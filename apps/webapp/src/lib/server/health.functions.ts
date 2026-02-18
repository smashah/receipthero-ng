import { createServerFn } from '@tanstack/react-start';

// API base URL - in production this would be internal, in dev it's localhost
const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';


export interface HealthStatus {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    configComplete: boolean;
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

/**
 * Get system health status - proxies to /api/health
 * NOTE: We intentionally do NOT use apiCall here because the health
 * endpoint returns 503 with valid JSON on unhealthy states (e.g. missing
 * config). We need that JSON body so the webapp can detect configComplete
 * and redirect to settings.
 */
export const getHealthStatus = createServerFn({ method: 'GET' }).handler(async (): Promise<HealthStatus> => {
    const url = `${API_BASE_URL}/api/health`;
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
    });

    // Parse JSON for both 200 and 503 responses
    const data = await response.json() as HealthStatus;

    // Only throw for truly unexpected errors (network failure, 500, etc.)
    if (!response.ok && response.status !== 503) {
        throw new Error(`API error: ${response.status}`);
    }

    return data;
});
