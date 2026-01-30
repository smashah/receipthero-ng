import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { CurrencyTotalsResponse } from '@/lib/queries';

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
              <span className="text-3xl font-bold tracking-tight">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: item.currency,
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(item.total)}
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

