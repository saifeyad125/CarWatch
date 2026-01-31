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
  },
  
  // Prediction endpoints
  predictions: {
    predict: `${API_BASE_URL}/api/predictions/predict`,
    uncertainty: `${API_BASE_URL}/api/predictions/uncertainty`,
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
