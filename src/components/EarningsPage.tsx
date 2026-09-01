import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Search,
  Plus,
  Briefcase,
  Eye,
  TrendingUp,
  TrendingDown,
  Sun,
  Moon,
  Clock,
  ExternalLink,
  Bell,
  Zap,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  DollarSign,
  PieChart,
  LayoutGrid,
  List,
  RotateCcw,
  Loader2,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useEarningsData,
  lookupSymbolEarnings,
  downloadEarningsCalendarIcs,
  EarningsItem,
} from '@/services/earningsService';
import { EarningsCalendarView } from './earnings/EarningsCalendarView';
import { PriceAlertModal } from './PriceAlertModal';
import { TradeStructureModal } from './TradeStructureModal';

interface EarningsPageProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
  onNavigateToWatchlist?: () => void;
}

type ScopeFilter = 'ALL' | 'PORTFOLIO' | 'WATCHLIST' | 'SEARCHED';
type TimeframeFilter = 'ALL' | 'THIS_WEEK' | 'NEXT_WEEK' | 'THIS_MONTH' | 'NEXT_90' | 'PAST';

export function EarningsPage({
  onNavigateToResearch,
  onNavigateToGraphs,
  onNavigateToWatchlist,
}: EarningsPageProps) {
  // Custom searched symbols
  const [customSymbols, setCustomSymbols] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Filters and Views
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>('ALL');
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'TABLE'>('CALENDAR');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Modals state
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertModalTarget, setAlertModalTarget] = useState<EarningsItem | null>(null);

  const [isTradeStructureModalOpen, setIsTradeStructureModalOpen] = useState(false);
  const [tradeStructureTarget, setTradeStructureTarget] = useState<EarningsItem | null>(null);

  // Fetch earnings data query
  const { data: earningsData, isLoading, refetch, isRefetching } = useEarningsData(customSymbols);

  const rawItems = earningsData?.items || [];
  const summary = earningsData?.summary;

  // Add custom ticker search handler
  const handleAddSearchTicker = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const sym = searchInput.trim().toUpperCase();
    if (!sym) return;

    if (customSymbols.includes(sym) || rawItems.some((it) => it.symbol === sym)) {
      toast.info(`${sym} is already in your earnings list.`);
      setSearchInput('');
      return;
    }

    setIsSearching(true);
    toast.info(`Looking up earnings date for ${sym}...`);

    try {
      const lookupResult = await lookupSymbolEarnings(sym);
      if (lookupResult) {
        setCustomSymbols((prev) => [...prev, sym]);
        setSearchInput('');
        toast.success(`Found earnings for ${sym} (${lookupResult.companyName})!`, {
          description: lookupResult.earningsDate
            ? `Reporting on ${lookupResult.earningsDateFormatted} (${lookupResult.timing})`
            : 'Date currently pending.',
        });
      } else {
        toast.error(`Could not locate earnings telemetry for ${sym}`);
      }
    } catch (err: any) {
      toast.error(err.message || `Failed to lookup ${sym}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Filtered earnings items list
  const filteredItems = useMemo(() => {
    return rawItems.filter((item) => {
      // 1. Scope filter
      if (scopeFilter === 'PORTFOLIO' && !item.isPortfolioHolding) return false;
      if (scopeFilter === 'WATCHLIST' && !item.isWatchlist) return false;
      if (scopeFilter === 'SEARCHED' && !item.isCustomSearch) return false;

      // 2. Calendar selected date filter
      if (selectedCalendarDate) {
        if (!item.earningsDate) return false;
        const itemDateKey = item.earningsDate.split('T')[0];
        if (itemDateKey !== selectedCalendarDate) return false;
      }

      // 3. Timeframe filter
      if (timeframeFilter === 'THIS_WEEK') {
        if (item.daysUntil === null || item.daysUntil < 0 || item.daysUntil > 7) return false;
      } else if (timeframeFilter === 'NEXT_WEEK') {
        if (item.daysUntil === null || item.daysUntil <= 7 || item.daysUntil > 14) return false;
      } else if (timeframeFilter === 'THIS_MONTH') {
        if (item.daysUntil === null || item.daysUntil < 0 || item.daysUntil > 30) return false;
      } else if (timeframeFilter === 'NEXT_90') {
        if (item.daysUntil === null || item.daysUntil < 0 || item.daysUntil > 90) return false;
      } else if (timeframeFilter === 'PAST') {
        if (item.daysUntil === null || item.daysUntil >= 0) return false;
      } else if (timeframeFilter === 'ALL') {
        // Default: upcoming and pending dates first
      }

      return true;
    });
  }, [rawItems, scopeFilter, timeframeFilter, selectedCalendarDate]);

  // Open Alert Modal helper
  const handleOpenAlert = (item: EarningsItem) => {
    setAlertModalTarget(item);
    setIsAlertModalOpen(true);
  };

  // Open Trade Structuring Modal helper
  const handleOpenTradeStructure = (item: EarningsItem) => {
    setTradeStructureTarget(item);
    setIsTradeStructureModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* ================= 1. HEADER RIBBON ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/20 to-primary/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground glow-text-white">
                Earnings Calendar & Catalysts
              </h1>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-xs font-mono">
                {rawItems.length} Monitored
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live earnings release dates, consensus EPS/Revenue estimates, and catalyst timing across your portfolio & watchlists
            </p>
          </div>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-xl border border-border/60 bg-card/60 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('CALENDAR')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                viewMode === 'CALENDAR'
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Calendar View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                viewMode === 'TABLE'
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="w-3.5 h-3.5" />
              <span>Schedule Table</span>
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-9 gap-1.5 text-xs font-bold bg-background/60 hover:bg-accent border-border/60"
          >
            <RotateCcw className={cn("w-3.5 h-3.5 text-muted-foreground", isRefetching && "animate-spin text-primary")} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* ================= 2. EXECUTIVE STATS CARDS RIBBON ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Next Imminent Holding */}
        <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden relative group">
          <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-indigo-500" />
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                Next Portfolio Reporting
              </span>
              {summary?.nextReportingHolding && (
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] font-mono">
                  {summary.nextReportingHolding.daysUntil === 0
                    ? 'Today'
                    : summary.nextReportingHolding.daysUntil === 1
                    ? 'Tomorrow'
                    : `In ${summary.nextReportingHolding.daysUntil} days`}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            {summary?.nextReportingHolding ? (
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-black text-foreground font-mono">
                    ${summary.nextReportingHolding.symbol}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">
                    {summary.nextReportingHolding.earningsDateFormatted}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate max-w-[160px]">{summary.nextReportingHolding.companyName}</span>
                  <span className="font-mono font-bold text-foreground">
                    {summary.nextReportingHolding.timing === 'BMO' ? '🌅 Pre-Market' : '🌙 Post-Market'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-2">No impending portfolio releases</p>
            )}
          </CardContent>
        </Card>

        {/* Reporting This Week */}
        <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden relative group">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Reporting This Week (7d)
              </span>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-mono">
                {summary?.reportingThisWeek || 0} Companies
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-black text-foreground font-mono">
              {summary?.reportingThisWeek || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary?.reportingNextWeek || 0} scheduled for next week
            </p>
          </CardContent>
        </Card>

        {/* Next 30 Days Exposure */}
        <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden relative group">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <PieChart className="w-3.5 h-3.5 text-emerald-400" />
                Portfolio Capital at Risk
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-mono">
                Next 30 Days
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-black text-foreground font-mono">
              ${(summary?.totalPortfolioValueAtRisk || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Across {summary?.reportingThisMonth || 0} upcoming reporting holdings
            </p>
          </CardContent>
        </Card>

        {/* Total Monitored Universe */}
        <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden relative group">
          <div className="h-1 w-full bg-gradient-to-r from-cyan-500 to-blue-500" />
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                Catalyst Radar Scope
              </span>
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px] font-mono">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-black text-foreground font-mono">
              {summary?.totalMonitored || rawItems.length}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary?.portfolioCount || 0} Holdings · {summary?.watchlistCount || 0} Watchlist
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ================= 3. SEARCH & FILTER TOOLBAR ================= */}
      <div className="p-4 rounded-2xl bg-card/70 backdrop-blur-xl border border-border/70 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Instant Search Bar */}
          <form onSubmit={handleAddSearchTicker} className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search ticker (e.g. TSLA, NVDA, COIN, RBRK, EOS)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 pr-24 h-10 text-xs bg-background/60 border-border/60 focus:border-primary rounded-xl font-mono uppercase"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!searchInput.trim() || isSearching}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-2.5 text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
            >
              {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              <span>Add</span>
            </Button>
          </form>

          {/* Scope Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setScopeFilter('ALL')}
              className={cn(
                "h-8 text-xs font-bold transition-all",
                scopeFilter === 'ALL'
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background/60 text-muted-foreground border-border/60"
              )}
            >
              All ({rawItems.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setScopeFilter('PORTFOLIO')}
              className={cn(
                "h-8 text-xs font-bold gap-1 transition-all",
                scopeFilter === 'PORTFOLIO'
                  ? "bg-purple-600 text-white border-purple-500"
                  : "bg-background/60 text-muted-foreground border-border/60"
              )}
            >
              <Briefcase className="w-3 h-3" />
              <span>Portfolio ({rawItems.filter((i) => i.isPortfolioHolding).length})</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setScopeFilter('WATCHLIST')}
              className={cn(
                "h-8 text-xs font-bold gap-1 transition-all",
                scopeFilter === 'WATCHLIST'
                  ? "bg-sky-600 text-white border-sky-500"
                  : "bg-background/60 text-muted-foreground border-border/60"
              )}
            >
              <Eye className="w-3 h-3" />
              <span>Watchlist ({rawItems.filter((i) => i.isWatchlist).length})</span>
            </Button>
            {customSymbols.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setScopeFilter('SEARCHED')}
                className={cn(
                  "h-8 text-xs font-bold gap-1 transition-all",
                  scopeFilter === 'SEARCHED'
                    ? "bg-amber-600 text-white border-amber-500"
                    : "bg-background/60 text-muted-foreground border-border/60"
                )}
              >
                <Search className="w-3 h-3" />
                <span>Searched ({customSymbols.length})</span>
              </Button>
            )}
          </div>
        </div>

        {/* Timeframe Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-border/40 pt-3">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
            Timeframe:
          </span>
          {[
            { id: 'ALL', label: 'All Upcoming' },
            { id: 'THIS_WEEK', label: 'This Week (7d)' },
            { id: 'NEXT_WEEK', label: 'Next Week (14d)' },
            { id: 'THIS_MONTH', label: 'Next 30 Days' },
            { id: 'NEXT_90', label: 'Next 90 Days' },
            { id: 'PAST', label: 'Recent Results (Past)' },
          ].map((tf) => (
            <button
              key={tf.id}
              type="button"
              onClick={() => setTimeframeFilter(tf.id as TimeframeFilter)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 border",
                timeframeFilter === tf.id
                  ? "bg-accent text-accent-foreground border-border/80 shadow-xs"
                  : "bg-background/40 text-muted-foreground border-border/40 hover:bg-accent/40"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================= 4. MAIN VIEW: CALENDAR OR TABLE ================= */}
      {isLoading ? (
        <div className="p-16 text-center rounded-2xl bg-card/60 border border-border/60 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-semibold text-foreground">Fetching live earnings calendar...</p>
          <p className="text-xs text-muted-foreground">Gathering catalyst telemetry across your positions</p>
        </div>
      ) : (
        <div className="space-y-6">
          {viewMode === 'CALENDAR' ? (
            <div className="space-y-6">
              <EarningsCalendarView
                items={filteredItems}
                selectedDate={selectedCalendarDate}
                onSelectDate={setSelectedCalendarDate}
                onNavigateToResearch={onNavigateToResearch}
                onOpenPriceAlert={handleOpenAlert}
              />

              {/* Day Selection Details Banner */}
              {selectedCalendarDate && (
                <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/40 space-y-3 shadow-md animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                        <CalendarIcon className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">
                        Earnings Releases on{' '}
                        {new Date(selectedCalendarDate + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </h3>
                      <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-xs font-mono">
                        {filteredItems.length} Companies
                      </Badge>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedCalendarDate(null)}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* ================= 5. EARNINGS SCHEDULE TABLE ================= */}
          <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/50 bg-accent/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Earnings Schedule & Consensus Radar ({filteredItems.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Consensus estimates, reporting dates, timing, and portfolio exposure
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredItems.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <CalendarIcon className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">No earnings releases matching your filter</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Try clearing the date filter or searching for additional tickers using the search bar above.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setScopeFilter('ALL');
                      setTimeframeFilter('ALL');
                      setSelectedCalendarDate(null);
                    }}
                    className="text-xs font-semibold"
                  >
                    Reset All Filters
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/25 text-muted-foreground font-bold uppercase text-[10px] tracking-wider">
                        <th className="p-3.5 pl-5">Asset / Company</th>
                        <th className="p-3.5">Spot Price</th>
                        <th className="p-3.5">Reporting Date & Timing</th>
                        <th className="p-3.5">Countdown</th>
                        <th className="p-3.5 text-right">EPS Estimate</th>
                        <th className="p-3.5 text-right">Revenue Estimate</th>
                        <th className="p-3.5 text-right">Portfolio Exposure</th>
                        <th className="p-3.5 pr-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredItems.map((item) => (
                        <tr
                          key={item.symbol}
                          className={cn(
                            "hover:bg-accent/30 transition-colors group",
                            item.isPortfolioHolding && "bg-purple-950/10"
                          )}
                        >
                          {/* Asset Name & Badges */}
                          <td className="p-3.5 pl-5">
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToResearch?.(item.symbol)}
                                    className="font-bold text-foreground font-mono hover:text-primary transition-colors flex items-center gap-1 text-sm"
                                    title="Open Research Page"
                                  >
                                    <span>${item.symbol}</span>
                                    <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                                  </button>
                                  {item.isPortfolioHolding && (
                                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[9px] font-mono">
                                      Portfolio
                                    </Badge>
                                  )}
                                  {item.isWatchlist && (
                                    <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-[9px] font-mono">
                                      Watchlist
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[11px] text-muted-foreground block truncate max-w-[180px]">
                                  {item.companyName}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Spot Price & Change */}
                          <td className="p-3.5 font-mono">
                            <span className="font-bold text-foreground block">${item.price.toFixed(2)}</span>
                            <span
                              className={cn(
                                "text-[10px] font-bold block",
                                item.dayChangePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                              )}
                            >
                              {item.dayChangePercent >= 0 ? '+' : ''}{item.dayChangePercent.toFixed(2)}%
                            </span>
                          </td>

                          {/* Reporting Date & Timing */}
                          <td className="p-3.5 font-mono">
                            <span className="font-bold text-foreground block">
                              {item.earningsDateFormatted}
                            </span>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              {item.timing === 'BMO' ? (
                                <>
                                  <Sun className="w-3 h-3 text-amber-400" />
                                  <span>Before Market Open (BMO)</span>
                                </>
                              ) : item.timing === 'AMC' ? (
                                <>
                                  <Moon className="w-3 h-3 text-indigo-400" />
                                  <span>After Market Close (AMC)</span>
                                </>
                              ) : (
                                <span>Timing Unspecified</span>
                              )}
                            </span>
                          </td>

                          {/* Countdown */}
                          <td className="p-3.5">
                            {item.daysUntil !== null ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "font-mono font-bold text-xs px-2 py-0.5",
                                  item.daysUntil === 0
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse"
                                    : item.daysUntil === 1
                                    ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                                    : item.daysUntil > 1 && item.daysUntil <= 7
                                    ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/40"
                                    : item.daysUntil > 7
                                    ? "bg-secondary text-muted-foreground border-border/60"
                                    : "bg-slate-800 text-slate-400 border-slate-700"
                                )}
                              >
                                {item.daysUntil === 0
                                  ? '🎯 Today'
                                  : item.daysUntil === 1
                                  ? '⚡ Tomorrow'
                                  : item.daysUntil > 1
                                  ? `In ${item.daysUntil} days`
                                  : `${Math.abs(item.daysUntil)}d ago`}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">Pending Date</span>
                            )}
                          </td>

                          {/* EPS Estimate */}
                          <td className="p-3.5 text-right font-mono">
                            {item.epsEstimate != null ? (
                              <>
                                <span className="font-bold text-foreground block">
                                  ${item.epsEstimate.toFixed(2)}
                                </span>
                                {(item.epsLow != null && item.epsHigh != null) && (
                                  <span className="text-[10px] text-muted-foreground block">
                                    ${item.epsLow.toFixed(2)} - ${item.epsHigh.toFixed(2)}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            )}
                          </td>

                          {/* Revenue Estimate */}
                          <td className="p-3.5 text-right font-mono">
                            {item.revenueEstimate != null ? (
                              <>
                                <span className="font-bold text-foreground block">
                                  ${item.revenueEstimate >= 1e9
                                    ? (item.revenueEstimate / 1e9).toFixed(2) + 'B'
                                    : (item.revenueEstimate / 1e6).toFixed(2) + 'M'}
                                </span>
                                {(item.revenueLow != null && item.revenueHigh != null) && (
                                  <span className="text-[10px] text-muted-foreground block">
                                    ${(item.revenueLow / 1e9).toFixed(1)}B - ${(item.revenueHigh / 1e9).toFixed(1)}B
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            )}
                          </td>

                          {/* Portfolio Exposure */}
                          <td className="p-3.5 text-right font-mono">
                            {item.isPortfolioHolding && item.portfolioMarketValue != null ? (
                              <div>
                                <span className="font-bold text-purple-300 block">
                                  ${item.portfolioMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                                <span className="text-[10px] text-muted-foreground block">
                                  {item.portfolioQuantity} shares
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">Not Held</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 pr-5 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onNavigateToResearch?.(item.symbol)}
                                className="h-7 w-7 p-0 rounded-lg hover:bg-primary/20 hover:text-primary"
                                title="Research Company"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenAlert(item)}
                                className="h-7 w-7 p-0 rounded-lg hover:bg-amber-500/20 hover:text-amber-300"
                                title="Set Price Alert"
                              >
                                <Bell className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenTradeStructure(item)}
                                className="h-7 w-7 p-0 rounded-lg hover:bg-purple-500/20 hover:text-purple-300"
                                title="Structure Derivatives / Earnings Play"
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </Button>

                              {item.earningsDate && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    downloadEarningsCalendarIcs(item);
                                    toast.success(`Downloaded calendar reminder for ${item.symbol} Earnings!`);
                                  }}
                                  className="h-7 w-7 p-0 rounded-lg hover:bg-accent hover:text-foreground"
                                  title="Add to iCal / Google Calendar"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================= 6. MODALS ================= */}
      {isAlertModalOpen && (
        <PriceAlertModal
          open={isAlertModalOpen}
          onOpenChange={setIsAlertModalOpen}
          initialSymbol={alertModalTarget?.symbol || ''}
          initialPrice={alertModalTarget?.price || 0}
          initialNotes={
            alertModalTarget
              ? `Earnings Catalyst: ${alertModalTarget.symbol} reporting on ${alertModalTarget.earningsDateFormatted} (${alertModalTarget.timing})`
              : undefined
          }
          onSuccess={() => {
            toast.success(`Price alert created for ${alertModalTarget?.symbol}!`);
          }}
        />
      )}

      <TradeStructureModal
        isOpen={isTradeStructureModalOpen}
        onClose={() => setIsTradeStructureModalOpen(false)}
        initialSymbol={tradeStructureTarget?.symbol || 'NVDA'}
        initialThesis={
          tradeStructureTarget
            ? `Trading upcoming earnings catalyst for ${tradeStructureTarget.symbol} on ${tradeStructureTarget.earningsDateFormatted}. Implied volatility play or post-earnings drift.`
            : ''
        }
        initialSentiment="BULLISH"
        onNavigateToTrades={() => {}}
      />
    </div>
  );
}
