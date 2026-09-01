import { useState, useMemo } from 'react';
import {
  History,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Filter,
  DollarSign,
  Layers,
  Sparkles,
  Loader2,
  Calendar,
  ExternalLink,
  Wallet,
  RefreshCw,
  Clock
} from 'lucide-react';
import { useTrades, useSyncTrades, UnifiedTrade } from '@/services/tradeService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

interface DashboardTradesCardProps {
  onNavigateToTrades?: () => void;
  onNavigateToResearch?: (symbol: string) => void;
}

export function DashboardTradesCard({
  onNavigateToTrades,
  onNavigateToResearch,
}: DashboardTradesCardProps) {
  const { toast } = useToast();
  const [filterSide, setFilterSide] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [filterAsset, setFilterAsset] = useState<'ALL' | 'EQUITY' | 'OPTION'>('ALL');
  const [filterBroker, setFilterBroker] = useState<'ALL' | 'IBKR' | 'TASTY'>('ALL');

  const { data: tradesResponse, isLoading, isFetching, refetch } = useTrades({
    limit: 50,
  });
  const syncTradesMutation = useSyncTrades();

  const allTrades = tradesResponse?.trades || [];
  const metrics = tradesResponse?.metrics;

  const handleSyncClick = async () => {
    try {
      const res = await syncTradesMutation.mutateAsync({});
      toast({
        title: "Trades Synced",
        description: `Successfully synchronized ${res.syncedCount || 0} trade executions across connected brokers.`,
      });
    } catch (err: any) {
      toast({
        title: "Sync Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const filteredTrades = useMemo(() => {
    return allTrades.filter((trade) => {
      // Filter by Broker
      if (filterBroker === 'IBKR' && !trade.broker.toLowerCase().includes('interactive')) return false;
      if (filterBroker === 'TASTY' && !trade.broker.toLowerCase().includes('tasty')) return false;

      // Filter by Buy / Sell
      if (filterSide === 'BUY' && trade.side !== 'BUY') return false;
      if (filterSide === 'SELL' && trade.side !== 'SELL') return false;

      // Filter by Asset Type
      if (filterAsset === 'EQUITY' && trade.assetType !== 'EQUITY') return false;
      if (filterAsset === 'OPTION' && trade.assetType !== 'OPTION') return false;

      return true;
    }).slice(0, 8); // Top 8 recent executions for the dashboard card
  }, [allTrades, filterBroker, filterSide, filterAsset]);

  const handleRowClick = (trade: UnifiedTrade) => {
    const symbolToOpen = trade.underlyingSymbol || trade.symbol.split(' ')[0];
    if (symbolToOpen && onNavigateToResearch) {
      onNavigateToResearch(symbolToOpen);
    } else if (symbolToOpen) {
      window.dispatchEvent(new CustomEvent('select-research-ticker', { detail: symbolToOpen }));
    }
  };

  const formatTradeDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (diffDays === 1) {
        return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="bg-card/75 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden transition-all duration-300">
      {/* Header */}
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-accent/10 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 via-primary/20 to-emerald-500/20 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
              <History className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-foreground">
                  Latest Portfolio Buys & Sells
                </CardTitle>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-mono font-bold px-1.5 py-0">
                  {allTrades.length} Synced
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time trade executions and position adjustments across connected accounts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSyncClick}
              disabled={syncTradesMutation.isPending}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              title="Sync live executions from IBKR & Tastytrade"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', (isFetching || syncTradesMutation.isPending) && 'animate-spin text-primary')} />
            </Button>

            {onNavigateToTrades && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToTrades}
                className="h-8 text-xs text-primary border-primary/30 bg-primary/5 hover:bg-primary/15 gap-1.5 px-3 font-semibold"
                title="View complete trade journal & history"
              >
                <span>Trades Journal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Quick Summary Telemetry Bar */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="p-2 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400/80 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-emerald-400" /> Bought Volume
              </span>
              <span className="font-mono font-bold text-xs text-emerald-300 mt-0.5">
                ${metrics.totalBoughtValue ? metrics.totalBoughtValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-rose-950/20 border border-rose-500/20 flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-bold text-rose-400/80 flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3 text-rose-400" /> Sold Volume
              </span>
              <span className="font-mono font-bold text-xs text-rose-300 mt-0.5">
                ${metrics.totalSoldValue ? metrics.totalSoldValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-card/60 border border-border/50 flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-primary" /> Net Cash Flow
              </span>
              <span
                className={cn(
                  "font-mono font-bold text-xs mt-0.5",
                  metrics.netCashFlow >= 0 ? "text-emerald-400" : "text-amber-400"
                )}
              >
                {metrics.netCashFlow >= 0 ? '+' : '-'}${Math.abs(metrics.netCashFlow).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-card/60 border border-border/50 flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
                <Layers className="w-3 h-3 text-indigo-400" /> Equities / Options
              </span>
              <span className="font-mono font-bold text-xs text-foreground mt-0.5">
                {metrics.equitiesCount} <span className="text-muted-foreground text-[10px]">EQ</span> / {metrics.optionsCount} <span className="text-muted-foreground text-[10px]">OPT</span>
              </span>
            </div>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
          {/* Broker Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-xl border border-border/60">
            <button
              onClick={() => setFilterBroker('ALL')}
              className={cn(
                'px-2 py-0.5 text-[11px] font-medium rounded-lg transition-all',
                filterBroker === 'ALL' ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All Brokers
            </button>
            <button
              onClick={() => setFilterBroker('IBKR')}
              className={cn(
                'px-2 py-0.5 text-[11px] font-medium rounded-lg transition-all',
                filterBroker === 'IBKR' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shadow-sm' : 'text-amber-400/70 hover:text-amber-300'
              )}
            >
              IBKR
            </button>
            <button
              onClick={() => setFilterBroker('TASTY')}
              className={cn(
                'px-2 py-0.5 text-[11px] font-medium rounded-lg transition-all',
                filterBroker === 'TASTY' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold shadow-sm' : 'text-purple-400/70 hover:text-purple-300'
              )}
            >
              Tastytrade
            </button>
          </div>

          {/* Side & Asset Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Side Filter Pills (All / Buys / Sells) */}
            <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-xl border border-border/60">
              <button
                onClick={() => setFilterSide('ALL')}
                className={cn(
                  'px-2 py-0.5 text-[11px] font-medium rounded-lg transition-all',
                  filterSide === 'ALL'
                    ? 'bg-accent text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                All Flow
              </button>
              <button
                onClick={() => setFilterSide('BUY')}
                className={cn(
                  'px-2 py-0.5 text-[11px] font-medium rounded-lg transition-all flex items-center gap-1',
                  filterSide === 'BUY'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'text-emerald-400/80 hover:text-emerald-300'
                )}
              >
                <ArrowUpRight className="w-3 h-3" />
                Buys
              </button>
              <button
                onClick={() => setFilterSide('SELL')}
                className={cn(
                  'px-2 py-0.5 text-[11px] font-medium rounded-lg transition-all flex items-center gap-1',
                  filterSide === 'SELL'
                    ? 'bg-rose-500 text-white font-bold shadow-sm'
                    : 'text-rose-400/80 hover:text-rose-300'
                )}
              >
                <ArrowDownRight className="w-3 h-3" />
                Sells
              </button>
            </div>

            {/* Asset Type Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-xl border border-border/60">
              <button
                onClick={() => setFilterAsset('ALL')}
                className={cn(
                  'px-2 py-0.5 text-[11px] font-medium rounded-lg transition-all',
                  filterAsset === 'ALL' ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground'
                )}
              >
                All Assets
              </button>
              <button
                onClick={() => setFilterAsset('EQUITY')}
                className={cn(
                  'px-2 py-0.5 text-[11px] font-medium rounded-lg transition-all',
                  filterAsset === 'EQUITY' ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground'
                )}
              >
                Stocks
              </button>
              <button
                onClick={() => setFilterAsset('OPTION')}
                className={cn(
                  'px-2 py-0.5 text-[11px] font-medium rounded-lg transition-all',
                  filterAsset === 'OPTION' ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground'
                )}
              >
                Options
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Trades List Content */}
      <CardContent className="p-4 space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-xs">Loading execution history...</p>
          </div>
        ) : filteredTrades.length === 0 ? (
          <div className="py-10 text-center space-y-2 text-xs text-muted-foreground">
            <History className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p className="font-semibold text-foreground">No recent {filterSide !== 'ALL' ? filterSide.toLowerCase() : ''} trades found</p>
            <p className="text-[11px]">Sync your connected broker accounts to pull recent execution logs.</p>
          </div>
        ) : (
          filteredTrades.map((trade) => {
            const isBuy = trade.side === 'BUY';
            const isOption = trade.assetType === 'OPTION';
            const isIBKR = trade.broker.toLowerCase().includes('interactive');
            const displaySymbol = trade.underlyingSymbol || trade.symbol.split(' ')[0] || trade.symbol;

            return (
              <div
                key={trade.id}
                onClick={() => handleRowClick(trade)}
                className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card/40 hover:bg-accent/40 hover:border-primary/30 transition-all cursor-pointer group shadow-sm"
              >
                {/* Left: Action Badge, Symbol & Details */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Action Icon / Pill */}
                  <div
                    className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold border',
                      isBuy
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500/25'
                        : 'bg-rose-500/15 border-rose-500/30 text-rose-400 group-hover:bg-rose-500/25'
                    )}
                  >
                    {isBuy ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                        {displaySymbol}
                      </span>

                      {/* Side Action Tag */}
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] px-1.5 py-0 font-mono font-bold border',
                          isBuy
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        )}
                      >
                        {trade.action ? trade.action.replace(/_/g, ' ') : trade.side}
                      </Badge>

                      {/* Option details if applicable */}
                      {isOption && trade.strikePrice && (
                        <span className="text-[9px] font-mono px-1.5 py-0 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          {trade.optionType || 'OPT'} ${trade.strikePrice} {trade.expiryDate ? trade.expiryDate.slice(5) : ''}
                        </span>
                      )}

                      {/* Broker Source Badge */}
                      <span
                        className={cn(
                          'text-[9px] font-mono font-bold px-1.5 py-0 rounded border',
                          isIBKR
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                        )}
                      >
                        {isIBKR ? 'IBKR' : 'Tastytrade'}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground truncate max-w-[200px] sm:max-w-[280px] mt-0.5">
                      {trade.description || `${isBuy ? 'Bought' : 'Sold'} ${Math.abs(trade.quantity)} @ $${trade.price?.toFixed(2)}`}
                    </p>
                  </div>
                </div>

                {/* Right: Quantity, Price, Total Value & Time */}
                <div className="text-right shrink-0 pl-2">
                  <div className="flex items-center justify-end gap-1 font-mono">
                    <span className="text-xs font-bold text-foreground">
                      ${trade.totalValue ? trade.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (trade.price * Math.abs(trade.quantity)).toFixed(2)}
                    </span>
                    {trade.valueEffect && (
                      <span
                        className={cn(
                          'text-[9px] px-1 py-0 rounded font-bold',
                          trade.valueEffect === 'CREDIT'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : trade.valueEffect === 'DEBIT'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'text-muted-foreground'
                        )}
                      >
                        {trade.valueEffect}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                    <span className="font-mono">
                      {Math.abs(trade.quantity)} {isOption ? 'contracts' : 'shares'} @ ${trade.price ? trade.price.toFixed(2) : '0.00'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5 text-[9.5px]">
                      <Clock className="w-2.5 h-2.5 text-muted-foreground/70" />
                      {formatTradeDate(trade.executedAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
