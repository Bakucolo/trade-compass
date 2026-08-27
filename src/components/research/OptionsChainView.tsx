import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Layers,
  Activity,
  Calendar,
  Zap,
  Clock,
  Sparkles,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  DollarSign,
  Compass,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Scale,
  Sliders,
  Maximize2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  OptionsChainData,
  OptionContractRow,
  StrikeMatrixRow,
  useOptionsChain,
} from '@/services/optionsChainService';
import { useCreateAlert } from '@/services/alertService';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
  Cell,
} from 'recharts';

interface OptionsChainViewProps {
  symbol: string;
  onNavigateToTrades?: () => void;
  onSelectOptionForTrade?: (option: OptionContractRow) => void;
}

type ViewMode = 'SIDE_BY_SIDE' | 'CALLS_ONLY' | 'PUTS_ONLY';
type StrikeRange = 'ATM_5' | 'ATM_10' | 'ATM_20' | 'ALL';

export function OptionsChainView({
  symbol,
  onNavigateToTrades,
  onSelectOptionForTrade,
}: OptionsChainViewProps) {
  const [selectedExp, setSelectedExp] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>('SIDE_BY_SIDE');
  const [strikeRange, setStrikeRange] = useState<StrikeRange>('ATM_10');
  const [showGreeks, setShowGreeks] = useState<boolean>(true);
  const [showDynamicsRadar, setShowDynamicsRadar] = useState<boolean>(true);
  const [strikeFilterQuery, setStrikeFilterQuery] = useState<string>('');
  const [copiedContract, setCopiedContract] = useState<string | null>(null);

  const { data: chain, isLoading, isError, error, refetch, isFetching } = useOptionsChain(symbol, selectedExp);
  const createAlertMutation = useCreateAlert();

  // Reset selected expiration when symbol changes
  React.useEffect(() => {
    setSelectedExp(undefined);
  }, [symbol]);

  const handleCopySymbol = (contractSymbol: string) => {
    navigator.clipboard.writeText(contractSymbol);
    setCopiedContract(contractSymbol);
    toast.success(`Copied contract symbol ${contractSymbol} to clipboard!`);
    setTimeout(() => setCopiedContract(null), 2000);
  };

  const handleArmAlert = async (contract: OptionContractRow) => {
    try {
      await createAlertMutation.mutateAsync({
        symbol: symbol,
        targetPrice: contract.strike,
        condition: contract.optionType === 'CALL' ? 'ABOVE' : 'BELOW',
        note: `Options Chain Strike Alert: ${contract.contractSymbol} (${contract.optionType} $${contract.strike}) target reached.`,
      });
      toast.success(`Arm price alert set at $${contract.strike} for ${symbol}!`);
    } catch (err: any) {
      toast.error(`Failed to create alert: ${err.message}`);
    }
  };

  const handleLogTrade = (contract: OptionContractRow) => {
    if (onSelectOptionForTrade) {
      onSelectOptionForTrade(contract);
    } else {
      window.dispatchEvent(
        new CustomEvent('tradeflow-log-option', {
          detail: {
            symbol,
            contractSymbol: contract.contractSymbol,
            strike: contract.strike,
            optionType: contract.optionType,
            expiration: contract.expiration,
            midPrice: contract.mid,
          },
        })
      );
      if (onNavigateToTrades) {
        onNavigateToTrades();
      } else {
        toast.info(`Selected ${contract.contractSymbol} for trading.`);
      }
    }
  };

  // Filter strikes based on range and search query
  const filteredStrikes = useMemo(() => {
    if (!chain || !chain.strikes || chain.strikes.length === 0) return [];

    let list = [...chain.strikes];

    // Strike number query filter
    if (strikeFilterQuery.trim()) {
      const q = strikeFilterQuery.trim();
      list = list.filter((s) => s.strike.toString().includes(q));
    }

    // Strike range filtering around ATM
    if (strikeRange !== 'ALL' && !strikeFilterQuery.trim()) {
      const count = strikeRange === 'ATM_5' ? 5 : strikeRange === 'ATM_10' ? 10 : 20;
      const atmIndex = list.findIndex((s) => s.isAtm);
      if (atmIndex !== -1) {
        const start = Math.max(0, atmIndex - count);
        const end = Math.min(list.length, atmIndex + count + 1);
        list = list.slice(start, end);
      }
    }

    return list;
  }, [chain, strikeRange, strikeFilterQuery]);

  // Open interest strike chart data
  const oiChartData = useMemo(() => {
    if (!chain || !chain.strikes) return [];
    return chain.strikes
      .map((s) => ({
        strike: s.strike,
        strikeLabel: `$${s.strike}`,
        callOI: s.call?.openInterest || 0,
        putOI: s.put?.openInterest || 0,
        isAtm: s.isAtm,
        isMaxPain: s.isMaxPain,
        isCallWall: s.isCallWall,
        isPutWall: s.isPutWall,
      }))
      .filter((s) => s.callOI > 0 || s.putOI > 0);
  }, [chain]);

  const formatNumber = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '—';
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return `$${val.toLocaleString()}`;
  };

  if (isLoading && !chain) {
    return (
      <Card className="bg-card/60 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl p-8">
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Activity className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground font-mono animate-pulse">
            Computing Max Pain, Call/Put Walls & Real-Time Derivatives Matrix for {symbol}...
          </p>
        </div>
      </Card>
    );
  }

  if (isError || !chain) {
    return (
      <Card className="bg-card/60 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl p-8">
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <h4 className="text-base font-bold text-foreground">Options Chain Unavailable</h4>
          <p className="text-xs text-muted-foreground max-w-md">
            {error instanceof Error ? error.message : `No exchange-listed options contracts found for ${symbol}.`}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs mt-2">
            Retry Options Query
          </Button>
        </div>
      </Card>
    );
  }

  const spot = chain.underlyingPrice || 100;
  const isUp = chain.underlyingChange >= 0;
  const keyLevels = chain.keyLevels;
  const bigOiStrikes = chain.bigOiStrikes || [];
  const bigOiExpirations = chain.bigOiExpirations || [];
  const narrative = chain.underlyingDynamics;

  return (
    <Card className="bg-card/70 backdrop-blur-2xl border border-border/70 shadow-xl hover:border-primary/40 transition-all rounded-2xl overflow-hidden">
      {/* Top sentiment accent glow strip */}
      <div
        className={cn(
          "h-1.5 w-full",
          isUp
            ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500"
            : "bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600"
        )}
      />

      {/* ================= 1. HEADER & UNDERLYING METRICS ================= */}
      <CardHeader className="p-6 pb-4 border-b border-border/40 bg-accent/15">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] font-mono font-bold uppercase tracking-wider">
                Options Market Dynamics & Derivatives Engine
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono font-bold uppercase bg-slate-900/60 border-slate-700 text-foreground">
                {chain.expirations.length} Expiration Cycles
              </Badge>
              {keyLevels?.maxPain && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-mono font-bold border",
                    keyLevels.maxPain.pullDirection === 'BULLISH_PULL'
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : keyLevels.maxPain.pullDirection === 'BEARISH_PULL'
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                      : "border-purple-500/40 bg-purple-500/10 text-purple-300"
                  )}
                >
                  🎯 Max Pain: ${keyLevels.maxPain.strike.toFixed(2)} ({keyLevels.maxPain.distancePercent >= 0 ? '+' : ''}
                  {keyLevels.maxPain.distancePercent.toFixed(1)}%)
                </Badge>
              )}
              {keyLevels?.callWall && (
                <Badge variant="outline" className="text-[10px] font-mono font-bold border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                  🧱 Call Wall (Resist): ${keyLevels.callWall.strike.toFixed(2)}
                </Badge>
              )}
              {keyLevels?.putWall && (
                <Badge variant="outline" className="text-[10px] font-mono font-bold border-rose-500/40 bg-rose-500/10 text-rose-300">
                  🛡️ Put Wall (Support): ${keyLevels.putWall.strike.toFixed(2)}
                </Badge>
              )}
            </div>

            <CardTitle className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5 pt-1">
              <Layers className="w-6 h-6 text-primary" />
              <span>{symbol} Options Dynamics & Key Levels</span>
              <span className="text-lg font-mono font-bold text-muted-foreground">
                ${spot.toFixed(2)}
              </span>
              <span className={cn("text-xs font-mono font-bold flex items-center", isUp ? "text-emerald-400" : "text-rose-400")}>
                {isUp ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5 inline" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5 inline" />}
                {isUp ? '+' : ''}{chain.underlyingChangePercent.toFixed(2)}%
              </span>
            </CardTitle>

            <CardDescription className="text-xs text-muted-foreground">
              Institutional derivatives telemetry analyzing Max Pain strike, Call/Put wall support & resistances, dealer gamma flip, and big open interest concentration.
            </CardDescription>
          </div>

          {/* Key Options Analytics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs self-start lg:self-center">
            {/* IV ATM */}
            <div className="bg-card/80 p-2.5 rounded-xl border border-border/60 shadow-sm">
              <span className="text-[9px] uppercase font-sans font-bold text-muted-foreground block">
                ATM Implied Vol
              </span>
              <span className="text-sm font-black text-purple-300">
                {chain.analytics.impliedVolatilityAtm}%
              </span>
            </div>

            {/* Expected Move */}
            <div className="bg-card/80 p-2.5 rounded-xl border border-border/60 shadow-sm">
              <span className="text-[9px] uppercase font-sans font-bold text-muted-foreground block">
                Implied Move (±)
              </span>
              <span className="text-sm font-black text-amber-300">
                ±${chain.analytics.expectedMoveDollars} ({chain.analytics.expectedMovePercent}%)
              </span>
            </div>

            {/* Put / Call Volume Ratio */}
            <div className="bg-card/80 p-2.5 rounded-xl border border-border/60 shadow-sm">
              <span className="text-[9px] uppercase font-sans font-bold text-muted-foreground block">
                P/C OI Ratio
              </span>
              <span className="text-sm font-black text-cyan-300">
                {chain.analytics.putCallOiRatio}x
              </span>
            </div>

            {/* Total Expiration Volume */}
            <div className="bg-card/80 p-2.5 rounded-xl border border-border/60 shadow-sm">
              <span className="text-[9px] uppercase font-sans font-bold text-muted-foreground block">
                Total Open Interest
              </span>
              <span className="text-sm font-black text-foreground">
                {(chain.analytics.totalCallOpenInterest + chain.analytics.totalPutOpenInterest).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">

        {/* ================= 2. UNDERLYING DYNAMICS & KEY LEVELS 4-CARD HERO RADAR ================= */}
        {keyLevels && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground font-sans">
                  Underlying Key Options Support, Resistance & Max Pain Levels
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDynamicsRadar(!showDynamicsRadar)}
                className="h-6 text-[11px] font-bold text-primary px-2"
              >
                {showDynamicsRadar ? 'Hide Dynamics Panel' : 'Show Dynamics Panel'}
              </Button>
            </div>

            {showDynamicsRadar && (
              <div className="space-y-4">
                {/* 4 Hero Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 font-mono">
                  {/* Card 1: Max Pain Strike */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/30 to-card border border-purple-500/40 shadow-sm space-y-2 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-purple-300 font-sans flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-purple-400" /> Max Pain Strike
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-bold px-1.5 py-0.2 border",
                          keyLevels.maxPain.pullDirection === 'BULLISH_PULL'
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                            : keyLevels.maxPain.pullDirection === 'BEARISH_PULL'
                            ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                            : "bg-purple-500/15 text-purple-300 border-purple-500/40"
                        )}
                      >
                        {keyLevels.maxPain.pullDirection === 'BULLISH_PULL'
                          ? '▲ Upward Pull'
                          : keyLevels.maxPain.pullDirection === 'BEARISH_PULL'
                          ? '▼ Downward Pull'
                          : '● Pinned at Spot'}
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <strong className="text-2xl font-black text-purple-200">
                        ${keyLevels.maxPain.strike.toFixed(2)}
                      </strong>
                      <span
                        className={cn(
                          "text-xs font-bold",
                          keyLevels.maxPain.distancePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {keyLevels.maxPain.distancePercent >= 0 ? '+' : ''}
                        {keyLevels.maxPain.distancePercent.toFixed(1)}% vs Spot
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground font-sans leading-tight">
                      Strike where options buyers lose maximum premium value at expiration.
                    </p>
                  </div>

                  {/* Card 2: Call Wall (Primary Resistance / Gamma Ceiling) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 to-card border border-emerald-500/40 shadow-sm space-y-2 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-300 font-sans flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Call Wall (Resistance)
                      </span>
                      <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/15 text-emerald-300 border-emerald-500/40">
                        Gamma Ceiling
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <strong className="text-2xl font-black text-emerald-300">
                        ${keyLevels.callWall.strike.toFixed(2)}
                      </strong>
                      <span className="text-xs font-bold text-emerald-400">
                        +{keyLevels.callWall.distancePercent.toFixed(1)}% Overhead
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                      <span>OI: <b className="text-foreground">{keyLevels.callWall.openInterest.toLocaleString()}</b></span>
                      <span>Notional: <b className="text-emerald-300">{formatNumber(keyLevels.callWall.notionalDollars)}</b></span>
                    </div>
                  </div>

                  {/* Card 3: Put Wall (Primary Support / Gamma Floor) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/30 to-card border border-rose-500/40 shadow-sm space-y-2 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-rose-300 font-sans flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-rose-400" /> Put Wall (Support)
                      </span>
                      <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0.2 bg-rose-500/15 text-rose-300 border-rose-500/40">
                        Gamma Floor
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <strong className="text-2xl font-black text-rose-300">
                        ${keyLevels.putWall.strike.toFixed(2)}
                      </strong>
                      <span className="text-xs font-bold text-rose-400">
                        {keyLevels.putWall.distancePercent.toFixed(1)}% Downside
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                      <span>OI: <b className="text-foreground">{keyLevels.putWall.openInterest.toLocaleString()}</b></span>
                      <span>Notional: <b className="text-rose-300">{formatNumber(keyLevels.putWall.notionalDollars)}</b></span>
                    </div>
                  </div>

                  {/* Card 4: Gamma Flip & Dealer Hedging Regime */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/30 to-card border border-cyan-500/40 shadow-sm space-y-2 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-cyan-300 font-sans flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-cyan-400" /> Gamma Flip Level
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-bold px-1.5 py-0.2 border",
                          keyLevels.gammaFlip.currentRegime === 'POSITIVE_GAMMA'
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                            : "bg-rose-500/15 text-rose-300 border-rose-500/40"
                        )}
                      >
                        {keyLevels.gammaFlip.currentRegime === 'POSITIVE_GAMMA' ? '+ Gamma (Pinning)' : '- Gamma (High Vol)'}
                      </Badge>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <strong className="text-2xl font-black text-cyan-200">
                        ${keyLevels.gammaFlip.estimatedStrike.toFixed(2)}
                      </strong>
                      <span className="text-xs text-muted-foreground">
                        Flip Pivot
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground font-sans leading-tight line-clamp-1" title={keyLevels.gammaFlip.description}>
                      {keyLevels.gammaFlip.description}
                    </p>
                  </div>
                </div>

                {/* Narrative & Institutional Summary */}
                {narrative && (
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-primary/25 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                        Underlying Market Dynamics & Institutional Positioning
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">Quantitative Derivatives Model</span>
                    </div>

                    <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                      {narrative.headline}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-muted-foreground pt-1 border-t border-border/30">
                      <div>
                        <b className="text-foreground">🎯 Gravity & Pinning: </b>
                        {narrative.pinningPressure}
                      </div>
                      <div>
                        <b className="text-foreground">⚡ Trading Implication: </b>
                        {narrative.tradingImplication}
                      </div>
                    </div>
                  </div>
                )}

                {/* Open Interest Distribution Chart & Big OI Strikes / Expirations */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Left: Recharts Bar Chart of Call vs Put Open Interest across Strikes */}
                  <div className="lg:col-span-2 p-4 rounded-2xl bg-slate-950/60 border border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-primary" />
                        Call vs Put Open Interest Distribution by Strike ({chain.selectedExpiration})
                      </span>
                      <div className="flex items-center gap-3 text-[10.5px] font-mono">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Call OI (Resistance)
                        </span>
                        <span className="flex items-center gap-1 text-rose-400">
                          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Put OI (Support)
                        </span>
                      </div>
                    </div>

                    <div className="h-[260px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={oiChartData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                          <XAxis
                            dataKey="strike"
                            stroke="#64748b"
                            tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                            interval="preserveStartEnd"
                            tickFormatter={(v) => `$${v}`}
                            tickLine={false}
                          />
                          <YAxis
                            stroke="#64748b"
                            tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
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
                            formatter={(val: any, name: any) => [`${Number(val).toLocaleString()} contracts`, name === 'callOI' ? 'Call Open Interest' : 'Put Open Interest']}
                            labelFormatter={(strike: any) => `Strike $${strike}`}
                          />
                          {/* Reference lines for Spot, Max Pain, Call Wall, Put Wall */}
                          <ReferenceLine x={spot} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1.5} label={{ value: `Spot: $${spot.toFixed(0)}`, fill: '#f59e0b', fontSize: 9, position: 'top' }} />
                          <ReferenceLine x={keyLevels.maxPain.strike} stroke="#a855f7" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Max Pain: $${keyLevels.maxPain.strike}`, fill: '#a855f7', fontSize: 9, position: 'insideTop' }} />
                          <ReferenceLine x={keyLevels.callWall.strike} stroke="#10b981" strokeDasharray="2 2" label={{ value: 'Call Wall', fill: '#10b981', fontSize: 9, position: 'insideTopRight' }} />
                          <ReferenceLine x={keyLevels.putWall.strike} stroke="#f43f5e" strokeDasharray="2 2" label={{ value: 'Put Wall', fill: '#f43f5e', fontSize: 9, position: 'insideTopLeft' }} />

                          <Bar dataKey="callOI" name="callOI" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.85} />
                          <Bar dataKey="putOI" name="putOI" fill="#f43f5e" radius={[4, 4, 0, 0]} opacity={0.85} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Right: Big Open Interest Strikes & Expirations Summary */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-border/50 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-amber-400" />
                          Top Big Open Interest Strikes
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">Notional $</span>
                      </div>

                      <div className="divide-y divide-border/20 font-mono text-xs max-h-[160px] overflow-y-auto custom-scrollbar">
                        {bigOiStrikes.slice(0, 5).map((boi) => (
                          <div key={boi.strike} className="py-1.5 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-foreground">${boi.strike}</span>
                              {boi.isCallWall && <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">CALL WALL</span>}
                              {boi.isPutWall && <span className="text-[8px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">PUT WALL</span>}
                              {boi.isMaxPain && <span className="text-[8px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold">MAX PAIN</span>}
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-foreground">{boi.totalOI.toLocaleString()} OI</span>
                              <span className="text-[10px] text-muted-foreground block">{formatNumber(boi.notionalDollars)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Expiration Concentration Preview */}
                    <div className="pt-2 border-t border-border/30 text-xs font-mono">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Top OpEx Concentrations:</span>
                        <span className="text-primary font-bold">Active: {chain.selectedExpiration}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {bigOiExpirations.slice(0, 4).map((bExp) => (
                          <button
                            key={bExp.date}
                            onClick={() => setSelectedExp(bExp.date)}
                            className={cn(
                              "px-2 py-0.5 rounded-lg text-[10px] border transition-all flex items-center gap-1",
                              bExp.date === chain.selectedExpiration
                                ? "bg-primary text-primary-foreground border-primary font-bold"
                                : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <span>{bExp.formattedDate}</span>
                            <span className="opacity-70">({(bExp.totalOI / 1000).toFixed(0)}k)</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 3. EXPIRATION DATES HORIZONTAL SELECTOR RIBBON ================= */}
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-sans">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              Select Expiration Cycle ({chain.expirations.length} Available)
            </span>
            <span className="text-xs font-mono font-bold text-primary">
              Active: {chain.selectedExpiration} ({chain.selectedDte} DTE)
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border">
            {chain.expirations.map((exp) => {
              const isSelected = exp.date === chain.selectedExpiration;
              const isMonthly = exp.type === 'MONTHLY';
              const isLeap = exp.type === 'LEAP';

              return (
                <button
                  key={exp.date}
                  type="button"
                  onClick={() => setSelectedExp(exp.date)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border shrink-0 flex items-center gap-1.5 shadow-sm",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30 shadow-md"
                      : "bg-card/60 hover:bg-accent/60 text-muted-foreground hover:text-foreground border-border/60"
                  )}
                >
                  <span>{exp.formattedDate}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] px-1 py-0 h-3.5 font-mono",
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
                        : isMonthly
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                        : isLeap
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    )}
                  >
                    {exp.dte}d
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* ================= 4. CONTROLS TOOLBAR (VIEW MODE, RANGE, GREEKS) ================= */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/40 border border-border/50">
          {/* Left: View Mode Switcher */}
          <div className="flex items-center gap-1 bg-card/80 p-1 rounded-xl border border-border/50">
            <button
              type="button"
              onClick={() => setViewMode('SIDE_BY_SIDE')}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                viewMode === 'SIDE_BY_SIDE' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Straddle (Calls & Puts)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('CALLS_ONLY')}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                viewMode === 'CALLS_ONLY' ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Calls Only
            </button>
            <button
              type="button"
              onClick={() => setViewMode('PUTS_ONLY')}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                viewMode === 'PUTS_ONLY' ? "bg-rose-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Puts Only
            </button>
          </div>

          {/* Right: Strike Range & Greeks Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Strike Range Selector */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground text-[11px] font-semibold hidden sm:inline">Strikes:</span>
              <select
                value={strikeRange}
                onChange={(e) => setStrikeRange(e.target.value as StrikeRange)}
                className="bg-card/80 border border-border/60 rounded-lg px-2.5 py-1 text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
              >
                <option value="ATM_5">ATM ± 5 Strikes</option>
                <option value="ATM_10">ATM ± 10 Strikes</option>
                <option value="ATM_20">ATM ± 20 Strikes</option>
                <option value="ALL">All Strikes</option>
              </select>
            </div>

            {/* Quick Strike Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Find strike..."
                value={strikeFilterQuery}
                onChange={(e) => setStrikeFilterQuery(e.target.value)}
                className="h-8 pl-8 pr-2 w-28 text-xs font-mono bg-card/60 border-border/60 rounded-lg"
              />
            </div>

            {/* Greeks Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGreeks(!showGreeks)}
              className={cn(
                "h-8 text-xs font-bold gap-1.5 transition-all",
                showGreeks ? "bg-purple-500/15 text-purple-300 border-purple-500/40" : "text-muted-foreground"
              )}
              title="Toggle Black-Scholes Greeks (Delta, Gamma, Theta, Vega)"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Greeks {showGreeks ? 'ON' : 'OFF'}</span>
            </Button>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 w-8 p-0"
              title="Refresh options chain"
            >
              <RotateCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin text-primary")} />
            </Button>
          </div>
        </div>

        {/* ================= 5. OPTIONS CHAIN DUAL MATRIX TABLE WITH KEY LEVEL BADGES ================= */}
        <div className="rounded-xl border border-border/70 overflow-hidden shadow-inner bg-card/30">
          <div className="overflow-x-auto max-h-[620px] scrollbar-thin">
            <table className="w-full text-xs font-mono border-collapse">
              {/* Main Headers */}
              <thead className="bg-slate-950/80 sticky top-0 z-20 backdrop-blur-md border-b border-border/60 text-muted-foreground select-none">
                {/* Category Header Row */}
                <tr className="border-b border-border/40 text-[10px] uppercase font-sans tracking-widest text-center">
                  {(viewMode === 'SIDE_BY_SIDE' || viewMode === 'CALLS_ONLY') && (
                    <th colSpan={showGreeks ? 9 : 6} className="py-1.5 bg-emerald-950/30 text-emerald-300 font-black border-r border-border/50">
                      ⚡ CALLS (Bullish Delta & Upward Upside)
                    </th>
                  )}

                  <th className="py-1.5 px-3 bg-slate-900 text-foreground font-black border-r border-border/50">
                    STRIKE
                  </th>

                  {(viewMode === 'SIDE_BY_SIDE' || viewMode === 'PUTS_ONLY') && (
                    <th colSpan={showGreeks ? 9 : 6} className="py-1.5 bg-rose-950/30 text-rose-300 font-black">
                      🛡️ PUTS (Bearish Delta & Downside Hedge)
                    </th>
                  )}
                </tr>

                {/* Sub-column Header Row */}
                <tr className="text-[10px] uppercase font-sans tracking-wider text-right border-b border-border/60">
                  {/* CALLS COLUMNS */}
                  {(viewMode === 'SIDE_BY_SIDE' || viewMode === 'CALLS_ONLY') && (
                    <>
                      {showGreeks && <th className="p-2 text-center text-purple-300 font-bold">Delta (Δ)</th>}
                      {showGreeks && <th className="p-2 text-center text-purple-300 font-bold">Theta (Θ)</th>}
                      <th className="p-2 text-center text-purple-300 font-bold">IV%</th>
                      <th className="p-2 text-right">Vol</th>
                      <th className="p-2 text-right">OI</th>
                      <th className="p-2 text-right">Bid</th>
                      <th className="p-2 text-right">Ask</th>
                      <th className="p-2 text-right text-emerald-400 font-bold">Mid</th>
                      <th className="p-2 text-right font-bold border-r border-border/50">Last</th>
                    </>
                  )}

                  {/* STRIKE COLUMN */}
                  <th className="p-2 text-center font-black text-foreground bg-slate-900/90 border-r border-border/50 min-w-[90px]">
                    Strike / Level
                  </th>

                  {/* PUTS COLUMNS */}
                  {(viewMode === 'SIDE_BY_SIDE' || viewMode === 'PUTS_ONLY') && (
                    <>
                      <th className="p-2 text-left font-bold">Last</th>
                      <th className="p-2 text-left text-rose-400 font-bold">Mid</th>
                      <th className="p-2 text-left">Bid</th>
                      <th className="p-2 text-left">Ask</th>
                      <th className="p-2 text-left">Vol</th>
                      <th className="p-2 text-left">OI</th>
                      <th className="p-2 text-center text-purple-300 font-bold">IV%</th>
                      {showGreeks && <th className="p-2 text-center text-purple-300 font-bold">Theta (Θ)</th>}
                      {showGreeks && <th className="p-2 text-center text-purple-300 font-bold">Delta (Δ)</th>}
                    </>
                  )}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-border/30">
                {filteredStrikes.map((row) => {
                  const call = row.call;
                  const put = row.put;
                  const isAtm = row.isAtm;
                  const isCallWall = row.isCallWall;
                  const isPutWall = row.isPutWall;
                  const isMaxPain = row.isMaxPain;

                  const callItm = call?.inTheMoney ?? false;
                  const putItm = put?.inTheMoney ?? false;

                  return (
                    <tr
                      key={row.strike}
                      className={cn(
                        "transition-colors group hover:bg-accent/40",
                        isAtm && "bg-primary/10 font-bold ring-1 ring-primary/40",
                        isCallWall && "bg-emerald-950/20",
                        isPutWall && "bg-rose-950/20",
                        isMaxPain && "bg-purple-950/20"
                      )}
                    >
                      {/* CALLS SIDE */}
                      {(viewMode === 'SIDE_BY_SIDE' || viewMode === 'CALLS_ONLY') && (
                        <>
                          {showGreeks && (
                            <td className="p-2 text-center text-purple-300 text-[11px]">
                              {call ? call.delta.toFixed(2) : '—'}
                            </td>
                          )}
                          {showGreeks && (
                            <td className="p-2 text-center text-muted-foreground text-[10px]">
                              {call ? call.theta.toFixed(2) : '—'}
                            </td>
                          )}
                          <td className="p-2 text-center text-[10px] text-muted-foreground">
                            {call ? `${call.impliedVolatility}%` : '—'}
                          </td>
                          <td className="p-2 text-right text-muted-foreground">
                            {call ? call.volume.toLocaleString() : '—'}
                          </td>
                          <td className={cn("p-2 text-right", isCallWall ? "font-black text-emerald-400" : "text-foreground")}>
                            {call ? call.openInterest.toLocaleString() : '—'}
                          </td>
                          <td className="p-2 text-right text-muted-foreground">
                            {call ? `$${call.bid.toFixed(2)}` : '—'}
                          </td>
                          <td className="p-2 text-right text-muted-foreground">
                            {call ? `$${call.ask.toFixed(2)}` : '—'}
                          </td>
                          <td
                            className={cn(
                              "p-2 text-right font-bold cursor-pointer hover:underline",
                              callItm ? "text-emerald-300 font-black bg-emerald-500/10" : "text-foreground"
                            )}
                            onClick={() => call && handleLogTrade(call)}
                            title="Click to trade this Call"
                          >
                            {call ? `$${call.mid.toFixed(2)}` : '—'}
                          </td>
                          <td className="p-2 text-right text-muted-foreground border-r border-border/50">
                            {call ? `$${call.lastPrice.toFixed(2)}` : '—'}
                          </td>
                        </>
                      )}

                      {/* STRIKE & KEY LEVEL BADGES */}
                      <td
                        className={cn(
                          "p-2 text-center font-mono font-black border-r border-border/50 select-none",
                          isAtm
                            ? "bg-primary text-primary-foreground font-black shadow"
                            : isCallWall
                            ? "bg-emerald-950/80 text-emerald-300 border-l-2 border-l-emerald-500"
                            : isPutWall
                            ? "bg-rose-950/80 text-rose-300 border-l-2 border-l-rose-500"
                            : isMaxPain
                            ? "bg-purple-950/80 text-purple-300 border-l-2 border-l-purple-500"
                            : "bg-slate-900/90 text-foreground"
                        )}
                      >
                        <div className="flex flex-col items-center">
                          <span>${row.strike.toFixed(2)}</span>
                          {isAtm && <span className="text-[8px] uppercase tracking-tighter opacity-90 font-sans">ATM</span>}
                          {isCallWall && <span className="text-[8px] uppercase font-black text-emerald-400 bg-emerald-950/90 px-1 rounded font-sans">CALL WALL</span>}
                          {isPutWall && <span className="text-[8px] uppercase font-black text-rose-400 bg-rose-950/90 px-1 rounded font-sans">PUT WALL</span>}
                          {isMaxPain && <span className="text-[8px] uppercase font-black text-purple-300 bg-purple-950/90 px-1 rounded font-sans">MAX PAIN</span>}
                        </div>
                      </td>

                      {/* PUTS SIDE */}
                      {(viewMode === 'SIDE_BY_SIDE' || viewMode === 'PUTS_ONLY') && (
                        <>
                          <td className="p-2 text-left text-muted-foreground">
                            {put ? `$${put.lastPrice.toFixed(2)}` : '—'}
                          </td>
                          <td
                            className={cn(
                              "p-2 text-left font-bold cursor-pointer hover:underline",
                              putItm ? "text-rose-300 font-black bg-rose-500/10" : "text-foreground"
                            )}
                            onClick={() => put && handleLogTrade(put)}
                            title="Click to trade this Put"
                          >
                            {put ? `$${put.mid.toFixed(2)}` : '—'}
                          </td>
                          <td className="p-2 text-left text-muted-foreground">
                            {put ? `$${put.bid.toFixed(2)}` : '—'}
                          </td>
                          <td className="p-2 text-left text-muted-foreground">
                            {put ? `$${put.ask.toFixed(2)}` : '—'}
                          </td>
                          <td className="p-2 text-left text-muted-foreground">
                            {put ? put.volume.toLocaleString() : '—'}
                          </td>
                          <td className={cn("p-2 text-left", isPutWall ? "font-black text-rose-400" : "text-foreground")}>
                            {put ? put.openInterest.toLocaleString() : '—'}
                          </td>
                          <td className="p-2 text-center text-[10px] text-muted-foreground">
                            {put ? `${put.impliedVolatility}%` : '—'}
                          </td>
                          {showGreeks && (
                            <td className="p-2 text-center text-muted-foreground text-[10px]">
                              {put ? put.theta.toFixed(2) : '—'}
                            </td>
                          )}
                          {showGreeks && (
                            <td className="p-2 text-center text-purple-300 text-[11px]">
                              {put ? put.delta.toFixed(2) : '—'}
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
