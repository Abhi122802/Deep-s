import { Request, Response, NextFunction } from 'express';
import { CakeModel, ICake } from '../models/Cake.js';
import { isDbConnected } from '../config/db.js';

// Fallback demo data in case MongoDB is temporarily disconnected
import { DEMO_CAKES } from '../data/cakes.js';

export async function getCakes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      q,
      search,
      category,
      eggPreference,
      maxPrice,
      weight,
      sortBy,
      page = 1,
      limit = 50,
    } = req.query as any;

    const searchTerm = (search || q || '').trim();

    if (isDbConnected()) {
      const filter: any = { isAvailable: true };

      if (searchTerm) {
        filter.$or = [
          { name: { $regex: searchTerm, $options: 'i' } },
          { flavor: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
        ];
      }

      if (category && category !== 'All') {
        filter.category = category;
      }

      if (eggPreference === 'eggless') {
        filter.isEggless = true;
      } else if (eggPreference === 'contains-egg') {
        filter.isEggless = false;
      }

      if (maxPrice && Number(maxPrice) > 0) {
        filter.basePrice = { $lte: Number(maxPrice) };
      }

      if (weight && weight !== 'all') {
        filter[`weightPrices.${weight}`] = { $exists: true };
      }

      // Sorting
      let sortQuery: any = { isFeatured: -1, createdAt: -1 };
      if (sortBy === 'price-low') {
        sortQuery = { basePrice: 1 };
      } else if (sortBy === 'price-high') {
        sortQuery = { basePrice: -1 };
      } else if (sortBy === 'rating') {
        sortQuery = { rating: -1 };
      } else if (sortBy === 'bestseller') {
        sortQuery = { isBestSeller: -1, rating: -1 };
      }

      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(50, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * limitNum;

      const [cakes, total] = await Promise.all([
        CakeModel.find(filter).sort(sortQuery).skip(skip).limit(limitNum).lean(),
        CakeModel.countDocuments(filter),
      ]);

      const formatted = cakes.map((c: any) => ({
        ...c,
        id: c._id ? c._id.toString() : c.id,
      }));

      res.json({
        success: true,
        data: formatted,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      });
      return;
    }

    // Graceful fallback to centralized demo cakes if database connection is pending
    let fallback = [...DEMO_CAKES];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      fallback = fallback.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.flavor.toLowerCase().includes(term) ||
          c.description.toLowerCase().includes(term)
      );
    }
    if (category && category !== 'All') {
      fallback = fallback.filter((c) => c.category === category);
    }
    if (eggPreference === 'eggless') {
      fallback = fallback.filter((c) => c.isEggless);
    } else if (eggPreference === 'contains-egg') {
      fallback = fallback.filter((c) => !c.isEggless);
    }
    if (maxPrice && Number(maxPrice) > 0) {
      fallback = fallback.filter((c) => c.basePrice <= Number(maxPrice));
    }
    if (sortBy === 'price-low') {
      fallback.sort((a, b) => a.basePrice - b.basePrice);
    } else if (sortBy === 'price-high') {
      fallback.sort((a, b) => b.basePrice - a.basePrice);
    } else if (sortBy === 'rating') {
      fallback.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'bestseller') {
      fallback.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
    }

    res.json({
      success: true,
      data: fallback,
      pagination: {
        total: fallback.length,
        page: 1,
        limit: fallback.length,
        pages: 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getCakeById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id);

    if (isDbConnected()) {
      let cake: ICake | null = null;
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        cake = await CakeModel.findById(id);
      }
      if (!cake) {
        cake = await CakeModel.findOne({
          $or: [{ slug: id }, { name: new RegExp(`^${id}$`, 'i') }],
        });
      }

      if (cake) {
        res.json({ success: true, data: cake });
        return;
      }
    }

    // Fallback search
    const found = DEMO_CAKES.find(
      (c) => c.id === id || c.slug === id || c.name.toLowerCase() === id.toLowerCase()
    );

    if (!found) {
      res.status(404).json({
        success: false,
        message: `Cake product with identifier "${id}" was not found.`,
      });
      return;
    }

    res.json({ success: true, data: found });
  } catch (error) {
    next(error);
  }
}

export async function getFeaturedCakes(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (isDbConnected()) {
      const cakes = await CakeModel.find({ isFeatured: true, isAvailable: true }).limit(8).lean();
      res.json({ success: true, data: cakes });
      return;
    }
    res.json({ success: true, data: DEMO_CAKES.filter((c) => c.isFeatured) });
  } catch (error) {
    next(error);
  }
}

export async function getBestSellers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (isDbConnected()) {
      const cakes = await CakeModel.find({ isBestSeller: true, isAvailable: true }).limit(8).lean();
      res.json({ success: true, data: cakes });
      return;
    }
    res.json({ success: true, data: DEMO_CAKES.filter((c) => c.isBestSeller) });
  } catch (error) {
    next(error);
  }
}
