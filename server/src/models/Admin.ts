import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IAdmin extends Document {
  username: string;
  email: string;
  passwordHash: string;
  role: 'superadmin' | 'bakery_manager';
  tokenVersion: number;
  comparePassword: (candidatePassword: string) => Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema = new Schema<IAdmin>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never return password hash in regular queries
    },
    role: {
      type: String,
      enum: ['superadmin', 'bakery_manager'],
      default: 'bakery_manager',
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

AdminSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const AdminModel = mongoose.model<IAdmin>('Admin', AdminSchema);

/**
 * Resilient in-memory default administrator account for development and offline testing.
 * Restriced strictly to dev/test environments. Default password: AdminBakery@2026.
 */
export const MEMORY_ADMIN = {
  _id: '67a000000000000000000099',
  id: '67a000000000000000000099',
  username: 'admin',
  email: 'admin@deepscakeshop.in',
  passwordHash: '$2b$10$2HNc/yI.hMiRNJT0CNG1/unR7p7UIUp914qnhAL6Zj6E.hbNpSSfC',
  role: 'superadmin' as const,
  tokenVersion: 0,
  async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.passwordHash);
  },
  async save(): Promise<any> {
    return this;
  },
};
