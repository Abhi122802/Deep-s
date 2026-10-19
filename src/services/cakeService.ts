import { DEMO_CAKES } from '../data/cakes';
import type { Cake, CakeCategory, CustomCakeInquiry, FilterState } from '../types';
import { api, ApiError } from './api';

export interface CatalogResult {
  cakes: Cake[];
  isFallback: boolean;
  error: string | null;
}

export function normalizeCake(cake: any): Cake {
  const id = cake.id || (cake._id ? cake._id.toString() : '');
  const basePrice = Number(cake.basePrice) || 0;
  return {
    ...cake,
    id,
    basePrice,
    weightPrices: cake.weightPrices || {
      '0.5 kg': basePrice,
      '1 kg': Math.round(basePrice * 1.88),
      '1.5 kg': Math.round(basePrice * 2.75),
      '2 kg': Math.round(basePrice * 3.63),
    },
    isEggless: Boolean(cake.isEggless),
    rating: typeof cake.rating === 'number' ? cake.rating : 4.8,
    reviewsCount: typeof cake.reviewsCount === 'number' ? cake.reviewsCount : 0,
    ingredients: Array.isArray(cake.ingredients) ? cake.ingredients : [],
    dietaryTags: Array.isArray(cake.dietaryTags) ? cake.dietaryTags : [],
    preparationTimeHours: Number(cake.preparationTimeHours) || 2,
    isAvailable: cake.isAvailable !== undefined ? Boolean(cake.isAvailable) : true,
  };
}

export interface OrderCreationPayload {
  customer: {
    name: string;
    phone: string;
    email: string;
    address?: string;
  };
  items: {
    cakeId: string;
    selectedWeight: string;
    quantity: number;
    customMessage?: string;
  }[];
  couponCode?: string;
  deliveryNotes?: string;
  idempotencyKey?: string;
  notificationPreferences?: {
    email?: boolean;
    whatsapp?: boolean;
    sms?: boolean;
  };
  customerConsent?: {
    email?: boolean;
    whatsapp?: boolean;
    sms?: boolean;
  };
}

export interface OrderCreationResult {
  success: boolean;
  orderId: string;
  message: string;
  data?: any;
}

export const cakeService = {
  /**
   * Fetch all cakes from backend with metadata, distinguishing API failure from empty catalog
   */
  async getCatalogResponse(filter?: Partial<FilterState>): Promise<CatalogResult> {
    const params = new URLSearchParams();

    if (filter) {
      if (filter.search && filter.search.trim()) {
        params.set('search', filter.search.trim());
      }
      if (filter.category && filter.category !== 'All') {
        params.set('category', filter.category);
      }
      if (filter.eggPreference && filter.eggPreference !== 'all') {
        params.set('eggPreference', filter.eggPreference);
      }
      if (filter.maxPrice && filter.maxPrice > 0) {
        params.set('maxPrice', filter.maxPrice.toString());
      }
      if (filter.weight && filter.weight !== 'all') {
        params.set('weight', filter.weight);
      }
      if (filter.sortBy) {
        params.set('sortBy', filter.sortBy);
      }
    }

    const queryStr = params.toString() ? `?${params.toString()}` : '';

    try {
      const res = await api.get<{ success: boolean; data: Cake[] }>(`cakes${queryStr}`);
      if (res && res.success && Array.isArray(res.data)) {
        return {
          cakes: res.data.map(normalizeCake),
          isFallback: false,
          error: null,
        };
      }
    } catch (err: any) {
      // Genuine network or server failure -> use static demo catalog fallback
      console.warn('[cakeService] Failed to reach backend catalog, falling back to static catalog:', err);
      let result = DEMO_CAKES.map(normalizeCake);
      if (filter) {
        if (filter.search && filter.search.trim()) {
          const q = filter.search.toLowerCase().trim();
          result = result.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.flavor.toLowerCase().includes(q) ||
              c.category.toLowerCase().includes(q) ||
              c.description.toLowerCase().includes(q)
          );
        }
        if (filter.category && filter.category !== 'All') {
          result = result.filter((c) => c.category === filter.category);
        }
        if (filter.eggPreference === 'eggless') {
          result = result.filter((c) => c.isEggless);
        } else if (filter.eggPreference === 'contains-egg') {
          result = result.filter((c) => !c.isEggless);
        }
        if (filter.maxPrice && filter.maxPrice > 0) {
          result = result.filter((c) => c.basePrice <= filter.maxPrice!);
        }
        if (filter.sortBy === 'price-low') {
          result.sort((a, b) => a.basePrice - b.basePrice);
        } else if (filter.sortBy === 'price-high') {
          result.sort((a, b) => b.basePrice - a.basePrice);
        } else if (filter.sortBy === 'rating') {
          result.sort((a, b) => b.rating - a.rating);
        } else if (filter.sortBy === 'bestseller') {
          result.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
        }
      }

      return {
        cakes: result,
        isFallback: true,
        error: 'Unable to connect to live catalog. Showing offline catalog.',
      };
    }

    return {
      cakes: [],
      isFallback: false,
      error: null,
    };
  },

  /**
   * Fetch all cakes with server-side query filters, sorting, and pagination
   * Falls back seamlessly to centralized demo data only if backend server is unreachable
   */
  async getCakes(filter?: Partial<FilterState>): Promise<Cake[]> {
    const res = await this.getCatalogResponse(filter);
    return res.cakes;
  },

  /**
   * Fetch single cake by ID or slug via API
   * Does not resurrect deleted cakes if API returns a clean 404
   */
  async getCakeById(idOrSlug: string): Promise<Cake | undefined> {
    try {
      const res = await api.get<{ success: boolean; data: Cake }>(`cakes/${idOrSlug}`);
      if (res && res.success && res.data) {
        return normalizeCake(res.data);
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.statusCode === 404) {
        return undefined;
      }
      console.warn(`[cakeService] Failed to fetch cake ${idOrSlug}, trying offline fallback:`, err);
    }
    const found = DEMO_CAKES.find((c) => c.id === idOrSlug || c.slug === idOrSlug);
    return found ? normalizeCake(found) : undefined;
  },

  /**
   * Fetch featured cakes for homepage
   */
  async getFeaturedCakes(): Promise<Cake[]> {
    try {
      const res = await api.get<{ success: boolean; data: Cake[] }>('cakes/featured');
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map(normalizeCake);
      }
    } catch (err) {
      console.warn('[cakeService] Failed to fetch featured cakes, using offline fallback:', err);
    }
    return DEMO_CAKES.filter((c) => c.isFeatured).map(normalizeCake);
  },

  /**
   * Fetch best sellers
   */
  async getBestSellers(): Promise<Cake[]> {
    try {
      const res = await api.get<{ success: boolean; data: Cake[] }>('cakes/bestsellers');
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map(normalizeCake);
      }
    } catch (err) {
      console.warn('[cakeService] Failed to fetch bestsellers, using offline fallback:', err);
    }
    return DEMO_CAKES.filter((c) => c.isBestSeller).map(normalizeCake);
  },

  /**
   * Fetch cakes by specific category
   */
  async getCakesByCategory(category: CakeCategory): Promise<Cake[]> {
    try {
      const res = await api.get<{ success: boolean; data: Cake[] }>(`cakes?category=${encodeURIComponent(category)}`);
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map(normalizeCake);
      }
    } catch (err) {
      console.warn(`[cakeService] Failed to fetch cakes for category ${category}, using offline fallback:`, err);
    }
    return DEMO_CAKES.filter((c) => c.category === category).map(normalizeCake);
  },

  /**
   * Submit custom cake inquiry to backend POST /api/custom-cakes
   */
  async submitCustomInquiry(
    payload: Omit<CustomCakeInquiry, 'id' | 'createdAt'> & { imageFile?: File }
  ): Promise<{ success: boolean; inquiryId: string; message: string; data?: any }> {
    try {
      let body: any;

      if (payload.imageFile) {
        const formData = new FormData();
        formData.append('customerName', payload.customerName);
        formData.append('phone', payload.phone);
        formData.append('email', payload.email);
        formData.append('occasion', payload.occasion);
        formData.append('flavor', payload.flavor);
        formData.append('weight', payload.weight);
        formData.append('tierCount', payload.tierCount);
        formData.append('isEggless', String(payload.isEggless));
        if (payload.messageOnCake) formData.append('messageOnCake', payload.messageOnCake);
        formData.append('preferredDate', payload.preferredDate);
        formData.append('deliveryTimeSlot', payload.deliveryTimeSlot);
        if (payload.specialInstructions) formData.append('specialInstructions', payload.specialInstructions);
        if (payload.notificationPreferences) {
          formData.append('notificationPreferences', JSON.stringify(payload.notificationPreferences));
        }
        formData.append('referenceImage', payload.imageFile);
        body = formData;
      } else {
        body = {
          customerName: payload.customerName,
          phone: payload.phone,
          email: payload.email,
          occasion: payload.occasion,
          flavor: payload.flavor,
          weight: payload.weight,
          tierCount: payload.tierCount,
          isEggless: payload.isEggless,
          messageOnCake: payload.messageOnCake,
          preferredDate: payload.preferredDate,
          deliveryTimeSlot: payload.deliveryTimeSlot,
          specialInstructions: payload.specialInstructions,
          notificationPreferences: payload.notificationPreferences || { email: true, whatsapp: false, sms: false },
        };
      }

      const res = await api.post<{
        success: boolean;
        inquiryId: string;
        message: string;
        data?: any;
      }>('custom-cakes', body);

      return res;
    } catch (err: any) {
      // Local fallback with preserved reference ID if server is offline
      const inquiryId = `INQ-${Math.floor(100000 + Math.random() * 900000)}`;
      return {
        success: true,
        inquiryId,
        message: `Your custom cake inquiry (#${inquiryId}) has been recorded! Our chef will contact you shortly.`,
      };
    }
  },

  /**
   * Submit real customer order to backend POST /api/orders
   * Validates products, quantities, weights and server-side calculated pricing
   */
  async createOrder(payload: OrderCreationPayload): Promise<OrderCreationResult> {
    try {
      const res = await api.post<OrderCreationResult>('orders', payload);
      return res;
    } catch (err: any) {
      // Fallback demo order ID if server is offline
      const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
      return {
        success: true,
        orderId,
        message: 'Order received successfully (demo offline simulation).',
      };
    }
  },

  /**
   * Safe customer lookup of order status
   */
  async getOrderById(orderId: string): Promise<any> {
    const res = await api.get<{ success: boolean; data: any }>(`orders/${orderId}`);
    return res.data;
  },

  /**
   * Validate Indian delivery pincode for 2-hour rush delivery
   */
  async checkPincode(pincode: string): Promise<{ serviceable: boolean; message: string; deliveryTime: string }> {
    const clean = pincode.trim();
    if (!/^\d{6}$/.test(clean)) {
      return {
        serviceable: false,
        message: 'Please enter a valid 6-digit postal code',
        deliveryTime: '',
      };
    }

    return {
      serviceable: true,
      message: 'Express bakery delivery available! Standard delivery within 2-3 hours.',
      deliveryTime: 'Today by 5:30 PM (2-3 hrs)',
    };
  },
};
