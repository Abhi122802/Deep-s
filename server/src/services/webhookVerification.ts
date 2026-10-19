import crypto from 'crypto';
import { Request } from 'express';
import { env } from '../config/env.js';

export interface VerifySendgridParams {
  signature?: string;
  timestamp?: string;
  rawBody?: Buffer | string;
  verificationKey?: string;
  maxAgeSeconds?: number;
}

export interface VerifySendgridResult {
  valid: boolean;
  reason?: string;
}

export interface VerifyTwilioParams {
  signature?: string;
  url: string;
  params: Record<string, any>;
  authToken?: string;
}

export interface VerifyTwilioResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verifies SendGrid Event Webhook ECDSA SHA-256 signature using the provider's documented protocol.
 *
 * Requirements & Security Controls:
 * 1. Protocol: Signs concatenation of UTF-8 timestamp and exact raw body bytes: `timestamp + rawBody`.
 * 2. Public Key: Expected to be Base64-encoded ECDSA SPKI (curve NIST P-256 / prime256v1).
 * 3. Replay Protection: Validates timestamp freshness within `maxAgeSeconds` window (default: 600s / 10m).
 * 4. Raw-Body Integrity: Does NOT parse and re-serialize JSON before verification.
 * 5. Secret Protection: Never logs the verification key, raw signature, or body contents.
 */
export function verifySendgridWebhookSignature(params: VerifySendgridParams): VerifySendgridResult {
  const { signature, timestamp, rawBody, verificationKey, maxAgeSeconds = 600 } = params;

  if (!signature || signature.trim().length === 0) {
    return { valid: false, reason: 'Missing signature header (X-Twilio-Email-Event-Webhook-Signature).' };
  }

  if (!timestamp || timestamp.trim().length === 0) {
    return { valid: false, reason: 'Missing timestamp header (X-Twilio-Email-Event-Webhook-Timestamp).' };
  }

  if (rawBody === undefined || rawBody === null) {
    return { valid: false, reason: 'Missing request body for signature verification.' };
  }

  const rawBodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  if (rawBodyBuf.length === 0) {
    return { valid: false, reason: 'Empty request body cannot be verified.' };
  }

  if (!verificationKey || verificationKey.trim().length === 0) {
    return { valid: false, reason: 'SENDGRID_WEBHOOK_VERIFICATION_KEY is not configured.' };
  }

  // 1. Timestamp Freshness and Numeric Validation
  const eventTimeSeconds = Number(timestamp);
  if (isNaN(eventTimeSeconds) || !isFinite(eventTimeSeconds)) {
    return { valid: false, reason: 'Invalid or non-numeric webhook timestamp header.' };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const timeDifference = Math.abs(nowSeconds - eventTimeSeconds);
  if (timeDifference > maxAgeSeconds) {
    return {
      valid: false,
      reason: `Webhook timestamp expired or outside acceptable window (${timeDifference}s difference, max allowed: ${maxAgeSeconds}s).`,
    };
  }

  // 2. Public Key Initialization (DER SPKI format)
  let publicKey: crypto.KeyObject;
  try {
    const keyDer = Buffer.from(verificationKey.trim(), 'base64');
    publicKey = crypto.createPublicKey({
      key: keyDer,
      format: 'der',
      type: 'spki',
    });
  } catch (err: any) {
    return {
      valid: false,
      reason: 'Failed to initialize ECDSA public key from verification key format.',
    };
  }

  // 3. Payload Construction: timestamp + rawBody
  const timestampBuf = Buffer.from(timestamp, 'utf8');
  const signedPayload = Buffer.concat([timestampBuf, rawBodyBuf]);

  // 4. ECDSA SHA-256 Verification
  try {
    const signatureBuf = Buffer.from(signature.trim(), 'base64');
    const isValid = crypto.verify('sha256', signedPayload, publicKey, signatureBuf);

    return {
      valid: isValid,
      reason: isValid ? undefined : 'Cryptographic signature mismatch.',
    };
  } catch (err: any) {
    return {
      valid: false,
      reason: 'Malformed signature or cryptographic verification failure.',
    };
  }
}

/**
 * Reconstructs the externally visible webhook callback URL for Twilio signature validation.
 *
 * CRITICAL HOST-HEADER INJECTION PROTECTION:
 * Never trusts client-supplied Host or X-Forwarded-Host headers.
 * Uses trusted configuration (env.PUBLIC_API_URL) or loopback default.
 */
export function reconstructTrustedTwilioUrl(req: Request, publicApiUrlOverride?: string): string {
  const configuredBase = publicApiUrlOverride || env.PUBLIC_API_URL || process.env.PUBLIC_API_URL;

  if (configuredBase && configuredBase.trim().length > 0) {
    const cleanBase = configuredBase.trim().replace(/\/+$/, '');
    const pathname = (req.originalUrl || req.url || '/api/webhooks/twilio').split('?')[0];
    const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
    const query = req.originalUrl?.includes('?') ? req.originalUrl.substring(req.originalUrl.indexOf('?')) : '';
    if (cleanBase.endsWith(cleanPath)) {
      return `${cleanBase}${query}`;
    }
    return `${cleanBase}${cleanPath}${query}`;
  }

  // Development / Test fallback using trusted loopback port from env (NOT client-supplied Host)
  const port = env.PORT || 5000;
  const pathname = (req.originalUrl || req.url || '/api/webhooks/twilio').split('?')[0];
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const query = req.originalUrl?.includes('?') ? req.originalUrl.substring(req.originalUrl.indexOf('?')) : '';
  return `http://localhost:${port}${cleanPath}${query}`;
}

/**
 * Verifies Twilio status callback signatures using HMAC-SHA1.
 *
 * Algorithm per Twilio protocol:
 * 1. Takes the reconstructed, trusted callback URL.
 * 2. Takes the POST parameters and sorts their keys alphabetically.
 * 3. Appends each key and value to the URL string with no delimiter.
 * 4. Signs the resulting string using HMAC-SHA1 with TWILIO_AUTH_TOKEN as key.
 * 5. Compares computed Base64 signature with X-Twilio-Signature using constant-time comparison.
 */
export function verifyTwilioWebhookSignature(params: VerifyTwilioParams): VerifyTwilioResult {
  const { signature, url, params: bodyParams, authToken } = params;

  if (!signature || signature.trim().length === 0) {
    return { valid: false, reason: 'Missing signature header (X-Twilio-Signature).' };
  }

  if (!authToken || authToken.trim().length === 0) {
    return { valid: false, reason: 'TWILIO_AUTH_TOKEN is not configured.' };
  }

  if (!url || url.trim().length === 0) {
    return { valid: false, reason: 'Missing callback URL for signature validation.' };
  }

  try {
    let data = url;
    if (bodyParams && typeof bodyParams === 'object') {
      const sortedKeys = Object.keys(bodyParams).sort();
      for (const key of sortedKeys) {
        const val = bodyParams[key];
        data += `${key}${val !== undefined && val !== null ? String(val) : ''}`;
      }
    }

    const hmac = crypto.createHmac('sha1', authToken);
    hmac.update(Buffer.from(data, 'utf8'));
    const expectedSignature = hmac.digest('base64');

    const sigBuf = Buffer.from(signature.trim());
    const expBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expBuf.length) {
      return { valid: false, reason: 'Signature mismatch.' };
    }

    const matches = crypto.timingSafeEqual(sigBuf, expBuf);
    return {
      valid: matches,
      reason: matches ? undefined : 'Signature mismatch.',
    };
  } catch (err: any) {
    return {
      valid: false,
      reason: `Verification error: ${err.message}`,
    };
  }
}
