import { Router } from 'express';
import {
  getCakes,
  getCakeById,
  getFeaturedCakes,
  getBestSellers,
} from '../controllers/cake.controller.js';
import { validateQuery } from '../middlewares/validate.middleware.js';
import { cakeQuerySchema } from '../schemas/cake.schema.js';

const router = Router();

router.get('/cakes', validateQuery(cakeQuerySchema), getCakes);
router.get('/cakes/featured', getFeaturedCakes);
router.get('/cakes/bestsellers', getBestSellers);
router.get('/cakes/:id', getCakeById);

export default router;
