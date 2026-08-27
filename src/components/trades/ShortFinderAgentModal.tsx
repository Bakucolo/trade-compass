import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingDown,
  TrendingUp,
  Target,
  Sparkles,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  DollarSign,
  BookmarkPlus,
  Bell,
  ExternalLink,
  Zap,
  Activity,
  Layers,
  BarChart3,
  Flame,
  Clock,
  ArrowDownRight,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ShortArchetype,
  ShortExecutionVehicle,
  MarketCapCategory,
  ShortAgentFilterParams,
  ShortTradeCandidate,
  useShortCandidates,
  useScanShortCandidates
} from '@/services/shortCandidateService';
import { useCreateAlert } from '@/services/alertService';
import { useCreateTradeIdea } from '@/services/ideaService';
import { UnifiedTrade } from '@/services/tradeService';

interface ShortFinderAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectShortToLog?: (candidate: ShortTradeCandidate) => void;
  onNavigateToResearch?: (symbol: string) => void;
}

export function ShortFinderAgentModal({
  isOpen,
  onClose,
  onSelectShortToLog,
  onNavigateToResearch,
}: ShortFinderAgentModalProps) {
  // Filter States
  const [selectedArchetype, setSelectedArchetype] = useState<ShortArchetype>('ALL');
  const [selectedVehicle, setSelectedVehicle] = useState<ShortExecutionVehicle>('ALL');
  const [selectedMarketCap, setSelectedMarketCap] = useState<MarketCapCategory>('ALL');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [minConviction, setMinConviction] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Active filter payload
  const activeFilters: ShortAgentFilterParams = useMemo(() => ({
    archetype: selectedArchetype !== 'ALL' ? selectedArchetype : undefined,
    executionVehicle: selectedVehicle !== 'ALL' ? selectedVehicle : undefined,
    marketCapCategory: selectedMarketCap !== 'ALL' ? selectedMarketCap : undefined,
    sector: selectedSector !== 'ALL' ? selectedSector : undefined,
    minConviction: minConviction > 0 ? minConviction : undefined,
    searchQuery: searchQuery.trim() || undefined,
    customPrompt: customPrompt.trim() || undefined,
  }), [selectedArchetype, selectedVehicle, selectedMarketCap, selectedSector, minConviction, searchQuery, customPrompt]);

  // Queries & Mutations
  const { data: scanResult, isLoading, refetch, isFetching } = useShortCandidates(activeFilters, isOpen);
  const scanMutation = useScanShortCandidates();
  const createAlertMutation = useCreateAlert();
  const createIdeaMutation = useCreateTradeIdea();

  const handleScan = () => {
    scanMutation.mutate(activeFilters, {
      onSuccess: (data) => {
        toast.success(`Agent scanned ${data.totalUniverseScanned} assets: Found ${data.matchedCount} short setups!`);
      },
      onError: (err: any) => {
        toast.error(`Agent scan failed: ${err.message}`);
      }
    });
  };

  const handleResetFilters = () => {
    setSelectedArchetype('ALL');
    setSelectedVehicle('ALL');
    setSelectedMarketCap('ALL');
    setSelectedSector('ALL');
    setMinConviction(0);
    setSearchQuery('');
    setCustomPrompt('');
  };

  const handleSetBreakdownAlert = async (candidate: ShortTradeCandidate) => {
    try {
      await createAlertMutation.mutateAsync({
        symbol: candidate.symbol,
        targetPrice: candidate.tradeBlueprint.entryTriggerPrice,
        condition: 'BELOW',
        notes: `[Short Finding Agent] ${candidate.symbol} breakdown trigger at $${candidate.tradeBlueprint.entryTriggerPrice.toFixed(2)} (${candidate.archetypeLabel})`
      });
      toast.success(`Breakdown alert armed for ${candidate.symbol} at $${candidate.tradeBlueprint.entryTriggerPrice.toFixed(2)}!`);
    } catch (err: any) {
      toast.error(`Failed to set alert: ${err.message}`);
    }
  };

  const handleSaveToIdeas = async (candidate: ShortTradeCandidate) => {
    try {
      const content = `### 🎯 Short Thesis & Catalyst: ${candidate.companyName} (${candidate.symbol})
- **Short Archetype**: ${candidate.archetypeLabel}
- **Conviction Score**: ${candidate.convictionScore}/100 (${candidate.convictionTier.replace(/_/g, ' ')})
- **Current Spot**: $${candidate.currentPrice.toFixed(2)} (${candidate.dayChangePercent >= 0 ? '+' : ''}${candidate.dayChangePercent.toFixed(2)}%)
- **Market Cap**: $${(candidate.marketCap / 1e9).toFixed(1)}B (${candidate.marketCapCategory})
- **Sector & Industry**: ${candidate.sector} • ${candidate.industry}

### 🛑 Key Fundamental & Technical Vulnerabilities
${candidate.keyVulnerabilities.map(v => `* ${v}`).join('\n')}

### ⚡ Catalysts & Timing Triggers
${candidate.catalysts.map(c => `* ${c}`).join('\n')}

### 📐 Trade Execution Blueprint
- **Recommended Vehicle**: \`${candidate.tradeBlueprint.vehicleLabel}\`
- **Entry Trigger**: $${candidate.tradeBlueprint.entryTriggerPrice.toFixed(2)} (${candidate.tradeBlueprint.entryCondition})
- **Target 1 (Conservative)**: $${candidate.tradeBlueprint.targetPrice1.toFixed(2)} (-${candidate.tradeBlueprint.downsidePotentialPercent.toFixed(1)}%)
- **Target 2 (Extended)**: $${candidate.tradeBlueprint.targetPrice2.toFixed(2)}
- **Stop Loss / Invalidation**: $${candidate.tradeBlueprint.stopLossPrice.toFixed(2)} (+${candidate.tradeBlueprint.riskPercent.toFixed(1)}%)
- **Risk/Reward Ratio**: ${candidate.tradeBlueprint.riskRewardRatio}
- **Time Horizon**: ${candidate.tradeBlueprint.timeHorizon.replace(/_/g, ' ')}
- **Execution Details**: ${candidate.tradeBlueprint.executionDetails}

### 📊 Key Quantitative Metrics
- **Valuation**: P/E ${candidate.metrics.peRatio ?? 'N/A'} | Forward P/E ${candidate.metrics.forwardPE ?? 'N/A'} | P/S ${candidate.metrics.priceToSales ?? 'N/A'}x | EV/EBITDA ${candidate.metrics.evToEbitda ?? 'N/A'}x
- **Fundamentals**: Revenue Growth ${candidate.metrics.revenueGrowthYoY ?? 'N/A'}% YoY | Net Margin ${candidate.metrics.netMargin ?? 'N/A'}% | FCF ${candidate.metrics.freeCashFlow ?? 'N/A'}
- **Technicals**: RSI(14) ${candidate.metrics.rsi14.toFixed(1)} | % vs 200 DMA ${candidate.metrics.distFrom200DmaPercent >= 0 ? '+' : ''}${candidate.metrics.distFrom200DmaPercent.toFixed(1)}% | Trend ${candidate.metrics.movingAverageTrend}
- **Short Float**: Short Interest ${candidate.metrics.shortInterestPercent ?? 'N/A'}% | Days to Cover ${candidate.metrics.daysToCover ?? 'N/A'}d`;

      await createIdeaMutation.mutateAsync({
        symbol: candidate.symbol,
        title: `SHORT: ${candidate.symbol} - ${candidate.archetypeLabel} (${candidate.convictionScore}% Conviction)`,
        type: 'BEARISH',
        timeframe: candidate.tradeBlueprint.timeHorizon === 'TACTICAL_DAYS' ? 'DAY' : 'SWING',
        entryPrice: candidate.currentPrice,
        targetPrice: candidate.tradeBlueprint.targetPrice1,
        stopLoss: candidate.tradeBlueprint.stopLossPrice,
        confidenceScore: candidate.convictionScore,
        source: 'AI_AGENT',
        content
      });

      toast.success(`Saved short idea for ${candidate.symbol} to Trade Ideas repository!`);
    } catch (err: any) {
      toast.error(`Failed to save idea: ${err.message}`);
    }
  };

  const handleOpenResearch = (symbol: string) => {
    if (onNavigateToResearch) {
      onNavigateToResearch(symbol);
    } else {
      window.dispatchEvent(new CustomEvent('select-research-ticker', { detail: symbol }));
    }
  };

  const candidates = scanResult?.candidates || [];
  const marketContext = scanResult?.marketContext;

  const quickPromptChips = [
    { label: 'Broken Valuation', prompt: 'Overvalued tech and software with high forward P/E and slowing growth' },
    { label: 'Cash Burn & Dilution', prompt: 'Unprofitable EV and growth companies with negative FCF and continuous dilution' },
    { label: 'Death Cross Breakdowns', prompt: 'Technical breakdown below 50 and 200 moving averages with high volume' },
    { label: 'High Debt Distress', prompt: 'Companies with high debt-to-equity and interest burden exceeding cash flows' },
    { label: 'Consumer Discretionary Peak', prompt: 'BNPL and cyclical retail vulnerable to consumer spending slowdown' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[94vh] flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-2xl border border-rose-500/20 shadow-2xl">
        
        {/* ================= MODAL HEADER ================= */}
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-gradient-to-r from-rose-950/30 via-slate-900/40 to-slate-950/40 relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-6">
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40 font-mono font-bold text-xs px-2.5 py-0.5">
                  <Flame className="w-3.5 h-3.5 mr-1 text-rose-400" />
                  BEARISH ALPHA AGENT
                </Badge>
                {marketContext && (
                  <Badge variant="outline" className={cn(
                    "text-xs font-mono font-semibold",
                    marketContext.marketRegime === 'RISK_OFF_BEARISH' ? "bg-rose-950/40 text-rose-300 border-rose-500/40" :
                    marketContext.marketRegime === 'ELEVATED_VOLATILITY' ? "bg-amber-950/40 text-amber-300 border-amber-500/40" :
                    "bg-slate-900/60 text-slate-300 border-border/60"
                  )}>
                    {marketContext.spyTrend} • VIX: {marketContext.vixLevel.toFixed(1)}
                  </Badge>
                )}
              </div>

              <DialogTitle className="text-2xl font-black tracking-tight text-foreground pt-1 flex items-center gap-2.5">
                <TrendingDown className="w-6 h-6 text-rose-400" />
                AI Short Finding & Bearish Catalyst Agent
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Autonomous quantitative scanner screening for valuation disconnects, technical breakdown patterns, balance sheet distress, and structured short trade setups.
              </DialogDescription>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2 self-start md:self-center shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset Filters
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={handleScan}
                disabled={scanMutation.isPending || isFetching}
                className="h-9 text-xs gap-1.5 bg-gradient-to-r from-rose-600 to-rose-800 hover:from-rose-500 hover:to-rose-700 text-white font-bold shadow-lg shadow-rose-900/30"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", (scanMutation.isPending || isFetching) && "animate-spin")} />
                <span>{scanMutation.isPending || isFetching ? 'Scanning Universe...' : 'Run Agent Scan'}</span>
              </Button>
            </div>

          </div>

          {/* ================= NATURAL LANGUAGE PROMPT INPUT ================= */}
          <div className="mt-4 pt-3 border-t border-border/40 space-y-2">
            <div className="relative flex items-center">
              <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-400" />
              <Input
                placeholder="Ask the Agent: e.g. 'Find high debt consumer retail companies vulnerable to margin compression'..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                className="pl-10 pr-24 h-10 text-xs bg-slate-950/60 border-rose-500/30 focus-visible:ring-rose-500/40 rounded-xl"
              />
              {customPrompt && (
                <button
                  onClick={() => setCustomPrompt('')}
                  className="absolute right-20 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
              <Button
                size="sm"
                onClick={handleScan}
                disabled={scanMutation.isPending || isFetching}
                className="absolute right-1.5 h-7 px-3 text-[11px] bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 rounded-lg"
              >
                Apply
              </Button>
            </div>

            {/* Quick Prompt Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0 mr-1 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> Archetypes:
              </span>
              {quickPromptChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCustomPrompt(chip.prompt);
                    // trigger quick refetch
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 transition-all border",
                    customPrompt === chip.prompt
                      ? "bg-rose-500/20 text-rose-200 border-rose-500/50 shadow-sm"
                      : "bg-slate-900/60 text-muted-foreground border-border/50 hover:text-rose-300 hover:border-rose-500/30"
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* ================= FILTER TOOLBAR ================= */}
        <div className="px-6 py-3 border-b border-border/50 bg-card/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Archetype Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0 mr-1">
              Short Thesis:
            </span>
            {[
              { id: 'ALL', label: 'All Archetypes' },
              { id: 'FUNDAMENTAL_OVERVALUATION', label: 'Broken Valuation' },
              { id: 'TECHNICAL_BREAKDOWN', label: 'Tech Breakdown' },
              { id: 'EARNINGS_DECELERATION', label: 'Earnings Deceleration' },
              { id: 'HIGH_BETA_CYCLICAL_TOP', label: 'Cyclical Peak' },
              { id: 'BALANCE_SHEET_DISTRESS', label: 'Debt Distress' },
            ].map((arch) => (
              <button
                key={arch.id}
                onClick={() => setSelectedArchetype(arch.id as ShortArchetype)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border",
                  selectedArchetype === arch.id
                    ? "bg-rose-600 text-white border-rose-500 shadow-sm"
                    : "bg-slate-950/40 text-muted-foreground border-border/50 hover:text-foreground hover:bg-slate-900"
                )}
              >
                {arch.label}
              </button>
            ))}
          </div>

          {/* Execution Vehicle & Market Cap */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Vehicle Selector */}
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value as ShortExecutionVehicle)}
              className="h-8 px-2.5 bg-slate-950/60 border border-border/60 rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:border-rose-500/50"
            >
              <option value="ALL">All Execution Vehicles</option>
              <option value="DIRECT_SHORT">Direct Equity Short</option>
              <option value="LONG_PUT">Long Outright Put</option>
              <option value="BEAR_PUT_SPREAD">Bear Put Spread (Debit)</option>
              <option value="BEAR_CALL_SPREAD">Bear Call Spread (Credit)</option>
            </select>

            {/* Market Cap Selector */}
            <select
              value={selectedMarketCap}
              onChange={(e) => setSelectedMarketCap(e.target.value as MarketCapCategory)}
              className="h-8 px-2.5 bg-slate-950/60 border border-border/60 rounded-lg text-xs font-semibold text-foreground focus:outline-none focus:border-rose-500/50"
            >
              <option value="ALL">All Market Caps</option>
              <option value="MEGA_CAP">Mega Cap (&gt; $200B)</option>
              <option value="LARGE_CAP">Large Cap ($10B - $200B)</option>
              <option value="MID_CAP">Mid Cap ($2B - $10B)</option>
              <option value="SMALL_CAP">Small Cap (&lt; $2B)</option>
            </select>

            {/* Ticker Search */}
            <div className="relative w-36">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter Ticker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-950/60 border-border/60 rounded-lg"
              />
            </div>
          </div>

        </div>

        {/* ================= SCROLLABLE CANDIDATES LIST ================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
          
          {(isLoading || scanMutation.isPending) ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20 shadow-lg">
                <TrendingDown className="w-10 h-10 text-rose-400 animate-bounce" />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-base font-bold text-foreground">AI Short Finding Agent Scanning Market Equities...</h4>
                <p className="text-xs text-muted-foreground max-w-md">
                  Analyzing fundamental multiple distortions, free cash flow deficits, 50/200 DMA breakdown momentum, and structuring asymmetric downside execution plans.
                </p>
              </div>
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card/40 p-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 bg-muted/20 rounded-full border border-border/50 text-muted-foreground">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-base font-bold text-foreground">No Matching Short Candidates Found</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Try adjusting your thesis archetype, clearing your search query, or lowering your conviction threshold.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="text-xs mt-2">
                Reset All Filters
              </Button>
            </div>
          ) : (
            candidates.map((cand) => {
              const isExpanded = expandedCardId === cand.id;
              const isHighConviction = cand.convictionScore >= 88;

              return (
                <Card
                  key={cand.id}
                  className={cn(
                    "border transition-all duration-200 overflow-hidden group shadow-md",
                    isHighConviction
                      ? "bg-gradient-to-r from-rose-950/20 via-slate-900/40 to-slate-950/40 border-rose-500/40 hover:border-rose-500/60"
                      : "bg-card/50 border-border/60 hover:border-border"
                  )}
                >
                  {/* Top Bar / Card Header */}
                  <div className="p-5 pb-4 space-y-3">
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      {/* Left: Ticker & Archetype Badges */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          onClick={() => handleOpenResearch(cand.symbol)}
                          className="font-mono font-black text-xl text-foreground hover:text-rose-400 transition-colors flex items-center gap-1.5 group/btn"
                        >
                          <span>{cand.symbol}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover/btn:opacity-100 text-rose-400 transition-opacity" />
                        </button>

                        <span className="text-xs font-semibold text-muted-foreground truncate max-w-[180px]">
                          {cand.companyName}
                        </span>

                        <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30 text-[10px] font-bold">
                          {cand.archetypeLabel}
                        </Badge>

                        <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
                          {cand.sector}
                        </Badge>
                      </div>

                      {/* Right: Conviction Badge & Spot Price */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="flex flex-col items-end font-mono">
                          <span className="text-base font-black text-foreground">
                            ${cand.currentPrice.toFixed(2)}
                          </span>
                          <span className={cn(
                            "text-xs font-bold",
                            cand.dayChangePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                          )}>
                            {cand.dayChangePercent >= 0 ? '+' : ''}{cand.dayChangePercent.toFixed(2)}%
                          </span>
                        </div>

                        {/* Conviction Score Pill */}
                        <div className={cn(
                          "px-3 py-1.5 rounded-xl border flex flex-col items-center justify-center font-mono shadow-sm",
                          isHighConviction
                            ? "bg-rose-950/40 border-rose-500/50 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.2)]"
                            : "bg-amber-950/30 border-amber-500/40 text-amber-300"
                        )}>
                          <span className="text-[9px] uppercase font-bold tracking-wider opacity-80">Conviction</span>
                          <span className="text-sm font-black">{cand.convictionScore}%</span>
                        </div>
                      </div>

                    </div>

                    {/* Short Thesis Callout Banner */}
                    <div className="p-3 rounded-xl bg-slate-950/50 border border-border/50 text-xs text-foreground/90 leading-relaxed">
                      <p className="font-medium">
                        <strong className="text-rose-400 uppercase font-black tracking-wider text-[10px] mr-1.5">
                          Short Thesis:
                        </strong>
                        {cand.shortThesis}
                      </p>
                    </div>

                    {/* Key Metrics Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs font-mono">
                      <div className="bg-card/70 border border-border/40 rounded-lg p-2">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">P/E (Forward)</span>
                        <span className="font-bold text-foreground mt-0.5 block">
                          {cand.metrics.forwardPE ? `${cand.metrics.forwardPE}x` : cand.metrics.peRatio ? `${cand.metrics.peRatio}x` : 'Unprofitable'}
                        </span>
                      </div>

                      <div className="bg-card/70 border border-border/40 rounded-lg p-2">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Price / Sales</span>
                        <span className="font-bold text-foreground mt-0.5 block">
                          {cand.metrics.priceToSales ? `${cand.metrics.priceToSales}x` : 'N/A'}
                        </span>
                      </div>

                      <div className="bg-card/70 border border-border/40 rounded-lg p-2">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Free Cash Flow</span>
                        <span className={cn("font-bold mt-0.5 block", cand.metrics.freeCashFlow?.startsWith('-') ? "text-rose-400" : "text-emerald-400")}>
                          {cand.metrics.freeCashFlow || 'N/A'}
                        </span>
                      </div>

                      <div className="bg-card/70 border border-border/40 rounded-lg p-2">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">RSI (14)</span>
                        <span className={cn(
                          "font-bold mt-0.5 block",
                          cand.metrics.rsi14 > 65 ? "text-amber-400" : cand.metrics.rsi14 < 45 ? "text-rose-400" : "text-foreground"
                        )}>
                          {cand.metrics.rsi14.toFixed(1)}
                        </span>
                      </div>

                      <div className="bg-card/70 border border-border/40 rounded-lg p-2">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">vs 200 DMA</span>
                        <span className={cn(
                          "font-bold mt-0.5 block",
                          cand.metrics.distFrom200DmaPercent < 0 ? "text-rose-400" : "text-amber-400"
                        )}>
                          {cand.metrics.distFrom200DmaPercent >= 0 ? '+' : ''}{cand.metrics.distFrom200DmaPercent.toFixed(1)}%
                        </span>
                      </div>

                      <div className="bg-card/70 border border-border/40 rounded-lg p-2">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Short Float %</span>
                        <span className="font-bold text-foreground mt-0.5 block">
                          {cand.metrics.shortInterestPercent ? `${cand.metrics.shortInterestPercent}%` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Trade Blueprint Summary Strip */}
                    <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-purple-500/20 text-purple-200 border-purple-500/40 text-[10px] font-bold">
                          {cand.tradeBlueprint.vehicleLabel}
                        </Badge>
                        <span className="font-mono text-muted-foreground">
                          Entry: <strong className="text-foreground">${cand.tradeBlueprint.entryTriggerPrice.toFixed(2)}</strong>
                        </span>
                        <span className="font-mono text-emerald-400 font-bold">
                          Target: ${cand.tradeBlueprint.targetPrice1.toFixed(2)} (-{cand.tradeBlueprint.downsidePotentialPercent.toFixed(1)}%)
                        </span>
                        <span className="font-mono text-rose-400 font-bold">
                          Stop: ${cand.tradeBlueprint.stopLossPrice.toFixed(2)} (+{cand.tradeBlueprint.riskPercent.toFixed(1)}%)
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono font-bold border-amber-500/40 text-amber-300">
                          R:R {cand.tradeBlueprint.riskRewardRatio}
                        </Badge>
                      </div>

                      {/* Expand / Details Toggle */}
                      <button
                        onClick={() => setExpandedCardId(isExpanded ? null : cand.id)}
                        className="text-xs font-semibold text-rose-300 hover:text-rose-200 flex items-center gap-1 transition-colors"
                      >
                        <span>{isExpanded ? 'Hide Blueprint Details' : 'Full Thesis & Execution Specs'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                    </div>

                  </div>

                  {/* ================= EXPANDED DETAILS ACCORDION ================= */}
                  {isExpanded && (
                    <div className="p-5 pt-3 border-t border-border/40 bg-slate-950/40 space-y-4 animate-in slide-in-from-top-2 duration-200">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        
                        {/* Vulnerabilities */}
                        <div className="space-y-2">
                          <h5 className="font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5 text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Structural Vulnerabilities
                          </h5>
                          <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                            {cand.keyVulnerabilities.map((v, i) => (
                              <li key={i} className="leading-relaxed">
                                <span className="text-foreground/90">{v}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Catalysts */}
                        <div className="space-y-2">
                          <h5 className="font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 text-[11px]">
                            <Zap className="w-3.5 h-3.5" />
                            Upcoming Catalysts & Downside Triggers
                          </h5>
                          <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                            {cand.catalysts.map((c, i) => (
                              <li key={i} className="leading-relaxed">
                                <span className="text-foreground/90">{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                      </div>

                      {/* Execution Details & Options Legs */}
                      <div className="p-3 rounded-xl bg-card/60 border border-border/50 space-y-2 text-xs">
                        <h5 className="font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 text-[11px]">
                          <Target className="w-3.5 h-3.5 text-rose-400" />
                          Trade Execution Tactics & Option Specs
                        </h5>
                        <p className="text-muted-foreground leading-relaxed">
                          {cand.tradeBlueprint.executionDetails}
                        </p>
                        {cand.tradeBlueprint.optionsStructure && (
                          <div className="pt-2 border-t border-border/40 flex items-center gap-3 flex-wrap font-mono text-[11px]">
                            <span className="text-purple-300 font-bold">{cand.tradeBlueprint.optionsStructure.strategyName}</span>
                            <span>Exp: <b>{cand.tradeBlueprint.optionsStructure.targetExpiration} ({cand.tradeBlueprint.optionsStructure.targetDte}d)</b></span>
                            <span>Primary Strike: <b>${cand.tradeBlueprint.optionsStructure.primaryStrike}</b></span>
                            {cand.tradeBlueprint.optionsStructure.secondaryStrike && (
                              <span>Secondary Strike: <b>${cand.tradeBlueprint.optionsStructure.secondaryStrike}</b></span>
                            )}
                            <span>Est. Cost/Credit: <b>${cand.tradeBlueprint.optionsStructure.estimatedCostOrCredit}</b></span>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* ================= ACTION BUTTONS FOOTER ================= */}
                  <div className="px-5 py-3 border-t border-border/40 bg-card/30 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetBreakdownAlert(cand)}
                        disabled={createAlertMutation.isPending}
                        className="h-8 text-xs gap-1.5 border-border/60 hover:bg-accent/40"
                        title="Arm a 1-click price alert at the short breakdown entry level"
                      >
                        <Bell className="w-3.5 h-3.5 text-amber-400" />
                        <span>Arm Breakdown Alert</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSaveToIdeas(cand)}
                        disabled={createIdeaMutation.isPending}
                        className="h-8 text-xs gap-1.5 border-border/60 hover:bg-accent/40"
                        title="Save comprehensive short thesis to Trade Ideas database"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5 text-primary" />
                        <span>Save to Trade Ideas</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      {onSelectShortToLog && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            onClose();
                            onSelectShortToLog(cand);
                          }}
                          className="h-8 text-xs gap-1.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold shadow-sm"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Log as Short Trade</span>
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenResearch(cand.symbol)}
                        className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <span>Deep Research</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                </Card>
              );
            })
          )}

        </div>

      </DialogContent>
    </Dialog>
  );
}
