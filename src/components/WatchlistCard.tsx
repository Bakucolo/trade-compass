import { watchlist } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Bell, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';

export function WatchlistCard() {
  return (
    <div className="glass-card rounded-xl p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Watchlist</h3>
        <Button variant="ghost" size="sm" className="gap-1">
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>

      <div className="space-y-2 max-h-[320px] overflow-y-auto scrollbar-thin">
        {watchlist.map((item) => {
          const isPositive = item.change >= 0;
          
          return (
            <div
              key={item.symbol}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                  <span className="text-xs font-bold text-foreground">
                    {item.symbol.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-foreground ticker-symbol">{item.symbol}</p>
                  <p className="text-xs text-muted-foreground">{item.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {item.alert && (
                  <Bell className="w-4 h-4 text-warning opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                <div className="text-right">
                  <p className="font-mono font-medium text-foreground">${item.price.toFixed(2)}</p>
                  <div className="flex items-center justify-end gap-1">
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3 text-success" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-destructive" />
                    )}
                    <span className={cn(
                      "text-xs font-medium",
                      isPositive ? "price-up" : "price-down"
                    )}>
                      {isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
