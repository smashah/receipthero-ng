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

    return response.json();
}

export interface WorkerStatus {
    success: boolean;
    isPaused: boolean;
    pausedAt: string | null;
    pauseReason: string | null;
    message?: string;
}

export interface ScanResult {
    documentsFound: number;
    documentsQueued: number;
    documentsSkipped: number;
    timestamp: string;
}

export interface TriggerScanResponse {
    success: boolean;
    message: string;
    consumed: boolean;
    durationMs: number;
    scanResult: ScanResult | null;
}

/**
 * Get current worker status - proxies to GET /api/worker/status
 */
export const getWorkerStatus = createServerFn({ method: 'GET' }).handler(async () => {
    return apiCall<WorkerStatus>('/api/worker/status');
});

/**
 * Pause the worker - proxies to POST /api/worker/pause
 */
export const pauseWorker = createServerFn({ method: 'POST' })
    .inputValidator((input: { reason?: string }) => input)
    .handler((async ({ data }: any) => {
        return apiCall<WorkerStatus>('/api/worker/pause', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }) as any) as (opts: { data: { reason?: string } }) => Promise<WorkerStatus>;

/**
 * Resume the worker - proxies to POST /api/worker/resume
 */
export const resumeWorker = createServerFn({ method: 'POST' }).handler(async () => {
    return apiCall<WorkerStatus>('/api/worker/resume', {
        method: 'POST',
    });
});

/**
 * Trigger scan and wait - proxies to POST /api/worker/scan
 */
export const triggerScanAndWait = createServerFn({ method: 'POST' }).handler(async () => {
    return apiCall<TriggerScanResponse>('/api/worker/scan', {
        method: 'POST',
    });
});
