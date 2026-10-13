import { Request, Response, NextFunction } from 'express';
import { OrderModel, IOrder } from '../models/Order.js';
import { isDbConnected } from '../config/db.js';
import { notificationService } from '../notifications/notificationService.js';

export const VALID_ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Baking',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
] as const;

export type OrderStatus = (typeof VALID_ORDER_STATUSES)[number];

export const PERMITTED_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Baking', 'Cancelled'],
  Baking: ['Out for Delivery', 'Cancelled'],
  'Out for Delivery': ['Delivered', 'Cancelled'],
  Delivered: [], // Terminal status: no transitions permitted
  Cancelled: [], // Terminal status: no transitions permitted
};

/**
 * Validates order identifier format (24-char hex MongoDB ObjectId or ORD-XXXXX reference)
 */
export function isValidOrderIdentifier(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) return true;
  if (/^ORD-[A-Za-z0-9_-]+$/i.test(trimmed)) return true;
  return false;
}

/**
 * In-memory fallback orders for resilient operations and automated tests
 */
export const MEMORY_ORDERS: any[] = [
  {
    _id: '67a000000000000000000001',
    id: '67a000000000000000000001',
    orderId: 'ORD-781920',
    customer: {
      name: 'Ananya Sharma',
      phone: '9876543210',
      email: 'ananya@example.com',
      address: 'Flat 402, Lotus Grand, MG Road, Mumbai 400001',
    },
    items: [
      {
        cakeId: 'belgian-truffle-opera-cake',
        cakeName: 'Belgian Truffle Opera Cake',
        selectedWeight: '1 kg',
        unitPrice: 1499,
        quantity: 1,
        customMessage: 'Happy Birthday Ananya!',
        lineTotal: 1499,
      },
    ],
    subtotal: 1499,
    discountAmount: 150,
    couponCode: 'SWEET10',
    deliveryFee: 0,
    grandTotal: 1349,
    deliveryNotes: 'Please ring bell twice and leave with security if unavailable.',
    status: 'Pending',
    paymentStatus: 'Unpaid',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    _id: '67a000000000000000000002',
    id: '67a000000000000000000002',
    orderId: 'ORD-781921',
    customer: {
      name: 'Rohan Mehta',
      phone: '9823456789',
      email: 'rohan.mehta@example.com',
      address: '12B, Sea Green View, Worli, Mumbai 400018',
    },
    items: [
      {
        cakeId: 'red-velvet-cream-cheese-cake',
        cakeName: 'Red Velvet Royale with Cream Cheese',
        selectedWeight: '0.5 kg',
        unitPrice: 749,
        quantity: 1,
        customMessage: 'Happy Anniversary!',
        lineTotal: 749,
      },
    ],
    subtotal: 749,
    discountAmount: 0,
    deliveryFee: 99,
    grandTotal: 848,
    status: 'Confirmed',
    paymentStatus: 'Paid',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    _id: '67a000000000000000000003',
    id: '67a000000000000000000003',
    orderId: 'ORD-781922',
    customer: {
      name: 'Priya Iyer',
      phone: '9934567890',
      email: 'priya.iyer@example.com',
      address: 'Apt 101, Palm Court, Bandra West, Mumbai 400050',
    },
    items: [
      {
        cakeId: 'black-forest-royale-kirsch-cake',
        cakeName: 'Black Forest Royale',
        selectedWeight: '1.5 kg',
        unitPrice: 1999,
        quantity: 1,
        lineTotal: 1999,
      },
    ],
    subtotal: 1999,
    discountAmount: 0,
    deliveryFee: 0,
    grandTotal: 1999,
    status: 'Baking',
    paymentStatus: 'Paid',
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    _id: '67a000000000000000000004',
    id: '67a000000000000000000004',
    orderId: 'ORD-781923',
    customer: {
      name: 'Vikram Malhotra',
      phone: '9845012345',
      email: 'vikram.m@example.com',
      address: 'Tower 4, Emerald Heights, Powai, Mumbai 400076',
    },
    items: [
      {
        cakeId: 'belgian-truffle-opera-cake',
        cakeName: 'Belgian Truffle Opera Cake',
        selectedWeight: '0.5 kg',
        unitPrice: 799,
        quantity: 2,
        lineTotal: 1598,
      },
    ],
    subtotal: 1598,
    discountAmount: 160,
    couponCode: 'DEEPS10',
    deliveryFee: 0,
    grandTotal: 1438,
    status: 'Out for Delivery',
    paymentStatus: 'Paid',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    _id: '67a000000000000000000005',
    id: '67a000000000000000000005',
    orderId: 'ORD-781924',
    customer: {
      name: 'Kavita Das',
      phone: '9712345678',
      email: 'kavita.das@example.com',
      address: '503, Symphony Towers, Andheri East, Mumbai 400069',
    },
    items: [
      {
        cakeId: 'fresh-fruit-vanilla-gateau',
        cakeName: 'Fresh Exotic Fruit Gateau',
        selectedWeight: '1 kg',
        unitPrice: 1299,
        quantity: 1,
        lineTotal: 1299,
      },
    ],
    subtotal: 1299,
    discountAmount: 0,
    deliveryFee: 0,
    grandTotal: 1299,
    status: 'Delivered',
    paymentStatus: 'Paid',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
  },
  {
    _id: '67a000000000000000000006',
    id: '67a000000000000000000006',
    orderId: 'ORD-781925',
    customer: {
      name: 'Sunil Nair',
      phone: '9867012345',
      email: 'sunil.nair@example.com',
      address: 'Flat 12, Gulmohar Enclave, Juhu, Mumbai 400049',
    },
    items: [
      {
        cakeId: 'mango-passion-fruit-mousse-cake',
        cakeName: 'Alphonso Mango & Passion Mousse',
        selectedWeight: '0.5 kg',
        unitPrice: 849,
        quantity: 1,
        lineTotal: 849,
      },
    ],
    subtotal: 849,
    discountAmount: 0,
    deliveryFee: 0,
    grandTotal: 849,
    status: 'Cancelled',
    paymentStatus: 'Unpaid',
    createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 35).toISOString(),
  },
];

export function addMemoryOrder(order: any): void {
  MEMORY_ORDERS.unshift({
    ...order,
    _id: order._id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    id: order.id || order.orderId,
    createdAt: order.createdAt || new Date().toISOString(),
    updatedAt: order.updatedAt || new Date().toISOString(),
  });
}

/**
 * GET /api/admin/orders
 * Protected admin endpoint to list and paginate customer orders
 */
export async function getAdminOrders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const status = req.query.status ? String(req.query.status).trim() : 'All';
    const search = req.query.search ? String(req.query.search).trim() : '';
    const sortBy = req.query.sortBy ? String(req.query.sortBy).trim() : 'newest';

    // 1. If database is connected, query MongoDB
    if (isDbConnected()) {
      const filter: any = {};

      if (status && status !== 'All') {
        filter.status = status;
      }

      if (search) {
        const regex = new RegExp(search, 'i');
        filter.$or = [
          { orderId: regex },
          { 'customer.name': regex },
          { 'customer.phone': regex },
          { 'customer.email': regex },
        ];
      }

      let sortQuery: any = { createdAt: -1 };
      if (sortBy === 'oldest') sortQuery = { createdAt: 1 };
      else if (sortBy === 'amount-desc') sortQuery = { grandTotal: -1 };
      else if (sortBy === 'amount-asc') sortQuery = { grandTotal: 1 };

      const skip = (page - 1) * limit;

      const [totalOrders, orders] = await Promise.all([
        OrderModel.countDocuments(filter),
        OrderModel.find(filter)
          .sort(sortQuery)
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      const totalPages = Math.ceil(totalOrders / limit) || 1;

      res.json({
        success: true,
        pagination: {
          page,
          limit,
          totalOrders,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        data: orders,
      });
      return;
    }

    // 2. Fallback memory filtering for resilience and automated unit tests
    let filtered = [...MEMORY_ORDERS];

    if (status && status !== 'All') {
      filtered = filtered.filter((o) => o.status === status);
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.orderId.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.phone.toLowerCase().includes(q) ||
          o.customer.email.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortBy === 'amount-desc') {
      filtered.sort((a, b) => b.grandTotal - a.grandTotal);
    } else if (sortBy === 'amount-asc') {
      filtered.sort((a, b) => a.grandTotal - b.grandTotal);
    } else {
      // Default: newest
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const totalOrders = filtered.length;
    const totalPages = Math.ceil(totalOrders / limit) || 1;
    const skip = (page - 1) * limit;
    const paginated = filtered.slice(skip, skip + limit);

    res.json({
      success: true,
      pagination: {
        page,
        limit,
        totalOrders,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      data: paginated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/orders/:id
 * Protected admin endpoint to retrieve complete order details by MongoDB _id or orderId
 */
export async function getAdminOrderById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id || '');

    if (!isValidOrderIdentifier(rawId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid order identifier format. Must be a 24-character hex ID or order reference (ORD-XXXXXX).',
      });
      return;
    }

    const id = rawId.trim();

    // 1. If database is connected, query MongoDB
    if (isDbConnected()) {
      const query = id.match(/^[0-9a-fA-F]{24}$/)
        ? { $or: [{ _id: id }, { orderId: id }] }
        : { orderId: id };

      const order = await OrderModel.findOne(query).lean();

      if (!order) {
        res.status(404).json({
          success: false,
          message: `Order with reference "${id}" was not found.`,
        });
        return;
      }

      res.json({
        success: true,
        data: order,
      });
      return;
    }

    // 2. Memory lookup fallback
    const memoryOrder = MEMORY_ORDERS.find(
      (o) => o._id === id || o.id === id || o.orderId.toUpperCase() === id.toUpperCase()
    );

    if (!memoryOrder) {
      res.status(404).json({
        success: false,
        message: `Order with reference "${id}" was not found.`,
      });
      return;
    }

    res.json({
      success: true,
      data: memoryOrder,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/orders/:id/status
 * Protected admin endpoint to update order fulfillment status with strict transition rules
 */
export async function updateAdminOrderStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id || '');

    if (!isValidOrderIdentifier(rawId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid order identifier format. Must be a 24-character hex ID or order reference (ORD-XXXXXX).',
      });
      return;
    }

    const id = rawId.trim();
    const newStatus = req.body.status as OrderStatus;

    // Validate that newStatus is one of the 6 permitted statuses
    if (!VALID_ORDER_STATUSES.includes(newStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid status "${newStatus}". Must be one of: ${VALID_ORDER_STATUSES.join(', ')}`,
      });
      return;
    }

    // 1. If database is connected, load and update via Mongoose
    if (isDbConnected()) {
      const query = id.match(/^[0-9a-fA-F]{24}$/)
        ? { $or: [{ _id: id }, { orderId: id }] }
        : { orderId: id };

      const order = await OrderModel.findOne(query);

      if (!order) {
        res.status(404).json({
          success: false,
          message: `Order with reference "${id}" was not found.`,
        });
        return;
      }

      const currentStatus = order.status as OrderStatus;

      // Rule: cannot transition to the same status
      if (currentStatus === newStatus) {
        res.status(400).json({
          success: false,
          message: `Order is already in "${currentStatus}" status. Please select a valid subsequent status.`,
        });
        return;
      }

      // Rule: Delivered is a terminal status
      if (currentStatus === 'Delivered') {
        res.status(400).json({
          success: false,
          message: 'Cannot change status of a Delivered order. Delivered is a terminal fulfillment status.',
        });
        return;
      }

      // Rule: Cancelled is a terminal status
      if (currentStatus === 'Cancelled') {
        res.status(400).json({
          success: false,
          message: 'Cannot change status of a Cancelled order. Cancelled is a terminal fulfillment status.',
        });
        return;
      }

      // Rule: Transition must be explicitly permitted
      const permittedNext = PERMITTED_STATUS_TRANSITIONS[currentStatus] || [];
      if (!permittedNext.includes(newStatus)) {
        res.status(400).json({
          success: false,
          message: `Invalid status transition from "${currentStatus}" to "${newStatus}". Allowed transitions: ${permittedNext.join(', ') || 'None (terminal status)'}.`,
        });
        return;
      }

      const previousStatus = order.status;

      // Update fulfillment status only — paymentStatus and pricing totals remain untouched!
      order.status = newStatus;
      await order.save();

      // Trigger non-blocking asynchronous order status transition notification
      notificationService
        .sendOrderStatusNotification(
          {
            orderId: order.orderId,
            customerName: order.customer?.name || 'Customer',
            previousStatus,
            newStatus,
            deliveryAddress: order.customer?.address,
            itemCount: order.items?.length,
          },
          order.customer?.email,
          order.customer?.phone,
          (order as any).notificationPreferences
        )
        .catch((notifErr: any) => {
          console.warn(`[Notification Note] Could not dispatch order status notification: ${notifErr.message}`);
        });

      res.json({
        success: true,
        message: `Order status successfully transitioned from "${previousStatus}" to "${newStatus}".`,
        data: order,
      });
      return;
    }

    // 2. Memory fallback update for tests and offline development
    const memoryOrder = MEMORY_ORDERS.find(
      (o) => o._id === id || o.id === id || o.orderId.toUpperCase() === id.toUpperCase()
    );

    if (!memoryOrder) {
      res.status(404).json({
        success: false,
        message: `Order with reference "${id}" was not found.`,
      });
      return;
    }

    const currentStatus = memoryOrder.status as OrderStatus;

    if (currentStatus === newStatus) {
      res.status(400).json({
        success: false,
        message: `Order is already in "${currentStatus}" status. Please select a valid subsequent status.`,
      });
      return;
    }

    if (currentStatus === 'Delivered') {
      res.status(400).json({
        success: false,
        message: 'Cannot change status of a Delivered order. Delivered is a terminal fulfillment status.',
      });
      return;
    }

    if (currentStatus === 'Cancelled') {
      res.status(400).json({
        success: false,
        message: 'Cannot change status of a Cancelled order. Cancelled is a terminal fulfillment status.',
      });
      return;
    }

    const permittedNext = PERMITTED_STATUS_TRANSITIONS[currentStatus] || [];
    if (!permittedNext.includes(newStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid status transition from "${currentStatus}" to "${newStatus}". Allowed transitions: ${permittedNext.join(', ') || 'None (terminal status)'}.`,
      });
      return;
    }

    const previousStatus = memoryOrder.status;
    memoryOrder.status = newStatus;
    memoryOrder.updatedAt = new Date().toISOString();

    // Trigger non-blocking asynchronous order status transition notification
    notificationService
      .sendOrderStatusNotification(
        {
          orderId: memoryOrder.orderId,
          customerName: memoryOrder.customer?.name || 'Customer',
          previousStatus,
          newStatus,
          deliveryAddress: memoryOrder.customer?.address,
          itemCount: memoryOrder.items?.length,
        },
        memoryOrder.customer?.email,
        memoryOrder.customer?.phone,
        memoryOrder.notificationPreferences
      )
      .catch((notifErr: any) => {
        console.warn(`[Notification Note] Could not dispatch order status notification: ${notifErr.message}`);
      });

    res.json({
      success: true,
      message: `Order status successfully transitioned from "${previousStatus}" to "${newStatus}".`,
      data: memoryOrder,
    });
  } catch (error) {
    next(error);
  }
}
