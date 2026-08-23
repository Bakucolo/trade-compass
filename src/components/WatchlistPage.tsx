import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  ExternalLink,
  FolderPlus,
  Loader2,
  Building2,
  ArrowUpDown,
  Check,
  X,
  Sparkles,
  Layers,
  Edit2,
  ListPlus,
  RefreshCw,
  BarChart3,
  DollarSign,
  PieChart,
  Percent,
  ActivitySquare,
  FileText,
  Clock,
  Activity,
  Globe,
  LineChart,
  Bell
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from './ui/sheet';
import {
  useWatchlists,
  useWatchlistData,
  useCreateWatchlist,
  useRenameWatchlist,
  useDeleteWatchlist,
  useAddSymbolToWatchlist,
  useRemoveSymbolFromWatchlist,
  EnrichedStockItem,
} from '@/services/watchlistService';
import { marketDataService } from '@/services/marketData';
import { useResearchDossier, useAIAnalysis } from '@/services/researchData';
import { useAlerts } from '@/services/alertService';
import { useReportPrompts } from '@/services/promptService';
import { useStockNotesMap } from '@/services/noteService';
import { AutonomousReport, reportService, useAutonomousReports } from '@/services/reportService';
import { AutonomousReportsList } from './AutonomousReportsList';
import { AutonomousReportViewerModal } from './AutonomousReportViewerModal';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PriceAlertModal } from './PriceAlertModal';
import { StockNoteModal } from './StockNoteModal';
import ReactMarkdown from 'react-markdown';

type SortField =
  | 'symbol'
  | 'name'
  | 'sector'
  | 'price'
  | 'changePercent'
  | 'marketCap'
  | 'pe'
  | 'ps'
  | 'eps'
  | 'operatingMargin'
  | 'roe';

type SortDirection = 'asc' | 'desc';

interface WatchlistPageProps {
  onNavigateToResearch?: (symbol: string) => void;
}

export function WatchlistPage({ onNavigateToResearch }: WatchlistPageProps) {
  // Watchlist query & active selection
  const { data: watchlists = [], isLoading: isWatchlistsLoading, refetch: refetchWatchlists } = useWatchlists();
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);

  // Auto-select first or default watchlist once loaded
  useEffect(() => {
    if (watchlists.length > 0) {
      if (!selectedWatchlistId || !watchlists.some((w) => w.id === selectedWatchlistId)) {
        const defaultW = watchlists.find((w) => w.isDefault) || watchlists[0];
        setSelectedWatchlistId(defaultW.id);
      }
    }
  }, [watchlists, selectedWatchlistId]);

  // Active watchlist detailed data
  const {
    data: activeData,
    isLoading: isDataLoading,
    isRefetching: isDataRefetching,
    refetch: refetchData,
  } = useWatchlistData(selectedWatchlistId);

  // Mutations
  const createWatchlistMutation = useCreateWatchlist();
  const renameWatchlistMutation = useRenameWatchlist();
  const deleteWatchlistMutation = useDeleteWatchlist();
  const addSymbolMutation = useAddSymbolToWatchlist();
  const removeSymbolMutation = useRemoveSymbolFromWatchlist();

  // Local UI States
  const [newTickerInput, setNewTickerInput] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Price Alerts Query & Modal State
  const { data: allAlerts = [] } = useAlerts();
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertModalStock, setAlertModalStock] = useState<{ symbol: string; price: number; name: string } | null>(null);

  // Stock Notes State & Map
  const { notesMap } = useStockNotesMap();
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteModalStock, setNoteModalStock] = useState<{ symbol: string; price?: number; name?: string } | null>(null);

  // Selected Stock for Research Side Drawer
  const [drawerSymbol, setDrawerSymbol] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { data: reportPrompts = [] } = useReportPrompts();
  const [drawerReportSlug, setDrawerReportSlug] = useState('company_research');
  const { data: drawerSavedReports = [] } = useAutonomousReports(drawerSymbol || undefined);
  const [drawerReportModalReport, setDrawerReportModalReport] = useState<AutonomousReport | null>(null);
  const [isDrawerReportModalOpen, setIsDrawerReportModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Watchlist Modal / Form States
  const [isCreatingWatchlist, setIsCreatingWatchlist] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [editingWatchlistId, setEditingWatchlistId] = useState<string | null>(null);
  const [editingWatchlistName, setEditingWatchlistName] = useState('');

  // Autocomplete Suggestions
  const [suggestions, setSuggestions] = useState<Array<{ symbol: string; name: string }>>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);

  // Handle live suggestions for ticker input
  useEffect(() => {
    const trimmed = newTickerInput.trim();
    if (trimmed.length < 1) {
      setSuggestions([]);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const results = await marketDataService.searchSymbols(trimmed);
        if (isMounted) {
          setSuggestions((results || []).slice(0, 5));
        }
      } catch (err) {
        console.warn('Suggestion search failed', err);
      } finally {
        if (isMounted) setIsSearchingSuggestions(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [newTickerInput]);

  // Quick addition action
  const handleAddTicker = async (tickerToAdd?: string) => {
    const symbol = (tickerToAdd || newTickerInput).trim().toUpperCase();
    if (!symbol || !selectedWatchlistId) return;

    try {
      await addSymbolMutation.mutateAsync({
        watchlistId: selectedWatchlistId,
        symbol,
      });
      setNewTickerInput('');
      setSuggestions([]);
    } catch (err: any) {
      alert(`Failed to add ${symbol}: ${err.message}`);
    }
  };

  // Create Watchlist
  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim()) return;
    try {
      const created = await createWatchlistMutation.mutateAsync(newWatchlistName.trim());
      setSelectedWatchlistId(created.id);
      setNewWatchlistName('');
      setIsCreatingWatchlist(false);
    } catch (err: any) {
      alert(`Failed to create watchlist: ${err.message}`);
    }
  };

  // Rename Watchlist
  const handleRenameWatchlist = async (id: string) => {
    if (!editingWatchlistName.trim()) return;
    try {
      await renameWatchlistMutation.mutateAsync({ id, name: editingWatchlistName.trim() });
      setEditingWatchlistId(null);
    } catch (err: any) {
      alert(`Failed to rename watchlist: ${err.message}`);
    }
  };

  // Delete Watchlist
  const handleDeleteWatchlist = async (id: string, name: string) => {
    if (watchlists.length <= 1) {
      alert('You must keep at least one watchlist.');
      return;
    }
    if (confirm(`Are you sure you want to delete the watchlist "${name}"?`)) {
      try {
        await deleteWatchlistMutation.mutateAsync(id);
        const remaining = watchlists.filter((w) => w.id !== id);
        if (remaining.length > 0) {
          setSelectedWatchlistId(remaining[0].id);
        }
      } catch (err: any) {
        alert(`Failed to delete watchlist: ${err.message}`);
      }
    }
  };

  // Delete Symbol
  const handleRemoveSymbol = async (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening the research drawer
    if (!selectedWatchlistId) return;
    try {
      await removeSymbolMutation.mutateAsync({
        watchlistId: selectedWatchlistId,
        symbol,
      });
    } catch (err: any) {
      alert(`Failed to remove ${symbol}: ${err.message}`);
    }
  };

  // Navigate to Full Research Page
  const handleViewFullResearch = (symbol: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onNavigateToResearch) {
      onNavigateToResearch(symbol);
    } else {
      window.dispatchEvent(new CustomEvent('select-research-ticker', { detail: symbol }));
    }
  };

  // Generate Autonomous PDF Report from inside the drawer
  const handleGenerateAutonomousReport = async (symbol: string) => {
    if (!symbol || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const activeTemplate = reportPrompts.find(p => p.slug === drawerReportSlug) || reportPrompts[0];
      const promptId = activeTemplate ? activeTemplate.id : undefined;
      const result = await reportService.generateReport(symbol, drawerReportSlug, promptId);

      toast.success(`Autonomous report generated for ${symbol}!`);
      await queryClient.invalidateQueries({ queryKey: ['autonomousReports', symbol] });
      await queryClient.invalidateQueries({ queryKey: ['allAutonomousReports'] });

      if (result?.report) {
        setDrawerReportModalReport(result.report);
        setIsDrawerReportModalOpen(true);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to generate report: ${error.message || 'Please check your Gemini / OpenRouter API key in Settings.'}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Helpers for formatting
  const formatNumber = (num: number | null | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    const val = Number(num);
    if (isNaN(val)) return 'N/A';

    if (val >= 1e12) return '$' + (val / 1e12).toFixed(2) + 'T';
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
    if (val >= 1e3) return '$' + (val / 1e3).toFixed(2) + 'K';
    return '$' + val.toLocaleString();
  };

  const safeFixed = (val: number | null | undefined, decimals: number = 2) => {
    if (val === undefined || val === null) return 'N/A';
    const num = Number(val);
    if (isNaN(num)) return 'N/A';
    return num.toFixed(decimals);
  };

  const formatChangePercent = (val: number | null | undefined) => {
    if (val === undefined || val === null) return '0.00%';
    const num = Number(val);
    if (isNaN(num)) return '0.00%';
    const pct = Math.abs(num) < 1.0 && num !== 0 ? num * 100 : num;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  };

  const formatPercent = (val: number | null | undefined) => {
    if (val === undefined || val === null) return 'N/A';
    const num = Number(val);
    if (isNaN(num)) return 'N/A';
    const formatted = Math.abs(num) < 1.5 && num !== 0 ? (num * 100).toFixed(2) : num.toFixed(2);
    return `${formatted}%`;
  };

  // Sort & Filter
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const items = activeData?.items || [];

  const processedItems = useMemo(() => {
    let list = [...items];

    // Filter
    if (tableFilter.trim()) {
      const q = tableFilter.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.symbol.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.sector.toLowerCase().includes(q) ||
          item.industry.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (valA === null || valA === undefined) valA = sortDirection === 'asc' ? Infinity : -Infinity;
      if (valB === null || valB === undefined) valB = sortDirection === 'asc' ? Infinity : -Infinity;

      if (typeof valA === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [items, tableFilter, sortField, sortDirection]);

  const activeWatchlist = watchlists.find((w) => w.id === selectedWatchlistId);

  // Queries for the Side-Drawer selected symbol
  const { data: drawerDossier, isLoading: isDrawerDossierLoading } = useResearchDossier(drawerSymbol || '');
  const { data: drawerAiData, isLoading: isDrawerAiLoading } = useAIAnalysis(drawerSymbol || '');

  // Parse Drawer AI analysis
  let parsedDrawerAi: any = null;
  if (drawerAiData?.analysis) {
    try {
      const cleanString = drawerAiData.analysis.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedDrawerAi = JSON.parse(cleanString);
    } catch (e) {
      console.warn('Failed to parse Drawer AI JSON', e);
    }
  }

  const drawerQuote = drawerDossier?.header;
  const drawerFundamentals = drawerDossier?.fundamentals;
  const drawerTechnicals = drawerDossier?.technicals;
  const drawerProfile = drawerDossier?.profile;
  const drawerNews = drawerDossier?.news || [];
  const drawerPriceIsUp = (drawerQuote?.regularMarketChange ?? 0) >= 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground glow-text-white">
              Watchlists
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
              <Layers className="w-3.5 h-3.5 mr-1" />
              {watchlists.length} Lists
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Click anywhere on a row to open its research dossier. Create custom lists, track live prices, and monitor fundamentals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchWatchlists();
              refetchData();
            }}
            disabled={isDataRefetching}
            className="gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isDataRefetching && "animate-spin text-primary")} />
            Refresh
          </Button>

          <Button
            variant="glow"
            size="sm"
            onClick={() => setIsCreatingWatchlist(true)}
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <FolderPlus className="w-4 h-4" />
            New Watchlist
          </Button>
        </div>
      </div>

      {/* Watchlist Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
        {watchlists.map((w) => {
          const isSelected = w.id === selectedWatchlistId;
          const isEditing = editingWatchlistId === w.id;

          if (isEditing) {
            return (
              <div key={w.id} className="flex items-center gap-1 bg-card border border-primary/40 rounded-lg p-1">
                <Input
                  size={1}
                  value={editingWatchlistName}
                  onChange={(e) => setEditingWatchlistName(e.target.value)}
                  className="h-7 text-xs w-32 px-2"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameWatchlist(w.id);
                    if (e.key === 'Escape') setEditingWatchlistId(null);
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-success"
                  onClick={() => handleRenameWatchlist(w.id)}
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => setEditingWatchlistId(null)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          }

          return (
            <div
              key={w.id}
              onClick={() => setSelectedWatchlistId(w.id)}
              className={cn(
                "group relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all border",
                isSelected
                  ? "bg-primary/15 text-primary border-primary/40 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                  : "bg-card/60 text-muted-foreground border-border/60 hover:bg-accent/40 hover:text-foreground"
              )}
            >
              <span>{w.name}</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold",
                  isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {w.items?.length || 0}
              </span>

              {isSelected && (
                <div className="flex items-center gap-0.5 ml-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingWatchlistId(w.id);
                      setEditingWatchlistName(w.name);
                    }}
                    className="p-1 hover:text-foreground text-muted-foreground transition-colors"
                    title="Rename Watchlist"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  {watchlists.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteWatchlist(w.id, w.name);
                      }}
                      className="p-1 hover:text-destructive text-muted-foreground transition-colors"
                      title="Delete Watchlist"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Modal / Inline form to add new watchlist */}
        {isCreatingWatchlist && (
          <div className="flex items-center gap-1.5 bg-card/80 backdrop-blur border border-primary/50 rounded-xl p-1.5 animate-in fade-in slide-in-from-left-2 duration-300">
            <Input
              placeholder="Watchlist Name..."
              value={newWatchlistName}
              onChange={(e) => setNewWatchlistName(e.target.value)}
              className="h-8 text-xs w-40 px-2.5 bg-background border-border"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateWatchlist();
                if (e.key === 'Escape') setIsCreatingWatchlist(false);
              }}
            />
            <Button
              size="sm"
              variant="glow"
              className="h-8 px-3 text-xs bg-primary text-primary-foreground"
              onClick={handleCreateWatchlist}
              disabled={createWatchlistMutation.isPending || !newWatchlistName.trim()}
            >
              {createWatchlistMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create'}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setIsCreatingWatchlist(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Quick Add Search Bar & Table Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Quick Add Stock Box */}
        <div className="lg:col-span-7 space-y-2">
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                <Input
                  placeholder={`Add symbol to "${activeWatchlist?.name || 'Watchlist'}" (e.g. AAPL, NVDA, TSLA, ORA)... Press Enter`}
                  value={newTickerInput}
                  onChange={(e) => setNewTickerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTicker();
                    }
                  }}
                  className="pl-10 pr-10 h-11 bg-card/70 border-primary/20 focus:border-primary text-sm font-medium shadow-inner"
                />
                {isSearchingSuggestions && (
                  <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                )}
              </div>
              <Button
                variant="glow"
                className="h-11 px-5 gap-1.5 font-semibold bg-primary text-primary-foreground shrink-0"
                onClick={() => handleAddTicker()}
                disabled={addSymbolMutation.isPending || !newTickerInput.trim()}
              >
                {addSymbolMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Add Stock
                  </>
                )}
              </Button>
            </div>

            {/* Suggestions Dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-16 mt-1.5 bg-popover/95 backdrop-blur-xl border border-primary/20 rounded-xl shadow-2xl overflow-hidden p-1">
                {suggestions.map((item) => (
                  <button
                    key={item.symbol}
                    onClick={() => handleAddTicker(item.symbol)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-primary/10 rounded-lg text-left transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground text-sm">{item.symbol}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[260px]">{item.name}</span>
                    </div>
                    <span className="text-xs text-primary font-semibold flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick-Add Preset Ticker Pills */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
              <Sparkles className="w-3 h-3 text-primary" /> Popular:
            </span>
            {['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'ORA', 'PLTR', 'FSLR'].map((ticker) => {
              const isAlreadyAdded = items.some((i) => i.symbol === ticker);
              return (
                <button
                  key={ticker}
                  onClick={() => !isAlreadyAdded && handleAddTicker(ticker)}
                  disabled={isAlreadyAdded || addSymbolMutation.isPending}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg border font-mono transition-all",
                    isAlreadyAdded
                      ? "bg-accent/30 text-muted-foreground/50 border-border/40 cursor-default"
                      : "bg-card hover:bg-primary/15 text-foreground hover:text-primary border-border/80 hover:border-primary/40 cursor-pointer shadow-sm"
                  )}
                >
                  +{ticker}
                </button>
              );
            })}
          </div>
        </div>

        {/* In-Table Filter */}
        <div className="lg:col-span-5 flex items-center justify-end gap-2">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter in this watchlist..."
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="pl-9 h-11 bg-card/50 border-border text-sm"
            />
          </div>
        </div>
      </div>

      {/* Main Stock Table with Clickable Rows */}
      <div className="glass-card rounded-2xl overflow-hidden border border-border/60 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border/80 bg-background/40 backdrop-blur-sm text-[11px] uppercase tracking-wider text-muted-foreground font-semibold select-none">
                <th
                  onClick={() => handleSort('symbol')}
                  className="text-left p-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Symbol & Company
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('sector')}
                  className="text-left p-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Sector / Industry
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('price')}
                  className="text-right p-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Last Price
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('changePercent')}
                  className="text-right p-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Day Change
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('marketCap')}
                  className="text-right p-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Market Cap
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('pe')}
                  className="text-right p-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    P/E (TTM)
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('ps')}
                  className="text-right p-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    P/S
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('eps')}
                  className="text-right p-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    EPS
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('operatingMargin')}
                  className="text-right p-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Op Margin
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('roe')}
                  className="text-right p-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    ROE
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="text-center p-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/40 text-sm">
              {isDataLoading ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-muted-foreground font-medium text-sm animate-pulse">
                        Loading real-time quotes & fundamental metrics...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : processedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center">
                    <div className="max-w-md mx-auto flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <ListPlus className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-semibold text-foreground">
                        {tableFilter ? 'No matching tickers found' : 'This watchlist is empty'}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {tableFilter
                          ? `No tickers matched "${tableFilter}". Try clearing your filter.`
                          : 'Use the search box above to add stocks like AAPL, NVDA, TSLA, or ORA to this list.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                processedItems.map((item, index) => {
                  const isPositive = item.change >= 0;
                  const activeAlert = allAlerts.find(
                    (a) => a.symbol.toUpperCase() === item.symbol.toUpperCase() && a.status === 'ACTIVE'
                  );
                  const stockNote = notesMap[item.symbol.toUpperCase()];

                  return (
                    <tr
                      key={item.symbol}
                      onClick={() => setDrawerSymbol(item.symbol)}
                      className="hover:bg-primary/10 transition-all cursor-pointer group animate-in fade-in relative"
                      style={{ animationDelay: `${index * 25}ms` }}
                    >
                      {/* Symbol & Name */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:border-primary/50 group-hover:scale-105 transition-all">
                            <span className="text-xs font-black text-primary font-mono">
                              {item.symbol.slice(0, 3)}
                            </span>
                          </div>
                          <div>
                            <div className="font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-base">{item.symbol}</span>
                              {stockNote && (
                                <Badge
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNoteModalStock({ symbol: item.symbol, name: item.name, price: item.price });
                                    setIsNoteModalOpen(true);
                                  }}
                                  className={cn(
                                    "text-[10px] px-1.5 py-0 cursor-pointer transition-all flex items-center gap-1",
                                    stockNote.sentiment === 'BULLISH'
                                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                                      : stockNote.sentiment === 'BEARISH'
                                      ? "bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25 shadow-[0_0_8px_rgba(244,63,94,0.15)]"
                                      : "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25 shadow-[0_0_8px_rgba(99,102,241,0.15)]"
                                  )}
                                  title={`Note: ${stockNote.content.slice(0, 120)}...`}
                                >
                                  <FileText className="w-2.5 h-2.5" />
                                  {stockNote.sentiment || 'Notes'}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-primary/10 text-primary border-primary/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                View Dossier
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate max-w-[160px]" title={item.name}>
                              {item.name}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Sector & Industry */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-accent/60 text-accent-foreground">
                            <Building2 className="w-3 h-3 opacity-70" />
                            <span className="truncate max-w-[120px]">{item.sector}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[130px]" title={item.industry}>
                            {item.industry}
                          </p>
                        </div>
                      </td>

                      {/* Last Price */}
                      <td className="p-4 text-right">
                        <span className="font-mono font-bold text-foreground text-base">
                          ${safeFixed(item.price)}
                        </span>
                      </td>

                      {/* Day Change */}
                      <td className="p-4 text-right">
                        <div className="inline-flex flex-col items-end">
                          <Badge
                            variant="outline"
                            className={cn(
                              "px-2 py-0.5 text-xs font-mono font-bold border",
                              isPositive
                                ? "bg-success/10 text-success border-success/30 shadow-[0_0_10px_rgba(34,197,94,0.1)]"
                                : "bg-destructive/10 text-destructive border-destructive/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                            )}
                          >
                            {formatChangePercent(item.changePercent)}
                          </Badge>
                          <span className={cn("text-[10px] font-mono mt-0.5", isPositive ? "text-success" : "text-destructive")}>
                            {isPositive ? '+' : ''}${safeFixed(item.change)}
                          </span>
                        </div>
                      </td>

                      {/* Market Cap */}
                      <td className="p-4 text-right">
                        <span className="font-mono font-semibold text-foreground text-xs">
                          {formatNumber(item.marketCap)}
                        </span>
                      </td>

                      {/* P/E Ratio */}
                      <td className="p-4 text-right">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {safeFixed(item.pe)}
                        </span>
                      </td>

                      {/* Price / Sales */}
                      <td className="p-4 text-right">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {safeFixed(item.ps)}
                        </span>
                      </td>

                      {/* EPS */}
                      <td className="p-4 text-right">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {item.eps !== null ? `$${safeFixed(item.eps)}` : 'N/A'}
                        </span>
                      </td>

                      {/* Operating Margin */}
                      <td className="p-4 text-right">
                        <span
                          className={cn(
                            "font-mono text-xs font-semibold",
                            item.operatingMargin && item.operatingMargin > 0
                              ? "text-success"
                              : item.operatingMargin && item.operatingMargin < 0
                              ? "text-destructive"
                              : "text-foreground"
                          )}
                        >
                          {formatPercent(item.operatingMargin)}
                        </span>
                      </td>

                      {/* ROE */}
                      <td className="p-4 text-right">
                        <span
                          className={cn(
                            "font-mono text-xs font-semibold",
                            item.roe && item.roe > 0
                              ? "text-success"
                              : item.roe && item.roe < 0
                              ? "text-destructive"
                              : "text-foreground"
                          )}
                        >
                          {formatPercent(item.roe)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Stock Notes Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-8 w-8 transition-colors",
                              stockNote
                                ? stockNote.sentiment === 'BULLISH'
                                  ? "text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                  : stockNote.sentiment === 'BEARISH'
                                  ? "text-rose-400 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.2)]"
                                  : "text-primary bg-primary/15 hover:bg-primary/25 border border-primary/30 shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                                : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              setNoteModalStock({ symbol: item.symbol, price: item.price, name: item.name });
                              setIsNoteModalOpen(true);
                            }}
                            title={
                              stockNote
                                ? `Notes on ${item.symbol} (${stockNote.sentiment || 'Notes'})`
                                : `Write Notes for ${item.symbol}`
                            }
                          >
                            <FileText className="w-4 h-4" />
                          </Button>

                          {/* Price Alert Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-8 w-8 transition-colors",
                              activeAlert
                                ? "text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                                : "text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              setAlertModalStock({ symbol: item.symbol, price: item.price, name: item.name });
                              setIsAlertModalOpen(true);
                            }}
                            title={
                              activeAlert
                                ? `Active Alert: Target $${activeAlert.targetPrice.toFixed(2)} (${activeAlert.condition})`
                                : 'Set Price Alert'
                            }
                          >
                            <Bell className={cn("w-4 h-4", activeAlert && "fill-amber-400/30")} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:bg-primary/20 hover:text-primary"
                            onClick={(e) => handleViewFullResearch(item.symbol, e)}
                            title="Open in Full Research Page"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => handleRemoveSymbol(item.symbol, e)}
                            title="Remove from Watchlist"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-Over Research Dossier Sheet */}
      <Sheet open={Boolean(drawerSymbol)} onOpenChange={(open) => !open && setDrawerSymbol(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto bg-background/95 backdrop-blur-2xl border-l border-primary/20 p-6 space-y-6">
          {drawerSymbol && (
            <>
              {/* Sheet Header */}
              <SheetHeader className="text-left border-b border-border/50 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
                  <div>
                    <div className="flex items-center gap-3">
                      <SheetTitle className="text-3xl font-black font-mono tracking-tight text-foreground">
                        {drawerSymbol}
                      </SheetTitle>
                      {drawerQuote?.sector && (
                        <Badge variant="outline" className="bg-accent/60 text-accent-foreground text-xs">
                          <Building2 className="w-3 h-3 mr-1" />
                          {drawerQuote.sector}
                        </Badge>
                      )}
                    </div>
                    <SheetDescription className="text-sm font-medium text-muted-foreground mt-0.5">
                      {drawerQuote?.shortName || drawerSymbol}
                    </SheetDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewFullResearch(drawerSymbol)}
                      className="gap-1.5 text-xs border-primary/30 hover:bg-primary/10 text-primary"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Full Research Page
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              {/* Drawer Content */}
              {isDrawerDossierLoading ? (
                <div className="h-64 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground animate-pulse">Compiling real-time dossier for {drawerSymbol}...</p>
                </div>
              ) : drawerQuote ? (
                <div className="space-y-6">
                  {/* Big Price & Action Hero */}
                  <Card className="bg-card/70 border-primary/15 shadow-lg overflow-hidden">
                    <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Market Price</span>
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-green-500/30 text-green-500 bg-green-500/10 font-bold">
                            <Activity className="w-3 h-3" /> Live Quote
                          </span>
                        </div>
                        <div className="flex items-baseline gap-3">
                          <span className="text-4xl font-black font-mono text-foreground">
                            ${safeFixed(drawerQuote.regularMarketPrice)}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "px-2.5 py-1 text-xs font-mono font-bold border",
                              drawerPriceIsUp
                                ? "bg-success/10 text-success border-success/30"
                                : "bg-destructive/10 text-destructive border-destructive/30"
                            )}
                          >
                            {drawerPriceIsUp ? <TrendingUp className="w-3.5 h-3.5 mr-1 inline" /> : <TrendingDown className="w-3.5 h-3.5 mr-1 inline" />}
                            {formatChangePercent(drawerQuote.regularMarketChangePercent)} ({drawerPriceIsUp ? '+' : ''}${safeFixed(drawerQuote.regularMarketChange)})
                          </Badge>
                        </div>
                      </div>

                      {/* Report Type Selector & Autonomous PDF Report Button */}
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <select
                          value={drawerReportSlug}
                          onChange={(e) => setDrawerReportSlug(e.target.value)}
                          className="bg-card/80 border border-border/80 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer h-9 shrink-0 max-w-[160px]"
                        >
                          {reportPrompts.map((p) => (
                            <option key={p.id} value={p.slug} className="bg-popover text-popover-foreground">
                              {p.name}
                            </option>
                          ))}
                        </select>

                        <Button
                          variant="glow"
                          size="sm"
                          onClick={() => handleGenerateAutonomousReport(drawerSymbol)}
                          disabled={isGeneratingPdf}
                          className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shrink-0 h-9 text-xs"
                        >
                          {isGeneratingPdf ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Synthesizing Report...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                              Generate Report
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Drawer Tabs */}
                  <Tabs value={drawerTab} onValueChange={setDrawerTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto sm:h-10 items-center bg-card/60 p-1 border border-border/50 rounded-xl gap-1">
                      <TabsTrigger value="overview" className="text-xs rounded-lg py-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-semibold">Overview</TabsTrigger>
                      <TabsTrigger value="fundamentals" className="text-xs rounded-lg py-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-semibold">Fundamentals</TabsTrigger>
                      <TabsTrigger value="news" className="text-xs rounded-lg py-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-semibold">News</TabsTrigger>
                      <TabsTrigger value="ai" className="text-xs rounded-lg py-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary flex items-center justify-center gap-1 font-semibold">
                        <Sparkles className="w-3 h-3 text-purple-400" /> AI
                      </TabsTrigger>
                      <TabsTrigger value="reports" className="text-xs rounded-lg py-1.5 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300 flex items-center justify-center gap-1 font-semibold">
                        <FileText className="w-3 h-3 text-purple-400" /> Reports
                        {drawerSavedReports.length > 0 && (
                          <span className="ml-1 px-1 py-0.2 rounded-full bg-purple-500/20 text-purple-300 text-[9px] font-mono font-bold">
                            {drawerSavedReports.length}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="notes" className="text-xs rounded-lg py-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary flex items-center justify-center gap-1 font-semibold">
                        <FileText className="w-3 h-3 text-primary" /> Notes
                      </TabsTrigger>
                    </TabsList>

                    {/* OVERVIEW */}
                    <TabsContent value="overview" className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Card className="bg-card/40 border-border/60 p-3">
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Market Cap</p>
                          <p className="font-mono text-base font-bold mt-1 text-foreground">{formatNumber(drawerFundamentals?.marketCap)}</p>
                        </Card>
                        <Card className="bg-card/40 border-border/60 p-3">
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">P/E Ratio</p>
                          <p className="font-mono text-base font-bold mt-1 text-foreground">{safeFixed(drawerFundamentals?.trailingPE)}</p>
                        </Card>
                        <Card className="bg-card/40 border-border/60 p-3">
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Day Volume</p>
                          <p className="font-mono text-base font-bold mt-1 text-foreground">{formatNumber(drawerTechnicals?.volume)}</p>
                        </Card>
                        <Card className="bg-card/40 border-border/60 p-3">
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Avg Volume</p>
                          <p className="font-mono text-base font-bold mt-1 text-foreground">{formatNumber(drawerTechnicals?.averageVolume)}</p>
                        </Card>
                      </div>

                      {/* 52-Week Range Bar */}
                      <Card className="bg-card/40 border-border/60 p-4">
                        <div className="flex justify-between items-center text-xs font-semibold uppercase text-muted-foreground mb-2">
                          <span className="flex items-center gap-1"><LineChart className="w-3.5 h-3.5 text-primary" /> 52-Week Price Range</span>
                          <span className="font-mono font-medium text-foreground">
                            ${safeFixed(drawerTechnicals?.fiftyTwoWeekLow)} - ${safeFixed(drawerTechnicals?.fiftyTwoWeekHigh)}
                          </span>
                        </div>
                        <div className="relative h-2.5 bg-accent/60 rounded-full overflow-hidden">
                          <div className="absolute h-full bg-gradient-to-r from-destructive via-warning to-success w-full" />
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-foreground rounded-full border-2 border-background shadow"
                            style={{
                              left: `${Math.min(100, Math.max(0, (((drawerQuote?.regularMarketPrice || 0) - (drawerTechnicals?.fiftyTwoWeekLow || 0)) / ((drawerTechnicals?.fiftyTwoWeekHigh || 1) - (drawerTechnicals?.fiftyTwoWeekLow || 0))) * 100))}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                          />
                        </div>
                      </Card>

                      {/* Company Summary */}
                      {drawerProfile?.longBusinessSummary && (
                        <Card className="bg-card/40 border-border/60 p-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Company Overview</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {drawerProfile.longBusinessSummary}
                          </p>
                        </Card>
                      )}
                    </TabsContent>

                    {/* FUNDAMENTALS */}
                    <TabsContent value="fundamentals" className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Valuation */}
                        <Card className="bg-card/40 border-border/60 p-4 space-y-3">
                          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                            <PieChart className="w-4 h-4 text-primary" />
                            <h4 className="text-sm font-semibold text-foreground">Valuation & Multiples</h4>
                          </div>
                          <div className="flex justify-between text-xs py-1 border-b border-border/30">
                            <span className="text-muted-foreground">P/E Ratio (Trailing)</span>
                            <span className="font-mono font-bold">{safeFixed(drawerFundamentals?.trailingPE)}</span>
                          </div>
                          <div className="flex justify-between text-xs py-1 border-b border-border/30">
                            <span className="text-muted-foreground">P/E Ratio (Forward)</span>
                            <span className="font-mono font-bold">{safeFixed(drawerFundamentals?.forwardPE)}</span>
                          </div>
                          <div className="flex justify-between text-xs py-1 border-b border-border/30">
                            <span className="text-muted-foreground">Price to Sales (P/S)</span>
                            <span className="font-mono font-bold">{safeFixed(drawerFundamentals?.priceToSales)}</span>
                          </div>
                          <div className="flex justify-between text-xs py-1">
                            <span className="text-muted-foreground">Earnings Per Share (EPS)</span>
                            <span className="font-mono font-bold">${safeFixed(drawerFundamentals?.trailingEps)}</span>
                          </div>
                        </Card>

                        {/* Profitability & Health */}
                        <Card className="bg-card/40 border-border/60 p-4 space-y-3">
                          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                            <Percent className="w-4 h-4 text-success" />
                            <h4 className="text-sm font-semibold text-foreground">Profitability & Quality</h4>
                          </div>
                          <div className="flex justify-between text-xs py-1 border-b border-border/30">
                            <span className="text-muted-foreground">Operating Margin</span>
                            <span className="font-mono font-bold text-success">{formatPercent(drawerFundamentals?.operatingMargins)}</span>
                          </div>
                          <div className="flex justify-between text-xs py-1 border-b border-border/30">
                            <span className="text-muted-foreground">Profit Margin</span>
                            <span className="font-mono font-bold">{formatPercent(drawerFundamentals?.profitMargins)}</span>
                          </div>
                          <div className="flex justify-between text-xs py-1 border-b border-border/30">
                            <span className="text-muted-foreground">Return on Equity (ROE)</span>
                            <span className="font-mono font-bold">{formatPercent(drawerFundamentals?.returnOnEquity)}</span>
                          </div>
                          <div className="flex justify-between text-xs py-1">
                            <span className="text-muted-foreground">Debt to Equity</span>
                            <span className="font-mono font-bold">{safeFixed(drawerFundamentals?.debtToEquity)}</span>
                          </div>
                        </Card>
                      </div>
                    </TabsContent>

                    {/* NEWS */}
                    <TabsContent value="news" className="mt-4 space-y-3">
                      {drawerNews.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No recent headlines found.</p>
                      ) : (
                        drawerNews.map((n: any, i: number) => (
                          <a
                            key={i}
                            href={n.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-3 rounded-xl bg-card/40 hover:bg-accent/40 border border-border/40 transition-colors group"
                          >
                            <h5 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                              {n.title}
                            </h5>
                            <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                              <span>{n.publisher}</span>
                              <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                            </div>
                          </a>
                        ))
                      )}
                    </TabsContent>

                    {/* AI ANALYSIS */}
                    <TabsContent value="ai" className="mt-4 space-y-4">
                      {isDrawerAiLoading ? (
                        <div className="py-8 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                          <p className="text-xs text-muted-foreground">Synthesizing AI Market Intelligence...</p>
                        </div>
                      ) : parsedDrawerAi ? (
                        <div className="space-y-4">
                          <Card className="bg-purple-950/20 border-purple-500/20 p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">AI Conviction Score</span>
                              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-sm font-mono font-black">
                                {parsedDrawerAi.conviction_score || 75} / 100
                              </Badge>
                            </div>
                            <p className="text-xs text-foreground/90 leading-relaxed">
                              {parsedDrawerAi.summary || parsedDrawerAi.thesis || 'Strong technical and fundamental alignment.'}
                            </p>
                          </Card>

                          {parsedDrawerAi.catalysts && (
                            <Card className="bg-card/40 border-border/60 p-4">
                              <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Key Growth Catalysts</h5>
                              <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                                {Array.isArray(parsedDrawerAi.catalysts)
                                  ? parsedDrawerAi.catalysts.map((c: string, idx: number) => <li key={idx}>{c}</li>)
                                  : <li>{parsedDrawerAi.catalysts}</li>}
                              </ul>
                            </Card>
                          )}
                        </div>
                      ) : (
                        <Card className="bg-card/40 border-border/60 p-4 text-center">
                          <Sparkles className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">Click "Generate Report" above to compile deep-dive AI analysis.</p>
                        </Card>
                      )}
                    </TabsContent>

                    {/* Notes & Thesis Tab Content */}
                    <TabsContent value="notes" className="space-y-4 pt-2">
                        {(() => {
                          const note = drawerSymbol ? notesMap[drawerSymbol.toUpperCase()] : null;
                          return (
                            <Card className="bg-card/70 border-border/60 p-5 space-y-4 shadow-md">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-sm text-foreground">
                                      Investment Notes & Thesis for {drawerSymbol}
                                    </h4>
                                    <p className="text-[11px] text-muted-foreground">
                                      {note?.updatedAt
                                        ? `Last updated on ${new Date(note.updatedAt).toLocaleDateString()}`
                                        : 'No notes saved yet'}
                                    </p>
                                  </div>
                                </div>

                                <Button
                                  variant="glow"
                                  size="sm"
                                  className="h-8 px-3 text-xs bg-primary text-primary-foreground gap-1.5"
                                  onClick={() => {
                                    if (drawerSymbol) {
                                      setNoteModalStock({
                                        symbol: drawerSymbol,
                                        name: drawerQuote?.shortName,
                                        price: drawerQuote?.regularMarketPrice,
                                      });
                                      setIsNoteModalOpen(true);
                                    }
                                  }}
                                >
                                  <Edit2 className="w-3 h-3" />
                                  {note ? 'Edit Notes' : 'Write Note'}
                                </Button>
                              </div>

                              {note ? (
                                <div className="space-y-3">
                                  {/* Badges */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {note.sentiment && (
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-xs px-2 py-0.5 font-semibold",
                                          note.sentiment === 'BULLISH'
                                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                            : note.sentiment === 'BEARISH'
                                            ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                                            : "bg-blue-500/20 text-blue-400 border-blue-500/40"
                                        )}
                                      >
                                        {note.sentiment === 'BULLISH' && <TrendingUp className="w-3 h-3 mr-1 inline" />}
                                        {note.sentiment === 'BEARISH' && <TrendingDown className="w-3 h-3 mr-1 inline" />}
                                        {note.sentiment}
                                      </Badge>
                                    )}
                                    {note.tags &&
                                      note.tags.split(',').map((t, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs px-2 py-0.5 bg-primary/10 text-primary">
                                          {t.trim()}
                                        </Badge>
                                      ))}
                                  </div>

                                  {/* Note Content Rendered in Markdown */}
                                  <div className="p-4 rounded-xl bg-background/60 border border-border/60 prose prose-invert prose-sm max-w-none">
                                    <ReactMarkdown>{note.content}</ReactMarkdown>
                                  </div>
                                </div>
                              ) : (
                                <div className="py-8 text-center bg-background/30 rounded-xl border border-dashed border-border/60 space-y-2">
                                  <p className="text-xs text-muted-foreground">
                                    Keep track of your conviction, catalysts, price targets, and trade plan for {drawerSymbol}.
                                  </p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => {
                                      if (drawerSymbol) {
                                        setNoteModalStock({
                                          symbol: drawerSymbol,
                                          name: drawerQuote?.shortName,
                                          price: drawerQuote?.regularMarketPrice,
                                        });
                                        setIsNoteModalOpen(true);
                                      }
                                    }}
                                  >
                                    <Plus className="w-3.5 h-3.5 mr-1" /> Add First Note
                                  </Button>
                                </div>
                              )}
                            </Card>
                          );
                        })()}
                    </TabsContent>

                    {/* AI REPORTS */}
                    <TabsContent value="reports" className="mt-4 space-y-4">
                      {drawerSymbol && (
                        <AutonomousReportsList symbol={drawerSymbol} compact={true} />
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              ) : (
                <p className="text-center text-sm text-destructive py-8">Failed to load dossier data.</p>
              )}
            </>
          )}
            </SheetContent>
          </Sheet>

          {/* Price Alert Modal */}
          <PriceAlertModal
            open={isAlertModalOpen}
            onOpenChange={setIsAlertModalOpen}
            initialSymbol={alertModalStock?.symbol || ''}
            initialPrice={alertModalStock?.price || 0}
            initialStockName={alertModalStock?.name || ''}
          />

          {/* Stock Note Modal */}
          <StockNoteModal
            isOpen={isNoteModalOpen}
            onClose={() => setIsNoteModalOpen(false)}
            symbol={noteModalStock?.symbol || ''}
            stockName={noteModalStock?.name}
            currentPrice={noteModalStock?.price}
          />

          {/* Autonomous Report Viewer Modal */}
          <AutonomousReportViewerModal
            report={drawerReportModalReport}
            isOpen={isDrawerReportModalOpen}
            onClose={() => {
              setIsDrawerReportModalOpen(false);
              setDrawerReportModalReport(null);
            }}
            onDeleteSuccess={() => {
              if (drawerSymbol) {
                queryClient.invalidateQueries({ queryKey: ['autonomousReports', drawerSymbol] });
              }
              queryClient.invalidateQueries({ queryKey: ['allAutonomousReports'] });
            }}
          />
        </div>
      );
    }

