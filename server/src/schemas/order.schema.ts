import { z } from 'zod';

export const createOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    phone: z.string().trim().min(10, 'Valid 10-digit mobile number required'),
    email: z.string().trim().email('Valid email address required'),
    address: z.string().trim().optional(),
  }),
  items: z
    .array(
      z.object({
        cakeId: z.string().trim().min(1, 'Product identifier is required'),
        selectedWeight: z.enum(['0.5 kg', '1 kg', '1.5 kg', '2 kg']),
        quantity: z.number().int().min(1, 'Quantity must be at least 1').max(20),
        customMessage: z.string().trim().max(100).optional(),
      })
    )
    .min(1, 'Order must contain at least one cake'),
  couponCode: z.string().trim().optional(),
  deliveryNotes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().optional(),
  customerConsent: z
    .object({
      email: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
      sms: z.boolean().optional(),
    })
    .optional(),
  notificationPreferences: z
    .object({
      email: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
      sms: z.boolean().optional(),
    })
    .optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(
    ['Pending', 'Confirmed', 'Baking', 'Out for Delivery', 'Delivered', 'Cancelled'],
    {
      errorMap: () => ({
        message:
          'Status must be one of: Pending, Confirmed, Baking, Out for Delivery, Delivered, Cancelled',
      }),
    }
  ),
  note: z.string().trim().max(500).optional(),
});

export const orderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z
    .enum(['All', 'Pending', 'Confirmed', 'Baking', 'Out for Delivery', 'Delivered', 'Cancelled'])
    .optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(['newest', 'oldest', 'amount-desc', 'amount-asc']).default('newest'),
});
