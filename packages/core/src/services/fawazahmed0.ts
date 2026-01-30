/**
 * Fallback Currency Exchange API Service (fawazahmed0/exchange-api)
 *
 * Alternative currency conversion service using the free fawazahmed0 exchange-api.
 * Features:
 * - 200+ currencies including cryptocurrencies and metals
 * - No rate limits
 * - Daily updated rates
 * - Dual CDN fallback (jsdelivr → pages.dev)
 *
 * @see https://github.com/fawazahmed0/exchange-api
 */

import { createLogger } from './logger';

const logger = createLogger('core');

// Primary CDN: cdn.jsdelivr.net, Fallback: currency-api.pages.dev
const API_PRIMARY = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api';
const API_SECONDARY = 'https://{date}.currency-api.pages.dev';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ExchangeRate {
    currency: string;
    date: string;
    rate: number;
}

interface WeeklyRates {
    currency: string;
    rates: ExchangeRate[];
    average: number;
}

export interface CurrencyConversionResult {
    originalAmount: number;
    originalCurrency: string;
    conversions: Record<string, number>;
    weekStart: string;
    weekEnd: string;
    ratesUsed: Record<string, number>;
}

interface FallbackRateResponse {
    date: string;
    [currency: string]: string | Record<string, number>;
}

// Cache for available currencies
let cachedCurrencies: string[] | null = null;
let currencyCacheTime: number = 0;
const CURRENCY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ─────────────────────────────────────────────────────────────────────────────
// API Fetching with Fallback
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches data from the currency API with automatic fallback.
 * Tries primary CDN first (jsdelivr), falls back to pages.dev.
 *
 * @param endpoint The API endpoint (e.g., 'currencies/eur.min.json')
 * @param date Date in YYYY-MM-DD format, or 'latest'
 * @returns Parsed JSON response, or null if all attempts fail
 */
async function fetchWithFallback<T>(endpoint: string, date: string = 'latest'): Promise<T | null> {
    const dateParam = date === 'latest' ? 'latest' : date;

    // Try primary CDN first
    const primaryUrl = `${API_PRIMARY}@${dateParam}/v1/${endpoint}`;
    // Fallback URL uses date subdomain
    const secondaryUrl = `${API_SECONDARY.replace('{date}', dateParam)}/v1/${endpoint}`;

    for (const url of [primaryUrl, secondaryUrl]) {
        try {
            logger.debug('Fetching from fawazahmed0 currency API', { url });

            const response = await fetch(url, {
                headers: { Accept: 'application/json' },
            });

            if (!response.ok) {
                logger.debug('Currency API returned non-OK status', { url, status: response.status });
                continue;
            }

            const data = await response.json() as T;

            logger.debug('Successfully fetched from currency API', { url });
            return data;
        } catch (error) {
            logger.debug('Currency API fetch failed', {
                url,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    logger.warn('All currency API attempts failed');
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Currency List
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the list of all available currencies.
 * Results are cached for 24 hours.
 */
export async function getAvailableCurrencies(): Promise<string[]> {
    const now = Date.now();

    if (cachedCurrencies && (now - currencyCacheTime) < CURRENCY_CACHE_TTL) {
        return cachedCurrencies;
    }

    const data = await fetchWithFallback<Record<string, string>>('currencies.min.json');

    if (!data) {
        return cachedCurrencies || [];
    }

    // Currency codes are keys in the response
    cachedCurrencies = Object.keys(data).map(c => c.toUpperCase()).sort();
    currencyCacheTime = now;

    logger.debug('Cached available currencies from fawazahmed0 API', { count: cachedCurrencies.length });

    return cachedCurrencies;
}

// ─────────────────────────────────────────────────────────────────────────────
// Week Boundary Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the Monday-Sunday week boundaries for a given date.
 */
export function getWeekBoundaries(dateStr: string): { weekStart: string; weekEnd: string } {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();

    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(date);
    monday.setDate(date.getDate() - daysToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
        weekStart: monday.toISOString().split('T')[0],
        weekEnd: sunday.toISOString().split('T')[0],
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exchange Rate Fetching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches exchange rates for a base currency on a specific date.
 *
 * @param baseCurrency The base currency code (e.g., 'EUR')
 * @param date Date in YYYY-MM-DD format
 * @returns Map of currency code -> rate, or null if failed
 */
async function fetchRatesForDate(
    baseCurrency: string,
    date: string
): Promise<Map<string, number> | null> {
    const base = baseCurrency.toLowerCase();
    const endpoint = `currencies/${base}.min.json`;

    const data = await fetchWithFallback<FallbackRateResponse>(endpoint, date);

    if (!data) {
        return null;
    }

    // Response structure: { date: "2024-01-01", eur: { usd: 1.05, gbp: 0.85, ... } }
    const rates = data[base];
    if (!rates || typeof rates !== 'object') {
        logger.debug('Currency API response missing rate data', { base, date });
        return null;
    }

    const rateMap = new Map<string, number>();
    for (const [currency, rate] of Object.entries(rates)) {
        if (typeof rate === 'number') {
            rateMap.set(currency.toUpperCase(), rate);
        }
    }

    return rateMap;
}

/**
 * Fetches exchange rates for a date range.
 * Since this API only provides single-day rates, we fetch each day individually.
 *
 * @param baseCurrency The base currency (e.g., 'EUR')
 * @param currencies Target currencies to include
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format
 */
async function fetchExchangeRates(
    baseCurrency: string,
    currencies: string[],
    startDate: string,
    endDate: string
): Promise<ExchangeRate[] | null> {
    const allRates: ExchangeRate[] = [];

    // Generate all dates in the range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates: string[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
    }

    // Fetch rates for each date
    for (const date of dates) {
        const rates = await fetchRatesForDate(baseCurrency, date);
        if (rates) {
            for (const currency of currencies) {
                const upper = currency.toUpperCase();
                const rate = rates.get(upper);
                if (rate !== undefined) {
                    allRates.push({ currency: upper, date, rate });
                }
            }
        }
    }

    if (allRates.length === 0) {
        logger.warn('No rates found for date range', { startDate, endDate });
        return null;
    }

    logger.debug('Fetched rates from currency API', {
        count: allRates.length,
        dates: dates.length,
    });

    return allRates;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Average Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the weekly average rate for each currency.
 */
function calculateWeeklyAverages(rates: ExchangeRate[]): Map<string, WeeklyRates> {
    const byCurrency = new Map<string, ExchangeRate[]>();

    for (const rate of rates) {
        const existing = byCurrency.get(rate.currency) || [];
        existing.push(rate);
        byCurrency.set(rate.currency, existing);
    }

    const result = new Map<string, WeeklyRates>();

    for (const [currency, currencyRates] of byCurrency) {
        const sum = currencyRates.reduce((acc, r) => acc + r.rate, 0);
        const average = sum / currencyRates.length;

        result.set(currency, {
            currency,
            rates: currencyRates,
            average,
        });
    }

    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Conversion Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts an amount from one currency to multiple target currencies.
 *
 * Uses weekly average exchange rates for the week containing the receipt date.
 * Returns null if conversion fails.
 *
 * @param amount The amount to convert
 * @param fromCurrency The source currency code (e.g., 'USD', 'AED')
 * @param targetCurrencies Array of target currency codes
 * @param receiptDate The receipt date in YYYY-MM-DD format
 * @returns Conversion result or null if failed
 */
export async function convertAmount(
    amount: number,
    fromCurrency: string,
    targetCurrencies: string[],
    receiptDate: string
): Promise<CurrencyConversionResult | null> {
    const from = fromCurrency.toUpperCase();
    const targets = targetCurrencies.map((c) => c.toUpperCase());

    // Always include at least the source currency for consistent totals
    const allTargets = [...new Set([...targets])];

    const { weekStart, weekEnd } = getWeekBoundaries(receiptDate);

    // This API uses EUR as base, so we need rates for all currencies against EUR
    const currenciesToFetch = [...new Set([from, ...allTargets, 'EUR'])];
    const rates = await fetchExchangeRates('eur', currenciesToFetch, weekStart, weekEnd);

    if (!rates) {
        logger.warn('Failed to fetch exchange rates for conversion');
        return null;
    }

    const weeklyAverages = calculateWeeklyAverages(rates);

    // Get source currency rate (how many source units per 1 EUR)
    let sourceRate: number;
    if (from === 'EUR') {
        sourceRate = 1;
    } else {
        const sourceRates = weeklyAverages.get(from);
        if (!sourceRates || sourceRates.rates.length === 0) {
            logger.warn('No rates available for source currency', { currency: from });
            return null;
        }
        sourceRate = sourceRates.average;
    }

    // Convert amount to EUR first
    // Rate represents: 1 EUR = X source currency
    // So: amount in source / rate = amount in EUR
    const amountInEur = amount / sourceRate;

    const conversions: Record<string, number> = {};
    const ratesUsed: Record<string, number> = {};

    // Always add the source currency with rate 1 (original amount)
    conversions[from] = Math.round(amount * 100) / 100;
    ratesUsed[from] = 1;

    for (const target of allTargets) {
        // Skip if it's the source currency (already added above)
        if (target === from) {
            continue;
        }

        if (target === 'EUR') {
            conversions[target] = Math.round(amountInEur * 100) / 100;
            ratesUsed[target] = 1 / sourceRate;
        } else {
            const targetRates = weeklyAverages.get(target);
            if (!targetRates || targetRates.rates.length === 0) {
                logger.warn('No rates available for target currency', { currency: target });
                continue;
            }

            // Rate represents: 1 EUR = X target currency
            const targetRate = targetRates.average;
            const converted = amountInEur * targetRate;

            conversions[target] = Math.round(converted * 100) / 100;
            ratesUsed[target] = targetRate / sourceRate;
        }
    }

    return {
        originalAmount: amount,
        originalCurrency: from,
        conversions,
        weekStart,
        weekEnd,
        ratesUsed,
    };
}
