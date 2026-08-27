import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
  Info,
  Radio,
  Sliders,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  VolatilityMacroData,
  VolatilitySignal,
  VolatilityTradeSetup,
} from '@/services/volatilityMacroService';
import { useCreateAlert } from '@/services/alertService';

interface ExtremeSignalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  volData: VolatilityMacroData | null;
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
  onNavigateToTrades?: () => void;
}

export function ExtremeSignalsModal({
  isOpen,
  onClose,
  volData,
  onNavigateToResearch,
  onNavigateToGraphs,
  onNavigateToTrades,
}: ExtremeSignalsModalProps) {
  const createAlertMutation = useCreateAlert();
  const [activeTab, setActiveTab] = useState<'ACTIVE_EXTREMES' | 'ALL_MONITORS'>('ACTIVE_EXTREMES');

  if (!volData) return null;

  const {
    regime,
    spotMetrics,
    termStructure,
    dispersion,
    activeSignals,
    hasExtremeSignals,
    extremeSignalsCount,
    analyzedAt,
  } = volData;

  // Filter signals with CRITICAL or HIGH severity as extreme signals
  const extremeSignals = activeSignals.filter(
    (s) => s.severity === 'CRITICAL' || s.severity === 'HIGH'
  );

  const handleArmSignalAlert = async (signal: VolatilitySignal) => {
    try {
      const targetSym = signal.recommendedTrade.targetAsset.includes('/')
        ? 'SPY'
        : signal.recommendedTrade.targetAsset;

      await createAlertMutation.mutateAsync({
        symbol: targetSym,
        targetPrice: spotMetrics.vix.current || 20,
        condition: signal.recommendedTrade.bias === 'BULLISH' ? 'BELOW' : 'ABOVE',
        note: `Macro Volatility Trigger: ${signal.title} (${signal.code}) active at ${signal.currentValue}.`,
      });
      toast.success(`Arm volatility signal alert set for ${targetSym}!`);
    } catch (err: any) {
      toast.error(`Failed to create alert: ${err.message}`);
    }
  };

  const handleExecuteTradeSetup = (trade: VolatilityTradeSetup) => {
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

    onClose();
    if (onNavigateToTrades) {
      onNavigateToTrades();
    } else {
      toast.success(`Pre-filled ${trade.strategyName} in Trade Command!`);
    }
  };

  // Monitored gauges definitions
  const MONITORED_GAUGES = [
    {
      name: 'Spot VIX Index',
      current: spotMetrics.vix.current.toFixed(2),
      normalRange: '12.00 - 20.00',
      extremeThreshold: '< 13.0 (Complacency) or > 25.0 (Panic)',
      percentile: spotMetrics.vix.percentile52w,
      isTriggered: spotMetrics.vix.current >= 25 || spotMetrics.vix.current <= 13.0,
      statusLabel:
        spotMetrics.vix.current >= 25
          ? '🚨 Extreme Panic Level'
          : spotMetrics.vix.current <= 13.0
          ? '⚡ Extreme Complacency'
          : '🟢 Normal Range',
      description: 'Standard 30-day S&P 500 implied volatility expectation.',
    },
    {
      name: 'VIX Term Structure (VX2 vs VX1)',
      current: `${termStructure.slopePercent >= 0 ? '+' : ''}${termStructure.slopePercent}% (${termStructure.structureType})`,
      normalRange: 'Contango (+2.0% to +10.0%)',
      extremeThreshold: 'Inverted Slope (< 0.0% Backwardation)',
      percentile: termStructure.structureType === 'BACKWARDATION' ? 95 : 40,
      isTriggered: termStructure.structureType === 'BACKWARDATION',
      statusLabel:
        termStructure.structureType === 'BACKWARDATION'
          ? '🚨 Acute Inversion (Liquidity Panic)'
          : '🟢 Standard Contango',
      description: 'Slope between front-month and second-month VIX futures.',
    },
    {
      name: 'CBOE SKEW Index',
      current: spotMetrics.skew.current.toFixed(1),
      normalRange: '115.0 - 135.0',
      extremeThreshold: '≥ 142.0 (Top 5% Historical Tail-Risk)',
      percentile: spotMetrics.skew.percentile52w,
      isTriggered: spotMetrics.skew.current >= 142.0,
      statusLabel:
        spotMetrics.skew.current >= 142.0
          ? '⚠️ Institutional Crash Hedging Spike'
          : '🟢 Normal Put/Call Pricing',
      description: 'Pricing of deep out-of-the-money black swan put options.',
    },
    {
      name: 'Stock Implied Correlation / Dispersion',
      current: `${spotMetrics.impliedCorrelation.current}% (Score: ${dispersion.stockDispersionScore}/100)`,
      normalRange: '35% - 55%',
      extremeThreshold: '< 25% (Extreme Decoupling) or > 70% (Systemic Panic)',
      percentile: dispersion.stockDispersionScore,
      isTriggered: spotMetrics.impliedCorrelation.current < 25 || spotMetrics.impliedCorrelation.current > 70,
      statusLabel:
        spotMetrics.impliedCorrelation.current < 25
          ? '✨ Golden Stock-Picker Dispersion'
          : spotMetrics.impliedCorrelation.current > 70
          ? '🚨 Systemic Index Lockstep'
          : '🟢 Normal Dispersion',
      description: 'Correlation of constituent equities versus the S&P 500 index.',
    },
    {
      name: 'Volatility Risk Premium (VRP: IV30 - RV20)',
      current: `+${spotMetrics.volatilityRiskPremium.vrpSpread.toFixed(1)} pts`,
      normalRange: '+1.5 to +4.5 pts',
      extremeThreshold: '< 0.0 pts (IV Underpricing / Short Squeeze Dislocation)',
      percentile: Math.min(100, Math.max(0, spotMetrics.volatilityRiskPremium.vrpSpread * 20)),
      isTriggered: spotMetrics.volatilityRiskPremium.vrpSpread < 0,
      statusLabel:
        spotMetrics.volatilityRiskPremium.vrpSpread < 0
          ? '⚠️ Inverted Vol Risk Premium'
          : '🟢 Positive Sellers Premium Edge',
      description: 'Spread between implied 30-day volatility and 20-day realized volatility.',
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[950px] w-[95vw] max-h-[90vh] bg-slate-950/95 border border-slate-800 text-foreground p-0 rounded-3xl overflow-hidden flex flex-col shadow-2xl backdrop-blur-2xl">
        {/* Ambient Top Glow Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-amber-400 to-cyan-500 shrink-0 animate-pulse" />

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-border/40 bg-accent/5 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/20 via-amber-500/20 to-primary/20 border border-rose-500/40 flex items-center justify-center font-mono font-black text-rose-400 shadow-inner">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-xl font-black font-mono tracking-tight text-foreground flex items-center gap-2">
                  <span>Macro Extreme Level Signals & Volatility Trigger Inspector</span>
                </DialogTitle>
                <Badge
                  className={cn(
                    "text-[10px] font-mono font-bold uppercase px-2 py-0.5",
                    hasExtremeSignals
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  )}
                >
                  {extremeSignals.length > 0
                    ? `🚨 ${extremeSignals.length} Extreme Triggers Firing`
                    : '✓ All Telemetry Within Bounds'}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Real-time quantitative alerts on CBOE SKEW spikes, VIX backwardation inversions, dispersion decouplings, and high-probability playbooks.
              </DialogDescription>
            </div>
          </div>

          {/* Quick Telemetry Pills */}
          <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
            <div className="px-2.5 py-1 rounded-xl bg-slate-900 border border-border/50">
              <span className="text-[10px] text-muted-foreground block">VIX Spot</span>
              <strong className="text-foreground">{spotMetrics.vix.current.toFixed(2)}</strong>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-slate-900 border border-border/50">
              <span className="text-[10px] text-muted-foreground block">CBOE SKEW</span>
              <strong className={cn(spotMetrics.skew.current >= 142 ? "text-amber-300" : "text-foreground")}>
                {spotMetrics.skew.current.toFixed(1)}
              </strong>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-slate-900 border border-border/50">
              <span className="text-[10px] text-muted-foreground block">Term Slope</span>
              <strong className={cn(termStructure.slopePercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {termStructure.slopePercent >= 0 ? '+' : ''}{termStructure.slopePercent}%
              </strong>
            </div>
          </div>
        </div>

        {/* View Mode Tabs: Active Extreme Triggers vs Monitored Threshold Matrix */}
        <div className="px-6 py-2.5 bg-slate-900/40 border-b border-border/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('ACTIVE_EXTREMES')}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border",
                activeTab === 'ACTIVE_EXTREMES'
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm"
                  : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground"
              )}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Active Extreme Triggers ({extremeSignals.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('ALL_MONITORS')}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border",
                activeTab === 'ALL_MONITORS'
                  ? "bg-primary/20 text-primary border-primary/50 shadow-sm"
                  : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground"
              )}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Monitored Volatility Thresholds ({MONITORED_GAUGES.length})</span>
            </button>
          </div>

          <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
            Telemetry Updated: {new Date(analyzedAt).toLocaleTimeString()}
          </span>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          {activeTab === 'ACTIVE_EXTREMES' ? (
            /* ================= VIEW 1: ACTIVE EXTREME SIGNALS BREAKDOWN ================= */
            extremeSignals.length === 0 ? (
              <div className="p-12 text-center space-y-3 border border-dashed border-border/40 rounded-2xl bg-card/20">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
                <h4 className="text-base font-bold text-foreground">No Extreme Level Volatility Signals Currently Active</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  All monitored macro volatility indicators (VIX term structure, CBOE SKEW, single-stock dispersion, and VRP) are operating within their standard statistical equilibrium bands.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('ALL_MONITORS')}
                  className="text-xs font-bold mt-2"
                >
                  View All Monitored Macro Thresholds
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
                    Currently Triggered Extreme Alerts ({extremeSignals.length})
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Actionable Quantitative Asymmetry
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {extremeSignals.map((signal) => {
                    const isCritical = signal.severity === 'CRITICAL';
                    const trade = signal.recommendedTrade;

                    return (
                      <div
                        key={signal.id}
                        className={cn(
                          "p-5 rounded-2xl border transition-all space-y-4 relative overflow-hidden shadow-lg",
                          isCritical
                            ? "border-rose-500/50 bg-gradient-to-br from-rose-950/30 via-slate-900/90 to-card"
                            : "border-amber-500/50 bg-gradient-to-br from-amber-950/30 via-slate-900/90 to-card"
                        )}
                      >
                        {/* Top Accent Line */}
                        <div
                          className={cn(
                            "absolute top-0 left-0 right-0 h-1",
                            isCritical ? "bg-rose-500 animate-pulse" : "bg-amber-400"
                          )}
                        />

                        {/* Signal Card Header */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pt-1">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                className={cn(
                                  "text-[10px] font-mono font-black uppercase px-2 py-0.5 shadow-sm",
                                  isCritical ? "bg-rose-500 text-white" : "bg-amber-500 text-black"
                                )}
                              >
                                {signal.severity} ALERT
                              </Badge>
                              <span className="text-[11px] font-mono font-bold text-muted-foreground">
                                Code: <b className="text-foreground">{signal.code}</b>
                              </span>
                            </div>
                            <h3 className="text-base sm:text-lg font-black text-foreground pt-1 flex items-center gap-2">
                              <span>{signal.title}</span>
                            </h3>
                          </div>

                          {/* Trigger Metric Badge */}
                          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-border/60 text-right font-mono self-start shrink-0">
                            <span className="text-[10px] text-muted-foreground block uppercase font-sans">Trigger Metric</span>
                            <span className="text-sm font-black text-foreground">{signal.metric}</span>
                            <div className="text-[11px] font-bold text-primary">{signal.currentValue}</div>
                            <span className="text-[9.5px] text-muted-foreground block">Threshold: {signal.threshold}</span>
                          </div>
                        </div>

                        {/* Description & Implication Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 rounded-xl bg-card/60 border border-border/40 space-y-1">
                            <span className="font-bold text-foreground flex items-center gap-1">
                              <Info className="w-3.5 h-3.5 text-cyan-400" />
                              Why This Extreme Signal Fired:
                            </span>
                            <p className="text-muted-foreground leading-relaxed text-[11.5px]">
                              {signal.description}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-card/60 border border-border/40 space-y-1">
                            <span className="font-bold text-amber-300 flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5 text-amber-400" />
                              Macro & Institutional Implication:
                            </span>
                            <p className="text-muted-foreground leading-relaxed text-[11.5px]">
                              {signal.implication}
                            </p>
                          </div>
                        </div>

                        {/* Recommended Trade Playbook Box */}
                        <div className="p-4 rounded-xl bg-slate-950/80 border border-border/60 space-y-3 font-mono text-xs">
                          <div className="flex items-center justify-between border-b border-border/40 pb-2.5 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                className={cn(
                                  "text-[10px] font-bold uppercase px-2 py-0.5",
                                  trade.bias === 'BULLISH'
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : trade.bias === 'BEARISH'
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                    : trade.bias === 'LONG_VOLATILITY'
                                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                    : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                )}
                              >
                                {trade.bias.replace(/_/g, ' ')}
                              </Badge>
                              <span className="font-bold text-sm text-foreground">{trade.strategyName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-primary font-mono">
                                Target Asset: [{trade.targetAsset}]
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] font-sans">
                            <div className="p-2 rounded-lg bg-card/40 border border-border/30">
                              <span className="text-muted-foreground block text-[10px] uppercase font-mono">Construction</span>
                              <strong className="text-foreground text-xs">{trade.tradeConstruction}</strong>
                            </div>
                            <div className="p-2 rounded-lg bg-card/40 border border-border/30">
                              <span className="text-muted-foreground block text-[10px] uppercase font-mono">Entry Trigger</span>
                              <strong className="text-foreground text-xs">{trade.entryTrigger}</strong>
                            </div>
                            <div className="p-2 rounded-lg bg-card/40 border border-border/30">
                              <span className="text-muted-foreground block text-[10px] uppercase font-mono">Target Profit / Stop</span>
                              <span className="text-emerald-400 font-mono font-bold text-xs">{trade.targetProfit}</span>
                              <span className="text-muted-foreground text-[10.5px] block">Stop: {trade.invalidationStop}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-primary/90 font-mono pt-1">
                            <span>★ Historical Reliability: <b>{trade.historicalWinRate}</b></span>
                            <span className="text-[10px] text-muted-foreground font-sans">
                              Triggered: {new Date(signal.triggeredAt).toLocaleTimeString()}
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2.5 pt-2 border-t border-border/40 flex-wrap">
                            <Button
                              size="sm"
                              onClick={() => handleExecuteTradeSetup(trade)}
                              className="h-8 text-xs font-bold gap-1.5 bg-gradient-to-r from-primary via-cyan-600 to-purple-600 hover:opacity-90 text-white shadow-md shadow-primary/20"
                            >
                              <Compass className="w-3.5 h-3.5" />
                              <span>Log Setup in Trade Command</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleArmSignalAlert(signal)}
                              className="h-8 text-xs font-bold gap-1.5 border-border/60 hover:bg-accent/40"
                            >
                              <Bell className="w-3.5 h-3.5 text-amber-400" />
                              <span>Arm Signal Alert</span>
                            </Button>

                            {onNavigateToGraphs && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  onClose();
                                  const sym = trade.targetAsset.includes('/')
                                    ? 'SPY'
                                    : trade.targetAsset;
                                  onNavigateToGraphs(sym);
                                }}
                                className="h-8 text-xs font-bold gap-1 text-cyan-300 hover:bg-cyan-500/20"
                              >
                                <LineChart className="w-3.5 h-3.5" />
                                <span>Chart {trade.targetAsset}</span>
                              </Button>
                            )}

                            {onNavigateToResearch && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  onClose();
                                  const sym = trade.targetAsset.includes('/')
                                    ? 'SPY'
                                    : trade.targetAsset;
                                  onNavigateToResearch(sym);
                                }}
                                className="h-8 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Research Asset</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ) : (
            /* ================= VIEW 2: ALL MONITORED MACRO VOLATILITY THRESHOLDS ================= */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-primary" />
                  Macro Volatility Telemetry & Surveillance Radar ({MONITORED_GAUGES.length} Metrics)
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Continuous Automated Scanning
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {MONITORED_GAUGES.map((gauge, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-4 rounded-2xl border transition-all space-y-2 bg-card/60 shadow-sm",
                      gauge.isTriggered
                        ? "border-rose-500/50 bg-rose-950/20 ring-1 ring-rose-500/30"
                        : "border-border/50 hover:border-border/80"
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{gauge.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-mono font-bold px-1.5 py-0.2 border",
                            gauge.isTriggered
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                              : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          )}
                        >
                          {gauge.statusLabel}
                        </Badge>
                      </div>

                      <div className="font-mono text-xs text-right">
                        <span className="text-muted-foreground text-[10px] mr-1.5">Current:</span>
                        <strong className={cn("text-base font-black", gauge.isTriggered ? "text-rose-400" : "text-emerald-400")}>
                          {gauge.current}
                        </strong>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">{gauge.description}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-border/30">
                      <div>
                        <span className="text-muted-foreground">Normal Baseline: </span>
                        <strong className="text-foreground">{gauge.normalRange}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Extreme Alert Trigger: </span>
                        <strong className="text-amber-300">{gauge.extremeThreshold}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-border/40 bg-accent/5 flex items-center justify-between text-xs font-mono text-muted-foreground shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span>Macro Volatility Guard Active</span>
          </div>

          <Button
            size="sm"
            onClick={onClose}
            className="h-8 px-4 rounded-xl text-xs font-bold"
          >
            Close Inspector
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
