import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Compass,
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertTriangle,
  Zap,
  Activity,
  RefreshCw,
  Search,
  LayoutGrid,
  Table as TableIcon,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  ExternalLink,
  Filter,
  SlidersHorizontal,
  Target,
  Layers,
  CheckCircle2,
  LineChart as LineChartIcon,
  Clock,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useTrendFinder,
  TrendItem,
  TrendStage,
  TrendDirection,
  TrendScope,
} from '@/services/trendFinderService';
import { TrendDetailModal } from './TrendDetailModal';

export function formatTrendDate(dateStr?: string): string {
  if (!dateStr) return 'Recent';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

interface TrendFinderCardProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
  onNavigateToTrades?: () => void;
}

type StageFilter = 'ALL' | 'STARTING' | 'ONGOING' | 'EXHAUSTED';
type DirectionFilter = 'ALL' | 'BULLISH' | 'BEARISH';
type ScopeFilter = 'ALL' | 'ASSET_CLASS' | 'SECTOR' | 'INDUSTRY_THEME';
type SortField = 'STRENGTH' | 'EXHAUSTION' | '1D' | '1M' | '3M' | 'RSI';

export function TrendFinderCard({
  onNavigateToResearch,
  onNavigateToGraphs,
  onNavigateToTrades,
}: TrendFinderCardProps) {
  const { data, isLoading, refetch, isFetching } = useTrendFinder();

  const [stageFilter, setStageFilter] = useState<StageFilter>('ALL');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('ALL');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('STRENGTH');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [selectedItem, setSelectedItem] = useState<TrendItem | null>(null);

  const rawItems = data?.items || [];

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    let result = [...rawItems];

    // Stage filter
    if (stageFilter !== 'ALL') {
      result = result.filter((item) => item.stage === stageFilter);
    }

    // Scope filter
    if (scopeFilter !== 'ALL') {
      result = result.filter((item) => item.scope === scopeFilter);
    }

    // Direction filter
    if (directionFilter !== 'ALL') {
      result = result.filter((item) => item.direction === directionFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.symbol.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.subCategory.toLowerCase().includes(q) ||
          item.macroDriver.toLowerCase().includes(q) ||
          item.signals.some((s) => s.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortField === 'STRENGTH') return b.trendStrengthScore - a.trendStrengthScore;
      if (sortField === 'EXHAUSTION') return b.exhaustionRiskScore - a.exhaustionRiskScore;
      if (sortField === '1D') return b.changePercent - a.changePercent;
      if (sortField === '1M') return b.returns['1M'] - a.returns['1M'];
      if (sortField === '3M') return b.returns['3M'] - a.returns['3M'];
      if (sortField === 'RSI') return b.rsi14 - a.rsi14;
      return 0;
    });

    return result;
  }, [rawItems, stageFilter, scopeFilter, directionFilter, searchQuery, sortField]);

  return (
    <Card className="rounded-3xl border border-border/70 bg-gradient-to-br from-card/90 via-card/60 to-accent/10 backdrop-blur-2xl shadow-xl overflow-hidden">
      {/* Top Card Header */}
      <CardHeader className="p-5 sm:p-6 pb-4 border-b border-border/40 bg-accent/5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 via-primary/20 to-cyan-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                  Macro Trend Finder & Lifecycle Scanner
                </CardTitle>
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono font-bold"
                >
                  {rawItems.length} Instruments Scanned
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time technical & momentum classification: Emerging breakouts, sustained multi-timeframe trends, and overbought/oversold exhaustion signals.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:self-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-accent/40 rounded-xl p-0.5 border border-border/60">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all',
                  viewMode === 'grid'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Grid Card View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  'p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all',
                  viewMode === 'table'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Detailed Table View"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 w-9 rounded-xl border-border/70 hover:bg-accent/40 shrink-0"
              title="Rescan Trends"
            >
              <RefreshCw className={cn('w-4 h-4 text-primary', isFetching && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* ================= 1. TOP LIFECYCLE STAGE SELECTOR CARDS ================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-4">
          {/* ALL */}
          <button
            type="button"
            onClick={() => setStageFilter('ALL')}
            className={cn(
              'p-3.5 sm:p-4 rounded-2xl border text-left transition-all relative overflow-hidden',
              stageFilter === 'ALL'
                ? 'bg-accent/50 border-primary shadow-md ring-1 ring-primary/40'
                : 'bg-card/40 border-border/60 hover:bg-card/70'
            )}
          >
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              All Universe
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black font-mono text-foreground">
                {rawItems.length}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {data?.bullishCount ?? 0} Bull • {data?.bearishCount ?? 0} Bear
              </span>
            </div>
          </button>

          {/* TRENDS STARTING */}
          <button
            type="button"
            onClick={() => setStageFilter('STARTING')}
            className={cn(
              'p-3.5 sm:p-4 rounded-2xl border text-left transition-all relative overflow-hidden group',
              stageFilter === 'STARTING'
                ? 'bg-cyan-500/15 border-cyan-400 shadow-md ring-1 ring-cyan-400/40'
                : 'bg-card/40 border-border/60 hover:bg-card/70'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-cyan-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" /> Trends Starting
              </span>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black font-mono text-cyan-300">
                {data?.startingCount ?? 0}
              </span>
              <span className="text-[10px] text-cyan-200/80 font-medium">
                Breakouts / Inflections
              </span>
            </div>
          </button>

          {/* TRENDS ONGOING */}
          <button
            type="button"
            onClick={() => setStageFilter('ONGOING')}
            className={cn(
              'p-3.5 sm:p-4 rounded-2xl border text-left transition-all relative overflow-hidden group',
              stageFilter === 'ONGOING'
                ? 'bg-emerald-500/15 border-emerald-400 shadow-md ring-1 ring-emerald-400/40'
                : 'bg-card/40 border-border/60 hover:bg-card/70'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-300 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> Trends Ongoing
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black font-mono text-emerald-300">
                {data?.ongoingCount ?? 0}
              </span>
              <span className="text-[10px] text-emerald-200/80 font-medium">
                Established Momentum
              </span>
            </div>
          </button>

          {/* TRENDS EXHAUSTED */}
          <button
            type="button"
            onClick={() => setStageFilter('EXHAUSTED')}
            className={cn(
              'p-3.5 sm:p-4 rounded-2xl border text-left transition-all relative overflow-hidden group',
              stageFilter === 'EXHAUSTED'
                ? 'bg-amber-500/15 border-amber-400 shadow-md ring-1 ring-amber-400/40'
                : 'bg-card/40 border-border/60 hover:bg-card/70'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" /> Trends Exhausted
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black font-mono text-amber-300">
                {data?.exhaustedCount ?? 0}
              </span>
              <span className="text-[10px] text-amber-200/80 font-medium">
                Topping / Reversal Watch
              </span>
            </div>
          </button>
        </div>

        {/* ================= 2. MULTI-FACTOR CONTROLS & SEARCH BAR ================= */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker, sector, catalyst..."
              className="h-9 pl-9 text-xs rounded-xl bg-card/60 border-border/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Scope, Direction & Sort Selectors */}
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {/* Scope Filter */}
            <Select
              value={scopeFilter}
              onValueChange={(val) => setScopeFilter(val as ScopeFilter)}
            >
              <SelectTrigger className="h-9 text-xs rounded-xl bg-card/60 border-border/60 min-w-[130px]">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                <SelectItem value="ASSET_CLASS">Asset Classes</SelectItem>
                <SelectItem value="SECTOR">S&P 500 Sectors</SelectItem>
                <SelectItem value="INDUSTRY_THEME">Industries & Themes</SelectItem>
              </SelectContent>
            </Select>

            {/* Direction Filter */}
            <Select
              value={directionFilter}
              onValueChange={(val) => setDirectionFilter(val as DirectionFilter)}
            >
              <SelectTrigger className="h-9 text-xs rounded-xl bg-card/60 border-border/60 min-w-[110px]">
                <SelectValue placeholder="Bias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Bias</SelectItem>
                <SelectItem value="BULLISH">Bullish Only</SelectItem>
                <SelectItem value="BEARISH">Bearish Only</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Selector */}
            <Select
              value={sortField}
              onValueChange={(val) => setSortField(val as SortField)}
            >
              <SelectTrigger className="h-9 text-xs rounded-xl bg-card/60 border-border/60 min-w-[140px]">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STRENGTH">Trend Strength</SelectItem>
                <SelectItem value="EXHAUSTION">Exhaustion Risk</SelectItem>
                <SelectItem value="1D">1D Performance</SelectItem>
                <SelectItem value="1M">1M Performance</SelectItem>
                <SelectItem value="3M">3M Performance</SelectItem>
                <SelectItem value="RSI">RSI Level</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-sm font-semibold text-foreground">
              Scanning 45+ Multi-Asset Instruments for Trend Lifecycle & Exhaustion...
            </p>
            <p className="text-xs text-muted-foreground">
              Computing Moving Average ribbons, 14-RSI divergence, and volatility metrics.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Compass className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold text-foreground">No matching trends found.</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search query, scope, or stage filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStageFilter('ALL');
                setScopeFilter('ALL');
                setDirectionFilter('ALL');
                setSearchQuery('');
              }}
              className="mt-2 text-xs"
            >
              Reset Filters
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          /* ================= 3A. GRID VIEW MODE ================= */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6">
            {filteredItems.map((item) => {
              const isBull = item.direction === 'BULLISH';
              const isStart = item.stage === 'STARTING';
              const isOngoing = item.stage === 'ONGOING';
              const isExhaust = item.stage === 'EXHAUSTED';

              return (
                <div
                  key={item.symbol}
                  onClick={() => setSelectedItem(item)}
                  className="group relative rounded-2xl bg-card/60 hover:bg-card/90 border border-border/70 hover:border-primary/40 p-5 sm:p-6 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
                >
                  {/* Top accent strip based on lifecycle stage */}
                  <div
                    className={cn(
                      'absolute top-0 left-0 right-0 h-1 rounded-t-2xl',
                      isStart
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-400'
                        : isOngoing
                        ? isBull
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : 'bg-gradient-to-r from-rose-500 to-pink-400'
                        : 'bg-gradient-to-r from-amber-500 via-rose-400 to-amber-600'
                    )}
                  />

                  <div>
                    {/* Header: Symbol, SubCategory & Price */}
                    <div className="flex items-start justify-between gap-3 mb-3.5 pt-1">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-11 h-11 rounded-xl flex items-center justify-center font-mono font-bold text-xs border shadow-sm shrink-0',
                            isBull
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          )}
                        >
                          {item.symbol.replace('-USD', '').slice(0, 4)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-sm sm:text-base text-foreground">
                              {item.symbol}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase px-2 py-0.5 h-4.5 bg-accent/40 text-muted-foreground border-border/50"
                            >
                              {item.subCategory}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground truncate block max-w-[170px] mt-0.5">
                            {item.shortName}
                          </span>
                        </div>
                      </div>

                      {/* Right: Live Price & Day Change */}
                      <div className="text-right shrink-0">
                        <span className="text-sm sm:text-base font-black font-mono text-foreground block">
                          ${item.price.toFixed(2)}
                        </span>
                        <span
                          className={cn(
                            'text-xs font-mono font-bold flex items-center justify-end mt-0.5',
                            item.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          )}
                        >
                          {item.changePercent >= 0 ? '+' : ''}
                          {item.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {/* Stage & Direction Badges */}
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-bold px-2.5 py-1 rounded-lg border gap-1.5',
                          isStart
                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                            : isOngoing
                            ? isBull
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        )}
                      >
                        {isStart && <Sparkles className="w-2.5 h-2.5 text-cyan-400" />}
                        {isOngoing && (
                          isBull ? <TrendingUp className="w-2.5 h-2.5 text-emerald-400" /> : <TrendingDown className="w-2.5 h-2.5 text-rose-400" />
                        )}
                        {isExhaust && <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />}
                        <span>
                          {isStart ? '🌱 Starting' : isOngoing ? '🚀 Ongoing' : '⚠️ Exhausted'}
                        </span>
                      </Badge>

                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-mono px-2 py-1 rounded-lg uppercase border',
                          isBull
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        )}
                      >
                        {item.direction}
                      </Badge>

                      <span className="text-[11px] font-mono text-muted-foreground ml-auto bg-accent/30 px-2 py-0.5 rounded-md border border-border/30">
                        RSI: <strong className={item.rsi14 >= 70 ? 'text-rose-400' : item.rsi14 <= 30 ? 'text-emerald-400' : 'text-foreground'}>{item.rsi14.toFixed(0)}</strong>
                      </span>
                    </div>

                    {/* Lifecycle Stage Timing Banner */}
                    {isStart && (
                      <div className="flex items-center gap-2 text-xs font-medium text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-3 py-1.5 rounded-xl mb-3.5 shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>
                          Trend Started: <strong className="font-mono text-cyan-200">{formatTrendDate(item.trendStartDate)}</strong>{' '}
                          <span className="text-cyan-300/80">({item.daysInTrend ?? 1}d in trend)</span>
                        </span>
                      </div>
                    )}
                    {isOngoing && (
                      <div className="flex items-center gap-2 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-xl mb-3.5 shadow-sm">
                        <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          In Trend: <strong className="font-mono text-emerald-200">{item.daysInTrend ?? 1} days</strong>{' '}
                          <span className="text-emerald-300/80">(Started {formatTrendDate(item.trendStartDate)})</span>
                        </span>
                      </div>
                    )}
                    {isExhaust && (
                      <div className="flex items-center gap-2 text-xs font-medium text-amber-300 bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 rounded-xl mb-3.5 shadow-sm">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          Exhaustion Began: <strong className="font-mono text-amber-200">{formatTrendDate(item.exhaustionStartDate)}</strong>{' '}
                          <span className="text-amber-300/80">({item.daysExhausted ?? 1}d ago • {item.daysInTrend ?? 1}d trend)</span>
                        </span>
                      </div>
                    )}

                    {/* Technical Signals Badges */}
                    <div className="flex flex-wrap gap-1.5 mb-3.5">
                      {item.signals.slice(0, 2).map((sig, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-accent/40 text-muted-foreground border border-border/40"
                        >
                          {sig}
                        </span>
                      ))}
                    </div>

                    {/* Macro Catalyst Preview */}
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4 min-h-[2.5rem]">
                      {item.macroDriver}
                    </p>
                  </div>

                  {/* Footer: Multi-Timeframe Strip & Quick Action */}
                  <div className="pt-3.5 mt-auto border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span>1M: <strong className={item.returns['1M'] >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{item.returns['1M'] >= 0 ? '+' : ''}{item.returns['1M'].toFixed(1)}%</strong></span>
                      <span>3M: <strong className={item.returns['3M'] >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{item.returns['3M'] >= 0 ? '+' : ''}{item.returns['3M'].toFixed(1)}%</strong></span>
                    </div>

                    <span className="text-xs text-primary flex items-center gap-1.5 font-semibold group-hover:underline">
                      Inspect <Maximize2 className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ================= 3B. TABLE VIEW MODE ================= */
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/40">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-accent/20 text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                  <th className="p-3 pl-4">Instrument</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Lifecycle Stage</th>
                  <th className="p-3">Trend Timeline & Duration</th>
                  <th className="p-3">Bias</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3 text-right">1D</th>
                  <th className="p-3 text-right">1M</th>
                  <th className="p-3 text-right">3M</th>
                  <th className="p-3 text-center">14-RSI</th>
                  <th className="p-3 text-right">200-SMA Dist</th>
                  <th className="p-3 text-center">Strength</th>
                  <th className="p-3 text-center">Exhaustion</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredItems.map((item) => {
                  const isBull = item.direction === 'BULLISH';
                  const isStart = item.stage === 'STARTING';
                  const isOngoing = item.stage === 'ONGOING';
                  const isExhaust = item.stage === 'EXHAUSTED';

                  return (
                    <tr
                      key={item.symbol}
                      onClick={() => setSelectedItem(item)}
                      className="hover:bg-accent/30 transition-colors cursor-pointer"
                    >
                      <td className="p-3 pl-4 font-mono font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{item.symbol}</span>
                          <span className="text-[10px] text-muted-foreground font-sans font-normal truncate max-w-[120px]">
                            {item.shortName}
                          </span>
                        </div>
                      </td>

                      <td className="p-3 text-muted-foreground">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/40 border border-border/40">
                          {item.subCategory}
                        </span>
                      </td>

                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px] font-bold px-1.5 py-0.5 rounded border',
                            isStart
                              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                              : isOngoing
                              ? isBull
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          )}
                        >
                          {isStart ? '🌱 Starting' : isOngoing ? '🚀 Ongoing' : '⚠️ Exhausted'}
                        </Badge>
                      </td>

                      <td className="p-3 text-xs">
                        {isStart && (
                          <div className="flex flex-col">
                            <span className="font-mono text-cyan-300 font-semibold text-[11px] flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                              Started {formatTrendDate(item.trendStartDate)}
                            </span>
                            <span className="text-[10px] text-muted-foreground pl-3.5">{item.daysInTrend ?? 1}d in trend</span>
                          </div>
                        )}
                        {isOngoing && (
                          <div className="flex flex-col">
                            <span className="font-mono text-emerald-300 font-bold text-[11px] flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                              {item.daysInTrend ?? 1} days in trend
                            </span>
                            <span className="text-[10px] text-muted-foreground pl-3.5">Since {formatTrendDate(item.trendStartDate)}</span>
                          </div>
                        )}
                        {isExhaust && (
                          <div className="flex flex-col">
                            <span className="font-mono text-amber-300 font-semibold text-[11px] flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                              Exhausted {formatTrendDate(item.exhaustionStartDate)}
                            </span>
                            <span className="text-[10px] text-muted-foreground pl-3.5">{item.daysExhausted ?? 1}d ago • {item.daysInTrend ?? 1}d trend</span>
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        <span
                          className={cn(
                            'text-[10px] font-mono font-bold uppercase',
                            isBull ? 'text-emerald-400' : 'text-rose-400'
                          )}
                        >
                          {item.direction}
                        </span>
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-foreground">
                        ${item.price.toFixed(2)}
                      </td>

                      <td
                        className={cn(
                          'p-3 text-right font-mono font-bold',
                          item.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        )}
                      >
                        {item.changePercent >= 0 ? '+' : ''}
                        {item.changePercent.toFixed(2)}%
                      </td>

                      <td
                        className={cn(
                          'p-3 text-right font-mono',
                          item.returns['1M'] >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        )}
                      >
                        {item.returns['1M'] >= 0 ? '+' : ''}
                        {item.returns['1M'].toFixed(1)}%
                      </td>

                      <td
                        className={cn(
                          'p-3 text-right font-mono',
                          item.returns['3M'] >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        )}
                      >
                        {item.returns['3M'] >= 0 ? '+' : ''}
                        {item.returns['3M'].toFixed(1)}%
                      </td>

                      <td className="p-3 text-center font-mono font-semibold">
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[10px]',
                            item.rsi14 >= 70
                              ? 'bg-rose-500/20 text-rose-300'
                              : item.rsi14 <= 30
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'text-foreground'
                          )}
                        >
                          {item.rsi14.toFixed(0)}
                        </span>
                      </td>

                      <td
                        className={cn(
                          'p-3 text-right font-mono font-semibold',
                          item.dist200DmaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        )}
                      >
                        {item.dist200DmaPct >= 0 ? '+' : ''}
                        {item.dist200DmaPct.toFixed(1)}%
                      </td>

                      <td className="p-3 text-center font-mono font-bold text-foreground">
                        {item.trendStrengthScore}
                      </td>

                      <td className="p-3 text-center font-mono font-bold">
                        <span
                          className={cn(
                            item.exhaustionRiskScore > 65
                              ? 'text-amber-400 font-bold'
                              : 'text-muted-foreground'
                          )}
                        >
                          {item.exhaustionRiskScore}
                        </span>
                      </td>

                      <td className="p-3 pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                          className="h-7 text-xs text-primary hover:bg-primary/10 gap-1 px-2"
                        >
                          <span>Inspect</span>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Deep-Dive Inspection Modal */}
      <TrendDetailModal
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
        onNavigateToResearch={onNavigateToResearch}
        onNavigateToGraphs={onNavigateToGraphs}
      />
    </Card>
  );
}
