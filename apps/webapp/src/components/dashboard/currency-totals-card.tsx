import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { CurrencyTotalsResponse } from '@/lib/queries';

interface CurrencyTotalsCardProps {
  currencyTotals: CurrencyTotalsResponse | undefined;
}

export function CurrencyTotalsCard({ currencyTotals }: CurrencyTotalsCardProps) {
  if (!currencyTotals?.success || !currencyTotals.totals.length) {
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
            gridTemplateColumns: `repeat(${Math.min(currencyTotals.totals.length, 5)}, minmax(0, 1fr))` 
          }}
        >
          {currencyTotals.totals.map((item, index) => (
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
