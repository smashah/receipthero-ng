import { createServerFn } from '@tanstack/react-start';

// API base URL - in production this would be internal, in dev it's localhost
const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';

/**
 * Internal fetch wrapper for calling the API from server functions.
 */
async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${path}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || error.message || `API error: ${response.status}`);
    }

    return response.json();
}

export interface HealthStatus {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    checks: {
        paperlessConnection: 'ok' | 'error';
        togetherAiConnection: 'ok' | 'error';
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

/**
 * Get system health status - proxies to /api/health
 */
export const getHealthStatus = createServerFn({ method: 'GET' }).handler(async (): Promise<HealthStatus> => {
    return apiCall<HealthStatus>('/api/health');
});
