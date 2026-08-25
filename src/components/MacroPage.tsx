import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Globe,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  LineChart,
  Layers,
  Scale,
  Gauge,
  Flame,
  Coins,
  DollarSign,
  Landmark,
  ArrowRight,
  Maximize2,
  ExternalLink,
  ChevronRight,
  Info,
  BarChart3,
  Building2,
  PieChart
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from './ui/dialog';
import { useMacroOverview, MacroAssetItem } from '@/services/macroService';
import { useMacroDossiers } from '@/services/macroDossierService';
import { MacroDossierModal } from './macro/MacroDossierModal';
import { TradingViewChart } from './graphs/TradingViewChart';
import { YieldsBondsChartCard } from './macro/YieldsBondsChartCard';
import { SectorsAndIndustriesCard } from './macro/SectorsAndIndustriesCard';
import { EconomicCycleCard } from './macro/EconomicCycleCard';

interface MacroPageProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
}

type MacroCategoryTab = 'all' | 'economic' | 'volatility' | 'rates_bonds' | 'indices' | 'currencies' | 'metals' | 'energy';

const CATEGORY_TABS: { id: MacroCategoryTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'All Macro', icon: Globe },
  { id: 'economic', label: 'Fed & Economics (FRED)', icon: Building2 },
  { id: 'volatility', label: 'Volatility & Fear', icon: Zap },
  { id: 'rates_bonds', label: 'Rates & Bonds', icon: Landmark },
  { id: 'indices', label: 'Global Indices', icon: Activity },
  { id: 'currencies', label: 'Currencies & FX', icon: DollarSign },
  { id: 'metals', label: 'Metals & Mining', icon: Coins },
  { id: 'energy', label: 'Energy & Petroleum', icon: Flame },
];

export function MacroPage({ onNavigateToResearch, onNavigateToGraphs }: MacroPageProps) {
  const { data: macroData, isLoading, refetch, isFetching } = useMacroOverview();
  const { data: dossiers = [] } = useMacroDossiers(10);
  const [activeTab, setActiveTab] = useState<MacroCategoryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);

  // Selected Macro Instrument for TradingView Modal
  const [chartModalSymbol, setChartModalSymbol] = useState<MacroAssetItem | null>(null);

  const categorized = macroData?.categorized;
  const regime = macroData?.regime;
  const yieldCurve = macroData?.yieldCurve || [];
  const spread2y10y = macroData?.spread2y10y ?? 0.36;
  const isCurveInverted = macroData?.isCurveInverted ?? false;

  // Active items list
  const activeItems = useMemo(() => {
    if (!categorized) return [];
    let list: MacroAssetItem[] = [];

    if (activeTab === 'all') {
      list = categorized.all || [];
    } else {
      list = categorized[activeTab] || [];
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (item) =>
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.assetType.toLowerCase().includes(q) ||
        (item.source && item.source.toLowerCase().includes(q))
    );
  }, [categorized, activeTab, searchQuery]);

  // Format price display based on asset type / format / FRED series
  const formatPrice = (item: MacroAssetItem) => {
    if (item.format === 'percent') {
      return `${item.price.toFixed(2)}%`;
    }
    if (item.symbol === 'WALCL') {
      return `$${(item.price / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}B`;
    }
    if (item.symbol === 'M2SL' || item.symbol === 'GDPC1') {
      return `$${item.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}B`;
    }
    if (item.format === 'number') {
      return item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (item.category === 'currencies' && !item.symbol.includes('BTC') && !item.symbol.includes('ETH')) {
      return item.price.toFixed(4);
    }
    return `$${item.price.toLocaleString(undefined, {
      minimumFractionDigits: item.price < 10 ? 2 : item.price < 1000 ? 2 : 2,
      maximumFractionDigits: item.price < 10 ? 3 : 2,
    })}`;
  };

  const formatChange = (item: MacroAssetItem) => {
    const sign = item.change >= 0 ? '+' : '';
    if (item.format === 'percent') {
      return `${sign}${item.change.toFixed(2)} pts (${sign}${item.changePercent.toFixed(2)}%)`;
    }
    return `${sign}${item.change.toFixed(2)} (${sign}${item.changePercent.toFixed(2)}%)`;
  };

  return (
    <div className="space-y-6 animate-fade-in p-1 sm:p-2 max-w-[1600px] mx-auto pb-12">
      
      {/* ================= TOP EXECUTIVE MACRO REGIME BANNER ================= */}
      <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-card/80 via-card/50 to-accent/10 backdrop-blur-2xl p-5 sm:p-6 shadow-2xl">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Regime Status & Description */}
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 via-cyan-500/20 to-purple-500/20 border border-primary/40 flex items-center justify-center text-primary shadow-inner">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground glow-text-white">
                    Global Macro & FRED Intelligence
                  </h1>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-2.5 py-0.5 font-bold uppercase tracking-wider border",
                      regime?.tone === 'bullish' ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" :
                      regime?.tone === 'bearish' ? "bg-rose-500/15 text-rose-300 border-rose-500/40" :
                      regime?.tone === 'warning' ? "bg-amber-500/15 text-amber-300 border-amber-500/40" :
                      "bg-primary/15 text-primary border-primary/40"
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
                    {regime?.title || 'Goldilocks Posture'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  <span>Federal Reserve (FRED) + Real-Time Inter-Market Telemetry</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">FRED API Active</span>
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed pl-1 pt-1">
              {regime?.description || 'Macro volatility is within normal ranges with stable bond yields and balanced risk assets.'}
            </p>
          </div>

          {/* Right: Key Macro Barometers & Refresh */}
          <div className="flex items-center gap-3 flex-wrap lg:justify-end">
            {/* VIX Fear Gauge */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-card/60 border border-border/60 shadow-sm min-w-[110px]">
              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> VIX Volatility
              </span>
              <span className={cn(
                "text-base font-black font-mono block mt-0.5",
                (regime?.vix || 15) > 20 ? "text-rose-400" : (regime?.vix || 15) < 15 ? "text-emerald-400" : "text-amber-400"
              )}>
                {regime?.vix ? regime.vix.toFixed(2) : '15.42'}
              </span>
            </div>

            {/* US 10Y Yield */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-card/60 border border-border/60 shadow-sm min-w-[110px]">
              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                <Landmark className="w-3 h-3 text-cyan-400" /> 10Y Treasury
              </span>
              <span className="text-base font-black font-mono text-cyan-300 block mt-0.5">
                {regime?.us10y ? `${regime.us10y.toFixed(2)}%` : '4.38%'}
              </span>
            </div>

            {/* DXY Dollar */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-card/60 border border-border/60 shadow-sm min-w-[110px]">
              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-400" /> US Dollar (DXY)
              </span>
              <span className="text-base font-black font-mono text-emerald-300 block mt-0.5">
                {regime?.dxy ? regime.dxy.toFixed(2) : '103.80'}
              </span>
            </div>

            {/* WTI Crude */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-card/60 border border-border/60 shadow-sm min-w-[110px]">
              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                <Flame className="w-3 h-3 text-rose-400" /> WTI Crude Oil
              </span>
              <span className="text-base font-black font-mono text-rose-300 block mt-0.5">
                ${regime?.oil ? regime.oil.toFixed(2) : '71.40'}
              </span>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-10 w-10 rounded-2xl border-border/70 hover:bg-accent/40 shadow-sm shrink-0"
              title="Refresh Macro Telemetry"
            >
              <RefreshCw className={cn("w-4 h-4 text-primary", isFetching && "animate-spin")} />
            </Button>

            {/* Autonomous Macro Dossier Agent Trigger Button */}
            <Button
              onClick={() => setIsDossierModalOpen(true)}
              className="h-10 px-4 rounded-2xl bg-gradient-to-r from-primary via-cyan-600 to-purple-600 hover:opacity-95 text-white font-bold text-xs gap-2 shadow-lg shadow-primary/20 shrink-0 border border-white/10"
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>AI Macro Dossier</span>
              {dossiers.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/30 text-cyan-200">
                  {dossiers.length}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ================= 2. ECONOMIC CYCLE STAGE & MACRO REGIME STATION ================= */}
      <EconomicCycleCard
        onNavigateToResearch={onNavigateToResearch}
        onNavigateToGraphs={onNavigateToGraphs}
      />

      {/* ================= 3. SOVEREIGN YIELDS & BOND MARKET CHART STATION ================= */}
      <YieldsBondsChartCard onNavigateToGraphs={onNavigateToGraphs} />

      {/* ================= 4. SECTORS & INDUSTRY PERFORMANCE & ROTATION ANALYZER ================= */}
      <SectorsAndIndustriesCard
        onNavigateToResearch={onNavigateToResearch}
        onNavigateToGraphs={onNavigateToGraphs}
      />

      {/* ================= YIELD CURVE & MACRO RADAR ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* US Treasury Yield Curve Visualizer (2 Cols) */}
        <Card className="lg:col-span-2 bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-border/40 bg-accent/10 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-cyan-400" />
              <CardTitle className="text-sm font-bold text-foreground">
                US Sovereign Yield Curve Structure (FRED Data)
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-mono font-bold px-2 py-0.5 border",
                  isCurveInverted
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                )}
              >
                2Y/10Y Spread: {spread2y10y >= 0 ? '+' : ''}{(spread2y10y * 100).toFixed(0)} bps ({isCurveInverted ? 'Inverted' : 'Normal Curve'})
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              {yieldCurve.map((pt) => {
                const heightPct = Math.min(100, Math.max(20, (pt.yield / 6) * 100));
                const isTenYear = pt.term === '10Y';
                return (
                  <div
                    key={pt.term}
                    className={cn(
                      "p-3 rounded-xl border transition-all flex flex-col items-center justify-between gap-2 relative overflow-hidden group",
                      isTenYear
                        ? "bg-cyan-950/20 border-cyan-500/40 ring-1 ring-cyan-500/30"
                        : "bg-card/40 border-border/40 hover:border-border/70"
                    )}
                  >
                    <span className="text-[11px] font-mono font-bold text-muted-foreground group-hover:text-foreground">
                      {pt.term}
                    </span>

                    {/* Mini Visual Yield Column */}
                    <div className="w-full h-16 bg-slate-950/60 rounded-lg p-1 flex items-end justify-center">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={cn(
                          "w-full rounded transition-all duration-500",
                          isTenYear
                            ? "bg-gradient-to-t from-cyan-600 to-cyan-400 shadow-cyan-500/50 shadow-sm"
                            : "bg-gradient-to-t from-primary/60 to-primary"
                        )}
                      />
                    </div>

                    <div className="text-center font-mono">
                      <span className="text-sm font-black text-foreground block">
                        {pt.yield.toFixed(2)}%
                      </span>
                      <span className="text-[9px] text-muted-foreground truncate max-w-[70px]">
                        {pt.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                Data sourced directly from Federal Reserve Constant Maturity Yield series.
              </span>
              <span className="font-mono text-cyan-300">
                10Y Yield: {yieldCurve.find(p => p.term === '10Y')?.yield.toFixed(2) || '4.38'}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Macro Cross-Asset Correlation Card (1 Col) */}
        <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-5 pb-3 border-b border-border/40 bg-accent/10 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-purple-400" />
              <CardTitle className="text-sm font-bold text-foreground">
                Macro Policy & Credit Spreads
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] text-purple-300 border-purple-500/30">
              FRED Telemetry
            </Badge>
          </CardHeader>

          <CardContent className="p-5 space-y-3 flex-1 flex flex-col justify-between text-xs">
            <div className="space-y-2.5">
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏛️</span>
                  <span className="font-semibold text-foreground">Fed Funds Rate</span>
                </div>
                <span className="font-mono text-[11px] text-cyan-400 font-bold">
                  {categorized?.economic?.find(i => i.symbol === 'FEDFUNDS')?.price.toFixed(2) || '4.83'}%
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">⚡</span>
                  <span className="font-semibold text-foreground">High Yield Spread</span>
                </div>
                <span className="font-mono text-[11px] text-emerald-400 font-bold">
                  +{categorized?.economic?.find(i => i.symbol === 'BAMLH0A0HYM2')?.price.toFixed(2) || '3.12'}% (Benign)
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">👥</span>
                  <span className="font-semibold text-foreground">US Unemployment</span>
                </div>
                <span className="font-mono text-[11px] text-amber-400 font-bold">
                  {categorized?.economic?.find(i => i.symbol === 'UNRATE')?.price.toFixed(1) || '4.3'}%
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateToGraphs && onNavigateToGraphs('^VIX')}
              className="w-full text-xs font-bold gap-1.5 border-purple-500/30 hover:bg-purple-950/20 text-purple-300 mt-2"
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>Open VIX in Graphs Terminal</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ================= CATEGORY TABS & SEARCH BAR ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        {/* Category Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = tab.id === 'all' ? categorized?.all?.length : categorized?.[tab.id]?.length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {count !== undefined && (
                  <span className={cn(
                    "text-[10px] font-mono px-1.5 py-0.2 rounded-full",
                    isActive ? "bg-black/20 text-white" : "bg-slate-900 text-muted-foreground"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="w-full md:w-64 shrink-0">
          <Input
            placeholder="Search macro or FRED ticker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 text-xs bg-slate-900/80 border-slate-700/50 rounded-xl"
          />
        </div>
      </div>

      {/* ================= MACRO ASSET CARDS GRID (LOWER BOARD) ================= */}
      {isLoading ? (
        <div className="py-24 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <span>Synchronizing Federal Reserve and global macro data feeds...</span>
        </div>
      ) : activeItems.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-2xl">
          No macro assets found matching "{searchQuery}".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeItems.map((item) => {
            const isPositive = item.change >= 0;
            const isFred = item.source === 'FRED';
            const rangeSpan = (item.fiftyTwoWeekHigh - item.fiftyTwoWeekLow) || 1;
            const currentPositionPct = Math.min(100, Math.max(0, ((item.price - item.fiftyTwoWeekLow) / rangeSpan) * 100));

            return (
              <Card
                key={item.symbol}
                className="bg-card/60 backdrop-blur-xl border border-border/60 hover:border-primary/40 transition-all rounded-2xl shadow-md overflow-hidden group flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-2 border-b border-border/30 bg-accent/5 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-xl border flex items-center justify-center font-mono font-bold text-xs shrink-0",
                      isFred
                        ? "bg-purple-950/40 border-purple-500/30 text-purple-300"
                        : "bg-slate-900/80 border-white/5 text-cyan-400"
                    )}>
                      {item.symbol.slice(0, 3)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-xs text-foreground group-hover:text-primary transition-colors">
                          {item.symbol}
                        </span>
                        <Badge variant="outline" className={cn(
                          "text-[8.5px] px-1.5 py-0 font-semibold border",
                          isFred ? "border-purple-500/40 text-purple-300 bg-purple-500/10" : "border-white/10 text-muted-foreground"
                        )}>
                          {isFred ? 'FRED' : item.assetType}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[170px]" title={item.name}>
                        {item.name}
                      </p>
                    </div>
                  </div>

                  {/* 1-Click Chart Modal Trigger */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setChartModalSymbol(item)}
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-cyan-300 hover:bg-cyan-950/30 transition-colors"
                    title={`Expand TradingView Chart for ${item.symbol}`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </Button>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  {/* Price and Day Change */}
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-xl font-black text-foreground tracking-tight">
                      {formatPrice(item)}
                    </span>
                    <div className={cn(
                      "text-xs font-bold flex items-center gap-0.5 px-2 py-0.5 rounded-lg border",
                      isPositive
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    )}>
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span>{item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%</span>
                    </div>
                  </div>

                  {/* Range or Source Details */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9.5px] font-mono text-muted-foreground">
                      <span>{isFred ? 'Series Source: FRED' : `52W L: ${item.fiftyTwoWeekLow.toFixed(2)}`}</span>
                      <span>{isFred ? `Obs: ${item.lastUpdated?.slice(0, 10)}` : `52W H: ${item.fiftyTwoWeekHigh.toFixed(2)}`}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden relative">
                      <div
                        style={{ width: `${currentPositionPct}%` }}
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isPositive ? "bg-emerald-500" : "bg-rose-500"
                        )}
                      />
                    </div>
                  </div>

                  {/* Quick Action Footer */}
                  <div className="pt-2 border-t border-border/30 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setChartModalSymbol(item)}
                      className="h-7 text-xs font-semibold gap-1 hover:bg-cyan-950/20 hover:text-cyan-300 hover:border-cyan-500/40"
                    >
                      <LineChart className="w-3 h-3" /> Chart
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigateToResearch && onNavigateToResearch(item.symbol.replace('^', ''))}
                      className="h-7 text-xs font-semibold gap-1 hover:bg-primary/20 hover:text-primary"
                    >
                      <Sparkles className="w-3 h-3 text-amber-300" /> Research
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ================= FULL TRADINGVIEW CHART MODAL FOR MACRO ASSETS ================= */}
      {chartModalSymbol && (
        <Dialog open={Boolean(chartModalSymbol)} onOpenChange={(open) => !open && setChartModalSymbol(null)}>
          <DialogContent className="sm:max-w-[1100px] w-[95vw] h-[85vh] bg-slate-950 border border-slate-800 text-foreground p-5 rounded-2xl flex flex-col">
            <DialogHeader className="space-y-1 pb-2 border-b border-border/40">
              <div className="flex items-center justify-between pr-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center font-mono font-bold text-xs text-cyan-300">
                    {chartModalSymbol.symbol.slice(0, 3)}
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-black font-mono text-foreground flex items-center gap-2">
                      {chartModalSymbol.symbol}
                      <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-300">
                        {chartModalSymbol.source === 'FRED' ? 'FRED Indicator' : chartModalSymbol.assetType}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      {chartModalSymbol.name} • Live Interactive Canvas
                    </DialogDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const sym = chartModalSymbol.symbol;
                      setChartModalSymbol(null);
                      if (onNavigateToGraphs) onNavigateToGraphs(sym);
                    }}
                    className="h-8 text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open in Graphs Terminal
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 pt-3">
              <TradingViewChart
                symbol={
                  chartModalSymbol.symbol.startsWith('^')
                    ? chartModalSymbol.symbol
                    : chartModalSymbol.symbol === 'DGS10' ? '^TNX'
                    : chartModalSymbol.symbol === 'DGS2' ? '^FVX'
                    : chartModalSymbol.symbol === 'DGS30' ? '^TYX'
                    : chartModalSymbol.symbol === 'VIXCLS' ? '^VIX'
                    : chartModalSymbol.symbol === 'DCOILWTICO' ? 'CL=F'
                    : chartModalSymbol.symbol === 'GOLDAMGBD228NLBM' ? 'GC=F'
                    : chartModalSymbol.symbol === 'DTWEXBGS' ? 'DX-Y.NYB'
                    : chartModalSymbol.symbol
                }
                theme="dark"
                interval="D"
                className="w-full h-full min-h-[500px]"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= GLOBAL MACRO DOSSIER AGENT MODAL ================= */}
      {isDossierModalOpen && (
        <MacroDossierModal
          isOpen={isDossierModalOpen}
          onClose={() => setIsDossierModalOpen(false)}
          onNavigateToResearch={onNavigateToResearch}
          onNavigateToGraphs={onNavigateToGraphs}
        />
      )}
    </div>
  );
}
