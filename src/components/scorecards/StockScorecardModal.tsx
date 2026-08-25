import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Zap,
  BarChart3,
  Scale,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Target,
  ShieldAlert,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Compass,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StockScorecard } from '@/services/scorecardService';

interface StockScorecardModalProps {
  scorecard: StockScorecard | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToResearch?: (symbol: string) => void;
  onOpenCompare?: (symbol: string) => void;
}

export function StockScorecardModal({
  scorecard,
  isOpen,
  onClose,
  onNavigateToResearch,
  onOpenCompare,
}: StockScorecardModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'factors' | 'tactical' | 'thesis'>('overview');

  if (!scorecard) return null;

  const {
    symbol,
    name,
    price,
    change,
    changePercent,
    currency,
    sector,
    industry,
    marketCap,
    beta,
    overallScore,
    grade,
    gradeLabel,
    buyingConvictionScore,
    fundamentalsScore,
    valuationScore,
    healthStatus,
    valuationPosture,
    metrics,
    tacticalAction,
    suggestedBuyZone,
    targetPrice,
    stopLossAnchor,
    recommendedMaxAllocationPct,
    keyStrengths,
    keyRisks,
    bullCase,
    bearCase,
    isHolding,
    holdingDetails,
    isWatchlist,
    watchlistNames,
  } = scorecard;

  const isPositiveChange = change >= 0;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    if (score >= 65) return 'text-teal-400 border-teal-500/40 bg-teal-500/10';
    if (score >= 50) return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    if (score >= 35) return 'text-orange-400 border-orange-500/40 bg-orange-500/10';
    return 'text-rose-400 border-rose-500/40 bg-rose-500/10';
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'PRISTINE':
        return { label: 'Pristine Health', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'STABLE':
        return { label: 'Stable Health', bg: 'bg-teal-500/15 text-teal-400 border-teal-500/30' };
      case 'MODERATE_DEBT':
        return { label: 'Moderate Leverage', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'HIGH_LEVERAGE':
        return { label: 'High Leverage', bg: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
      case 'DISTRESSED':
      default:
        return { label: 'Financial Strain', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    }
  };

  const getValuationBadge = (posture: string) => {
    switch (posture) {
      case 'DEEP_VALUE':
        return { label: 'Deep Value Discount', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'FAIR_VALUE':
        return { label: 'Fair Valuation', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
      case 'RICHLY_VALUED':
        return { label: 'Rich Valuation', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'SPECULATIVE_BUBBLE':
      default:
        return { label: 'Speculative Multiple', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    }
  };

  const healthBadge = getHealthBadge(healthStatus);
  const valBadge = getValuationBadge(valuationPosture);

  const fmtCurrency = (val: number) => {
    const sym = currency === 'GBP' || currency === 'GBp' ? '£' : '$';
    return `${sym}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card/95 backdrop-blur-2xl border-border/80 p-0 rounded-2xl shadow-2xl">
        {/* Top Header Gradient */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />

        <div className="p-6 space-y-6">
          {/* ================= MODAL HEADER ================= */}
          <DialogHeader className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 via-emerald-500/20 to-primary/10 border border-primary/40 flex items-center justify-center font-mono font-black text-primary text-base shadow-sm">
                  {symbol.slice(0, 4)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-2xl font-black font-mono tracking-tight text-foreground">
                      {symbol}
                    </DialogTitle>
                    {isHolding && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] uppercase font-bold">
                        Holding ({holdingDetails?.broker || 'Portfolio'})
                      </Badge>
                    )}
                    {isWatchlist && (
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] uppercase font-bold">
                        Watchlist {watchlistNames?.[0] ? `(${watchlistNames[0]})` : ''}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {name} • <span className="text-foreground/80 font-medium">{sector}</span> ({industry})
                  </p>
                </div>
              </div>

              {/* Price & Score Header Pill */}
              <div className="flex items-center gap-4 self-end sm:self-auto">
                <div className="text-right">
                  <div className="text-xl font-mono font-black text-foreground">
                    {fmtCurrency(price)}
                  </div>
                  <div className={cn("text-xs font-mono font-bold flex items-center justify-end gap-0.5", isPositiveChange ? "text-emerald-400" : "text-rose-400")}>
                    {isPositiveChange ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {isPositiveChange ? '+' : ''}{changePercent.toFixed(2)}% ({change >= 0 ? '+' : ''}{change.toFixed(2)})
                  </div>
                </div>

                {/* Big Overall Score Ring */}
                <div className={cn("px-4 py-2 rounded-2xl border flex flex-col items-center justify-center font-mono shadow-sm", getScoreColor(overallScore))}>
                  <span className="text-2xl font-black">{overallScore}</span>
                  <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">Conviction</span>
                </div>
              </div>
            </div>

            {/* Badges Bar */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Badge variant="outline" className={cn("text-xs font-semibold px-2.5 py-0.5", healthBadge.bg)}>
                <ShieldCheck className="w-3 h-3 mr-1 inline" /> {healthBadge.label}
              </Badge>
              <Badge variant="outline" className={cn("text-xs font-semibold px-2.5 py-0.5", valBadge.bg)}>
                <DollarSign className="w-3 h-3 mr-1 inline" /> {valBadge.label}
              </Badge>
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 bg-accent/20 border-border/60 text-muted-foreground">
                <Scale className="w-3 h-3 mr-1 inline" /> Beta: {beta.toFixed(2)}
              </Badge>
              {marketCap > 0 && (
                <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 bg-accent/20 border-border/60 text-muted-foreground">
                  Cap: ${(marketCap / 1e9).toFixed(1)}B
                </Badge>
              )}
            </div>
          </DialogHeader>

          {/* ================= TRI-FACTOR SUMMARY CARDS ================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* 1. Buying Conviction */}
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> Buying Conviction
                </span>
                <span className="text-base font-black font-mono text-emerald-400">{buyingConvictionScore}/100</span>
              </div>
              <Progress value={buyingConvictionScore} className="h-1.5 bg-emerald-950/40" />
              <p className="text-[11px] text-muted-foreground">
                {metrics.priceTo52WeekHighPct < -15 ? `${Math.abs(metrics.priceTo52WeekHighPct).toFixed(1)}% off 52W high (Attractive dip)` : 'Consolidating near active range'}
              </p>
            </div>

            {/* 2. Fundamentals & Quality */}
            <div className="p-4 rounded-2xl bg-teal-950/20 border border-teal-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Fundamental Quality
                </span>
                <span className="text-base font-black font-mono text-teal-400">{fundamentalsScore}/100</span>
              </div>
              <Progress value={fundamentalsScore} className="h-1.5 bg-teal-950/40" />
              <p className="text-[11px] text-muted-foreground">
                {metrics.operatingMarginPct ? `${metrics.operatingMarginPct}% Op. Margin` : 'Solid balance sheet & capital structure'}
              </p>
            </div>

            {/* 3. Valuation */}
            <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Scale className="w-4 h-4" /> Valuation Posture
                </span>
                <span className="text-base font-black font-mono text-indigo-400">{valuationScore}/100</span>
              </div>
              <Progress value={valuationScore} className="h-1.5 bg-indigo-950/40" />
              <p className="text-[11px] text-muted-foreground">
                Fair Value: {fmtCurrency(metrics.fairValueEstimate)} (+{metrics.upsideToFairValuePct}%)
              </p>
            </div>
          </div>

          {/* ================= TABS SECTION ================= */}
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
            <TabsList className="bg-background/80 p-1 rounded-xl border border-border/60 grid grid-cols-4 w-full">
              <TabsTrigger value="overview" className="text-xs font-bold">Overview</TabsTrigger>
              <TabsTrigger value="factors" className="text-xs font-bold">Factor Deep Dive</TabsTrigger>
              <TabsTrigger value="tactical" className="text-xs font-bold">Tactical Action</TabsTrigger>
              <TabsTrigger value="thesis" className="text-xs font-bold">Bull vs Bear</TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="space-y-4">
              {/* Tactical Action Banner */}
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30 flex items-start gap-3">
                <Compass className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Tactical Conviction Verdict</h4>
                  <p className="text-xs text-foreground font-medium leading-relaxed">{tacticalAction}</p>
                </div>
              </div>

              {/* Key Highlights Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="p-3 rounded-xl bg-accent/20 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase block font-sans">P/E Ratio</span>
                  <span className="text-sm font-bold text-foreground">
                    {metrics.forwardPE ? `${metrics.forwardPE}x (Fwd)` : metrics.trailingPE ? `${metrics.trailingPE}x (Trail)` : 'N/A'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-accent/20 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase block font-sans">Op. Margin</span>
                  <span className="text-sm font-bold text-foreground">
                    {metrics.operatingMarginPct != null ? `${metrics.operatingMarginPct}%` : 'N/A'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-accent/20 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase block font-sans">Debt / Equity</span>
                  <span className="text-sm font-bold text-foreground">
                    {metrics.debtToEquity != null ? `${metrics.debtToEquity}%` : 'N/A'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-accent/20 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase block font-sans">Upside Target</span>
                  <span className="text-sm font-bold text-emerald-400">
                    +{metrics.upsideToFairValuePct}%
                  </span>
                </div>
              </div>

              {/* Bull vs Bear Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="p-4 rounded-xl bg-emerald-950/15 border border-emerald-500/25 space-y-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Key Strengths
                  </span>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    {keyStrengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-rose-950/15 border border-rose-500/25 space-y-2">
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Risk Factors
                  </span>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    {keyRisks.map((risk, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-rose-400 mt-0.5">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: FACTOR DEEP DIVE */}
            <TabsContent value="factors" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Buying Conviction Factors */}
                <div className="p-4 rounded-2xl bg-card/60 border border-border/60 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 border-b border-border/40 pb-2">
                    <TrendingUp className="w-3.5 h-3.5" /> Technical & Timing
                  </h4>
                  <div className="space-y-2.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">52W High Drawdown:</span>
                      <span className={cn("font-bold", metrics.priceTo52WeekHighPct < -20 ? "text-emerald-400" : "text-foreground")}>
                        {metrics.priceTo52WeekHighPct}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Above 52W Low:</span>
                      <span className="font-bold text-foreground">+{metrics.distanceFrom52WeekLowPct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Momentum Velocity:</span>
                      <span className="font-bold text-foreground">{metrics.momentumScore}/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Market Beta:</span>
                      <span className="font-bold text-foreground">{beta.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Fundamental Quality Factors */}
                <div className="p-4 rounded-2xl bg-card/60 border border-border/60 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5 border-b border-border/40 pb-2">
                    <Sparkles className="w-3.5 h-3.5" /> Balance Sheet & Quality
                  </h4>
                  <div className="space-y-2.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Operating Margin:</span>
                      <span className="font-bold text-foreground">{metrics.operatingMarginPct != null ? `${metrics.operatingMarginPct}%` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Return on Equity:</span>
                      <span className="font-bold text-foreground">{metrics.roePct != null ? `${metrics.roePct}%` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Debt-to-Equity:</span>
                      <span className={cn("font-bold", metrics.debtToEquity && metrics.debtToEquity > 150 ? "text-rose-400" : "text-foreground")}>
                        {metrics.debtToEquity != null ? `${metrics.debtToEquity}%` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Altman Z-Score:</span>
                      <span className="font-bold text-emerald-400">{metrics.altmanZScoreEstimate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Piotroski F-Score:</span>
                      <span className="font-bold text-teal-400">{metrics.piotroskiFScoreEstimate}/9</span>
                    </div>
                  </div>
                </div>

                {/* Valuation Factors */}
                <div className="p-4 rounded-2xl bg-card/60 border border-border/60 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-border/40 pb-2">
                    <Scale className="w-3.5 h-3.5" /> Multiples & Fair Value
                  </h4>
                  <div className="space-y-2.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Forward P/E:</span>
                      <span className="font-bold text-foreground">{metrics.forwardPE ? `${metrics.forwardPE}x` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Price to Sales:</span>
                      <span className="font-bold text-foreground">{metrics.priceToSales ? `${metrics.priceToSales}x` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">EV / EBITDA:</span>
                      <span className="font-bold text-foreground">{metrics.evToEbitda ? `${metrics.evToEbitda}x` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Fair Value Target:</span>
                      <span className="font-bold text-emerald-400">{fmtCurrency(metrics.fairValueEstimate)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: TACTICAL ACTION */}
            <TabsContent value="tactical" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-card/60 border border-border/60 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-border/40 pb-2">
                    <Target className="w-3.5 h-3.5" /> Execution Price Zones
                  </h4>
                  <div className="space-y-3 font-mono">
                    <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block font-sans">Suggested Buy Limit Zone</span>
                        <span className="text-sm font-bold text-emerald-400">
                          {fmtCurrency(suggestedBuyZone.min)} - {fmtCurrency(suggestedBuyZone.max)}
                        </span>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px]">Optimal Entry</Badge>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block font-sans">Target Valuation Price</span>
                        <span className="text-sm font-bold text-blue-400">{fmtCurrency(targetPrice)}</span>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[9px]">+{metrics.upsideToFairValuePct}% Upside</Badge>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block font-sans">Stop Loss / Risk Anchor</span>
                        <span className="text-sm font-bold text-rose-400">{fmtCurrency(stopLossAnchor)}</span>
                      </div>
                      <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[9px]">Risk Anchor</Badge>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-card/60 border border-border/60 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-border/40 pb-2">
                    <Layers className="w-3.5 h-3.5" /> Position Sizing & Allocation
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-accent/20 border border-border/40">
                      <span className="text-[10px] text-muted-foreground uppercase block">Recommended Max Allocation</span>
                      <span className="text-base font-bold font-mono text-foreground">{recommendedMaxAllocationPct}% of Portfolio Net Liq</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Based on {symbol}'s conviction rating of <strong className="text-foreground">{overallScore}/100</strong> and beta of <strong className="text-foreground">{beta.toFixed(2)}</strong>, scale entries in 2-3 equal tranches within the buy limit zone.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 4: THESIS (BULL VS BEAR) */}
            <TabsContent value="thesis" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2.5">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Core Bull Investment Thesis
                  </span>
                  <p className="text-xs text-foreground/90 leading-relaxed">{bullCase}</p>
                </div>

                <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-2.5">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4" /> Core Bear Invalidation Thesis
                  </span>
                  <p className="text-xs text-foreground/90 leading-relaxed">{bearCase}</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* ================= MODAL FOOTER ACTIONS ================= */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              {onOpenCompare && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenCompare(symbol);
                  }}
                  className="h-8 text-xs font-bold gap-1.5 border-border/70"
                >
                  <Scale className="w-3.5 h-3.5 text-primary" />
                  <span>Compare vs Peers</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
                Close
              </Button>
              {onNavigateToResearch && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onNavigateToResearch(symbol);
                  }}
                  className="h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-sm"
                >
                  <span>Open Institutional Research</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
