import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingDown,
  TrendingUp,
  Loader2,
  Sparkles,
  FileText,
  ArrowRight,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  ExternalLink,
  Plus,
  Trash2,
  Check,
  X,
  BookmarkPlus
} from 'lucide-react';
import {
  useWatchlists,
  useWatchlistData,
  useAddSymbolToWatchlist,
  useRemoveSymbolFromWatchlist,
} from '@/services/watchlistService';
import { marketDataService } from '@/services/marketData';
import { useStockNotesMap } from '@/services/noteService';
import { getCompanyStyleAndThemes, STYLE_CONFIG, getThemeBadgeStyle } from '@/services/stockThematics';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { AddToWatchlistModal } from './AddToWatchlistModal';
import { toast } from 'sonner';

interface WatchlistCardProps {
  onNavigateToWatchlist?: () => void;
  onNavigateToResearch?: (symbol: string) => void;
}

export function WatchlistCard({ onNavigateToWatchlist, onNavigateToResearch }: WatchlistCardProps) {
  const { data: watchlists = [], isLoading: isWatchlistsLoading } = useWatchlists();
  
  // Persisted selected watchlist ID in local storage
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(() => {
    return localStorage.getItem('dashboard_selected_watchlist') || null;
  });

  const [searchFilter, setSearchFilter] = useState('');
  const [isAddMode, setIsAddMode] = useState(false);
  const [newSymbolInput, setNewSymbolInput] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ symbol: string; name: string; exchange?: string }>>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Mutations
  const addSymbolMutation = useAddSymbolToWatchlist();
  const removeSymbolMutation = useRemoveSymbolFromWatchlist();

  // Auto-select valid watchlist if current selection is invalid or null
  useEffect(() => {
    if (watchlists.length > 0) {
      if (!selectedWatchlistId || !watchlists.some((w) => w.id === selectedWatchlistId)) {
        const defaultW = watchlists.find((w) => w.isDefault) || watchlists[0];
        setSelectedWatchlistId(defaultW.id);
        localStorage.setItem('dashboard_selected_watchlist', defaultW.id);
      }
    }
  }, [watchlists, selectedWatchlistId]);

  const handleSelectWatchlist = (id: string) => {
    setSelectedWatchlistId(id);
    localStorage.setItem('dashboard_selected_watchlist', id);
  };

  const activeWatchlist = watchlists.find((w) => w.id === selectedWatchlistId) || watchlists[0];
  const { data: activeData, isLoading: isDataLoading } = useWatchlistData(activeWatchlist?.id);
  const { notesMap } = useStockNotesMap();

  const rawItems = activeData?.items || [];
  const isLoading = isWatchlistsLoading || isDataLoading;

  // Filter items by mini search query
  const items = useMemo(() => {
    if (!searchFilter.trim()) return rawItems;
    const q = searchFilter.toLowerCase().trim();
    return rawItems.filter((item) =>
      item.symbol.toLowerCase().includes(q) ||
      (item.name && item.name.toLowerCase().includes(q))
    );
  }, [rawItems, searchFilter]);

  // Index of active watchlist for next/prev navigation
  const currentIndex = watchlists.findIndex((w) => w.id === activeWatchlist?.id);

  const handlePrevWatchlist = () => {
    if (watchlists.length <= 1) return;
    const prevIdx = (currentIndex - 1 + watchlists.length) % watchlists.length;
    handleSelectWatchlist(watchlists[prevIdx].id);
  };

  const handleNextWatchlist = () => {
    if (watchlists.length <= 1) return;
    const nextIdx = (currentIndex + 1) % watchlists.length;
    handleSelectWatchlist(watchlists[nextIdx].id);
  };

  // Live autocomplete search for adding new ticker
  useEffect(() => {
    const query = newSymbolInput.trim();
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const results = await marketDataService.searchSymbols(query);
        if (isMounted) {
          setSuggestions((results || []).slice(0, 6));
        }
      } catch (err) {
        console.warn('Live ticker search failed', err);
      } finally {
        if (isMounted) setIsSearchingSuggestions(false);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [newSymbolInput]);

  // Focus input when add mode is opened
  useEffect(() => {
    if (isAddMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddMode]);

  // Add ticker to active watchlist
  const handleAddSymbol = async (symbolToAdd?: string) => {
    const sym = (symbolToAdd || newSymbolInput).trim().toUpperCase();
    if (!sym || !activeWatchlist?.id) return;

    setIsAdding(true);
    try {
      await addSymbolMutation.mutateAsync({
        watchlistId: activeWatchlist.id,
        symbol: sym,
      });

      toast.success(`Added ${sym} to ${activeWatchlist.name}`, {
        description: 'Quote data and analytics synced successfully.',
      });

      setNewSymbolInput('');
      setSuggestions([]);
      setIsAddMode(false);
    } catch (err: any) {
      toast.error(`Failed to add ${sym}: ${err.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  // Remove ticker from active watchlist
  const handleRemoveSymbol = async (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    if (!activeWatchlist?.id) return;

    try {
      await removeSymbolMutation.mutateAsync({
        watchlistId: activeWatchlist.id,
        symbol,
      });

      toast.info(`Removed ${symbol} from ${activeWatchlist.name}`);
    } catch (err: any) {
      toast.error(`Failed to remove ${symbol}: ${err.message}`);
    }
  };

  const handleRowClick = (symbol: string) => {
    if (onNavigateToResearch) {
      onNavigateToResearch(symbol);
    } else {
      window.dispatchEvent(new CustomEvent('select-research-ticker', { detail: symbol }));
    }
  };

  return (
    <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden">
      {/* Header with Watchlist Switcher & Quick Add Button */}
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-accent/10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center border bg-primary/10 text-primary border-primary/30">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-foreground">
                  Watchlists Radar
                </CardTitle>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-mono font-bold px-1.5 py-0">
                  {rawItems.length} Stocks
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Real-time tracking across custom focus lists
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-1.5">
            {/* Quick Add Ticker Toggle */}
            <Button
              variant={isAddMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsAddMode((prev) => !prev)}
              className={cn(
                'h-8 text-xs gap-1.5 px-2.5 font-semibold transition-all',
                isAddMode
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border-primary/40 text-primary bg-primary/5 hover:bg-primary/20'
              )}
              title="Add ticker directly to this watchlist"
            >
              {isAddMode ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{isAddMode ? 'Close' : 'Add Ticker'}</span>
            </Button>

            {/* Action Link to Full Watchlist Page */}
            {onNavigateToWatchlist && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateToWatchlist}
                className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2 font-medium"
                title="Open full Watchlists page"
              >
                <span>Full View</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Watchlist Switcher Bar & Prev/Next Controls */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Watchlist Dropdown Selector */}
          <div className="relative flex-1">
            <select
              value={activeWatchlist?.id || ''}
              onChange={(e) => handleSelectWatchlist(e.target.value)}
              className="w-full h-8 text-xs font-semibold bg-slate-900/90 text-foreground border border-border/70 rounded-xl px-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer transition-colors appearance-none"
            >
              {watchlists.map((w) => (
                <option key={w.id} value={w.id} className="bg-slate-900 text-foreground py-1">
                  📁 {w.name} {w.isDefault ? '(Default)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>

          {/* Quick Prev / Next Buttons */}
          {watchlists.length > 1 && (
            <div className="flex items-center gap-0.5 bg-slate-900/80 border border-border/60 rounded-xl p-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevWatchlist}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                title="Previous Watchlist"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-[10px] font-mono text-muted-foreground px-1">
                {currentIndex + 1}/{watchlists.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextWatchlist}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                title="Next Watchlist"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Quick Horizontal Watchlist Pills (If ≤ 5 watchlists) */}
        {watchlists.length > 1 && watchlists.length <= 5 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {watchlists.map((w) => {
              const isSelected = w.id === activeWatchlist?.id;
              return (
                <button
                  key={w.id}
                  onClick={() => handleSelectWatchlist(w.id)}
                  className={cn(
                    "px-2.5 py-0.5 text-[11px] font-semibold rounded-lg transition-all shrink-0 border",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-slate-900/50 text-muted-foreground border-white/5 hover:text-foreground hover:bg-slate-900"
                  )}
                >
                  {w.name}
                </button>
              );
            })}
          </div>
        )}

        {/* ================= INLINE FAST-ADD TICKER INPUT & AUTOCOMPLETE ================= */}
        {isAddMode && (
          <div className="relative pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={newSymbolInput}
                  onChange={(e) => setNewSymbolInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSymbol();
                    } else if (e.key === 'Escape') {
                      setIsAddMode(false);
                    }
                  }}
                  placeholder={`Add ticker to "${activeWatchlist?.name || 'Watchlist'}" (e.g. NVDA, PLTR, BTC-USD)...`}
                  className="h-8 text-xs pl-8 pr-8 font-mono uppercase bg-slate-950/90 border-primary/50 focus-visible:ring-1 focus-visible:ring-primary placeholder:normal-case placeholder:font-sans"
                />
                {isSearchingSuggestions && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-primary" />
                )}
              </div>

              <Button
                size="sm"
                disabled={!newSymbolInput.trim() || isAdding}
                onClick={() => handleAddSymbol()}
                className="h-8 px-3 text-xs font-semibold bg-primary text-primary-foreground gap-1"
              >
                {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Add</span>
              </Button>
            </div>

            {/* Live Autocomplete Dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-slate-950/95 border border-border/80 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl divide-y divide-border/40">
                <div className="px-3 py-1.5 bg-accent/20 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Matching Symbols</span>
                  <span>Click to add</span>
                </div>
                {suggestions.map((s) => (
                  <div
                    key={s.symbol}
                    onClick={() => handleAddSymbol(s.symbol)}
                    className="flex items-center justify-between px-3 py-2 hover:bg-primary/15 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                        {s.symbol}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                        {s.name}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 space-y-2 max-h-[360px] overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-xs">Loading watchlist...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center space-y-3 text-xs text-muted-foreground">
            <p>No stocks in <strong>{activeWatchlist?.name}</strong>.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddMode(true)}
              className="text-xs h-8 gap-1.5 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Add First Symbol
            </Button>
          </div>
        ) : (
          items.map((item) => {
            const isPositive = item.change >= 0;
            const stockNote = notesMap[item.symbol.toUpperCase()];
            const thematic = getCompanyStyleAndThemes(item.symbol, item.name);
            const styleConfig = STYLE_CONFIG[thematic.style] || STYLE_CONFIG.Growth;
            const primaryThemeStyle = getThemeBadgeStyle(thematic.primaryTheme);

            return (
              <div
                key={item.symbol}
                onClick={() => handleRowClick(item.symbol)}
                className="flex items-center justify-between p-2.5 rounded-xl border border-border/40 bg-card/30 hover:bg-accent/40 hover:border-primary/30 transition-all cursor-pointer group relative"
              >
                {/* Left: Symbol, Name, Style Badge & Themes */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 font-mono font-bold text-xs text-primary group-hover:border-primary/50 transition-colors">
                    {item.symbol.slice(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs font-mono text-foreground group-hover:text-primary transition-colors">
                        {item.symbol}
                      </span>

                      {/* Investment Style Badge */}
                      <span className={cn("text-[8.5px] px-1 py-0 rounded font-bold border", styleConfig.badgeClass)}>
                        {thematic.style}
                      </span>

                      {/* Primary Theme Tag */}
                      {thematic.primaryTheme && (
                        <span className={cn("text-[8.5px] px-1.5 py-0 rounded-full border hidden sm:flex items-center gap-0.5", primaryThemeStyle.badgeClass)}>
                          <span>{primaryThemeStyle.icon}</span>
                          <span className="truncate max-w-[80px]">{thematic.primaryTheme}</span>
                        </span>
                      )}

                      {/* Sentiment Note Pill */}
                      {stockNote && (
                        <span
                          className={cn(
                            "text-[8.5px] font-mono px-1 py-0 rounded border flex items-center gap-0.5",
                            stockNote.sentiment === 'BULLISH'
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : stockNote.sentiment === 'BEARISH'
                              ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                              : "bg-primary/20 text-primary border-primary/30"
                          )}
                          title={`Note: ${stockNote.content.slice(0, 100)}...`}
                        >
                          <FileText className="w-2.5 h-2.5" />
                          {stockNote.sentiment ? stockNote.sentiment[0] : 'N'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[130px] sm:max-w-[170px]">
                      {item.name || thematic.sector || 'Equities'}
                    </p>
                  </div>
                </div>

                {/* Right: Live Price, Day Move & Quick Actions */}
                <div className="flex items-center gap-2 shrink-0 pl-2">
                  <div className="text-right font-mono">
                    <p className="font-bold text-xs text-foreground">
                      ${item.price ? item.price.toFixed(2) : '0.00'}
                    </p>
                    <div className="flex items-center justify-end gap-0.5 text-[11px] font-semibold">
                      {isPositive ? (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-rose-400" />
                      )}
                      <span className={isPositive ? "text-emerald-400" : "text-rose-400"}>
                        {isPositive ? '+' : ''}{item.changePercent ? item.changePercent.toFixed(2) : '0.00'}%
                      </span>
                    </div>
                  </div>

                  {/* Remove Icon on Hover */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleRemoveSymbol(e, item.symbol)}
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all rounded-lg"
                    title={`Remove ${item.symbol} from ${activeWatchlist?.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
