import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  errors?: any[];
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected internal server error occurred';

  // Do not expose internal stacks in production
  const responsePayload: any = {
    success: false,
    message,
  };

  if (err.errors) {
    responsePayload.errors = err.errors;
  }

  if (process.env.NODE_ENV === 'development' && statusCode === 500) {
    responsePayload.stack = err.stack;
  }

  console.error(`[Error] ${statusCode} - ${message}`);
  res.status(statusCode).json(responsePayload);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Resource not found at ${req.method} ${req.originalUrl}`,
  });
}
