import { Router } from 'express';
import {
  createCustomCakeInquiry,
  getInquiryByReference,
} from '../controllers/inquiry.controller.js';
import { upload } from '../config/cloudinary.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { createCustomCakeInquirySchema } from '../schemas/inquiry.schema.js';
import { submissionLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// Rate limited custom cake inquiry endpoint
router.post(
  '/custom-cakes',
  submissionLimiter,
  upload.single('referenceImage'),
  validateBody(createCustomCakeInquirySchema),
  createCustomCakeInquiry
);

router.get('/custom-cakes/:referenceId', getInquiryByReference);

export default router;
