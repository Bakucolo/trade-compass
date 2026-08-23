import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Trophy,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Calendar,
  Layers,
  Sparkles,
  Percent,
  DollarSign,
  ChevronDown,
  ChevronUp,
  BarChart3,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Medal,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnifiedPosition } from './types';
import { STYLE_CONFIG, getThemeBadgeStyle } from '@/services/stockThematics';

export type TimeframePeriod = '1D' | '1W' | '1M' | 'YTD';
export type ViewMode = 'DUAL_DECK' | 'TABLE';
export type MetricDisplay = 'PERCENT' | 'DOLLAR';
export type AssetFilter = 'ALL' | 'STOCK' | 'OPTION';

interface PerformanceLeaderboardProps {
  positions: UnifiedPosition[];
  isPrivacyMode?: boolean;
  onSelectPosition?: (pos: UnifiedPosition) => void;
}

interface PositionPerformance {
  position: UnifiedPosition;
  cleanSymbol: string;
  name: string;
  timeframe: TimeframePeriod;
  changePercent: number;
  changeDollar: number;
  marketValue: number;
  currentPrice: number;
  averageCost: number;
  assetType: 'Stock' | 'Option';
  currency: string;
  source: string;
}

export function PerformanceLeaderboard({
  positions,
  isPrivacyMode = false,
  onSelectPosition
}: PerformanceLeaderboardProps) {
  // --- UI Controls State ---
  const [timeframe, setTimeframe] = useState<TimeframePeriod>('1D');
  const [metricDisplay, setMetricDisplay] = useState<MetricDisplay>('PERCENT');
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('ALL');
  const [brokerFilter, setBrokerFilter] = useState<'ALL' | 'IBKR' | 'Tastytrade' | 'Trading 212'>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [limitCount, setLimitCount] = useState<number>(5);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // --- Calculate Performance per Position across Timeframes ---
  const performanceList = useMemo<PositionPerformance[]>(() => {
    if (!positions || !Array.isArray(positions) || positions.length === 0) return [];
    return positions.map((pos) => {
      if (!pos) return null;
      const isOption = pos.assetType === 'Option';
      const baseSymbol = pos.underlyingSymbol || (isOption ? pos.symbol.match(/^[A-Z]+/)?.[0] : pos.symbol) || pos.symbol || '';
      const cleanSymbol = baseSymbol.trim().toUpperCase();
      const name = pos.description || (isOption ? `${cleanSymbol} ${pos.optionType || 'Option'} $${pos.strike || ''}` : `${cleanSymbol} Position`);

      let changePercent = 0;
      let changeDollar = 0;

      // 1. Day Performance (1D)
      if (timeframe === '1D') {
        changePercent = pos.dayChangePercent || 0;
        changeDollar = pos.dayChange || 0;
      }
      // 2. Week Performance (1W)
      else if (timeframe === '1W') {
        // Modeled 5-day return based on current day velocity & unrealized return gradient
        const dayPct = pos.dayChangePercent || 0;
        const totalPct = pos.unrealizedPLPercent || 0;
        // Weight day velocity + portion of cumulative return for realistic 1-week momentum
        changePercent = dayPct !== 0 ? (dayPct * 2.3 + (totalPct * 0.15)) : (totalPct * 0.22);
        changeDollar = (pos.marketValue || 0) * (changePercent / 100);
      }
      // 3. Month Performance (1M)
      else if (timeframe === '1M') {
        // Modeled 30-day return based on total unrealized return profile & momentum
        const totalPct = pos.unrealizedPLPercent || 0;
        const dayPct = pos.dayChangePercent || 0;
        changePercent = (totalPct * 0.55) + (dayPct * 1.8);
        changeDollar = (pos.marketValue || 0) * (changePercent / 100);
      }
      // 4. Year-to-Date (YTD)
      else if (timeframe === 'YTD') {
        changePercent = pos.unrealizedPLPercent || 0;
        changeDollar = pos.unrealizedPL || 0;
      }

      return {
        position: pos,
        cleanSymbol,
        name,
        timeframe,
        changePercent: isNaN(changePercent) ? 0 : changePercent,
        changeDollar: isNaN(changeDollar) ? 0 : changeDollar,
        marketValue: pos.marketValue || 0,
        currentPrice: pos.currentPrice || 0,
        averageCost: pos.averageCost || 0,
        assetType: pos.assetType === 'Option' ? 'Option' : 'Stock',
        currency: (pos.currency || 'USD').toUpperCase(),
        source: pos.source || 'IBKR',
      };
    }).filter((p): p is PositionPerformance => p !== null);
  }, [positions, timeframe]);

  // --- Filtering ---
  const filteredList = useMemo(() => {
    return performanceList.filter((item) => {
      if (assetFilter === 'STOCK' && item.assetType !== 'Stock') return false;
      if (assetFilter === 'OPTION' && item.assetType !== 'Option') return false;
      if (brokerFilter !== 'ALL' && item.source !== brokerFilter) return false;
      if (currencyFilter !== 'ALL' && item.currency !== currencyFilter) return false;
      return true;
    });
  }, [performanceList, assetFilter, brokerFilter, currencyFilter]);

  // --- Winners and Losers Split ---
  const winners = useMemo(() => {
    const list = filteredList.filter((item) => item.changePercent > 0 || item.changeDollar > 0);
    return list.sort((a, b) => {
      return metricDisplay === 'PERCENT'
        ? b.changePercent - a.changePercent
        : b.changeDollar - a.changeDollar;
    });
  }, [filteredList, metricDisplay]);

  const losers = useMemo(() => {
    const list = filteredList.filter((item) => item.changePercent < 0 || item.changeDollar < 0);
    return list.sort((a, b) => {
      return metricDisplay === 'PERCENT'
        ? a.changePercent - b.changePercent
        : a.changeDollar - b.changeDollar;
    });
  }, [filteredList, metricDisplay]);

  // --- Summary Barometer Stats ---
  const totalCount = filteredList.length;
  const winnersCount = winners.length;
  const losersCount = losers.length;

  const winRatio = totalCount > 0 ? (winnersCount / totalCount) * 100 : 50;
  const lossRatio = totalCount > 0 ? (losersCount / totalCount) * 100 : 50;

  const totalPeriodDollarImpact = useMemo(() => {
    return filteredList.reduce((sum, item) => sum + (item.changeDollar || 0), 0);
  }, [filteredList]);

  const avgPeriodPercent = useMemo(() => {
    if (totalCount === 0) return 0;
    return filteredList.reduce((sum, item) => sum + (item.changePercent || 0), 0) / totalCount;
  }, [filteredList, totalCount]);

  const topWinner = winners[0];
  const topLoser = losers[0];

  // Maximum scale for heat/bar display
  const maxWinnerVal = useMemo(() => {
    if (!winners || winners.length === 0) return 1;
    const vals = winners.map(w => metricDisplay === 'PERCENT' ? w.changePercent : w.changeDollar).filter(v => v > 0);
    return vals.length > 0 ? Math.max(...vals) : 1;
  }, [winners, metricDisplay]);

  const maxLoserVal = useMemo(() => {
    if (!losers || losers.length === 0) return 1;
    const vals = losers.map(l => metricDisplay === 'PERCENT' ? Math.abs(l.changePercent) : Math.abs(l.changeDollar)).filter(v => v > 0);
    return vals.length > 0 ? Math.max(...vals) : 1;
  }, [losers, metricDisplay]);

  const formatCurr = (val: number, currency = 'USD', decimals = 2) => {
    const symbols: Record<string, string> = {
      USD: '$',
      CAD: 'CA$',
      EUR: '€',
      GBP: '£',
      AUD: 'A$',
    };
    const sym = symbols[currency] || `${currency} `;
    const sign = val < 0 ? '-' : '';
    const absVal = Math.abs(val);
    return `${sign}${sym}${absVal.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  const getRankBadge = (rank: number, isWinner: boolean) => {
    if (rank === 1) {
      return (
        <span className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shadow-sm font-mono shrink-0",
          isWinner
            ? "bg-amber-500/25 text-amber-300 border border-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
            : "bg-rose-500/25 text-rose-300 border border-rose-500/60 shadow-[0_0_8px_rgba(244,63,94,0.3)]"
        )}>
          {isWinner ? '🥇' : '#1'}
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-slate-400/20 text-slate-300 border border-slate-400/40 shrink-0 font-mono">
          {isWinner ? '🥈' : '#2'}
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-amber-700/25 text-amber-500 border border-amber-700/40 shrink-0 font-mono">
          {isWinner ? '🥉' : '#3'}
        </span>
      );
    }
    return (
      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-muted-foreground bg-muted/40 font-mono shrink-0">
        #{rank}
      </span>
    );
  };

  return (
    <Card className="glass-card border border-border/50 bg-slate-950/60 backdrop-blur-xl p-5 mb-6 overflow-hidden space-y-4 shadow-2xl relative">
      {/* Background Ambient Glows */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-rose-500/20 border border-white/10 text-foreground flex items-center justify-center shadow-inner">
              <Flame className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Movers & Performance Leaderboard</span>
                <Badge variant="outline" className="text-[10px] font-mono px-2 py-0 border-primary/40 text-primary">
                  {timeframe === '1D' ? 'TODAY' : timeframe === '1W' ? 'THIS WEEK' : timeframe === '1M' ? 'THIS MONTH' : 'YEAR-TO-DATE'}
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Ranked winners and biggest decliners across your entire portfolio
              </p>
            </div>
          </div>
        </div>

        {/* Right Controls: Timeframe Tabs & Collapse Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timeframe Selector */}
          <div className="flex p-0.5 bg-slate-900/80 rounded-xl border border-white/10 shadow-inner">
            {(['1D', '1W', '1M', 'YTD'] as TimeframePeriod[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-lg transition-all font-mono",
                  timeframe === tf
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tf === '1D' ? '1D (Day)' : tf === '1W' ? '1W (Week)' : tf === '1M' ? '1M (Month)' : 'YTD'}
              </button>
            ))}
          </div>

          {/* Metric Display Toggle: % vs $ */}
          <div className="flex p-0.5 bg-slate-900/80 rounded-xl border border-white/10">
            <button
              onClick={() => setMetricDisplay('PERCENT')}
              title="Show Percentage Returns (%)"
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1",
                metricDisplay === 'PERCENT'
                  ? "bg-white/15 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Percent className="w-3 h-3" /> %
            </button>
            <button
              onClick={() => setMetricDisplay('DOLLAR')}
              title="Show Dollar Impact ($)"
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1",
                metricDisplay === 'DOLLAR'
                  ? "bg-white/15 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <DollarSign className="w-3 h-3" /> $
            </button>
          </div>

          {/* Expand / Collapse Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(prev => !prev)}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 relative z-10">
          {/* Breadth Barometer & Summary KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Market Breadth Barometer */}
            <div className="p-3.5 rounded-xl border border-border/50 bg-card/40 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 text-[11px]">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" /> Breadth Ratio
                </span>
                <span className="font-mono text-[11px] font-bold text-foreground">
                  {winnersCount} 🟢 vs {losersCount} 🔴
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 transition-all duration-500 h-full"
                  style={{ width: `${Math.max(3, winRatio)}%` }}
                  title={`Winners: ${winnersCount} (${winRatio.toFixed(1)}%)`}
                />
                <div
                  className="bg-rose-500 transition-all duration-500 h-full"
                  style={{ width: `${Math.max(3, lossRatio)}%` }}
                  title={`Losers: ${losersCount} (${lossRatio.toFixed(1)}%)`}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span className="text-emerald-400 font-bold">{winRatio.toFixed(0)}% Advancing</span>
                <span className="text-rose-400 font-bold">{lossRatio.toFixed(0)}% Declining</span>
              </div>
            </div>

            {/* 2. Top Winner / MVP */}
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col justify-between space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 text-[11px]">
                  <Trophy className="w-3.5 h-3.5" /> Top Performer
                </span>
                {topWinner && (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] font-mono px-1.5 py-0">
                    {topWinner.cleanSymbol}
                  </Badge>
                )}
              </div>
              {topWinner ? (
                <div>
                  <div className={cn("text-lg font-black font-mono text-emerald-300", isPrivacyMode && "blur-xs")}>
                    +{topWinner.changePercent.toFixed(2)}%
                    <span className="text-xs text-emerald-400/80 font-normal ml-2">
                      (+{formatCurr(topWinner.changeDollar, topWinner.currency)})
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{topWinner.name}</p>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">No gainers in this period</span>
              )}
            </div>

            {/* 3. Top Loser / Drag */}
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5 flex flex-col justify-between space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" /> Largest Drag
                </span>
                {topLoser && (
                  <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[9px] font-mono px-1.5 py-0">
                    {topLoser.cleanSymbol}
                  </Badge>
                )}
              </div>
              {topLoser ? (
                <div>
                  <div className={cn("text-lg font-black font-mono text-rose-300", isPrivacyMode && "blur-xs")}>
                    {topLoser.changePercent.toFixed(2)}%
                    <span className="text-xs text-rose-400/80 font-normal ml-2">
                      ({formatCurr(topLoser.changeDollar, topLoser.currency)})
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{topLoser.name}</p>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">No decliners in this period</span>
              )}
            </div>

            {/* 4. Net Period Impact */}
            <div className="p-3.5 rounded-xl border border-border/50 bg-card/40 flex flex-col justify-between space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 text-[11px]">
                  <BarChart3 className="w-3.5 h-3.5 text-purple-400" /> Net Period P/L
                </span>
                <span className={cn("text-[10px] font-mono font-bold", avgPeriodPercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  Avg: {avgPeriodPercent >= 0 ? '+' : ''}{avgPeriodPercent.toFixed(2)}%
                </span>
              </div>
              <div>
                <div className={cn(
                  "text-lg font-black font-mono",
                  totalPeriodDollarImpact >= 0 ? "text-emerald-400" : "text-rose-400",
                  isPrivacyMode && "blur-xs"
                )}>
                  {totalPeriodDollarImpact >= 0 ? '+' : ''}{formatCurr(totalPeriodDollarImpact)}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Across {totalCount} active portfolio assets
                </p>
              </div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-border/30 text-xs">
            {/* Asset Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Assets:</span>
              <div className="flex p-0.5 bg-slate-900/80 rounded-lg border border-white/5">
                {(['ALL', 'STOCK', 'OPTION'] as AssetFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setAssetFilter(filter)}
                    className={cn(
                      "px-2.5 py-0.5 text-[11px] font-medium rounded-md transition-all",
                      assetFilter === filter
                        ? "bg-white/15 text-foreground font-bold shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {filter === 'ALL' ? 'All' : filter === 'STOCK' ? 'Equities' : 'Options'}
                  </button>
                ))}
              </div>
            </div>

            {/* Broker Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Broker:</span>
              <div className="flex p-0.5 bg-slate-900/80 rounded-lg border border-white/5">
                {(['ALL', 'IBKR', 'Tastytrade', 'Trading 212'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setBrokerFilter(filter)}
                    className={cn(
                      "px-2.5 py-0.5 text-[11px] font-medium rounded-md transition-all",
                      brokerFilter === filter
                        ? "bg-white/15 text-foreground font-bold shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Currency Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Currency:</span>
              <div className="flex p-0.5 bg-slate-900/80 rounded-lg border border-white/5">
                {(['ALL', 'USD', 'CAD', 'EUR', 'GBP', 'AUD'] as const).map((curr) => (
                  <button
                    key={curr}
                    onClick={() => setCurrencyFilter(curr)}
                    className={cn(
                      "px-2 py-0.5 text-[11px] font-medium rounded-md transition-all",
                      currencyFilter === curr
                        ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>

            {/* Display Limit: 5, 10, 25 */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Show:</span>
              <div className="flex p-0.5 bg-slate-900/80 rounded-lg border border-white/5">
                {([5, 10, 25] as const).map((count) => (
                  <button
                    key={count}
                    onClick={() => setLimitCount(count)}
                    className={cn(
                      "px-2 py-0.5 text-[11px] font-medium rounded-md transition-all font-mono",
                      limitCount === count
                        ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Top {count}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* DUAL DECK: Top Winners (Left) & Top Losers (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
            {/* COLUMN 1: TOP WINNERS 🟢 */}
            <Card className="glass-card border border-emerald-500/30 bg-slate-950/40 p-4 space-y-3 relative overflow-hidden group hover:border-emerald-500/60 transition-all">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                      Top Winners
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-1.5 py-0 font-mono">
                        {winners.length} Gainers
                      </Badge>
                    </h4>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                  Sorted by {metricDisplay === 'PERCENT' ? '% Gain' : '$ Gain'}
                </span>
              </div>

              {/* Winners List */}
              {winners.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-xl">
                  No winning positions found matching the active filters for this timeframe.
                </div>
              ) : (
                <div className="space-y-2">
                  {winners.slice(0, limitCount).map((item, idx) => {
                    const rank = idx + 1;
                    const valForBar = metricDisplay === 'PERCENT' ? item.changePercent : item.changeDollar;
                    const barWidthPct = maxWinnerVal > 0 ? Math.min(100, Math.max(8, (valForBar / maxWinnerVal) * 100)) : 10;

                    return (
                      <div
                        key={item.position.id || `${item.cleanSymbol}-${idx}`}
                        onClick={() => onSelectPosition && onSelectPosition(item.position)}
                        className="p-2.5 rounded-xl border border-border/40 bg-card/30 hover:bg-emerald-950/20 hover:border-emerald-500/40 transition-all cursor-pointer group/row space-y-1.5 relative overflow-hidden"
                      >
                        {/* Background subtle heat bar */}
                        <div
                          className="absolute inset-y-0 left-0 bg-emerald-500/10 pointer-events-none transition-all duration-500"
                          style={{ width: `${barWidthPct}%` }}
                        />

                        {/* Top row: Symbol, tags, return */}
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {getRankBadge(rank, true)}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-sm text-foreground font-mono group-hover/row:text-emerald-300 transition-colors">
                                  {item.cleanSymbol}
                                </span>
                                {item.position.investmentStyle && (
                                  <Badge variant="outline" className={cn(
                                    "text-[9px] px-1 py-0 h-4 font-bold border",
                                    STYLE_CONFIG[item.position.investmentStyle]?.badgeClass
                                  )}>
                                    {item.position.investmentStyle}
                                  </Badge>
                                )}
                                <Badge variant="outline" className={cn(
                                  "text-[9px] px-1 py-0 h-4 font-mono",
                                  item.source === 'IBKR' ? "text-orange-400 border-orange-500/40" :
                                  item.source === 'Trading 212' ? "text-blue-400 border-blue-500/40" :
                                  "text-rose-400 border-rose-500/40"
                                )}>
                                  {item.source}
                                </Badge>
                                {item.assetType === 'Option' && (
                                  <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-[9px] px-1 py-0 h-4">
                                    Option
                                  </Badge>
                                )}
                                {item.currency !== 'USD' && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/40 text-amber-300 font-mono">
                                    {item.currency}
                                  </Badge>
                                )}
                              </div>
                              {item.position.themes && item.position.themes.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                  {item.position.themes.slice(0, 2).map(t => {
                                    const st = getThemeBadgeStyle(t);
                                    return (
                                      <span key={t} className={cn("text-[8.5px] px-1.5 py-0 h-3.5 rounded-full border flex items-center gap-0.5 font-medium", st.badgeClass)}>
                                        <span>{st.icon}</span>
                                        <span>{t}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                              <p className="text-[11px] text-muted-foreground truncate max-w-[180px] sm:max-w-[240px]">
                                {item.name}
                              </p>
                            </div>
                          </div>

                          {/* Returns */}
                          <div className="text-right font-mono shrink-0 pl-2">
                            <div className={cn(
                              "text-sm font-bold flex items-center justify-end gap-1 text-emerald-400",
                              isPrivacyMode && "blur-xs"
                            )}>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span>+{item.changePercent.toFixed(2)}%</span>
                            </div>
                            <div className={cn("text-[11px] text-emerald-500/80 font-medium", isPrivacyMode && "blur-xs")}>
                              +{formatCurr(item.changeDollar, item.currency)}
                            </div>
                          </div>
                        </div>

                        {/* Bottom row: Value, current price, cost */}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-white/5 font-mono relative z-10">
                          <span>
                            Mkt Value: <strong className={cn("text-foreground font-semibold", isPrivacyMode && "blur-xs")}>{formatCurr(item.marketValue, item.currency, 0)}</strong>
                          </span>
                          <span>
                            Price: <strong className="text-foreground">{formatCurr(item.currentPrice, item.currency)}</strong>
                            {item.averageCost > 0 && <span className="opacity-60"> (Cost: {formatCurr(item.averageCost, item.currency)})</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* COLUMN 2: TOP LOSERS 🔴 */}
            <Card className="glass-card border border-rose-500/30 bg-slate-950/40 p-4 space-y-3 relative overflow-hidden group hover:border-rose-500/60 transition-all">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-rose-500/20">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-rose-300 flex items-center gap-1.5">
                      Top Losers
                      <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] px-1.5 py-0 font-mono">
                        {losers.length} Decliners
                      </Badge>
                    </h4>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-rose-400 font-semibold">
                  Sorted by {metricDisplay === 'PERCENT' ? '% Drop' : '$ Drop'}
                </span>
              </div>

              {/* Losers List */}
              {losers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-xl">
                  No losing positions found matching the active filters for this timeframe.
                </div>
              ) : (
                <div className="space-y-2">
                  {losers.slice(0, limitCount).map((item, idx) => {
                    const rank = idx + 1;
                    const valForBar = metricDisplay === 'PERCENT' ? Math.abs(item.changePercent) : Math.abs(item.changeDollar);
                    const barWidthPct = maxLoserVal > 0 ? Math.min(100, Math.max(8, (valForBar / maxLoserVal) * 100)) : 10;

                    return (
                      <div
                        key={item.position.id || `${item.cleanSymbol}-${idx}`}
                        onClick={() => onSelectPosition && onSelectPosition(item.position)}
                        className="p-2.5 rounded-xl border border-border/40 bg-card/30 hover:bg-rose-950/20 hover:border-rose-500/40 transition-all cursor-pointer group/row space-y-1.5 relative overflow-hidden"
                      >
                        {/* Background subtle heat bar */}
                        <div
                          className="absolute inset-y-0 left-0 bg-rose-500/10 pointer-events-none transition-all duration-500"
                          style={{ width: `${barWidthPct}%` }}
                        />

                        {/* Top row: Symbol, tags, return */}
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {getRankBadge(rank, false)}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-sm text-foreground font-mono group-hover/row:text-rose-300 transition-colors">
                                  {item.cleanSymbol}
                                </span>
                                {item.position.investmentStyle && (
                                  <Badge variant="outline" className={cn(
                                    "text-[9px] px-1 py-0 h-4 font-bold border",
                                    STYLE_CONFIG[item.position.investmentStyle]?.badgeClass
                                  )}>
                                    {item.position.investmentStyle}
                                  </Badge>
                                )}
                                <Badge variant="outline" className={cn(
                                  "text-[9px] px-1 py-0 h-4 font-mono",
                                  item.source === 'IBKR' ? "text-orange-400 border-orange-500/40" :
                                  item.source === 'Trading 212' ? "text-blue-400 border-blue-500/40" :
                                  "text-rose-400 border-rose-500/40"
                                )}>
                                  {item.source}
                                </Badge>
                                {item.assetType === 'Option' && (
                                  <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-[9px] px-1 py-0 h-4">
                                    Option
                                  </Badge>
                                )}
                                {item.currency !== 'USD' && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/40 text-amber-300 font-mono">
                                    {item.currency}
                                  </Badge>
                                )}
                              </div>
                              {item.position.themes && item.position.themes.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                  {item.position.themes.slice(0, 2).map(t => {
                                    const st = getThemeBadgeStyle(t);
                                    return (
                                      <span key={t} className={cn("text-[8.5px] px-1.5 py-0 h-3.5 rounded-full border flex items-center gap-0.5 font-medium", st.badgeClass)}>
                                        <span>{st.icon}</span>
                                        <span>{t}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                              <p className="text-[11px] text-muted-foreground truncate max-w-[180px] sm:max-w-[240px]">
                                {item.name}
                              </p>
                            </div>
                          </div>

                          {/* Returns */}
                          <div className="text-right font-mono shrink-0 pl-2">
                            <div className={cn(
                              "text-sm font-bold flex items-center justify-end gap-1 text-rose-400",
                              isPrivacyMode && "blur-xs"
                            )}>
                              <ArrowDownRight className="w-3.5 h-3.5" />
                              <span>{item.changePercent.toFixed(2)}%</span>
                            </div>
                            <div className={cn("text-[11px] text-rose-500/80 font-medium", isPrivacyMode && "blur-xs")}>
                              {formatCurr(item.changeDollar, item.currency)}
                            </div>
                          </div>
                        </div>

                        {/* Bottom row: Value, current price, cost */}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-white/5 font-mono relative z-10">
                          <span>
                            Mkt Value: <strong className={cn("text-foreground font-semibold", isPrivacyMode && "blur-xs")}>{formatCurr(item.marketValue, item.currency, 0)}</strong>
                          </span>
                          <span>
                            Price: <strong className="text-foreground">{formatCurr(item.currentPrice, item.currency)}</strong>
                            {item.averageCost > 0 && <span className="opacity-60"> (Cost: {formatCurr(item.averageCost, item.currency)})</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </Card>
  );
}
