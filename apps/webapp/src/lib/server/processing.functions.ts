/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from '@tanstack/react-start';
import type { ProcessingLog, LogEntry } from '@sm-rn/shared/types';

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

export interface RetryDocumentResponse {
    success: boolean;
    message: string;
    error?: string;
}

// Re-export the type for convenience
export type { ProcessingLog };

/**
 * Get recent processing logs - proxies to GET /api/events
 */
export const getProcessingLogs = createServerFn({ method: 'GET' }).handler(async () => {
    return apiCall<ProcessingLog[]>('/api/events');
});

/**
 * Get logs for a specific document - proxies to GET /api/events/logs/document/:id
 */
export const getDocumentLogs = createServerFn({ method: 'GET' })
    .inputValidator((input: { documentId: number }) => input)
    .handler((async ({ data }: any) => {
        return apiCall<LogEntry[]>(`/api/events/logs/document/${data.documentId}`);
    }) as any) as (opts: { data: { documentId: number } }) => Promise<LogEntry[]>;

/**
 * Get app logs - proxies to GET /api/events/logs
 */
export const getAppLogs = createServerFn({ method: 'GET' })
    .inputValidator((input: { source?: string }) => input)
    .handler((async ({ data }: any) => {
        const queryParam = data?.source ? `?source=${data.source}` : '';
        return apiCall<LogEntry[]>(`/api/events/logs${queryParam}`);
    }) as any) as (opts: { data: { source?: string } }) => Promise<LogEntry[]>;

/**
 * Retry document processing - proxies to POST /api/processing/:id/retry
 */
export const retryDocument = createServerFn({ method: 'POST' })
    .inputValidator((input: { id: number; strategy: 'full' | 'partial' }) => input)
    .handler((async ({ data }: any) => {
        return apiCall<RetryDocumentResponse>(`/api/processing/${data.id}/retry`, {
            method: 'POST',
            body: JSON.stringify({ strategy: data.strategy }),
        });
    }) as any) as (opts: { data: { id: number; strategy: 'full' | 'partial' } }) => Promise<RetryDocumentResponse>;
