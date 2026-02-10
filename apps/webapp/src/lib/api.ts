import type { Config } from '@sm-rn/shared/schemas';
import type { ProcessingLog, ProcessingEvent } from '@sm-rn/shared/types';

// API base URL - defaults to localhost:3001 for development
export const API_BASE_URL =
  typeof window !== 'undefined' && import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : 'http://localhost:3001';

// WS base URL
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    paperlessConnection: 'ok' | 'error';
    aiConnection: 'ok' | 'error';
    config: 'ok' | 'error';
  };
  worker?: {
    isPaused: boolean;
    pausedAt: string | null;
    pauseReason: string | null;
  };
  stats?: {
    detected: number;
    processed: number;
    failed: number;
    skipped: number;
    inQueue: number;
  };
  errors?: string[];
}

export interface WorkerStatus {
  success: boolean;
  isPaused: boolean;
  pausedAt: string | null;
  pauseReason: string | null;
  message?: string;
}

export interface QueueStatus {
  success: boolean;
  queue: {
    size: number;
    items: Array<{
      documentId: number;
      attempts: number;
      lastError: string;
      nextRetryAt: string;
    }>;
  };
  skipped: {
    count: number;
  };
}

export interface QueueActionResponse {
  success: boolean;
  message: string;
  count: number;
}

export interface ApiError {
  error: string;
}

export interface ZodIssue {
  code: string;
  path: (string | number)[];
  message: string;
  expected?: string;
  received?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    name: string;
    message: string;
    issues?: ZodIssue[];
  };
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

// Re-export shared types for convenience
export type { Config, ProcessingLog, ProcessingEvent };
export type { LogEntry, AppEvent } from '@sm-rn/shared/types';

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

export const workerKeys = {
  all: ['worker'] as const,
  status: () => [...workerKeys.all, 'status'] as const,
};

export const queueKeys = {
  all: ['queue'] as const,
  status: () => [...queueKeys.all, 'status'] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// API Fetch Wrapper
// ─────────────────────────────────────────────────────────────────────────────

export class FetchError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: ApiErrorResponse | ApiError
  ) {
    const message = FetchError.extractMessage(data) || `${status} ${statusText}`;
    super(message);
    this.name = 'FetchError';
  }

  private static extractMessage(data: ApiErrorResponse | ApiError | undefined): string | undefined {
    if (!data) return undefined;
    if ('error' in data && typeof data.error === 'object') {
      const { message } = data.error;
      // If message is a stringified JSON array (common for Zod errors in some frameworks)
      if (typeof message === 'string' && message.startsWith('[') && message.endsWith(']')) {
        try {
          const parsed = JSON.parse(message);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].message) {
            return parsed[0].message;
          }
        } catch {
          // Fallback to original message
        }
      }
      return message;
    }
    if ('error' in data && typeof data.error === 'string') {
      return data.error;
    }
    return undefined;
  }

  get validationIssues(): ZodIssue[] | undefined {
    if (this.data && 'error' in this.data && typeof this.data.error === 'object') {
      const { issues, message } = this.data.error;
      if (issues) return issues;

      // Try to parse issues from message string
      if (typeof message === 'string' && message.startsWith('[') && message.endsWith(']')) {
        try {
          const parsed = JSON.parse(message);
          if (Array.isArray(parsed)) return parsed as ZodIssue[];
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  get isValidationError(): boolean {
    if (this.data && 'error' in this.data && typeof this.data.error === 'object') {
      return ['ValidationError', 'ZodError'].includes(this.data.error.name);
    }
    return false;
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
