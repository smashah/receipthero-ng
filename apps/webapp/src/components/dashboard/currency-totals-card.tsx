import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SlidingNumber } from '@/components/ui/sliding-number';
import type { CurrencyTotalsResponse } from '@/lib/queries';

// Get currency symbol for display
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    GBP: '£',
    EUR: '€',
    SAR: '﷼',
    SEK: 'kr',
    AED: 'د.إ',
    TRY: '₺',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
    CAD: 'C$',
    AUD: 'A$',
  };
  return symbols[currency.toUpperCase()] || currency;
}

interface CurrencyTotalsCardProps {
  currencyTotals: CurrencyTotalsResponse | undefined;
  targetCurrencies?: string[];
}

export function CurrencyTotalsCard({ currencyTotals, targetCurrencies }: CurrencyTotalsCardProps) {
  if (!currencyTotals?.success || !currencyTotals.totals.length) {
    return null;
  }

  // Filter to only show configured target currencies (if provided)
  const filteredTotals = targetCurrencies?.length 
    ? currencyTotals.totals.filter(item => 
        targetCurrencies.map(c => c.toUpperCase()).includes(item.currency.toUpperCase())
      )
    : currencyTotals.totals;

  if (!filteredTotals.length) {
    return null;
  }

  return (
    <Card className="md:col-span-2 lg:col-span-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Currency Totals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          className="grid gap-4"
          style={{ 
            gridTemplateColumns: `repeat(${Math.min(filteredTotals.length, 5)}, minmax(0, 1fr))` 
          }}
        >
          {filteredTotals.map((item, index) => (
            <div key={item.currency} className={`space-y-1 ${index > 0 ? 'border-l pl-4' : ''}`}>
              <span className="text-3xl font-bold tracking-tight flex items-baseline gap-0.5">
                <span className="text-xl">{getCurrencySymbol(item.currency)}</span>
                <SlidingNumber 
                  number={Math.round(item.total)} 
                  thousandSeparator=","
                  transition={{ stiffness: 150, damping: 25, mass: 0.5 }}
                />
              </span>
              <p className="text-xs text-muted-foreground uppercase font-medium">
                {item.currency}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
