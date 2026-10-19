import { NotificationLogModel } from './NotificationLog.js';
import { WebhookEventModel } from './WebhookEvent.js';
import { isDbConnected } from '../config/db.js';

export interface IndexSpecification {
  name: string;
  key: Record<string, 1 | -1>;
  unique?: boolean;
  sparse?: boolean;
  background?: boolean;
}

/**
 * Declared and required indexes for NotificationLog collection:
 * - 2 critical unique indexes (idempotency key & notification ID)
 * - 3 compound query indexes for rapid administrative audit filtering & sorting
 * - 1 single-field sparse index for correlation lookups by provider message ID
 */
export const REQUIRED_NOTIFICATION_LOG_INDEXES: IndexSpecification[] = [
  {
    name: 'idempotencyKey_1',
    key: { idempotencyKey: 1 },
    unique: true,
  },
  {
    name: 'notificationId_1',
    key: { notificationId: 1 },
    unique: true,
  },
  {
    name: 'deliveryStatus_1_createdAt_-1',
    key: { deliveryStatus: 1, createdAt: -1 },
    background: true,
  },
  {
    name: 'channel_1_createdAt_-1',
    key: { channel: 1, createdAt: -1 },
    background: true,
  },
  {
    name: 'eventType_1_createdAt_-1',
    key: { eventType: 1, createdAt: -1 },
    background: true,
  },
  {
    name: 'providerMessageId_1',
    key: { providerMessageId: 1 },
    background: true,
    sparse: true,
  },
];

/**
 * Declared and required indexes for WebhookEvent collection:
 * - 1 compound unique index on { provider, eventId } for durable cross-process deduplication
 * - 1 sparse secondary index on providerMessageId for correlation lookups
 * - 1 compound query index on { status, nextRetryAt, createdAt } for background recovery scans (Phase 5, Milestone 3)
 */
export const REQUIRED_WEBHOOK_EVENT_INDEXES: IndexSpecification[] = [
  {
    name: 'provider_1_eventId_1',
    key: { provider: 1, eventId: 1 },
    unique: true,
    background: true,
  },
  {
    name: 'providerMessageId_1',
    key: { providerMessageId: 1 },
    background: true,
    sparse: true,
  },
  {
    name: 'status_1_nextRetryAt_1_createdAt_1',
    key: { status: 1, nextRetryAt: 1, createdAt: 1 },
    background: true,
  },
];

export interface IndexInspectionResult {
  connected: boolean;
  collectionName: string;
  existingIndexes: Array<{ name: string; key: Record<string, any>; unique?: boolean; sparse?: boolean }>;
  missingIndexes: IndexSpecification[];
  mismatchedIndexes: Array<{ name: string; issue: string; expected: any; actual: any }>;
  synced: boolean;
  notes: string[];
}

/**
 * Safely inspects NotificationLog index metadata.
 * Validates presence, keys, uniqueness, and sparse options.
 * Never prints or returns connection strings, credentials, or customer data.
 */
export async function getNotificationLogIndexMetadata(): Promise<IndexInspectionResult> {
  if (!isDbConnected()) {
    return {
      connected: false,
      collectionName: NotificationLogModel.collection?.collectionName || 'notificationlogs',
      existingIndexes: [],
      missingIndexes: [...REQUIRED_NOTIFICATION_LOG_INDEXES],
      mismatchedIndexes: [],
      synced: false,
      notes: ['Database is not connected. Live index inspection unavailable.'],
    };
  }

  try {
    const rawIndexes = await NotificationLogModel.collection.indexes();
    const existing = rawIndexes.map((idx: any) => ({
      name: idx.name,
      key: idx.key,
      unique: Boolean(idx.unique),
      sparse: Boolean(idx.sparse),
    }));

    const existingByName = new Map(existing.map((i) => [i.name, i]));
    const missing: IndexSpecification[] = [];
    const mismatched: Array<{ name: string; issue: string; expected: any; actual: any }> = [];

    for (const req of REQUIRED_NOTIFICATION_LOG_INDEXES) {
      const found = existingByName.get(req.name);
      if (!found) {
        missing.push(req);
      } else {
        if (Boolean(req.unique) !== found.unique) {
          mismatched.push({
            name: req.name,
            issue: 'unique mismatch',
            expected: Boolean(req.unique),
            actual: found.unique,
          });
        }
        if (Boolean(req.sparse) !== found.sparse) {
          mismatched.push({
            name: req.name,
            issue: 'sparse mismatch',
            expected: Boolean(req.sparse),
            actual: found.sparse,
          });
        }
      }
    }

    const isSynced = missing.length === 0 && mismatched.length === 0;

    return {
      connected: true,
      collectionName: NotificationLogModel.collection.collectionName,
      existingIndexes: existing,
      missingIndexes: missing,
      mismatchedIndexes: mismatched,
      synced: isSynced,
      notes: [
        `Collection has ${existing.length} existing index(es).`,
        isSynced
          ? 'All required indexes are present with matching options.'
          : `${missing.length} missing index(es), ${mismatched.length} mismatched index option(s).`,
      ],
    };
  } catch (err: any) {
    return {
      connected: true,
      collectionName: NotificationLogModel.collection?.collectionName || 'notificationlogs',
      existingIndexes: [],
      missingIndexes: [...REQUIRED_NOTIFICATION_LOG_INDEXES],
      mismatchedIndexes: [],
      synced: false,
      notes: [`Error inspecting collection indexes: ${err.message}`],
    };
  }
}

/**
 * Safely inspects WebhookEvent index metadata.
 */
export async function getWebhookEventIndexMetadata(): Promise<IndexInspectionResult> {
  if (!isDbConnected()) {
    return {
      connected: false,
      collectionName: WebhookEventModel.collection?.collectionName || 'webhookevents',
      existingIndexes: [],
      missingIndexes: [...REQUIRED_WEBHOOK_EVENT_INDEXES],
      mismatchedIndexes: [],
      synced: false,
      notes: ['Database is not connected. Live index inspection unavailable.'],
    };
  }

  try {
    const rawIndexes = await WebhookEventModel.collection.indexes();
    const existing = rawIndexes.map((idx: any) => ({
      name: idx.name,
      key: idx.key,
      unique: Boolean(idx.unique),
      sparse: Boolean(idx.sparse),
    }));

    const existingByName = new Map(existing.map((i) => [i.name, i]));
    const missing: IndexSpecification[] = [];
    const mismatched: Array<{ name: string; issue: string; expected: any; actual: any }> = [];

    for (const req of REQUIRED_WEBHOOK_EVENT_INDEXES) {
      const found = existingByName.get(req.name);
      if (!found) {
        missing.push(req);
      } else {
        if (Boolean(req.unique) !== found.unique) {
          mismatched.push({
            name: req.name,
            issue: 'unique mismatch',
            expected: Boolean(req.unique),
            actual: found.unique,
          });
        }
        if (Boolean(req.sparse) !== found.sparse) {
          mismatched.push({
            name: req.name,
            issue: 'sparse mismatch',
            expected: Boolean(req.sparse),
            actual: found.sparse,
          });
        }
      }
    }

    const isSynced = missing.length === 0 && mismatched.length === 0;

    return {
      connected: true,
      collectionName: WebhookEventModel.collection.collectionName,
      existingIndexes: existing,
      missingIndexes: missing,
      mismatchedIndexes: mismatched,
      synced: isSynced,
      notes: [
        `Collection has ${existing.length} existing index(es).`,
        isSynced
          ? 'All required webhook event indexes are present.'
          : `${missing.length} missing index(es), ${mismatched.length} mismatched index option(s).`,
      ],
    };
  } catch (err: any) {
    return {
      connected: true,
      collectionName: WebhookEventModel.collection?.collectionName || 'webhookevents',
      existingIndexes: [],
      missingIndexes: [...REQUIRED_WEBHOOK_EVENT_INDEXES],
      mismatchedIndexes: [],
      synced: false,
      notes: [`Error inspecting collection indexes: ${err.message}`],
    };
  }
}

export interface EnsureIndexesResult {
  applied: boolean;
  dryRun: boolean;
  createdIndexes: string[];
  alreadyPresent: string[];
  errors: string[];
}

/**
 * Targeted index builder for NotificationLog.
 * - Operates in dryRun mode by default unless explicitly disabled.
 * - Does NOT drop existing or third-party indexes (avoids destructive syncIndexes()).
 * - Builds secondary indexes with { background: true } to prevent blocking database operations.
 * - Preserves existing records and unique constraints.
 */
export async function ensureNotificationLogIndexes(options: { dryRun?: boolean } = {}): Promise<EnsureIndexesResult> {
  const dryRun = options.dryRun ?? true;

  if (!isDbConnected()) {
    return {
      applied: false,
      dryRun,
      createdIndexes: [],
      alreadyPresent: [],
      errors: ['Database is not connected.'],
    };
  }

  const inspection = await getNotificationLogIndexMetadata();
  const createdIndexes: string[] = [];
  const alreadyPresent = inspection.existingIndexes.map((i) => i.name);
  const errors: string[] = [];

  if (dryRun) {
    return {
      applied: false,
      dryRun: true,
      createdIndexes: inspection.missingIndexes.map((m) => m.name),
      alreadyPresent,
      errors: [],
    };
  }

  // Live creation: target only missing indexes one by one
  for (const idx of inspection.missingIndexes) {
    try {
      await NotificationLogModel.collection.createIndex(idx.key, {
        name: idx.name,
        unique: idx.unique,
        sparse: idx.sparse,
        background: idx.background ?? true,
      });
      createdIndexes.push(idx.name);
    } catch (err: any) {
      errors.push(`Failed to create index "${idx.name}": ${err.message}`);
    }
  }

  return {
    applied: createdIndexes.length > 0,
    dryRun: false,
    createdIndexes,
    alreadyPresent,
    errors,
  };
}

/**
 * Targeted index builder for WebhookEvent collection.
 */
export async function ensureWebhookEventIndexes(options: { dryRun?: boolean } = {}): Promise<EnsureIndexesResult> {
  const dryRun = options.dryRun ?? true;

  if (!isDbConnected()) {
    return {
      applied: false,
      dryRun,
      createdIndexes: [],
      alreadyPresent: [],
      errors: ['Database is not connected.'],
    };
  }

  const inspection = await getWebhookEventIndexMetadata();
  const createdIndexes: string[] = [];
  const alreadyPresent = inspection.existingIndexes.map((i) => i.name);
  const errors: string[] = [];

  if (dryRun) {
    return {
      applied: false,
      dryRun: true,
      createdIndexes: inspection.missingIndexes.map((m) => m.name),
      alreadyPresent,
      errors: [],
    };
  }

  // Live creation: target only missing indexes one by one
  for (const idx of inspection.missingIndexes) {
    try {
      await WebhookEventModel.collection.createIndex(idx.key, {
        name: idx.name,
        unique: idx.unique,
        sparse: idx.sparse,
        background: idx.background ?? true,
      });
      createdIndexes.push(idx.name);
    } catch (err: any) {
      errors.push(`Failed to create index "${idx.name}": ${err.message}`);
    }
  }

  return {
    applied: createdIndexes.length > 0,
    dryRun: false,
    createdIndexes,
    alreadyPresent,
    errors,
  };
}

/**
 * Idempotently ensures all notification and webhook event indexes across both collections.
 */
export async function ensureAllNotificationIndexes(options: { dryRun?: boolean } = {}): Promise<{
  notificationLogs: EnsureIndexesResult;
  webhookEvents: EnsureIndexesResult;
}> {
  const notificationLogs = await ensureNotificationLogIndexes(options);
  const webhookEvents = await ensureWebhookEventIndexes(options);
  return { notificationLogs, webhookEvents };
}
