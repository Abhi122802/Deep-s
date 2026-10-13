import mongoose from 'mongoose';
import dns from 'dns';
import { env } from './env.js';

let isConnected = false;

/**
 * Normalizes MongoDB connection strings:
 * 1. Trims extraneous leading/trailing symbols (such as colons or spaces).
 * 2. Properly URL-encodes passwords with special characters (like '@' or ':') if provided raw.
 * 3. Ensures default database name is set if omitted before query parameters.
 */
export function normalizeMongoUri(rawUri: string): string {
  let uri = rawUri.trim().replace(/^[:\-\s]+/, '');
  const schemeMatch = uri.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/);
  if (!schemeMatch) return uri;

  const scheme = schemeMatch[1];
  const rest = schemeMatch[2];

  const hostSlashIdx = rest.indexOf('/');
  const hostQuestionIdx = rest.indexOf('?');
  let authAndHostEnd = rest.length;
  if (hostSlashIdx !== -1 && (hostQuestionIdx === -1 || hostSlashIdx < hostQuestionIdx)) {
    authAndHostEnd = hostSlashIdx;
  } else if (hostQuestionIdx !== -1) {
    authAndHostEnd = hostQuestionIdx;
  }

  const authAndHost = rest.substring(0, authAndHostEnd);
  const pathAndQuery = rest.substring(authAndHostEnd);

  const lastAtIdx = authAndHost.lastIndexOf('@');
  if (lastAtIdx === -1) return uri; // no credentials

  const authPart = authAndHost.substring(0, lastAtIdx);
  const hostPart = authAndHost.substring(lastAtIdx + 1);

  const colonIdx = authPart.indexOf(':');
  if (colonIdx === -1) return uri;

  const username = authPart.substring(0, colonIdx);
  let password = authPart.substring(colonIdx + 1);

  // Decode first in case already partially encoded, then re-encode safely
  try {
    const decoded = decodeURIComponent(password);
    password = encodeURIComponent(decoded);
  } catch {
    password = encodeURIComponent(password);
  }

  const encodedUsername = encodeURIComponent(decodeURIComponent(username));

  // If path doesn't specify a database name, default to deeps_cake_shop
  let finalPath = pathAndQuery;
  if (!finalPath || finalPath === '/' || finalPath.startsWith('/?')) {
    const query = finalPath.startsWith('/?')
      ? finalPath.substring(2)
      : (finalPath.startsWith('?') ? finalPath.substring(1) : '');
    finalPath = `/deeps_cake_shop${query ? `?${query}` : ''}`;
  }

  return `${scheme}${encodedUsername}:${password}@${hostPart}${finalPath}`;
}

export async function connectDB(): Promise<typeof mongoose | null> {
  if (isConnected) {
    return mongoose;
  }

  const normalizedUri = normalizeMongoUri(env.MONGODB_URI);

  // If SRV record on Windows, configure public DNS to avoid querySrv ECONNREFUSED issues in c-ares
  if (normalizedUri.startsWith('mongodb+srv://')) {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch {
      // Ignore if DNS server override is restricted
    }
  }

  try {
    const conn = await mongoose.connect(normalizedUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`[Database] MongoDB connected successfully to ${conn.connection.host}/${conn.connection.name}`);

    // If connected, automatically check if database needs initial seeding
    try {
      const { seedInitialData } = await import('../scripts/seed.js');
      await seedInitialData(false);
    } catch (seedErr: any) {
      console.warn(`[Database Auto-Seed Note] Could not auto-seed: ${seedErr.message}`);
    }

    return conn;
  } catch (err: any) {
    isConnected = false;
    const maskedUri = normalizedUri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@.*)/, '$1******$2');
    console.error(`[Database Warning] Could not connect to MongoDB at "${maskedUri}".`);
    console.error(`[Database Diagnostic] Error message: ${err.message}`);

    if (err.message && err.message.includes('authentication failed')) {
      console.info(`[Database Info] Authentication failed on MongoDB Atlas. Please check:`);
      console.info(`  1. MongoDB Atlas > Database Access: Ensure database user exists with correct password.`);
      console.info(`  2. Ensure the user has "Read and write to any database" or "readWrite@deeps_cake_shop" privileges.`);
      console.info(`  3. MongoDB Atlas > Network Access: Ensure IP access list includes your current IP or 0.0.0.0/0 (anywhere).`);
    } else {
      console.info(`[Database Info] If you are using MongoDB Atlas, verify your MONGODB_URI in server/.env with your cluster credentials.`);
      console.info(`[Database Info] If you are running MongoDB locally, ensure the mongod service is active (mongod --dbpath <data_dir>).`);
    }
    return null;
  }
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDB(): Promise<void> {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[Database] MongoDB disconnected cleanly.');
  }
}
