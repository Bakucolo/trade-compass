import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { BarChart3, Building2, DollarSign, Percent, Search, TrendingDown, TrendingUp, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { marketDataService, USE_STREAMING } from '../services/marketData';
import { tastyStreamer, StreamerData } from '../services/tastytradeStreamer';
import { Activity, ArrowDown, ArrowUp } from 'lucide-react';

// Simple debounce hook implementation if not available
function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export function ResearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounceValue(searchQuery, 500);
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');

  // Real-time Streaming State
  const [streamingData, setStreamingData] = useState<Partial<StreamerData>>({});

  useEffect(() => {
    if (selectedSymbol && USE_STREAMING) {
      setStreamingData({}); // Reset on symbol change
      tastyStreamer.connect(selectedSymbol);

      const handleUpdate = (data: StreamerData) => {
        setStreamingData(prev => ({ ...prev, ...data }));
      };

      tastyStreamer.subscribe(handleUpdate);

      return () => {
        tastyStreamer.unsubscribe(handleUpdate);
        tastyStreamer.disconnect();
      };
    }
  }, [selectedSymbol]);




  // Search Query
  const { data: searchResults, isLoading: isSearchLoading, isError: isSearchError, error: searchError } = useQuery({
    queryKey: ['stockSearch', debouncedSearch],
    queryFn: () => marketDataService.searchSymbols(debouncedSearch),
    enabled: debouncedSearch.length > 0,
  });

  // Data Queries for Selected Stock
  const { data: quote, isLoading: isQuoteLoading, error: quoteError, isError: isQuoteError } = useQuery({
    queryKey: ['stockQuote', selectedSymbol],
    queryFn: () => marketDataService.getQuote(selectedSymbol),
    enabled: !!selectedSymbol,
    retry: false
  });

  const { data: profile } = useQuery({
    queryKey: ['stockProfile', selectedSymbol],
    queryFn: () => marketDataService.getProfile(selectedSymbol),
    enabled: !!selectedSymbol,
    retry: false
  });

  // Combined Financials Query (Manual Calculation)
  const { data: financials } = useQuery({
    queryKey: ['stockFinancials', selectedSymbol],
    queryFn: () => marketDataService.getFinancials(selectedSymbol),
    enabled: !!selectedSymbol,
    retry: false
  });

  const isLoading = isQuoteLoading;

  // Format helper
  const formatNumber = (num: number | undefined | any) => {
    if (num === undefined || num === null) return 'N/A';
    const val = Number(num);
    if (isNaN(val)) return 'N/A';

    if (val >= 1e12) return (val / 1e12).toFixed(2) + 'T';
    if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    return val.toLocaleString();
  };

  // Helper to safely format percentages and prices
  const safeFixed = (val: number | undefined | null | any, decimals: number = 2) => {
    if (val === undefined || val === null) return '0.00';
    const num = Number(val);
    if (isNaN(num)) return '0.00';
    return num.toFixed(decimals);
  }

  // Merge Static and Streaming Data
  const currentPrice = streamingData.price || quote?.price;
  const currentChange = streamingData.change || quote?.change;
  const currentChangePercent = streamingData.changePercent || quote?.changesPercentage;
  const isStreaming = !!streamingData.price;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Stock Research</h1>
        <p className="text-muted-foreground">Analyze fundamentals and technical indicators (Real-time Data)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Search & List */}
        <div className="glass-card rounded-xl p-4 h-[600px] flex flex-col">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search (e.g., MSFT)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-accent border-border"
            />
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2">
            {isSearchLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
            ) : isSearchError ? (
              <div className="p-4 text-center text-destructive text-sm">
                Error searching: {searchError instanceof Error ? searchError.message : 'Unknown'}
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              searchResults.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => setSelectedSymbol(stock.symbol)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg transition-all",
                    selectedSymbol === stock.symbol
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className="text-left">
                    <p className="font-semibold text-foreground ticker-symbol">{stock.symbol}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[150px]">{stock.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground">{stock.stockExchange}</span>
                  </div>
                </button>
              ))
            ) : debouncedSearch.length > 0 ? (
              <div className="text-center text-muted-foreground p-4">
                No results found for "{debouncedSearch}"
              </div>
            ) : (
              <div className="text-center text-muted-foreground p-4">
                Type to search for stocks...
              </div>
            )}

            {/* Show selected stock even if not in search results (initial state) */}
            {!searchQuery && selectedSymbol && !searchResults && (
              <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                <p className="font-semibold text-foreground">{selectedSymbol}</p>
                <p className="text-xs text-muted-foreground">Currently Viewing</p>
              </div>
            )}
          </div>
        </div>

        {/* Stock Details */}
        <div className="lg:col-span-2 space-y-6">
          {isLoading ? (
            <div className="glass-card rounded-xl p-6 flex justify-center items-center h-[200px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isQuoteError ? (
            <div className="glass-card rounded-xl p-6">
              <div className="text-center text-destructive mb-2">Error loading data</div>
              <div className="text-center text-sm text-muted-foreground bg-destructive/10 p-4 rounded-lg font-mono">
                {quoteError instanceof Error ? quoteError.message : 'Unknown error'}
              </div>
            </div>
          ) : quote ? (
            <>
              {/* Header Card */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-2xl font-bold text-foreground ticker-symbol">{quote.symbol}</h2>
                      <span className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded text-sm font-medium",
                        (quote.change || 0) >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                      )}>
                        {(quote.change || 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {(quote.change || 0) >= 0 ? '+' : ''}{safeFixed(quote.changesPercentage)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-muted-foreground">{quote.name}</p>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-medium",
                        quote.source?.includes('Tastytrade')
                          ? "border-green-500/30 text-green-500 bg-green-500/5"
                          : "border-yellow-500/30 text-yellow-500 bg-yellow-500/5"
                      )}>
                        {quote.source || 'Delayed'}
                      </span>
                      {!USE_STREAMING && (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-yellow-500/30 text-yellow-500 bg-yellow-500/5 uppercase tracking-wider font-medium">
                          ⚠️ Data Feed: Offline (Using Fallback)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-3xl font-bold font-mono transition-colors duration-300", isStreaming ? "text-primary" : "text-foreground")}>
                      ${safeFixed(currentPrice)}
                    </p>
                    <p className={cn("text-sm font-mono", (currentChange || 0) >= 0 ? "price-up" : "price-down")}>
                      {(currentChange || 0) >= 0 ? '+' : ''}${safeFixed(currentChange)} ({safeFixed(currentChangePercent)}%)
                    </p>
                    {/* Bid/Ask Spread Ticker */}
                    {(streamingData.bidPrice || streamingData.askPrice) && (
                      <div className="flex items-center justify-end gap-2 text-xs font-mono text-muted-foreground mt-1 bg-accent/30 px-2 py-1 rounded">
                        <span className="text-destructive">B: {safeFixed(streamingData.bidPrice)}</span>
                        <span className="text-border">|</span>
                        <span className="text-success">A: {safeFixed(streamingData.askPrice)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="p-3 rounded-lg bg-accent/50">
                    <p className="data-label mb-1">Volume</p>
                    <p className="font-mono font-medium text-foreground">{formatNumber(streamingData.dayVolume || quote.volume)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/50">
                    <p className="data-label mb-1">Avg Volume</p>
                    <p className="font-mono font-medium text-foreground">{formatNumber(quote.avgVolume)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/50">
                    <p className="data-label mb-1">52W High</p>
                    <p className="font-mono font-medium text-success">${safeFixed(streamingData.dayHigh || quote.yearHigh)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/50">
                    <p className="data-label mb-1">52W Low</p>
                    <p className="font-mono font-medium text-destructive">${safeFixed(streamingData.dayLow || quote.yearLow)}</p>
                  </div>
                  {/* Implied Volatility (Greeks) */}
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-1 mb-1">
                      <Activity className="w-3 h-3 text-purple-400" />
                      <p className="data-label text-purple-400">Imp. Volatility</p>
                    </div>
                    <p className="font-mono font-medium text-purple-100">
                      {streamingData.volatility ? safeFixed(streamingData.volatility * 100) + '%' : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Fundamentals */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Fundamentals</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-accent/30">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <p className="data-label">Market Cap</p>
                    </div>
                    <p className="text-xl font-bold text-foreground">{formatNumber(quote.marketCap)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-accent/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Percent className="w-4 h-4 text-primary" />
                      <p className="data-label">P/E Ratio</p>
                    </div>
                    <p className="text-xl font-bold text-foreground">{quote.pe ? safeFixed(quote.pe) : 'N/A'}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-accent/30">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <p className="data-label">EPS</p>
                    </div>
                    <p className="text-xl font-bold text-foreground">${quote.eps ? safeFixed(quote.eps) : 'N/A'}</p>
                  </div>

                  {/* New Metrics (Manually Calculated from Free Tier Data) */}
                  <div className="p-4 rounded-lg bg-accent/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Percent className="w-4 h-4 text-success" />
                      <p className="data-label">Operating Margin</p>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {financials?.operatingMargin ? safeFixed(financials.operatingMargin * 100) + '%' : 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-accent/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-warning" />
                      <p className="data-label">Debt/Equity</p>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {financials?.debtToEquity ? safeFixed(financials.debtToEquity) : 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-accent/30">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-info" />
                      <p className="data-label">Enterprise Value</p>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {formatNumber(financials?.enterpriseValue)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-accent/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Percent className="w-4 h-4 text-purple-400" />
                      <p className="data-label">P/S Ratio</p>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {financials?.priceToSales ? safeFixed(financials.priceToSales) : 'N/A'}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-accent/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      <p className="data-label">Sector</p>
                    </div>
                    <p className="text-lg font-semibold text-foreground">{profile?.sector || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* 52 Week Range Visualization */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">52 Week Range</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">${safeFixed(quote.yearLow)}</span>
                    <span className="text-muted-foreground">${safeFixed(quote.yearHigh)}</span>
                  </div>
                  <div className="relative h-2 bg-accent rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-gradient-to-r from-destructive via-warning to-success"
                      style={{ width: '100%' }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-foreground rounded-full border-2 border-background shadow-lg transition-all duration-500"
                      style={{
                        left: `${Math.min(100, Math.max(0, (((quote.price || 0) - (quote.yearLow || 0)) / ((quote.yearHigh || 1) - (quote.yearLow || 0))) * 100))}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Current: <span className="font-mono text-foreground">${safeFixed(quote.price)}</span>
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card rounded-xl p-6 text-center text-muted-foreground">
              {isQuoteLoading ? "Loading quote..." : "Stock not found. Try searching for a different symbol."}
            </div>
          )}
        </div>
      </div>

      {/* Debug Info (Temporary) */}
      <div className="glass-card p-4 mt-8 bg-black/50 text-xs font-mono text-muted-foreground overflow-auto max-h-40">
        <p className="font-bold mb-2">Debug Dump:</p>
        <p>Streaming Connected: {isStreaming ? 'YES' : 'NO'}</p>
        <p>Quote Source: {quote?.source}</p>
        <p>Price: {quote?.price} (Static) / {streamingData.price} (Stream)</p>
        <div className="mt-2 border-t border-white/10 pt-2">
          <p className="font-bold">Streamer Logs:</p>
          {tastyStreamer.logs.map((log, i) => (
            <p key={i}>{log}</p>
          ))}
        </div>
        <pre className="mt-2">{JSON.stringify(streamingData, null, 2)}</pre>
      </div>
    </div>
  );
}
