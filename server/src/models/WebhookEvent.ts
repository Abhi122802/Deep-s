import mongoose, { Schema, Document } from 'mongoose';
import { sanitizeLogDetails } from '../notifications/sanitize.js';
import { isDbConnected } from '../config/db.js';
import { env } from '../config/env.js';

export type WebhookEventProcessingStatus = 'received' | 'processing' | 'processed' | 'failed' | 'ignored';

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
  // Lease, Fencing, and Recovery Primitives (Phase 5, Milestone 3)
  lockedUntil?: Date;
  lockedBy?: string;
  leaseGeneration: number;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  lastError?: string;
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
      enum: ['received', 'processing', 'processed', 'failed', 'ignored'],
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
    // Lease, Fencing, and Recovery Primitives (Phase 5, Milestone 3)
    lockedUntil: {
      type: Date,
      sparse: true,
    },
    lockedBy: {
      type: String,
      trim: true,
    },
    leaseGeneration: {
      type: Number,
      default: 0,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
    nextRetryAt: {
      type: Date,
      sparse: true,
    },
    lastError: {
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

// Compound query index for recovery worker scans (Phase 5, Milestone 3)
WebhookEventSchema.index(
  { status: 1, nextRetryAt: 1, createdAt: 1 },
  { background: true, name: 'status_1_nextRetryAt_1_createdAt_1' }
);

export const WebhookEventModel = mongoose.model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);

/**
 * In-memory fallback storage for WebhookEvents when database is disconnected (dev/test only).
 * WARNING: Lacks cross-process durability and persistence across server restarts.
 * In production environments, MongoDB unique compound index { provider: 1, eventId: 1 } is the durable authority.
 */
export const MEMORY_WEBHOOK_EVENTS_MAX_CAPACITY = 500;
export const MEMORY_WEBHOOK_EVENTS: any[] = [];

/**
 * Prunes the in-memory fallback events queue to prevent memory leaks during offline test suites (AUD-M3-03).
 */
export function pruneMemoryWebhookEvents(maxCapacity = MEMORY_WEBHOOK_EVENTS_MAX_CAPACITY): void {
  while (MEMORY_WEBHOOK_EVENTS.length > maxCapacity) {
    MEMORY_WEBHOOK_EVENTS.shift();
  }
}

/**
 * Resets the in-memory webhook event store (clean test isolation).
 */
export function clearMemoryWebhookEvents(): void {
  MEMORY_WEBHOOK_EVENTS.length = 0;
}

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
  existingStatus?: WebhookEventProcessingStatus;
  canRetry?: boolean;
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
        leaseGeneration: 0,
        retryCount: 0,
        maxRetries: 3,
      });
      return {
        isDuplicate: false,
        reserved: true,
        event: doc,
      };
    } catch (err: any) {
      if (err.code === 11000 || err.message?.includes('E11000')) {
        const existing = await WebhookEventModel.findOne({ provider, eventId }).lean();
        const isLocked = Boolean(existing?.lockedUntil && new Date(existing.lockedUntil).getTime() > Date.now());
        const canRetry = existing?.status === 'failed' || (existing?.status === 'received' && !isLocked);
        return {
          isDuplicate: true,
          reserved: false,
          event: existing,
          existingStatus: existing?.status,
          canRetry,
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
    const isLocked = Boolean(existingMem.lockedUntil && new Date(existingMem.lockedUntil).getTime() > Date.now());
    const canRetry = existingMem.status === 'failed' || (existingMem.status === 'received' && !isLocked);
    return {
      isDuplicate: true,
      reserved: false,
      event: existingMem,
      existingStatus: existingMem.status,
      canRetry,
    };
  }

  pruneMemoryWebhookEvents();
  const memDoc = {
    id: `mem_wh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    provider,
    eventId,
    providerMessageId: params.providerMessageId?.trim() || undefined,
    eventType: params.eventType?.trim() || undefined,
    status: 'received' as WebhookEventProcessingStatus,
    sanitizedSummary: cleanSummary,
    receivedAt: new Date(),
    leaseGeneration: 0,
    retryCount: 0,
    maxRetries: 3,
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
 * Sets processedAt timestamp, clears active locks, and records sanitized error message if failed.
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
            lastError: cleanError,
          },
          $unset: {
            lockedUntil: 1,
            lockedBy: 1,
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
    mem.lastError = cleanError;
    mem.updatedAt = processedAt;
    delete mem.lockedUntil;
    delete mem.lockedBy;
  }

  event.status = status;
  event.processedAt = processedAt;
  if (cleanError) {
    event.errorMessage = cleanError;
    event.lastError = cleanError;
  }
  delete event.lockedUntil;
  delete event.lockedBy;
}

/**
 * Calculates exponential backoff with full jitter for webhook recovery retries.
 * - Attempt 1: 60s base + 0..15s jitter
 * - Attempt 2: 120s base + 0..30s jitter
 * - Attempt 3+: 300s base + 0..60s jitter
 */
export function calculateWebhookRetryBackoffMs(retryCount: number): number {
  if (retryCount <= 1) {
    return 60_000 + Math.floor(Math.random() * 15_000);
  }
  if (retryCount === 2) {
    return 120_000 + Math.floor(Math.random() * 30_000);
  }
  return 300_000 + Math.floor(Math.random() * 60_000);
}

export interface ClaimWebhookEventOptions {
  id?: string;
  provider?: string;
  eventId?: string;
  workerId?: string;
  leaseDurationMs?: number;
  minAgeMs?: number;
  allowStatus?: WebhookEventProcessingStatus[];
  maxRetries?: number;
}

export interface ClaimWebhookEventResult {
  claimed: boolean;
  event?: any;
  reason?: string;
}

/**
 * Atomically claims an eligible webhook event for processing.
 *
 * Requirements & Guarantees:
 * - Atomic lease acquisition: Uses MongoDB findOneAndUpdate with lease expiration check.
 * - Monotonically increasing fencing token: Increments leaseGeneration on every claim.
 * - Bounded retries: Enforces retryCount < maxRetries and respects nextRetryAt backoff.
 * - Safe for legacy records: Gracefully treats missing lease/retry fields as eligible.
 * - Full in-memory fallback for offline test suites.
 */
export async function claimWebhookEvent(
  options: ClaimWebhookEventOptions = {}
): Promise<ClaimWebhookEventResult> {
  const now = new Date();
  const leaseDurationMs = options.leaseDurationMs ?? 30_000;
  const workerId =
    options.workerId?.trim() ||
    `worker_${process.pid}_${Math.random().toString(36).substring(2, 8)}`;
  const allowedStatuses = options.allowStatus ?? ['received', 'processing', 'failed'];
  const maxRetries = options.maxRetries ?? 3;

  if (isDbConnected()) {
    try {
      const filter: Record<string, any> = {
        status: { $in: allowedStatuses },
        $and: [
          // Must not be currently locked by an active lease
          {
            $or: [
              { lockedUntil: { $exists: false } },
              { lockedUntil: null },
              { lockedUntil: { $lte: now } },
            ],
          },
          // Must not be waiting for backoff
          {
            $or: [
              { nextRetryAt: { $exists: false } },
              { nextRetryAt: null },
              { nextRetryAt: { $lte: now } },
            ],
          },
          // Must have attempts remaining
          {
            $or: [
              { retryCount: { $exists: false } },
              { retryCount: { $lt: maxRetries } },
            ],
          },
        ],
      };

      if (options.id) {
        filter._id = options.id;
      } else if (options.provider && options.eventId) {
        filter.provider = options.provider.trim().toLowerCase();
        filter.eventId = options.eventId.trim();
      }

      // Minimum age check: prevents worker from claiming in-flight HTTP requests
      // Defaults to 60s for general worker scan, or 0s if specific event targeted
      const defaultMinAge = options.id || (options.provider && options.eventId) ? 0 : 60_000;
      const minAgeMs = options.minAgeMs ?? defaultMinAge;
      if (minAgeMs > 0) {
        const maxCreatedAt = new Date(now.getTime() - minAgeMs);
        filter.createdAt = { $lte: maxCreatedAt };
      }

      const update = {
        $set: {
          status: 'processing' as WebhookEventProcessingStatus,
          lockedUntil: new Date(now.getTime() + leaseDurationMs),
          lockedBy: workerId,
        },
        $inc: {
          leaseGeneration: 1,
          retryCount: 1,
        },
      };

      const claimedDoc = await WebhookEventModel.findOneAndUpdate(filter, update, {
        new: true,
        sort: { nextRetryAt: 1, createdAt: 1 },
      });

      if (!claimedDoc) {
        return {
          claimed: false,
          reason: 'No eligible webhook event found matching criteria or lock unavailable.',
        };
      }

      return {
        claimed: true,
        event: claimedDoc,
      };
    } catch (err: any) {
      return {
        claimed: false,
        reason: `Database claim failure: ${err.message}`,
      };
    }
  }

  // In production mode, refuse fallback to memory
  if (env.NODE_ENV === 'production') {
    return {
      claimed: false,
      reason: 'Database is disconnected. Claim refused in production mode.',
    };
  }

  // In-Memory fallback (offline dev/test only)
  const defaultMinAge = options.id || (options.provider && options.eventId) ? 0 : 60_000;
  const minAgeMs = options.minAgeMs ?? defaultMinAge;
  const maxCreatedAt = minAgeMs > 0 ? new Date(now.getTime() - minAgeMs) : null;

  const eligibleMem = MEMORY_WEBHOOK_EVENTS.find((e) => {
    if (options.id && e.id !== options.id && e._id !== options.id) return false;
    if (options.provider && e.provider !== options.provider.trim().toLowerCase()) return false;
    if (options.eventId && e.eventId !== options.eventId.trim()) return false;

    if (!allowedStatuses.includes(e.status)) return false;

    // Check lock
    if (e.lockedUntil && new Date(e.lockedUntil).getTime() > now.getTime()) return false;

    // Check backoff
    if (e.nextRetryAt && new Date(e.nextRetryAt).getTime() > now.getTime()) return false;

    // Check retry count
    if ((e.retryCount || 0) >= maxRetries) return false;

    // Check age
    if (maxCreatedAt && e.createdAt && new Date(e.createdAt).getTime() > maxCreatedAt.getTime()) {
      return false;
    }

    return true;
  });

  if (!eligibleMem) {
    return {
      claimed: false,
      reason: 'No eligible webhook event found in memory matching criteria or lock unavailable.',
    };
  }

  eligibleMem.status = 'processing';
  eligibleMem.lockedUntil = new Date(now.getTime() + leaseDurationMs);
  eligibleMem.lockedBy = workerId;
  eligibleMem.leaseGeneration = (eligibleMem.leaseGeneration || 0) + 1;
  eligibleMem.retryCount = (eligibleMem.retryCount || 0) + 1;
  eligibleMem.updatedAt = new Date();

  return {
    claimed: true,
    event: eligibleMem,
  };
}

export interface CompleteWebhookEventParams {
  id: string;
  leaseGeneration: number;
  status: 'processed' | 'failed' | 'ignored';
  errorMessage?: string;
  retryBackoffMs?: number;
  maxRetries?: number;
}

export interface CompleteWebhookEventResult {
  success: boolean;
  event?: any;
  reason?: string;
}

/**
 * Completes processing of a webhook event using a fenced write.
 *
 * Fencing Protection:
 * - Requires matching leaseGeneration. If another worker took over after lease expiry,
 *   the update will modify 0 records and fail safely without corrupting newer state.
 * - Releases lockedUntil and lockedBy locks.
 * - For status 'failed':
 *     - If retryCount < maxRetries, schedules nextRetryAt with exponential backoff.
 *     - If retryCount >= maxRetries, marks terminal dead-letter without scheduling nextRetryAt.
 */
export async function completeWebhookEvent(
  params: CompleteWebhookEventParams
): Promise<CompleteWebhookEventResult> {
  const cleanError = params.errorMessage
    ? sanitizeLogDetails(params.errorMessage).substring(0, 1000)
    : undefined;
  const maxRetries = params.maxRetries ?? 3;

  if (isDbConnected()) {
    try {
      // First verify the current document exists and check its retryCount
      const existing = await WebhookEventModel.findOne({
        _id: params.id,
        leaseGeneration: params.leaseGeneration,
      });

      if (!existing) {
        return {
          success: false,
          reason: 'Fencing token mismatch or document not found. Lease may have expired and been reclaimed.',
        };
      }

      const update: Record<string, any> = {
        $set: {
          status: params.status,
          processedAt: new Date(),
          errorMessage: cleanError,
          lastError: cleanError,
        },
        $unset: {
          lockedUntil: 1,
          lockedBy: 1,
          nextRetryAt: 1,
        },
      };

      if (params.status === 'failed') {
        const currentRetries = existing.retryCount || 1;
        if (currentRetries < maxRetries) {
          const backoffMs =
            params.retryBackoffMs ?? calculateWebhookRetryBackoffMs(currentRetries);
          update.$set.nextRetryAt = new Date(Date.now() + backoffMs);
          delete update.$unset.nextRetryAt;
        }
      }

      const updated = await WebhookEventModel.findOneAndUpdate(
        {
          _id: params.id,
          leaseGeneration: params.leaseGeneration,
        },
        update,
        { new: true }
      );

      if (!updated) {
        return {
          success: false,
          reason: 'Fencing token mismatch during final update. Lease was reclaimed concurrently.',
        };
      }

      return {
        success: true,
        event: updated,
      };
    } catch (err: any) {
      return {
        success: false,
        reason: `Database complete failure: ${err.message}`,
      };
    }
  }

  // In production mode, refuse fallback to memory
  if (env.NODE_ENV === 'production') {
    return {
      success: false,
      reason: 'Database is disconnected. Complete refused in production mode.',
    };
  }

  // In-Memory fallback (offline dev/test only)
  const mem = MEMORY_WEBHOOK_EVENTS.find(
    (e) => (e.id && e.id === params.id) || (e._id && String(e._id) === params.id)
  );

  if (!mem) {
    return {
      success: false,
      reason: 'Document not found in memory.',
    };
  }

  if (mem.leaseGeneration !== params.leaseGeneration) {
    return {
      success: false,
      reason: 'Fencing token mismatch. Lease may have expired and been reclaimed.',
    };
  }

  mem.status = params.status;
  mem.processedAt = new Date();
  mem.errorMessage = cleanError;
  mem.lastError = cleanError;
  mem.updatedAt = new Date();
  delete mem.lockedUntil;
  delete mem.lockedBy;

  if (params.status === 'failed') {
    const currentRetries = mem.retryCount || 1;
    if (currentRetries < maxRetries) {
      const backoffMs =
        params.retryBackoffMs ?? calculateWebhookRetryBackoffMs(currentRetries);
      mem.nextRetryAt = new Date(Date.now() + backoffMs);
    } else {
      delete mem.nextRetryAt;
    }
  } else {
    delete mem.nextRetryAt;
  }

  return {
    success: true,
    event: mem,
  };
}
