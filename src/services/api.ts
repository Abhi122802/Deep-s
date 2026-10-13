/**
 * API Client Configuration for Deep's Cake Shop
 * Connects directly to the Node.js + Express + MongoDB backend
 * via configurable VITE_API_BASE_URL.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export class ApiError extends Error {
  statusCode: number;
  errors?: any[];

  constructor(message: string, statusCode: number, errors?: any[]) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export const authStorage = {
  getToken: (): string | null => {
    try {
      return localStorage.getItem('deeps_admin_token');
    } catch {
      return null;
    }
  },
  setToken: (token: string): void => {
    try {
      localStorage.setItem('deeps_admin_token', token);
    } catch {
      // Ignore storage errors in private browsing
    }
  },
  clearToken: (): void => {
    try {
      localStorage.removeItem('deeps_admin_token');
    } catch {
      // Ignore storage errors
    }
  },
};

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 8000, headers, ...customConfig } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  const defaultHeaders: Record<string, string> = {
    Accept: 'application/json',
  };

  const storedToken = authStorage.getToken();
  if (storedToken) {
    defaultHeaders['Authorization'] = `Bearer ${storedToken}`;
  }

  if (!(customConfig.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    credentials: 'include', // Transmit HttpOnly cookies across origins where supported
    ...customConfig,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    signal: controller.signal,
  };

  try {
    const response = await fetch(url, config);
    clearTimeout(id);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.message || `HTTP Request failed with status ${response.status}`;
      throw new ApiError(message, response.status, data?.errors);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(id);
    if (err instanceof ApiError) {
      throw err;
    }
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your backend connection.', 408);
    }
    throw new ApiError(
      err.message || 'Network error occurred while communicating with the bakery API.',
      0
    );
  }
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { method: 'GET', ...options }),

  post: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),

  put: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),

  patch: <T>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { method: 'DELETE', ...options }),
};

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res: any = await api.get('health', { timeoutMs: 2500 });
    return res?.status === 'ok';
  } catch {
    return false;
  }
}
