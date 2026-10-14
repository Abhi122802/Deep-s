import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { CorrelatedRequest } from './requestLogger.js';

export interface AppError extends Error {
  statusCode?: number;
  errors?: any[];
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected internal server error occurred';
  const correlationId = (req as CorrelatedRequest).correlationId;

  const rawUrl = req.originalUrl || req.url || '';
  const pathname = rawUrl.split('?')[0] || '/';

  // Route error through structured redacting logger to prevent leaking credentials or PII
  logger.error(`[Error] ${statusCode} - ${message}`, {
    correlationId,
    statusCode,
    method: req.method,
    path: pathname,
    errorName: err.name,
    errors: err.errors,
    stack: err.stack,
  });

  // Do not expose internal stacks in production
  const responsePayload: any = {
    success: false,
    message,
  };

  if (correlationId) {
    responsePayload.correlationId = correlationId;
  }

  if (err.errors) {
    responsePayload.errors = err.errors;
  }

  if (process.env.NODE_ENV === 'development' && statusCode === 500) {
    responsePayload.stack = err.stack;
  }

  res.status(statusCode).json(responsePayload);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Resource not found at ${req.method} ${req.originalUrl}`,
  });
}
