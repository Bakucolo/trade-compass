import { useState, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  FolderPlus,
  Layers,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  X,
  TrendingUp,
  Cpu,
  Flame,
  Globe,
  Award,
  Building2,
  Atom,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBulkCreateWatchlist, useCreateWatchlist } from '@/services/watchlistService';
import { CRITERIA_CATALOG } from './PopulateByCriteriaModal';
import { toast } from 'sonner';

interface CreateWatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatedSuccess?: (newWatchlistId: string) => void;
  onOpenBulkAlerts?: () => void;
  onOpenCriteriaModal?: () => void;
}

export function CreateWatchlistModal({
  isOpen,
  onClose,
  onCreatedSuccess,
  onOpenBulkAlerts,
  onOpenCriteriaModal,
}: CreateWatchlistModalProps) {
  const [name, setName] = useState('');
  const [tickersText, setTickersText] = useState('');
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<string[]>([]);
  const bulkCreateMutation = useBulkCreateWatchlist();
  const createSingleMutation = useCreateWatchlist();

  // Extract clean distinct tickers from freeform input
  const parsedTickers = useMemo(() => {
    if (!tickersText.trim()) return [];
    const tokens = tickersText
      .split(/[\s,;\n\r\t]+/)
      .map((t) => t.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, ''))
      .filter((t) => t.length >= 1 && t.length <= 8);

    // Deduplicate preserving order
    return Array.from(new Set(tokens));
  }, [tickersText]);

  const handleApplyCriteria = (crit: typeof CRITERIA_CATALOG[0]) => {
    if (!name) {
      setName(crit.name);
    } else if (!name.includes(crit.name.split('&')[0].trim())) {
      setName((prev) => `${prev} + ${crit.name.split('&')[0].trim()}`);
    }

    // Append tickers
    const currentTickers = new Set(parsedTickers);
    crit.tickers.forEach((t) => currentTickers.add(t));
    setTickersText(Array.from(currentTickers).join(', '));
    
    if (!selectedCriteriaIds.includes(crit.id)) {
      setSelectedCriteriaIds((prev) => [...prev, crit.id]);
    }
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Please enter a name for the watchlist.');
      return;
    }

    try {
      if (parsedTickers.length > 0) {
        const created = await bulkCreateMutation.mutateAsync({
          name: trimmedName,
          symbols: parsedTickers,
        });

        toast.success(`Created watchlist "${created.name}" with ${parsedTickers.length} ticker(s)!`, {
          description: `Populated: ${parsedTickers.slice(0, 6).join(', ')}${parsedTickers.length > 6 ? ` and ${parsedTickers.length - 6} more` : ''}`,
        });

        setName('');
        setTickersText('');
        setSelectedCriteriaIds([]);
        onCreatedSuccess?.(created.id);
        onClose();
      } else {
        const created = await createSingleMutation.mutateAsync(trimmedName);
        toast.success(`Created empty watchlist "${created.name}"!`);
        setName('');
        setTickersText('');
        setSelectedCriteriaIds([]);
        onCreatedSuccess?.(created.id);
        onClose();
      }
    } catch (err: any) {
      toast.error(`Failed to create watchlist: ${err.message}`);
    }
  };

  const isPending = bulkCreateMutation.isPending || createSingleMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px] p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-accent/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-black shadow-inner">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                  <span>Create New Watchlist</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Type a name and paste tickers, or click criteria & themes below to auto-populate.
                </DialogDescription>
              </div>
            </div>

            {onOpenCriteriaModal && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenCriteriaModal();
                }}
                className="h-8 text-xs font-bold gap-1.5 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Criteria Generator</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Watchlist Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Watchlist Name</label>
            <Input
              placeholder="e.g. AI & Semis, Uranium Core, Dividend Aristocrats"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 text-sm bg-background/60 border-border/60 focus:border-primary font-semibold"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && name.trim()) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>

          {/* Quick Criteria & Themes Chips */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Quick Criteria, Themes & Asset Classes
              </span>
              {onOpenCriteriaModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCriteriaModal();
                  }}
                  className="text-[11px] text-primary hover:underline font-bold"
                >
                  View All Criteria ({CRITERIA_CATALOG.length}) →
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CRITERIA_CATALOG.slice(0, 9).map((crit) => {
                const isSelected = selectedCriteriaIds.includes(crit.id);
                const Icon = crit.icon;
                return (
                  <button
                    key={crit.id}
                    type="button"
                    onClick={() => handleApplyCriteria(crit)}
                    className={cn(
                      "p-2 rounded-xl border text-left transition-all flex items-start gap-2",
                      isSelected
                        ? "bg-primary/20 border-primary/50 text-primary shadow-sm"
                        : "bg-card/60 hover:bg-accent/60 border-border/40 hover:border-border/80"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">
                        {crit.name}
                      </p>
                      <p className="text-[9.5px] text-muted-foreground font-mono truncate">
                        {crit.tickers.slice(0, 3).join(', ')}... ({crit.tickers.length})
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tickers Input Box */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">
                Tickers / Stocks to Add <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>
              {parsedTickers.length > 0 && (
                <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/30 bg-primary/10">
                  {parsedTickers.length} Detected
                </Badge>
              )}
            </div>

            <Textarea
              placeholder="Type or paste tickers separated by comma, space or new lines (e.g. NVDA, PLTR, AAPL, TSLA, MSFT, AMD)..."
              value={tickersText}
              onChange={(e) => setTickersText(e.target.value)}
              rows={3}
              className="bg-background/60 border-border/60 focus:border-primary font-mono text-xs uppercase resize-none leading-relaxed p-3"
            />
          </div>

          {/* Detected Tickers Chips Preview */}
          {parsedTickers.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-900/60 border border-border/40 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block font-sans">
                Tickers that will be added ({parsedTickers.length})
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {parsedTickers.map((t) => (
                  <span
                    key={t}
                    className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-primary/15 text-primary border border-primary/30 flex items-center gap-1"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/50 bg-accent/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {onOpenBulkAlerts ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenBulkAlerts();
              }}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Need to set price alerts too? Use Bulk Import & Alerts</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>

            <Button
              onClick={handleCreate}
              disabled={isPending || !name.trim()}
              className="bg-primary text-primary-foreground font-bold text-xs shadow-md gap-1.5 px-4"
            >
              {isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</>
              ) : (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Create Watchlist {parsedTickers.length > 0 ? `(${parsedTickers.length} Tickers)` : ''}</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
