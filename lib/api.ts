/**
 * API Configuration
 * Single source of truth for all API calls
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  // Car endpoints
  cars: {
    list: `${API_BASE_URL}/api/cars`,
    detail: (id: number) => `${API_BASE_URL}/api/cars/${id}`,
    brands: `${API_BASE_URL}/api/cars/brands`,
    models: (brand: string) => `${API_BASE_URL}/api/cars/brands/${encodeURIComponent(brand)}/models`,
  },
  
  // Prediction endpoints
  predictions: {
    predict: `${API_BASE_URL}/api/predictions/predict`,
    uncertainty: `${API_BASE_URL}/api/predictions/uncertainty`,
  },
  
  // Watchlist endpoints
  watchlists: {
    list: `${API_BASE_URL}/api/watchlists`,
    create: `${API_BASE_URL}/api/watchlists`,
    detail: (id: number) => `${API_BASE_URL}/api/watchlists/${id}`,
    setStatus: (id: number) => `${API_BASE_URL}/api/watchlists/${id}/status`,
    matches: (id: number, sort?: string) => 
      `${API_BASE_URL}/api/watchlists/${id}/matches${sort ? `?sort=${sort}` : ''}`,
    scan: (id: number) => `${API_BASE_URL}/api/watchlists/${id}/scan`,
  },
  
  // Health check
  health: `${API_BASE_URL}/api/health`,
} as const;

/**
 * Fetch wrapper with error handling
 */
export async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}
