import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

export interface CorrelatedRequest extends Request {
  correlationId?: string;
}

export const CORRELATION_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Validates a client-supplied request correlation ID.
 * Accepts only values matching ^[a-zA-Z0-9_-]{1,64}$ after trimming.
 * Returns a fresh server-side UUID-based ID if missing, empty, or invalid.
 */
export function validateAndResolveCorrelationId(incomingHeader: unknown): string {
  if (typeof incomingHeader === 'string') {
    const trimmed = incomingHeader.trim();
    if (CORRELATION_ID_REGEX.test(trimmed)) {
      return trimmed;
    }
  }
  return `req_${randomUUID().substring(0, 12)}`;
}

/**
 * Middleware that attaches or propagates a validated unique correlation ID per request (X-Request-Id)
 * and records structured access logs upon response completion.
 */
export function requestLogger(req: CorrelatedRequest, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const correlationId = validateAndResolveCorrelationId(incomingId);

  req.correlationId = correlationId;
  res.setHeader('X-Request-Id', correlationId);

  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const rawUrl = req.originalUrl || req.url || '';
    const pathname = rawUrl.split('?')[0] || '/';

    logger[logLevel]('HTTP request completed', {
      correlationId,
      method: req.method,
      path: pathname,
      statusCode,
      durationMs,
      ip: req.ip,
    });
  });

  next();
}
