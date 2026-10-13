import { Router, Request, Response, NextFunction } from 'express';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { getAdminDashboardStats } from '../controllers/admin.controller.js';
import {
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
} from '../controllers/adminOrder.controller.js';
import {
  getAdminCakes,
  getAdminCakeById,
  createAdminCake,
  updateAdminCake,
  toggleAdminCakeAvailability,
  deleteAdminCake,
} from '../controllers/adminCake.controller.js';
import {
  getAdminCategories,
  getAdminCategoryById,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
} from '../controllers/adminCategory.controller.js';
import {
  getAdminInquiries,
  getAdminInquiryById,
  updateAdminInquiryStatus,
} from '../controllers/adminInquiry.controller.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validate.middleware.js';
import { orderQuerySchema, updateOrderStatusSchema } from '../schemas/order.schema.js';
import {
  adminCakeQuerySchema,
  createCakeSchema,
  updateCakeSchema,
  updateCakeAvailabilitySchema,
} from '../schemas/cake.schema.js';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryQuerySchema,
} from '../schemas/category.schema.js';
import {
  adminInquiryQuerySchema,
  updateInquiryStatusSchema,
} from '../schemas/inquiry.schema.js';
import {
  adminNotificationQuerySchema,
  AdminNotificationQuery,
  retryNotificationParamsSchema,
} from '../schemas/notification.schema.js';
import { upload, uploadImageBuffer } from '../config/cloudinary.js';

const router = Router();

/**
 * GET /api/admin/stats
 * Protected admin dashboard overview statistics endpoint
 */
router.get('/admin/stats', requireAdminAuth, getAdminDashboardStats);

/**
 * ========================================================
 * ORDERS MANAGEMENT
 * ========================================================
 */
router.get(
  '/admin/orders',
  requireAdminAuth,
  validateQuery(orderQuerySchema),
  getAdminOrders
);

router.get('/admin/orders/:id', requireAdminAuth, getAdminOrderById);

router.patch(
  '/admin/orders/:id/status',
  requireAdminAuth,
  validateBody(updateOrderStatusSchema),
  updateAdminOrderStatus
);

/**
 * ========================================================
 * CAKE CATALOG CRUD
 * ========================================================
 */
router.get(
  '/admin/cakes',
  requireAdminAuth,
  validateQuery(adminCakeQuerySchema),
  getAdminCakes
);

router.get('/admin/cakes/:id', requireAdminAuth, getAdminCakeById);

router.post(
  '/admin/cakes',
  requireAdminAuth,
  validateBody(createCakeSchema),
  createAdminCake
);

router.put(
  '/admin/cakes/:id',
  requireAdminAuth,
  validateBody(updateCakeSchema),
  updateAdminCake
);

router.patch(
  '/admin/cakes/:id/availability',
  requireAdminAuth,
  validateBody(updateCakeAvailabilitySchema),
  toggleAdminCakeAvailability
);

router.delete('/admin/cakes/:id', requireAdminAuth, deleteAdminCake);

/**
 * ========================================================
 * CATEGORY MANAGEMENT CRUD
 * ========================================================
 */
router.get(
  '/admin/categories',
  requireAdminAuth,
  validateQuery(categoryQuerySchema),
  getAdminCategories
);

router.get('/admin/categories/:id', requireAdminAuth, getAdminCategoryById);

router.post(
  '/admin/categories',
  requireAdminAuth,
  validateBody(createCategorySchema),
  createAdminCategory
);

router.put(
  '/admin/categories/:id',
  requireAdminAuth,
  validateBody(updateCategorySchema),
  updateAdminCategory
);

router.delete('/admin/categories/:id', requireAdminAuth, deleteAdminCategory);

/**
 * ========================================================
 * CUSTOM CAKE INQUIRIES MANAGEMENT
 * ========================================================
 */
router.get(
  '/admin/inquiries',
  requireAdminAuth,
  validateQuery(adminInquiryQuerySchema),
  getAdminInquiries
);

router.get('/admin/inquiries/:id', requireAdminAuth, getAdminInquiryById);

router.patch(
  '/admin/inquiries/:id/status',
  requireAdminAuth,
  validateBody(updateInquiryStatusSchema),
  updateAdminInquiryStatus
);

/**
 * ========================================================
 * NOTIFICATION LOGS (AUDIT INSPECTION)
 * ========================================================
 */
router.get(
  '/admin/notifications',
  requireAdminAuth,
  validateQuery(adminNotificationQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { notificationService } = await import('../notifications/notificationService.js');
      const query = req.query as unknown as AdminNotificationQuery;

      const page = query.page || 1;
      const limit = query.limit || 20;
      const channel = query.channel === 'all' ? undefined : query.channel;
      const eventType = query.eventType === 'all' ? undefined : query.eventType;
      const deliveryStatus = query.deliveryStatus === 'all' ? undefined : query.deliveryStatus;
      const search = query.search?.trim() || undefined;

      const result = await notificationService.getPaginatedLogs({
        page,
        limit,
        eventType,
        channel,
        deliveryStatus,
        search,
      });

      res.json({
        success: true,
        data: result.logs,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/notifications/:id/retry
 * Protected admin operation to retry eligible failed notifications
 * Strictly ignores arbitrary recipient, eventType, or message overrides
 */
router.post(
  '/admin/notifications/:id/retry',
  requireAdminAuth,
  validateParams(retryNotificationParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { notificationService } = await import('../notifications/notificationService.js');
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id || '');

      const result = await notificationService.retryNotification(rawId);

      res.status(result.statusCode).json({
        success: result.success,
        message: result.message,
        data: result.data,
        error: result.error,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * ========================================================
 * IMAGE UPLOAD HANDLING
 * ========================================================
 */
router.post(
  '/admin/upload',
  requireAdminAuth,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'Image upload validation failed.',
        });
      }
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No image file uploaded. Please attach a valid JPEG, PNG, or WEBP image file.',
        });
        return;
      }

      const result = await uploadImageBuffer(req.file, 'deeps_cake_catalog');
      res.json({
        success: true,
        url: result.url,
        publicId: result.publicId,
        message: 'Image uploaded successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
