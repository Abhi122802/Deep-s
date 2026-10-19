import mongoose, { Schema, Document } from 'mongoose';
import { sanitizeLogDetails } from '../notifications/sanitize.js';
import { isDbConnected } from '../config/db.js';
import { env } from '../config/env.js';

export type WebhookEventProcessingStatus = 'received' | 'processed' | 'failed' | 'ignored';

export interface IWebhookEvent extends Document {
  provider: string;
  eventId: string;
  providerMessageId?: string;
  eventType?: string;
  status: WebhookEventProcessingStatus;
  sanitizedSummary?: Record<string, any>;
  receivedAt: Date;
  processedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    provider: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    eventId: {
      type: String,
      required: true,
      trim: true,
    },
    providerMessageId: {
      type: String,
      trim: true,
    },
    eventType: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['received', 'processed', 'failed', 'ignored'],
      default: 'received',
      index: true,
    },
    sanitizedSummary: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
    },
    errorMessage: {
      type: String,
      trim: true,
      maxlength: 1000,
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

// Compound unique index for durable deduplication: same eventId from same provider must not be processed twice
WebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true, name: 'provider_1_eventId_1' });

// Secondary index for correlation lookups by provider message ID
WebhookEventSchema.index({ providerMessageId: 1 }, { sparse: true, background: true, name: 'providerMessageId_1' });

export const WebhookEventModel = mongoose.model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);

/**
 * In-memory fallback storage for WebhookEvents when database is disconnected (dev/test only).
 * WARNING: Lacks cross-process durability and persistence across server restarts.
 * In production environments, MongoDB unique compound index { provider: 1, eventId: 1 } is the durable authority.
 */
export const MEMORY_WEBHOOK_EVENTS: any[] = [];

/**
 * Sanitizes optional event summary metadata.
 * Strictly excludes raw request bodies, credentials, signatures, and full customer PII.
 */
export function sanitizeWebhookEventSummary(summary?: Record<string, any>): Record<string, any> | undefined {
  if (!summary || typeof summary !== 'object') return undefined;

  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(summary)) {
    const lower = k.toLowerCase();
    // Exclude secrets, raw bodies, authorization, and contact PII
    if (
      lower.includes('secret') ||
      lower.includes('key') ||
      lower.includes('token') ||
      lower.includes('auth') ||
      lower.includes('sig') ||
      lower.includes('password') ||
      lower.includes('body') ||
      lower.includes('raw') ||
      lower.includes('payload') ||
      lower.includes('email') ||
      lower.includes('phone') ||
      lower.includes('contact')
    ) {
      continue;
    }

    if (typeof v === 'number' || typeof v === 'boolean') {
      clean[k] = v;
    } else if (typeof v === 'string') {
      clean[k] = sanitizeLogDetails(v).substring(0, 200);
    }
  }

  return Object.keys(clean).length > 0 ? clean : undefined;
}

export interface ReserveWebhookEventParams {
  provider: string;
  eventId: string;
  providerMessageId?: string;
  eventType?: string;
  sanitizedSummary?: Record<string, any>;
}

export interface WebhookReservationResult {
  isDuplicate: boolean;
  reserved: boolean;
  event?: any;
  error?: string;
}

/**
 * Atomically reserves a webhook event to ensure durable deduplication.
 *
 * Guarantees & Limitations:
 * - At-most-once event receipt: Rejects subsequent concurrent or delayed duplicate deliveries of the same (provider, eventId).
 * - MongoDB unique compound index { provider: 1, eventId: 1 } serves as the authoritative boundary.
 * - Non-atomic multi-document updates: If an unhandled crash occurs between reserving the webhook event
 *   and applying the status change on NotificationLog, the event remains in 'received' status.
 *   This prevents duplicate notification mutations while allowing audit inspection.
 */
export async function reserveWebhookEvent(
  params: ReserveWebhookEventParams
): Promise<WebhookReservationResult> {
  const provider = params.provider?.trim().toLowerCase();
  const eventId = params.eventId?.trim();

  if (!provider || provider.length === 0) {
    return {
      isDuplicate: false,
      reserved: false,
      error: 'Invalid webhook event: "provider" is required and cannot be empty.',
    };
  }

  if (!eventId || eventId.length === 0) {
    return {
      isDuplicate: false,
      reserved: false,
      error: 'Invalid webhook event: "eventId" is required and cannot be empty.',
    };
  }

  const cleanSummary = sanitizeWebhookEventSummary(params.sanitizedSummary);

  if (isDbConnected()) {
    try {
      const doc = await WebhookEventModel.create({
        provider,
        eventId,
        providerMessageId: params.providerMessageId?.trim() || undefined,
        eventType: params.eventType?.trim() || undefined,
        status: 'received',
        sanitizedSummary: cleanSummary,
        receivedAt: new Date(),
      });
      return {
        isDuplicate: false,
        reserved: true,
        event: doc,
      };
    } catch (err: any) {
      if (err.code === 11000 || err.message?.includes('E11000')) {
        const existing = await WebhookEventModel.findOne({ provider, eventId }).lean();
        return {
          isDuplicate: true,
          reserved: false,
          event: existing,
        };
      }
      return {
        isDuplicate: false,
        reserved: false,
        error: `Database reservation failure: ${err.message}`,
      };
    }
  }

  // In production mode, refuse silent fallback to volatile in-memory storage
  if (env.NODE_ENV === 'production') {
    return {
      isDuplicate: false,
      reserved: false,
      error: 'Database is disconnected. Webhook processing refused in production mode without persistent database.',
    };
  }

  // In-Memory fallback (strictly for offline dev/test environments)
  const existingMem = MEMORY_WEBHOOK_EVENTS.find(
    (e) => e.provider === provider && e.eventId === eventId
  );
  if (existingMem) {
    return {
      isDuplicate: true,
      reserved: false,
      event: existingMem,
    };
  }

  const memDoc = {
    id: `mem_wh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    provider,
    eventId,
    providerMessageId: params.providerMessageId?.trim() || undefined,
    eventType: params.eventType?.trim() || undefined,
    status: 'received',
    sanitizedSummary: cleanSummary,
    receivedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  MEMORY_WEBHOOK_EVENTS.push(memDoc);

  return {
    isDuplicate: false,
    reserved: true,
    event: memDoc,
  };
}

/**
 * Updates the processing outcome status of a reserved WebhookEvent.
 * Sets processedAt timestamp and records sanitized error message if failed.
 * Operates across both MongoDB and in-memory test environments.
 */
export async function updateWebhookEventStatus(
  event: any,
  status: WebhookEventProcessingStatus,
  errorMessage?: string
): Promise<void> {
  if (!event) return;

  const processedAt = new Date();
  const cleanError = errorMessage ? sanitizeLogDetails(errorMessage).substring(0, 1000) : undefined;

  if (isDbConnected()) {
    try {
      const docId = event._id || event.id;
      if (docId) {
        await WebhookEventModel.findByIdAndUpdate(docId, {
          $set: {
            status,
            processedAt,
            errorMessage: cleanError,
          },
        });
        return;
      }
    } catch {
      // In case of DB lookup failure, fall through to in-memory update
    }
  }

  // In-Memory update
  const mem = MEMORY_WEBHOOK_EVENTS.find(
    (e) => (e.id && event.id && e.id === event.id) || (e.provider === event.provider && e.eventId === event.eventId)
  );
  if (mem) {
    mem.status = status;
    mem.processedAt = processedAt;
    mem.errorMessage = cleanError;
    mem.updatedAt = processedAt;
  }

  event.status = status;
  event.processedAt = processedAt;
  if (cleanError) {
    event.errorMessage = cleanError;
  }
}
