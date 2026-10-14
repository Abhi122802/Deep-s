import { app } from './app.js';
import { env, validateNotificationConfig } from './config/env.js';
import { connectDB, isDbConnected, disconnectDB } from './config/db.js';
import { ensureNotificationLogIndexes } from './models/NotificationLog.js';
import { notificationService } from './notifications/notificationService.js';
import { notificationRecoveryScheduler } from './notifications/notificationRecoveryScheduler.js';
import { logger } from './utils/logger.js';

export interface ShutdownOptions {
  server?: {
    close: (cb: (err?: Error) => void) => void;
    closeIdleConnections?: () => void;
    closeAllConnections?: () => void;
  };
  notificationService?: { drainInFlight: (timeoutMs: number) => Promise<{ drained: boolean; pendingCount: number }> };
  recoveryScheduler?: { stop: () => void };
  disconnectDB?: () => Promise<void>;
  drainTimeoutMs?: number;
  serverCloseTimeoutMs?: number;
  onExit?: (code: number) => void;
}

/**
 * Creates an idempotent, graceful shutdown handler that:
 * 1. Stops the recovery scheduler immediately.
 * 2. Stops accepting new HTTP requests and closes idle keep-alive connections.
 * 3. Enforces bounded timeouts so lingering sockets cannot stall termination.
 * 4. Drains in-flight notifications up to a bounded timeout.
 * 5. Disconnects MongoDB only AFTER draining completes or times out.
 * 6. Preserves uncertain delivery records on timeout without falsifying state.
 */
export function createShutdownHandler(options: ShutdownOptions = {}) {
  let isShuttingDown = false;

  const targetNotificationService = options.notificationService || notificationService;
  const targetScheduler = options.recoveryScheduler || notificationRecoveryScheduler;
  const targetDisconnectDB = options.disconnectDB || disconnectDB;
  const drainTimeoutMs = options.drainTimeoutMs ?? env.NOTIFICATION_DRAIN_TIMEOUT_MS ?? 10000;
  const serverCloseTimeoutMs = options.serverCloseTimeoutMs ?? drainTimeoutMs;

  return async function shutdown(signal = 'SIGTERM'): Promise<void> {
    if (isShuttingDown) {
      logger.warn(`[Shutdown] Shutdown is already in progress. Repeated ${signal} signal ignored.`);
      return;
    }
    isShuttingDown = true;

    logger.info(`[Shutdown] Received ${signal}. Terminating server cleanly...`);

    // 1. Stop background recovery scheduler
    try {
      targetScheduler.stop();
    } catch (schedErr: any) {
      logger.warn(`[Shutdown Warning] Error stopping recovery scheduler: ${schedErr.message}`);
    }

    // 2. Stop accepting new HTTP requests and handle keep-alive connections safely
    const closeServerPromise = new Promise<void>((resolve) => {
      if (options.server && typeof options.server.close === 'function') {
        let isDone = false;
        let forceCloseTimer: NodeJS.Timeout | undefined;

        const finalizeServerClose = (warnMsg?: string) => {
          if (isDone) return;
          isDone = true;
          if (forceCloseTimer) clearTimeout(forceCloseTimer);
          if (warnMsg) logger.warn(warnMsg);
          resolve();
        };

        // Close idle keep-alive connections immediately if supported by the runtime (Node 19+ / 18.2+)
        if (typeof options.server.closeIdleConnections === 'function') {
          try {
            options.server.closeIdleConnections();
          } catch (idleErr: any) {
            logger.warn(`[Shutdown Warning] Error closing idle connections: ${idleErr.message}`);
          }
        }

        // Enforce a bounded timeout so lingering client sockets do not hang process shutdown indefinitely
        forceCloseTimer = setTimeout(() => {
          if (typeof options.server?.closeAllConnections === 'function') {
            try {
              options.server.closeAllConnections();
            } catch (allErr: any) {
              logger.warn(`[Shutdown Warning] Error forcefully closing active connections: ${allErr.message}`);
            }
          }
          finalizeServerClose(`[Shutdown Warning] HTTP server close timed out after ${serverCloseTimeoutMs}ms. Forcing socket closure.`);
        }, serverCloseTimeoutMs);

        options.server.close((err) => {
          if (err) {
            finalizeServerClose(`[Shutdown Warning] Error closing HTTP server: ${err.message}`);
          } else {
            finalizeServerClose();
          }
        });
      } else {
        resolve();
      }
    });

    // 3. Drain in-flight notifications and await bounded HTTP server close concurrently
    try {
      await Promise.all([
        closeServerPromise,
        targetNotificationService.drainInFlight(drainTimeoutMs),
      ]);
    } catch (drainErr: any) {
      logger.error(`[Shutdown Error] Error while draining active notifications: ${drainErr.message}`);
    }

    // 4. Disconnect MongoDB only after drain completes or timeout expires
    try {
      await targetDisconnectDB();
      logger.info('[Shutdown] Database disconnected cleanly.');
    } catch (dbErr: any) {
      logger.error(`[Shutdown Error] Error disconnecting database: ${dbErr.message}`);
    }

    logger.info('[Shutdown] Server closed and shutdown complete.');

    if (options.onExit) {
      options.onExit(0);
    } else {
      process.exit(0);
    }
  };
}

async function bootstrap() {
  logger.info(`[Startup] Initializing Deep's Cake Shop Backend Server (Node ${process.version}, ${env.NODE_ENV})...`);

  // 1. Production Notification Safety Prerequisite Check
  const configCheck = validateNotificationConfig(env);
  if (!configCheck.valid && env.NODE_ENV === 'production') {
    const errorMsg = `[Startup Fatal] Production notification configuration invalid: ${configCheck.errors.join('; ')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  // 2. Attempt database connection
  await connectDB();

  // 3. Database-dependent initialization (Indexes & Notification Crash Recovery)
  if (isDbConnected()) {
    try {
      const indexResult = await ensureNotificationLogIndexes({ dryRun: false });
      if (indexResult.createdIndexes.length > 0) {
        logger.info(`[Startup Index Sync] Created ${indexResult.createdIndexes.length} missing secondary index(es): ${indexResult.createdIndexes.join(', ')}`);
      }
    } catch (idxErr: any) {
      logger.warn(`[Startup Index Warning] Could not sync indexes: ${idxErr.message}`);
    }

    try {
      const initialRecovered = await notificationService.recoverStuckSendingLogs();
      if (initialRecovered > 0) {
        logger.info(`[Startup Recovery] Cleaned up ${initialRecovered} stuck notification(s) from prior session.`);
      }
    } catch (recErr: any) {
      logger.warn(`[Startup Recovery Warning] Initial recovery scan error: ${recErr.message}`);
    }

    // Start background recovery scheduler with controlled lifecycle
    notificationRecoveryScheduler.start();
  } else if (env.NODE_ENV === 'production') {
    const errorMsg = '[Startup Fatal] Database connection is required in production mode. Refusing startup without persistent database.';
    logger.error(errorMsg);
    throw new Error(errorMsg);
  } else {
    logger.warn('[Startup Database Note] MongoDB is offline. Running with resilient local demo fallbacks (dev/test mode).');
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`-----------------------------------------------------`);
    logger.info(`🍰 Deep's Cake Shop API running at http://localhost:${env.PORT}`);
    logger.info(`📡 Health Check: http://localhost:${env.PORT}/api/health`);
    logger.info(`🎂 Cake Catalog: http://localhost:${env.PORT}/api/cakes`);
    logger.info(`📂 Categories:   http://localhost:${env.PORT}/api/categories`);
    logger.info(`-----------------------------------------------------`);
  });

  // Graceful shutdown handling with bounded drain and safe MongoDB disconnection
  const shutdown = createShutdownHandler({
    server,
    notificationService,
    recoveryScheduler: notificationRecoveryScheduler,
    disconnectDB,
  });

  process.on('SIGTERM', () => { shutdown('SIGTERM'); });
  process.on('SIGINT', () => { shutdown('SIGINT'); });
}

bootstrap().catch((err) => {
  logger.error(`[Fatal Error] Failed to start server: ${err.message}`, { error: err.stack });
  process.exit(1);
});
