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
  RefreshCw,
  Clock,
  BookOpen,
  Briefcase,
  Bookmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StockScorecard } from '@/services/scorecardService';

interface StockScorecardModalProps {
  scorecard: StockScorecard | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToResearch?: (symbol: string) => void;
  onOpenCompare?: (symbol: string) => void;
  onRefresh?: (symbol: string) => void;
  onAnalyzeEarnings?: (symbol: string) => void;
  isRefreshing?: boolean;
}

export function StockScorecardModal({
  scorecard,
  isOpen,
  onClose,
  onNavigateToResearch,
  onOpenCompare,
  onRefresh,
  onAnalyzeEarnings,
  isRefreshing,
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
    rank,
    grade,
    gradeLabel,
    buyingConvictionScore,
    fundamentalsScore,
    valuationScore,
    momentumScore,
    healthStatus,
    valuationPosture,
    metrics,
    tacticalAction,
    suggestedBuyZone,
    targetPrice,
    stopLossAnchor,
    recommendedMaxAllocationPct,
    scoreJustification,
    fundamentalSituation,
    keyStrengths,
    keyRisks,
    bullCase,
    bearCase,
    isHolding,
    holdingDetails,
    brokers,
    isWatchlist,
    watchlistNames,
    analyzedAt,
  } = scorecard;

  const isPositiveChange = change >= 0;

  const getScoreColor = (score: number) => {
    if (score >= 9.0) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
    if (score >= 7.5) return 'text-teal-400 border-teal-500/40 bg-teal-500/10';
    if (score >= 5.5) return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    if (score >= 3.5) return 'text-orange-400 border-orange-500/40 bg-orange-500/10';
    return 'text-rose-400 border-rose-500/40 bg-rose-500/10';
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'PRISTINE':
        return { label: 'Pristine Balance Sheet', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
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
        return { label: 'Deep Value Multiple', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'FAIR_VALUE':
        return { label: 'Fair Valuation', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
      case 'RICHLY_VALUED':
        return { label: 'Richly Valued', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'SPECULATIVE_BUBBLE':
      default:
        return { label: 'Speculative Multiple', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    }
  };

  const getBrokerBadgeStyle = (broker: string) => {
    const b = (broker || '').toLowerCase();
    if (b.includes('interactive') || b.includes('ibkr')) {
      return {
        label: 'Interactive Brokers',
        badgeClass: 'bg-red-500/15 text-red-300 border-red-500/35',
        dotColor: 'bg-red-400',
      };
    }
    if (b.includes('tasty')) {
      return {
        label: 'Tastytrade',
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
        dotColor: 'bg-amber-400',
      };
    }
    if (b.includes('212')) {
      return {
        label: 'Trading 212',
        badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
        dotColor: 'bg-sky-400',
      };
    }
    return {
      label: broker || 'Portfolio Holding',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
      dotColor: 'bg-emerald-400',
    };
  };

  const healthBadge = getHealthBadge(healthStatus);
  const valBadge = getValuationBadge(valuationPosture);

  const fmtCurrency = (val: number) => {
    const sym = currency === 'GBP' || currency === 'GBp' ? '£' : '$';
    return `${sym}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formattedDate = analyzedAt ? new Date(analyzedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) : 'Recently';

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
                    {rank != null && (
                      <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] font-mono font-black px-2 py-0.5">
                        Rank #{rank}
                      </Badge>
                    )}

                    {/* Broker Holding Badges */}
                    {brokers && brokers.length > 0 ? (
                      brokers.map((b) => {
                        const style = getBrokerBadgeStyle(b);
                        return (
                          <Badge
                            key={b}
                            className={cn("text-[10px] font-bold border flex items-center gap-1.5 px-2 py-0.5", style.badgeClass)}
                          >
                            <span className={cn("w-1.5 h-1.5 rounded-full", style.dotColor)} />
                            <Briefcase className="w-3 h-3 opacity-80" />
                            <span>{style.label}</span>
                          </Badge>
                        );
                      })
                    ) : isHolding ? (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold flex items-center gap-1.5 px-2 py-0.5">
                        <Briefcase className="w-3 h-3 opacity-80" />
                        <span>Holding ({holdingDetails?.broker || 'Portfolio'})</span>
                      </Badge>
                    ) : null}

                    {/* Watchlist Badges */}
                    {watchlistNames && watchlistNames.length > 0 ? (
                      watchlistNames.map((wl) => (
                        <Badge
                          key={wl}
                          className="bg-purple-500/15 text-purple-300 border-purple-500/35 text-[10px] font-medium flex items-center gap-1.5 px-2 py-0.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                          <Bookmark className="w-3 h-3 opacity-80" />
                          <span>{wl}</span>
                        </Badge>
                      ))
                    ) : isWatchlist ? (
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] font-bold flex items-center gap-1.5 px-2 py-0.5">
                        <Bookmark className="w-3 h-3 opacity-80" />
                        <span>Watchlist</span>
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {name} • <span className="text-foreground/80 font-medium">{sector}</span> ({industry})
                  </p>
                </div>
              </div>

              {/* Price, Date & Overall Score (1 to 10 Scale) */}
              <div className="flex items-center gap-4 self-end sm:self-auto">
                <div className="text-right">
                  <div className="text-xl font-mono font-black text-foreground">
                    {fmtCurrency(price)}
                  </div>
                  <div className={cn("text-xs font-mono font-bold flex items-center justify-end gap-0.5", isPositiveChange ? "text-emerald-400" : "text-rose-400")}>
                    {isPositiveChange ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {isPositiveChange ? '+' : ''}{changePercent.toFixed(2)}% ({change >= 0 ? '+' : ''}{change.toFixed(2)})
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono flex items-center justify-end gap-1 pt-0.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span>Analyzed: {formattedDate}</span>
                  </div>
                </div>

                {/* Big Overall Score Ring (1.0 to 10.0) */}
                <div className={cn("px-4 py-2 rounded-2xl border flex flex-col items-center justify-center font-mono shadow-sm", getScoreColor(overallScore))}>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-2xl font-black leading-none">{overallScore.toFixed(1)}</span>
                    <span className="text-xs font-bold opacity-70">/10</span>
                  </div>
                  <span className="text-[8px] uppercase tracking-wider font-bold opacity-80 mt-0.5">Score</span>
                </div>
              </div>
            </div>

            {/* Badges Bar & Quick Header Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
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

              {/* Action Buttons: Refresh & Analyze Latest Earnings */}
              <div className="flex items-center gap-2">
                {onAnalyzeEarnings && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAnalyzeEarnings(symbol)}
                    className="h-7 text-xs font-bold gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>Analyze Latest Earnings</span>
                  </Button>
                )}
                {onRefresh && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRefresh(symbol)}
                    disabled={isRefreshing}
                    className="h-7 text-xs font-bold gap-1.5 border-border/70 bg-card/60"
                  >
                    <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin text-primary")} />
                    <span>{isRefreshing ? 'Refreshing...' : 'Refresh Stock'}</span>
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* ================= TRI-FACTOR SUMMARY CARDS (1 TO 10 SCALE) ================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* 1. Buying Conviction */}
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> Buying Conviction
                </span>
                <span className="text-sm font-black font-mono text-emerald-400">{buyingConvictionScore.toFixed(1)} / 10</span>
              </div>
              <Progress value={buyingConvictionScore * 10} className="h-1.5 bg-emerald-950/40" />
              <p className="text-[11px] text-muted-foreground">
                {metrics.priceTo52WeekHighPct < -15 ? `${Math.abs(metrics.priceTo52WeekHighPct).toFixed(1)}% off 52W high (Pullback zone)` : 'Consolidating near active range'}
              </p>
            </div>

            {/* 2. Fundamentals & Quality */}
            <div className="p-4 rounded-2xl bg-teal-950/20 border border-teal-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Fundamental Quality
                </span>
                <span className="text-sm font-black font-mono text-teal-400">{fundamentalsScore.toFixed(1)} / 10</span>
              </div>
              <Progress value={fundamentalsScore * 10} className="h-1.5 bg-teal-950/40" />
              <p className="text-[11px] text-muted-foreground">
                {metrics.operatingMarginPct != null ? `${metrics.operatingMarginPct}% Op. Margin` : 'Solid capital structure & moat profile'}
              </p>
            </div>

            {/* 3. Valuation Posture */}
            <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Scale className="w-4 h-4" /> Valuation Posture
                </span>
                <span className="text-sm font-black font-mono text-indigo-400">{valuationScore.toFixed(1)} / 10</span>
              </div>
              <Progress value={valuationScore * 10} className="h-1.5 bg-indigo-950/40" />
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
              {/* INSTITUTIONAL SCORE JUSTIFICATION & FUNDAMENTAL SITUATION */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Score Justification */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-card to-accent/20 border border-primary/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Score Justification ({overallScore.toFixed(1)}/10)
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed font-sans">
                    {scoreJustification || 'Multi-factor quantitative and fundamental rating calculated across valuation multiples, balance sheet liquidity, and technical positioning.'}
                  </p>
                </div>

                {/* Fundamental Situation */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-950/20 via-card to-accent/20 border border-teal-500/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Fundamental Situation & Economic Moat
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed font-sans">
                    {fundamentalSituation || `${name} exhibits steady operating execution with balanced cash flows and consistent liquidity support.`}
                  </p>
                </div>
              </div>

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
                    <AlertTriangle className="w-3.5 h-3.5" /> Key Risk Factors
                  </span>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    {keyRisks.map((rsk, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-rose-400 mt-0.5">•</span>
                        <span>{rsk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: FACTORS DEEP DIVE */}
            <TabsContent value="factors" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Fundamentals Breakdown */}
                <div className="p-4 rounded-2xl bg-card/80 border border-border/60 space-y-3">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-teal-400" /> Capital Structure & Efficiency
                  </span>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-sans">Return on Equity (ROE)</span>
                      <span className="font-bold text-foreground">{metrics.roePct != null ? `${metrics.roePct}%` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-sans">Operating Margin</span>
                      <span className="font-bold text-foreground">{metrics.operatingMarginPct != null ? `${metrics.operatingMarginPct}%` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-sans">Net Profit Margin</span>
                      <span className="font-bold text-foreground">{metrics.netMarginPct != null ? `${metrics.netMarginPct}%` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-sans">Revenue Growth (YoY)</span>
                      <span className="font-bold text-foreground">{metrics.revenueGrowthPct != null ? `${metrics.revenueGrowthPct}%` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-sans">Debt to Equity</span>
                      <span className="font-bold text-foreground">{metrics.debtToEquity != null ? `${metrics.debtToEquity}%` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground font-sans">Current Ratio</span>
                      <span className="font-bold text-foreground">{metrics.currentRatio != null ? `${metrics.currentRatio}x` : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Valuation Breakdown */}
                <div className="p-4 rounded-2xl bg-card/80 border border-border/60 space-y-3">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-indigo-400" /> Multiples & Fair Value Modeling
                  </span>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-sans">Forward P/E Multiple</span>
                      <span className="font-bold text-foreground">{metrics.forwardPE ? `${metrics.forwardPE}x` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-sans">Trailing P/E Multiple</span>
                      <span className="font-bold text-foreground">{metrics.trailingPE ? `${metrics.trailingPE}x` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-sans">Price to Sales (P/S)</span>
                      <span className="font-bold text-foreground">{metrics.priceToSales ? `${metrics.priceToSales}x` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-sans">PEG Ratio</span>
                      <span className="font-bold text-foreground">{metrics.pegRatio ? `${metrics.pegRatio}x` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-sans">Free Cash Flow Yield</span>
                      <span className="font-bold text-foreground">{metrics.fcfYieldPct ? `${metrics.fcfYieldPct}%` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground font-sans">Estimated Fair Value</span>
                      <span className="font-bold text-emerald-400">{fmtCurrency(metrics.fairValueEstimate)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: TACTICAL EXECUTION */}
            <TabsContent value="tactical" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
                <div className="p-3.5 rounded-xl bg-card/70 border border-border/60">
                  <span className="text-[10px] text-muted-foreground uppercase block font-sans">Suggested Buy Zone</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {fmtCurrency(suggestedBuyZone.min)} - {fmtCurrency(suggestedBuyZone.max)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-card/70 border border-border/60">
                  <span className="text-[10px] text-muted-foreground uppercase block font-sans">Price Target (Fair Value)</span>
                  <span className="text-sm font-bold text-foreground">
                    {fmtCurrency(targetPrice)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-card/70 border border-border/60">
                  <span className="text-[10px] text-muted-foreground uppercase block font-sans">Stop Loss Anchor</span>
                  <span className="text-sm font-bold text-rose-400">
                    {fmtCurrency(stopLossAnchor)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-card/70 border border-border/60">
                  <span className="text-[10px] text-muted-foreground uppercase block font-sans">Recommended Max Allocation</span>
                  <span className="text-sm font-bold text-foreground">
                    {recommendedMaxAllocationPct}% Portfolio
                  </span>
                </div>
              </div>

              {/* Portfolio Position Context if Holding */}
              {isHolding && holdingDetails && (
                <div className="p-4 rounded-2xl bg-accent/20 border border-border/60 space-y-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Current Portfolio Position Context
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-sans">Broker</span>
                      <span className="font-bold text-foreground">{holdingDetails.broker}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-sans">Quantity</span>
                      <span className="font-bold text-foreground">{holdingDetails.quantity} Shares</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-sans">Average Cost</span>
                      <span className="font-bold text-foreground">{fmtCurrency(holdingDetails.averageCost)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-sans">Unrealized P&L</span>
                      <span className={cn("font-bold", holdingDetails.unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {holdingDetails.unrealizedPnL >= 0 ? '+' : ''}{fmtCurrency(holdingDetails.unrealizedPnL)} ({holdingDetails.unrealizedPnLPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 4: BULL VS BEAR THESIS */}
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
            <div className="flex items-center gap-2 flex-wrap">
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
              {onAnalyzeEarnings && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAnalyzeEarnings(symbol)}
                  className="h-8 text-xs font-bold gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Analyze Latest Earnings</span>
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
