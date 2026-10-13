import { api, authStorage } from './api';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'superadmin' | 'bakery_manager';
}

export interface AdminLoginResponse {
  success: boolean;
  token?: string;
  admin: AdminUser;
  isDefaultCredentials?: boolean;
  message: string;
}

export interface AdminMeResponse {
  success: boolean;
  admin: AdminUser;
  isDefaultCredentials?: boolean;
}

export interface OrderItemSummary {
  cakeId: string;
  cakeName: string;
  selectedWeight: string;
  unitPrice: number;
  quantity: number;
  customMessage?: string;
  lineTotal: number;
}

export interface RecentOrder {
  id: string;
  orderId: string;
  customerName: string;
  grandTotal: number;
  itemCount: number;
  status: 'Pending' | 'Confirmed' | 'Baking' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  paymentStatus: 'Unpaid' | 'Pending' | 'Paid';
  createdAt: string;
}

export interface RecentInquiry {
  id: string;
  referenceId: string;
  customerName: string;
  occasion: string;
  flavor: string;
  weight: string;
  estimatedPrice: number;
  status: 'pending' | 'reviewed' | 'quoted' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface AdminDashboardStats {
  orders: {
    total: number;
    byStatus: {
      Pending: number;
      Confirmed: number;
      Baking: number;
      'Out for Delivery': number;
      Delivered: number;
      Cancelled: number;
    };
    recentOrders: RecentOrder[];
  };
  revenue: {
    total: number;
    delivered: number;
    inProgress: number;
    pending: number;
    currency: string;
    eligibleOrdersCount: number;
    eligibleCriteria: string;
  };
  catalog: {
    totalCakes: number;
    availableCakes: number;
    totalCategories: number;
  };
  inquiries: {
    total: number;
    pendingCount: number;
    byStatus: {
      pending: number;
      reviewed: number;
      quoted: number;
      confirmed: number;
      cancelled: number;
    };
    recentInquiries: RecentInquiry[];
  };
  security: {
    adminUsername: string;
    adminRole: string;
    isDefaultCredentials: boolean;
    warningMessage?: string;
  };
}

export interface AdminCustomer {
  name: string;
  phone: string;
  email: string;
  address: string;
}

export interface AdminOrderItem {
  cakeId: string;
  cakeName: string;
  selectedWeight: string;
  unitPrice: number;
  quantity: number;
  customMessage?: string;
  lineTotal: number;
}

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Baking'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export type PaymentStatus = 'Unpaid' | 'Pending' | 'Paid';

export interface AdminOrder {
  _id: string;
  id?: string;
  orderId: string;
  customer: AdminCustomer;
  items: AdminOrderItem[];
  subtotal: number;
  discountAmount: number;
  couponCode?: string;
  deliveryFee: number;
  grandTotal: number;
  deliveryNotes?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrdersPagination {
  page: number;
  limit: number;
  totalOrders: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AdminOrdersResponse {
  success: boolean;
  pagination: AdminOrdersPagination;
  data: AdminOrder[];
}

export interface AdminOrderQuery {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sortBy?: 'newest' | 'oldest' | 'amount-desc' | 'amount-asc';
}

export interface UpdateOrderStatusPayload {
  status: OrderStatus;
  note?: string;
}

export interface UpdateOrderStatusResponse {
  success: boolean;
  message: string;
  data: AdminOrder;
}

export interface AdminCake {
  _id?: string;
  id: string;
  name: string;
  slug: string;
  category: string;
  basePrice: number;
  weightPrices: {
    '0.5 kg': number;
    '1 kg': number;
    '1.5 kg': number;
    '2 kg': number;
  };
  isEggless: boolean;
  image: string;
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
  isAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCategory {
  _id?: string;
  id: string;
  name: string;
  slug: string;
  tagline: string;
  image: string;
  itemCount: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCakesResponse {
  success: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  data: AdminCake[];
}

export interface AdminCakeQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  isAvailable?: 'all' | 'true' | 'false';
  sortBy?: 'newest' | 'oldest' | 'price-low' | 'price-high' | 'name-asc' | 'name-desc' | 'rating';
}

export interface CreateCakePayload {
  name: string;
  slug?: string;
  category: string;
  basePrice: number;
  weightPrices: {
    '0.5 kg': number;
    '1 kg': number;
    '1.5 kg': number;
    '2 kg': number;
  };
  isEggless: boolean;
  image: string;
  secondaryImages?: string[];
  description: string;
  flavor: string;
  ingredients: string[];
  isBestSeller?: boolean;
  isFeatured?: boolean;
  preparationTimeHours?: number;
  dietaryTags?: string[];
  isAvailable?: boolean;
}

export type UpdateCakePayload = Partial<CreateCakePayload>;

export interface CreateCategoryPayload {
  name: string;
  slug?: string;
  tagline: string;
  image: string;
  isActive?: boolean;
}

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export const adminService = {
  /**
   * Admin Login with username/email and password
   */
  async login(usernameOrEmail: string, password: string): Promise<AdminLoginResponse> {
    const res = await api.post<AdminLoginResponse>('auth/login', {
      usernameOrEmail,
      password,
    });

    if (res.token) {
      authStorage.setToken(res.token);
    }

    return res;
  },

  /**
   * Verify active administrative session
   */
  async getMe(): Promise<AdminMeResponse> {
    return api.get<AdminMeResponse>('auth/me');
  },

  /**
   * Admin Logout
   */
  async logout(): Promise<void> {
    try {
      await api.post('auth/logout');
    } finally {
      authStorage.clearToken();
    }
  },

  /**
   * Fetch aggregate statistics for the dashboard
   */
  async getDashboardStats(): Promise<{ success: boolean; stats: AdminDashboardStats; timestamp: string }> {
    return api.get<{ success: boolean; stats: AdminDashboardStats; timestamp: string }>('admin/stats');
  },

  /**
   * Fetch paginated list of orders with optional status filter, search query, and sorting
   */
  async getOrders(params: AdminOrderQuery = {}): Promise<AdminOrdersResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', String(params.page));
    if (params.limit) searchParams.append('limit', String(params.limit));
    if (params.status && params.status !== 'All') searchParams.append('status', params.status);
    if (params.search) searchParams.append('search', params.search);
    if (params.sortBy) searchParams.append('sortBy', params.sortBy);

    const qs = searchParams.toString();
    const endpoint = qs ? `admin/orders?${qs}` : 'admin/orders';
    return api.get<AdminOrdersResponse>(endpoint);
  },

  /**
   * Fetch single order by Mongo ID or orderId reference
   */
  async getOrderById(id: string): Promise<{ success: boolean; data: AdminOrder }> {
    return api.get<{ success: boolean; data: AdminOrder }>(`admin/orders/${encodeURIComponent(id)}`);
  },

  /**
   * Transition order fulfillment status
   */
  async updateOrderStatus(
    id: string,
    status: OrderStatus,
    note?: string
  ): Promise<UpdateOrderStatusResponse> {
    return api.patch<UpdateOrderStatusResponse>(`admin/orders/${encodeURIComponent(id)}/status`, {
      status,
      note,
    });
  },

  /**
   * ========================================================
   * CAKE CATALOG CRUD
   * ========================================================
   */
  async getCakes(params: AdminCakeQuery = {}): Promise<AdminCakesResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', String(params.page));
    if (params.limit) searchParams.append('limit', String(params.limit));
    if (params.search) searchParams.append('search', params.search);
    if (params.category && params.category !== 'All') searchParams.append('category', params.category);
    if (params.isAvailable && params.isAvailable !== 'all') searchParams.append('isAvailable', params.isAvailable);
    if (params.sortBy) searchParams.append('sortBy', params.sortBy);

    const qs = searchParams.toString();
    const endpoint = qs ? `admin/cakes?${qs}` : 'admin/cakes';
    return api.get<AdminCakesResponse>(endpoint);
  },

  async getCakeById(id: string): Promise<{ success: boolean; data: AdminCake }> {
    return api.get<{ success: boolean; data: AdminCake }>(`admin/cakes/${encodeURIComponent(id)}`);
  },

  async createCake(payload: CreateCakePayload): Promise<{ success: boolean; message: string; data: AdminCake }> {
    return api.post<{ success: boolean; message: string; data: AdminCake }>('admin/cakes', payload);
  },

  async updateCake(id: string, payload: UpdateCakePayload): Promise<{ success: boolean; message: string; data: AdminCake }> {
    return api.put<{ success: boolean; message: string; data: AdminCake }>(`admin/cakes/${encodeURIComponent(id)}`, payload);
  },

  async toggleCakeAvailability(id: string, isAvailable: boolean): Promise<{ success: boolean; message: string; data: AdminCake }> {
    return api.patch<{ success: boolean; message: string; data: AdminCake }>(`admin/cakes/${encodeURIComponent(id)}/availability`, {
      isAvailable,
    });
  },

  async deleteCake(id: string): Promise<{ success: boolean; isSoftDeleted?: boolean; message: string }> {
    return api.delete<{ success: boolean; isSoftDeleted?: boolean; message: string }>(`admin/cakes/${encodeURIComponent(id)}`);
  },

  /**
   * ========================================================
   * CATEGORY MANAGEMENT CRUD
   * ========================================================
   */
  async getCategories(params: { search?: string; isActive?: 'all' | 'true' | 'false' } = {}): Promise<{ success: boolean; data: AdminCategory[] }> {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.append('search', params.search);
    if (params.isActive && params.isActive !== 'all') searchParams.append('isActive', params.isActive);

    const qs = searchParams.toString();
    const endpoint = qs ? `admin/categories?${qs}` : 'admin/categories';
    return api.get<{ success: boolean; data: AdminCategory[] }>(endpoint);
  },

  async getCategoryById(id: string): Promise<{ success: boolean; data: AdminCategory }> {
    return api.get<{ success: boolean; data: AdminCategory }>(`admin/categories/${encodeURIComponent(id)}`);
  },

  async createCategory(payload: CreateCategoryPayload): Promise<{ success: boolean; message: string; data: AdminCategory }> {
    return api.post<{ success: boolean; message: string; data: AdminCategory }>('admin/categories', payload);
  },

  async updateCategory(id: string, payload: UpdateCategoryPayload): Promise<{ success: boolean; message: string; data: AdminCategory }> {
    return api.put<{ success: boolean; message: string; data: AdminCategory }>(`admin/categories/${encodeURIComponent(id)}`, payload);
  },

  async deleteCategory(id: string): Promise<{ success: boolean; message: string; referencingCakesCount?: number }> {
    return api.delete<{ success: boolean; message: string; referencingCakesCount?: number }>(`admin/categories/${encodeURIComponent(id)}`);
  },

  /**
   * ========================================================
   * IMAGE UPLOAD
   * ========================================================
   */
  async uploadImage(file: File): Promise<{ success: boolean; url: string; publicId: string; message: string }> {
    const formData = new FormData();
    formData.append('image', file);
    return api.post<{ success: boolean; url: string; publicId: string; message: string }>('admin/upload', formData);
  },

  /**
   * ========================================================
   * CUSTOM CAKE INQUIRIES MANAGEMENT
   * ========================================================
   */
  async getInquiries(params: AdminInquiryQueryParams = {}): Promise<AdminInquiriesListResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', String(params.page));
    if (params.limit) searchParams.append('limit', String(params.limit));
    if (params.search) searchParams.append('search', params.search);
    if (params.status && params.status !== 'all') searchParams.append('status', params.status);
    if (params.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder);

    const qs = searchParams.toString();
    const endpoint = qs ? `admin/inquiries?${qs}` : 'admin/inquiries';
    return api.get<AdminInquiriesListResponse>(endpoint);
  },

  async getInquiryById(id: string): Promise<{ success: boolean; data: AdminInquiry }> {
    return api.get<{ success: boolean; data: AdminInquiry }>(`admin/inquiries/${encodeURIComponent(id)}`);
  },

  async updateInquiryStatus(
    id: string,
    payload: UpdateInquiryStatusPayload
  ): Promise<{ success: boolean; message: string; data: AdminInquiry }> {
    return api.patch<{ success: boolean; message: string; data: AdminInquiry }>(
      `admin/inquiries/${encodeURIComponent(id)}/status`,
      payload
    );
  },

  /**
   * ========================================================
   * NOTIFICATION AUDIT LOGS
   * ========================================================
   */
  async getNotifications(params: AdminNotificationQueryParams = {}): Promise<AdminNotificationsListResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', String(params.page));
    if (params.limit) searchParams.append('limit', String(params.limit));
    if (params.search) searchParams.append('search', params.search);
    if (params.channel && params.channel !== 'all') searchParams.append('channel', params.channel);
    if (params.eventType && params.eventType !== 'all') searchParams.append('eventType', params.eventType);
    if (params.deliveryStatus && params.deliveryStatus !== 'all') searchParams.append('deliveryStatus', params.deliveryStatus);

    const qs = searchParams.toString();
    const endpoint = qs ? `admin/notifications?${qs}` : 'admin/notifications';
    return api.get<AdminNotificationsListResponse>(endpoint);
  },

  /**
   * Retry an eligible failed notification
   */
  async retryNotification(
    id: string
  ): Promise<{ success: boolean; message: string; data?: AdminNotificationLog; error?: string }> {
    return api.post<{ success: boolean; message: string; data?: AdminNotificationLog; error?: string }>(
      `admin/notifications/${encodeURIComponent(id)}/retry`,
      {}
    );
  },
};

export interface AdminInquiry {
  id: string;
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
  quotedAmount?: number;
  quoteCurrency?: string;
  quoteValidityDays?: number;
  quoteValidUntil?: string;
  quoteNotes?: string;
  internalNotes?: string;
  reviewedAt?: string;
  quotedAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminInquiryQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'all' | 'pending' | 'reviewed' | 'quoted' | 'confirmed' | 'cancelled';
  sortBy?: 'createdAt' | 'preferredDate' | 'estimatedPrice' | 'customerName' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateInquiryStatusPayload {
  status: 'pending' | 'reviewed' | 'quoted' | 'confirmed' | 'cancelled';
  quotedAmount?: number;
  quoteCurrency?: string;
  quoteValidityDays?: number;
  quoteNotes?: string;
  internalNotes?: string;
}

export interface AdminInquiriesListResponse {
  success: boolean;
  data: AdminInquiry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminNotificationLog {
  id: string;
  notificationId: string;
  idempotencyKey: string;
  channel: 'email' | 'whatsapp' | 'sms';
  eventType: 'order_placed' | 'order_status_updated' | 'inquiry_quotation_sent';
  recipient: string;
  provider: string;
  deliveryStatus: 'pending' | 'sending' | 'delivered' | 'failed' | 'skipped';
  attempts: number;
  maxAttempts: number;
  subject?: string;
  messagePreview?: string;
  metadata?: Record<string, any>;
  sanitizedError?: string;
  queuedAt?: string;
  sentAt?: string;
  failedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminNotificationQueryParams {
  page?: number;
  limit?: number;
  channel?: 'all' | 'email' | 'whatsapp' | 'sms';
  eventType?: 'all' | 'order_placed' | 'order_status_updated' | 'inquiry_quotation_sent';
  deliveryStatus?: 'all' | 'pending' | 'sending' | 'delivered' | 'failed' | 'skipped';
  search?: string;
}

export interface AdminNotificationsListResponse {
  success: boolean;
  data: AdminNotificationLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
