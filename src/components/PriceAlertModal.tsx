import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import {
  Bell,
  TrendingUp,
  TrendingDown,
  Loader2,
  Sparkles,
  Search,
  Check,
  Edit2,
  Plus,
  Trash2,
  DollarSign,
  Activity,
  Layers,
  ArrowRight,
  FolderPlus,
  CheckCircle2,
} from 'lucide-react';
import { useCreateAlert, useUpdateAlert, useDeleteAlert, useAlerts, PriceAlert } from '@/services/alertService';
import { useWatchlists, useAddSymbolToWatchlist, useCreateWatchlist } from '@/services/watchlistService';
import { marketDataService } from '@/services/marketData';
import { toast } from 'sonner';

interface PriceAlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSymbol?: string;
  initialPrice?: number;
  initialStockName?: string;
  initialTargetPrice?: number | string;
  initialCondition?: 'ABOVE' | 'BELOW';
  initialNotes?: string;
  editAlert?: PriceAlert | null;
  onSuccess?: () => void;
  currentWatchlistId?: string | null;
}

interface BatchCreatedItem {
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  time: string;
}

export function PriceAlertModal({
  open,
  onOpenChange,
  initialSymbol = '',
  initialPrice = 0,
  initialStockName = '',
  initialTargetPrice,
  initialCondition,
  initialNotes,
  editAlert = null,
  onSuccess,
  currentWatchlistId,
}: PriceAlertModalProps) {
  const [symbol, setSymbol] = useState('');
  const [stockName, setStockName] = useState('');
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0);
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

  // Multi-alert & Continuous Mode
  const [keepOpenMode, setKeepOpenMode] = useState(false);
  const [sessionAlerts, setSessionAlerts] = useState<BatchCreatedItem[]>([]);
  const [lastCreatedNotice, setLastCreatedNotice] = useState<string | null>(null);

  // Asset Search / Selection state
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ symbol: string; name: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const createAlertMutation = useCreateAlert();
  const updateAlertMutation = useUpdateAlert();
  const deleteAlertMutation = useDeleteAlert();

  // Watchlist integration
  const { data: watchlists = [] } = useWatchlists();
  const addSymbolMutation = useAddSymbolToWatchlist();
  const createWatchlistMutation = useCreateWatchlist();
  const [addToWatchlist, setAddToWatchlist] = useState(false);
  const [targetWatchlistId, setTargetWatchlistId] = useState<string>('');
  const [isCreatingWatchlist, setIsCreatingWatchlist] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');

  const cleanSymbol = symbol.trim().toUpperCase();
  const { data: allAlertsData = [], isLoading: isLoadingExistingAlerts } = useAlerts(
    cleanSymbol ? { symbol: cleanSymbol, status: 'ALL' } : undefined
  );

  // Sync target watchlist selection when modal opens or lists change
  useEffect(() => {
    if (open && watchlists.length > 0) {
      if (currentWatchlistId && watchlists.some((w) => w.id === currentWatchlistId)) {
        setTargetWatchlistId(currentWatchlistId);
      } else if (!targetWatchlistId || !watchlists.some((w) => w.id === targetWatchlistId)) {
        const defaultW = watchlists.find((w) => w.isDefault) || watchlists[0];
        if (defaultW) {
          setTargetWatchlistId(defaultW.id);
        }
      }
    }
  }, [open, currentWatchlistId, watchlists, targetWatchlistId]);

  const targetWatchlist = useMemo(() => {
    return watchlists.find((w) => w.id === targetWatchlistId);
  }, [watchlists, targetWatchlistId]);

  const isAlreadyInTargetWatchlist = useMemo(() => {
    if (!cleanSymbol || !targetWatchlist) return false;
    return (targetWatchlist.items || []).some(
      (item) => item.symbol.toUpperCase() === cleanSymbol
    );
  }, [cleanSymbol, targetWatchlist]);

  const watchlistsContainingStock = useMemo(() => {
    if (!cleanSymbol) return [];
    return watchlists.filter((w) =>
      (w.items || []).some((i) => i.symbol.toUpperCase() === cleanSymbol)
    );
  }, [cleanSymbol, watchlists]);

  // Automatically update checkbox state when selected stock or watchlist changes
  useEffect(() => {
    if (cleanSymbol && targetWatchlist) {
      const alreadyThere = (targetWatchlist.items || []).some(
        (item) => item.symbol.toUpperCase() === cleanSymbol
      );
      if (!alreadyThere && !editAlert) {
        setAddToWatchlist(true);
      } else {
        setAddToWatchlist(false);
      }
    }
  }, [cleanSymbol, targetWatchlistId, targetWatchlist, editAlert]);

  const handleDirectAddToWatchlist = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!cleanSymbol) {
      toast.error('Please enter or select a valid stock symbol first.');
      return;
    }
    if (!targetWatchlistId) {
      toast.error('Please select a target watchlist.');
      return;
    }
    try {
      await addSymbolMutation.mutateAsync({
        watchlistId: targetWatchlistId,
        symbol: cleanSymbol,
      });
      toast.success(`Added ${cleanSymbol} to "${targetWatchlist?.name || 'Watchlist'}"!`);
    } catch (err: any) {
      toast.error(`Failed to add to watchlist: ${err.message}`);
    }
  };

  const handleCreateAndSelectWatchlist = async () => {
    const trimmed = newWatchlistName.trim();
    if (!trimmed) return;
    try {
      const created = await createWatchlistMutation.mutateAsync(trimmed);
      setTargetWatchlistId(created.id);
      setIsCreatingWatchlist(false);
      setNewWatchlistName('');
      toast.success(`Created watchlist "${created.name}"`);
    } catch (err: any) {
      toast.error(`Failed to create watchlist: ${err.message}`);
    }
  };

  const existingAlertsForStock = useMemo(() => {
    if (!cleanSymbol) return [];
    return (allAlertsData || []).filter(
      (a) => a.symbol.toUpperCase() === cleanSymbol
    );
  }, [allAlertsData, cleanSymbol]);

  const handleDeleteExistingAlert = async (e: React.MouseEvent, alertId: string, alertTarget: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteAlertMutation.mutateAsync(alertId);
      toast.success(`Removed alert @ $${alertTarget.toFixed(2)} for ${cleanSymbol}`);
    } catch (err: any) {
      toast.error(`Failed to delete alert: ${err.message}`);
    }
  };

  const handleLoadExistingAlert = (alertItem: PriceAlert) => {
    setTargetPrice(alertItem.targetPrice.toString());
    setCondition(alertItem.condition);
    if (alertItem.notes) {
      setNotes(alertItem.notes);
    }
    toast.info(`Loaded target price $${alertItem.targetPrice.toFixed(2)} (${alertItem.condition === 'ABOVE' ? '≥ Higher' : '≤ Lower'})`);
  };

  // Reset state when opening modal
  useEffect(() => {
    if (open) {
      setLastCreatedNotice(null);
      setSessionAlerts([]);

      if (editAlert) {
        // Edit mode
        setSymbol(editAlert.symbol);
        setStockName(editAlert.stockName || editAlert.symbol);
        setCondition(editAlert.condition);
        setTargetPrice(editAlert.targetPrice.toString());
        setNotes(editAlert.notes || '');
        if (editAlert.currentPrice) {
          setCurrentPrice(editAlert.currentPrice);
        }
        fetchPriceForSymbol(editAlert.symbol, true);
      } else {
        // Create mode
        const sym = (initialSymbol || '').toUpperCase();
        setSymbol(sym);
        setStockName(initialStockName || '');
        setNotes(initialNotes || '');
        setCondition(initialCondition || 'ABOVE');
        setSearchQuery('');
        setSuggestions([]);

        if (initialTargetPrice !== undefined && initialTargetPrice !== null && String(initialTargetPrice).trim() !== '') {
          setTargetPrice(String(initialTargetPrice));
          if (initialPrice > 0) {
            setCurrentPrice(initialPrice);
          }
          if (sym) fetchPriceForSymbol(sym, false);
        } else if (initialPrice > 0) {
          setCurrentPrice(initialPrice);
          setTargetPrice((initialPrice * 1.05).toFixed(2));
          if (sym) fetchPriceForSymbol(sym, false);
        } else if (sym) {
          fetchPriceForSymbol(sym, false);
        } else {
          setCurrentPrice(0);
          setTargetPrice('');
        }
      }
    }
  }, [open, initialSymbol, initialPrice, initialStockName, initialTargetPrice, initialCondition, initialNotes, editAlert]);

  // Autocomplete search suggestions
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 1) {
      setSuggestions([]);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await marketDataService.searchSymbols(trimmed);
        if (isMounted) {
          setSuggestions((results || []).slice(0, 6));
        }
      } catch (err) {
        console.warn('Search failed', err);
      } finally {
        if (isMounted) setIsSearching(false);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const fetchPriceForSymbol = async (sym: string, isEditingFlag: boolean) => {
    if (!sym) return;
    setIsLoadingPrice(true);
    try {
      const quote = await marketDataService.getQuote(sym);
      if (quote) {
        if (quote.price) setCurrentPrice(quote.price);
        if (quote.change !== undefined) setPriceChange(quote.change);
        if (quote.changePercent !== undefined) setPriceChangePercent(quote.changePercent);
        if (quote.name) setStockName(quote.name);

        if (!isEditingFlag && quote.price && !targetPrice) {
          setTargetPrice((quote.price * (condition === 'ABOVE' ? 1.05 : 0.95)).toFixed(2));
        }
      }
    } catch (e) {
      console.warn('Failed to fetch quote', e);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const handleSelectSymbol = (sym: string, name?: string) => {
    const clean = sym.toUpperCase().trim();
    setSymbol(clean);
    if (name) setStockName(name);
    setSearchQuery('');
    setSuggestions([]);
    setTargetPrice('');
    fetchPriceForSymbol(clean, false);
  };

  const handleApplyPercentage = (pct: number) => {
    if (!currentPrice || currentPrice <= 0) return;
    const computed = currentPrice * (1 + pct / 100);
    setTargetPrice(computed.toFixed(2));
    if (pct > 0) {
      setCondition('ABOVE');
    } else if (pct < 0) {
      setCondition('BELOW');
    }
  };

  const executeSaveAlert = async (keepOpen: boolean) => {
    const cleanSym = symbol.trim().toUpperCase();
    const numTarget = parseFloat(targetPrice);

    if (!cleanSym) {
      alert('Please select or enter a valid stock symbol.');
      return;
    }
    if (isNaN(numTarget) || numTarget <= 0) {
      alert('Please enter a valid target price greater than $0.');
      return;
    }

    const payload = {
      symbol: cleanSym,
      targetPrice: numTarget,
      condition,
      notes: notes.trim() || undefined,
    };

    // Close modal immediately for instant feedback if not in continuous/keep-open mode
    const shouldCloseNow = !keepOpen && !keepOpenMode;
    if (shouldCloseNow) {
      onOpenChange(false);
    }

    try {
      if (editAlert) {
        // Update alert
        await updateAlertMutation.mutateAsync({
          id: editAlert.id,
          targetPrice: numTarget,
          condition,
          notes: notes.trim() || undefined,
        });
      } else {
        // Create alert
        await createAlertMutation.mutateAsync(payload);

        // Record in batch created list
        setSessionAlerts((prev) => [
          {
            symbol: cleanSym,
            targetPrice: numTarget,
            condition,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          },
          ...prev,
        ]);

        // Auto-add to watchlist if requested and not already present
        let addedToWatchlistName: string | null = null;
        if (addToWatchlist && targetWatchlistId && !isAlreadyInTargetWatchlist) {
          try {
            await addSymbolMutation.mutateAsync({
              watchlistId: targetWatchlistId,
              symbol: cleanSym,
            });
            addedToWatchlistName = targetWatchlist?.name || 'Watchlist';
          } catch (watchErr) {
            console.warn('Auto-add to watchlist failed:', watchErr);
          }
        }

        const successNotice = addedToWatchlistName
          ? `Alert for ${cleanSym} @ $${numTarget.toFixed(2)} created & added to "${addedToWatchlistName}"!`
          : `Alert for ${cleanSym} @ $${numTarget.toFixed(2)} (${condition === 'ABOVE' ? '≥ Higher' : '≤ Lower'}) created!`;

        setLastCreatedNotice(successNotice);
        toast.success(successNotice);

        if (keepOpen || keepOpenMode) {
          // Keep dialog open and prepare for next alert
          setNotes('');
          if (currentPrice > 0) {
            setTargetPrice((currentPrice * (condition === 'ABOVE' ? 0.95 : 1.05)).toFixed(2));
            setCondition(condition === 'ABOVE' ? 'BELOW' : 'ABOVE');
          } else {
            setTargetPrice('');
          }
        }
      }

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Failed to save alert:', err);
      alert(`Failed to save alert: ${err.message}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSaveAlert(keepOpenMode);
  };

  const numTarget = parseFloat(targetPrice);
  const distancePct =
    currentPrice > 0 && !isNaN(numTarget)
      ? (((numTarget - currentPrice) / currentPrice) * 100).toFixed(2)
      : null;

  const isEditing = Boolean(editAlert);
  const isPending = createAlertMutation.isPending || updateAlertMutation.isPending || addSymbolMutation.isPending;
  const isPositiveChange = priceChangePercent >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                {isEditing ? <Edit2 className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  {isEditing ? `Edit Alert: ${symbol}` : 'Set Price Alert'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {isEditing
                    ? `Update target price level or notes for ${symbol}.`
                    : 'Set single or multiple price triggers with live market prices.'}
                </DialogDescription>
              </div>
            </div>

            {!isEditing && (
              <div className="flex items-center gap-1.5 bg-card/60 border border-border/80 rounded-xl px-2.5 py-1">
                <span className="text-[11px] text-muted-foreground font-medium">Keep open</span>
                <Switch
                  checked={keepOpenMode}
                  onCheckedChange={setKeepOpenMode}
                  className="scale-75 data-[state=checked]:bg-primary"
                />
              </div>
            )}
          </div>
        </DialogHeader>

        {/* In-Dialog Flash Feedback Notice */}
        {lastCreatedNotice && (
          <div className="bg-success/15 border border-success/30 rounded-xl p-2.5 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-success">
              <Check className="w-4 h-4 text-success" />
              <span>{lastCreatedNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setLastCreatedNotice(null)}
              className="text-xs text-success/80 hover:text-success"
            >
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Asset Selection (Search Box or Prominent Selected Asset Banner) */}
          {!symbol || (!isEditing && !initialSymbol && !symbol) ? (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Select Stock / Asset</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Type ticker symbol (e.g. AAPL, NVDA, TSLA, ORA)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      e.preventDefault();
                      handleSelectSymbol(searchQuery.trim());
                    }
                  }}
                  className="pl-9 pr-10 h-10 text-xs bg-card border-border"
                  autoFocus
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                )}
              </div>

              {/* Suggestions Dropdown */}
              {suggestions.length > 0 && (
                <div className="border border-primary/20 rounded-xl bg-popover shadow-xl overflow-hidden p-1 space-y-0.5">
                  {suggestions.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      onClick={() => handleSelectSymbol(item.symbol, item.name)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-xs rounded-lg hover:bg-primary/10 transition-colors"
                    >
                      <span className="font-mono font-bold text-foreground">{item.symbol}</span>
                      <span className="text-muted-foreground truncate max-w-[200px]">{item.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Quick Popular Ticker Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                  <Sparkles className="w-3 h-3 text-primary" /> Popular:
                </span>
                {['AAPL', 'NVDA', 'TSLA', 'MSFT', 'ORA', 'AMZN', 'PLTR', 'FSLR'].map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleSelectSymbol(sym)}
                    className="text-[11px] px-2 py-0.5 rounded-md border border-border/80 bg-card hover:bg-primary/15 hover:border-primary/40 font-mono text-foreground transition-colors"
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Selected Asset Banner with Prominent Actual Price */
            <div className="p-3.5 rounded-2xl bg-card/80 border border-primary/20 shadow-inner flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center font-mono font-black text-sm text-primary shrink-0">
                  {symbol.slice(0, 4)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-mono font-black text-foreground">{symbol}</span>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setSymbol('');
                          setCurrentPrice(0);
                          setPriceChange(0);
                          setPriceChangePercent(0);
                          setTargetPrice('');
                        }}
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        Change Asset
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-[190px]">
                    {stockName || symbol}
                  </p>
                </div>
              </div>

              {/* Actual Live Price Display */}
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center justify-end gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  Live Market Price
                </span>
                <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
                  <span className="text-xl font-mono font-black text-foreground">
                    {isLoadingPrice ? (
                      <Loader2 className="w-4 h-4 animate-spin inline text-primary" />
                    ) : currentPrice > 0 ? (
                      `$${currentPrice.toFixed(2)}`
                    ) : (
                      'N/A'
                    )}
                  </span>
                </div>
                {priceChangePercent !== 0 && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0 font-mono font-bold mt-0.5",
                      isPositiveChange
                        ? "bg-success/10 text-success border-success/30"
                        : "bg-destructive/10 text-destructive border-destructive/30"
                    )}
                  >
                    {isPositiveChange ? <TrendingUp className="w-2.5 h-2.5 mr-0.5 inline" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5 inline" />}
                    {isPositiveChange ? '+' : ''}{priceChangePercent.toFixed(2)}% (${isPositiveChange ? '+' : ''}{priceChange.toFixed(2)})
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Alerts Already Set for this Stock */}
          {cleanSymbol && (
            <div className="rounded-2xl border border-border/70 bg-card/60 p-3.5 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
                    <Bell className="w-3 h-3" />
                  </div>
                  <span className="text-xs font-bold text-foreground">
                    Alerts Already Set for {cleanSymbol}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono font-bold bg-primary/10 text-primary border-primary/30 px-1.5 py-0"
                  >
                    {existingAlertsForStock.length}
                  </Badge>
                </div>
                {isLoadingExistingAlerts && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    <span>Checking alerts...</span>
                  </div>
                )}
              </div>

              {isLoadingExistingAlerts && existingAlertsForStock.length === 0 ? (
                <div className="py-2.5 flex items-center justify-center text-xs text-muted-foreground gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>Loading alerts for {cleanSymbol}...</span>
                </div>
              ) : existingAlertsForStock.length === 0 ? (
                <div className="py-2.5 px-3 rounded-xl bg-muted/20 border border-border/40 text-[11px] text-muted-foreground flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                  <span>No alerts currently set for <strong className="text-foreground">{cleanSymbol}</strong>. Create your first trigger below!</span>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {existingAlertsForStock.map((a) => {
                    const isBeingEdited = editAlert?.id === a.id;
                    const diffPct =
                      currentPrice > 0
                        ? (((a.targetPrice - currentPrice) / currentPrice) * 100).toFixed(1)
                        : null;

                    return (
                      <div
                        key={a.id}
                        className={cn(
                          "flex items-center justify-between p-2 sm:p-2.5 rounded-xl border text-xs transition-all",
                          isBeingEdited
                            ? "bg-primary/10 border-primary/40 shadow-sm"
                            : "bg-card/90 border-border/60 hover:border-border hover:bg-card"
                        )}
                      >
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          {/* Condition & Target */}
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-mono font-bold text-[11px] px-2 py-0.5",
                              a.condition === 'ABOVE'
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            )}
                          >
                            {a.condition === 'ABOVE' ? (
                              <TrendingUp className="w-3 h-3 mr-1 inline text-emerald-400" />
                            ) : (
                              <TrendingDown className="w-3 h-3 mr-1 inline text-rose-400" />
                            )}
                            {a.condition === 'ABOVE' ? '≥' : '≤'} ${a.targetPrice.toFixed(2)}
                          </Badge>

                          {/* Distance */}
                          {diffPct !== null && (
                            <span
                              className={cn(
                                "font-mono font-semibold text-[10px]",
                                parseFloat(diffPct) >= 0 ? "text-emerald-400/90" : "text-rose-400/90"
                              )}
                            >
                              ({parseFloat(diffPct) >= 0 ? '+' : ''}{diffPct}%)
                            </span>
                          )}

                          {/* Status Badge */}
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] uppercase px-1.5 py-0 font-bold",
                              a.status === 'ACTIVE'
                                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                                : a.status === 'TRIGGERED'
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                : "bg-muted text-muted-foreground border-border/40"
                            )}
                          >
                            {a.status}
                          </Badge>

                          {/* Note if any */}
                          {a.notes && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px] sm:max-w-[150px] italic">
                              "{a.notes}"
                            </span>
                          )}

                          {isBeingEdited && (
                            <Badge className="bg-primary/20 text-primary border-primary/40 text-[9px] font-semibold px-1 py-0">
                              Editing Now
                            </Badge>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLoadExistingAlert(a)}
                            title="Load this target price into input"
                            className="h-6 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                          >
                            <span>Use</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </Button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteExistingAlert(e, a.id, a.targetPrice)}
                            title="Delete this alert"
                            className="p-1 rounded-lg text-muted-foreground/70 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Condition Selectors (Higher / Lower) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Alert Condition</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCondition('ABOVE');
                  if (currentPrice > 0 && (!targetPrice || parseFloat(targetPrice) <= currentPrice)) {
                    setTargetPrice((currentPrice * 1.05).toFixed(2));
                  }
                }}
                className={cn(
                  "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all",
                  condition === 'ABOVE'
                    ? "bg-success/15 border-success text-success shadow-[0_0_12px_rgba(34,197,94,0.2)]"
                    : "bg-card/50 border-border text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                )}
              >
                <TrendingUp className="w-4 h-4 text-success" />
                Price Rises Above (≥)
              </button>

              <button
                type="button"
                onClick={() => {
                  setCondition('BELOW');
                  if (currentPrice > 0 && (!targetPrice || parseFloat(targetPrice) >= currentPrice)) {
                    setTargetPrice((currentPrice * 0.95).toFixed(2));
                  }
                }}
                className={cn(
                  "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all",
                  condition === 'BELOW'
                    ? "bg-destructive/15 border-destructive text-destructive shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                    : "bg-card/50 border-border text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                )}
              >
                <TrendingDown className="w-4 h-4 text-destructive" />
                Price Drops Below (≤)
              </button>
            </div>
          </div>

          {/* Target Price Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Target Price ($ USD)</Label>
              {distancePct !== null && (
                <span
                  className={cn(
                    "text-xs font-mono font-bold",
                    parseFloat(distancePct) >= 0 ? "text-success" : "text-destructive"
                  )}
                >
                  {parseFloat(distancePct) >= 0 ? '+' : ''}{distancePct}% from current
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-muted-foreground text-base">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="pl-8 h-11 text-base font-mono font-bold bg-card border-border"
                required
              />
            </div>
          </div>

          {/* Quick Percentage Bump Shortcuts */}
          {currentPrice > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3 text-primary" /> Quick Percentage Presets:
              </span>
              <div className="grid grid-cols-6 gap-1.5">
                {condition === 'ABOVE' ? (
                  <>
                    {[1, 2, 5, 10, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleApplyPercentage(pct)}
                        className="py-1 px-1.5 rounded-lg border border-border/80 bg-card hover:bg-success/15 hover:border-success/40 text-[11px] font-mono font-semibold text-foreground transition-colors text-center"
                      >
                        +{pct}%
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {[-1, -2, -5, -10, -15, -20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleApplyPercentage(pct)}
                        className="py-1 px-1.5 rounded-lg border border-border/80 bg-card hover:bg-destructive/15 hover:border-destructive/40 text-[11px] font-mono font-semibold text-foreground transition-colors text-center"
                      >
                        {pct}%
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Optional Note */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Alert Note (Optional)</Label>
            <Input
              placeholder="e.g. Take profit target, Breakout above resistance, Dip buy..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9 text-xs bg-card border-border"
            />
          </div>

          {/* Watchlist Integration Option */}
          {cleanSymbol && (
            <div className="rounded-2xl border border-border/80 bg-card/50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
                    <FolderPlus className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground">Add to Watchlist</span>
                    <p className="text-[10px] text-muted-foreground">
                      Include {cleanSymbol} in a watchlist
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAlreadyInTargetWatchlist ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-success/15 text-success border-success/30 font-semibold gap-1 py-0.5 px-2"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Already in Watchlist
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="add-to-watchlist-switch" className="text-[11px] text-muted-foreground cursor-pointer">
                        Add to list
                      </Label>
                      <Switch
                        id="add-to-watchlist-switch"
                        checked={addToWatchlist}
                        onCheckedChange={setAddToWatchlist}
                        className="data-[state=checked]:bg-primary scale-90"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Watchlist selection dropdown & quick actions */}
              <div className="space-y-2 pt-0.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <select
                      id="target-watchlist-select"
                      aria-label="Select target watchlist"
                      value={targetWatchlistId}
                      onChange={(e) => {
                        if (e.target.value === '__CREATE_NEW__') {
                          setIsCreatingWatchlist(true);
                        } else {
                          setTargetWatchlistId(e.target.value);
                        }
                      }}
                      className="w-full h-8 text-xs rounded-lg bg-background border border-border/80 px-2.5 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                    >
                      {watchlists.map((w) => {
                        const hasStock = (w.items || []).some(
                          (i) => i.symbol.toUpperCase() === cleanSymbol
                        );
                        return (
                          <option key={w.id} value={w.id}>
                            {w.name} {w.isDefault ? '(Default)' : ''} {hasStock ? '✓ (Already Added)' : ''}
                          </option>
                        );
                      })}
                      <option value="__CREATE_NEW__">+ Create New Watchlist...</option>
                    </select>
                  </div>

                  {!isAlreadyInTargetWatchlist && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={addSymbolMutation.isPending || !cleanSymbol || !targetWatchlistId}
                      onClick={handleDirectAddToWatchlist}
                      className="h-8 text-xs gap-1 font-semibold border-primary/30 hover:bg-primary/10 text-primary shrink-0"
                      title="Add to selected watchlist right now without waiting to submit alert"
                    >
                      {addSymbolMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      <span>Add Now</span>
                    </Button>
                  )}
                </div>

                {/* New Watchlist Inline Creator */}
                {isCreatingWatchlist && (
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-accent/30 border border-border animate-in fade-in">
                    <Input
                      placeholder="New watchlist name..."
                      value={newWatchlistName}
                      onChange={(e) => setNewWatchlistName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateAndSelectWatchlist();
                        }
                      }}
                      className="h-7 text-xs bg-background"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={createWatchlistMutation.isPending || !newWatchlistName.trim()}
                      onClick={handleCreateAndSelectWatchlist}
                      className="h-7 px-2.5 text-xs bg-primary text-primary-foreground font-semibold"
                    >
                      {createWatchlistMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Create'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsCreatingWatchlist(false);
                        setNewWatchlistName('');
                      }}
                      className="h-7 px-2 text-xs text-muted-foreground"
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                {/* Watchlists containing this stock badges */}
                {watchlistsContainingStock.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground pt-0.5">
                    <span className="font-medium">Currently in:</span>
                    {watchlistsContainingStock.map((w) => (
                      <Badge
                        key={w.id}
                        variant="secondary"
                        className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary border border-primary/20 font-medium"
                      >
                        {w.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Session Added Alerts History Chips (Batch Mode) */}
          {sessionAlerts.length > 0 && (
            <div className="pt-2 border-t border-border/60 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3 text-primary" /> Created in this session ({sessionAlerts.length}):
              </span>
              <div className="flex items-center gap-1.5 flex-wrap max-h-20 overflow-y-auto">
                {sessionAlerts.map((item, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-[11px] font-mono py-0.5 px-2 bg-card border-primary/20 flex items-center gap-1"
                  >
                    <span className="font-bold text-foreground">{item.symbol}</span>
                    <span className={item.condition === 'ABOVE' ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                      {item.condition === 'ABOVE' ? '≥' : '≤'} ${item.targetPrice.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-muted-foreground">({item.time})</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Dialog Action Buttons */}
          <DialogFooter className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              {sessionAlerts.length > 0 ? 'Done / Close' : 'Cancel'}
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending || !targetPrice || !symbol}
                  onClick={() => executeSaveAlert(true)}
                  className="text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 w-full sm:w-auto"
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Add & Create Another
                    </>
                  )}
                </Button>
              )}

              <Button
                type="submit"
                variant="glow"
                size="sm"
                disabled={isPending || !targetPrice || !symbol}
                className="bg-primary text-primary-foreground font-semibold gap-1.5 text-xs w-full sm:w-auto"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isEditing ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    {keepOpenMode ? 'Add Alert' : 'Set Alert & Close'}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
