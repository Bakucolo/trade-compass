import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Landmark,
  TrendingDown,
  TrendingUp,
  Calendar,
  Activity,
  Info,
  RefreshCw,
  Maximize2,
  ExternalLink,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
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
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  useFedFundsCurve,
  FedFundsContractPoint,
  fetchFedFundsCurve,
} from '@/services/macroService';
import { TradingViewChart } from '../graphs/TradingViewChart';
import { useQueryClient } from '@tanstack/react-query';

interface FedFundsCurveCardProps {
  onNavigateToGraphs?: (symbol: string) => void;
}

type CurveViewMode = 'RATE_CURVE' | 'CUMULATIVE_BPS' | 'MARGINAL_BPS' | 'CONTRACT_MATRIX';
type HorizonFilter = '6M' | '12M' | 'ALL';
type BaselineMode = 'EFFR_SPOT' | 'FRONT_MONTH';

export function FedFundsCurveCard({ onNavigateToGraphs }: FedFundsCurveCardProps) {
  const queryClient = useQueryClient();
  const { data: curveData, isLoading, isFetching, refetch } = useFedFundsCurve();

  const [viewMode, setViewMode] = useState<CurveViewMode>('RATE_CURVE');
  const [horizon, setHorizon] = useState<HorizonFilter>('12M');
  const [baseline, setBaseline] = useState<BaselineMode>('EFFR_SPOT');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selected contract for TradingView modal
  const [selectedTvSymbol, setSelectedTvSymbol] = useState<string | null>(null);

  const contracts = curveData?.contracts || [];
  const summary = curveData?.summary;
  const continuousZq = curveData?.continuousZq;

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await fetchFedFundsCurve(true);
      queryClient.setQueryData(['fedFundsCurve'], fresh);
    } catch (e) {
      console.error('Failed to force refresh Fed Funds curve:', e);
      refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filtered contracts according to chosen horizon
  const visibleContracts = useMemo(() => {
    if (!contracts.length) return [];
    if (horizon === '6M') return contracts.slice(0, 6);
    if (horizon === '12M') return contracts.slice(0, 12);
    return contracts;
  }, [contracts, horizon]);

  // Prepared chart data
  const chartData = useMemo(() => {
    const spotEffr = summary?.currentEffr ?? 4.83;
    const frontRate = contracts[0]?.impliedRate ?? spotEffr;

    return visibleContracts.map((c) => {
      const activeBaseline = baseline === 'EFFR_SPOT' ? spotEffr : frontRate;
      const cumulativeBps = Number(((c.impliedRate - activeBaseline) * 100).toFixed(1));
      const cumulativeCuts = Number((cumulativeBps / 25).toFixed(2));

      return {
        symbol: c.cleanSymbol,
        fullSymbol: c.symbol,
        label: c.expiryLabel,
        fullMonth: c.fullMonthYear,
        year: c.year,
        price: c.price,
        impliedRate: c.impliedRate,
        impliedRateDisplay: `${c.impliedRate.toFixed(2)}%`,
        spotEffr,
        cumulativeBps,
        cumulativeCuts,
        marginalBps: c.marginalBps,
        marginalCuts: c.marginalCuts,
        hasFomc: c.hasFomc,
        fomcMeeting: c.fomcMeeting,
        fomcImpliedStepBps: c.fomcImpliedStepBps,
        fomcProbabilities: c.fomcProbabilities,
        priceChange: c.priceChange,
      };
    });
  }, [visibleContracts, summary, baseline, contracts]);

  // Current spot rate
  const currentEffr = summary?.currentEffr ?? 4.83;
  const frontMonthRate = summary?.frontMonthRate ?? (contracts[0]?.impliedRate || 3.75);

  // Filtered FOMC meeting contracts across visible horizon
  const fomcMeetings = useMemo(() => {
    return visibleContracts.filter((c) => c.hasFomc && c.fomcMeeting);
  }, [visibleContracts]);

  // Safe resolver for FOMC decision probabilities
  const resolveProbabilities = (c: FedFundsContractPoint) => {
    if (c.fomcProbabilities) return c.fomcProbabilities;
    const move = c.fomcImpliedStepBps ?? c.marginalBps ?? 0;
    if (move <= -35) {
      const cut50 = Math.min(100, Math.max(0, Math.round(((Math.abs(move) - 25) / 25) * 100)));
      return { cut50, cut25: 100 - cut50, pause: 0, hike25: 0 };
    }
    if (move < -2) {
      const cut25 = Math.min(100, Math.max(0, Math.round((Math.abs(move) / 25) * 100)));
      return { cut50: 0, cut25, pause: 100 - cut25, hike25: 0 };
    }
    if (move > 35) {
      const hike50 = Math.min(100, Math.max(0, Math.round(((move - 25) / 25) * 100)));
      return { cut50: 0, cut25: 0, pause: 0, hike25: 100 - hike50 };
    }
    if (move > 2) {
      const hike25 = Math.min(100, Math.max(0, Math.round((move / 25) * 100)));
      return { cut50: 0, cut25: 0, pause: 100 - hike25, hike25 };
    }
    return { cut50: 0, cut25: 0, pause: 100, hike25: 0 };
  };

  return (
    <Card className="bg-card/80 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-3xl overflow-hidden relative transition-all duration-300">
      {/* Decorative gradient glow accents */}
      <div className="absolute top-0 right-1/4 -mt-10 w-96 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 -mb-10 w-80 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* ================= HEADER ================= */}
      <CardHeader className="p-5 sm:p-6 pb-4 border-b border-border/50 bg-gradient-to-r from-card via-card/70 to-accent/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Subtitle */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-purple-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                    Fed Funds Futures (<span className="text-cyan-400 font-mono">ZQ!</span>) Implied Policy Curve
                  </h2>
                  <Badge
                    variant="outline"
                    className="bg-cyan-500/15 text-cyan-300 border-cyan-500/40 text-[10px] font-mono font-bold px-2 py-0.5 tracking-wider uppercase"
                  >
                    CBOT 30-Day Fed Funds
                  </Badge>
                  {summary?.policyStance && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold px-2.5 py-0.5 border",
                        summary.policyStance === 'AGGRESSIVE_EASING' || summary.policyStance === 'MEASURED_EASING'
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                          : summary.policyStance === 'TIGHTENING_HIKES'
                          ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                          : "bg-purple-500/15 text-purple-300 border-purple-500/40"
                      )}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
                      {summary.policyStance.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>Market-implied Federal Reserve rate path, basis points (bps) per expiry & rate cuts/hikes priced</span>
                  <span className="text-[10px] text-cyan-400/80 font-mono">Formula: 100 - Contract Price = Implied Rate</span>
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons & Launchers */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Open Continuous ZQ! in TradingView */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTvSymbol('CBOT:ZQ1!')}
              className="h-8 px-3 rounded-xl border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 text-xs font-semibold gap-1.5 shadow-sm"
              title="Open full interactive TradingView chart for continuous ZQ! contract"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>ZQ! TradingView</span>
              <Maximize2 className="w-3 h-3 text-cyan-400/70 ml-0.5" />
            </Button>

            {/* Refresh */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleManualRefresh}
              disabled={isFetching || isRefreshing}
              className="h-8 w-8 rounded-xl border-border/70 hover:bg-accent/40 shadow-sm shrink-0"
              title="Refresh live ZQ contracts and implied calculations"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-primary", (isFetching || isRefreshing) && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* ================= KEY METRICS EXECUTIVE BAROMETER ================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-4">
          {/* 1. Current Spot EFFR */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-card/60 border border-border/60 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
              <Landmark className="w-3 h-3 text-cyan-400" /> Spot EFFR
            </span>
            <div className="mt-1">
              <span className="text-base font-black font-mono text-cyan-300 block">
                {currentEffr.toFixed(2)}%
              </span>
              <span className="text-[9px] text-muted-foreground font-medium">Effective Fed Funds</span>
            </div>
          </div>

          {/* 2. Front Month ZQ Implied Rate */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-card/60 border border-border/60 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
              <Activity className="w-3 h-3 text-blue-400" /> Front ZQ ({summary?.frontMonthLabel || 'Front'})
            </span>
            <div className="mt-1">
              <span className="text-base font-black font-mono text-blue-300 block">
                {frontMonthRate.toFixed(2)}%
              </span>
              <span className="text-[9px] text-muted-foreground font-medium">
                Priced: {continuousZq?.price?.toFixed(3) || '96.25'}
              </span>
            </div>
          </div>

          {/* 3. Cycle Trough / Terminal Rate */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-card/60 border border-border/60 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-emerald-400" /> Cycle Trough
            </span>
            <div className="mt-1">
              <span className="text-base font-black font-mono text-emerald-300 block">
                {summary?.troughRate ? `${summary.troughRate.toFixed(2)}%` : '3.75%'}
              </span>
              <span className="text-[9px] text-muted-foreground font-medium truncate block max-w-[120px]">
                {summary?.troughExpiry || "Sep '26"}
              </span>
            </div>
          </div>

          {/* 4. Year-End 2026 Priced Cuts */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-card/60 border border-border/60 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
              <Calendar className="w-3 h-3 text-amber-400" /> 2026 Year-End
            </span>
            <div className="mt-1">
              <div className="flex items-baseline gap-1">
                <span className={cn(
                  "text-base font-black font-mono",
                  (summary?.totalCutsCurrentYearBps ?? 0) <= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {summary?.totalCutsCurrentYearBps ? `${summary.totalCutsCurrentYearBps > 0 ? '+' : ''}${summary.totalCutsCurrentYearBps} bps` : '-63.0 bps'}
                </span>
              </div>
              <span className="text-[9px] text-emerald-300/90 font-mono font-bold block">
                {summary?.totalCutsCurrentYearCount
                  ? `${Math.abs(summary.totalCutsCurrentYearCount)} cuts of 25 bps`
                  : '2.5 cuts'}
              </span>
            </div>
          </div>

          {/* 5. Year-End 2027 Priced Cuts */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-card/60 border border-border/60 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
              <Calendar className="w-3 h-3 text-purple-400" /> 2027 Year-End
            </span>
            <div className="mt-1">
              <span className={cn(
                "text-base font-black font-mono",
                (summary?.totalCutsNextYearBps ?? 0) <= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {summary?.totalCutsNextYearBps ? `${summary.totalCutsNextYearBps > 0 ? '+' : ''}${summary.totalCutsNextYearBps} bps` : '-105.0 bps'}
              </span>
              <span className="text-[9px] text-emerald-300/90 font-mono font-bold block">
                {summary?.totalCutsNextYearCount
                  ? `${Math.abs(summary.totalCutsNextYearCount)} cuts of 25 bps`
                  : '4.2 cuts'}
              </span>
            </div>
          </div>

          {/* 6. Next Upcoming FOMC Decision Pricing */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-purple-950/30 to-card/60 border border-purple-500/30 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] text-purple-300 font-semibold flex items-center gap-1">
              <Zap className="w-3 h-3 text-purple-400" /> Next FOMC Meeting
            </span>
            <div className="mt-1 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black text-foreground block truncate">
                  {summary?.nextFomc?.label || 'Nov 4-5, 2026'}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground font-semibold">
                  {summary?.nextFomc?.daysUntil ? `${summary.nextFomc.daysUntil}d` : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-[9px] font-mono font-bold">
                <span className="text-emerald-400" title="Probability of 25 bps rate cut">
                  {summary?.nextFomc?.probabilities?.cut25 ?? 74}% Cut
                </span>
                <span className="text-muted-foreground/60">•</span>
                <span className="text-sky-300" title="Probability of policy pause / hold">
                  {summary?.nextFomc?.probabilities?.pause ?? 26}% Pause
                </span>
                <span className="text-muted-foreground/60">•</span>
                <span className="text-rose-400" title="Probability of 25 bps rate hike">
                  {summary?.nextFomc?.probabilities?.hike25 ?? 0}% Hike
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Narrative Banner */}
        {summary?.policyNarrative && (
          <div className="mt-3 p-2.5 rounded-xl bg-accent/20 border border-border/40 text-xs text-foreground/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                <strong className="text-cyan-300 font-semibold">{summary.policyHeadline}: </strong>
                {summary.policyNarrative}
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      {/* ================= CONTROLS & TOGGLE TABS ================= */}
      <div className="px-5 sm:px-6 py-3 border-b border-border/40 bg-accent/5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: View Mode Toggle */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-muted-foreground text-[11px] font-semibold mr-1">Display:</span>
          <Button
            size="sm"
            variant={viewMode === 'RATE_CURVE' ? 'default' : 'outline'}
            onClick={() => setViewMode('RATE_CURVE')}
            className={cn(
              "h-7 text-xs rounded-xl px-3 font-semibold",
              viewMode === 'RATE_CURVE' && "bg-cyan-600 text-white shadow-cyan-900/30"
            )}
          >
            Implied Rate Curve (%)
          </Button>

          <Button
            size="sm"
            variant={viewMode === 'CUMULATIVE_BPS' ? 'default' : 'outline'}
            onClick={() => setViewMode('CUMULATIVE_BPS')}
            className={cn(
              "h-7 text-xs rounded-xl px-3 font-semibold",
              viewMode === 'CUMULATIVE_BPS' && "bg-emerald-600 text-white shadow-emerald-900/30"
            )}
          >
            Cumulative Bps (Hikes/Cuts)
          </Button>

          <Button
            size="sm"
            variant={viewMode === 'MARGINAL_BPS' ? 'default' : 'outline'}
            onClick={() => setViewMode('MARGINAL_BPS')}
            className={cn(
              "h-7 text-xs rounded-xl px-3 font-semibold",
              viewMode === 'MARGINAL_BPS' && "bg-purple-600 text-white shadow-purple-900/30"
            )}
          >
            Marginal Bps per Month
          </Button>

          <Button
            size="sm"
            variant={viewMode === 'CONTRACT_MATRIX' ? 'default' : 'outline'}
            onClick={() => setViewMode('CONTRACT_MATRIX')}
            className={cn(
              "h-7 text-xs rounded-xl px-3 font-semibold",
              viewMode === 'CONTRACT_MATRIX' && "bg-blue-600 text-white shadow-blue-900/30"
            )}
          >
            <Layers className="w-3.5 h-3.5 mr-1" />
            Contract Expiry Matrix
          </Button>
        </div>

        {/* Right: Horizon & Baseline Anchor */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Horizon Selection */}
          <div className="flex items-center bg-card/60 border border-border/60 rounded-xl p-0.5">
            {(['6M', '12M', 'ALL'] as HorizonFilter[]).map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all",
                  horizon === h
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {h === 'ALL' ? 'Full Curve' : h}
              </button>
            ))}
          </div>

          {/* Baseline selector (for Bps views) */}
          {(viewMode === 'CUMULATIVE_BPS' || viewMode === 'CONTRACT_MATRIX') && (
            <div className="flex items-center bg-card/60 border border-border/60 rounded-xl p-0.5">
              <button
                onClick={() => setBaseline('EFFR_SPOT')}
                className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-semibold transition-all",
                  baseline === 'EFFR_SPOT'
                    ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/40"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Calculate cumulative basis points vs Current Spot Effective Fed Funds Rate"
              >
                vs Spot ({currentEffr.toFixed(2)}%)
              </button>
              <button
                onClick={() => setBaseline('FRONT_MONTH')}
                className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-semibold transition-all",
                  baseline === 'FRONT_MONTH'
                    ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/40"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Calculate cumulative basis points vs Front Month ZQ Implied Rate"
              >
                vs Front ({frontMonthRate.toFixed(2)}%)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <CardContent className="p-5 sm:p-6">
        {isLoading ? (
          <div className="h-80 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-xs text-muted-foreground font-mono">Loading CME Fed Funds Futures ZQ! curve...</p>
          </div>
        ) : (
          <div>
            {/* VIEW 1: IMPLIED RATE CURVE (%) */}
            {viewMode === 'RATE_CURVE' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-3 h-1 bg-cyan-400 rounded-full inline-block" />
                      ZQ! Implied Fed Funds Policy Rate (%)
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-3 h-0.5 border-t border-dashed border-rose-400 inline-block" />
                      Spot EFFR Baseline ({currentEffr.toFixed(2)}%)
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-purple-300">
                      <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                      FOMC Meeting Expiry
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-400/90">
                    Hover data points for exact settlement, bps step & cuts priced
                  </span>
                </div>

                <div className="h-[360px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
                      <defs>
                        <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={40}
                      />
                      <YAxis
                        domain={['dataMin - 0.2', 'dataMax + 0.3']}
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                        tickFormatter={(val) => `${val.toFixed(2)}%`}
                        tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        width={55}
                      />
                      <Tooltip content={<CustomRateCurveTooltip onOpenTv={(sym) => setSelectedTvSymbol(sym)} />} />
                      
                      {/* Spot EFFR horizontal baseline */}
                      <ReferenceLine
                        y={currentEffr}
                        stroke="#f43f5e"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: `Spot EFFR: ${currentEffr.toFixed(2)}%`,
                          fill: '#f43f5e',
                          position: 'top',
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: 'monospace',
                        }}
                      />

                      <Area
                        type="monotone"
                        dataKey="impliedRate"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#rateGradient)"
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isFomc = payload.hasFomc;
                          return (
                            <circle
                              key={`dot-${payload.symbol}`}
                              cx={cx}
                              cy={cy}
                              r={isFomc ? 5.5 : 3.5}
                              fill={isFomc ? '#a855f7' : '#06b6d4'}
                              stroke="#0f172a"
                              strokeWidth={2}
                              className={cn(
                                "cursor-pointer transition-transform hover:scale-150",
                                isFomc && "ring-2 ring-purple-400"
                              )}
                              onClick={() => setSelectedTvSymbol(payload.symbol)}
                            />
                          );
                        }}
                        activeDot={{ r: 7, fill: '#38bdf8', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* VIEW 2: CUMULATIVE BASIS POINTS & PRICED CUTS/HIKES */}
            {viewMode === 'CUMULATIVE_BPS' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                      <span className="w-3 h-2 bg-emerald-500 rounded-sm inline-block" />
                      Rate Cuts Priced (Negative Bps)
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-rose-400">
                      <span className="w-3 h-2 bg-rose-500 rounded-sm inline-block" />
                      Rate Hikes Priced (Positive Bps)
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Reference: {baseline === 'EFFR_SPOT' ? `Spot EFFR (${currentEffr.toFixed(2)}%)` : `Front ZQ (${frontMonthRate.toFixed(2)}%)`}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-400">
                    Dashed lines = 25 bps policy rate cut increments (-25, -50, -75, -100 bps)
                  </span>
                </div>

                <div className="h-[360px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={40}
                      />
                      <YAxis
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                        tickFormatter={(val) => `${val > 0 ? '+' : ''}${val} bps`}
                        tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        width={65}
                      />
                      <Tooltip content={<CustomBpsTooltip onOpenTv={(sym) => setSelectedTvSymbol(sym)} />} />

                      {/* 0 Baseline */}
                      <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />

                      {/* Standard 25 bps cut increments */}
                      <ReferenceLine y={-25} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: '1 Cut (-25 bps)', fill: '#10b981', position: 'right', fontSize: 9, fontFamily: 'monospace' }} />
                      <ReferenceLine y={-50} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: '2 Cuts (-50 bps)', fill: '#10b981', position: 'right', fontSize: 9, fontFamily: 'monospace' }} />
                      <ReferenceLine y={-75} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: '3 Cuts (-75 bps)', fill: '#10b981', position: 'right', fontSize: 9, fontFamily: 'monospace' }} />
                      <ReferenceLine y={-100} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: '4 Cuts (-100 bps)', fill: '#10b981', position: 'right', fontSize: 9, fontFamily: 'monospace' }} />
                      <ReferenceLine y={-125} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: '5 Cuts (-125 bps)', fill: '#10b981', position: 'right', fontSize: 9, fontFamily: 'monospace' }} />

                      <Bar dataKey="cumulativeBps" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={entry.cumulativeBps <= 0 ? '#10b981' : '#f43f5e'}
                            fillOpacity={0.85}
                            className="cursor-pointer hover:opacity-100 transition-opacity"
                            onClick={() => setSelectedTvSymbol(entry.symbol)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* VIEW 3: MARGINAL MOVE (BPS/MO) */}
            {viewMode === 'MARGINAL_BPS' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-3 h-2 bg-purple-500 rounded-sm inline-block" />
                      Sequential Rate Change from Prior Expiry (bps)
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-purple-300">
                      🏛️ Badges indicate FOMC meeting months
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Shows incremental rate cuts/hikes priced at each specific expiry
                  </span>
                </div>

                <div className="h-[360px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={40}
                      />
                      <YAxis
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                        tickFormatter={(val) => `${val > 0 ? '+' : ''}${val} bps`}
                        tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        width={60}
                      />
                      <Tooltip content={<CustomMarginalTooltip onOpenTv={(sym) => setSelectedTvSymbol(sym)} />} />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />

                      <Bar dataKey="marginalBps" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, idx) => {
                          const isFomc = entry.hasFomc;
                          return (
                            <Cell
                              key={`cell-m-${idx}`}
                              fill={isFomc ? '#a855f7' : entry.marginalBps <= 0 ? '#38bdf8' : '#fb7185'}
                              fillOpacity={0.85}
                              className="cursor-pointer hover:opacity-100 transition-opacity"
                              onClick={() => setSelectedTvSymbol(entry.symbol)}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* VIEW 4: CONTRACT EXPIRY MATRIX / TABLE */}
            {viewMode === 'CONTRACT_MATRIX' && (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/40">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/20 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        <th className="py-3 px-4">Expiry Month</th>
                        <th className="py-3 px-4">Ticker</th>
                        <th className="py-3 px-4 text-right">Futures Price</th>
                        <th className="py-3 px-4 text-right">1D Change</th>
                        <th className="py-3 px-4 text-right">Implied Rate</th>
                        <th className="py-3 px-4 text-right">Marginal Move</th>
                        <th className="py-3 px-4 text-right">
                          Cumul. Bps ({baseline === 'EFFR_SPOT' ? 'vs Spot' : 'vs Front'})
                        </th>
                        <th className="py-3 px-4 text-center">Priced Hikes/Cuts</th>
                        <th className="py-3 px-4 text-center">FOMC Meeting</th>
                        <th className="py-3 px-3 text-center">Chart</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 font-mono">
                      {chartData.map((c) => {
                        const cutsCount = Math.abs(c.cumulativeCuts);
                        const isCut = c.cumulativeBps <= 0;

                        return (
                          <tr
                            key={c.symbol}
                            className="hover:bg-accent/20 transition-colors group cursor-pointer"
                            onClick={() => setSelectedTvSymbol(c.symbol)}
                          >
                            <td className="py-2.5 px-4 font-semibold text-foreground flex items-center gap-2">
                              <span>{c.fullMonth}</span>
                              {c.hasFomc && (
                                <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[9px] px-1.5 py-0 font-sans font-bold">
                                  FOMC
                                </Badge>
                              )}
                            </td>

                            <td className="py-2.5 px-4 text-cyan-300 font-bold group-hover:underline">
                              {c.symbol}
                            </td>

                            <td className="py-2.5 px-4 text-right font-bold text-foreground">
                              {c.price.toFixed(4)}
                            </td>

                            <td className={cn(
                              "py-2.5 px-4 text-right text-[11px]",
                              c.priceChange > 0 ? "text-emerald-400" : c.priceChange < 0 ? "text-rose-400" : "text-muted-foreground"
                            )}>
                              {c.priceChange !== 0 ? `${c.priceChange > 0 ? '+' : ''}${c.priceChange.toFixed(4)}` : '0.0000'}
                            </td>

                            <td className="py-2.5 px-4 text-right font-black text-cyan-400 text-sm">
                              {c.impliedRate.toFixed(3)}%
                            </td>

                            <td className={cn(
                              "py-2.5 px-4 text-right font-semibold",
                              c.marginalBps < 0 ? "text-emerald-400" : c.marginalBps > 0 ? "text-rose-400" : "text-muted-foreground"
                            )}>
                              {c.marginalBps !== 0 ? `${c.marginalBps > 0 ? '+' : ''}${c.marginalBps} bps` : '0.0 bps'}
                            </td>

                            <td className={cn(
                              "py-2.5 px-4 text-right font-bold",
                              isCut ? "text-emerald-400" : "text-rose-400"
                            )}>
                              {c.cumulativeBps > 0 ? '+' : ''}{c.cumulativeBps} bps
                            </td>

                            <td className="py-2.5 px-4 text-center">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-mono px-2 py-0.5 border",
                                  isCut
                                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                                    : "bg-rose-500/15 text-rose-300 border-rose-500/40"
                                )}
                              >
                                {isCut ? `-${cutsCount} cuts` : `+${cutsCount} hikes`}
                              </Badge>
                            </td>

                            <td className="py-2.5 px-4 text-center text-[10px] font-sans">
                              {c.fomcMeeting ? (
                                <span className="text-purple-300 font-semibold" title={c.fomcMeeting.label}>
                                  {c.fomcMeeting.label.split(',')[0]}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 rounded-lg text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTvSymbol(c.symbol);
                                }}
                                title={`Open TradingView chart for ${c.symbol}`}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* FOMC MEETING BREAKDOWN CALLOUT STRIP & PRICING MATRIX */}
            <div className="mt-6 p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-card/80 via-purple-950/20 to-card/80 border border-purple-500/30 shadow-xl space-y-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 shadow-inner">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-black text-foreground text-sm tracking-tight flex items-center gap-2">
                      Upcoming FOMC Decision Pricing Matrix
                      <Badge variant="outline" className="text-[9px] font-mono text-purple-300 border-purple-500/40 uppercase">
                        CME FedWatch Model
                      </Badge>
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Market-implied decision probabilities across scheduled FOMC meetings (Rate Cut vs. Pause vs. Rate Hike).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedTvSymbol('CBOT:ZQ1!')}
                    className="h-8 text-xs rounded-xl border-purple-500/40 text-purple-300 hover:bg-purple-500/20 font-semibold gap-1.5 shadow-sm"
                  >
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                    <span>View Continuous ZQ!</span>
                  </Button>
                </div>
              </div>

              {/* Next Imminent Decision Spotlight */}
              {summary?.nextFomc && (
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-purple-500/25 text-purple-200 border-purple-500/40 text-[10px] font-bold">
                        Next Decision
                      </Badge>
                      <span className="text-sm font-black text-foreground">
                        {summary.nextFomc.label}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        ({summary.nextFomc.daysUntil} days away)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
                      <span>Market-Implied Meeting Shift:</span>
                      <strong className={cn(
                        "font-bold",
                        summary.nextFomc.impliedMoveBps < 0 ? "text-emerald-400" : summary.nextFomc.impliedMoveBps > 0 ? "text-rose-400" : "text-sky-300"
                      )}>
                        {summary.nextFomc.impliedMoveBps > 0 ? '+' : ''}{summary.nextFomc.impliedMoveBps} bps
                      </strong>
                    </p>
                  </div>

                  {/* Color-Coded Probabilities & Stack Bar */}
                  <div className="space-y-2 md:max-w-lg w-full">
                    <div className="flex items-center gap-2 flex-wrap text-xs font-mono font-bold justify-start md:justify-end">
                      {/* 50 bps Cut (if > 0%) */}
                      {summary.nextFomc.probabilities.cut50 > 0 && (
                        <div className="px-2.5 py-1 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 flex items-center gap-1 shadow-sm">
                          <TrendingDown className="w-3 h-3 text-teal-400" />
                          <span>-50bp Cut: {summary.nextFomc.probabilities.cut50}%</span>
                        </div>
                      )}

                      {/* 25 bps Cut */}
                      <div className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-1 shadow-sm">
                        <TrendingDown className="w-3 h-3 text-emerald-400" />
                        <span>-25bp Cut: {summary.nextFomc.probabilities.cut25}%</span>
                      </div>

                      {/* Pause (0 bps) */}
                      <div className="px-2.5 py-1 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-300 flex items-center gap-1 shadow-sm">
                        <span className="w-2 h-0.5 bg-sky-400 rounded-full inline-block" />
                        <span>Pause: {summary.nextFomc.probabilities.pause}%</span>
                      </div>

                      {/* 25 bps Hike */}
                      <div className="px-2.5 py-1 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-center gap-1 shadow-sm">
                        <TrendingUp className="w-3 h-3 text-rose-400" />
                        <span>+25bp Hike: {summary.nextFomc.probabilities.hike25}%</span>
                      </div>
                    </div>

                    {/* Visual Segmented Progress Bar */}
                    <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden flex shadow-inner border border-white/10">
                      {summary.nextFomc.probabilities.cut50 > 0 && (
                        <div
                          style={{ width: `${summary.nextFomc.probabilities.cut50}%` }}
                          className="bg-teal-500 transition-all duration-500"
                          title={`50 bps Cut: ${summary.nextFomc.probabilities.cut50}%`}
                        />
                      )}
                      <div
                        style={{ width: `${summary.nextFomc.probabilities.cut25}%` }}
                        className="bg-emerald-500 transition-all duration-500"
                        title={`25 bps Cut: ${summary.nextFomc.probabilities.cut25}%`}
                      />
                      <div
                        style={{ width: `${summary.nextFomc.probabilities.pause}%` }}
                        className="bg-sky-500 transition-all duration-500"
                        title={`Pause / Unchanged: ${summary.nextFomc.probabilities.pause}%`}
                      />
                      <div
                        style={{ width: `${summary.nextFomc.probabilities.hike25}%` }}
                        className="bg-rose-500 transition-all duration-500"
                        title={`25 bps Hike: ${summary.nextFomc.probabilities.hike25}%`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Grid of All Upcoming Scheduled FOMC Decisions */}
              {fomcMeetings.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                    <span className="font-semibold uppercase tracking-wider text-foreground/80">
                      Scheduled FOMC Decisions Matrix (Upcoming Expiries)
                    </span>
                    <span className="font-mono text-purple-300">Click meeting to inspect in TradingView</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                    {fomcMeetings.map((c) => {
                      const probs = resolveProbabilities(c);
                      const move = c.fomcImpliedStepBps ?? c.marginalBps ?? 0;
                      const isCut = move < 0;

                      return (
                        <div
                          key={`fomc-matrix-${c.symbol}`}
                          onClick={() => setSelectedTvSymbol(c.symbol)}
                          className="p-3 rounded-2xl bg-card/60 hover:bg-accent/25 border border-border/60 hover:border-purple-500/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between space-y-2.5"
                        >
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-foreground group-hover:text-cyan-300 transition-colors">
                                  {c.fomcMeeting?.label?.split(',')[0] || c.expiryLabel}
                                </span>
                                <Badge variant="outline" className="text-[9px] font-mono text-purple-300 border-purple-500/30 px-1 py-0">
                                  {c.symbol}
                                </Badge>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                                Implied Rate: <strong className="text-cyan-400 font-bold">{c.impliedRate.toFixed(3)}%</strong>
                              </span>
                            </div>

                            <span className={cn(
                              "text-xs font-black font-mono px-2 py-0.5 rounded-lg border",
                              isCut
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : move > 0
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : "bg-sky-500/10 text-sky-400 border-sky-500/30"
                            )}>
                              {move > 0 ? '+' : ''}{move} bps
                            </span>
                          </div>

                          {/* Color-Coded Probabilities Badges */}
                          <div className="grid grid-cols-3 gap-1 text-[10px] font-mono font-bold text-center">
                            {/* Cut */}
                            <div className="p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
                              <span className="text-[9px] text-emerald-400/80 block font-sans font-medium">Cut</span>
                              <span>{probs.cut25}%</span>
                            </div>

                            {/* Pause */}
                            <div className="p-1 rounded-lg bg-sky-500/10 border border-sky-500/25 text-sky-300">
                              <span className="text-[9px] text-sky-400/80 block font-sans font-medium">Pause</span>
                              <span>{probs.pause}%</span>
                            </div>

                            {/* Hike */}
                            <div className="p-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300">
                              <span className="text-[9px] text-rose-400/80 block font-sans font-medium">Hike</span>
                              <span>{probs.hike25}%</span>
                            </div>
                          </div>

                          {/* Mini Segmented Distribution Bar */}
                          <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden flex border border-white/10">
                            {probs.cut50 > 0 && (
                              <div style={{ width: `${probs.cut50}%` }} className="bg-teal-500" />
                            )}
                            <div style={{ width: `${probs.cut25}%` }} className="bg-emerald-500" />
                            <div style={{ width: `${probs.pause}%` }} className="bg-sky-500" />
                            <div style={{ width: `${probs.hike25}%` }} className="bg-rose-500" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* ================= INTERACTIVE TRADINGVIEW MODAL ================= */}
      <Dialog open={!!selectedTvSymbol} onOpenChange={(open) => !open && setSelectedTvSymbol(null)}>
        <DialogContent className="max-w-5xl w-[96vw] h-[86vh] p-0 overflow-hidden bg-slate-950/95 border-border/80 rounded-3xl flex flex-col shadow-2xl">
          <DialogHeader className="p-4 px-6 border-b border-border/50 bg-card/60 flex flex-row items-center justify-between shrink-0">
            <div>
              <DialogTitle className="text-base font-black flex items-center gap-2 text-foreground">
                <Landmark className="w-4 h-4 text-cyan-400" />
                <span>TradingView Chart — {selectedTvSymbol || 'ZQ!'}</span>
                <Badge variant="outline" className="text-[10px] font-mono text-cyan-300 border-cyan-500/40">
                  CBOT 30-Day Fed Funds Futures
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Real-time price action, settlement history, moving averages and volume for 30-Day Fed Funds futures contract.
              </DialogDescription>
            </div>

            {onNavigateToGraphs && selectedTvSymbol && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const sym = selectedTvSymbol;
                  setSelectedTvSymbol(null);
                  onNavigateToGraphs(sym);
                }}
                className="h-8 px-3 rounded-xl border-cyan-500/40 text-cyan-300 text-xs font-semibold gap-1.5"
              >
                <span>Full Graphs View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </DialogHeader>

          <div className="flex-1 w-full h-full p-2 bg-slate-950">
            {selectedTvSymbol && (
              <TradingViewChart
                symbol={selectedTvSymbol}
                height="100%"
                interval="D"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ================= CUSTOM RECHARTS TOOLTIPS =================

interface TooltipProps {
  active?: boolean;
  payload?: any[];
  onOpenTv: (sym: string) => void;
}

function CustomRateCurveTooltip({ active, payload, onOpenTv }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const spotRate = d.spotEffr || 4.83;
  const impliedRate = d.impliedRate;
  const cumBps = d.cumulativeBps;
  const cuts = Math.abs(d.cumulativeCuts);
  const isCut = cumBps <= 0;

  return (
    <div className="p-3.5 rounded-2xl bg-slate-950/95 border border-cyan-500/40 shadow-2xl backdrop-blur-xl text-xs space-y-2 min-w-[220px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div>
          <span className="font-bold text-foreground block text-sm">{d.fullMonth}</span>
          <span className="text-[10px] text-cyan-400 font-mono font-semibold">{d.symbol} ({d.fullSymbol})</span>
        </div>
        {d.hasFomc && (
          <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] px-1.5 py-0 font-bold">
            FOMC Month
          </Badge>
        )}
      </div>

      <div className="space-y-1.5 font-mono text-[11px]">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-sans">Futures Price:</span>
          <span className="font-bold text-foreground">{d.price.toFixed(4)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-sans">Implied Policy Rate:</span>
          <span className="font-black text-cyan-400 text-sm">{impliedRate.toFixed(3)}%</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-sans">Marginal Move (1M):</span>
          <span className={cn("font-bold", d.marginalBps < 0 ? "text-emerald-400" : d.marginalBps > 0 ? "text-rose-400" : "text-muted-foreground")}>
            {d.marginalBps > 0 ? '+' : ''}{d.marginalBps} bps
          </span>
        </div>

        <div className="flex justify-between items-center border-t border-white/10 pt-1.5">
          <span className="text-muted-foreground font-sans">Shift from Spot ({spotRate.toFixed(2)}%):</span>
          <span className={cn("font-black", isCut ? "text-emerald-400" : "text-rose-400")}>
            {cumBps > 0 ? '+' : ''}{cumBps} bps
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-sans">Priced 25bp Moves:</span>
          <Badge variant="outline" className={cn(
            "text-[10px] font-mono px-1.5 py-0 font-bold border",
            isCut ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border-rose-500/40"
          )}>
            {isCut ? `${cuts} Rate Cuts` : `${cuts} Rate Hikes`}
          </Badge>
        </div>

        {d.fomcMeeting && (
          <div className="mt-2 pt-2 border-t border-purple-500/30 text-[10px] font-sans text-purple-200 space-y-1">
            <span className="font-semibold block text-purple-300">🏛️ {d.fomcMeeting.label}</span>
            <div className="grid grid-cols-3 gap-1 font-mono font-bold text-[10px] text-center">
              <span className="p-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Cut: {d.fomcProbabilities?.cut25 ?? 0}%
              </span>
              <span className="p-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                Pause: {d.fomcProbabilities?.pause ?? 100}%
              </span>
              <span className="p-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                Hike: {d.fomcProbabilities?.hike25 ?? 0}%
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="pt-1 border-t border-white/10 text-[9px] text-cyan-400/80 text-center font-sans">
        Click to open in TradingView
      </div>
    </div>
  );
}

function CustomBpsTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const cumBps = d.cumulativeBps;
  const cuts = Math.abs(d.cumulativeCuts);
  const isCut = cumBps <= 0;

  return (
    <div className="p-3.5 rounded-2xl bg-slate-950/95 border border-emerald-500/40 shadow-2xl backdrop-blur-xl text-xs space-y-2 min-w-[210px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
        <div>
          <span className="font-bold text-foreground text-sm block">{d.fullMonth}</span>
          <span className="text-[10px] text-cyan-400 font-mono">{d.symbol}</span>
        </div>
        <Badge variant="outline" className={cn(
          "text-[10px] font-mono px-1.5 py-0 font-bold border",
          isCut ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border-rose-500/40"
        )}>
          {isCut ? `${cuts} Cuts` : `${cuts} Hikes`}
        </Badge>
      </div>

      <div className="space-y-1 font-mono text-[11px]">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-sans">Cumulative Shift:</span>
          <span className={cn("font-black text-sm", isCut ? "text-emerald-400" : "text-rose-400")}>
            {cumBps > 0 ? '+' : ''}{cumBps} bps
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-sans">Implied Policy Rate:</span>
          <span className="font-bold text-cyan-300">{d.impliedRate.toFixed(3)}%</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-sans">Futures Price:</span>
          <span className="text-foreground">{d.price.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
}

function CustomMarginalTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;

  return (
    <div className="p-3 rounded-2xl bg-slate-950/95 border border-purple-500/40 shadow-2xl backdrop-blur-xl text-xs space-y-1.5 min-w-[200px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
        <span className="font-bold text-foreground">{d.fullMonth}</span>
        {d.hasFomc && (
          <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] px-1 py-0">
            FOMC
          </Badge>
        )}
      </div>

      <div className="font-mono text-[11px] space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-sans">Marginal Move:</span>
          <span className={cn("font-black", d.marginalBps < 0 ? "text-emerald-400" : d.marginalBps > 0 ? "text-rose-400" : "text-muted-foreground")}>
            {d.marginalBps > 0 ? '+' : ''}{d.marginalBps} bps
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground font-sans">Rate Change:</span>
          <span className="text-cyan-300">{d.impliedRate.toFixed(3)}%</span>
        </div>
      </div>
    </div>
  );
}
