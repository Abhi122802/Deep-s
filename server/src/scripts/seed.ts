import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dns from 'dns';
import { env } from '../config/env.js';
import { connectDB, normalizeMongoUri } from '../config/db.js';
import { CakeModel } from '../models/Cake.js';
import { CategoryModel } from '../models/Category.js';
import { AdminModel } from '../models/Admin.js';
import { DEMO_CAKES } from '../data/cakes.js';
import { CATEGORIES_DATA } from '../data/categories.js';

export async function seedInitialData(force = false): Promise<void> {
  if (!force) {
    const existingCakes = await CakeModel.countDocuments();
    if (existingCakes > 0) {
      return;
    }
    console.log('[Seed] Empty database detected. Seeding initial categories, cakes, and admin...');
  }

  // 1. Seed Categories (Idempotent upsert by name)
  console.log(`[Seed] Seeding ${CATEGORIES_DATA.length} categories...`);
  for (const cat of CATEGORIES_DATA) {
    await CategoryModel.findOneAndUpdate(
      { name: cat.name },
      {
        name: cat.name,
        slug: cat.slug || cat.id.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        tagline: cat.tagline,
        image: cat.image,
        itemCount: cat.itemCount,
        isActive: true,
      },
      { upsert: true, new: true }
    );
  }
  console.log('✓ Categories seeded successfully.');

  // 2. Seed 14 Demo Cakes (Idempotent upsert by slug)
  console.log(`[Seed] Seeding ${DEMO_CAKES.length} demo cakes...`);
  for (const cake of DEMO_CAKES) {
    await CakeModel.findOneAndUpdate(
      { slug: cake.slug },
      {
        name: cake.name,
        slug: cake.slug,
        category: cake.category,
        basePrice: cake.basePrice,
        weightPrices: cake.weightPrices,
        isEggless: cake.isEggless,
        image: cake.image,
        secondaryImages: cake.secondaryImages || [],
        rating: cake.rating,
        reviewsCount: cake.reviewsCount,
        description: cake.description,
        flavor: cake.flavor,
        ingredients: cake.ingredients,
        isBestSeller: cake.isBestSeller ?? false,
        isFeatured: cake.isFeatured ?? false,
        preparationTimeHours: cake.preparationTimeHours ?? 2,
        dietaryTags: cake.dietaryTags || [],
        isAvailable: true,
      },
      { upsert: true, new: true }
    );
  }
  console.log('✓ All 14 demo cakes seeded idempotently.');

  // 3. Seed Default Admin Account (if not exists)
  const existingAdmin = await AdminModel.findOne({ username: 'admin' });
  if (!existingAdmin) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'AdminBakery@2026';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    await AdminModel.create({
      username: 'admin',
      email: 'admin@deepscakeshop.in',
      passwordHash,
      role: 'superadmin',
    });
    console.log(`✓ Default admin created: username="admin", email="admin@deepscakeshop.in"`);
    console.log(`  (Default password: "${defaultPassword}")`);
  } else {
    console.log('✓ Default admin already exists. Preserved.');
  }

  console.log('[Seed] Database seeding completed successfully with 0 duplicates!');
}

async function runSeedCli() {
  const normalized = normalizeMongoUri(env.MONGODB_URI);
  console.log(`[Seed CLI] Connecting to MongoDB at ${normalized.replace(/:([^@]+)@/, ':***@')}...`);

  try {
    const conn = await connectDB();
    if (!conn) {
      throw new Error('Database connection returned null');
    }
    console.log('[Seed CLI] Connected to database.');
    await seedInitialData(true);
  } catch (err: any) {
    console.error(`[Seed Error] Could not connect to MongoDB: ${err.message}`);
    console.error(`[Seed Tip] Make sure MongoDB is running or configure MONGODB_URI in server/.env with your MongoDB Atlas connection string.`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[Seed CLI] Database connection closed.');
    process.exit(0);
  }
}

// Execute CLI run if script is directly executed
if (process.argv[1]?.includes('seed')) {
  runSeedCli();
}
