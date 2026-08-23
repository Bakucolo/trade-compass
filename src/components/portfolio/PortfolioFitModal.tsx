import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Scale,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  Layers,
  PieChart,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Plus,
  RefreshCw,
  Loader2,
  DollarSign,
  Percent,
  Sliders,
  Compass,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortfolioFit, PortfolioFitResult } from '@/services/portfolioFitService';

interface PortfolioFitModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  onOpenTradeIdea?: (symbol: string, initialThesis?: string) => void;
  onOpenNote?: (symbol: string) => void;
}

export function PortfolioFitModal({
  isOpen,
  onClose,
  symbol,
  onOpenTradeIdea,
  onOpenNote,
}: PortfolioFitModalProps) {
  const { data: fitData, isLoading, isError, error, refetch } = usePortfolioFit(symbol, isOpen);
  const [simulatedDollars, setSimulatedDollars] = useState<number>(3000);

  // Format currency helper
  const fmtCurr = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '—';
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const getVerdictStyle = (type?: string) => {
    switch (type) {
      case 'EXCELLENT_FIT':
        return {
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          gradient: 'from-emerald-950/40 via-background to-teal-950/40',
          border: 'border-emerald-500/30',
          icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
          accentText: 'text-emerald-400',
        };
      case 'REPLACEMENT_SWAP':
        return {
          badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          gradient: 'from-cyan-950/40 via-background to-blue-950/40',
          border: 'border-cyan-500/30',
          icon: <RefreshCw className="w-5 h-5 text-cyan-400" />,
          accentText: 'text-cyan-400',
        };
      case 'REDUNDANT_OVERWEIGHT':
        return {
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          gradient: 'from-amber-950/40 via-background to-orange-950/40',
          border: 'border-amber-500/30',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          accentText: 'text-amber-400',
        };
      case 'HIGH_BETA_RISK':
        return {
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          gradient: 'from-rose-950/40 via-background to-pink-950/40',
          border: 'border-rose-500/30',
          icon: <ShieldAlert className="w-5 h-5 text-rose-400" />,
          accentText: 'text-rose-400',
        };
      default:
        return {
          badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          gradient: 'from-purple-950/40 via-background to-indigo-950/40',
          border: 'border-purple-500/30',
          icon: <Target className="w-5 h-5 text-purple-400" />,
          accentText: 'text-purple-400',
        };
    }
  };

  const style = getVerdictStyle(fitData?.verdictType);

  // Simulation calculations
  const totalPortVal = fitData?.portfolioTotalValue || 150000;
  const simWeightPercent = totalPortVal > 0 ? (simulatedDollars / (totalPortVal + simulatedDollars)) * 100 : 0;
  const simShares = fitData && fitData.currentPrice > 0 ? Math.floor(simulatedDollars / fitData.currentPrice) : 0;
  const currentSectorVal = fitData?.sectorImpact.currentSectorMarketValue || 0;
  const simSectorWeight = totalPortVal > 0 ? ((currentSectorVal + simulatedDollars) / (totalPortVal + simulatedDollars)) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[860px] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-2xl border border-primary/20 shadow-2xl">
        {/* Header */}
        <DialogHeader className={cn('p-6 pb-4 border-b border-border/50 bg-gradient-to-r', style.gradient)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
                <Scale className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <span className="font-mono font-black">{symbol}</span>
                    <span className="text-muted-foreground font-normal text-sm">
                      {fitData?.companyName}
                    </span>
                  </DialogTitle>
                  <Badge variant="outline" className={cn('text-[10px] font-bold uppercase font-mono px-2 py-0.5', style.badge)}>
                    {fitData ? `${fitData.fitScore}/100 Fit` : 'Analyzing'}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  <span>{fitData?.categoryName || 'Portfolio Overlap & Category Benchmarking'}</span>
                  {fitData?.currentPrice ? (
                    <span className="font-mono font-bold text-foreground">
                      • ${fitData.currentPrice.toFixed(2)}
                    </span>
                  ) : null}
                </DialogDescription>
              </div>
            </div>

            {fitData && (
              <div className="text-right hidden sm:block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Overall Fit Score
                </span>
                <span className={cn('text-2xl font-black font-mono', style.accentText)}>
                  {fitData.fitScore}
                  <span className="text-xs text-muted-foreground font-normal">/100</span>
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">Analyzing Portfolio Fit & Peer Correlation...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Benchmarking {symbol} against existing holdings, sector concentrations & factor sensitivities.
                </p>
              </div>
            </div>
          ) : isError || !fitData ? (
            <div className="p-8 text-center space-y-3 bg-destructive/10 rounded-xl border border-destructive/30">
              <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
              <p className="text-sm font-bold text-destructive">
                {error?.message || `Failed to analyze portfolio fit for ${symbol}`}
              </p>
              <Button size="sm" variant="outline" onClick={() => refetch()} className="text-xs">
                Retry Analysis
              </Button>
            </div>
          ) : (
            <>
              {/* 1. Tactical Verdict Spotlight Banner */}
              <div className={cn('p-4 rounded-2xl border bg-card/60 backdrop-blur-md space-y-2 relative overflow-hidden', style.border)}>
                <div className="flex items-center gap-2.5">
                  {style.icon}
                  <h3 className={cn('font-bold text-sm tracking-tight', style.accentText)}>
                    {fitData.verdictTitle}
                  </h3>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed pl-7">
                  {fitData.verdictSummary}
                </p>
                <div className="flex items-center gap-2 pl-7 pt-1 text-[11px] font-semibold text-primary">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Recommendation: {fitData.suggestedAction}</span>
                </div>
              </div>

              {/* 2. Correlation & Diversification Barometers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Correlation Score */}
                <div className="p-4 rounded-xl bg-accent/20 border border-border/60 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Portfolio Correlation
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-bold font-mono px-1.5 py-0',
                        fitData.correlationRating === 'LOW'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : fitData.correlationRating === 'MODERATE'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      )}
                    >
                      {fitData.correlationRating} ({fitData.correlationEstimate.toFixed(2)})
                    </Badge>
                  </div>
                  <div className="w-full bg-background/60 h-2 rounded-full overflow-hidden my-2 border border-border/40">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        fitData.correlationRating === 'LOW'
                          ? 'bg-emerald-400'
                          : fitData.correlationRating === 'MODERATE'
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                      )}
                      style={{ width: `${Math.round(fitData.correlationEstimate * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {fitData.correlationRating === 'LOW'
                      ? 'High non-correlated diversification benefit'
                      : fitData.correlationRating === 'MODERATE'
                      ? 'Moderate co-movement with existing assets'
                      : 'High overlap with existing sector positions'}
                  </p>
                </div>

                {/* Sector Exposure Impact */}
                <div className="p-4 rounded-xl bg-accent/20 border border-border/60 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {fitData.sectorImpact.sector} Exposure
                    </span>
                    <span className="font-mono text-xs font-bold text-foreground">
                      {fitData.sectorImpact.currentSectorWeightPercent.toFixed(1)}% → {fitData.sectorImpact.projectedSectorWeightPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-background/60 h-2 rounded-full overflow-hidden my-2 border border-border/40">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        fitData.sectorImpact.isOverweight ? 'bg-amber-500' : 'bg-primary'
                      )}
                      style={{ width: `${Math.min(100, Math.round(fitData.sectorImpact.projectedSectorWeightPercent * 2.5))}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {fitData.sectorImpact.existingHoldingsInSectorCount > 0
                      ? `${fitData.sectorImpact.existingHoldingsInSectorCount} existing holding(s) in this sector (${fmtCurr(fitData.sectorImpact.currentSectorMarketValue)})`
                      : 'First position in this sector (0% existing)'}
                  </p>
                </div>

                {/* Portfolio Beta Impact */}
                <div className="p-4 rounded-xl bg-accent/20 border border-border/60 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Beta / Volatility Shift
                    </span>
                    <span className="font-mono text-xs font-bold text-foreground">
                      {fitData.portfolioBetaBefore.toFixed(2)} → {fitData.portfolioBetaAfterEstimate.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 my-1.5">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-mono font-bold text-foreground">
                      Asset Beta: {fitData.peers[0]?.beta ? fitData.peers[0].beta.toFixed(2) : '1.15'}x
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {fitData.diversificationBenefitScore >= 70
                      ? 'Accretive to risk-adjusted portfolio Sharpe'
                      : 'Increases factor sensitivity to market drawdowns'}
                  </p>
                </div>
              </div>

              {/* 3. Category & Peer Comparison: "Is it better than the rest in that category?" */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Category Head-to-Head Benchmark ({fitData.categoryName})
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {fitData.candidateWinsCount > 0
                      ? `${symbol} leads peers in ${fitData.candidateWinsCount} metric(s)`
                      : 'Sector comparison'}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 bg-accent/30 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                        <th className="p-3">Asset</th>
                        <th className="p-3">Portfolio Status</th>
                        <th className="p-3 text-right">Price</th>
                        <th className="p-3 text-right">Fwd P/E</th>
                        <th className="p-3 text-right">P/S</th>
                        <th className="p-3 text-right">Op. Margin</th>
                        <th className="p-3 text-right">ROE %</th>
                        <th className="p-3 text-right">Debt/Eq</th>
                        <th className="p-3 text-right">Beta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {fitData.peers.map((peer) => {
                        const isCandidate = peer.isCandidate;
                        return (
                          <tr
                            key={peer.symbol}
                            className={cn(
                              'transition-colors',
                              isCandidate
                                ? 'bg-cyan-500/10 hover:bg-cyan-500/15 font-semibold text-foreground'
                                : 'hover:bg-accent/30 text-muted-foreground'
                            )}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2 font-sans">
                                <span className={cn('font-mono font-black text-xs', isCandidate ? 'text-cyan-300' : 'text-foreground')}>
                                  {peer.symbol}
                                </span>
                                {isCandidate && (
                                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[9px] px-1 py-0 h-4 uppercase">
                                    Target
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground block truncate max-w-[110px] font-normal">
                                {peer.name}
                              </span>
                            </td>

                            <td className="p-3 text-[11px] font-sans">
                              {isCandidate ? (
                                <span className="text-cyan-300 font-semibold">New Candidate</span>
                              ) : (
                                <span>
                                  {fmtCurr(peer.marketValue)}{' '}
                                  <span className="text-[10px] text-muted-foreground">
                                    ({peer.portfolioWeightPercent?.toFixed(1)}%)
                                  </span>
                                </span>
                              )}
                            </td>

                            <td className="p-3 text-right text-foreground font-bold">
                              ${peer.currentPrice.toFixed(2)}
                            </td>

                            <td className="p-3 text-right">
                              {peer.forwardPE ? `${peer.forwardPE.toFixed(1)}x` : '—'}
                            </td>

                            <td className="p-3 text-right">
                              {peer.priceToSales ? `${peer.priceToSales.toFixed(1)}x` : '—'}
                            </td>

                            <td className="p-3 text-right">
                              {peer.operatingMarginPercent != null ? (
                                <span className={peer.operatingMarginPercent >= 20 ? 'text-emerald-400 font-bold' : ''}>
                                  {peer.operatingMarginPercent.toFixed(1)}%
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>

                            <td className="p-3 text-right">
                              {peer.roePercent != null ? (
                                <span className={peer.roePercent >= 15 ? 'text-emerald-400 font-bold' : ''}>
                                  {peer.roePercent.toFixed(1)}%
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>

                            <td className="p-3 text-right">
                              {peer.debtToEquity != null ? (
                                <span className={peer.debtToEquity <= 50 ? 'text-emerald-400 font-bold' : ''}>
                                  {peer.debtToEquity.toFixed(0)}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>

                            <td className="p-3 text-right">
                              {peer.beta ? peer.beta.toFixed(2) : '1.15'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Strategic Pros & Portfolio Risks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pros */}
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Competitive Advantages vs. Portfolio</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-emerald-200/90">
                    {fitData.keyPros.map((pro, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Risks */}
                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/40 space-y-2.5">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <XCircle className="w-4 h-4" />
                    <span>Portfolio Concentration & Factor Risks</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-rose-200/90">
                    {fitData.keyRisks.map((risk, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 5. Interactive Sizing Simulator */}
              <div className="p-4 rounded-xl bg-accent/20 border border-border/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Trade Allocation Simulator
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm text-primary">
                    {fmtCurr(simulatedDollars)} ({simWeightPercent.toFixed(1)}% of Portfolio)
                  </span>
                </div>

                <Slider
                  value={[simulatedDollars]}
                  min={500}
                  max={Math.min(25000, Math.round(totalPortVal * 0.1))}
                  step={250}
                  onValueChange={(val) => setSimulatedDollars(val[0])}
                  className="py-2"
                />

                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1 bg-background/50 p-2.5 rounded-lg border border-border/40">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block font-sans font-bold">
                      Simulated Shares
                    </span>
                    <span className="font-bold text-foreground">
                      {simShares} shares
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block font-sans font-bold">
                      Max Recommended Size
                    </span>
                    <span className="font-bold text-cyan-400">
                      {fmtCurr(fitData.recommendedMaxAllocationUSD)} ({fitData.recommendedMaxWeightPercent}%)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block font-sans font-bold">
                      Post-Trade Sector Share
                    </span>
                    <span className={cn('font-bold', simSectorWeight > 25 ? 'text-amber-400' : 'text-foreground')}>
                      {simSectorWeight.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/50 bg-accent/10 flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground hidden sm:block font-mono">
            Analyzed with live portfolio holdings & Yahoo Finance fundamentals
          </div>

          <div className="flex items-center gap-2">
            {onOpenNote && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenNote(symbol);
                }}
                className="text-xs h-9"
              >
                Add Note
              </Button>
            )}

            {onOpenTradeIdea && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  const thesis = fitData
                    ? `### 🎯 Core Hypothesis: ${fitData.verdictTitle}\n\n${fitData.verdictSummary}\n\n**Category Fit:** Leads category peers in ${fitData.candidateSuperiorMetrics.join(', ')}.\n**Sizing:** Recommended max size ${fmtCurr(fitData.recommendedMaxAllocationUSD)} (${fitData.recommendedMaxWeightPercent}%).`
                    : undefined;
                  onOpenTradeIdea(symbol, thesis);
                }}
                className="text-xs h-9 text-purple-300 border-purple-500/30 hover:bg-purple-500/10 gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Draft Trade Idea
              </Button>
            )}

            <Button
              size="sm"
              onClick={onClose}
              className="text-xs h-9 px-4 font-semibold"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
