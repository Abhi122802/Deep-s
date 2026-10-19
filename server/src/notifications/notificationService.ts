import {
  INotificationProvider,
  NotificationPayload,
  NotificationChannel,
  NotificationEventType,
  CustomerConsent,
  OrderPlacedTemplateData,
  OrderStatusTemplateData,
  InquiryQuotationTemplateData,
} from './types.js';
import { defaultMockProvider, DevMockNotificationProvider } from './providers/mockProvider.js';
import {
  NotificationLogModel,
  INotificationLog,
  MEMORY_NOTIFICATION_LOGS,
  DeliveryStatus,
} from '../models/NotificationLog.js';
import { isDbConnected } from '../config/db.js';
import { env, validateNotificationConfig } from '../config/env.js';
import { sanitizeLogDetails, isValidEmail, isValidPhone } from './sanitize.js';
import { renderOrderPlacedTemplate } from './templates/orderPlaced.template.js';
import { renderOrderStatusTemplate } from './templates/orderStatus.template.js';
import { renderInquiryQuotationTemplate } from './templates/inquiryQuotation.template.js';
import { logger } from '../utils/logger.js';

export interface DispatchNotificationOptions {
  channel: NotificationChannel;
  eventType: NotificationEventType;
  recipient: string;
  subject?: string;
  message: string;
  idempotencyKey: string;
  metadata?: Record<string, any>;
  customerConsent?: CustomerConsent;
  maxAttempts?: number;
}

export interface DispatchNotificationResult {
  notificationId: string;
  idempotencyKey: string;
  status: DeliveryStatus;
  channel: NotificationChannel;
  recipient: string;
  attempts: number;
  skippedReason?: string;
  providerMessageId?: string;
  error?: string;
}

export interface PaginatedNotificationLogs {
  logs: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RetryNotificationResult {
  success: boolean;
  statusCode: number;
  message: string;
  data?: any;
  error?: string;
}

/**
 * ============================================================================
 * ARCHITECTURAL DELIVERY GUARANTEES & LIMITATIONS
 * ============================================================================
 * 1. Delivery Semantics: AT-LEAST-ONCE (Bounded retries within process lifecycle)
 *    - Each notification payload is dispatched with a unique, deterministic idempotency key.
 *    - In the event of transient provider timeouts or HTTP 5xx errors, the service retries
 *      up to maxAttempts (default: 3) using exponential backoff with randomized jitter.
 *
 * 2. Idempotency & Deduplication:
 *    - A unique index on `idempotencyKey` prevents duplicate database logs.
 *    - Dispatches checking an existing 'delivered' or active 'sending' record immediately
 *      deduplicate and return the existing delivery state without re-invoking the provider.
 *    - An in-memory in-flight lock map prevents duplicate dispatches from concurrent calls.
 *
 * 3. Stuck 'sending' Status & Crash Recovery:
 *    - If a Node process crashes or ungracefully exits while a record is in 'sending',
 *      the record could remain in 'sending'.
 *    - `recoverStuckSendingLogs()` scans for records in 'sending' older than the threshold
 *      (default: 5 minutes) and transitions them to 'failed' (timeout) or allows recovery.
 *
 * 4. Boundary Limitation (Why this is NOT Exactly-Once):
 *    - Across external network boundaries (e.g. SendGrid, Twilio), true "exactly-once" delivery
 *      is mathematically impossible without two-phase commit across the remote provider API.
 *    - If a network partition occurs immediately AFTER the external provider dispatches an email
 *      but BEFORE the HTTP response returns to update the database, a subsequent retry could
 *      result in a duplicate external send.
 *    - To achieve enterprise-grade durability and decouple process crashes from HTTP lifecycles,
 *      a transactional outbox pattern (polling MongoDB change streams / CDC) combined with
 *      a durable message queue (BullMQ / RabbitMQ / AWS SQS) is recommended for Phase 5.
 * ============================================================================
 */
export class NotificationService {
  private providers: Map<string, INotificationProvider> = new Map();
  private activeProviderName = 'mock';
  private defaultMaxAttempts = 3;
  private readonly stuckSendingThresholdMs = 5 * 60 * 1000; // 5 minutes
  private inFlightDispatches: Map<string, Promise<DispatchNotificationResult>> = new Map();
  private inFlightRetries: Map<string, Promise<RetryNotificationResult>> = new Map();
  private inFlightTasks: Set<Promise<any>> = new Set();
  private readonly maxRetryCeiling = 5;

  /**
   * Registers an active asynchronous notification dispatch promise
   * so that graceful shutdown can drain in-flight operations before database disconnection.
   */
  trackTask<T>(promise: Promise<T>): Promise<T> {
    this.inFlightTasks.add(promise);
    promise
      .catch(() => {
        // Prevent unhandled rejections during tracking
      })
      .finally(() => {
        this.inFlightTasks.delete(promise);
      });
    return promise;
  }

  getActiveTaskCount(): number {
    return this.inFlightTasks.size;
  }

  /**
   * Drains all active in-flight notification tasks up to timeoutMs.
   * Resolves { drained: true, pendingCount: 0 } if all tasks complete within timeout,
   * or { drained: false, pendingCount: N } if timeout expires.
   */
  async drainInFlight(timeoutMs = 10000): Promise<{ drained: boolean; pendingCount: number }> {
    if (this.inFlightTasks.size === 0) {
      return { drained: true, pendingCount: 0 };
    }

    logger.info(`[Notification Drain] Waiting for ${this.inFlightTasks.size} in-flight notification task(s) to complete (timeout: ${timeoutMs}ms)...`);

    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<{ timeout: true }>((resolve) => {
      timeoutId = setTimeout(() => resolve({ timeout: true }), timeoutMs);
    });

    const allTasksPromise = Promise.allSettled(Array.from(this.inFlightTasks));

    const result = await Promise.race([
      allTasksPromise.then(() => ({ timeout: false })),
      timeoutPromise,
    ]);

    if (timeoutId) clearTimeout(timeoutId);

    if (result.timeout) {
      const remaining = this.inFlightTasks.size;
      logger.warn(`[Notification Drain Warning] Drain timeout exceeded (${timeoutMs}ms). ${remaining} task(s) still in-flight. Disconnecting safely without modifying uncertain states.`);
      return { drained: false, pendingCount: remaining };
    }

    logger.info('[Notification Drain] All in-flight notification tasks drained successfully.');
    return { drained: true, pendingCount: 0 };
  }

  constructor() {
    // Register default development mock provider
    this.registerProvider(defaultMockProvider);

    // Validate environment configuration
    const configCheck = validateNotificationConfig(env);
    if (!configCheck.valid && env.NOTIFICATION_MODE === 'production') {
      logger.error(
        `[NotificationService Configuration Warning] Production mode misconfigured: ${configCheck.errors.join('; ')}`
      );
    }
  }

  /**
   * Registers a delivery provider into the service registry
   */
  registerProvider(provider: INotificationProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Switches the active delivery provider
   */
  setActiveProvider(providerName: string): void {
    if (!this.providers.has(providerName)) {
      throw new Error(`Notification provider "${providerName}" is not registered.`);
    }
    this.activeProviderName = providerName;
  }

  /**
   * Retrieves the currently active delivery provider
   */
  getActiveProvider(): INotificationProvider {
    const provider = this.providers.get(this.activeProviderName);
    if (!provider) {
      return defaultMockProvider;
    }
    return provider;
  }

  /**
   * Retrieves the mock provider instance for testing inspection
   */
  getMockProvider(): DevMockNotificationProvider {
    const provider = this.providers.get('mock');
    if (provider instanceof DevMockNotificationProvider) {
      return provider;
    }
    return defaultMockProvider;
  }

  /**
   * Validates customer contact format and verifies consent rules:
   * - Syntax check runs first (email format, phone digit count).
   * - Email: transactional receipt permitted unless customer explicitly opted out.
   * - WhatsApp / SMS: requires explicit opt-in (consent.[channel] === true).
   *   Consent is NEVER invented or assumed.
   */
  validateContactAndConsent(
    channel: NotificationChannel,
    recipient: string,
    consent?: CustomerConsent
  ): { valid: boolean; reason?: string } {
    // 1. Format syntax validation
    if (channel === 'email') {
      if (!isValidEmail(recipient)) {
        return {
          valid: false,
          reason: `Invalid email recipient address format: "${recipient}".`,
        };
      }
    } else if (channel === 'whatsapp' || channel === 'sms') {
      if (!isValidPhone(recipient)) {
        return {
          valid: false,
          reason: `Invalid phone recipient format: "${recipient}". At least 10 valid digits required.`,
        };
      }
    }

    // 2. Consent verification
    if (channel === 'whatsapp' || channel === 'sms') {
      // Messaging channels strictly require explicit opt-in consent
      if (!consent || consent[channel] !== true) {
        return {
          valid: false,
          reason: `Customer has not opted in to ${channel.toUpperCase()} communications. Explicit consent is required.`,
        };
      }
    } else if (channel === 'email') {
      // Transactional email permitted unless explicitly declined
      if (consent && consent.email === false) {
        return {
          valid: false,
          reason: `Customer has explicitly declined EMAIL communications.`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Checks whether a notification with this idempotency key was already recorded
   */
  async checkIdempotency(idempotencyKey: string): Promise<any | null> {
    if (!idempotencyKey) return null;

    if (isDbConnected()) {
      const existing = await NotificationLogModel.findOne({ idempotencyKey }).lean();
      return existing || null;
    }

    const existingMemory = MEMORY_NOTIFICATION_LOGS.find(
      (log) => log.idempotencyKey === idempotencyKey
    );
    return existingMemory || null;
  }

  /**
   * Persists or updates a notification log record.
   * CRITICAL SECURITY & AUDIT RULE:
   * In production mode, database write failures must NEVER silently fall back
   * to volatile memory, which would mask persistent audit loss.
   */
  async saveNotificationLog(logData: Partial<INotificationLog>): Promise<void> {
    const sanitizedError = logData.sanitizedError
      ? sanitizeLogDetails(logData.sanitizedError)
      : undefined;

    const record = {
      ...logData,
      sanitizedError,
      updatedAt: logData.updatedAt || new Date(),
    };

    if (isDbConnected()) {
      try {
        await NotificationLogModel.findOneAndUpdate(
          { idempotencyKey: logData.idempotencyKey },
          { $set: record },
          { upsert: true, new: true }
        );
        return;
      } catch (err: any) {
        if (env.NODE_ENV === 'production') {
          console.error(
            `[CRITICAL NOTIFICATION AUDIT FAILURE] Database write failed in production mode: ${err.message}`
          );
          throw new Error(`Production notification log persistence failure: ${err.message}`);
        }
        console.warn(`[Notification Warning] Falling back to memory log in dev/test: ${err.message}`);
      }
    } else if (env.NODE_ENV === 'production') {
      console.error(
        '[CRITICAL NOTIFICATION AUDIT FAILURE] Database is disconnected in production mode. Refusing silent in-memory fallback.'
      );
      throw new Error('Production notification log persistence failure: Database is not connected.');
    }

    // In-Memory log persistence (Restricted to dev / test environments)
    const idx = MEMORY_NOTIFICATION_LOGS.findIndex(
      (l) => l.idempotencyKey === logData.idempotencyKey
    );
    if (idx !== -1) {
      MEMORY_NOTIFICATION_LOGS[idx] = {
        ...MEMORY_NOTIFICATION_LOGS[idx],
        ...record,
      };
    } else {
      MEMORY_NOTIFICATION_LOGS.unshift({
        id: `mem_notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: record.queuedAt || new Date(),
        ...record,
      });
    }
  }

  /**
   * Scans for stale logs stuck in 'sending' state due to an unexpected process crash
   * or provider disconnect, transitioning them safely to 'failed'.
   */
  async recoverStuckSendingLogs(stuckThresholdMs = this.stuckSendingThresholdMs): Promise<number> {
    const cutoffDate = new Date(Date.now() - stuckThresholdMs);
    let recoveredCount = 0;

    if (isDbConnected()) {
      const result = await NotificationLogModel.updateMany(
        {
          deliveryStatus: 'sending',
          $or: [
            { updatedAt: { $lt: cutoffDate } },
            { queuedAt: { $lt: cutoffDate } },
          ],
        },
        {
          $set: {
            deliveryStatus: 'failed',
            sanitizedError: 'Dispatch timed out or process terminated before confirmation',
            failedAt: new Date(),
            'metadata.uncertainOutcome': true,
            'metadata.crashedWhileSending': true,
          },
        }
      );
      recoveredCount = result.modifiedCount || 0;
    } else {
      for (const log of MEMORY_NOTIFICATION_LOGS) {
        const logDate = log.updatedAt || log.queuedAt || log.createdAt;
        if (
          log.deliveryStatus === 'sending' &&
          logDate &&
          new Date(logDate).getTime() < cutoffDate.getTime()
        ) {
          log.deliveryStatus = 'failed';
          log.sanitizedError = 'Dispatch timed out or process terminated before confirmation';
          log.failedAt = new Date();
          log.metadata = {
            ...(log.metadata || {}),
            uncertainOutcome: true,
            crashedWhileSending: true,
          };
          recoveredCount++;
        }
      }
    }

    if (recoveredCount > 0) {
      logger.info(`[Notification Recovery] Cleaned up ${recoveredCount} stuck 'sending' notification(s).`, {
        recoveredCount,
      });
    }
    return recoveredCount;
  }

  /**
   * Public dispatch method with in-flight concurrency locking.
   * If an identical idempotencyKey is already in flight in the current process,
   * subsequent callers await the existing execution rather than double-sending.
   */
  async dispatch(options: DispatchNotificationOptions): Promise<DispatchNotificationResult> {
    if (this.inFlightDispatches.has(options.idempotencyKey)) {
      return this.inFlightDispatches.get(options.idempotencyKey)!;
    }

    const executionPromise = this.internalDispatch(options);
    this.inFlightDispatches.set(options.idempotencyKey, executionPromise);
    this.trackTask(executionPromise);

    try {
      return await executionPromise;
    } finally {
      this.inFlightDispatches.delete(options.idempotencyKey);
    }
  }

  /**
   * Internal execution method with:
   * 1. Idempotency guard & database concurrency reservation
   * 2. Customer consent & contact syntax verification
   * 3. Bounded exponential retries with jitter & timeout handling
   * 4. Sanitized audit logging with strict production durability
   */
  private async internalDispatch(options: DispatchNotificationOptions): Promise<DispatchNotificationResult> {
    const notificationId = `NOTIF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const maxAttempts = options.maxAttempts || this.defaultMaxAttempts;
    const provider = this.getActiveProvider();

    // 1. Idempotency Guard & Concurrency Reservation
    const existingLog = await this.checkIdempotency(options.idempotencyKey);
    if (existingLog) {
      if (existingLog.deliveryStatus === 'delivered') {
        return {
          notificationId: existingLog.notificationId,
          idempotencyKey: options.idempotencyKey,
          status: 'delivered',
          channel: options.channel,
          recipient: options.recipient,
          attempts: existingLog.attempts || 1,
          providerMessageId: existingLog.metadata?.providerMessageId,
          skippedReason: 'Duplicate send prevented by idempotency key.',
        };
      }

      if (existingLog.deliveryStatus === 'sending') {
        const timeInSending = Date.now() - new Date(existingLog.updatedAt || existingLog.queuedAt).getTime();
        if (timeInSending < this.stuckSendingThresholdMs) {
          return {
            notificationId: existingLog.notificationId,
            idempotencyKey: options.idempotencyKey,
            status: 'sending',
            channel: options.channel,
            recipient: options.recipient,
            attempts: existingLog.attempts || 1,
            skippedReason: 'Concurrent dispatch currently in progress.',
          };
        }
        // Log is stuck beyond threshold -> proceed with crash recovery retry
        console.warn(
          `[Notification Recovery] Stuck 'sending' state detected for key "${options.idempotencyKey}" (${Math.round(
            timeInSending / 1000
          )}s old). Proceeding with recovery dispatch.`
        );
      }
    }

    // 2. Customer Contact & Consent Verification
    const validation = this.validateContactAndConsent(
      options.channel,
      options.recipient,
      options.customerConsent
    );

    if (!validation.valid) {
      await this.saveNotificationLog({
        notificationId,
        idempotencyKey: options.idempotencyKey,
        channel: options.channel,
        eventType: options.eventType,
        recipient: options.recipient,
        provider: provider.name,
        deliveryStatus: 'skipped',
        attempts: 0,
        maxAttempts,
        subject: options.subject,
        message: options.message,
        messagePreview: options.message.substring(0, 300),
        metadata: { ...options.metadata, skipReason: validation.reason },
        customerConsent: options.customerConsent,
        sanitizedError: validation.reason,
        queuedAt: new Date(),
      });

      return {
        notificationId,
        idempotencyKey: options.idempotencyKey,
        status: 'skipped',
        channel: options.channel,
        recipient: options.recipient,
        attempts: 0,
        skippedReason: validation.reason,
      };
    }

    // 3. Mark state as 'sending' to lock concurrent duplicate dispatches
    await this.saveNotificationLog({
      notificationId,
      idempotencyKey: options.idempotencyKey,
      channel: options.channel,
      eventType: options.eventType,
      recipient: options.recipient,
      provider: provider.name,
      deliveryStatus: 'sending',
      attempts: 1,
      maxAttempts,
      subject: options.subject,
      message: options.message,
      messagePreview: options.message.substring(0, 300),
      metadata: options.metadata,
      customerConsent: options.customerConsent,
      queuedAt: new Date(),
    });

    // 4. Execution with Bounded Retries, Jitter & Timeout Guard
    let attempt = 0;
    let lastError = '';
    let isDelivered = false;
    let providerMsgId: string | undefined = undefined;

    const payload: NotificationPayload = {
      notificationId,
      idempotencyKey: options.idempotencyKey,
      channel: options.channel,
      eventType: options.eventType,
      recipient: options.recipient,
      subject: options.subject,
      message: options.message,
      metadata: options.metadata,
      customerConsent: options.customerConsent,
    };

    while (attempt < maxAttempts && !isDelivered) {
      attempt++;

      if (attempt > 1) {
        // Exponential backoff with randomized jitter
        const baseDelayMs = 150;
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 2);
        const jitter = Math.floor(Math.random() * 50);
        const backoffMs = Math.min(exponentialDelay + jitter, 2500);
        await new Promise((res) => setTimeout(res, backoffMs));
      }

      const abortController = new AbortController();
      let timeoutId: NodeJS.Timeout | undefined;

      try {
        // Enforce 5000ms bounded timeout on provider network calls
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            abortController.abort(new Error('Provider dispatch timed out (5000ms threshold)'));
            reject(new Error('Provider dispatch timed out (5000ms threshold)'));
          }, 5000);
        });

        const result = await Promise.race([
          provider.send({ ...payload, signal: abortController.signal }),
          timeoutPromise,
        ]);
        if (timeoutId) clearTimeout(timeoutId);

        if (result.success) {
          isDelivered = true;
          providerMsgId = result.providerMessageId;
          break;
        } else {
          lastError = result.error || 'Unknown delivery failure';
          if (result.retryable === false) {
            // Unretryable provider rejection (e.g. fatal 4xx bad recipient)
            break;
          }
        }
      } catch (err: any) {
        lastError = err?.message || 'Provider execution exception';
      }
    }

    // 5. Finalize Audit Record
    const finalStatus: DeliveryStatus = isDelivered ? 'delivered' : 'failed';
    const now = new Date();

    await this.saveNotificationLog({
      notificationId,
      idempotencyKey: options.idempotencyKey,
      channel: options.channel,
      eventType: options.eventType,
      recipient: options.recipient,
      provider: provider.name,
      providerMessageId: providerMsgId,
      deliveryStatus: finalStatus,
      attempts: attempt,
      maxAttempts,
      subject: options.subject,
      message: options.message,
      messagePreview: options.message.substring(0, 300),
      metadata: {
        ...options.metadata,
        providerMessageId: providerMsgId,
      },
      customerConsent: options.customerConsent,
      sanitizedError: isDelivered ? undefined : lastError,
      queuedAt: new Date(),
      sentAt: isDelivered ? now : undefined,
      failedAt: isDelivered ? undefined : now,
    });

    return {
      notificationId,
      idempotencyKey: options.idempotencyKey,
      status: finalStatus,
      channel: options.channel,
      recipient: options.recipient,
      attempts: attempt,
      providerMessageId: providerMsgId,
      error: isDelivered ? undefined : sanitizeLogDetails(lastError),
    };
  }

  /**
   * Asynchronously dispatches Order Placed confirmation receipt.
   * Respects customer consent: messaging channels (WhatsApp/SMS) only sent
   * if explicit opt-in consent is provided.
   */
  async sendOrderPlacedNotification(
    data: OrderPlacedTemplateData,
    customerConsent?: CustomerConsent
  ): Promise<DispatchNotificationResult[]> {
    const task = (async () => {
      const results: DispatchNotificationResult[] = [];

      // 1. Transactional Email receipt
      try {
        const emailTemplate = renderOrderPlacedTemplate(data, 'email');
        const emailResult = await this.dispatch({
          channel: 'email',
          eventType: 'order_placed',
          recipient: (data as any).customer?.email || (data as any).email || 'customer@example.com',
          subject: emailTemplate.subject,
          message: emailTemplate.message,
          idempotencyKey: `order-placed:${data.orderId}:email`,
          metadata: { orderId: data.orderId, ...emailTemplate.metadata },
          customerConsent,
        });
        results.push(emailResult);
      } catch (err: any) {
        logger.warn(`[Notification Warning] Failed to dispatch order placed email: ${sanitizeLogDetails(err.message)}`);
      }

      // 2. WhatsApp notification (Strictly requires explicit opt-in consent)
      if (customerConsent?.whatsapp === true) {
        try {
          const phone = (data as any).customer?.phone || (data as any).phone;
          if (phone) {
            const whatsappTemplate = renderOrderPlacedTemplate(data, 'whatsapp');
            const whatsappResult = await this.dispatch({
              channel: 'whatsapp',
              eventType: 'order_placed',
              recipient: phone,
              subject: whatsappTemplate.subject,
              message: whatsappTemplate.message,
              idempotencyKey: `order-placed:${data.orderId}:whatsapp`,
              metadata: { orderId: data.orderId, ...whatsappTemplate.metadata },
              customerConsent,
            });
            results.push(whatsappResult);
          }
        } catch (err: any) {
          logger.warn(`[Notification Warning] Failed to dispatch order placed whatsapp: ${sanitizeLogDetails(err.message)}`);
        }
      }

      return results;
    })();

    return this.trackTask(task);
  }

  /**
   * Asynchronously dispatches Order Status Transition update notification.
   * Respects channel consent rules.
   */
  async sendOrderStatusNotification(
    data: OrderStatusTemplateData,
    customerEmail?: string,
    customerPhone?: string,
    customerConsent?: CustomerConsent
  ): Promise<DispatchNotificationResult[]> {
    const task = (async () => {
      const results: DispatchNotificationResult[] = [];

      // 1. Email notification
      if (customerEmail) {
        try {
          const emailTemplate = renderOrderStatusTemplate(data, 'email');
          const emailResult = await this.dispatch({
            channel: 'email',
            eventType: 'order_status_updated',
            recipient: customerEmail,
            subject: emailTemplate.subject,
            message: emailTemplate.message,
            idempotencyKey: `order-status:${data.orderId}:${data.newStatus}:email`,
            metadata: { orderId: data.orderId, status: data.newStatus, ...emailTemplate.metadata },
            customerConsent,
          });
          results.push(emailResult);
        } catch (err: any) {
          logger.warn(`[Notification Warning] Failed to dispatch order status email: ${sanitizeLogDetails(err.message)}`);
        }
      }

      // 2. WhatsApp notification (Strictly requires explicit opt-in consent)
      if (customerPhone && customerConsent?.whatsapp === true) {
        try {
          const whatsappTemplate = renderOrderStatusTemplate(data, 'whatsapp');
          const whatsappResult = await this.dispatch({
            channel: 'whatsapp',
            eventType: 'order_status_updated',
            recipient: customerPhone,
            subject: whatsappTemplate.subject,
            message: whatsappTemplate.message,
            idempotencyKey: `order-status:${data.orderId}:${data.newStatus}:whatsapp`,
            metadata: { orderId: data.orderId, status: data.newStatus, ...whatsappTemplate.metadata },
            customerConsent,
          });
          results.push(whatsappResult);
        } catch (err: any) {
          logger.warn(`[Notification Warning] Failed to dispatch order status whatsapp: ${sanitizeLogDetails(err.message)}`);
        }
      }

      return results;
    })();

    return this.trackTask(task);
  }

  /**
   * Asynchronously dispatches Bespoke Cake Quotation Proposal notification.
   * Complies with non-order disclaimer and explicit consent rules.
   */
  async sendInquiryQuotationNotification(
    data: InquiryQuotationTemplateData,
    customerEmail?: string,
    customerPhone?: string,
    customerConsent?: CustomerConsent
  ): Promise<DispatchNotificationResult[]> {
    const task = (async () => {
      const results: DispatchNotificationResult[] = [];

      // 1. Email proposal
      if (customerEmail) {
        try {
          const emailTemplate = renderInquiryQuotationTemplate(data, 'email');
          const emailResult = await this.dispatch({
            channel: 'email',
            eventType: 'inquiry_quotation_sent',
            recipient: customerEmail,
            subject: emailTemplate.subject,
            message: emailTemplate.message,
            idempotencyKey: `inquiry-quote:${data.referenceId}:${data.quotedAmount}:email`,
            metadata: {
              referenceId: data.referenceId,
              quotedAmount: data.quotedAmount,
              ...emailTemplate.metadata,
            },
            customerConsent,
          });
          results.push(emailResult);
        } catch (err: any) {
          logger.warn(`[Notification Warning] Failed to dispatch quotation email: ${sanitizeLogDetails(err.message)}`);
        }
      }

      // 2. WhatsApp proposal (Strictly requires explicit opt-in consent)
      if (customerPhone && customerConsent?.whatsapp === true) {
        try {
          const whatsappTemplate = renderInquiryQuotationTemplate(data, 'whatsapp');
          const whatsappResult = await this.dispatch({
            channel: 'whatsapp',
            eventType: 'inquiry_quotation_sent',
            recipient: customerPhone,
            subject: whatsappTemplate.subject,
            message: whatsappTemplate.message,
            idempotencyKey: `inquiry-quote:${data.referenceId}:${data.quotedAmount}:whatsapp`,
            metadata: {
              referenceId: data.referenceId,
              quotedAmount: data.quotedAmount,
              ...whatsappTemplate.metadata,
            },
            customerConsent,
          });
          results.push(whatsappResult);
        } catch (err: any) {
          logger.warn(`[Notification Warning] Failed to dispatch quotation whatsapp: ${sanitizeLogDetails(err.message)}`);
        }
      }

      return results;
    })();

    return this.trackTask(task);
  }

  /**
   * Retrieves notification logs as an array (backwards compatible with tests)
   */
  async getLogs(params: {
    eventType?: NotificationEventType;
    channel?: NotificationChannel;
    deliveryStatus?: DeliveryStatus;
    search?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    const paginated = await this.getPaginatedLogs({
      ...params,
      page: 1,
      limit: params.limit || 50,
    });
    return paginated.logs;
  }

  /**
   * Retrieves paginated notification audit logs with total counts for the admin UI
   */
  async getPaginatedLogs(params: {
    page?: number;
    limit?: number;
    eventType?: NotificationEventType;
    channel?: NotificationChannel;
    deliveryStatus?: DeliveryStatus;
    search?: string;
  } = {}): Promise<PaginatedNotificationLogs> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    if (isDbConnected()) {
      const query: any = {};
      if (params.eventType) query.eventType = params.eventType;
      if (params.channel) query.channel = params.channel;
      if (params.deliveryStatus) query.deliveryStatus = params.deliveryStatus;
      if (params.search) {
        const regex = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
          { recipient: regex },
          { idempotencyKey: regex },
          { notificationId: regex },
          { providerMessageId: regex },
        ];
      }

      const [logs, total] = await Promise.all([
        NotificationLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        NotificationLogModel.countDocuments(query),
      ]);

      return {
        logs,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    }

    // In-Memory pagination for dev/test
    let filtered = [...MEMORY_NOTIFICATION_LOGS];
    if (params.eventType) filtered = filtered.filter((l) => l.eventType === params.eventType);
    if (params.channel) filtered = filtered.filter((l) => l.channel === params.channel);
    if (params.deliveryStatus) filtered = filtered.filter((l) => l.deliveryStatus === params.deliveryStatus);
    if (params.search) {
      const s = params.search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.recipient?.toLowerCase().includes(s) ||
          l.idempotencyKey?.toLowerCase().includes(s) ||
          l.notificationId?.toLowerCase().includes(s) ||
          l.providerMessageId?.toLowerCase().includes(s) ||
          l.metadata?.providerMessageId?.toLowerCase().includes(s)
      );
    }

    const total = filtered.length;
    const logs = filtered.slice(skip, skip + limit);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Retrieves a notification audit record by its provider message ID.
   * Checks top-level providerMessageId first, falling back to legacy metadata.providerMessageId.
   */
  async getLogByProviderMessageId(providerMessageId: string): Promise<any | null> {
    if (!providerMessageId || typeof providerMessageId !== 'string' || providerMessageId.trim().length === 0) {
      return null;
    }
    const trimmed = providerMessageId.trim();

    if (isDbConnected()) {
      try {
        const record = await NotificationLogModel.findOne({
          $or: [
            { providerMessageId: trimmed },
            { 'metadata.providerMessageId': trimmed },
          ],
        }).lean();
        if (record) return record;
      } catch (err: any) {
        logger.warn(`[Notification Warning] Error looking up notification log by provider message ID: ${sanitizeLogDetails(err.message)}`);
      }
    }

    // In-Memory lookup fallback for dev/test
    const mem = MEMORY_NOTIFICATION_LOGS.find(
      (l) => l.providerMessageId === trimmed || l.metadata?.providerMessageId === trimmed
    );
    return mem || null;
  }


  /**
   * Admin-authorized notification retry management:
   * 1. Inspects existing notification audit log by notificationId or MongoDB _id.
   * 2. Enforces strict eligibility criteria:
   *    - MUST be in 'failed' deliveryStatus.
   *    - Rejects 'delivered' (prevents accidental duplicate dispatches).
   *    - Rejects 'sending' (prevents concurrent in-flight retries).
   *    - Rejects 'skipped' (cannot override customer consent or invalid format without opt-in).
   *    - Rejects if attempts >= maxRetryCeiling (prevents indefinite retry loops on permanent failures).
   * 3. Prevents concurrent retries via optimistic atomic locking on MongoDB / in-memory state.
   * 4. Dispatches to the active provider using original immutable attributes (recipient, channel,
   *    eventType, subject, message, customerConsent). Arbitrary parameters cannot be supplied.
   * 5. Updates audit logs with new attempts count, timestamps, and delivery outcome.
   */
  async retryNotification(identifier: string): Promise<RetryNotificationResult> {
    if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
      return {
        success: false,
        statusCode: 400,
        message: 'Invalid notification identifier format.',
      };
    }

    const cleanId = identifier.trim();

    // 1. Locate record
    let record: any = null;
    let isFromDb = false;

    if (isDbConnected()) {
      try {
        const query = cleanId.match(/^[0-9a-fA-F]{24}$/)
          ? { $or: [{ _id: cleanId }, { notificationId: cleanId }] }
          : { notificationId: cleanId };
        record = await NotificationLogModel.findOne(query);
        if (record) isFromDb = true;
      } catch (err: any) {
        // If DB query fails, fall back to memory search
      }
    }

    if (!record) {
      record = MEMORY_NOTIFICATION_LOGS.find(
        (l) => l.notificationId === cleanId || l.id === cleanId || l._id === cleanId
      );
    }

    if (!record) {
      return {
        success: false,
        statusCode: 404,
        message: `Notification record "${cleanId}" was not found.`,
      };
    }

    // 2. Eligibility verification
    if (record.deliveryStatus === 'delivered') {
      return {
        success: false,
        statusCode: 400,
        message: 'Notification was already delivered successfully. Duplicate dispatches are prohibited.',
      };
    }

    if (record.deliveryStatus === 'sending') {
      return {
        success: false,
        statusCode: 409,
        message: 'Notification dispatch or retry is currently in flight. Concurrent retry prohibited.',
      };
    }

    if (record.deliveryStatus === 'skipped') {
      return {
        success: false,
        statusCode: 400,
        message: 'Notification was skipped due to customer consent preferences or invalid contact format. Cannot retry without customer consent.',
      };
    }

    if (record.deliveryStatus !== 'failed') {
      return {
        success: false,
        statusCode: 400,
        message: `Notification in "${record.deliveryStatus}" state is not eligible for retry. Only failed notifications may be retried.`,
      };
    }

    const currentAttempts = record.attempts || 0;
    if (currentAttempts >= this.maxRetryCeiling) {
      return {
        success: false,
        statusCode: 400,
        message: `Notification has reached the maximum permitted attempt limit (${this.maxRetryCeiling}). Cannot retry permanently failed notification.`,
      };
    }

    // 3. In-flight concurrency lock
    if (this.inFlightRetries.has(record.notificationId)) {
      return {
        success: false,
        statusCode: 409,
        message: 'Notification retry is currently in flight. Concurrent retry prohibited.',
      };
    }

    // 4. Atomic status transition to 'sending' (optimistic lock reservation)
    if (isFromDb) {
      const claimed = await NotificationLogModel.findOneAndUpdate(
        {
          _id: record._id,
          deliveryStatus: 'failed',
        },
        {
          $set: {
            deliveryStatus: 'sending',
            lastRetriedAt: new Date(),
          },
          $inc: { attempts: 1 },
        },
        { new: true }
      );

      if (!claimed) {
        return {
          success: false,
          statusCode: 409,
          message: 'Notification status was updated concurrently. Retry cancelled.',
        };
      }
      record = claimed;
    } else {
      record.deliveryStatus = 'sending';
      record.attempts = currentAttempts + 1;
      record.lastRetriedAt = new Date();
    }

    // 5. Execution with lock management
    const retryPromise = (async (): Promise<RetryNotificationResult> => {
      const provider = this.getActiveProvider();
      const updatedAttempts = record.attempts || currentAttempts + 1;

      // Re-validate consent & syntax
      const validation = this.validateContactAndConsent(
        record.channel,
        record.recipient,
        record.customerConsent
      );

      if (!validation.valid) {
        const errorMsg = validation.reason || 'Customer contact/consent validation failed on retry.';
        const failedAt = new Date();
        if (isFromDb) {
          await NotificationLogModel.findByIdAndUpdate(record._id, {
            $set: {
              deliveryStatus: 'failed',
              sanitizedError: errorMsg,
              failedAt,
            },
          });
        } else {
          record.deliveryStatus = 'failed';
          record.sanitizedError = errorMsg;
          record.failedAt = failedAt;
        }

        return {
          success: false,
          statusCode: 400,
          message: errorMsg,
        };
      }

      const isUncertain =
        Boolean(record.metadata?.uncertainOutcome) ||
        Boolean(record.sanitizedError?.includes('timed out')) ||
        Boolean(record.sanitizedError?.includes('process terminated'));

      // Build retry payload preserving original immutable fields
      const retryPayload: NotificationPayload = {
        notificationId: record.notificationId,
        idempotencyKey: record.idempotencyKey,
        channel: record.channel,
        eventType: record.eventType,
        recipient: record.recipient,
        subject: record.subject,
        message: record.message || record.messagePreview || `Notification retry for ${record.eventType}`,
        metadata: {
          ...record.metadata,
          isRetry: true,
          retryAttempt: updatedAttempts,
          previousError: record.sanitizedError,
          ...(isUncertain ? { uncertainOutcomeAcknowledged: true } : {}),
        },
        customerConsent: record.customerConsent,
      };

      const abortController = new AbortController();
      let timeoutId: NodeJS.Timeout | undefined;

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            abortController.abort(new Error('Provider dispatch timed out (5000ms threshold)'));
            reject(new Error('Provider dispatch timed out (5000ms threshold)'));
          }, 5000);
        });

        const result = await Promise.race([
          provider.send({ ...retryPayload, signal: abortController.signal }),
          timeoutPromise,
        ]);
        if (timeoutId) clearTimeout(timeoutId);
        const now = new Date();

        if (result.success) {
          const updateData: any = {
            deliveryStatus: 'delivered',
            sentAt: now,
            providerMessageId: result.providerMessageId,
            sanitizedError: undefined,
            metadata: {
              ...(record.metadata || {}),
              providerMessageId: result.providerMessageId,
              isRetry: true,
              ...(isUncertain ? { uncertainOutcomeAcknowledged: true } : {}),
            },
          };

          if (isFromDb) {
            const updated = await NotificationLogModel.findByIdAndUpdate(
              record._id,
              { $set: updateData, $unset: { sanitizedError: 1 } },
              { new: true }
            );
            return {
              success: true,
              statusCode: 200,
              message: 'Notification retry delivered successfully.',
              data: updated,
            };
          } else {
            Object.assign(record, updateData);
            delete record.sanitizedError;
            return {
              success: true,
              statusCode: 200,
              message: 'Notification retry delivered successfully.',
              data: record,
            };
          }
        } else {
          const sanitizedErr = sanitizeLogDetails(result.error || 'Retry delivery failed');
          const updateData: any = {
            deliveryStatus: 'failed',
            failedAt: now,
            sanitizedError: sanitizedErr,
          };

          if (isFromDb) {
            const updated = await NotificationLogModel.findByIdAndUpdate(
              record._id,
              { $set: updateData },
              { new: true }
            );
            return {
              success: false,
              statusCode: 502,
              message: 'Notification retry failed during delivery.',
              data: updated,
              error: sanitizedErr,
            };
          } else {
            Object.assign(record, updateData);
            return {
              success: false,
              statusCode: 502,
              message: 'Notification retry failed during delivery.',
              data: record,
              error: sanitizedErr,
            };
          }
        }
      } catch (err: any) {
        const sanitizedErr = sanitizeLogDetails(err.message || 'Retry execution exception');
        const now = new Date();
        const updateData: any = {
          deliveryStatus: 'failed',
          failedAt: now,
          sanitizedError: sanitizedErr,
        };

        if (isFromDb) {
          const updated = await NotificationLogModel.findByIdAndUpdate(
            record._id,
            { $set: updateData },
            { new: true }
          );
          return {
            success: false,
            statusCode: 500,
            message: `Notification retry execution error: ${sanitizedErr}`,
            data: updated,
            error: sanitizedErr,
          };
        } else {
          Object.assign(record, updateData);
          return {
            success: false,
            statusCode: 500,
            message: `Notification retry execution error: ${sanitizedErr}`,
            data: record,
            error: sanitizedErr,
          };
        }
      }
    })();

    this.inFlightRetries.set(record.notificationId, retryPromise);
    this.trackTask(retryPromise);

    try {
      return await retryPromise;
    } finally {
      this.inFlightRetries.delete(record.notificationId);
    }
  }

  /**
   * Applies webhook delivery status transition to correlating NotificationLog.
   *
   * Guarantees & Integrity Rules:
   * 1. Terminal Delivered Protection: A notification in 'delivered' status MUST NEVER
   *    be downgraded to 'sending', 'pending', or 'failed' by stale or out-of-order callbacks.
   * 2. Engagement Separation: Engagement events (SendGrid 'open', 'click'; Twilio WhatsApp 'read')
   *    are tracked in metadata and DO NOT alter core deliveryStatus.
   * 3. SendGrid Lifecycles:
   *    - 'delivered' -> transitions to 'delivered', sets sentAt, clears error.
   *    - 'bounce', 'dropped', 'spamreport' -> transitions to 'failed', sets failedAt and error (unless delivered).
   *    - 'processed' -> transitions 'pending' to 'sending'.
   *    - 'deferred' -> transient; records in metadata.
   * 4. Twilio Lifecycles:
   *    - 'delivered' -> transitions to 'delivered', sets sentAt, clears error.
   *    - 'undelivered', 'failed' -> transitions to 'failed', sets failedAt and error (unless delivered).
   *    - 'queued', 'sent', 'sending' -> transitions 'pending' to 'sending'.
   * 5. Operates across both MongoDB and in-memory test environments.
   */
  async applyDeliveryStatusTransition(
    params: ApplyWebhookDeliveryStatusParams
  ): Promise<ApplyWebhookDeliveryStatusResult> {
    const { provider, providerMessageId, eventType, timestamp, errorCode, errorMessage } = params;
    const cleanMsgId = (providerMessageId || '').trim();

    if (!cleanMsgId) {
      return {
        matched: false,
        statusChanged: false,
        reason: 'Missing provider message ID',
      };
    }

    let record = await this.getLogByProviderMessageId(cleanMsgId);
    // For SendGrid, if not found and msgId contains dot (filter suffix), fallback to base ID
    if (!record && provider === 'sendgrid' && cleanMsgId.includes('.')) {
      record = await this.getLogByProviderMessageId(cleanMsgId.split('.')[0]);
    }

    if (!record) {
      return {
        matched: false,
        statusChanged: false,
        isIgnored: true,
        reason: `NotificationLog not found for provider message ID "${cleanMsgId}".`,
      };
    }

    const eventTime = timestamp instanceof Date ? timestamp : (timestamp ? new Date(timestamp) : new Date());
    const isFromDb = isDbConnected() && Boolean(record._id);
    const previousStatus: DeliveryStatus = record.deliveryStatus;

    if (provider === 'sendgrid') {
      const normEvent = (eventType || '').trim().toLowerCase();
      const engagementEvents = ['open', 'click', 'unsubscribe', 'group_unsubscribe', 'group_resubscribe'];

      // Engagement events: do not change deliveryStatus
      if (engagementEvents.includes(normEvent)) {
        const metadataUpdate = {
          ...(record.metadata || {}),
          [`${normEvent}At`]: eventTime,
          lastEngagement: normEvent,
          lastEngagementAt: eventTime,
        };

        if (isFromDb) {
          await NotificationLogModel.findByIdAndUpdate(record._id, {
            $set: { metadata: metadataUpdate },
          });
        } else {
          record.metadata = metadataUpdate;
        }

        return {
          matched: true,
          statusChanged: false,
          previousStatus,
          currentStatus: previousStatus,
          log: record,
          reason: `SendGrid engagement event "${normEvent}" recorded in metadata without altering delivery status.`,
        };
      }

      if (normEvent === 'delivered') {
        if (previousStatus === 'delivered') {
          return {
            matched: true,
            statusChanged: false,
            previousStatus: 'delivered',
            currentStatus: 'delivered',
            log: record,
            reason: 'NotificationLog already in terminal delivered status.',
          };
        }

        const updateFields: any = {
          deliveryStatus: 'delivered',
          sentAt: eventTime,
        };

        if (isFromDb) {
          const updated = await NotificationLogModel.findByIdAndUpdate(
            record._id,
            {
              $set: updateFields,
              $unset: { sanitizedError: 1 },
            },
            { new: true }
          );
          return {
            matched: true,
            statusChanged: true,
            previousStatus,
            currentStatus: 'delivered',
            log: updated,
            reason: 'NotificationLog transitioned to delivered.',
          };
        } else {
          record.deliveryStatus = 'delivered';
          record.sentAt = eventTime;
          delete record.sanitizedError;
          return {
            matched: true,
            statusChanged: true,
            previousStatus,
            currentStatus: 'delivered',
            log: record,
            reason: 'NotificationLog transitioned to delivered.',
          };
        }
      }

      if (['bounce', 'dropped', 'spamreport'].includes(normEvent)) {
        // Terminal delivered protection
        if (previousStatus === 'delivered') {
          const metadataUpdate = {
            ...(record.metadata || {}),
            ignoredLateFailure: {
              eventType: normEvent,
              timestamp: eventTime,
              error: sanitizeLogDetails(errorMessage || `SendGrid ${normEvent}`),
            },
          };

          if (isFromDb) {
            await NotificationLogModel.findByIdAndUpdate(record._id, {
              $set: { metadata: metadataUpdate },
            });
          } else {
            record.metadata = metadataUpdate;
          }

          return {
            matched: true,
            statusChanged: false,
            previousStatus: 'delivered',
            currentStatus: 'delivered',
            log: record,
            reason: `Stale or out-of-order failure callback "${normEvent}" ignored to protect terminal delivered status.`,
          };
        }

        const errText = sanitizeLogDetails(errorMessage || `SendGrid delivery failure: ${normEvent}`);
        const updateFields: any = {
          deliveryStatus: 'failed',
          failedAt: eventTime,
          sanitizedError: errText,
        };

        if (isFromDb) {
          const updated = await NotificationLogModel.findByIdAndUpdate(
            record._id,
            { $set: updateFields },
            { new: true }
          );
          return {
            matched: true,
            statusChanged: true,
            previousStatus,
            currentStatus: 'failed',
            log: updated,
            reason: `NotificationLog transitioned to failed on SendGrid "${normEvent}".`,
          };
        } else {
          record.deliveryStatus = 'failed';
          record.failedAt = eventTime;
          record.sanitizedError = errText;
          return {
            matched: true,
            statusChanged: true,
            previousStatus,
            currentStatus: 'failed',
            log: record,
            reason: `NotificationLog transitioned to failed on SendGrid "${normEvent}".`,
          };
        }
      }

      if (normEvent === 'processed') {
        if (previousStatus === 'pending') {
          const updateFields: any = { deliveryStatus: 'sending' };
          if (isFromDb) {
            const updated = await NotificationLogModel.findByIdAndUpdate(
              record._id,
              { $set: updateFields },
              { new: true }
            );
            return {
              matched: true,
              statusChanged: true,
              previousStatus,
              currentStatus: 'sending',
              log: updated,
              reason: 'NotificationLog transitioned to sending on SendGrid processed.',
            };
          } else {
            record.deliveryStatus = 'sending';
            return {
              matched: true,
              statusChanged: true,
              previousStatus,
              currentStatus: 'sending',
              log: record,
              reason: 'NotificationLog transitioned to sending on SendGrid processed.',
            };
          }
        }

        return {
          matched: true,
          statusChanged: false,
          previousStatus,
          currentStatus: previousStatus,
          log: record,
          reason: `SendGrid processed event does not change status from "${previousStatus}".`,
        };
      }

      if (normEvent === 'deferred') {
        const metadataUpdate = {
          ...(record.metadata || {}),
          deferredAt: eventTime,
          deferredReason: sanitizeLogDetails(errorMessage || 'SendGrid deferred'),
        };
        if (isFromDb) {
          await NotificationLogModel.findByIdAndUpdate(record._id, {
            $set: { metadata: metadataUpdate },
          });
        } else {
          record.metadata = metadataUpdate;
        }
        return {
          matched: true,
          statusChanged: false,
          previousStatus,
          currentStatus: previousStatus,
          log: record,
          reason: 'Transient deferred event recorded in metadata.',
        };
      }

      // Unsupported SendGrid event
      return {
        matched: true,
        statusChanged: false,
        isIgnored: true,
        previousStatus,
        currentStatus: previousStatus,
        log: record,
        reason: `Unsupported SendGrid event type "${eventType}".`,
      };
    }

    if (provider === 'twilio') {
      const normTwilioStatus = (eventType || '').trim().toLowerCase();

      // Engagement: WhatsApp read receipt
      if (normTwilioStatus === 'read') {
        const metadataUpdate = {
          ...(record.metadata || {}),
          whatsappReadAt: eventTime,
        };
        if (isFromDb) {
          await NotificationLogModel.findByIdAndUpdate(record._id, {
            $set: { metadata: metadataUpdate },
          });
        } else {
          record.metadata = metadataUpdate;
        }
        return {
          matched: true,
          statusChanged: false,
          previousStatus,
          currentStatus: previousStatus,
          log: record,
          reason: 'WhatsApp read receipt recorded in metadata without altering delivery status.',
        };
      }

      if (normTwilioStatus === 'delivered') {
        if (previousStatus === 'delivered') {
          return {
            matched: true,
            statusChanged: false,
            previousStatus: 'delivered',
            currentStatus: 'delivered',
            log: record,
            reason: 'NotificationLog already in terminal delivered status.',
          };
        }

        const updateFields: any = {
          deliveryStatus: 'delivered',
          sentAt: eventTime,
        };

        if (isFromDb) {
          const updated = await NotificationLogModel.findByIdAndUpdate(
            record._id,
            {
              $set: updateFields,
              $unset: { sanitizedError: 1 },
            },
            { new: true }
          );
          return {
            matched: true,
            statusChanged: true,
            previousStatus,
            currentStatus: 'delivered',
            log: updated,
            reason: 'NotificationLog transitioned to delivered.',
          };
        } else {
          record.deliveryStatus = 'delivered';
          record.sentAt = eventTime;
          delete record.sanitizedError;
          return {
            matched: true,
            statusChanged: true,
            previousStatus,
            currentStatus: 'delivered',
            log: record,
            reason: 'NotificationLog transitioned to delivered.',
          };
        }
      }

      if (['undelivered', 'failed'].includes(normTwilioStatus)) {
        // Terminal delivered protection
        if (previousStatus === 'delivered') {
          const metadataUpdate = {
            ...(record.metadata || {}),
            ignoredLateFailure: {
              eventType: normTwilioStatus,
              errorCode,
              errorMessage: sanitizeLogDetails(errorMessage || 'Twilio delivery failed'),
              timestamp: eventTime,
            },
          };

          if (isFromDb) {
            await NotificationLogModel.findByIdAndUpdate(record._id, {
              $set: { metadata: metadataUpdate },
            });
          } else {
            record.metadata = metadataUpdate;
          }

          return {
            matched: true,
            statusChanged: false,
            previousStatus: 'delivered',
            currentStatus: 'delivered',
            log: record,
            reason: `Stale or out-of-order failure callback "${normTwilioStatus}" ignored to protect terminal delivered status.`,
          };
        }

        const errText = sanitizeLogDetails(
          errorCode || errorMessage
            ? `Twilio error ${errorCode || ''}: ${errorMessage || 'Delivery failed'}`.trim()
            : 'Twilio delivery failed'
        );
        const updateFields: any = {
          deliveryStatus: 'failed',
          failedAt: eventTime,
          sanitizedError: errText,
        };

        if (isFromDb) {
          const updated = await NotificationLogModel.findByIdAndUpdate(
            record._id,
            { $set: updateFields },
            { new: true }
          );
          return {
            matched: true,
            statusChanged: true,
            previousStatus,
            currentStatus: 'failed',
            log: updated,
            reason: `NotificationLog transitioned to failed on Twilio "${normTwilioStatus}".`,
          };
        } else {
          record.deliveryStatus = 'failed';
          record.failedAt = eventTime;
          record.sanitizedError = errText;
          return {
            matched: true,
            statusChanged: true,
            previousStatus,
            currentStatus: 'failed',
            log: record,
            reason: `NotificationLog transitioned to failed on Twilio "${normTwilioStatus}".`,
          };
        }
      }

      if (['queued', 'sent', 'sending'].includes(normTwilioStatus)) {
        if (previousStatus === 'pending') {
          const updateFields: any = { deliveryStatus: 'sending' };
          if (isFromDb) {
            const updated = await NotificationLogModel.findByIdAndUpdate(
              record._id,
              { $set: updateFields },
              { new: true }
            );
            return {
              matched: true,
              statusChanged: true,
              previousStatus,
              currentStatus: 'sending',
              log: updated,
              reason: `NotificationLog transitioned to sending on Twilio "${normTwilioStatus}".`,
            };
          } else {
            record.deliveryStatus = 'sending';
            return {
              matched: true,
              statusChanged: true,
              previousStatus,
              currentStatus: 'sending',
              log: record,
              reason: `NotificationLog transitioned to sending on Twilio "${normTwilioStatus}".`,
            };
          }
        }

        return {
          matched: true,
          statusChanged: false,
          previousStatus,
          currentStatus: previousStatus,
          log: record,
          reason: `Twilio "${normTwilioStatus}" callback does not downgrade or change status from "${previousStatus}".`,
        };
      }

      // Unsupported Twilio event
      return {
        matched: true,
        statusChanged: false,
        isIgnored: true,
        previousStatus,
        currentStatus: previousStatus,
        log: record,
        reason: `Unsupported Twilio event type "${eventType}".`,
      };
    }

    return {
      matched: false,
      statusChanged: false,
      reason: `Unknown provider "${provider}".`,
    };
  }
}

export interface ApplyWebhookDeliveryStatusParams {
  provider: 'sendgrid' | 'twilio';
  providerMessageId: string;
  eventType: string;
  timestamp?: Date;
  errorCode?: string;
  errorMessage?: string;
  rawPayload?: Record<string, any>;
}

export interface ApplyWebhookDeliveryStatusResult {
  matched: boolean;
  statusChanged: boolean;
  previousStatus?: DeliveryStatus;
  currentStatus?: DeliveryStatus;
  log?: any;
  reason?: string;
  isIgnored?: boolean;
}

export const notificationService = new NotificationService();

export const drainInFlight = (timeoutMs?: number) => notificationService.drainInFlight(timeoutMs);
export const getActiveTaskCount = () => notificationService.getActiveTaskCount();
export const trackTask = <T>(promise: Promise<T>) => notificationService.trackTask(promise);
export const getLogByProviderMessageId = (id: string) => notificationService.getLogByProviderMessageId(id);
export const applyDeliveryStatusTransition = (params: ApplyWebhookDeliveryStatusParams) =>
  notificationService.applyDeliveryStatusTransition(params);
