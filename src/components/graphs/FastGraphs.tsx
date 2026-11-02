import React, { useState, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Layers,
  Calendar,
  Calculator,
  Info,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
  Check,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Eye,
  EyeOff,
  Search,
  Loader2
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { marketDataService, StockSearchResult } from '@/services/marketData';
import {
  useFastGraphs,
  FastGraphsMetricType,
  FastGraphsTimeframe,
  FastGraphsDataPoint,
  calculatePointToPointReturn,
  RateOfReturnResult
} from '@/services/fastGraphsService';
import { cn } from '@/lib/utils';

export interface FastGraphsProps {
  symbol: string;
  currentPrice?: number;
  onSelectSymbol?: (symbol: string) => void;
  onNavigateToResearch?: (symbol: string) => void;
  isFullPage?: boolean;
  onToggleFullPage?: () => void;
  className?: string;
}

const TIMEFRAMES: FastGraphsTimeframe[] = ['MAX', '10Y', '6Y', '5Y', '4Y', '3Y', '2Y', '1Y'];

const METRIC_OPTIONS: { value: FastGraphsMetricType; label: string }[] = [
  { value: 'ADJUSTED_EARNINGS', label: 'Adjusted (Operating) Earnings' },
  { value: 'BASIC_EARNINGS', label: 'Basic Earnings (GAAP)' },
  { value: 'OPERATING_CASH_FLOW', label: 'Operating Cash Flow (OCF)' },
  { value: 'FREE_CASH_FLOW', label: 'Free Cash Flow (FCF)' },
  { value: 'SALES', label: 'Sales / Revenue (S/R)' },
  { value: 'EBITDA', label: 'EBITDA' }
];

export const POPULAR_FG_TICKERS = [
  { symbol: 'SOFI', name: 'SoFi Technologies Inc' },
  { symbol: 'NU', name: 'Nu Holdings Ltd' },
  { symbol: 'CCK', name: 'Crown Holdings Inc' },
  { symbol: 'AAPL', name: 'Apple Inc' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'AMZN', name: 'Amazon.com Inc' },
  { symbol: 'GOOGL', name: 'Alphabet Inc' },
  { symbol: 'TSLA', name: 'Tesla Inc' },
  { symbol: 'SHOP.TO', name: 'Shopify Inc (TSX)' },
];

export function FastGraphs({
  symbol,
  currentPrice: overridePrice,
  onSelectSymbol,
  onNavigateToResearch,
  isFullPage = false,
  onToggleFullPage,
  className
}: FastGraphsProps) {
  const cleanSymbol = (symbol || 'SOFI').trim().toUpperCase();

  // Ticker search box state in header
  const [searchTicker, setSearchTicker] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [recentTickers, setRecentTickers] = useState<string[]>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('fast_graphs_recent_tickers') : null;
      return raw ? JSON.parse(raw) : ['SOFI', 'NU', 'CCK', 'AAPL'];
    } catch {
      return ['SOFI', 'NU', 'CCK', 'AAPL'];
    }
  });

  // Dynamic company suggestions state (same as Watchlist searchbox)
  const [searchSuggestions, setSearchSuggestions] = useState<StockSearchResult[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);

  // Debounced live company search as user types
  React.useEffect(() => {
    const trimmed = searchTicker.trim();
    if (trimmed.length < 1) {
      setSearchSuggestions([]);
      setIsSearchingSuggestions(false);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const results = await marketDataService.searchSymbols(trimmed);
        if (isMounted) {
          setSearchSuggestions((results || []).slice(0, 10));
        }
      } catch (err) {
        console.warn('FastGraphs suggestion search failed', err);
      } finally {
        if (isMounted) setIsSearchingSuggestions(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchTicker]);

  const handleClearRecents = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentTickers([]);
    try {
      localStorage.removeItem('fast_graphs_recent_tickers');
    } catch {}
  };

  const handleSelectTicker = (raw: string) => {
    const sym = raw.trim().toUpperCase();
    if (!sym) return;

    // Update recents
    const updated = [sym, ...recentTickers.filter((s) => s !== sym)].slice(0, 8);
    setRecentTickers(updated);
    try {
      localStorage.setItem('fast_graphs_recent_tickers', JSON.stringify(updated));
    } catch {}

    onSelectSymbol?.(sym);
    setSearchTicker('');
    setSearchSuggestions([]);
    setIsSearchOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTicker.trim()) {
      const trimmed = searchTicker.trim().toUpperCase();
      const exactMatch = searchSuggestions.find(
        (s) => s.symbol.toUpperCase() === trimmed
      );
      if (exactMatch) {
        handleSelectTicker(exactMatch.symbol);
      } else if (searchSuggestions.length > 0) {
        handleSelectTicker(searchSuggestions[0].symbol);
      } else {
        handleSelectTicker(trimmed);
      }
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Controls state
  const [timeframe, setTimeframe] = useState<FastGraphsTimeframe>('4Y');
  const [metric, setMetric] = useState<FastGraphsMetricType>('ADJUSTED_EARNINGS');

  // Legend visibility toggles
  const [showFairValue, setShowFairValue] = useState(true); // Orange Line
  const [showNormalPe, setShowNormalPe] = useState(true); // Blue Line
  const [showPrice, setShowPrice] = useState(true); // Black Line
  const [showDividends, setShowDividends] = useState(true); // Green area
  const [showEpsArea, setShowEpsArea] = useState(true); // Dark green earnings area

  // Rate of Return Tool selection state (point-to-point clicking)
  const [isRorToolActive, setIsRorToolActive] = useState(false);
  const [rorStartPoint, setRorStartPoint] = useState<FastGraphsDataPoint | null>(null);
  const [rorEndPoint, setRorEndPoint] = useState<FastGraphsDataPoint | null>(null);
  const [investedAmount, setInvestedAmount] = useState<number>(10000);

  // Hover state on future projection points
  const [hoveredProjection, setHoveredProjection] = useState<FastGraphsDataPoint | null>(null);

  // Data fetching
  const { data, isLoading, isError, error, refetch, isFetching } = useFastGraphs(
    cleanSymbol,
    timeframe,
    metric
  );

  const series = data?.series || [];
  const bottomStrip = data?.bottomStrip || [];
  const graphKey = data?.graphKey;
  const fastFacts = data?.fastFacts;
  const companyInfo = data?.companyInfo;
  const analystScorecard = data?.analystScorecard;
  const dividendTrends = data?.dividendTrends;

  // Split series into historical and future for dotted styling
  const boundaryIndex = useMemo(() => {
    return series.findIndex((pt) => pt.isEstimate || pt.isCurrentYearBoundary);
  }, [series]);

  const boundaryDate = useMemo(() => {
    if (boundaryIndex >= 0 && series[boundaryIndex]) {
      return series[boundaryIndex].date;
    }
    return null;
  }, [series, boundaryIndex]);

  // Point to point Rate of Return calculated result
  const rorResult: RateOfReturnResult | null = useMemo(() => {
    if (!rorStartPoint || !rorEndPoint || !graphKey) return null;
    return calculatePointToPointReturn(rorStartPoint, rorEndPoint, graphKey, investedAmount);
  }, [rorStartPoint, rorEndPoint, graphKey, investedAmount]);

  // Handle chart click for Rate of Return tool
  const handleChartClick = (e: any) => {
    if (!e || !e.activePayload || !e.activePayload[0]) return;
    const clickedPoint: FastGraphsDataPoint = e.activePayload[0].payload;
    if (!clickedPoint) return;

    if (!rorStartPoint || (rorStartPoint && rorEndPoint)) {
      setRorStartPoint(clickedPoint);
      setRorEndPoint(null);
      setIsRorToolActive(true);
    } else {
      // If clicking before start, make it start
      if (new Date(clickedPoint.date).getTime() < new Date(rorStartPoint.date).getTime()) {
        setRorEndPoint(rorStartPoint);
        setRorStartPoint(clickedPoint);
      } else {
        setRorEndPoint(clickedPoint);
      }
    }
  };

  const resetRorTool = () => {
    setRorStartPoint(null);
    setRorEndPoint(null);
    setIsRorToolActive(false);
  };

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] glass-card rounded-2xl border border-border/70 p-8 space-y-4">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <div className="text-center">
          <h3 className="font-bold text-foreground text-base">Generating FAST Graphs for {cleanSymbol}...</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Analyzing multi-year operating earnings, Graham-Dodd / Peter Lynch intrinsic multiples, and forward consensus estimates
          </p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] glass-card rounded-2xl border border-destructive/40 p-8 space-y-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <div className="text-center">
          <h3 className="font-bold text-foreground text-base">Unable to load FAST Graphs for {cleanSymbol}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Historical financial fundamentals or pricing could not be retrieved.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </Button>
      </div>
    );
  }

  const effectivePrice = overridePrice || data.currentPrice;

  return (
    <div className={cn("space-y-4 font-sans animate-fade-in", className)}>
      {/* ================= 1. HEADER & METRIC CONTROLS ================= */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-border/70 bg-card/80 backdrop-blur-xl shadow-lg flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        
        {/* Left: Ticker Summary Header & Searchbox */}
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2
                onClick={() => onNavigateToResearch && onNavigateToResearch(data.symbol)}
                className="text-xl sm:text-2xl font-black font-mono tracking-tight text-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5"
                title={`Open research dossier for ${data.symbol}`}
              >
                <span>{data.companyName}</span>
                <span className="text-muted-foreground font-semibold text-lg">({data.companyInfo.ticker})</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground/60 inline" />
              </h2>
            </div>

            <div className="flex items-center gap-2.5 mt-1 font-mono text-sm">
              <span className="text-base sm:text-lg font-bold text-foreground">
                USD {effectivePrice.toFixed(2)}
              </span>
              <div
                className={cn(
                  "font-semibold text-xs flex items-center gap-0.5",
                  data.priceChangePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                )}
              >
                {data.priceChangePercent >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>
                  {data.priceChange >= 0 ? '+' : ''}{data.priceChange.toFixed(2)} ({data.priceChangePercent >= 0 ? '+' : ''}{data.priceChangePercent}%)
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                At close: {data.lastCloseDate}
              </span>
            </div>
          </div>

          {/* Quick Ticker Search Box */}
          <div ref={searchContainerRef} className="relative min-w-[220px] sm:w-72 md:w-80">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none" />
              <Input
                data-testid="fast-graphs-ticker-search"
                value={searchTicker}
                onChange={(e) => {
                  setSearchTicker(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Search company or ticker (e.g. AAPL, SOFI, Shopify)..."
                autoComplete="off"
                spellCheck="false"
                className="h-9 pl-9 pr-8 text-xs font-medium bg-slate-900/90 border-border/80 focus:border-amber-500/80 rounded-xl text-foreground placeholder:text-muted-foreground/60 shadow-inner"
              />
              {isSearchingSuggestions ? (
                <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-primary pointer-events-none" />
              ) : searchTicker ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTicker('');
                    setSearchSuggestions([]);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                  title="Clear search text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </form>

            {/* Dropdown with recents & dynamic company suggestions (like Watchlist searchbox) */}
            {isSearchOpen && (
              <div
                data-testid="fast-graphs-search-dropdown"
                className="absolute left-0 right-0 sm:right-auto sm:w-[380px] top-full mt-1.5 bg-slate-900/98 backdrop-blur-xl border border-primary/30 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-1 text-xs max-h-[380px] overflow-y-auto"
              >
                {/* When user is typing a query */}
                {searchTicker.trim() ? (
                  <div className="space-y-1">
                    {/* Direct Analyze Button */}
                    <button
                      type="button"
                      onClick={() => handleSelectTicker(searchTicker)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-amber-400" />
                        <span>Analyze &quot;{searchTicker.trim().toUpperCase()}&quot; directly</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Searching status indicator */}
                    {isSearchingSuggestions && searchSuggestions.length === 0 && (
                      <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>Loading companies for &quot;{searchTicker}&quot;...</span>
                      </div>
                    )}

                    {/* Dynamic Company Suggestions */}
                    {searchSuggestions.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                          <span>Matching Companies ({searchSuggestions.length})</span>
                          {isSearchingSuggestions && (
                            <Loader2 className="w-3 h-3 animate-spin text-primary" />
                          )}
                        </div>
                        <div className="space-y-0.5 mt-0.5">
                          {searchSuggestions.map((item) => {
                            const isCanadian =
                              item.symbol.endsWith('.TO') ||
                              item.symbol.endsWith('.V') ||
                              item.stockExchange === 'TSX' ||
                              item.stockExchange === 'TSXV' ||
                              item.stockExchange === 'TOR' ||
                              item.stockExchange === 'VAN';
                            const exchangeLabel =
                              item.stockExchange === 'TOR'
                                ? 'TSX'
                                : item.stockExchange === 'VAN'
                                ? 'TSXV'
                                : item.stockExchange || (isCanadian ? 'TSX' : 'US');

                            return (
                              <button
                                key={item.symbol}
                                type="button"
                                onClick={() => handleSelectTicker(item.symbol)}
                                className={cn(
                                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors group cursor-pointer",
                                  cleanSymbol === item.symbol
                                    ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40"
                                    : "hover:bg-primary/15 text-foreground"
                                )}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="font-mono font-bold text-sm text-foreground group-hover:text-amber-400 transition-colors">
                                    {item.symbol}
                                  </span>
                                  <span className="text-xs text-muted-foreground truncate max-w-[170px] sm:max-w-[210px]">
                                    {item.name}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] px-1.5 py-0 font-mono shrink-0 font-semibold",
                                      isCanadian
                                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                        : "bg-slate-800 text-slate-300 border-slate-700"
                                    )}
                                  >
                                    {exchangeLabel}
                                  </Badge>
                                </div>
                                <span className="text-xs text-primary font-semibold flex items-center gap-1 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Open <ArrowRight className="w-3 h-3" />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* No Results Fallback */}
                    {!isSearchingSuggestions && searchSuggestions.length === 0 && (
                      <div className="py-3 px-2 text-center text-xs text-muted-foreground">
                        No companies found matching &quot;{searchTicker}&quot;. Press Enter to analyze ticker directly.
                      </div>
                    )}
                  </div>
                ) : (
                  /* When input is empty / initial focus */
                  <div className="space-y-2">
                    {/* Recent Tickers */}
                    {recentTickers.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          <span>Recent Tickers</span>
                          <button
                            type="button"
                            onClick={handleClearRecents}
                            className="hover:text-foreground text-[10px] lowercase text-muted-foreground transition-colors"
                          >
                            clear
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1 px-1 pt-0.5">
                          {recentTickers.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => handleSelectTicker(t)}
                              className={cn(
                                "px-2 py-1 rounded-md text-xs font-mono font-bold transition-colors cursor-pointer",
                                cleanSymbol === t
                                  ? "bg-amber-500 text-slate-950"
                                  : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Popular Benchmarks with Company Names */}
                    <div>
                      <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Popular Benchmarks
                      </div>
                      <div className="space-y-0.5 max-h-48 overflow-y-auto">
                        {POPULAR_FG_TICKERS.map((item) => {
                          const isCanadian = item.symbol.endsWith('.TO');
                          return (
                            <button
                              key={item.symbol}
                              type="button"
                              onClick={() => handleSelectTicker(item.symbol)}
                              className={cn(
                                "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer group",
                                cleanSymbol === item.symbol
                                  ? "bg-amber-500/15 text-amber-300 font-bold"
                                  : "hover:bg-slate-800 text-slate-300"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono font-bold text-xs">{item.symbol}</span>
                                <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                  {item.name}
                                </span>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1 py-0 font-mono shrink-0",
                                  isCanadian
                                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                    : "bg-slate-800 text-slate-400 border-slate-700"
                                )}
                              >
                                {isCanadian ? 'TSX' : 'US'}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Key Valuation Badges (FG Score, Blended P/E, Div Yield, Market Cap) */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* FG Score */}
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-xl px-3 py-1.5 text-center min-w-[70px] shadow-sm">
            <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider block">FG Score</span>
            <span className="font-mono font-black text-sm sm:text-base text-cyan-300">
              {data.companyInfo.fgScore}/100
            </span>
          </div>

          {/* Blended P/E */}
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl px-3 py-1.5 text-center min-w-[80px] shadow-sm">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">Blended P/E</span>
            <span className="font-mono font-black text-sm sm:text-base text-amber-300">
              {data.fastFacts.blendedPe ? `${data.fastFacts.blendedPe.toFixed(2)}x` : '--'}
            </span>
          </div>

          {/* Dividend Yield */}
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl px-3 py-1.5 text-center min-w-[75px] shadow-sm">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">Div Yield</span>
            <span className="font-mono font-black text-sm sm:text-base text-emerald-300">
              {data.fastFacts.divYield.toFixed(2)}%
            </span>
          </div>

          {/* Market Cap */}
          <div className="bg-slate-900/90 border border-purple-500/30 rounded-xl px-3.5 py-1.5 text-center min-w-[90px] shadow-sm">
            <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider block">Market Cap</span>
            <span className="font-mono font-black text-sm sm:text-base text-purple-300">
              {data.companyInfo.marketCapFormatted}
            </span>
          </div>

          {/* Refresh Action */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 w-9 rounded-xl border-border/80 hover:border-primary/50 text-muted-foreground hover:text-foreground"
            title="Refresh valuation data"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin text-primary")} />
          </Button>

          {/* Full Page Mode Trigger Button */}
          {onToggleFullPage && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleFullPage}
              className={cn(
                "h-9 px-3 gap-1.5 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer border",
                isFullPage
                  ? "border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-white"
                  : "border-cyan-500/50 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:text-white"
              )}
              title={isFullPage ? "Exit Full Page Mode (or press Escape)" : "Expand FAST Graphs to Full Page"}
            >
              {isFullPage ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Exit Full Page</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Full Page</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* ================= SECONDARY CONTROLS: METRIC SELECTOR & TIMEFRAME TOGGLES ================= */}
      <div className="glass-card rounded-2xl p-3 px-4 border border-border/70 bg-card/75 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 shadow-md">
        
        {/* Metric Selector: "Price Correlated with:" */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-bold text-amber-400 text-xs sm:text-sm">Price Correlated with:</span>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as FastGraphsMetricType)}
            className="h-8 text-xs font-semibold bg-slate-900 text-foreground border border-amber-500/40 rounded-xl px-3 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer shadow-inner"
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-slate-900 text-foreground">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Timeframe Toggles: MAX, 10Y, 6Y, 5Y, 4Y, 3Y, 2Y, 1Y */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-white/5 font-mono text-xs">
          {TIMEFRAMES.map((tf) => {
            const isActive = timeframe === tf;
            return (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all text-xs",
                  isActive
                    ? "bg-amber-500 text-slate-950 font-black shadow-md scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                {tf}
              </button>
            );
          })}
        </div>

        {/* Interactive Rate of Return Tool Toggle */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (isRorToolActive) {
                resetRorTool();
              } else {
                setIsRorToolActive(true);
                // Pre-populate with first and last points if available
                if (series.length >= 2) {
                  setRorStartPoint(series[0]);
                  setRorEndPoint(series[series.length - 1]);
                }
              }
            }}
            className={cn(
              "h-8 text-xs font-bold gap-1.5 rounded-xl border transition-all",
              isRorToolActive
                ? "bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm"
                : "border-border/70 hover:border-amber-500/40 text-muted-foreground hover:text-amber-300"
            )}
            title="Measure return and fundamental growth between two points on the chart"
          >
            <Calculator className="w-3.5 h-3.5 text-amber-400" />
            <span>Rate of Return Tool</span>
          </Button>

          {isRorToolActive && (
            <Button
              size="sm"
              variant="ghost"
              onClick={resetRorTool}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* ================= MAIN CONTENT: CHART AREA + SIDEBAR PANELS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* ================= 2. PRIMARY VALUATION CHART AREA ================= */}
        <div className="lg:col-span-9 flex flex-col space-y-3 min-w-0">
          
          <div className="glass-card rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
            
            {/* Rate of Return Pop-up Floating Overlay (Matching Screenshot 2) */}
            {isRorToolActive && rorResult && (
              <div className="absolute z-20 top-4 left-4 sm:left-6 max-w-sm w-full bg-slate-950/95 border border-amber-500/50 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl animate-fade-in text-xs font-mono space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <Calculator className="w-4 h-4" />
                    <span>Rate Of Return & CAGR</span>
                  </div>
                  <button
                    onClick={resetRorTool}
                    className="p-1 hover:text-foreground text-muted-foreground rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  {/* Start Point */}
                  <div className="space-y-1 bg-white/5 p-2 rounded-xl border border-white/5">
                    <span className="font-bold text-muted-foreground block text-[10px]">{rorResult.startDisplayDate}</span>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invested:</span>
                      <span className="font-bold text-white">${rorResult.invested.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price:</span>
                      <span className="font-bold text-white">${rorResult.startPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shares:</span>
                      <span className="font-bold text-white">{rorResult.shares}</span>
                    </div>
                    {rorResult.startPe && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">P/E:</span>
                        <span className="font-bold text-amber-300">{rorResult.startPe}x</span>
                      </div>
                    )}
                  </div>

                  {/* End Point */}
                  <div className="space-y-1 bg-white/5 p-2 rounded-xl border border-white/5">
                    <span className="font-bold text-muted-foreground block text-[10px]">{rorResult.endDisplayDate}</span>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Close Price:</span>
                      <span className="font-bold text-white">${rorResult.endPrice}</span>
                    </div>
                    {rorResult.endPe && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">P/E:</span>
                        <span className="font-bold text-amber-300">{rorResult.endPe}x</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fair Value:</span>
                      <span className="font-bold text-orange-400">${rorResult.fairValueEndPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Normal P/E:</span>
                      <span className="font-bold text-blue-400">${rorResult.normalPeEndPrice}</span>
                    </div>
                  </div>
                </div>

                {/* Return Summary */}
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-sans">Market Value:</span>
                    <span className="font-bold text-white text-sm">${rorResult.marketValue.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-sans">Total Return:</span>
                    <span className={cn("font-bold text-sm", rorResult.totalReturnPct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {rorResult.totalReturnPct >= 0 ? '+' : ''}{rorResult.totalReturnPct}% ({rorResult.marketValueChange >= 0 ? '+' : ''}${rorResult.marketValueChange.toLocaleString()})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-sans">Annualized CAGR:</span>
                    <span className={cn("font-bold", rorResult.annualizedCagrPct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {rorResult.annualizedCagrPct >= 0 ? '+' : ''}{rorResult.annualizedCagrPct}%
                    </span>
                  </div>
                </div>

                {/* Fundamental Metric CAGR Badge (Screenshot 2 highlight) */}
                {rorResult.metricCagrPct !== null && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                    <span className="font-sans font-bold text-xs uppercase tracking-wider">EPS CAGR</span>
                    <Badge className="bg-emerald-500 text-slate-950 font-black text-xs px-2 py-0.5">
                      {rorResult.metricCagrPct >= 0 ? '+' : ''}{rorResult.metricCagrPct}%
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Hover Inspection Tooltip on Future Projection Points (Screenshot 1) */}
            {hoveredProjection && (
              <div className="absolute z-20 top-4 right-4 sm:right-6 max-w-xs w-full bg-slate-950/95 border border-primary/40 rounded-2xl p-3.5 shadow-2xl backdrop-blur-2xl animate-fade-in text-xs font-mono space-y-2">
                <div className="font-bold text-foreground border-b border-white/10 pb-1.5 flex items-center justify-between">
                  <span>{hoveredProjection.displayDate}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">
                    Consensus Estimate
                  </Badge>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="grid grid-cols-3 font-semibold text-muted-foreground text-[10px] pb-0.5 border-b border-white/5">
                    <span>Target</span>
                    <span className="text-center">Multiple</span>
                    <span className="text-right">Price</span>
                  </div>

                  {/* Fair Value Line Multiple */}
                  <div className="grid grid-cols-3 items-center">
                    <span className="flex items-center gap-1 text-orange-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Fair Value
                    </span>
                    <span className="text-center font-bold text-white">{graphKey?.fairValueRatio}x</span>
                    <span className="text-right font-bold text-orange-300">${hoveredProjection.fairValuePrice}</span>
                  </div>

                  {/* Normal P/E Line Multiple */}
                  <div className="grid grid-cols-3 items-center">
                    <span className="flex items-center gap-1 text-blue-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Normal P/E
                    </span>
                    <span className="text-center font-bold text-white">{graphKey?.normalPeRatio}x</span>
                    <span className="text-right font-bold text-blue-300">${hoveredProjection.normalPrice}</span>
                  </div>

                  <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-sans">Est. Metric / EPS:</span>
                    <span className="font-bold text-emerald-400 text-sm">${hoveredProjection.metricValue}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Recharts SVG Visualization */}
            <div className={cn("w-full transition-all duration-300", isFullPage ? "h-[620px] lg:h-[720px]" : "h-[480px] sm:h-[540px]")}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={series}
                  margin={{ top: 15, right: 25, left: 5, bottom: 5 }}
                  onClick={handleChartClick}
                >
                  <defs>
                    {/* Dark Green Gradient for Earnings Area under Orange Fair Value Line */}
                    <linearGradient id="fastGraphsEarningsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2d6a4f" stopOpacity={0.85} />
                      <stop offset="95%" stopColor="#1b4332" stopOpacity={0.55} />
                    </linearGradient>

                    {/* Light Green Gradient for Dividend Overlay */}
                    <linearGradient id="fastGraphsDividendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#52b788" stopOpacity={0.75} />
                      <stop offset="95%" stopColor="#40916c" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={true} />

                  <XAxis
                    dataKey="displayDate"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />

                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickFormatter={(val) => `$${val}`}
                    domain={['auto', 'auto']}
                    orientation="left"
                    tickLine={false}
                  />

                  {/* Vertical boundary line dividing Historical from Future Projections */}
                  {boundaryDate && (
                    <ReferenceLine
                      x={boundaryDate}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{
                        value: 'TODAY / EST. BOUNDARY',
                        fill: '#f59e0b',
                        fontSize: 10,
                        fontWeight: 'bold',
                        position: 'top'
                      }}
                    />
                  )}

                  {/* Range highlight for Rate of Return tool */}
                  {rorStartPoint && rorEndPoint && (
                    <ReferenceArea
                      x1={rorStartPoint.displayDate}
                      x2={rorEndPoint.displayDate}
                      fill="rgba(245, 158, 11, 0.15)"
                      stroke="rgba(245, 158, 11, 0.5)"
                      strokeDasharray="2 2"
                    />
                  )}

                  {/* Tooltip */}
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const pt: FastGraphsDataPoint = payload[0]?.payload;
                      if (!pt) return null;

                      // Trigger future projection card if in estimate zone
                      if (pt.isEstimate && !hoveredProjection) {
                        setHoveredProjection(pt);
                      } else if (!pt.isEstimate && hoveredProjection) {
                        setHoveredProjection(null);
                      }

                      return (
                        <div className="bg-slate-950/95 border border-border/80 rounded-xl p-3 shadow-2xl font-mono text-xs space-y-1.5 backdrop-blur-md">
                          <div className="font-bold text-foreground border-b border-white/10 pb-1 flex items-center justify-between gap-3">
                            <span>{pt.displayDate}</span>
                            {pt.isEstimate && (
                              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[9px] px-1 py-0">
                                Estimated
                              </Badge>
                            )}
                          </div>

                          {pt.price !== null && (
                            <div className="flex justify-between gap-4">
                              <span className="text-white font-bold flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-white inline-block" /> Price:
                              </span>
                              <span className="font-bold text-white">${pt.price.toFixed(2)}</span>
                            </div>
                          )}

                          <div className="flex justify-between gap-4">
                            <span className="text-orange-400 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Fair Value ({graphKey?.fairValueRatio}x):
                            </span>
                            <span className="font-bold text-orange-300">${pt.fairValuePrice}</span>
                          </div>

                          <div className="flex justify-between gap-4">
                            <span className="text-blue-400 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Normal P/E ({graphKey?.normalPeRatio}x):
                            </span>
                            <span className="font-bold text-blue-300">${pt.normalPrice}</span>
                          </div>

                          <div className="flex justify-between gap-4 pt-1 border-t border-white/5">
                            <span className="text-muted-foreground">{data.metricLabel}:</span>
                            <span className="font-bold text-emerald-400">${pt.metricValue}</span>
                          </div>

                          {pt.dividend && (
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Dividend:</span>
                              <span className="font-bold text-cyan-300">${pt.dividend}</span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />

                  {/* 1. Dark Green Fill Area representing Earnings Power (Under Orange Line) */}
                  {showEpsArea && (
                    <Area
                      type="monotone"
                      dataKey="fairValuePrice"
                      stroke="none"
                      fill="url(#fastGraphsEarningsFill)"
                      fillOpacity={0.85}
                      isAnimationActive={false}
                    />
                  )}

                  {/* 2. Light Green Fill representing Dividends Area (if dividend paying) */}
                  {showDividends && dividendTrends?.hasDividends && (
                    <Area
                      type="monotone"
                      dataKey="dividend"
                      stroke="none"
                      fill="url(#fastGraphsDividendFill)"
                      fillOpacity={0.65}
                      isAnimationActive={false}
                    />
                  )}

                  {/* 3. Orange Line (Intrinsic Fair Value: Peter Lynch P/E=G or Graham-Dodd) */}
                  {showFairValue && (
                    <Line
                      type="monotone"
                      dataKey="fairValuePrice"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (payload?.isEstimate) {
                          return (
                            <circle
                              key={`fv-dot-${payload.date}`}
                              cx={cx}
                              cy={cy}
                              r={4}
                              fill="#ffffff"
                              stroke="#f97316"
                              strokeWidth={2}
                            />
                          );
                        }
                        return null;
                      }}
                      strokeDasharray={(entry: any) => (entry?.isEstimate ? '5 5' : undefined)}
                      isAnimationActive={false}
                    />
                  )}

                  {/* 4. Blue Line (Normal Historical Multiple) */}
                  {showNormalPe && (
                    <Line
                      type="monotone"
                      dataKey="normalPrice"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (payload?.isEstimate) {
                          return (
                            <circle
                              key={`norm-dot-${payload.date}`}
                              cx={cx}
                              cy={cy}
                              r={4}
                              fill="#ffffff"
                              stroke="#3b82f6"
                              strokeWidth={2}
                            />
                          );
                        }
                        return null;
                      }}
                      isAnimationActive={false}
                    />
                  )}

                  {/* 5. Black / High-Contrast Line (Historical & Current Market Price) */}
                  {showPrice && (
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#ffffff"
                      strokeWidth={2.2}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* ================= 3. BOTTOM DATA ALIGNMENT STRIP ================= */}
            <div className="mt-3 border-t border-border/80 pt-3 overflow-x-auto">
              <div className="min-w-[680px]">
                {/* Headers */}
                <div className="grid grid-cols-12 gap-1 text-[10.5px] uppercase font-bold text-muted-foreground pb-1.5 border-b border-white/5">
                  <div className="col-span-2 font-mono text-left">Metric Strip</div>
                  <div className="col-span-10 grid grid-flow-col auto-cols-fr text-center">
                    {bottomStrip.map((item) => (
                      <span key={`header-${item.fyDate}`} className={cn("font-mono", item.isEstimate && "text-amber-400")}>
                        {item.fyDate}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Row 1: FY Date */}
                <div className="grid grid-cols-12 gap-1 text-[11px] font-mono py-1 border-b border-white/5 items-center">
                  <span className="col-span-2 text-muted-foreground font-semibold text-left">FY Date</span>
                  <div className="col-span-10 grid grid-flow-col auto-cols-fr text-center font-bold text-foreground">
                    {bottomStrip.map((item) => (
                      <span key={`date-${item.fyDate}`}>{item.fyDate}</span>
                    ))}
                  </div>
                </div>

                {/* Row 2: Metric / EPS */}
                <div className="grid grid-cols-12 gap-1 text-[11px] font-mono py-1 border-b border-white/5 items-center bg-white/[0.02]">
                  <span className="col-span-2 text-muted-foreground font-semibold text-left">EPS / Metric</span>
                  <div className="col-span-10 grid grid-flow-col auto-cols-fr text-center font-black text-emerald-400">
                    {bottomStrip.map((item) => (
                      <span key={`eps-${item.fyDate}`}>{item.metricValue}</span>
                    ))}
                  </div>
                </div>

                {/* Row 3: Chg/Yr (YoY % Growth Rate) */}
                <div className="grid grid-cols-12 gap-1 text-[11px] font-mono py-1 border-b border-white/5 items-center">
                  <span className="col-span-2 text-muted-foreground font-semibold text-left">Chg/Yr</span>
                  <div className="col-span-10 grid grid-flow-col auto-cols-fr text-center font-bold">
                    {bottomStrip.map((item) => {
                      const isNegative = item.chgYrNum !== null && item.chgYrNum < 0;
                      return (
                        <span
                          key={`chg-${item.fyDate}`}
                          className={cn(isNegative ? "text-rose-400" : "text-emerald-400")}
                        >
                          {item.chgYr}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Row 4: Div (Dividends Paid Per Share) */}
                <div className="grid grid-cols-12 gap-1 text-[11px] font-mono py-1 items-center bg-white/[0.02]">
                  <span className="col-span-2 text-muted-foreground font-semibold text-left">Div</span>
                  <div className="col-span-10 grid grid-flow-col auto-cols-fr text-center text-cyan-300 font-medium">
                    {bottomStrip.map((item) => (
                      <span key={`div-${item.fyDate}`}>{item.div}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ================= LEGEND TOGGLES ================= */}
            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Fair Value Ratio Toggle */}
                <button
                  onClick={() => setShowFairValue(!showFairValue)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all",
                    showFairValue
                      ? "bg-orange-500/15 text-orange-400 border-orange-500/40"
                      : "bg-muted/30 text-muted-foreground/60 border-transparent opacity-60"
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                  <span>Fair Value Ratio ({graphKey?.fairValueRatio}x)</span>
                </button>

                {/* Normal PE Toggle */}
                <button
                  onClick={() => setShowNormalPe(!showNormalPe)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all",
                    showNormalPe
                      ? "bg-blue-500/15 text-blue-400 border-blue-500/40"
                      : "bg-muted/30 text-muted-foreground/60 border-transparent opacity-60"
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  <span>Normal P/E ({graphKey?.normalPeRatio}x)</span>
                </button>

                {/* Price Toggle */}
                <button
                  onClick={() => setShowPrice(!showPrice)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all",
                    showPrice
                      ? "bg-white/10 text-white border-white/30"
                      : "bg-muted/30 text-muted-foreground/60 border-transparent opacity-60"
                  )}
                >
                  <span className="w-2.5 h-0.5 bg-white inline-block" />
                  <span>Price</span>
                </button>

                {/* Earnings Area Toggle */}
                <button
                  onClick={() => setShowEpsArea(!showEpsArea)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all",
                    showEpsArea
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                      : "bg-muted/30 text-muted-foreground/60 border-transparent opacity-60"
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded bg-emerald-700 inline-block" />
                  <span>Earnings Volume Area</span>
                </button>

                {/* Dividends Toggle */}
                {dividendTrends?.hasDividends && (
                  <button
                    onClick={() => setShowDividends(!showDividends)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all",
                      showDividends
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                        : "bg-muted/30 text-muted-foreground/60 border-transparent opacity-60"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                    <span>Dividends Declared</span>
                  </button>
                )}
              </div>

              <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Click 2 points on chart for Rate of Return</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 4. SIDEBAR PANELS ================= */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Panel A: FAST Facts */}
          <Card className="p-4 bg-card/75 border-border/70 backdrop-blur-xl rounded-2xl space-y-3 shadow-md">
            <div className="flex items-center gap-1.5 border-b border-border/40 pb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className="font-bold text-sm text-foreground">FAST Facts</h4>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Previous close:</span>
                <span className="font-bold text-white">USD {fastFacts?.previousClose.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Blended P/E:</span>
                <span className="font-bold text-amber-300">{fastFacts?.blendedPe ? `${fastFacts.blendedPe.toFixed(2)}x` : '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">EPS Yld:</span>
                <span className="font-bold text-emerald-400">{fastFacts?.epsYield.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Div Yld:</span>
                <span className="font-bold text-cyan-300">{fastFacts?.divYield.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">TYPE:</span>
                <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0">
                  {fastFacts?.type || 'SHARE'}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Panel B: Graph Key */}
          <Card className="p-4 bg-card/75 border-border/70 backdrop-blur-xl rounded-2xl space-y-3 shadow-md">
            <div className="flex items-center gap-1.5 border-b border-border/40 pb-2">
              <Info className="w-4 h-4 text-cyan-400" />
              <h4 className="font-bold text-sm text-foreground">Graph Key</h4>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div>
                <span className="text-[11px] text-muted-foreground block truncate">{graphKey?.metricName}</span>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-muted-foreground">Growth Rate:</span>
                  <span className="font-bold text-emerald-400">
                    {graphKey?.growthRate !== undefined ? `${graphKey.growthRate.toFixed(2)}%` : '--'}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-white/5">
                <span className="text-muted-foreground">Fair Value Ratio:</span>
                <span className="font-bold text-orange-400">{graphKey?.fairValueRatio.toFixed(2)}x</span>
              </div>
              <span className="text-[10px] text-muted-foreground/80 block font-sans italic">
                Formula: {graphKey?.fairValueFormula}
              </span>

              <div className="flex justify-between items-center pt-1 border-t border-white/5">
                <span className="text-muted-foreground">Normal P/E Ratio:</span>
                <span className="font-bold text-blue-400">{graphKey?.normalPeRatio.toFixed(2)}x</span>
              </div>
            </div>
          </Card>

          {/* Panel C: Dividend Trends (if dividend paying) */}
          {dividendTrends?.hasDividends && (
            <Card className="p-4 bg-card/75 border-border/70 backdrop-blur-xl rounded-2xl space-y-3 shadow-md">
              <div className="flex items-center gap-1.5 border-b border-border/40 pb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-sm text-foreground">Dividend Trends</h4>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Dividend CAGR:</span>
                  <span className="font-bold text-emerald-400">
                    {dividendTrends.dividendCagr ? `${dividendTrends.dividendCagr}%` : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Avg Div Growth:</span>
                  <span className="font-bold text-emerald-400">
                    {dividendTrends.avgDivGrowth ? `${dividendTrends.avgDivGrowth}%` : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Normal Yield:</span>
                  <span className="font-bold text-cyan-300">
                    {dividendTrends.normalYield ? `${dividendTrends.normalYield}%` : '--'}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Panel D: Company Info */}
          <Card className="p-4 bg-card/75 border-border/70 backdrop-blur-xl rounded-2xl space-y-3 shadow-md">
            <div className="flex items-center gap-1.5 border-b border-border/40 pb-2">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <h4 className="font-bold text-sm text-foreground">Company Info</h4>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-start gap-2">
                <span className="text-muted-foreground font-sans">GICS Sub-ind:</span>
                <span className="font-bold text-foreground text-right truncate max-w-[150px]">
                  {companyInfo?.gicsSubIndustry}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">Country:</span>
                <span className="font-bold text-foreground">{companyInfo?.country}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">Market Cap:</span>
                <span className="font-bold text-purple-300">{companyInfo?.marketCapFormatted}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">S&P Credit Rating:</span>
                <Badge variant="outline" className="text-[10px] font-bold border-cyan-500/40 text-cyan-300 bg-cyan-500/10 px-1.5 py-0">
                  {companyInfo?.spCreditRating || 'NR'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">LT Debt/Capital:</span>
                <span className="font-bold text-amber-300">{companyInfo?.ltDebtToCapital}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">TEV:</span>
                <span className="font-bold text-white">{companyInfo?.tevFormatted}</span>
              </div>
            </div>
          </Card>

          {/* Panel E: Analyst Scorecard */}
          <Card className="p-4 bg-card/75 border-border/70 backdrop-blur-xl rounded-2xl space-y-3 shadow-md">
            <div className="flex items-center gap-1.5 border-b border-border/40 pb-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <h4 className="font-bold text-sm text-foreground">Analyst Scorecard</h4>
            </div>

            <div className="space-y-3 text-xs font-mono">
              {/* 1Y Forward */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground font-sans block">1Y Forward</span>
                <div className="grid grid-cols-3 gap-1 text-[11px]">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    <span className="text-muted-foreground">Beat:</span>
                    <span className="font-bold text-emerald-400">{analystScorecard?.oneYearForward.beatPct}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                    <span className="text-muted-foreground">Hit:</span>
                    <span className="font-bold text-cyan-400">{analystScorecard?.oneYearForward.hitPct}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                    <span className="text-muted-foreground">Miss:</span>
                    <span className="font-bold text-rose-400">{analystScorecard?.oneYearForward.missPct}%</span>
                  </div>
                </div>
              </div>

              {/* 2Y Forward */}
              <div className="space-y-1 pt-2 border-t border-white/5">
                <span className="text-[11px] font-bold text-muted-foreground font-sans block">2Y Forward</span>
                <div className="grid grid-cols-3 gap-1 text-[11px]">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    <span className="text-muted-foreground">Beat:</span>
                    <span className="font-bold text-emerald-400">{analystScorecard?.twoYearForward.beatPct}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                    <span className="text-muted-foreground">Hit:</span>
                    <span className="font-bold text-cyan-400">{analystScorecard?.twoYearForward.hitPct}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                    <span className="text-muted-foreground">Miss:</span>
                    <span className="font-bold text-rose-400">{analystScorecard?.twoYearForward.missPct}%</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
