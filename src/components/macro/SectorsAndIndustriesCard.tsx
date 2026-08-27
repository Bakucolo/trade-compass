import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Table as TableIcon,
  LayoutGrid,
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

export type SectorSortField =
  | 'return_active'
  | 'return_1D'
  | 'return_1W'
  | 'return_1M'
  | 'return_3M'
  | 'return_6M'
  | 'return_YTD'
  | 'return_1Y'
  | 'alpha_active'
  | 'alpha_1D'
  | 'alpha_1W'
  | 'alpha_1M'
  | 'alpha_3M'
  | 'alpha_6M'
  | 'alpha_YTD'
  | 'alpha_1Y'
  | 'momentum'
  | 'rsi'
  | 'dma50'
  | 'dist52wHigh'
  | 'price'
  | 'symbol'
  | 'name'
  | 'rotationStage';

export type SortDirection = 'desc' | 'asc';
type ViewMode = 'HEATMAP_GRID' | 'LEADERBOARD_BARS' | 'ROTATION_QUADRANT' | 'COMPARATIVE_TIMELINE';
type ScopeFilter = 'all' | 'sector' | 'industry';
type TableDisplayMode = 'summary' | 'matrix';

const ROTATION_STAGE_ORDER: Record<string, number> = {
  Leading: 4,
  Improving: 3,
  Weakening: 2,
  Lagging: 1,
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

  // Sorting State
  const [sortField, setSortField] = useState<SectorSortField>('return_active');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [tableDisplayMode, setTableDisplayMode] = useState<TableDisplayMode>('summary');

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

  // Helper to extract sorting value for an item
  const getSortValue = (item: SectorItem, field: SectorSortField, activeTf: SectorTimeframe): number | string => {
    switch (field) {
      case 'return_active':
        return item.returns[activeTf] ?? 0;
      case 'return_1D':
        return item.returns['1D'] ?? 0;
      case 'return_1W':
        return item.returns['1W'] ?? 0;
      case 'return_1M':
        return item.returns['1M'] ?? 0;
      case 'return_3M':
        return item.returns['3M'] ?? 0;
      case 'return_6M':
        return item.returns['6M'] ?? 0;
      case 'return_YTD':
        return item.returns['YTD'] ?? 0;
      case 'return_1Y':
        return item.returns['1Y'] ?? 0;
      case 'alpha_active':
        return item.alphaVsSpy[activeTf] ?? 0;
      case 'alpha_1D':
        return item.alphaVsSpy['1D'] ?? 0;
      case 'alpha_1W':
        return item.alphaVsSpy['1W'] ?? 0;
      case 'alpha_1M':
        return item.alphaVsSpy['1M'] ?? 0;
      case 'alpha_3M':
        return item.alphaVsSpy['3M'] ?? 0;
      case 'alpha_6M':
        return item.alphaVsSpy['6M'] ?? 0;
      case 'alpha_YTD':
        return item.alphaVsSpy['YTD'] ?? 0;
      case 'alpha_1Y':
        return item.alphaVsSpy['1Y'] ?? 0;
      case 'price':
        return item.price ?? 0;
      case 'momentum':
        return item.momentumScore ?? 0;
      case 'rsi':
        return item.rsi14 ?? 0;
      case 'dma50':
        return item.dma50DistancePct ?? 0;
      case 'dist52wHigh':
        return item.distance52wHighPct ?? 0;
      case 'rotationStage':
        return ROTATION_STAGE_ORDER[item.rotationStage] ?? 0;
      case 'symbol':
        return item.symbol ?? '';
      case 'name':
        return item.shortName ?? '';
      default:
        return item.returns[activeTf] ?? 0;
    }
  };

  // Human-readable Sort Field Label
  const getSortFieldLabel = (field: SectorSortField, tf: SectorTimeframe): string => {
    switch (field) {
      case 'return_active':
        return `${tf} Return`;
      case 'return_1D':
        return '1D Return';
      case 'return_1W':
        return '1W Return';
      case 'return_1M':
        return '1M Return';
      case 'return_3M':
        return '3M Return';
      case 'return_6M':
        return '6M Return';
      case 'return_YTD':
        return 'YTD Return';
      case 'return_1Y':
        return '1Y Return';
      case 'alpha_active':
        return `${tf} Alpha vs SPY`;
      case 'alpha_1D':
        return '1D Alpha';
      case 'alpha_1W':
        return '1W Alpha';
      case 'alpha_1M':
        return '1M Alpha';
      case 'alpha_3M':
        return '3M Alpha';
      case 'alpha_6M':
        return '6M Alpha';
      case 'alpha_YTD':
        return 'YTD Alpha';
      case 'alpha_1Y':
        return '1Y Alpha';
      case 'momentum':
        return 'Momentum Acceleration';
      case 'rsi':
        return 'RSI (14)';
      case 'dma50':
        return '50 DMA Distance';
      case 'dist52wHigh':
        return '52W High Proximity';
      case 'price':
        return 'Price ($)';
      case 'symbol':
        return 'Ticker Symbol';
      case 'name':
        return 'Sector Name';
      case 'rotationStage':
        return 'Rotation Stage';
      default:
        return 'Performance';
    }
  };

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

    return [...list].sort((a, b) => {
      const valA = getSortValue(a, sortField, timeframe);
      const valB = getSortValue(b, sortField, timeframe);

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      const numA = Number(valA);
      const numB = Number(valB);

      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });
  }, [allItems, scope, searchQuery, sortField, sortDirection, timeframe]);

  // Click handler to toggle or select column sorting
  const handleSortColumn = (targetField: SectorSortField) => {
    if (sortField === targetField) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(targetField);
      if (targetField === 'symbol' || targetField === 'name') {
        setSortDirection('asc');
      } else {
        setSortDirection('desc');
      }
    }
  };

  // Render header sort arrow indicator
  const renderSortArrow = (field: SectorSortField) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-80 transition-opacity shrink-0 ml-1 inline-block" />
      );
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0 ml-1 inline-block" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0 ml-1 inline-block" />
    );
  };

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

  const isCustomSort = sortField !== 'return_active' || sortDirection !== 'desc';

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
                    onClick={() => {
                      setTimeframe(tf.id);
                    }}
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

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
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
                title="Ranked Alpha Bar Chart & Table"
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

        {/* Third Row: Dedicated Sorting & Quick Presets Control Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-border/30">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" /> Sort By:
            </span>

            {/* Sort Metric Selector Dropdown */}
            <Select
              value={sortField}
              onValueChange={(val) => setSortField(val as SectorSortField)}
            >
              <SelectTrigger className="h-8 w-[210px] text-xs bg-slate-900/90 border-slate-700/60 rounded-xl font-medium focus:ring-1 focus:ring-primary shadow-sm">
                <SelectValue placeholder="Select Sort Metric..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-xs z-50 max-h-80">
                <SelectGroup>
                  <SelectLabel className="text-[10px] font-mono text-muted-foreground uppercase">Returns Performance</SelectLabel>
                  <SelectItem value="return_active">Active ({timeframe}) Return</SelectItem>
                  <SelectItem value="return_1D">1-Day Return (1D)</SelectItem>
                  <SelectItem value="return_1W">1-Week Return (1W)</SelectItem>
                  <SelectItem value="return_1M">1-Month Return (1M)</SelectItem>
                  <SelectItem value="return_3M">3-Month Return (3M)</SelectItem>
                  <SelectItem value="return_6M">6-Month Return (6M)</SelectItem>
                  <SelectItem value="return_YTD">Year-to-Date Return (YTD)</SelectItem>
                  <SelectItem value="return_1Y">1-Year Return (1Y)</SelectItem>
                </SelectGroup>
                <SelectSeparator className="bg-slate-800" />
                <SelectGroup>
                  <SelectLabel className="text-[10px] font-mono text-muted-foreground uppercase">Relative Alpha vs SPY</SelectLabel>
                  <SelectItem value="alpha_active">Active ({timeframe}) Alpha</SelectItem>
                  <SelectItem value="alpha_1D">1D Alpha vs SPY</SelectItem>
                  <SelectItem value="alpha_1W">1W Alpha vs SPY</SelectItem>
                  <SelectItem value="alpha_1M">1M Alpha vs SPY</SelectItem>
                  <SelectItem value="alpha_3M">3M Alpha vs SPY</SelectItem>
                  <SelectItem value="alpha_6M">6M Alpha vs SPY</SelectItem>
                  <SelectItem value="alpha_YTD">YTD Alpha vs SPY</SelectItem>
                  <SelectItem value="alpha_1Y">1Y Alpha vs SPY</SelectItem>
                </SelectGroup>
                <SelectSeparator className="bg-slate-800" />
                <SelectGroup>
                  <SelectLabel className="text-[10px] font-mono text-muted-foreground uppercase">Technical & Momentum</SelectLabel>
                  <SelectItem value="momentum">Momentum Acceleration</SelectItem>
                  <SelectItem value="rsi">RSI (14) Momentum</SelectItem>
                  <SelectItem value="dist52wHigh">52W High Proximity</SelectItem>
                  <SelectItem value="dma50">50 DMA Distance (%)</SelectItem>
                  <SelectItem value="rotationStage">Rotation Stage (Leading 1st)</SelectItem>
                </SelectGroup>
                <SelectSeparator className="bg-slate-800" />
                <SelectGroup>
                  <SelectLabel className="text-[10px] font-mono text-muted-foreground uppercase">General Info</SelectLabel>
                  <SelectItem value="price">Current Price ($)</SelectItem>
                  <SelectItem value="symbol">Ticker Symbol (A-Z)</SelectItem>
                  <SelectItem value="name">Sector / Industry Name</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            {/* Sort Direction Toggle Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className={cn(
                "h-8 px-2.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm",
                sortDirection === 'desc'
                  ? "bg-slate-900 border-primary/50 text-primary hover:bg-primary/10"
                  : "bg-slate-900 border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
              )}
              title={sortDirection === 'desc' ? "Sorted High to Low (Descending)" : "Sorted Low to High (Ascending)"}
            >
              {sortDirection === 'desc' ? (
                <>
                  <ArrowDown className="w-3.5 h-3.5 text-primary" />
                  <span>High → Low</span>
                </>
              ) : (
                <>
                  <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                  <span>Low → High</span>
                </>
              )}
            </Button>

            {/* Quick Sort Presets */}
            <div className="flex items-center gap-1 pl-1 border-l border-border/40 flex-wrap">
              <button
                onClick={() => { setSortField('return_active'); setSortDirection('desc'); }}
                className={cn(
                  "px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 border",
                  sortField === 'return_active' && sortDirection === 'desc'
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                    : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                )}
                title="Sort by highest return in active timeframe"
              >
                <span>🔥</span> Top Gainers
              </button>
              <button
                onClick={() => { setSortField('return_active'); setSortDirection('asc'); }}
                className={cn(
                  "px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 border",
                  sortField === 'return_active' && sortDirection === 'asc'
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm"
                    : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                )}
                title="Sort by biggest decliners in active timeframe"
              >
                <span>❄️</span> Decliners
              </button>
              <button
                onClick={() => { setSortField('alpha_active'); setSortDirection('desc'); }}
                className={cn(
                  "px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 border",
                  sortField === 'alpha_active' && sortDirection === 'desc'
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm"
                    : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                )}
                title="Sort by highest relative alpha vs SPY"
              >
                <span>🚀</span> Alpha
              </button>
              <button
                onClick={() => { setSortField('momentum'); setSortDirection('desc'); }}
                className={cn(
                  "px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 border",
                  sortField === 'momentum' && sortDirection === 'desc'
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm"
                    : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                )}
                title="Sort by strongest momentum acceleration"
              >
                <span>⚡</span> Momentum
              </button>
              <button
                onClick={() => { setSortField('rsi'); setSortDirection('asc'); }}
                className={cn(
                  "px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 border",
                  sortField === 'rsi' && sortDirection === 'asc'
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm"
                    : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                )}
                title="Sort by lowest RSI (Oversold bounce candidates)"
              >
                <span>🌊</span> Oversold
              </button>
            </div>
          </div>

          {/* Sort Status Summary & Reset */}
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <div className="text-[11px] font-mono text-muted-foreground bg-slate-900/60 px-2.5 py-1 rounded-xl border border-border/40 flex items-center gap-1.5">
              <span>Sorted by:</span>
              <strong className="text-foreground">{getSortFieldLabel(sortField, timeframe)}</strong>
              <span className="text-primary font-bold">({sortDirection === 'desc' ? 'High → Low' : 'Low → High'})</span>
              <span>•</span>
              <span>{filteredItems.length} assets</span>
            </div>

            {isCustomSort && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSortField('return_active');
                  setSortDirection('desc');
                }}
                className="h-7 px-2 text-[10.5px] font-bold text-muted-foreground hover:text-foreground hover:bg-accent/40 rounded-lg gap-1"
                title="Reset to default sorting"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </Button>
            )}
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
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredItems.map((item, idx) => {
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
                    {/* Card Header & Rank */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Rank Badge */}
                        <span className={cn(
                          "w-6 h-6 rounded-lg text-[10px] font-mono font-black flex items-center justify-center border shrink-0 shadow-sm",
                          idx === 0
                            ? "bg-amber-500/30 text-amber-300 border-amber-500/60"
                            : idx === 1
                            ? "bg-slate-300/30 text-slate-200 border-slate-300/60"
                            : idx === 2
                            ? "bg-orange-500/30 text-orange-300 border-orange-500/60"
                            : "bg-slate-900/80 text-muted-foreground border-white/10"
                        )}>
                          #{idx + 1}
                        </span>

                        <div className="w-8 h-8 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-center font-mono font-black text-xs text-foreground group-hover:text-primary transition-colors shrink-0 shadow-sm">
                          {item.symbol}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-xs text-foreground group-hover:text-primary transition-colors">
                              {item.symbol}
                            </span>
                            <span className="text-[11px] font-bold text-foreground/90 truncate max-w-[100px]" title={item.shortName}>
                              {item.shortName}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={item.description}>
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

                    {/* Active Sorted Metric Indicator if custom sort is active */}
                    {isCustomSort && (
                      <div className="px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/25 text-[10px] font-mono font-bold text-primary flex items-center justify-between">
                        <span>Sorted: {getSortFieldLabel(sortField, timeframe)}</span>
                        <span>
                          {sortField.startsWith('return_')
                            ? `${(item.returns[sortField.replace('return_', '') as SectorTimeframe] ?? 0) >= 0 ? '+' : ''}${(item.returns[sortField.replace('return_', '') as SectorTimeframe] ?? 0).toFixed(2)}%`
                            : sortField === 'rsi'
                            ? `RSI ${item.rsi14}`
                            : sortField === 'momentum'
                            ? `${item.momentumScore > 0 ? '+' : ''}${item.momentumScore} pts`
                            : sortField === 'dma50'
                            ? `${item.dma50DistancePct >= 0 ? '+' : ''}${item.dma50DistancePct.toFixed(1)}%`
                            : sortField === 'dist52wHigh'
                            ? `${item.distance52wHighPct.toFixed(1)}%`
                            : sortField.startsWith('alpha_')
                            ? `${(item.alphaVsSpy[sortField.replace('alpha_', '') as SectorTimeframe] ?? 0) >= 0 ? '+' : ''}${(item.alphaVsSpy[sortField.replace('alpha_', '') as SectorTimeframe] ?? 0).toFixed(1)}%`
                            : ''}
                        </span>
                      </div>
                    )}

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
                          {isAlphaPos ? '+' : ''}{alpha.toFixed(1)}% vs SPY ({timeframe})
                        </span>
                      </div>
                    </div>

                    {/* Multi-Timeframe Mini Returns Pills */}
                    <div className="grid grid-cols-4 gap-1 text-[9.5px] font-mono text-center pt-1 border-t border-border/30">
                      {(['1W', '1M', '3M', 'YTD'] as const).map((tf) => {
                        const r = item.returns[tf];
                        const isSortedTf = sortField === `return_${tf}` || (sortField === 'return_active' && timeframe === tf);
                        return (
                          <div
                            key={tf}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSortColumn(`return_${tf}` as SectorSortField);
                            }}
                            className={cn(
                              "p-1 rounded-lg transition-all cursor-pointer border",
                              isSortedTf
                                ? "bg-primary/20 border-primary text-primary font-black shadow-sm"
                                : "bg-slate-900/60 border-border/20 hover:border-primary/40 hover:bg-slate-800"
                            )}
                            title={`Click to sort by ${tf} Return`}
                          >
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
          </div>
        ) : viewMode === 'LEADERBOARD_BARS' ? (
          /* ================= VIEW 2: LEADERBOARD & ALPHA RANKING BAR CHART & SORTABLE TABLE ================= */
          <div className="space-y-4">
            {/* Bar Chart Header & Description */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Performance & Alpha Leaderboard ({getSortFieldLabel(sortField, timeframe)})
                </span>
              </div>

              {/* Table View Mode Switcher: Summary vs Full Multi-Timeframe Returns Matrix */}
              <div className="flex items-center bg-slate-900/80 p-0.5 rounded-xl border border-slate-800 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTableDisplayMode('summary')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1",
                    tableDisplayMode === 'summary' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Summary view with technicals"
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>Summary Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTableDisplayMode('matrix')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1",
                    tableDisplayMode === 'matrix' ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                  )}
                  title="All timeframe returns matrix side-by-side"
                >
                  <TableIcon className="w-3 h-3" />
                  <span>All Returns Matrix (1D to 1Y)</span>
                </button>
              </div>
            </div>

            {/* Recharts Bar Chart */}
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredItems.map((i) => {
                    const plotVal =
                      sortField.startsWith('return_')
                        ? i.returns[sortField.replace('return_', '') as SectorTimeframe] ?? i.returns[timeframe]
                        : sortField.startsWith('alpha_')
                        ? i.alphaVsSpy[sortField.replace('alpha_', '') as SectorTimeframe] ?? i.alphaVsSpy[timeframe]
                        : i.returns[timeframe];

                    return {
                      symbol: i.symbol,
                      name: i.shortName,
                      returnVal: plotVal,
                      alphaVal: i.alphaVsSpy[timeframe],
                      rawItem: i,
                    };
                  })}
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
                        value: `SPY Benchmark (${timeframe}): ${benchmark.spy.returns[timeframe] >= 0 ? '+' : ''}${benchmark.spy.returns[timeframe]?.toFixed(2)}%`,
                        fill: '#38bdf8',
                        fontSize: 10,
                        position: 'top',
                      }}
                    />
                  )}
                  <Bar dataKey="returnVal" radius={[6, 6, 0, 0]} onClick={(entry) => setSelectedSector(entry.rawItem)}>
                    {filteredItems.map((entry, index) => {
                      const plotVal =
                        sortField.startsWith('return_')
                          ? entry.returns[sortField.replace('return_', '') as SectorTimeframe] ?? entry.returns[timeframe]
                          : entry.returns[timeframe];
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={plotVal >= 0 ? '#34d399' : '#fb7185'}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Performance Ranking Table with Clickable Sort Headers */}
            <div className="rounded-2xl border border-border/50 overflow-hidden bg-card/40">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/80 text-muted-foreground uppercase font-mono text-[10px] border-b border-border/40 select-none">
                    {tableDisplayMode === 'summary' ? (
                      /* Summary Table Headers */
                      <tr>
                        <th className="p-3 w-12 text-center cursor-pointer hover:text-foreground group" onClick={() => handleSortColumn('return_active')}>
                          Rank {renderSortArrow('return_active')}
                        </th>
                        <th className="p-3 cursor-pointer hover:text-foreground group" onClick={() => handleSortColumn('symbol')}>
                          Ticker / Sector {renderSortArrow('symbol')}
                        </th>
                        <th className="p-3 cursor-pointer hover:text-foreground group" onClick={() => handleSortColumn('name')}>
                          Category {renderSortArrow('name')}
                        </th>
                        <th className="p-3 text-right cursor-pointer hover:text-foreground group" onClick={() => handleSortColumn('price')}>
                          Price {renderSortArrow('price')}
                        </th>
                        <th className="p-3 text-right cursor-pointer hover:text-foreground group" onClick={() => handleSortColumn('return_active')}>
                          Return ({timeframe}) {renderSortArrow('return_active')}
                        </th>
                        <th className="p-3 text-right cursor-pointer hover:text-foreground group" onClick={() => handleSortColumn('alpha_active')}>
                          Alpha vs SPY {renderSortArrow('alpha_active')}
                        </th>
                        <th className="p-3 text-center cursor-pointer hover:text-foreground group" onClick={() => handleSortColumn('rotationStage')}>
                          Rotation Stage {renderSortArrow('rotationStage')}
                        </th>
                        <th className="p-3 text-center cursor-pointer hover:text-foreground group" onClick={() => handleSortColumn('rsi')}>
                          RSI (14) {renderSortArrow('rsi')}
                        </th>
                        <th className="p-3 text-center cursor-pointer hover:text-foreground group" onClick={() => handleSortColumn('dma50')}>
                          50DMA {renderSortArrow('dma50')}
                        </th>
                        <th className="p-3 text-center cursor-pointer hover:text-foreground group" onClick={() => handleSortColumn('dist52wHigh')}>
                          52W High {renderSortArrow('dist52wHigh')}
                        </th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    ) : (
                      /* Full Returns Matrix Table Headers (All Timeframes) */
                      <tr>
                        <th className="p-3 w-12 text-center">Rank</th>
                        <th className="p-3 cursor-pointer hover:text-foreground group" onClick={() => handleSortColumn('symbol')}>
                          Ticker {renderSortArrow('symbol')}
                        </th>
                        <th className="p-3 text-right cursor-pointer hover:text-foreground group" onClick={() => handleSortColumn('price')}>
                          Price {renderSortArrow('price')}
                        </th>
                        <th className={cn("p-2.5 text-right cursor-pointer hover:text-foreground group", sortField === 'return_1D' && "text-primary font-black bg-primary/10")} onClick={() => handleSortColumn('return_1D')}>
                          1D {renderSortArrow('return_1D')}
                        </th>
                        <th className={cn("p-2.5 text-right cursor-pointer hover:text-foreground group", sortField === 'return_1W' && "text-primary font-black bg-primary/10")} onClick={() => handleSortColumn('return_1W')}>
                          1W {renderSortArrow('return_1W')}
                        </th>
                        <th className={cn("p-2.5 text-right cursor-pointer hover:text-foreground group", sortField === 'return_1M' && "text-primary font-black bg-primary/10")} onClick={() => handleSortColumn('return_1M')}>
                          1M {renderSortArrow('return_1M')}
                        </th>
                        <th className={cn("p-2.5 text-right cursor-pointer hover:text-foreground group", sortField === 'return_3M' && "text-primary font-black bg-primary/10")} onClick={() => handleSortColumn('return_3M')}>
                          3M {renderSortArrow('return_3M')}
                        </th>
                        <th className={cn("p-2.5 text-right cursor-pointer hover:text-foreground group", sortField === 'return_6M' && "text-primary font-black bg-primary/10")} onClick={() => handleSortColumn('return_6M')}>
                          6M {renderSortArrow('return_6M')}
                        </th>
                        <th className={cn("p-2.5 text-right cursor-pointer hover:text-foreground group", sortField === 'return_YTD' && "text-primary font-black bg-primary/10")} onClick={() => handleSortColumn('return_YTD')}>
                          YTD {renderSortArrow('return_YTD')}
                        </th>
                        <th className={cn("p-2.5 text-right cursor-pointer hover:text-foreground group", sortField === 'return_1Y' && "text-primary font-black bg-primary/10")} onClick={() => handleSortColumn('return_1Y')}>
                          1Y {renderSortArrow('return_1Y')}
                        </th>
                        <th className="p-3 text-right cursor-pointer hover:text-foreground group" onClick={() => handleSortColumn('alpha_active')}>
                          Alpha ({timeframe}) {renderSortArrow('alpha_active')}
                        </th>
                        <th className="p-3 text-center cursor-pointer hover:text-foreground group" onClick={() => handleSortColumn('rotationStage')}>
                          Stage {renderSortArrow('rotationStage')}
                        </th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-border/20 font-mono">
                    {filteredItems.map((item, idx) => {
                      const ret = item.returns[timeframe];
                      const alpha = item.alphaVsSpy[timeframe];
                      const stage = getRotationStageBadge(item.rotationStage);

                      if (tableDisplayMode === 'summary') {
                        return (
                          <tr
                            key={item.symbol}
                            onClick={() => setSelectedSector(item)}
                            className="hover:bg-accent/30 transition-colors cursor-pointer"
                          >
                            <td className="p-3 text-center font-bold text-muted-foreground">#{idx + 1}</td>
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
                                {item.dma50DistancePct >= 0 ? '+' : ''}{item.dma50DistancePct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-3 text-center text-muted-foreground text-[10px]">
                              {item.distance52wHighPct.toFixed(1)}%
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
                      }

                      {/* Full Matrix View Rows */}
                      return (
                        <tr
                          key={item.symbol}
                          onClick={() => setSelectedSector(item)}
                          className="hover:bg-accent/30 transition-colors cursor-pointer"
                        >
                          <td className="p-3 text-center font-bold text-muted-foreground">#{idx + 1}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-foreground">{item.symbol}</span>
                              <span className="font-sans text-[11px] text-muted-foreground truncate max-w-[90px]">{item.shortName}</span>
                            </div>
                          </td>
                          <td className="p-3 text-right font-bold text-foreground">${item.price.toFixed(2)}</td>

                          {/* 1D */}
                          <td className={cn("p-2.5 text-right font-bold text-[11px]", item.returns['1D'] >= 0 ? "text-emerald-400" : "text-rose-400", sortField === 'return_1D' && "bg-primary/5 font-black")}>
                            {item.returns['1D'] >= 0 ? '+' : ''}{item.returns['1D']?.toFixed(1)}%
                          </td>
                          {/* 1W */}
                          <td className={cn("p-2.5 text-right font-bold text-[11px]", item.returns['1W'] >= 0 ? "text-emerald-400" : "text-rose-400", sortField === 'return_1W' && "bg-primary/5 font-black")}>
                            {item.returns['1W'] >= 0 ? '+' : ''}{item.returns['1W']?.toFixed(1)}%
                          </td>
                          {/* 1M */}
                          <td className={cn("p-2.5 text-right font-bold text-[11px]", item.returns['1M'] >= 0 ? "text-emerald-400" : "text-rose-400", sortField === 'return_1M' && "bg-primary/5 font-black")}>
                            {item.returns['1M'] >= 0 ? '+' : ''}{item.returns['1M']?.toFixed(1)}%
                          </td>
                          {/* 3M */}
                          <td className={cn("p-2.5 text-right font-bold text-[11px]", item.returns['3M'] >= 0 ? "text-emerald-400" : "text-rose-400", sortField === 'return_3M' && "bg-primary/5 font-black")}>
                            {item.returns['3M'] >= 0 ? '+' : ''}{item.returns['3M']?.toFixed(1)}%
                          </td>
                          {/* 6M */}
                          <td className={cn("p-2.5 text-right font-bold text-[11px]", item.returns['6M'] >= 0 ? "text-emerald-400" : "text-rose-400", sortField === 'return_6M' && "bg-primary/5 font-black")}>
                            {item.returns['6M'] >= 0 ? '+' : ''}{item.returns['6M']?.toFixed(1)}%
                          </td>
                          {/* YTD */}
                          <td className={cn("p-2.5 text-right font-bold text-[11px]", item.returns['YTD'] >= 0 ? "text-emerald-400" : "text-rose-400", sortField === 'return_YTD' && "bg-primary/5 font-black")}>
                            {item.returns['YTD'] >= 0 ? '+' : ''}{item.returns['YTD']?.toFixed(1)}%
                          </td>
                          {/* 1Y */}
                          <td className={cn("p-2.5 text-right font-bold text-[11px]", item.returns['1Y'] >= 0 ? "text-emerald-400" : "text-rose-400", sortField === 'return_1Y' && "bg-primary/5 font-black")}>
                            {item.returns['1Y'] >= 0 ? '+' : ''}{item.returns['1Y']?.toFixed(1)}%
                          </td>

                          {/* Alpha vs SPY */}
                          <td className={cn("p-3 text-right font-bold", alpha >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {alpha >= 0 ? '+' : ''}{alpha.toFixed(1)}%
                          </td>

                          {/* Stage */}
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0.2 border", stage.badge)}>
                              {stage.label}
                            </Badge>
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
                    name={`Relative Strength vs SPY (${timeframe})`}
                    unit="%"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                    label={{ value: `Relative Strength vs SPY (${timeframe} Alpha %)`, position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }}
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
                      `${props.payload.symbol} (${props.payload.shortName}): ${timeframe} Alpha ${props.payload.x >= 0 ? '+' : ''}${props.payload.x}%, Momentum ${props.payload.y >= 0 ? '+' : ''}${props.payload.y}`,
                      props.payload.stage,
                    ]}
                  />
                  <Scatter
                    name="Sectors"
                    data={filteredItems.map((i) => ({
                      x: i.alphaVsSpy[timeframe],
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
