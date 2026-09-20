import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  Target,
  BarChart3,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LatestEarningsAnalysisResult } from '@/services/scorecardService';

interface StockEarningsAnalysisModalProps {
  result: LatestEarningsAnalysisResult | null;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  onReanalyze?: () => void;
}

export function StockEarningsAnalysisModal({
  result,
  isOpen,
  onClose,
  isLoading,
  onReanalyze,
}: StockEarningsAnalysisModalProps) {
  if (!result && !isLoading) return null;

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'STRONG_BEAT':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'MODEST_BEAT':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      case 'IN_LINE':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'MODEST_MISS':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'BIG_MISS':
      default:
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card/95 backdrop-blur-2xl border-border/80 p-0 shadow-2xl rounded-2xl">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary animate-pulse">
                <Zap className="w-7 h-7" />
              </div>
              <Sparkles className="w-4 h-4 text-amber-400 absolute -top-1 -right-1 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">AI Earnings Agent at Work...</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Parsing quarterly transcripts, consensus EPS revisions, revenue surprises, and calculating scorecard impact.
              </p>
            </div>
          </div>
        ) : result ? (
          <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 via-primary/20 to-indigo-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-sm">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-xl text-foreground">{result.symbol}</span>
                    <Badge variant="outline" className={cn("text-xs font-bold px-2 py-0.5", getVerdictBadge(result.verdict))}>
                      {result.verdictLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-sm">{result.companyName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:text-right font-mono">
                <div>
                  <span className="text-xs text-muted-foreground block font-sans">Current Spot</span>
                  <span className="text-lg font-black text-foreground">${result.currentPrice.toFixed(2)}</span>
                </div>
                {result.reportDate && (
                  <div className="pl-3 border-l border-border/50 text-left sm:text-right">
                    <span className="text-[10px] text-muted-foreground block font-sans flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" /> Latest Period
                    </span>
                    <span className="text-xs font-bold text-foreground">{result.reportDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Executive Diagnosis */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-card to-accent/20 border border-primary/30 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  AI Agent Executive Diagnosis
                </span>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed font-sans">
                {result.executiveDiagnosis}
              </p>
            </div>

            {/* Scorecard & Valuation Impact Panel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-xl bg-card/70 border border-border/60 space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-primary" /> Scorecard Impact
                </span>
                <div className="flex items-center gap-2 font-mono">
                  <span className={cn(
                    "text-lg font-black",
                    result.scorecardImpact.recommendedScoreAdjustment >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {result.scorecardImpact.recommendedScoreAdjustment >= 0 ? '+' : ''}
                    {result.scorecardImpact.recommendedScoreAdjustment.toFixed(1)} Pts
                  </span>
                  <span className="text-[11px] text-muted-foreground font-sans">to Overall Conviction Score</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight pt-0.5">
                  {result.scorecardImpact.analystSummary}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-card/70 border border-border/60 space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-indigo-400" /> Fair Value Target Revision
                </span>
                <div className="flex items-center gap-2 font-mono">
                  <span className={cn(
                    "text-lg font-black",
                    result.scorecardImpact.fairValueAdjustmentPct >= 0 ? "text-indigo-400" : "text-rose-400"
                  )}>
                    {result.scorecardImpact.fairValueAdjustmentPct >= 0 ? '+' : ''}
                    {result.scorecardImpact.fairValueAdjustmentPct.toFixed(1)}%
                  </span>
                  <span className="text-[11px] text-muted-foreground font-sans">target multiple revision</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight pt-0.5">
                  Forward baseline adjusted based on quarterly cash flow run-rate.
                </p>
              </div>
            </div>

            {/* Guidance Commentary */}
            {result.guidanceCommentary && (
              <div className="p-3.5 rounded-xl bg-accent/20 border border-border/50 space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-teal-400" /> Management Guidance & Outlook
                </span>
                <p className="text-xs text-foreground/90 leading-relaxed">
                  {result.guidanceCommentary}
                </p>
              </div>
            )}

            {/* Quarterly EPS & Surprise History Table */}
            {result.quarters && result.quarters.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Quarterly Performance History (Actual vs Consensus)
                </span>
                <div className="rounded-xl border border-border/60 overflow-hidden bg-card/60">
                  <table className="w-full text-xs text-left border-collapse font-mono">
                    <thead>
                      <tr className="bg-accent/30 border-b border-border/60 font-sans text-muted-foreground text-[10px] uppercase">
                        <th className="p-2.5 font-bold">Quarter</th>
                        <th className="p-2.5 font-bold text-center">EPS Actual</th>
                        <th className="p-2.5 font-bold text-center">Consensus</th>
                        <th className="p-2.5 font-bold text-center">Surprise %</th>
                        <th className="p-2.5 font-bold text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {result.quarters.map((q, idx) => {
                        const isSurprisePositive = q.epsSurprisePct != null && q.epsSurprisePct >= 0;
                        return (
                          <tr key={idx} className="hover:bg-accent/20 transition-colors">
                            <td className="p-2.5 font-bold text-foreground">{q.quarter}</td>
                            <td className="p-2.5 text-center font-bold text-foreground">
                              {q.epsActual != null ? `$${q.epsActual.toFixed(2)}` : '—'}
                            </td>
                            <td className="p-2.5 text-center text-muted-foreground">
                              {q.epsEstimate != null ? `$${q.epsEstimate.toFixed(2)}` : '—'}
                            </td>
                            <td className="p-2.5 text-center font-bold">
                              {q.epsSurprisePct != null ? (
                                <span className={isSurprisePositive ? 'text-emerald-400' : 'text-rose-400'}>
                                  {isSurprisePositive ? '+' : ''}{q.epsSurprisePct}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-2.5 text-right text-muted-foreground font-sans">
                              {q.revenue != null
                                ? `$${(q.revenue / 1e9).toFixed(2)}B`
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Key Focus Points */}
            {result.keyFocusPoints && result.keyFocusPoints.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Next Quarter Focus Areas & Catalysts
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {result.keyFocusPoints.map((pt, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-card/60 border border-border/50 text-[11px] text-foreground/80 flex items-start gap-1.5">
                      <span className="text-primary font-bold">•</span>
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/50 text-xs text-muted-foreground">
              <span className="text-[10px] flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-muted-foreground" />
                Analyzed on {new Date(result.analyzedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>

              <div className="flex items-center gap-2">
                {onReanalyze && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onReanalyze}
                    className="h-8 text-xs font-bold gap-1.5 border-border/70"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Re-Analyze</span>
                  </Button>
                )}
                <Button variant="default" size="sm" onClick={onClose} className="h-8 text-xs font-bold px-4">
                  Done
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
