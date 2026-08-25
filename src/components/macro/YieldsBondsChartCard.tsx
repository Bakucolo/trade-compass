import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  LineChart as LineChartIcon,
  BarChart3,
  Calendar,
  Maximize2,
  RefreshCw,
  ExternalLink,
  Info,
  Check,
  Zap,
  Scale,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useYieldsAndBondsChart } from '@/services/macroService';
import { TradingViewChart } from '../graphs/TradingViewChart';

interface YieldsBondsChartCardProps {
  onNavigateToGraphs?: (symbol: string) => void;
}

type ChartViewMode = 'YIELDS' | 'SPREAD_INVERSION' | 'BOND_ETFS' | 'TERM_STRUCTURE' | 'TRADINGVIEW';
type Timeframe = '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';

export function YieldsBondsChartCard({ onNavigateToGraphs }: YieldsBondsChartCardProps) {
  const [viewMode, setViewMode] = useState<ChartViewMode>('YIELDS');
  const [timeframe, setTimeframe] = useState<Timeframe>('1Y');

  // Series visibility toggles for Yields Mode
  const [show10Y, setShow10Y] = useState(true);
  const [show2Y, setShow2Y] = useState(true);
  const [show5Y, setShow5Y] = useState(true);
  const [show30Y, setShow30Y] = useState(true);
  const [showFedFunds, setShowFedFunds] = useState(false);

  // Series visibility toggles for Bond ETFs Mode
  const [showTLT, setShowTLT] = useState(true);
  const [showIEF, setShowIEF] = useState(true);
  const [showHYG, setShowHYG] = useState(true);
  const [showLQD, setShowLQD] = useState(false);
  const [showBND, setShowBND] = useState(true);
  const [isNormalized, setIsNormalized] = useState(true);

  // TradingView symbol picker
  const [tvSymbol, setTvSymbol] = useState<'US10Y' | 'US02Y' | 'US30Y' | 'TLT' | 'IEF' | 'HYG' | 'LQD' | 'BND'>('US10Y');

  const { data: chartData, isLoading, isFetching, refetch } = useYieldsAndBondsChart(timeframe);

  const yieldHistory = chartData?.yieldHistory || [];
  const bondEtfHistory = chartData?.bondEtfHistory || [];
  const termStructure = chartData?.termStructure || [];
  const summary = chartData?.summary;

  // TV mapping
  const getTradingViewSymbol = (sym: string) => {
    switch (sym) {
      case 'US10Y': return 'TVC:US10Y';
      case 'US02Y': return 'TVC:US02Y';
      case 'US30Y': return 'TVC:US30Y';
      case 'TLT': return 'NASDAQ:TLT';
      case 'IEF': return 'NASDAQ:IEF';
      case 'HYG': return 'AMEX:HYG';
      case 'LQD': return 'AMEX:LQD';
      case 'BND': return 'NASDAQ:BND';
      default: return 'TVC:US10Y';
    }
  };

  return (
    <Card className="bg-card/70 backdrop-blur-xl border border-border/80 shadow-2xl rounded-3xl overflow-hidden relative group">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500" />

      {/* ================= CARD HEADER ================= */}
      <CardHeader className="p-5 pb-4 border-b border-border/50 bg-accent/10 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-indigo-500/20 to-primary/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm font-bold">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <span>US Sovereign Yields & Bond Market Station</span>
                </CardTitle>
                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30 text-[10px] font-mono font-bold">
                  FRED + Live Market
                </Badge>
                {summary && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono font-bold border",
                      summary.spread10y2y.isInverted
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                    )}
                  >
                    10Y-2Y Spread: {summary.spread10y2y.current >= 0 ? '+' : ''}{(summary.spread10y2y.current * 100).toFixed(0)} bps ({summary.spread10y2y.isInverted ? 'Inverted' : 'Normal Curve'})
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Benchmark Treasury yield curves, 2Y/10Y inversion spreads, and sovereign/credit bond ETF performance.
              </p>
            </div>
          </div>

          {/* View Mode Switcher Pills */}
          <div className="flex items-center bg-card/80 p-1 rounded-2xl border border-border/70 flex-wrap gap-1 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('YIELDS')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
                viewMode === 'YIELDS'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Treasury Yields</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('SPREAD_INVERSION')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
                viewMode === 'SPREAD_INVERSION'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>10Y-2Y Spread</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('BOND_ETFS')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
                viewMode === 'BOND_ETFS'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Bond ETFs</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('TERM_STRUCTURE')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
                viewMode === 'TERM_STRUCTURE'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Curve Shift</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('TRADINGVIEW')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
                viewMode === 'TRADINGVIEW'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LineChartIcon className="w-3.5 h-3.5 text-purple-300" />
              <span>Live TradingView</span>
            </button>
          </div>
        </div>

        {/* Key Barometer Ribbon */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1 font-mono text-xs">
            <div className="p-2 rounded-xl bg-card/60 border border-border/40">
              <span className="text-[9px] text-muted-foreground uppercase block font-sans">10Y Yield</span>
              <span className="text-sm font-bold text-cyan-400">{summary.us10y.current.toFixed(2)}%</span>
            </div>
            <div className="p-2 rounded-xl bg-card/60 border border-border/40">
              <span className="text-[9px] text-muted-foreground uppercase block font-sans">2Y Yield</span>
              <span className="text-sm font-bold text-indigo-400">{summary.us02y.current.toFixed(2)}%</span>
            </div>
            <div className="p-2 rounded-xl bg-card/60 border border-border/40">
              <span className="text-[9px] text-muted-foreground uppercase block font-sans">30Y Yield</span>
              <span className="text-sm font-bold text-purple-400">{summary.us30y.current.toFixed(2)}%</span>
            </div>
            <div className="p-2 rounded-xl bg-card/60 border border-border/40">
              <span className="text-[9px] text-muted-foreground uppercase block font-sans">10Y-2Y Spread</span>
              <span className={cn("text-sm font-bold", summary.spread10y2y.isInverted ? "text-rose-400" : "text-emerald-400")}>
                {summary.spread10y2y.current >= 0 ? '+' : ''}{(summary.spread10y2y.current * 100).toFixed(0)} bps
              </span>
            </div>
            <div className="p-2 rounded-xl bg-card/60 border border-border/40">
              <span className="text-[9px] text-muted-foreground uppercase block font-sans">Fed Funds Rate</span>
              <span className="text-sm font-bold text-amber-400">{summary.fedFunds.toFixed(2)}%</span>
            </div>
            <div className="p-2 rounded-xl bg-card/60 border border-border/40">
              <span className="text-[9px] text-muted-foreground uppercase block font-sans">TLT 20Y Bond</span>
              <span className="text-sm font-bold text-emerald-400">${summary.tlt.current.toFixed(2)}</span>
            </div>
            <div className="p-2 rounded-xl bg-card/60 border border-border/40">
              <span className="text-[9px] text-muted-foreground uppercase block font-sans">HYG Junk Bond</span>
              <span className="text-sm font-bold text-blue-400">${summary.hyg.current.toFixed(2)}</span>
            </div>
          </div>
        )}
      </CardHeader>

      {/* ================= CARD BODY & CONTROLS ================= */}
      <CardContent className="p-5 space-y-4">
        {/* Controls Toolbar: Timeframes & Series Toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Timeframe Selector (Only for non-TradingView and non-Curve shift modes) */}
          {viewMode !== 'TERM_STRUCTURE' && viewMode !== 'TRADINGVIEW' ? (
            <div className="flex items-center bg-card/80 p-0.5 rounded-xl border border-border/60">
              {(['1M', '3M', '6M', '1Y', '5Y', 'MAX'] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all font-mono',
                    timeframe === tf
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
          ) : viewMode === 'TRADINGVIEW' ? (
            /* TradingView Symbol Quick Picker */
            <div className="flex items-center bg-card/80 p-0.5 rounded-xl border border-border/60 flex-wrap gap-1">
              {(['US10Y', 'US02Y', 'US30Y', 'TLT', 'IEF', 'HYG', 'LQD', 'BND'] as const).map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setTvSymbol(sym)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono uppercase transition-all',
                    tvSymbol === sym
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {sym}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Full Term Structure Shift from 1-Month T-Bills to 30-Year Sovereign Bonds</span>
            </div>
          )}

          {/* Series Visibility Toggles */}
          {viewMode === 'YIELDS' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShow10Y(!show10Y)}
                className={cn('px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all flex items-center gap-1', show10Y ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'opacity-40 border-border/40 text-muted-foreground')}
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> 10Y
              </button>
              <button
                type="button"
                onClick={() => setShow2Y(!show2Y)}
                className={cn('px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all flex items-center gap-1', show2Y ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' : 'opacity-40 border-border/40 text-muted-foreground')}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-400" /> 2Y
              </button>
              <button
                type="button"
                onClick={() => setShow5Y(!show5Y)}
                className={cn('px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all flex items-center gap-1', show5Y ? 'bg-teal-500/20 text-teal-300 border-teal-500/50' : 'opacity-40 border-border/40 text-muted-foreground')}
              >
                <span className="w-2 h-2 rounded-full bg-teal-400" /> 5Y
              </button>
              <button
                type="button"
                onClick={() => setShow30Y(!show30Y)}
                className={cn('px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all flex items-center gap-1', show30Y ? 'bg-purple-500/20 text-purple-300 border-purple-500/50' : 'opacity-40 border-border/40 text-muted-foreground')}
              >
                <span className="w-2 h-2 rounded-full bg-purple-400" /> 30Y
              </button>
              <button
                type="button"
                onClick={() => setShowFedFunds(!showFedFunds)}
                className={cn('px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all flex items-center gap-1', showFedFunds ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'opacity-40 border-border/40 text-muted-foreground')}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Fed Funds
              </button>
            </div>
          )}

          {viewMode === 'BOND_ETFS' && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Normalize % vs Price Toggle */}
              <button
                type="button"
                onClick={() => setIsNormalized(!isNormalized)}
                className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-primary/15 text-primary border border-primary/30"
              >
                {isNormalized ? 'Mode: % Return' : 'Mode: Price ($)'}
              </button>

              <button
                type="button"
                onClick={() => setShowTLT(!showTLT)}
                className={cn('px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all flex items-center gap-1', showTLT ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' : 'opacity-40 border-border/40 text-muted-foreground')}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> TLT (20Y)
              </button>
              <button
                type="button"
                onClick={() => setShowIEF(!showIEF)}
                className={cn('px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all flex items-center gap-1', showIEF ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'opacity-40 border-border/40 text-muted-foreground')}
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> IEF (7-10Y)
              </button>
              <button
                type="button"
                onClick={() => setShowHYG(!showHYG)}
                className={cn('px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all flex items-center gap-1', showHYG ? 'bg-purple-500/20 text-purple-300 border-purple-500/50' : 'opacity-40 border-border/40 text-muted-foreground')}
              >
                <span className="w-2 h-2 rounded-full bg-purple-400" /> HYG (Junk)
              </button>
              <button
                type="button"
                onClick={() => setShowBND(!showBND)}
                className={cn('px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-all flex items-center gap-1', showBND ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'opacity-40 border-border/40 text-muted-foreground')}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" /> BND (Total)
              </button>
            </div>
          )}
        </div>

        {/* ================= RENDER SELECTED CHART VIEW ================= */}
        {isLoading ? (
          <div className="h-[360px] flex flex-col items-center justify-center text-xs text-muted-foreground gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <span>Fetching sovereign bond feeds & historical yields...</span>
          </div>
        ) : viewMode === 'YIELDS' ? (
          /* 1. TREASURY YIELDS MULTI-LINE CHART */
          <div className="h-[360px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yieldHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="formattedDate"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={10}
                  tickLine={false}
                  minTickGap={25}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={10}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="p-3 rounded-xl bg-slate-950/90 backdrop-blur-md border border-border/70 shadow-xl text-xs font-mono space-y-1">
                        <span className="font-bold text-foreground block font-sans border-b border-border/40 pb-1">{label}</span>
                        {payload.map((entry: any) => (
                          <div key={entry.name} className="flex justify-between items-center gap-4">
                            <span style={{ color: entry.color }} className="font-semibold">{entry.name}:</span>
                            <span className="font-bold text-foreground">{Number(entry.value).toFixed(2)}%</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {show10Y && (
                  <Line
                    type="monotone"
                    dataKey="us10y"
                    name="10Y Yield"
                    stroke="#22d3ee"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                )}
                {show2Y && (
                  <Line
                    type="monotone"
                    dataKey="us02y"
                    name="2Y Yield"
                    stroke="#818cf8"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                )}
                {show5Y && (
                  <Line
                    type="monotone"
                    dataKey="us05y"
                    name="5Y Yield"
                    stroke="#2dd4bf"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                  />
                )}
                {show30Y && (
                  <Line
                    type="monotone"
                    dataKey="us30y"
                    name="30Y Yield"
                    stroke="#c084fc"
                    strokeWidth={1.5}
                    dot={false}
                  />
                )}
                {showFedFunds && (
                  <Line
                    type="stepAfter"
                    dataKey="fedFunds"
                    name="Fed Funds"
                    stroke="#fbbf24"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : viewMode === 'SPREAD_INVERSION' ? (
          /* 2. 10Y-2Y YIELD CURVE SPREAD AREA CHART */
          <div className="h-[360px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={yieldHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="spreadGreenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="formattedDate"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={10}
                  tickLine={false}
                  minTickGap={25}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)} bps`}
                />
                <ReferenceLine y={0} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" label={{ value: '0 bps (Inversion Floor)', fill: '#ef4444', fontSize: 10, position: 'right' }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const val = Number(payload[0].value);
                    const isInverted = val < 0;
                    return (
                      <div className="p-3 rounded-xl bg-slate-950/90 backdrop-blur-md border border-border/70 shadow-xl text-xs font-mono space-y-1">
                        <span className="font-bold text-foreground block font-sans border-b border-border/40 pb-1">{label}</span>
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-muted-foreground">10Y-2Y Spread:</span>
                          <span className={cn("font-bold", isInverted ? "text-rose-400" : "text-emerald-400")}>
                            {val >= 0 ? '+' : ''}{(val * 100).toFixed(0)} bps ({val.toFixed(2)}%)
                          </span>
                        </div>
                        <span className={cn("text-[9px] block uppercase font-bold", isInverted ? "text-rose-400" : "text-emerald-400")}>
                          {isInverted ? 'Curve Inverted (Recession Warning)' : 'Normal Positive Sloped Curve'}
                        </span>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="spread10y2y"
                  name="10Y-2Y Spread"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#spreadGreenGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : viewMode === 'BOND_ETFS' ? (
          /* 3. BOND ETFS PERFORMANCE CHART */
          <div className="h-[360px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bondEtfHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="formattedDate"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={10}
                  tickLine={false}
                  minTickGap={25}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={10}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => isNormalized ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : `$${v.toFixed(0)}`}
                />
                {isNormalized && <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="2 2" />}
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="p-3 rounded-xl bg-slate-950/90 backdrop-blur-md border border-border/70 shadow-xl text-xs font-mono space-y-1">
                        <span className="font-bold text-foreground block font-sans border-b border-border/40 pb-1">{label}</span>
                        {payload.map((entry: any) => (
                          <div key={entry.name} className="flex justify-between items-center gap-4">
                            <span style={{ color: entry.color }} className="font-semibold">{entry.name}:</span>
                            <span className="font-bold text-foreground">
                              {isNormalized ? `${entry.value >= 0 ? '+' : ''}${Number(entry.value).toFixed(2)}%` : `$${Number(entry.value).toFixed(2)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {showTLT && (
                  <Line
                    type="monotone"
                    dataKey={isNormalized ? "tltNormalized" : "tlt"}
                    name="TLT (20Y Treasury)"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                {showIEF && (
                  <Line
                    type="monotone"
                    dataKey={isNormalized ? "iefNormalized" : "ief"}
                    name="IEF (7-10Y Treasury)"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                {showHYG && (
                  <Line
                    type="monotone"
                    dataKey={isNormalized ? "hygNormalized" : "hyg"}
                    name="HYG (High Yield Junk)"
                    stroke="#c084fc"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                {showBND && (
                  <Line
                    type="monotone"
                    dataKey={isNormalized ? "bndNormalized" : "bnd"}
                    name="BND (Total Market)"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : viewMode === 'TERM_STRUCTURE' ? (
          /* 4. FULL YIELD CURVE TERM STRUCTURE & HISTORICAL SHIFT */
          <div className="h-[360px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={termStructure} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="term" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} fontStyle="bold" />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={10}
                  tickLine={false}
                  domain={[3.0, 6.0]}
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload;
                    return (
                      <div className="p-3 rounded-xl bg-slate-950/90 backdrop-blur-md border border-border/70 shadow-xl text-xs font-mono space-y-1">
                        <span className="font-bold text-foreground block font-sans border-b border-border/40 pb-1">{item.label} ({item.term})</span>
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-cyan-400">Current Yield:</span>
                          <span className="font-bold text-cyan-300">{item.current.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-indigo-400">1 Month Ago:</span>
                          <span className="font-bold text-indigo-300">{item.oneMonthAgo.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-purple-400">1 Year Ago:</span>
                          <span className="font-bold text-purple-300">{item.oneYearAgo.toFixed(2)}%</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" height={36} formatter={(val) => <span className="text-xs font-semibold text-muted-foreground">{val}</span>} />
                <Bar dataKey="current" name="Current Yield" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                <Bar dataKey="oneMonthAgo" name="1 Month Ago" fill="#818cf8" radius={[4, 4, 0, 0]} opacity={0.7} />
                <Bar dataKey="oneYearAgo" name="1 Year Ago" fill="#c084fc" radius={[4, 4, 0, 0]} opacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* 5. LIVE INSTITUTIONAL TRADINGVIEW CHART */
          <div className="h-[420px] w-full rounded-2xl overflow-hidden border border-border/60 shadow-inner">
            <TradingViewChart
              symbol={getTradingViewSymbol(tvSymbol)}
              theme="dark"
              height={420}
              interval="D"
              allowSymbolChange={true}
              hideSideToolbar={false}
            />
          </div>
        )}

        {/* Footer info & Graphs Terminal Jump */}
        <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row justify-between items-center text-xs text-muted-foreground gap-2">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Real-time sovereign curve analytics with multi-series overlay and inversion monitoring.</span>
          </span>
          {onNavigateToGraphs && (
            <button
              onClick={() => onNavigateToGraphs(tvSymbol)}
              className="text-primary hover:underline font-semibold inline-flex items-center gap-1 text-xs shrink-0"
            >
              <span>Open in Graphs Terminal</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
