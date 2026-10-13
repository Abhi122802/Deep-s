import { Router } from 'express';
import { createOrder, getOrderById } from '../controllers/order.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { createOrderSchema } from '../schemas/order.schema.js';
import { submissionLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// Rate limited order placement endpoint
router.post(
  '/orders',
  submissionLimiter,
  validateBody(createOrderSchema),
  createOrder
);

router.get('/orders/:orderId', getOrderById);

export default router;
