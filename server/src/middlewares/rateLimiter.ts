import rateLimit from 'express-rate-limit';

// Standard rate limiter for general public endpoints
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});

// Stricter rate limiter for order submissions and custom inquiries
export const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // Limit each IP to 30 submissions per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Submission limit reached for this hour. Please try again later.',
  },
});

// Auth endpoint rate limiter
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit login attempts to 10 per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
});

// Dedicated rate limiter for webhook callbacks (SendGrid, Twilio)
// Provides higher request ceiling (1200 req/15min) so legitimate high-volume provider callbacks
// are not throttled while safeguarding against volumetric Denial-of-Service attacks.
export function createWebhookLimiter(maxRequests = 1200) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Webhook rate limit exceeded. Please retry later.',
    },
  });
}

export const webhookLimiter = createWebhookLimiter();
