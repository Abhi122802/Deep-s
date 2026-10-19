import mongoose, { Schema, Document } from 'mongoose';
import { CustomerConsent } from '../notifications/types.js';

export type NotificationChannel = 'email' | 'whatsapp' | 'sms';
export type NotificationEventType = 'order_placed' | 'order_status_updated' | 'inquiry_quotation_sent';
export type DeliveryStatus = 'pending' | 'sending' | 'delivered' | 'failed' | 'skipped';

export interface INotificationLog extends Document {
  notificationId: string;
  idempotencyKey: string;
  channel: NotificationChannel;
  eventType: NotificationEventType;
  recipient: string;
  provider: string;
  providerMessageId?: string;
  deliveryStatus: DeliveryStatus;
  attempts: number;
  maxAttempts: number;
  subject?: string;
  message?: string;
  messagePreview?: string;
  metadata?: Record<string, any>;
  customerConsent?: CustomerConsent;
  sanitizedError?: string;
  queuedAt: Date;
  sentAt?: Date;
  failedAt?: Date;
  lastRetriedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationLogSchema = new Schema<INotificationLog>(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['email', 'whatsapp', 'sms'],
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: ['order_placed', 'order_status_updated', 'inquiry_quotation_sent'],
      required: true,
      index: true,
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
    },
    provider: {
      type: String,
      required: true,
      default: 'mock',
    },
    providerMessageId: {
      type: String,
      trim: true,
      sparse: true,
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sending', 'delivered', 'failed', 'skipped'],
      default: 'pending',
      index: true,
    },
    attempts: {
      type: Number,
      default: 1,
      min: 1,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 250,
    },
    message: {
      type: String,
      trim: true,
    },
    messagePreview: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    customerConsent: {
      type: Schema.Types.Mixed,
    },
    sanitizedError: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    queuedAt: {
      type: Date,
      default: Date.now,
    },
    sentAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    lastRetriedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id?.toString() || ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for rapid administrative filtering and audit querying
NotificationLogSchema.index({ deliveryStatus: 1, createdAt: -1 });
NotificationLogSchema.index({ channel: 1, createdAt: -1 });
NotificationLogSchema.index({ eventType: 1, createdAt: -1 });

// Single-field sparse index for correlation lookups by provider message ID
// Sparse avoids indexing records lacking providerMessageId (e.g. pending, mock, failed before network)
NotificationLogSchema.index({ providerMessageId: 1 }, { sparse: true, background: true });

export const NotificationLogModel = mongoose.model<INotificationLog>(
  'NotificationLog',
  NotificationLogSchema
);

/**
 * ============================================================================
 * PROPOSED FUTURE DELIVERY STATUS TRANSITION ARCHITECTURE (Phase 5, Milestone 2)
 * ============================================================================
 * To maintain audit integrity and avoid race conditions from out-of-order webhook deliveries:
 *
 * 1. Terminal Outcome Immutability:
 *    - An existing 'delivered' status MUST NEVER be downgraded to 'sending' or 'pending'
 *      if a delayed/out-of-order webhook event (e.g. Twilio 'queued' or 'sent') arrives.
 *    - Once 'delivered', only confirmed terminal bounces or complaints can update outcome notes.
 *
 * 2. Separation of Lifecycle States vs. Engagement Events:
 *    - Core DeliveryStatus remains strictly: ['pending', 'sending', 'delivered', 'failed', 'skipped'].
 *    - Engagement signals (e.g. SendGrid 'open', 'click'; Twilio WhatsApp 'read') MUST NOT
 *      alter core DeliveryStatus; they should be tracked in webhook event logs and metadata.
 *
 * 3. Channel-Specific Failure & Suppression Semantics:
 *    - Email (SendGrid):
 *      - 'delivered' -> maps to DeliveryStatus 'delivered'.
 *      - 'bounce', 'dropped', 'spamreport' -> maps to DeliveryStatus 'failed' with reason recorded.
 *      - 'deferred' -> transient; does not alter 'sending' or 'delivered'.
 *    - WhatsApp / SMS (Twilio):
 *      - 'delivered' -> maps to DeliveryStatus 'delivered'.
 *      - 'undelivered', 'failed' -> maps to DeliveryStatus 'failed' with error code recorded.
 *      - 'sent', 'queued' -> intermediate states; do not overwrite 'delivered'.
 * ============================================================================
 */

/**
 * In-memory fallback notification log storage for resilient offline operation and testing.
 * Restricted strictly to dev/test environments.
 */
export const MEMORY_NOTIFICATION_LOGS: any[] = [];

export {
  REQUIRED_NOTIFICATION_LOG_INDEXES,
  REQUIRED_WEBHOOK_EVENT_INDEXES,
  getNotificationLogIndexMetadata,
  getWebhookEventIndexMetadata,
  ensureNotificationLogIndexes,
  ensureWebhookEventIndexes,
  ensureAllNotificationIndexes,
} from './notificationLogIndexManager.js';
