import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Zap,
  Layers,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sparkles,
  BarChart3,
  Clock,
  DollarSign,
  Compass,
  FileSpreadsheet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OptionsLiquidityData, useOptionsLiquidity } from '@/services/researchData';

interface OptionsLiquidityCardProps {
  symbol: string;
  onOpenTradeStructure?: () => void;
  onOpenOptionsAgent?: () => void;
}

export function OptionsLiquidityCard({
  symbol,
  onOpenTradeStructure,
  onOpenOptionsAgent
}: OptionsLiquidityCardProps) {
  const { data: liquidity, isLoading, isError, refetch } = useOptionsLiquidity(symbol);

  if (isLoading) {
    return (
      <Card className="bg-card/60 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl p-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Activity className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs font-semibold text-muted-foreground animate-pulse font-mono">
            Evaluating options chain depth, bid-ask spreads & institutional liquidity for {symbol}...
          </p>
        </div>
      </Card>
    );
  }

  if (isError || !liquidity) {
    return (
      <Card className="bg-card/60 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl p-6">
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <h4 className="text-sm font-bold text-foreground">Options Liquidity Data Unavailable</h4>
          <p className="text-xs text-muted-foreground max-w-sm">
            Unable to analyze derivatives liquidity for {symbol}. The equity may not have standardized exchange-listed options.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs mt-2">
            Retry Evaluation
          </Button>
        </div>
      </Card>
    );
  }

  if (!liquidity.hasOptions) {
    return (
      <Card className="bg-card/50 backdrop-blur-xl border border-border/60 shadow-lg rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-slate-800/80 rounded-2xl border border-border/50 text-muted-foreground">
            <XCircle className="w-6 h-6 text-slate-400" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-foreground">No Listed Options Chain</h4>
              <Badge variant="outline" className="text-[10px] bg-slate-900 text-slate-400 border-slate-700 font-mono">
                NON-OPTIONABLE
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {symbol} currently does not have standard options contracts traded on US options exchanges (CBOE/Nasdaq/MIAX). Only direct cash equity shares can be transacted.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const isElite = liquidity.score >= 88;
  const isHigh = liquidity.score >= 74 && liquidity.score < 88;
  const isModerate = liquidity.score >= 55 && liquidity.score < 74;

  const scoreBadgeBg =
    liquidity.badgeColor === 'emerald'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
      : liquidity.badgeColor === 'cyan'
      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
      : liquidity.badgeColor === 'amber'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : liquidity.badgeColor === 'orange'
      ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
      : 'bg-rose-500/20 text-rose-300 border-rose-500/40';

  const renderStars = (starsCount: number) => {
    const fullStars = Math.floor(starsCount);
    const hasHalf = starsCount % 1 >= 0.5;
    return (
      <div className="flex items-center gap-0.5 text-amber-400">
        {[...Array(5)].map((_, i) => {
          if (i < fullStars) return <span key={i}>★</span>;
          if (i === fullStars && hasHalf) return <span key={i} className="opacity-75">★</span>;
          return <span key={i} className="text-slate-600">☆</span>;
        })}
      </div>
    );
  };

  return (
    <Card className="bg-card/70 backdrop-blur-2xl border border-border/70 shadow-xl hover:border-primary/40 transition-all rounded-2xl overflow-hidden">
      
      {/* Top Accent Strip */}
      <div className={cn(
        "h-1.5 w-full",
        isElite ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" :
        isHigh ? "bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" :
        isModerate ? "bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600" :
        "bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600"
      )} />

      {/* Card Header */}
      <CardHeader className="p-6 pb-4 border-b border-border/40 bg-accent/15">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] font-mono font-bold uppercase tracking-wider">
                Derivatives Liquidity Diagnostic
              </Badge>
              <Badge className={cn("text-[10px] font-mono font-bold uppercase", scoreBadgeBg)}>
                {liquidity.tierLabel}
              </Badge>
              {liquidity.metrics.pennySpreadProgram && (
                <Badge variant="outline" className="text-[10px] font-mono font-semibold border-emerald-500/30 text-emerald-400 bg-emerald-950/20">
                  ⚡ Penny Pilot ($0.01 Ticks)
                </Badge>
              )}
            </div>

            <CardTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2 pt-1">
              <Activity className="w-5 h-5 text-primary" />
              Options Liquidity & Execution Quality
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Institutional derivatives analysis measuring bid-ask tightness, open interest depth, and multi-leg spread execution feasibility for {symbol}.
            </CardDescription>
          </div>

          {/* Large Liquidity Score Gauge Badge */}
          <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
            <div className={cn("flex flex-col items-center justify-center p-3 rounded-2xl border font-mono", scoreBadgeBg)}>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black tracking-tight">{liquidity.score}</span>
                <span className="text-xs opacity-70">/100</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-xs font-bold">
                {renderStars(liquidity.stars)}
                <span className="ml-1 text-[11px]">{liquidity.stars.toFixed(1)}</span>
              </div>
            </div>
          </div>

        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        
        {/* ================= 1. PRIMARY LIQUIDITY METRICS GRID ================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          
          {/* Average ATM Bid-Ask Spread */}
          <div className="bg-card/80 p-3 rounded-xl border border-border/60 shadow-sm space-y-1">
            <span className="text-[10px] uppercase font-sans font-bold text-muted-foreground block">
              Avg ATM Bid-Ask Spread
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <strong className={cn(
                "text-lg font-black",
                liquidity.metrics.avgAtmSpreadDollars <= 0.05 ? "text-emerald-400" :
                liquidity.metrics.avgAtmSpreadDollars <= 0.15 ? "text-cyan-300" :
                liquidity.metrics.avgAtmSpreadDollars <= 0.35 ? "text-amber-400" : "text-rose-400"
              )}>
                ${liquidity.metrics.avgAtmSpreadDollars.toFixed(2)}
              </strong>
              <span className="text-[11px] text-muted-foreground">
                ({liquidity.metrics.avgAtmSpreadPercent.toFixed(1)}% of mid)
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block font-sans">
              {liquidity.metrics.avgAtmSpreadDollars <= 0.04 ? 'Ultra-tight institutional spread' : 'Moderate spread friction'}
            </span>
          </div>

          {/* Total Open Interest */}
          <div className="bg-card/80 p-3 rounded-xl border border-border/60 shadow-sm space-y-1">
            <span className="text-[10px] uppercase font-sans font-bold text-muted-foreground block">
              Total Open Interest
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <strong className="text-lg font-black text-foreground">
                {liquidity.metrics.totalOpenInterest.toLocaleString()}
              </strong>
              <span className="text-[10px] text-muted-foreground">contracts</span>
            </div>
            <span className="text-[10px] text-muted-foreground block font-sans">
              Calls: {liquidity.metrics.callOpenInterest.toLocaleString()} • Puts: {liquidity.metrics.putOpenInterest.toLocaleString()}
            </span>
          </div>

          {/* Total Daily Option Volume */}
          <div className="bg-card/80 p-3 rounded-xl border border-border/60 shadow-sm space-y-1">
            <span className="text-[10px] uppercase font-sans font-bold text-muted-foreground block">
              Daily Option Volume
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <strong className="text-lg font-black text-primary">
                {liquidity.metrics.totalDailyVolume.toLocaleString()}
              </strong>
              <span className="text-[10px] text-muted-foreground">/day</span>
            </div>
            <span className="text-[10px] text-muted-foreground block font-sans">
              Put/Call Vol Ratio: <b>{liquidity.metrics.putCallVolumeRatio}</b>
            </span>
          </div>

          {/* Available Expirations */}
          <div className="bg-card/80 p-3 rounded-xl border border-border/60 shadow-sm space-y-1">
            <span className="text-[10px] uppercase font-sans font-bold text-muted-foreground block">
              Available Expirations
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <strong className="text-lg font-black text-foreground">
                {liquidity.metrics.availableExpirationsCount} Dates
              </strong>
            </div>
            <span className="text-[10px] text-muted-foreground block font-sans">
              {liquidity.metrics.hasWeeklyExpirations ? '✓ Weeklies + Monthlies + LEAPs' : 'Monthlies only'}
            </span>
          </div>

        </div>

        {/* ================= 2. COMPONENT SCORES BREAKDOWN METER ================= */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 font-sans">
              <BarChart3 className="w-3.5 h-3.5 text-primary" />
              Liquidity Component Breakdown
            </span>
            <span className="text-xs font-mono font-bold text-primary">
              Overall Score: {liquidity.score} / 100
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 font-mono text-xs">
            {/* Spread Score */}
            <div className="space-y-1 bg-card/60 p-2.5 rounded-lg border border-border/40">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Spread Tightness</span>
                <b className="text-emerald-400">{liquidity.componentScores.spreadScore}/35</b>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(liquidity.componentScores.spreadScore / 35) * 100}%` }} />
              </div>
            </div>

            {/* OI Depth Score */}
            <div className="space-y-1 bg-card/60 p-2.5 rounded-lg border border-border/40">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Open Interest</span>
                <b className="text-cyan-400">{liquidity.componentScores.oiDepthScore}/25</b>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(liquidity.componentScores.oiDepthScore / 25) * 100}%` }} />
              </div>
            </div>

            {/* Volume Score */}
            <div className="space-y-1 bg-card/60 p-2.5 rounded-lg border border-border/40">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Daily Volume</span>
                <b className="text-purple-400">{liquidity.componentScores.volumeScore}/20</b>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(liquidity.componentScores.volumeScore / 20) * 100}%` }} />
              </div>
            </div>

            {/* Breadth Score */}
            <div className="space-y-1 bg-card/60 p-2.5 rounded-lg border border-border/40">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Expirations</span>
                <b className="text-amber-400">{liquidity.componentScores.breadthScore}/10</b>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(liquidity.componentScores.breadthScore / 10) * 100}%` }} />
              </div>
            </div>

            {/* Balance Score */}
            <div className="space-y-1 bg-card/60 p-2.5 rounded-lg border border-border/40">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Put/Call Balance</span>
                <b className="text-blue-400">{liquidity.componentScores.balanceScore}/10</b>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(liquidity.componentScores.balanceScore / 10) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ================= 3. NEAREST ATM CALL & PUT CONTRACTS SNAPSHOT ================= */}
        {(liquidity.metrics.nearestAtmCall || liquidity.metrics.nearestAtmPut) && (
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block font-sans">
              Front Expiration Near-The-Money (ATM) Live Snapshot
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              
              {/* ATM Call */}
              {liquidity.metrics.nearestAtmCall && (
                <div className="p-3.5 rounded-xl bg-card/60 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold">
                      ATM CALL (${liquidity.metrics.nearestAtmCall.strike})
                    </Badge>
                    <span className="text-muted-foreground text-[11px]">
                      {liquidity.metrics.nearestAtmCall.expiration} ({liquidity.metrics.nearestAtmCall.dte}d)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="bg-slate-900/60 p-1.5 rounded-lg border border-border/40">
                      <span className="text-[9px] uppercase font-sans text-muted-foreground block">Bid / Ask</span>
                      <b className="text-foreground">${liquidity.metrics.nearestAtmCall.bid.toFixed(2)} / ${liquidity.metrics.nearestAtmCall.ask.toFixed(2)}</b>
                    </div>
                    <div className="bg-slate-900/60 p-1.5 rounded-lg border border-border/40">
                      <span className="text-[9px] uppercase font-sans text-muted-foreground block">Mid Price</span>
                      <b className="text-emerald-400">${liquidity.metrics.nearestAtmCall.mid.toFixed(2)}</b>
                    </div>
                    <div className="bg-slate-900/60 p-1.5 rounded-lg border border-border/40">
                      <span className="text-[9px] uppercase font-sans text-muted-foreground block">Spread</span>
                      <b className="text-cyan-300">${liquidity.metrics.nearestAtmCall.spread.toFixed(2)}</b>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>Vol: <b>{liquidity.metrics.nearestAtmCall.volume.toLocaleString()}</b></span>
                    <span>OI: <b>{liquidity.metrics.nearestAtmCall.openInterest.toLocaleString()}</b></span>
                    <span>IV: <b>{liquidity.metrics.nearestAtmCall.impliedVolatility}%</b></span>
                  </div>
                </div>
              )}

              {/* ATM Put */}
              {liquidity.metrics.nearestAtmPut && (
                <div className="p-3.5 rounded-xl bg-card/60 border border-rose-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] font-bold">
                      ATM PUT (${liquidity.metrics.nearestAtmPut.strike})
                    </Badge>
                    <span className="text-muted-foreground text-[11px]">
                      {liquidity.metrics.nearestAtmPut.expiration} ({liquidity.metrics.nearestAtmPut.dte}d)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="bg-slate-900/60 p-1.5 rounded-lg border border-border/40">
                      <span className="text-[9px] uppercase font-sans text-muted-foreground block">Bid / Ask</span>
                      <b className="text-foreground">${liquidity.metrics.nearestAtmPut.bid.toFixed(2)} / ${liquidity.metrics.nearestAtmPut.ask.toFixed(2)}</b>
                    </div>
                    <div className="bg-slate-900/60 p-1.5 rounded-lg border border-border/40">
                      <span className="text-[9px] uppercase font-sans text-muted-foreground block">Mid Price</span>
                      <b className="text-rose-400">${liquidity.metrics.nearestAtmPut.mid.toFixed(2)}</b>
                    </div>
                    <div className="bg-slate-900/60 p-1.5 rounded-lg border border-border/40">
                      <span className="text-[9px] uppercase font-sans text-muted-foreground block">Spread</span>
                      <b className="text-cyan-300">${liquidity.metrics.nearestAtmPut.spread.toFixed(2)}</b>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>Vol: <b>{liquidity.metrics.nearestAtmPut.volume.toLocaleString()}</b></span>
                    <span>OI: <b>{liquidity.metrics.nearestAtmPut.openInterest.toLocaleString()}</b></span>
                    <span>IV: <b>{liquidity.metrics.nearestAtmPut.impliedVolatility}%</b></span>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ================= 4. STRATEGY SUITABILITY PLAYBOOK ================= */}
        <div className="space-y-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block font-sans">
            Derivatives Strategy Suitability & Execution Playbook
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {liquidity.strategySuitability.map((strat, i) => {
              const isExec = strat.suitability === 'EXCELLENT';
              const isGood = strat.suitability === 'GOOD';
              const isFair = strat.suitability === 'FAIR';

              return (
                <div
                  key={i}
                  className={cn(
                    "p-3 rounded-xl border space-y-1 bg-card/60 transition-colors",
                    isExec ? "border-emerald-500/30 hover:border-emerald-500/50" :
                    isGood ? "border-cyan-500/30 hover:border-cyan-500/50" :
                    isFair ? "border-amber-500/30 hover:border-amber-500/50" :
                    "border-border/50 opacity-75"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground font-mono">{strat.strategyName}</span>
                    <Badge
                      className={cn(
                        "text-[9px] font-bold uppercase font-mono px-1.5 py-0 h-4",
                        isExec ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" :
                        isGood ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" :
                        isFair ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                        "bg-slate-800 text-slate-400 border-slate-700"
                      )}
                    >
                      {strat.suitability}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {strat.notes}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= 5. TRADING GUIDANCE CALLOUT & ACTIONS ================= */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 via-accent/30 to-card border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1 flex-1 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-primary">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Execution Best Practice:</span>
            </div>
            <p className="text-foreground/90 leading-relaxed text-xs">
              {liquidity.tradingGuidance}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenTradeStructure && (
              <Button
                variant="default"
                size="sm"
                onClick={onOpenTradeStructure}
                className="h-8 text-xs font-bold gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-sm"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Structure Trade</span>
              </Button>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
