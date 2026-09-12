import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Compass,
  Cpu,
  Flame,
  HelpCircle,
  Info,
  Layers,
  LineChart as LineChartIcon,
  Loader2,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  useImpliedExpectations,
  ImpliedExpectationsAnalysis,
  getVerdictStyle,
  getDifficultyBadge,
} from '@/services/impliedExpectationsService';
import { cn } from '@/lib/utils';

interface ImpliedExpectationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice?: number;
}

export function ImpliedExpectationsModal({
  isOpen,
  onClose,
  symbol,
  currentPrice,
}: ImpliedExpectationsModalProps) {
  const cleanSymbol = (symbol || '').trim().toUpperCase();

  const [activeTab, setActiveTab] = useState<'synthesis' | 'benchmarks' | 'scenarios' | 'simulator'>('synthesis');

  // Interactive What-If Simulator State
  const [simulatedGrowth, setSimulatedGrowth] = useState<number | null>(null);

  // Fetch implied expectations
  const {
    data: analysis,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useImpliedExpectations(cleanSymbol, {
    enabled: isOpen && Boolean(cleanSymbol),
    priceOverride: currentPrice,
  });

  const effectivePrice = currentPrice || analysis?.currentPrice || 0;
  const verdictStyle = analysis ? getVerdictStyle(analysis.verdict.type) : getVerdictStyle('PRICED_FOR_CONSENSUS');

  // Active simulated growth value (defaults to implied growth)
  const activeSimGrowth = simulatedGrowth !== null ? simulatedGrowth : (analysis?.impliedGrowth.horizon5YGrowthPct || 12);

  // Interactive fair value calculation based on simulated growth
  const simulatedPriceResult = useMemo(() => {
    if (!analysis) return { price: effectivePrice, returnPct: 0 };
    const baseG = analysis.impliedGrowth.horizon5YGrowthPct;
    const diff = activeSimGrowth - baseG;
    // Each 100 bps delta in 5Y growth impacts valuation by ~3.8%
    const priceDeltaPct = diff * 3.8;
    const simPrice = Number((effectivePrice * (1 + priceDeltaPct / 100)).toFixed(2));
    return {
      price: Math.max(1, simPrice),
      returnPct: Number(priceDeltaPct.toFixed(1)),
    };
  }, [analysis, activeSimGrowth, effectivePrice]);

  // Growth Benchmarks Comparison Chart Data
  const benchmarkChartData = useMemo(() => {
    if (!analysis) return [];
    return [
      {
        name: 'Sector Median',
        growth: analysis.benchmarks.sectorMedianGrowth,
        fill: '#64748b',
        label: 'S&P 500 Baseline',
      },
      {
        name: '3Y Historical',
        growth: analysis.benchmarks.historicalRevenue3YCagr,
        fill: '#38bdf8',
        label: 'Company Past Track Record',
      },
      {
        name: 'Consensus FY1',
        growth: analysis.benchmarks.consensusRevenueGrowthFY1,
        fill: '#818cf8',
        label: 'Wall Street Forecast',
      },
      {
        name: 'Market Implied',
        growth: analysis.impliedGrowth.horizon5YGrowthPct,
        fill: analysis.benchmarks.expectationsGapPct > 4 ? '#f43f5e' : '#10b981',
        label: "What's Baked Into Price",
      },
    ];
  }, [analysis]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl p-0 gap-0 rounded-2xl scrollbar-thin">
        {/* Top Gradient Banner */}
        <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400" />

        {/* Header Ribbon */}
        <div className="p-6 pb-4 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-cyan-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
              <BrainCircuit className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <DialogTitle className="text-2xl font-black font-mono tracking-tight text-foreground">
                  {cleanSymbol}
                </DialogTitle>
                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/30 text-[10px] font-mono font-bold uppercase">
                  Reverse Valuation Engine
                </Badge>
                {analysis && (
                  <Badge className={cn("text-[10px] font-mono font-bold border shadow-sm", verdictStyle.badge)}>
                    {analysis.verdict.badgeLabel}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {analysis?.name ? `${analysis.name} • ` : ''}Deconstructs current market price to reveal implied revenue growth, margins, and operational hurdle expectations.
              </DialogDescription>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading || isFetching}
              className="h-8 text-xs font-mono gap-1.5 border-border/70 hover:bg-accent/40"
            >
              {isLoading || isFetching ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
              ) : (
                <><RefreshCw className="w-3.5 h-3.5" /> Refresh</>
              )}
            </Button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <BrainCircuit className="w-7 h-7 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Running Reverse Valuation Decomposition</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Reverse-engineering Wall Street consensus, historical cash flows, and cost of capital to isolate what the market is pricing for {cleanSymbol}...
                </p>
              </div>
            </div>
          ) : isError ? (
            <div className="p-8 rounded-2xl bg-destructive/10 border border-destructive/30 text-center space-y-3">
              <ShieldAlert className="w-10 h-10 text-destructive mx-auto" />
              <h3 className="text-base font-bold text-destructive">Implied Expectations Engine Error</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {error?.message || 'Unable to execute reverse valuation analysis for this ticker.'}
              </p>
              <Button size="sm" variant="outline" onClick={() => refetch()} className="text-xs">
                Retry Analysis
              </Button>
            </div>
          ) : analysis ? (
            <>
              {/* ================= HERO EXECUTIVE HUD BAR ================= */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Implied Revenue Growth */}
                <Card className="bg-card/70 border-border/70 p-4 rounded-xl shadow-sm border-l-4 border-l-indigo-500">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block font-sans">
                      Implied 5Y Revenue CAGR
                    </span>
                    <Badge variant="outline" className="text-[9px] font-mono border-indigo-500/30 text-indigo-300">
                      Required
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black font-mono text-foreground">
                      +{analysis.impliedGrowth.horizon5YGrowthPct}%
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">/ year</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Consensus: +{analysis.benchmarks.consensusRevenueGrowthFY1}% (Gap: {analysis.benchmarks.expectationsGapPct >= 0 ? '+' : ''}{analysis.benchmarks.expectationsGapPct}%)
                  </p>
                </Card>

                {/* 2. Implied Target Operating Margin */}
                <Card className="bg-card/70 border-border/70 p-4 rounded-xl shadow-sm border-l-4 border-l-cyan-500">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block font-sans">
                      Implied Operating Margin
                    </span>
                    <Badge variant="outline" className="text-[9px] font-mono border-cyan-500/30 text-cyan-300">
                      Target
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black font-mono text-foreground">
                      {analysis.impliedGrowth.impliedTargetMarginPct}%
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">EBIT</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Current TTM: {analysis.currentOperatingMargin}% ({analysis.benchmarks.marginExpectationsGapPct >= 0 ? '+' : ''}{analysis.benchmarks.marginExpectationsGapPct}% required)
                  </p>
                </Card>

                {/* 3. Implied Exit Multiple */}
                <Card className="bg-card/70 border-border/70 p-4 rounded-xl shadow-sm border-l-4 border-l-purple-500">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block font-sans">
                      Implied Terminal Multiple
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">WACC: {analysis.wacc}%</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black font-mono text-foreground">
                      {analysis.impliedGrowth.impliedTerminalMultiple}x
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">P/E</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Forward P/E: {analysis.forwardPE}x • Trailing: {analysis.trailingPE}x
                  </p>
                </Card>

                {/* 4. Expectation Risk Score */}
                <Card className={cn("p-4 rounded-xl shadow-sm border-l-4", verdictStyle.card)}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block font-sans">
                      Expectation Risk Barometer
                    </span>
                    <span className={cn("text-xs font-mono font-bold", verdictStyle.text)}>
                      {analysis.verdict.sentiment}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className={cn("text-2xl font-black font-mono", verdictStyle.text)}>
                      {analysis.verdict.riskScore}/100
                    </span>
                    <span className="text-[10px] text-muted-foreground">Hurdle Score</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-border/60 overflow-hidden mt-2">
                    <div
                      className={cn(
                        "h-full transition-all duration-500 rounded-full",
                        analysis.verdict.riskScore >= 75 ? "bg-rose-500" :
                        analysis.verdict.riskScore >= 55 ? "bg-amber-500" :
                        analysis.verdict.riskScore >= 35 ? "bg-cyan-400" : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, analysis.verdict.riskScore))}%` }}
                    />
                  </div>
                </Card>
              </div>

              {/* ================= TABS NAVIGATION ================= */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full space-y-4">
                <TabsList className="bg-card/70 border border-border/70 p-1 rounded-xl flex-wrap h-auto">
                  <TabsTrigger value="synthesis" className="text-xs font-bold gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-indigo-400" /> What's Priced In (Agent Synthesis)
                  </TabsTrigger>
                  <TabsTrigger value="benchmarks" className="text-xs font-bold gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-cyan-400" /> Expectation Benchmarks & Gaps
                  </TabsTrigger>
                  <TabsTrigger value="scenarios" className="text-xs font-bold gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-rose-400" /> Downside De-Rating Scenarios
                  </TabsTrigger>
                  <TabsTrigger value="simulator" className="text-xs font-bold gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Interactive "What-If" Sandbox
                  </TabsTrigger>
                </TabsList>

                {/* ================= TAB 1: WHAT'S PRICED IN (AGENT SYNTHESIS) ================= */}
                <TabsContent value="synthesis" className="space-y-4">
                  {/* Executive Briefing Banner */}
                  <div className={cn("p-4 rounded-2xl border space-y-3", verdictStyle.card)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className={cn("w-5 h-5", verdictStyle.iconColor)} />
                        <h4 className="text-sm font-bold text-foreground">
                          {analysis.verdict.headline}
                        </h4>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                        {analysis.agentSynthesis.source === 'LLM_SYNTHESIS' ? 'AI Strategist' : 'Quant Reverse Engine'}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed font-sans">
                      {analysis.agentSynthesis.executiveSummary}
                    </p>
                  </div>

                  {/* The Market's Hurdle Checklist */}
                  <Card className="p-4 bg-card/60 border-border/70 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-indigo-400" />
                        The Market's Hurdle Checklist: What {cleanSymbol} Must Deliver
                      </h4>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Required performance to avoid multiple de-rating
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {analysis.hurdleChecklist.map((m) => (
                        <div key={m.period} className="p-3 rounded-xl bg-card/70 border border-border/70 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-foreground">{m.period} Target</span>
                            <Badge className={cn("text-[9px] font-mono font-bold border", getDifficultyBadge(m.difficultyRating))}>
                              {m.difficultyRating}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground font-medium">{m.label}</div>
                          <div className="space-y-1 pt-1 font-mono text-xs border-t border-border/40">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground text-[11px]">Revenue:</span>
                              <span className="font-bold text-foreground">${m.requiredRevenueBillions}B</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground text-[11px]">Growth Required:</span>
                              <span className="font-bold text-indigo-400">+{m.requiredYoYGrowthPct}%/yr</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground text-[11px]">Target Operating Margin:</span>
                              <span className="font-bold text-cyan-400">{m.requiredMarginPct}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground text-[11px]">Implied EPS:</span>
                              <span className="font-bold text-emerald-400">${m.requiredEps}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Vulnerability & Catalyst Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Key Vulnerability */}
                    <Card className="p-4 bg-rose-500/10 border-rose-500/25 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span>Key Valuation Vulnerability & Pressure Point</span>
                      </div>
                      <p className="text-xs text-foreground/85 leading-relaxed font-sans">
                        {analysis.agentSynthesis.keyVulnerability}
                      </p>
                    </Card>

                    {/* Catalyst Threshold */}
                    <Card className="p-4 bg-emerald-500/10 border-emerald-500/25 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <span>Upside Catalyst Threshold</span>
                      </div>
                      <p className="text-xs text-foreground/85 leading-relaxed font-sans">
                        {analysis.agentSynthesis.catalystThreshold}
                      </p>
                    </Card>
                  </div>

                  {/* Next Earnings Callout */}
                  <div className="p-3 px-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center gap-2.5 text-xs">
                    <Info className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-foreground/90 font-medium">
                      <strong>Earnings Hurdle:</strong> {analysis.agentSynthesis.earningsHurdleText}
                    </span>
                  </div>
                </TabsContent>

                {/* ================= TAB 2: BENCHMARKS & GAPS ================= */}
                <TabsContent value="benchmarks" className="space-y-4">
                  <Card className="p-4 bg-card/60 border-border/70 rounded-2xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                          Expectations Gap: Implied Growth vs Reality Benchmarks
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Compares what the current stock price requires against Wall Street forecasts and historical delivery.
                        </p>
                      </div>
                      <Badge variant="outline" className={cn("text-xs font-mono font-bold", verdictStyle.badge)}>
                        Expectations Gap: {analysis.benchmarks.expectationsGapPct >= 0 ? '+' : ''}{analysis.benchmarks.expectationsGapPct}%
                      </Badge>
                    </div>

                    <div className="h-56 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={benchmarkChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                          <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontFamily="monospace" />
                          <YAxis stroke="#64748b" fontSize={10} fontFamily="monospace" tickFormatter={(v) => `+${v}%`} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const p = payload[0].payload;
                              return (
                                <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-2.5 rounded-xl shadow-xl text-xs font-mono">
                                  <p className="font-bold text-foreground">{p.name}</p>
                                  <p className="text-primary font-bold">Annual Growth: +{p.growth}%</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.label}</p>
                                </div>
                              );
                            }}
                          />
                          <ReferenceLine y={0} stroke="#64748b" />
                          <Bar dataKey="growth" radius={[6, 6, 0, 0]}>
                            {benchmarkChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Explanation Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-card/60 border border-border/50">
                        <span className="text-[10px] text-muted-foreground uppercase font-sans">Wall St Consensus (FY1)</span>
                        <div className="text-lg font-bold text-indigo-400 mt-0.5">+{analysis.benchmarks.consensusRevenueGrowthFY1}%</div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">Next 12-month sell-side estimate</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-card/60 border border-border/50">
                        <span className="text-[10px] text-muted-foreground uppercase font-sans">3-Year Historical CAGR</span>
                        <div className="text-lg font-bold text-cyan-400 mt-0.5">+{analysis.benchmarks.historicalRevenue3YCagr}%</div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">Track record of actual delivery</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-card/60 border border-border/50">
                        <span className="text-[10px] text-muted-foreground uppercase font-sans">Market Implied Hurdle</span>
                        <div className={cn("text-lg font-bold mt-0.5", verdictStyle.text)}>+{analysis.impliedGrowth.horizon5YGrowthPct}%</div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-sans">Growth required by current price</p>
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                {/* ================= TAB 3: DOWNSIDE RISK SCENARIOS ================= */}
                <TabsContent value="scenarios" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {analysis.downsideScenarios.map((sc) => {
                      const isNegative = sc.priceChangePct < 0;
                      return (
                        <Card
                          key={sc.name}
                          className={cn(
                            "p-4 rounded-xl border space-y-2.5 shadow-sm transition-all",
                            sc.impactVerdict === 'SEVERE_DOWNSIDE' ? "bg-rose-500/10 border-rose-500/30" :
                            sc.impactVerdict === 'MODERATE_DOWNSIDE' ? "bg-amber-500/10 border-amber-500/30" :
                            sc.impactVerdict === 'EXPANSION_UPSIDE' ? "bg-emerald-500/10 border-emerald-500/30" :
                            "bg-cyan-500/10 border-cyan-500/30"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground font-sans">
                              {sc.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-mono font-bold",
                                isNegative ? "text-rose-400 border-rose-500/30" : "text-emerald-400 border-emerald-500/30"
                              )}
                            >
                              Growth: +{sc.assumedGrowthPct}%
                            </Badge>
                          </div>

                          <div className="flex items-baseline justify-between pt-1">
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase font-mono block">Implied Price</span>
                              <span className="text-xl font-black font-mono text-foreground">${sc.impliedStockPrice.toFixed(2)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-muted-foreground uppercase font-mono block">Impact</span>
                              <span className={cn("text-base font-black font-mono", isNegative ? "text-rose-400" : "text-emerald-400")}>
                                {isNegative ? '' : '+'}{sc.priceChangePct}%
                              </span>
                            </div>
                          </div>

                          <p className="text-[11px] text-muted-foreground leading-relaxed font-sans border-t border-border/40 pt-2">
                            {sc.description}
                          </p>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* ================= TAB 4: INTERACTIVE "WHAT-IF" SANDBOX ================= */}
                <TabsContent value="simulator" className="space-y-4">
                  <Card className="p-5 bg-card/60 border-border/70 rounded-2xl shadow-inner space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          Interactive Reverse Valuation Simulator
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Adjust growth assumptions to immediately see what fair value the stock would gravitate to.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSimulatedGrowth(analysis.impliedGrowth.horizon5YGrowthPct)}
                        className="h-7 text-[11px] font-mono"
                      >
                        Reset to Implied (+{analysis.impliedGrowth.horizon5YGrowthPct}%)
                      </Button>
                    </div>

                    {/* Growth Slider */}
                    <div className="space-y-3 p-4 bg-card/70 rounded-xl border border-border/60">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-primary" />
                          Simulated Annual 5-Year Revenue Growth:
                        </label>
                        <span className="text-base font-black font-mono text-primary">
                          +{activeSimGrowth.toFixed(1)}% / yr
                        </span>
                      </div>
                      <Slider
                        min={-5}
                        max={45}
                        step={0.5}
                        value={[activeSimGrowth]}
                        onValueChange={(val) => setSimulatedGrowth(val[0])}
                      />
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                        <span>-5% (Contraction)</span>
                        <span>Consensus: +{analysis.benchmarks.consensusRevenueGrowthFY1}%</span>
                        <span>Current Implied: +{analysis.impliedGrowth.horizon5YGrowthPct}%</span>
                        <span>+45% (Hypergrowth)</span>
                      </div>
                    </div>

                    {/* Result Callout Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-card/80 border border-border/70 space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-mono">
                          Simulated Fair Value at +{activeSimGrowth.toFixed(1)}% Growth
                        </span>
                        <div className="text-2xl font-black font-mono text-foreground">
                          ${simulatedPriceResult.price.toFixed(2)}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Current Market Price: ${effectivePrice.toFixed(2)}
                        </p>
                      </div>

                      <div className={cn(
                        "p-4 rounded-xl border space-y-1",
                        simulatedPriceResult.returnPct >= 0
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : "bg-rose-500/10 border-rose-500/30"
                      )}>
                        <span className="text-[10px] text-muted-foreground uppercase font-mono">
                          Valuation Delta from Current Price
                        </span>
                        <div className={cn(
                          "text-2xl font-black font-mono",
                          simulatedPriceResult.returnPct >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                          {simulatedPriceResult.returnPct >= 0 ? '+' : ''}{simulatedPriceResult.returnPct}%
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {simulatedPriceResult.returnPct >= 0
                            ? 'Upside if company delivers this acceleration'
                            : 'De-rating risk if execution slows to this rate'}
                        </p>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
