import { useState, useMemo, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Layers,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ExternalLink,
  Plus,
  Compass,
  Wallet,
  Tag,
  FileText,
  Clock,
  Filter,
  Maximize2,
  Minimize2,
  RefreshCw,
  SlidersHorizontal,
  FolderOpen,
  Bookmark,
  BookmarkPlus,
  Check,
  X,
  Bell,
  BellRing,
  BellPlus,
  ArrowRight,
  Zap
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { TradingViewChart } from './graphs/TradingViewChart';
import { useWatchlists, useWatchlistData, useAddSymbolToWatchlist } from '@/services/watchlistService';
import { useIBKRPortfolio } from '@/services/ibkr';
import { useTastytradePositions } from '@/services/tastytrade';
import { useTrading212Positions } from '@/services/trading212';
import { useStockNotesMap } from '@/services/noteService';
import { useAlerts, useCreateAlert, PriceAlert } from '@/services/alertService';
import { PriceAlertModal } from './PriceAlertModal';
import { StockNoteModal } from './StockNoteModal';
import { AddToWatchlistModal } from './AddToWatchlistModal';
import { getCompanyStyleAndThemes, STYLE_CONFIG, getThemeBadgeStyle } from '@/services/stockThematics';
import { parseTrading212Ticker } from '@/utils/tickerUtils';
import { toast } from 'sonner';

interface GraphsPageProps {
  onNavigateToResearch?: (symbol: string) => void;
  initialSymbol?: string;
}

type SidePanelSource = 'WATCHLIST' | 'PORTFOLIO';

export function GraphsPage({ onNavigateToResearch, initialSymbol }: GraphsPageProps) {
  // --- Side Panel Source & Watchlists ---
  const [sourceMode, setSourceMode] = useState<SidePanelSource>('WATCHLIST');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Watchlists Query
  const { data: watchlists = [], isLoading: isWatchlistsLoading } = useWatchlists();
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(() => {
    return localStorage.getItem('graphs_selected_watchlist') || null;
  });

  // Price Alerts Query & Mutations
  const { data: allAlerts = [] } = useAlerts();
  const createAlertMutation = useCreateAlert();
  const [isPriceAlertModalOpen, setIsPriceAlertModalOpen] = useState(false);
  const [priceAlertModalStock, setPriceAlertModalStock] = useState<{
    symbol: string;
    price: number;
    name?: string;
    editAlert?: PriceAlert | null;
  } | null>(null);

  // Quick Custom Alert Inline State
  const [quickAlertPrice, setQuickAlertPrice] = useState<string>('');
  const [quickAlertCondition, setQuickAlertCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');

  // Add Symbol to Watchlist Mutation
  const addSymbolMutation = useAddSymbolToWatchlist();

  // Add to Watchlist Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalStock, setModalStock] = useState<{ symbol: string; name?: string } | null>(null);

  // Ensure valid watchlist is selected
  useEffect(() => {
    if (watchlists.length > 0) {
      if (!selectedWatchlistId || !watchlists.some((w) => w.id === selectedWatchlistId)) {
        const def = watchlists.find((w) => w.isDefault) || watchlists[0];
        setSelectedWatchlistId(def.id);
        localStorage.setItem('graphs_selected_watchlist', def.id);
      }
    }
  }, [watchlists, selectedWatchlistId]);

  const handleSelectWatchlist = (id: string) => {
    setSelectedWatchlistId(id);
    localStorage.setItem('graphs_selected_watchlist', id);
  };

  const activeWatchlist = watchlists.find((w) => w.id === selectedWatchlistId) || watchlists[0];
  const { data: activeWatchlistData, isLoading: isWatchlistDataLoading } = useWatchlistData(activeWatchlist?.id);

  // Portfolio Queries
  const { data: ibkrPositions = [] } = useIBKRPortfolio();
  const { data: tastyPositions = [] } = useTastytradePositions();
  const { data: t212Positions = [] } = useTrading212Positions();

  // Stock Notes
  const { notesMap } = useStockNotesMap();
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  // --- Active Selected Stock to Chart ---
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => {
    return initialSymbol ? initialSymbol.toUpperCase() : 'AAPL';
  });

  // Combined Portfolio Positions
  const portfolioItems = useMemo(() => {
    const raw = [...ibkrPositions, ...tastyPositions, ...t212Positions];
    const uniqueMap = new Map<string, any>();

    raw.forEach((p: any) => {
      const isOption = p.assetType === 'OPTION' || p.assetType === 'Option';
      let rawSym = (p.underlyingSymbol || p.symbol || p.ticker || '').toUpperCase();
      if (!rawSym) return;

      let cleanSym = rawSym;
      if (p.ticker) {
        cleanSym = parseTrading212Ticker(p.ticker).cleanSymbol.toUpperCase();
      } else if (rawSym.endsWith('_US_EQ')) {
        cleanSym = rawSym.replace('_US_EQ', '');
      } else if (rawSym.endsWith('_CA_EQ')) {
        cleanSym = rawSym.replace('_CA_EQ', '') + '.TO';
      } else if (rawSym.endsWith('L_EQ') || rawSym.endsWith('P_EQ')) {
        cleanSym = rawSym.replace(/[LP]_EQ$/, '') + '.L';
      } else if (rawSym.endsWith('_EQ')) {
        cleanSym = rawSym.replace('_EQ', '');
      }

      const sym = (p.underlyingSymbol || (isOption ? (cleanSym.match(/^[A-Z]+/)?.[0] || cleanSym) : cleanSym)).trim().toUpperCase();
      if (!sym) return;

      if (!uniqueMap.has(sym)) {
        const qty = p.quantity || p.shares || 0;
        const curPrice = p.currentPrice || p.underlyingPrice || p.averageCost || 0;
        const dPct = p.dayChangePercent ?? p.dayPnLPercent ?? 0;
        const dDollar = p.dayChange ?? p.dayPnL ?? 0;

        uniqueMap.set(sym, {
          symbol: sym,
          name: p.description || p.name || `${sym} Holding`,
          price: curPrice,
          change: dDollar,
          changePercent: dPct,
          source: p.broker?.name || (p.ticker ? 'Trading 212' : p.source || 'IBKR'),
        });
      }
    });

    return Array.from(uniqueMap.values());
  }, [ibkrPositions, tastyPositions, t212Positions]);

  // Active items list based on mode
  const currentList = useMemo(() => {
    if (sourceMode === 'WATCHLIST') {
      return (activeWatchlistData?.items || []).map((item) => ({
        symbol: item.symbol.toUpperCase(),
        name: item.name || `${item.symbol} Stock`,
        price: item.price || 0,
        change: item.change || 0,
        changePercent: item.changePercent || 0,
        source: 'Watchlist',
      }));
    } else {
      return portfolioItems;
    }
  }, [sourceMode, activeWatchlistData, portfolioItems]);

  // Filtered items by search query
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return currentList;
    const q = searchQuery.toLowerCase().trim();
    return currentList.filter(
      (item) =>
        item.symbol.toLowerCase().includes(q) ||
        (item.name && item.name.toLowerCase().includes(q))
    );
  }, [currentList, searchQuery]);

  // Keep selectedSymbol in sync with initialSymbol prop
  useEffect(() => {
    if (initialSymbol && initialSymbol.trim()) {
      const sym = initialSymbol.trim().toUpperCase();
      setSelectedSymbol(sym);
      if (portfolioItems.some((p) => p.symbol === sym)) {
        setSourceMode('PORTFOLIO');
      }
    }
  }, [initialSymbol, portfolioItems]);

  // Listen for global select-graphs-ticker event
  useEffect(() => {
    const handleTickerEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail && customEvent.detail.trim()) {
        const sym = customEvent.detail.trim().toUpperCase();
        setSelectedSymbol(sym);
        if (portfolioItems.some((p) => p.symbol === sym)) {
          setSourceMode('PORTFOLIO');
        }
      }
    };
    window.addEventListener('select-graphs-ticker', handleTickerEvent);
    return () => {
      window.removeEventListener('select-graphs-ticker', handleTickerEvent);
    };
  }, [portfolioItems]);

  // Check if searched ticker is an unlisted new ticker
  const searchedCleanTicker = searchQuery.trim().toUpperCase();
  const isSearchNotInList = Boolean(
    searchedCleanTicker &&
    searchedCleanTicker.length >= 1 &&
    searchedCleanTicker.length <= 12 &&
    !currentList.some((i) => i.symbol === searchedCleanTicker)
  );

  // Check if selectedSymbol is currently in active watchlist
  const isInActiveWatchlist = useMemo(() => {
    if (!activeWatchlistData?.items) return false;
    return activeWatchlistData.items.some(
      (i) => i.symbol.toUpperCase() === selectedSymbol.toUpperCase()
    );
  }, [activeWatchlistData, selectedSymbol]);

  // Only default to first item if no symbol has been chosen at all
  useEffect(() => {
    if (!selectedSymbol && filteredList.length > 0) {
      setSelectedSymbol(filteredList[0].symbol);
    }
  }, [filteredList, selectedSymbol]);

  // Active Symbol Details (find in current list, portfolio, or fallback)
  const activeItemDetails = useMemo(() => {
    return (
      filteredList.find((i) => i.symbol === selectedSymbol) ||
      currentList.find((i) => i.symbol === selectedSymbol) ||
      portfolioItems.find((i) => i.symbol === selectedSymbol) || {
        symbol: selectedSymbol,
        name: `${selectedSymbol} Stock`,
        price: 0,
        changePercent: 0,
      }
    );
  }, [filteredList, currentList, portfolioItems, selectedSymbol]);

  const activeThematics = useMemo(() => {
    return getCompanyStyleAndThemes(selectedSymbol, activeItemDetails?.name);
  }, [selectedSymbol, activeItemDetails]);

  const styleConfig = STYLE_CONFIG[activeThematics.style] || STYLE_CONFIG.Growth;
  const primaryThemeStyle = getThemeBadgeStyle(activeThematics.primaryTheme);
  const activeStockNote = notesMap[selectedSymbol.toUpperCase()];

  // Keyboard navigation through stock list
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const currentIndex = filteredList.findIndex((i) => i.symbol === selectedSymbol);
        if (currentIndex < filteredList.length - 1) {
          setSelectedSymbol(filteredList[currentIndex + 1].symbol);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const currentIndex = filteredList.findIndex((i) => i.symbol === selectedSymbol);
        if (currentIndex > 0) {
          setSelectedSymbol(filteredList[currentIndex - 1].symbol);
        }
      }
    },
    [filteredList, selectedSymbol]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const clean = searchQuery.trim().toUpperCase();
      setSelectedSymbol(clean);
    }
  };

  // Quick 1-click add to current active watchlist
  const handleQuickAddToActiveWatchlist = async (sym: string) => {
    if (!activeWatchlist?.id || !sym) return;
    try {
      await addSymbolMutation.mutateAsync({
        watchlistId: activeWatchlist.id,
        symbol: sym.trim().toUpperCase(),
      });
      toast.success(`Added ${sym.toUpperCase()} to "${activeWatchlist.name}"!`);
      setSearchQuery('');
    } catch (err: any) {
      toast.error(`Failed to add ${sym}: ${err.message}`);
    }
  };

  const openAddModal = (sym: string, name?: string) => {
    setModalStock({ symbol: sym, name });
    setIsAddModalOpen(true);
  };

  // Active Alerts on the currently charted symbol
  const activeStockAlerts = useMemo(() => {
    return allAlerts.filter(
      (a) => a.symbol.toUpperCase() === selectedSymbol.toUpperCase() && a.status === 'ACTIVE'
    );
  }, [allAlerts, selectedSymbol]);

  const openPriceAlertModal = (
    sym: string,
    price?: number,
    name?: string,
    editAlert?: PriceAlert | null
  ) => {
    setPriceAlertModalStock({
      symbol: sym,
      price: price || 0,
      name,
      editAlert: editAlert || null,
    });
    setIsPriceAlertModalOpen(true);
  };

  const handleQuickPresetAlert = async (pctOffset: number) => {
    const currentP = activeItemDetails?.price || 0;
    if (!currentP || !selectedSymbol) {
      toast.error('Current price not available. Opening custom alert dialog.');
      openPriceAlertModal(selectedSymbol, 0, activeItemDetails?.name);
      return;
    }

    const targetP = Number((currentP * (1 + pctOffset / 100)).toFixed(2));
    const cond = pctOffset >= 0 ? 'ABOVE' : 'BELOW';
    const label = pctOffset >= 0 ? `+${pctOffset}% Target` : `${pctOffset}% Pullback`;

    try {
      await createAlertMutation.mutateAsync({
        symbol: selectedSymbol.toUpperCase(),
        targetPrice: targetP,
        condition: cond,
        notes: `Quick alert set from Graph (${label}) at $${targetP}`,
      });
      toast.success(`Price alert created for ${selectedSymbol.toUpperCase()} at $${targetP.toFixed(2)} (${cond})!`);
    } catch (err: any) {
      toast.error(`Failed to create alert: ${err.message}`);
    }
  };

  const handleCreateQuickCustomAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(quickAlertPrice);
    if (isNaN(num) || num <= 0) {
      toast.error('Please enter a valid price for the alert.');
      return;
    }

    try {
      await createAlertMutation.mutateAsync({
        symbol: selectedSymbol.toUpperCase(),
        targetPrice: num,
        condition: quickAlertCondition,
        notes: `Alert set from Graph at $${num.toFixed(2)}`,
      });
      toast.success(`Price alert set for ${selectedSymbol.toUpperCase()} at $${num.toFixed(2)} (${quickAlertCondition})!`);
      setQuickAlertPrice('');
    } catch (err: any) {
      toast.error(`Failed to create alert: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ================= TOP COMMAND BAR ================= */}
      <div className="glass-card rounded-2xl p-4 border border-border/70 bg-card/70 backdrop-blur-xl shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left: Active Stock Details & Live Quotes */}
        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Ticker Icon */}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-primary/20 to-purple-500/20 border border-cyan-500/40 flex items-center justify-center font-mono font-black text-sm text-cyan-400 shadow-md">
            {selectedSymbol.slice(0, 3)}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                onClick={() => onNavigateToResearch && onNavigateToResearch(selectedSymbol)}
                className="text-2xl font-black font-mono tracking-tight text-foreground glow-text-white cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5"
                title={`Click to analyse ${selectedSymbol} in Research section`}
              >
                {selectedSymbol}
              </h1>

              {/* Style Badge */}
              <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 font-bold border", styleConfig.badgeClass)}>
                <span className={cn("w-1.5 h-1.5 rounded-full mr-1", styleConfig.dotColor)} />
                {activeThematics.style}
              </Badge>

              {/* Primary Theme Badge */}
              {activeThematics.primaryTheme && (
                <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 font-semibold border gap-1", primaryThemeStyle.badgeClass)}>
                  <span>{primaryThemeStyle.icon}</span>
                  <span>{activeThematics.primaryTheme}</span>
                </Badge>
              )}

              {/* Stock Note Pill */}
              {activeStockNote && (
                <button
                  onClick={() => setIsNoteModalOpen(true)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all cursor-pointer font-semibold",
                    activeStockNote.sentiment === 'BULLISH'
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : activeStockNote.sentiment === 'BEARISH'
                      ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                      : "bg-primary/20 text-primary border-primary/30"
                  )}
                >
                  <FileText className="w-3 h-3" />
                  {activeStockNote.sentiment || 'Note'}
                </button>
              )}

              {/* Active Alerts Pills for this Stock */}
              {activeStockAlerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => openPriceAlertModal(alert.symbol, activeItemDetails?.price, activeItemDetails?.name, alert)}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-300 flex items-center gap-1 transition-all hover:bg-amber-500/25 cursor-pointer font-mono font-bold shadow-sm"
                  title={`Alert set at $${alert.targetPrice.toFixed(2)} (${alert.condition === 'ABOVE' ? 'Above' : 'Below'}). Click to manage.`}
                >
                  <Bell className="w-3 h-3 text-amber-400" />
                  <span>${alert.targetPrice.toFixed(2)} ({alert.condition === 'ABOVE' ? '▲' : '▼'})</span>
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground mt-0.5 max-w-md truncate">
              {activeItemDetails?.name || activeThematics.sector || 'Advanced Interactive Telemetry'}
            </p>
          </div>

          {/* Live Price & Return (if available) */}
          {activeItemDetails && activeItemDetails.price > 0 && (
            <div className="flex items-center gap-3 pl-2 border-l border-border/50 font-mono">
              <div>
                <span className="text-lg font-bold text-foreground block">
                  ${activeItemDetails.price.toFixed(2)}
                </span>
                <div className={cn("text-xs font-semibold flex items-center gap-0.5", activeItemDetails.changePercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {activeItemDetails.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span>{activeItemDetails.changePercent >= 0 ? '+' : ''}{activeItemDetails.changePercent.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          
          {/* Add / In Watchlist Button */}
          {isInActiveWatchlist ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openAddModal(selectedSymbol, activeItemDetails?.name)}
              className="h-9 px-3 gap-1.5 font-bold text-xs bg-emerald-500/10 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20 shadow-sm"
              title={`In ${activeWatchlist?.name}. Click to add to another watchlist.`}
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>In Watchlist</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => openAddModal(selectedSymbol, activeItemDetails?.name)}
              className="h-9 px-3.5 gap-1.5 font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md transition-all"
              title="Add this ticker to a watchlist"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-emerald-200" />
              <span>+ Add to Watchlist</span>
            </Button>
          )}

          {/* Price Alert Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => openPriceAlertModal(selectedSymbol, activeItemDetails?.price, activeItemDetails?.name)}
            className={cn(
              "h-9 px-3.5 gap-1.5 font-bold text-xs shadow-sm transition-all",
              activeStockAlerts.length > 0
                ? "bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25"
                : "border-amber-500/30 hover:border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
            )}
            title={`Set or manage price alerts for ${selectedSymbol}`}
          >
            <Bell className={cn("w-3.5 h-3.5 text-amber-400", activeStockAlerts.length > 0 && "animate-pulse")} />
            <span>Price Alert</span>
            {activeStockAlerts.length > 0 && (
              <Badge className="bg-amber-500/30 text-amber-200 border-amber-500/50 text-[9px] px-1.5 py-0 font-mono font-bold">
                {activeStockAlerts.length}
              </Badge>
            )}
          </Button>

          {/* Analyse in Research Section Button */}
          <Button
            size="sm"
            onClick={() => onNavigateToResearch && onNavigateToResearch(selectedSymbol)}
            className="h-9 px-4 gap-2 font-bold text-xs bg-gradient-to-r from-cyan-600 via-primary to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all cursor-pointer"
            title={`Analyse ${selectedSymbol} in Research section`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Analyse in Research</span>
            <ExternalLink className="w-3 h-3 opacity-80 ml-0.5" />
          </Button>

          {/* Notes Modal */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsNoteModalOpen(true)}
            className="h-9 px-3 gap-1.5 text-xs font-semibold border-border/70 hover:bg-accent/40"
          >
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Notes</span>
          </Button>

          {/* Toggle Side Panel */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
            className="h-9 px-3 gap-1.5 text-xs font-semibold border-border/70 hover:bg-accent/40"
            title={isPanelCollapsed ? 'Show Watchlist Side Panel' : 'Maximize Chart Area'}
          >
            {isPanelCollapsed ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isPanelCollapsed ? 'Show Watchlist' : 'Full Chart'}</span>
          </Button>
        </div>
      </div>

      {/* ================= MAIN WORKSPACE: SIDE PANEL + TRADINGVIEW ================= */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch min-h-[750px]">
        
        {/* ================= WATCHLIST / PORTFOLIO SIDE PANEL ================= */}
        {!isPanelCollapsed && (
          <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col glass-card rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xl shadow-xl overflow-hidden">
            
            {/* Side Panel Header Controls */}
            <div className="p-4 border-b border-border/40 bg-accent/10 space-y-3">
              {/* Source Tabs: Watchlists vs Portfolio */}
              <div className="flex p-1 bg-slate-950/70 rounded-xl border border-white/5">
                <button
                  onClick={() => setSourceMode('WATCHLIST')}
                  className={cn(
                    "flex-1 py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                    sourceMode === 'WATCHLIST'
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Watchlists
                </button>
                <button
                  onClick={() => setSourceMode('PORTFOLIO')}
                  className={cn(
                    "flex-1 py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                    sourceMode === 'PORTFOLIO'
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Wallet className="w-3.5 h-3.5" /> Portfolio ({portfolioItems.length})
                </button>
              </div>

              {/* Watchlist Selector Dropdown (When in Watchlist Mode) */}
              {sourceMode === 'WATCHLIST' && watchlists.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                    <span>Active Watchlist:</span>
                    <span className="font-mono text-cyan-400">{filteredList.length} items</span>
                  </div>
                  <select
                    value={activeWatchlist?.id || ''}
                    onChange={(e) => handleSelectWatchlist(e.target.value)}
                    className="w-full h-8 text-xs font-semibold bg-slate-900/90 text-foreground border border-border/70 rounded-xl px-2.5 focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                  >
                    {watchlists.map((w) => (
                      <option key={w.id} value={w.id} className="bg-slate-900 text-foreground">
                        📁 {w.name} {w.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search Ticker Input */}
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Look up any ticker (e.g. NVDA, TSLA)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-8 h-8 text-xs bg-slate-900/80 border-slate-700/50 rounded-xl font-mono"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </form>

              {/* Ticker Quick Add Card (When searched ticker is not currently on list) */}
              {isSearchNotInList && (
                <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-950/40 via-slate-900/60 to-emerald-950/40 border border-cyan-500/30 space-y-2 animate-fade-in shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="font-mono font-black text-xs text-cyan-300">
                        {searchedCleanTicker}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Not in current list</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setSelectedSymbol(searchedCleanTicker)}
                      className={cn(
                        "h-7 text-xs font-bold gap-1",
                        selectedSymbol === searchedCleanTicker
                          ? "bg-cyan-500 text-slate-950"
                          : "bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30"
                      )}
                    >
                      <TrendingUp className="w-3 h-3" /> Chart
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onNavigateToResearch && onNavigateToResearch(searchedCleanTicker)}
                      className="h-7 text-xs font-bold bg-gradient-to-r from-cyan-600 to-primary hover:from-cyan-500 hover:to-primary text-white gap-1 shadow-sm"
                      title={`Analyse ${searchedCleanTicker} in Research`}
                    >
                      <Sparkles className="w-3 h-3 text-amber-300" /> Research
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openAddModal(searchedCleanTicker)}
                      className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1 shadow-sm"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Stock List Scroll Area */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[600px] scrollbar-thin">
              {isWatchlistsLoading || isWatchlistDataLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                  Loading stocks...
                </div>
              ) : filteredList.length === 0 && !isSearchNotInList ? (
                <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                  <p>No stocks found matching "{searchQuery}".</p>
                  {searchQuery && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedSymbol(searchQuery.toUpperCase().trim());
                        setSearchQuery('');
                      }}
                      className="text-xs h-7 gap-1"
                    >
                      <Plus className="w-3 h-3 text-primary" /> Chart "{searchQuery.toUpperCase()}"
                    </Button>
                  )}
                </div>
              ) : (
                filteredList.map((item) => {
                  const isSelected = item.symbol === selectedSymbol;
                  const itemThematics = getCompanyStyleAndThemes(item.symbol, item.name);
                  const itemStyleConfig = STYLE_CONFIG[itemThematics.style] || STYLE_CONFIG.Growth;
                  const note = notesMap[item.symbol];

                  return (
                    <div
                      key={item.symbol}
                      onClick={() => setSelectedSymbol(item.symbol)}
                      className={cn(
                        "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group relative overflow-hidden",
                        isSelected
                          ? "bg-primary/15 border-primary/50 shadow-md ring-1 ring-primary/40"
                          : "bg-card/30 border-border/40 hover:bg-accent/40 hover:border-border/70"
                      )}
                    >
                      {/* Active Left Indicator */}
                      {isSelected && (
                        <div className="absolute inset-y-0 left-0 w-1 bg-cyan-400 rounded-r-full" />
                      )}

                      {/* Left: Ticker & Name */}
                      <div className="flex items-center gap-2.5 min-w-0 pl-1">
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs border shrink-0 transition-colors",
                          isSelected
                            ? "bg-primary/20 border-primary/40 text-primary"
                            : "bg-slate-900/60 border-white/5 text-muted-foreground group-hover:text-foreground"
                        )}>
                          {item.symbol.slice(0, 3)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn(
                              "font-mono font-bold text-xs tracking-wide transition-colors",
                              isSelected ? "text-cyan-300 font-black" : "text-foreground group-hover:text-primary"
                            )}>
                              {item.symbol}
                            </span>

                            {/* Style Badge */}
                            <span className={cn("text-[8.5px] px-1 py-0 rounded font-bold border", itemStyleConfig.badgeClass)}>
                              {itemThematics.style}
                            </span>

                            {/* Note pill */}
                            {note && (
                              <span className={cn(
                                "text-[8px] font-mono px-1 py-0 rounded border",
                                note.sentiment === 'BULLISH' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                                note.sentiment === 'BEARISH' ? "bg-rose-500/20 text-rose-400 border-rose-500/30" :
                                "bg-primary/20 text-primary border-primary/30"
                              )}>
                                {note.sentiment ? note.sentiment[0] : 'N'}
                              </span>
                            )}
                          </div>

                          <p className="text-[10.5px] text-muted-foreground truncate max-w-[130px]">
                            {item.name || itemThematics.sector || 'Holding'}
                          </p>
                        </div>
                      </div>

                      {/* Right: Live Price & Day Change & Quick Alert */}
                      <div className="flex items-center gap-2 font-mono shrink-0 pl-1">
                        <div className="text-right">
                          <span className="font-bold text-xs text-foreground block">
                            ${item.price > 0 ? item.price.toFixed(2) : '-'}
                          </span>
                          {item.changePercent !== 0 && (
                            <span className={cn(
                              "text-[10px] font-semibold flex items-center justify-end gap-0.5",
                              item.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                            )}>
                              {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                            </span>
                          )}
                        </div>

                        {/* Quick Alert Bell button on row */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPriceAlertModal(item.symbol, item.price, item.name);
                          }}
                          className="p-1.5 rounded-lg hover:bg-amber-500/20 text-muted-foreground hover:text-amber-300 opacity-40 group-hover:opacity-100 transition-all cursor-pointer"
                          title={`Set price alert for ${item.symbol}`}
                        >
                          <Bell className="w-3.5 h-3.5" />
                        </button>

                        {/* Quick Analyse in Research button on row */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToResearch && onNavigateToResearch(item.symbol);
                          }}
                          className="p-1.5 rounded-lg hover:bg-cyan-500/20 text-muted-foreground hover:text-cyan-300 opacity-40 group-hover:opacity-100 transition-all cursor-pointer"
                          title={`Analyse ${item.symbol} in Research section`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Side Panel Footer with Keyboard Hint */}
            <div className="p-2.5 border-t border-border/40 bg-accent/5 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1 font-mono">
                <kbd className="px-1 py-0.5 bg-slate-900 border border-white/10 rounded">▲</kbd>
                <kbd className="px-1 py-0.5 bg-slate-900 border border-white/10 rounded">▼</kbd>
                Navigate
              </span>
              <span>{filteredList.length} items</span>
            </div>
          </div>
        )}

        {/* ================= MAIN TRADINGVIEW ADVANCED CHART & QUICK-ALERT TOOLBAR ================= */}
        <div className="flex-1 flex flex-col min-w-0 space-y-3">
          
          {/* ================= GRAPH QUICK-ALERT PRESET BAR ================= */}
          <div className="glass-card rounded-2xl p-3 px-4 border border-border/70 bg-card/80 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 shadow-md">
            {/* Left: Quick Target Presets based on live price */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mr-1">
                <Bell className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Quick Price Alert:</span>
              </div>

              {activeItemDetails && activeItemDetails.price > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickPresetAlert(5)}
                    disabled={createAlertMutation.isPending}
                    className="h-7 text-[11px] px-2.5 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 shadow-sm"
                    title={`Set alert at +5% ($${(activeItemDetails.price * 1.05).toFixed(2)})`}
                  >
                    <TrendingUp className="w-3 h-3 mr-1 text-emerald-400" />
                    +5% (${(activeItemDetails.price * 1.05).toFixed(2)})
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickPresetAlert(10)}
                    disabled={createAlertMutation.isPending}
                    className="h-7 text-[11px] px-2.5 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 shadow-sm"
                    title={`Set alert at +10% ($${(activeItemDetails.price * 1.10).toFixed(2)})`}
                  >
                    <TrendingUp className="w-3 h-3 mr-1 text-emerald-400" />
                    +10% (${(activeItemDetails.price * 1.10).toFixed(2)})
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickPresetAlert(-5)}
                    disabled={createAlertMutation.isPending}
                    className="h-7 text-[11px] px-2.5 bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 shadow-sm"
                    title={`Set alert at -5% ($${(activeItemDetails.price * 0.95).toFixed(2)})`}
                  >
                    <TrendingDown className="w-3 h-3 mr-1 text-rose-400" />
                    -5% (${(activeItemDetails.price * 0.95).toFixed(2)})
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickPresetAlert(-10)}
                    disabled={createAlertMutation.isPending}
                    className="h-7 text-[11px] px-2.5 bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 shadow-sm"
                    title={`Set alert at -10% ($${(activeItemDetails.price * 0.90).toFixed(2)})`}
                  >
                    <TrendingDown className="w-3 h-3 mr-1 text-rose-400" />
                    -10% (${(activeItemDetails.price * 0.90).toFixed(2)})
                  </Button>
                </div>
              ) : null}
            </div>

            {/* Right: Quick Custom Price Input & Full Modal Button */}
            <div className="flex items-center gap-2 flex-wrap">
              <form onSubmit={handleCreateQuickCustomAlert} className="flex items-center gap-1.5">
                <div className="relative w-28">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Target $"
                    value={quickAlertPrice}
                    onChange={(e) => setQuickAlertPrice(e.target.value)}
                    className="h-7 pl-6 pr-2 text-xs font-mono bg-slate-900/80 border-border/70 focus:border-amber-500/60"
                  />
                </div>

                <select
                  value={quickAlertCondition}
                  onChange={(e) => setQuickAlertCondition(e.target.value as 'ABOVE' | 'BELOW')}
                  className="h-7 text-[11px] font-semibold bg-slate-900/90 text-foreground border border-border/70 rounded-lg px-1.5 focus:outline-none cursor-pointer"
                >
                  <option value="ABOVE">▲ Above</option>
                  <option value="BELOW">▼ Below</option>
                </select>

                <Button
                  type="submit"
                  size="sm"
                  disabled={createAlertMutation.isPending || !quickAlertPrice}
                  className="h-7 px-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm"
                >
                  Set
                </Button>
              </form>

              <Button
                variant="outline"
                size="sm"
                onClick={() => openPriceAlertModal(selectedSymbol, activeItemDetails?.price, activeItemDetails?.name)}
                className="h-7 px-2.5 text-xs font-semibold border-amber-500/30 text-amber-300 hover:bg-amber-500/10 gap-1"
              >
                <BellPlus className="w-3 h-3" />
                <span>Custom Alert</span>
              </Button>
            </div>
          </div>

          <TradingViewChart
            symbol={selectedSymbol}
            theme="dark"
            interval="D"
            className="flex-1 h-full min-h-[680px]"
          />
        </div>
      </div>

      {/* Stock Note Modal */}
      <StockNoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        symbol={selectedSymbol}
        stockName={activeItemDetails?.name}
        currentPrice={activeItemDetails?.price}
      />

      {/* Price Alert Modal */}
      <PriceAlertModal
        open={isPriceAlertModalOpen}
        onOpenChange={setIsPriceAlertModalOpen}
        initialSymbol={priceAlertModalStock?.symbol || selectedSymbol}
        initialPrice={priceAlertModalStock?.price || activeItemDetails?.price || 0}
        initialStockName={priceAlertModalStock?.name || activeItemDetails?.name}
        editAlert={priceAlertModalStock?.editAlert}
      />

      {/* Add To Watchlist Modal */}
      {modalStock && (
        <AddToWatchlistModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setModalStock(null);
          }}
          symbol={modalStock.symbol}
          companyName={modalStock.name}
          defaultWatchlistId={selectedWatchlistId}
          onSuccess={(wId) => {
            if (sourceMode === 'WATCHLIST') {
              handleSelectWatchlist(wId);
            }
          }}
        />
      )}
    </div>
  );
}
