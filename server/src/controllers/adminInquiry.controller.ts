import { Request, Response, NextFunction } from 'express';
import { CustomCakeInquiryModel, ICustomCakeInquiry } from '../models/CustomCakeInquiry.js';
import { isDbConnected } from '../config/db.js';
import { notificationService } from '../notifications/notificationService.js';

export const VALID_INQUIRY_STATUSES = [
  'pending',
  'reviewed',
  'quoted',
  'confirmed',
  'cancelled',
] as const;

export type InquiryStatus = (typeof VALID_INQUIRY_STATUSES)[number];

export const PERMITTED_INQUIRY_STATUS_TRANSITIONS: Record<
  InquiryStatus,
  readonly InquiryStatus[]
> = {
  pending: ['reviewed', 'quoted', 'cancelled'],
  reviewed: ['quoted', 'confirmed', 'cancelled'],
  quoted: ['confirmed', 'reviewed', 'cancelled'],
  confirmed: ['cancelled'],
  cancelled: [], // Terminal status: no transitions permitted once cancelled
};

/**
 * Validates inquiry identifier (24-char hex MongoDB ObjectId or INQ-XXXXXX reference)
 */
export function isValidInquiryIdentifier(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) return true;
  if (/^INQ-[A-Za-z0-9_-]+$/i.test(trimmed)) return true;
  return false;
}

/**
 * In-memory fallback inquiries for resilient operation and automated testing
 */
export const MEMORY_INQUIRIES: any[] = [
  {
    _id: '67b000000000000000000001',
    id: '67b000000000000000000001',
    referenceId: 'INQ-781920',
    customerName: 'Ananya Sharma',
    phone: '9876543210',
    email: 'ananya@example.com',
    occasion: '25th Silver Wedding Anniversary',
    flavor: 'Belgian Chocolate Truffle with Hazelnut Praline',
    weight: '2 kg',
    tierCount: '2 Tiers',
    isEggless: true,
    messageOnCake: 'Silver Jubliee Cheers Mom & Dad',
    preferredDate: '2026-11-20',
    deliveryTimeSlot: '3:00 PM – 6:00 PM',
    deliveryAddress: 'Flat 402, Lotus Grand, MG Road, Mumbai 400001',
    specialInstructions: 'White fondant with delicate silver edible lace and sugar roses.',
    referenceImageUrl: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80',
    referenceImagePublicId: 'sample_inq_1',
    estimatedPrice: 3500,
    status: 'pending',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: '67b000000000000000000002',
    id: '67b000000000000000000002',
    referenceId: 'INQ-452109',
    customerName: 'Vikram Malhotra',
    phone: '9820011223',
    email: 'vikram.m@example.com',
    occasion: 'Grand Wedding Reception',
    flavor: 'Royal Red Velvet & Madagascar Vanilla Bean',
    weight: '3 kg+',
    tierCount: '3 Tiers',
    isEggless: false,
    messageOnCake: 'Forever & Always V & S',
    preferredDate: '2026-12-05',
    deliveryTimeSlot: '12:00 PM – 3:00 PM',
    deliveryAddress: 'Grand Ballroom, Taj Lands End, Bandra, Mumbai 400050',
    specialInstructions: 'Cascading cascading fresh sugar flowers matching burgundy theme.',
    referenceImageUrl: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80',
    referenceImagePublicId: 'sample_inq_2',
    estimatedPrice: 5600,
    status: 'reviewed',
    reviewedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    internalNotes: 'Reviewed with Head Chef Arjun. Feasible for requested date.',
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: '67b000000000000000000003',
    id: '67b000000000000000000003',
    referenceId: 'INQ-319842',
    customerName: 'Meera Iyer',
    phone: '9930044556',
    email: 'meera.iyer@example.com',
    occasion: '30th Milestone Birthday',
    flavor: 'New York Baked Blueberry Cheesecake',
    weight: '1.5 kg',
    tierCount: '1 Tier',
    isEggless: true,
    messageOnCake: 'Fabulous at 30 Meera',
    preferredDate: '2026-11-15',
    deliveryTimeSlot: '6:00 PM – 9:00 PM',
    deliveryAddress: 'Villa 12, Palm Meadows, Worli, Mumbai 400018',
    specialInstructions: 'Decorate with fresh imported blueberries and edible gold leaves.',
    referenceImageUrl: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80',
    referenceImagePublicId: 'sample_inq_3',
    estimatedPrice: 2200,
    status: 'quoted',
    quotedAmount: 2650,
    quoteCurrency: 'INR',
    quoteValidityDays: 7,
    quoteValidUntil: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    quoteNotes: 'Includes customized acrylic golden cake topper, organic berries and premium gift box packaging.',
    reviewedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    quotedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: '67b000000000000000000004',
    id: '67b00000000000000000004',
    referenceId: 'INQ-890123',
    customerName: 'Rohan Kapur',
    phone: '9811122334',
    email: 'rohan.k@example.com',
    occasion: 'Traditional Housewarming & Pooja',
    flavor: 'Persian Pistachio Saffron & Rose Delice',
    weight: '2 kg',
    tierCount: '2 Tiers',
    isEggless: true,
    messageOnCake: 'Shubh Aarambh Kapur Niwas',
    preferredDate: '2026-11-12',
    deliveryTimeSlot: '9:00 AM – 12:00 PM',
    deliveryAddress: 'Flat 1102, Sky Greens, Powai, Mumbai 400076',
    specialInstructions: 'Strictly 100% pure vegetarian / eggless ingredients only.',
    estimatedPrice: 3500,
    status: 'confirmed',
    quotedAmount: 3800,
    quoteCurrency: 'INR',
    quoteValidityDays: 7,
    quoteNotes: 'Saffron pistachio cream with cardamom essence and crushed Iranian pistachios.',
    reviewedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    quotedAt: new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(),
    confirmedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 52 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: '67b000000000000000000005',
    id: '67b00000000000000000005',
    referenceId: 'INQ-654321',
    customerName: 'Sneha Kulkarni',
    phone: '9769988776',
    email: 'sneha.k@example.com',
    occasion: 'Baby Shower Party',
    flavor: 'Tropical Mango Passionfruit Cream',
    weight: '1 kg',
    tierCount: '1 Tier',
    isEggless: true,
    preferredDate: '2026-11-01',
    deliveryTimeSlot: '12:00 PM – 3:00 PM',
    estimatedPrice: 1500,
    status: 'cancelled',
    internalNotes: 'Client postponed event date indefinitely due to family travel.',
    cancelledAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 90 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  },
];

/**
 * Format inquiry document safely
 */
export function formatAdminInquiry(doc: any): any {
  return {
    id: doc._id?.toString() || doc.id,
    referenceId: doc.referenceId,
    customerName: doc.customerName,
    phone: doc.phone,
    email: doc.email,
    occasion: doc.occasion,
    flavor: doc.flavor,
    weight: doc.weight,
    tierCount: doc.tierCount,
    isEggless: Boolean(doc.isEggless),
    messageOnCake: doc.messageOnCake,
    preferredDate: doc.preferredDate,
    deliveryTimeSlot: doc.deliveryTimeSlot,
    deliveryAddress: doc.deliveryAddress,
    specialInstructions: doc.specialInstructions,
    referenceImageUrl: doc.referenceImageUrl,
    referenceImagePublicId: doc.referenceImagePublicId,
    estimatedPrice: doc.estimatedPrice,
    status: doc.status,
    quotedAmount: doc.quotedAmount,
    quoteCurrency: doc.quoteCurrency || 'INR',
    quoteValidityDays: doc.quoteValidityDays,
    quoteValidUntil: doc.quoteValidUntil,
    quoteNotes: doc.quoteNotes,
    internalNotes: doc.internalNotes,
    reviewedAt: doc.reviewedAt,
    quotedAt: doc.quotedAt,
    confirmedAt: doc.confirmedAt,
    cancelledAt: doc.cancelledAt,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
  };
}

/**
 * GET /api/admin/inquiries
 * Retrieves paginated, searchable, and filtered custom cake inquiries
 */
export async function getAdminInquiries(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const search = (req.query.search as string)?.trim();
    const status = (req.query.status as string)?.trim().toLowerCase();
    const sortBy = (req.query.sortBy as string)?.trim() || 'createdAt';
    const sortOrder = (req.query.sortOrder as string)?.trim().toLowerCase() === 'asc' ? 1 : -1;

    if (isDbConnected()) {
      const query: any = {};

      if (status && status !== 'all' && VALID_INQUIRY_STATUSES.includes(status as InquiryStatus)) {
        query.status = status;
      }

      if (search) {
        const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
          { referenceId: searchRegex },
          { customerName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { occasion: searchRegex },
          { flavor: searchRegex },
        ];
      }

      const total = await CustomCakeInquiryModel.countDocuments(query);
      const totalPages = Math.ceil(total / limit) || 1;

      const validSortFields: Record<string, string> = {
        createdAt: 'createdAt',
        preferredDate: 'preferredDate',
        estimatedPrice: 'estimatedPrice',
        customerName: 'customerName',
        status: 'status',
      };
      const mongoSortField = validSortFields[sortBy] || 'createdAt';

      const inquiries = await CustomCakeInquiryModel.find(query)
        .sort({ [mongoSortField]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      res.json({
        success: true,
        data: inquiries.map(formatAdminInquiry),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
      return;
    }

    // Fallback: In-memory inquiries filter, search, sort, and pagination
    let filtered = [...MEMORY_INQUIRIES];

    if (status && status !== 'all' && VALID_INQUIRY_STATUSES.includes(status as InquiryStatus)) {
      filtered = filtered.filter((inq) => inq.status === status);
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (inq) =>
          inq.referenceId?.toLowerCase().includes(q) ||
          inq.customerName?.toLowerCase().includes(q) ||
          inq.email?.toLowerCase().includes(q) ||
          inq.phone?.includes(q) ||
          inq.occasion?.toLowerCase().includes(q) ||
          inq.flavor?.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (sortBy === 'createdAt') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (sortBy === 'estimatedPrice') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 1 ? -1 : 1;
      if (valA > valB) return sortOrder === 1 ? 1 : -1;
      return 0;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      data: paginated.map(formatAdminInquiry),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/inquiries/:id
 * Retrieves full details of a specific custom cake inquiry by MongoDB ID or INQ reference ID
 */
export async function getAdminInquiryById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId.trim() : '';

    if (!isValidInquiryIdentifier(id)) {
      res.status(400).json({
        success: false,
        message: `Invalid inquiry identifier format "${id}". Must be a valid MongoDB ObjectId or INQ-XXXXXX reference ID.`,
      });
      return;
    }

    if (isDbConnected()) {
      let inquiry = null;
      if (/^[0-9a-fA-F]{24}$/.test(id)) {
        inquiry = await CustomCakeInquiryModel.findById(id).lean();
      }
      if (!inquiry) {
        inquiry = await CustomCakeInquiryModel.findOne({ referenceId: id.toUpperCase() }).lean();
      }

      if (!inquiry) {
        res.status(404).json({
          success: false,
          message: `Custom cake inquiry "${id}" was not found.`,
        });
        return;
      }

      res.json({
        success: true,
        data: formatAdminInquiry(inquiry),
      });
      return;
    }

    // In-memory fallback
    const inquiry = MEMORY_INQUIRIES.find(
      (inq) =>
        inq._id === id ||
        inq.id === id ||
        inq.referenceId?.toUpperCase() === id.toUpperCase()
    );

    if (!inquiry) {
      res.status(404).json({
        success: false,
        message: `Custom cake inquiry "${id}" was not found.`,
      });
      return;
    }

    res.json({
      success: true,
      data: formatAdminInquiry(inquiry),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/inquiries/:id/status
 * Updates inquiry status with quotation details, permitted transitions, and audit timestamps
 */
export async function updateAdminInquiryStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId.trim() : '';

    if (!isValidInquiryIdentifier(id)) {
      res.status(400).json({
        success: false,
        message: `Invalid inquiry identifier format "${id}". Must be a valid MongoDB ObjectId or INQ-XXXXXX reference ID.`,
      });
      return;
    }

    const {
      status: targetStatus,
      quotedAmount,
      quoteCurrency = 'INR',
      quoteValidityDays = 7,
      quoteNotes,
      internalNotes,
    } = req.body;

    if (isDbConnected()) {
      let inquiryDoc: ICustomCakeInquiry | null = null;
      if (/^[0-9a-fA-F]{24}$/.test(id)) {
        inquiryDoc = await CustomCakeInquiryModel.findById(id);
      }
      if (!inquiryDoc) {
        inquiryDoc = await CustomCakeInquiryModel.findOne({ referenceId: id.toUpperCase() });
      }

      if (!inquiryDoc) {
        res.status(404).json({
          success: false,
          message: `Custom cake inquiry "${id}" was not found.`,
        });
        return;
      }

      const currentStatus = inquiryDoc.status as InquiryStatus;

      // 1. Prevent redundant identical status transition
      if (currentStatus === targetStatus) {
        res.status(400).json({
          success: false,
          message: `Inquiry #${inquiryDoc.referenceId} is already in "${currentStatus}" status. No change applied.`,
        });
        return;
      }

      // 2. Validate permitted transition
      const permitted = PERMITTED_INQUIRY_STATUS_TRANSITIONS[currentStatus] || [];
      if (!permitted.includes(targetStatus)) {
        res.status(400).json({
          success: false,
          message: `Invalid status transition from "${currentStatus}" to "${targetStatus}". Permitted transitions: ${
            permitted.length > 0 ? permitted.join(', ') : 'none (terminal status)'
          }.`,
        });
        return;
      }

      // 3. Validate quotation if transitioning to 'quoted'
      if (targetStatus === 'quoted') {
        const finalQuoteAmount = typeof quotedAmount === 'number' ? quotedAmount : inquiryDoc.quotedAmount;
        if (!finalQuoteAmount || finalQuoteAmount <= 0) {
          res.status(400).json({
            success: false,
            message: 'A valid positive quote amount is required when providing a quotation.',
          });
          return;
        }
      }

      // 4. Apply status update and quotation metadata without touching customer requirements
      inquiryDoc.status = targetStatus;
      const now = new Date();

      if (targetStatus === 'reviewed') {
        inquiryDoc.reviewedAt = now;
      } else if (targetStatus === 'quoted') {
        inquiryDoc.quotedAt = now;
        inquiryDoc.quotedAmount = quotedAmount;
        inquiryDoc.quoteCurrency = quoteCurrency || 'INR';
        inquiryDoc.quoteValidityDays = quoteValidityDays || 7;
        inquiryDoc.quoteValidUntil = new Date(
          now.getTime() + (quoteValidityDays || 7) * 24 * 60 * 60 * 1000
        );
        if (quoteNotes !== undefined) {
          inquiryDoc.quoteNotes = quoteNotes?.trim();
        }
      } else if (targetStatus === 'confirmed') {
        inquiryDoc.confirmedAt = now;
      } else if (targetStatus === 'cancelled') {
        inquiryDoc.cancelledAt = now;
      }

      if (internalNotes !== undefined) {
        inquiryDoc.internalNotes = internalNotes?.trim();
      }

      await inquiryDoc.save();

      // Trigger non-blocking quotation notification if status was updated to quoted
      if (targetStatus === 'quoted' && inquiryDoc.quotedAmount) {
        notificationService
          .sendInquiryQuotationNotification(
            {
              referenceId: inquiryDoc.referenceId,
              customerName: inquiryDoc.customerName,
              occasion: inquiryDoc.occasion,
              flavor: inquiryDoc.flavor,
              weight: inquiryDoc.weight,
              tierCount: inquiryDoc.tierCount,
              isEggless: inquiryDoc.isEggless,
              preferredDate: inquiryDoc.preferredDate,
              deliveryTimeSlot: inquiryDoc.deliveryTimeSlot,
              quotedAmount: inquiryDoc.quotedAmount,
              quoteCurrency: inquiryDoc.quoteCurrency,
              quoteValidityDays: inquiryDoc.quoteValidityDays,
              quoteValidUntil: inquiryDoc.quoteValidUntil,
              quoteNotes: inquiryDoc.quoteNotes,
            },
            inquiryDoc.email,
            inquiryDoc.phone,
            inquiryDoc.notificationPreferences
          )
          .catch((notifErr: any) => {
            console.warn(`[Notification Note] Could not dispatch quotation proposal notification: ${notifErr.message}`);
          });
      }

      res.json({
        success: true,
        message: `Inquiry #${inquiryDoc.referenceId} status successfully updated to "${targetStatus}".`,
        data: formatAdminInquiry(inquiryDoc),
      });
      return;
    }

    // In-memory fallback
    const index = MEMORY_INQUIRIES.findIndex(
      (inq) =>
        inq._id === id ||
        inq.id === id ||
        inq.referenceId?.toUpperCase() === id.toUpperCase()
    );

    if (index === -1) {
      res.status(404).json({
        success: false,
        message: `Custom cake inquiry "${id}" was not found.`,
      });
      return;
    }

    const inq = MEMORY_INQUIRIES[index];
    const currentStatus = inq.status as InquiryStatus;

    if (currentStatus === targetStatus) {
      res.status(400).json({
        success: false,
        message: `Inquiry #${inq.referenceId} is already in "${currentStatus}" status. No change applied.`,
      });
      return;
    }

    const permitted = PERMITTED_INQUIRY_STATUS_TRANSITIONS[currentStatus] || [];
    if (!permitted.includes(targetStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid status transition from "${currentStatus}" to "${targetStatus}". Permitted transitions: ${
          permitted.length > 0 ? permitted.join(', ') : 'none (terminal status)'
        }.`,
      });
      return;
    }

    if (targetStatus === 'quoted') {
      const finalQuoteAmount = typeof quotedAmount === 'number' ? quotedAmount : inq.quotedAmount;
      if (!finalQuoteAmount || finalQuoteAmount <= 0) {
        res.status(400).json({
          success: false,
          message: 'A valid positive quote amount is required when providing a quotation.',
        });
        return;
      }
    }

    const now = new Date();
    inq.status = targetStatus;
    inq.updatedAt = now.toISOString();

    if (targetStatus === 'reviewed') {
      inq.reviewedAt = now.toISOString();
    } else if (targetStatus === 'quoted') {
      inq.quotedAt = now.toISOString();
      inq.quotedAmount = quotedAmount;
      inq.quoteCurrency = quoteCurrency || 'INR';
      inq.quoteValidityDays = quoteValidityDays || 7;
      inq.quoteValidUntil = new Date(
        now.getTime() + (quoteValidityDays || 7) * 24 * 60 * 60 * 1000
      ).toISOString();
      if (quoteNotes !== undefined) {
        inq.quoteNotes = quoteNotes?.trim();
      }
    } else if (targetStatus === 'confirmed') {
      inq.confirmedAt = now.toISOString();
    } else if (targetStatus === 'cancelled') {
      inq.cancelledAt = now.toISOString();
    }

    if (internalNotes !== undefined) {
      inq.internalNotes = internalNotes?.trim();
    }

    MEMORY_INQUIRIES[index] = inq;

    // Trigger non-blocking quotation notification if status was updated to quoted
    if (targetStatus === 'quoted' && inq.quotedAmount) {
      notificationService
        .sendInquiryQuotationNotification(
          {
            referenceId: inq.referenceId,
            customerName: inq.customerName,
            occasion: inq.occasion,
            flavor: inq.flavor,
            weight: inq.weight,
            tierCount: inq.tierCount,
            isEggless: inq.isEggless,
            preferredDate: inq.preferredDate,
            deliveryTimeSlot: inq.deliveryTimeSlot,
            quotedAmount: inq.quotedAmount,
            quoteCurrency: inq.quoteCurrency,
            quoteValidityDays: inq.quoteValidityDays,
            quoteValidUntil: inq.quoteValidUntil,
            quoteNotes: inq.quoteNotes,
          },
          inq.email,
          inq.phone,
          inq.notificationPreferences
        )
        .catch((notifErr: any) => {
          console.warn(`[Notification Note] Could not dispatch quotation proposal notification: ${notifErr.message}`);
        });
    }

    res.json({
      success: true,
      message: `Inquiry #${inq.referenceId} status successfully updated to "${targetStatus}".`,
      data: formatAdminInquiry(inq),
    });
  } catch (error) {
    next(error);
  }
}
