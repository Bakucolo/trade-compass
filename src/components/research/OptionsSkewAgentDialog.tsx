import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Scale,
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertTriangle,
  RotateCw,
  Activity,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Target,
  BarChart2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useOptionsSkewAnalysis,
  OptionsSkewAgentResponse,
  EquidistantStrikePair,
  OptimalSkewStrategy,
} from '@/services/optionsChainService';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';

interface OptionsSkewAgentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  selectedExpiration?: string;
}

export function OptionsSkewAgentDialog({
  isOpen,
  onClose,
  symbol,
  selectedExpiration,
}: OptionsSkewAgentDialogProps) {
  const {
    data: skewData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useOptionsSkewAnalysis(symbol, selectedExpiration, { enabled: isOpen });

  const metrics = skewData?.metrics;
  const directAnswers = skewData?.directAnswers;
  const pairs = skewData?.equidistantPairs || [];
  const synthesis = skewData?.agentSynthesis;

  // Prepare chart data for Volatility Smile / Skew
  const chartData = React.useMemo(() => {
    if (!pairs || pairs.length === 0) return [];
    
    // Sort all unique strikes from puts and calls
    const strikePoints: { strike: number; callIv?: number; putIv?: number; isSpot?: boolean }[] = [];
    
    pairs.forEach((p) => {
      strikePoints.push({
        strike: p.putStrike,
        putIv: p.putImpliedVol,
      });
      strikePoints.push({
        strike: p.callStrike,
        callIv: p.callImpliedVol,
      });
    });

    return strikePoints.sort((a, b) => a.strike - b.strike);
  }, [pairs]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-950/95 border-purple-500/30 shadow-2xl backdrop-blur-2xl">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-border/40 bg-gradient-to-r from-purple-950/40 via-slate-950 to-indigo-950/30 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                  Options Volatility Skew & Upside Bias Agent
                </Badge>
                {metrics && (
                  <>
                    <Badge variant="outline" className="text-[10px] font-mono border-slate-700 bg-slate-900/60 text-foreground">
                      {metrics.selectedExpiration} ({metrics.selectedDte}d DTE)
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-mono border-purple-500/30 bg-purple-500/10 text-purple-200">
                      ATM IV: {metrics.atmIv}%
                    </Badge>
                  </>
                )}
                {synthesis && (
                  <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground border-border/50">
                    {synthesis.source === 'LLM_AGENT' ? '🤖 Multi-Tier LLM Agent' : '⚡ Deterministic Quant Engine'}
                  </Badge>
                )}
              </div>

              <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2 pt-1">
                <Scale className="w-5 h-5 text-purple-400" />
                <span>{symbol} Options Skew Analysis</span>
                {metrics && (
                  <span className="text-base font-mono font-bold text-muted-foreground">
                    ${metrics.spotPrice.toFixed(2)}
                  </span>
                )}
              </DialogTitle>

              <DialogDescription className="text-xs text-muted-foreground">
                Analyzing strike equidistance, 25-Delta risk reversals, volatility smile curvature, and institutional upside vs downside expectations.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-8 text-xs font-mono font-bold gap-1.5 border-border/60 hover:border-purple-500/50"
                title="Refresh Skew Analysis"
              >
                <RotateCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin text-purple-400")} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar space-y-6 flex-1 text-foreground">
          {/* Loading State */}
          {isLoading && !skewData && (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <Activity className="w-8 h-8 text-purple-400 animate-spin" />
              <p className="text-sm font-semibold text-muted-foreground font-mono animate-pulse">
                Evaluating 25-Delta Risk Reversal, Equidistant Strikes & Implied Probability Distribution for {symbol}...
              </p>
            </div>
          )}

          {/* Error State */}
          {isError && !skewData && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
              <h4 className="text-sm font-bold">Failed to Analyze Options Skew</h4>
              <p className="text-xs text-muted-foreground max-w-md font-mono">
                {error instanceof Error ? error.message : `Could not compute derivatives skew for ${symbol}.`}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs mt-2">
                Retry Analysis
              </Button>
            </div>
          )}

          {/* Loaded Content */}
          {skewData && metrics && directAnswers && (
            <>
              {/* ================= 1. DUAL HERO DIRECT-ANSWER CARDS ================= */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Question 1: Are puts and calls equidistant? */}
                <div
                  className={cn(
                    "p-4 rounded-2xl border backdrop-blur-md relative overflow-hidden transition-all shadow-md flex flex-col justify-between",
                    metrics.arePutsAndCallsEquidistant
                      ? "bg-cyan-950/20 border-cyan-500/40"
                      : metrics.equidistanceVerdict === 'CALL_SKEWED_UPSIDE_HEAVY'
                      ? "bg-emerald-950/20 border-emerald-500/40"
                      : "bg-rose-950/20 border-rose-500/40"
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-purple-400" />
                        1. Are Puts & Calls Equidistant?
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono font-black px-2 py-0.5 border",
                          metrics.arePutsAndCallsEquidistant
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                            : metrics.equidistanceVerdict === 'CALL_SKEWED_UPSIDE_HEAVY'
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                            : "bg-rose-500/20 text-rose-300 border-rose-500/50"
                        )}
                      >
                        {directAnswers.arePutsAndCallsEquidistant.badgeText}
                      </Badge>
                    </div>

                    <h4 className="text-sm font-black text-foreground">
                      {directAnswers.arePutsAndCallsEquidistant.headline}
                    </h4>

                    <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                      {directAnswers.arePutsAndCallsEquidistant.explanation}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/30 flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Average IV Disparity:</span>
                    <span
                      className={cn(
                        "font-black",
                        metrics.averageIvSkewDiff > 0 ? "text-emerald-300" : "text-rose-300"
                      )}
                    >
                      {metrics.averageIvSkewDiff > 0 ? '+' : ''}
                      {metrics.averageIvSkewDiff}% (Call IV vs Put IV)
                    </span>
                  </div>
                </div>

                {/* Question 2: Are options implying a stock upside? */}
                <div
                  className={cn(
                    "p-4 rounded-2xl border backdrop-blur-md relative overflow-hidden transition-all shadow-md flex flex-col justify-between",
                    metrics.isImplyingUpside
                      ? "bg-emerald-950/20 border-emerald-500/40"
                      : metrics.impliedDirectionalBias === 'BEARISH_DOWNSIDE_HEDGE'
                      ? "bg-amber-950/20 border-amber-500/40"
                      : "bg-purple-950/20 border-purple-500/40"
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        2. Are Options Implying Upside?
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono font-black px-2 py-0.5 border",
                          metrics.isImplyingUpside
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                            : metrics.impliedDirectionalBias === 'BEARISH_DOWNSIDE_HEDGE'
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                            : "bg-purple-500/20 text-purple-300 border-purple-500/50"
                        )}
                      >
                        {directAnswers.areOptionsImplyingUpside.badgeText}
                      </Badge>
                    </div>

                    <h4 className="text-sm font-black text-foreground">
                      {directAnswers.areOptionsImplyingUpside.headline}
                    </h4>

                    <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                      {directAnswers.areOptionsImplyingUpside.explanation}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/30 flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Directional Bias Score:</span>
                    <span
                      className={cn(
                        "font-black flex items-center gap-1",
                        metrics.isImplyingUpside
                          ? "text-emerald-300"
                          : metrics.impliedDirectionalBias === 'BEARISH_DOWNSIDE_HEDGE'
                          ? "text-rose-300"
                          : "text-purple-300"
                      )}
                    >
                      {metrics.directionalConfidenceScore}/100
                      <span className="text-[10px] text-muted-foreground font-normal">
                        ({metrics.impliedDirectionalBias.replace(/_/g, ' ')})
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* ================= 2. DERIVATIVES VOLATILITY SKEW TELEMETRY STRIP ================= */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                {/* 25-Delta Risk Reversal */}
                <div className="bg-card/70 p-3 rounded-xl border border-border/60 shadow-sm space-y-1">
                  <span className="text-[9px] uppercase font-sans font-bold text-muted-foreground block">
                    25-Delta Risk Reversal
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span
                      className={cn(
                        "text-base font-black",
                        metrics.delta25RiskReversal > 0
                          ? "text-emerald-300"
                          : metrics.delta25RiskReversal < -4
                          ? "text-rose-300"
                          : "text-purple-300"
                      )}
                    >
                      {metrics.delta25RiskReversal > 0 ? '+' : ''}
                      {metrics.delta25RiskReversal}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {metrics.delta25RiskReversal > 0 ? 'Call Skew' : 'Put Skew'}
                    </span>
                  </div>
                  <span className="text-[9px] text-muted-foreground block leading-tight">
                    Call {metrics.delta25CallIv}% vs Put {metrics.delta25PutIv}%
                  </span>
                </div>

                {/* 10-Delta Tail Skew */}
                <div className="bg-card/70 p-3 rounded-xl border border-border/60 shadow-sm space-y-1">
                  <span className="text-[9px] uppercase font-sans font-bold text-muted-foreground block">
                    10-Delta Tail Skew
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span
                      className={cn(
                        "text-base font-black",
                        metrics.delta10TailSkew > 0 ? "text-emerald-300" : "text-amber-300"
                      )}
                    >
                      {metrics.delta10TailSkew > 0 ? '+' : ''}
                      {metrics.delta10TailSkew}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">Deep Wings</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground block leading-tight">
                    Call {metrics.delta10CallIv}% vs Put {metrics.delta10PutIv}%
                  </span>
                </div>

                {/* Butterfly Smile Curvature */}
                <div className="bg-card/70 p-3 rounded-xl border border-border/60 shadow-sm space-y-1">
                  <span className="text-[9px] uppercase font-sans font-bold text-muted-foreground block">
                    Smile Curvature (Fly)
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-black text-cyan-300">
                      {metrics.butterfly25Delta > 0 ? '+' : ''}
                      {metrics.butterfly25Delta}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">Kurtosis</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground block leading-tight">
                    {metrics.butterfly25Delta > 0 ? 'Wings elevated over ATM' : 'Flat smile profile'}
                  </span>
                </div>

                {/* Skew Regime */}
                <div className="bg-card/70 p-3 rounded-xl border border-border/60 shadow-sm space-y-1">
                  <span className="text-[9px] uppercase font-sans font-bold text-muted-foreground block">
                    Skew Regime
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-black text-primary truncate" title={metrics.skewRegime}>
                      {metrics.skewRegime.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-[9px] text-muted-foreground block leading-tight">
                    Max Pain: ${metrics.maxPainStrike} ({metrics.maxPainDistancePercent >= 0 ? '+' : ''}{metrics.maxPainDistancePercent.toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* ================= 3. EQUIDISTANT STRIKE COMPARISON MATRIX TABLE ================= */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                    <Scale className="w-4 h-4 text-purple-400" />
                    <span>Equidistant Strike Pairs Matrix (Distance from Spot ${metrics.spotPrice.toFixed(2)})</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Compares Call IV vs Put IV at equidistant dollar distance
                  </span>
                </div>

                <div className="rounded-xl border border-border/70 overflow-hidden bg-card/40">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono border-collapse">
                      <thead>
                        <tr className="bg-slate-900/90 text-muted-foreground border-b border-border/50 text-[10px] uppercase font-sans tracking-wider">
                          <th className="p-2.5 text-left">Offset</th>
                          <th className="p-2.5 text-right bg-rose-950/20 text-rose-300">Put Strike</th>
                          <th className="p-2.5 text-right bg-rose-950/20 text-rose-300">Put IV</th>
                          <th className="p-2.5 text-right bg-rose-950/20 text-rose-300">Put Mid</th>
                          <th className="p-2.5 text-center bg-slate-950 text-foreground font-black">
                            IV Skew Spread (C - P)
                          </th>
                          <th className="p-2.5 text-left bg-emerald-950/20 text-emerald-300">Call Mid</th>
                          <th className="p-2.5 text-left bg-emerald-950/20 text-emerald-300">Call IV</th>
                          <th className="p-2.5 text-left bg-emerald-950/20 text-emerald-300">Call Strike</th>
                          <th className="p-2.5 text-left">Skew Asymmetry</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {pairs.map((p) => {
                          const isCallHigher = p.ivSkewDiff > 1.0;
                          const isPutHigher = p.ivSkewDiff < -1.0;

                          return (
                            <tr key={p.targetDistancePercent} className="hover:bg-accent/20 transition-colors">
                              <td className="p-2.5 font-bold text-foreground">
                                ±{p.targetDistancePercent}%
                              </td>
                              <td className="p-2.5 text-right font-black text-rose-300 bg-rose-950/10">
                                ${p.putStrike} ({p.putActualDistancePercent}%)
                              </td>
                              <td className="p-2.5 text-right font-bold text-rose-200 bg-rose-950/10">
                                {p.putImpliedVol}%
                              </td>
                              <td className="p-2.5 text-right text-muted-foreground bg-rose-950/10">
                                ${p.putMidPrice.toFixed(2)}
                              </td>
                              <td className="p-2.5 text-center bg-slate-950 font-bold">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "font-mono text-[10px] px-2 py-0.5 border",
                                    isCallHigher
                                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                                      : isPutHigher
                                      ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
                                      : "bg-slate-800 text-slate-300 border-slate-700"
                                  )}
                                >
                                  {p.ivSkewDiff > 0 ? '+' : ''}
                                  {p.ivSkewDiff.toFixed(1)}% IV
                                </Badge>
                              </td>
                              <td className="p-2.5 text-left text-muted-foreground bg-emerald-950/10">
                                ${p.callMidPrice.toFixed(2)}
                              </td>
                              <td className="p-2.5 text-left font-bold text-emerald-200 bg-emerald-950/10">
                                {p.callImpliedVol}%
                              </td>
                              <td className="p-2.5 text-left font-black text-emerald-300 bg-emerald-950/10">
                                ${p.callStrike} (+{p.callActualDistancePercent}%)
                              </td>
                              <td className="p-2.5 text-[11px] text-muted-foreground font-sans">
                                {p.skewDescription}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ================= 4. AI AGENT SYNTHESIS & STRATEGY PLAYBOOK ================= */}
              {synthesis && (
                <div className="space-y-4">
                  {/* Synthesis Narrative */}
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-purple-500/30 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-border/30 pb-2">
                      <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        Institutional Skew Assessment & Flow Dynamics
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        Agent Playbook
                      </span>
                    </div>

                    <p className="text-xs text-foreground/90 font-sans leading-relaxed">
                      {synthesis.executiveSummary}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs font-sans text-muted-foreground border-t border-border/20">
                      <div>
                        <b className="text-foreground block mb-0.5">Volatility Smile & Curve:</b>
                        {synthesis.volatilitySmileAnalysis}
                      </div>
                      <div>
                        <b className="text-foreground block mb-0.5">Institutional Tail Risk:</b>
                        {synthesis.institutionalTailRisk}
                      </div>
                    </div>
                  </div>

                  {/* Optimal Derivatives Strategies for this Skew */}
                  {synthesis.optimalDerivativesStrategies && synthesis.optimalDerivativesStrategies.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span>Tactical Derivatives Strategies to Exploit This Skew</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-sans">
                        {synthesis.optimalDerivativesStrategies.map((strat, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-card/60 border border-border/60 hover:border-purple-500/40 transition-all space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-foreground">{strat.strategyName}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] font-mono font-bold uppercase",
                                  strat.category === 'BULLISH'
                                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                                    : strat.category === 'NEUTRAL_INCOME'
                                    ? "bg-purple-500/15 text-purple-300 border-purple-500/40"
                                    : "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
                                )}
                              >
                                {strat.actionVerdict}
                              </Badge>
                            </div>

                            <p className="text-[11.5px] text-muted-foreground leading-snug">
                              {strat.rationale}
                            </p>

                            <div className="pt-2 border-t border-border/30 text-[11px] font-mono space-y-1">
                              <div>
                                <span className="text-muted-foreground">Setup: </span>
                                <span className="text-foreground font-bold">{strat.suggestedSetup}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Skew Edge: </span>
                                <span className="text-purple-300">{strat.skewEdge}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Catalysts & Key Risks */}
                  {synthesis.catalystsAndRisks && synthesis.catalystsAndRisks.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-900/40 border border-border/40 text-xs space-y-1.5">
                      <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-primary" /> Key Catalysts & Skew Shift Triggers
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11.5px]">
                        {synthesis.catalystsAndRisks.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
