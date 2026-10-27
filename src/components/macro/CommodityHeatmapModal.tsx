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
  Flame,
  Coins,
  Activity,
  Wheat,
  Scale,
  Layers,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Maximize2,
  Minimize2,
  Table as TableIcon,
  LayoutGrid,
  Sparkles,
  ExternalLink,
  LineChart as LineChartIcon,
  X,
  Gauge,
  SlidersHorizontal,
  ChevronRight,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CommodityPriceItem,
  CommodityTimeframe,
  CommodityCategory,
  CurveStructure,
} from '@/services/commoditiesService';

interface CommodityHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  commodities: CommodityPriceItem[];
  marketRegime?: {
    overallPosture: string;
    summary: string;
    inflationaryImpulseScore: number;
  };
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
}

export type HeatmapSortField =
  | 'return_active'
  | 'return_1D'
  | 'return_1W'
  | 'return_1M'
  | 'return_3M'
  | 'return_6M'
  | 'return_YTD'
  | 'return_1Y'
  | 'price'
  | 'name'
  | 'range52w'
  | 'rollYield';

type HeatmapViewMode = 'TILES' | 'GROUPED' | 'MATRIX';

const TIMEFRAMES: { id: CommodityTimeframe; label: string; periodLabel: string }[] = [
  { id: '1D', label: '1D', periodLabel: '1 Day' },
  { id: '1W', label: '1W', periodLabel: '1 Week' },
  { id: '1M', label: '1M', periodLabel: '1 Month' },
  { id: '3M', label: '3M', periodLabel: '3 Months' },
  { id: '6M', label: '6M', periodLabel: '6 Months' },
  { id: 'YTD', label: 'YTD', periodLabel: 'Year-to-Date' },
  { id: '1Y', label: '1Y', periodLabel: '1 Year' },
];

const COMPLEX_FILTERS: {
  id: 'all' | CommodityCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'all', label: 'All Complexes', icon: Layers },
  { id: 'energy', label: 'Energy', icon: Flame },
  { id: 'precious_metals', label: 'Precious Metals', icon: Coins },
  { id: 'industrial_metals', label: 'Industrial Metals', icon: Activity },
  { id: 'agriculture', label: 'Agriculture & Softs', icon: Wheat },
  { id: 'livestock', label: 'Livestock', icon: Scale },
];

export function CommodityHeatmapModal({
  isOpen,
  onClose,
  commodities,
  marketRegime,
  onNavigateToResearch,
  onNavigateToGraphs,
}: CommodityHeatmapModalProps) {
  const [timeframe, setTimeframe] = useState<CommodityTimeframe>('1M');
  const [activeComplex, setActiveComplex] = useState<'all' | CommodityCategory>('all');
  const [viewMode, setViewMode] = useState<HeatmapViewMode>('TILES');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<HeatmapSortField>('return_active');
  const [sortAscending, setSortAscending] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedCommodity, setSelectedCommodity] = useState<CommodityPriceItem | null>(null);

  // Dynamic Heatmap Shading Palette
  const getHeatmapColor = (ret: number) => {
    if (ret >= 10.0) return 'bg-emerald-900/60 border-emerald-400/80 text-emerald-200 shadow-emerald-950/40';
    if (ret >= 5.0) return 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300 shadow-emerald-950/30';
    if (ret >= 2.0) return 'bg-emerald-950/50 border-emerald-600/40 text-emerald-300';
    if (ret >= 0.5) return 'bg-emerald-950/30 border-emerald-700/30 text-emerald-400';
    if (ret > -0.5) return 'bg-slate-900/70 border-slate-800 text-slate-300';
    if (ret > -2.0) return 'bg-rose-950/30 border-rose-700/30 text-rose-400';
    if (ret > -5.0) return 'bg-rose-950/50 border-rose-600/40 text-rose-300';
    if (ret > -10.0) return 'bg-rose-950/70 border-rose-500/60 text-rose-300 shadow-rose-950/30';
    return 'bg-rose-900/60 border-rose-400/80 text-rose-200 shadow-rose-950/40';
  };

  const getHeatmapPillColor = (ret: number) => {
    if (ret >= 5.0) return 'bg-emerald-500/25 text-emerald-200 border-emerald-500/40';
    if (ret >= 0.5) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (ret > -0.5) return 'bg-slate-800 text-slate-300 border-slate-700';
    if (ret > -5.0) return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    return 'bg-rose-500/25 text-rose-200 border-rose-500/40';
  };

  // Filter and sort items
  const filteredAndSortedCommodities = useMemo(() => {
    let list = [...commodities];

    // Filter by complex
    if (activeComplex !== 'all') {
      list = list.filter((c) => c.category === activeComplex);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.shortName.toLowerCase().includes(q) ||
          c.symbol.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.categoryLabel.toLowerCase().includes(q)
      );
    }

    // Sort items
    list.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortField) {
        case 'return_active':
          valA = a.returns?.[timeframe] ?? a.changePercent;
          valB = b.returns?.[timeframe] ?? b.changePercent;
          break;
        case 'return_1D':
          valA = a.returns?.['1D'] ?? a.changePercent;
          valB = b.returns?.['1D'] ?? b.changePercent;
          break;
        case 'return_1W':
          valA = a.returns?.['1W'] ?? 0;
          valB = b.returns?.['1W'] ?? 0;
          break;
        case 'return_1M':
          valA = a.returns?.['1M'] ?? 0;
          valB = b.returns?.['1M'] ?? 0;
          break;
        case 'return_3M':
          valA = a.returns?.['3M'] ?? 0;
          valB = b.returns?.['3M'] ?? 0;
          break;
        case 'return_6M':
          valA = a.returns?.['6M'] ?? 0;
          valB = b.returns?.['6M'] ?? 0;
          break;
        case 'return_YTD':
          valA = a.returns?.['YTD'] ?? 0;
          valB = b.returns?.['YTD'] ?? 0;
          break;
        case 'return_1Y':
          valA = a.returns?.['1Y'] ?? 0;
          valB = b.returns?.['1Y'] ?? 0;
          break;
        case 'price':
          valA = a.price;
          valB = b.price;
          break;
        case 'range52w':
          valA = a.range52wPercent;
          valB = b.range52wPercent;
          break;
        case 'rollYield':
          valA = a.annualizedRollYield;
          valB = b.annualizedRollYield;
          break;
        case 'name':
          valA = a.shortName;
          valB = b.shortName;
          break;
        default:
          valA = a.returns?.[timeframe] ?? 0;
          valB = b.returns?.[timeframe] ?? 0;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      const numA = Number(valA);
      const numB = Number(valB);
      return sortAscending ? numA - numB : numB - numA;
    });

    return list;
  }, [commodities, activeComplex, searchQuery, sortField, sortAscending, timeframe]);

  // Aggregate telemetry
  const telemetry = useMemo(() => {
    if (!commodities.length) {
      return {
        advancing: 0,
        declining: 0,
        avgReturn: 0,
        topGainer: null as CommodityPriceItem | null,
        topLaggard: null as CommodityPriceItem | null,
      };
    }

    let adv = 0;
    let dec = 0;
    let sum = 0;
    let topG: CommodityPriceItem | null = null;
    let topL: CommodityPriceItem | null = null;

    commodities.forEach((c) => {
      const ret = c.returns?.[timeframe] ?? c.changePercent;
      sum += ret;
      if (ret >= 0) adv++;
      else dec++;

      if (!topG || ret > (topG.returns?.[timeframe] ?? topG.changePercent)) {
        topG = c;
      }
      if (!topL || ret < (topL.returns?.[timeframe] ?? topL.changePercent)) {
        topL = c;
      }
    });

    return {
      advancing: adv,
      declining: dec,
      avgReturn: Number((sum / commodities.length).toFixed(2)),
      topGainer: topG,
      topLaggard: topL,
    };
  }, [commodities, timeframe]);

  // Grouped by complex structure
  const groupedCommodities = useMemo(() => {
    const map = new Map<CommodityCategory, CommodityPriceItem[]>();
    const order: CommodityCategory[] = [
      'energy',
      'precious_metals',
      'industrial_metals',
      'agriculture',
      'livestock',
    ];

    order.forEach((cat) => map.set(cat, []));

    filteredAndSortedCommodities.forEach((c) => {
      const list = map.get(c.category) || [];
      list.push(c);
      map.set(c.category, list);
    });

    return order
      .map((cat) => ({
        category: cat,
        label: COMPLEX_FILTERS.find((f) => f.id === cat)?.label || cat,
        icon: COMPLEX_FILTERS.find((f) => f.id === cat)?.icon || Layers,
        items: map.get(cat) || [],
      }))
      .filter((g) => g.items.length > 0);
  }, [filteredAndSortedCommodities]);

  const activePeriodLabel = TIMEFRAMES.find((t) => t.id === timeframe)?.periodLabel || timeframe;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "bg-slate-950/98 border border-slate-800 text-foreground p-0 overflow-hidden flex flex-col shadow-2xl backdrop-blur-3xl transition-all duration-300 z-50",
          isFullscreen
            ? "fixed inset-0 w-screen h-screen max-w-none max-h-none rounded-none m-0"
            : "sm:max-w-[1550px] w-[97vw] h-[93vh] max-h-[96vh] rounded-3xl"
        )}
      >
        {/* Ambient Top Glow Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 shrink-0" />

        {/* ================= 1. MODAL HEADER ================= */}
        <div className="p-4 sm:p-5 border-b border-border/40 bg-accent/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 via-primary/20 to-emerald-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-sm shrink-0">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                  Commodities Cross-Asset Performance Heatmap
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] font-mono font-bold bg-primary/15 text-primary border-primary/30 uppercase">
                  {timeframe} Horizon
                </Badge>
                {marketRegime && (
                  <Badge variant="outline" className="text-[10px] font-mono text-amber-300 border-amber-500/30">
                    Regime: {marketRegime.overallPosture.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Full-window relative return matrix across 21 futures benchmarks • Multi-timeframe performance, roll yield & term structure
              </DialogDescription>
            </div>
          </div>

          {/* Timeframe Selector & Window Controls */}
          <div className="flex items-center gap-2 flex-wrap justify-between lg:justify-end">
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
                        ? "bg-gradient-to-r from-primary to-emerald-600 text-white shadow-md scale-102"
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
                title="Grouped by Commodity Complex"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Complexes</span>
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

        {/* ================= 2. TELEMETRY & SUMMARY RIBBON ================= */}
        <div className="bg-slate-900/50 border-b border-border/30 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-muted-foreground">Horizon:</span>
              <strong className="text-foreground">{activePeriodLabel}</strong>
            </div>

            <div className="flex items-center gap-2 font-mono">
              <span className="text-emerald-400 font-bold">▲ {telemetry.advancing} Advancing</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-rose-400 font-bold">▼ {telemetry.declining} Declining</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-muted-foreground">Universe Avg:</span>
              <span className={cn("font-black", telemetry.avgReturn >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {telemetry.avgReturn >= 0 ? '+' : ''}{telemetry.avgReturn}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap font-mono text-[11px]">
            {telemetry.topGainer && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Top Gainer:</span>
                <span className="text-emerald-300 font-bold truncate max-w-[130px]">
                  👑 {telemetry.topGainer.shortName}
                </span>
                <span className="text-emerald-400 font-black">
                  +{(telemetry.topGainer.returns?.[timeframe] ?? telemetry.topGainer.changePercent).toFixed(1)}%
                </span>
              </div>
            )}

            {telemetry.topLaggard && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Top Laggard:</span>
                <span className="text-rose-300 font-bold truncate max-w-[130px]">
                  ⚠️ {telemetry.topLaggard.shortName}
                </span>
                <span className="text-rose-400 font-black">
                  {(telemetry.topLaggard.returns?.[timeframe] ?? telemetry.topLaggard.changePercent).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ================= 3. FILTER & SEARCH CONTROL BAR ================= */}
        <div className="p-3 sm:px-5 border-b border-border/30 bg-background/40 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          {/* Complex Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {COMPLEX_FILTERS.map((f) => {
              const isSelected = activeComplex === f.id;
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveComplex(f.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer shrink-0",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-slate-900/60 hover:bg-accent/40 text-muted-foreground hover:text-foreground border-slate-800"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-2 self-end md:self-auto w-full md:w-auto">
            <div className="relative w-full md:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search commodity or symbol..."
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
          {filteredAndSortedCommodities.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted-foreground border border-dashed border-border/40 rounded-3xl">
              No commodities found matching "{searchQuery}".
            </div>
          ) : viewMode === 'TILES' ? (
            /* VIEW 1: INTERACTIVE HEATMAP TILES GRID */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {filteredAndSortedCommodities.map((item, idx) => {
                const ret = item.returns?.[timeframe] ?? item.changePercent;
                const isPositive = ret >= 0;
                const isBackwardation = item.curveStructure === 'BACKWARDATION';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedCommodity(item)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between gap-3 shadow-lg group relative overflow-hidden",
                      getHeatmapColor(ret)
                    )}
                  >
                    {/* Top Row: Symbol, Category & Structure Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center font-mono font-black text-xs text-foreground group-hover:text-primary transition-colors shadow-inner">
                          {item.id}
                        </div>
                        <div className="min-w-0">
                          <span className="font-mono font-black text-xs text-foreground block truncate group-hover:text-primary transition-colors">
                            {item.shortName}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate block">
                            {item.categoryLabel}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 border shrink-0",
                          isBackwardation
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                            : item.curveStructure === 'CONTANGO'
                            ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                            : "bg-slate-800 text-slate-300 border-slate-700"
                        )}
                        title={isBackwardation ? 'Backwardation: Bullish immediate physical scarcity' : 'Contango: Ample carry/storage'}
                      >
                        {item.curveStructure.slice(0, 4)}
                      </Badge>
                    </div>

                    {/* Middle Row: Large Return Metric */}
                    <div className="flex items-baseline justify-between font-mono my-1">
                      <div>
                        <span className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-1">
                          {isPositive ? <TrendingUp className="w-5 h-5 text-emerald-400 inline" /> : <TrendingDown className="w-5 h-5 text-rose-400 inline" />}
                          <span>{isPositive ? '+' : ''}{ret.toFixed(2)}%</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                          {activePeriodLabel} Return
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-extrabold text-foreground block">
                          ${item.price.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          {item.unit}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: 52W Range Gauge */}
                    <div className="space-y-1 pt-1.5 border-t border-white/10">
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                        <span>52W: ${item.fiftyTwoWeekLow.toFixed(1)}</span>
                        <span className="font-bold text-foreground">{item.range52wPercent}%</span>
                        <span>${item.fiftyTwoWeekHigh.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-primary transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(5, item.range52wPercent))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'GROUPED' ? (
            /* VIEW 2: GROUPED BY COMMODITY COMPLEX */
            <div className="space-y-6">
              {groupedCommodities.map((group) => {
                const Icon = group.icon;
                const groupAvg = Number(
                  (
                    group.items.reduce((acc, c) => acc + (c.returns?.[timeframe] ?? c.changePercent), 0) /
                    group.items.length
                  ).toFixed(2)
                );

                return (
                  <div key={group.category} className="space-y-3">
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
                        <span className="text-muted-foreground">Complex Avg:</span>
                        <span className={cn("font-bold px-2 py-0.5 rounded-lg border", getHeatmapPillColor(groupAvg))}>
                          {groupAvg >= 0 ? '+' : ''}{groupAvg}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {group.items.map((item) => {
                        const ret = item.returns?.[timeframe] ?? item.changePercent;
                        const isPositive = ret >= 0;

                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedCommodity(item)}
                            className={cn(
                              "p-3.5 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col justify-between gap-2 shadow-sm group",
                              getHeatmapColor(ret)
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                                {item.shortName} ({item.id})
                              </span>
                              <span className="font-mono font-black text-sm">
                                {isPositive ? '+' : ''}{ret.toFixed(2)}%
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                              <span>${item.price.toFixed(2)} {item.unit}</span>
                              <span className="text-[10px] font-bold uppercase">{item.curveStructure}</span>
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
                      <th className="py-3 px-4 font-bold">Commodity</th>
                      <th className="py-3 px-3 font-bold">Complex</th>
                      <th className="py-3 px-3 text-right font-bold">Spot Price</th>
                      <th className="py-3 px-2 text-center font-bold">1D</th>
                      <th className="py-3 px-2 text-center font-bold">1W</th>
                      <th className="py-3 px-2 text-center font-bold">1M</th>
                      <th className="py-3 px-2 text-center font-bold">3M</th>
                      <th className="py-3 px-2 text-center font-bold">6M</th>
                      <th className="py-3 px-2 text-center font-bold">YTD</th>
                      <th className="py-3 px-2 text-center font-bold">1Y</th>
                      <th className="py-3 px-3 text-center font-bold">Curve</th>
                      <th className="py-3 px-3 text-right font-bold">Roll Yield</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredAndSortedCommodities.map((item) => {
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedCommodity(item)}
                          className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <span className="text-primary font-black">{item.id}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="truncate max-w-[140px]">{item.shortName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {item.categoryLabel}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-foreground">
                            ${item.price.toFixed(2)} <span className="text-[10px] text-muted-foreground">{item.unit}</span>
                          </td>

                          {/* Returns across all 7 timeframes */}
                          {(['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y'] as CommodityTimeframe[]).map((tf) => {
                            const val = item.returns?.[tf] ?? (tf === '1D' ? item.changePercent : 0);
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
                              className={cn(
                                "text-[9px] uppercase px-1.5 py-0.2 border",
                                item.curveStructure === 'BACKWARDATION'
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                                  : "bg-amber-500/15 text-amber-300 border-amber-500/40"
                              )}
                            >
                              {item.curveStructure.slice(0, 4)}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold">
                            <span className={item.annualizedRollYield >= 0 ? "text-emerald-400" : "text-amber-400"}>
                              {item.annualizedRollYield >= 0 ? '+' : ''}{item.annualizedRollYield.toFixed(1)}%
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

        {/* ================= 5. COMMODITY INSPECTION QUICK DRAWER / POPOVER ================= */}
        {selectedCommodity && (
          <div className="p-4 sm:p-5 bg-slate-900/95 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center font-mono font-black text-sm text-primary shrink-0">
                {selectedCommodity.id}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base font-black text-foreground">
                    {selectedCommodity.name} ({selectedCommodity.symbol})
                  </h4>
                  <Badge variant="outline" className="text-[10px] font-mono border-white/20">
                    {selectedCommodity.exchange}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono font-bold uppercase border",
                      selectedCommodity.curveStructure === 'BACKWARDATION'
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/40"
                    )}
                  >
                    {selectedCommodity.curveStructure}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-2xl">
                  {selectedCommodity.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto">
              <div className="text-right font-mono">
                <span className="text-lg font-black text-foreground block">
                  ${selectedCommodity.price.toFixed(2)} {selectedCommodity.unit}
                </span>
                <span className={cn(
                  "text-xs font-bold",
                  (selectedCommodity.returns?.[timeframe] ?? selectedCommodity.changePercent) >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {(selectedCommodity.returns?.[timeframe] ?? selectedCommodity.changePercent) >= 0 ? '+' : ''}
                  {(selectedCommodity.returns?.[timeframe] ?? selectedCommodity.changePercent).toFixed(2)}% ({timeframe})
                </span>
              </div>

              {onNavigateToGraphs && (
                <Button
                  size="sm"
                  onClick={() => {
                    onClose();
                    onNavigateToGraphs(selectedCommodity.tradingViewSymbol || selectedCommodity.symbol);
                  }}
                  className="h-8 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-1.5 shadow-sm"
                >
                  <LineChartIcon className="w-3.5 h-3.5" />
                  <span>Interactive Chart</span>
                </Button>
              )}

              {onNavigateToResearch && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onNavigateToResearch(selectedCommodity.symbol);
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
                onClick={() => setSelectedCommodity(null)}
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
