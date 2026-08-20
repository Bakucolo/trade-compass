import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Loader2, Sparkles } from 'lucide-react';
import { useWatchlists, useWatchlistData } from '@/services/watchlistService';

export function WatchlistCard() {
  const { data: watchlists = [], isLoading: isWatchlistsLoading } = useWatchlists();
  const defaultWatchlist = watchlists.find((w) => w.isDefault) || watchlists[0];
  const { data: activeData, isLoading: isDataLoading } = useWatchlistData(defaultWatchlist?.id);

  const items = activeData?.items || [];
  const isLoading = isWatchlistsLoading || isDataLoading;

  return (
    <div className="glass-card rounded-xl p-6 animate-fade-in border border-border/50 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            Watchlist
            <span className="text-xs font-normal text-muted-foreground">({defaultWatchlist?.name || 'Main'})</span>
          </h3>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
          {items.length} stocks
        </span>
      </div>

      <div className="space-y-2 max-h-[320px] overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-xs">Loading watchlist...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-xs">
            No stocks in this watchlist.
          </div>
        ) : (
          items.map((item) => {
            const isPositive = item.change >= 0;

            return (
              <div
                key={item.symbol}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/40 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary font-mono">
                      {item.symbol.slice(0, 3)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground ticker-symbol text-sm">{item.symbol}</p>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">{item.name}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-mono font-bold text-foreground text-sm">
                    ${item.price ? item.price.toFixed(2) : '0.00'}
                  </p>
                  <div className="flex items-center justify-end gap-1">
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3 text-success" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-destructive" />
                    )}
                    <span
                      className={cn(
                        "text-xs font-mono font-medium",
                        isPositive ? "price-up" : "price-down"
                      )}
                    >
                      {isPositive ? '+' : ''}{item.changePercent ? item.changePercent.toFixed(2) : '0.00'}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
