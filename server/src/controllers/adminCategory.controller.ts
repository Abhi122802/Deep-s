import { Request, Response, NextFunction } from 'express';
import { CategoryModel, ICategory } from '../models/Category.js';
import { CakeModel } from '../models/Cake.js';
import { isDbConnected } from '../config/db.js';
import { CATEGORIES_DATA } from '../data/categories.js';
import { MEMORY_CAKES } from './adminCake.controller.js';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidCategoryId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) return true;
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return true;
  return false;
}

/**
 * In-memory fallback categories for test suite and offline execution
 */
export const MEMORY_CATEGORIES: any[] = CATEGORIES_DATA.map((c) => ({
  ...c,
  _id: c.id,
  slug: c.slug || slugify(c.name),
  isActive: c.isActive !== undefined ? c.isActive : true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

/**
 * Helper to compute live product counts per category
 */
async function computeProductCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  if (isDbConnected()) {
    const agg = await CakeModel.aggregate([
      { $match: { isAvailable: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    for (const item of agg) {
      if (item._id) counts[item._id] = item.count;
    }
  } else {
    for (const cake of MEMORY_CAKES) {
      if (cake.isAvailable) {
        counts[cake.category] = (counts[cake.category] || 0) + 1;
      }
    }
  }

  return counts;
}

/**
 * GET /api/admin/categories
 * Protected admin endpoint to list all categories with live product counts
 */
export async function getAdminCategories(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const search = req.query.search ? String(req.query.search).trim() : '';
    const isActiveParam = req.query.isActive ? String(req.query.isActive).trim() : 'all';

    const productCounts = await computeProductCounts();

    if (isDbConnected()) {
      const filter: any = {};
      if (search) {
        const regex = new RegExp(search, 'i');
        filter.$or = [{ name: regex }, { tagline: regex }, { slug: regex }];
      }

      if (isActiveParam === 'true') {
        filter.isActive = true;
      } else if (isActiveParam === 'false') {
        filter.isActive = false;
      }

      const categories = await CategoryModel.find(filter).sort({ name: 1 }).lean();

      const formatted = categories.map((cat: any) => ({
        ...cat,
        id: cat._id ? cat._id.toString() : cat.name,
        itemCount: productCounts[cat.name] || cat.itemCount || 0,
      }));

      res.json({
        success: true,
        data: formatted,
      });
      return;
    }

    // Memory fallback
    let list = [...MEMORY_CATEGORIES];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.tagline.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q)
      );
    }

    if (isActiveParam === 'true') {
      list = list.filter((c) => c.isActive !== false);
    } else if (isActiveParam === 'false') {
      list = list.filter((c) => c.isActive === false);
    }

    list = list.map((cat) => ({
      ...cat,
      itemCount: productCounts[cat.name] || cat.itemCount || 0,
    }));

    res.json({
      success: true,
      data: list,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/categories/:id
 * Protected admin endpoint to retrieve category by ID, slug, or name
 */
export async function getAdminCategoryById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id || '');

    if (!isValidCategoryId(rawId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid category identifier format.',
      });
      return;
    }

    const id = rawId.trim();
    const productCounts = await computeProductCounts();

    if (isDbConnected()) {
      let category: any = null;
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        category = await CategoryModel.findById(id).lean();
      }
      if (!category) {
        category = await CategoryModel.findOne({
          $or: [{ slug: id }, { name: new RegExp(`^${id}$`, 'i') }],
        }).lean();
      }

      if (!category) {
        res.status(404).json({
          success: false,
          message: `Category with identifier "${id}" was not found.`,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          ...category,
          id: category._id ? category._id.toString() : category.name,
          itemCount: productCounts[category.name] || category.itemCount || 0,
        },
      });
      return;
    }

    // Memory fallback
    const found = MEMORY_CATEGORIES.find(
      (c) =>
        c._id === id ||
        c.id === id ||
        c.slug === id ||
        c.name.toLowerCase() === id.toLowerCase()
    );

    if (!found) {
      res.status(404).json({
        success: false,
        message: `Category with identifier "${id}" was not found.`,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...found,
        itemCount: productCounts[found.name] || found.itemCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/categories
 * Protected admin endpoint to create a new category
 */
export async function createAdminCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const name = String(req.body.name).trim();
    const rawSlug = req.body.slug ? slugify(String(req.body.slug)) : slugify(name);

    if (!rawSlug) {
      res.status(400).json({
        success: false,
        message: 'Could not generate a valid slug from the provided category name.',
      });
      return;
    }

    const slug = rawSlug;

    if (isDbConnected()) {
      // Check duplicate name or slug
      const existing = await CategoryModel.findOne({
        $or: [{ name: new RegExp(`^${name}$`, 'i') }, { slug }],
      });

      if (existing) {
        res.status(409).json({
          success: false,
          message: `Category with name "${name}" or slug "${slug}" already exists.`,
        });
        return;
      }

      const category = await CategoryModel.create({
        ...req.body,
        name,
        slug,
        itemCount: 0,
        isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      });

      res.status(201).json({
        success: true,
        message: `Category "${category.name}" created successfully.`,
        data: category,
      });
      return;
    }

    // Memory fallback
    const existingMemory = MEMORY_CATEGORIES.find(
      (c) => c.name.toLowerCase() === name.toLowerCase() || c.slug === slug
    );

    if (existingMemory) {
      res.status(409).json({
        success: false,
        message: `Category with name "${name}" or slug "${slug}" already exists.`,
      });
      return;
    }

    const newId = `cat_${Date.now()}`;
    const newCat = {
      ...req.body,
      _id: newId,
      id: newId,
      name,
      slug,
      itemCount: 0,
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    MEMORY_CATEGORIES.push(newCat);
    CATEGORIES_DATA.push(newCat);

    res.status(201).json({
      success: true,
      message: `Category "${newCat.name}" created successfully.`,
      data: newCat,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: 'Duplicate key error: A category with this name or slug already exists.',
      });
      return;
    }
    next(error);
  }
}

/**
 * PUT /api/admin/categories/:id
 * Protected admin endpoint to update a category
 */
export async function updateAdminCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id || '');

    if (!isValidCategoryId(rawId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid category identifier format.',
      });
      return;
    }

    const id = rawId.trim();
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.id;

    if (updateData.name && !updateData.slug) {
      updateData.slug = slugify(updateData.name);
    } else if (updateData.slug) {
      updateData.slug = slugify(updateData.slug);
    }

    if (isDbConnected()) {
      let category = id.match(/^[0-9a-fA-F]{24}$/)
        ? await CategoryModel.findById(id)
        : await CategoryModel.findOne({ slug: id });

      if (!category) {
        res.status(404).json({
          success: false,
          message: `Category with identifier "${id}" was not found.`,
        });
        return;
      }

      // Check conflict if name or slug changed
      if (updateData.name || updateData.slug) {
        const conflict = await CategoryModel.findOne({
          _id: { $ne: category._id },
          $or: [
            ...(updateData.name ? [{ name: new RegExp(`^${updateData.name}$`, 'i') }] : []),
            ...(updateData.slug ? [{ slug: updateData.slug }] : []),
          ],
        });
        if (conflict) {
          res.status(409).json({
            success: false,
            message: 'A category with this name or slug already exists.',
          });
          return;
        }
      }

      const oldName = category.name;
      Object.assign(category, updateData);
      await category.save();

      // Prevent orphaning: If category name changed, update associated cakes
      if (updateData.name && updateData.name !== oldName) {
        await CakeModel.updateMany({ category: oldName }, { category: updateData.name });
      }

      res.json({
        success: true,
        message: `Category "${category.name}" updated successfully.`,
        data: category,
      });
      return;
    }

    // Memory fallback
    const index = MEMORY_CATEGORIES.findIndex(
      (c) => c._id === id || c.id === id || c.slug === id
    );

    if (index === -1) {
      res.status(404).json({
        success: false,
        message: `Category with identifier "${id}" was not found.`,
      });
      return;
    }

    const existingCat = MEMORY_CATEGORIES[index];

    if (updateData.slug && updateData.slug !== existingCat.slug) {
      const conflict = MEMORY_CATEGORIES.find(
        (c) => c.slug === updateData.slug && c.id !== existingCat.id && c._id !== existingCat._id
      );
      if (conflict) {
        res.status(409).json({
          success: false,
          message: `A category with slug "${updateData.slug}" already exists.`,
        });
        return;
      }
    }

    const oldName = existingCat.name;
    const updated = {
      ...existingCat,
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    MEMORY_CATEGORIES[index] = updated;

    // Synchronize CATEGORIES_DATA
    const dataIdx = CATEGORIES_DATA.findIndex((c) => c.id === existingCat.id || c.name === oldName);
    if (dataIdx !== -1) {
      CATEGORIES_DATA[dataIdx] = { ...CATEGORIES_DATA[dataIdx], ...updated };
    }

    // Prevent orphaning: update associated cakes in memory
    if (updateData.name && updateData.name !== oldName) {
      for (const cake of MEMORY_CAKES) {
        if (cake.category === oldName) {
          cake.category = updateData.name;
        }
      }
    }

    res.json({
      success: true,
      message: `Category "${updated.name}" updated successfully.`,
      data: updated,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: 'Duplicate key error: A category with this name or slug already exists.',
      });
      return;
    }
    next(error);
  }
}

/**
 * DELETE /api/admin/categories/:id
 * Protected admin endpoint to deactivate or delete category safely
 */
export async function deleteAdminCategory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id || '');

    if (!isValidCategoryId(rawId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid category identifier format.',
      });
      return;
    }

    const id = rawId.trim();

    if (isDbConnected()) {
      let category = id.match(/^[0-9a-fA-F]{24}$/)
        ? await CategoryModel.findById(id)
        : await CategoryModel.findOne({ slug: id });

      if (!category) {
        res.status(404).json({
          success: false,
          message: `Category with identifier "${id}" was not found.`,
        });
        return;
      }

      // Check if products reference this category
      const referencingCakesCount = await CakeModel.countDocuments({
        $or: [
          { category: category.name },
          { category: category.id },
          { category: category.slug },
          { category: category.name.replace(/\s+cakes$/i, '') },
        ],
      });

      if (referencingCakesCount > 0) {
        res.status(400).json({
          success: false,
          message: `Cannot delete category "${category.name}". It is currently referenced by ${referencingCakesCount} cake(s). Reassign or delete those cakes first, or deactivate this category.`,
          referencingCakesCount,
        });
        return;
      }

      await CategoryModel.deleteOne({ _id: category._id });

      res.json({
        success: true,
        message: `Category "${category.name}" was successfully removed.`,
      });
      return;
    }

    // Memory fallback
    const index = MEMORY_CATEGORIES.findIndex(
      (c) => c._id === id || c.id === id || c.slug === id || c.name.toLowerCase() === id.toLowerCase()
    );

    if (index === -1) {
      res.status(404).json({
        success: false,
        message: `Category with identifier "${id}" was not found.`,
      });
      return;
    }

    const category = MEMORY_CATEGORIES[index];

    const shortName = category.name.replace(/\s+cakes$/i, '');
    const count = MEMORY_CAKES.filter(
      (c) =>
        c.category === category.name ||
        c.category === category.id ||
        c.category === category.slug ||
        c.category === shortName
    ).length;

    if (count > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete category "${category.name}". It is currently referenced by ${count} cake(s). Reassign or delete those cakes first, or deactivate this category.`,
        referencingCakesCount: count,
      });
      return;
    }

    MEMORY_CATEGORIES.splice(index, 1);
    const dataIdx = CATEGORIES_DATA.findIndex((c) => c.name === category.name);
    if (dataIdx !== -1) {
      CATEGORIES_DATA.splice(dataIdx, 1);
    }

    res.json({
      success: true,
      message: `Category "${category.name}" was successfully removed.`,
    });
  } catch (error) {
    next(error);
  }
}
