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
import { Input } from '@/components/ui/input';
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  BarChart3,
  Sparkles,
  Search,
  Maximize2,
  Minimize2,
  ExternalLink,
  LineChart as LineChartIcon,
  X,
  Gauge,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Scale,
  Compass,
  ArrowUpDown,
  Table as TableIcon,
  LayoutGrid,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SectorItem,
  SectorTimeframe,
  SectorScope,
  MacroRotationRatios,
} from '@/services/sectorsService';

interface SectorHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectors: SectorItem[];
  benchmark?: {
    spy: { price: number; returns: Record<SectorTimeframe, number> };
    qqq?: { price: number; returns: Record<SectorTimeframe, number> };
    iwm?: { price: number; returns: Record<SectorTimeframe, number> };
  };
  rotationRatios?: MacroRotationRatios;
  breadth?: {
    pctAbove50Dma: number;
    pctAbove200Dma: number;
    pctPositive1W: number;
    pctPositive1M: number;
    topLeader1M: string;
    topLaggard1M: string;
  };
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
  onSelectDeepDive?: (sector: SectorItem) => void;
}

export type SectorHeatmapSortField =
  | 'metric_active'
  | 'alpha_active'
  | 'momentum'
  | 'rsi'
  | 'price'
  | 'name'
  | 'symbol';

type SectorHeatmapViewMode = 'TILES' | 'GROUPED' | 'MATRIX';
type SectorMetricMode = 'RETURN' | 'ALPHA';

const TIMEFRAMES: { id: SectorTimeframe; label: string; periodLabel: string }[] = [
  { id: '1D', label: '1D', periodLabel: '1 Day' },
  { id: '1W', label: '1W', periodLabel: '1 Week' },
  { id: '1M', label: '1M', periodLabel: '1 Month' },
  { id: '3M', label: '3M', periodLabel: '3 Months' },
  { id: '6M', label: '6M', periodLabel: '6 Months' },
  { id: 'YTD', label: 'YTD', periodLabel: 'Year-to-Date' },
  { id: '1Y', label: '1Y', periodLabel: '1 Year' },
];

const SCOPE_TABS: { id: 'all' | 'sector' | 'industry'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'All Assets', icon: Layers },
  { id: 'sector', label: '11 GICS Sectors', icon: PieChart },
  { id: 'industry', label: '16 Sub-Industries & Themes', icon: Activity },
];

export function SectorHeatmapModal({
  isOpen,
  onClose,
  sectors,
  benchmark,
  rotationRatios,
  breadth,
  onNavigateToResearch,
  onNavigateToGraphs,
  onSelectDeepDive,
}: SectorHeatmapModalProps) {
  const [timeframe, setTimeframe] = useState<SectorTimeframe>('1M');
  const [metricMode, setMetricMode] = useState<SectorMetricMode>('RETURN');
  const [scope, setScope] = useState<'all' | 'sector' | 'industry'>('all');
  const [viewMode, setViewMode] = useState<SectorHeatmapViewMode>('TILES');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SectorHeatmapSortField>('metric_active');
  const [sortAscending, setSortAscending] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedSector, setSelectedSector] = useState<SectorItem | null>(null);

  // Dynamic Heatmap Shading Palette
  const getHeatmapColor = (val: number) => {
    if (val >= 8.0) return 'bg-emerald-900/60 border-emerald-400/80 text-emerald-200 shadow-emerald-950/40';
    if (val >= 4.0) return 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300 shadow-emerald-950/30';
    if (val >= 1.5) return 'bg-emerald-950/50 border-emerald-600/40 text-emerald-300';
    if (val >= 0.3) return 'bg-emerald-950/30 border-emerald-700/30 text-emerald-400';
    if (val > -0.3) return 'bg-slate-900/70 border-slate-800 text-slate-300';
    if (val > -1.5) return 'bg-rose-950/30 border-rose-700/30 text-rose-400';
    if (val > -4.0) return 'bg-rose-950/50 border-rose-600/40 text-rose-300';
    if (val > -8.0) return 'bg-rose-950/70 border-rose-500/60 text-rose-300 shadow-rose-950/30';
    return 'bg-rose-900/60 border-rose-400/80 text-rose-200 shadow-rose-950/40';
  };

  const getHeatmapPillColor = (val: number) => {
    if (val >= 4.0) return 'bg-emerald-500/25 text-emerald-200 border-emerald-500/40';
    if (val >= 0.3) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (val > -0.3) return 'bg-slate-800 text-slate-300 border-slate-700';
    if (val > -4.0) return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    return 'bg-rose-500/25 text-rose-200 border-rose-500/40';
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

  // Filter and sort items
  const filteredAndSortedSectors = useMemo(() => {
    let list = [...sectors];

    // Filter by scope
    if (scope === 'sector') {
      list = list.filter((s) => s.category === 'sector');
    } else if (scope === 'industry') {
      list = list.filter((s) => s.category === 'industry');
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.shortName.toLowerCase().includes(q) ||
          s.symbol.toLowerCase().includes(q) ||
          (s.sectorGroup && s.sectorGroup.toLowerCase().includes(q))
      );
    }

    // Sort items
    list.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortField) {
        case 'metric_active':
          valA = metricMode === 'RETURN' ? a.returns[timeframe] : a.alphaVsSpy[timeframe];
          valB = metricMode === 'RETURN' ? b.returns[timeframe] : b.alphaVsSpy[timeframe];
          break;
        case 'alpha_active':
          valA = a.alphaVsSpy[timeframe] ?? 0;
          valB = b.alphaVsSpy[timeframe] ?? 0;
          break;
        case 'momentum':
          valA = a.momentumScore ?? 0;
          valB = b.momentumScore ?? 0;
          break;
        case 'rsi':
          valA = a.rsi14 ?? 0;
          valB = b.rsi14 ?? 0;
          break;
        case 'price':
          valA = a.price;
          valB = b.price;
          break;
        case 'name':
          valA = a.shortName;
          valB = b.shortName;
          break;
        case 'symbol':
          valA = a.symbol;
          valB = b.symbol;
          break;
        default:
          valA = a.returns[timeframe] ?? 0;
          valB = b.returns[timeframe] ?? 0;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      const numA = Number(valA);
      const numB = Number(valB);
      return sortAscending ? numA - numB : numB - numA;
    });

    return list;
  }, [sectors, scope, searchQuery, sortField, sortAscending, timeframe, metricMode]);

  // Aggregate telemetry
  const telemetry = useMemo(() => {
    if (!sectors.length) {
      return {
        advancing: 0,
        declining: 0,
        avgReturn: 0,
        avgAlpha: 0,
        topGainer: null as SectorItem | null,
        topLaggard: null as SectorItem | null,
      };
    }

    let adv = 0;
    let dec = 0;
    let sumRet = 0;
    let sumAlpha = 0;
    let topG: SectorItem | null = null;
    let topL: SectorItem | null = null;

    sectors.forEach((s) => {
      const ret = s.returns[timeframe] ?? 0;
      const alpha = s.alphaVsSpy[timeframe] ?? 0;
      sumRet += ret;
      sumAlpha += alpha;
      if (ret >= 0) adv++;
      else dec++;

      const metric = metricMode === 'RETURN' ? ret : alpha;
      const topGMetric = topG ? (metricMode === 'RETURN' ? topG.returns[timeframe] : topG.alphaVsSpy[timeframe]) : -Infinity;
      const topLMetric = topL ? (metricMode === 'RETURN' ? topL.returns[timeframe] : topL.alphaVsSpy[timeframe]) : Infinity;

      if (!topG || metric > topGMetric) {
        topG = s;
      }
      if (!topL || metric < topLMetric) {
        topL = s;
      }
    });

    return {
      advancing: adv,
      declining: dec,
      avgReturn: Number((sumRet / sectors.length).toFixed(2)),
      avgAlpha: Number((sumAlpha / sectors.length).toFixed(2)),
      topGainer: topG,
      topLaggard: topL,
    };
  }, [sectors, timeframe, metricMode]);

  // Grouped by Category (GICS Sectors vs Sub-Industries / Themes)
  const groupedSectors = useMemo(() => {
    const sectorItems = filteredAndSortedSectors.filter((s) => s.category === 'sector');
    const industryItems = filteredAndSortedSectors.filter((s) => s.category === 'industry');

    const groups = [];
    if (sectorItems.length > 0) {
      groups.push({
        id: 'sector',
        label: '11 GICS Sectors (Macro Core)',
        icon: PieChart,
        items: sectorItems,
      });
    }
    if (industryItems.length > 0) {
      groups.push({
        id: 'industry',
        label: '16 High-Beta Sub-Industries & Themes',
        icon: Activity,
        items: industryItems,
      });
    }
    return groups;
  }, [filteredAndSortedSectors]);

  const activePeriodLabel = TIMEFRAMES.find((t) => t.id === timeframe)?.periodLabel || timeframe;
  const spyReturn = benchmark?.spy?.returns[timeframe];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "bg-slate-950/98 border border-slate-800 text-foreground p-0 overflow-hidden flex flex-col shadow-2xl backdrop-blur-3xl transition-all duration-300 z-50",
          isFullscreen
            ? "!fixed !inset-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !m-0 !p-0"
            : "sm:max-w-[1550px] w-[97vw] h-[93vh] max-h-[96vh] rounded-3xl"
        )}
      >
        {/* Ambient Top Glow Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-primary to-cyan-500 shrink-0" />

        {/* ================= 1. MODAL HEADER ================= */}
        <div className="p-4 sm:p-5 border-b border-border/40 bg-accent/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500/20 via-primary/20 to-cyan-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-sm shrink-0">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                  S&P 500 Sectors & Capital Rotation Heatmap
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] font-mono font-bold bg-primary/15 text-primary border-primary/30 uppercase">
                  {timeframe} Horizon
                </Badge>
                {spyReturn !== undefined && (
                  <Badge variant="outline" className="text-[10px] font-mono text-cyan-300 border-cyan-500/30">
                    SPY Benchmark ({timeframe}): {spyReturn >= 0 ? '+' : ''}{spyReturn.toFixed(2)}%
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Full-window institutional capital flows matrix • Multi-timeframe performance, relative alpha over SPY, and rotation quadrants
              </DialogDescription>
            </div>
          </div>

          {/* Timeframe Selector, Metric Mode & Window Controls */}
          <div className="flex items-center gap-2 flex-wrap justify-between lg:justify-end">
            {/* Metric Mode Toggle (Absolute Return vs Relative Alpha) */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setMetricMode('RETURN')}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-xs font-bold transition-all",
                  metricMode === 'RETURN'
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="View Absolute Performance"
              >
                Return (%)
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('ALPHA')}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-xs font-bold transition-all",
                  metricMode === 'ALPHA'
                    ? "bg-purple-600 text-white shadow"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="View Relative Alpha vs SPY"
              >
                Alpha vs SPY
              </button>
            </div>

            {/* Timeframe Pills */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-800 shadow-inner">
              {TIMEFRAMES.map((tf) => {
                const isActive = timeframe === tf.id;
                return (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => setTimeframe(tf.id)}
                    className={cn(
                      "px-2.5 sm:px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer font-mono",
                      isActive
                        ? "bg-gradient-to-r from-purple-500 via-primary to-cyan-500 text-white shadow-md scale-102"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                    title={`View ${tf.periodLabel} returns`}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('TILES')}
                className={cn(
                  "p-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1",
                  viewMode === 'TILES' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
                title="Heatmap Cards"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Tiles</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('GROUPED')}
                className={cn(
                  "p-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1",
                  viewMode === 'GROUPED' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
                title="Grouped by Sector vs Industry"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Groups</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('MATRIX')}
                className={cn(
                  "p-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1",
                  viewMode === 'MATRIX' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
                title="Multi-Timeframe Matrix Table"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Matrix</span>
              </button>
            </div>

            {/* Fullscreen Expand Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 rounded-xl border-border/70 hover:bg-accent/40 text-muted-foreground hover:text-foreground"
              title={isFullscreen ? 'Exit Fullscreen' : 'Expand to Full Window'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* ================= 2. TELEMETRY & BREADTH RIBBON ================= */}
        <div className="bg-slate-900/50 border-b border-border/30 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-muted-foreground">Horizon:</span>
              <strong className="text-foreground">{activePeriodLabel}</strong>
              <span className="text-muted-foreground font-semibold">({metricMode === 'RETURN' ? 'Absolute Return' : 'Alpha vs SPY'})</span>
            </div>

            <div className="flex items-center gap-2 font-mono">
              <span className="text-emerald-400 font-bold">▲ {telemetry.advancing} Positive</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-rose-400 font-bold">▼ {telemetry.declining} Negative</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-muted-foreground">Average Return:</span>
              <span className={cn("font-black", telemetry.avgReturn >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {telemetry.avgReturn >= 0 ? '+' : ''}{telemetry.avgReturn}%
              </span>
            </div>

            {breadth && (
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-muted-foreground">Breadth &gt; 50DMA:</span>
                <span className="text-cyan-300 font-bold">{breadth.pctAbove50Dma}%</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap font-mono text-[11px]">
            {telemetry.topGainer && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Top Leader:</span>
                <span className="text-emerald-300 font-bold truncate max-w-[130px]">
                  👑 {telemetry.topGainer.symbol} ({telemetry.topGainer.shortName})
                </span>
                <span className="text-emerald-400 font-black">
                  +{(metricMode === 'RETURN' ? telemetry.topGainer.returns[timeframe] : telemetry.topGainer.alphaVsSpy[timeframe]).toFixed(1)}%
                </span>
              </div>
            )}

            {telemetry.topLaggard && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Top Laggard:</span>
                <span className="text-rose-300 font-bold truncate max-w-[130px]">
                  ⚠️ {telemetry.topLaggard.symbol} ({telemetry.topLaggard.shortName})
                </span>
                <span className="text-rose-400 font-black">
                  {(metricMode === 'RETURN' ? telemetry.topLaggard.returns[timeframe] : telemetry.topLaggard.alphaVsSpy[timeframe]).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ================= 3. SCOPE & SEARCH CONTROL BAR ================= */}
        <div className="p-3 sm:px-5 border-b border-border/30 bg-background/40 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          {/* Scope Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {SCOPE_TABS.map((tab) => {
              const isSelected = scope === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setScope(tab.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer shrink-0",
                    isSelected
                      ? "bg-purple-600 text-white border-purple-500 shadow-xs"
                      : "bg-slate-900/60 hover:bg-accent/40 text-muted-foreground hover:text-foreground border-slate-800"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-2 self-end md:self-auto w-full md:w-auto">
            <div className="relative w-full md:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search ticker, name or theme..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-900/80 border-slate-800 rounded-xl"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortAscending(!sortAscending)}
              className="h-8 text-xs gap-1 border-slate-800 bg-slate-900/80 hover:bg-accent/40 shrink-0 font-mono"
              title="Toggle sort direction"
            >
              <ArrowUpDown className="w-3 h-3 text-primary" />
              <span className="hidden sm:inline">{sortAscending ? 'Asc (Worst First)' : 'Desc (Best First)'}</span>
            </Button>
          </div>
        </div>

        {/* ================= 4. MAIN HEATMAP BODY (SCROLLABLE) ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {filteredAndSortedSectors.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted-foreground border border-dashed border-border/40 rounded-3xl">
              No sectors or themes found matching "{searchQuery}".
            </div>
          ) : viewMode === 'TILES' ? (
            /* VIEW 1: INTERACTIVE HEATMAP TILES GRID */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {filteredAndSortedSectors.map((item) => {
                const ret = item.returns[timeframe];
                const alpha = item.alphaVsSpy[timeframe];
                const activeVal = metricMode === 'RETURN' ? ret : alpha;
                const isPositive = activeVal >= 0;
                const stage = getRotationStageBadge(item.rotationStage);

                return (
                  <div
                    key={item.symbol}
                    onClick={() => setSelectedSector(item)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between gap-3 shadow-lg group relative overflow-hidden",
                      getHeatmapColor(activeVal)
                    )}
                  >
                    {/* Top Row: Symbol, Category & Stage Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center font-mono font-black text-xs text-foreground group-hover:text-primary transition-colors shadow-inner">
                          {item.symbol}
                        </div>
                        <div className="min-w-0">
                          <span className="font-mono font-black text-xs text-foreground block truncate group-hover:text-primary transition-colors">
                            {item.shortName}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate block">
                            {item.category === 'sector' ? 'GICS Sector' : item.sectorGroup || 'Theme ETF'}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={cn("text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 border shrink-0 flex items-center gap-1", stage.badge)}
                      >
                        <span className={cn("w-1 h-1 rounded-full", stage.dot)} />
                        {stage.label}
                      </Badge>
                    </div>

                    {/* Middle Row: Large Return / Alpha Metric */}
                    <div className="flex items-baseline justify-between font-mono my-1">
                      <div>
                        <span className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-1">
                          {isPositive ? <TrendingUp className="w-5 h-5 text-emerald-400 inline" /> : <TrendingDown className="w-5 h-5 text-rose-400 inline" />}
                          <span>{isPositive ? '+' : ''}{activeVal.toFixed(2)}%</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                          {activePeriodLabel} {metricMode === 'RETURN' ? 'Return' : 'Alpha vs SPY'}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-extrabold text-foreground block">
                          ${item.price.toFixed(2)}
                        </span>
                        <span className={cn("text-[10px] font-bold block", alpha >= 0 ? "text-cyan-300" : "text-amber-300")}>
                          Alpha: {alpha >= 0 ? '+' : ''}{alpha.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: RSI & 52W Range Gauge */}
                    <div className="space-y-1 pt-1.5 border-t border-white/10">
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                        <span>RSI: <strong className="text-foreground">{item.rsi14?.toFixed(0) || '50'}</strong></span>
                        <span>Mom: <strong className="text-foreground">{item.momentumScore?.toFixed(0) || '50'}</strong></span>
                        <span className="text-foreground font-bold">52W: {item.distance52wHighPct?.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-400 via-primary to-cyan-400 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(5, 100 + (item.distance52wHighPct || 0)))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'GROUPED' ? (
            /* VIEW 2: GROUPED BY GICS SECTORS VS SUB-INDUSTRIES */
            <div className="space-y-6">
              {groupedSectors.map((group) => {
                const Icon = group.icon;
                const groupAvg = Number(
                  (
                    group.items.reduce((acc, s) => acc + (metricMode === 'RETURN' ? s.returns[timeframe] : s.alphaVsSpy[timeframe]), 0) /
                    group.items.length
                  ).toFixed(2)
                );

                return (
                  <div key={group.id} className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-border/40">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                          <Icon className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-foreground">{group.label}</h4>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {group.items.length} Assets
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="text-muted-foreground">Group Avg {metricMode === 'RETURN' ? 'Return' : 'Alpha'}:</span>
                        <span className={cn("font-bold px-2 py-0.5 rounded-lg border", getHeatmapPillColor(groupAvg))}>
                          {groupAvg >= 0 ? '+' : ''}{groupAvg}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {group.items.map((item) => {
                        const val = metricMode === 'RETURN' ? item.returns[timeframe] : item.alphaVsSpy[timeframe];
                        const isPositive = val >= 0;

                        return (
                          <div
                            key={item.symbol}
                            onClick={() => setSelectedSector(item)}
                            className={cn(
                              "p-3.5 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col justify-between gap-2 shadow-sm group",
                              getHeatmapColor(val)
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                                {item.symbol} • {item.shortName}
                              </span>
                              <span className="font-mono font-black text-sm">
                                {isPositive ? '+' : ''}{val.toFixed(2)}%
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                              <span>${item.price.toFixed(2)}</span>
                              <span className="text-[10px] font-bold uppercase">{item.rotationStage}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* VIEW 3: MULTI-TIMEFRAME MATRIX TABLE */
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] text-muted-foreground uppercase">
                      <th className="py-3 px-4 font-bold">Sector / Theme</th>
                      <th className="py-3 px-3 font-bold">Scope</th>
                      <th className="py-3 px-3 text-right font-bold">Price</th>
                      <th className="py-3 px-2 text-center font-bold">1D</th>
                      <th className="py-3 px-2 text-center font-bold">1W</th>
                      <th className="py-3 px-2 text-center font-bold">1M</th>
                      <th className="py-3 px-2 text-center font-bold">3M</th>
                      <th className="py-3 px-2 text-center font-bold">6M</th>
                      <th className="py-3 px-2 text-center font-bold">YTD</th>
                      <th className="py-3 px-2 text-center font-bold">1Y</th>
                      <th className="py-3 px-3 text-center font-bold">Stage</th>
                      <th className="py-3 px-3 text-right font-bold">RSI (14)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredAndSortedSectors.map((item) => {
                      const stage = getRotationStageBadge(item.rotationStage);
                      return (
                        <tr
                          key={item.symbol}
                          onClick={() => setSelectedSector(item)}
                          className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <span className="text-primary font-black">{item.symbol}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="truncate max-w-[140px]">{item.shortName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {item.category === 'sector' ? 'GICS' : 'Theme'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-foreground">
                            ${item.price.toFixed(2)}
                          </td>

                          {/* Returns across all 7 timeframes */}
                          {(['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y'] as SectorTimeframe[]).map((tf) => {
                            const val = metricMode === 'RETURN' ? item.returns[tf] : item.alphaVsSpy[tf];
                            const isPos = val >= 0;
                            const isFocusedTf = timeframe === tf;

                            return (
                              <td key={tf} className="py-2.5 px-2 text-center">
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded-md text-[11px] font-bold inline-block min-w-[52px]",
                                    getHeatmapPillColor(val),
                                    isFocusedTf && "ring-1 ring-primary shadow-xs font-black"
                                  )}
                                >
                                  {isPos ? '+' : ''}{val.toFixed(1)}%
                                </span>
                              </td>
                            );
                          })}

                          <td className="py-2.5 px-3 text-center">
                            <Badge
                              variant="outline"
                              className={cn("text-[9px] uppercase px-1.5 py-0.2 border", stage.badge)}
                            >
                              {stage.label}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold">
                            <span className={item.rsi14 >= 70 ? "text-amber-400" : item.rsi14 <= 30 ? "text-cyan-400" : "text-slate-300"}>
                              {item.rsi14?.toFixed(0) || '50'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ================= 5. SECTOR INSPECTION QUICK DRAWER / POPOVER ================= */}
        {selectedSector && (
          <div className="p-4 sm:p-5 bg-slate-900/95 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center font-mono font-black text-sm text-purple-300 shrink-0">
                {selectedSector.symbol}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base font-black text-foreground">
                    {selectedSector.name} ({selectedSector.symbol})
                  </h4>
                  <Badge variant="outline" className="text-[10px] font-mono border-white/20">
                    {selectedSector.category === 'sector' ? 'GICS Sector ETF' : selectedSector.sectorGroup || 'Theme'}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono font-bold uppercase border",
                      getRotationStageBadge(selectedSector.rotationStage).badge
                    )}
                  >
                    {selectedSector.rotationStage}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-2xl">
                  {selectedSector.description}
                </p>
                {selectedSector.topHoldings && selectedSector.topHoldings.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-mono text-muted-foreground">
                    <span>Top Weights:</span>
                    {selectedSector.topHoldings.slice(0, 4).map((h) => (
                      <span key={h.symbol} className="text-foreground font-semibold">
                        {h.symbol} ({(h.weight * 100).toFixed(0)}%)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto">
              <div className="text-right font-mono">
                <span className="text-lg font-black text-foreground block">
                  ${selectedSector.price.toFixed(2)}
                </span>
                <span className={cn(
                  "text-xs font-bold",
                  selectedSector.returns[timeframe] >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {selectedSector.returns[timeframe] >= 0 ? '+' : ''}
                  {selectedSector.returns[timeframe]?.toFixed(2)}% ({timeframe})
                </span>
              </div>

              {onSelectDeepDive && (
                <Button
                  size="sm"
                  onClick={() => {
                    const s = selectedSector;
                    setSelectedSector(null);
                    onSelectDeepDive(s);
                  }}
                  className="h-8 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold gap-1.5 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Deep Dive Analysis</span>
                </Button>
              )}

              {onNavigateToGraphs && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onNavigateToGraphs(selectedSector.symbol);
                  }}
                  className="h-8 px-3 rounded-xl border-slate-700 hover:bg-accent/40 text-xs font-bold gap-1.5"
                >
                  <LineChartIcon className="w-3.5 h-3.5" />
                  <span>Chart</span>
                </Button>
              )}

              {onNavigateToResearch && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onNavigateToResearch(selectedSector.symbol);
                  }}
                  className="h-8 px-3 rounded-xl border-slate-700 hover:bg-accent/40 text-xs font-bold gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Research</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedSector(null)}
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                title="Dismiss inspector"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
