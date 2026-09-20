import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  BrainCircuit,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  RefreshCw,
  Target,
  Scale,
  Gauge,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import {
  useAiRating,
  useTriggerAiRating,
  AiRatingConsensus,
  ModelRatingResult,
  AiRatingGrade,
  ConsensusGrade,
} from '@/services/aiRatingService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AiRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice?: number;
}

export function AiRatingModal({
  isOpen,
  onClose,
  symbol,
  currentPrice,
}: AiRatingModalProps) {
  const cleanSymbol = (symbol || '').trim().toUpperCase();

  // Fetch cached or existing rating
  const {
    data: ratingData,
    isLoading: isFetching,
    error: fetchError,
    refetch,
  } = useAiRating(cleanSymbol, isOpen);

  // Trigger mutation
  const triggerMutation = useTriggerAiRating();

  // Auto-run if opened and no data is cached yet
  useEffect(() => {
    if (isOpen && cleanSymbol && !ratingData && !isFetching && !triggerMutation.isPending && !fetchError) {
      triggerMutation.mutate(
        { symbol: cleanSymbol, forceRefresh: false },
        {
          onError: (err) => {
            toast.error(`AI Rating analysis failed: ${err.message}`);
          },
        }
      );
    }
  }, [isOpen, cleanSymbol, ratingData, isFetching, triggerMutation, fetchError]);

  const handleRefresh = () => {
    if (!cleanSymbol) return;
    triggerMutation.mutate(
      { symbol: cleanSymbol, forceRefresh: true },
      {
        onSuccess: () => {
          toast.success(`AI Rating consensus updated for ${cleanSymbol}`);
        },
        onError: (err) => {
          toast.error(`Analysis failed: ${err.message}`);
        },
      }
    );
  };

  const activeData: AiRatingConsensus | undefined = triggerMutation.data || ratingData;
  const isLoading = isFetching || triggerMutation.isPending;

  // Grade color helper
  const getRatingBadge = (rating: AiRatingGrade | ConsensusGrade) => {
    switch (rating) {
      case 'STRONG_BUY':
        return {
          label: 'STRONG BUY',
          color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]',
          icon: TrendingUp,
        };
      case 'BUY':
        return {
          label: 'BUY',
          color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          icon: TrendingUp,
        };
      case 'HOLD':
        return {
          label: 'HOLD',
          color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          icon: Minus,
        };
      case 'SELL':
        return {
          label: 'SELL',
          color: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          icon: TrendingDown,
        };
      case 'STRONG_SELL':
        return {
          label: 'STRONG SELL',
          color: 'bg-rose-500/25 text-rose-400 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.3)]',
          icon: TrendingDown,
        };
      default:
        return {
          label: 'HOLD',
          color: 'bg-muted text-muted-foreground border-border',
          icon: Minus,
        };
    }
  };

  // Conviction color helper (1 to 10 scale)
  const getConvictionColor = (conviction: number) => {
    if (conviction >= 8.0) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (conviction >= 6.5) return 'text-teal-400 border-teal-500/30 bg-teal-500/10';
    if (conviction >= 5.0) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    if (conviction >= 3.5) return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[95vw] sm:max-w-5xl max-h-[92vh] overflow-y-auto bg-card/95 backdrop-blur-2xl shadow-2xl p-0 gap-0 border border-border/80 rounded-2xl scrollbar-thin"
      >
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400" />

        {/* Header Ribbon */}
        <div className="p-6 pb-4 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4 pr-12">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 via-indigo-500/20 to-cyan-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-sm shrink-0">
              <BrainCircuit className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <DialogTitle className="text-2xl font-black font-mono tracking-tight text-foreground">
                  {cleanSymbol}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="bg-violet-500/10 text-violet-300 border-violet-500/30 text-[10px] font-mono font-bold uppercase tracking-wider"
                >
                  Multi-LLM Consensus
                </Badge>
                {activeData?.sector && (
                  <Badge variant="secondary" className="text-[10px] font-mono text-muted-foreground">
                    {activeData.sector}
                  </Badge>
                )}
                {activeData?.currentPrice ? (
                  <span className="text-xs font-mono font-bold text-foreground">
                    ${activeData.currentPrice.toFixed(2)}
                  </span>
                ) : currentPrice ? (
                  <span className="text-xs font-mono font-bold text-foreground">
                    ${currentPrice.toFixed(2)}
                  </span>
                ) : null}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Consensus synthesis across 5 premier frontier models (Claude 3.5, GPT-4o, DeepSeek R1, Llama 3.3, Gemini 2.0).
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 text-xs font-bold gap-1.5 border-border/70 hover:bg-accent/40 text-muted-foreground hover:text-foreground shadow-sm"
              title="Re-query models with latest market data"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin text-primary")} />
              <span>{isLoading ? 'Evaluating...' : 'Refresh Rating'}</span>
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Loading Skeleton */}
          {isLoading && !activeData && (
            <div className="py-14 flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin flex items-center justify-center" />
                <BrainCircuit className="w-7 h-7 text-violet-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold text-foreground text-sm">
                  Polling 5 Frontier LLMs for {cleanSymbol}...
                </p>
                <p className="text-xs text-muted-foreground max-w-md">
                  Synthesizing real-time financials, valuation multiples, analyst targets, and computing blended conviction consensus.
                </p>
              </div>

              {/* Step checklist visual */}
              <div className="w-full max-w-sm bg-background/50 border border-border/50 rounded-xl p-3 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>OpenAI GPT-4o</span>
                  <span className="text-emerald-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Querying</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Anthropic Claude 3.5</span>
                  <span className="text-emerald-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Querying</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>DeepSeek R1 / V3</span>
                  <span className="text-emerald-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Querying</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Meta Llama 3.3 70B</span>
                  <span className="text-emerald-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Querying</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Google Gemini 2.0 Flash</span>
                  <span className="text-emerald-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Querying</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {!isLoading && !activeData && (fetchError || triggerMutation.error) && (
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Unable to synthesize AI rating
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {fetchError?.message || triggerMutation.error?.message || 'Failed to connect to AI rating consensus engine.'}
              </p>
              <Button onClick={handleRefresh} size="sm" className="mt-2">
                Retry Analysis
              </Button>
            </div>
          )}

          {/* Result View */}
          {activeData && (
            <>
              {/* TOP BLENDED HERO SECTION */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Consensus Grade Card */}
                {(() => {
                  const badge = getRatingBadge(activeData.consensusRating);
                  const Icon = badge.icon;
                  return (
                    <Card className="bg-background/60 border-border/70 backdrop-blur-sm relative overflow-hidden flex flex-col justify-between">
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                            Blended Consensus
                          </span>
                          <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
                        </div>
                        <div className="flex items-baseline gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-sm font-black font-mono px-2.5 py-1 tracking-wider border flex items-center gap-1.5",
                              badge.color
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            {badge.label}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {activeData.buyPercentage}% Buy • {activeData.holdPercentage}% Hold • {activeData.sellPercentage}% Sell
                        </p>
                      </div>

                      {/* Vote Split Ratio Bar */}
                      <div className="h-1.5 w-full flex bg-muted/40 overflow-hidden">
                        {activeData.buyPercentage > 0 && (
                          <div
                            style={{ width: `${activeData.buyPercentage}%` }}
                            className="bg-emerald-500 h-full transition-all"
                            title={`Buy: ${activeData.buyPercentage}%`}
                          />
                        )}
                        {activeData.holdPercentage > 0 && (
                          <div
                            style={{ width: `${activeData.holdPercentage}%` }}
                            className="bg-amber-400 h-full transition-all"
                            title={`Hold: ${activeData.holdPercentage}%`}
                          />
                        )}
                        {activeData.sellPercentage > 0 && (
                          <div
                            style={{ width: `${activeData.sellPercentage}%` }}
                            className="bg-rose-500 h-full transition-all"
                            title={`Sell: ${activeData.sellPercentage}%`}
                          />
                        )}
                      </div>
                    </Card>
                  );
                })()}

                {/* Conviction Rating (1 to 10) */}
                <Card className="bg-background/60 border-border/70 backdrop-blur-sm p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                      Conviction Rating
                    </span>
                    <Gauge className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black font-mono tracking-tight text-foreground">
                      {activeData.blendedConviction.toFixed(1)}
                    </span>
                    <span className="text-xs font-mono font-bold text-muted-foreground">/ 10.0</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "ml-auto text-[9px] font-mono font-bold uppercase px-1.5 py-0.5",
                        getConvictionColor(activeData.blendedConviction)
                      )}
                    >
                      {activeData.convictionStrength}
                    </Badge>
                  </div>
                  {/* Gauge Progress Bar */}
                  <div className="w-full bg-muted/50 h-2 rounded-full overflow-hidden relative">
                    <div
                      style={{ width: `${(activeData.blendedConviction / 10) * 100}%` }}
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        activeData.blendedConviction >= 7.5
                          ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                          : activeData.blendedConviction >= 5.0
                          ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                          : "bg-gradient-to-r from-rose-500 to-orange-400"
                      )}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Scale from 1 (Extreme Uncertainty) to 10 (High Conviction)
                  </p>
                </Card>

                {/* Blended Target Price */}
                <Card className="bg-background/60 border-border/70 backdrop-blur-sm p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                      Blended Target
                    </span>
                    <Target className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono tracking-tight text-foreground">
                      {activeData.blendedTargetPrice ? `$${activeData.blendedTargetPrice.toFixed(2)}` : 'N/A'}
                    </span>
                    {activeData.impliedUpsidePercent !== null && activeData.impliedUpsidePercent !== undefined && (
                      <span
                        className={cn(
                          "text-xs font-mono font-bold",
                          activeData.impliedUpsidePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {activeData.impliedUpsidePercent >= 0 ? '+' : ''}
                        {activeData.impliedUpsidePercent.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Aggregated consensus 1-year price target from model estimates
                  </p>
                </Card>

                {/* Model Participation Stats */}
                <Card className="bg-background/60 border-border/70 backdrop-blur-sm p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                      Panel Quorum
                    </span>
                    <Scale className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono tracking-tight text-foreground">
                      {activeData.modelResults.filter((m) => m.success).length} / {activeData.modelResults.length}
                    </span>
                    <span className="text-xs font-mono font-bold text-muted-foreground">Models Reporting</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Synthesized at {new Date(activeData.analyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </Card>
              </div>

              {/* EXECUTIVE CONSENSUS SUMMARY */}
              <div className="bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-cyan-500/10 border border-violet-500/30 rounded-2xl p-5 space-y-3.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
                  <span className="font-bold text-sm text-foreground uppercase font-mono tracking-wide">
                    Consensus Executive Summary
                  </span>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed font-normal">
                  {activeData.consensusSummary}
                </p>

                {/* Bull vs Bear Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-2.5">
                    <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-emerald-300 block mb-0.5 font-mono uppercase text-[10px]">
                        Primary Bullish Thesis
                      </span>
                      <span className="text-foreground/90 leading-relaxed">
                        {activeData.topBullDriver}
                      </span>
                    </div>
                  </div>
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-rose-300 block mb-0.5 font-mono uppercase text-[10px]">
                        Primary Bearish Risk
                      </span>
                      <span className="text-foreground/90 leading-relaxed">
                        {activeData.topBearRisk}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* INDIVIDUAL MODEL RATINGS (THE 5 LLMS) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-foreground uppercase font-mono tracking-wider">
                      Individual Model Evaluations ({activeData.modelResults.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Independent blind ratings
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {activeData.modelResults.map((model) => {
                    const badge = getRatingBadge(model.rating);
                    const Icon = badge.icon;
                    return (
                      <div
                        key={model.modelId}
                        className={cn(
                          "bg-background/60 border rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all",
                          model.success
                            ? "border-border/70 hover:border-border hover:shadow-md"
                            : "border-rose-500/30 bg-rose-500/5 opacity-80"
                        )}
                      >
                        {/* Model Card Header */}
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                {model.modelName}
                              </h4>
                              <span className="text-[10px] text-muted-foreground uppercase font-mono">
                                {model.provider} • {model.latencyMs > 0 ? `${(model.latencyMs / 1000).toFixed(1)}s` : 'Cached'}
                              </span>
                            </div>

                            {/* Model Rating Badge */}
                            {model.success ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs font-black font-mono px-2 py-0.5 tracking-wider border flex items-center gap-1",
                                  badge.color
                                )}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {badge.label}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-rose-500/15 text-rose-400 border-rose-500/30">
                                OFFLINE
                              </Badge>
                            )}
                          </div>

                          {/* Conviction & Target Price Bar */}
                          {model.success && (
                            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/40 text-xs font-mono">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Conviction:</span>
                                <Badge
                                  variant="outline"
                                  className={cn("text-[10px] font-bold px-1.5 py-0 font-mono", getConvictionColor(model.conviction))}
                                >
                                  {model.conviction} / 10
                                </Badge>
                              </div>

                              {model.targetPrice ? (
                                <div className="text-right">
                                  <span className="text-foreground font-bold">${model.targetPrice.toFixed(2)}</span>
                                  {model.upsidePercent !== null && model.upsidePercent !== undefined && (
                                    <span
                                      className={cn(
                                        "ml-1 text-[10px] font-bold",
                                        model.upsidePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                                      )}
                                    >
                                      ({model.upsidePercent >= 0 ? '+' : ''}{model.upsidePercent.toFixed(1)}%)
                                    </span>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>

                        {/* Model Analysis Text */}
                        <div className="space-y-2 text-xs">
                          <p className="text-foreground/90 line-clamp-3 leading-relaxed">
                            {model.summary}
                          </p>

                          {model.success && (
                            <div className="pt-2 border-t border-border/40 space-y-1.5 text-[11px]">
                              <div className="text-emerald-400 flex items-start gap-1">
                                <TrendingUp className="w-3 h-3 shrink-0 mt-0.5" />
                                <span className="line-clamp-2 text-muted-foreground">
                                  <strong className="text-emerald-300">Bull:</strong> {model.bullThesis}
                                </span>
                              </div>
                              <div className="text-rose-400 flex items-start gap-1">
                                <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" />
                                <span className="line-clamp-2 text-muted-foreground">
                                  <strong className="text-rose-300">Risk:</strong> {model.bearRisk}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
