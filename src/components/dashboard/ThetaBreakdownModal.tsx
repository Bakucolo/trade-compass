import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Search,
  Copy,
  Check,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  calculatePortfolioTheta,
  PortfolioThetaSummary,
} from '@/utils/greeksUtils';

export interface ThetaBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions?: any[];
  netLiq?: number;
  onNavigateToResearch?: (symbol: string) => void;
  onOpenAdvisorForPosition?: (pos: any) => void;
}

type FilterCategory = 'ALL' | 'SHORT' | 'LONG' | 'CALL' | 'PUT' | 'NEAR_EXPIRY';
type SortOption = 'THETA_DESC' | 'THETA_ASC' | 'DTE_ASC' | 'QTY_DESC' | 'SYMBOL_ASC';

export function ThetaBreakdownModal({
  isOpen,
  onClose,
  positions = [],
  netLiq = 0,
  onNavigateToResearch,
  onOpenAdvisorForPosition,
}: ThetaBreakdownModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('THETA_DESC');
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);

  // Compute portfolio theta metrics
  const portfolioTheta: PortfolioThetaSummary = useMemo(() => {
    return calculatePortfolioTheta(positions, netLiq);
  }, [positions, netLiq]);

  const allItems = portfolioTheta.positionsTheta || [];

  // Filter positions
  const filteredPositions = useMemo(() => {
    return allItems.filter((pt) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const symMatch = pt.symbol.toLowerCase().includes(q);
        const undMatch = pt.underlyingSymbol.toLowerCase().includes(q);
        const descMatch = pt.description ? pt.description.toLowerCase().includes(q) : false;
        if (!symMatch && !undMatch && !descMatch) return false;
      }

      // 2. Category Filter
      if (filterCategory === 'SHORT') {
        return pt.isShort;
      }
      if (filterCategory === 'LONG') {
        return !pt.isShort;
      }
      if (filterCategory === 'CALL') {
        return pt.optionType === 'CALL';
      }
      if (filterCategory === 'PUT') {
        return pt.optionType === 'PUT';
      }
      if (filterCategory === 'NEAR_EXPIRY') {
        return pt.dte <= 14;
      }

      return true;
    });
  }, [allItems, searchQuery, filterCategory]);

  // Sort positions
  const sortedPositions = useMemo(() => {
    const list = [...filteredPositions];
    switch (sortBy) {
      case 'THETA_DESC':
        // Highest income / most positive first
        return list.sort((a, b) => b.dailyDollarTheta - a.dailyDollarTheta);
      case 'THETA_ASC':
        // Highest decay cost first (most negative first)
        return list.sort((a, b) => a.dailyDollarTheta - b.dailyDollarTheta);
      case 'DTE_ASC':
        return list.sort((a, b) => a.dte - b.dte);
      case 'QTY_DESC':
        return list.sort((a, b) => Math.abs(b.quantity) - Math.abs(a.quantity));
      case 'SYMBOL_ASC':
        return list.sort((a, b) => a.underlyingSymbol.localeCompare(b.underlyingSymbol));
      default:
        return list;
    }
  }, [filteredPositions, sortBy]);

  // Copy helper
  const handleCopySymbol = (sym: string) => {
    navigator.clipboard.writeText(sym);
    setCopiedSymbol(sym);
    toast.success(`Copied ${sym} to clipboard`);
    setTimeout(() => setCopiedSymbol(null), 2000);
  };

  const isNetThetaPositive = portfolioTheta.totalDailyTheta >= 0;
  const shortTotal = portfolioTheta.shortOptionsTheta || 0;
  const longTotal = Math.abs(portfolioTheta.longOptionsTheta || 0);
  const totalVolume = shortTotal + longTotal;
  const shortSharePct = totalVolume > 0 ? (shortTotal / totalVolume) * 100 : 50;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-2xl border-border/80 shadow-2xl rounded-2xl">
        {/* Top Gradient Banner */}
        <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400" />

        {/* Modal Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-card/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-md shadow-purple-500/10">
                <Zap className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                    Portfolio Theta (Θ) Breakdown
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-mono font-bold px-2 py-0.5',
                      portfolioTheta.regime === 'POSITIVE_INCOME'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : portfolioTheta.regime === 'THETA_DRAG'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                        : 'bg-accent/60 text-muted-foreground'
                    )}
                  >
                    {portfolioTheta.regime === 'POSITIVE_INCOME'
                      ? 'Net Cash Flow Engine'
                      : portfolioTheta.regime === 'THETA_DRAG'
                      ? 'Theta Drag / Long Decay'
                      : portfolioTheta.regime === 'BALANCED'
                      ? 'Balanced Theta'
                      : 'No Active Options'}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Positions and option contracts currently generating time decay income or paying decay cost
                </DialogDescription>
              </div>
            </div>

            {/* Overall Rate Badge */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <div
                className={cn(
                  'px-3 py-1.5 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5',
                  isNetThetaPositive
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                )}
              >
                {isNetThetaPositive ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>
                  {isNetThetaPositive ? '+' : ''}${portfolioTheta.totalDailyTheta.toFixed(2)}/day
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  ({isNetThetaPositive ? '+' : ''}${portfolioTheta.totalMonthlyTheta.toFixed(0)}/mo)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            <Card className="bg-card/60 border-border/60 shadow-sm p-2.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Net Daily Theta
              </span>
              <p
                className={cn(
                  'text-lg font-black font-mono mt-0.5',
                  isNetThetaPositive ? 'text-emerald-400' : 'text-amber-400'
                )}
              >
                {isNetThetaPositive ? '+' : ''}${portfolioTheta.totalDailyTheta.toFixed(2)}
              </p>
              <span className="text-[10px] text-muted-foreground font-mono">
                per calendar day
              </span>
            </Card>

            <Card className="bg-card/60 border-border/60 shadow-sm p-2.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Monthly Projection
              </span>
              <p
                className={cn(
                  'text-lg font-black font-mono mt-0.5',
                  portfolioTheta.totalMonthlyTheta >= 0 ? 'text-emerald-400' : 'text-amber-400'
                )}
              >
                {portfolioTheta.totalMonthlyTheta >= 0 ? '+' : ''}${portfolioTheta.totalMonthlyTheta.toFixed(2)}
              </p>
              <span className="text-[10px] text-muted-foreground font-mono">
                30-day run rate
              </span>
            </Card>

            <Card className="bg-card/60 border-border/60 shadow-sm p-2.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Short Income Harvest
              </span>
              <p className="text-lg font-black font-mono text-emerald-400 mt-0.5">
                +${shortTotal.toFixed(2)}
              </p>
              <span className="text-[10px] text-muted-foreground font-mono">
                {portfolioTheta.shortOptionsCount} short contracts
              </span>
            </Card>

            <Card className="bg-card/60 border-border/60 shadow-sm p-2.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Long Option Drag
              </span>
              <p className="text-lg font-black font-mono text-amber-400 mt-0.5">
                -${longTotal.toFixed(2)}
              </p>
              <span className="text-[10px] text-muted-foreground font-mono">
                {portfolioTheta.longOptionsCount} long contracts
              </span>
            </Card>
          </div>

          {/* Cash Flow Visualizer Bar */}
          {totalVolume > 0 && (
            <div className="mt-3 space-y-1">
              <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Short Harvest: +${shortTotal.toFixed(2)}/d ({shortSharePct.toFixed(0)}%)
                </span>
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  Long Drag: -${longTotal.toFixed(2)}/d ({(100 - shortSharePct).toFixed(0)}%)
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-border/80 overflow-hidden flex">
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${shortSharePct}%` }}
                />
                <div
                  className="bg-amber-500 transition-all"
                  style={{ width: `${100 - shortSharePct}%` }}
                />
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-border/40 bg-card/20 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search ticker, contract..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-background/60 border-border/60 rounded-lg focus-visible:ring-purple-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 text-xs">
            <button
              onClick={() => setFilterCategory('ALL')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0',
                filterCategory === 'ALL'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent/40 text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              All ({allItems.length})
            </button>
            <button
              onClick={() => setFilterCategory('SHORT')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 flex items-center gap-1',
                filterCategory === 'SHORT'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-accent/40 text-muted-foreground hover:bg-accent hover:text-emerald-400'
              )}
            >
              Short (Income)
            </button>
            <button
              onClick={() => setFilterCategory('LONG')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 flex items-center gap-1',
                filterCategory === 'LONG'
                  ? 'bg-amber-600 text-white'
                  : 'bg-accent/40 text-muted-foreground hover:bg-accent hover:text-amber-400'
              )}
            >
              Long (Decay)
            </button>
            <button
              onClick={() => setFilterCategory('CALL')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0',
                filterCategory === 'CALL'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-accent/40 text-muted-foreground hover:bg-accent hover:text-cyan-400'
              )}
            >
              Calls
            </button>
            <button
              onClick={() => setFilterCategory('PUT')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0',
                filterCategory === 'PUT'
                  ? 'bg-purple-600 text-white'
                  : 'bg-accent/40 text-muted-foreground hover:bg-accent hover:text-purple-400'
              )}
            >
              Puts
            </button>
            <button
              onClick={() => setFilterCategory('NEAR_EXPIRY')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 flex items-center gap-1',
                filterCategory === 'NEAR_EXPIRY'
                  ? 'bg-rose-600 text-white'
                  : 'bg-accent/40 text-muted-foreground hover:bg-accent hover:text-rose-400'
              )}
            >
              ≤ 14 DTE
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 self-end md:self-auto text-xs">
            <span className="text-muted-foreground text-[11px] font-medium hidden sm:inline">
              Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-8 px-2 bg-background/60 border border-border/60 rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="THETA_DESC">Highest Income ($/d)</option>
              <option value="THETA_ASC">Highest Decay Cost ($/d)</option>
              <option value="DTE_ASC">Nearest Expiry (DTE)</option>
              <option value="QTY_DESC">Quantity / Size</option>
              <option value="SYMBOL_ASC">Symbol (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Positions List / Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[300px] max-h-[50vh]">
          {sortedPositions.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/40 border border-border/60 flex items-center justify-center text-muted-foreground">
                <Zap className="w-6 h-6 opacity-40" />
              </div>
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-foreground">
                  {allItems.length === 0
                    ? 'No Option Positions in Portfolio'
                    : 'No Matching Positions'}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {allItems.length === 0
                    ? 'Portfolio Theta measures time decay generated by options holdings. Short positions (like covered calls or cash-secured puts) collect positive daily Theta cash flow, while long options pay decay.'
                    : 'No options matched your search query or filter category. Clear filters to see all contracts.'}
                </p>
              </div>
              {allItems.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterCategory('ALL');
                  }}
                  className="h-7 text-xs"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          ) : (
            sortedPositions.map((pt, idx) => {
              const isIncome = pt.dailyDollarTheta >= 0;
              const isCall = pt.optionType === 'CALL';
              const spot = pt.underlyingPrice || 0;
              const strike = pt.strike || 0;
              
              let moneynessLabel = '';
              if (spot > 0 && strike > 0) {
                const diffPct = Math.abs((spot - strike) / strike) * 100;
                const isITM = isCall ? spot > strike : spot < strike;
                moneynessLabel = `${diffPct.toFixed(1)}% ${isITM ? 'ITM' : 'OTM'}`;
              }

              return (
                <Card
                  key={`${pt.symbol}-${idx}`}
                  className="bg-card/50 hover:bg-card/80 border-border/60 hover:border-purple-500/40 transition-all rounded-xl overflow-hidden p-3 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Contract Info */}
                    <div className="flex items-start sm:items-center gap-3">
                      {/* DTE Badge */}
                      <div
                        className={cn(
                          'w-11 h-11 rounded-xl border flex flex-col items-center justify-center font-mono font-bold shrink-0',
                          pt.dte <= 7
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : pt.dte <= 14
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                            : 'bg-accent/40 text-foreground border-border/60'
                        )}
                        title={`${pt.dte} days until expiration`}
                      >
                        <span className="text-xs">{pt.dte}d</span>
                        <span className="text-[9px] uppercase tracking-tighter opacity-70">
                          DTE
                        </span>
                      </div>

                      {/* Details */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground font-mono">
                            {pt.underlyingSymbol}
                          </span>

                          {/* Call / Put Badge */}
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-mono font-bold px-1.5 py-0',
                              isCall
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                                : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            )}
                          >
                            ${pt.strike?.toFixed(1)} {pt.optionType}
                          </Badge>

                          {/* Short vs Long Badge */}
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-mono font-bold px-1.5 py-0',
                              pt.isShort
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            )}
                          >
                            {pt.isShort ? 'Short' : 'Long'} ({pt.quantity > 0 ? `+${pt.quantity}` : pt.quantity}x)
                          </Badge>

                          {/* Broker Tag */}
                          {pt.broker && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/40 text-muted-foreground">
                              {pt.broker}
                            </span>
                          )}

                          {/* ITM/OTM Pill */}
                          {moneynessLabel && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              ({moneynessLabel})
                            </span>
                          )}
                        </div>

                        {/* Contract spec or description */}
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                          <span>Exp: {pt.expiry || '—'}</span>
                          <span>•</span>
                          <span>Per Share: ${pt.thetaPerShare.toFixed(4)}/sh</span>
                          {pt.unrealizedPnL !== undefined && (
                            <>
                              <span>•</span>
                              <span
                                className={
                                  pt.unrealizedPnL >= 0
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                                }
                              >
                                P&L: {pt.unrealizedPnL >= 0 ? '+' : ''}${pt.unrealizedPnL.toFixed(2)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Theta contribution & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      {/* Theta Value */}
                      <div className="text-right">
                        <div
                          className={cn(
                            'text-base sm:text-lg font-black font-mono',
                            isIncome ? 'text-emerald-400' : 'text-amber-400'
                          )}
                        >
                          {isIncome ? '+' : ''}${pt.dailyDollarTheta.toFixed(2)}{' '}
                          <span className="text-xs font-normal text-muted-foreground">
                            / day
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {isIncome ? '+' : ''}${pt.monthlyDollarTheta.toFixed(2)}/mo
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="flex items-center gap-1">
                        {onNavigateToResearch && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              onClose();
                              onNavigateToResearch(pt.underlyingSymbol);
                            }}
                            className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 font-semibold"
                            title={`Navigate to Research for ${pt.underlyingSymbol}`}
                          >
                            <span>Research</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </Button>
                        )}

                        {onOpenAdvisorForPosition && pt.rawPosition && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              onClose();
                              onOpenAdvisorForPosition(pt.rawPosition);
                            }}
                            className="h-7 px-2 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 gap-1 font-semibold"
                            title="Open AI Defense Advisor for this position"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span className="hidden sm:inline">Defense</span>
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopySymbol(pt.symbol || pt.underlyingSymbol)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Copy contract symbol"
                        >
                          {copiedSymbol === (pt.symbol || pt.underlyingSymbol) ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border/50 bg-card/40 flex items-center justify-between text-xs">
          <div className="text-muted-foreground flex items-center gap-2">
            <span>
              Showing <strong className="text-foreground font-mono">{sortedPositions.length}</strong> of{' '}
              <strong className="text-foreground font-mono">{allItems.length}</strong> option contracts
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs font-semibold">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
