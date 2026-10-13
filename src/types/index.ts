export type CakeCategory =
  | 'Birthday'
  | 'Anniversary'
  | 'Chocolate'
  | 'Designer'
  | 'Photo'
  | 'Eggless'
  | 'Wedding';

export type WeightOption = '0.5 kg' | '1 kg' | '1.5 kg' | '2 kg';

export interface Cake {
  id: string;
  name: string;
  slug: string;
  category: CakeCategory;
  basePrice: number; // Price for 0.5 kg
  weightPrices: Record<WeightOption, number>;
  isEggless: boolean;
  image: string; // Exactly one single complete cake image
  secondaryImages?: string[];
  rating: number;
  reviewsCount: number;
  description: string;
  flavor: string;
  ingredients: string[];
  isBestSeller?: boolean;
  isFeatured?: boolean;
  preparationTimeHours: number;
  dietaryTags?: string[];
}

export interface CartItem {
  id: string; // `${cake.id}-${selectedWeight}-${customMessage || 'none'}`
  cake: Cake;
  selectedWeight: WeightOption;
  unitPrice: number;
  quantity: number;
  customMessage?: string;
}

export interface WishlistItem {
  cake: Cake;
  addedAt: string;
}

export interface CustomCakeInquiry {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  occasion: string;
  flavor: string;
  weight: WeightOption;
  isEggless: boolean;
  messageOnCake: string;
  preferredDate: string;
  deliveryTimeSlot: string;
  tierCount: '1 Tier' | '2 Tiers' | '3 Tiers';
  specialInstructions: string;
  referenceImageName?: string;
  referenceImagePreview?: string;
  notificationPreferences?: {
    email?: boolean;
    whatsapp?: boolean;
    sms?: boolean;
  };
  createdAt: string;
}

export interface FilterState {
  search: string;
  category: CakeCategory | 'All';
  eggPreference: 'all' | 'eggless' | 'contains-egg';
  maxPrice: number;
  weight: WeightOption | 'all';
  sortBy: 'featured' | 'price-low' | 'price-high' | 'rating' | 'bestseller';
}

export interface CategoryInfo {
  id: CakeCategory;
  name: string;
  tagline: string;
  image: string;
  itemCount: number;
}
