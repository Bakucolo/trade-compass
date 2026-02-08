import { recentTrades } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, Calendar, Filter, Plus, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useState } from 'react';

export function TradesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'sell'>('all');

  const filteredTrades = recentTrades.filter((trade) => {
    const matchesSearch = trade.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || trade.type.toLowerCase() === filterType;
    return matchesSearch && matchesType;
  });

  const totalBuyValue = recentTrades.filter(t => t.type === 'BUY').reduce((sum, t) => sum + t.total, 0);
  const totalSellValue = recentTrades.filter(t => t.type === 'SELL').reduce((sum, t) => sum + t.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trade History</h1>
          <p className="text-muted-foreground">View and manage your trading activity</p>
        </div>
        <Button variant="glow" className="gap-2">
          <Plus className="w-4 h-4" />
          Log Trade
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="data-label mb-1">Total Trades</p>
          <p className="text-2xl font-bold text-foreground">{recentTrades.length}</p>
        </div>
        <div className="stat-card">
          <p className="data-label mb-1">Total Bought</p>
          <p className="text-2xl font-bold text-success font-mono">${totalBuyValue.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <p className="data-label mb-1">Total Sold</p>
          <p className="text-2xl font-bold text-destructive font-mono">${totalSellValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search trades..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'buy', 'sell'] as const).map((type) => (
            <Button
              key={type}
              variant={filterType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType(type)}
              className="capitalize"
            >
              {type}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar className="w-4 h-4" />
          Date Range
        </Button>
      </div>

      {/* Trades List */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Type</th>
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Symbol</th>
                <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Quantity</th>
                <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Price</th>
                <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Total</th>
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Date</th>
                <th className="text-center p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade, index) => {
                const isBuy = trade.type === 'BUY';

                return (
                  <tr
                    key={trade.id}
                    className="border-b border-border/50 hover:bg-accent/30 transition-colors animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="p-4">
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg",
                        isBuy ? "bg-success/10" : "bg-destructive/10"
                      )}>
                        {isBuy ? (
                          <ArrowDownLeft className="w-4 h-4 text-success" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-destructive" />
                        )}
                        <span className={cn(
                          "text-sm font-medium",
                          isBuy ? "text-success" : "text-destructive"
                        )}>
                          {trade.type}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-foreground ticker-symbol">{trade.symbol}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-mono text-foreground">{trade.quantity}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-mono text-foreground">${trade.price.toFixed(2)}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-mono font-medium text-foreground">${trade.total.toLocaleString()}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-muted-foreground">{trade.date}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={cn(
                        "text-xs font-medium px-2 py-1 rounded-full",
                        trade.status === 'executed' && "bg-success/20 text-success",
                        trade.status === 'pending' && "bg-warning/20 text-warning",
                        trade.status === 'cancelled' && "bg-muted text-muted-foreground"
                      )}>
                        {trade.status}
                      </span>
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
