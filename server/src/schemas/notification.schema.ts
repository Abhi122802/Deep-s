import { z } from 'zod';

export const adminNotificationQuerySchema = z.object({
  page: z.coerce
    .number({ invalid_type_error: 'Page must be a valid number' })
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .max(10000, 'Page cannot exceed 10000')
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: 'Limit must be a valid number' })
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
  channel: z
    .enum(['email', 'whatsapp', 'sms', 'all'], {
      errorMap: () => ({ message: 'Channel must be one of: email, whatsapp, sms, all' }),
    })
    .optional(),
  eventType: z
    .enum(['order_placed', 'order_status_updated', 'inquiry_quotation_sent', 'all'], {
      errorMap: () => ({
        message: 'EventType must be one of: order_placed, order_status_updated, inquiry_quotation_sent, all',
      }),
    })
    .optional(),
  deliveryStatus: z
    .enum(['pending', 'sending', 'delivered', 'failed', 'skipped', 'all'], {
      errorMap: () => ({
        message: 'DeliveryStatus must be one of: pending, sending, delivered, failed, skipped, all',
      }),
    })
    .optional(),
  search: z
    .string()
    .trim()
    .max(100, 'Search query cannot exceed 100 characters')
    .optional(),
});

export type AdminNotificationQuery = z.infer<typeof adminNotificationQuerySchema>;

export const retryNotificationParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Notification identifier is required')
    .max(100, 'Notification identifier cannot exceed 100 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid notification identifier format'),
});

export const retryNotificationBodySchema = z
  .object({})
  .passthrough(); // Discards or ignores arbitrary fields so admins cannot override recipient/content
