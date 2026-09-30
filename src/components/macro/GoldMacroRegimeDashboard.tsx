import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Coins,
  TrendingDown,
  TrendingUp,
  Landmark,
  Scale,
  Flame,
  DollarSign,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Maximize2
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
  Legend
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  useGoldMacroRegime,
  useGoldMacroHistory,
  useGoldMacroBacktest,
  useGenerateGoldMacroAiNarrative,
  PillarBreakdown,
  HistoricalRegimePoint
} from '@/services/goldMacroService';
import { GoldMethodologyModal } from './GoldMethodologyModal';
import { toast } from 'sonner';

interface GoldMacroRegimeDashboardProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
}

type TimeframeFilter = '1Y' | '3Y' | '5Y' | '10Y' | 'MAX';
type ActivePillarCurve = 'total' | 'real_rates' | 'fiscal' | 'inflation' | 'usd' | 'liquidity';

export function GoldMacroRegimeDashboard({
  onNavigateToResearch,
  onNavigateToGraphs
}: GoldMacroRegimeDashboardProps) {
  const { data: snapshot, isLoading, isFetching, refetch } = useGoldMacroRegime();
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeFilter>('5Y');
  const { data: historyData = [], isLoading: isHistoryLoading } = useGoldMacroHistory(selectedTimeframe);
  const { data: backtestData, isLoading: isBacktestLoading } = useGoldMacroBacktest();

  const [activeCurve, setActiveCurve] = useState<ActivePillarCurve>('total');
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);

  const aiMutation = useGenerateGoldMacroAiNarrative();

  const handleGenerateAi = async () => {
    try {
      await aiMutation.mutateAsync(true);
      toast.success('AI macro narrative refreshed');
    } catch (err: any) {
      toast.error(`AI generation notice: ${err.message}`);
    }
  };

  // Helper colors for the score
  const score = snapshot?.goldMacroScore ?? 50;
  const scoreColor = useMemo(() => {
    if (score >= 75) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 58) return 'text-teal-400 bg-teal-500/10 border-teal-500/30';
    if (score <= 28) return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    if (score <= 45) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  }, [score]);

  if (isLoading) {
    return (
      <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-3xl p-10 text-center">
        <div className="flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
          <p className="text-sm font-bold text-foreground">
            Synthesizing 5-Pillar Gold Macro Regime Telemetry...
          </p>
          <p className="text-xs text-muted-foreground max-w-md">
            Ingesting TIPS real yields, NY Fed ACM term premia, Treasury auction results, broad USD, and stagflation metrics from public databases.
          </p>
        </div>
      </Card>
    );
  }

  if (!snapshot) return null;

  return (
    <div className="space-y-6">
      {/* ========================================================
          1. TOP REGIME CARD: SCORE, 4 REGIME LABELS & STATUS
         ======================================================== */}
      <Card className="bg-gradient-to-br from-card/90 via-card/70 to-card/50 backdrop-blur-xl border border-border/80 shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-border/50 pb-5 px-6 sm:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                    Gold Macro Regime Dashboard
                  </CardTitle>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-bold uppercase tracking-widest">
                    Institutional
                  </Badge>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                    Confidence: {snapshot.confidenceScore}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Point-in-time structural regime, tactical pressure, and sovereign debt interaction model
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMethodologyOpen(true)}
                className="h-9 px-3 text-xs font-semibold rounded-xl bg-background/50 border-border/70 hover:bg-muted/50 gap-1.5"
              >
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                Methodology
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-9 px-3 text-xs font-semibold rounded-xl bg-background/50 border-border/70 hover:bg-muted/50 gap-1.5"
              >
                <RefreshCw className={cn('w-3.5 h-3.5 text-primary', isFetching && 'animate-spin')} />
                {isFetching ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Main Dial & 4 Regimes Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Score Gauge (5 Cols) */}
            <div className="lg:col-span-5 bg-background/40 border border-border/60 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Gold Macro Score
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  Spot: <strong className="text-foreground">${snapshot.goldPrice.current.toLocaleString()}</strong>
                  <span className={cn('text-[11px] font-bold', snapshot.goldPrice.change1D >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                    ({snapshot.goldPrice.changePercent1D >= 0 ? '+' : ''}{snapshot.goldPrice.changePercent1D.toFixed(2)}%)
                  </span>
                </span>
              </div>

              {/* Large Score Indicator */}
              <div className="flex items-baseline gap-3 my-2">
                <span className="text-5xl sm:text-6xl font-black tracking-tight text-foreground">
                  {snapshot.goldMacroScore}
                </span>
                <span className="text-2xl font-bold text-muted-foreground">/ 100</span>
                <Badge variant="outline" className={cn('ml-auto text-xs font-black px-3 py-1 uppercase tracking-wide border', scoreColor)}>
                  {snapshot.structuralRegimeLabel.replace('Structural: ', '')}
                </Badge>
              </div>

              {/* Score Bar Scale */}
              <div className="space-y-1.5 mt-3">
                <div className="h-3 w-full bg-muted/40 rounded-full overflow-hidden p-0.5 border border-border/40 relative">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      snapshot.goldMacroScore >= 60 ? 'bg-gradient-to-r from-teal-500 to-emerald-400' :
                      snapshot.goldMacroScore >= 45 ? 'bg-gradient-to-r from-amber-500 to-blue-400' :
                      'bg-gradient-to-r from-rose-500 to-amber-500'
                    )}
                    style={{ width: `${Math.max(5, snapshot.goldMacroScore)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>0 Hostile</span>
                  <span>50 Neutral</span>
                  <span>100 Bullish</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border/40 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Calculated deterministically from 5 underlying macro pillars</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Zero AI bias
                </span>
              </div>
            </div>

            {/* Right 4 Independent Regimes (7 Cols) */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* 1. Structural Regime */}
              <div className="p-4 rounded-2xl bg-background/40 border border-border/60 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Structural Gold Regime
                  </div>
                  <div className="text-base font-extrabold text-foreground flex items-center gap-2">
                    {snapshot.structuralRegime === 'STRONGLY_BULLISH' || snapshot.structuralRegime === 'BULLISH' ? (
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    ) : snapshot.structuralRegime === 'STRONGLY_BEARISH' || snapshot.structuralRegime === 'BEARISH' ? (
                      <TrendingDown className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Activity className="w-4 h-4 text-blue-400" />
                    )}
                    {snapshot.structuralRegimeLabel.replace('Structural: ', '')}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Medium/long-term sovereign macro environment based on real rates, dollar trends, and monetary accommodation.
                </p>
              </div>

              {/* 2. Tactical Gold Pressure */}
              <div className="p-4 rounded-2xl bg-background/40 border border-border/60 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Tactical Gold Pressure
                  </div>
                  <div className="text-base font-extrabold text-foreground flex items-center gap-2">
                    {snapshot.tacticalPressureScore >= 20 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    ) : snapshot.tacticalPressureScore <= -20 ? (
                      <TrendingDown className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Activity className="w-4 h-4 text-amber-400" />
                    )}
                    {snapshot.tacticalPressureLabel.replace('Tactical: ', '')}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Short-term (1M/3M) velocity from real-yield shifts, USD momentum, and energy supply shock impulse.
                </p>
              </div>

              {/* 3. Fiscal Dominance Pressure */}
              <div className="p-4 rounded-2xl bg-background/40 border border-border/60 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Fiscal Dominance Pressure
                  </div>
                  <div className="text-base font-extrabold text-foreground flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-amber-400" />
                    {snapshot.fiscalPressureCategory} ({snapshot.fiscalPressureScore}/100)
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Probability that U.S. debt ($40T+) and rising Treasury term premia constrain future monetary tightening choices.
                </p>
              </div>

              {/* 4. Stagflation Pressure */}
              <div className="p-4 rounded-2xl bg-background/40 border border-border/60 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Stagflation Pressure
                  </div>
                  <div className="text-base font-extrabold text-foreground flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    {snapshot.stagflationPressureCategory} ({snapshot.stagflationPressureScore}/100)
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Energy price elevation alongside tightening financial conditions and sticky 10Y inflation expectations.
                </p>
              </div>
            </div>
          </div>

          {/* ========================================================
              2. WHAT IS DRIVING GOLD? (CONTRIBUTION BARS)
             ======================================================== */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                What is Driving Gold? (Pillar Contribution Breakdown)
              </h3>
              <span className="text-[11px] text-muted-foreground">
                Sum of 5 Pillars = Net Composite Score
              </span>
            </div>

            <div className="space-y-2.5">
              {snapshot.pillars.map((pillar) => {
                const isTailwind = pillar.rawScore > 0;
                const isHeadwind = pillar.rawScore < 0;
                return (
                  <div
                    key={pillar.id}
                    className="p-3.5 rounded-2xl bg-background/40 border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="sm:w-1/3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {pillar.name}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono border-border/60">
                          {(pillar.weight * 100).toFixed(0)}% wt
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {pillar.summary}
                      </p>
                    </div>

                    {/* Middle Bar */}
                    <div className="sm:w-1/3 flex items-center gap-2">
                      <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden flex relative">
                        {/* Center line */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-border z-10" />
                        {isHeadwind ? (
                          <div className="w-1/2 flex justify-end">
                            <div
                              className="h-full bg-rose-500 rounded-l-full"
                              style={{ width: `${Math.min(100, Math.abs(pillar.rawScore))}%` }}
                            />
                          </div>
                        ) : (
                          <div className="w-1/2" />
                        )}
                        {isTailwind ? (
                          <div className="w-1/2">
                            <div
                              className="h-full bg-emerald-500 rounded-r-full"
                              style={{ width: `${Math.min(100, Math.abs(pillar.rawScore))}%` }}
                            />
                          </div>
                        ) : (
                          <div className="w-1/2" />
                        )}
                      </div>
                    </div>

                    {/* Right Numbers */}
                    <div className="sm:w-1/4 flex items-center justify-between sm:justify-end gap-3 text-xs font-mono">
                      <span className={cn('font-bold', isTailwind ? 'text-emerald-400' : isHeadwind ? 'text-rose-400' : 'text-muted-foreground')}>
                        {pillar.rawScore > 0 ? '+' : ''}{pillar.rawScore} pts
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5',
                          isTailwind ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          isHeadwind ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                          'bg-muted/40 text-muted-foreground border-border/50'
                        )}
                      >
                        {pillar.stance.replace('_', ' ')} ({pillar.contribution > 0 ? '+' : ''}{pillar.contribution})
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================
              3. WHY? PANEL & DRIVER DYNAMICS
             ======================================================== */}
          <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs sm:text-sm uppercase tracking-wide">
              <Info className="w-4 h-4" />
              Why Is Gold Behaving This Way?
            </div>
            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-sans">
              {snapshot.whyUnderPressureOrSupported}
            </p>
          </div>

          {/* Two Columns: Hurting vs Supporting */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hurting */}
            <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs sm:text-sm uppercase tracking-wide">
                <TrendingDown className="w-4 h-4" />
                What is Hurting Gold?
              </div>
              <div className="space-y-2.5">
                {snapshot.whatIsHurtingGold.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-background/50 border border-border/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{item.title}</span>
                      {item.impactBpsOrPct && (
                        <Badge variant="outline" className="text-[10px] font-mono bg-rose-500/10 text-rose-400 border-rose-500/30">
                          {item.impactBpsOrPct}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Supporting */}
            <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm uppercase tracking-wide">
                <TrendingUp className="w-4 h-4" />
                What is Supporting Gold?
              </div>
              <div className="space-y-2.5">
                {snapshot.whatIsSupportingGold.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-background/50 border border-border/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{item.title}</span>
                      {item.impactBpsOrPct && (
                        <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                          {item.impactBpsOrPct}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ========================================================
              4. SIGNAL CONFLICT DETECTOR
             ======================================================== */}
          {snapshot.signalConflict.hasConflict && (
            <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/25 space-y-3">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs sm:text-sm uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 text-blue-400" />
                Signal Conflict Detected (Monetary Tightening vs Fiscal Dominance)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-background/50 border border-border/50">
                  <span className="text-emerald-400 font-bold">Bullish Signals:</span>
                  <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-0.5">
                    {snapshot.signalConflict.bullishFactors.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 rounded-xl bg-background/50 border border-border/50">
                  <span className="text-rose-400 font-bold">Bearish Signals:</span>
                  <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-0.5">
                    {snapshot.signalConflict.bearishFactors.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {snapshot.signalConflict.interpretation}
              </p>
            </div>
          )}

          {/* ========================================================
              5. KEY MACRO INDICATORS GRID
             ======================================================== */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Key Macro Indicators Telemetry
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* 1. 10Y TIPS */}
              <div className="p-3.5 rounded-2xl bg-background/40 border border-border/60 space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">10Y TIPS Real</div>
                <div className="text-lg font-black text-foreground">
                  {snapshot.pillars[0]?.metrics[0]?.currentValue}%
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={cn(snapshot.pillars[0]?.metrics[0]?.change3M >= 0 ? 'text-rose-400' : 'text-emerald-400')}>
                    {snapshot.pillars[0]?.metrics[0]?.change3M >= 0 ? '+' : ''}{(snapshot.pillars[0]?.metrics[0]?.change3M * 100).toFixed(0)} bps 3M
                  </span>
                  <span className="text-muted-foreground">{snapshot.pillars[0]?.metrics[0]?.percentile10Y}th %ile</span>
                </div>
              </div>

              {/* 2. Broad USD */}
              <div className="p-3.5 rounded-2xl bg-background/40 border border-border/60 space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Broad USD Index</div>
                <div className="text-lg font-black text-foreground">
                  {snapshot.pillars[3]?.metrics[0]?.currentValue}
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={cn(snapshot.pillars[3]?.metrics[0]?.change3M >= 0 ? 'text-rose-400' : 'text-emerald-400')}>
                    {snapshot.pillars[3]?.metrics[0]?.change3M >= 0 ? '+' : ''}{snapshot.pillars[3]?.metrics[0]?.change3M.toFixed(1)}% 3M
                  </span>
                  <span className="text-muted-foreground">{snapshot.pillars[3]?.metrics[0]?.percentile5Y}th %ile</span>
                </div>
              </div>

              {/* 3. 10Y Breakeven */}
              <div className="p-3.5 rounded-2xl bg-background/40 border border-border/60 space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">10Y Breakeven</div>
                <div className="text-lg font-black text-foreground">
                  {snapshot.pillars[2]?.metrics[0]?.currentValue}%
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">
                    {snapshot.pillars[2]?.metrics[0]?.change3M >= 0 ? '+' : ''}{(snapshot.pillars[2]?.metrics[0]?.change3M * 100).toFixed(0)} bps 3M
                  </span>
                  <span className="text-muted-foreground">{snapshot.pillars[2]?.metrics[0]?.percentile5Y}th %ile</span>
                </div>
              </div>

              {/* 4. 10Y ACM Term Premium */}
              <div className="p-3.5 rounded-2xl bg-background/40 border border-border/60 space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">10Y Term Premium</div>
                <div className="text-lg font-black text-foreground">
                  {snapshot.fiscalTelemetry.termPremium10Y.toFixed(2)}%
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={cn(snapshot.fiscalTelemetry.termPremium3MChange >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                    {snapshot.fiscalTelemetry.termPremium3MChange >= 0 ? '+' : ''}{(snapshot.fiscalTelemetry.termPremium3MChange * 100).toFixed(0)} bps 3M
                  </span>
                  <span className="text-muted-foreground">{snapshot.fiscalTelemetry.termPremiumPercentile}th %ile</span>
                </div>
              </div>

              {/* 5. Brent Crude */}
              <div className="p-3.5 rounded-2xl bg-background/40 border border-border/60 space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Brent Crude Oil</div>
                <div className="text-lg font-black text-foreground">
                  ${snapshot.pillars[2]?.metrics[2]?.currentValue}
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">
                    {snapshot.pillars[2]?.metrics[2]?.change3M >= 0 ? '+' : ''}{snapshot.pillars[2]?.metrics[2]?.change3M.toFixed(1)}% 3M
                  </span>
                  <span className="text-muted-foreground">{snapshot.pillars[2]?.metrics[2]?.percentile5Y}th %ile</span>
                </div>
              </div>

              {/* 6. U.S. Debt */}
              <div className="p-3.5 rounded-2xl bg-background/40 border border-border/60 space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Total Public Debt</div>
                <div className="text-lg font-black text-foreground">
                  ${snapshot.fiscalTelemetry.debtToPennyTrillions}T
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-amber-400 font-bold">Debt/GDP &gt;120%</span>
                  <span className="text-muted-foreground">Fiscal Data</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================
              6. WHAT WOULD CHANGE MY MIND?
             ======================================================== */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              What Would Change My Mind? (Dynamic Pivot Levels)
            </h3>

            <div className="border border-border/60 rounded-2xl overflow-hidden bg-background/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/60 font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">Stance Shift</th>
                    <th className="p-3">Target Variable</th>
                    <th className="p-3">Current</th>
                    <th className="p-3">Trigger Level</th>
                    <th className="p-3">Macro Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {snapshot.whatWouldChangeMyMind.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="p-3 font-bold">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5',
                            item.direction === 'BULLISH'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          )}
                        >
                          {item.direction === 'BULLISH' ? '+ More Bullish' : '- More Bearish'}
                        </Badge>
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        {item.targetMetric}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {item.currentValue}
                      </td>
                      <td className="p-3 font-mono font-bold text-foreground">
                        {item.triggerThreshold}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {item.economicRationale}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================
              7. HISTORICAL REGIME CHART (SCORE VS GOLD PRICE)
             ======================================================== */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Historical Gold Macro Score vs. Gold Price
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Investigate whether the multi-pillar model historically aligns with economic cycle inflections
                </p>
              </div>

              {/* Timeframe selector */}
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50">
                {(['1Y', '3Y', '5Y', '10Y', 'MAX'] as TimeframeFilter[]).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setSelectedTimeframe(tf)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-bold rounded-lg transition-all',
                      selectedTimeframe === tf
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Pillar Curve Selector */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-muted-foreground text-[11px] font-semibold">Active Series:</span>
              {[
                { id: 'total', label: 'Gold Macro Score (0-100)', color: '#f59e0b' },
                { id: 'real_rates', label: 'Real Rates Pillar', color: '#f43f5e' },
                { id: 'fiscal', label: 'Fiscal Stress Pillar', color: '#10b981' },
                { id: 'inflation', label: 'Inflation Pillar', color: '#f97316' },
                { id: 'usd', label: 'USD Pillar', color: '#06b6d4' }
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCurve(c.id as ActivePillarCurve)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all flex items-center gap-1.5',
                    activeCurve === c.id
                      ? 'bg-card text-foreground border-primary shadow-sm'
                      : 'bg-background/40 text-muted-foreground border-border/60 hover:text-foreground'
                  )}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.label}
                </button>
              ))}
            </div>

            {/* Recharts Area/Line Chart */}
            <div className="h-72 w-full bg-background/40 border border-border/60 rounded-2xl p-4">
              {isHistoryLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading historical macro series...
                </div>
              ) : historyData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  No historical observations available for this range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData}>
                    <defs>
                      <linearGradient id="goldPriceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="formattedDate"
                      stroke="#888888"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="price"
                      orientation="left"
                      stroke="#f59e0b"
                      fontSize={10}
                      tickLine={false}
                      domain={['auto', 'auto']}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <YAxis
                      yAxisId="score"
                      orientation="right"
                      stroke="#a8a29e"
                      fontSize={10}
                      tickLine={false}
                      domain={activeCurve === 'total' ? [0, 100] : [-100, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        borderColor: '#27272a',
                        borderRadius: '0.75rem',
                        fontSize: '0.75rem'
                      }}
                    />
                    <ReferenceLine yAxisId="score" y={activeCurve === 'total' ? 50 : 0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                    <Area
                      yAxisId="price"
                      type="monotone"
                      dataKey="goldPrice"
                      name="Gold Spot Price ($)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#goldPriceGrad)"
                    />
                    {activeCurve === 'total' && (
                      <Line
                        yAxisId="score"
                        type="monotone"
                        dataKey="goldMacroScore"
                        name="Gold Macro Score (0-100)"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={false}
                      />
                    )}
                    {activeCurve === 'real_rates' && (
                      <Line
                        yAxisId="score"
                        type="monotone"
                        dataKey="realRatesScore"
                        name="Real Rates Score (-100 to +100)"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        dot={false}
                      />
                    )}
                    {activeCurve === 'fiscal' && (
                      <Line
                        yAxisId="score"
                        type="monotone"
                        dataKey="fiscalScore"
                        name="Fiscal Score (-100 to +100)"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                      />
                    )}
                    {activeCurve === 'inflation' && (
                      <Line
                        yAxisId="score"
                        type="monotone"
                        dataKey="inflationScore"
                        name="Inflation Score (-100 to +100)"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={false}
                      />
                    )}
                    {activeCurve === 'usd' && (
                      <Line
                        yAxisId="score"
                        type="monotone"
                        dataKey="usdScore"
                        name="USD Score (-100 to +100)"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        dot={false}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ========================================================
              8. POINT-IN-TIME REGIME BACKTESTING REPORT
             ======================================================== */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-primary" />
                  Historical Regime Backtesting (Forward Return Distribution)
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Strict point-in-time calculation — verified zero future data leakage
                </p>
              </div>
            </div>

            <div className="border border-border/60 rounded-2xl overflow-hidden bg-background/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/60 font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">Regime Trigger Condition</th>
                    <th className="p-3 text-center">Sample (N)</th>
                    <th className="p-3 text-center">+1M Return</th>
                    <th className="p-3 text-center">+3M Return</th>
                    <th className="p-3 text-center">+6M Return</th>
                    <th className="p-3 text-center">+12M Return</th>
                    <th className="p-3 text-center">12M Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {backtestData?.conditions.map((cond, idx) => (
                    <tr key={idx} className="hover:bg-muted/20 font-sans">
                      <td className="p-3">
                        <div className="font-semibold text-foreground text-xs">{cond.conditionName}</div>
                        <div className="text-[10px] text-muted-foreground">{cond.description}</div>
                      </td>
                      <td className="p-3 text-center font-mono text-muted-foreground">{cond.sampleSize} obs</td>
                      <td className={cn('p-3 text-center font-mono font-bold', cond.avgReturn1M >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                        {cond.avgReturn1M >= 0 ? '+' : ''}{cond.avgReturn1M}%
                      </td>
                      <td className={cn('p-3 text-center font-mono font-bold', cond.avgReturn3M >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                        {cond.avgReturn3M >= 0 ? '+' : ''}{cond.avgReturn3M}%
                      </td>
                      <td className={cn('p-3 text-center font-mono font-bold', cond.avgReturn6M >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                        {cond.avgReturn6M >= 0 ? '+' : ''}{cond.avgReturn6M}%
                      </td>
                      <td className={cn('p-3 text-center font-mono font-bold', cond.avgReturn12M >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                        {cond.avgReturn12M >= 0 ? '+' : ''}{cond.avgReturn12M}%
                      </td>
                      <td className="p-3 text-center font-mono">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-2 py-0.5',
                            cond.winRate12M >= 70 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                            cond.winRate12M <= 40 ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                            'bg-muted/40 text-muted-foreground border-border/50'
                          )}
                        >
                          {cond.winRate12M}% win
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================
              9. OPTIONAL OPENROUTER AI NARRATIVE LAYER
             ======================================================== */}
          <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Optional AI Narrative Synthesis (OpenRouter)
                </span>
                <Badge variant="outline" className="text-[10px] font-mono border-border/60">
                  {snapshot.aiNarrative?.enabled ? 'Active' : 'Disabled by Default (0 Cost)'}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAi}
                  disabled={aiMutation.isPending}
                  className="h-8 px-2.5 text-xs rounded-xl bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 gap-1.5"
                >
                  <RefreshCw className={cn('w-3 h-3', aiMutation.isPending && 'animate-spin')} />
                  {aiMutation.isPending ? 'Generating...' : 'Refresh AI Analysis'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAiOpen(!isAiOpen)}
                  className="h-8 w-8 p-0 rounded-xl"
                >
                  {isAiOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {isAiOpen && (
              <div className="pt-2 border-t border-border/40 text-xs space-y-3">
                <p className="text-muted-foreground text-[11px]">
                  <em>Notice:</em> AI operates strictly as an optional interpretation layer over the calculated numbers. Scores and percentiles are 100% deterministic and cannot be modified by the LLM.
                </p>
                {snapshot.aiNarrative?.whatChanged && (
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-background/50 border border-border/40">
                      <span className="font-bold text-foreground">What Changed:</span>
                      <p className="text-muted-foreground mt-0.5">{snapshot.aiNarrative.whatChanged}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/50 border border-border/40">
                      <span className="font-bold text-foreground">What Matters Most:</span>
                      <p className="text-muted-foreground mt-0.5">{snapshot.aiNarrative.whatMattersMost}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Methodology Modal */}
      <GoldMethodologyModal
        isOpen={isMethodologyOpen}
        onClose={() => setIsMethodologyOpen(false)}
      />
    </div>
  );
}
