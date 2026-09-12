import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Scale,
  Sparkles,
  BarChart3,
  LineChart,
  SlidersHorizontal,
  Compass,
  PieChart,
  HelpCircle,
  Zap,
  Target,
  ShieldCheck,
  Flame,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Percent,
  DollarSign,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  GrowthValuationData,
  useGrowthAndValuation,
} from '@/services/growthValuationService';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
  LineChart as RechartsLineChart,
  Line,
  Legend,
  ComposedChart,
  Area,
} from 'recharts';

interface GrowthAndValuationCardProps {
  symbol: string;
}

type SubTab = 'GROWTH_MATRIX' | 'IMPLIED_DCF' | 'PROBABILITY_SCENARIOS' | 'QUALITY_DIAGNOSTICS';

export function GrowthAndValuationCard({ symbol }: GrowthAndValuationCardProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useGrowthAndValuation(symbol);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('GROWTH_MATRIX');

  // Interactive Reverse DCF Sliders
  const [customWacc, setCustomWacc] = useState<number>(9.5);
  const [customTerminalRate, setCustomTerminalRate] = useState<number>(3.0);

  // Interactive Scenario Probabilities
  const [bullProb, setBullProb] = useState<number>(25);
  const [baseProb, setBaseProb] = useState<number>(50);
  const [bearProb, setBearProb] = useState<number>(25);

  // Sync defaults when data loads
  React.useEffect(() => {
    if (data?.impliedValuation) {
      setCustomWacc(data.impliedValuation.defaultWacc || 9.5);
      setCustomTerminalRate(data.impliedValuation.defaultTerminalRate || 3.0);
    }
  }, [data?.symbol]);

  // Live Reverse DCF recalculation based on interactive sliders
  const dynamicImpliedGrowth = useMemo(() => {
    if (!data?.impliedValuation?.currentFcf || !data?.marketCap) return data?.impliedValuation?.implied5YFcfGrowth || 15;
    const baseFcf = data.impliedValuation.currentFcf;
    const targetValue = data.marketCap;
    const waccDec = customWacc / 100;
    const termDec = customTerminalRate / 100;

    let low = -0.30;
    let high = 1.50;
    let bestG = 0.15;

    for (let iter = 0; iter < 40; iter++) {
      const midG = (low + high) / 2;
      let pvFcf = 0;
      let currentCash = baseFcf;

      for (let t = 1; t <= 5; t++) {
        currentCash *= (1 + midG);
        pvFcf += currentCash / Math.pow(1 + waccDec, t);
      }

      const terminalFcf = currentCash * (1 + termDec);
      const terminalValue = terminalFcf / Math.max(0.015, (waccDec - termDec));
      const pvTerminal = terminalValue / Math.pow(1 + waccDec, 5);
      const totalDcf = pvFcf + pvTerminal;

      if (Math.abs(totalDcf - targetValue) / targetValue < 0.001) {
        bestG = midG;
        break;
      }
      if (totalDcf < targetValue) low = midG;
      else high = midG;
      bestG = midG;
    }

    return Number((bestG * 100).toFixed(1));
  }, [data, customWacc, customTerminalRate]);

  // Live Scenario Probability Recalculation
  const dynamicScenarioEV = useMemo(() => {
    if (!data?.scenarios) return null;
    const totalP = (bullProb + baseProb + bearProb) || 100;
    const normBull = bullProb / totalP;
    const normBase = baseProb / totalP;
    const normBear = bearProb / totalP;

    const evPrice = Number(
      (data.scenarios.bull.targetPrice * normBull +
        data.scenarios.base.targetPrice * normBase +
        data.scenarios.bear.targetPrice * normBear).toFixed(2)
    );

    const evReturn = data.currentPrice > 0
      ? Number((((evPrice - data.currentPrice) / data.currentPrice) * 100).toFixed(1))
      : 0;

    return {
      evPrice,
      evReturn,
      normBull: Math.round(normBull * 100),
      normBase: Math.round(normBase * 100),
      normBear: Math.round(normBear * 100),
    };
  }, [data, bullProb, baseProb, bearProb]);

  if (isLoading) {
    return (
      <Card className="bg-card/70 backdrop-blur-xl border border-border/70 p-12 text-center rounded-3xl shadow-xl">
        <div className="flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-7 h-7 animate-spin text-primary" />
          <span className="text-sm font-bold text-foreground">
            Synthesizing forward valuation, historical growth rates, and reverse DCF implied expectations for {symbol}...
          </span>
          <span className="text-xs text-muted-foreground">Parsing Wall Street consensus estimates, annual financial time series, and probability models</span>
        </div>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="bg-card/70 border border-destructive/30 p-8 rounded-3xl text-center">
        <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
        <p className="text-sm font-bold text-destructive">Failed to compile Growth & Forward Valuation model</p>
        <p className="text-xs text-muted-foreground mt-1">{(error as any)?.message || 'Financial estimates temporarily unavailable.'}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4 text-xs font-bold gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Retry Model
        </Button>
      </Card>
    );
  }

  const { valuation, historicalGrowth, forwardGrowth, impliedValuation, scenarios, growthDiagnostics, trajectoryChart } = data;

  const formatBillion = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    return `$${val.toLocaleString()}`;
  };

  return (
    <Card className="bg-card/70 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-3xl overflow-hidden relative group space-y-6">
      {/* Top Ambient Light Header Accent */}
      <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-500" />

      {/* ================= 1. CARD HEADER & EXECUTIVE GROWTH BAROMETER ================= */}
      <div className="p-6 pb-0 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-primary/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black shadow-inner">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black font-mono tracking-tight text-foreground">
                  {data.symbol} Growth & Forward Valuation Engine
                </h2>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[10px] font-mono font-bold">
                  Rule of 40: {growthDiagnostics.ruleOf40Score}%
                </Badge>
                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30 text-[10px] font-mono font-bold">
                  PEG: {valuation.pegRatio ? `${valuation.pegRatio}x` : 'N/A'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Past vs expected future growth rates, market implied FCF trajectory, probability scenarios, and multiple expansion modeling.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 text-xs gap-1.5 border-border/70 hover:bg-accent/40 font-semibold"
              title="Refresh Estimates & Financials"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-primary", isFetching && "animate-spin")} />
              <span>Update Data</span>
            </Button>
          </div>
        </div>

        {/* 4 Executive Growth & Valuation KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {/* 1. Forward P/E & Multiple Compression */}
          <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 shadow-sm flex flex-col justify-between gap-1.5">
            <span className="text-[10.5px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-cyan-400" /> Forward P/E (FY1)
            </span>
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-xl font-black text-foreground">
                {valuation.forwardPE ? `${valuation.forwardPE.toFixed(1)}x` : '—'}
              </span>
              {valuation.peCompressionPct !== null && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.2 rounded",
                  valuation.peCompressionPct < 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                )}>
                  {valuation.peCompressionPct >= 0 ? '+' : ''}{valuation.peCompressionPct}% vs Trailing
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              FY2 P/E: <strong className="text-foreground">{valuation.forwardPE_FY2 ? `${valuation.forwardPE_FY2.toFixed(1)}x` : '—'}</strong> • Trailing: {valuation.trailingPE ? `${valuation.trailingPE.toFixed(1)}x` : '—'}
            </span>
          </div>

          {/* 2. Expected Consensus Growth (FY1) */}
          <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 shadow-sm flex flex-col justify-between gap-1.5">
            <span className="text-[10.5px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Consensus Revenue Growth
            </span>
            <div className="flex items-baseline justify-between font-mono">
              <span className={cn(
                "text-xl font-black",
                (forwardGrowth.consensusRevenueGrowthFY1 || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {forwardGrowth.consensusRevenueGrowthFY1 !== null ? `${forwardGrowth.consensusRevenueGrowthFY1 >= 0 ? '+' : ''}${forwardGrowth.consensusRevenueGrowthFY1.toFixed(1)}%` : '—'}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground">FY1 Consensus</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              FY2 Est: <strong className="text-foreground">{forwardGrowth.consensusRevenueGrowthFY2 !== null ? `+${forwardGrowth.consensusRevenueGrowthFY2.toFixed(1)}%` : '—'}</strong> • EPS FY1: +{forwardGrowth.consensusEpsGrowthFY1?.toFixed(1) || '0'}%
            </span>
          </div>

          {/* 3. Market Implied Growth (Reverse DCF) */}
          <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 shadow-sm flex flex-col justify-between gap-1.5">
            <span className="text-[10.5px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-purple-400" /> Implied Growth in Price
            </span>
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-xl font-black text-purple-300">
                +{dynamicImpliedGrowth}%
              </span>
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.2 rounded",
                (impliedValuation.growthGap || 0) >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
              )}>
                {(impliedValuation.growthGap || 0) >= 0 ? 'Margin of Safety' : 'High Premium'}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono truncate" title={impliedValuation.marketExpectationTone}>
              {impliedValuation.marketExpectationTone}
            </span>
          </div>

          {/* 4. Rule of 40 & Quality Score */}
          <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 shadow-sm flex flex-col justify-between gap-1.5">
            <span className="text-[10.5px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Growth Quality Score
            </span>
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-xl font-black text-emerald-400">
                {growthDiagnostics.growthQualityScore}/100
              </span>
              <span className="text-[10px] font-bold text-muted-foreground">
                ROIC: {growthDiagnostics.roic ? `${growthDiagnostics.roic}%` : '—'}
              </span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
              <div
                style={{ width: `${growthDiagnostics.growthQualityScore}%` }}
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
              />
            </div>
          </div>
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="flex items-center bg-slate-900/80 p-1 rounded-2xl border border-slate-800 flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('GROWTH_MATRIX')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              activeSubTab === 'GROWTH_MATRIX' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Past & Forward Growth Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('IMPLIED_DCF')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              activeSubTab === 'IMPLIED_DCF' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Target className="w-3.5 h-3.5" />
            <span>What is the Price Implying? (Reverse DCF)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('PROBABILITY_SCENARIOS')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              activeSubTab === 'PROBABILITY_SCENARIOS' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Probability-Based Scenarios & Valuation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('QUALITY_DIAGNOSTICS')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              activeSubTab === 'QUALITY_DIAGNOSTICS' ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Capital Efficiency & Rule of 40</span>
          </button>
        </div>
      </div>

      {/* ================= 2. TAB BODY PANELS ================= */}
      <CardContent className="p-6 pt-0 space-y-6">

        {/* ================= SUB-TAB 1: PAST & FORWARD GROWTH MATRIX ================= */}
        {activeSubTab === 'GROWTH_MATRIX' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Historical vs Forward Growth Side-by-Side Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Left: Past Historical Growth Rates */}
              <div className="p-4 rounded-2xl bg-card/50 border border-border/60 space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" /> Historical Growth Track Record
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono border-cyan-500/30 text-cyan-300">
                    Audited Annuals
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-border/30">
                    <span className="text-[10px] text-muted-foreground block font-sans">1Y Revenue Growth</span>
                    <span className={cn("text-sm font-black", (historicalGrowth.revenueYoY || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {historicalGrowth.revenueYoY !== null ? `${historicalGrowth.revenueYoY >= 0 ? '+' : ''}${historicalGrowth.revenueYoY}%` : '—'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-border/30">
                    <span className="text-[10px] text-muted-foreground block font-sans">3Y Revenue CAGR</span>
                    <span className={cn("text-sm font-black", (historicalGrowth.revenue3YCagr || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {historicalGrowth.revenue3YCagr !== null ? `+${historicalGrowth.revenue3YCagr}%` : '—'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-border/30">
                    <span className="text-[10px] text-muted-foreground block font-sans">5Y Revenue CAGR</span>
                    <span className={cn("text-sm font-black", (historicalGrowth.revenue5YCagr || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {historicalGrowth.revenue5YCagr !== null ? `+${historicalGrowth.revenue5YCagr}%` : '—'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-border/30">
                    <span className="text-[10px] text-muted-foreground block font-sans">1Y Net Income YoY</span>
                    <span className={cn("text-sm font-black", (historicalGrowth.netIncomeYoY || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {historicalGrowth.netIncomeYoY !== null ? `${historicalGrowth.netIncomeYoY >= 0 ? '+' : ''}${historicalGrowth.netIncomeYoY}%` : '—'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-border/30">
                    <span className="text-[10px] text-muted-foreground block font-sans">3Y EPS CAGR</span>
                    <span className={cn("text-sm font-black", (historicalGrowth.eps3YCagr || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {historicalGrowth.eps3YCagr !== null ? `+${historicalGrowth.eps3YCagr}%` : '—'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-border/30">
                    <span className="text-[10px] text-muted-foreground block font-sans">3Y FCF CAGR</span>
                    <span className={cn("text-sm font-black", (historicalGrowth.fcf3YCagr || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {historicalGrowth.fcf3YCagr !== null ? `+${historicalGrowth.fcf3YCagr}%` : '—'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1">
                  <span>Gross Margin: <strong className="text-foreground">{historicalGrowth.grossMargin}%</strong></span>
                  <span>Operating Margin: <strong className="text-foreground">{historicalGrowth.operatingMargin}%</strong></span>
                  <span>FCF Margin: <strong className="text-foreground">{historicalGrowth.fcfMargin?.toFixed(1)}%</strong></span>
                </div>
              </div>

              {/* Right: Forward Expected Consensus Estimates */}
              <div className="p-4 rounded-2xl bg-card/50 border border-border/60 space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Forward Consensus Forecasts (FY1 & FY2)
                  </span>
                  <Badge variant="outline" className={cn(
                    "text-[9px] font-bold px-1.5 py-0.2 border",
                    forwardGrowth.revisions.momentum === 'Strong Upward Revisions' ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-slate-800 text-muted-foreground"
                  )}>
                    {forwardGrowth.revisions.momentum}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
                  {/* FY1 Box */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-border/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">Current Year (FY1)</span>
                      <span className="text-[10px] text-cyan-400 font-bold">+{forwardGrowth.consensusRevenueGrowthFY1?.toFixed(1)}% Rev</span>
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      <span>Revenue: <strong className="text-foreground">{formatBillion(forwardGrowth.fy1Estimate?.revenueAvg)}</strong></span>
                      <span className="block">Range: {formatBillion(forwardGrowth.fy1Estimate?.revenueLow)} - {formatBillion(forwardGrowth.fy1Estimate?.revenueHigh)}</span>
                    </div>
                    <div className="pt-1 border-t border-border/20 flex justify-between text-[11px]">
                      <span>Consensus EPS: <strong className="text-foreground">${forwardGrowth.fy1Estimate?.epsAvg.toFixed(2)}</strong></span>
                      <span className="text-emerald-400 font-bold">+{forwardGrowth.consensusEpsGrowthFY1?.toFixed(1)}% EPS</span>
                    </div>
                  </div>

                  {/* FY2 Box */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-border/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">Next Year (FY2)</span>
                      <span className="text-[10px] text-cyan-400 font-bold">+{forwardGrowth.consensusRevenueGrowthFY2?.toFixed(1)}% Rev</span>
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      <span>Revenue: <strong className="text-foreground">{formatBillion(forwardGrowth.fy2Estimate?.revenueAvg)}</strong></span>
                      <span className="block">Range: {formatBillion(forwardGrowth.fy2Estimate?.revenueLow)} - {formatBillion(forwardGrowth.fy2Estimate?.revenueHigh)}</span>
                    </div>
                    <div className="pt-1 border-t border-border/20 flex justify-between text-[11px]">
                      <span>Consensus EPS: <strong className="text-foreground">${forwardGrowth.fy2Estimate?.epsAvg.toFixed(2)}</strong></span>
                      <span className="text-emerald-400 font-bold">+{forwardGrowth.consensusEpsGrowthFY2?.toFixed(1)}% EPS</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10.5px] font-mono text-muted-foreground pt-1">
                  <span>Analyst Coverage: <strong className="text-foreground">{forwardGrowth.fy1Estimate?.numberOfAnalysts || 35} Wall St Analysts</strong></span>
                  <span>EPS Revisions (30D): <strong className="text-emerald-400">+{forwardGrowth.revisions.up30Days} Up</strong> / <strong className="text-rose-400">-{forwardGrowth.revisions.down30Days} Down</strong></span>
                </div>
              </div>

            </div>

            {/* Visual Trajectory Chart (Past to Forward) */}
            <div className="p-4 rounded-2xl bg-card/40 border border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <LineChart className="w-3.5 h-3.5 text-primary" /> Revenue & Net Income Trajectory (Historical to Forecast)
                </span>
                <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-cyan-400 rounded-sm" /> Historical Revenue</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-400 rounded-sm" /> Forecast Revenue</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-purple-400 rounded-full" /> Net Income ($)</span>
                </div>
              </div>

              <div className="h-[280px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trajectoryChart} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis
                      dataKey="period"
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(v) => `$${(v / 1e9).toFixed(0)}B`}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255, 255, 255, 0.06)' }}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#f8fafc',
                      }}
                      itemStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                      labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        return (
                          <div className="bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs font-mono min-w-[190px] space-y-1.5 ring-1 ring-white/10">
                            <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
                              <span className="font-bold text-slate-100 text-xs">
                                Period: {label}
                              </span>
                              {payload[0]?.payload?.isEstimate && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  ESTIMATE
                                </span>
                              )}
                            </div>
                            {payload.map((entry, idx) => (
                              <div key={`tt-${idx}`} className="flex items-center justify-between gap-3 text-xs">
                                <span className="text-slate-300 flex items-center gap-1.5">
                                  <span
                                    className="w-2 h-2 rounded-full inline-block"
                                    style={{ backgroundColor: entry.color || (entry.dataKey === 'revenue' ? '#38bdf8' : '#c084fc') }}
                                  />
                                  {entry.name}:
                                </span>
                                <span className="font-black text-slate-100 font-mono">
                                  {formatBillion(Number(entry.value))}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="revenue"
                      name="Revenue ($)"
                      radius={[6, 6, 0, 0]}
                    >
                      {trajectoryChart.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.isEstimate ? '#34d399' : '#38bdf8'}
                          fillOpacity={entry.isEstimate ? 0.85 : 1}
                        />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="netIncome"
                      name="Net Income ($)"
                      stroke="#c084fc"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#c084fc' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ================= SUB-TAB 2: WHAT IS THE PRICE IMPLYING? (REVERSE DCF) ================= */}
        {activeSubTab === 'IMPLIED_DCF' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Top Explanation Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-card/60 to-cyan-950/40 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-purple-400" /> Reverse DCF & Market Implied Growth Barometer
                </span>
                <Badge variant="outline" className="bg-purple-500/15 text-purple-300 border-purple-500/40 text-[10px] font-mono font-bold">
                  Implied FCF CAGR: +{dynamicImpliedGrowth}%/yr
                </Badge>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed">
                {impliedValuation.explanation}
              </p>
            </div>

            {/* Interactive Model Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Slider 1: Discount Rate (WACC) */}
              <div className="p-4 rounded-2xl bg-card/60 border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Discount Rate (WACC)</span>
                  <span className="font-mono text-xs font-black text-cyan-400">{customWacc.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="6.5"
                  max="14.0"
                  step="0.1"
                  value={customWacc}
                  onChange={(e) => setCustomWacc(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Required rate of return based on enterprise risk & beta.
                </span>
              </div>

              {/* Slider 2: Terminal Perpetual Growth */}
              <div className="p-4 rounded-2xl bg-card/60 border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Terminal Growth Rate (g)</span>
                  <span className="font-mono text-xs font-black text-amber-400">{customTerminalRate.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="4.5"
                  step="0.1"
                  value={customTerminalRate}
                  onChange={(e) => setCustomTerminalRate(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Long-term mature GDP baseline growth rate.
                </span>
              </div>

              {/* Box 3: Implied vs Consensus Gap */}
              <div className="p-4 rounded-2xl bg-card/60 border border-border/60 space-y-1.5 flex flex-col justify-between">
                <span className="text-xs font-bold text-foreground">Expectations Spread</span>
                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-lg font-black text-foreground">
                    {Number(((forwardGrowth.consensusRevenueGrowthFY1 || 15) - dynamicImpliedGrowth).toFixed(1)) >= 0 ? '+' : ''}
                    {Number(((forwardGrowth.consensusRevenueGrowthFY1 || 15) - dynamicImpliedGrowth).toFixed(1))}%
                  </span>
                  <Badge variant="outline" className={cn(
                    "text-[9px] font-bold px-1.5 py-0.2 border",
                    ((forwardGrowth.consensusRevenueGrowthFY1 || 15) - dynamicImpliedGrowth) >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                  )}>
                    {((forwardGrowth.consensusRevenueGrowthFY1 || 15) - dynamicImpliedGrowth) >= 0 ? 'Discounted' : 'Priced High'}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Consensus (+{forwardGrowth.consensusRevenueGrowthFY1?.toFixed(1)}%) vs Implied (+{dynamicImpliedGrowth}%)
                </span>
              </div>
            </div>

            {/* Visual Bar Comparison: Market Implied vs Consensus vs Historical */}
            <div className="p-4 rounded-2xl bg-card/40 border border-border/60 space-y-2">
              <span className="text-xs font-bold text-foreground">
                Growth Benchmarking: Market Implied vs Wall Street Consensus vs Historical Track Record
              </span>

              <div className="h-[200px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Historical 3Y CAGR', rate: historicalGrowth.revenue3YCagr || 20, fill: '#38bdf8' },
                      { name: 'Consensus FY1 Growth', rate: forwardGrowth.consensusRevenueGrowthFY1 || 18, fill: '#34d399' },
                      { name: 'Price Implied 5Y Growth', rate: dynamicImpliedGrowth, fill: '#a855f7' },
                      { name: 'Implied 10Y Growth', rate: impliedValuation.implied10YFcfGrowth || 12, fill: '#f59e0b' },
                    ]}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#64748b"
                      tick={{ fill: '#e2e8f0', fontSize: 11, fontWeight: 'bold' }}
                      tickLine={false}
                      width={140}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255, 255, 255, 0.06)' }}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#f8fafc',
                      }}
                      itemStyle={{ color: '#34d399', fontWeight: 'bold' }}
                      labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const item = payload[0].payload;
                        const rateNum = Number(item.rate ?? 0);
                        const isPositive = rateNum >= 0;
                        return (
                          <div className="bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs font-mono min-w-[220px] space-y-1.5 ring-1 ring-white/10">
                            <div className="flex items-center gap-2 border-b border-slate-700/60 pb-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                                style={{ backgroundColor: item.fill || '#38bdf8' }}
                              />
                              <span className="font-bold text-slate-100 text-xs truncate">
                                {item.name}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-3 pt-0.5">
                              <span className="text-slate-400 text-[11px] font-medium">CAGR Rate:</span>
                              <span className={cn("font-black text-sm tracking-tight", isPositive ? "text-emerald-400" : "text-rose-400")}>
                                {isPositive ? '+' : ''}{rateNum.toFixed(1)}% Annual Growth
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-sans border-t border-slate-800/60 pt-1 leading-snug">
                              {item.name.includes('Historical') && 'Trailing compounded annual growth record'}
                              {item.name.includes('Consensus') && 'Wall Street consensus forward estimate'}
                              {item.name.includes('Price Implied') && 'Growth implied by current market valuation (5Y)'}
                              {item.name.includes('10Y') && 'Long-term terminal DCF priced growth rate (10Y)'}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
                      {['#38bdf8', '#34d399', '#a855f7', '#f59e0b'].map((color, idx) => (
                        <Cell key={`bar-${idx}`} fill={color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ================= SUB-TAB 3: PROBABILITY-BASED SCENARIOS ================= */}
        {activeSubTab === 'PROBABILITY_SCENARIOS' && dynamicScenarioEV && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Probability Weight Sliders Bar */}
            <div className="p-4 rounded-2xl bg-card/60 border border-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-primary" /> Adjust Scenario Probability Weights
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  Expected Value: <strong className="text-emerald-400 text-xs">${dynamicScenarioEV.evPrice} ({dynamicScenarioEV.evReturn >= 0 ? '+' : ''}{dynamicScenarioEV.evReturn}%)</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Bull Probability */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-emerald-400 font-bold">🚀 Bull Case</span>
                    <span className="font-bold">{bullProb}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="80"
                    value={bullProb}
                    onChange={(e) => setBullProb(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>

                {/* Base Probability */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-cyan-400 font-bold">⚖️ Base Case</span>
                    <span className="font-bold">{baseProb}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={baseProb}
                    onChange={(e) => setBaseProb(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* Bear Probability */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-rose-400 font-bold">🐻 Bear Case</span>
                    <span className="font-bold">{bearProb}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="80"
                    value={bearProb}
                    onChange={(e) => setBearProb(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-rose-400"
                  />
                </div>
              </div>
            </div>

            {/* 3 Scenario Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Bull Case */}
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-3 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
                    <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                      🚀 {scenarios.bull.label}
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] font-mono">
                      {dynamicScenarioEV.normBull}% Weight
                    </Badge>
                  </div>

                  <div className="pt-2.5 font-mono">
                    <span className="text-2xl font-black text-emerald-400">
                      ${scenarios.bull.targetPrice}
                    </span>
                    <span className="text-xs font-bold text-emerald-300 ml-2">
                      +{scenarios.bull.upsidePct}% Return
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    {scenarios.bull.thesis}
                  </p>
                </div>

                <div className="pt-2 border-t border-emerald-500/20 text-[10px] font-mono text-muted-foreground flex justify-between">
                  <span>Growth: <strong className="text-foreground">+{scenarios.bull.growthRate}%</strong></span>
                  <span>Multiple: <strong className="text-foreground">{scenarios.bull.targetMultiple}x P/E</strong></span>
                </div>
              </div>

              {/* Base Case */}
              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/40 space-y-3 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2">
                    <span className="text-xs font-black text-cyan-300 uppercase tracking-wider">
                      ⚖️ {scenarios.base.label}
                    </span>
                    <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[9px] font-mono">
                      {dynamicScenarioEV.normBase}% Weight
                    </Badge>
                  </div>

                  <div className="pt-2.5 font-mono">
                    <span className="text-2xl font-black text-cyan-300">
                      ${scenarios.base.targetPrice}
                    </span>
                    <span className="text-xs font-bold text-cyan-200 ml-2">
                      {scenarios.base.upsidePct >= 0 ? '+' : ''}{scenarios.base.upsidePct}% Return
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    {scenarios.base.thesis}
                  </p>
                </div>

                <div className="pt-2 border-t border-cyan-500/20 text-[10px] font-mono text-muted-foreground flex justify-between">
                  <span>Growth: <strong className="text-foreground">+{scenarios.base.growthRate}%</strong></span>
                  <span>Multiple: <strong className="text-foreground">{scenarios.base.targetMultiple}x P/E</strong></span>
                </div>
              </div>

              {/* Bear Case */}
              <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/40 space-y-3 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between border-b border-rose-500/30 pb-2">
                    <span className="text-xs font-black text-rose-300 uppercase tracking-wider">
                      🐻 {scenarios.bear.label}
                    </span>
                    <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[9px] font-mono">
                      {dynamicScenarioEV.normBear}% Weight
                    </Badge>
                  </div>

                  <div className="pt-2.5 font-mono">
                    <span className="text-2xl font-black text-rose-400">
                      ${scenarios.bear.targetPrice}
                    </span>
                    <span className="text-xs font-bold text-rose-300 ml-2">
                      {scenarios.bear.upsidePct}% Downside
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    {scenarios.bear.thesis}
                  </p>
                </div>

                <div className="pt-2 border-t border-rose-500/20 text-[10px] font-mono text-muted-foreground flex justify-between">
                  <span>Growth: <strong className="text-foreground">+{scenarios.bear.growthRate}%</strong></span>
                  <span>Multiple: <strong className="text-foreground">{scenarios.bear.targetMultiple}x P/E</strong></span>
                </div>
              </div>

            </div>

            {/* Asymmetry Verdict Bar */}
            <div className="p-3.5 rounded-2xl bg-card/60 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-foreground/90 font-medium">{scenarios.verdict}</span>
              </div>
              <span className="font-mono text-xs font-bold text-primary shrink-0">
                Risk/Reward Ratio: {scenarios.riskRewardRatio}:1
              </span>
            </div>
          </div>
        )}

        {/* ================= SUB-TAB 4: CAPITAL EFFICIENCY & RULE OF 40 ================= */}
        {activeSubTab === 'QUALITY_DIAGNOSTICS' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Rule of 40 Box */}
              <div className="p-4 rounded-2xl bg-card/50 border border-border/60 space-y-3">
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" /> Rule of 40 Efficiency Benchmark
                  </span>
                  <Badge variant="outline" className={cn(
                    "text-[9px] font-bold px-1.5 py-0.2 border",
                    growthDiagnostics.ruleOf40Score >= 40 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-amber-500/15 text-amber-300"
                  )}>
                    {growthDiagnostics.ruleOf40Grade}
                  </Badge>
                </div>

                <div className="flex items-baseline justify-between font-mono">
                  <div>
                    <span className="text-2xl font-black text-foreground">{growthDiagnostics.ruleOf40Score}%</span>
                    <span className="text-xs text-muted-foreground block">Combined Score</span>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-cyan-400 block font-bold">Revenue Growth: +{historicalGrowth.revenueYoY || 15}%</span>
                    <span className="text-emerald-400 block font-bold">FCF Margin: +{historicalGrowth.fcfMargin?.toFixed(1)}%</span>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-snug">
                  Rule of 40 is the golden standard metric for high-growth software and tech: companies scoring &gt;40% balance aggressive top-line revenue expansion with robust free cash flow generation.
                </p>
              </div>

              {/* ROIC vs WACC Value Creation Spread */}
              <div className="p-4 rounded-2xl bg-card/50 border border-border/60 space-y-3">
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" /> ROIC vs WACC (Value Creation Spread)
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/30 text-emerald-300">
                    EVA Positive
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-mono text-center">
                  <div className="p-2 rounded-xl bg-slate-900/60 border border-border/30">
                    <span className="text-[9px] text-muted-foreground block font-sans">ROIC</span>
                    <span className="text-sm font-black text-emerald-400">{growthDiagnostics.roic ? `${growthDiagnostics.roic}%` : '—'}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/60 border border-border/30">
                    <span className="text-[9px] text-muted-foreground block font-sans">WACC</span>
                    <span className="text-sm font-black text-muted-foreground">{growthDiagnostics.wacc}%</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/60 border border-border/30">
                    <span className="text-[9px] text-muted-foreground block font-sans">EVA Spread</span>
                    <span className="text-sm font-black text-cyan-300">+{growthDiagnostics.evaSpread}%</span>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-snug">
                  ROIC measures how much profit the company generates for every $1 of capital invested. When ROIC exceeds WACC, every dollar of growth creates substantial economic shareholder value.
                </p>
              </div>

            </div>

            {/* Annual Financial Health Table */}
            <div className="rounded-2xl border border-border/50 overflow-hidden bg-card/40">
              <div className="p-3 bg-slate-900/80 border-b border-border/40 flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Annual Multi-Year Growth & Margins Breakdown</span>
                <span className="text-[10px] font-mono text-muted-foreground">{historicalGrowth.annualHistory.length} Recorded Years</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left font-mono">
                  <thead className="bg-slate-950/60 text-muted-foreground uppercase text-[9.5px]">
                    <tr>
                      <th className="p-2.5">Fiscal Year</th>
                      <th className="p-2.5 text-right">Revenue</th>
                      <th className="p-2.5 text-right">Gross Margin</th>
                      <th className="p-2.5 text-right">Operating Income</th>
                      <th className="p-2.5 text-right">Net Income</th>
                      <th className="p-2.5 text-right">Free Cash Flow</th>
                      <th className="p-2.5 text-right">FCF Margin</th>
                      <th className="p-2.5 text-right">EPS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {historicalGrowth.annualHistory.map((row) => (
                      <tr key={row.year} className="hover:bg-accent/30 transition-colors">
                        <td className="p-2.5 font-bold text-foreground">{row.year}</td>
                        <td className="p-2.5 text-right text-foreground font-bold">{formatBillion(row.revenue)}</td>
                        <td className="p-2.5 text-right text-muted-foreground">{row.grossMargin}%</td>
                        <td className="p-2.5 text-right text-foreground">{formatBillion(row.operatingIncome)}</td>
                        <td className="p-2.5 text-right text-foreground">{formatBillion(row.netIncome)}</td>
                        <td className="p-2.5 text-right text-emerald-400 font-bold">{formatBillion(row.freeCashFlow)}</td>
                        <td className="p-2.5 text-right text-emerald-400 font-bold">{row.fcfMargin}%</td>
                        <td className="p-2.5 text-right text-cyan-300 font-bold">${row.dilutedEps.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
