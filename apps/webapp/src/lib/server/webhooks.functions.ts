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

export interface WebhookQueueStats {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
}

export interface WebhookStatusResponse {
    enabled: boolean;
    hasSecret: boolean;
    queue: WebhookQueueStats;
}

/**
 * Get webhook status - proxies to GET /api/webhooks/status
 */
export const getWebhookStatus = createServerFn({ method: 'GET' }).handler(async (): Promise<WebhookStatusResponse> => {
    return apiCall<WebhookStatusResponse>('/api/webhooks/status');
});
