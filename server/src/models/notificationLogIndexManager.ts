import { NotificationLogModel } from './NotificationLog.js';
import { isDbConnected } from '../config/db.js';

export interface IndexSpecification {
  name: string;
  key: Record<string, 1 | -1>;
  unique?: boolean;
  background?: boolean;
}

/**
 * Declared and required indexes for NotificationLog collection:
 * - 2 critical unique indexes (idempotency key & notification ID)
 * - 3 compound query indexes for rapid administrative audit filtering & sorting
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
];

export interface IndexInspectionResult {
  connected: boolean;
  collectionName: string;
  existingIndexes: Array<{ name: string; key: Record<string, any>; unique?: boolean }>;
  missingIndexes: IndexSpecification[];
  synced: boolean;
  notes: string[];
}

/**
 * Safely inspects NotificationLog index metadata.
 * Never prints or returns connection strings, credentials, or customer data.
 */
export async function getNotificationLogIndexMetadata(): Promise<IndexInspectionResult> {
  if (!isDbConnected()) {
    return {
      connected: false,
      collectionName: NotificationLogModel.collection.collectionName || 'notificationlogs',
      existingIndexes: [],
      missingIndexes: [...REQUIRED_NOTIFICATION_LOG_INDEXES],
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
    }));

    const existingNames = new Set(existing.map((i) => i.name));
    const missing = REQUIRED_NOTIFICATION_LOG_INDEXES.filter((req) => !existingNames.has(req.name));

    return {
      connected: true,
      collectionName: NotificationLogModel.collection.collectionName,
      existingIndexes: existing,
      missingIndexes: missing,
      synced: missing.length === 0,
      notes: [
        `Collection has ${existing.length} existing index(es).`,
        missing.length === 0
          ? 'All required indexes are present.'
          : `${missing.length} declared secondary index(es) are missing from the live collection.`,
      ],
    };
  } catch (err: any) {
    return {
      connected: true,
      collectionName: NotificationLogModel.collection.collectionName,
      existingIndexes: [],
      missingIndexes: [...REQUIRED_NOTIFICATION_LOG_INDEXES],
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
 * - By default, operates in dryRun mode unless explicitly set to false.
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
