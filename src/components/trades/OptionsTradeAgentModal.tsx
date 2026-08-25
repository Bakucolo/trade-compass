import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles,
  SlidersHorizontal,
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Shield,
  Zap,
  Activity,
  Layers,
  DollarSign,
  Percent,
  Clock,
  ArrowRight,
  ExternalLink,
  Bell,
  BookmarkPlus,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Play,
  Lightbulb,
  FileSpreadsheet
} from 'lucide-react';
import {
  useOptionsTradeScanner,
  useScanOptionsAgent,
  OptionsAgentFilterParams,
  OptionsStrategyCategory,
  OptionsTradeOpportunity,
  LiquidityTier
} from '@/services/optionsTradeAgentService';
import { useCreateAlert } from '@/services/alertService';
import { useCreateTradeIdea } from '@/services/ideaService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface OptionsTradeAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTradeToLog?: (opportunity: OptionsTradeOpportunity) => void;
  onNavigateToResearch?: (symbol: string) => void;
}

const STRATEGY_TABS: Array<{ id: OptionsStrategyCategory; label: string; icon: string }> = [
  { id: 'ALL', label: 'All Strategies', icon: '✨' },
  { id: 'CASH_SECURED_PUT', label: 'Cash-Secured Puts', icon: '🛡️' },
  { id: 'BULL_PUT_SPREAD', label: 'Bull Put Spreads', icon: '🐂' },
  { id: 'IRON_CONDOR', label: 'Iron Condors', icon: '🦅' },
  { id: 'POOR_MANS_COVERED_CALL', label: 'PMCC Diagonals', icon: '🚀' },
  { id: 'BULL_CALL_SPREAD', label: 'Bull Call Spreads', icon: '🎯' },
];

export function OptionsTradeAgentModal({
  isOpen,
  onClose,
  onSelectTradeToLog,
  onNavigateToResearch,
}: OptionsTradeAgentModalProps) {
  // Filter States
  const [selectedStrategy, setSelectedStrategy] = useState<OptionsStrategyCategory>('ALL');
  const [minIVP, setMinIVP] = useState<number>(0);
  const [minIVR, setMinIVR] = useState<number>(0);
  const [minLiquidity, setMinLiquidity] = useState<'ALL' | 'HIGH' | 'INSTITUTIONAL'>('ALL');
  const [minPOP, setMinPOP] = useState<number>(0);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Filter Payload
  const activeFilters: OptionsAgentFilterParams = useMemo(() => ({
    strategyCategory: selectedStrategy !== 'ALL' ? selectedStrategy : undefined,
    minIVP: minIVP > 0 ? minIVP : undefined,
    minIVR: minIVR > 0 ? minIVR : undefined,
    minLiquidity: minLiquidity !== 'ALL' ? minLiquidity : undefined,
    minPOP: minPOP > 0 ? minPOP : undefined,
    minUnderlyingPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxUnderlyingPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    searchQuery: searchQuery.trim() || undefined,
    customPrompt: customPrompt.trim() || undefined,
  }), [selectedStrategy, minIVP, minIVR, minLiquidity, minPOP, minPrice, maxPrice, searchQuery, customPrompt]);

  // Query & Mutation
  const { data: scanResult, isLoading, refetch, isFetching } = useOptionsTradeScanner(activeFilters, isOpen);
  const scanMutation = useScanOptionsAgent();
  const createAlertMutation = useCreateAlert();
  const createIdeaMutation = useCreateTradeIdea();

  const handleScan = () => {
    scanMutation.mutate(activeFilters, {
      onSuccess: (data) => {
        toast.success(`Scanned ${data.totalUniverseScanned} assets: Found ${data.matchedCount} opportunities!`);
      },
      onError: (err: any) => {
        toast.error(`Scan failed: ${err.message}`);
      }
    });
  };

  const handleResetFilters = () => {
    setSelectedStrategy('ALL');
    setMinIVP(0);
    setMinIVR(0);
    setMinLiquidity('ALL');
    setMinPOP(0);
    setMinPrice('');
    setMaxPrice('');
    setSearchQuery('');
    setCustomPrompt('');
  };

  // Quick 1-Click Set Alert at Breakeven / Strike
  const handleSetPriceAlert = async (opp: OptionsTradeOpportunity, targetPrice: number, label: string) => {
    try {
      await createAlertMutation.mutateAsync({
        symbol: opp.symbol,
        targetPrice,
        condition: opp.sentiment.includes('BEAR') ? 'ABOVE' : 'BELOW',
        notes: `Options Agent Alert: ${opp.strategyName} (${label} at $${targetPrice.toFixed(2)})`
      });
      toast.success(`Alert set for ${opp.symbol} at $${targetPrice.toFixed(2)} (${label})!`);
    } catch (err: any) {
      toast.error(`Failed to set alert: ${err.message}`);
    }
  };

  // Quick 1-Click Save as Trade Idea
  const handleSaveToIdeas = async (opp: OptionsTradeOpportunity) => {
    try {
      const content = `### 🎯 Strategy Blueprint: ${opp.strategyName}
- **Underlying Spot**: $${opp.currentPrice.toFixed(2)} (${opp.dayChangePercent >= 0 ? '+' : ''}${opp.dayChangePercent.toFixed(2)}%)
- **Target Expiration**: ${opp.targetExpiration} (${opp.targetDte} DTE)
- **Volatility Context**: IV ${opp.impliedVolatility}% | IV Rank: ${opp.ivRank}% | IV Percentile: ${opp.ivPercentile}%
- **Options Liquidity**: ${opp.liquidityTier} (${opp.liquidityScore}/5 Stars, ~${opp.avgDailyOptionVolume.toLocaleString()} daily volume)

### 📐 Multi-Leg Execution Specs
${opp.legs.map((leg, idx) => `* **Leg ${idx + 1}**: \`${leg.action}\` 1x **$${leg.strike} ${leg.optionType}** @ ~$${leg.mid.toFixed(2)} (Delta: ${leg.delta.toFixed(2)})`).join('\n')}

### 💵 Capital & Risk Parameters
- **Net ${opp.netEffect}**: $${opp.netPremiumTotal.toFixed(2)} ($${opp.netPremiumPerShare.toFixed(2)}/share)
- **Capital at Risk**: $${opp.capitalRequired.toFixed(2)}
- **Max Return on Capital (ROC)**: +${opp.maxProfitPercent.toFixed(2)}% (+${opp.annualizedRocPercent.toFixed(1)}% Annualized)
- **Probability of Profit (POP)**: ${opp.probabilityOfProfitPercent.toFixed(1)}%
- **Break-Even Level**: $${opp.breakEvenPrice.toFixed(2)} (${opp.breakEvenBufferPercent.toFixed(1)}% buffer)
- **Greeks**: Delta ${opp.netDelta.toFixed(2)} | Theta +$${opp.netTheta.toFixed(2)}/day | Vega ${opp.netVega.toFixed(1)}

### 🛡️ Trade Management & Rules
- **Profit Target**: ${opp.tradeManagementRules.profitTarget}
- **Stop Loss**: ${opp.tradeManagementRules.stopLossRule}
- **Time Stop**: ${opp.tradeManagementRules.timeStopRule}
${opp.tradeManagementRules.defenseAdjustment ? `- **Defense Plan**: ${opp.tradeManagementRules.defenseAdjustment}` : ''}

### 🧠 Volatility & Technical Thesis
${opp.volatilityThesis}
${opp.technicalSetup}`;

      await createIdeaMutation.mutateAsync({
        symbol: opp.symbol,
        title: `${opp.strategyName} (${opp.probabilityOfProfitPercent.toFixed(0)}% POP, +${opp.annualizedRocPercent.toFixed(0)}% Ann.)`,
        sentiment: opp.sentiment === 'BULLISH' || opp.sentiment === 'NEUTRAL_BULLISH' ? 'BULLISH' : opp.sentiment === 'BEARISH' ? 'BEARISH' : 'NEUTRAL',
        timeframe: 'SWING',
        entryPrice: opp.currentPrice,
        targetPrice: opp.legs[0].strike,
        stopLoss: opp.breakEvenPrice,
        confidenceScore: opp.aiScore,
        tags: `Options, ${opp.strategyCategory}, IVR-${opp.ivRank}, POP-${opp.probabilityOfProfitPercent.toFixed(0)}`,
        content
      });

      toast.success(`Strategy saved to Trade Ideas for ${opp.symbol}!`);
    } catch (err: any) {
      toast.error(`Failed to save idea: ${err.message}`);
    }
  };

  const opportunities = scanResult?.opportunities || [];
  const metrics = scanResult?.summaryMetrics || {
    avgAnnualizedRoc: 0,
    avgPopPercent: 0,
    highIvOpportunitiesCount: 0,
    institutionalLiquidityCount: 0
  };
  const env = scanResult?.marketEnvironment;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[96vw] max-h-[92vh] overflow-y-auto p-0 border border-border/80 bg-slate-950 text-foreground shadow-2xl rounded-2xl scrollbar-thin">
        
        {/* ================= MODAL HEADER ================= */}
        <div className="p-6 border-b border-border/60 bg-gradient-to-r from-purple-950/40 via-slate-950 to-indigo-950/40 sticky top-0 z-20 backdrop-blur-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/40 flex items-center justify-center font-bold text-purple-400 shadow-md">
                  <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black tracking-tight text-white glow-text-white flex items-center gap-2">
                    <span>Options Strategy & Trade Finding Agent</span>
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 font-mono text-xs">
                      AI Volatility & Liquidity Screener
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Scans options liquidity, IV Rank / IV Percentile, multi-leg structures, and quantitative probabilities of profit.
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleScan}
                disabled={isLoading || isFetching || scanMutation.isPending}
                className="h-9 px-4 text-xs font-bold gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/20"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", (isLoading || isFetching || scanMutation.isPending) && "animate-spin")} />
                <span>{isLoading || isFetching || scanMutation.isPending ? 'Scanning Markets...' : 'Scan Live Chains'}</span>
              </Button>
            </div>
          </div>

          {/* Market Volatility Regime Banner */}
          {env && (
            <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-mono">
              <div className="flex items-center gap-2.5">
                <Badge className="bg-purple-500/30 text-purple-200 border-purple-400/40 font-bold">
                  VIX: {env.vixLevel.toFixed(2)} ({env.vixChange >= 0 ? '+' : ''}{env.vixChange.toFixed(2)}%)
                </Badge>
                <span className="text-slate-300 font-sans">{env.regimeSummary}</span>
              </div>
              <div className="text-muted-foreground text-[11px] font-sans">
                💡 <span className="text-purple-300">{env.recommendedApproach}</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* ================= FILTER & STRATEGY SELECTION HUB ================= */}
          <div className="glass-card rounded-2xl p-5 border border-border/70 bg-card/60 space-y-4">
            
            {/* Strategy Tabs */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                Options Strategy Strategy Category
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {STRATEGY_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedStrategy(tab.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border",
                      selectedStrategy === tab.id
                        ? "bg-purple-600 text-white border-purple-500 shadow-md"
                        : "bg-slate-900/60 text-muted-foreground border-white/5 hover:bg-slate-800 hover:text-foreground"
                    )}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Matrix Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2 border-t border-border/40 text-xs">
              
              {/* Min IV Percentile (IVP) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground font-semibold">
                  <span>Min IVP:</span>
                  <span className="font-mono text-purple-400 font-bold">{minIVP}%</span>
                </div>
                <select
                  value={minIVP}
                  onChange={(e) => setMinIVP(Number(e.target.value))}
                  className="w-full h-8 text-xs font-semibold bg-slate-900/90 text-foreground border border-border/70 rounded-xl px-2 focus:outline-none"
                >
                  <option value={0}>Any IVP (0%+)</option>
                  <option value={30}>30%+ (Moderate)</option>
                  <option value={50}>50%+ (Premium Selling Zone)</option>
                  <option value={70}>70%+ (High IV Crush Zone)</option>
                  <option value={85}>85%+ (Extreme Spike)</option>
                </select>
              </div>

              {/* Min IV Rank (IVR) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground font-semibold">
                  <span>Min IV Rank:</span>
                  <span className="font-mono text-purple-400 font-bold">{minIVR}%</span>
                </div>
                <select
                  value={minIVR}
                  onChange={(e) => setMinIVR(Number(e.target.value))}
                  className="w-full h-8 text-xs font-semibold bg-slate-900/90 text-foreground border border-border/70 rounded-xl px-2 focus:outline-none"
                >
                  <option value={0}>Any IVR (0%+)</option>
                  <option value={25}>25%+ (Standard)</option>
                  <option value={45}>45%+ (Tastytrade Benchmark)</option>
                  <option value={65}>65%+ (Elevated Premium)</option>
                </select>
              </div>

              {/* Options Liquidity Filter */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-semibold block">Options Liquidity:</label>
                <select
                  value={minLiquidity}
                  onChange={(e) => setMinLiquidity(e.target.value as any)}
                  className="w-full h-8 text-xs font-semibold bg-slate-900/90 text-foreground border border-border/70 rounded-xl px-2 focus:outline-none"
                >
                  <option value="ALL">All Liquid Underlyings</option>
                  <option value="HIGH">★★★★ High & Above</option>
                  <option value="INSTITUTIONAL">★★★★★ Institutional Only (Penny Wide)</option>
                </select>
              </div>

              {/* Min Probability of Profit (POP) */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-semibold block">Min POP (%):</label>
                <select
                  value={minPOP}
                  onChange={(e) => setMinPOP(Number(e.target.value))}
                  className="w-full h-8 text-xs font-semibold bg-slate-900/90 text-foreground border border-border/70 rounded-xl px-2 focus:outline-none"
                >
                  <option value={0}>Any POP</option>
                  <option value={60}>60%+ Probability</option>
                  <option value={70}>70%+ (High Probability)</option>
                  <option value={80}>80%+ (Conservative Delta)</option>
                </select>
              </div>

              {/* Underlying Price Range */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-semibold block">Stock Price ($):</label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    placeholder="Min $"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="h-8 text-xs px-2 bg-slate-900/90"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    placeholder="Max $"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="h-8 text-xs px-2 bg-slate-900/90"
                  />
                </div>
              </div>

              {/* Ticker Search */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-semibold block">Filter Ticker:</label>
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="e.g. NVDA, SPY..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 text-xs pl-7 bg-slate-900/90 font-mono uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Custom AI Query Input */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Sparkles className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" />
                <Input
                  placeholder="Tell the Agent what to look for (e.g. 'High IV rank cash-secured puts with >80% POP on semiconductor stocks under $150')..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="h-9 pl-9 pr-3 text-xs bg-slate-900/90 border-purple-500/30 focus:border-purple-500/60"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground shrink-0"
              >
                Reset Filters
              </Button>
            </div>
          </div>

          {/* ================= SUMMARY KPIS RIBBON ================= */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="p-3.5 rounded-xl bg-card/40 border border-border/60">
              <span className="text-[10px] font-sans font-bold uppercase text-muted-foreground block">
                Qualified Setups
              </span>
              <strong className="text-xl font-black text-foreground mt-1 block">
                {opportunities.length}
              </strong>
              <span className="text-[10px] text-muted-foreground">across {scanResult?.totalUniverseScanned || 0} liquid assets</span>
            </div>

            <div className="p-3.5 rounded-xl bg-card/40 border border-emerald-500/30">
              <span className="text-[10px] font-sans font-bold uppercase text-emerald-400 block">
                Avg Annualized ROC
              </span>
              <strong className="text-xl font-black text-emerald-300 mt-1 block">
                +{metrics.avgAnnualizedRoc.toFixed(1)}%
              </strong>
              <span className="text-[10px] text-emerald-400/80">Monthly velocity yield</span>
            </div>

            <div className="p-3.5 rounded-xl bg-card/40 border border-cyan-500/30">
              <span className="text-[10px] font-sans font-bold uppercase text-cyan-400 block">
                Avg Probability of Profit
              </span>
              <strong className="text-xl font-black text-cyan-300 mt-1 block">
                {metrics.avgPopPercent.toFixed(1)}% POP
              </strong>
              <span className="text-[10px] text-cyan-400/80">Statistical win rate</span>
            </div>

            <div className="p-3.5 rounded-xl bg-card/40 border border-purple-500/30">
              <span className="text-[10px] font-sans font-bold uppercase text-purple-400 block">
                High IV Harvesting
              </span>
              <strong className="text-xl font-black text-purple-300 mt-1 block">
                {metrics.highIvOpportunitiesCount} Opportunities
              </strong>
              <span className="text-[10px] text-purple-400/80">IV Rank ≥ 50%</span>
            </div>
          </div>

          {/* ================= OPPORTUNITY CARDS LIST ================= */}
          <div className="space-y-4">
            {isLoading || isFetching ? (
              <div className="py-20 text-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-400" />
                <p className="text-sm font-semibold text-foreground">Analyzing real-time option chains and volatility skew...</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Calculating Black-Scholes Greeks, IV Percentile, 30-45 DTE credit yields, and statistical breakevens.
                </p>
              </div>
            ) : opportunities.length === 0 ? (
              <div className="py-16 text-center space-y-3 bg-card/20 rounded-2xl border border-dashed border-border/60">
                <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-sm font-bold text-foreground">No options setups matched the selected filters.</p>
                <p className="text-xs text-muted-foreground">Try lowering the Min IVP / IVR thresholds or resetting filters.</p>
                <Button size="sm" variant="outline" onClick={handleResetFilters} className="text-xs mt-2">
                  Reset Filter Parameters
                </Button>
              </div>
            ) : (
              opportunities.map((opp) => {
                const isExpanded = expandedCardId === opp.id;

                return (
                  <Card
                    key={opp.id}
                    className="border border-border/70 bg-card/60 backdrop-blur-xl shadow-md hover:border-purple-500/50 transition-all rounded-2xl overflow-hidden"
                  >
                    <CardContent className="p-5 space-y-4">
                      
                      {/* Top Row: Symbol, Strategy, Live Price & Volatility Badges */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-border/40">
                        
                        {/* Left: Ticker & Strategy Details */}
                        <div className="flex items-center gap-3.5 flex-wrap">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500/20 via-primary/20 to-indigo-500/20 border border-purple-500/40 flex items-center justify-center font-mono font-black text-sm text-purple-300 shadow-md">
                            {opp.symbol}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-lg font-black font-mono tracking-tight text-foreground">
                                {opp.symbol}
                              </h3>
                              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {opp.companyName}
                              </span>

                              {/* Sentiment Tag */}
                              <Badge className={cn(
                                "text-[10px] font-bold",
                                opp.sentiment.includes('BULL') ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" :
                                opp.sentiment.includes('BEAR') ? "bg-rose-500/20 text-rose-300 border-rose-500/40" :
                                "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                              )}>
                                {opp.sentiment}
                              </Badge>

                              {/* AI Conviction Score */}
                              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] font-mono font-bold">
                                ⭐ {opp.aiScore} AI Score
                              </Badge>
                            </div>

                            <p className="text-xs font-bold text-foreground mt-0.5 text-purple-200">
                              {opp.strategyName}
                            </p>
                          </div>
                        </div>

                        {/* Right: Volatility & Liquidity Heat Badges */}
                        <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                          {/* Live Price */}
                          <div className="text-right pr-2 border-r border-border/50">
                            <span className="font-bold text-sm text-foreground block">
                              ${opp.currentPrice.toFixed(2)}
                            </span>
                            <span className={cn("text-[10px] font-semibold", opp.dayChangePercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                              {opp.dayChangePercent >= 0 ? '+' : ''}{opp.dayChangePercent.toFixed(2)}%
                            </span>
                          </div>

                          {/* IV Rank Badge */}
                          <div className="px-2.5 py-1 rounded-xl bg-slate-900/90 border border-purple-500/30 text-center">
                            <span className="text-[9px] font-sans text-muted-foreground block">IV RANK</span>
                            <span className={cn(
                              "font-bold text-xs",
                              opp.ivRank >= 60 ? "text-emerald-400 font-black" : opp.ivRank >= 35 ? "text-amber-300" : "text-cyan-400"
                            )}>
                              {opp.ivRank}%
                            </span>
                          </div>

                          {/* IV Percentile Badge */}
                          <div className="px-2.5 py-1 rounded-xl bg-slate-900/90 border border-purple-500/30 text-center">
                            <span className="text-[9px] font-sans text-muted-foreground block">IV PERCENTILE</span>
                            <span className="font-bold text-xs text-purple-300">{opp.ivPercentile}%</span>
                          </div>

                          {/* Liquidity Stars */}
                          <div className="px-2.5 py-1 rounded-xl bg-slate-900/90 border border-border/60 text-center" title={`${opp.avgDailyOptionVolume.toLocaleString()} daily option volume`}>
                            <span className="text-[9px] font-sans text-muted-foreground block">LIQUIDITY</span>
                            <span className="font-bold text-xs text-amber-300">
                              {'★'.repeat(opp.liquidityScore)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Legs Breakdown & Financial Matrix */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                        
                        {/* Legs Details (Col 1-7) */}
                        <div className="lg:col-span-7 space-y-2 font-mono text-xs">
                          <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground block">
                            Option Contract Structure ({opp.targetDte} DTE • Exp: {opp.targetExpiration})
                          </span>

                          <div className="space-y-1.5">
                            {opp.legs.map((leg, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  "p-2 rounded-xl border flex items-center justify-between gap-2 text-xs",
                                  leg.action === 'SELL'
                                    ? "bg-purple-950/20 border-purple-500/40 text-purple-200"
                                    : "bg-indigo-950/20 border-indigo-500/40 text-indigo-200"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Badge className={cn(
                                    "text-[9px] px-1.5 py-0 font-bold",
                                    leg.action === 'SELL' ? "bg-purple-500 text-slate-950" : "bg-indigo-500 text-white"
                                  )}>
                                    {leg.action}
                                  </Badge>
                                  <span className="font-black text-white">1x ${leg.strike} {leg.optionType}</span>
                                </div>

                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                  <span>Δ {leg.delta.toFixed(2)}</span>
                                  <span>Mid: <strong className="text-foreground">${leg.mid.toFixed(2)}</strong></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Return & Risk Telemetry (Col 8-12) */}
                        <div className="lg:col-span-5 grid grid-cols-2 gap-2 font-mono text-xs p-3 rounded-xl bg-slate-900/70 border border-border/60">
                          <div>
                            <span className="text-[9px] font-sans text-muted-foreground block uppercase">
                              Net {opp.netEffect}
                            </span>
                            <strong className="text-sm font-black text-emerald-400">
                              ${opp.netPremiumTotal.toFixed(2)}
                            </strong>
                            <span className="text-[9px] text-muted-foreground block">(${opp.netPremiumPerShare.toFixed(2)}/sh)</span>
                          </div>

                          <div>
                            <span className="text-[9px] font-sans text-muted-foreground block uppercase">
                              Annualized ROC
                            </span>
                            <strong className="text-sm font-black text-emerald-300">
                              +{opp.annualizedRocPercent.toFixed(1)}%
                            </strong>
                            <span className="text-[9px] text-emerald-400/80 block">(+{opp.maxProfitPercent.toFixed(2)}% in {opp.targetDte}d)</span>
                          </div>

                          <div>
                            <span className="text-[9px] font-sans text-muted-foreground block uppercase">
                              Probability of Profit
                            </span>
                            <strong className="text-sm font-black text-cyan-300">
                              {opp.probabilityOfProfitPercent.toFixed(1)}% POP
                            </strong>
                          </div>

                          <div>
                            <span className="text-[9px] font-sans text-muted-foreground block uppercase">
                              Break-Even Level
                            </span>
                            <strong className="text-sm font-black text-foreground">
                              ${opp.breakEvenPrice.toFixed(2)}
                            </strong>
                            <span className="text-[9px] text-muted-foreground block">{opp.breakEvenBufferPercent.toFixed(1)}% buffer</span>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Strategy Rationale & AI Playbook */}
                      {isExpanded && (
                        <div className="p-4 rounded-xl bg-slate-900/90 border border-purple-500/30 space-y-3 animate-fade-in text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                              🧠 Volatility & Technical Thesis
                            </span>
                            <p className="text-foreground mt-0.5">{opp.volatilityThesis}</p>
                            <p className="text-muted-foreground mt-1">{opp.technicalSetup}</p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/40 font-mono text-[11px]">
                            <div className="p-2 rounded-lg bg-slate-950/60 border border-white/5">
                              <span className="text-[9px] font-sans text-emerald-400 font-bold block">PROFIT TARGET</span>
                              <span>{opp.tradeManagementRules.profitTarget}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-950/60 border border-white/5">
                              <span className="text-[9px] font-sans text-rose-400 font-bold block">STOP LOSS</span>
                              <span>{opp.tradeManagementRules.stopLossRule}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-950/60 border border-white/5">
                              <span className="text-[9px] font-sans text-cyan-400 font-bold block">TIME STOP / 21 DTE</span>
                              <span>{opp.tradeManagementRules.timeStopRule}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Bottom Action Controls */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        <button
                          onClick={() => setExpandedCardId(isExpanded ? null : opp.id)}
                          className="text-xs font-semibold text-purple-300 hover:text-purple-200 flex items-center gap-1 transition-colors"
                        >
                          <span>{isExpanded ? 'Hide AI Thesis & Management' : 'View AI Playbook & Greeks'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Set Price Alert Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetPriceAlert(opp, opp.breakEvenPrice, 'Break-Even')}
                            disabled={createAlertMutation.isPending}
                            className="h-8 text-xs font-semibold gap-1.5 border-border/70 hover:bg-amber-500/10 hover:text-amber-300 hover:border-amber-500/40"
                            title={`Set alert at break-even level ($${opp.breakEvenPrice.toFixed(2)})`}
                          >
                            <Bell className="w-3.5 h-3.5 text-amber-400" />
                            <span>Set Alert</span>
                          </Button>

                          {/* Save to Trade Ideas */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSaveToIdeas(opp)}
                            disabled={createIdeaMutation.isPending}
                            className="h-8 text-xs font-semibold gap-1.5 border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                            title="Save structured strategy to Trade Ideas"
                          >
                            <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
                            <span>Save to Ideas</span>
                          </Button>

                          {/* Open in Research */}
                          {onNavigateToResearch && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                onNavigateToResearch(opp.symbol);
                                onClose();
                              }}
                              className="h-8 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
                            >
                              <span>Research</span>
                              <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                            </Button>
                          )}

                          {/* Log in Trades */}
                          {onSelectTradeToLog && (
                            <Button
                              size="sm"
                              onClick={() => {
                                onSelectTradeToLog(opp);
                                onClose();
                              }}
                              className="h-8 text-xs font-bold gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>Log Fill</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
