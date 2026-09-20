import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Coins,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Calendar,
  Layers,
  ArrowUpRight,
  Search,
  PieChart,
  BarChart3,
  Sliders,
  DollarSign,
  Percent,
  CalendarDays,
  ShieldCheck,
  Check,
  RotateCcw,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  usePortfolioDividendIncome,
  useCalculateDividendIncome,
  PortfolioDividendIncomeReport,
  DividendHoldingItem,
} from '@/services/portfolioDividendService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PortfolioDividendIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToResearch?: (symbol: string) => void;
}

export function PortfolioDividendIncomeModal({
  isOpen,
  onClose,
  onNavigateToResearch,
}: PortfolioDividendIncomeModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyPayers, setShowOnlyPayers] = useState(true);
  const [customOverrides, setCustomOverrides] = useState<Record<string, number>>({});
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editInputValue, setEditInputValue] = useState<string>('');
  const [globalRaiseAdjustment, setGlobalRaiseAdjustment] = useState<number | null>(null);

  // Queries & Mutations
  const {
    data: report,
    isLoading: isReportLoading,
    isFetching,
    refetch,
  } = usePortfolioDividendIncome(isOpen);

  const calculateMutation = useCalculateDividendIncome();

  const handleRefresh = () => {
    calculateMutation.mutate(
      { forceRefresh: true, overrides: Object.keys(customOverrides).length > 0 ? customOverrides : undefined },
      {
        onSuccess: () => toast.success('Portfolio dividend income & raises recalculated'),
        onError: (err) => toast.error(`Recalculation failed: ${err.message}`),
      }
    );
  };

  const activeData: PortfolioDividendIncomeReport | undefined = calculateMutation.data || report;
  const isLoading = isReportLoading || calculateMutation.isPending;

  // Filtered holdings list
  const filteredHoldings = useMemo(() => {
    if (!activeData?.holdings) return [];
    return activeData.holdings.filter((h) => {
      if (showOnlyPayers && !h.isDividendPayer) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        h.symbol.toLowerCase().includes(q) ||
        h.name.toLowerCase().includes(q) ||
        h.sector.toLowerCase().includes(q)
      );
    });
  }, [activeData?.holdings, showOnlyPayers, searchQuery]);

  // Handle individual ticker raise change
  const handleSaveTickerRaise = (symbol: string) => {
    const val = parseFloat(editInputValue);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      const newOverrides = { ...customOverrides, [symbol]: val };
      setCustomOverrides(newOverrides);
      calculateMutation.mutate({ overrides: newOverrides });
      toast.success(`Updated expected raise for ${symbol} to ${val.toFixed(1)}%`);
    }
    setEditingTicker(null);
  };

  // Handle global raise adjustment preset
  const handleApplyGlobalRaise = (raisePct: number) => {
    if (!activeData?.holdings) return;
    const newOverrides: Record<string, number> = {};
    for (const h of activeData.holdings) {
      if (h.isDividendPayer) {
        newOverrides[h.symbol] = raisePct;
      }
    }
    setGlobalRaiseAdjustment(raisePct);
    setCustomOverrides(newOverrides);
    calculateMutation.mutate({ overrides: newOverrides });
    toast.success(`Simulating across-the-board ${raisePct}% dividend raise on all holdings`);
  };

  // Reset to original historical model estimates
  const handleResetOverrides = () => {
    setGlobalRaiseAdjustment(null);
    setCustomOverrides({});
    calculateMutation.mutate({ overrides: {} });
    toast.info('Reset to model baseline dividend raise estimates');
  };

  // Find peak monthly income for chart normalization
  const maxMonthlyIncome = useMemo(() => {
    if (!activeData?.monthlyDistribution) return 1;
    return Math.max(...activeData.monthlyDistribution.map((m) => m.expectedIncomeUSD), 1);
  }, [activeData?.monthlyDistribution]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-6xl max-h-[94vh] overflow-y-auto bg-card/95 backdrop-blur-2xl shadow-2xl p-0 gap-0 border border-border/80 rounded-2xl scrollbar-thin">
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

        {/* Header Ribbon */}
        <div className="p-6 pb-4 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4 pr-12">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shrink-0">
              <Coins className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <DialogTitle className="text-2xl font-black font-mono tracking-tight text-foreground">
                  Expected Dividend Income & Raises
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono font-bold uppercase tracking-wider"
                >
                  Forward 1-Year Forecast
                </Badge>
                {activeData && (
                  <Badge variant="secondary" className="text-[10px] font-mono text-muted-foreground">
                    {activeData.dividendPayerCount} Payers / {activeData.totalHoldingsCount} Holdings
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Calculates annual expected dividend income based on open portfolio holdings and their forward expected dividend raises.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 text-xs font-bold gap-1.5 border-border/70 hover:bg-accent/40 text-muted-foreground hover:text-foreground shadow-sm"
              title="Recalculate dividend income with fresh market data"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin text-emerald-400')} />
              <span>{isLoading ? 'Calculating...' : 'Recalculate'}</span>
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Loading Skeleton */}
          {isLoading && !activeData && (
            <div className="py-16 flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin flex items-center justify-center" />
                <Coins className="w-7 h-7 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold text-foreground text-sm">
                  Analyzing Open Portfolio Holdings & Dividend Raise Histories...
                </p>
                <p className="text-xs text-muted-foreground max-w-md">
                  Fetching current dividend rates, yields, payout dates, and historical dividend hike trajectories across your brokers.
                </p>
              </div>
            </div>
          )}

          {/* Active Data View */}
          {activeData && (
            <>
              {/* TOP KPI HERO CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {/* 1. Current Annual Income */}
                <Card className="bg-background/60 border-border/70 backdrop-blur-sm p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                      Current Annual Income
                    </span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black font-mono tracking-tight text-foreground">
                      ${activeData.currentAnnualIncomeUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">/ yr</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Run rate ~${activeData.monthlyRunRateUSD.toFixed(2)}/mo
                  </p>
                </Card>

                {/* 2. Projected Income with Raises */}
                <Card className="bg-background/60 border-emerald-500/30 bg-emerald-500/5 backdrop-blur-sm p-4 space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider">
                      Projected (With Raises)
                    </span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black font-mono tracking-tight text-emerald-400">
                      ${activeData.projectedAnnualIncomeUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400/80">/ yr</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-mono font-bold px-1.5 py-0"
                    >
                      +${activeData.incrementalRaiseIncomeUSD.toFixed(2)} (+{activeData.totalProjectedRaisePct.toFixed(1)}%)
                    </Badge>
                  </div>
                </Card>

                {/* 3. Portfolio Dividend Yield */}
                <Card className="bg-background/60 border-border/70 backdrop-blur-sm p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                      Portfolio Yield
                    </span>
                    <Percent className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black font-mono tracking-tight text-foreground">
                      {activeData.portfolioWeightedYield.toFixed(2)}%
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">weighted</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {activeData.dividendPayersWeightedYield.toFixed(2)}% on dividend assets
                  </p>
                </Card>

                {/* 4. Weighted Expected Raise */}
                <Card className="bg-background/60 border-border/70 backdrop-blur-sm p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                      Avg Expected Raise
                    </span>
                    <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black font-mono tracking-tight text-cyan-400">
                      +{activeData.portfolioWeightedExpectedRaise.toFixed(1)}%
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">annual hike</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Historical compound trajectory
                  </p>
                </Card>

                {/* 5. Income Coverage */}
                <Card className="bg-background/60 border-border/70 backdrop-blur-sm p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                      Income Coverage
                    </span>
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black font-mono tracking-tight text-foreground">
                      {activeData.portfolioDividendCoveragePct.toFixed(0)}%
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">of portfolio</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    ${activeData.totalDividendHoldingsValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })} invested
                  </p>
                </Card>
              </div>

              {/* 12-MONTH ESTIMATED CASH FLOW DISTRIBUTION */}
              <div className="bg-background/60 border border-border/70 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-foreground uppercase font-mono tracking-wider">
                      12-Month Estimated Cash Flow Schedule (Projected: ${activeData.projectedAnnualIncomeUSD.toFixed(2)}/yr)
                    </h3>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Avg ~${activeData.monthlyAverageIncomeUSD.toFixed(2)} / month
                  </span>
                </div>

                {/* Visual Bar Chart */}
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-2">
                  {activeData.monthlyDistribution.map((m) => {
                    const heightPct = Math.min(100, Math.max(12, Math.round((m.expectedIncomeUSD / maxMonthlyIncome) * 100)));
                    const isAboveAverage = m.expectedIncomeUSD >= activeData.monthlyAverageIncomeUSD;

                    return (
                      <div
                        key={m.month}
                        className="flex flex-col items-center bg-muted/20 border border-border/40 rounded-xl p-2.5 pb-2 transition-all hover:bg-muted/40 hover:border-emerald-500/40 group"
                      >
                        {/* Amount */}
                        <span className="text-[11px] font-mono font-bold text-foreground group-hover:text-emerald-400 transition-colors">
                          ${m.expectedIncomeUSD > 0 ? m.expectedIncomeUSD.toFixed(0) : '0'}
                        </span>

                        {/* Bar Container */}
                        <div className="w-full h-16 flex items-end justify-center my-2">
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={cn(
                              'w-full max-w-[28px] rounded-t-md transition-all duration-500',
                              isAboveAverage
                                ? 'bg-gradient-to-t from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                                : 'bg-gradient-to-t from-emerald-500/40 to-teal-500/40'
                            )}
                          />
                        </div>

                        {/* Month Name */}
                        <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                          {m.monthName}
                        </span>

                        {/* Payer count */}
                        <span className="text-[9px] font-mono text-muted-foreground/80 mt-0.5">
                          {m.holdingsCount} {m.holdingsCount === 1 ? 'payer' : 'payers'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* INTERACTIVE SCENARIO RAISE CONTROLS */}
              <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 border border-emerald-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-foreground font-mono uppercase text-[11px]">
                      Dividend Raise Stress-Test & Simulation:
                    </span>
                    <span className="text-muted-foreground ml-1.5 hidden sm:inline">
                      Simulate across-the-board dividend hikes or customize per ticker in the table below.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono mr-1">
                    Preset Hikes:
                  </span>
                  {[3, 5, 7.5, 10].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleApplyGlobalRaise(pct)}
                      className={cn(
                        'px-2 py-1 rounded-lg font-mono font-bold text-[11px] transition-all border',
                        globalRaiseAdjustment === pct
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                          : 'bg-background/60 text-muted-foreground hover:text-foreground border-border/60 hover:bg-accent/40'
                      )}
                    >
                      +{pct}%
                    </button>
                  ))}

                  {(globalRaiseAdjustment !== null || Object.keys(customOverrides).length > 0) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetOverrides}
                      className="h-7 text-[10px] font-bold text-muted-foreground hover:text-foreground gap-1 ml-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset to Baseline
                    </Button>
                  )}
                </div>
              </div>

              {/* HOLDINGS DIVIDEND BREAKDOWN TABLE */}
              <div className="space-y-3">
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search ticker, company, or sector..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-xs bg-background/50 border-border/70 rounded-xl"
                    />
                  </div>

                  <div className="flex items-center gap-2 self-end">
                    <button
                      type="button"
                      onClick={() => setShowOnlyPayers(!showOnlyPayers)}
                      className={cn(
                        'text-xs font-mono font-bold px-2.5 py-1 rounded-xl border transition-all',
                        showOnlyPayers
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                          : 'bg-background/50 text-muted-foreground border-border/70 hover:text-foreground'
                      )}
                    >
                      {showOnlyPayers ? 'Showing Dividend Payers Only' : 'Showing All Open Holdings'}
                    </button>
                    <span className="text-xs text-muted-foreground font-mono">
                      {filteredHoldings.length} holdings
                    </span>
                  </div>
                </div>

                {/* Table Container */}
                <div className="border border-border/70 rounded-2xl overflow-hidden bg-background/40 backdrop-blur-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border/50">
                        <tr>
                          <th className="py-3 px-3.5">Holding</th>
                          <th className="py-3 px-3 text-right">Shares & Value</th>
                          <th className="py-3 px-3 text-right">Div Rate & Yield</th>
                          <th className="py-3 px-3 text-center">Expected Raise</th>
                          <th className="py-3 px-3 text-right">Current Income</th>
                          <th className="py-3 px-3 text-right">Projected Income</th>
                          <th className="py-3 px-3 text-right">Raise Gain</th>
                          <th className="py-3 px-3 text-center">Frequency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {filteredHoldings.map((h) => {
                          const isCustomized = customOverrides[h.symbol] !== undefined;

                          return (
                            <tr
                              key={h.symbol}
                              className="hover:bg-accent/30 transition-colors group"
                            >
                              {/* Holding Symbol & Name */}
                              <td className="py-3 px-3.5">
                                <div className="flex items-center gap-2">
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onNavigateToResearch) {
                                          onClose();
                                          onNavigateToResearch(h.symbol);
                                        }
                                      }}
                                      className="font-bold text-foreground hover:text-emerald-400 transition-colors flex items-center gap-1 group-hover:underline"
                                    >
                                      {h.symbol}
                                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400" />
                                    </button>
                                    <span className="text-[10px] text-muted-foreground block truncate max-w-[140px]">
                                      {h.name}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Shares & Market Value */}
                              <td className="py-3 px-3 text-right">
                                <span className="font-bold text-foreground block">
                                  {h.shares.toLocaleString()} shs
                                </span>
                                <span className="text-[10px] text-muted-foreground block">
                                  ${h.marketValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                              </td>

                              {/* Dividend Rate & Yield */}
                              <td className="py-3 px-3 text-right">
                                {h.isDividendPayer ? (
                                  <>
                                    <span className="font-bold text-foreground block">
                                      {h.currency === 'GBP' ? '£' : '$'}{h.dividendRate.toFixed(2)}/sh
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-[9px] font-bold px-1.5 py-0',
                                        h.dividendYield >= 5.0
                                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                          : h.dividendYield >= 2.5
                                          ? 'bg-teal-500/15 text-teal-400 border-teal-500/30'
                                          : 'bg-muted text-muted-foreground border-border/50'
                                      )}
                                    >
                                      {h.dividendYield.toFixed(2)}%
                                    </Badge>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">—</span>
                                )}
                              </td>

                              {/* Expected Raise (%) - Editable */}
                              <td className="py-3 px-3 text-center">
                                {h.isDividendPayer ? (
                                  editingTicker === h.symbol ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <Input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        max="100"
                                        value={editInputValue}
                                        onChange={(e) => setEditInputValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveTickerRaise(h.symbol);
                                          if (e.key === 'Escape') setEditingTicker(null);
                                        }}
                                        autoFocus
                                        className="w-16 h-6 text-xs text-center font-mono p-1 bg-background"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSaveTickerRaise(h.symbol)}
                                        className="p-1 text-emerald-400 hover:text-emerald-300"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingTicker(h.symbol);
                                        setEditInputValue(String(h.expectedRaisePercent));
                                      }}
                                      title="Click to edit expected raise %"
                                      className={cn(
                                        'px-2 py-0.5 rounded-lg border text-[11px] font-bold transition-all hover:ring-1 hover:ring-emerald-400',
                                        isCustomized
                                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                          : h.expectedRaisePercent > 0
                                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                          : 'bg-muted/40 text-muted-foreground border-border/50'
                                      )}
                                    >
                                      +{h.expectedRaisePercent.toFixed(1)}%
                                      {isCustomized && <span className="text-[9px] ml-1">*</span>}
                                    </button>
                                  )
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">—</span>
                                )}
                              </td>

                              {/* Current Annual Income */}
                              <td className="py-3 px-3 text-right">
                                <span className="font-bold text-foreground">
                                  ${h.currentAnnualIncomeUSD.toFixed(2)}
                                </span>
                              </td>

                              {/* Projected Annual Income with Raise */}
                              <td className="py-3 px-3 text-right">
                                <span className="font-black text-emerald-400 font-mono">
                                  ${h.projectedAnnualIncomeUSD.toFixed(2)}
                                </span>
                              </td>

                              {/* Incremental Raise Gain */}
                              <td className="py-3 px-3 text-right">
                                {h.incrementalRaiseIncomeUSD > 0 ? (
                                  <span className="text-emerald-400 font-bold">
                                    +${h.incrementalRaiseIncomeUSD.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>

                              {/* Frequency & Payment Months */}
                              <td className="py-3 px-3 text-center">
                                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                                  {h.frequency}
                                </span>
                                {h.paymentMonths.length > 0 && (
                                  <span className="text-[9px] text-muted-foreground/80 block">
                                    {h.paymentMonths.map((m) => MONTH_NAMES[m - 1]).join('/')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* TOP INCOME GENERATORS HIGHLIGHT CARDS */}
              {activeData.topIncomeGenerators.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold text-foreground uppercase font-mono tracking-wider flex items-center gap-2">
                    <PieChart className="w-3.5 h-3.5 text-emerald-400" />
                    Top Dividend Income Anchors
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono">
                    {activeData.topIncomeGenerators.map((gen) => (
                      <div
                        key={gen.symbol}
                        className="bg-background/60 border border-border/60 rounded-xl p-3 space-y-1 hover:border-emerald-500/40 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">{gen.symbol}</span>
                          <span className="text-[10px] text-emerald-400 font-bold">
                            {gen.percentOfTotal.toFixed(1)}%
                          </span>
                        </div>
                        <span className="text-sm font-black text-emerald-400 block">
                          ${gen.incomeUSD.toFixed(2)}/yr
                        </span>
                        <span className="text-[9px] text-muted-foreground block truncate">
                          {gen.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
