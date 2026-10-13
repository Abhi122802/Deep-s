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
};

const parsedEnv = envSchema.parse(rawEnv);

/**
 * Validates notification provider credentials when production mode is activated
 */
export function validateNotificationConfig(config: typeof parsedEnv): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.NOTIFICATION_MODE === 'production') {
    if (config.NOTIFICATION_EMAIL_PROVIDER === 'sendgrid' && !config.SENDGRID_API_KEY) {
      errors.push('SENDGRID_API_KEY is required when NOTIFICATION_EMAIL_PROVIDER is "sendgrid" in production mode.');
    }
    if (config.NOTIFICATION_MESSAGING_PROVIDER === 'twilio') {
      if (!config.TWILIO_ACCOUNT_SID) {
        errors.push('TWILIO_ACCOUNT_SID is required when NOTIFICATION_MESSAGING_PROVIDER is "twilio" in production mode.');
      }
      if (!config.TWILIO_AUTH_TOKEN) {
        errors.push('TWILIO_AUTH_TOKEN is required when NOTIFICATION_MESSAGING_PROVIDER is "twilio" in production mode.');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export const env = parsedEnv;
