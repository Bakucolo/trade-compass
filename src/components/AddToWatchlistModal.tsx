import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FolderPlus, Plus, Check, Loader2, Bookmark, Layers } from 'lucide-react';
import {
  useWatchlists,
  useAddSymbolToWatchlist,
  useCreateWatchlist,
} from '@/services/watchlistService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getCompanyStyleAndThemes, STYLE_CONFIG } from '@/services/stockThematics';

interface AddToWatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  companyName?: string;
  defaultWatchlistId?: string | null;
  onSuccess?: (watchlistId: string, watchlistName: string) => void;
}

export function AddToWatchlistModal({
  isOpen,
  onClose,
  symbol,
  companyName,
  defaultWatchlistId,
  onSuccess,
}: AddToWatchlistModalProps) {
  const cleanSymbol = (symbol || '').trim().toUpperCase();
  const { data: watchlists = [], isLoading: isWatchlistsLoading } = useWatchlists();
  const addSymbolMutation = useAddSymbolToWatchlist();
  const createWatchlistMutation = useCreateWatchlist();

  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string>(() => {
    return defaultWatchlistId || '';
  });

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const thematics = getCompanyStyleAndThemes(cleanSymbol, companyName);
  const styleConfig = STYLE_CONFIG[thematics.style] || STYLE_CONFIG.Growth;

  const handleAdd = async () => {
    if (!cleanSymbol) return;

    let targetWatchlistId = selectedWatchlistId;
    let targetWatchlistName = '';

    setIsSubmitting(true);
    try {
      // 1. If creating a new watchlist first
      if (isCreatingNew && newWatchlistName.trim()) {
        const created = await createWatchlistMutation.mutateAsync(newWatchlistName.trim());
        targetWatchlistId = created.id;
        targetWatchlistName = created.name;
      } else {
        const found = watchlists.find((w) => w.id === targetWatchlistId) || watchlists[0];
        targetWatchlistId = found?.id;
        targetWatchlistName = found?.name || 'Watchlist';
      }

      if (!targetWatchlistId) {
        toast.error('Please select or create a watchlist.');
        setIsSubmitting(false);
        return;
      }

      // 2. Add symbol to selected watchlist
      await addSymbolMutation.mutateAsync({
        watchlistId: targetWatchlistId,
        symbol: cleanSymbol,
      });

      toast.success(`Added ${cleanSymbol} to "${targetWatchlistName}"!`, {
        description: `${companyName || cleanSymbol} is now actively tracked in your watchlist.`,
      });

      if (onSuccess) {
        onSuccess(targetWatchlistId, targetWatchlistName);
      }

      setIsCreatingNew(false);
      setNewWatchlistName('');
      onClose();
    } catch (err: any) {
      toast.error(`Failed to add ${cleanSymbol}: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px] bg-slate-950 border border-slate-800 text-foreground p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Add to Watchlist
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Track {cleanSymbol} across custom focus watchlists
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Stock Badge Summary */}
        <div className="p-3 rounded-xl bg-card/40 border border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-mono font-bold text-xs text-cyan-400">
              {cleanSymbol.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-sm text-foreground">{cleanSymbol}</span>
                <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-bold border", styleConfig.badgeClass)}>
                  {thematics.style}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                {companyName || thematics.sector || 'Equities'}
              </p>
            </div>
          </div>
          {thematics.primaryTheme && (
            <Badge variant="outline" className="text-[9px] px-2 py-0.5 border-white/10 text-muted-foreground">
              {thematics.primaryTheme}
            </Badge>
          )}
        </div>

        {/* Watchlist Picker */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Select Watchlist:
            </label>
            <button
              type="button"
              onClick={() => setIsCreatingNew(!isCreatingNew)}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              {isCreatingNew ? 'Choose Existing' : 'New Watchlist'}
            </button>
          </div>

          {!isCreatingNew ? (
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
              {isWatchlistsLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading watchlists...
                </div>
              ) : watchlists.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-xl">
                  No watchlists created yet. Create your first one below!
                </div>
              ) : (
                watchlists.map((w) => {
                  const isSelected = (selectedWatchlistId || watchlists[0]?.id) === w.id;
                  const alreadyContains = w.items?.some((i) => i.symbol?.toUpperCase() === cleanSymbol);

                  return (
                    <div
                      key={w.id}
                      onClick={() => setSelectedWatchlistId(w.id)}
                      className={cn(
                        "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between",
                        isSelected
                          ? "bg-primary/20 border-primary text-foreground shadow-sm ring-1 ring-primary/40"
                          : "bg-card/30 border-border/40 hover:bg-accent/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📁</span>
                        <span className="font-semibold text-xs text-foreground">
                          {w.name} {w.isDefault && <span className="text-[10px] text-muted-foreground">(Default)</span>}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {alreadyContains && (
                          <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                            Already added
                          </Badge>
                        )}
                        <span className="font-mono text-[11px] opacity-70">
                          {w.items?.length || 0} stocks
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/60 space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
                New Watchlist Name:
              </label>
              <Input
                placeholder="e.g. AI & Semis, Dividend Champions, Space..."
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                autoFocus
                className="h-9 text-xs bg-slate-950 border-slate-700"
              />
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs h-9"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={isSubmitting || (!isCreatingNew && watchlists.length === 0)}
            className="text-xs h-9 px-4 font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding...
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" /> Add {cleanSymbol}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
