import { notificationService } from './notificationService.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

/**
 * Manages the lifecycle of background notification crash recovery.
 * Guarantees:
 * 1. Single active timer instance per process (prevents duplicate interval timers).
 * 2. Non-overlapping executions (if previous recovery scan is active, skips execution).
 * 3. Preserves uncertain-delivery safeguards (never automatically resends uncertain notifications).
 * 4. Graceful clean shutdown.
 */
export class NotificationRecoveryScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isExecuting = false;
  private intervalMs: number;

  constructor(intervalMs: number = env.NOTIFICATION_RECOVERY_INTERVAL_MS) {
    this.intervalMs = intervalMs;
  }

  start(customIntervalMs?: number): void {
    if (this.timer) {
      logger.warn('[Recovery Scheduler] Background scheduler is already running. Duplicate start ignored.');
      return;
    }

    if (customIntervalMs && customIntervalMs > 0) {
      this.intervalMs = customIntervalMs;
    }

    logger.info(`[Recovery Scheduler] Initializing background notification recovery scheduler (interval: ${Math.round(this.intervalMs / 1000)}s)...`);

    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        logger.error(`[Recovery Scheduler] Uncaught tick error: ${err.message}`);
      });
    }, this.intervalMs);

    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('[Recovery Scheduler] Background notification recovery scheduler stopped cleanly.');
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  async tick(): Promise<number> {
    if (this.isExecuting) {
      logger.warn('[Recovery Scheduler] Previous recovery scan is still in flight. Skipping overlapping execution.');
      return 0;
    }

    this.isExecuting = true;
    try {
      const recovered = await notificationService.recoverStuckSendingLogs();
      if (recovered > 0) {
        logger.info(`[Recovery Scheduler] Recovered ${recovered} stuck sending notification log(s).`);
      }
      return recovered;
    } catch (err: any) {
      logger.error(`[Recovery Scheduler Error] Execution failure: ${err.message}`);
      return 0;
    } finally {
      this.isExecuting = false;
    }
  }
}

export const notificationRecoveryScheduler = new NotificationRecoveryScheduler();
