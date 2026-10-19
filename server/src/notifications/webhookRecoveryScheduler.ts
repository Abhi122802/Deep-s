import { claimWebhookEvent, completeWebhookEvent } from '../models/WebhookEvent.js';
import { notificationService } from './notificationService.js';
import { logger } from '../utils/logger.js';
import { sanitizeLogDetails } from './sanitize.js';

export interface WebhookRecoverySchedulerOptions {
  intervalMs?: number;
  batchSize?: number;
  leaseDurationMs?: number;
  minAgeMs?: number;
  workerId?: string;
}

/**
 * Manages the background recovery lifecycle for interrupted, stalled, or failed inbound webhook events (AUD-M3-02).
 *
 * Guarantees & Safeguards:
 * 1. Single active timer instance per process (prevents duplicate interval timers).
 * 2. Non-overlapping executions (if previous recovery scan is still running, skips execution).
 * 3. Atomic batch leasing: Claims events atomically with fenced leaseGeneration tokens.
 * 4. Stale lease protection: Re-claims abandoned events where lockedUntil has expired.
 * 5. Bounded backoff: Enforces exponential backoff schedules and respects maxRetries.
 * 6. Minimum age protection: Defaults to 60s minimum age to prevent competing with in-flight HTTP requests.
 * 7. Clean lifecycle: unref() timers so background processing never stalls process shutdown.
 */
export class WebhookRecoveryScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isExecuting = false;
  private intervalMs: number;
  private batchSize: number;
  private leaseDurationMs: number;
  private minAgeMs: number;
  private workerId: string;

  constructor(options: WebhookRecoverySchedulerOptions = {}) {
    this.intervalMs = options.intervalMs ?? 60_000;
    this.batchSize = options.batchSize ?? 25;
    this.leaseDurationMs = options.leaseDurationMs ?? 30_000;
    this.minAgeMs = options.minAgeMs ?? 60_000;
    this.workerId =
      options.workerId ??
      `webhook_recovery_${process.pid}_${Math.random().toString(36).substring(2, 7)}`;
  }

  start(customIntervalMs?: number): void {
    if (this.timer) {
      logger.warn('[Webhook Recovery Scheduler] Background scheduler is already running. Duplicate start ignored.');
      return;
    }

    if (customIntervalMs && customIntervalMs > 0) {
      this.intervalMs = customIntervalMs;
    }

    logger.info(
      `[Webhook Recovery Scheduler] Initializing background webhook recovery scheduler (interval: ${Math.round(
        this.intervalMs / 1000
      )}s, batch: ${this.batchSize})...`
    );

    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        logger.error(`[Webhook Recovery Scheduler] Uncaught tick error: ${sanitizeLogDetails(err.message)}`);
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
      logger.info('[Webhook Recovery Scheduler] Background webhook recovery scheduler stopped cleanly.');
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  setMinAgeMs(minAgeMs: number): void {
    this.minAgeMs = minAgeMs;
  }

  setBatchSize(batchSize: number): void {
    this.batchSize = batchSize;
  }

  async tick(): Promise<number> {
    if (this.isExecuting) {
      logger.warn('[Webhook Recovery Scheduler] Previous scan is still in flight. Skipping overlapping execution.');
      return 0;
    }

    this.isExecuting = true;
    let recoveredCount = 0;
    let failedCount = 0;
    let ignoredCount = 0;

    try {
      for (let i = 0; i < this.batchSize; i++) {
        const claim = await claimWebhookEvent({
          workerId: this.workerId,
          leaseDurationMs: this.leaseDurationMs,
          minAgeMs: this.minAgeMs,
          allowStatus: ['received', 'processing', 'failed'],
        });

        if (!claim.claimed || !claim.event) {
          // No more eligible events to claim in this tick
          break;
        }

        const event = claim.event;
        const docId = String(event._id || event.id);
        const leaseGeneration = event.leaseGeneration || 0;
        const provider = event.provider;
        const providerMessageId = event.providerMessageId;
        const eventType = event.eventType;
        const sanitizedSummary = event.sanitizedSummary || {};

        if (provider && providerMessageId && eventType) {
          try {
            const transitionResult = await notificationService.applyDeliveryStatusTransition({
              provider: provider as any,
              providerMessageId: String(providerMessageId),
              eventType: String(eventType),
              errorMessage: sanitizedSummary.reason || sanitizedSummary.errorMessage,
              rawPayload: sanitizedSummary,
            });

            if (transitionResult.isIgnored || !transitionResult.matched) {
              ignoredCount++;
              await completeWebhookEvent({
                id: docId,
                leaseGeneration,
                status: 'ignored',
                errorMessage: transitionResult.reason || 'Event did not match any delivery transition',
              });
            } else {
              recoveredCount++;
              await completeWebhookEvent({
                id: docId,
                leaseGeneration,
                status: 'processed',
              });
            }
          } catch (err: any) {
            failedCount++;
            logger.error(
              `[Webhook Recovery Error] Error applying transition for event ${docId}: ${sanitizeLogDetails(
                err.message
              )}`
            );
            await completeWebhookEvent({
              id: docId,
              leaseGeneration,
              status: 'failed',
              errorMessage: err.message,
            });
          }
        } else {
          ignoredCount++;
          await completeWebhookEvent({
            id: docId,
            leaseGeneration,
            status: 'ignored',
            errorMessage: 'Missing provider, providerMessageId, or eventType on stored WebhookEvent',
          });
        }
      }

      if (recoveredCount > 0 || failedCount > 0) {
        logger.info(
          `[Webhook Recovery Scheduler] Tick completed: recovered ${recoveredCount}, failed ${failedCount}, ignored ${ignoredCount}.`
        );
      }

      return recoveredCount;
    } catch (err: any) {
      logger.error(`[Webhook Recovery Scheduler Error] Tick execution failure: ${sanitizeLogDetails(err.message)}`);
      return 0;
    } finally {
      this.isExecuting = false;
    }
  }
}

export const webhookRecoveryScheduler = new WebhookRecoveryScheduler();
