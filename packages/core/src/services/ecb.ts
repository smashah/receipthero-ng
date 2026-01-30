/**
 * ECB (European Central Bank) Currency Conversion Service
 *
 * Provides currency conversion using the ECB Data API.
 * Calculates weekly average exchange rates for accuracy during travel periods.
 *
 * @see https://data-api.ecb.europa.eu/
 */

import { createLogger } from './logger';

const logger = createLogger('core');

const ECB_API_BASE = 'https://data-api.ecb.europa.eu/service/data/EXR';

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
    ratesUsed: Record<string, number>; // Average rates used for each target currency
}

// Cache for available currencies (refreshed every 24 hours)
let cachedCurrencies: string[] | null = null;
let currencyCacheTime: number = 0;
const CURRENCY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetches the list of available currencies from ECB.
 * Results are cached for 24 hours.
 */
export async function getAvailableCurrencies(): Promise<string[]> {
    const now = Date.now();

    // Return cached currencies if still valid
    if (cachedCurrencies && (now - currencyCacheTime) < CURRENCY_CACHE_TTL) {
        return cachedCurrencies;
    }

    // Fetch all currencies by using empty currency slot
    // D..EUR.SP00.A = Daily, all currencies, against EUR, spot rate, average
    const url = `${ECB_API_BASE}/D..EUR.SP00.A?lastNObservations=1&format=csvdata`;

    logger.debug('Fetching available currencies from ECB');

    try {
        const response = await fetch(url, {
            headers: { Accept: 'text/csv' },
        });

        if (!response.ok) {
            logger.warn('ECB API returned non-OK status when fetching currencies', {
                status: response.status,
            });
            return cachedCurrencies || getDefaultCurrencies();
        }

        const csv = await response.text();
        const lines = csv.trim().split('\n');

        if (lines.length < 2) {
            return cachedCurrencies || getDefaultCurrencies();
        }

        // Parse header to find CURRENCY column
        const headers = lines[0].split(',');
        const currencyIdx = headers.indexOf('CURRENCY');

        if (currencyIdx === -1) {
            return cachedCurrencies || getDefaultCurrencies();
        }

        // Extract unique currencies, excluding historical/discontinued ones
        const currencies = new Set<string>();
        const discontinuedCurrencies = new Set(['CYP', 'EEK', 'GRD', 'LTL', 'LVL', 'MTL', 'SKK', 'SIT']);

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const currency = values[currencyIdx];
            if (currency && !discontinuedCurrencies.has(currency)) {
                currencies.add(currency);
            }
        }

        cachedCurrencies = Array.from(currencies).sort();
        currencyCacheTime = now;

        logger.debug('Cached available ECB currencies', { count: cachedCurrencies.length });

        return cachedCurrencies;
    } catch (error) {
        logger.warn('Failed to fetch available currencies from ECB', {
            error: error instanceof Error ? error.message : String(error),
        });
        return cachedCurrencies || getDefaultCurrencies();
    }
}

/**
 * Fallback list of common ECB-supported currencies.
 */
function getDefaultCurrencies(): string[] {
    return [
        'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK',
        'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY',
        'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON',
        'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'
    ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Week Boundary Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the Monday-Sunday week boundaries for a given date.
 */
export function getWeekBoundaries(dateStr: string): { weekStart: string; weekEnd: string } {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ...

    // Calculate days to subtract to get to Monday
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(date);
    monday.setDate(date.getDate() - daysToMonday);

    // Calculate Sunday (6 days after Monday)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
        weekStart: monday.toISOString().split('T')[0],
        weekEnd: sunday.toISOString().split('T')[0],
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// ECB CSV Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses ECB CSV response into exchange rates.
 *
 * ECB CSV format example:
 * KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE,...
 * EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2025-01-02,1.0321,...
 */
function parseEcbCsv(csv: string): ExchangeRate[] {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];

    // Header line to find column indices
    const headers = lines[0].split(',');
    const currencyIdx = headers.indexOf('CURRENCY');
    const dateIdx = headers.indexOf('TIME_PERIOD');
    const rateIdx = headers.indexOf('OBS_VALUE');

    if (currencyIdx === -1 || dateIdx === -1 || rateIdx === -1) {
        logger.warn('ECB CSV missing expected columns', {
            headers: headers.slice(0, 10),
        });
        return [];
    }

    const rates: ExchangeRate[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle CSV with potential quoted values
        const values = line.split(',');
        const currency = values[currencyIdx];
        const date = values[dateIdx];
        const rateStr = values[rateIdx];

        if (currency && date && rateStr) {
            const rate = parseFloat(rateStr);
            if (!isNaN(rate)) {
                rates.push({ currency, date, rate });
            }
        }
    }

    return rates;
}

// ─────────────────────────────────────────────────────────────────────────────
// ECB API Fetching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches daily exchange rates for specified currencies within a date range.
 *
 * @param currencies Array of currency codes (e.g., ['USD', 'GBP', 'SAR'])
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format
 * @returns Array of exchange rates, or null if fetch fails
 */
async function fetchExchangeRates(
    currencies: string[],
    startDate: string,
    endDate: string
): Promise<ExchangeRate[] | null> {
    // ECB uses EUR as base, so we need to exclude EUR from the request
    const currenciesToFetch = currencies.filter((c) => c !== 'EUR');

    if (currenciesToFetch.length === 0) {
        // Only EUR requested, no conversion needed
        return [];
    }

    // Build the series key with OR operator for multiple currencies
    const currencyKey = currenciesToFetch.join('+');

    // D = Daily, .{currencies}.EUR = against EUR, SP00 = spot rate, A = average
    const url = `${ECB_API_BASE}/D.${currencyKey}.EUR.SP00.A?startPeriod=${startDate}&endPeriod=${endDate}&format=csvdata`;

    logger.debug('Fetching ECB exchange rates', { url, currencies: currenciesToFetch });

    try {
        const response = await fetch(url, {
            headers: {
                Accept: 'text/csv',
            },
        });

        if (!response.ok) {
            logger.warn('ECB API returned non-OK status', {
                status: response.status,
                statusText: response.statusText,
            });
            return null;
        }

        const csv = await response.text();
        const rates = parseEcbCsv(csv);

        logger.debug('Parsed ECB rates', {
            count: rates.length,
            currencies: [...new Set(rates.map((r) => r.currency))],
        });

        return rates;
    } catch (error) {
        logger.warn('Failed to fetch ECB exchange rates', {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
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
 * Uses ECB weekly average exchange rates for the week containing the receipt date.
 * Returns null if conversion fails (by design - failable step).
 *
 * @param amount The amount to convert
 * @param fromCurrency The source currency code (e.g., 'AED', 'USD')
 * @param targetCurrencies Array of target currency codes (e.g., ['GBP', 'USD', 'SAR'])
 * @param receiptDate The receipt date in YYYY-MM-DD format (used to determine the week)
 * @returns Conversion result or null if failed
 */
export async function convertAmount(
    amount: number,
    fromCurrency: string,
    targetCurrencies: string[],
    receiptDate: string
): Promise<CurrencyConversionResult | null> {
    // Normalize currency codes to uppercase
    const from = fromCurrency.toUpperCase();
    const targets = targetCurrencies.map((c) => c.toUpperCase());

    // Filter out the source currency from targets (no need to convert to itself)
    const actualTargets = targets.filter((t) => t !== from);

    if (actualTargets.length === 0) {
        logger.debug('No conversion needed - all targets match source currency');
        return null;
    }

    // Get week boundaries
    const { weekStart, weekEnd } = getWeekBoundaries(receiptDate);

    // Determine which currencies we need rates for
    // We always need the source currency rate (against EUR) if it's not EUR
    // And we need all target currency rates (against EUR)
    const currenciesToFetch = [...new Set([from, ...actualTargets])].filter((c) => c !== 'EUR');

    // Fetch rates
    const rates = await fetchExchangeRates(currenciesToFetch, weekStart, weekEnd);

    if (!rates) {
        logger.warn('Failed to fetch exchange rates for conversion');
        return null;
    }

    // Calculate weekly averages
    const weeklyAverages = calculateWeeklyAverages(rates);

    // Get source currency rate against EUR
    // If source is EUR, rate is 1
    let sourceToEur: number;
    if (from === 'EUR') {
        sourceToEur = 1;
    } else {
        const sourceRates = weeklyAverages.get(from);
        if (!sourceRates || sourceRates.rates.length === 0) {
            logger.warn('No rates available for source currency', { currency: from });
            return null;
        }
        // ECB rates are expressed as "X units of currency per 1 EUR"
        // So to convert FROM the currency TO EUR, we divide by the rate
        sourceToEur = 1 / sourceRates.average;
    }

    // Convert to EUR first
    const amountInEur = amount * sourceToEur;

    // Now convert from EUR to each target currency
    const conversions: Record<string, number> = {};
    const ratesUsed: Record<string, number> = {};

    for (const target of actualTargets) {
        if (target === 'EUR') {
            // Direct conversion to EUR
            conversions[target] = Math.round(amountInEur * 100) / 100;
            ratesUsed[target] = sourceToEur;
        } else {
            const targetRates = weeklyAverages.get(target);
            if (!targetRates || targetRates.rates.length === 0) {
                logger.warn('No rates available for target currency', { currency: target });
                continue; // Skip this target but continue with others
            }

            // ECB rate is "X units of target per 1 EUR"
            // So to convert FROM EUR TO target, we multiply by the rate
            const eurToTarget = targetRates.average;
            const converted = amountInEur * eurToTarget;

            conversions[target] = Math.round(converted * 100) / 100;
            ratesUsed[target] = (from === 'EUR' ? 1 : 1 / weeklyAverages.get(from)!.average) * eurToTarget;
        }
    }

    // If no conversions were successful, return null
    if (Object.keys(conversions).length === 0) {
        logger.warn('No conversions could be performed');
        return null;
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
