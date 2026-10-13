import mongoose, { Schema, Document } from 'mongoose';

export type CakeCategoryType =
  | 'Birthday'
  | 'Anniversary'
  | 'Chocolate'
  | 'Designer'
  | 'Photo'
  | 'Eggless'
  | 'Wedding'
  | (string & {});

export type WeightOptionType = '0.5 kg' | '1 kg' | '1.5 kg' | '2 kg';

export interface ICake extends Document {
  name: string;
  slug: string;
  category: CakeCategoryType;
  basePrice: number;
  weightPrices: Record<WeightOptionType, number>;
  isEggless: boolean;
  image: string;
  secondaryImages: string[];
  rating: number;
  reviewsCount: number;
  description: string;
  flavor: string;
  ingredients: string[];
  isBestSeller: boolean;
  isFeatured: boolean;
  preparationTimeHours: number;
  dietaryTags: string[];
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CakeSchema = new Schema<ICake>(
  {
    name: {
      type: String,
      required: [true, 'Cake name is required'],
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: [0, 'Base price cannot be negative'],
    },
    weightPrices: {
      '0.5 kg': { type: Number, required: true },
      '1 kg': { type: Number, required: true },
      '1.5 kg': { type: Number, required: true },
      '2 kg': { type: Number, required: true },
    },
    isEggless: {
      type: Boolean,
      default: true,
      index: true,
    },
    image: {
      type: String,
      required: [true, 'Cake image URL is required'],
      trim: true,
    },
    secondaryImages: {
      type: [String],
      default: [],
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
    reviewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    flavor: {
      type: String,
      required: [true, 'Flavor profile is required'],
      trim: true,
    },
    ingredients: {
      type: [String],
      default: [],
    },
    isBestSeller: {
      type: Boolean,
      default: false,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    preparationTimeHours: {
      type: Number,
      default: 2,
      min: 1,
    },
    dietaryTags: {
      type: [String],
      default: [],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for searching and filtering performance
CakeSchema.index({ name: 'text', flavor: 'text', description: 'text' });
CakeSchema.index({ basePrice: 1 });
CakeSchema.index({ rating: -1 });

export const CakeModel = mongoose.model<ICake>('Cake', CakeSchema);
