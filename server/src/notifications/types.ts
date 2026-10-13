import { NotificationChannel, NotificationEventType, DeliveryStatus } from '../models/NotificationLog.js';

export type { NotificationChannel, NotificationEventType, DeliveryStatus };

export interface CustomerConsent {
  email?: boolean;
  whatsapp?: boolean;
  sms?: boolean;
}

export interface NotificationPayload {
  notificationId?: string;
  idempotencyKey: string;
  channel: NotificationChannel;
  eventType: NotificationEventType;
  recipient: string;
  subject?: string;
  message: string;
  metadata?: Record<string, any>;
  customerConsent?: CustomerConsent;
  signal?: AbortSignal;
}

export interface NotificationSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  retryable?: boolean;
}

export interface INotificationProvider {
  readonly name: string;
  readonly supportedChannels: readonly NotificationChannel[];
  send(payload: NotificationPayload): Promise<NotificationSendResult>;
}

export interface RenderedTemplate {
  subject?: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface OrderPlacedTemplateData {
  orderId: string;
  customerName: string;
  items: Array<{
    cakeName: string;
    selectedWeight: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    customMessage?: string;
  }>;
  subtotal: number;
  discountAmount?: number;
  couponCode?: string;
  deliveryFee: number;
  grandTotal: number;
  deliveryAddress?: string;
  deliveryNotes?: string;
  createdAt?: string | Date;
}

export interface OrderStatusTemplateData {
  orderId: string;
  customerName: string;
  previousStatus?: string;
  newStatus: 'Pending' | 'Confirmed' | 'Baking' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  deliveryAddress?: string;
  itemCount?: number;
}

export interface InquiryQuotationTemplateData {
  referenceId: string;
  customerName: string;
  occasion: string;
  flavor: string;
  weight: string;
  tierCount: string;
  isEggless: boolean;
  preferredDate: string;
  deliveryTimeSlot?: string;
  quotedAmount: number;
  quoteCurrency?: string;
  quoteValidityDays?: number;
  quoteValidUntil?: string | Date;
  quoteNotes?: string;
}
