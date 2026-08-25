import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Bookmark,
  Plus,
  FolderPlus,
  Loader2,
  CheckCircle2,
  TrendingDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  useWatchlists,
  useBulkAddSymbolsToWatchlist,
  useBulkCreateWatchlist,
} from '@/services/watchlistService';
import { DipCandidateItem } from '@/services/dipRadarService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BulkSaveDipsToWatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  dips: DipCandidateItem[];
}

export function BulkSaveDipsToWatchlistModal({
  isOpen,
  onClose,
  dips,
}: BulkSaveDipsToWatchlistModalProps) {
  const { data: watchlists = [], isLoading: isWatchlistsLoading } = useWatchlists();
  const bulkAddMutation = useBulkAddSymbolsToWatchlist();
  const bulkCreateMutation = useBulkCreateWatchlist();

  // Selected dip symbols to save (default to all or top 10)
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(() =>
    dips.slice(0, 10).map((d) => d.symbol.toUpperCase())
  );

  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('AI Opportunity Dips');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync default selection when opened
  React.useEffect(() => {
    if (isOpen && dips.length > 0) {
      setSelectedSymbols(dips.slice(0, 10).map((d) => d.symbol.toUpperCase()));
    }
  }, [isOpen, dips]);

  const toggleSymbol = (sym: string) => {
    const clean = sym.toUpperCase();
    if (selectedSymbols.includes(clean)) {
      setSelectedSymbols(selectedSymbols.filter((s) => s !== clean));
    } else {
      setSelectedSymbols([...selectedSymbols, clean]);
    }
  };

  const selectAll = () => {
    setSelectedSymbols(dips.map((d) => d.symbol.toUpperCase()));
  };

  const deselectAll = () => {
    setSelectedSymbols([]);
  };

  const handleSave = async () => {
    if (selectedSymbols.length === 0) {
      toast.error('Please select at least one stock to save.');
      return;
    }

    setIsSubmitting(true);
    try {
      let targetWatchlistName = '';

      if (isCreatingNew && newWatchlistName.trim()) {
        const created = await bulkCreateMutation.mutateAsync({
          name: newWatchlistName.trim(),
          symbols: selectedSymbols,
        });
        targetWatchlistName = created.name;
      } else {
        const targetW = watchlists.find((w) => w.id === selectedWatchlistId) || watchlists[0];
        if (!targetW) {
          toast.error('Please select or create a watchlist.');
          setIsSubmitting(false);
          return;
        }

        await bulkAddMutation.mutateAsync({
          watchlistId: targetW.id,
          symbols: selectedSymbols,
        });
        targetWatchlistName = targetW.name;
      }

      toast.success(`Saved ${selectedSymbols.length} dips to "${targetWatchlistName}"!`, {
        description: `Successfully added ${selectedSymbols.join(', ')} to your watchlist.`,
      });

      onClose();
    } catch (err: any) {
      toast.error(`Failed to save dips: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto bg-slate-950 border border-slate-800 text-foreground p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Save Radar Dips to Watchlist
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Save detected pullback opportunities directly to a watchlist of your choice.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Section 1: Choose Watchlist Target */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" /> Target Watchlist:
            </label>
            <button
              type="button"
              onClick={() => setIsCreatingNew(!isCreatingNew)}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              {isCreatingNew ? 'Choose Existing' : 'Create New Watchlist'}
            </button>
          </div>

          {!isCreatingNew ? (
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              {isWatchlistsLoading ? (
                <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading watchlists...
                </div>
              ) : watchlists.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-xl">
                  No watchlists found. Create your first one below!
                </div>
              ) : (
                watchlists.map((w) => {
                  const isSelected = (selectedWatchlistId || watchlists[0]?.id) === w.id;
                  return (
                    <div
                      key={w.id}
                      onClick={() => setSelectedWatchlistId(w.id)}
                      className={cn(
                        "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between",
                        isSelected
                          ? "bg-purple-950/40 border-purple-500 text-foreground ring-1 ring-purple-500/40 shadow-sm"
                          : "bg-card/40 border-border/40 hover:bg-accent/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📁</span>
                        <span className="font-semibold text-xs text-foreground">
                          {w.name} {w.isDefault && <span className="text-[10px] text-muted-foreground">(Default)</span>}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] opacity-70">{w.items?.length || 0} stocks</span>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/60 space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FolderPlus className="w-3.5 h-3.5 text-emerald-400" /> New Watchlist Name:
              </label>
              <Input
                placeholder="e.g. AI Opportunity Dips, Value Pullbacks..."
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                autoFocus
                className="h-9 text-xs bg-slate-950 border-slate-700"
              />
            </div>
          )}
        </div>

        {/* Section 2: Select Stocks to Include */}
        <div className="space-y-2.5 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Select Stocks to Save ({selectedSymbols.length}/{dips.length}):
            </span>
            <div className="flex items-center gap-2 text-[11px]">
              <button onClick={selectAll} className="text-primary hover:underline font-semibold">Select All</button>
              <span>•</span>
              <button onClick={deselectAll} className="text-muted-foreground hover:underline font-semibold">Clear</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
            {dips.map((item) => {
              const sym = item.symbol.toUpperCase();
              const isChecked = selectedSymbols.includes(sym);
              const oppScore = item.savedReportInfo?.opportunityScore ?? item.heuristicSignal.preliminaryOpportunityScore;

              return (
                <div
                  key={sym}
                  onClick={() => toggleSymbol(sym)}
                  className={cn(
                    "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none",
                    isChecked
                      ? "bg-primary/10 border-primary/50 text-foreground"
                      : "bg-card/30 border-border/40 hover:bg-accent/30 text-muted-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Checkbox checked={isChecked} onCheckedChange={() => toggleSymbol(sym)} />
                    <div className="min-w-0 font-mono">
                      <span className="text-xs font-bold text-foreground block">{sym}</span>
                      <span className="text-[10px] text-muted-foreground truncate block max-w-[120px] font-sans">
                        {item.name || item.sector}
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-mono shrink-0">
                    <span className="text-xs font-bold text-foreground block">${item.currentPrice.toFixed(2)}</span>
                    <span className="text-[10px] text-emerald-400 font-bold">{oppScore} pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="pt-3 flex items-center justify-between gap-2 border-t border-border/50">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting} className="text-xs h-9">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSubmitting || selectedSymbols.length === 0}
            className="text-xs h-9 px-4 font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5" /> Save {selectedSymbols.length} Stocks to Watchlist
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
