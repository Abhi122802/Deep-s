import { Request, Response, NextFunction } from 'express';
import { OrderModel, IOrderItem } from '../models/Order.js';
import { CakeModel } from '../models/Cake.js';
import { isDbConnected } from '../config/db.js';
import { DEMO_CAKES } from '../data/cakes.js';
import { notificationService } from '../notifications/notificationService.js';
import { logger } from '../utils/logger.js';

export async function createOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { customer, items, couponCode, deliveryNotes, idempotencyKey } = req.body;

    // 1. Idempotency check to prevent accidental duplicate order creation
    if (idempotencyKey && isDbConnected()) {
      const existingOrder = await OrderModel.findOne({ idempotencyKey });
      if (existingOrder) {
        res.status(200).json({
          success: true,
          message: 'Order already processed (idempotent response)',
          orderId: existingOrder.orderId,
          data: existingOrder,
        });
        return;
      }
    }

    // 2. Fetch cakes from Database and calculate price server-side
    const validatedItems: IOrderItem[] = [];
    let calculatedSubtotal = 0;

    for (const item of items) {
      let cakeRecord: any = null;

      if (isDbConnected()) {
        if (item.cakeId.match(/^[0-9a-fA-F]{24}$/)) {
          cakeRecord = await CakeModel.findById(item.cakeId);
        }
        if (!cakeRecord) {
          cakeRecord = await CakeModel.findOne({
            $or: [{ slug: item.cakeId }, { name: item.cakeId }],
          });
        }
      }

      // Fallback lookup from DEMO_CAKES if not found in DB
      if (!cakeRecord) {
        cakeRecord = DEMO_CAKES.find(
          (c) => c.id === item.cakeId || c.slug === item.cakeId || c.name === item.cakeId
        );
      }

      if (!cakeRecord) {
        res.status(400).json({
          success: false,
          message: `Product with identifier "${item.cakeId}" is invalid or unavailable.`,
        });
        return;
      }

      // Validate weight price on server
      const weightPriceMap = cakeRecord.weightPrices as Record<string, number>;
      const serverUnitPrice = weightPriceMap[item.selectedWeight] || cakeRecord.basePrice;

      if (!serverUnitPrice || serverUnitPrice <= 0) {
        res.status(400).json({
          success: false,
          message: `Invalid weight option "${item.selectedWeight}" for cake "${cakeRecord.name}".`,
        });
        return;
      }

      const lineTotal = serverUnitPrice * item.quantity;
      calculatedSubtotal += lineTotal;

      validatedItems.push({
        cakeId: cakeRecord.id || cakeRecord._id?.toString() || item.cakeId,
        cakeName: cakeRecord.name,
        selectedWeight: item.selectedWeight,
        unitPrice: serverUnitPrice,
        quantity: item.quantity,
        customMessage: item.customMessage?.trim() || undefined,
        lineTotal,
      });
    }

    // 3. Server-side discount calculation (e.g. SWEET10 gives 10% off)
    let discountAmount = 0;
    const cleanCoupon = couponCode ? couponCode.trim().toUpperCase() : '';
    if (cleanCoupon === 'SWEET10' || cleanCoupon === 'DEEPS10') {
      discountAmount = Math.round(calculatedSubtotal * 0.1);
    }

    // 4. Server-side delivery fee calculation (Free above ₹799, else ₹99)
    const deliveryFee = calculatedSubtotal >= 799 ? 0 : 99;

    // 5. Server-side Grand Total calculation
    const grandTotal = Math.max(0, calculatedSubtotal - discountAmount + deliveryFee);

    // 6. Generate unique order ID
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderId = `ORD-${randomSuffix}`;

    const rawPreferences = req.body.notificationPreferences || req.body.customerConsent || {};
    const notificationPreferences = {
      email: rawPreferences.email !== false,
      whatsapp: Boolean(rawPreferences.whatsapp),
      sms: Boolean(rawPreferences.sms),
    };

    const orderPayload = {
      orderId,
      idempotencyKey: idempotencyKey || undefined,
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        email: customer.email.trim(),
        address: customer.address?.trim() || undefined,
      },
      notificationPreferences,
      items: validatedItems,
      subtotal: calculatedSubtotal,
      discountAmount,
      couponCode: cleanCoupon || undefined,
      deliveryFee,
      grandTotal,
      deliveryNotes: deliveryNotes?.trim() || undefined,
      status: 'Pending' as const,
      paymentStatus: 'Unpaid' as const,
    };

    let savedOrderResponse: any;

    if (isDbConnected()) {
      const savedOrder = await OrderModel.create(orderPayload);
      savedOrderResponse = savedOrder;
    } else {
      // Fallback response when DB connection is pending in dev/test
      const { addMemoryOrder } = await import('./adminOrder.controller.js');
      addMemoryOrder(orderPayload);
      savedOrderResponse = orderPayload;
    }

    // Trigger non-blocking asynchronous order placed notification AFTER database persistence
    notificationService
      .sendOrderPlacedNotification(
        {
          orderId,
          customerName: orderPayload.customer.name,
          items: orderPayload.items,
          subtotal: orderPayload.subtotal,
          discountAmount: orderPayload.discountAmount,
          couponCode: orderPayload.couponCode,
          deliveryFee: orderPayload.deliveryFee,
          grandTotal: orderPayload.grandTotal,
          deliveryAddress: orderPayload.customer.address,
          deliveryNotes: orderPayload.deliveryNotes,
          createdAt: new Date(),
          email: orderPayload.customer.email,
          phone: orderPayload.customer.phone,
        } as any,
        notificationPreferences
      )
      .catch((notifErr: any) => {
        logger.warn(`[Notification Note] Could not dispatch order placed notification: ${notifErr.message}`);
      });

    res.status(201).json({
      success: true,
      orderId,
      message: isDbConnected()
        ? 'Order placed successfully and recorded in database.'
        : 'Demo order received successfully (simulated storage).',
      data: savedOrderResponse,
    });
    return;
  } catch (error) {
    next(error);
  }
}

export async function getOrderById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orderId = String(req.params.orderId);

    if (!isDbConnected()) {
      res.status(503).json({
        success: false,
        message: 'Database is currently offline. Please try again shortly.',
      });
      return;
    }

    const order = await OrderModel.findOne({ orderId }).lean();

    if (!order) {
      res.status(404).json({
        success: false,
        message: `Order with reference "${orderId}" was not found.`,
      });
      return;
    }

    // Safe customer view (hide internal tokens if any)
    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        customerName: order.customer.name,
        items: order.items,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        deliveryFee: order.deliveryFee,
        grandTotal: order.grandTotal,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
