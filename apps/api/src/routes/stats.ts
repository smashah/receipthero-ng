import { Hono } from 'hono';
import { loadConfig, db, processingLogs } from '@sm-rn/core';
import { eq } from 'drizzle-orm';

const stats = new Hono();

interface CurrencyTotal {
    currency: string;
    total: number;
    count: number;
}

interface CurrencyTotalsResponse {
    success: boolean;
    totals: CurrencyTotal[];
    totalReceipts: number;
    targetCurrencies: string[];
}

/**
 * GET /api/stats/currency-totals
 *
 * Returns aggregated totals in all configured target currencies.
 * Reads from processingLogs and sums up converted amounts.
 */
stats.get('/currency-totals', async (c) => {
    try {
        const config = loadConfig();
        const targetCurrencies = config.processing.currencyConversion?.targetCurrencies || [];
        const isEnabled = config.processing.currencyConversion?.enabled ?? false;

        if (!isEnabled) {
            return c.json({
                success: true,
                totals: [],
                totalReceipts: 0,
                targetCurrencies: [],
                message: 'Currency conversion is disabled',
            });
        }

        // Fetch all completed processing logs
        const completedLogs = await db.query.processingLogs.findMany({
            where: eq(processingLogs.status, 'completed'),
        });

        // Aggregate totals by currency
        const currencyTotals = new Map<string, { total: number; count: number }>();

        // Initialize all target currencies with 0
        for (const currency of targetCurrencies) {
            currencyTotals.set(currency.toUpperCase(), { total: 0, count: 0 });
        }

        for (const log of completedLogs) {
            if (!log.receiptData) continue;

            try {
                const receipt = JSON.parse(log.receiptData);
                const conversions = receipt.conversions as Record<string, number> | undefined;

                if (conversions) {
                    for (const [currency, amount] of Object.entries(conversions)) {
                        const upper = currency.toUpperCase();
                        const existing = currencyTotals.get(upper) || { total: 0, count: 0 };
                        currencyTotals.set(upper, {
                            total: existing.total + amount,
                            count: existing.count + 1,
                        });
                    }
                } else if (receipt.amount && receipt.currency) {
                    // Fallback: use original amount/currency if no conversions
                    const upper = receipt.currency.toUpperCase();
                    const existing = currencyTotals.get(upper) || { total: 0, count: 0 };
                    currencyTotals.set(upper, {
                        total: existing.total + receipt.amount,
                        count: existing.count + 1,
                    });
                }
            } catch {
                // Skip malformed JSON
                continue;
            }
        }

        // Convert to array and sort by currency code
        const totals: CurrencyTotal[] = Array.from(currencyTotals.entries())
            .map(([currency, data]) => ({
                currency,
                total: Math.round(data.total * 100) / 100,
                count: data.count,
            }))
            .sort((a, b) => a.currency.localeCompare(b.currency));

        return c.json({
            success: true,
            totals,
            totalReceipts: completedLogs.length,
            targetCurrencies: targetCurrencies.map(c => c.toUpperCase()),
        } as CurrencyTotalsResponse);
    } catch (error) {
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
        }, 500);
    }
});

export default stats;
