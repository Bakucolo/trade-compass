import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Flame,
  Coins,
  Activity,
  TrendingUp,
  TrendingDown,
  Layers,
  Scale,
  Zap,
  Info,
  ExternalLink,
  RefreshCw,
  Search,
  Droplets,
  Calendar,
  LineChart as LineChartIcon,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Gauge,
  Wheat,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  useCommoditiesIntelligence,
  CommodityCategory,
  CommodityPriceItem,
  ForwardCurvePoint,
} from '@/services/commoditiesService';

interface CommoditiesForwardCurveCardProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
}

const CATEGORY_TABS: { id: 'all' | CommodityCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'All Commodities', icon: Layers },
  { id: 'energy', label: 'Energy & Fuels', icon: Flame },
  { id: 'precious_metals', label: 'Precious Metals', icon: Coins },
  { id: 'industrial_metals', label: 'Industrial Metals', icon: Activity },
  { id: 'agriculture', label: 'Agriculture & Softs', icon: Wheat },
  { id: 'livestock', label: 'Livestock', icon: Scale },
];

const CURVE_COMMODITY_KEYS = [
  { id: 'CL', label: 'WTI Crude', icon: Flame, unit: '$/bbl' },
  { id: 'BZ', label: 'Brent Crude', icon: Droplets, unit: '$/bbl' },
  { id: 'NG', label: 'Natural Gas', icon: Zap, unit: '$/MMBtu' },
  { id: 'GC', label: 'Gold', icon: Coins, unit: '$/oz' },
  { id: 'SI', label: 'Silver', icon: Coins, unit: '$/oz' },
  { id: 'HG', label: 'Copper', icon: Activity, unit: '$/lb' },
  { id: 'ZC', label: 'Corn', icon: Wheat, unit: '¢/bu' },
  { id: 'ZW', label: 'Wheat', icon: Wheat, unit: '¢/bu' },
  { id: 'KC', label: 'Coffee', icon: Activity, unit: '¢/lb' },
];

export function CommoditiesForwardCurveCard({
  onNavigateToResearch,
  onNavigateToGraphs,
}: CommoditiesForwardCurveCardProps) {
  const { data, isLoading, isError, refetch, isFetching } = useCommoditiesIntelligence();

  const [selectedCurveId, setSelectedCurveId] = useState<string>('CL');
  const [showHistoricalCurves, setShowHistoricalCurves] = useState<boolean>(true);
  const [activeCatalogCategory, setActiveCatalogCategory] = useState<'all' | CommodityCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRatioId, setSelectedRatioId] = useState<string | null>(null);

  const activeCurve = useMemo(() => {
    if (!data?.forwardCurves) return null;
    return data.forwardCurves[selectedCurveId] || data.forwardCurves['CL'] || null;
  }, [data, selectedCurveId]);

  const filteredCommodities = useMemo(() => {
    if (!data?.commodities) return [];
    return data.commodities.filter((item) => {
      const matchesCategory = activeCatalogCategory === 'all' || item.category === activeCatalogCategory;
      const matchesSearch =
        searchQuery === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.shortName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [data?.commodities, activeCatalogCategory, searchQuery]);

  if (isLoading) {
    return (
      <Card className="bg-card/70 backdrop-blur-xl border border-border/70 rounded-2xl p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-muted-foreground animate-pulse">
            Loading Real-Time Commodities Prices & Forward Curves...
          </p>
        </div>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="bg-card/70 backdrop-blur-xl border border-destructive/40 rounded-2xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
        <h3 className="text-base font-bold text-destructive">Failed to Load Commodities Intelligence</h3>
        <p className="text-xs text-muted-foreground mt-1 mb-4">Unable to retrieve live futures quotes or term structures.</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
        </Button>
      </Card>
    );
  }

  const { marketRegime, commodities, macroRatios } = data;

  return (
    <div className="space-y-6">
      {/* ================= 1. COMMODITY REGIME BAROMETER ================= */}
      <Card className="bg-card/75 backdrop-blur-2xl border border-border/70 shadow-lg rounded-2xl overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500" />
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 via-primary/20 to-emerald-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300 shadow-sm">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-foreground tracking-tight">
                    Commodities Macro Regime & Forward Term Structures
                  </h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-mono font-bold uppercase px-2 py-0.5 border',
                      marketRegime.overallPosture === 'BROAD_BACKWARDATION'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : marketRegime.overallPosture === 'BROAD_CONTANGO'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                        : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
                    )}
                  >
                    {marketRegime.overallPosture.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{marketRegime.summary}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Commodity Inflation Pulse
                </span>
                <span className="text-sm font-mono font-extrabold text-foreground flex items-center justify-end gap-1">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  {marketRegime.inflationaryImpulseScore}/100
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-8 text-xs gap-1.5 border-border/70 hover:bg-accent/40"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin text-primary')} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {/* Sub-Regime Badges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-background/50 border border-border/50 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
                <Flame className="w-3.5 h-3.5" /> Energy Complex
              </div>
              <p className="text-xs text-foreground/90 leading-tight">{marketRegime.energyRegime}</p>
            </div>
            <div className="p-3 rounded-xl bg-background/50 border border-border/50 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-400">
                <Coins className="w-3.5 h-3.5" /> Metals & Mining
              </div>
              <p className="text-xs text-foreground/90 leading-tight">{marketRegime.metalsRegime}</p>
            </div>
            <div className="p-3 rounded-xl bg-background/50 border border-border/50 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                <Wheat className="w-3.5 h-3.5" /> Grains & Softs
              </div>
              <p className="text-xs text-foreground/90 leading-tight">{marketRegime.agricultureRegime}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================= 2. MACRO COMMODITY RATIOS & BENCHMARKS ================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-foreground">Cross-Asset Commodity Macro Ratios & Spreads</h4>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Institutional Sentiment
            </Badge>
          </div>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Click any ratio card to view macro interpretation
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {macroRatios.map((ratio) => {
            const isSelected = selectedRatioId === ratio.id;
            const isUp = ratio.change >= 0;
            return (
              <div
                key={ratio.id}
                onClick={() => setSelectedRatioId(isSelected ? null : ratio.id)}
                className={cn(
                  'p-3.5 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between',
                  isSelected
                    ? 'bg-accent/40 border-primary ring-1 ring-primary/40 shadow-md'
                    : 'bg-card/60 hover:bg-card/90 border-border/60 hover:border-border/90'
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-bold text-muted-foreground truncate" title={ratio.name}>
                      {ratio.name.split('(')[0].trim()}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] font-mono px-1.5 py-0 border shrink-0',
                        ratio.valuationStatus === 'EXTREME_HIGH' || ratio.valuationStatus === 'HIGH'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                          : ratio.valuationStatus === 'EXTREME_LOW' || ratio.valuationStatus === 'LOW'
                          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      )}
                    >
                      {ratio.valuationStatus}
                    </Badge>
                  </div>

                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-mono font-black text-foreground">{ratio.currentValue}</span>
                    <span
                      className={cn(
                        'text-[11px] font-mono font-semibold flex items-center',
                        isUp ? 'text-emerald-400' : 'text-rose-400'
                      )}
                    >
                      {isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5 inline" /> : <ArrowDownRight className="w-3 h-3 mr-0.5 inline" />}
                      {isUp ? '+' : ''}
                      {ratio.change} ({ratio.changePercent}%)
                    </span>
                  </div>

                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-tight">
                    {ratio.macroSignal}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground/80 font-mono">
                  <span>52W: {ratio.historicalLow52w}</span>
                  <span>Mean: {ratio.historicalMean}</span>
                  <span>{ratio.historicalHigh52w}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Ratio Expanded Analysis */}
        {selectedRatioId && (
          <div className="mt-3 p-4 rounded-xl bg-accent/20 border border-primary/30 animate-in fade-in slide-in-from-top-1 text-xs space-y-1.5">
            {(() => {
              const r = macroRatios.find((m) => m.id === selectedRatioId);
              if (!r) return null;
              return (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-primary" /> {r.name} Analysis
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedRatioId(null)}
                      className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Close
                    </Button>
                  </div>
                  <p className="text-foreground/90 leading-relaxed font-sans">{r.interpretation}</p>
                  <p className="text-muted-foreground font-mono text-[11px]">
                    Current Value: <b>{r.currentValue}</b> • 52-Week Range: [{r.historicalLow52w} — {r.historicalHigh52w}] • Historical Mean: {r.historicalMean}
                  </p>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* ================= 3. FORWARD CURVES & TERM STRUCTURE EXPLORER ================= */}
      <Card className="bg-card/75 backdrop-blur-2xl border border-border/70 shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-border/40 bg-accent/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <LineChartIcon className="w-4 h-4 text-emerald-400" />
              <CardTitle className="text-sm font-bold text-foreground">
                Futures Forward Curves (Term Structure Analysis)
              </CardTitle>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                M1 Prompt to M24 Strip
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Analyze prompt physical tightness (Backwardation) vs storage cost carrying charges (Contango) across key commodities.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistoricalCurves(!showHistoricalCurves)}
              className={cn(
                'h-7 text-xs font-semibold gap-1.5 border-border/70 transition-colors',
                showHistoricalCurves
                  ? 'bg-primary/20 text-primary border-primary/40'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{showHistoricalCurves ? 'Historical Curves (Active)' : 'Compare 1M / 6M Ago'}</span>
            </Button>

            {activeCurve && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateToGraphs && onNavigateToGraphs(activeCurve.symbol)}
                className="h-7 text-xs font-semibold gap-1.5 border-border/70 hover:bg-accent/40"
              >
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                <span>Trade Chart</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-6">
          {/* Commodity Selector Ribbon */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
            {CURVE_COMMODITY_KEYS.map((c) => {
              const isSelected = selectedCurveId === c.id;
              const curveData = data?.forwardCurves?.[c.id];
              const isBack = curveData?.structure === 'BACKWARDATION';
              const Icon = c.icon;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCurveId(c.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 shrink-0 transition-all cursor-pointer',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm font-bold'
                      : 'bg-card/50 hover:bg-accent/60 text-muted-foreground hover:text-foreground border-border/50'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{c.label}</span>
                  {curveData && (
                    <span
                      className={cn(
                        'text-[10px] font-mono px-1 rounded',
                        isSelected
                          ? 'bg-black/30 text-white'
                          : isBack
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      )}
                    >
                      {isBack ? 'Backw.' : 'Contango'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Curve Headline Metrics */}
          {activeCurve && (
            <div className="p-4 rounded-xl bg-background/60 border border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h4 className="text-base font-black font-mono text-foreground">{activeCurve.name}</h4>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-bold uppercase px-2 py-0.5 border',
                      activeCurve.structure === 'BACKWARDATION'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                    )}
                  >
                    {activeCurve.structure === 'BACKWARDATION' ? '✓ Backwardation (Physical Deficit)' : 'Contango (Carry Drag)'}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-mono border-border/70 text-muted-foreground">
                    Spot / M1: ${activeCurve.spotPrice.toFixed(2)} {activeCurve.unit}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{activeCurve.curveShapeDescription}</p>
                <p className="text-xs text-foreground/90 mt-1 font-sans">{activeCurve.marketThesis}</p>
              </div>

              <div className="grid grid-cols-3 gap-3 md:border-l md:border-border/50 md:pl-6 shrink-0">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Prompt Spread (M1-M2)
                  </span>
                  <span
                    className={cn(
                      'text-sm font-mono font-bold',
                      activeCurve.promptSpread <= 0 ? 'text-emerald-400' : 'text-amber-400'
                    )}
                  >
                    {activeCurve.promptSpread > 0 ? '+' : ''}${activeCurve.promptSpread.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    1-Year Curve Slope
                  </span>
                  <span
                    className={cn(
                      'text-sm font-mono font-bold',
                      activeCurve.slopePercent <= 0 ? 'text-emerald-400' : 'text-amber-400'
                    )}
                  >
                    {activeCurve.slopePercent > 0 ? '+' : ''}{activeCurve.slopePercent.toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Est. Roll Yield (p.a.)
                  </span>
                  <span
                    className={cn(
                      'text-sm font-mono font-bold',
                      activeCurve.annualizedRollYield >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    )}
                  >
                    {activeCurve.annualizedRollYield >= 0 ? '+' : ''}{activeCurve.annualizedRollYield.toFixed(2)}%/yr
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Recharts Forward Curve Visualizer */}
          {activeCurve && (
            <div className="space-y-2">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activeCurve.points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="curveColorCurrent" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={activeCurve.structure === 'BACKWARDATION' ? '#10b981' : '#f59e0b'}
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor={activeCurve.structure === 'BACKWARDATION' ? '#10b981' : '#f59e0b'}
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="contractMonth"
                      stroke="rgba(255,255,255,0.4)"
                      tick={{ fontSize: 11, fill: 'currentColor' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      stroke="rgba(255,255,255,0.4)"
                      tick={{ fontSize: 11, fill: 'currentColor' }}
                      tickLine={false}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                      }}
                      formatter={(val: any, name: string) => {
                        if (name === 'price') return [`$${Number(val).toFixed(2)} ${activeCurve.unit}`, 'Current Curve'];
                        if (name === 'historicalOneMonthAgo') return [`$${Number(val).toFixed(2)} ${activeCurve.unit}`, '1 Month Ago'];
                        if (name === 'historicalSixMonthsAgo') return [`$${Number(val).toFixed(2)} ${activeCurve.unit}`, '6 Months Ago'];
                        return [val, name];
                      }}
                      labelFormatter={(label, payload) => {
                        const pt = payload?.[0]?.payload as ForwardCurvePoint;
                        if (!pt) return label;
                        return `${pt.tenor} Contract: ${pt.contractCode} (${pt.contractMonth}) • Spread to M1: ${pt.spreadToPrompt >= 0 ? '+' : ''}$${pt.spreadToPrompt} (${pt.spreadPercent}%)`;
                      }}
                    />
                    <ReferenceLine
                      y={activeCurve.spotPrice}
                      stroke="rgba(255,255,255,0.25)"
                      strokeDasharray="4 4"
                      label={{ value: `M1 Prompt: $${activeCurve.spotPrice}`, fill: 'rgba(255,255,255,0.6)', fontSize: 10, position: 'insideTopLeft' }}
                    />
                    {showHistoricalCurves && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="historicalSixMonthsAgo"
                          stroke="#a855f7"
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          dot={false}
                          name="historicalSixMonthsAgo"
                        />
                        <Line
                          type="monotone"
                          dataKey="historicalOneMonthAgo"
                          stroke="#06b6d4"
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                          dot={false}
                          name="historicalOneMonthAgo"
                        />
                      </>
                    )}
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={activeCurve.structure === 'BACKWARDATION' ? '#10b981' : '#f59e0b'}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#curveColorCurrent)"
                      name="price"
                      dot={{ r: 3, fill: activeCurve.structure === 'BACKWARDATION' ? '#10b981' : '#f59e0b' }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Curve Legend & Tenor Quick Ribbon */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 px-1">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'w-2.5 h-2.5 rounded-full inline-block',
                        activeCurve.structure === 'BACKWARDATION' ? 'bg-emerald-400' : 'bg-amber-400'
                      )}
                    />
                    <span className="text-foreground font-semibold">Active Current Curve</span>
                  </span>
                  {showHistoricalCurves && (
                    <>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-0.5 bg-cyan-400 inline-block border-b border-dashed" />
                        <span>1 Month Ago</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-0.5 bg-purple-400 inline-block border-b border-dotted" />
                        <span>6 Months Ago</span>
                      </span>
                    </>
                  )}
                </div>
                <span className="font-mono text-[10px]">Settlement in USD</span>
              </div>
            </div>
          )}

          {/* Calendar Spreads Table & Physical Supply Telemetry (2-Column Grid) */}
          {activeCurve && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
              {/* Left Column: Calendar Spreads Table */}
              <div className="p-4 rounded-xl bg-background/50 border border-border/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" /> Key Calendar Spreads & Roll Economics
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                    Prompt vs Strips
                  </Badge>
                </div>

                <div className="space-y-2">
                  {activeCurve.calendarSpreads.map((cs, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-card/60 border border-border/40 text-xs space-y-1 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">{cs.name}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'font-mono font-bold',
                              cs.spread >= 0 ? 'text-emerald-400' : 'text-amber-400'
                            )}
                          >
                            {cs.spread >= 0 ? '+' : ''}${cs.spread.toFixed(2)} ({cs.spreadPercent}%)
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[9px] font-mono px-1.5 py-0 border',
                              cs.signal === 'BULLISH_BACKWARDATION'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                            )}
                          >
                            {cs.signal === 'BULLISH_BACKWARDATION' ? 'Backwardation' : 'Contango'}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">{cs.implication}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Physical Supply & Seasonal Telemetry */}
              <div className="p-4 rounded-xl bg-background/50 border border-border/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" /> Physical Supply, Inventories & Catalysts
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono text-cyan-400 border-cyan-500/30">
                    Fundamental Pillars
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-card/60 border border-border/40 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-primary block">Inventory Context</span>
                    <p className="text-[11px] text-foreground/90 leading-tight">
                      {activeCurve.keyStats.inventoryContext}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card/60 border border-border/40 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-amber-400 block">Supply Catalyst</span>
                    <p className="text-[11px] text-foreground/90 leading-tight">
                      {activeCurve.keyStats.supplyCatalyst}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card/60 border border-border/40 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-emerald-400 block">Demand Catalyst</span>
                    <p className="text-[11px] text-foreground/90 leading-tight">
                      {activeCurve.keyStats.demandCatalyst}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card/60 border border-border/40 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-cyan-400 block">Seasonal Pattern</span>
                    <p className="text-[11px] text-foreground/90 leading-tight">
                      {activeCurve.keyStats.seasonalPattern}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================= 4. COMMODITIES PRICE & STRUCTURE CATALOG ================= */}
      <Card className="bg-card/75 backdrop-blur-2xl border border-border/70 shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-border/40 bg-accent/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <CardTitle className="text-sm font-bold text-foreground">
              Commodities Universe Price Grid & Telemetry
            </CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono">
              {filteredCommodities.length} Assets
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-48 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search commodity or ticker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-background/50 border-border/60 rounded-xl"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const isSelected = activeCatalogCategory === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCatalogCategory(tab.id)}
                  className={cn(
                    'px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer shrink-0',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-background/40 hover:bg-accent/60 text-muted-foreground hover:text-foreground border-border/50'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Commodity Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredCommodities.map((item) => {
              const isUp = item.change >= 0;
              const isBackwardation = item.curveStructure === 'BACKWARDATION';

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-background/50 border border-border/50 hover:border-primary/40 transition-all hover:shadow-md space-y-3 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-foreground">{item.symbol}</span>
                        <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 border-border/60 text-muted-foreground">
                          {item.exchange}
                        </Badge>
                      </div>
                      <h5 className="text-xs font-bold text-foreground/90 mt-0.5">{item.name}</h5>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-mono font-black text-foreground">
                        ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-[10px] text-muted-foreground font-sans font-normal ml-1">
                          {item.unit}
                        </span>
                      </div>
                      <div
                        className={cn(
                          'text-xs font-mono font-bold flex items-center justify-end',
                          isUp ? 'text-emerald-400' : 'text-rose-400'
                        )}
                      >
                        {isUp ? '+' : ''}
                        {item.change.toFixed(2)} ({item.changePercent.toFixed(2)}%)
                      </div>
                    </div>
                  </div>

                  {/* 52-Week Range Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                      <span>52W L: ${item.fiftyTwoWeekLow.toFixed(2)}</span>
                      <span>52W H: ${item.fiftyTwoWeekHigh.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-border/40 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-amber-500 rounded-full"
                        style={{ width: `${item.range52wPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Curve Structure & Roll Yield Badge */}
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] font-mono font-bold px-1.5 py-0 border',
                          isBackwardation
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                        )}
                      >
                        {isBackwardation ? 'Backwardation' : 'Contango'}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        Prompt Spread: {item.promptSpread > 0 ? '+' : ''}${item.promptSpread.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCurveId(item.id)}
                        className="h-6 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/10 gap-1"
                        title={`View ${item.shortName} Forward Curve`}
                      >
                        <LineChartIcon className="w-3 h-3" />
                        <span>Curve</span>
                      </Button>
                      {onNavigateToGraphs && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onNavigateToGraphs(item.symbol)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title="Open Chart"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredCommodities.length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground bg-background/30 rounded-xl border border-dashed border-border/60">
              No commodities found matching "{searchQuery}".
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
