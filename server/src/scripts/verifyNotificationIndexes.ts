import { connectDB, disconnectDB } from '../config/db.js';
import { getNotificationLogIndexMetadata } from '../models/NotificationLog.js';

async function main() {
  console.log('[Index Verification] Initializing read-only index audit for NotificationLog...');

  const conn = await connectDB();
  if (!conn) {
    console.log('[Index Verification] Database is disconnected or unavailable. Exiting.');
    process.exit(0);
  }

  try {
    const metadata = await getNotificationLogIndexMetadata();
    console.log('------------------------------------------------------------');
    console.log(`Collection: ${metadata.collectionName}`);
    console.log(`Connected: ${metadata.connected}`);
    console.log(`Synced: ${metadata.synced ? 'YES' : 'NO (Missing secondary indexes)'}`);
    console.log('Existing Indexes on Cluster:');
    for (const idx of metadata.existingIndexes) {
      console.log(`  - ${idx.name} (unique: ${Boolean(idx.unique)})`);
    }

    if (metadata.missingIndexes.length > 0) {
      console.log('Missing Declared Secondary Indexes:');
      for (const idx of metadata.missingIndexes) {
        console.log(`  - ${idx.name} (key: ${JSON.stringify(idx.key)})`);
      }
    } else {
      console.log('✓ All declared schema indexes exist on the cluster.');
    }
    console.log('------------------------------------------------------------');
  } catch (err: any) {
    console.error(`[Index Verification Error] ${err.message}`);
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error('[Index Verification Fatal]', err.message);
  process.exit(1);
});
