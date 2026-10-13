import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env.js';
import { UPLOADS_DIR } from './config/cloudinary.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { generalLimiter } from './middlewares/rateLimiter.js';

import healthRoutes from './routes/health.routes.js';
import cakeRoutes from './routes/cake.routes.js';
import categoryRoutes from './routes/category.routes.js';
import inquiryRoutes from './routes/inquiry.routes.js';
import orderRoutes from './routes/order.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';

export const DEV_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

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
