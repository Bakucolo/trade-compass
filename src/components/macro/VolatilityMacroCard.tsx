import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Zap,
  Activity,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sparkles,
  Layers,
  LineChart,
  BarChart3,
  Calendar,
  Compass,
  Bell,
  CheckCircle2,
  HelpCircle,
  Clock,
  RotateCw,
  ExternalLink,
  ChevronRight,
  Flame,
  Scale,
  ArrowUpRight,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  VolatilityMacroData,
  VolatilitySignal,
  VolatilityTradeSetup,
  useVolatilityIntelligence,
} from '@/services/volatilityMacroService';
import { useCreateAlert } from '@/services/alertService';
import { ExtremeSignalsModal } from './ExtremeSignalsModal';

interface VolatilityMacroCardProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
  onNavigateToTrades?: () => void;
}

export function VolatilityMacroCard({
  onNavigateToResearch,
  onNavigateToGraphs,
  onNavigateToTrades,
}: VolatilityMacroCardProps) {
  const { data: volData, isLoading, isError, refetch, isFetching } = useVolatilityIntelligence();
  const createAlertMutation = useCreateAlert();
  const [isExtremeModalOpen, setIsExtremeModalOpen] = useState(false);

  const handleArmSignalAlert = async (signal: VolatilitySignal) => {
    try {
      const targetSym = signal.recommendedTrade.targetAsset.includes('/') ? 'SPY' : signal.recommendedTrade.targetAsset;
      await createAlertMutation.mutateAsync({
        symbol: targetSym,
        targetPrice: volData?.spotMetrics.vix.current || 20,
        condition: signal.recommendedTrade.bias === 'BULLISH' ? 'BELOW' : 'ABOVE',
        note: `Macro Volatility Trigger: ${signal.title} (${signal.code}) active at ${signal.currentValue}.`,
      });
      toast.success(`Arm volatility signal alert set for ${targetSym}!`);
    } catch (err: any) {
      toast.error(`Failed to create alert: ${err.message}`);
    }
  };

  const handleExecuteTradeSetup = (trade: VolatilityTradeSetup) => {
    // Dispatch custom event to prefill trade
    window.dispatchEvent(
      new CustomEvent('tradeflow-log-macro-trade', {
        detail: {
          strategyName: trade.strategyName,
          targetAsset: trade.targetAsset,
          bias: trade.bias,
          tradeConstruction: trade.tradeConstruction,
          rationale: trade.rationale,
        },
      })
    );

    if (onNavigateToTrades) {
      onNavigateToTrades();
    } else {
      toast.success(`Pre-filled ${trade.strategyName} in Trade Command!`);
    }
  };

  if (isLoading && !volData) {
    return (
      <Card className="bg-card/60 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl p-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Zap className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs font-semibold text-muted-foreground font-mono animate-pulse">
            Compiling Real-Time Volatility Term Structure, CBOE SKEW & Dispersion Signals...
          </p>
        </div>
      </Card>
    );
  }

  if (isError || !volData) {
    return (
      <Card className="bg-card/60 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl p-6">
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <h4 className="text-sm font-bold text-foreground">Volatility Intelligence Unavailable</h4>
          <p className="text-xs text-muted-foreground max-w-sm">
            Unable to connect to live CBOE volatility telemetry.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs mt-2">
            Retry Volatility Telemetry
          </Button>
        </div>
      </Card>
    );
  }

  const { regime, spotMetrics, termStructure, dispersion, activeSignals, hasExtremeSignals, extremeSignalsCount } = volData;

  const regimeBadgeStyle =
    regime.badgeColor === 'emerald'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
      : regime.badgeColor === 'cyan'
      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
      : regime.badgeColor === 'amber'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : regime.badgeColor === 'orange'
      ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
      : 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.25)]';

  return (
    <Card className="bg-card/70 backdrop-blur-2xl border border-border/70 shadow-xl hover:border-primary/40 transition-all rounded-2xl overflow-hidden">
      
      {/* Top sentiment accent glow strip */}
      <div className={cn(
        "h-1.5 w-full",
        hasExtremeSignals
          ? "bg-gradient-to-r from-rose-500 via-amber-400 to-rose-600 animate-pulse"
          : "bg-gradient-to-r from-cyan-500 via-primary to-purple-500"
      )} />

      {/* ================= HEADER & REGIME DIAGNOSIS ================= */}
      <CardHeader className="p-6 pb-4 border-b border-border/40 bg-accent/15">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] font-mono font-bold uppercase tracking-wider">
                CBOE Volatility & Derivatives Matrix
              </Badge>
              <Badge className={cn("text-[10px] font-mono font-bold uppercase", regimeBadgeStyle)}>
                <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
                {regime.label}
              </Badge>

              {/* Clickable Extreme Level Signals Active Badge */}
              {hasExtremeSignals ? (
                <button
                  type="button"
                  onClick={() => setIsExtremeModalOpen(true)}
                  className="text-[10px] font-mono font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.35)] hover:bg-rose-500/35 hover:border-rose-400 active:scale-95 transition-all px-2.5 py-0.5 rounded-full flex items-center gap-1.5 cursor-pointer group animate-pulse"
                  title="Click to inspect active extreme signals & trade setups"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping inline-block" />
                  <span>🚨 {extremeSignalsCount} Extreme Level Signals Active</span>
                  <ArrowUpRight className="w-3 h-3 text-rose-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsExtremeModalOpen(true)}
                  className="text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 active:scale-95 transition-all px-2.5 py-0.5 rounded-full flex items-center gap-1.5 cursor-pointer group"
                  title="Click to inspect all monitored macro volatility thresholds"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>All Gauges Normal • Inspect Radar</span>
                  <ArrowUpRight className="w-3 h-3 text-emerald-300 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              )}
            </div>

            <CardTitle className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5 pt-0.5">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>Macro Volatility, VIX Term Structure & Dispersion Signals</span>
            </CardTitle>
            
            <CardDescription className="text-xs text-muted-foreground leading-relaxed max-w-4xl">
              {regime.summary}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            {hasExtremeSignals && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExtremeModalOpen(true)}
                className="h-9 text-xs font-bold gap-1.5 border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>View {extremeSignalsCount} Alerts</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 text-xs font-bold gap-1.5"
            >
              <RotateCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin text-primary")} />
              <span>Refresh Vol Telemetry</span>
            </Button>
          </div>

        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        
        {/* ================= 1. CORE VOLATILITY METRICS 5-CARD GRID ================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 font-mono">
          
          {/* Spot VIX */}
          <div className="bg-card/80 p-3.5 rounded-xl border border-border/60 shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-sans font-bold text-muted-foreground block">
                Spot VIX Index
              </span>
              <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-4 bg-slate-900 border-slate-700">
                {spotMetrics.vix.percentile52w}th %ile
              </Badge>
            </div>
            <div className="flex items-baseline gap-1.5">
              <strong className={cn(
                "text-2xl font-black",
                spotMetrics.vix.current > 24 ? "text-rose-400" :
                spotMetrics.vix.current < 13.5 ? "text-cyan-300" : "text-emerald-400"
              )}>
                {spotMetrics.vix.current.toFixed(2)}
              </strong>
              <span className={cn("text-[11px] font-bold", spotMetrics.vix.change >= 0 ? "text-rose-400" : "text-emerald-400")}>
                {spotMetrics.vix.change >= 0 ? '+' : ''}{spotMetrics.vix.change.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", spotMetrics.vix.current > 24 ? "bg-rose-500" : "bg-emerald-500")}
                style={{ width: `${spotMetrics.vix.percentile52w}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground block font-sans">
              Range: {spotMetrics.vix.dayLow.toFixed(1)} - {spotMetrics.vix.dayHigh.toFixed(1)}
            </span>
          </div>

          {/* VIX Futures Term Structure Slope */}
          <div className="bg-card/80 p-3.5 rounded-xl border border-border/60 shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-sans font-bold text-muted-foreground block">
                Term Structure Slope
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] font-mono px-1 py-0 h-4",
                  termStructure.structureType === 'CONTANGO'
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                )}
              >
                {termStructure.structureType}
              </Badge>
            </div>
            <div className="flex items-baseline gap-1.5">
              <strong className={cn(
                "text-2xl font-black",
                termStructure.slopePercent >= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {termStructure.slopePercent >= 0 ? '+' : ''}{termStructure.slopePercent}%
              </strong>
              <span className="text-[10px] text-muted-foreground">VX2/VX1</span>
            </div>
            <span className="text-[10px] text-muted-foreground block font-sans">
              Roll Yield: <b>+{termStructure.rollYieldAnnualized}%/yr</b>
            </span>
            <span className="text-[10px] text-muted-foreground block font-sans">
              VX1: ${termStructure.vx1FrontMonth.toFixed(2)} • VX2: ${termStructure.vx2SecondMonth.toFixed(2)}
            </span>
          </div>

          {/* CBOE SKEW Index */}
          <div className="bg-card/80 p-3.5 rounded-xl border border-border/60 shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-sans font-bold text-muted-foreground block">
                CBOE SKEW Index
              </span>
              <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-4 bg-slate-900 border-slate-700">
                {spotMetrics.skew.percentile52w}th %ile
              </Badge>
            </div>
            <div className="flex items-baseline gap-1.5">
              <strong className={cn(
                "text-2xl font-black",
                spotMetrics.skew.current >= 142 ? "text-amber-300" : "text-foreground"
              )}>
                {spotMetrics.skew.current.toFixed(1)}
              </strong>
              <span className="text-[10px] text-muted-foreground">Tail Risk</span>
            </div>
            <span className="text-[10px] text-muted-foreground block font-sans truncate" title={spotMetrics.skew.riskLabel}>
              {spotMetrics.skew.riskLabel}
            </span>
            <span className="text-[10px] text-muted-foreground block font-sans">
              Out-of-the-Money Put Pricing
            </span>
          </div>

          {/* Implied Correlation & Dispersion */}
          <div className="bg-card/80 p-3.5 rounded-xl border border-border/60 shadow-sm space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-sans font-bold text-muted-foreground block">
                Stock Dispersion
              </span>
              <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-4 bg-purple-500/10 text-purple-300 border-purple-500/30">
                CORR {spotMetrics.impliedCorrelation.current}%
              </Badge>
            </div>
            <div className="flex items-baseline gap-1.5">
              <strong className="text-2xl font-black text-purple-300">
                {dispersion.stockDispersionScore}
              </strong>
              <span className="text-[10px] text-muted-foreground">/100</span>
            </div>
            <span className="text-[10px] text-muted-foreground block font-sans truncate" title={spotMetrics.impliedCorrelation.regimeLabel}>
              {spotMetrics.impliedCorrelation.regimeLabel}
            </span>
            <span className="text-[10px] text-muted-foreground block font-sans">
              Single-stock vs Index Vol
            </span>
          </div>

          {/* Volatility Risk Premium (VRP) */}
          <div className="bg-card/80 p-3.5 rounded-xl border border-border/60 shadow-sm space-y-1.5 col-span-2 sm:col-span-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-sans font-bold text-muted-foreground block">
                Vol Risk Premium (VRP)
              </span>
              <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-4 bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                Edge
              </Badge>
            </div>
            <div className="flex items-baseline gap-1.5">
              <strong className={cn(
                "text-2xl font-black",
                spotMetrics.volatilityRiskPremium.vrpSpread > 2.0 ? "text-emerald-400" : "text-amber-400"
              )}>
                +{spotMetrics.volatilityRiskPremium.vrpSpread}
              </strong>
              <span className="text-[10px] text-muted-foreground">pts</span>
            </div>
            <span className="text-[10px] text-emerald-400 block font-sans truncate" title={spotMetrics.volatilityRiskPremium.edgeLabel}>
              {spotMetrics.volatilityRiskPremium.edgeLabel}
            </span>
            <span className="text-[10px] text-muted-foreground block font-sans">
              IV: {spotMetrics.volatilityRiskPremium.iv30.toFixed(1)}% vs Realized: {spotMetrics.volatilityRiskPremium.rv20.toFixed(1)}%
            </span>
          </div>

        </div>

        {/* ================= 2. VOLATILITY TERM STRUCTURE CURVE VISUALIZER ================= */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/50 border border-border/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LineChart className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground font-sans">
                VIX Term Structure Curve (9D to 6M Expirations)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className={cn(
                "font-bold px-2 py-0.5 rounded-full text-[11px] border",
                termStructure.structureType === 'CONTANGO'
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-300 border-rose-500/30"
              )}>
                {termStructure.structureType === 'CONTANGO' ? '✓ Upward Sloping Contango (Options Sellers Tailwind)' : '⚠️ Inverted Backwardation (Market Stress)'}
              </span>
            </div>
          </div>

          {/* Curve Step Progression */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 font-mono text-xs">
            {termStructure.points.map((pt, idx) => (
              <div
                key={pt.tenor}
                className={cn(
                  "p-3 rounded-xl border space-y-1 transition-all",
                  idx === 1 ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30" : "bg-card/60 border-border/50"
                )}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-muted-foreground">{pt.label}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-slate-900 border-slate-700">
                    {pt.dte}d
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1 pt-0.5">
                  <strong className="text-base font-black text-foreground">
                    {pt.value.toFixed(2)}
                  </strong>
                  <span className={cn("text-[10px] font-bold", pt.change >= 0 ? "text-rose-400" : "text-emerald-400")}>
                    {pt.change >= 0 ? '+' : ''}{pt.change.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ================= 3. ACTIVE SIGNALS & HIGH-PROBABILITY TRADES ================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground font-sans">
                Active Volatility Signals & High-Probability Trade Playbooks ({activeSignals.length})
              </span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExtremeModalOpen(true)}
              className="h-7 px-2.5 text-[11px] font-bold gap-1.5 border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 shadow-sm"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Inspect Extreme Signals ({extremeSignalsCount})</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeSignals.map((signal) => {
              const isCritical = signal.severity === 'CRITICAL';
              const isHigh = signal.severity === 'HIGH';
              const isModerate = signal.severity === 'MODERATE';
              const trade = signal.recommendedTrade;

              return (
                <div
                  key={signal.id}
                  className={cn(
                    "p-5 rounded-2xl border transition-all space-y-4 relative overflow-hidden bg-card/70 shadow-md cursor-pointer hover:border-primary/50",
                    isCritical ? "border-rose-500/40 bg-gradient-to-br from-rose-950/20 to-card" :
                    isHigh ? "border-amber-500/40 bg-gradient-to-br from-amber-950/20 to-card" :
                    isModerate ? "border-purple-500/40 bg-gradient-to-br from-purple-950/20 to-card" :
                    "border-border/60 hover:border-border"
                  )}
                  onClick={() => setIsExtremeModalOpen(true)}
                >
                  {/* Signal Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          className={cn(
                            "text-[9px] font-mono font-bold uppercase px-1.5 py-0 h-4",
                            isCritical ? "bg-rose-500 text-white" :
                            isHigh ? "bg-amber-500 text-black" :
                            isModerate ? "bg-purple-500 text-white" :
                            "bg-primary/20 text-primary border-primary/30"
                          )}
                        >
                          {signal.severity}
                        </Badge>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {signal.metric}: <b>{signal.currentValue}</b>
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-foreground pt-0.5">
                        {signal.title}
                      </h4>
                    </div>

                    <Badge variant="outline" className="text-[10px] font-mono font-semibold border-border/60 bg-slate-900/60 self-start sm:self-center">
                      Threshold: {signal.threshold}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {signal.description}
                  </p>

                  {/* Trade Blueprint Box */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-border/50 space-y-3 font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={cn(
                            "text-[10px] font-bold uppercase px-2 py-0.5",
                            trade.bias === 'BULLISH' ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" :
                            trade.bias === 'BEARISH' ? "bg-rose-500/20 text-rose-300 border-rose-500/40" :
                            trade.bias === 'LONG_VOLATILITY' ? "bg-purple-500/20 text-purple-300 border-purple-500/40" :
                            "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          )}
                        >
                          {trade.bias.replace(/_/g, ' ')}
                        </Badge>
                        <span className="font-bold text-foreground">{trade.strategyName}</span>
                      </div>
                      <span className="text-primary font-black">[{trade.targetAsset}]</span>
                    </div>

                    <div className="space-y-1 text-[11px] text-muted-foreground font-sans">
                      <div><b>Construction:</b> {trade.tradeConstruction}</div>
                      <div><b>Entry Trigger:</b> {trade.entryTrigger}</div>
                      <div><b>Target Profit:</b> <span className="text-emerald-400 font-mono font-bold">{trade.targetProfit}</span> • <b>Stop:</b> {trade.invalidationStop}</div>
                      <div className="text-[10px] text-primary/90 font-mono pt-1">
                        ★ {trade.historicalWinRate}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/40 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => handleExecuteTradeSetup(trade)}
                        className="h-7 text-xs font-bold gap-1 bg-gradient-to-r from-primary to-cyan-600 hover:opacity-90 text-white shadow-sm"
                      >
                        <Compass className="w-3 h-3" />
                        <span>Log Setup in Trades</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleArmSignalAlert(signal)}
                        className="h-7 text-xs font-bold gap-1 border-border/60 hover:bg-accent/40"
                      >
                        <Bell className="w-3 h-3 text-amber-400" />
                        <span>Arm Signal Alert</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsExtremeModalOpen(true)}
                        className="h-7 text-xs font-bold gap-1 text-primary hover:bg-primary/20 ml-auto"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Deep Dive</span>
                      </Button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* ================= 4. SECTOR VOLATILITY DISPERSION MAP ================= */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card/60 border border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-sans">
              <BarChart3 className="w-3.5 h-3.5 text-primary" />
              Sector Implied Volatility Dispersion vs SPY
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              Dispersion Score: <b className="text-purple-300">{dispersion.stockDispersionScore}/100</b>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 font-mono text-xs">
            {dispersion.topSectorDispersion.map((sec) => (
              <div key={sec.sector} className="p-3 rounded-xl bg-slate-950/40 border border-border/40 space-y-1">
                <span className="text-[11px] font-bold text-foreground block truncate">{sec.sector}</span>
                <div className="flex items-baseline justify-between pt-0.5">
                  <span className="text-sm font-black text-purple-300">{sec.iv}% IV</span>
                  <span className={cn("text-[10px] font-bold", sec.spreadVsSpy >= 0 ? "text-amber-400" : "text-cyan-300")}>
                    {sec.spreadVsSpy >= 0 ? '+' : ''}{sec.spreadVsSpy}% vs SPY
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </CardContent>

      {/* ================= EXTREME LEVEL SIGNALS INSPECTOR MODAL ================= */}
      <ExtremeSignalsModal
        isOpen={isExtremeModalOpen}
        onClose={() => setIsExtremeModalOpen(false)}
        volData={volData}
        onNavigateToResearch={onNavigateToResearch}
        onNavigateToGraphs={onNavigateToGraphs}
        onNavigateToTrades={onNavigateToTrades}
      />
    </Card>
  );
}
