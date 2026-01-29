import type { Config } from '@sm-rn/shared/schemas';

// API base URL - defaults to localhost:3001 for development
export const API_BASE_URL =
  typeof window !== 'undefined' && import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    paperlessConnection: 'ok' | 'error';
    togetherAiConnection: 'ok' | 'error';
    config: 'ok' | 'error';
  };
  errors?: string[];
}

export interface ApiError {
  error: string;
}

export interface SaveConfigResponse {
  success: boolean;
  message: string;
}

export interface TestConnectionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Re-export Config type for convenience
export type { Config };

// ─────────────────────────────────────────────────────────────────────────────
// Query Key Factories
// ─────────────────────────────────────────────────────────────────────────────

export const healthKeys = {
  all: ['health'] as const,
  status: () => [...healthKeys.all, 'status'] as const,
};

export const configKeys = {
  all: ['config'] as const,
  current: () => [...configKeys.all, 'current'] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// API Fetch Wrapper
// ─────────────────────────────────────────────────────────────────────────────

export class FetchError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: ApiError
  ) {
    super(data?.error || `${status} ${statusText}`);
    this.name = 'FetchError';
  }
}

export interface FetchOptions extends RequestInit {
  /** Skip JSON parsing for non-JSON responses */
  raw?: boolean;
}

/**
 * Fetch wrapper with automatic JSON handling and error extraction.
 *
 * @param path - API path (e.g., '/api/health')
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws FetchError on non-2xx responses
 */
export async function fetchApi<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { raw, ...fetchOptions } = options;

  const url = `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });

  // Handle non-2xx responses
  if (!response.ok) {
    let errorData: ApiError | undefined;
    try {
      errorData = await response.json();
    } catch {
      // Response body wasn't JSON
    }
    throw new FetchError(response.status, response.statusText, errorData);
  }

  // Return raw response if requested
  if (raw) {
    return response as unknown as T;
  }

  // Parse JSON response
  return response.json();
}
