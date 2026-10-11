import React, { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sparkles,
  Bot,
  TrendingUp,
  TrendingDown,
  Loader2,
  Check,
  CheckSquare,
  Square,
  Search,
  Layers,
  Zap,
  Building2,
  Cpu,
  Atom,
  Lock,
  ShieldAlert,
  ArrowRight,
  Info,
  DollarSign,
  Briefcase,
} from 'lucide-react';
import {
  useThematicStockLookup,
  useBulkAddSymbolsToWatchlist,
  ThematicStockCandidate,
  ThematicLookupResult,
} from '@/services/watchlistService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AiThematicWatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWatchlist?: { id: string; name: string } | null;
  existingSymbols?: string[];
  onAddedSuccess?: (watchlistId: string, addedCount: number) => void;
}

const PRESET_TOPICS = [
  'Semiconductors & Foundry',
  'Nuclear Energy & SMRs',
  'AI & Neural Compute',
  'Cybersecurity & Zero-Trust',
  'Aerospace & Defense',
  'GLP-1 Biopharma',
  'Clean Energy & Grid',
  'Dividend Aristocrats',
  'Critical Commodities & Mining',
  'Robotics & Automation',
];

export function AiThematicWatchlistModal({
  isOpen,
  onClose,
  activeWatchlist,
  existingSymbols = [],
  onAddedSuccess,
}: AiThematicWatchlistModalProps) {
  const [topicInput, setTopicInput] = useState('');
  const [customFocusInput, setCustomFocusInput] = useState('');
  const [showAdvancedFocus, setShowAdvancedFocus] = useState(false);
  const [researchResult, setResearchResult] = useState<ThematicLookupResult | null>(null);
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());

  // Mutations
  const lookupMutation = useThematicStockLookup();
  const bulkAddMutation = useBulkAddSymbolsToWatchlist();

  // Reset or initialize when modal opens with active watchlist
  useEffect(() => {
    if (isOpen) {
      const defaultTopic = activeWatchlist?.name || 'Semiconductors';
      setTopicInput(defaultTopic);
      // Auto-run research if no result or if topic changed
      if (!researchResult || researchResult.topic.toLowerCase() !== defaultTopic.toLowerCase()) {
        runLookup(defaultTopic);
      }
    }
  }, [isOpen, activeWatchlist?.id]);

  const runLookup = async (topicToSearch?: string) => {
    const targetTopic = (topicToSearch || topicInput).trim();
    if (!targetTopic) {
      toast.error('Please enter a theme or topic for the agent to research.');
      return;
    }

    try {
      const result = await lookupMutation.mutateAsync({
        topic: targetTopic,
        existingSymbols,
        customFocus: customFocusInput.trim() || undefined,
        count: 8,
      });

      setResearchResult(result);

      // Default select all candidates that are not already in the watchlist
      const newSelected = new Set<string>();
      result.stocks.forEach((stock) => {
        if (!stock.isAlreadyInWatchlist) {
          newSelected.add(stock.symbol);
        }
      });
      setSelectedSymbols(newSelected);

      toast.success(
        `AI Agent identified ${result.stocks.length} stocks for "${result.refinedTopicName || targetTopic}"!`
      );
    } catch (err: any) {
      toast.error(`Agent lookup failed: ${err.message || 'Please check API keys in settings'}`);
    }
  };

  const handleToggleSymbol = (symbol: string, isAlreadyIn: boolean) => {
    if (isAlreadyIn) return; // Prevent toggling already added
    const updated = new Set(selectedSymbols);
    if (updated.has(symbol)) {
      updated.delete(symbol);
    } else {
      updated.add(symbol);
    }
    setSelectedSymbols(updated);
  };

  const handleSelectAll = () => {
    if (!researchResult) return;
    const available = researchResult.stocks.filter((s) => !s.isAlreadyInWatchlist).map((s) => s.symbol);
    if (selectedSymbols.size === available.length) {
      setSelectedSymbols(new Set());
    } else {
      setSelectedSymbols(new Set(available));
    }
  };

  const handleAddSelectedToWatchlist = async () => {
    if (!activeWatchlist?.id) {
      toast.error('No target watchlist selected.');
      return;
    }

    const symbolsToAdd = Array.from(selectedSymbols);
    if (symbolsToAdd.length === 0) {
      toast.error('Please select at least one stock to add.');
      return;
    }

    try {
      const res = await bulkAddMutation.mutateAsync({
        watchlistId: activeWatchlist.id,
        symbols: symbolsToAdd,
      });

      toast.success(
        `Added ${res.addedCount} new stock${res.addedCount === 1 ? '' : 's'} to "${activeWatchlist.name}"!`
      );

      if (onAddedSuccess) {
        onAddedSuccess(activeWatchlist.id, res.addedCount);
      }
      onClose();
    } catch (err: any) {
      toast.error(`Failed to add stocks: ${err.message}`);
    }
  };

  const formatMarketCap = (cap?: number | null) => {
    if (!cap) return 'N/A';
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
    return `$${cap.toLocaleString()}`;
  };

  const availableCandidates = researchResult?.stocks.filter((s) => !s.isAlreadyInWatchlist) || [];
  const allAvailableSelected = availableCandidates.length > 0 && selectedSymbols.size === availableCandidates.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[850px] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-2xl border border-purple-500/30 shadow-2xl">
        {/* ================= HEADER ================= */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-gradient-to-r from-purple-500/15 via-indigo-500/10 to-primary/5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-primary flex items-center justify-center text-white font-black shadow-lg shadow-purple-500/20">
                <Bot className="w-5 h-5 text-amber-300 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                  <span>Thematic Watchlist AI Agent</span>
                  <Badge
                    variant="outline"
                    className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-[10px] uppercase font-mono font-bold"
                  >
                    Autonomous Research
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Screens premier US liquid leaders and pure-play beneficiaries tailored to{' '}
                  <span className="text-foreground font-semibold">"{activeWatchlist?.name || 'this watchlist'}"</span>.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* ================= BODY ================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Topic Search & Controls Card */}
          <div className="p-4 rounded-2xl bg-accent/20 border border-purple-500/20 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <Input
                  placeholder="Enter investment theme or sector (e.g. Semiconductors, Nuclear SMRs, Cybersecurity)..."
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runLookup();
                  }}
                  className="pl-10 h-11 bg-background/80 border-purple-500/30 focus:border-purple-500 text-sm font-medium"
                />
              </div>

              <Button
                variant="glow"
                className="h-11 px-5 bg-gradient-to-r from-purple-600 via-indigo-600 to-primary text-white font-bold gap-2 shrink-0 shadow-lg shadow-purple-500/20 hover:opacity-95"
                onClick={() => runLookup()}
                disabled={lookupMutation.isPending || !topicInput.trim()}
              >
                {lookupMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Researching Universe...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Run Research Agent</span>
                  </>
                )}
              </Button>
            </div>

            {/* Advanced Focus Toggle */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowAdvancedFocus(!showAdvancedFocus)}
                className="text-xs text-muted-foreground hover:text-purple-300 flex items-center gap-1 font-medium transition-colors"
              >
                <span>{showAdvancedFocus ? 'Hide' : '+ Add'} Custom Criteria / Focus Filters</span>
              </button>

              <span className="text-[11px] text-muted-foreground">
                Target List:{' '}
                <span className="font-semibold text-foreground">{activeWatchlist?.name || 'Active Watchlist'}</span>
              </span>
            </div>

            {showAdvancedFocus && (
              <div className="pt-2">
                <Input
                  placeholder="Optional custom instructions (e.g. 'pure plays only', 'dividend payers', 'small-to-mid cap equipment suppliers')..."
                  value={customFocusInput}
                  onChange={(e) => setCustomFocusInput(e.target.value)}
                  className="h-9 text-xs bg-background/60 border-border/80"
                />
              </div>
            )}

            {/* Quick Preset Topics */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/40">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mr-1">
                <Zap className="w-3 h-3 text-amber-400" /> Presets:
              </span>
              {PRESET_TOPICS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setTopicInput(preset);
                    runLookup(preset);
                  }}
                  disabled={lookupMutation.isPending}
                  className="text-[11px] px-2 py-0.5 rounded-lg border border-border/60 bg-background/50 hover:bg-purple-500/15 hover:border-purple-500/40 text-muted-foreground hover:text-foreground transition-all cursor-pointer font-medium"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Loading Radar State */}
          {lookupMutation.isPending && (
            <div className="p-8 rounded-2xl bg-card border border-purple-500/30 flex flex-col items-center justify-center gap-4 text-center animate-in fade-in">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-purple-500/30 animate-ping opacity-60" />
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Bot className="w-6 h-6 text-white animate-pulse" />
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-foreground">
                  Autonomous Agent Screening Stocks for "{topicInput}"
                </h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Evaluating pure-play beneficiaries, secular catalysts, quantitative theses, and live market pricing...
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-purple-300 font-mono">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Screening US equities universe & verifying fundamentals...</span>
              </div>
            </div>
          )}

          {/* Research Results */}
          {!lookupMutation.isPending && researchResult && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Thematic Overview Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/20 via-background to-indigo-950/20 border border-purple-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">
                      {researchResult.refinedTopicName}
                    </span>
                    <Badge
                      variant="outline"
                      className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-[10px]"
                    >
                      {researchResult.source === 'ai_agent' ? 'AI Strategist' : 'Institutional Basket'}
                    </Badge>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {researchResult.stocks.length} candidates analyzed
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {researchResult.themeDescription}
                </p>

                {researchResult.keyDrivers?.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-[11px] text-muted-foreground font-semibold">Key Catalysts:</span>
                    {researchResult.keyDrivers.map((driver, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-[10px] bg-purple-500/10 text-purple-200 border border-purple-500/20 font-medium"
                      >
                        {driver}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Candidates Header & Select All */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Recommended Tickers ({researchResult.stocks.length})
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    ({selectedSymbols.size} selected)
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-7 text-xs text-purple-400 hover:text-purple-300 gap-1.5"
                >
                  {allAvailableSelected ? (
                    <>
                      <Square className="w-3.5 h-3.5" /> Deselect All
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" /> Select All ({availableCandidates.length})
                    </>
                  )}
                </Button>
              </div>

              {/* Candidates Cards Grid / List */}
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {researchResult.stocks.map((stock) => {
                  const isSelected = selectedSymbols.has(stock.symbol);
                  const isAlreadyIn = Boolean(stock.isAlreadyInWatchlist);
                  const isPositive = (stock.changePercent ?? 0) >= 0;

                  return (
                    <div
                      key={stock.symbol}
                      onClick={() => handleToggleSymbol(stock.symbol, isAlreadyIn)}
                      className={cn(
                        'group p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                        isAlreadyIn
                          ? 'bg-accent/15 border-border/40 opacity-70 cursor-default'
                          : isSelected
                          ? 'bg-purple-950/25 border-purple-500/50 shadow-sm cursor-pointer'
                          : 'bg-card/70 hover:bg-accent/30 border-border/60 hover:border-purple-500/30 cursor-pointer'
                      )}
                    >
                      {/* Left: Checkbox + Ticker + Company Name + Role */}
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="pt-0.5 sm:pt-0">
                          <Checkbox
                            checked={isSelected || isAlreadyIn}
                            disabled={isAlreadyIn}
                            onCheckedChange={() => handleToggleSymbol(stock.symbol, isAlreadyIn)}
                            className={cn(
                              'border-purple-500/50',
                              isSelected && 'bg-purple-600 text-white border-purple-600'
                            )}
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-sm text-foreground">
                              {stock.symbol}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground truncate max-w-[180px]">
                              {stock.companyName}
                            </span>
                            {stock.subCategory && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1.5 py-0 bg-accent/40 text-muted-foreground border-border/60"
                              >
                                {stock.subCategory}
                              </Badge>
                            )}
                            {isAlreadyIn && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] px-1.5 py-0 bg-blue-500/20 text-blue-300 border-blue-500/40"
                              >
                                In Watchlist
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs text-foreground/80 mt-1 line-clamp-2 leading-relaxed">
                            {stock.thesis}
                          </p>
                        </div>
                      </div>

                      {/* Right: Real-time Telemetry (Price, % Change, Market Cap, PE) */}
                      <div className="flex items-center sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40 text-xs">
                        {stock.price !== undefined && (
                          <div className="text-right">
                            <div className="font-mono font-bold text-foreground">
                              ${stock.price.toFixed(2)}
                            </div>
                            {stock.changePercent !== undefined && (
                              <div
                                className={cn(
                                  'text-[10px] font-mono font-semibold flex items-center justify-end gap-0.5',
                                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                                )}
                              >
                                {isPositive ? '+' : ''}
                                {stock.changePercent.toFixed(2)}%
                              </div>
                            )}
                          </div>
                        )}

                        <div className="text-right text-[10px] text-muted-foreground">
                          <div>MCap: <span className="font-mono text-foreground font-medium">{formatMarketCap(stock.marketCap)}</span></div>
                          {stock.pe && stock.pe > 0 && (
                            <div>P/E: <span className="font-mono text-foreground font-medium">{stock.pe.toFixed(1)}</span></div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ================= FOOTER ================= */}
        <div className="p-4 border-t border-border/50 bg-background/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            {researchResult && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {selectedSymbols.size} of {availableCandidates.length} new stocks selected
              </span>
            )}
          </div>

          <Button
            variant="glow"
            size="sm"
            onClick={handleAddSelectedToWatchlist}
            disabled={bulkAddMutation.isPending || selectedSymbols.size === 0}
            className="h-10 px-5 bg-gradient-to-r from-purple-600 via-indigo-600 to-primary text-white font-bold gap-2 shadow-lg shadow-purple-500/20"
          >
            {bulkAddMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Adding to Watchlist...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Add {selectedSymbols.size} Stock{selectedSymbols.size === 1 ? '' : 's'} to "{activeWatchlist?.name || 'Watchlist'}"</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
