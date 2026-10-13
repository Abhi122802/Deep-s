import { z } from 'zod';

export const cakeQuerySchema = z.object({
  q: z.string().optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  eggPreference: z.enum(['all', 'eggless', 'contains-egg']).optional(),
  maxPrice: z.coerce.number().positive().optional(),
  weight: z.enum(['all', '0.5 kg', '1 kg', '1.5 kg', '2 kg']).optional(),
  sortBy: z.enum([
    'featured',
    'bestseller',
    'rating',
    'price-low',
    'price-high',
  ]).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
});

export const adminCakeQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  isAvailable: z.enum(['all', 'true', 'false']).optional(),
  sortBy: z.enum([
    'newest',
    'oldest',
    'price-low',
    'price-high',
    'name-asc',
    'name-desc',
    'rating',
  ]).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10).optional(),
});

export const weightPricesSchema = z.object({
  '0.5 kg': z.number().min(0, 'Weight price must be positive'),
  '1 kg': z.number().min(0, 'Weight price must be positive'),
  '1.5 kg': z.number().min(0, 'Weight price must be positive'),
  '2 kg': z.number().min(0, 'Weight price must be positive'),
});

export const createCakeSchema = z.object({
  name: z.string().trim().min(2, 'Cake name must be at least 2 characters').max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  category: z.string().trim().min(2, 'Category is required').max(80),
  basePrice: z.number().min(0, 'Base price cannot be negative'),
  weightPrices: weightPricesSchema,
  isEggless: z.boolean().default(true),
  image: z.string().trim().min(1, 'Image URL or path is required'),
  secondaryImages: z.array(z.string().trim()).default([]).optional(),
  description: z.string().trim().min(5, 'Description must be at least 5 characters').max(3000),
  flavor: z.string().trim().min(2, 'Flavor profile is required').max(120),
  ingredients: z.array(z.string().trim()).default([]).optional(),
  isBestSeller: z.boolean().default(false).optional(),
  isFeatured: z.boolean().default(false).optional(),
  preparationTimeHours: z.number().min(1).default(2).optional(),
  dietaryTags: z.array(z.string().trim()).default([]).optional(),
  isAvailable: z.boolean().default(true).optional(),
});

export const updateCakeSchema = createCakeSchema.partial();

export const updateCakeAvailabilitySchema = z.object({
  isAvailable: z.boolean({ required_error: 'isAvailable boolean flag is required' }),
});
