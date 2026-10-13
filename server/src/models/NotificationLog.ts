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

export const NotificationLogModel = mongoose.model<INotificationLog>(
  'NotificationLog',
  NotificationLogSchema
);

/**
 * In-memory fallback notification log storage for resilient offline operation and testing.
 * Restriced strictly to dev/test environments.
 */
export const MEMORY_NOTIFICATION_LOGS: any[] = [];

export {
  REQUIRED_NOTIFICATION_LOG_INDEXES,
  getNotificationLogIndexMetadata,
  ensureNotificationLogIndexes,
} from './notificationLogIndexManager.js';
