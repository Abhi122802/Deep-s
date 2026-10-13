import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  cakeId: string;
  cakeName: string;
  selectedWeight: string;
  unitPrice: number; // Server-validated price
  quantity: number;
  customMessage?: string;
  lineTotal: number;
}

export interface IOrderCustomer {
  name: string;
  phone: string;
  email: string;
  address?: string;
}

export interface INotificationPreferences {
  email?: boolean;
  whatsapp?: boolean;
  sms?: boolean;
}

export interface IOrder extends Document {
  orderId: string;
  idempotencyKey?: string;
  customer: IOrderCustomer;
  notificationPreferences?: INotificationPreferences;
  items: IOrderItem[];
  subtotal: number;
  discountAmount: number;
  couponCode?: string;
  deliveryFee: number;
  grandTotal: number;
  deliveryNotes?: string;
  status: 'Pending' | 'Confirmed' | 'Baking' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  paymentStatus: 'Unpaid' | 'Pending' | 'Paid';
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    cakeId: {
      type: String,
      required: true,
    },
    cakeName: {
      type: String,
      required: true,
    },
    selectedWeight: {
      type: String,
      required: true,
      enum: ['0.5 kg', '1 kg', '1.5 kg', '2 kg'],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    customMessage: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
    },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      address: { type: String, trim: true },
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: [(val: any[]) => val.length > 0, 'Order must contain at least one item'],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    deliveryNotes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Baking', 'Out for Delivery', 'Delivered', 'Cancelled'],
      default: 'Pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Unpaid', 'Pending', 'Paid'],
      default: 'Unpaid',
      index: true,
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

export const OrderModel = mongoose.model<IOrder>('Order', OrderSchema);
