import { z } from 'zod';

const preferenceObjectSchema = z.object({
  email: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional(),
  whatsapp: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional(),
  sms: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional(),
});

export const createCustomCakeInquirySchema = z.preprocess(
  (data: any) => {
    if (data && typeof data === 'object') {
      const copy = { ...data };
      if (
        !copy.notificationPreferences &&
        (copy['notificationPreferences[email]'] !== undefined ||
          copy['notificationPreferences[whatsapp]'] !== undefined ||
          copy['notificationPreferences[sms]'] !== undefined)
      ) {
        copy.notificationPreferences = {
          email: copy['notificationPreferences[email]'],
          whatsapp: copy['notificationPreferences[whatsapp]'],
          sms: copy['notificationPreferences[sms]'],
        };
      } else if (typeof copy.notificationPreferences === 'string') {
        try {
          copy.notificationPreferences = JSON.parse(copy.notificationPreferences);
        } catch {}
      }

      if (
        !copy.customerConsent &&
        (copy['customerConsent[email]'] !== undefined ||
          copy['customerConsent[whatsapp]'] !== undefined ||
          copy['customerConsent[sms]'] !== undefined)
      ) {
        copy.customerConsent = {
          email: copy['customerConsent[email]'],
          whatsapp: copy['customerConsent[whatsapp]'],
          sms: copy['customerConsent[sms]'],
        };
      } else if (typeof copy.customerConsent === 'string') {
        try {
          copy.customerConsent = JSON.parse(copy.customerConsent);
        } catch {}
      }
      return copy;
    }
    return data;
  },
  z.object({
    customerName: z.string().trim().min(2, 'Name must be at least 2 characters'),
    phone: z.string().trim().min(10, 'Phone must be at least 10 digits'),
    email: z.string().trim().email('Invalid email address'),
    occasion: z.string().trim().min(2, 'Occasion is required'),
    flavor: z.string().trim().min(2, 'Flavor selection is required'),
    weight: z.enum(['0.5 kg', '1 kg', '1.5 kg', '2 kg', '3 kg+']).default('1 kg'),
    tierCount: z.enum(['1 Tier', '2 Tiers', '3 Tiers']).default('1 Tier'),
    isEggless: z
      .union([z.boolean(), z.string()])
      .transform((val) => (typeof val === 'string' ? val === 'true' : val)),
    messageOnCake: z.string().trim().max(100).optional(),
    preferredDate: z.string().trim().min(4, 'Preferred date is required'),
    deliveryTimeSlot: z.string().trim().default('12:00 PM – 3:00 PM'),
    deliveryAddress: z.string().trim().optional(),
    specialInstructions: z.string().trim().max(1000).optional(),
    customerConsent: preferenceObjectSchema.optional(),
    notificationPreferences: preferenceObjectSchema.optional(),
  })
);

export const adminInquiryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['all', 'pending', 'reviewed', 'quoted', 'confirmed', 'cancelled']).default('all'),
  sortBy: z.enum(['createdAt', 'preferredDate', 'estimatedPrice', 'customerName', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const updateInquiryStatusSchema = z.object({
  status: z.enum(['pending', 'reviewed', 'quoted', 'confirmed', 'cancelled'], {
    errorMap: () => ({ message: 'Status must be one of: pending, reviewed, quoted, confirmed, cancelled' }),
  }),
  quotedAmount: z.number().positive('Quoted amount must be a positive number').optional(),
  quoteCurrency: z.string().trim().min(3).max(5).default('INR').optional(),
  quoteValidityDays: z.number().int().min(1).max(90).default(7).optional(),
  quoteNotes: z.string().trim().max(1000).optional(),
  internalNotes: z.string().trim().max(1000).optional(),
}).refine(
  (data) => {
    if (data.status === 'quoted') {
      return typeof data.quotedAmount === 'number' && data.quotedAmount > 0;
    }
    return true;
  },
  {
    message: 'A valid positive quote amount is required when transitioning status to "quoted".',
    path: ['quotedAmount'],
  }
);
