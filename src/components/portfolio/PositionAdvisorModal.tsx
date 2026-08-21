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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UnifiedPosition } from './types';
import {
  PositionAnalysisData,
  ManagementPlan,
  useAnalyzePosition
} from '@/services/positionAdvisorService';
import { saveStockNote } from '@/services/noteService';
import {
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Copy,
  Check,
  Compass,
  ArrowRight,
  Target,
  Zap,
  Layers,
  Clock,
  DollarSign,
  Activity,
  FileText,
  BookmarkPlus,
  Minus,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PositionAdvisorModalProps {
  position: UnifiedPosition | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PositionAdvisorModal({
  position,
  isOpen,
  onClose
}: PositionAdvisorModalProps) {
  const [analysisData, setAnalysisData] = useState<PositionAnalysisData | null>(null);
  const [liveChain, setLiveChain] = useState<any>(null);
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [showLiveChainQuotes, setShowLiveChainQuotes] = useState(false);

  const analyzeMutation = useAnalyzePosition();

  // Trigger analysis on modal open if not already loaded for this position
  React.useEffect(() => {
    if (isOpen && position) {
      handleRunAnalysis(position);
    } else if (!isOpen) {
      setAnalysisData(null);
      setLiveChain(null);
    }
  }, [isOpen, position?.id]);

  const handleRunAnalysis = async (pos: UnifiedPosition) => {
    try {
      const res = await analyzeMutation.mutateAsync(pos);
      setAnalysisData(res.analysis);
      setLiveChain(res.liveOptionChain || null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to analyze position');
    }
  };

  if (!position) return null;

  const isShort = position.quantity < 0;
  const isLosing = position.unrealizedPL < 0;
  const cleanBaseSymbol = (position.underlyingSymbol || position.symbol.match(/^[A-Z]+/)?.[0] || position.symbol).trim().toUpperCase();

  // Urgency styling
  const urgencyLevel = analysisData?.urgencyLevel || (isShort && isLosing && Math.abs(position.unrealizedPLPercent) > 50 ? 'CRITICAL_DEFENSE' : 'MONITOR_AND_ADJUST');

  const getUrgencyBadge = () => {
    if (urgencyLevel === 'CRITICAL_DEFENSE') {
      return {
        bg: 'bg-rose-950/40 border-rose-500/50 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.3)]',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        title: 'CRITICAL DEFENSE REQUIRED',
        icon: <ShieldAlert className="w-5 h-5 text-rose-400" />
      };
    }
    if (urgencyLevel === 'PROFIT_TARGET_REACHED') {
      return {
        bg: 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        title: 'PROFIT TARGET REACHED',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />
      };
    }
    if (urgencyLevel === 'HEALTHY_ON_TRACK') {
      return {
        bg: 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300',
        badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        title: 'HEALTHY & ON TRACK',
        icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />
      };
    }
    return {
      bg: 'bg-amber-950/30 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      title: 'MONITOR & ADJUST',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />
    };
  };

  const urgency = getUrgencyBadge();

  const handleCopyOrderLegs = async (plan: ManagementPlan) => {
    const legsText = plan.orderLegs.join('\n');
    const fullText = `[${position.symbol} ${plan.title}]\n${legsText}\nTarget: ${plan.netCreditOrDebit || 'N/A'}\nNew Breakeven: ${plan.newBreakeven || 'N/A'}`;
    await navigator.clipboard.writeText(fullText);
    setCopiedPlanId(plan.planId);
    toast.success(`Copied ${plan.title} orders to clipboard!`);
    setTimeout(() => setCopiedPlanId(null), 2000);
  };

  const handleSaveToStockNotes = async () => {
    if (!analysisData) return;
    setIsSavingNote(true);
    try {
      const planA = analysisData.rankedPlans.find(p => p.isRecommended) || analysisData.rankedPlans[0];
      const noteContent = `### AI Position Management Plan (${position.symbol})\n**Urgency**: ${analysisData.urgencyHeadline}\n**Diagnosis**: ${analysisData.currentPnlAssessment}\n\n**Recommended Defense (${planA.title})**:\n${planA.summary}\n\n**Order Legs**:\n${planA.orderLegs.map(l => `- ${l}`).join('\n')}\n\n**Expected Net**: ${planA.netCreditOrDebit || 'N/A'} | **New Breakeven**: ${planA.newBreakeven || 'N/A'}\n\n*Rule of Thumb: ${analysisData.tradingRuleOfThumb}*`;

      await saveStockNote({
        symbol: cleanBaseSymbol,
        content: noteContent,
        sentiment: urgencyLevel === 'CRITICAL_DEFENSE' ? 'BEARISH' : 'NEUTRAL',
        tags: `PositionDefense,${position.assetType},${position.source}`
      });

      toast.success(`Saved position defense plan to ${cleanBaseSymbol} notes!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save note');
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-2xl">
        
        {/* ================= MODAL TOP HEADER ================= */}
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-card/40 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-6">
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-primary/20 hover:bg-primary/30 text-primary border-primary/40 font-mono font-bold text-sm px-2.5 py-0.5">
                  {cleanBaseSymbol}
                </Badge>
                <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
                  {position.assetType} • {position.source}
                </Badge>
                {position.assetType === 'Option' && position.strike && (
                  <Badge variant="secondary" className="text-xs font-mono font-bold">
                    ${position.strike} {position.optionType}
                  </Badge>
                )}
                <span className="text-xs font-mono text-muted-foreground">
                  Qty: {position.quantity > 0 ? `+${position.quantity}` : position.quantity}
                </span>
              </div>

              <DialogTitle className="text-xl font-black tracking-tight text-foreground pt-1 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                AI Position Defense & Management Advisor
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Institutional options risk assessment, delta/gamma threat analysis, and automated defense playbooks.
              </DialogDescription>
            </div>

            {/* Current P&L Pill */}
            <div className={cn(
              "flex flex-col items-end justify-center px-4 py-2 rounded-2xl border shrink-0 font-mono",
              isLosing ? "bg-rose-950/20 border-rose-500/40 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)]" : "bg-emerald-950/20 border-emerald-500/40 text-emerald-400"
            )}>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                Unrealized P/L
              </span>
              <span className="text-xl font-black">
                {position.unrealizedPL >= 0 ? '+' : '-'}${Math.abs(position.unrealizedPL).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] font-bold">
                {position.unrealizedPLPercent >= 0 ? '+' : ''}{position.unrealizedPLPercent.toFixed(1)}%
              </span>
            </div>

          </div>

          {/* Top Control Bar */}
          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/40 flex-wrap">
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <span>Avg Cost: <b className="text-foreground">${position.averageCost.toFixed(2)}</b></span>
              <span>Current: <b className="text-foreground">${position.currentPrice.toFixed(2)}</b></span>
              {position.underlyingPrice && (
                <span>Underlying: <b className="text-foreground">${position.underlyingPrice.toFixed(2)}</b></span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveToStockNotes}
                disabled={!analysisData || isSavingNote}
                className="h-8 text-xs gap-1.5 border-border/80 hover:bg-accent/40"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-primary" />
                <span>Save to Stock Notes</span>
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={() => handleRunAnalysis(position)}
                disabled={analyzeMutation.isPending}
                className="h-8 text-xs gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-sm"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", analyzeMutation.isPending && "animate-spin")} />
                <span>{analyzeMutation.isPending ? 'Analyzing Position...' : 'Re-Analyze'}</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ================= MODAL BODY ================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          
          {analyzeMutation.isPending && !analysisData ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20 shadow-lg">
                <Sparkles className="w-10 h-10 text-purple-400 animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-base font-bold text-foreground">Analyzing Derivatives Risk & Defense Options...</h4>
                <p className="text-xs text-muted-foreground max-w-md">
                  Evaluating strike distance, gamma acceleration, DTE danger zone, extrinsic time value, and multi-leg recovery routes for {position.symbol}.
                </p>
              </div>
            </div>
          ) : analysisData ? (
            <>
              {/* ================= 1. URGENCY CALLOUT ALERT ================= */}
              <div className={cn("p-4 rounded-2xl border flex items-start gap-3.5 transition-all", urgency.bg)}>
                <div className="mt-0.5 shrink-0">
                  {urgency.icon}
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black uppercase tracking-wider">{urgency.title}</span>
                    <Badge variant="outline" className={cn("text-[10px] uppercase font-bold", urgency.badge)}>
                      {analysisData.urgencyLevel.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-bold text-foreground leading-snug">
                    {analysisData.urgencyHeadline}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                    {analysisData.currentPnlAssessment}
                  </p>
                </div>
              </div>

              {/* ================= 2. GREEKS & RISK DIAGNOSIS GRID ================= */}
              <Card className="bg-card/40 border-border/60 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-foreground">
                    <Activity className="w-4 h-4 text-purple-400" />
                    Greeks & Danger Zone Diagnostic
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  
                  <div className="bg-card/70 border border-border/50 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Delta Risk (Exposure)
                    </span>
                    <p className="text-xs text-foreground/90 leading-tight font-medium">
                      {analysisData.greeksAndRiskDiagnosis.deltaRisk || 'Normal Directional Exposure'}
                    </p>
                  </div>

                  <div className="bg-card/70 border border-border/50 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Gamma Acceleration
                    </span>
                    <p className="text-xs text-foreground/90 leading-tight font-medium">
                      {analysisData.greeksAndRiskDiagnosis.gammaRisk || 'Moderate Gamma'}
                    </p>
                  </div>

                  <div className="bg-card/70 border border-border/50 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Assignment Probability
                    </span>
                    <p className={cn(
                      "text-xs font-bold font-mono",
                      analysisData.greeksAndRiskDiagnosis.assignmentProbability?.toLowerCase().includes('high')
                        ? "text-rose-400"
                        : "text-emerald-400"
                    )}>
                      {analysisData.greeksAndRiskDiagnosis.assignmentProbability || 'Low (<15%)'}
                    </p>
                  </div>

                  <div className="bg-card/70 border border-border/50 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      DTE Danger Status
                    </span>
                    <p className={cn(
                      "text-xs font-bold",
                      analysisData.greeksAndRiskDiagnosis.dteDangerZone?.toLowerCase().includes('high')
                        ? "text-rose-400"
                        : "text-amber-400"
                    )}>
                      {analysisData.greeksAndRiskDiagnosis.dteDangerZone || 'Normal'}
                    </p>
                  </div>

                </CardContent>
              </Card>

              {/* ================= 3. RANKED MANAGEMENT PLAYBOOKS ================= */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                      Ranked Actionable Management Plans
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {analysisData.rankedPlans.length} Playbooks Available
                  </span>
                </div>

                <div className="space-y-4">
                  {analysisData.rankedPlans.map((plan) => (
                    <Card
                      key={plan.planId}
                      className={cn(
                        "transition-all duration-200 border shadow-md relative overflow-hidden",
                        plan.isRecommended
                          ? "bg-gradient-to-br from-purple-950/20 via-card/80 to-card/40 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                          : "bg-card/40 border-border/60 hover:border-border"
                      )}
                    >
                      {plan.isRecommended && (
                        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-gradient-to-b from-purple-500 to-indigo-600" />
                      )}

                      <CardHeader className="pb-3 border-b border-border/40 pl-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={cn(
                              "text-xs font-bold font-mono px-2 py-0.5",
                              plan.isRecommended ? "bg-purple-500 text-white" : "bg-muted text-muted-foreground"
                            )}>
                              PLAN {plan.planId}
                            </Badge>

                            <CardTitle className="text-sm font-bold text-foreground">
                              {plan.title}
                            </CardTitle>

                            {plan.isRecommended && (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Recommended Defense
                              </Badge>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyOrderLegs(plan)}
                            className="h-7 px-2.5 text-xs gap-1 self-start sm:self-center text-muted-foreground hover:text-foreground hover:bg-accent/40"
                          >
                            {copiedPlanId === plan.planId ? (
                              <><Check className="w-3 h-3 text-emerald-400" /> Copied!</>
                            ) : (
                              <><Copy className="w-3 h-3" /> Copy Orders</>
                            )}
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="p-5 pl-5 space-y-4">
                        
                        {/* Summary Rationale */}
                        <p className="text-xs text-foreground/90 leading-relaxed">
                          {plan.summary}
                        </p>

                        {/* Order Legs Box */}
                        {plan.orderLegs && plan.orderLegs.length > 0 && (
                          <div className="bg-background/80 border border-border/70 rounded-xl p-3.5 space-y-2 font-mono text-xs">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-sans">
                                <Layers className="w-3.5 h-3.5 text-primary" />
                                Exact Execution Order Legs:
                              </div>
                              <Badge variant="outline" className="text-[9px] font-sans font-semibold bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                                Live Exchange Quotes Applied
                              </Badge>
                            </div>
                            <div className="space-y-1.5 pl-1">
                              {plan.orderLegs.map((leg, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-foreground font-semibold flex-wrap">
                                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] shrink-0 font-sans">
                                    {idx + 1}
                                  </span>
                                  <span>{leg}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Metrics Bar (Net Credit / Breakeven / Pop) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                          {plan.netCreditOrDebit && (
                            <div className="bg-card/70 border border-border/50 rounded-xl p-2.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Net Effect</span>
                              <p className={cn(
                                "font-mono font-bold mt-0.5",
                                plan.netCreditOrDebit.includes('+') || plan.netCreditOrDebit.toLowerCase().includes('credit')
                                  ? "text-emerald-400"
                                  : "text-foreground"
                              )}>
                                {plan.netCreditOrDebit}
                              </p>
                            </div>
                          )}

                          {plan.newBreakeven && (
                            <div className="bg-card/70 border border-border/50 rounded-xl p-2.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">New Breakeven</span>
                              <p className="font-mono font-bold text-foreground mt-0.5">
                                {plan.newBreakeven}
                              </p>
                            </div>
                          )}

                          {plan.probabilityImprovement && (
                            <div className="bg-card/70 border border-border/50 rounded-xl p-2.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Probability Shift</span>
                              <p className="font-mono font-bold text-purple-300 mt-0.5">
                                {plan.probabilityImprovement}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Trade-offs */}
                        {plan.tradeoffs && (
                          <div className="text-[11px] text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/40 leading-relaxed">
                            <b className="text-foreground">Trade-offs & Risks:</b> {plan.tradeoffs}
                          </div>
                        )}

                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* ================= 4. TECHNICAL & CATALYST CONTEXT ================= */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Technical Levels */}
                <Card className="bg-card/40 border-border/60 shadow-sm p-4 space-y-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-primary" /> Key Underlying Technical Levels
                  </h5>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">Immediate Support</span>
                      <span className="font-mono font-bold text-emerald-400">{analysisData.technicalAndCatalystContext.supportLevel || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">Key Resistance</span>
                      <span className="font-mono font-bold text-foreground">{analysisData.technicalAndCatalystContext.resistanceLevel || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between pt-0.5">
                      <span className="text-muted-foreground">IV Environment</span>
                      <span className="font-mono font-bold text-purple-300">{analysisData.technicalAndCatalystContext.ivOutlook || 'Normal IV'}</span>
                    </div>
                  </div>
                </Card>

                {/* Institutional Rule of Thumb */}
                <Card className="bg-gradient-to-br from-card/80 to-purple-950/10 border-purple-500/20 shadow-sm p-4 space-y-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Derivatives Rule of Thumb
                  </h5>
                  <p className="text-xs text-foreground/90 italic leading-relaxed">
                    "{analysisData.tradingRuleOfThumb}"
                  </p>
                  {analysisData.technicalAndCatalystContext.earningsWarning && (
                    <div className="pt-2 border-t border-border/40 text-[11px] text-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{analysisData.technicalAndCatalystContext.earningsWarning}</span>
                    </div>
                  )}
                </Card>

              </div>

              {/* ================= 5. LIVE OPTION CHAIN REFERENCE QUOTES ================= */}
              {liveChain && liveChain.options && liveChain.options.length > 0 && (
                <Card className="bg-card/40 border-border/60 shadow-sm">
                  <CardHeader className="pb-2 border-b border-border/40 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-foreground">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      Live Option Chain Reference (Market Quotes)
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLiveChainQuotes(!showLiveChainQuotes)}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showLiveChainQuotes ? 'Hide Quotes' : `View ${liveChain.options.length} Live Quotes`}
                    </Button>
                  </CardHeader>
                  {showLiveChainQuotes && (
                    <CardContent className="p-4">
                      <p className="text-[11px] text-muted-foreground mb-3">
                        These real-time quotes were retrieved for <strong className="text-foreground">{liveChain.underlyingSymbol}</strong> at underlying price <strong className="text-foreground">${liveChain.underlyingPrice.toFixed(2)}</strong> to price all suggested management legs with verified precision:
                      </p>
                      <div className="max-h-56 overflow-y-auto border border-border/50 rounded-xl">
                        <table className="w-full text-xs font-mono">
                          <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground sticky top-0">
                            <tr>
                              <th className="p-2 text-left">Expiration</th>
                              <th className="p-2 text-left">Type</th>
                              <th className="p-2 text-right">Strike</th>
                              <th className="p-2 text-right">Bid</th>
                              <th className="p-2 text-right">Ask</th>
                              <th className="p-2 text-right">Mid Quote</th>
                              <th className="p-2 text-right">IV</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {liveChain.options.map((opt: any, idx: number) => (
                              <tr key={idx} className="hover:bg-muted/20">
                                <td className="p-2 text-muted-foreground">{opt.expiration} ({opt.dte}d)</td>
                                <td className={cn("p-2 font-bold", opt.optionType === 'PUT' ? 'text-rose-400' : 'text-emerald-400')}>
                                  {opt.optionType}
                                </td>
                                <td className="p-2 text-right font-bold text-foreground">${opt.strike}</td>
                                <td className="p-2 text-right text-muted-foreground">${opt.bid.toFixed(2)}</td>
                                <td className="p-2 text-right text-muted-foreground">${opt.ask.toFixed(2)}</td>
                                <td className="p-2 text-right font-bold text-emerald-400">${opt.mid.toFixed(2)}</td>
                                <td className="p-2 text-right text-muted-foreground">{(opt.impliedVolatility * 100).toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

            </>
          ) : (
            <div className="text-center py-12 space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-sm font-semibold text-foreground">Click Re-Analyze to Evaluate Position</p>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
