import { Router } from 'express';
import { handleSendgridWebhook, handleTwilioWebhook } from '../controllers/webhook.controller.js';
import { webhookLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// Apply dedicated rate limiter for webhook endpoints (1200 req / 15 min)
router.use(webhookLimiter);

// POST /api/webhooks/sendgrid
router.post('/sendgrid', handleSendgridWebhook);

// POST /api/webhooks/twilio
router.post('/twilio', handleTwilioWebhook);

export default router;
