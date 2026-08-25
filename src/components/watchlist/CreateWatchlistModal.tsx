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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBulkCreateWatchlist, useCreateWatchlist } from '@/services/watchlistService';
import { toast } from 'sonner';

interface CreateWatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatedSuccess?: (newWatchlistId: string) => void;
  onOpenBulkAlerts?: () => void;
}

const PRESET_IDEAS = [
  { name: 'AI & Data Infrastructure', tickers: 'NVDA, PLTR, TSM, AMD, MSFT, AVGO, MRVL' },
  { name: 'Cybersecurity Leaders', tickers: 'CRWD, PANW, FTNT, ZS, NET, CYBR' },
  { name: 'Nuclear & Clean Energy', tickers: 'CCJ, SMR, URA, CEG, VST, ORA' },
  { name: 'Dividend & Cash Compounders', tickers: 'AAPL, MSFT, BRK-B, JNJ, PG, KO, V' },
];

export function CreateWatchlistModal({
  isOpen,
  onClose,
  onCreatedSuccess,
  onOpenBulkAlerts,
}: CreateWatchlistModalProps) {
  const [name, setName] = useState('');
  const [tickersText, setTickersText] = useState('');
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

  const handleApplyPreset = (preset: typeof PRESET_IDEAS[0]) => {
    setName(preset.name);
    setTickersText(preset.tickers);
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
        onCreatedSuccess?.(created.id);
        onClose();
      } else {
        const created = await createSingleMutation.mutateAsync(trimmedName);
        toast.success(`Created empty watchlist "${created.name}"!`);
        setName('');
        setTickersText('');
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
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-accent/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-black shadow-inner">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black tracking-tight text-foreground">
                Create New Watchlist
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Type a name and paste or type all tickers in bulk to populate instantly.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Watchlist Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Watchlist Name</label>
            <Input
              placeholder="e.g. AI & Semis, Uranium Core, Swing Watch"
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

          {/* Tickers Input Box */}
          <div className="space-y-1.5">
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
              rows={4}
              className="bg-background/60 border-border/60 focus:border-primary font-mono text-xs uppercase resize-none leading-relaxed p-3"
            />
            <p className="text-[11px] text-muted-foreground">
              Tip: You can paste a comma-separated list or full multi-line column from Excel/TradingView.
            </p>
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

          {/* Quick Presets */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Quick Theme Starter Templates
            </span>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_IDEAS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="p-2 rounded-xl bg-card/60 hover:bg-accent/60 border border-border/40 hover:border-border/80 text-left transition-colors group"
                >
                  <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    {preset.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                    {preset.tickers}
                  </p>
                </button>
              ))}
            </div>
          </div>
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
