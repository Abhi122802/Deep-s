import { Router } from 'express';
import { adminLogin, getAdminMe, adminLogout } from '../controllers/auth.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { adminLoginSchema } from '../schemas/auth.schema.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.post('/auth/login', authLimiter, validateBody(adminLoginSchema), adminLogin);
router.post('/auth/logout', adminLogout);
router.get('/auth/me', requireAdminAuth, getAdminMe);

export default router;
