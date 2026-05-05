import { supabase } from '@/lib/supabase/client';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  // Car endpoints
  cars: {
    list: `${API_BASE_URL}/api/cars`,
    detail: (id: number) => `${API_BASE_URL}/api/cars/${id}`,
    analysis: (id: number) => `${API_BASE_URL}/api/cars/${id}/analysis`,
    brands: `${API_BASE_URL}/api/cars/brands`,
    models: (brand: string) => `${API_BASE_URL}/api/cars/brands/${encodeURIComponent(brand)}/models`,
    trims: (brand: string, model: string) => `${API_BASE_URL}/api/cars/brands/${encodeURIComponent(brand)}/models/${encodeURIComponent(model)}/trims`,
  },
  
  // Prediction endpoints
  predictions: {
    predict: `${API_BASE_URL}/api/predictions/predict`,
    uncertainty: `${API_BASE_URL}/api/predictions/uncertainty`,
    forecast: `${API_BASE_URL}/api/predictions/forecast`,
  },
  
  // Watchlist endpoints
  watchlists: {
    list: `${API_BASE_URL}/api/watchlists`,
    create: `${API_BASE_URL}/api/watchlists`,
    detail: (id: number) => `${API_BASE_URL}/api/watchlists/${id}`,
    delete: (id: number) => `${API_BASE_URL}/api/watchlists/${id}`,
    setStatus: (id: number) => `${API_BASE_URL}/api/watchlists/${id}/status`,
    matches: (id: number, sort?: string) => 
      `${API_BASE_URL}/api/watchlists/${id}/matches${sort ? `?sort=${sort}` : ''}`,
    scan: (id: number) => `${API_BASE_URL}/api/watchlists/${id}/scan`,
  },
  
  // Notifications
  notifications: {
    list: `${API_BASE_URL}/api/notifications`,
    unreadCount: `${API_BASE_URL}/api/notifications/unread-count`,
    markRead: (id: number) => `${API_BASE_URL}/api/notifications/${id}/read`,
    markAllRead: `${API_BASE_URL}/api/notifications/read-all`,
  },

  // Profile
  profile: `${API_BASE_URL}/api/profile`,

  // Chat
  chat: {
    conversations: `${API_BASE_URL}/api/chat/conversations`,
    conversation: (id: number) => `${API_BASE_URL}/api/chat/conversations/${id}`,
    messages: (id: number) => `${API_BASE_URL}/api/chat/conversations/${id}/messages`,
  },

  // Dealers
  dealers: {
    list: `${API_BASE_URL}/api/dealers`,
    detail: (id: number) => `${API_BASE_URL}/api/dealers/${id}`,
  },

  // Dealer Cars
  dealerCars: {
    list: `${API_BASE_URL}/api/dealer-cars`,
    detail: (id: number) => `${API_BASE_URL}/api/dealer-cars/${id}`,
    brands: `${API_BASE_URL}/api/dealer-cars/brands`,
    models: (brand: string) => `${API_BASE_URL}/api/dealer-cars/brands/${encodeURIComponent(brand)}/models`,
    trims: (brand: string, model: string) => `${API_BASE_URL}/api/dealer-cars/brands/${encodeURIComponent(brand)}/models/${encodeURIComponent(model)}/trims`,
  },

  // Parts
  parts: {
    list: `${API_BASE_URL}/api/parts`,
    detail: (id: number) => `${API_BASE_URL}/api/parts/${id}`,
    categories: `${API_BASE_URL}/api/parts/categories`,
    category: (id: number) => `${API_BASE_URL}/api/parts/categories/${id}`,
    compatible: (brand: string, model: string) => `${API_BASE_URL}/api/parts/compatible/${encodeURIComponent(brand)}/${encodeURIComponent(model)}`,
  },

  // Browse Hub
  browse: {
    counts: `${API_BASE_URL}/api/browse/counts`,
    search: `${API_BASE_URL}/api/browse/search`,
  },

  // Health check
  health: `${API_BASE_URL}/api/health`,
} as const;


// Fetch wrapper with error handling
export async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    // Get current session token
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as T;
    }

    return await response.json();
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}
