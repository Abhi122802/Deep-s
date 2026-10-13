import { Request, Response, NextFunction } from 'express';
import { CategoryModel } from '../models/Category.js';
import { isDbConnected } from '../config/db.js';
import { CATEGORIES_DATA } from '../data/categories.js';

export async function getCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (isDbConnected()) {
      const categories = await CategoryModel.find().lean();
      if (categories && categories.length > 0) {
        res.json({ success: true, data: categories });
        return;
      }
    }

    // Fallback to demo categories
    res.json({ success: true, data: CATEGORIES_DATA });
  } catch (error) {
    next(error);
  }
}
