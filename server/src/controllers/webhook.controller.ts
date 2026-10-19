import { Request, Response } from 'express';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { sanitizeLogDetails } from '../notifications/sanitize.js';
import {
  verifySendgridWebhookSignature,
  verifyTwilioWebhookSignature,
  reconstructTrustedTwilioUrl,
} from '../services/webhookVerification.js';
import {
  reserveWebhookEvent,
  updateWebhookEventStatus,
} from '../models/WebhookEvent.js';
import { notificationService } from '../notifications/notificationService.js';

/**
 * Handles incoming SendGrid Event Webhook dispatches.
 * Endpoint: POST /api/webhooks/sendgrid
 *
 * Security & Reliability Flow:
 * 1. Validates presence of raw request body.
 * 2. Enforces ECDSA SHA-256 signature and timestamp verification using SENDGRID_WEBHOOK_VERIFICATION_KEY.
 * 3. Enforces payload schema (non-empty JSON array).
 * 4. Iterates events, reserving each via `reserveWebhookEvent` for durable deduplication (`sg_event_id`).
 * 5. Applies delivery status updates via `notificationService.applyDeliveryStatusTransition`, protecting terminal states.
 * 6. Marks WebhookEvent as 'processed', 'ignored', or 'failed' based on work completion.
 * 7. Never logs secrets, raw signatures, or customer PII.
 */
export async function handleSendgridWebhook(req: Request, res: Response): Promise<void> {
  // 1. Raw body preservation check
  const rawBody = (req as any).rawBody;
  if (!rawBody || (Buffer.isBuffer(rawBody) && rawBody.length === 0)) {
    res.status(400).json({
      success: false,
      message: 'Bad Request: Missing webhook payload body',
    });
    return;
  }

  // 2. Signature and Timestamp Header Extraction
  const signature =
    req.get('X-Twilio-Email-Event-Webhook-Signature') ||
    (req.headers['x-twilio-email-event-webhook-signature'] as string);
  const timestamp =
    req.get('X-Twilio-Email-Event-Webhook-Timestamp') ||
    (req.headers['x-twilio-email-event-webhook-timestamp'] as string);

  if (!signature || !timestamp) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing required SendGrid signature or timestamp headers',
    });
    return;
  }

  // 3. Verification Key Check
  const verificationKey = env.SENDGRID_WEBHOOK_VERIFICATION_KEY || process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
  if (!verificationKey || verificationKey.trim().length === 0) {
    logger.error('[Webhook Error] SendGrid webhook verification key is not configured.');
    res.status(500).json({
      success: false,
      message: 'Internal Server Error: Webhook verification key is not configured',
    });
    return;
  }

  // 4. ECDSA Signature Verification
  const verification = verifySendgridWebhookSignature({
    signature,
    timestamp,
    rawBody,
    verificationKey,
  });

  if (!verification.valid) {
    logger.warn(`[Webhook Warning] SendGrid signature verification failed: ${verification.reason || 'invalid signature'}`);
    res.status(401).json({
      success: false,
      message: `Unauthorized: ${verification.reason || 'Invalid webhook signature'}`,
    });
    return;
  }

  // 5. Payload Validation
  const events = req.body;
  if (!Array.isArray(events) || events.length === 0) {
    res.status(400).json({
      success: false,
      message: 'Bad Request: SendGrid webhook payload must be a non-empty JSON array of events',
    });
    return;
  }

  // 6. Process Events with Durable Deduplication
  let processedCount = 0;
  let duplicateCount = 0;
  let ignoredCount = 0;

  for (const item of events) {
    if (!item || typeof item !== 'object') continue;

    const eventId = item.sg_event_id;
    const eventType = item.event;
    const providerMessageId = item.sg_message_id;

    if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
      continue;
    }

    const sanitizedSummary = {
      event: eventType,
      emailDomain: item.email ? String(item.email).split('@')[1] : undefined,
      reason: item.reason,
      status: item.status,
      response: item.response,
      attempt: item.attempt,
    };

    // Deduplication Reservation
    const reservation = await reserveWebhookEvent({
      provider: 'sendgrid',
      eventId: eventId.trim(),
      providerMessageId: providerMessageId ? String(providerMessageId).trim() : undefined,
      eventType: eventType ? String(eventType).trim() : undefined,
      sanitizedSummary,
    });

    if (reservation.isDuplicate) {
      duplicateCount++;
      continue;
    }

    if (!reservation.reserved) {
      logger.error(`[Webhook Error] Failed to reserve SendGrid event: ${reservation.error}`);
      res.status(500).json({
        success: false,
        message: 'Internal Server Error: Failed to reserve webhook event',
      });
      return;
    }

    const eventRecord = reservation.event;

    try {
      if (providerMessageId && eventType) {
        const transitionResult = await notificationService.applyDeliveryStatusTransition({
          provider: 'sendgrid',
          providerMessageId: String(providerMessageId),
          eventType: String(eventType),
          timestamp: item.timestamp ? new Date(Number(item.timestamp) * 1000) : new Date(),
          errorMessage: item.reason || item.response,
          rawPayload: sanitizedSummary,
        });

        if (transitionResult.isIgnored || !transitionResult.matched) {
          ignoredCount++;
          await updateWebhookEventStatus(eventRecord, 'ignored', transitionResult.reason);
        } else {
          processedCount++;
          await updateWebhookEventStatus(eventRecord, 'processed');
        }
      } else {
        ignoredCount++;
        await updateWebhookEventStatus(eventRecord, 'ignored', 'Missing sg_message_id or event type');
      }
    } catch (err: any) {
      logger.error(
        `[Webhook Error] Error processing SendGrid event ${eventId}: ${sanitizeLogDetails(err.message)}`
      );
      await updateWebhookEventStatus(eventRecord, 'failed', err.message);
      res.status(500).json({
        success: false,
        message: 'Internal Server Error: Failed to process webhook event',
      });
      return;
    }
  }

  res.status(200).json({
    success: true,
    message: 'SendGrid webhook processed successfully',
    processedCount,
    duplicateCount,
    ignoredCount,
  });
}

/**
 * Handles incoming Twilio Status Callback dispatches.
 * Endpoint: POST /api/webhooks/twilio
 *
 * Security & Reliability Flow:
 * 1. Enforces X-Twilio-Signature verification using TWILIO_AUTH_TOKEN and trusted reconstructed URL.
 * 2. Neutralizes Host header injection by reconstructing URL from trusted configuration.
 * 3. Validates required payload attributes (MessageSid, MessageStatus).
 * 4. Integrates `reserveWebhookEvent` with stable `${MessageSid}:${MessageStatus}` eventId.
 * 5. Applies status transition on correlating NotificationLog, preserving terminal 'delivered'.
 * 6. Marks WebhookEvent as 'processed', 'ignored', or 'failed' based on work completion.
 * 7. Never logs authentication tokens, raw signatures, or customer PII.
 */
export async function handleTwilioWebhook(req: Request, res: Response): Promise<void> {
  // 1. Signature Header Extraction
  const signature =
    req.get('X-Twilio-Signature') || (req.headers['x-twilio-signature'] as string);

  if (!signature) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing required Twilio signature header',
    });
    return;
  }

  // 2. Auth Token Check
  const authToken = env.TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
  if (!authToken || authToken.trim().length === 0) {
    logger.error('[Webhook Error] Twilio auth token is not configured.');
    res.status(500).json({
      success: false,
      message: 'Internal Server Error: Twilio auth token is not configured',
    });
    return;
  }

  // 3. Reconstruct Trusted URL & Validate Signature
  const trustedUrl = reconstructTrustedTwilioUrl(req);
  const verification = verifyTwilioWebhookSignature({
    signature,
    url: trustedUrl,
    params: req.body || {},
    authToken,
  });

  if (!verification.valid) {
    logger.warn(`[Webhook Warning] Twilio signature verification failed: ${verification.reason || 'invalid signature'}`);
    res.status(401).json({
      success: false,
      message: `Unauthorized: ${verification.reason || 'Invalid webhook signature'}`,
    });
    return;
  }

  // 4. Validate Payload Fields
  const messageSid = req.body?.MessageSid || req.body?.SmsSid;
  const messageStatus = req.body?.MessageStatus || req.body?.SmsStatus;

  if (!messageSid || typeof messageSid !== 'string' || messageSid.trim().length === 0) {
    res.status(400).json({
      success: false,
      message: 'Bad Request: Missing required MessageSid parameter in Twilio callback',
    });
    return;
  }

  if (!messageStatus || typeof messageStatus !== 'string' || messageStatus.trim().length === 0) {
    res.status(400).json({
      success: false,
      message: 'Bad Request: Missing required MessageStatus parameter in Twilio callback',
    });
    return;
  }

  // 5. Construct Stable Event ID for Durable Deduplication
  // Twilio does not provide an isolated event UUID. Deduplication is bound to the
  // tuple of MessageSid + MessageStatus (+ SequenceNumber if provided).
  const sequenceNumber = req.body?.SequenceNumber;
  const eventId =
    sequenceNumber !== undefined
      ? `${messageSid.trim()}:${messageStatus.trim()}:${sequenceNumber}`
      : `${messageSid.trim()}:${messageStatus.trim()}`;

  const sanitizedSummary = {
    messageStatus,
    errorCode: req.body?.ErrorCode,
    errorMessage: req.body?.ErrorMessage,
    sequenceNumber: req.body?.SequenceNumber,
  };

  // 6. Deduplication Reservation
  const reservation = await reserveWebhookEvent({
    provider: 'twilio',
    eventId,
    providerMessageId: messageSid.trim(),
    eventType: messageStatus.trim(),
    sanitizedSummary,
  });

  if (reservation.isDuplicate) {
    res.status(200).json({
      success: true,
      message: 'Twilio callback already processed (duplicate)',
    });
    return;
  }

  if (!reservation.reserved) {
    logger.error(`[Webhook Error] Failed to reserve Twilio event: ${reservation.error}`);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error: Failed to reserve webhook event',
    });
    return;
  }

  const eventRecord = reservation.event;

  // 7. Apply Status Transition
  try {
    const transitionResult = await notificationService.applyDeliveryStatusTransition({
      provider: 'twilio',
      providerMessageId: messageSid.trim(),
      eventType: messageStatus.trim(),
      errorCode: req.body?.ErrorCode,
      errorMessage: req.body?.ErrorMessage,
      rawPayload: sanitizedSummary,
    });

    if (transitionResult.isIgnored || !transitionResult.matched) {
      await updateWebhookEventStatus(eventRecord, 'ignored', transitionResult.reason);
    } else {
      await updateWebhookEventStatus(eventRecord, 'processed');
    }

    res.status(200).json({
      success: true,
      message: 'Twilio callback processed successfully',
      statusChanged: transitionResult.statusChanged,
    });
  } catch (err: any) {
    logger.error(
      `[Webhook Error] Error processing Twilio event ${eventId}: ${sanitizeLogDetails(err.message)}`
    );
    await updateWebhookEventStatus(eventRecord, 'failed', err.message);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error: Failed to process webhook event',
    });
  }
}
