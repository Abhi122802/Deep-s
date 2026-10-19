import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from server directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const DEV_DEFAULT_JWT_SECRET = 'deeps_cake_shop_super_secret_jwt_key_2026_dev_env';

/**
 * Validates JWT secret based on environment requirements.
 * In production:
 * - Must be explicitly configured (not empty or undefined).
 * - Must be at least 32 characters long.
 * - Must not be the default development secret.
 * In development / test:
 * - Permitted to fall back to the safe local default.
 * Does NOT log or expose the secret value.
 */
export function validateJwtSecret(
  secret?: string,
  nodeEnv: string = 'development'
): { valid: boolean; error?: string } {
  if (nodeEnv === 'production') {
    if (!secret || secret.trim().length === 0) {
      return {
        valid: false,
        error: 'JWT_SECRET is required in production mode. It must not be empty or omitted.',
      };
    }
    if (secret.length < 32) {
      return {
        valid: false,
        error: `JWT_SECRET must be at least 32 characters in production (provided length: ${secret.length}).`,
      };
    }
    if (secret === DEV_DEFAULT_JWT_SECRET) {
      return {
        valid: false,
        error: 'JWT_SECRET cannot use the default development secret in production mode.',
      };
    }
  }
  return { valid: true };
}

export function validateSendgridWebhookKey(key?: string): { valid: boolean; error?: string } {
  if (!key || key.trim().length === 0) {
    return { valid: true };
  }
  const trimmed = key.trim();
  if (trimmed.length < 32) {
    return {
      valid: false,
      error: `SENDGRID_WEBHOOK_VERIFICATION_KEY must be at least 32 characters (provided length: ${trimmed.length}).`,
    };
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    return {
      valid: false,
      error: 'SENDGRID_WEBHOOK_VERIFICATION_KEY must be a valid base64-encoded ECDSA public key.',
    };
  }
  return { valid: true };
}

export function validateTwilioWhatsAppNumber(number?: string): { valid: boolean; error?: string } {
  if (!number || number.trim().length === 0) {
    return { valid: true };
  }
  const trimmed = number.trim();
  if (!/^(whatsapp:)?\+[1-9]\d{1,14}$/.test(trimmed)) {
    return {
      valid: false,
      error: 'TWILIO_WHATSAPP_NUMBER must be in valid E.164 format (e.g. +[country_code][number] or whatsapp:+[country_code][number]).',
    };
  }
  return { valid: true };
}

export function validatePublicApiUrl(
  url?: string,
  nodeEnv: string = 'development'
): { valid: boolean; error?: string } {
  if (!url || url.trim().length === 0) {
    return { valid: true };
  }
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: 'PUBLIC_API_URL must use http:// or https:// protocol.',
      };
    }
    if (nodeEnv === 'production') {
      if (parsed.protocol !== 'https:') {
        return {
          valid: false,
          error: 'PUBLIC_API_URL must use https:// in production mode.',
        };
      }
      if (parsed.username || parsed.password) {
        return {
          valid: false,
          error: 'PUBLIC_API_URL must not include credentials in the URL.',
        };
      }
      const hostname = parsed.hostname.toLowerCase();
      const loopbackHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
      if (
        loopbackHosts.includes(hostname) ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.localhost')
      ) {
        return {
          valid: false,
          error: 'PUBLIC_API_URL cannot use a localhost or loopback address in production mode.',
        };
      }
      if (!hostname.includes('.')) {
        return {
          valid: false,
          error: 'PUBLIC_API_URL must contain a valid domain name with top-level domain in production mode.',
        };
      }
    }
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'PUBLIC_API_URL must be a valid URL (e.g. https://api.deepscakeshop.in).',
    };
  }
}

export const baseEnvSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/deeps_cake_shop'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),

  // Notification delivery configurations
  NOTIFICATION_MODE: z.enum(['mock', 'production']).default('mock'),
  NOTIFICATION_EMAIL_PROVIDER: z.enum(['mock', 'sendgrid']).default('mock'),
  NOTIFICATION_MESSAGING_PROVIDER: z.enum(['mock', 'twilio']).default('mock'),
  SENDGRID_API_KEY: z.string().default(''),
  SENDGRID_FROM_EMAIL: z.string().default('noreply@deepscakeshop.in'),
  TWILIO_ACCOUNT_SID: z.string().default(''),
  TWILIO_AUTH_TOKEN: z.string().default(''),
  TWILIO_PHONE_NUMBER: z.string().default(''),

  // Webhook and messaging configuration (Phase 5, Milestone 2)
  SENDGRID_WEBHOOK_VERIFICATION_KEY: z.string().default(''),
  TWILIO_WHATSAPP_NUMBER: z.string().default(''),
  PUBLIC_API_URL: z.string().default(''),

  // Production Reliability & Security Hardening (Phase 5, Milestone 1)
  TRUST_PROXY: z.string().default('1'),
  NOTIFICATION_RECOVERY_INTERVAL_MS: z.coerce.number().default(300000), // 5 minutes default
  NOTIFICATION_DRAIN_TIMEOUT_MS: z.coerce.number().default(10000), // 10 seconds default drain
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
});

export const envSchema = baseEnvSchema
  .superRefine((data, ctx) => {
    const jwtCheck = validateJwtSecret(data.JWT_SECRET, data.NODE_ENV);
    if (!jwtCheck.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: jwtCheck.error || 'Invalid JWT_SECRET configuration.',
      });
    }

    const sendgridKeyCheck = validateSendgridWebhookKey(data.SENDGRID_WEBHOOK_VERIFICATION_KEY);
    if (!sendgridKeyCheck.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SENDGRID_WEBHOOK_VERIFICATION_KEY'],
        message: sendgridKeyCheck.error || 'Invalid SENDGRID_WEBHOOK_VERIFICATION_KEY configuration.',
      });
    }

    const waCheck = validateTwilioWhatsAppNumber(data.TWILIO_WHATSAPP_NUMBER);
    if (!waCheck.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TWILIO_WHATSAPP_NUMBER'],
        message: waCheck.error || 'Invalid TWILIO_WHATSAPP_NUMBER configuration.',
      });
    }

    const urlCheck = validatePublicApiUrl(data.PUBLIC_API_URL, data.NODE_ENV);
    if (!urlCheck.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PUBLIC_API_URL'],
        message: urlCheck.error || 'Invalid PUBLIC_API_URL configuration.',
      });
    }

    const isLiveProd =
      data.NODE_ENV === 'production' &&
      data.NOTIFICATION_MODE === 'production' &&
      (data.NOTIFICATION_EMAIL_PROVIDER === 'sendgrid' || data.NOTIFICATION_MESSAGING_PROVIDER === 'twilio');

    if (isLiveProd && (!data.PUBLIC_API_URL || data.PUBLIC_API_URL.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PUBLIC_API_URL'],
        message: 'PUBLIC_API_URL is required in production mode when live notification providers are configured.',
      });
    }
  })
  .transform((data) => ({
    ...data,
    JWT_SECRET: data.JWT_SECRET || DEV_DEFAULT_JWT_SECRET,
  }));

const rawEnv = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  MONGODB_URI: process.env.MONGODB_URI,
  FRONTEND_URL: process.env.FRONTEND_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  NOTIFICATION_MODE: process.env.NOTIFICATION_MODE,
  NOTIFICATION_EMAIL_PROVIDER: process.env.NOTIFICATION_EMAIL_PROVIDER,
  NOTIFICATION_MESSAGING_PROVIDER: process.env.NOTIFICATION_MESSAGING_PROVIDER,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  SENDGRID_WEBHOOK_VERIFICATION_KEY: process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY,
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,
  PUBLIC_API_URL: process.env.PUBLIC_API_URL,
  TRUST_PROXY: process.env.TRUST_PROXY,
  NOTIFICATION_RECOVERY_INTERVAL_MS: process.env.NOTIFICATION_RECOVERY_INTERVAL_MS,
  NOTIFICATION_DRAIN_TIMEOUT_MS: process.env.NOTIFICATION_DRAIN_TIMEOUT_MS,
  LOG_LEVEL: process.env.LOG_LEVEL,
  LOG_FORMAT: process.env.LOG_FORMAT,
};

const parsedEnv = envSchema.parse(rawEnv);

export interface NotificationValidationOptions {
  requireSendgridWebhookKey?: boolean;
  requireTwilioWhatsApp?: boolean;
  requirePublicApiUrl?: boolean;
}

/**
 * Validates notification provider credentials and webhook configurations.
 * - Optional when NOTIFICATION_MODE=mock (safe default).
 * - Validates required values and formats when production integrations are enabled.
 * - Never prints or leaks secret values.
 */
export function validateNotificationConfig(
  config: typeof parsedEnv | Record<string, any>,
  options: NotificationValidationOptions = {}
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Format validation for settings whenever non-empty
  if (config.SENDGRID_WEBHOOK_VERIFICATION_KEY) {
    const keyCheck = validateSendgridWebhookKey(config.SENDGRID_WEBHOOK_VERIFICATION_KEY);
    if (!keyCheck.valid && keyCheck.error) {
      errors.push(keyCheck.error);
    }
  }

  if (config.TWILIO_WHATSAPP_NUMBER) {
    const waCheck = validateTwilioWhatsAppNumber(config.TWILIO_WHATSAPP_NUMBER);
    if (!waCheck.valid && waCheck.error) {
      errors.push(waCheck.error);
    }
  }

  const isProd = config.NOTIFICATION_MODE === 'production' || config.NODE_ENV === 'production';
  const hasLiveProvider =
    config.NOTIFICATION_MODE === 'production' &&
    (config.NOTIFICATION_EMAIL_PROVIDER === 'sendgrid' || config.NOTIFICATION_MESSAGING_PROVIDER === 'twilio');

  if (config.PUBLIC_API_URL) {
    const urlCheck = validatePublicApiUrl(config.PUBLIC_API_URL, isProd ? 'production' : 'development');
    if (!urlCheck.valid && urlCheck.error) {
      errors.push(urlCheck.error);
    }
  }

  if (config.NOTIFICATION_MODE === 'production') {
    if (config.NOTIFICATION_EMAIL_PROVIDER === 'sendgrid') {
      if (!config.SENDGRID_API_KEY) {
        errors.push('SENDGRID_API_KEY is required when NOTIFICATION_EMAIL_PROVIDER is "sendgrid" in production mode.');
      }
      if (options.requireSendgridWebhookKey && !config.SENDGRID_WEBHOOK_VERIFICATION_KEY) {
        errors.push('SENDGRID_WEBHOOK_VERIFICATION_KEY is required when SendGrid webhook verification is enabled in production mode.');
      }
    }
    if (config.NOTIFICATION_MESSAGING_PROVIDER === 'twilio') {
      if (!config.TWILIO_ACCOUNT_SID) {
        errors.push('TWILIO_ACCOUNT_SID is required when NOTIFICATION_MESSAGING_PROVIDER is "twilio" in production mode.');
      }
      if (!config.TWILIO_AUTH_TOKEN) {
        errors.push('TWILIO_AUTH_TOKEN is required when NOTIFICATION_MESSAGING_PROVIDER is "twilio" in production mode.');
      }
      if (options.requireTwilioWhatsApp && !config.TWILIO_WHATSAPP_NUMBER) {
        errors.push('TWILIO_WHATSAPP_NUMBER is required when Twilio WhatsApp integration is enabled in production mode.');
      }
    }

    const shouldRequirePublicApiUrl =
      options.requirePublicApiUrl !== undefined
        ? options.requirePublicApiUrl
        : hasLiveProvider;

    if (shouldRequirePublicApiUrl && (!config.PUBLIC_API_URL || String(config.PUBLIC_API_URL).trim().length === 0)) {
      errors.push('PUBLIC_API_URL is required in production mode when live notification providers are configured.');
    }
  } else if (options.requirePublicApiUrl) {
    if (!config.PUBLIC_API_URL || String(config.PUBLIC_API_URL).trim().length === 0) {
      errors.push('PUBLIC_API_URL is required when public webhook callbacks are enabled.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export const env = parsedEnv;
