import { sanitizeLogDetails } from '../notifications/sanitize.js';
import { env } from '../config/env.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'passwordhash',
  'token',
  'admin_token',
  'admintoken',
  'jwt_secret',
  'jwtsecret',
  'secret',
  'client_secret',
  'clientsecret',
  'authorization',
  'cookie',
  'cookies',
  'set-cookie',
  'setcookie',
  'mongodb_uri',
  'mongodburi',
  'sendgrid_api_key',
  'sendgridapikey',
  'twilio_auth_token',
  'twilioauthtoken',
  'twilio_account_sid',
  'twilioaccountsid',
  'twilio_phone_number',
  'twiliophonenumber',
  'cloudinary_api_secret',
  'cloudinaryapisecret',
  'cloudinary_api_key',
  'cloudinaryapikey',
  'apikey',
  'api_key',
  'access_token',
  'accesstoken',
  'refreshtoken',
  'refresh_token',
  'bearer',
  'credentials',
  'sendgrid_webhook_verification_key',
  'sendgridwebhookverificationkey',
  'webhook_verification_key',
  'webhookverificationkey',
  'verification_key',
  'verificationkey',
  'rawbody',
  'raw_body',
  'rawpayload',
  'raw_payload',
  'dburi',
  'db_uri',
  'database_uri',
  'databaseuri',
]);

const EMAIL_KEYS = new Set([
  'email',
  'customeremail',
  'useremail',
  'recipientemail',
  'senderemail',
  'billingemail',
  'contactemail',
]);

const PHONE_KEYS = new Set([
  'phone',
  'phonenumber',
  'customerphone',
  'userphone',
  'recipientphone',
  'mobile',
  'mobilenumber',
  'contact',
  'contactnumber',
  'cellphone',
  'telephone',
  'twilio_whatsapp_number',
  'twiliowhatsappnumber',
  'whatsapp_number',
  'whatsappnumber',
]);

/**
 * Masks email address: customer.support@deepscakeshop.in -> c***@deepscakeshop.in
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return '***@***';
  const clean = email.trim();
  const parts = clean.split('@');
  if (parts.length === 2 && parts[0].length > 0) {
    const user = parts[0];
    const maskedUser = user.length > 1 ? `${user[0]}***` : '***';
    return `${maskedUser}@${parts[1]}`;
  }
  return '***@***';
}

/**
 * Masks phone number: 9876543210 -> ******3210
 */
export function maskPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '******';
  const clean = phone.trim();
  return clean.length > 4 ? `******${clean.slice(-4)}` : '******';
}

function redactEntry(k: string, v: any, depth: number): any {
  const lower = k.toLowerCase();
  const normalized = lower.replace(/[-_]/g, '');

  if (SENSITIVE_KEYS.has(lower) || SENSITIVE_KEYS.has(normalized)) {
    return '[REDACTED]';
  } else if (EMAIL_KEYS.has(lower) || EMAIL_KEYS.has(normalized)) {
    return typeof v === 'string' ? maskEmail(v) : '[REDACTED]';
  } else if (PHONE_KEYS.has(lower) || PHONE_KEYS.has(normalized)) {
    return typeof v === 'string' ? maskPhone(v) : '[REDACTED]';
  } else if (normalized === 'recipient') {
    if (typeof v === 'string') {
      return v.includes('@') ? maskEmail(v) : maskPhone(v);
    } else {
      return '[REDACTED]';
    }
  }
  return redactLogData(v, depth + 1);
}

/**
 * Recursively redacts sensitive credentials, passwords, tokens, and PII from log payloads.
 */
export function redactLogData(val: any, depth = 0): any {
  if (depth > 6) return '[Truncated Depth]';
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    return sanitizeLogDetails(val);
  }
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (val instanceof Date) return val.toISOString();
  if (val instanceof Error) {
    const errorObj: Record<string, any> = {
      name: val.name,
      message: sanitizeLogDetails(val.message),
      stack: sanitizeLogDetails(val.stack || ''),
    };
    for (const [k, v] of Object.entries(val)) {
      if (!errorObj[k]) {
        errorObj[k] = redactEntry(k, v, depth);
      }
    }
    return errorObj;
  }
  if (Array.isArray(val)) {
    return val.map((item) => redactLogData(item, depth + 1));
  }
  if (typeof val === 'object') {
    const copy: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      copy[k] = redactEntry(k, v, depth);
    }
    return copy;
  }
  return String(val);
}

export class StructuredLogger {
  private levelWeights: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };

  private get minWeight(): number {
    const current = (env.LOG_LEVEL as LogLevel) || 'info';
    return this.levelWeights[current] || 20;
  }

  private write(level: LogLevel, message: string, meta?: Record<string, any>): void {
    if (this.levelWeights[level] < this.minWeight) {
      return;
    }

    const timestamp = new Date().toISOString();
    const redactedMeta = meta ? redactLogData(meta) : undefined;
    const sanitizedMsg = sanitizeLogDetails(message);

    const logObject = {
      timestamp,
      level,
      message: sanitizedMsg,
      ...(redactedMeta || {}),
    };

    const isPretty = env.LOG_FORMAT === 'pretty' && env.NODE_ENV !== 'production';

    if (isPretty) {
      const metaString = redactedMeta && Object.keys(redactedMeta).length > 0
        ? ` ${JSON.stringify(redactedMeta)}`
        : '';
      const prefix = `[${timestamp}] [${level.toUpperCase()}] ${sanitizedMsg}${metaString}`;
      if (level === 'error') {
        console.error(prefix);
      } else if (level === 'warn') {
        console.warn(prefix);
      } else {
        console.log(prefix);
      }
    } else {
      const jsonLine = JSON.stringify(logObject);
      if (level === 'error') {
        console.error(jsonLine);
      } else if (level === 'warn') {
        console.warn(jsonLine);
      } else {
        console.log(jsonLine);
      }
    }
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: Record<string, any>): void {
    this.write('error', message, meta);
  }
}

export const logger = new StructuredLogger();
