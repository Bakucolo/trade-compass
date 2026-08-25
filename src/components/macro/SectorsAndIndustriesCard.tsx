import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  BarChart3,
  Sparkles,
  RefreshCw,
  Search,
  Maximize2,
  ExternalLink,
  Info,
  Zap,
  Flame,
  ArrowUpRight,
  ShieldCheck,
  Scale,
  Compass,
  LineChart as LineChartIcon,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SectorItem,
  SectorTimeframe,
  SectorScope,
  useSectorsOverview,
  useSectorsHistory,
} from '@/services/sectorsService';
import { SectorDeepDiveModal } from './SectorDeepDiveModal';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
  LineChart,
  Line,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';

interface SectorsAndIndustriesCardProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
}

type ViewMode = 'HEATMAP_GRID' | 'LEADERBOARD_BARS' | 'ROTATION_QUADRANT' | 'COMPARATIVE_TIMELINE';
type ScopeFilter = 'all' | 'sector' | 'industry';

export function SectorsAndIndustriesCard({
  onNavigateToResearch,
  onNavigateToGraphs,
}: SectorsAndIndustriesCardProps) {
  const { data: overview, isLoading, isFetching, refetch } = useSectorsOverview();

  const [timeframe, setTimeframe] = useState<SectorTimeframe>('1M');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('HEATMAP_GRID');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<SectorItem | null>(null);

  // Selected symbols for multi-line comparative chart
  const [activeCompareSymbols, setActiveCompareSymbols] = useState<string[]>([
    'XLK',
    'XLF',
    'XLE',
    'XLU',
    'SMH',
  ]);

  const { data: historyData, isLoading: isHistoryLoading } = useSectorsHistory(
    activeCompareSymbols,
    timeframe === '1D' ? '1W' : timeframe
  );

  const allItems = overview?.all || [];
  const benchmark = overview?.benchmark;
  const rotationRatios = overview?.rotationRatios;
  const breadth = overview?.breadth;
  const emergingTrends = overview?.emergingTrends || [];

  // Filter and Sort Items
  const filteredItems = useMemo(() => {
    let list = allItems;
    if (scope === 'sector') {
      list = list.filter((i) => i.category === 'sector');
    } else if (scope === 'industry') {
      list = list.filter((i) => i.category === 'industry');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.symbol.toLowerCase().includes(q) ||
          i.shortName.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          (i.sectorGroup && i.sectorGroup.toLowerCase().includes(q))
      );
    }

    // Sort by return of selected timeframe descending
    return [...list].sort((a, b) => b.returns[timeframe] - a.returns[timeframe]);
  }, [allItems, scope, searchQuery, timeframe]);

  // Heatmap Color Generator
  const getHeatmapBg = (ret: number) => {
    if (ret >= 6.0) return 'bg-emerald-950/50 border-emerald-500/50 hover:border-emerald-400';
    if (ret >= 3.0) return 'bg-emerald-950/30 border-emerald-600/40 hover:border-emerald-400';
    if (ret >= 0.5) return 'bg-emerald-950/20 border-emerald-700/30 hover:border-emerald-400';
    if (ret > -0.5) return 'bg-card/40 border-border/40 hover:border-border/70';
    if (ret > -3.0) return 'bg-rose-950/20 border-rose-700/30 hover:border-rose-400';
    if (ret > -6.0) return 'bg-rose-950/30 border-rose-600/40 hover:border-rose-400';
    return 'bg-rose-950/50 border-rose-500/50 hover:border-rose-400';
  };

  const getRotationStageBadge = (stage: SectorItem['rotationStage']) => {
    switch (stage) {
      case 'Leading':
        return { label: 'Leading', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-400' };
      case 'Weakening':
        return { label: 'Weakening', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40', dot: 'bg-amber-400' };
      case 'Improving':
        return { label: 'Improving', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40', dot: 'bg-cyan-400' };
      case 'Lagging':
        return { label: 'Lagging', badge: 'bg-rose-500/15 text-rose-300 border-rose-500/40', dot: 'bg-rose-400' };
    }
  };

  const toggleCompareSymbol = (sym: string) => {
    if (activeCompareSymbols.includes(sym)) {
      if (activeCompareSymbols.length > 1) {
        setActiveCompareSymbols(activeCompareSymbols.filter((s) => s !== sym));
      }
    } else {
      if (activeCompareSymbols.length < 8) {
        setActiveCompareSymbols([...activeCompareSymbols, sym]);
      }
    }
  };

  const TIMEFRAMES: { id: SectorTimeframe; label: string }[] = [
    { id: '1D', label: '1D' },
    { id: '1W', label: '1W' },
    { id: '1M', label: '1M' },
    { id: '3M', label: '3M' },
    { id: '6M', label: '6M' },
    { id: 'YTD', label: 'YTD' },
    { id: '1Y', label: '1Y' },
  ];

  const LINE_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#ec4899', '#a855f7', '#fb7185', '#60a5fa', '#f97316'];

  return (
    <Card className="bg-card/70 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-3xl overflow-hidden relative group">
      {/* Top Ambient Highlight */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-primary to-purple-500" />

      {/* ================= 1. CARD HEADER & TOOLBAR ================= */}
      <CardHeader className="p-5 pb-4 border-b border-border/50 bg-accent/10 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/20 via-cyan-500/20 to-primary/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-sm font-bold">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                  <span>Sectors & Industry Intelligence Station</span>
                </CardTitle>
                <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-[10px] font-mono font-bold">
                  11 GICS Sectors + 16 Sub-Industries
                </Badge>
                {benchmark?.spy && (
                  <Badge variant="outline" className="text-[10px] font-mono font-bold border-cyan-500/40 text-cyan-300 bg-cyan-500/10">
                    SPY Benchmark ({timeframe}): {benchmark.spy.returns[timeframe] >= 0 ? '+' : ''}{benchmark.spy.returns[timeframe]?.toFixed(2)}%
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Track weekly, monthly, and multi-timeframe capital rotations, relative strength alpha, and emerging thematic trends.
              </p>
            </div>
          </div>

          {/* Timeframe Selector & Refresh */}
          <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
            {/* Multi-Timeframe Pills */}
            <div className="flex items-center bg-card/90 p-1 rounded-2xl border border-border/70 shadow-inner">
              {TIMEFRAMES.map((tf) => {
                const isActive = timeframe === tf.id;
                return (
                  <button
                    key={tf.id}
                    onClick={() => setTimeframe(tf.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 w-8 rounded-xl border-border/70 hover:bg-accent/40 shadow-sm shrink-0"
              title="Refresh Sector Telemetry"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-primary", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Second Row Toolbar: Scope Filter, Search, and View Mode Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-t border-border/30">
          {/* Scope Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              onClick={() => setScope('all')}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-bold transition-all border",
                scope === 'all'
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm"
                  : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground"
              )}
            >
              All Assets ({allItems.length})
            </button>
            <button
              onClick={() => setScope('sector')}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-bold transition-all border",
                scope === 'sector'
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm"
                  : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground"
              )}
            >
              11 GICS Sectors
            </button>
            <button
              onClick={() => setScope('industry')}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-bold transition-all border",
                scope === 'industry'
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                  : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground"
              )}
            >
              16 Sub-Industries & Themes
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter sector or theme..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-900/80 border-slate-700/50 rounded-xl"
              />
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-900/80 p-0.5 rounded-xl border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('HEATMAP_GRID')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  viewMode === 'HEATMAP_GRID' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
                title="Performance Heatmap & Cards Grid"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Heatmap Grid</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('LEADERBOARD_BARS')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  viewMode === 'LEADERBOARD_BARS' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
                title="Ranked Alpha Bar Chart"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Rankings</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('ROTATION_QUADRANT')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  viewMode === 'ROTATION_QUADRANT' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
                title="Sector Rotation Quadrant (RRG Map)"
              >
                <Compass className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Rotation Quadrant</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('COMPARATIVE_TIMELINE')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  viewMode === 'COMPARATIVE_TIMELINE' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
                title="Comparative Return Timeline"
              >
                <LineChartIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Timeline</span>
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">

        {/* ================= 2. INTER-MARKET MACRO ROTATION & BREADTH RADAR ================= */}
        {rotationRatios && breadth && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Cyclical vs Defensive Ratio */}
            <div className="p-3.5 rounded-2xl bg-card/50 border border-border/60 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-purple-400" /> Cyclicals vs Defensives
                </span>
                <Badge variant="outline" className={cn(
                  "text-[9px] font-bold px-1.5 py-0.2 border",
                  rotationRatios.cyclicalVsDefensive.regime === 'Strong Risk-On' || rotationRatios.cyclicalVsDefensive.regime === 'Moderate Cyclical'
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                    : "bg-amber-500/15 text-amber-300 border-amber-500/40"
                )}>
                  {rotationRatios.cyclicalVsDefensive.regime}
                </Badge>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-lg font-black text-foreground">
                  {rotationRatios.cyclicalVsDefensive.ratio}x
                </span>
                <span className={cn(
                  "text-xs font-bold",
                  rotationRatios.cyclicalVsDefensive.change1M >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {rotationRatios.cyclicalVsDefensive.change1M >= 0 ? '+' : ''}{rotationRatios.cyclicalVsDefensive.change1M}% (1M)
                </span>
              </div>
              <p className="text-[10.5px] text-muted-foreground leading-tight line-clamp-1" title={rotationRatios.cyclicalVsDefensive.description}>
                {rotationRatios.cyclicalVsDefensive.description}
              </p>
            </div>

            {/* Discretionary vs Staples (XLY / XLP) */}
            <div className="p-3.5 rounded-2xl bg-card/50 border border-border/60 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Consumer Risk (XLY/XLP)
                </span>
                <span className="text-[10px] font-mono font-bold text-cyan-300">
                  {rotationRatios.discretionaryVsStaples.ratio}
                </span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-xs font-bold text-foreground">
                  {rotationRatios.discretionaryVsStaples.signal}
                </span>
                <span className={cn(
                  "text-xs font-bold",
                  rotationRatios.discretionaryVsStaples.change1M >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {rotationRatios.discretionaryVsStaples.change1M >= 0 ? '+' : ''}{rotationRatios.discretionaryVsStaples.change1M}%
                </span>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, Math.max(10, rotationRatios.discretionaryVsStaples.ratio * 35))}%` }}
                  className="bg-amber-400 h-full rounded-full"
                />
              </div>
            </div>

            {/* Growth vs Value (XLK / XLU) */}
            <div className="p-3.5 rounded-2xl bg-card/50 border border-border/60 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-cyan-400" /> Tech vs Utilities (XLK/XLU)
                </span>
                <span className="text-[10px] font-mono font-bold text-cyan-300">
                  {rotationRatios.growthVsValue.ratio}
                </span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-xs font-bold text-foreground truncate max-w-[150px]">
                  {rotationRatios.growthVsValue.signal}
                </span>
                <span className={cn(
                  "text-xs font-bold",
                  rotationRatios.growthVsValue.change1M >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {rotationRatios.growthVsValue.change1M >= 0 ? '+' : ''}{rotationRatios.growthVsValue.change1M}%
                </span>
              </div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, Math.max(10, rotationRatios.growthVsValue.ratio * 30))}%` }}
                  className="bg-cyan-400 h-full rounded-full"
                />
              </div>
            </div>

            {/* Sector Breadth Gauge */}
            <div className="p-3.5 rounded-2xl bg-card/50 border border-border/60 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Sector Market Breadth
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-400">
                  {breadth.pctAbove50Dma}% &gt; 50DMA
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground">Pos (1M): <strong className="text-foreground">{breadth.pctPositive1M}%</strong></span>
                <span className="text-muted-foreground">&gt; 200DMA: <strong className="text-foreground">{breadth.pctAbove200Dma}%</strong></span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span className="truncate max-w-[120px]" title={breadth.topLeader1M}>👑 {breadth.topLeader1M}</span>
                <span className="truncate max-w-[100px]" title={breadth.topLaggard1M}>⚠️ {breadth.topLaggard1M}</span>
              </div>
            </div>

          </div>
        )}

        {/* ================= 3. AI EMERGING THEMES & ROTATION SIGNALS BAR ================= */}
        {emergingTrends.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-primary/20 backdrop-blur-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" /> Active Sector Rotation & Macro Themes
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">Real-time Telemetry</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {emergingTrends.slice(0, 3).map((trend, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-card/40 border border-border/30 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {trend.title}
                    </span>
                    <div className="flex gap-1">
                      {trend.sectors.map((s) => (
                        <span key={s} className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-slate-800 text-cyan-300">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {trend.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= 4. MAIN VIEW MODES ================= */}
        {isLoading ? (
          <div className="py-20 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span>Computing multi-timeframe returns, rotation stages, and sector breadth...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-2xl">
            No sectors or industries found matching "{searchQuery}".
          </div>
        ) : viewMode === 'HEATMAP_GRID' ? (
          /* ================= VIEW 1: PERFORMANCE MATRIX & HEATMAP GRID ================= */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredItems.map((item) => {
              const ret = item.returns[timeframe];
              const alpha = item.alphaVsSpy[timeframe];
              const isPositive = ret >= 0;
              const isAlphaPos = alpha >= 0;
              const stage = getRotationStageBadge(item.rotationStage);

              return (
                <div
                  key={item.symbol}
                  onClick={() => setSelectedSector(item)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between gap-3 shadow-md group relative overflow-hidden",
                    getHeatmapBg(ret)
                  )}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-center font-mono font-black text-xs text-foreground group-hover:text-primary transition-colors shrink-0 shadow-sm">
                        {item.symbol}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-xs text-foreground group-hover:text-primary transition-colors">
                            {item.symbol}
                          </span>
                          <span className="text-[11px] font-bold text-foreground/90 truncate max-w-[110px]" title={item.shortName}>
                            {item.shortName}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[160px]" title={item.description}>
                          {item.category === 'sector' ? 'GICS Sector' : item.sectorGroup || 'Sub-Industry'}
                        </p>
                      </div>
                    </div>

                    {/* Rotation Stage Pill */}
                    <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0.2 border shrink-0 flex items-center gap-1", stage.badge)}>
                      <span className={cn("w-1 h-1 rounded-full", stage.dot)} />
                      {stage.label}
                    </Badge>
                  </div>

                  {/* Return Display & Relative Alpha */}
                  <div className="flex items-baseline justify-between font-mono py-1">
                    <div>
                      <span className="text-xl font-black text-foreground tracking-tight block">
                        ${item.price.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        1D: {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                      </span>
                    </div>

                    <div className="text-right">
                      <div className={cn(
                        "text-base font-black px-2 py-0.5 rounded-xl border flex items-center gap-0.5 justify-end shadow-sm",
                        isPositive
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      )}>
                        {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        <span>{ret >= 0 ? '+' : ''}{ret.toFixed(2)}%</span>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold mt-0.5 block",
                        isAlphaPos ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {isAlphaPos ? '+' : ''}{alpha.toFixed(1)}% vs SPY
                      </span>
                    </div>
                  </div>

                  {/* Multi-Timeframe Mini Returns Pills */}
                  <div className="grid grid-cols-4 gap-1 text-[9.5px] font-mono text-center pt-1 border-t border-border/30">
                    {(['1W', '1M', '3M', 'YTD'] as const).map((tf) => {
                      const r = item.returns[tf];
                      return (
                        <div key={tf} className="p-1 rounded-lg bg-slate-900/60 border border-border/20">
                          <span className="text-muted-foreground block text-[8.5px]">{tf}</span>
                          <span className={cn("font-bold", r >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {r >= 0 ? '+' : ''}{r.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Top Holdings Tags & Deep Dive Trigger */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                    <div className="flex items-center gap-1 overflow-hidden">
                      <span className="text-[9px] text-muted-foreground">Top:</span>
                      {item.topHoldings.slice(0, 3).map((h) => (
                        <span key={h.symbol} className="font-mono text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                          {h.symbol}
                        </span>
                      ))}
                    </div>

                    <span className="text-[10px] font-bold text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      Deep Dive <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'LEADERBOARD_BARS' ? (
          /* ================= VIEW 2: LEADERBOARD & ALPHA RANKING BAR CHART ================= */
          <div className="space-y-4">
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredItems.map((i) => ({
                    symbol: i.symbol,
                    name: i.shortName,
                    returnVal: i.returns[timeframe],
                    alphaVal: i.alphaVsSpy[timeframe],
                    rawItem: i,
                  }))}
                  margin={{ top: 20, right: 10, left: -10, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                  <XAxis
                    dataKey="symbol"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                    tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: 'rgba(51, 65, 85, 0.8)',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                    formatter={(value: any, name: any, props: any) => [
                      `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}% (Alpha: ${props.payload.alphaVal >= 0 ? '+' : ''}${props.payload.alphaVal.toFixed(2)}%)`,
                      props.payload.name,
                    ]}
                  />
                  {benchmark?.spy && (
                    <ReferenceLine
                      y={benchmark.spy.returns[timeframe]}
                      stroke="#38bdf8"
                      strokeDasharray="4 4"
                      label={{
                        value: `SPY Benchmark: ${benchmark.spy.returns[timeframe] >= 0 ? '+' : ''}${benchmark.spy.returns[timeframe]?.toFixed(2)}%`,
                        fill: '#38bdf8',
                        fontSize: 10,
                        position: 'top',
                      }}
                    />
                  )}
                  <Bar dataKey="returnVal" radius={[6, 6, 0, 0]} onClick={(entry) => setSelectedSector(entry.rawItem)}>
                    {filteredItems.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.returns[timeframe] >= 0 ? '#34d399' : '#fb7185'}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Performance Ranking Table */}
            <div className="rounded-2xl border border-border/50 overflow-hidden bg-card/40">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/80 text-muted-foreground uppercase font-mono text-[10px] border-b border-border/40">
                    <tr>
                      <th className="p-3">Rank</th>
                      <th className="p-3">Ticker / Sector</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Price</th>
                      <th className="p-3 text-right">Return ({timeframe})</th>
                      <th className="p-3 text-right">Alpha vs SPY</th>
                      <th className="p-3 text-center">Rotation Stage</th>
                      <th className="p-3 text-center">RSI (14)</th>
                      <th className="p-3 text-center">50DMA</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 font-mono">
                    {filteredItems.map((item, idx) => {
                      const ret = item.returns[timeframe];
                      const alpha = item.alphaVsSpy[timeframe];
                      const stage = getRotationStageBadge(item.rotationStage);

                      return (
                        <tr
                          key={item.symbol}
                          onClick={() => setSelectedSector(item)}
                          className="hover:bg-accent/30 transition-colors cursor-pointer"
                        >
                          <td className="p-3 font-bold text-muted-foreground">#{idx + 1}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-foreground">{item.symbol}</span>
                              <span className="font-sans text-muted-foreground truncate max-w-[130px]">{item.shortName}</span>
                            </div>
                          </td>
                          <td className="p-3 font-sans text-muted-foreground">
                            <Badge variant="outline" className="text-[9px] border-white/10">
                              {item.category === 'sector' ? 'GICS' : 'Theme'}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-bold text-foreground">${item.price.toFixed(2)}</td>
                          <td className={cn("p-3 text-right font-black", ret >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
                          </td>
                          <td className={cn("p-3 text-right font-bold", alpha >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {alpha >= 0 ? '+' : ''}{alpha.toFixed(1)}%
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0.2 border", stage.badge)}>
                              {stage.label}
                            </Badge>
                          </td>
                          <td className={cn("p-3 text-center font-bold", item.rsi14 > 70 ? "text-rose-400" : item.rsi14 < 35 ? "text-emerald-400" : "text-muted-foreground")}>
                            {item.rsi14}
                          </td>
                          <td className="p-3 text-center">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", item.above50Dma ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
                              {item.above50Dma ? 'Above' : 'Below'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSector(item);
                              }}
                              className="h-6 text-[10px] font-bold px-2 text-primary hover:bg-primary/20"
                            >
                              Deep Dive
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : viewMode === 'ROTATION_QUADRANT' ? (
          /* ================= VIEW 3: SECTOR ROTATION QUADRANT (RRG MOMENTUM MAP) ================= */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-foreground">Sector Rotation Momentum Quadrant (RRG Matrix)</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] flex-wrap font-mono">
                <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Leading (Outperforming + Accelerating)</span>
                <span className="flex items-center gap-1.5 text-amber-400"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Weakening (Outperforming + Decelerating)</span>
                <span className="flex items-center gap-1.5 text-rose-400"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Lagging (Underperforming + Decelerating)</span>
                <span className="flex items-center gap-1.5 text-cyan-400"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Improving (Underperforming + Gaining Acceleration)</span>
              </div>
            </div>

            <div className="h-[420px] w-full bg-slate-950/80 rounded-2xl border border-border/60 p-4 relative">
              {/* Quadrant Background Labels */}
              <div className="absolute top-6 left-6 text-xs font-mono font-black text-cyan-500/40 pointer-events-none uppercase">
                🔵 IMPROVING (Rebound / Inflow)
              </div>
              <div className="absolute top-6 right-6 text-xs font-mono font-black text-emerald-500/40 pointer-events-none uppercase">
                🟢 LEADING (Market Drivers)
              </div>
              <div className="absolute bottom-6 left-6 text-xs font-mono font-black text-rose-500/40 pointer-events-none uppercase">
                🔴 LAGGING (Distribution / Drag)
              </div>
              <div className="absolute bottom-6 right-6 text-xs font-mono font-black text-amber-500/40 pointer-events-none uppercase">
                🟡 WEAKENING (Cooling Momentum)
              </div>

              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Relative Strength vs SPY (1M)"
                    unit="%"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                    label={{ value: 'Relative Strength vs SPY (1M Alpha %)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Momentum Acceleration"
                    unit=" pts"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                    label={{ value: 'Momentum Acceleration (1W vs 1M Velocity)', angle: -90, position: 'insideLeft', offset: 15, fill: '#94a3b8', fontSize: 11 }}
                  />
                  <ZAxis range={[200, 200]} />
                  <ReferenceLine x={0} stroke="#64748b" strokeWidth={1.5} />
                  <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.5} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: 'rgba(51, 65, 85, 0.8)',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                    formatter={(value: any, name: any, props: any) => [
                      `${props.payload.symbol} (${props.payload.shortName}): 1M Alpha ${props.payload.x >= 0 ? '+' : ''}${props.payload.x}%, Momentum ${props.payload.y >= 0 ? '+' : ''}${props.payload.y}`,
                      props.payload.stage,
                    ]}
                  />
                  <Scatter
                    name="Sectors"
                    data={filteredItems.map((i) => ({
                      x: i.alphaVsSpy['1M'],
                      y: i.momentumScore,
                      symbol: i.symbol,
                      shortName: i.shortName,
                      stage: i.rotationStage,
                      rawItem: i,
                    }))}
                    onClick={(entry) => setSelectedSector(entry.rawItem)}
                  >
                    {filteredItems.map((entry, index) => {
                      let color = '#34d399'; // green
                      if (entry.rotationStage === 'Weakening') color = '#fbbf24'; // amber
                      if (entry.rotationStage === 'Lagging') color = '#fb7185'; // rose
                      if (entry.rotationStage === 'Improving') color = '#38bdf8'; // cyan
                      return (
                        <Cell
                          key={`scatter-cell-${index}`}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth={1}
                          className="cursor-pointer hover:scale-125 transition-transform"
                        />
                      );
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          /* ================= VIEW 4: MULTI-SECTOR COMPARATIVE TIMELINE ================= */
          <div className="space-y-4">
            {/* Sector Ticker Badges Selector */}
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-border/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-primary" /> Select Sectors to Overlay on Timeline (Max 8)
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {activeCompareSymbols.length} / 8 Active
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {allItems.map((item) => {
                  const isSelected = activeCompareSymbols.includes(item.symbol);
                  return (
                    <button
                      key={item.symbol}
                      onClick={() => toggleCompareSymbol(item.symbol)}
                      className={cn(
                        "px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all border",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                      )}
                    >
                      {item.symbol} ({item.shortName})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recharts Line Chart */}
            <div className="h-[380px] w-full bg-slate-950/80 rounded-2xl border border-border/60 p-4">
              {isHistoryLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Loading multi-sector performance timeline...
                </div>
              ) : historyData?.history && historyData.history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData.history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis
                      dataKey="formattedDate"
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: 'rgba(51, 65, 85, 0.8)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                      formatter={(value: any, name: any) => [`${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`, name]}
                    />
                    <ReferenceLine y={0} stroke="#64748b" strokeDasharray="2 2" />
                    <Legend
                      verticalAlign="top"
                      height={32}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                    />
                    {/* SPY Benchmark Line */}
                    <Line
                      type="monotone"
                      dataKey="SPY"
                      name="SPY (S&P 500 Index)"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                    {activeCompareSymbols.map((sym, idx) => (
                      <Line
                        key={sym}
                        type="monotone"
                        dataKey={sym}
                        name={sym}
                        stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  No historical data available for selected symbols.
                </div>
              )}
            </div>
          </div>
        )}

      </CardContent>

      {/* ================= SECTOR DEEP DIVE MODAL ================= */}
      {selectedSector && (
        <SectorDeepDiveModal
          isOpen={Boolean(selectedSector)}
          onClose={() => setSelectedSector(null)}
          sector={selectedSector}
          onNavigateToResearch={onNavigateToResearch}
          onNavigateToGraphs={onNavigateToGraphs}
        />
      )}
    </Card>
  );
}
