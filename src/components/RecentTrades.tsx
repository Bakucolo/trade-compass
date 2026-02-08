import { recentTrades } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export function RecentTrades() {
  return (
    <div className="glass-card rounded-xl p-6 animate-fade-in">
      <h3 className="text-lg font-semibold text-foreground mb-4">Recent Trades</h3>

      <div className="space-y-3">
        {recentTrades.slice(0, 5).map((trade) => {
          const isBuy = trade.type === 'BUY';
          
          return (
            <div
              key={trade.id}
              className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  isBuy ? "bg-success/10" : "bg-destructive/10"
                )}>
                  {isBuy ? (
                    <ArrowDownLeft className="w-4 h-4 text-success" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-destructive" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground ticker-symbol">{trade.symbol}</span>
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded",
                      isBuy ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                    )}>
                      {trade.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {trade.quantity} shares @ ${trade.price.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="font-mono font-medium text-foreground">
                  ${trade.total.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{trade.date}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
