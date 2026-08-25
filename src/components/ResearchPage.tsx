import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  BarChart3, Building2, DollarSign, Percent, Search,
  TrendingDown, TrendingUp, Loader2, Activity,
  Newspaper, LineChart, PieChart, ActivitySquare,
  Globe, Clock, Sparkles, AlertTriangle, FileText, Download,
  SlidersHorizontal, Settings2, Scale, ExternalLink,
  Layers, ArrowUpRight, ArrowDownRight, ShieldCheck,
  CheckCircle2, Compass, Zap, Flame, Lightbulb, Bookmark,
  PanelLeftClose, PanelLeftOpen, Maximize2, Minimize2
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { marketDataService, USE_STREAMING } from '../services/marketData';
import { useResearchDossier, useAIAnalysis } from '../services/researchData';
import { tastyStreamer, StreamerData } from '../services/tastytradeStreamer';
import { useReportPrompts } from '../services/promptService';
import { PromptManagerModal } from './PromptManagerModal';
import { useStockNote } from '@/services/noteService';
import { StockNoteModal } from './StockNoteModal';
import { PortfolioFitModal } from './portfolio/PortfolioFitModal';
import { IdeaModal } from './IdeaModal';
import { AutonomousReport, reportService, useAutonomousReports } from '@/services/reportService';
import { AutonomousReportsList } from './AutonomousReportsList';
import { AutonomousReportViewerModal } from './AutonomousReportViewerModal';
import { GrowthAndValuationCard } from './research/GrowthAndValuationCard';
import { InvestorRelationsCard } from './research/InvestorRelationsCard';
import { StructuredTradesCard } from './research/StructuredTradesCard';
import { TradeStructureModal } from './TradeStructureModal';
import ReactMarkdown from 'react-markdown';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';

// Simple debounce hook implementation
function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const POPULAR_TICKERS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'PLTR', 'CCJ', 'SMR'];

interface ResearchPageProps {
  initialSymbol?: string;
  onNavigateTab?: (tab: string) => void;
}

export function ResearchPage({ initialSymbol, onNavigateTab }: ResearchPageProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounceValue(searchQuery, 400);
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol || 'AAPL');
  const [activeDataTab, setActiveDataTab] = useState('overview');
  const [isTradeStructureModalOpen, setIsTradeStructureModalOpen] = useState(false);

  // Full Page View Mode State (defaults to true for maximum screen space, persisted in localStorage)
  const [isFullPageMode, setIsFullPageMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tradeflow_research_full_page');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleFullPageMode = () => {
    setIsFullPageMode((prev) => {
      const next = !prev;
      localStorage.setItem('tradeflow_research_full_page', JSON.stringify(next));
      return next;
    });
  };

  // Report Prompts State
  const { data: reportPrompts = [] } = useReportPrompts();
  const [selectedPromptSlug, setSelectedPromptSlug] = useState<string>('company_research');
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);

  // Saved Autonomous Reports Query
  const { data: savedReports = [] } = useAutonomousReports(selectedSymbol);
  const [viewerReport, setViewerReport] = useState<AutonomousReport | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Stock Notes State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const { data: currentStockNote } = useStockNote(selectedSymbol);

  // Portfolio Fit State
  const [isFitModalOpen, setIsFitModalOpen] = useState(false);
  const [ideaModalState, setIdeaModalState] = useState<{ open: boolean; initialThesis?: string }>({ open: false });

  useEffect(() => {
    if (initialSymbol) {
      setSelectedSymbol(initialSymbol);
      setSearchQuery('');
    }
  }, [initialSymbol]);

  useEffect(() => {
    const handleTickerEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setSelectedSymbol(customEvent.detail);
        setSearchQuery('');
      }
    };
    window.addEventListener('select-research-ticker', handleTickerEvent);
    return () => window.removeEventListener('select-research-ticker', handleTickerEvent);
  }, []);

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
    if (num === undefined || num === null) return '—';
    const val = Number(num);
    if (isNaN(val)) return '—';

    if (val >= 1e12) return '$' + (val / 1e12).toFixed(2) + 'T';
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
    if (val >= 1e3) return '$' + (val / 1e3).toFixed(2) + 'K';
    return '$' + val.toLocaleString();
  };

  const safeFixed = (val: number | undefined | null | any, decimals: number = 2) => {
    if (val === undefined || val === null) return '—';
    const num = Number(val);
    if (isNaN(num)) return '—';
    return num.toFixed(decimals);
  };

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
    if (!selectedSymbol || isAgentLoading) return;
    setIsAgentLoading(true);
    try {
      const activeTemplate = reportPrompts.find(p => p.slug === selectedPromptSlug) || reportPrompts[0];
      const promptId = activeTemplate ? activeTemplate.id : undefined;
      const result = await reportService.generateReport(selectedSymbol, selectedPromptSlug, promptId);

      toast.success(`Autonomous report generated for ${selectedSymbol}!`);
      await queryClient.invalidateQueries({ queryKey: ['autonomousReports', selectedSymbol] });
      await queryClient.invalidateQueries({ queryKey: ['allAutonomousReports'] });

      if (result?.report) {
        setViewerReport(result.report);
        setIsViewerOpen(true);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to generate report: ${error.message || 'Please check your Gemini / OpenRouter API key in Settings.'}`);
    } finally {
      setIsAgentLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500 pb-24">
      {/* ================= HEADER RIBBON ================= */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 via-indigo-500/20 to-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground glow-text-white">
                Global Equity Research
              </h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono uppercase font-bold">
                Unified Dossier
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Institutional fundamentals, live market telemetry, AI synthesis & portfolio fit benchmarking.
            </p>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Report Type Selector */}
          <div className="flex items-center gap-1.5 bg-card/70 border border-border/70 rounded-xl px-3 h-9 shadow-sm">
            <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <select
              value={selectedPromptSlug}
              onChange={(e) => setSelectedPromptSlug(e.target.value)}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer pr-1"
            >
              {reportPrompts.map((p) => (
                <option key={p.id} value={p.slug} className="bg-popover text-popover-foreground">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Manage Prompts Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPromptModalOpen(true)}
            className="text-xs gap-1.5 h-9 border-border/70 hover:bg-accent/40"
            title="Manage and customize report prompt instructions"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Customize</span>
          </Button>

          {/* View Saved Reports Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveDataTab('reports')}
            className={cn(
              "text-xs gap-1.5 h-9 border-border/70 transition-all",
              savedReports.length > 0
                ? "bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                : "hover:bg-accent/40 text-muted-foreground hover:text-foreground"
            )}
            title={`View ${savedReports.length} saved reports for ${selectedSymbol}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-semibold">
              {savedReports.length > 0 ? `Reports (${savedReports.length})` : 'Reports'}
            </span>
          </Button>

          {/* Stock Notes Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsNoteModalOpen(true)}
            className={cn(
              "text-xs gap-1.5 h-9 border-border/70 transition-all",
              currentStockNote
                ? currentStockNote.sentiment === 'BULLISH'
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                  : currentStockNote.sentiment === 'BEARISH'
                  ? "bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                  : "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25"
                : "hover:bg-accent/40 text-muted-foreground hover:text-foreground"
            )}
            title={currentStockNote ? `Notes on ${selectedSymbol}` : `Write notes for ${selectedSymbol}`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span className="font-semibold">{currentStockNote ? 'Notes (Saved)' : 'Notes'}</span>
          </Button>

          {/* Portfolio Fit Checker Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFitModalOpen(true)}
            className="text-xs gap-1.5 h-9 bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.15)] font-bold transition-all"
            title={`Check portfolio fit & correlation for ${selectedSymbol}`}
          >
            <Scale className="w-3.5 h-3.5 text-cyan-400" />
            <span>Portfolio Fit</span>
          </Button>

          {/* Full Page (100% Width) View Mode Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullPageMode}
            className={cn(
              "text-xs gap-1.5 h-9 font-bold transition-all shadow-sm",
              isFullPageMode
                ? "bg-primary/20 text-primary border-primary/40 hover:bg-primary/30 ring-1 ring-primary/30"
                : "hover:bg-accent/40 text-muted-foreground hover:text-foreground border-border/70"
            )}
            title={isFullPageMode ? "Switch to Split Explorer View" : "Expand to 100% Full Page View"}
          >
            {isFullPageMode ? (
              <>
                <PanelLeftOpen className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">Split View</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary font-mono ml-0.5">
                  100% Full Width
                </Badge>
              </>
            ) : (
              <>
                <PanelLeftClose className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Full Page View</span>
              </>
            )}
          </Button>

          {/* Generate Report Button */}
          <Button
            onClick={handleAgentGeneration}
            disabled={isAgentLoading || !selectedSymbol}
            className="h-9 flex items-center gap-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all font-bold text-xs px-4"
          >
            {isAgentLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Compiling Dossier...</>
            ) : (
              <><Sparkles className="w-4 h-4 text-amber-300" /> Generate AI Report</>
            )}
          </Button>
        </div>
      </div>

      {/* ================= FULL PAGE QUICK TICKER RIBBON (When Full Page Mode is ON) ================= */}
      {isFullPageMode && (
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 bg-card/70 backdrop-blur-xl border border-border/70 rounded-2xl shadow-sm animate-in fade-in">
          {/* Quick Search Input */}
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search any ticker (e.g. NVDA, PLTR, CCJ, TSLA)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const trimmed = searchQuery.trim().toUpperCase();
                  if (trimmed) {
                    if (searchResults && searchResults.length > 0) {
                      setSelectedSymbol(searchResults[0].symbol);
                    } else {
                      setSelectedSymbol(trimmed);
                    }
                    setSearchQuery('');
                  }
                }
              }}
              className="pl-9 pr-12 bg-background/70 border-border/60 focus:border-primary/50 text-xs font-mono uppercase h-8.5 rounded-xl shadow-inner font-bold"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  const trimmed = searchQuery.trim().toUpperCase();
                  if (trimmed) {
                    if (searchResults && searchResults.length > 0) {
                      setSelectedSymbol(searchResults[0].symbol);
                    } else {
                      setSelectedSymbol(trimmed);
                    }
                    setSearchQuery('');
                  }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-md hover:opacity-90 transition-opacity"
              >
                Go
              </button>
            )}
          </div>

          {/* Popular Tickers Fast Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0 mr-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Fast Watch:
            </span>
            {POPULAR_TICKERS.map((ticker) => (
              <button
                key={ticker}
                type="button"
                onClick={() => setSelectedSymbol(ticker)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-lg font-mono font-bold transition-all border shrink-0",
                  selectedSymbol === ticker
                    ? "bg-primary text-primary-foreground border-primary shadow-sm ring-1 ring-primary/30"
                    : "bg-card/50 hover:bg-accent/60 text-muted-foreground hover:text-foreground border-border/50"
                )}
              >
                {ticker}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ================= MAIN DOSSIER LAYOUT (Full Page 100% or Split 2-Column) ================= */}
      <div className={cn(
        "gap-6 items-start",
        isFullPageMode ? "w-full space-y-6" : "grid grid-cols-1 xl:grid-cols-4"
      )}>
        {/* Left Sidebar: Asset Search & Quick Tickers (Only visible when Full Page mode is OFF) */}
        {!isFullPageMode && (
          <div className="xl:col-span-1 space-y-6">
            <Card className="bg-card/60 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="p-4 pb-3 border-b border-border/40 bg-accent/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Search className="w-4 h-4 text-primary" />
                  Asset Explorer
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Search Input */}
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    placeholder="Ticker (e.g. NVDA, PLTR, CCJ)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const trimmed = searchQuery.trim().toUpperCase();
                        if (trimmed) {
                          if (searchResults && searchResults.length > 0) {
                            setSelectedSymbol(searchResults[0].symbol);
                          } else {
                            setSelectedSymbol(trimmed);
                          }
                        }
                      }
                    }}
                    className="pl-9 pr-10 bg-background/60 border-border/60 focus:border-primary/50 text-xs font-mono uppercase h-9 rounded-xl shadow-inner"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = searchQuery.trim().toUpperCase();
                        if (trimmed) {
                          if (searchResults && searchResults.length > 0) {
                            setSelectedSymbol(searchResults[0].symbol);
                          } else {
                            setSelectedSymbol(trimmed);
                          }
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-md hover:opacity-90 transition-opacity"
                    >
                      Go
                    </button>
                  )}
                </div>

                {/* Quick Select Popular Tickers */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Quick Watch Tickers
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_TICKERS.map((ticker) => (
                      <button
                        key={ticker}
                        type="button"
                        onClick={() => setSelectedSymbol(ticker)}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-lg font-mono font-bold transition-all border",
                          selectedSymbol === ticker
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-card/40 hover:bg-accent/60 text-muted-foreground hover:text-foreground border-border/50"
                        )}
                      >
                        {ticker}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Results / Autocomplete */}
                <div className="space-y-1.5 max-h-[380px] overflow-y-auto scrollbar-thin pr-1 pt-1">
                  {isSearchLoading ? (
                    <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : isSearchError ? (
                    <div className="p-3 rounded-xl text-destructive text-xs bg-destructive/10 border border-destructive/20">
                      Failed to fetch search results.
                    </div>
                  ) : searchResults && searchResults.length > 0 ? (
                    searchResults.map((stock) => (
                      <button
                        key={stock.symbol}
                        onClick={() => setSelectedSymbol(stock.symbol)}
                        className={cn(
                          "w-full flex items-center justify-between p-2.5 rounded-xl transition-all border text-left group",
                          selectedSymbol === stock.symbol
                            ? "bg-primary/10 border-primary/40 shadow-sm ring-1 ring-primary/20"
                            : "bg-background/40 border-border/40 hover:bg-accent/50 hover:border-border/80"
                        )}
                      >
                        <div>
                          <p className={cn("font-mono font-black text-xs", selectedSymbol === stock.symbol ? "text-primary" : "text-foreground")}>
                            {stock.symbol}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[130px] leading-tight">
                            {stock.name}
                          </p>
                        </div>
                        <Badge variant={selectedSymbol === stock.symbol ? "default" : "secondary"} className="text-[9px] font-mono px-1.5 h-4">
                          {stock.stockExchange}
                        </Badge>
                      </button>
                    ))
                  ) : debouncedSearch.length > 0 ? (
                    <div className="text-center text-muted-foreground p-4 text-xs">
                      No matching assets for "{debouncedSearch}"
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground/60 p-4 text-xs italic">
                      Type to search any US/Global equity...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Area: Expands to 100% width in Full Page mode or xl:col-span-3 in split view */}
        <div className={cn("space-y-6", isFullPageMode ? "w-full" : "xl:col-span-3")}>
          {isLoading ? (
            <Card className="h-[420px] flex items-center justify-center bg-card/50 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-semibold text-muted-foreground animate-pulse">
                  Compiling Live Research Dossier for {selectedSymbol}...
                </p>
              </div>
            </Card>
          ) : isQuoteError ? (
            <Card className="bg-destructive/10 border-destructive/30 shadow-lg rounded-2xl">
              <CardContent className="p-8 text-center space-y-3">
                <div className="inline-flex w-12 h-12 rounded-2xl bg-destructive/20 items-center justify-center text-destructive">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-destructive">Dossier Synthesis Failed</h3>
                <p className="font-mono text-xs text-destructive/80 bg-destructive/10 p-3 rounded-xl max-w-lg mx-auto overflow-auto">
                  {quoteError instanceof Error ? quoteError.message : 'Unable to retrieve live market fundamentals.'}
                </p>
                <Button size="sm" variant="outline" onClick={() => setSelectedSymbol(selectedSymbol)} className="text-xs">
                  Retry Dossier
                </Button>
              </CardContent>
            </Card>
          ) : quote ? (
            <>
              {/* ================= HERO COMMAND CENTER ================= */}
              <Card className="bg-card/70 backdrop-blur-2xl border border-border/70 shadow-xl hover:border-primary/40 transition-all duration-300 rounded-2xl overflow-hidden relative group">
                {/* Sentiment Accent Top Glow Strip */}
                <div
                  className={cn(
                    'h-1.5 w-full',
                    priceIsUp
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600'
                      : 'bg-gradient-to-r from-rose-500 via-pink-400 to-rose-600'
                  )}
                />

                <CardContent className="p-6 space-y-6">
                  {/* Top Row: Symbol, Profile & Live Telemetry */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-black text-xl border shadow-md',
                            priceIsUp
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          )}
                        >
                          {quote.symbol.slice(0, 4)}
                        </div>

                        <div>
                          <div className="flex items-center gap-2.5">
                            <h2 className="text-3xl font-black font-mono tracking-tight text-foreground">
                              {quote.symbol}
                            </h2>
                            <Badge
                              variant="outline"
                              className={cn(
                                "px-2.5 py-0.5 text-xs font-bold font-mono uppercase border transition-colors",
                                priceIsUp
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                                  : "bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                              )}
                            >
                              {priceIsUp ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5 inline" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5 inline" />}
                              {priceIsUp ? '+' : ''}{safeFixed(currentChangePercent)}%
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-base text-muted-foreground font-semibold">
                              {quote.name}
                            </span>
                            {profile.sector && (
                              <Badge variant="secondary" className="text-[10px] font-semibold bg-accent/60 text-muted-foreground gap-1">
                                <Building2 className="w-3 h-3" /> {profile.sector}
                              </Badge>
                            )}
                            {profile.industry && (
                              <Badge variant="outline" className="text-[10px] font-medium border-border/50 text-muted-foreground">
                                {profile.industry}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Live Price Display */}
                    <div className="text-left md:text-right">
                      <div className="flex items-center justify-start md:justify-end gap-2 mb-1">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                          Market Price
                        </span>
                        {isStreaming ? (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 uppercase tracking-widest font-mono font-bold animate-pulse">
                            <Activity className="w-3 h-3" /> Live Feed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-400 bg-amber-500/10 uppercase tracking-widest font-mono font-bold">
                            <Clock className="w-3 h-3" /> Delayed
                          </span>
                        )}
                      </div>

                      <p className={cn(
                        "text-4xl sm:text-5xl font-black font-mono tracking-tight",
                        isStreaming ? "text-primary" : "text-foreground"
                      )}>
                        ${safeFixed(currentPrice)}
                      </p>
                      <p className={cn("text-xs font-mono font-bold mt-1 flex items-center justify-start md:justify-end", priceIsUp ? "text-emerald-400" : "text-rose-400")}>
                        {priceIsUp ? '+' : ''}${safeFixed(currentChange)} ({safeFixed(currentChangePercent)}%) Today
                      </p>
                    </div>
                  </div>

                  {/* Micro-Stats Bar + Direct Quick Action Chips */}
                  <div className="pt-4 border-t border-border/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block font-sans">Market Cap</span>
                        <span className="font-bold text-foreground">{formatNumber(quote.marketCap)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block font-sans">Day Range</span>
                        <span className="font-bold text-foreground">${safeFixed(quote.dayLow)} - ${safeFixed(quote.dayHigh)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block font-sans">52W Range</span>
                        <span className="font-bold text-foreground">${safeFixed(quote.yearLow)} - ${safeFixed(quote.yearHigh)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block font-sans">P/E Multiple</span>
                        <span className="font-bold text-foreground">{safeFixed(quote.pe)}x</span>
                      </div>
                    </div>

                    {/* Direct Quick Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsTradeStructureModalOpen(true)}
                        className="h-8 text-xs font-bold bg-gradient-to-r from-purple-600/20 via-indigo-600/20 to-purple-600/20 text-purple-200 border-purple-500/40 hover:bg-purple-500/30 gap-1.5 shadow-sm"
                      >
                        <Layers className="w-3.5 h-3.5 text-purple-300" />
                        <span>Structure Trade Idea</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveDataTab('growth-valuation')}
                        className="h-8 text-xs font-bold bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 gap-1.5 shadow-sm"
                      >
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Growth & Forward Valuation</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveDataTab('ir-presentations')}
                        className="h-8 text-xs font-bold bg-purple-500/10 text-purple-300 border-purple-500/30 hover:bg-purple-500/20 gap-1.5 shadow-sm"
                      >
                        <Globe className="w-3.5 h-3.5 text-purple-400" />
                        <span>IR & Decks</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsFitModalOpen(true)}
                        className="h-8 text-xs font-bold bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20 gap-1.5 shadow-sm"
                      >
                        <Scale className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Portfolio Fit</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIdeaModalState({ open: true })}
                        className="h-8 text-xs font-bold bg-purple-500/10 text-purple-300 border-purple-500/30 hover:bg-purple-500/20 gap-1.5"
                      >
                        <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
                        <span>Trade Idea</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ================= DATA TABS RIBBON ================= */}
              <Tabs value={activeDataTab} onValueChange={setActiveDataTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 h-auto p-1.5 bg-card/70 backdrop-blur-xl border border-border/70 rounded-2xl gap-1.5">
                  <TabsTrigger
                    value="overview"
                    className="rounded-xl py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="structures"
                    className="rounded-xl py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:via-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5 text-purple-300" /> Structured Trades
                  </TabsTrigger>
                  <TabsTrigger
                    value="growth-valuation"
                    className="rounded-xl py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-300" /> Growth & Forward
                  </TabsTrigger>
                  <TabsTrigger
                    value="ir-presentations"
                    className="rounded-xl py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Globe className="w-3.5 h-3.5 text-cyan-300" /> IR & Decks
                  </TabsTrigger>
                  <TabsTrigger
                    value="fundamentals"
                    className="rounded-xl py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <PieChart className="w-3.5 h-3.5" /> Valuation
                  </TabsTrigger>
                  <TabsTrigger
                    value="financials"
                    className="rounded-xl py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Building2 className="w-3.5 h-3.5" /> Financials
                  </TabsTrigger>
                  <TabsTrigger
                    value="news"
                    className="rounded-xl py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Newspaper className="w-3.5 h-3.5" /> News
                  </TabsTrigger>
                  <TabsTrigger
                    value="ai-analysis"
                    className="rounded-xl py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex items-center justify-center gap-1.5 text-xs font-bold"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" /> AI Thesis
                  </TabsTrigger>
                  <TabsTrigger
                    value="reports"
                    className="rounded-xl py-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex items-center justify-center gap-1.5 text-xs font-bold"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Reports</span>
                    {savedReports.length > 0 && (
                      <span className="px-1.5 py-0 rounded-full bg-purple-400/30 text-[10px] font-mono font-bold">
                        {savedReports.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* ================= 0. STRUCTURED TRADES & IDEAS GENERATOR TAB ================= */}
                <TabsContent value="structures" className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <StructuredTradesCard
                    symbol={selectedSymbol}
                    currentPrice={currentPrice || quote?.price || 0}
                    companyName={quote?.name || dossier?.header?.shortName || selectedSymbol}
                    onNavigateToIdeas={() => onNavigateTab?.('ideas')}
                  />
                </TabsContent>

                {/* ================= 0. GROWTH & FORWARD VALUATION TAB ================= */}
                <TabsContent value="growth-valuation" className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <GrowthAndValuationCard symbol={selectedSymbol} />
                </TabsContent>

                {/* ================= 0.5. INVESTOR RELATIONS & PRESENTATIONS TAB ================= */}
                <TabsContent value="ir-presentations" className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <InvestorRelationsCard symbol={selectedSymbol} />
                </TabsContent>

                {/* ================= 1. OVERVIEW TAB ================= */}
                <TabsContent value="overview" className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* 4 Metric Spotlight Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-card/60 backdrop-blur-xl border border-border/60 hover:border-primary/40 transition-all rounded-2xl shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Volume</span>
                          <BarChart3 className="w-4 h-4 text-primary" />
                        </div>
                        <p className="font-mono text-xl font-black text-foreground">
                          {quote.volume ? Number(quote.volume).toLocaleString() : '—'}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Avg: {quote.avgVolume ? Number(quote.avgVolume).toLocaleString() : '—'}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-card/60 backdrop-blur-xl border border-border/60 hover:border-primary/40 transition-all rounded-2xl shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Market Cap</span>
                          <DollarSign className="w-4 h-4 text-primary" />
                        </div>
                        <p className="font-mono text-xl font-black text-foreground">
                          {formatNumber(quote.marketCap)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">Enterprise Size</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-card/60 backdrop-blur-xl border border-border/60 hover:border-primary/40 transition-all rounded-2xl shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Trailing P/E</span>
                          <ActivitySquare className="w-4 h-4 text-primary" />
                        </div>
                        <p className="font-mono text-xl font-black text-foreground">
                          {safeFixed(quote.pe)}x
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">Earnings Multiple</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-card/60 backdrop-blur-xl border border-border/60 hover:border-purple-500/40 transition-all rounded-2xl shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Imp. Volatility</span>
                          <Activity className="w-4 h-4 text-purple-400" />
                        </div>
                        <p className="font-mono text-xl font-black text-purple-200">
                          {streamingData.volatility ? safeFixed(streamingData.volatility * 100) + '%' : 'N/A'}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">Options Pricing Factor</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 52-Week Range Bar */}
                  <Card className="bg-card/60 backdrop-blur-xl border border-border/60 rounded-2xl overflow-hidden shadow-sm">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-foreground">
                        <LineChart className="w-4 h-4 text-primary" /> 52-Week Price Range
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-2">
                      <div className="flex justify-between text-xs font-mono font-bold">
                        <span className="text-rose-400">52W Low: ${safeFixed(quote.yearLow)}</span>
                        <span className="text-foreground">Current: ${safeFixed(currentPrice)}</span>
                        <span className="text-emerald-400">52W High: ${safeFixed(quote.yearHigh)}</span>
                      </div>
                      <div className="relative h-3 bg-accent/40 rounded-full overflow-hidden border border-border/50">
                        <div className="absolute h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 w-full" />
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-background shadow-[0_0_10px_rgba(0,0,0,0.6)] transition-all duration-500"
                          style={{
                            left: `${Math.min(100, Math.max(0, (((currentPrice || 0) - (quote.yearLow || 0)) / ((quote.yearHigh || 1) - (quote.yearLow || 0))) * 100))}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Portfolio Fit & Correlation Assessment Banner */}
                  <Card className="bg-gradient-to-r from-cyan-950/30 via-background/60 to-indigo-950/30 border border-cyan-500/30 hover:border-cyan-500/50 transition-all shadow-md rounded-2xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -z-10 group-hover:bg-cyan-500/10 transition-colors" />
                    <CardHeader className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
                            <Scale className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-bold text-foreground">
                              Portfolio Fit & Category Benchmarking
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground mt-0.5">
                              Evaluate portfolio correlation, sector concentration & head-to-head metrics vs. existing holdings.
                            </CardDescription>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setIsFitModalOpen(true)}
                          className="text-xs h-9 bg-cyan-600 hover:bg-cyan-500 text-white font-bold gap-1.5 shadow-md px-4 shrink-0"
                        >
                          <Scale className="w-3.5 h-3.5" /> Check Portfolio Fit
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Investor Relations & Latest Presentations Spotlight Banner */}
                  <Card className="bg-gradient-to-r from-purple-950/30 via-background/60 to-cyan-950/30 border border-purple-500/30 hover:border-purple-500/50 transition-all shadow-md rounded-2xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -z-10 group-hover:bg-purple-500/10 transition-colors" />
                    <CardHeader className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-sm">
                            <Globe className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-bold text-foreground">
                              Official Investor Relations & Latest Presentations
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground mt-0.5">
                              Direct access to official IR website, latest investor slide deck (PDF), earnings webcasts, and SEC EDGAR filings.
                            </CardDescription>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setActiveDataTab('ir-presentations')}
                          className="text-xs h-9 bg-purple-600 hover:bg-purple-500 text-white font-bold gap-1.5 shadow-md px-4 shrink-0"
                        >
                          <Globe className="w-3.5 h-3.5" /> View IR Hub & Decks
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Company Profile Card */}
                  {profile.summary && (
                    <Card className="bg-card/60 backdrop-blur-xl border border-border/60 rounded-2xl shadow-sm">
                      <CardHeader className="p-4 pb-2 border-b border-border/40 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Company Business Profile
                        </CardTitle>
                        {profile.website && (
                          <a
                            href={profile.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                          >
                            <span>Website</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </CardHeader>
                      <CardContent className="p-4 pt-3">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {profile.summary}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* ================= 2. FUNDAMENTALS TAB ================= */}
                <TabsContent value="fundamentals" className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Valuation Multiples */}
                    <Card className="bg-card/60 backdrop-blur-xl border border-border/60 rounded-2xl shadow-sm">
                      <CardHeader className="p-4 pb-3 border-b border-border/40 flex flex-row items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary"><PieChart className="w-4 h-4" /></div>
                        <CardTitle className="text-sm font-bold text-foreground">Valuation & Growth Multiples</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3 font-mono text-xs">
                        <div className="flex justify-between items-center border-b border-border/40 pb-2">
                          <span className="font-sans text-muted-foreground">P/E Ratio (Trailing)</span>
                          <span className="font-bold text-foreground">{safeFixed(quote.pe)}x</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-border/40 pb-2">
                          <span className="font-sans text-muted-foreground">Price to Sales (P/S)</span>
                          <span className="font-bold text-foreground">{safeFixed(financials?.priceToSales)}x</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-border/40 pb-2">
                          <span className="font-sans text-muted-foreground">Earnings Per Share (EPS)</span>
                          <span className="font-bold text-foreground">${safeFixed(quote.eps)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-1">
                          <span className="font-sans text-muted-foreground">Market Capitalization</span>
                          <span className="font-bold text-foreground">{formatNumber(quote.marketCap)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Profitability & Returns */}
                    <Card className="bg-card/60 backdrop-blur-xl border border-border/60 rounded-2xl shadow-sm">
                      <CardHeader className="p-4 pb-3 border-b border-border/40 flex flex-row items-center gap-2">
                        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400"><Percent className="w-4 h-4" /></div>
                        <CardTitle className="text-sm font-bold text-foreground">Profitability & Capital Efficiency</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3 font-mono text-xs">
                        <div className="flex justify-between items-center border-b border-border/40 pb-2">
                          <span className="font-sans text-muted-foreground">Operating Margin</span>
                          <span className="font-bold text-emerald-400">
                            {financials?.operatingMargin ? safeFixed(financials.operatingMargin * 100) + '%' : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-border/40 pb-2">
                          <span className="font-sans text-muted-foreground">Return on Equity (ROE)</span>
                          <span className="font-bold text-emerald-400">
                            {financials?.roe ? safeFixed(financials.roe * 100) + '%' : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-border/40 pb-2">
                          <span className="font-sans text-muted-foreground">Return on Assets (ROA)</span>
                          <span className="font-bold text-foreground">
                            {financials?.roa ? safeFixed(financials.roa * 100) + '%' : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-1">
                          <span className="font-sans text-muted-foreground">Debt-to-Equity Multiple</span>
                          <span className={cn(
                            "font-bold",
                            (financials?.debtToEquity || 0) > 100 ? "text-rose-400" : "text-emerald-400"
                          )}>
                            {safeFixed(financials?.debtToEquity)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* ================= 3. FINANCIALS TAB ================= */}
                <TabsContent value="financials" className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <Card className="bg-card/60 backdrop-blur-xl border border-border/60 rounded-2xl shadow-sm">
                    <CardHeader className="p-4 pb-3 border-b border-border/40 flex flex-row items-center gap-2">
                      <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400"><Building2 className="w-4 h-4" /></div>
                      <CardTitle className="text-sm font-bold text-foreground">Balance Sheet & Liquidity Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 font-mono text-xs">
                      <div className="flex justify-between items-center border-b border-border/40 pb-2">
                        <span className="font-sans text-muted-foreground">Enterprise Value (EV)</span>
                        <span className="font-bold text-foreground">{formatNumber(financials?.enterpriseValue)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-border/40 pb-2">
                        <span className="font-sans text-muted-foreground">Market Capitalization</span>
                        <span className="font-bold text-foreground">{formatNumber(quote.marketCap)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-border/40 pb-2">
                        <span className="font-sans text-muted-foreground">Debt to Equity</span>
                        <span className={cn(
                          "font-bold",
                          (financials?.debtToEquity || 0) > 100 ? "text-rose-400" : "text-emerald-400"
                        )}>
                          {safeFixed(financials?.debtToEquity)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b border-border/40 pb-2">
                        <span className="font-sans text-muted-foreground">Levered Free Cash Flow</span>
                        <span className="font-bold text-emerald-400">{formatNumber(financials?.fcf)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ================= 4. NEWS TAB ================= */}
                <TabsContent value="news" className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {dossier?.news && dossier.news.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3.5">
                      {dossier.news.map((item: any, i: number) => (
                        <a
                          key={i}
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block"
                        >
                          <Card className="bg-card/60 hover:bg-card/90 backdrop-blur-xl border border-border/60 hover:border-primary/40 transition-all rounded-2xl shadow-sm p-4">
                            <div className="flex gap-4 items-start">
                              <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors shrink-0 text-primary">
                                <Newspaper className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors leading-snug mb-1">
                                  {item.title}
                                </h4>
                                <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
                                  <Badge variant="secondary" className="text-[10px] font-semibold bg-accent/60">
                                    {item.publisher || 'Market Wire'}
                                  </Badge>
                                  {item.providerPublishTime && (
                                    <span className="flex items-center gap-1 font-mono text-[10px]">
                                      <Clock className="w-3 h-3" />
                                      {new Date(item.providerPublishTime * 1000).toLocaleString(undefined, {
                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-1" />
                            </div>
                          </Card>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <Card className="bg-card/30 border-dashed border-2 border-border/60 py-12 rounded-2xl text-center">
                      <CardContent className="flex flex-col items-center justify-center">
                        <Newspaper className="w-10 h-10 text-muted-foreground/40 mb-3" />
                        <h3 className="text-base font-bold text-foreground">No News Feed Data</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                          Recent news articles for {quote.symbol} have not populated from data providers.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* ================= 5. AI THESIS TAB ================= */}
                <TabsContent value="ai-analysis" className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <Card className="bg-card/60 backdrop-blur-xl border border-border/70 rounded-2xl shadow-lg overflow-hidden relative">
                    <CardHeader className="p-5 pb-4 border-b border-border/50 bg-gradient-to-r from-purple-950/30 via-background to-indigo-950/30 flex flex-row items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-foreground">AI Fundamental & Valuation Thesis</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">Synthesized by Hedge Fund Analyst Agent using live dossier telemetry</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {aiLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3">
                          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                          <p className="text-xs font-semibold text-muted-foreground animate-pulse">Running advanced AI equity thesis evaluation...</p>
                        </div>
                      ) : aiError ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-2 text-center">
                          <AlertTriangle className="h-8 w-8 text-destructive" />
                          <p className="text-xs font-bold text-destructive">Failed to generate AI Analysis</p>
                          <p className="text-[11px] text-muted-foreground">Verify OPENROUTER_API_KEY in your settings.</p>
                        </div>
                      ) : parsedAiAnalysis ? (
                        <div className="space-y-6">
                          {/* Company Overview */}
                          {parsedAiAnalysis.overview && (
                            <section className="space-y-2">
                              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-primary" /> Core Overview
                              </h3>
                              <p className="text-xs text-foreground/90 leading-relaxed bg-accent/20 p-4 rounded-xl border border-border/40">
                                {parsedAiAnalysis.overview}
                              </p>
                            </section>
                          )}

                          {/* Key Metrics Grid */}
                          {parsedAiAnalysis.keyMetrics && Object.keys(parsedAiAnalysis.keyMetrics).length > 0 && (
                            <section className="space-y-2">
                              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <PieChart className="w-3.5 h-3.5 text-primary" /> Key Financial Drivers
                              </h3>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {Object.entries(parsedAiAnalysis.keyMetrics).map(([key, val]) => (
                                  <div key={key} className="bg-background/60 p-3 rounded-xl border border-border/50">
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-bold mb-0.5">{key}</span>
                                    <span className="font-mono text-sm font-bold text-foreground">{val as string}</span>
                                  </div>
                                ))}
                              </div>
                            </section>
                          )}

                          {/* Red Flags / Alerts */}
                          {parsedAiAnalysis.redFlags && parsedAiAnalysis.redFlags.length > 0 && (
                            <section className="space-y-2">
                              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" /> Risk Factors & Red Flags
                              </h3>
                              <div className="space-y-2">
                                {parsedAiAnalysis.redFlags.map((flag: string, idx: number) => (
                                  <div key={idx} className="flex items-start gap-2.5 bg-rose-950/20 border border-rose-800/40 p-3 rounded-xl text-xs text-rose-200">
                                    <span className="text-rose-400 font-bold">•</span>
                                    <span>{flag}</span>
                                  </div>
                                ))}
                              </div>
                            </section>
                          )}

                          {/* Deep Dive */}
                          {parsedAiAnalysis.deepDive && (
                            <section className="space-y-2">
                              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Deep Dive Analysis
                              </h3>
                              <p className="text-xs text-foreground/90 leading-relaxed bg-accent/20 p-4 rounded-xl border border-border/40">
                                {parsedAiAnalysis.deepDive}
                              </p>
                            </section>
                          )}
                        </div>
                      ) : (
                        <div className="prose prose-invert prose-p:text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground max-w-none text-xs leading-relaxed">
                          <ReactMarkdown>{aiData?.analysis || "No analysis available."}</ReactMarkdown>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ================= 6. AUTONOMOUS REPORTS TAB ================= */}
                <TabsContent value="reports" className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <AutonomousReportsList symbol={selectedSymbol} />
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card className="h-[420px] flex items-center justify-center bg-card/40 backdrop-blur-md border-dashed border-2 border-border/60 rounded-2xl">
              <div className="text-center space-y-2">
                <Search className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-base font-bold text-foreground">Awaiting Asset Selection</p>
                <p className="text-xs text-muted-foreground">Select a ticker from the explorer sidebar to compile its dossier.</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Prompt Manager Modal */}
      <PromptManagerModal
        open={isPromptModalOpen}
        onOpenChange={setIsPromptModalOpen}
        onSelectPrompt={(t) => setSelectedPromptSlug(t.slug)}
      />

      {/* Stock Note Modal */}
      <StockNoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        symbol={selectedSymbol}
        stockName={quote?.name || dossier?.header?.shortName}
        currentPrice={currentPrice || quote?.price}
      />

      {/* Autonomous Report Viewer Modal */}
      <AutonomousReportViewerModal
        report={viewerReport}
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setViewerReport(null);
        }}
        onDeleteSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['autonomousReports', selectedSymbol] });
          queryClient.invalidateQueries({ queryKey: ['allAutonomousReports'] });
        }}
      />

      {/* Portfolio Fit & Category Benchmark Modal */}
      <PortfolioFitModal
        isOpen={isFitModalOpen}
        onClose={() => setIsFitModalOpen(false)}
        symbol={selectedSymbol}
        onOpenNote={(sym) => {
          setSelectedSymbol(sym);
          setIsNoteModalOpen(true);
        }}
        onOpenTradeIdea={(sym, thesis) => {
          setIdeaModalState({ open: true, initialThesis: thesis });
        }}
      />

      {/* Trade Idea Writing Modal */}
      <IdeaModal
        isOpen={ideaModalState.open}
        onClose={() => setIdeaModalState({ open: false })}
        initialSymbol={selectedSymbol}
        initialContent={ideaModalState.initialThesis}
      />

      {/* Trade Structure & Playbook Modal */}
      <TradeStructureModal
        isOpen={isTradeStructureModalOpen}
        onClose={() => setIsTradeStructureModalOpen(false)}
        initialSymbol={selectedSymbol}
        initialPrice={currentPrice || quote?.price || 0}
        initialThesis={dossier?.companyOverview || ''}
        onSavedSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['tradeIdeas'] });
        }}
      />
    </div>
  );
}
