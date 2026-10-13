import { Request, Response, NextFunction } from 'express';
import { CustomCakeInquiryModel } from '../models/CustomCakeInquiry.js';
import { uploadImageBuffer } from '../config/cloudinary.js';
import { isDbConnected } from '../config/db.js';
import { MEMORY_INQUIRIES } from './adminInquiry.controller.js';

function calculateEstimatedQuote(weight: string, tierCount: string): number {
  let base = 800;
  if (weight === '1 kg') base = 1500;
  if (weight === '1.5 kg') base = 2200;
  if (weight === '2 kg') base = 2900;
  if (weight === '3 kg+') base = 4200;

  if (tierCount === '2 Tiers') base += 600;
  if (tierCount === '3 Tiers') base += 1400;
  return base;
}

export async function createCustomCakeInquiry(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = req.file;
    let referenceImageUrl: string | undefined = undefined;
    let referenceImagePublicId: string | undefined = undefined;

    // Handle uploaded file if present
    if (file) {
      try {
        const uploadResult = await uploadImageBuffer(file, 'deeps_custom_cakes');
        referenceImageUrl = uploadResult.url;
        referenceImagePublicId = uploadResult.publicId;
      } catch (uploadErr: any) {
        res.status(400).json({
          success: false,
          message: `Failed to upload reference image: ${uploadErr.message}`,
        });
        return;
      }
    }

    const {
      customerName,
      phone,
      email,
      occasion,
      flavor,
      weight = '1 kg',
      tierCount = '1 Tier',
      isEggless = true,
      messageOnCake,
      preferredDate,
      deliveryTimeSlot = '12:00 PM – 3:00 PM',
      deliveryAddress,
      specialInstructions,
    } = req.body;

    // Generate unique inquiry reference ID
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const referenceId = `INQ-${randomSuffix}`;

    const estimatedPrice = calculateEstimatedQuote(weight, tierCount);

    const rawPreferences = req.body.notificationPreferences || req.body.customerConsent || {};
    const notificationPreferences = {
      email: rawPreferences.email !== false,
      whatsapp: Boolean(rawPreferences.whatsapp),
      sms: Boolean(rawPreferences.sms),
    };

    const inquiryPayload = {
      referenceId,
      customerName,
      phone,
      email,
      occasion,
      flavor,
      weight,
      tierCount,
      isEggless: Boolean(isEggless),
      messageOnCake: messageOnCake?.trim() || undefined,
      preferredDate,
      deliveryTimeSlot,
      deliveryAddress: deliveryAddress?.trim() || undefined,
      specialInstructions: specialInstructions?.trim() || undefined,
      referenceImageUrl,
      referenceImagePublicId,
      estimatedPrice,
      status: 'pending',
      notificationPreferences,
    };

    if (isDbConnected()) {
      const savedInquiry = await CustomCakeInquiryModel.create(inquiryPayload);
      res.status(201).json({
        success: true,
        inquiryId: referenceId,
        message: `Your custom cake request (#${referenceId}) has been successfully submitted! Our pastry chef will contact you within 2 business hours.`,
        data: savedInquiry,
      });
      return;
    }

    // If database is not connected, store in memory inquiries and return structured response
    const inMemoryDoc = {
      _id: `mem_inq_${randomSuffix}`,
      id: `mem_inq_${randomSuffix}`,
      ...inquiryPayload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    MEMORY_INQUIRIES.unshift(inMemoryDoc);

    res.status(201).json({
      success: true,
      inquiryId: referenceId,
      message: `Your custom cake request (#${referenceId}) has been recorded! Our head chef will contact you shortly.`,
      data: inMemoryDoc,
    });
  } catch (error) {
    next(error);
  }
}

export async function getInquiryByReference(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const referenceId = String(req.params.referenceId)?.trim().toUpperCase();

    if (isDbConnected()) {
      const inquiry = await CustomCakeInquiryModel.findOne({ referenceId });

      if (!inquiry) {
        res.status(404).json({
          success: false,
          message: `Custom cake inquiry with reference "${referenceId}" was not found.`,
        });
        return;
      }

      // Return safe customer projection without sensitive administrative logs
      res.json({
        success: true,
        data: {
          referenceId: inquiry.referenceId,
          customerName: inquiry.customerName,
          occasion: inquiry.occasion,
          flavor: inquiry.flavor,
          weight: inquiry.weight,
          tierCount: inquiry.tierCount,
          isEggless: inquiry.isEggless,
          preferredDate: inquiry.preferredDate,
          deliveryTimeSlot: inquiry.deliveryTimeSlot,
          estimatedPrice: inquiry.estimatedPrice,
          status: inquiry.status,
          quotedAmount: inquiry.quotedAmount,
          quoteCurrency: inquiry.quoteCurrency,
          quoteValidUntil: inquiry.quoteValidUntil,
          quoteNotes: inquiry.quoteNotes,
          referenceImageUrl: inquiry.referenceImageUrl,
          createdAt: inquiry.createdAt,
        },
      });
      return;
    }

    // In-memory fallback
    const inquiry = MEMORY_INQUIRIES.find(
      (inq) => inq.referenceId?.toUpperCase() === referenceId
    );

    if (!inquiry) {
      res.status(404).json({
        success: false,
        message: `Custom cake inquiry with reference "${referenceId}" was not found.`,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        referenceId: inquiry.referenceId,
        customerName: inquiry.customerName,
        occasion: inquiry.occasion,
        flavor: inquiry.flavor,
        weight: inquiry.weight,
        tierCount: inquiry.tierCount,
        isEggless: inquiry.isEggless,
        preferredDate: inquiry.preferredDate,
        deliveryTimeSlot: inquiry.deliveryTimeSlot,
        estimatedPrice: inquiry.estimatedPrice,
        status: inquiry.status,
        quotedAmount: inquiry.quotedAmount,
        quoteCurrency: inquiry.quoteCurrency,
        quoteValidUntil: inquiry.quoteValidUntil,
        quoteNotes: inquiry.quoteNotes,
        referenceImageUrl: inquiry.referenceImageUrl,
        createdAt: inquiry.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
