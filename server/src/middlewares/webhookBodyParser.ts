import { Request, Response, NextFunction, Router } from 'express';
import express from 'express';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export interface WebhookRequest extends Request {
  rawBody?: Buffer;
}

export const WEBHOOK_BODY_LIMIT = '1mb';

export const SUPPORTED_WEBHOOK_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
] as const;

/**
 * Validates whether the incoming Content-Type header matches supported webhook types.
 */
export function isSupportedWebhookContentType(contentType?: string): boolean {
  if (!contentType) return false;
  const lower = contentType.toLowerCase();
  return (
    lower.includes('application/json') ||
    lower.includes('application/x-www-form-urlencoded')
  );
}

/**
 * Express middleware / router configured specifically for webhook endpoints.
 *
 * Security and compatibility design:
 * 1. Scoped strictly to webhook routes to avoid buffering raw payloads for general API traffic.
 * 2. Enforces a 1MB payload size limit (WEBHOOK_BODY_LIMIT) to prevent memory exhaustion DoS.
 * 3. Preserves the exact incoming raw bytes in `req.rawBody` as a Buffer BEFORE JSON parsing,
 *    which is required for cryptographic signature verification (SendGrid ECDSA and Twilio HMAC-SHA1).
 * 4. Rejects unsupported content types (e.g., text/plain, multipart/form-data) with HTTP 415.
 * 5. Returns HTTP 413 for oversized payloads (> 1MB) and HTTP 400 for malformed JSON.
 * 6. Never logs raw webhook bodies or verification keys.
 */
export function createWebhookBodyParser(): Router {
  const router = Router();

  // 1. Content-type and method filtering
  router.use((req: Request, res: Response, next: NextFunction) => {
    // Only requests with payloads (POST, PUT, PATCH) require content-type checking
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'];
      if (!isSupportedWebhookContentType(contentType)) {
        res.status(415).json({
          success: false,
          message:
            'Unsupported Media Type: Webhooks accept only application/json or application/x-www-form-urlencoded',
        });
        return;
      }
    }
    next();
  });

  // 2. JSON parser with raw-body preservation hook and 1MB size limit
  router.use(
    express.json({
      limit: WEBHOOK_BODY_LIMIT,
      verify: (req: Request, _res: Response, buf: Buffer) => {
        (req as WebhookRequest).rawBody = Buffer.from(buf);
      },
    })
  );

  // 3. URL-encoded parser with raw-body preservation hook and 1MB size limit (for Twilio callbacks)
  router.use(
    express.urlencoded({
      extended: true,
      limit: WEBHOOK_BODY_LIMIT,
      verify: (req: Request, _res: Response, buf: Buffer) => {
        if (!(req as WebhookRequest).rawBody) {
          (req as WebhookRequest).rawBody = Buffer.from(buf);
        }
      },
    })
  );

  // 4. Dedicated error handler for body parsing errors (oversized payload, malformed JSON)
  router.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
      res.status(413).json({
        success: false,
        message: 'Payload Too Large: Webhook payload exceeds the 1MB limit',
      });
      return;
    }
    if (err instanceof SyntaxError && ((err as any).status === 400 || (err as any).statusCode === 400 || 'body' in err)) {
      res.status(400).json({
        success: false,
        message: 'Bad Request: Malformed JSON payload',
      });
      return;
    }
    next(err);
  });

  return router;
}

export const webhookBodyParser = createWebhookBodyParser();
