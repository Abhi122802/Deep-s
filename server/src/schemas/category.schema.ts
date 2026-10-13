import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters').max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  tagline: z.string().trim().min(2, 'Tagline is required').max(200),
  image: z.string().trim().min(1, 'Image URL or path is required'),
  isActive: z.boolean().default(true).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z.enum(['all', 'true', 'false']).optional(),
});
