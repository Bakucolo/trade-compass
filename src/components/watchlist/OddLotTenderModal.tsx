import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sparkles,
  Zap,
  TrendingUp,
  DollarSign,
  Calendar,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  BookmarkPlus,
  AlertCircle,
  FileText,
  CheckCircle2,
  Lock,
  Layers,
  Scale
} from 'lucide-react';
import {
  useOddLotTenders,
  useSaveToOddLotsWatchlist,
  OddLotTenderOpportunity
} from '@/services/oddLotTenderService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface OddLotTenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWatchlistSaved?: (watchlistId: string, watchlistName: string) => void;
  onNavigateToResearch?: (symbol: string) => void;
}

export function OddLotTenderModal({
  isOpen,
  onClose,
  onWatchlistSaved,
  onNavigateToResearch
}: OddLotTenderModalProps) {
  const { data: scanResult, isLoading, isRefetching, refetch } = useOddLotTenders();
  const saveMutation = useSaveToOddLotsWatchlist();

  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [createPriceAlerts, setCreatePriceAlerts] = useState<boolean>(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const opportunities = scanResult?.opportunities || [];

  // Initialize all selected by default when data arrives
  React.useEffect(() => {
    if (opportunities.length > 0 && selectedSymbols.length === 0) {
      setSelectedSymbols(opportunities.map(o => o.symbol));
    }
  }, [opportunities]);

  const handleToggleSelectAll = () => {
    if (selectedSymbols.length === opportunities.length) {
      setSelectedSymbols([]);
    } else {
      setSelectedSymbols(opportunities.map(o => o.symbol));
    }
  };

  const handleToggleSymbol = (symbol: string) => {
    setSelectedSymbols(prev =>
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  };

  const handleSaveToWatchlist = async () => {
    if (selectedSymbols.length === 0) {
      toast.error('Please select at least one odd lot opportunity.');
      return;
    }

    try {
      const res = await saveMutation.mutateAsync({
        symbols: selectedSymbols,
        createPriceAlerts
      });

      toast.success(
        `Successfully saved ${selectedSymbols.length} odd lot opportunities to the "Odd Lots" watchlist! (${res.alertsCreated} price alerts set)`
      );

      if (onWatchlistSaved) {
        onWatchlistSaved(res.watchlistId, res.watchlistName);
      }
      onClose();
    } catch (err: any) {
      toast.error(`Failed to save watchlist: ${err.message}`);
    }
  };

  const formatCurr = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '$0.00';
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Selected totals
  const selectedOpps = opportunities.filter(o => selectedSymbols.includes(o.symbol));
  const selectedCapital = selectedOpps.reduce((sum, o) => sum + o.capitalRequired, 0);
  const selectedProfit = selectedOpps.reduce((sum, o) => sum + o.estimatedGrossProfit, 0);
  const selectedAvgSpread = selectedOpps.length > 0
    ? (selectedOpps.reduce((sum, o) => sum + o.spreadPercent, 0) / selectedOpps.length).toFixed(1)
    : '0.0';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-950/95 border-amber-500/30 shadow-2xl backdrop-blur-2xl">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-border/40 bg-gradient-to-r from-amber-950/30 via-slate-950/80 to-purple-950/30 relative">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                    Odd Lots Tender Arbitrage Agent
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-mono">
                      SEC RULE 13E-4 PRIORITY
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Self-tender and buyback arbitrage scanner. Tenders provide 100% priority acceptance without proration for holdings of ≤99 shares.
                  </DialogDescription>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="h-8 text-xs gap-1 border-amber-500/30 hover:bg-amber-500/10 text-amber-300"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", (isLoading || isRefetching) && "animate-spin")} />
              <span>Refresh Scan</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Executive Summary Metrics Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="glass-card p-3 border-amber-500/30 bg-slate-900/60">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block flex items-center gap-1">
                <Layers className="w-3 h-3 text-amber-400" /> Active Opportunities
              </span>
              <div className="text-xl font-black font-mono text-foreground mt-0.5">
                {opportunities.length} Offers
              </div>
              <span className="text-[10px] text-amber-400/80 font-mono">All Rule 13e-4 Verified</span>
            </Card>

            <Card className="glass-card p-3 border-emerald-500/30 bg-slate-900/60">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> Average Spread
              </span>
              <div className="text-xl font-black font-mono text-emerald-400 mt-0.5">
                +{scanResult?.averageSpreadPercent || '0.00'}%
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Upside to Tender Price</span>
            </Card>

            <Card className="glass-card p-3 border-cyan-500/30 bg-slate-900/60">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-cyan-400" /> Max 99-Share Profit
              </span>
              <div className="text-xl font-black font-mono text-cyan-300 mt-0.5">
                {formatCurr(scanResult?.totalPotentialProfit)}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Combined Portfolio Gain</span>
            </Card>

            <Card className="glass-card p-3 border-purple-500/30 bg-slate-900/60">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block flex items-center gap-1">
                <Scale className="w-3 h-3 text-purple-400" /> Proration Protection
              </span>
              <div className="text-xl font-black font-mono text-purple-300 mt-0.5">
                0% Proration
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">100% Fill on ≤99 Shares</span>
            </Card>
          </div>

          {/* Arbitrage Strategy Notice Box */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-amber-200">
                How Odd-Lot Tender Arbitrage Works (SEC Rule 13e-4 Priority):
              </p>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                When companies buy back shares via tender offers, oversubscribed shares are normally prorated. However, under SEC regulations, holders of <strong>99 shares or fewer ("odd lots")</strong> who tender all their shares receive <strong>100% priority acceptance with zero proration</strong>. You buy up to 99 shares at the market price, submit a voluntary corporate action tender instruction through your broker, and collect the tender cash payout upon settlement.
              </p>
            </div>
          </div>

          {/* Table Header / Selection Bar */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedSymbols.length === opportunities.length && opportunities.length > 0}
                onCheckedChange={handleToggleSelectAll}
              />
              <label htmlFor="select-all" className="text-xs font-semibold text-foreground cursor-pointer">
                Select All Opportunities ({selectedSymbols.length}/{opportunities.length})
              </label>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
              <span>Capital Req: <strong className="text-foreground">{formatCurr(selectedCapital)}</strong></span>
              <span>Selected Profit: <strong className="text-emerald-400">+{formatCurr(selectedProfit)}</strong></span>
            </div>
          </div>

          {/* Opportunities List */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-sm">Scanning SEC Form SC TO-I filings & live market quotes...</p>
            </div>
          ) : opportunities.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-sm font-semibold">No active odd-lot tender opportunities found right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {opportunities.map((opp) => {
                const isSelected = selectedSymbols.includes(opp.symbol);
                const isExpanded = expandedId === opp.id;

                return (
                  <div
                    key={opp.id}
                    className={cn(
                      "rounded-xl border transition-all overflow-hidden bg-card/60",
                      isSelected ? "border-amber-500/40 shadow-sm" : "border-border/40 opacity-85",
                      isExpanded && "bg-card/90 border-amber-500/60"
                    )}
                  >
                    {/* Opportunity Summary Row */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSymbol(opp.symbol)}
                        />

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-foreground text-base tracking-tight">
                              {opp.symbol}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-300 bg-amber-500/10">
                              {opp.tenderType.replace(/_/g, ' ')}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] font-mono border-purple-500/40 text-purple-300 bg-purple-500/10">
                              {opp.secForm}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                            {opp.companyName}
                          </p>
                        </div>
                      </div>

                      {/* Pricing & Spread Metrics */}
                      <div className="flex items-center gap-4 sm:gap-6 text-right">
                        <div>
                          <span className="text-[10px] uppercase text-muted-foreground block">Market vs Tender</span>
                          <div className="text-xs font-mono font-semibold text-foreground">
                            {formatCurr(opp.currentPrice)} <ArrowRight className="w-3 h-3 inline text-amber-400" /> <span className="text-amber-300 font-bold">{formatCurr(opp.tenderPrice)}</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase text-muted-foreground block">Spread</span>
                          <div className="text-sm font-mono font-black text-emerald-400">
                            +{opp.spreadPercent.toFixed(2)}%
                          </div>
                        </div>

                        <div className="hidden md:block">
                          <span className="text-[10px] uppercase text-muted-foreground block">99-Share Profit</span>
                          <div className="text-sm font-mono font-bold text-cyan-300">
                            +{formatCurr(opp.estimatedGrossProfit)}
                          </div>
                        </div>

                        <div className="hidden lg:block">
                          <span className="text-[10px] uppercase text-muted-foreground block">Expires In</span>
                          <div className="text-xs font-mono text-muted-foreground flex items-center gap-1 justify-end">
                            <Calendar className="w-3 h-3 text-primary" /> {opp.daysToExpiration}d ({opp.expirationDate})
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? null : opp.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="View Execution Playbook"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Expandable Execution Blueprint & Risk Analysis */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-border/40 bg-slate-950/60 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {/* Deal Summary & Key Conditions */}
                          <div className="p-3 rounded-lg bg-card/40 border border-border/30 space-y-1.5">
                            <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs text-amber-300">
                              <FileText className="w-3.5 h-3.5" /> SEC Tender Filing Terms
                            </span>
                            <p className="text-muted-foreground text-[11px] leading-relaxed">
                              {opp.dealSummary}
                            </p>
                            <div className="pt-1.5 space-y-1">
                              {opp.keyConditions.map((cond, idx) => (
                                <div key={idx} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                  <span>{cond}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Step-by-Step Execution Roadmap */}
                          <div className="p-3 rounded-lg bg-card/40 border border-border/30 space-y-1.5 font-mono text-[11px]">
                            <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs font-sans text-cyan-300">
                              <Zap className="w-3.5 h-3.5" /> 99-Share Arbitrage Roadmap
                            </span>
                            <div className="space-y-1 text-muted-foreground">
                              <p>1. Capital Outlay: <strong className="text-foreground">{formatCurr(opp.capitalRequired)}</strong> (99 shares @ {formatCurr(opp.currentPrice)})</p>
                              <p>2. Buy Deadline: <strong className="text-foreground">{opp.executionPlaybook.buyWindowDeadline}</strong></p>
                              <p>3. Broker Election Cut-off: <strong className="text-amber-300">{opp.executionPlaybook.tenderInstructionDeadline}</strong></p>
                              <p>4. Estimated Payout: <strong className="text-emerald-400">{formatCurr(opp.tenderPrice * 99)}</strong></p>
                              <p>5. Net Profit: <strong className="text-emerald-400">+{formatCurr(opp.estimatedGrossProfit)}</strong> (Annualized: +{opp.annualizedReturnPercent}%)</p>
                            </div>
                          </div>
                        </div>

                        {/* Broker Action Instruction */}
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 flex items-start gap-2">
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>
                            <strong>Broker Execution Step:</strong> {opp.executionPlaybook.brokerActionStep}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/40 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="set-alerts"
              checked={createPriceAlerts}
              onCheckedChange={(checked) => setCreatePriceAlerts(!!checked)}
            />
            <label htmlFor="set-alerts" className="text-xs text-muted-foreground cursor-pointer">
              Automatically set target price alerts on all saved stocks
            </label>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs h-9"
            >
              Cancel
            </Button>

            <Button
              variant="glow"
              size="sm"
              onClick={handleSaveToWatchlist}
              disabled={saveMutation.isPending || selectedSymbols.length === 0}
              className="h-9 px-4 text-xs font-bold gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-lg shadow-amber-500/20"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
              ) : (
                <BookmarkPlus className="w-3.5 h-3.5 text-slate-950" />
              )}
              <span>Save {selectedSymbols.length} Opportunities to "Odd Lots" Watchlist</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
