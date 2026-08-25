import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Layers,
  Zap,
  Target,
  ShieldAlert,
  ShieldCheck,
  DollarSign,
  Calendar,
  CheckCircle2,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw,
  Info,
  SlidersHorizontal,
  Flame,
  Check,
  ExternalLink,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  StructuredTradeApproach,
  TradeStructureResult,
  useStructureTrade,
  useCreateTradeIdea,
  TradeIdea
} from '@/services/ideaService';
import { createAlert } from '@/services/alertService';
import { toast } from 'sonner';

interface StructuredTradesCardProps {
  symbol: string;
  currentPrice?: number;
  companyName?: string;
  onNavigateToIdeas?: () => void;
}

export function StructuredTradesCard({
  symbol,
  currentPrice,
  companyName,
  onNavigateToIdeas,
}: StructuredTradesCardProps) {
  const structureTradeMutation = useStructureTrade();
  const createIdeaMutation = useCreateTradeIdea();

  const [sentiment, setSentiment] = useState<'BULLISH' | 'BEARISH' | 'NEUTRAL'>('BULLISH');
  const [timeframe, setTimeframe] = useState<string>('SWING');
  const [structureResult, setStructureResult] = useState<TradeStructureResult | null>(null);
  const [savedApproachMap, setSavedApproachMap] = useState<Record<string, boolean>>({});
  const [isAlertsLoading, setIsAlertsLoading] = useState<Record<string, boolean>>({});

  // Fetch / Generate Trade Structures
  const handleGenerateStructures = () => {
    if (!symbol) return;
    setSavedApproachMap({});

    structureTradeMutation.mutate(
      {
        symbol: symbol.toUpperCase(),
        title: `${symbol.toUpperCase()} ${sentiment} Quantitative Trade Structure`,
        type: sentiment,
        timeframe,
        entryPrice: currentPrice,
      },
      {
        onSuccess: (data) => {
          setStructureResult(data);
          toast.success(`Generated ${data.approaches?.length || 0} structured trade approaches for ${symbol}!`);
        },
        onError: (err) => {
          toast.error(`Trade structuring error: ${err.message}`);
        },
      }
    );
  };

  // Auto-generate when symbol changes
  useEffect(() => {
    if (symbol) {
      handleGenerateStructures();
    }
  }, [symbol]);

  // 1-Click: Save specific Approach into the Ideas section
  const handleSaveApproachAsIdea = async (approach: StructuredTradeApproach) => {
    try {
      const ideaTitle = `${symbol.toUpperCase()} ${approach.approachName} (${approach.strategyType})`;
      
      const structuredContent = `### 🎯 Strategy Thesis: ${approach.approachName}
${approach.thesis}

---

### 📋 Structural Execution Parameters
- **Strategy Category**: ${approach.strategyType}
- **Target Sentiment / Bias**: ${approach.sentiment}
- **Recommended Time Horizon**: ${approach.timeframe}
- **Capital Requirement**: $${approach.capitalRequired?.toLocaleString() || 'N/A'}
- **Maximum Profit Potential**: $${approach.maxProfit?.toLocaleString() || 'N/A'} (${approach.maxProfitPercent ? `+${approach.maxProfitPercent}%` : 'Uncapped'})
- **Defined Maximum Risk**: $${approach.maxRisk?.toLocaleString() || 'N/A'}
- **Estimated Probability of Profit (POP)**: ${approach.winRatePercent || 65}%
- **Capital Efficiency Score**: ${approach.capitalEfficiencyRating || 'A-'}
- **Breakeven Level(s)**: ${approach.breakEvenLevels?.map(b => `$${b}`).join(', ') || 'N/A'}

---

### ⚡ Multi-Leg Contract Specifications
${approach.legs?.map((leg, i) => `${i + 1}. **${leg.action} ${leg.quantity}x ${leg.assetType}** ${leg.strike ? `@ $${leg.strike}` : ''} ${leg.expiry ? `(Exp: ${leg.expiry})` : ''} - Net Premium/Cost: $${leg.estimatedCostOrCredit}`).join('\n')}

---

### 🛡️ Risk Management & Exit Protocol
- 🛑 **Invalidation Trigger**: ${approach.invalidationTrigger || 'Close below critical support'}
- 🎯 **Profit Taking Plan**: ${approach.profitTakingPlan || 'Take 50% profit at 50% max gain or roll up'}
- 💡 **Execution Notes**: ${approach.executionInstructions || 'Enter with limit order'}
`;

      await createIdeaMutation.mutateAsync({
        symbol: symbol.toUpperCase(),
        title: ideaTitle,
        type: sentiment,
        timeframe: timeframe,
        entryPrice: currentPrice || null,
        targetPrice: approach.maxProfit && currentPrice ? (sentiment === 'BULLISH' ? currentPrice * 1.15 : currentPrice * 0.85) : null,
        stopLoss: currentPrice ? (sentiment === 'BULLISH' ? currentPrice * 0.92 : currentPrice * 1.08) : null,
        content: structuredContent,
        tags: `${symbol}, ${approach.strategyType}, StructuredTrade, ${sentiment}`,
        status: 'ACTIVE',
        confidenceScore: approach.winRatePercent || 75,
      });

      setSavedApproachMap((prev) => ({ ...prev, [approach.id]: true }));

      toast.success(`Successfully saved "${approach.approachName}" into Ideas section!`, {
        description: 'You can track, manage, and execute this idea from the Ideas Page.',
        action: onNavigateToIdeas ? {
          label: 'View Ideas',
          onClick: () => onNavigateToIdeas(),
        } : undefined,
      });
    } catch (err: any) {
      toast.error(`Failed to save idea: ${err.message}`);
    }
  };

  // 1-Click: Create Price Alerts for Entry Levels
  const handleCreateAlerts = async (approach: StructuredTradeApproach) => {
    setIsAlertsLoading((prev) => ({ ...prev, [approach.id]: true }));
    let createdCount = 0;

    try {
      if (currentPrice) {
        // Target alert
        const targetPrice = sentiment === 'BULLISH' ? currentPrice * 1.12 : currentPrice * 0.88;
        await createAlert({
          symbol: symbol.toUpperCase(),
          targetPrice: Math.round(targetPrice * 100) / 100,
          condition: sentiment === 'BULLISH' ? 'ABOVE' : 'BELOW',
          note: `🎯 Profit Target Alert for ${approach.approachName}`,
        });
        createdCount++;

        // Invalidation stop alert
        const stopPrice = sentiment === 'BULLISH' ? currentPrice * 0.93 : currentPrice * 1.07;
        await createAlert({
          symbol: symbol.toUpperCase(),
          targetPrice: Math.round(stopPrice * 100) / 100,
          condition: sentiment === 'BULLISH' ? 'BELOW' : 'ABOVE',
          note: `🛑 Invalidation Stop Alert for ${approach.approachName}`,
        });
        createdCount++;
      }

      toast.success(`Created ${createdCount} monitoring alerts for ${symbol}!`);
    } catch (err: any) {
      toast.error(`Failed to create alerts: ${err.message}`);
    } finally {
      setIsAlertsLoading((prev) => ({ ...prev, [approach.id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Strategy Generation Controls */}
      <Card className="bg-card/70 backdrop-blur-xl border-border/70 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500/20 via-primary/20 to-indigo-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-sm">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">
                  Institutional Trade Structurer & Ideas Generator
                </h3>
                <Badge variant="outline" className="text-[10px] font-mono uppercase bg-purple-500/10 text-purple-300 border-purple-500/30 font-bold">
                  {symbol}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically builds multi-leg equity and options execution structures tailored to live valuation, volatility, and support levels.
              </p>
            </div>
          </div>

          {/* Controls Segment */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sentiment Selector */}
            <div className="flex items-center gap-1 bg-background/60 p-1 rounded-xl border border-border/60">
              {(['BULLISH', 'NEUTRAL', 'BEARISH'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSentiment(s)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-lg transition-all",
                    sentiment === s
                      ? s === 'BULLISH' ? "bg-emerald-500 text-white shadow-sm"
                        : s === 'BEARISH' ? "bg-rose-500 text-white shadow-sm"
                        : "bg-amber-500 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Timeframe Selector */}
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-background/80 border border-border/70 rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:border-primary/50"
            >
              <option value="SHORT_TERM">Short-Term (1–2 Wks)</option>
              <option value="SWING">Swing (2–6 Wks)</option>
              <option value="LONG_TERM">Long-Term (3–12 Mos)</option>
            </select>

            {/* Generate Button */}
            <Button
              size="sm"
              onClick={handleGenerateStructures}
              disabled={structureTradeMutation.isPending}
              className="h-8 text-xs font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white shadow-md gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", structureTradeMutation.isPending && "animate-spin")} />
              <span>{structureTradeMutation.isPending ? 'Structuring...' : 'Re-Structure'}</span>
            </Button>
          </div>
        </div>

        {/* Macro & Catalyst Summary Banner */}
        {structureResult?.macroContextSummary && (
          <div className="mt-4 p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{structureResult.macroContextSummary}</p>
          </div>
        )}
      </Card>

      {/* Loading State */}
      {structureTradeMutation.isPending && !structureResult && (
        <Card className="h-64 flex items-center justify-center bg-card/50 backdrop-blur-xl border-border/70 rounded-2xl">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            <p className="text-sm font-semibold text-muted-foreground animate-pulse">
              Synthesizing Multi-Leg Trade Structures for {symbol}...
            </p>
          </div>
        </Card>
      )}

      {/* Strategy Approaches Grid */}
      {structureResult?.approaches && structureResult.approaches.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {structureResult.approaches.map((approach, index) => {
            const isSaved = savedApproachMap[approach.id];

            return (
              <Card
                key={approach.id || index}
                className={cn(
                  "bg-card/70 backdrop-blur-xl border-2 transition-all duration-300 rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm relative group hover:border-purple-500/50",
                  isSaved ? "border-emerald-500/50 bg-emerald-950/10" : "border-border/70"
                )}
              >
                <div>
                  {/* Top Header Strip */}
                  <div className="p-4 pb-3 border-b border-border/40 bg-accent/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center text-xs font-mono font-bold">
                        {index + 1}
                      </span>
                      <div>
                        <Badge variant="outline" className="text-[10px] font-bold font-mono uppercase bg-background/60">
                          {approach.strategyType}
                        </Badge>
                      </div>
                    </div>

                    <Badge className={cn(
                      "text-[10px] font-mono font-bold",
                      approach.sentiment === 'BULLISH' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                      approach.sentiment === 'BEARISH' ? "bg-rose-500/20 text-rose-400 border-rose-500/30" :
                      "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    )}>
                      {approach.sentiment}
                    </Badge>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-4">
                    <div>
                      <h4 className="text-base font-black text-foreground group-hover:text-purple-300 transition-colors">
                        {approach.approachName}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {approach.thesis}
                      </p>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-background/60 p-2.5 rounded-xl border border-border/40">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block font-sans">Capital Required</span>
                        <span className="text-sm font-bold text-foreground">${approach.capitalRequired?.toLocaleString() || '—'}</span>
                      </div>

                      <div className="bg-background/60 p-2.5 rounded-xl border border-border/40">
                        <span className="text-[10px] uppercase font-bold text-emerald-400 block font-sans">Max Profit</span>
                        <span className="text-sm font-bold text-emerald-400">
                          ${approach.maxProfit?.toLocaleString() || 'Uncapped'}
                          {approach.maxProfitPercent && ` (+${approach.maxProfitPercent}%)`}
                        </span>
                      </div>

                      <div className="bg-background/60 p-2.5 rounded-xl border border-border/40">
                        <span className="text-[10px] uppercase font-bold text-rose-400 block font-sans">Max Risk</span>
                        <span className="text-sm font-bold text-rose-400">${approach.maxRisk?.toLocaleString() || 'Defined'}</span>
                      </div>

                      <div className="bg-background/60 p-2.5 rounded-xl border border-border/40">
                        <span className="text-[10px] uppercase font-bold text-purple-400 block font-sans">Win Rate (POP)</span>
                        <span className="text-sm font-bold text-purple-300">{approach.winRatePercent || 68}%</span>
                      </div>
                    </div>

                    {/* Multi-Leg Contract Specifications */}
                    {approach.legs && approach.legs.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Contract Legs & Execution:
                        </span>
                        <div className="space-y-1">
                          {approach.legs.map((leg, lIdx) => (
                            <div
                              key={lIdx}
                              className="p-2 rounded-lg bg-background/50 border border-border/40 text-xs font-mono flex items-center justify-between"
                            >
                              <span className={cn("font-bold", leg.action.includes('BUY') ? "text-emerald-400" : "text-purple-400")}>
                                {leg.action} {leg.quantity}x {leg.assetType}
                              </span>
                              <span className="text-muted-foreground text-[11px]">
                                {leg.strike ? `@ $${leg.strike}` : ''} {leg.expiry ? `(${leg.expiry})` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Exit Rules */}
                    <div className="p-3 rounded-xl bg-accent/20 border border-border/40 text-xs space-y-1.5">
                      <div className="text-[11px]">
                        <span className="font-bold text-rose-400">🛑 Invalidation: </span>
                        <span className="text-muted-foreground">{approach.invalidationTrigger}</span>
                      </div>
                      <div className="text-[11px]">
                        <span className="font-bold text-emerald-400">🎯 Profit Target: </span>
                        <span className="text-muted-foreground">{approach.profitTakingPlan}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="p-4 border-t border-border/40 bg-accent/10 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreateAlerts(approach)}
                    disabled={isAlertsLoading[approach.id]}
                    className="h-8 text-xs gap-1 border-border/60 hover:bg-accent/40"
                    title="Set price alerts for target and stop"
                  >
                    <Bell className={cn("w-3.5 h-3.5 text-amber-400", isAlertsLoading[approach.id] && "animate-spin")} />
                    <span className="hidden sm:inline">Set Alerts</span>
                  </Button>

                  {/* 1-Click Save as Idea */}
                  <Button
                    size="sm"
                    onClick={() => handleSaveApproachAsIdea(approach)}
                    disabled={createIdeaMutation.isPending || isSaved}
                    className={cn(
                      "h-8 text-xs font-bold gap-1.5 shadow-sm transition-all",
                      isSaved
                        ? "bg-emerald-500 text-white hover:bg-emerald-600"
                        : "bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white"
                    )}
                  >
                    {isSaved ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Saved to Ideas!</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Save to Ideas</span>
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : !structureTradeMutation.isPending && (
        <Card className="p-8 text-center bg-card/40 border-border/60 rounded-2xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-foreground">No Structured Trades Generated Yet</h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Click "Re-Structure" above to generate institutional options and equity playbooks tailored for {symbol}.
          </p>
          <Button
            size="sm"
            onClick={handleGenerateStructures}
            className="text-xs font-bold bg-primary text-primary-foreground gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Generate Trade Structures Now</span>
          </Button>
        </Card>
      )}
    </div>
  );
}
