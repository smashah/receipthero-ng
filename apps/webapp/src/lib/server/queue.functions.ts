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

export interface QueueItem {
    documentId: number;
    attempts: number;
    lastError: string;
    nextRetryAt: string;
}

export interface QueueStatus {
    success: boolean;
    queue: {
        size: number;
        items: QueueItem[];
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

/**
 * Get queue status - proxies to GET /api/queue
 */
export const getQueueStatus = createServerFn({ method: 'GET' }).handler(async (): Promise<QueueStatus> => {
    return apiCall<QueueStatus>('/api/queue');
});

/**
 * Retry all queue items - proxies to POST /api/queue/retry-all
 */
export const retryAllQueue = createServerFn({ method: 'POST' }).handler(async (): Promise<QueueActionResponse> => {
    return apiCall<QueueActionResponse>('/api/queue/retry-all', {
        method: 'POST',
    });
});

/**
 * Clear queue - proxies to POST /api/queue/clear
 */
export const clearQueue = createServerFn({ method: 'POST' }).handler(async (): Promise<QueueActionResponse> => {
    return apiCall<QueueActionResponse>('/api/queue/clear', {
        method: 'POST',
    });
});

/**
 * Get skipped documents - proxies to GET /api/queue/skipped
 */
export const getSkippedDocuments = createServerFn({ method: 'GET' }).handler(async () => {
    return apiCall<{ success: boolean; count: number; items: any[] }>('/api/queue/skipped');
});

/**
 * Clear skipped documents - proxies to POST /api/queue/skipped/clear
 */
export const clearSkippedDocuments = createServerFn({ method: 'POST' }).handler(async (): Promise<QueueActionResponse> => {
    return apiCall<QueueActionResponse>('/api/queue/skipped/clear', {
        method: 'POST',
    });
});
