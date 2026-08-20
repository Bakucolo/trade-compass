import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  BarChart3, Building2, DollarSign, Percent, Search,
  TrendingDown, TrendingUp, Loader2, Activity,
  Newspaper, LineChart, PieChart, ActivitySquare,
  Globe, Clock, Sparkles, AlertTriangle, FileText, Download
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { marketDataService, USE_STREAMING } from '../services/marketData';
import { useResearchDossier, useAIAnalysis } from '../services/researchData';
import { tastyStreamer, StreamerData } from '../services/tastytradeStreamer';
import ReactMarkdown from 'react-markdown';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Simple debounce hook implementation
function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function ResearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounceValue(searchQuery, 500);
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');

  // Real-time Streaming State
  const [streamingData, setStreamingData] = useState<Partial<StreamerData>>({});

  // Agent PDF State
  const [isAgentLoading, setIsAgentLoading] = useState(false);

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

  // Data Queries for Selected Stock (Backend Dossier)
  const { data: dossier, isLoading: isQuoteLoading, error: quoteError, isError: isQuoteError } = useResearchDossier(selectedSymbol);

  // AI Analysis Query
  const { data: aiData, isLoading: aiLoading, isError: aiError } = useAIAnalysis(selectedSymbol);

  const quote = dossier ? {
    symbol: dossier.header?.symbol,
    name: dossier.header?.shortName || selectedSymbol,
    price: dossier.header?.regularMarketPrice,
    change: dossier.header?.regularMarketChange,
    changesPercentage: dossier.header?.regularMarketChangePercent,
    yearHigh: dossier.technicals?.fiftyTwoWeekHigh,
    yearLow: dossier.technicals?.fiftyTwoWeekLow,
    dayHigh: dossier.technicals?.dayHigh,
    dayLow: dossier.technicals?.dayLow,
    volume: dossier.technicals?.volume,
    avgVolume: dossier.technicals?.averageVolume,
    marketCap: dossier.fundamentals?.marketCap,
    pe: dossier.fundamentals?.trailingPE,
    eps: dossier.fundamentals?.trailingEps,
    source: 'Yahoo Finance'
  } : null;

  const financials = dossier ? {
    operatingMargin: dossier.fundamentals?.operatingMargins,
    debtToEquity: dossier.fundamentals?.debtToEquity,
    enterpriseValue: dossier.fundamentals?.enterpriseValue,
    priceToSales: dossier.fundamentals?.priceToSales,
    roa: dossier.fundamentals?.returnOnAssets,
    roe: dossier.fundamentals?.returnOnEquity,
    fcf: dossier.fundamentals?.freeCashflow,
  } : null;

  const profile = {
    sector: dossier?.header?.sector,
    industry: dossier?.header?.industry,
    summary: dossier?.profile?.longBusinessSummary,
    website: dossier?.profile?.website
  };

  const isLoading = isQuoteLoading;

  const formatNumber = (num: number | undefined | any) => {
    if (num === undefined || num === null) return 'N/A';
    const val = Number(num);
    if (isNaN(val)) return 'N/A';

    if (val >= 1e12) return (val / 1e12).toFixed(2) + 'T';
    if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
    return val.toLocaleString();
  };

  const safeFixed = (val: number | undefined | null | any, decimals: number = 2) => {
    if (val === undefined || val === null) return '0.00';
    const num = Number(val);
    if (isNaN(num)) return '0.00';
    return num.toFixed(decimals);
  }

  const currentPrice = streamingData.price || quote?.price;
  const currentChange = streamingData.change || quote?.change;
  const currentChangePercent = streamingData.changePercent || quote?.changesPercentage;
  const isStreaming = !!streamingData.price;
  const priceIsUp = (currentChange || 0) >= 0;

  // Attempt to parse AI analysis
  let parsedAiAnalysis: any = null;
  if (aiData?.analysis) {
    try {
      const cleanString = aiData.analysis.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedAiAnalysis = JSON.parse(cleanString);
    } catch (e) {
      console.warn("Failed to parse AI Analysis JSON", e);
    }
  }

  const handleAgentGeneration = async () => {
    if (!selectedSymbol) return;
    setIsAgentLoading(true);
    try {
      const res = await fetch(`/api/research/autonomous/${selectedSymbol}`);
      if (!res.ok) throw new Error("Failed to generate report");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `research_report_${selectedSymbol}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Failed to generate PDF Report");
    } finally {
      setIsAgentLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">

      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border/50 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            Global Research
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4" /> Company Analysis & Unified Market Dossiers
          </p>
        </div>

        <div>
          <Button
            onClick={handleAgentGeneration}
            disabled={isAgentLoading || !selectedSymbol}
            className="flex items-center gap-2 bg-gradient-to-r from-primary/80 to-primary hover:from-primary hover:to-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all font-semibold"
          >
            {isAgentLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Compiling Autonomous Deep-Dive PDF...</>
            ) : (
              <><FileText className="w-4 h-4" /> Generate Autonomous Report</>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Sidebar: Search & Nav */}
        <div className="xl:col-span-1 space-y-6">
          <Card className="bg-background/40 backdrop-blur-md shadow-lg border-primary/10">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                Asset Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Ticker (e.g. MSFT, TSLA)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-accent/50 border-border/50 focus:border-primary/50 transition-all shadow-inner"
                />
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
                {isSearchLoading ? (
                  <div className="flex justify-center p-4"><Loader2 className="animate-spin text-primary" /></div>
                ) : isSearchError ? (
                  <div className="p-4 rounded-md text-destructive text-sm bg-destructive/10">
                    Failed to fetch search results.
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  searchResults.map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => setSelectedSymbol(stock.symbol)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-300 border",
                        selectedSymbol === stock.symbol
                          ? "bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.15)] ring-1 ring-primary/20"
                          : "bg-background/30 border-border/30 hover:bg-accent/50 hover:border-border/80"
                      )}
                    >
                      <div className="text-left">
                        <p className={cn("font-bold tracking-wide", selectedSymbol === stock.symbol ? "text-primary" : "text-foreground")}>
                          {stock.symbol}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate w-[140px] leading-tight">{stock.name}</p>
                      </div>
                      <Badge variant={selectedSymbol === stock.symbol ? "default" : "secondary"} className="text-[10px] px-1.5 h-5">
                        {stock.stockExchange}
                      </Badge>
                    </button>
                  ))
                ) : debouncedSearch.length > 0 ? (
                  <div className="text-center text-muted-foreground p-4 text-sm">
                    No matching assets for "{debouncedSearch}"
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground p-4 text-sm italic">
                    Type characters to begin searching...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Main Content */}
        <div className="xl:col-span-3 space-y-6">
          {isLoading ? (
            <Card className="h-[400px] flex items-center justify-center bg-background/30 backdrop-blur-sm border-primary/10 shadow-lg">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Compiling Global Dossier...</p>
              </div>
            </Card>
          ) : isQuoteError ? (
            <Card className="bg-destructive/5 border-destructive/20 shadow-lg">
              <CardContent className="p-8 text-center">
                <div className="inline-flex w-12 h-12 rounded-full bg-destructive/10 items-center justify-center mb-4">
                  <ActivitySquare className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Data</h3>
                <p className="font-mono text-sm text-destructive/80 bg-destructive/10 p-3 rounded text-left overflow-auto">
                  {quoteError instanceof Error ? quoteError.message : 'Dossier synthesis failed.'}
                </p>
              </CardContent>
            </Card>
          ) : quote ? (
            <>
              {/* Ticker Action Strip */}
              <Card className="bg-background/60 backdrop-blur-xl border-primary/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-primary/30 transition-colors duration-500 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 h-full opacity-5 pointer-events-none">
                  <BarChart3 className="w-full h-full text-primary" />
                </div>

                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-4xl font-black tracking-tight text-foreground">{quote.symbol}</h2>
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-3 pl-2 py-1 text-sm font-semibold border transition-colors",
                            priceIsUp
                              ? "bg-success/10 text-success border-success/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                              : "bg-destructive/10 text-destructive border-destructive/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                          )}
                        >
                          {priceIsUp ? <TrendingUp className="w-4 h-4 mr-1 inline-block" /> : <TrendingDown className="w-4 h-4 mr-1 inline-block" />}
                          {priceIsUp ? '+' : ''}{safeFixed(currentChangePercent)}%
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <p className="text-xl text-muted-foreground font-medium">{quote.name}</p>
                        {profile.sector && (
                          <div className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md bg-accent/50 text-accent-foreground">
                            <Building2 className="w-3 h-3" /> {profile.sector}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-left md:text-right">
                      <div className="flex items-center justify-start md:justify-end gap-2 mb-1">
                        <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Market Price</span>
                        {isStreaming ? (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-green-500/30 text-green-500 bg-green-500/10 uppercase tracking-widest font-bold animate-pulse">
                            <Activity className="w-3 h-3" /> Live
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-yellow-500/30 text-yellow-500 bg-yellow-500/10 uppercase tracking-widest font-bold">
                            <Clock className="w-3 h-3" /> Delayed
                          </span>
                        )}
                      </div>
                      <p className={cn(
                        "text-5xl font-black font-mono tracking-tighter transition-colors duration-500",
                        isStreaming ? "text-primary" : "text-foreground"
                      )}>
                        ${safeFixed(currentPrice)}
                      </p>
                      <p className={cn("text-lg font-mono font-medium mt-1", priceIsUp ? "text-success" : "text-destructive")}>
                        {priceIsUp ? '+' : ''}${safeFixed(currentChange)} Today
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Data Tabs */}
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-5 h-12 items-center bg-background/50 p-1 border border-border/50 backdrop-blur-md rounded-xl">
                  <TabsTrigger value="overview" className="rounded-lg py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all">Overview</TabsTrigger>
                  <TabsTrigger value="fundamentals" className="rounded-lg py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all">Fundamentals</TabsTrigger>
                  <TabsTrigger value="financials" className="rounded-lg py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all">Financials</TabsTrigger>
                  <TabsTrigger value="news" className="rounded-lg py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all">News & Press</TabsTrigger>
                  <TabsTrigger value="ai-analysis" className="rounded-lg py-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> AI Analysis
                  </TabsTrigger>
                </TabsList>

                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-background/40 hover:bg-background/60 transition-colors border-primary/5 hover:border-primary/20">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Volume</p>
                          <BarChart3 className="w-4 h-4 text-primary/50" />
                        </div>
                        <p className="font-mono text-xl font-bold">{formatNumber(streamingData.dayVolume || quote.volume)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Avg: {formatNumber(quote.avgVolume)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-background/40 hover:bg-background/60 transition-colors border-primary/5 hover:border-primary/20">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Market Cap</p>
                          <DollarSign className="w-4 h-4 text-primary/50" />
                        </div>
                        <p className="font-mono text-xl font-bold">{formatNumber(quote.marketCap)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-background/40 hover:bg-background/60 transition-colors border-primary/5 hover:border-primary/20">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">P/E Ratio</p>
                          <ActivitySquare className="w-4 h-4 text-primary/50" />
                        </div>
                        <p className="font-mono text-xl font-bold">{safeFixed(quote.pe)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-background/40 hover:bg-background/60 transition-colors border-purple-500/10 hover:border-purple-500/30">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-xs font-semibold text-purple-400/80 uppercase tracking-wider">Imp. Volatility</p>
                          <Activity className="w-4 h-4 text-purple-500/50" />
                        </div>
                        <p className="font-mono text-xl font-bold text-purple-100">
                          {streamingData.volatility ? safeFixed(streamingData.volatility * 100) + '%' : 'N/A'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-background/40 backdrop-blur-sm border-primary/10 overflow-hidden group">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                        <LineChart className="w-4 h-4 text-primary" /> 52-Week Range
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between text-xs font-mono font-medium mb-2">
                        <span className="text-destructive">${safeFixed(quote.yearLow)}</span>
                        <span className="text-success">${safeFixed(quote.yearHigh)}</span>
                      </div>
                      <div className="relative h-3 bg-accent rounded-full overflow-hidden shadow-inner group-hover:h-4 transition-all duration-300">
                        <div className="absolute h-full bg-gradient-to-r from-destructive via-warning to-success" style={{ width: '100%' }} />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-foreground rounded-full border-2 border-background shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-all duration-500"
                          style={{
                            left: `${Math.min(100, Math.max(0, (((quote.price || 0) - (quote.yearLow || 0)) / ((quote.yearHigh || 1) - (quote.yearLow || 0))) * 100))}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {profile.summary && (
                    <Card className="bg-background/40 border-primary/10">
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider">Company Profile</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {profile.summary}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* FUNDAMENTALS TAB */}
                <TabsContent value="fundamentals" className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-background/40 hover:bg-background/60 transition-all border-primary/10">
                      <CardHeader className="pb-2 flex flex-row items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg"><PieChart className="w-4 h-4 text-primary" /></div>
                        <CardTitle className="text-lg">Valuation & Growth</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-4">
                        <div className="flex justify-between items-center border-b border-border/50 pb-2">
                          <span className="text-sm text-muted-foreground">P/E Ratio (Trailing)</span>
                          <span className="font-mono font-semibold">{safeFixed(quote.pe)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-border/50 pb-2">
                          <span className="text-sm text-muted-foreground">Price / Sales</span>
                          <span className="font-mono font-semibold">{safeFixed(financials?.priceToSales)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2">
                          <span className="text-sm text-muted-foreground">Earnings Per Share</span>
                          <span className="font-mono font-semibold">${safeFixed(quote.eps)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-background/40 hover:bg-background/60 transition-all border-primary/10">
                      <CardHeader className="pb-2 flex flex-row items-center gap-2">
                        <div className="p-2 bg-success/10 rounded-lg"><Percent className="w-4 h-4 text-success" /></div>
                        <CardTitle className="text-lg">Profitability & Returns</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-4">
                        <div className="flex justify-between items-center border-b border-border/50 pb-2">
                          <span className="text-sm text-muted-foreground">Operating Margin</span>
                          <span className="font-mono font-semibold text-success">
                            {financials?.operatingMargin ? safeFixed(financials.operatingMargin * 100) + '%' : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-border/50 pb-2">
                          <span className="text-sm text-muted-foreground">Return on Assets (ROA)</span>
                          <span className="font-mono font-semibold">
                            {financials?.roa ? safeFixed(financials.roa * 100) + '%' : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-2">
                          <span className="text-sm text-muted-foreground">Return on Equity (ROE)</span>
                          <span className="font-mono font-semibold">
                            {financials?.roe ? safeFixed(financials.roe * 100) + '%' : 'N/A'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* FINANCIALS TAB */}
                <TabsContent value="financials" className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <Card className="bg-background/40 hover:bg-background/60 border-primary/10">
                    <CardHeader className="pb-2 flex flex-row items-center gap-2">
                      <div className="p-2 bg-warning/10 rounded-lg"><Building2 className="w-4 h-4 text-warning" /></div>
                      <CardTitle className="text-lg">Balance Sheet & Liquidity</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                      <div className="flex justify-between items-center border-b border-border/50 pb-2">
                        <span className="text-sm text-muted-foreground">Enterprise Value</span>
                        <span className="font-mono font-bold text-foreground">{formatNumber(financials?.enterpriseValue)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-border/50 pb-2">
                        <span className="text-sm text-muted-foreground">Market Capitalization</span>
                        <span className="font-mono font-bold text-foreground">{formatNumber(quote.marketCap)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-border/50 pb-2">
                        <span className="text-sm text-muted-foreground">Debt to Equity</span>
                        <span className={cn(
                          "font-mono font-bold",
                          (financials?.debtToEquity || 0) > 100 ? "text-destructive" : "text-success"
                        )}>
                          {safeFixed(financials?.debtToEquity)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b border-border/50 pb-2">
                        <span className="text-sm text-muted-foreground">Levered Free Cash Flow</span>
                        <span className="font-mono font-bold text-foreground">{formatNumber(financials?.fcf)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* NEWS TAB */}
                <TabsContent value="news" className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {dossier?.news && dossier.news.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {dossier.news.map((item: any, i: number) => (
                        <a
                          key={i}
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group"
                        >
                          <Card className="bg-background/40 hover:bg-accent/40 transition-colors border-primary/5 hover:border-primary/30 group-hover:shadow-[0_0_15px_rgba(var(--primary),0.1)]">
                            <CardContent className="p-5 flex gap-4 items-start">
                              <div className="mt-1 p-2 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors shadow-sm">
                                <Newspaper className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-lg text-foreground mb-1 group-hover:text-primary transition-colors leading-tight">
                                  {item.title}
                                </h4>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                  <Badge variant="secondary" className="font-medium bg-secondary/50">
                                    {item.publisher || 'Wire'}
                                  </Badge>
                                  {item.providerPublishTime && (
                                    <span className="flex items-center gap-1 font-mono text-xs">
                                      <Clock className="w-3 h-3" />
                                      {new Date(item.providerPublishTime * 1000).toLocaleString(undefined, {
                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <Card className="bg-background/30 border-dashed border-2 py-12">
                      <CardContent className="flex flex-col items-center justify-center text-center">
                        <Newspaper className="w-12 h-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium text-foreground">No News Available</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                          News feeds from Yahoo Finance have not populated for {quote.symbol}.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* AI ANALYSIS TAB */}
                <TabsContent value="ai-analysis" className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <Card className="bg-background/40 border-primary/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 h-full opacity-[0.03] pointer-events-none group-hover:opacity-[0.06] transition-opacity">
                      <Sparkles className="w-full h-full text-primary" />
                    </div>
                    <CardHeader className="pb-4 flex flex-row items-center gap-2 border-b border-border/50">
                      <div className="p-2 bg-primary/10 rounded-lg"><Sparkles className="w-5 h-5 text-primary animate-pulse" /></div>
                      <div>
                        <CardTitle className="text-xl">Aggressive Growth AI Analysis</CardTitle>
                        <CardDescription>Generated by GPT-4o-mini using live dossier data</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {aiLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                          <Loader2 className="w-10 h-10 animate-spin text-primary" />
                          <p className="text-muted-foreground animate-pulse">Running advanced AI evaluation...</p>
                        </div>
                      ) : aiError ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-3">
                          <ActivitySquare className="h-10 w-10 text-destructive/80" />
                          <p className="text-destructive font-medium">Failed to generate AI Analysis</p>
                          <p className="text-sm text-muted-foreground">Verify OPENROUTER_API_KEY in your .env.local file</p>
                        </div>
                      ) : parsedAiAnalysis ? (
                        <div className="space-y-6">
                          {/* Company Overview */}
                          {parsedAiAnalysis.overview && (
                            <section>
                              <h3 className="text-lg font-semibold text-foreground border-b border-border/50 pb-2 mb-3">Company Overview</h3>
                              <p className="text-slate-300 max-w-4xl leading-relaxed">
                                {parsedAiAnalysis.overview}
                              </p>
                            </section>
                          )}

                          {/* Key Metrics Grid */}
                          {parsedAiAnalysis.keyMetrics && Object.keys(parsedAiAnalysis.keyMetrics).length > 0 && (
                            <section>
                              <h3 className="text-lg font-semibold text-foreground border-b border-border/50 pb-2 mb-3">Key Metrics</h3>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {Object.entries(parsedAiAnalysis.keyMetrics).map(([key, val]) => (
                                  <div key={key} className="bg-slate-900/80 p-4 rounded-xl border border-white/5 flex flex-col justify-center">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">{key}</span>
                                    <span className="text-lg font-bold text-white">{val as string}</span>
                                  </div>
                                ))}
                              </div>
                            </section>
                          )}

                          {/* Red Flags / Alerts */}
                          {parsedAiAnalysis.redFlags && parsedAiAnalysis.redFlags.length > 0 && (
                            <section className="space-y-3">
                              {parsedAiAnalysis.redFlags.map((flag: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 bg-red-950/30 border border-red-900/50 p-4 rounded-xl">
                                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                                  <p className="text-red-200 text-sm leading-relaxed">{flag}</p>
                                </div>
                              ))}
                            </section>
                          )}

                          {/* Deep Dive */}
                          {parsedAiAnalysis.deepDive && (
                            <section>
                              <h3 className="text-lg font-semibold text-foreground border-b border-border/50 pb-2 mb-3">Deep Dive into Financials</h3>
                              <p className="text-slate-300 max-w-4xl leading-relaxed">
                                {parsedAiAnalysis.deepDive}
                              </p>
                            </section>
                          )}
                        </div>
                      ) : (
                        <div className="prose prose-invert prose-p:text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary max-w-none">
                          <ReactMarkdown>{aiData?.analysis || "No analysis available."}</ReactMarkdown>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card className="h-[400px] flex items-center justify-center bg-background/30 backdrop-blur-sm border-dashed border-2 border-border/50">
              <div className="text-center">
                <Search className="h-10 w-10 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground">Awaiting Input</p>
                <p className="text-sm text-muted-foreground">Select an asset from the sidebar to compile its dossier.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
