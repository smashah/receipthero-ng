/* eslint-disable @typescript-eslint/no-explicit-any */
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

    const data = await response.json();
    return data;
}

export interface TestConnectionResponse {
    success: boolean;
    message?: string;
    error?: string;
}

/**
 * Test Paperless connection - proxies to POST /api/config/test-paperless
 */
export const testPaperlessConnection = createServerFn({ method: 'POST' })
    .inputValidator((data: { host: string; apiKey: string }) => data)
    .handler((async ({ data }: any) => {
        return apiCall<TestConnectionResponse>('/api/config/test-paperless', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }))

/**
 * Test Together AI connection - proxies to POST /api/config/test-together
 */
export const testTogetherConnection = createServerFn({ method: 'POST' })
    .inputValidator((data: { apiKey: string }) => data)
    .handler((async ({ data }: any) => {
        return apiCall<TestConnectionResponse>('/api/config/test-together', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }));
