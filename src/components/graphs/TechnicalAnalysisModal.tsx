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
import { Card } from '@/components/ui/card';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Compass,
  Crosshair,
  Layers,
  Bell,
  BellPlus,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
  Target,
  BarChart2,
  Maximize2
} from 'lucide-react';
import {
  useTechnicalAnalysis,
  getStageColor,
  getTrendBadge,
  getVerdictBadge,
  SupportResistanceLevel,
  Timeframe,
  LevelType
} from '@/services/technicalAnalysisService';
import { cn } from '@/lib/utils';

interface TechnicalAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  onSetAlert?: (price: number, condition: 'ABOVE' | 'BELOW', noteLabel?: string) => void;
  onNavigateToResearch?: (symbol: string) => void;
}

type ActiveTab = 'PHASE' | 'LEVELS' | 'TREND' | 'OSCILLATORS';
type LevelFilter = 'ALL' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PIVOTS' | 'FIBONACCI';

export function TechnicalAnalysisModal({
  isOpen,
  onClose,
  symbol,
  onSetAlert,
  onNavigateToResearch,
}: TechnicalAnalysisModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('PHASE');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('ALL');

  const {
    data: analysis,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useTechnicalAnalysis(isOpen ? symbol : undefined);

  if (!isOpen) return null;

  const stageColor = analysis ? getStageColor(analysis.marketPhase.stage) : null;
  const trendBadge = analysis ? getTrendBadge(analysis.trend.primaryTrend) : null;
  const verdictBadge = analysis ? getVerdictBadge(analysis.blueprint.verdict) : null;

  // Filter levels based on selected filter
  const filteredLevels = analysis
    ? analysis.levels.filter((lvl) => {
        if (levelFilter === 'ALL') return true;
        if (levelFilter === 'DAILY') return lvl.timeframe === 'DAILY';
        if (levelFilter === 'WEEKLY') return lvl.timeframe === 'WEEKLY';
        if (levelFilter === 'MONTHLY') return lvl.timeframe === 'MONTHLY';
        return true;
      })
    : [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-slate-950/95 border-slate-800 backdrop-blur-2xl p-0 gap-0 text-slate-100 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{symbol.toUpperCase()} Technical Analysis</DialogTitle>
          <DialogDescription>
            Multi-timeframe Support and Resistance, Wyckoff Market Phase, and Technical State for {symbol}.
          </DialogDescription>
        </DialogHeader>

        {/* ================= MODAL HEADER ================= */}
        <div className="p-6 border-b border-border/40 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 sticky top-0 z-20 backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <Activity className="w-6 h-6 text-cyan-400 animate-pulse" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-black tracking-tight font-mono text-white">
                    {symbol.toUpperCase()}
                  </h2>
                  <span className="text-sm text-muted-foreground font-medium truncate max-w-[200px] sm:max-w-xs">
                    {analysis?.name || 'Technical Breakdown'}
                  </span>

                  {/* Stage Pill */}
                  {analysis && stageColor && (
                    <Badge className={cn("text-xs font-bold px-2.5 py-0.5 border shadow-sm", stageColor.badge)}>
                      ⚡ {analysis.marketPhase.stageName}
                    </Badge>
                  )}

                  {/* Primary Trend Pill */}
                  {analysis && trendBadge && (
                    <Badge className={cn("text-xs font-bold px-2.5 py-0.5 border", trendBadge.color)}>
                      {trendBadge.label} Trend
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1 text-xs">
                  {analysis && (
                    <>
                      <span className="font-mono font-bold text-base text-foreground">
                        ${analysis.currentPrice.toFixed(2)}
                      </span>
                      <span
                        className={cn(
                          "font-mono font-bold flex items-center",
                          analysis.dayChange >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {analysis.dayChange >= 0 ? '+' : ''}
                        {analysis.dayChange.toFixed(2)} ({analysis.dayChangePercent >= 0 ? '+' : ''}
                        {analysis.dayChangePercent}%)
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground text-[11px]">
                        As of: {new Date(analysis.asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Top Right Header Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-8 px-2.5 text-xs font-semibold border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300"
                title="Refresh real-time technical analysis"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 mr-1 text-primary", isFetching && "animate-spin")} />
                Refresh
              </Button>

              {onNavigateToResearch && (
                <Button
                  size="sm"
                  onClick={() => {
                    onClose();
                    onNavigateToResearch(symbol);
                  }}
                  className="h-8 px-3 text-xs font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-300" />
                  Research
                </Button>
              )}
            </div>
          </div>

          {/* Quick HUD Metrics Bar */}
          {analysis && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-border/30 text-xs">
              {/* Immediate Resistance */}
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
                <span className="text-[11px] text-rose-300/80 font-semibold flex items-center justify-between">
                  <span>Immediate Resistance</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="font-mono font-bold text-sm text-white">
                    {analysis.immediateResistance ? `$${analysis.immediateResistance.price.toFixed(2)}` : 'At All-Time Highs'}
                  </span>
                  {analysis.immediateResistance && (
                    <span className="font-mono font-semibold text-[11px] text-rose-400">
                      +{analysis.immediateResistance.distancePercent}%
                    </span>
                  )}
                </div>
              </div>

              {/* Immediate Support */}
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
                <span className="text-[11px] text-emerald-300/80 font-semibold flex items-center justify-between">
                  <span>Immediate Support</span>
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="font-mono font-bold text-sm text-white">
                    {analysis.immediateSupport ? `$${analysis.immediateSupport.price.toFixed(2)}` : 'N/A'}
                  </span>
                  {analysis.immediateSupport && (
                    <span className="font-mono font-semibold text-[11px] text-emerald-400">
                      {analysis.immediateSupport.distancePercent}%
                    </span>
                  )}
                </div>
              </div>

              {/* Dynamic Trend (20 EMA / 50 SMA) */}
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
                <span className="text-[11px] text-cyan-300/80 font-semibold flex items-center justify-between">
                  <span>Dynamic Support (20 EMA)</span>
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="font-mono font-bold text-sm text-white">
                    ${analysis.movingAverages.dma20.toFixed(2)}
                  </span>
                  <span
                    className={cn(
                      "font-mono font-semibold text-[11px]",
                      analysis.movingAverages.dma20DistPct >= 0 ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {analysis.movingAverages.dma20DistPct >= 0 ? '+' : ''}
                    {analysis.movingAverages.dma20DistPct}%
                  </span>
                </div>
              </div>

              {/* Strategic Stance */}
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
                <span className="text-[11px] text-amber-300/80 font-semibold flex items-center justify-between">
                  <span>Strategic Playbook</span>
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="font-bold text-xs text-amber-300 truncate">
                    {analysis.blueprint.verdictTitle}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    R:R 1:{analysis.blueprint.riskRewardRatio}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 mt-4 pt-1 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('PHASE')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0",
                activeTab === 'PHASE'
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800"
              )}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>State & Phase Diagnosis</span>
            </button>

            <button
              onClick={() => setActiveTab('LEVELS')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0",
                activeTab === 'LEVELS'
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800"
              )}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Support & Resistance ({analysis?.levels.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('TREND')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0",
                activeTab === 'TREND'
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800"
              )}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Moving Averages & Trend</span>
            </button>

            <button
              onClick={() => setActiveTab('OSCILLATORS')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0",
                activeTab === 'OSCILLATORS'
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800"
              )}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Oscillators & Volatility</span>
            </button>
          </div>
        </div>

        {/* ================= MODAL BODY CONTENT ================= */}
        <div className="p-6 space-y-6">
          {isLoading && (
            <div className="py-24 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-sm font-semibold text-slate-300">
                Calculating multi-timeframe support/resistance and market phase for {symbol}...
              </p>
              <p className="text-xs text-muted-foreground">
                Analyzing daily, weekly, and monthly candles, moving average stacks, and Wyckoff cycle stages.
              </p>
            </div>
          )}

          {isError && (
            <div className="py-16 text-center space-y-3 p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30">
              <ShieldAlert className="w-10 h-10 mx-auto text-rose-400" />
              <h3 className="text-base font-bold text-rose-300">Technical Analysis Unavailable</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {(error as Error)?.message || 'Failed to compute technical indicators for this ticker.'}
              </p>
              <Button size="sm" variant="outline" onClick={() => refetch()} className="text-xs">
                Try Again
              </Button>
            </div>
          )}

          {analysis && !isLoading && (
            <>
              {/* ================= TAB 1: STATE & MARKET PHASE DIAGNOSIS ================= */}
              {activeTab === 'PHASE' && (
                <div className="space-y-6">
                  {/* Stan Weinstein 4-Stage Visual Status Card */}
                  <div className={cn("p-5 rounded-2xl border bg-gradient-to-br backdrop-blur-xl shadow-xl space-y-4", stageColor?.bg, stageColor?.border)}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                            Current Market Phase (Stan Weinstein Stage Analysis)
                          </span>
                          <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] px-1.5 py-0">
                            Confidence: {analysis.marketPhase.confidenceScore}%
                          </Badge>
                        </div>
                        <h3 className="text-xl font-black text-white mt-1">
                          {analysis.marketPhase.stageName}
                        </h3>
                        <p className="text-xs font-semibold text-cyan-300 mt-0.5">
                          Sub-Phase: {analysis.marketPhase.subPhaseName} • Estimated Duration: {analysis.marketPhase.phaseAgeEstimate}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={cn("px-3 py-1 text-xs font-bold border shadow-sm", verdictBadge?.color)}>
                          Action: {analysis.blueprint.verdictTitle}
                        </Badge>
                      </div>
                    </div>

                    {/* 4 Stages Progress Bar */}
                    <div className="grid grid-cols-4 gap-2 pt-2">
                      {[
                        { key: 'STAGE_1_ACCUMULATION', label: '1. Accumulation / Base', desc: 'Bottoming' },
                        { key: 'STAGE_2_MARKUP', label: '2. Markup / Uptrend', desc: 'Bullish Momentum' },
                        { key: 'STAGE_3_DISTRIBUTION', label: '3. Distribution / Top', desc: 'Topping Risk' },
                        { key: 'STAGE_4_MARKDOWN', label: '4. Markdown / Decline', desc: 'Bearish Trend' },
                      ].map((st) => {
                        const isCurrent = analysis.marketPhase.stage === st.key;
                        return (
                          <div
                            key={st.key}
                            className={cn(
                              "p-2.5 rounded-xl border text-center transition-all",
                              isCurrent
                                ? "bg-primary/20 border-primary shadow-md ring-1 ring-primary/50 text-white font-bold"
                                : "bg-slate-900/50 border-slate-800/80 text-muted-foreground"
                            )}
                          >
                            <span className="text-[11px] block font-bold truncate">
                              {isCurrent && '⚡ '}
                              {st.label}
                            </span>
                            <span className="text-[9px] block mt-0.5 opacity-80">
                              {st.desc}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Diagnostic Narrative */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-2 text-xs">
                      <p className="text-slate-200 leading-relaxed font-medium">
                        {analysis.marketPhase.summary}
                      </p>
                      <p className="text-slate-400 leading-relaxed pt-1">
                        {analysis.marketPhase.diagnosticDetails}
                      </p>
                    </div>

                    {/* Key Observed Characteristics */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                        Key Structural Footprints:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {analysis.marketPhase.keyCharacteristics.map((char, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{char}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Multi-Timeframe Trend Alignment Matrix */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Short Term */}
                    <Card className="p-4 bg-slate-900/70 border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase">Short-Term (1-20 Days)</span>
                        <Badge className={getTrendBadge(analysis.trend.shortTerm.direction).color}>
                          {analysis.trend.shortTerm.direction}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold text-white">
                        {analysis.trend.shortTerm.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        20 EMA: ${analysis.movingAverages.dma20.toFixed(2)} ({analysis.movingAverages.dma20DistPct >= 0 ? '+' : ''}{analysis.movingAverages.dma20DistPct}%)
                      </p>
                    </Card>

                    {/* Medium Term */}
                    <Card className="p-4 bg-slate-900/70 border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase">Medium-Term (1-6 Months)</span>
                        <Badge className={getTrendBadge(analysis.trend.mediumTerm.direction).color}>
                          {analysis.trend.mediumTerm.direction}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold text-white">
                        {analysis.trend.mediumTerm.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        50 SMA: ${analysis.movingAverages.dma50.toFixed(2)} ({analysis.movingAverages.dma50DistPct >= 0 ? '+' : ''}{analysis.movingAverages.dma50DistPct}%)
                      </p>
                    </Card>

                    {/* Long Term */}
                    <Card className="p-4 bg-slate-900/70 border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase">Long-Term (Macro 200D)</span>
                        <Badge className={getTrendBadge(analysis.trend.longTerm.direction).color}>
                          {analysis.trend.longTerm.direction}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold text-white">
                        {analysis.trend.longTerm.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        200 SMA: ${analysis.movingAverages.dma200.toFixed(2)} ({analysis.movingAverages.dma200DistPct >= 0 ? '+' : ''}{analysis.movingAverages.dma200DistPct}%)
                      </p>
                    </Card>
                  </div>

                  {/* Actionable Trade Strategy & Risk-Reward Blueprint */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-amber-400" />
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                          Strategic Trading Blueprint & Key Zones
                        </h4>
                      </div>
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono">
                        Risk/Reward: 1 : {analysis.blueprint.riskRewardRatio}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-300 font-medium leading-relaxed">
                      {analysis.blueprint.playbookGuidance}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                      {/* Entry Zone */}
                      <div className="p-3 rounded-xl bg-slate-950/70 border border-cyan-500/30 space-y-1">
                        <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider">
                          🎯 Ideal Entry Zone
                        </span>
                        <p className="font-mono font-bold text-sm text-cyan-200">
                          ${analysis.blueprint.idealEntryZone.low.toFixed(2)} – ${analysis.blueprint.idealEntryZone.high.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {analysis.blueprint.idealEntryZone.rationale}
                        </p>
                      </div>

                      {/* Invalidation Stop */}
                      <div className="p-3 rounded-xl bg-slate-950/70 border border-rose-500/30 space-y-1">
                        <span className="text-[10px] text-rose-300 font-bold uppercase tracking-wider">
                          🛑 Invalidation / Stop Level
                        </span>
                        <p className="font-mono font-bold text-sm text-rose-200">
                          ${analysis.blueprint.invalidationStop.price.toFixed(2)} ({analysis.blueprint.invalidationStop.distancePct}%)
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {analysis.blueprint.invalidationStop.rationale}
                        </p>
                      </div>

                      {/* Upside Target */}
                      <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/30 space-y-1">
                        <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">
                          🏁 Primary Upside Target
                        </span>
                        <p className="font-mono font-bold text-sm text-emerald-200">
                          ${analysis.blueprint.targets[0]?.price.toFixed(2) || 'N/A'} (+{analysis.blueprint.targets[0]?.distancePct}%)
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {analysis.blueprint.targets[0]?.rationale || 'Target zone'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= TAB 2: SUPPORT & RESISTANCE LEVELS ================= */}
              {activeTab === 'LEVELS' && (
                <div className="space-y-4">
                  {/* Timeframe Filter Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/30">
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      {(['ALL', 'DAILY', 'WEEKLY', 'MONTHLY', 'PIVOTS', 'FIBONACCI'] as LevelFilter[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setLevelFilter(f)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg font-bold text-xs transition-all",
                            levelFilter === f
                              ? "bg-cyan-500 text-slate-950 shadow-sm"
                              : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                          )}
                        >
                          {f === 'ALL' ? 'All S/R Levels' : f === 'DAILY' ? 'Daily (Swing)' : f === 'WEEKLY' ? 'Weekly (Structural)' : f === 'MONTHLY' ? 'Monthly (Macro)' : f === 'PIVOTS' ? 'Classic Pivots' : 'Fibonacci'}
                        </button>
                      ))}
                    </div>

                    <span className="text-xs font-mono text-muted-foreground">
                      Current: <strong className="text-white">${analysis.currentPrice.toFixed(2)}</strong>
                    </span>
                  </div>

                  {/* Standard Multi-Timeframe S/R Levels Table */}
                  {levelFilter !== 'PIVOTS' && levelFilter !== 'FIBONACCI' && (
                    <div className="space-y-2">
                      {filteredLevels.length === 0 ? (
                        <div className="py-12 text-center text-xs text-muted-foreground">
                          No levels found for this timeframe filter.
                        </div>
                      ) : (
                        filteredLevels.map((lvl) => {
                          const isResistance = lvl.type === 'RESISTANCE';
                          const isImmediate = lvl.isImmediate;

                          return (
                            <div
                              key={lvl.id}
                              className={cn(
                                "p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                                isImmediate
                                  ? isResistance
                                    ? "bg-rose-950/20 border-rose-500/40 shadow-md ring-1 ring-rose-500/30"
                                    : "bg-emerald-950/20 border-emerald-500/40 shadow-md ring-1 ring-emerald-500/30"
                                  : "bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700"
                              )}
                            >
                              {/* Left: Label, Timeframe, Description */}
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0",
                                    isResistance
                                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  )}
                                >
                                  {isResistance ? 'R' : 'S'}
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-white">
                                      {lvl.label}
                                    </span>
                                    {isImmediate && (
                                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] px-1.5 py-0 font-bold">
                                        ⚡ IMMEDIATE {lvl.type}
                                      </Badge>
                                    )}
                                    <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] px-1.5 py-0">
                                      {lvl.timeframe}
                                    </Badge>
                                    <Badge
                                      className={cn(
                                        "text-[10px] px-1.5 py-0",
                                        lvl.strength === 'MAJOR'
                                          ? "bg-purple-500/20 text-purple-300 border-purple-500/30 font-bold"
                                          : "bg-slate-800 text-muted-foreground border-slate-700"
                                      )}
                                    >
                                      {lvl.strength} ({lvl.touchCount} {lvl.touchCount === 1 ? 'touch' : 'touches'})
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {lvl.description}
                                  </p>
                                </div>
                              </div>

                              {/* Right: Price, Distance %, Set Alert Button */}
                              <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0">
                                <div className="text-right font-mono">
                                  <span className="font-bold text-base text-white">
                                    ${lvl.price.toFixed(2)}
                                  </span>
                                  <span
                                    className={cn(
                                      "block text-xs font-semibold",
                                      lvl.distancePercent >= 0 ? "text-rose-400" : "text-emerald-400"
                                    )}
                                  >
                                    {lvl.distancePercent >= 0 ? '+' : ''}
                                    {lvl.distancePercent}% (${lvl.distanceDollar >= 0 ? '+' : ''}
                                    {lvl.distanceDollar.toFixed(2)})
                                  </span>
                                </div>

                                {onSetAlert && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      onSetAlert(
                                        lvl.price,
                                        isResistance ? 'ABOVE' : 'BELOW',
                                        `[Technical Analysis] ${symbol} ${lvl.label}`
                                      )
                                    }
                                    className={cn(
                                      "h-8 px-2.5 text-xs font-semibold gap-1",
                                      isResistance
                                        ? "border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                                        : "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                    )}
                                    title={`Set alert at ${lvl.label} ($${lvl.price.toFixed(2)})`}
                                  >
                                    <BellPlus className="w-3.5 h-3.5" />
                                    <span>Alert</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Classic Floor Pivot Points View */}
                  {levelFilter === 'PIVOTS' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-muted-foreground flex items-center gap-2">
                        <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>
                          Standard Floor Pivot Points calculated from prior day's High, Low, and Close. Pivot Point (PP) is the primary intraday equilibrium.
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                        {[
                          { label: 'R3 (Third Resistance / Extended)', price: analysis.pivotPoints.classic.r3, type: 'RESISTANCE' as LevelType },
                          { label: 'R2 (Second Resistance / Breakout)', price: analysis.pivotPoints.classic.r2, type: 'RESISTANCE' as LevelType },
                          { label: 'R1 (First Resistance / Range High)', price: analysis.pivotPoints.classic.r1, type: 'RESISTANCE' as LevelType },
                          { label: 'PP (Central Pivot Point Equilibrium)', price: analysis.pivotPoints.classic.pp, type: 'PIVOT' as LevelType },
                          { label: 'S1 (First Support / Range Low)', price: analysis.pivotPoints.classic.s1, type: 'SUPPORT' as LevelType },
                          { label: 'S2 (Second Support / Breakdown)', price: analysis.pivotPoints.classic.s2, type: 'SUPPORT' as LevelType },
                          { label: 'S3 (Third Support / Deep Value)', price: analysis.pivotPoints.classic.s3, type: 'SUPPORT' as LevelType },
                        ].map((p, idx) => {
                          const dist = Number((((p.price - analysis.currentPrice) / analysis.currentPrice) * 100).toFixed(2));
                          return (
                            <div
                              key={idx}
                              className={cn(
                                "p-3 rounded-xl border flex items-center justify-between",
                                p.type === 'RESISTANCE'
                                  ? "bg-rose-950/20 border-rose-500/20 text-rose-200"
                                  : p.type === 'SUPPORT'
                                  ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-200"
                                  : "bg-cyan-950/20 border-cyan-500/30 text-cyan-200 font-bold"
                              )}
                            >
                              <div>
                                <span className="font-bold text-xs">{p.label}</span>
                                <span className="block text-[11px] opacity-80">
                                  ${p.price.toFixed(2)} ({dist >= 0 ? '+' : ''}{dist}%)
                                </span>
                              </div>

                              {onSetAlert && p.type !== 'PIVOT' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    onSetAlert(
                                      p.price,
                                      p.type === 'RESISTANCE' ? 'ABOVE' : 'BELOW',
                                      `[Pivot Point] ${symbol} ${p.label}`
                                    )
                                  }
                                  className="h-7 px-2 text-xs"
                                >
                                  <Bell className="w-3 h-3 mr-1" /> Set
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Fibonacci Retracements View */}
                  {levelFilter === 'FIBONACCI' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-muted-foreground flex items-center gap-2">
                        <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>
                          Fibonacci Retracement levels measured from the 52-Week High (${analysis.oscillators.fiftyTwoWeek.high.toFixed(2)}) to 52-Week Low (${analysis.oscillators.fiftyTwoWeek.low.toFixed(2)}).
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                        {[
                          { label: '100.0% (52-Week High)', price: analysis.pivotPoints.fibonacci.level1000 },
                          { label: '78.6% Retracement', price: analysis.pivotPoints.fibonacci.level786 },
                          { label: '61.8% Golden Ratio', price: analysis.pivotPoints.fibonacci.level618 },
                          { label: '50.0% Midpoint Level', price: analysis.pivotPoints.fibonacci.level500 },
                          { label: '38.2% Retracement', price: analysis.pivotPoints.fibonacci.level382 },
                          { label: '23.6% Shallow Pullback', price: analysis.pivotPoints.fibonacci.level236 },
                          { label: '0.0% (52-Week Low)', price: analysis.pivotPoints.fibonacci.level0 },
                        ].map((fib, idx) => {
                          const dist = Number((((fib.price - analysis.currentPrice) / analysis.currentPrice) * 100).toFixed(2));
                          const isAbove = fib.price >= analysis.currentPrice;

                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-xs text-white">{fib.label}</span>
                                <span className="block text-[11px] text-muted-foreground">
                                  ${fib.price.toFixed(2)} ({dist >= 0 ? '+' : ''}{dist}%)
                                </span>
                              </div>

                              {onSetAlert && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    onSetAlert(
                                      fib.price,
                                      isAbove ? 'ABOVE' : 'BELOW',
                                      `[Fibonacci ${fib.label}] ${symbol}`
                                    )
                                  }
                                  className="h-7 px-2 text-xs text-slate-300 hover:text-white"
                                >
                                  <Bell className="w-3 h-3 mr-1" /> Alert
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================= TAB 3: MOVING AVERAGES & TREND HIERARCHY ================= */}
              {activeTab === 'TREND' && (
                <div className="space-y-6">
                  {/* Alignment Banner */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                        Moving Average Alignment
                      </span>
                      <Badge
                        className={cn(
                          "text-xs font-bold px-2 py-0.5",
                          analysis.trend.movingAverageAlignment === 'BULLISH_STACK'
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : analysis.trend.movingAverageAlignment === 'BEARISH_STACK'
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        )}
                      >
                        {analysis.trend.movingAverageAlignment.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm font-bold text-white">
                      {analysis.trend.alignmentDescription}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Trend Strength Score: <strong className="text-cyan-300">{analysis.trend.trendStrengthScore}/100</strong> • ADX Trend Intensity: <strong className="text-cyan-300">{analysis.trend.adx}</strong>
                    </p>
                  </div>

                  {/* Moving Averages Stack */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 20 EMA */}
                    <Card className="p-4 bg-slate-900/70 border-slate-800 space-y-2">
                      <span className="text-[11px] font-bold text-cyan-400 uppercase">20-Day EMA (Tactical)</span>
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono font-bold text-lg text-white">
                          ${analysis.movingAverages.dma20.toFixed(2)}
                        </span>
                        <span
                          className={cn(
                            "font-mono font-bold text-xs",
                            analysis.movingAverages.dma20DistPct >= 0 ? "text-emerald-400" : "text-rose-400"
                          )}
                        >
                          {analysis.movingAverages.dma20DistPct >= 0 ? '+' : ''}
                          {analysis.movingAverages.dma20DistPct}%
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Short-term swing trigger. Price {analysis.movingAverages.dma20DistPct >= 0 ? 'riding above' : 'trading below'} 20 EMA.
                      </p>
                    </Card>

                    {/* 50 SMA */}
                    <Card className="p-4 bg-slate-900/70 border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-400 uppercase">50-Day SMA (Institutional)</span>
                        <Badge className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">
                          {analysis.movingAverages.slope50}
                        </Badge>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono font-bold text-lg text-white">
                          ${analysis.movingAverages.dma50.toFixed(2)}
                        </span>
                        <span
                          className={cn(
                            "font-mono font-bold text-xs",
                            analysis.movingAverages.dma50DistPct >= 0 ? "text-emerald-400" : "text-rose-400"
                          )}
                        >
                          {analysis.movingAverages.dma50DistPct >= 0 ? '+' : ''}
                          {analysis.movingAverages.dma50DistPct}%
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Primary benchmark for institutional funds. Slope is currently {analysis.movingAverages.slope50.toLowerCase()}.
                      </p>
                    </Card>

                    {/* 200 SMA */}
                    <Card className="p-4 bg-slate-900/70 border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-purple-400 uppercase">200-Day SMA (Macro Cycle)</span>
                        <Badge className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">
                          {analysis.movingAverages.slope200}
                        </Badge>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono font-bold text-lg text-white">
                          ${analysis.movingAverages.dma200.toFixed(2)}
                        </span>
                        <span
                          className={cn(
                            "font-mono font-bold text-xs",
                            analysis.movingAverages.dma200DistPct >= 0 ? "text-emerald-400" : "text-rose-400"
                          )}
                        >
                          {analysis.movingAverages.dma200DistPct >= 0 ? '+' : ''}
                          {analysis.movingAverages.dma200DistPct}%
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Defines bull/bear macro boundary. Price is {analysis.movingAverages.dma200DistPct >= 0 ? 'bullish above' : 'bearish below'} 200 SMA.
                      </p>
                    </Card>
                  </div>
                </div>
              )}

              {/* ================= TAB 4: OSCILLATORS & VOLATILITY ================= */}
              {activeTab === 'OSCILLATORS' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* RSI 14 Momentum Meter */}
                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          Relative Strength Index (RSI 14)
                        </span>
                        <Badge
                          className={cn(
                            "text-xs font-bold",
                            analysis.oscillators.rsiCondition === 'OVERBOUGHT'
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                              : analysis.oscillators.rsiCondition === 'OVERSOLD'
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          )}
                        >
                          {analysis.oscillators.rsiCondition.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="font-mono font-black text-3xl text-white">
                          {analysis.oscillators.rsi14}
                        </span>
                        <span className="text-xs text-muted-foreground font-semibold">/ 100</span>
                      </div>

                      {/* Visual RSI Slider */}
                      <div className="space-y-1">
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden relative">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              analysis.oscillators.rsi14 >= 70
                                ? "bg-rose-500"
                                : analysis.oscillators.rsi14 <= 30
                                ? "bg-emerald-400"
                                : "bg-cyan-400"
                            )}
                            style={{ width: `${Math.min(100, Math.max(0, analysis.oscillators.rsi14))}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                          <span>0 (Oversold &lt;30)</span>
                          <span>50 (Center)</span>
                          <span>100 (Overbought &gt;70)</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {analysis.oscillators.rsiInterpretation}
                      </p>
                    </div>

                    {/* MACD (12, 26, 9) */}
                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          MACD Momentum (12, 26, 9)
                        </span>
                        <Badge
                          className={cn(
                            "text-xs font-bold",
                            analysis.oscillators.macd.crossover === 'BULLISH_CROSS'
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : analysis.oscillators.macd.crossover === 'BEARISH_CROSS'
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          )}
                        >
                          {analysis.oscillators.macd.crossover.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
                        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                          <span className="text-[10px] text-muted-foreground block">MACD Line</span>
                          <span className="font-bold text-sm text-cyan-300">{analysis.oscillators.macd.macdLine}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                          <span className="text-[10px] text-muted-foreground block">Signal Line</span>
                          <span className="font-bold text-sm text-purple-300">{analysis.oscillators.macd.signalLine}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                          <span className="text-[10px] text-muted-foreground block">Histogram</span>
                          <span
                            className={cn(
                              "font-bold text-sm",
                              analysis.oscillators.macd.histogram >= 0 ? "text-emerald-400" : "text-rose-400"
                            )}
                          >
                            {analysis.oscillators.macd.histogram >= 0 ? '+' : ''}
                            {analysis.oscillators.macd.histogram}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {analysis.oscillators.macd.interpretation}
                      </p>
                    </div>

                    {/* Bollinger Bands & Volatility */}
                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          Bollinger Bands (20, 2)
                        </span>
                        {analysis.oscillators.bollingerBands.isSqueeze && (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-bold animate-pulse">
                            ⚠️ SQUEEZE ALERT
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 font-mono text-xs text-center">
                        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                          <span className="text-[10px] text-rose-300 block">Upper Band</span>
                          <span className="font-bold text-white">${analysis.oscillators.bollingerBands.upper.toFixed(2)}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                          <span className="text-[10px] text-cyan-300 block">Middle (20 SMA)</span>
                          <span className="font-bold text-white">${analysis.oscillators.bollingerBands.middle.toFixed(2)}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                          <span className="text-[10px] text-emerald-300 block">Lower Band</span>
                          <span className="font-bold text-white">${analysis.oscillators.bollingerBands.lower.toFixed(2)}</span>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Bandwidth: <strong className="text-white">{analysis.oscillators.bollingerBands.bandwidthPct}%</strong> • Position in Band: <strong className="text-white">{Math.round(analysis.oscillators.bollingerBands.percentB * 100)}%</strong>
                      </p>
                    </div>

                    {/* Volatility ATR & Volume Multiplier */}
                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                        Expected Move & Institutional Volume
                      </span>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                          <span className="text-[10px] text-muted-foreground block">Average True Range (ATR 14)</span>
                          <span className="font-mono font-bold text-base text-white">
                            ${analysis.oscillators.atr14.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-cyan-300 block">
                            ±{analysis.oscillators.atrPercent}% expected daily swing
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                          <span className="text-[10px] text-muted-foreground block">Relative Volume (RVOL)</span>
                          <span className="font-mono font-bold text-base text-white">
                            {analysis.oscillators.relativeVolume}x
                          </span>
                          <span className="text-[10px] text-cyan-300 block">
                            {analysis.oscillators.volumeCondition.replace('_', ' ')} vs 30D
                          </span>
                        </div>
                      </div>

                      {/* 52-Week Range */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                          <span>52W Low: ${analysis.oscillators.fiftyTwoWeek.low.toFixed(2)}</span>
                          <span className="font-bold text-white">Current: ${analysis.currentPrice.toFixed(2)}</span>
                          <span>52W High: ${analysis.oscillators.fiftyTwoWeek.high.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-emerald-400 font-semibold">
                            +{analysis.oscillators.fiftyTwoWeek.distLowPct}% from low
                          </span>
                          <span className="text-rose-400 font-semibold">
                            {analysis.oscillators.fiftyTwoWeek.distHighPct}% from high
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ================= MODAL FOOTER ================= */}
        {analysis && (
          <div className="p-4 px-6 border-t border-border/40 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-20 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Multi-Timeframe Engine Active (Daily, Weekly, Monthly)</span>
            </div>

            <div className="flex items-center gap-2">
              {onSetAlert && analysis.immediateSupport && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onSetAlert(
                      analysis.immediateSupport!.price,
                      'BELOW',
                      `[Key Support] ${symbol} $${analysis.immediateSupport!.price}`
                    )
                  }
                  className="h-8 text-xs font-semibold border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                >
                  <Bell className="w-3.5 h-3.5 mr-1" />
                  Alert at Support (${analysis.immediateSupport.price.toFixed(2)})
                </Button>
              )}

              {onSetAlert && analysis.immediateResistance && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onSetAlert(
                      analysis.immediateResistance!.price,
                      'ABOVE',
                      `[Key Resistance] ${symbol} $${analysis.immediateResistance!.price}`
                    )
                  }
                  className="h-8 text-xs font-semibold border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                >
                  <Bell className="w-3.5 h-3.5 mr-1" />
                  Alert at Resistance (${analysis.immediateResistance.price.toFixed(2)})
                </Button>
              )}

              <Button
                size="sm"
                onClick={onClose}
                className="h-8 px-4 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
