import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env.js';
import { UPLOADS_DIR } from './config/cloudinary.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { generalLimiter } from './middlewares/rateLimiter.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { webhookBodyParser } from './middlewares/webhookBodyParser.js';

import healthRoutes from './routes/health.routes.js';
import cakeRoutes from './routes/cake.routes.js';
import categoryRoutes from './routes/category.routes.js';
import inquiryRoutes from './routes/inquiry.routes.js';
import orderRoutes from './routes/order.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import webhookRoutes from './routes/webhook.routes.js';

export const DEV_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

/**
 * Configures Express trust proxy based on deployment topology.
 *
 * Supported values:
 * - '0' | 'false': Direct internet exposure (no reverse proxy). Disables proxy trust to prevent client spoofing.
 * - '1' | 'true': Standard single reverse proxy (Cloudflare, AWS ALB, Nginx, Render, etc.). Trusts immediate upstream proxy.
 * - '<number>': Multi-hop proxy chain (e.g., '2' for Cloudflare + Nginx).
 * - '<ip/subnet/cidr>': Specific trusted proxy IP address or subnet (e.g., '127.0.0.1', 'loopback', '10.0.0.0/8').
 *
 * CRITICAL DEPLOYMENT DIRECTIVE:
 * If the API is deployed directly to the public internet without an upstream reverse proxy,
 * TRUST_PROXY MUST be set to '0' or 'false' to prevent client spoofing of X-Forwarded-For headers,
 * which would otherwise allow attackers to bypass IP-based rate limiting.
 */
export function configureTrustProxy(app: Express, trustProxySetting: string = env.TRUST_PROXY): void {
  const normalized = (trustProxySetting || '').trim().toLowerCase();

  if (normalized === '0' || normalized === 'false') {
    app.set('trust proxy', false);
  } else if (normalized === '1' || normalized === 'true') {
    app.set('trust proxy', 1);
  } else if (!isNaN(Number(normalized)) && Number(normalized) >= 0) {
    app.set('trust proxy', Number(normalized));
  } else if (trustProxySetting && trustProxySetting.trim().length > 0) {
    try {
      app.set('trust proxy', trustProxySetting.trim());
    } catch {
      app.set('trust proxy', false);
    }
  } else {
    app.set('trust proxy', false);
  }
}

/**
 * Resolves permitted origins based on environment and configured FRONTEND_URL.
 * In production: accepts ONLY explicitly configured trusted origins.
 * In development / test: accepts configured origins plus explicit local dev servers.
 */
export function resolveAllowedOrigins(nodeEnv: string, frontendUrl: string): string[] {
  const configured = frontendUrl
    ? frontendUrl
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  if (nodeEnv === 'production') {
    return configured;
  }

  const combined = new Set([...configured, ...DEV_ALLOWED_ORIGINS]);
  return Array.from(combined);
}

/**
 * Validates whether an incoming request Origin is permitted under CORS rules.
 * Requests without an Origin header are permitted for server-to-server, health-check, or CLI calls.
 */
export function isOriginAllowed(
  origin: string | undefined,
  nodeEnv: string = env.NODE_ENV,
  frontendUrl: string = env.FRONTEND_URL
): boolean {
  // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, health checks)
  if (!origin) {
    return true;
  }

  const allowed = resolveAllowedOrigins(nodeEnv, frontendUrl);
  return allowed.includes(origin);
}

export function createApp(): Express {
  const app = express();

  // Configure reverse proxy trust
  configureTrustProxy(app, env.TRUST_PROXY);

  // Security HTTP Headers via Helmet
  // ContentSecurityPolicy is disabled on the REST API to avoid breaking cross-origin clients and external payment scripts
  // CrossOriginResourcePolicy is configured to allow cross-origin image embedding for /uploads
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // Attach correlation ID and structured access logging
  app.use(requestLogger);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin, env.NODE_ENV, env.FRONTEND_URL)) {
          callback(null, true);
        } else {
          // Unlisted origins do not receive CORS permission
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Cookie parser for secure HttpOnly session tokens
  app.use(cookieParser());

  // Webhook-specific body parser with exact raw-body capture (Phase 5, Milestone 2)
  // Scoped strictly to /api/webhooks before general body parsers to avoid buffering raw payloads for regular API traffic
  app.use('/api/webhooks', webhookBodyParser);

  // Webhook routes with dedicated webhookLimiter (Phase 5, Milestone 2, Work Item 3)
  app.use('/api/webhooks', webhookRoutes);

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Static serving for local uploads directory
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Global rate limiter
  app.use('/api', generalLimiter);

  // API Routes
  app.use('/api', healthRoutes);
  app.use('/api', cakeRoutes);
  app.use('/api', categoryRoutes);
  app.use('/api', inquiryRoutes);
  app.use('/api', orderRoutes);
  app.use('/api', authRoutes);
  app.use('/api', adminRoutes);

  // 404 Catch-All & Centralized Error Handler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
