import {
  INotificationProvider,
  NotificationPayload,
  NotificationSendResult,
  NotificationChannel,
} from '../types.js';
import { sanitizeLogDetails } from '../sanitize.js';

/**
 * ============================================================================
 * PRODUCTION PROVIDER READINESS & ACTIVATION CHECKLIST
 * ============================================================================
 * Before activating real customer messaging in Phase 5, the following
 * infrastructure, verification, and regulatory requirements must be completed:
 *
 * 1. Email Provider (SendGrid / AWS SES):
 *    [ ] Provision paid/production SendGrid API key with restricted `mail.send` scope.
 *    [ ] Complete DNS Domain Authentication: CNAME records for SPF and DKIM.
 *    [ ] Set up DMARC policy with reporting address.
 *    [ ] Verify Single Sender Identity (e.g. `orders@deepscakeshop.in`).
 *    [ ] Configure inbound spam bounce/suppression webhooks with HMAC validation.
 *
 * 2. WhatsApp Messaging Provider (Twilio / Meta WhatsApp Cloud API):
 *    [ ] Register Meta WhatsApp Business Account (WABA) with verified business manager.
 *    [ ] Provision dedicated phone number with E.164 formatting (+91 for India).
 *    [ ] Submit transactional WhatsApp message templates for Meta approval:
 *        - `order_placed_receipt` (Utility category)
 *        - `order_status_update` (Utility category)
 *        - `inquiry_quotation_proposal` (Utility category)
 *    [ ] Provision Twilio Account SID & Auth Token or Meta System User Access Token.
 *    [ ] Configure inbound delivery status callback webhooks.
 *
 * 3. Regulatory & Legal Messaging Compliance (TRAI / DND Registry):
 *    [ ] DLT (Distributed Ledger Technology) registration on telecom operator portals.
 *    [ ] Transactional SMS template approval with registered Sender Header (6-alpha ID).
 *    [ ] Maintain explicit, auditable opt-in customer consent logs before dispatching SMS/WhatsApp.
 *
 * 4. Architecture Safety Guarantee:
 *    - In Milestone 2, real sending remains DISABLED.
 *    - The stubs below do NOT transmit real messages over any network.
 * ============================================================================
 */
export interface ProductionProviderConfig {
  apiKey?: string;
  senderEmail?: string;
  accountSid?: string;
  authToken?: string;
  senderPhone?: string;
  timeoutMs?: number;
}

/**
 * Production Email Provider Interface Stub (SendGrid / AWS SES)
 * Demonstrates drop-in provider contract adherence without sending live emails.
 */
export class SendGridEmailProviderStub implements INotificationProvider {
  readonly name = 'sendgrid';
  readonly supportedChannels: readonly NotificationChannel[] = ['email'] as const;

  constructor(private config: ProductionProviderConfig = {}) {}

  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    // In this milestone, production providers are disabled by design
    return {
      success: false,
      error: sanitizeLogDetails(
        `Production SendGrid provider is in stub mode. External messaging is disabled for this milestone.`
      ),
      retryable: false,
    };
  }
}

/**
 * Production Messaging Provider Interface Stub (Twilio / WhatsApp Cloud API)
 * Demonstrates drop-in provider contract adherence without sending live messages.
 */
export class TwilioMessagingProviderStub implements INotificationProvider {
  readonly name = 'twilio';
  readonly supportedChannels: readonly NotificationChannel[] = ['whatsapp', 'sms'] as const;

  constructor(private config: ProductionProviderConfig = {}) {}

  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    // In this milestone, production providers are disabled by design
    return {
      success: false,
      error: sanitizeLogDetails(
        `Production Twilio provider is in stub mode. External messaging is disabled for this milestone.`
      ),
      retryable: false,
    };
  }
}
