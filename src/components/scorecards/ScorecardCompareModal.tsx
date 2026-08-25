import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Scale,
  Trophy,
  TrendingUp,
  Sparkles,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  X,
  Plus,
  ArrowRight,
  ExternalLink,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScorecardComparison, StockScorecard } from '@/services/scorecardService';

interface ScorecardCompareModalProps {
  initialSymbols?: string[];
  allAvailableSymbols?: string[];
  isOpen: boolean;
  onClose: () => void;
  onNavigateToResearch?: (symbol: string) => void;
}

export function ScorecardCompareModal({
  initialSymbols = [],
  allAvailableSymbols = [],
  isOpen,
  onClose,
  onNavigateToResearch,
}: ScorecardCompareModalProps) {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [newSymbolInput, setNewSymbolInput] = useState('');

  const compareMutation = useScorecardComparison();

  useEffect(() => {
    if (isOpen && initialSymbols.length > 0) {
      setSelectedSymbols(initialSymbols.slice(0, 4));
      compareMutation.mutate(initialSymbols.slice(0, 4));
    }
  }, [isOpen, initialSymbols]);

  const handleAddSymbol = (symToAdd: string) => {
    const clean = symToAdd.trim().toUpperCase();
    if (!clean || selectedSymbols.includes(clean) || selectedSymbols.length >= 4) return;

    const updated = [...selectedSymbols, clean];
    setSelectedSymbols(updated);
    compareMutation.mutate(updated);
    setNewSymbolInput('');
  };

  const handleRemoveSymbol = (symToRemove: string) => {
    if (selectedSymbols.length <= 1) return;
    const updated = selectedSymbols.filter((s) => s !== symToRemove);
    setSelectedSymbols(updated);
    compareMutation.mutate(updated);
  };

  const data = compareMutation.data;
  const candidates = data?.candidates || [];
  const winners = data?.winners;

  const fmtVal = (val: number | null | undefined, suffix = '', prefix = '') => {
    if (val == null || isNaN(val)) return 'N/A';
    return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}${suffix}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-card/95 backdrop-blur-2xl border-border/80 p-0 rounded-2xl shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-indigo-500 to-purple-500" />

        <div className="p-6 space-y-6">
          {/* Header */}
          <DialogHeader className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-foreground">
                    Head-to-Head Stock Scorecard Comparison
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    Compare watchlist candidates against existing portfolio holdings across all multi-factor conviction metrics.
                  </p>
                </div>
              </div>

              {/* Add Symbol Input */}
              {selectedSymbols.length < 4 && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add ticker (e.g. NVDA)"
                    value={newSymbolInput}
                    onChange={(e) => setNewSymbolInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddSymbol(newSymbolInput);
                    }}
                    className="h-8 w-36 text-xs font-mono uppercase bg-background/80"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddSymbol(newSymbolInput)}
                    className="h-8 text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Winner Callout Ribbon */}
          {winners && winners.overall && (
            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/30 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                <span className="font-bold text-foreground">
                  Overall Group Winner: <strong className="text-primary font-mono text-sm">{winners.overall}</strong>
                </span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground font-mono text-[11px]">
                <span>Quality: <strong className="text-teal-400">{winners.fundamentals}</strong></span>
                <span>•</span>
                <span>Valuation: <strong className="text-indigo-400">{winners.valuation}</strong></span>
                <span>•</span>
                <span>Upside: <strong className="text-emerald-400">{winners.marginOfSafety}</strong></span>
              </div>
            </div>
          )}

          {/* Comparative Matrix Table */}
          {compareMutation.isPending ? (
            <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Scale className="w-8 h-8 text-primary animate-pulse" />
              <span>Analyzing comparative multi-factor scorecards...</span>
            </div>
          ) : candidates.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground bg-accent/10 rounded-xl border border-border/40">
              No comparison candidates selected. Add tickers above to compare.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-accent/30 border-b border-border/60">
                    <th className="p-3.5 font-bold text-muted-foreground uppercase text-[10px] w-48">
                      Metric / Attribute
                    </th>
                    {candidates.map((c) => (
                      <th key={c.symbol} className="p-3.5 font-mono text-center border-l border-border/40 min-w-[170px]">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="text-left">
                            <span className="text-sm font-black text-foreground block">{c.symbol}</span>
                            <span className="text-[10px] text-muted-foreground truncate block max-w-[120px] font-sans">
                              {c.name}
                            </span>
                          </div>
                          {selectedSymbols.length > 1 && (
                            <button
                              onClick={() => handleRemoveSymbol(c.symbol)}
                              className="text-muted-foreground hover:text-rose-400 p-1"
                              title="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1 justify-start">
                          {c.isHolding && (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[8px] px-1 py-0 uppercase">
                              Holding
                            </Badge>
                          )}
                          {c.isWatchlist && (
                            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[8px] px-1 py-0 uppercase">
                              Watchlist
                            </Badge>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {/* Current Price & Day Move */}
                  <tr className="hover:bg-accent/10">
                    <td className="p-3 font-sans font-medium text-muted-foreground">Price & Day Return</td>
                    {candidates.map((c) => (
                      <td key={c.symbol} className="p-3 text-center border-l border-border/40">
                        <span className="font-bold text-foreground block">${c.price.toFixed(2)}</span>
                        <span className={cn("text-[10px] font-bold", c.changePercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                          {c.changePercent >= 0 ? '+' : ''}{c.changePercent.toFixed(2)}%
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Section 1: Composite Scores */}
                  <tr className="bg-accent/20">
                    <td colSpan={candidates.length + 1} className="p-2 px-3.5 font-sans font-bold text-[10px] uppercase tracking-wider text-primary">
                      Multi-Factor Conviction Scores
                    </td>
                  </tr>
                  <tr className="hover:bg-accent/10">
                    <td className="p-3 font-sans font-bold text-foreground flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-primary" /> Overall Conviction Score
                    </td>
                    {candidates.map((c) => {
                      const isWinner = winners?.overall === c.symbol;
                      return (
                        <td key={c.symbol} className={cn("p-3 text-center border-l border-border/40", isWinner && "bg-primary/10 font-bold")}>
                          <span className={cn("text-base font-black px-2.5 py-0.5 rounded-lg border", isWinner ? "text-primary border-primary/40 bg-primary/20" : "text-foreground border-border/60")}>
                            {c.overallScore}/100
                          </span>
                          <span className="block text-[9px] text-muted-foreground mt-1 font-sans font-semibold">{c.gradeLabel}</span>
                        </td>
                      );
                    })}
                  </tr>

                  <tr className="hover:bg-accent/10">
                    <td className="p-3 font-sans font-medium text-muted-foreground">🟢 Buying Conviction</td>
                    {candidates.map((c) => {
                      const isWinner = winners?.buyingConviction === c.symbol;
                      return (
                        <td key={c.symbol} className={cn("p-3 text-center border-l border-border/40 font-bold", isWinner ? "text-emerald-400 bg-emerald-950/20" : "text-foreground")}>
                          {c.buyingConvictionScore}/100
                          {isWinner && <Badge className="ml-1 bg-emerald-500/20 text-emerald-300 text-[8px] px-1 py-0">Top</Badge>}
                        </td>
                      );
                    })}
                  </tr>

                  <tr className="hover:bg-accent/10">
                    <td className="p-3 font-sans font-medium text-muted-foreground">🔵 Fundamentals & Quality</td>
                    {candidates.map((c) => {
                      const isWinner = winners?.fundamentals === c.symbol;
                      return (
                        <td key={c.symbol} className={cn("p-3 text-center border-l border-border/40 font-bold", isWinner ? "text-teal-400 bg-teal-950/20" : "text-foreground")}>
                          {c.fundamentalsScore}/100
                          {isWinner && <Badge className="ml-1 bg-teal-500/20 text-teal-300 text-[8px] px-1 py-0">Top</Badge>}
                        </td>
                      );
                    })}
                  </tr>

                  <tr className="hover:bg-accent/10">
                    <td className="p-3 font-sans font-medium text-muted-foreground">🟣 Valuation Score</td>
                    {candidates.map((c) => {
                      const isWinner = winners?.valuation === c.symbol;
                      return (
                        <td key={c.symbol} className={cn("p-3 text-center border-l border-border/40 font-bold", isWinner ? "text-indigo-400 bg-indigo-950/20" : "text-foreground")}>
                          {c.valuationScore}/100
                          {isWinner && <Badge className="ml-1 bg-indigo-500/20 text-indigo-300 text-[8px] px-1 py-0">Top</Badge>}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Section 2: Fundamental & Quality Metrics */}
                  <tr className="bg-accent/20">
                    <td colSpan={candidates.length + 1} className="p-2 px-3.5 font-sans font-bold text-[10px] uppercase tracking-wider text-teal-400">
                      Fundamental Quality & Solvency
                    </td>
                  </tr>

                  <tr className="hover:bg-accent/10">
                    <td className="p-3 font-sans font-medium text-muted-foreground">Operating Margin</td>
                    {candidates.map((c) => (
                      <td key={c.symbol} className="p-3 text-center border-l border-border/40">
                        {fmtVal(c.metrics.operatingMarginPct, '%')}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-accent/10">
                    <td className="p-3 font-sans font-medium text-muted-foreground">Return on Equity (ROE)</td>
                    {candidates.map((c) => (
                      <td key={c.symbol} className="p-3 text-center border-l border-border/40">
                        {fmtVal(c.metrics.roePct, '%')}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-accent/10">
                    <td className="p-3 font-sans font-medium text-muted-foreground">Debt-to-Equity</td>
                    {candidates.map((c) => (
                      <td key={c.symbol} className="p-3 text-center border-l border-border/40">
                        {fmtVal(c.metrics.debtToEquity, '%')}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-accent/10">
                    <td className="p-3 font-sans font-medium text-muted-foreground">Piotroski F-Score</td>
                    {candidates.map((c) => (
                      <td key={c.symbol} className="p-3 text-center border-l border-border/40">
                        {c.metrics.piotroskiFScoreEstimate}/9
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-accent/10">
                    <td className="p-3 font-sans font-medium text-muted-foreground">Health Status</td>
                    {candidates.map((c) => (
                      <td key={c.symbol} className="p-3 text-center border-l border-border/40">
                        <Badge variant="outline" className="text-[9px] font-sans font-semibold">
                          {c.healthStatus.replace('_', ' ')}
                        </Badge>
                      </td>
                    ))}
                  </tr>

                  {/* Section 3: Valuation Multiples */}
                  <tr className="bg-accent/20">
                    <td colSpan={candidates.length + 1} className="p-2 px-3.5 font-sans font-bold text-[10px] uppercase tracking-wider text-indigo-400">
                      Valuation & Upside Targets
                    </td>
                  </tr>

                  <tr className="hover:bg-accent/10">
                    <td className="p-3 font-sans font-medium text-muted-foreground">Forward P/E Multiple</td>
                    {candidates.map((c) => (
                      <td key={c.symbol} className="p-3 text-center border-l border-border/40">
                        {fmtVal(c.metrics.forwardPE, 'x')}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-accent/10">
                    <td className="p-3 font-sans font-medium text-muted-foreground">Price-to-Sales (P/S)</td>
                    {candidates.map((c) => (
                      <td key={c.symbol} className="p-3 text-center border-l border-border/40">
                        {fmtVal(c.metrics.priceToSales, 'x')}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-accent/10">
                    <td className="p-3 font-sans font-medium text-muted-foreground">Fair Value Target</td>
                    {candidates.map((c) => (
                      <td key={c.symbol} className="p-3 text-center border-l border-border/40 font-bold text-emerald-400">
                        ${c.metrics.fairValueEstimate.toFixed(2)} (+{c.metrics.upsideToFairValuePct}%)
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-accent/10">
                    <td className="p-3 font-sans font-medium text-muted-foreground">52W High Drawdown</td>
                    {candidates.map((c) => (
                      <td key={c.symbol} className="p-3 text-center border-l border-border/40">
                        {fmtVal(c.metrics.priceTo52WeekHighPct, '%')}
                      </td>
                    ))}
                  </tr>

                  {/* Section 4: Actions */}
                  <tr className="bg-accent/20">
                    <td colSpan={candidates.length + 1} className="p-2 px-3.5 font-sans font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
                      Execution & Research
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-sans font-medium text-muted-foreground">Research Jump</td>
                    {candidates.map((c) => (
                      <td key={c.symbol} className="p-3 text-center border-l border-border/40 font-sans">
                        {onNavigateToResearch && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              onClose();
                              onNavigateToResearch(c.symbol);
                            }}
                            className="h-7 text-xs text-primary hover:bg-primary/10 gap-1"
                          >
                            <span>Research</span>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Key Comparative Takeaways */}
          {data?.keyTakeaways && data.keyTakeaways.length > 0 && (
            <div className="p-4 rounded-xl bg-accent/20 border border-border/50 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Key Comparative Takeaways
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                {data.keyTakeaways.map((takeaway, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs font-bold">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
