import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Input } from '@/components/ui/input';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  HelpCircle,
  Info,
  Layers,
  LineChart as LineChartIcon,
  Loader2,
  Percent,
  Play,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldAlert,
  Sliders,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import {
  useMonteCarloSimulation,
  useRunMonteCarloSimulation,
  useCompanyBaselines,
  useValuationAgentScenarios,
  MonteCarloSimulationResult,
  ValuationAgentScenarioResponse,
} from '@/services/monteCarloService';
import {
  calculateValuationForecast,
  getScenarioPresets,
  ValuationInputs,
  ValuationForecastResult,
} from '@/services/valuationForecastEngine';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MonteCarloSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice?: number;
}

export function MonteCarloSimulationModal({
  isOpen,
  onClose,
  symbol,
  currentPrice,
}: MonteCarloSimulationModalProps) {
  const cleanSymbol = (symbol || '').trim().toUpperCase();

  // Fullscreen State
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'forecast' | 'table' | 'sensitivity' | 'stochastic'>('forecast');
  const [showStartingOverrides, setShowStartingOverrides] = useState<boolean>(false);

  // Fetch company baselines (fast ~200ms, does not run heavy python simulation)
  const { data: baselines, isLoading: isBaselinesLoading } = useCompanyBaselines(cleanSymbol, isOpen);

  // Monte Carlo simulation hook - note enabled is false so it NEVER runs automatically
  const [trials, setTrials] = useState<number>(10000);
  const [shouldRunStochastic, setShouldRunStochastic] = useState<boolean>(false);

  const {
    data: simulation,
    isLoading: isSimLoading,
    isError: isSimError,
    error: simError,
    refetch: refetchSimulation,
    isFetching: isSimFetching,
  } = useMonteCarloSimulation(cleanSymbol, {
    trials,
    horizon: 5,
    enabled: shouldRunStochastic && isOpen && Boolean(cleanSymbol),
  });

  const runMutation = useRunMonteCarloSimulation();

  // Interactive Valuation Assumptions State
  const [inputs, setInputs] = useState<ValuationInputs>({
    startingPrice: currentPrice || 100,
    startingRevenue: 50,
    startingMargin: 20,
    startingShares: 1,
    revenueGrowthRate: 10,
    targetMargin: 20,
    exitMultiple: 22,
    discountRate: 10,
    annualShareChangePct: -1.0,
    horizonYears: 5,
  });

  // Track if user customized or selected a preset
  const [activePreset, setActivePreset] = useState<'CUSTOM' | 'BEAR' | 'BASE' | 'BULL'>('BASE');

  // AI Valuation Scenario Agent Hook & State
  const agentScenariosMutation = useValuationAgentScenarios();
  const [aiReport, setAiReport] = useState<ValuationAgentScenarioResponse | null>(null);
  const [isAiCardExpanded, setIsAiCardExpanded] = useState<boolean>(true);
  const initializedSymbolRef = useRef<string | null>(null);

  // Reset AI report when ticker changes
  useEffect(() => {
    setAiReport(null);
    initializedSymbolRef.current = null;
  }, [cleanSymbol]);

  const handleRunValuationAgent = async () => {
    try {
      toast.info(`AI Agent is researching ${cleanSymbol} fundamentals and estimating highest-probability trajectory...`);
      const result = await agentScenariosMutation.mutateAsync({
        ticker: cleanSymbol,
        currentPrice: currentPrice || inputs.startingPrice,
        horizonYears: inputs.horizonYears,
      });

      setAiReport(result);
      setActivePreset('BASE');
      setIsAiCardExpanded(true);
      initializedSymbolRef.current = cleanSymbol;

      // Auto-fill all fields with highest probability Base Case
      if (result.recommendedInputs) {
        setInputs({
          startingPrice: result.recommendedInputs.startingPrice || inputs.startingPrice,
          startingRevenue: result.recommendedInputs.startingRevenue || inputs.startingRevenue,
          startingMargin: result.recommendedInputs.startingMargin || inputs.startingMargin,
          startingShares: result.recommendedInputs.startingShares || inputs.startingShares,
          revenueGrowthRate: result.recommendedInputs.revenueGrowthRate,
          targetMargin: result.recommendedInputs.targetMargin,
          exitMultiple: result.recommendedInputs.exitMultiple,
          discountRate: result.recommendedInputs.discountRate,
          annualShareChangePct: result.recommendedInputs.annualShareChangePct,
          horizonYears: result.recommendedInputs.horizonYears || inputs.horizonYears,
        });
      }

      toast.success(`✨ AI Agent populated highest-probability valuation trajectory for ${cleanSymbol}!`);
    } catch (err: any) {
      toast.error(`AI Valuation Agent failed: ${err.message}`);
    }
  };

  const handleApplyAiScenario = (scenarioKey: 'base' | 'bull' | 'bear') => {
    if (!aiReport) return;
    const s = aiReport.scenarios[scenarioKey];
    if (s) {
      setActivePreset(scenarioKey.toUpperCase() as any);
      setInputs((prev) => ({
        ...prev,
        revenueGrowthRate: s.revenueGrowthRate,
        targetMargin: s.targetMargin,
        exitMultiple: s.exitMultiple,
        discountRate: s.discountRate,
        annualShareChangePct: s.annualShareChangePct,
        horizonYears: s.horizonYears,
      }));
      toast.info(`Applied AI ${s.name} assumptions.`);
    }
  };

  // Populate initial assumptions when baselines or currentPrice arrive
  useEffect(() => {
    if (aiReport) return;
    if (initializedSymbolRef.current === cleanSymbol) return;

    if (baselines) {
      initializedSymbolRef.current = cleanSymbol;
      const revB = baselines.revenueBillions > 0 ? baselines.revenueBillions : (baselines.revenue ? baselines.revenue / 1e9 : 50);
      const sharesB = baselines.sharesOutstandingBillions > 0 ? baselines.sharesOutstandingBillions : (baselines.sharesOutstanding ? baselines.sharesOutstanding / 1e9 : 1);
      const price = currentPrice || baselines.currentPrice || 100;
      const margin = baselines.operatingMargin || 20;
      const pe = baselines.trailingPE || baselines.forwardPE || 22;
      const growth = baselines.revenueGrowth != null ? Math.max(-10, Math.min(35, baselines.revenueGrowth)) : 10;

      setInputs((prev) => ({
        ...prev,
        startingPrice: Number(price.toFixed(2)),
        startingRevenue: Number(revB.toFixed(2)),
        startingMargin: Number(margin.toFixed(1)),
        startingShares: Number(sharesB.toFixed(3)),
        revenueGrowthRate: Number(growth.toFixed(1)),
        targetMargin: Number(margin.toFixed(1)),
        exitMultiple: Number(pe.toFixed(1)),
      }));
    } else if (currentPrice && currentPrice > 0) {
      setInputs((prev) => ({
        ...prev,
        startingPrice: Number(currentPrice.toFixed(2)),
      }));
    }
  }, [baselines, currentPrice, cleanSymbol, aiReport]);

  // Compute deterministic valuation forecast instantly on any assumption change
  const forecastResult = useMemo<ValuationForecastResult>(() => {
    return calculateValuationForecast(inputs);
  }, [inputs]);

  // Handle Scenario Presets
  const handleApplyPreset = (preset: 'BEAR' | 'BASE' | 'BULL') => {
    setActivePreset(preset);
    const presets = getScenarioPresets(inputs);
    const chosen = presets[preset];
    if (chosen) {
      setInputs((prev) => ({
        ...prev,
        revenueGrowthRate: chosen.revenueGrowthRate,
        targetMargin: chosen.targetMargin,
        exitMultiple: chosen.exitMultiple,
        annualShareChangePct: chosen.annualShareChangePct,
      }));
      toast.info(`Applied ${preset} scenario assumptions.`);
    }
  };

  const handleResetBaselines = () => {
    setActivePreset('BASE');
    if (baselines) {
      const revB = baselines.revenueBillions > 0 ? baselines.revenueBillions : (baselines.revenue ? baselines.revenue / 1e9 : 50);
      const sharesB = baselines.sharesOutstandingBillions > 0 ? baselines.sharesOutstandingBillions : (baselines.sharesOutstanding ? baselines.sharesOutstanding / 1e9 : 1);
      const price = currentPrice || baselines.currentPrice || 100;
      const margin = baselines.operatingMargin || 20;
      const pe = baselines.trailingPE || baselines.forwardPE || 22;
      const growth = baselines.revenueGrowth != null ? Math.max(-10, Math.min(35, baselines.revenueGrowth)) : 10;

      setInputs({
        startingPrice: Number(price.toFixed(2)),
        startingRevenue: Number(revB.toFixed(2)),
        startingMargin: Number(margin.toFixed(1)),
        startingShares: Number(sharesB.toFixed(3)),
        revenueGrowthRate: Number(growth.toFixed(1)),
        targetMargin: Number(margin.toFixed(1)),
        exitMultiple: Number(pe.toFixed(1)),
        discountRate: 10,
        annualShareChangePct: -1.0,
        horizonYears: 5,
      });
      toast.success(`Reset assumptions to ${cleanSymbol} reported baselines.`);
    }
  };

  // Explicit user trigger for stochastic Monte Carlo
  const handleRunStochastic = async () => {
    setShouldRunStochastic(true);
    try {
      toast.info(`Running ${trials.toLocaleString()} stochastic economic paths for ${cleanSymbol}...`);
      await runMutation.mutateAsync({
        ticker: cleanSymbol,
        trials,
        horizon: inputs.horizonYears,
        noCache: true,
      });
      await refetchSimulation();
      toast.success(`Stochastic simulation completed for ${cleanSymbol}!`);
    } catch (err: any) {
      toast.error(`Stochastic simulation failed: ${err.message}`);
    }
  };

  // Metrics resolution (compatible with both stochastic simulation result if loaded, and deterministic valuation)
  const effectivePrice = currentPrice || simulation?.current_market_price || inputs.startingPrice;
  const medianValue = simulation ? simulation.median_intrinsic_value : forecastResult.discountedFairValue;
  const marginOfSafety = simulation ? simulation.expected_margin_of_safety_pct : forecastResult.marginOfSafetyPct;
  const isUndervalued = marginOfSafety > 0;
  const probUndervalued = simulation
    ? Math.round(simulation.prob_undervalued * 100)
    : forecastResult.marginOfSafetyPct > 25 ? 85 : forecastResult.marginOfSafetyPct > 0 ? 65 : 35;

  const terminalYearPoint = forecastResult.path[forecastResult.path.length - 1];

  // Scenarios display data
  const scenariosData = useMemo(() => {
    if (aiReport) {
      const s = aiReport.scenarios;
      const bearTerminal = forecastResult.bearPath[forecastResult.bearPath.length - 1];
      const bullTerminal = forecastResult.bullPath[forecastResult.bullPath.length - 1];
      return {
        bear: {
          name: s.bear.name,
          probability: s.bear.probability,
          intrinsic_value: bearTerminal ? bearTerminal.projectedPrice : inputs.startingPrice * 0.8,
          upside_downside_pct: bearTerminal ? bearTerminal.cumulativeReturnPct : -20,
          description: s.bear.description,
        },
        base: {
          name: s.base.name,
          probability: s.base.probability,
          intrinsic_value: terminalYearPoint ? terminalYearPoint.projectedPrice : inputs.startingPrice * 1.2,
          upside_downside_pct: terminalYearPoint ? terminalYearPoint.cumulativeReturnPct : 20,
          description: s.base.description,
        },
        bull: {
          name: s.bull.name,
          probability: s.bull.probability,
          intrinsic_value: bullTerminal ? bullTerminal.projectedPrice : inputs.startingPrice * 1.5,
          upside_downside_pct: bullTerminal ? bullTerminal.cumulativeReturnPct : 50,
          description: s.bull.description,
        },
      };
    }
    if (simulation) {
      return simulation.scenarios;
    }
    const bearTerminal = forecastResult.bearPath[forecastResult.bearPath.length - 1];
    const bullTerminal = forecastResult.bullPath[forecastResult.bullPath.length - 1];
    return {
      bear: {
        name: 'Bear Scenario',
        probability: 0.1,
        intrinsic_value: bearTerminal ? bearTerminal.projectedPrice : inputs.startingPrice * 0.8,
        upside_downside_pct: bearTerminal ? bearTerminal.cumulativeReturnPct : -20,
        description: 'Margin compression and lower multiple realization.',
      },
      base: {
        name: 'Base Case',
        probability: 0.5,
        intrinsic_value: terminalYearPoint ? terminalYearPoint.projectedPrice : inputs.startingPrice * 1.2,
        upside_downside_pct: terminalYearPoint ? terminalYearPoint.cumulativeReturnPct : 20,
        description: 'Target financial trajectory with custom assumptions.',
      },
      bull: {
        name: 'Bull Scenario',
        probability: 0.1,
        intrinsic_value: bullTerminal ? bullTerminal.projectedPrice : inputs.startingPrice * 1.5,
        upside_downside_pct: bullTerminal ? bullTerminal.cumulativeReturnPct : 50,
        description: 'Sustained top-line growth and multiple expansion.',
      },
    };
  }, [aiReport, simulation, forecastResult, terminalYearPoint, inputs.startingPrice]);

  // Format Stock Forecast Path Chart Data
  const forecastChartData = useMemo(() => {
    return forecastResult.path.map((pt, i) => {
      const bearPt = forecastResult.bearPath[i];
      const bullPt = forecastResult.bullPath[i];
      return {
        year: pt.year,
        yearLabel: pt.yearLabel,
        basePrice: pt.projectedPrice,
        bearPrice: bearPt ? bearPt.projectedPrice : pt.projectedPrice,
        bullPrice: bullPt ? bullPt.projectedPrice : pt.projectedPrice,
        revenue: pt.revenue,
        margin: pt.margin,
        eps: pt.epsOrFcfPerShare,
        returnPct: pt.cumulativeReturnPct,
      };
    });
  }, [forecastResult]);

  // Stochastic Distribution Chart Data
  const stochasticChartData = useMemo(() => {
    return (simulation?.raw_distribution || []).map((b) => ({
      price: Math.round(b.bin_midpoint),
      count: b.count,
      density: Number((b.density * 100).toFixed(3)),
      cumulative: Number((b.cumulative_probability * 100).toFixed(1)),
    }));
  }, [simulation]);

  const isLoadingStochastic = isSimLoading || runMutation.isPending || isSimFetching;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "overflow-y-auto bg-card/95 backdrop-blur-2xl shadow-2xl p-0 gap-0 scrollbar-thin transition-all duration-200",
          isFullScreen
            ? "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !border-0 !m-0 z-50"
            : "w-[95vw] sm:max-w-5xl max-h-[94vh] border border-border/80 rounded-2xl"
        )}
      >
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-indigo-600" />

        {/* Header Ribbon */}
        <div className="p-6 pb-4 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4 pr-14">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 via-indigo-500/20 to-teal-500/10 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
              <Calculator className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <DialogTitle className="text-2xl font-black font-mono tracking-tight text-foreground">
                  {cleanSymbol}
                </DialogTitle>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono font-bold uppercase">
                  Multi-Factor Monte Carlo
                </Badge>
                <Badge variant="secondary" className="text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  Interactive Forecast Studio
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                  {inputs.horizonYears}Y Horizon • {activePreset} Mode
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Full assumption control: project revenue growth, margins, exit multiples, and derive year-by-year stock price path.
              </DialogDescription>
            </div>
          </div>

          {/* Quick Scenario & Horizon Selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Horizon Pills */}
            <div className="flex items-center gap-1 bg-background/60 border border-border/60 rounded-xl p-1 text-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground px-1.5">Horizon:</span>
              {[3, 5, 7, 10].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setInputs((prev) => ({ ...prev, horizonYears: h }));
                  }}
                  className={cn(
                    "px-2 py-0.5 rounded-lg font-mono font-bold text-[11px] transition-all",
                    inputs.horizonYears === h
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {h}Y
                </button>
              ))}
            </div>

            {/* Scenario Quick Presets */}
            <div className="flex items-center gap-1 bg-background/60 border border-border/60 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => handleApplyPreset('BEAR')}
                className={cn(
                  "px-2 py-0.5 rounded-lg font-mono font-bold text-[11px] transition-all",
                  activePreset === 'BEAR'
                    ? "bg-rose-500 text-white shadow-sm"
                    : "text-rose-400 hover:text-rose-300"
                )}
              >
                Bear
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('BASE')}
                className={cn(
                  "px-2 py-0.5 rounded-lg font-mono font-bold text-[11px] transition-all",
                  activePreset === 'BASE'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Base
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('BULL')}
                className={cn(
                  "px-2 py-0.5 rounded-lg font-mono font-bold text-[11px] transition-all",
                  activePreset === 'BULL'
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-emerald-400 hover:text-emerald-300"
                )}
              >
                Bull
              </button>
              <button
                type="button"
                title="Reset to company reported baselines"
                onClick={handleResetBaselines}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-all"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            {/* AI Auto-Populate Highest Probability Scenarios Button */}
            <Button
              type="button"
              onClick={handleRunValuationAgent}
              disabled={agentScenariosMutation.isPending}
              className="h-8 text-xs font-bold gap-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-primary hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/20 hover:shadow-purple-500/40 rounded-xl transition-all px-3"
              title={`Call AI Research Agent to research ${cleanSymbol} and auto-populate highest-probability scenarios`}
            >
              {agentScenariosMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">AI Researching...</span>
                  <span className="sm:hidden">AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  <span>AI Auto-Populate</span>
                </>
              )}
            </Button>

            {/* Full Screen Toggle Button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setIsFullScreen((prev) => !prev)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-xl border-border/60 hover:bg-accent/40 shrink-0 transition-all shadow-sm"
              title={isFullScreen ? "Restore window size (Exit Fullscreen)" : "Full size simulate window (Fullscreen)"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Loading Indicator for Stochastic Execution */}
          {isLoadingStochastic ? (
            <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Cpu className="w-7 h-7 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Running 10,000 Trial Simulation</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Ingesting Treasury yield curves, implied inflation baselines, and historical operating metrics for {cleanSymbol}...
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* ================= HERO VALUATION SUMMARY CARDS ================= */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {/* 1. Current Price */}
                <Card className="bg-card/70 border-border/70 p-4 rounded-xl shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block font-sans">
                    Current Market Price
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black font-mono text-foreground">
                      ${effectivePrice.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">USD</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Baseline entry valuation
                  </p>
                </Card>

                {/* 2. Median Fair Value / Present Intrinsic Value */}
                <Card className="bg-card/70 border-border/70 p-4 rounded-xl shadow-sm border-l-4 border-l-cyan-500">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 block font-sans flex items-center gap-1">
                    <Scale className="w-3 h-3" /> Median Fair Value (P50)
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black font-mono text-foreground">
                      ${medianValue.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">Present PV</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Discounted at {inputs.discountRate}% required return
                  </p>
                </Card>

                {/* 3. Margin of Safety */}
                <Card className={cn(
                  "p-4 rounded-xl shadow-sm border-l-4",
                  isUndervalued
                    ? "bg-emerald-500/10 border-emerald-500/30 border-l-emerald-500"
                    : "bg-rose-500/10 border-rose-500/30 border-l-rose-500"
                )}>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block font-sans">
                    Expected Margin of Safety
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    {isUndervalued ? (
                      <ArrowUpRight className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <span className={cn(
                      "text-2xl font-black font-mono",
                      isUndervalued ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {isUndervalued ? '+' : ''}{marginOfSafety.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {isUndervalued ? 'Discount to Fair Value' : 'Premium to Fair Value'}
                  </p>
                </Card>

                {/* 4. Prob. Undervalued */}
                <Card className="bg-card/70 border-border/70 p-4 rounded-xl shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground font-sans">
                      Prob. Undervalued
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-mono font-bold px-1.5 py-0 h-4 border",
                        probUndervalued >= 70 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                        probUndervalued >= 50 ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" :
                        "bg-rose-500/15 text-rose-400 border-rose-500/30"
                      )}
                    >
                      {probUndervalued >= 70 ? 'High Margin' : probUndervalued >= 50 ? 'Moderate' : 'Stretched'}
                    </Badge>
                  </div>
                  <div className="text-2xl font-black font-mono text-foreground mt-1">
                    {probUndervalued}%
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-border/60 overflow-hidden mt-1.5">
                    <div
                      className={cn(
                        "h-full transition-all duration-500 rounded-full",
                        probUndervalued >= 70 ? "bg-emerald-500" :
                        probUndervalued >= 50 ? "bg-cyan-400" : "bg-rose-500"
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, probUndervalued))}%` }}
                    />
                  </div>
                </Card>

                {/* 5. Projected Target Price (Horizon Year N) */}
                <Card className="bg-card/70 border-border/70 p-4 rounded-xl shadow-sm border-l-4 border-l-primary">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-primary block font-sans flex items-center gap-1">
                      <Target className="w-3 h-3" /> Target ({inputs.horizonYears}Y)
                    </span>
                    <Badge variant="outline" className="text-[9px] font-mono text-primary border-primary/30">
                      {forecastResult.annualizedCagrPct >= 0 ? '+' : ''}{forecastResult.annualizedCagrPct.toFixed(1)}%/yr
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black font-mono text-foreground">
                      ${forecastResult.projectedTargetPrice.toFixed(2)}
                    </span>
                    <span className={cn("text-xs font-mono font-bold", forecastResult.totalReturnPct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {forecastResult.totalReturnPct >= 0 ? '+' : ''}{forecastResult.totalReturnPct.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Exit: {inputs.exitMultiple}x P/E on ${forecastResult.terminalEps.toFixed(2)} EPS
                  </p>
                </Card>
              </div>

              {/* ================= 3 SCENARIOS CARDS ================= */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Bear Case */}
                <div
                  onClick={() => aiReport ? handleApplyAiScenario('bear') : handleApplyPreset('BEAR')}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5",
                    activePreset === 'BEAR'
                      ? "bg-rose-500/15 border-rose-500/50 shadow-md"
                      : "bg-rose-500/10 border-rose-500/25 hover:border-rose-500/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-rose-400 flex items-center gap-1 font-mono">
                      <TrendingDown className="w-3.5 h-3.5" /> Bear Scenario (P10)
                    </span>
                    <Badge variant="outline" className="text-[9px] font-mono border-rose-500/40 text-rose-300">
                      {Math.round(scenariosData.bear.probability * 100)}% Prob
                    </Badge>
                  </div>
                  <div className="flex items-baseline justify-between pt-0.5">
                    <span className="text-xl font-black font-mono text-foreground">
                      ${scenariosData.bear.intrinsic_value.toFixed(2)}
                    </span>
                    <span className={cn("text-xs font-mono font-bold", scenariosData.bear.upside_downside_pct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {scenariosData.bear.upside_downside_pct >= 0 ? '+' : ''}{scenariosData.bear.upside_downside_pct.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {scenariosData.bear.description}
                  </p>
                </div>

                {/* Base Case */}
                <div
                  onClick={() => aiReport ? handleApplyAiScenario('base') : handleApplyPreset('BASE')}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5",
                    activePreset === 'BASE'
                      ? "bg-primary/15 border-primary/60 shadow-md"
                      : "bg-primary/10 border-primary/30 hover:border-primary/45"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-primary flex items-center gap-1 font-mono">
                      <Scale className="w-3.5 h-3.5" /> Base Case (P50 Median)
                    </span>
                    <Badge variant="outline" className="text-[9px] font-mono border-primary/40 text-primary">
                      {aiReport ? `${Math.round(scenariosData.base.probability * 100)}% Prob` : 'Active'}
                    </Badge>
                  </div>
                  <div className="flex items-baseline justify-between pt-0.5">
                    <span className="text-xl font-black font-mono text-foreground">
                      ${scenariosData.base.intrinsic_value.toFixed(2)}
                    </span>
                    <span className={cn("text-xs font-mono font-bold", scenariosData.base.upside_downside_pct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {scenariosData.base.upside_downside_pct >= 0 ? '+' : ''}{scenariosData.base.upside_downside_pct.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {scenariosData.base.description}
                  </p>
                </div>

                {/* Bull Case */}
                <div
                  onClick={() => aiReport ? handleApplyAiScenario('bull') : handleApplyPreset('BULL')}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5",
                    activePreset === 'BULL'
                      ? "bg-emerald-500/15 border-emerald-500/50 shadow-md"
                      : "bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-emerald-400 flex items-center gap-1 font-mono">
                      <TrendingUp className="w-3.5 h-3.5" /> Bull Scenario (P90)
                    </span>
                    <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/40 text-emerald-300">
                      {Math.round(scenariosData.bull.probability * 100)}% Prob
                    </Badge>
                  </div>
                  <div className="flex items-baseline justify-between pt-0.5">
                    <span className="text-xl font-black font-mono text-foreground">
                      ${scenariosData.bull.intrinsic_value.toFixed(2)}
                    </span>
                    <span className={cn("text-xs font-mono font-bold", scenariosData.bull.upside_downside_pct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {scenariosData.bull.upside_downside_pct >= 0 ? '+' : ''}{scenariosData.bull.upside_downside_pct.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {scenariosData.bull.description}
                  </p>
                </div>
              </div>

              {/* ================= INTERACTIVE TABS ================= */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full space-y-4">
                <TabsList className="bg-card/70 border border-border/70 p-1 rounded-xl flex-wrap h-auto">
                  <TabsTrigger value="forecast" className="text-xs font-bold gap-1.5">
                    <LineChartIcon className="w-3.5 h-3.5 text-primary" /> Forecast Path & Assumptions
                  </TabsTrigger>
                  <TabsTrigger value="table" className="text-xs font-bold gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" /> Year-by-Year Financials
                  </TabsTrigger>
                  <TabsTrigger value="sensitivity" className="text-xs font-bold gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-400" /> 2D Sensitivity Grid
                  </TabsTrigger>
                  <TabsTrigger value="stochastic" className="text-xs font-bold gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Stochastic Monte Carlo
                  </TabsTrigger>
                </TabsList>

                {/* ================= TAB 1: FORECAST PATH & ASSUMPTIONS STUDIO ================= */}
                <TabsContent value="forecast" className="space-y-5">
                  {/* Stock Forecast Path Chart */}
                  <Card className="bg-card/60 border-border/70 p-4 rounded-2xl shadow-inner">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <LineChartIcon className="w-3.5 h-3.5 text-primary" />
                          Stock Price Trajectory ({inputs.horizonYears}-Year Forecast Path)
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Dynamic path calculated in real-time from growth CAGR, margin expansion, and exit P/E multiple.
                        </p>
                      </div>

                      {/* Legend Chips */}
                      <div className="flex items-center gap-3 text-[10px] font-mono font-bold flex-wrap">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-0.5 bg-amber-400 inline-block" /> Current (${effectivePrice.toFixed(0)})
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-0.5 bg-primary inline-block" /> Base Path
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" /> Bull Corridor
                        </span>
                        <span className="flex items-center gap-1 text-rose-400">
                          <span className="w-2.5 h-0.5 bg-rose-400 inline-block" /> Bear Corridor
                        </span>
                      </div>
                    </div>

                    <div className={cn("w-full transition-all duration-200", isFullScreen ? "h-96" : "h-64")}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={forecastChartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="basePathGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="bullPathGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="yearLabel"
                            stroke="#64748b"
                            fontSize={10}
                            fontFamily="monospace"
                          />
                          <YAxis
                            stroke="#64748b"
                            fontSize={10}
                            fontFamily="monospace"
                            tickFormatter={(val) => `$${val}`}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const p = payload[0].payload;
                              return (
                                <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-3 rounded-xl shadow-xl text-xs font-mono space-y-1">
                                  <p className="font-bold text-foreground text-sm">{p.yearLabel}</p>
                                  <p className="text-primary font-bold">Projected Price: ${p.basePrice.toFixed(2)}</p>
                                  <p className="text-muted-foreground text-[11px]">
                                    Return: {p.returnPct >= 0 ? '+' : ''}{p.returnPct.toFixed(1)}%
                                  </p>
                                  <div className="border-t border-border/40 pt-1 text-[10px] text-muted-foreground space-y-0.5">
                                    <p>EPS: ${p.eps.toFixed(2)} • Rev: ${p.revenue.toFixed(1)}B</p>
                                    <p>Operating Margin: {p.margin.toFixed(1)}%</p>
                                    <p className="text-emerald-400">Bull Target: ${p.bullPrice.toFixed(2)}</p>
                                    <p className="text-rose-400">Bear Target: ${p.bearPrice.toFixed(2)}</p>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <ReferenceLine
                            y={effectivePrice}
                            stroke="#f59e0b"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            label={{
                              value: `Current: $${effectivePrice.toFixed(0)}`,
                              position: 'insideBottomLeft',
                              fill: '#f59e0b',
                              fontSize: 10,
                              fontFamily: 'monospace',
                              fontWeight: 'bold',
                            }}
                          />
                          {/* Bull Case Corridor */}
                          <Area
                            type="monotone"
                            dataKey="bullPrice"
                            stroke="#10b981"
                            strokeWidth={1.5}
                            strokeDasharray="3 3"
                            fill="url(#bullPathGradient)"
                          />
                          {/* Bear Case Line */}
                          <Line
                            type="monotone"
                            dataKey="bearPrice"
                            stroke="#f43f5e"
                            strokeWidth={1.5}
                            strokeDasharray="3 3"
                            dot={false}
                          />
                          {/* Base Forecast Area & Line */}
                          <Area
                            type="monotone"
                            dataKey="basePrice"
                            stroke="#6366f1"
                            strokeWidth={3}
                            fill="url(#basePathGradient)"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* AI Valuation Scenario Intelligence & Justifications Card */}
                  {aiReport && (
                    <Card className="bg-gradient-to-br from-purple-950/25 via-card/95 to-indigo-950/20 border border-purple-500/35 rounded-2xl shadow-xl overflow-hidden p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-500/20 pb-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/25 via-indigo-500/25 to-primary/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-sm shrink-0">
                            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                AI Valuation Intelligence & Parameter Justifications
                              </h4>
                              <Badge variant="outline" className="text-[9px] font-mono font-bold uppercase bg-purple-500/15 text-purple-300 border-purple-500/40">
                                {cleanSymbol} • Highest-Probability Thesis
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Institutional synthesis of growth runway, operating leverage, terminal multiple, and cost of capital.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            onClick={handleRunValuationAgent}
                            disabled={agentScenariosMutation.isPending}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs font-semibold gap-1.5 border-purple-500/30 text-purple-300 hover:bg-purple-500/15"
                          >
                            <RefreshCw className={cn("w-3 h-3", agentScenariosMutation.isPending && "animate-spin text-primary")} />
                            <span>Re-Run AI</span>
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsAiCardExpanded(!isAiCardExpanded)}
                            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                          >
                            {isAiCardExpanded ? (
                              <><ChevronUp className="w-3.5 h-3.5" /> <span>Collapse</span></>
                            ) : (
                              <><ChevronDown className="w-3.5 h-3.5" /> <span>Expand Rationales</span></>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Executive Summary */}
                      <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-foreground/90 leading-relaxed font-sans">
                        <span className="font-bold text-purple-300 font-mono uppercase text-[10px] tracking-wider block mb-1">
                          Valuation Thesis & Setup
                        </span>
                        {aiReport.executiveSummary}
                      </div>

                      {/* 1-Click Scenario Appliers */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono block">
                          Apply AI Scenarios ({aiReport.scenarios.base.horizonYears}Y Horizon):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => handleApplyAiScenario('base')}
                            className={cn(
                              "p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between gap-1",
                              activePreset === 'BASE'
                                ? "bg-primary/20 border-primary shadow-sm ring-1 ring-primary/40"
                                : "bg-card/50 hover:bg-primary/10 border-border/60 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-primary flex items-center gap-1 font-mono">
                                <Scale className="w-3.5 h-3.5" /> Base Case ({(aiReport.scenarios.base.probability * 100).toFixed(0)}% Prob)
                              </span>
                              {activePreset === 'BASE' && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </div>
                            <span className="text-[10px] font-mono text-foreground/80">
                              {aiReport.scenarios.base.revenueGrowthRate}% CAGR • {aiReport.scenarios.base.targetMargin}% Mgn • {aiReport.scenarios.base.exitMultiple}x PE
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApplyAiScenario('bull')}
                            className={cn(
                              "p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between gap-1",
                              activePreset === 'BULL'
                                ? "bg-emerald-500/20 border-emerald-500 shadow-sm ring-1 ring-emerald-500/40"
                                : "bg-card/50 hover:bg-emerald-500/10 border-border/60 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 font-mono">
                                <TrendingUp className="w-3.5 h-3.5" /> Bull Case ({(aiReport.scenarios.bull.probability * 100).toFixed(0)}% Prob)
                              </span>
                              {activePreset === 'BULL' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                            </div>
                            <span className="text-[10px] font-mono text-foreground/80">
                              {aiReport.scenarios.bull.revenueGrowthRate}% CAGR • {aiReport.scenarios.bull.targetMargin}% Mgn • {aiReport.scenarios.bull.exitMultiple}x PE
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApplyAiScenario('bear')}
                            className={cn(
                              "p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between gap-1",
                              activePreset === 'BEAR'
                                ? "bg-rose-500/20 border-rose-500 shadow-sm ring-1 ring-rose-500/40"
                                : "bg-card/50 hover:bg-rose-500/10 border-border/60 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-rose-400 flex items-center gap-1 font-mono">
                                <TrendingDown className="w-3.5 h-3.5" /> Bear Case ({(aiReport.scenarios.bear.probability * 100).toFixed(0)}% Prob)
                              </span>
                              {activePreset === 'BEAR' && <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                            </div>
                            <span className="text-[10px] font-mono text-foreground/80">
                              {aiReport.scenarios.bear.revenueGrowthRate}% CAGR • {aiReport.scenarios.bear.targetMargin}% Mgn • {aiReport.scenarios.bear.exitMultiple}x PE
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Parameter Justifications Grid */}
                      {isAiCardExpanded && (
                        <div className="space-y-2 pt-1 border-t border-purple-500/20">
                          <span className="text-[10px] uppercase font-bold text-purple-300/80 font-mono block">
                            Parameter Rationales & Mathematical Justifications:
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            {/* Revenue Growth Justification */}
                            <div className="p-3 rounded-xl bg-card/60 border border-border/60 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground flex items-center gap-1.5 font-mono text-[11px]">
                                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                  Revenue Growth ({inputs.revenueGrowthRate}% CAGR)
                                </span>
                                <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/30 text-emerald-300">
                                  Top-Line
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {aiReport.justifications.revenueGrowth}
                              </p>
                            </div>

                            {/* Target Margin Justification */}
                            <div className="p-3 rounded-xl bg-card/60 border border-border/60 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground flex items-center gap-1.5 font-mono text-[11px]">
                                  <Percent className="w-3.5 h-3.5 text-indigo-400" />
                                  Operating Margin ({inputs.targetMargin}%)
                                </span>
                                <Badge variant="outline" className="text-[9px] font-mono border-indigo-500/30 text-indigo-300">
                                  Profitability
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {aiReport.justifications.targetMargin}
                              </p>
                            </div>

                            {/* Exit Multiple Justification */}
                            <div className="p-3 rounded-xl bg-card/60 border border-border/60 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground flex items-center gap-1.5 font-mono text-[11px]">
                                  <Scale className="w-3.5 h-3.5 text-cyan-400" />
                                  Exit Valuation Multiple ({inputs.exitMultiple}x P/E)
                                </span>
                                <Badge variant="outline" className="text-[9px] font-mono border-cyan-500/30 text-cyan-300">
                                  Terminal Multiple
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {aiReport.justifications.exitMultiple}
                              </p>
                            </div>

                            {/* Discount Rate / WACC Justification */}
                            <div className="p-3 rounded-xl bg-card/60 border border-border/60 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground flex items-center gap-1.5 font-mono text-[11px]">
                                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                                  Discount Rate / WACC ({inputs.discountRate}%)
                                </span>
                                <Badge variant="outline" className="text-[9px] font-mono border-amber-500/30 text-amber-300">
                                  Hurdle Rate
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {aiReport.justifications.discountRate}
                              </p>
                            </div>

                            {/* Share Count Trajectory Justification */}
                            <div className="p-3 rounded-xl bg-card/60 border border-border/60 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground flex items-center gap-1.5 font-mono text-[11px]">
                                  <Zap className="w-3.5 h-3.5 text-teal-400" />
                                  Annual Share Count Change ({inputs.annualShareChangePct}%/yr)
                                </span>
                                <Badge variant="outline" className="text-[9px] font-mono border-teal-500/30 text-teal-300">
                                  Capital Return
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {aiReport.justifications.annualShareChange}
                              </p>
                            </div>

                            {/* Investment Horizon Justification */}
                            <div className="p-3 rounded-xl bg-card/60 border border-border/60 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground flex items-center gap-1.5 font-mono text-[11px]">
                                  <Target className="w-3.5 h-3.5 text-purple-400" />
                                  Forecast Horizon ({inputs.horizonYears} Years)
                                </span>
                                <Badge variant="outline" className="text-[9px] font-mono border-purple-500/30 text-purple-300">
                                  Cycle Duration
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {aiReport.justifications.horizon}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* AI Invite Banner when report not yet generated */}
                  {!aiReport && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-primary/10 border border-purple-500/25 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0 shadow-sm">
                          <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-foreground">
                              AI Institutional Valuation Modeler
                            </p>
                            <Badge variant="outline" className="text-[9px] font-mono text-purple-300 border-purple-500/40">
                              Auto-Research
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Let the AI agent audit {cleanSymbol} fundamentals, project highest-probability value scenarios, and justify each parameter.
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={handleRunValuationAgent}
                        disabled={agentScenariosMutation.isPending}
                        className="h-8 px-4 text-xs font-bold gap-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-primary hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/25 rounded-xl shrink-0"
                      >
                        {agentScenariosMutation.isPending ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> <span>Researching {cleanSymbol}...</span></>
                        ) : (
                          <><Sparkles className="w-3.5 h-3.5 text-amber-300" /> <span>Run AI Auto-Research</span></>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Assumptions Control Panel */}
                  <Card className="p-5 bg-card/70 border-border/70 rounded-2xl shadow-sm space-y-5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-bold text-foreground">Interactive Assumptions Controls</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRunValuationAgent}
                          disabled={agentScenariosMutation.isPending}
                          className="h-7 text-xs font-bold gap-1.5 border-purple-500/30 text-purple-300 hover:bg-purple-500/15"
                        >
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          <span>{aiReport ? 'Re-Populate with AI' : 'AI Auto-Fill'}</span>
                        </Button>
                        <div className="text-xs text-muted-foreground font-mono hidden sm:inline">
                          Instant recalculation • Live path projection
                        </div>
                      </div>
                    </div>

                    {/* Sliders Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* 1. Revenue Growth Rate CAGR */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            Revenue Growth Rate (% CAGR)
                          </label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.5"
                              value={inputs.revenueGrowthRate}
                              onChange={(e) => {
                                setActivePreset('CUSTOM');
                                setInputs((prev) => ({ ...prev, revenueGrowthRate: parseFloat(e.target.value) || 0 }));
                              }}
                              className="w-18 h-7 text-xs font-mono font-bold text-right py-0 px-2"
                            />
                            <span className="text-xs font-mono text-muted-foreground">%</span>
                          </div>
                        </div>
                        <Slider
                          min={-15}
                          max={45}
                          step={0.5}
                          value={[inputs.revenueGrowthRate]}
                          onValueChange={(val) => {
                            setActivePreset('CUSTOM');
                            setInputs((prev) => ({ ...prev, revenueGrowthRate: val[0] }));
                          }}
                        />
                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                          <span>-15% (Decline)</span>
                          <span>+10% (Market)</span>
                          <span>+45% (Hypergrowth)</span>
                        </div>
                      </div>

                      {/* 2. Target Operating Margin */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Percent className="w-3.5 h-3.5 text-indigo-400" />
                            Target Operating / FCF Margin (%)
                          </label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.5"
                              value={inputs.targetMargin}
                              onChange={(e) => {
                                setActivePreset('CUSTOM');
                                setInputs((prev) => ({ ...prev, targetMargin: parseFloat(e.target.value) || 0 }));
                              }}
                              className="w-18 h-7 text-xs font-mono font-bold text-right py-0 px-2"
                            />
                            <span className="text-xs font-mono text-muted-foreground">%</span>
                          </div>
                        </div>
                        <Slider
                          min={5}
                          max={65}
                          step={0.5}
                          value={[inputs.targetMargin]}
                          onValueChange={(val) => {
                            setActivePreset('CUSTOM');
                            setInputs((prev) => ({ ...prev, targetMargin: val[0] }));
                          }}
                        />
                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                          <span>5% (Thin Margin)</span>
                          <span>Starting: {inputs.startingMargin.toFixed(1)}%</span>
                          <span>65% (Software/SaaS)</span>
                        </div>
                      </div>

                      {/* 3. Exit Valuation Multiple */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Scale className="w-3.5 h-3.5 text-cyan-400" />
                            Exit Valuation Multiple (P/E or P/FCF)
                          </label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.5"
                              value={inputs.exitMultiple}
                              onChange={(e) => {
                                setActivePreset('CUSTOM');
                                setInputs((prev) => ({ ...prev, exitMultiple: parseFloat(e.target.value) || 1 }));
                              }}
                              className="w-18 h-7 text-xs font-mono font-bold text-right py-0 px-2"
                            />
                            <span className="text-xs font-mono text-muted-foreground">x</span>
                          </div>
                        </div>
                        <Slider
                          min={6}
                          max={60}
                          step={0.5}
                          value={[inputs.exitMultiple]}
                          onValueChange={(val) => {
                            setActivePreset('CUSTOM');
                            setInputs((prev) => ({ ...prev, exitMultiple: val[0] }));
                          }}
                        />
                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                          <span>6x (Value/Cyclical)</span>
                          <span>18x (Fair Mean)</span>
                          <span>60x (High Multiple)</span>
                        </div>
                      </div>

                      {/* 4. Discount Rate / Required Annual Return */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-amber-400" />
                            Discount Rate / Required Return (%)
                          </label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.25"
                              value={inputs.discountRate}
                              onChange={(e) => {
                                setActivePreset('CUSTOM');
                                setInputs((prev) => ({ ...prev, discountRate: parseFloat(e.target.value) || 1 }));
                              }}
                              className="w-18 h-7 text-xs font-mono font-bold text-right py-0 px-2"
                            />
                            <span className="text-xs font-mono text-muted-foreground">%</span>
                          </div>
                        </div>
                        <Slider
                          min={6}
                          max={20}
                          step={0.25}
                          value={[inputs.discountRate]}
                          onValueChange={(val) => {
                            setActivePreset('CUSTOM');
                            setInputs((prev) => ({ ...prev, discountRate: val[0] }));
                          }}
                        />
                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                          <span>6% (Low WACC)</span>
                          <span>10% (Market Hurdle)</span>
                          <span>20% (High Hurdle)</span>
                        </div>
                      </div>

                      {/* 5. Annual Share Count Change */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-teal-400" />
                            Annual Share Change (% / yr)
                          </label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.25"
                              value={inputs.annualShareChangePct}
                              onChange={(e) => {
                                setActivePreset('CUSTOM');
                                setInputs((prev) => ({ ...prev, annualShareChangePct: parseFloat(e.target.value) || 0 }));
                              }}
                              className="w-18 h-7 text-xs font-mono font-bold text-right py-0 px-2"
                            />
                            <span className="text-xs font-mono text-muted-foreground">%</span>
                          </div>
                        </div>
                        <Slider
                          min={-5}
                          max={5}
                          step={0.25}
                          value={[inputs.annualShareChangePct]}
                          onValueChange={(val) => {
                            setActivePreset('CUSTOM');
                            setInputs((prev) => ({ ...prev, annualShareChangePct: val[0] }));
                          }}
                        />
                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                          <span>-5% (Aggressive Buybacks)</span>
                          <span>0% (Neutral)</span>
                          <span>+5% (SBC Dilution)</span>
                        </div>
                      </div>

                      {/* 6. Horizon Selector Details */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-foreground block">
                          Forecast Horizon Duration
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {[3, 5, 7, 10].map((h) => (
                            <Button
                              key={h}
                              type="button"
                              variant={inputs.horizonYears === h ? "default" : "outline"}
                              size="sm"
                              onClick={() => setInputs((prev) => ({ ...prev, horizonYears: h }))}
                              className="font-mono text-xs font-bold"
                            >
                              {h} Years
                            </Button>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Terminal multiple will be applied at Year {inputs.horizonYears}.
                        </p>
                      </div>
                    </div>

                    {/* Collapsible Starting Financials Overrides */}
                    <div className="border-t border-border/50 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowStartingOverrides(!showStartingOverrides)}
                        className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-primary" />
                          Advanced: Edit Starting Baseline Financials ({cleanSymbol})
                        </span>
                        {showStartingOverrides ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {showStartingOverrides && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-border/30">
                          <div>
                            <label className="text-[10px] text-muted-foreground font-mono block mb-1">Starting Price ($)</label>
                            <Input
                              type="number"
                              step="0.1"
                              value={inputs.startingPrice}
                              onChange={(e) => setInputs((prev) => ({ ...prev, startingPrice: parseFloat(e.target.value) || 0 }))}
                              className="h-7 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground font-mono block mb-1">TTM Revenue ($B)</label>
                            <Input
                              type="number"
                              step="0.5"
                              value={inputs.startingRevenue}
                              onChange={(e) => setInputs((prev) => ({ ...prev, startingRevenue: parseFloat(e.target.value) || 0 }))}
                              className="h-7 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground font-mono block mb-1">Starting Margin (%)</label>
                            <Input
                              type="number"
                              step="0.5"
                              value={inputs.startingMargin}
                              onChange={(e) => setInputs((prev) => ({ ...prev, startingMargin: parseFloat(e.target.value) || 0 }))}
                              className="h-7 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground font-mono block mb-1">Shares Out (B)</label>
                            <Input
                              type="number"
                              step="0.05"
                              value={inputs.startingShares}
                              onChange={(e) => setInputs((prev) => ({ ...prev, startingShares: parseFloat(e.target.value) || 0.01 }))}
                              className="h-7 text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </TabsContent>

                {/* ================= TAB 2: YEAR-BY-YEAR FINANCIAL MODEL ================= */}
                <TabsContent value="table" className="space-y-4">
                  <Card className="p-4 bg-card/60 border-border/70 rounded-2xl shadow-inner">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">
                          Year-by-Year Financial Statement Projections
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Trajectory of revenue, margin expansion, share buybacks, and resulting stock price each year.
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        Horizon: {inputs.horizonYears}Y
                      </Badge>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-border/70">
                      <table className="w-full text-xs font-mono text-left">
                        <thead className="bg-muted/50 border-b border-border/70 text-muted-foreground uppercase text-[10px]">
                          <tr>
                            <th className="p-2.5">Period</th>
                            <th className="p-2.5 text-right">Proj Price</th>
                            <th className="p-2.5 text-right">EPS / FCF</th>
                            <th className="p-2.5 text-right">Revenue</th>
                            <th className="p-2.5 text-right">Margin</th>
                            <th className="p-2.5 text-right">Net Income</th>
                            <th className="p-2.5 text-right">Shares</th>
                            <th className="p-2.5 text-right">Cum. Return</th>
                            <th className="p-2.5 text-right">Ann. CAGR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {forecastResult.path.map((row) => (
                            <tr
                              key={row.year}
                              className={cn(
                                "transition-colors",
                                row.year === 0 ? "bg-muted/20 font-bold" : "hover:bg-muted/10",
                                row.year === inputs.horizonYears && "bg-primary/10 font-bold"
                              )}
                            >
                              <td className="p-2.5 font-sans font-medium text-foreground flex items-center gap-1.5">
                                {row.year === 0 ? (
                                  <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">Base</Badge>
                                ) : row.year === inputs.horizonYears ? (
                                  <Badge variant="default" className="text-[9px] py-0 px-1 font-mono bg-primary">Target</Badge>
                                ) : null}
                                {row.yearLabel}
                              </td>
                              <td className="p-2.5 text-right font-bold text-foreground">
                                ${row.projectedPrice.toFixed(2)}
                              </td>
                              <td className="p-2.5 text-right text-foreground">
                                ${row.epsOrFcfPerShare.toFixed(2)}
                              </td>
                              <td className="p-2.5 text-right text-muted-foreground">
                                ${row.revenue.toFixed(1)}B
                              </td>
                              <td className="p-2.5 text-right text-muted-foreground">
                                {row.margin.toFixed(1)}%
                              </td>
                              <td className="p-2.5 text-right text-muted-foreground">
                                ${row.earningsOrFcf.toFixed(1)}B
                              </td>
                              <td className="p-2.5 text-right text-muted-foreground">
                                {row.shares.toFixed(2)}B
                              </td>
                              <td className={cn("p-2.5 text-right font-bold", row.cumulativeReturnPct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                {row.year === 0 ? '—' : `${row.cumulativeReturnPct >= 0 ? '+' : ''}${row.cumulativeReturnPct.toFixed(1)}%`}
                              </td>
                              <td className={cn("p-2.5 text-right font-bold", row.annualizedCagrPct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                {row.year === 0 ? '—' : `${row.annualizedCagrPct >= 0 ? '+' : ''}${row.annualizedCagrPct.toFixed(1)}%`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </TabsContent>

                {/* ================= TAB 3: 2D SENSITIVITY MATRIX ================= */}
                <TabsContent value="sensitivity" className="space-y-4">
                  <Card className="p-4 bg-card/60 border-border/70 rounded-2xl shadow-inner space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-primary" />
                          2D Valuation Sensitivity Matrix (CAGR & Target Price)
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Evaluates outcomes across 5 revenue growth rates vs 5 exit multiples at Year {inputs.horizonYears}.
                        </p>
                      </div>

                      {/* Legend */}
                      <div className="flex items-center gap-2 text-[10px] font-mono font-bold">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">&gt;10% CAGR</span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">0-10%</span>
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">&lt;0% Negative</span>
                        <span className="px-2 py-0.5 rounded ring-2 ring-primary bg-primary/20 text-foreground">Active Case</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-border/70 p-2 bg-card/40">
                      <table className="w-full text-xs font-mono text-center">
                        <thead>
                          <tr>
                            <th className="p-2.5 text-muted-foreground text-[10px] uppercase text-left">Growth \ Exit P/E</th>
                            {forecastResult.sensitivityMatrix.multiples.map((m) => (
                              <th
                                key={m}
                                className={cn(
                                  "p-2.5 font-bold transition-all",
                                  m === inputs.exitMultiple ? "text-primary bg-primary/10 rounded-t" : "text-foreground"
                                )}
                              >
                                {m}x
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {forecastResult.sensitivityMatrix.cells.map((row, rIdx) => {
                            const gRate = forecastResult.sensitivityMatrix.growthRates[rIdx];
                            return (
                              <tr key={rIdx}>
                                <td
                                  className={cn(
                                    "p-2.5 font-bold text-left",
                                    gRate === inputs.revenueGrowthRate ? "text-primary bg-primary/10 rounded-l" : "text-foreground"
                                  )}
                                >
                                  {gRate >= 0 ? '+' : ''}{gRate}% CAGR
                                </td>
                                {row.map((cell, cIdx) => {
                                  const isBase = cell.isBaseCase;
                                  const isPositive = cell.annualizedCagrPct >= 10;
                                  const isModerate = cell.annualizedCagrPct >= 0 && cell.annualizedCagrPct < 10;
                                  return (
                                    <td
                                      key={cIdx}
                                      className={cn(
                                        "p-2.5 transition-all",
                                        isBase ? "ring-2 ring-primary bg-primary/25 font-black rounded" :
                                        isPositive ? "bg-emerald-500/15 text-emerald-300" :
                                        isModerate ? "bg-amber-500/10 text-amber-300" :
                                        "bg-rose-500/15 text-rose-300"
                                      )}
                                    >
                                      <div className="font-bold text-xs">${cell.projectedPrice.toFixed(0)}</div>
                                      <div className="text-[10px] opacity-80">
                                        {cell.annualizedCagrPct >= 0 ? '+' : ''}{cell.annualizedCagrPct.toFixed(1)}%/yr
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </TabsContent>

                {/* ================= TAB 4: STOCHASTIC MONTE CARLO ================= */}
                <TabsContent value="stochastic" className="space-y-4">
                  {!simulation ? (
                    <Card className="p-8 bg-card/60 border-border/70 rounded-2xl text-center space-y-4">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                        <Cpu className="w-8 h-8" />
                      </div>
                      <div className="max-w-md mx-auto">
                        <h4 className="text-base font-bold text-foreground">
                          Stochastic Multi-Factor Monte Carlo Simulation
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Executes 10,000 randomized paths combining Vasicek mean-reverting interest rate models, macroeconomic inflation shocks, and stochastic cash flow variance.
                        </p>
                        <p className="text-[11px] text-amber-400/90 font-medium mt-1">
                          Note: This runs on-demand only and does not execute automatically.
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-3 pt-2">
                        <div className="flex items-center gap-1 bg-background/60 border border-border/60 rounded-xl p-1 text-xs">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground px-1.5">Paths:</span>
                          {[5000, 10000, 25000].map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTrials(t)}
                              className={cn(
                                "px-2 py-0.5 rounded-lg font-mono font-bold text-[11px] transition-all",
                                trials === t
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {(t / 1000).toFixed(0)}k
                            </button>
                          ))}
                        </div>

                        <Button
                          onClick={handleRunStochastic}
                          disabled={isLoadingStochastic}
                          className="font-bold gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/20"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          Run {trials.toLocaleString()} Stochastic Paths
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {/* Stochastic Bell Curve Distribution */}
                      <Card className="bg-card/60 border-border/70 p-4 rounded-2xl shadow-inner">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                          <div>
                            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <LineChartIcon className="w-3.5 h-3.5 text-primary" />
                              Probability Density of Intrinsic Values ({simulation.simulated_paths_count.toLocaleString()} Paths)
                            </h4>
                            <p className="text-[11px] text-muted-foreground">
                              80% CI: ${simulation.confidence_interval_80.p10.toFixed(2)} - ${simulation.confidence_interval_80.p90.toFixed(2)} • 90% CI: ${simulation.confidence_interval_90.p05.toFixed(2)} - ${simulation.confidence_interval_90.p95.toFixed(2)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleRunStochastic}
                            disabled={isLoadingStochastic}
                            className="h-7 text-xs font-mono"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" /> Re-Simulate
                          </Button>
                        </div>

                        <div className={cn("w-full transition-all duration-200", isFullScreen ? "h-80" : "h-56")}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stochasticChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                              <defs>
                                <linearGradient id="stochDensityGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="price" tickFormatter={(val) => `$${val}`} stroke="#64748b" fontSize={10} fontFamily="monospace" />
                              <YAxis stroke="#64748b" fontSize={10} fontFamily="monospace" tickFormatter={(val) => `${val}%`} />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  const p = payload[0].payload;
                                  return (
                                    <div className="bg-popover/95 backdrop-blur-md border border-border/80 p-2.5 rounded-xl shadow-xl text-xs font-mono">
                                      <p className="font-bold text-foreground">Intrinsic Price: ${p.price}</p>
                                      <p className="text-primary mt-0.5">Probability Density: {p.density}%</p>
                                      <p className="text-muted-foreground">Cumulative: {p.cumulative}%</p>
                                    </div>
                                  );
                                }}
                              />
                              <ReferenceLine x={Math.round(effectivePrice)} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" />
                              <ReferenceLine x={Math.round(medianValue)} stroke="#6366f1" strokeWidth={2} />
                              <Area type="monotone" dataKey="density" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#stochDensityGrad)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>

                      {/* Sensitivities & Macro Baselines */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <Card className="p-4 bg-card/60 border-border/70 rounded-xl space-y-2">
                          <span className="text-xs font-bold text-foreground flex items-center justify-between">
                            <span>Revenue Growth Sensitivity</span>
                            <Badge variant="outline" className="text-emerald-400 font-mono">
                              +{simulation.factor_sensitivities.sensitivity_to_revenue_growth.toFixed(2)}% per +1%
                            </Badge>
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            100 bps faster revenue growth increases intrinsic value by {simulation.factor_sensitivities.sensitivity_to_revenue_growth.toFixed(2)}%.
                          </p>
                        </Card>

                        <Card className="p-4 bg-card/60 border-border/70 rounded-xl space-y-2">
                          <span className="text-xs font-bold text-foreground flex items-center justify-between">
                            <span>Operating Margin Sensitivity</span>
                            <Badge variant="outline" className="text-indigo-400 font-mono">
                              +{simulation.factor_sensitivities.sensitivity_to_operating_margin.toFixed(2)}% per +1%
                            </Badge>
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            100 bps margin expansion increases valuation by {simulation.factor_sensitivities.sensitivity_to_operating_margin.toFixed(2)}%.
                          </p>
                        </Card>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
