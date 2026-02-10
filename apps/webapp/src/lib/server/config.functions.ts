/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from '@tanstack/react-start';
import type { Config } from '@sm-rn/shared/schemas';

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

export interface SaveConfigResponse {
    success: boolean;
    message: string;
    error?: {
        name: string;
        message: string;
        issues?: unknown[];
    };
}

/**
 * Get current configuration with masked API keys - proxies to GET /api/config
 */
export const getConfig = createServerFn({ method: 'GET' }).handler(async () => {
    return apiCall<Config>('/api/config');
});

/**
 * Save configuration (partial update) - proxies to PATCH /api/config
 * Note: Type assertion used due to TanStack Start typing limitations with complex input validators.
 */
export const saveConfig = createServerFn({ method: 'POST' })
    .inputValidator((input: Partial<Config>) => input)
    .handler((async ({ data }: any) => {
        return apiCall<SaveConfigResponse>('/api/config', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }) as any) as (opts: { data: Partial<Config> }) => Promise<SaveConfigResponse>;

export interface CurrencyInfo {
    code: string;
    name: string;
    symbol: string;
}

export interface CurrenciesResponse {
    success: boolean;
    currencies: CurrencyInfo[];
}

/**
 * Get available currencies - proxies to GET /api/config/currencies
 */
export const getAvailableCurrencies = createServerFn({ method: 'GET' }).handler(async () => {
    return apiCall<CurrenciesResponse>('/api/config/currencies');
});
