import { Request, Response, NextFunction } from 'express';
import { CakeModel, ICake } from '../models/Cake.js';
import { OrderModel } from '../models/Order.js';
import { isDbConnected } from '../config/db.js';
import { DEMO_CAKES } from '../data/cakes.js';
import { MEMORY_ORDERS } from './adminOrder.controller.js';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidCakeId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) return true;
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return true;
  return false;
}

/**
 * In-memory fallback cakes for testing and offline resilience
 */
export const MEMORY_CAKES: any[] = DEMO_CAKES.map((c) => ({
  ...c,
  _id: c.id,
  isAvailable: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

/**
 * GET /api/admin/cakes
 * Protected admin endpoint to list, search, filter, and paginate cakes
 */
export async function getAdminCakes(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const search = req.query.search ? String(req.query.search).trim() : '';
    const category = req.query.category ? String(req.query.category).trim() : 'All';
    const isAvailableParam = req.query.isAvailable ? String(req.query.isAvailable).trim() : 'all';
    const sortBy = req.query.sortBy ? String(req.query.sortBy).trim() : 'newest';

    if (isDbConnected()) {
      const filter: any = {};

      if (search) {
        const regex = new RegExp(search, 'i');
        filter.$or = [
          { name: regex },
          { flavor: regex },
          { description: regex },
          { slug: regex },
        ];
      }

      if (category && category !== 'All') {
        filter.category = category;
      }

      if (isAvailableParam === 'true') {
        filter.isAvailable = true;
      } else if (isAvailableParam === 'false') {
        filter.isAvailable = false;
      }

      let sortQuery: any = { createdAt: -1 };
      if (sortBy === 'oldest') sortQuery = { createdAt: 1 };
      else if (sortBy === 'price-low') sortQuery = { basePrice: 1 };
      else if (sortBy === 'price-high') sortQuery = { basePrice: -1 };
      else if (sortBy === 'name-asc') sortQuery = { name: 1 };
      else if (sortBy === 'name-desc') sortQuery = { name: -1 };
      else if (sortBy === 'rating') sortQuery = { rating: -1 };

      const skip = (page - 1) * limit;

      const [total, cakes] = await Promise.all([
        CakeModel.countDocuments(filter),
        CakeModel.find(filter).sort(sortQuery).skip(skip).limit(limit).lean(),
      ]);

      const totalPages = Math.ceil(total / limit) || 1;

      res.json({
        success: true,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        data: cakes.map((c: any) => ({
          ...c,
          id: c._id ? c._id.toString() : c.id,
        })),
      });
      return;
    }

    // Memory fallback
    let filtered = [...MEMORY_CAKES];

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.flavor.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q)
      );
    }

    if (category && category !== 'All') {
      filtered = filtered.filter((c) => c.category === category);
    }

    if (isAvailableParam === 'true') {
      filtered = filtered.filter((c) => c.isAvailable === true);
    } else if (isAvailableParam === 'false') {
      filtered = filtered.filter((c) => c.isAvailable === false);
    }

    if (sortBy === 'oldest') {
      filtered.sort(
        (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      );
    } else if (sortBy === 'price-low') {
      filtered.sort((a, b) => a.basePrice - b.basePrice);
    } else if (sortBy === 'price-high') {
      filtered.sort((a, b) => b.basePrice - a.basePrice);
    } else if (sortBy === 'name-asc') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name-desc') {
      filtered.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating);
    } else {
      filtered.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;
    const paginated = filtered.slice(skip, skip + limit);

    res.json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      data: paginated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/cakes/:id
 * Protected admin endpoint to retrieve a cake by ID or slug
 */
export async function getAdminCakeById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id || '');

    if (!isValidCakeId(rawId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid cake identifier format.',
      });
      return;
    }

    const id = rawId.trim();

    if (isDbConnected()) {
      let cake: any = null;
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        cake = await CakeModel.findById(id).lean();
      }
      if (!cake) {
        cake = await CakeModel.findOne({
          $or: [{ slug: id }, { name: new RegExp(`^${id}$`, 'i') }],
        }).lean();
      }

      if (!cake) {
        res.status(404).json({
          success: false,
          message: `Cake with identifier "${id}" was not found.`,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          ...cake,
          id: cake._id ? cake._id.toString() : cake.id,
        },
      });
      return;
    }

    // Memory fallback
    const found = MEMORY_CAKES.find(
      (c) => c._id === id || c.id === id || c.slug === id || c.name.toLowerCase() === id.toLowerCase()
    );

    if (!found) {
      res.status(404).json({
        success: false,
        message: `Cake with identifier "${id}" was not found.`,
      });
      return;
    }

    res.json({
      success: true,
      data: found,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/cakes
 * Protected admin endpoint to create a new cake
 */
export async function createAdminCake(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawSlug = req.body.slug ? slugify(String(req.body.slug)) : slugify(String(req.body.name));

    if (!rawSlug) {
      res.status(400).json({
        success: false,
        message: 'Could not generate a valid slug from the provided cake name.',
      });
      return;
    }

    const slug = rawSlug;

    // Check duplicate slug
    if (isDbConnected()) {
      const existing = await CakeModel.findOne({ slug });
      if (existing) {
        res.status(409).json({
          success: false,
          message: `A cake with slug "${slug}" already exists. Please choose a different name or slug.`,
        });
        return;
      }

      // Security: never accept client-supplied ratings/reviewsCount as trusted values
      const cakeData = {
        ...req.body,
        slug,
        rating: 4.8,
        reviewsCount: 0,
        isAvailable: req.body.isAvailable !== undefined ? Boolean(req.body.isAvailable) : true,
      };

      const cake = await CakeModel.create(cakeData);

      res.status(201).json({
        success: true,
        message: `Cake "${cake.name}" created successfully.`,
        data: cake,
      });
      return;
    }

    // Memory fallback
    const existingMemory = MEMORY_CAKES.find((c) => c.slug === slug);
    if (existingMemory) {
      res.status(409).json({
        success: false,
        message: `A cake with slug "${slug}" already exists. Please choose a different name or slug.`,
      });
      return;
    }

    const newId = `cake_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newCake = {
      ...req.body,
      _id: newId,
      id: newId,
      slug,
      rating: 4.8,
      reviewsCount: 0,
      isAvailable: req.body.isAvailable !== undefined ? Boolean(req.body.isAvailable) : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    MEMORY_CAKES.unshift(newCake);
    DEMO_CAKES.unshift(newCake);

    res.status(201).json({
      success: true,
      message: `Cake "${newCake.name}" created successfully.`,
      data: newCake,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: 'Duplicate key error: A cake with this slug or name already exists.',
      });
      return;
    }
    next(error);
  }
}

/**
 * PUT /api/admin/cakes/:id
 * Protected admin endpoint to update a cake
 */
export async function updateAdminCake(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id || '');

    if (!isValidCakeId(rawId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid cake identifier format.',
      });
      return;
    }

    const id = rawId.trim();

    // Security: sanitize out rating and reviewsCount so client cannot tamper
    const updateData = { ...req.body };
    delete updateData.rating;
    delete updateData.reviewsCount;
    delete updateData._id;
    delete updateData.id;

    if (updateData.name && !updateData.slug) {
      updateData.slug = slugify(updateData.name);
    } else if (updateData.slug) {
      updateData.slug = slugify(updateData.slug);
    }

    if (isDbConnected()) {
      let cake = id.match(/^[0-9a-fA-F]{24}$/)
        ? await CakeModel.findById(id)
        : await CakeModel.findOne({ slug: id });

      if (!cake) {
        res.status(404).json({
          success: false,
          message: `Cake with identifier "${id}" was not found.`,
        });
        return;
      }

      // Check slug conflict if slug is being updated
      if (updateData.slug && updateData.slug !== cake.slug) {
        const conflict = await CakeModel.findOne({
          slug: updateData.slug,
          _id: { $ne: cake._id },
        });
        if (conflict) {
          res.status(409).json({
            success: false,
            message: `A cake with slug "${updateData.slug}" already exists.`,
          });
          return;
        }
      }

      // Preserve existing image if update doesn't provide a new one
      if (!updateData.image) {
        delete updateData.image;
      }

      Object.assign(cake, updateData);
      await cake.save();

      res.json({
        success: true,
        message: `Cake "${cake.name}" updated successfully.`,
        data: cake,
      });
      return;
    }

    // Memory fallback
    const index = MEMORY_CAKES.findIndex(
      (c) => c._id === id || c.id === id || c.slug === id
    );

    if (index === -1) {
      res.status(404).json({
        success: false,
        message: `Cake with identifier "${id}" was not found.`,
      });
      return;
    }

    const existingCake = MEMORY_CAKES[index];

    if (updateData.slug && updateData.slug !== existingCake.slug) {
      const conflict = MEMORY_CAKES.find(
        (c) => c.slug === updateData.slug && c.id !== existingCake.id && c._id !== existingCake._id
      );
      if (conflict) {
        res.status(409).json({
          success: false,
          message: `A cake with slug "${updateData.slug}" already exists.`,
        });
        return;
      }
    }

    if (!updateData.image) {
      delete updateData.image;
    }

    const updated = {
      ...existingCake,
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    MEMORY_CAKES[index] = updated;

    // Update DEMO_CAKES if present
    const demoIdx = DEMO_CAKES.findIndex((c) => c.id === existingCake.id || c.slug === existingCake.slug);
    if (demoIdx !== -1) {
      DEMO_CAKES[demoIdx] = { ...DEMO_CAKES[demoIdx], ...updated };
    }

    res.json({
      success: true,
      message: `Cake "${updated.name}" updated successfully.`,
      data: updated,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: 'Duplicate key error: A cake with this slug or name already exists.',
      });
      return;
    }
    next(error);
  }
}

/**
 * PATCH /api/admin/cakes/:id/availability
 * Protected admin endpoint to toggle cake availability (soft active/inactive)
 */
export async function toggleAdminCakeAvailability(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id || '');

    if (!isValidCakeId(rawId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid cake identifier format.',
      });
      return;
    }

    const id = rawId.trim();
    const isAvailable = Boolean(req.body.isAvailable);

    if (isDbConnected()) {
      let cake = id.match(/^[0-9a-fA-F]{24}$/)
        ? await CakeModel.findById(id)
        : await CakeModel.findOne({ slug: id });

      if (!cake) {
        res.status(404).json({
          success: false,
          message: `Cake with identifier "${id}" was not found.`,
        });
        return;
      }

      cake.isAvailable = isAvailable;
      await cake.save();

      res.json({
        success: true,
        message: `Cake "${cake.name}" is now ${isAvailable ? 'available' : 'unavailable'} for ordering.`,
        data: cake,
      });
      return;
    }

    // Memory fallback
    const cake = MEMORY_CAKES.find((c) => c._id === id || c.id === id || c.slug === id);

    if (!cake) {
      res.status(404).json({
        success: false,
        message: `Cake with identifier "${id}" was not found.`,
      });
      return;
    }

    cake.isAvailable = isAvailable;
    cake.updatedAt = new Date().toISOString();

    const demoIdx = DEMO_CAKES.findIndex((c) => c.id === cake.id || c.slug === cake.slug);
    if (demoIdx !== -1) {
      (DEMO_CAKES[demoIdx] as any).isAvailable = isAvailable;
    }

    res.json({
      success: true,
      message: `Cake "${cake.name}" is now ${isAvailable ? 'available' : 'unavailable'} for ordering.`,
      data: cake,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/admin/cakes/:id
 * Soft-deletes or deletes cake if not referenced by existing historical orders
 */
export async function deleteAdminCake(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id || '');

    if (!isValidCakeId(rawId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid cake identifier format.',
      });
      return;
    }

    const id = rawId.trim();

    if (isDbConnected()) {
      let cake = id.match(/^[0-9a-fA-F]{24}$/)
        ? await CakeModel.findById(id)
        : await CakeModel.findOne({ slug: id });

      if (!cake) {
        res.status(404).json({
          success: false,
          message: `Cake with identifier "${id}" was not found.`,
        });
        return;
      }

      // Check historical orders reference
      const orderRef = await OrderModel.findOne({
        'items.cakeId': { $in: [cake._id.toString(), cake.slug] },
      });

      if (orderRef) {
        // Soft deactivate to preserve historical order integrity
        cake.isAvailable = false;
        await cake.save();

        res.json({
          success: true,
          isSoftDeleted: true,
          message: `Cake "${cake.name}" has historical order records and was deactivated instead of deleted.`,
          data: cake,
        });
        return;
      }

      await CakeModel.deleteOne({ _id: cake._id });

      res.json({
        success: true,
        isSoftDeleted: false,
        message: `Cake "${cake.name}" was successfully removed from catalog.`,
      });
      return;
    }

    // Memory fallback
    const index = MEMORY_CAKES.findIndex((c) => c._id === id || c.id === id || c.slug === id);

    if (index === -1) {
      res.status(404).json({
        success: false,
        message: `Cake with identifier "${id}" was not found.`,
      });
      return;
    }

    const cake = MEMORY_CAKES[index];

    // Check memory orders
    const hasOrder = MEMORY_ORDERS.some((o) =>
      o.items?.some((item: any) => item.cakeId === cake.id || item.cakeId === cake.slug)
    );

    if (hasOrder) {
      cake.isAvailable = false;
      res.json({
        success: true,
        isSoftDeleted: true,
        message: `Cake "${cake.name}" has historical order records and was deactivated instead of deleted.`,
        data: cake,
      });
      return;
    }

    MEMORY_CAKES.splice(index, 1);
    const demoIndex = DEMO_CAKES.findIndex((c) => c.id === cake.id || c.slug === cake.slug);
    if (demoIndex !== -1) {
      DEMO_CAKES.splice(demoIndex, 1);
    }

    res.json({
      success: true,
      isSoftDeleted: false,
      message: `Cake "${cake.name}" was successfully removed from catalog.`,
    });
  } catch (error) {
    next(error);
  }
}
