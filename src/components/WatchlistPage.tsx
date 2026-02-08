import { watchlist } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Bell, BellOff, Plus, Search, TrendingDown, TrendingUp, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useState } from 'react';

export function WatchlistPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredWatchlist = watchlist.filter(
    (item) =>
      item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Watchlist</h1>
          <p className="text-muted-foreground">Track your favorite stocks and set price alerts</p>
        </div>
        <Button variant="glow" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Symbol
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search symbols..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-card border-border"
        />
      </div>

      {/* Watchlist Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Symbol</th>
                <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Price</th>
                <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Change</th>
                <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Change %</th>
                <th className="text-center p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Alert</th>
                <th className="text-center p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWatchlist.map((item, index) => {
                const isPositive = item.change >= 0;

                return (
                  <tr
                    key={item.symbol}
                    className="border-b border-border/50 hover:bg-accent/30 transition-colors animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="p-4">
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
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-mono font-medium text-foreground">${item.price.toFixed(2)}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className={cn("font-mono", isPositive ? "price-up" : "price-down")}>
                        {isPositive ? '+' : ''}${item.change.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isPositive ? (
                          <TrendingUp className="w-4 h-4 text-success" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-destructive" />
                        )}
                        <span className={cn("font-mono", isPositive ? "price-up" : "price-down")}>
                          {isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {item.alert ? (
                        <div className="flex items-center justify-center gap-1">
                          <Bell className="w-4 h-4 text-warning" />
                          <span className="text-xs text-warning font-mono">${item.alert}</span>
                        </div>
                      ) : (
                        <BellOff className="w-4 h-4 text-muted-foreground mx-auto" />
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Bell className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
