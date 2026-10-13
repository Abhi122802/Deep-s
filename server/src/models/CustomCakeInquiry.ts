import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomCakeInquiry extends Document {
  referenceId: string;
  customerName: string;
  phone: string;
  email: string;
  occasion: string;
  flavor: string;
  weight: string;
  tierCount: string;
  isEggless: boolean;
  messageOnCake?: string;
  preferredDate: string;
  deliveryTimeSlot: string;
  deliveryAddress?: string;
  specialInstructions?: string;
  referenceImageUrl?: string;
  referenceImagePublicId?: string;
  estimatedPrice: number;
  status: 'pending' | 'reviewed' | 'quoted' | 'confirmed' | 'cancelled';
  notificationPreferences?: {
    email?: boolean;
    whatsapp?: boolean;
    sms?: boolean;
  };
  quotedAmount?: number;
  quoteCurrency?: string;
  quoteValidityDays?: number;
  quoteValidUntil?: Date;
  quoteNotes?: string;
  internalNotes?: string;
  reviewedAt?: Date;
  quotedAt?: Date;
  confirmedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomCakeInquirySchema = new Schema<ICustomCakeInquiry>(
  {
    referenceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Contact email is required'],
      trim: true,
      lowercase: true,
    },
    occasion: {
      type: String,
      required: [true, 'Occasion is required'],
      trim: true,
    },
    flavor: {
      type: String,
      required: [true, 'Flavor preference is required'],
      trim: true,
    },
    weight: {
      type: String,
      required: [true, 'Target weight is required'],
      enum: ['0.5 kg', '1 kg', '1.5 kg', '2 kg', '3 kg+'],
      default: '1 kg',
    },
    tierCount: {
      type: String,
      enum: ['1 Tier', '2 Tiers', '3 Tiers'],
      default: '1 Tier',
    },
    isEggless: {
      type: Boolean,
      default: true,
    },
    messageOnCake: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    preferredDate: {
      type: String,
      required: [true, 'Preferred celebration date is required'],
    },
    deliveryTimeSlot: {
      type: String,
      default: '12:00 PM – 3:00 PM',
    },
    deliveryAddress: {
      type: String,
      trim: true,
    },
    specialInstructions: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    referenceImageUrl: {
      type: String,
      trim: true,
    },
    referenceImagePublicId: {
      type: String,
      trim: true,
    },
    estimatedPrice: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'quoted', 'confirmed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    quotedAmount: {
      type: Number,
      min: 0,
    },
    quoteCurrency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    quoteValidityDays: {
      type: Number,
      default: 7,
    },
    quoteValidUntil: {
      type: Date,
    },
    quoteNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    internalNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    reviewedAt: {
      type: Date,
    },
    quotedAt: {
      type: Date,
    },
    confirmedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
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

export const CustomCakeInquiryModel = mongoose.model<ICustomCakeInquiry>(
  'CustomCakeInquiry',
  CustomCakeInquirySchema
);
