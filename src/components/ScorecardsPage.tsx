import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Zap,
  BarChart3,
  Scale,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Target,
  ShieldAlert,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Compass,
  Activity,
  Search,
  SlidersHorizontal,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon,
  Trophy,
  Filter,
  ArrowRight,
  Eye,
  Plus,
  Play,
  Pause,
  Clock,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Briefcase,
  Bookmark,
  Building2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useScorecards,
  useScorecardsWorkerStatus,
  useStartScorecardsWorker,
  usePauseScorecardsWorker,
  useResumeScorecardsWorker,
  useRefreshSingleStockScorecard,
  useAnalyzeLatestEarnings,
  StockScorecard,
  LatestEarningsAnalysisResult,
} from '@/services/scorecardService';
import { StockScorecardModal } from './scorecards/StockScorecardModal';
import { ScorecardCompareModal } from './scorecards/ScorecardCompareModal';
import { StockEarningsAnalysisModal } from './scorecards/StockEarningsAnalysisModal';

interface ScorecardsPageProps {
  onNavigateToResearch?: (symbol: string) => void;
}

type SourceCategory = 'ALL' | 'BROKERS' | 'WATCHLISTS' | 'HIGH_CONVICTION' | 'DEEP_VALUE' | 'QUALITY_KINGS';
type SortOption =
  | 'RANK'
  | 'SYMBOL'
  | 'PRICE'
  | 'CHANGE'
  | 'OVERALL'
  | 'BUYING'
  | 'FUNDAMENTALS'
  | 'VALUATION'
  | 'FORWARD_PE'
  | 'UPSIDE'
  | 'ANALYZED'
  | 'MARKET_CAP';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'GRID' | 'TABLE';

export function ScorecardsPage({ onNavigateToResearch }: ScorecardsPageProps) {
  const { data: scorecardsData, isLoading, refetch, isRefetching } = useScorecards();
  const { data: workerStatus } = useScorecardsWorkerStatus();
  const startWorker = useStartScorecardsWorker();
  const pauseWorker = usePauseScorecardsWorker();
  const resumeWorker = useResumeScorecardsWorker();
  const refreshSingle = useRefreshSingleStockScorecard();
  const analyzeEarnings = useAnalyzeLatestEarnings();

  // Multi-tier Source Filters
  const [sourceCategory, setSourceCategory] = useState<SourceCategory>('ALL');
  const [selectedBroker, setSelectedBroker] = useState<string>('ALL');
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>('ALL');

  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('RANK');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('TABLE'); // Default view is TABLE

  // Modal states
  const [selectedScorecard, setSelectedScorecard] = useState<StockScorecard | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Single refresh & Earnings states
  const [refreshingSymbol, setRefreshingSymbol] = useState<string | null>(null);
  const [earningsResult, setEarningsResult] = useState<LatestEarningsAnalysisResult | null>(null);
  const [isEarningsModalOpen, setIsEarningsModalOpen] = useState(false);
  const [analyzingEarningsSymbol, setAnalyzingEarningsSymbol] = useState<string | null>(null);

  const rawScorecards = scorecardsData?.scorecards || [];
  const summary = scorecardsData?.summary;
  const sectors = scorecardsData?.sectors || [];

  // Derived available brokers list with evaluated counts
  const availableBrokers = useMemo(() => {
    if (scorecardsData?.brokers && scorecardsData.brokers.length > 0) {
      return scorecardsData.brokers;
    }
    const map = new Map<string, number>();
    rawScorecards.forEach((s) => {
      const bList = s.brokers && s.brokers.length > 0
        ? s.brokers
        : s.holdingDetails?.broker
        ? [s.holdingDetails.broker]
        : [];
      bList.forEach((b) => {
        map.set(b, (map.get(b) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [scorecardsData?.brokers, rawScorecards]);

  // Derived available watchlists list with evaluated counts
  const availableWatchlists = useMemo(() => {
    if (scorecardsData?.watchlists && scorecardsData.watchlists.length > 0) {
      return scorecardsData.watchlists;
    }
    const map = new Map<string, number>();
    rawScorecards.forEach((s) => {
      (s.watchlistNames || []).forEach((w) => {
        map.set(w, (map.get(w) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [scorecardsData?.watchlists, rawScorecards]);

  // Total evaluated holdings count
  const totalHoldingsCount = useMemo(() => {
    return rawScorecards.filter((s) => s.isHolding).length;
  }, [rawScorecards]);

  // Total evaluated watchlist count
  const totalWatchlistCount = useMemo(() => {
    return rawScorecards.filter((s) => s.isWatchlist).length;
  }, [rawScorecards]);

  // Broker badge design mapping helper
  const getBrokerBadgeStyle = (broker: string) => {
    const b = (broker || '').toLowerCase();
    if (b.includes('interactive') || b.includes('ibkr')) {
      return {
        label: 'IBKR',
        fullLabel: 'Interactive Brokers',
        badgeClass: 'bg-red-500/15 text-red-300 border-red-500/35 hover:bg-red-500/25',
        dotColor: 'bg-red-400',
      };
    }
    if (b.includes('tasty')) {
      return {
        label: 'Tastytrade',
        fullLabel: 'Tastytrade',
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25',
        dotColor: 'bg-amber-400',
      };
    }
    if (b.includes('212')) {
      return {
        label: 'Trading 212',
        fullLabel: 'Trading 212',
        badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/35 hover:bg-sky-500/25',
        dotColor: 'bg-sky-400',
      };
    }
    return {
      label: broker || 'Broker',
      fullLabel: broker || 'Broker',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25',
      dotColor: 'bg-emerald-400',
    };
  };

  // Watchlist badge styling helper
  const getWatchlistBadgeStyle = (wlName: string) => {
    return {
      label: wlName,
      badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/35 hover:bg-purple-500/25',
      dotColor: 'bg-purple-400',
    };
  };

  // Synchronized dropdown state helper
  const activeDropdownValue = useMemo(() => {
    if (sourceCategory === 'ALL') return 'ALL';
    if (sourceCategory === 'BROKERS') {
      return selectedBroker === 'ALL' ? 'BROKER:ALL' : `BROKER:${selectedBroker}`;
    }
    if (sourceCategory === 'WATCHLISTS') {
      return selectedWatchlist === 'ALL' ? 'WATCHLIST:ALL' : `WATCHLIST:${selectedWatchlist}`;
    }
    return `PRESET:${sourceCategory}`;
  }, [sourceCategory, selectedBroker, selectedWatchlist]);

  const handleDropdownSelect = (val: string) => {
    if (val === 'ALL') {
      setSourceCategory('ALL');
      setSelectedBroker('ALL');
      setSelectedWatchlist('ALL');
    } else if (val === 'BROKER:ALL') {
      setSourceCategory('BROKERS');
      setSelectedBroker('ALL');
    } else if (val.startsWith('BROKER:')) {
      setSourceCategory('BROKERS');
      setSelectedBroker(val.replace('BROKER:', ''));
    } else if (val === 'WATCHLIST:ALL') {
      setSourceCategory('WATCHLISTS');
      setSelectedWatchlist('ALL');
    } else if (val.startsWith('WATCHLIST:')) {
      setSourceCategory('WATCHLISTS');
      setSelectedWatchlist(val.replace('WATCHLIST:', ''));
    } else if (val.startsWith('PRESET:')) {
      setSourceCategory(val.replace('PRESET:', '') as SourceCategory);
    }
  };

  // Active filter label for feedback banner
  const hasActiveSpecificFilter =
    sourceCategory !== 'ALL' ||
    selectedBroker !== 'ALL' ||
    selectedWatchlist !== 'ALL' ||
    selectedSector !== 'ALL' ||
    Boolean(searchQuery.trim());

  const activeFilterDescription = useMemo(() => {
    if (sourceCategory === 'BROKERS') {
      if (selectedBroker === 'ALL') return `All Brokers (${totalHoldingsCount} stocks)`;
      const bCount = availableBrokers.find((b) => b.name === selectedBroker)?.count || 0;
      return `Broker: ${selectedBroker} (${bCount} stocks)`;
    }
    if (sourceCategory === 'WATCHLISTS') {
      if (selectedWatchlist === 'ALL') return `All Watchlists (${totalWatchlistCount} stocks)`;
      const wCount = availableWatchlists.find((w) => w.name === selectedWatchlist)?.count || 0;
      return `Watchlist: ${selectedWatchlist} (${wCount} stocks)`;
    }
    if (sourceCategory === 'HIGH_CONVICTION') return 'High Conviction Picks (7.5+ Score)';
    if (sourceCategory === 'DEEP_VALUE') return 'Deep Value Multiple (7.5+ Valuation)';
    if (sourceCategory === 'QUALITY_KINGS') return 'Quality Kings (8.0+ Fundamentals)';
    return null;
  }, [sourceCategory, selectedBroker, selectedWatchlist, totalHoldingsCount, totalWatchlistCount, availableBrokers, availableWatchlists]);

  // Reset all filters to default
  const handleResetFilters = () => {
    setSourceCategory('ALL');
    setSelectedBroker('ALL');
    setSelectedWatchlist('ALL');
    setSelectedSector('ALL');
    setSearchQuery('');
  };

  // Handle column header click
  const handleColumnSort = (field: SortOption) => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection(field === 'RANK' || field === 'SYMBOL' ? 'asc' : 'desc');
    }
  };

  // Filter and Sort Scorecards
  const filteredScorecards = useMemo(() => {
    return rawScorecards
      .filter((item) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchSym = item.symbol.toLowerCase().includes(q);
          const matchName = item.name.toLowerCase().includes(q);
          if (!matchSym && !matchName) return false;
        }

        // Source Category & Sub-Filter
        if (sourceCategory === 'BROKERS') {
          if (!item.isHolding) return false;
          if (selectedBroker !== 'ALL') {
            const itemBrokers = item.brokers && item.brokers.length > 0
              ? item.brokers
              : item.holdingDetails?.broker
              ? [item.holdingDetails.broker]
              : [];
            if (!itemBrokers.includes(selectedBroker)) return false;
          }
        } else if (sourceCategory === 'WATCHLISTS') {
          if (!item.isWatchlist) return false;
          if (selectedWatchlist !== 'ALL') {
            const itemWls = item.watchlistNames || [];
            if (!itemWls.includes(selectedWatchlist)) return false;
          }
        } else if (sourceCategory === 'HIGH_CONVICTION' && item.overallScore < 7.5) {
          return false;
        } else if (sourceCategory === 'DEEP_VALUE' && item.valuationScore < 7.5) {
          return false;
        } else if (sourceCategory === 'QUALITY_KINGS' && item.fundamentalsScore < 8.0) {
          return false;
        }

        // Sector Filter
        if (selectedSector !== 'ALL' && item.sector !== selectedSector) return false;

        return true;
      })
      .sort((a, b) => {
        let delta = 0;
        switch (sortBy) {
          case 'RANK':
            delta = (a.rank ?? 999) - (b.rank ?? 999);
            break;
          case 'SYMBOL':
            delta = a.symbol.localeCompare(b.symbol);
            break;
          case 'PRICE':
            delta = a.price - b.price;
            break;
          case 'CHANGE':
            delta = a.changePercent - b.changePercent;
            break;
          case 'OVERALL':
            delta = a.overallScore - b.overallScore;
            break;
          case 'BUYING':
            delta = a.buyingConvictionScore - b.buyingConvictionScore;
            break;
          case 'FUNDAMENTALS':
            delta = a.fundamentalsScore - b.fundamentalsScore;
            break;
          case 'VALUATION':
            delta = a.valuationScore - b.valuationScore;
            break;
          case 'FORWARD_PE':
            delta = (a.metrics.forwardPE ?? (sortDirection === 'asc' ? 9999 : -9999)) - 
                    (b.metrics.forwardPE ?? (sortDirection === 'asc' ? 9999 : -9999));
            break;
          case 'UPSIDE':
            delta = a.metrics.upsideToFairValuePct - b.metrics.upsideToFairValuePct;
            break;
          case 'ANALYZED':
            delta = new Date(a.analyzedAt || 0).getTime() - new Date(b.analyzedAt || 0).getTime();
            break;
          case 'MARKET_CAP':
            delta = a.marketCap - b.marketCap;
            break;
          default:
            delta = (a.rank ?? 999) - (b.rank ?? 999);
        }
        return sortDirection === 'asc' ? delta : -delta;
      });
  }, [rawScorecards, sourceFilter, selectedSector, sortBy, sortDirection, searchQuery]);

  // Find Upgrade Opportunities
  const upgradeOpportunities = useMemo(() => {
    const opportunities: { watchlistStock: StockScorecard; holdingStock: StockScorecard; scoreDelta: number }[] = [];
    const holdingsBySector = new Map<string, StockScorecard[]>();

    rawScorecards.filter((s) => s.isHolding).forEach((h) => {
      const list = holdingsBySector.get(h.sector) || [];
      list.push(h);
      holdingsBySector.set(h.sector, list);
    });

    rawScorecards.filter((s) => s.isWatchlist && !s.isHolding && s.overallScore >= 7.5).forEach((w) => {
      const heldPeers = holdingsBySector.get(w.sector) || [];
      heldPeers.forEach((h) => {
        const delta = Number((w.overallScore - h.overallScore).toFixed(1));
        if (delta >= 1.5) {
          opportunities.push({ watchlistStock: w, holdingStock: h, scoreDelta: delta });
        }
      });
    });

    return opportunities.sort((a, b) => b.scoreDelta - a.scoreDelta).slice(0, 3);
  }, [rawScorecards]);

  const handleOpenDetail = (sc: StockScorecard) => {
    setSelectedScorecard(sc);
    setIsDetailModalOpen(true);
  };

  const handleOpenCompare = (symbolsToCompare: string[]) => {
    setCompareSymbols(symbolsToCompare);
    setIsCompareModalOpen(true);
  };

  const handleRefreshSingle = async (sym: string) => {
    setRefreshingSymbol(sym);
    try {
      const updated = await refreshSingle.mutateAsync(sym);
      if (selectedScorecard && selectedScorecard.symbol === sym) {
        setSelectedScorecard(updated);
      }
    } catch (e) {
      console.error(`Refresh single failed for ${sym}:`, e);
    } finally {
      setRefreshingSymbol(null);
    }
  };

  const handleAnalyzeEarnings = async (sym: string) => {
    setAnalyzingEarningsSymbol(sym);
    setIsEarningsModalOpen(true);
    setEarningsResult(null);
    try {
      const res = await analyzeEarnings.mutateAsync(sym);
      setEarningsResult(res);
    } catch (e) {
      console.error(`Earnings analysis failed for ${sym}:`, e);
    } finally {
      setAnalyzingEarningsSymbol(null);
    }
  };

  const getScoreBadgeStyle = (score: number) => {
    if (score >= 9.0) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (score >= 7.5) return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
    if (score >= 5.5) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (score >= 3.5) return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  };

  const getScoreRingClass = (score: number) => {
    if (score >= 9.0) return 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
    if (score >= 7.5) return 'text-teal-400 border-teal-500/50 bg-teal-500/10';
    if (score >= 5.5) return 'text-amber-400 border-amber-500/50 bg-amber-500/10';
    if (score >= 3.5) return 'text-orange-400 border-orange-500/50 bg-orange-500/10';
    return 'text-rose-400 border-rose-500/50 bg-rose-500/10';
  };

  const isWorkerRunning = workerStatus?.status === 'RUNNING';
  const isWorkerPausedQuota = workerStatus?.status === 'PAUSED_QUOTA_EXHAUSTED';
  const isWorkerPaused = workerStatus?.status === 'PAUSED';

  const renderSortHeader = (label: string, field: SortOption, align: 'left' | 'center' | 'right' = 'center') => {
    const isActive = sortBy === field;
    return (
      <th
        key={field}
        onClick={() => handleColumnSort(field)}
        className={cn(
          "p-3.5 font-bold cursor-pointer select-none transition-colors group/col",
          align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center',
          isActive ? 'text-primary bg-primary/10' : 'hover:bg-accent/40 hover:text-foreground'
        )}
        title={`Sort by ${label} (${isActive && sortDirection === 'asc' ? 'Click for Descending' : 'Click for Ascending'})`}
      >
        <div className={cn(
          "flex items-center gap-1.5 inline-flex",
          align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center'
        )}>
          <span>{label}</span>
          {isActive ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover/col:opacity-100 transition-opacity shrink-0" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500 pb-24">
      {/* ================= PAGE HEADER ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 via-indigo-500/20 to-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-3xl font-bold tracking-tight text-foreground glow-text-white">
                Institutional Stock Scorecards
              </h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono font-bold">
                {rawScorecards.length} Scored Assets
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Multi-factor 1-10 conviction ranking, fundamental situation analysis & valuation benchmarking across portfolio holdings and watchlists.
            </p>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Compare Matrix Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenCompare(rawScorecards.slice(0, 3).map((s) => s.symbol))}
            disabled={rawScorecards.length === 0}
            className="h-9 text-xs font-bold gap-1.5 border-border/70 bg-card/60"
          >
            <Scale className="w-4 h-4 text-primary" />
            <span>Compare Matrix</span>
          </Button>

          {/* GENERATE ALL STOCKS ANALYSIS BUTTON (USER TRIGGERED) */}
          <Button
            variant={isWorkerRunning ? "secondary" : "default"}
            size="sm"
            onClick={() => {
              if (isWorkerRunning) {
                pauseWorker.mutate();
              } else if (isWorkerPausedQuota || isWorkerPaused) {
                resumeWorker.mutate();
              } else {
                startWorker.mutate({ forceRefresh: false });
              }
            }}
            disabled={startWorker.isPending || pauseWorker.isPending || resumeWorker.isPending}
            className={cn(
              "h-9 text-xs font-bold gap-1.5 shadow-sm transition-all",
              isWorkerRunning
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {isWorkerRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                <span>Pause Analysis ({workerStatus?.currentSymbol || 'Running...'})</span>
              </>
            ) : isWorkerPausedQuota || isWorkerPaused ? (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Resume Analysis ({workerStatus?.total ? `${workerStatus.total - workerStatus.current} remaining` : 'Resume'})</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Generate All Stocks Analysis</span>
              </>
            )}
          </Button>

          {/* Optional Force Re-run */}
          {!isWorkerRunning && rawScorecards.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => startWorker.mutate({ forceRefresh: true })}
              disabled={startWorker.isPending}
              className="h-9 text-xs font-bold gap-1 border-border/70 bg-card/60 text-muted-foreground hover:text-foreground"
              title="Force re-evaluate all stocks from scratch"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Force Re-run</span>
            </Button>
          )}
        </div>
      </div>

      {/* ================= WORKER PROGRESS / QUOTA ALERT BANNER ================= */}
      {isWorkerRunning && workerStatus && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/15 via-background to-accent/20 border border-primary/40 space-y-2.5 animate-pulse">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary animate-spin" />
              <span className="font-bold text-foreground">
                Sequential Agent Evaluation in Progress:
              </span>
              <span className="font-mono font-black text-primary">
                Analyzing {workerStatus.currentSymbol || 'Stock'}...
              </span>
            </div>
            <span className="font-mono font-bold text-muted-foreground">
              {workerStatus.current} of {workerStatus.total} ({workerStatus.percent}%)
            </span>
          </div>
          <Progress value={workerStatus.percent} className="h-2 bg-accent/40" />
          <p className="text-[11px] text-muted-foreground">
            Evaluating stocks one-by-one by AI agents. Safe rate-limit dampening active. Completed cards are saved instantly to the database.
          </p>
        </div>
      )}

      {isWorkerPausedQuota && workerStatus && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/30 via-background to-accent/20 border border-amber-500/40 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Analysis Paused: OpenRouter / LLM Daily Allowance Limit Reached</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resumeWorker.mutate()}
              className="h-7 text-xs font-bold border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            >
              <Play className="w-3 h-3 mr-1" /> Resume Analysis
            </Button>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed font-sans">
            {workerStatus.quotaMessage || 'Daily allowance limit reached. All completed stocks remain safely saved with their scores. You can resume tomorrow or whenever quota resets.'}
          </p>
        </div>
      )}

      {/* ================= EXECUTIVE SUMMARY CARDS (1 TO 10 SCALE) ================= */}
      {summary && rawScorecards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Top Conviction Pick */}
          <Card className="bg-card/70 backdrop-blur-xl border border-emerald-500/30 shadow-lg rounded-2xl overflow-hidden relative group">
            <div className="h-1 w-full bg-emerald-500" />
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-muted-foreground uppercase text-[10px] flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-emerald-400" /> Top Conviction Pick
                </span>
                {summary.topConvictionPick && (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] font-mono font-bold">
                    {summary.topConvictionPick.overallScore.toFixed(1)} / 10
                  </Badge>
                )}
              </div>
              {summary.topConvictionPick ? (
                <div
                  onClick={() => handleOpenDetail(summary.topConvictionPick!)}
                  className="cursor-pointer group/pick"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black font-mono text-foreground group-hover/pick:text-primary transition-colors">
                      {summary.topConvictionPick.symbol}
                    </span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      +{summary.topConvictionPick.metrics.upsideToFairValuePct}% Upside
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{summary.topConvictionPick.name}</p>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Scanning universe...</span>
              )}
            </CardContent>
          </Card>

          {/* 2. Top Value Leader */}
          <Card className="bg-card/70 backdrop-blur-xl border border-indigo-500/30 shadow-lg rounded-2xl overflow-hidden relative group">
            <div className="h-1 w-full bg-indigo-500" />
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-muted-foreground uppercase text-[10px] flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-400" /> Top Value Leader
                </span>
                {summary.topValuePick && (
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[9px] font-mono font-bold">
                    Val: {summary.topValuePick.valuationScore.toFixed(1)} / 10
                  </Badge>
                )}
              </div>
              {summary.topValuePick ? (
                <div
                  onClick={() => handleOpenDetail(summary.topValuePick!)}
                  className="cursor-pointer group/pick"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black font-mono text-foreground group-hover/pick:text-primary transition-colors">
                      {summary.topValuePick.symbol}
                    </span>
                    <span className="text-xs font-bold text-indigo-400 font-mono">
                      Target ${summary.topValuePick.metrics.fairValueEstimate.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{summary.topValuePick.name}</p>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Scanning universe...</span>
              )}
            </CardContent>
          </Card>

          {/* 3. Top Quality / Fundamentals King */}
          <Card className="bg-card/70 backdrop-blur-xl border border-teal-500/30 shadow-lg rounded-2xl overflow-hidden relative group">
            <div className="h-1 w-full bg-teal-500" />
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-muted-foreground uppercase text-[10px] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" /> Quality King
                </span>
                {summary.topQualityPick && (
                  <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/40 text-[9px] font-mono font-bold">
                    Fund: {summary.topQualityPick.fundamentalsScore.toFixed(1)} / 10
                  </Badge>
                )}
              </div>
              {summary.topQualityPick ? (
                <div
                  onClick={() => handleOpenDetail(summary.topQualityPick!)}
                  className="cursor-pointer group/pick"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black font-mono text-foreground group-hover/pick:text-primary transition-colors">
                      {summary.topQualityPick.symbol}
                    </span>
                    <span className="text-xs font-bold text-teal-400 font-mono">
                      {summary.topQualityPick.metrics.operatingMarginPct ?? '35'}% Op. Margin
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{summary.topQualityPick.name}</p>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Scanning universe...</span>
              )}
            </CardContent>
          </Card>

          {/* 4. Watchlist vs Holdings Overview */}
          <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden relative group">
            <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-primary" />
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-muted-foreground uppercase text-[10px] flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-primary" /> Watchlist vs Holdings
                </span>
                <span className="text-xs font-mono font-bold text-foreground">
                  Avg {summary.avgOverallScore.toFixed(1)} / 10
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs pt-1">
                <div>
                  <span className="text-[10px] text-muted-foreground block font-sans">Holdings ({summary.holdingsCount})</span>
                  <span className="text-sm font-bold text-foreground">{summary.avgHoldingsScore.toFixed(1)} / 10</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block font-sans">Watchlist ({summary.watchlistCount})</span>
                  <span className="text-sm font-bold text-primary">{summary.avgWatchlistScore.toFixed(1)} / 10</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================= WATCHLIST UPGRADE RADAR ================= */}
      {upgradeOpportunities.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/20 via-background to-primary/10 border border-purple-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Watchlist Upgrade Opportunity Radar
              </span>
            </div>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-[9px] font-mono">
              Higher Conviction Alternatives
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {upgradeOpportunities.map((opp, idx) => (
              <div
                key={idx}
                onClick={() => handleOpenCompare([opp.watchlistStock.symbol, opp.holdingStock.symbol])}
                className="p-3 rounded-xl bg-card/60 hover:bg-card/90 border border-border/60 hover:border-purple-500/40 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="text-center font-mono">
                    <span className="text-xs font-black text-purple-400 block">{opp.watchlistStock.symbol}</span>
                    <span className="text-[9px] text-muted-foreground">{opp.watchlistStock.overallScore.toFixed(1)}/10</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div className="text-center font-mono">
                    <span className="text-xs font-bold text-muted-foreground block">{opp.holdingStock.symbol}</span>
                    <span className="text-[9px] text-muted-foreground">{opp.holdingStock.overallScore.toFixed(1)}/10</span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] font-bold">
                    +{opp.scoreDelta} Pts
                  </Badge>
                  <span className="text-[10px] text-muted-foreground block truncate max-w-[80px]">
                    {opp.watchlistStock.sector}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= CONTROLS & FILTER TOOLBAR ================= */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          {/* Source Category Tabs */}
          <div className="flex items-center bg-card/80 p-1 rounded-xl border border-border/60 flex-wrap gap-1">
            <button
              type="button"
              onClick={() => {
                setSourceCategory('ALL');
                setSelectedBroker('ALL');
                setSelectedWatchlist('ALL');
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                sourceCategory === 'ALL'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>All Assets</span>
              <span className="font-mono text-[10px] opacity-75">({rawScorecards.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceCategory('BROKERS');
                setSelectedBroker('ALL');
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                sourceCategory === 'BROKERS'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Brokers & Portfolios</span>
              <span className="font-mono text-[10px] opacity-80">({totalHoldingsCount})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceCategory('WATCHLISTS');
                setSelectedWatchlist('ALL');
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                sourceCategory === 'WATCHLISTS'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Watchlists</span>
              <span className="font-mono text-[10px] opacity-80">({totalWatchlistCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceCategory('HIGH_CONVICTION')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                sourceCategory === 'HIGH_CONVICTION'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              High Conviction (7.5+)
            </button>
            <button
              type="button"
              onClick={() => setSourceCategory('DEEP_VALUE')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                sourceCategory === 'DEEP_VALUE'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Deep Value (7.5+)
            </button>
            <button
              type="button"
              onClick={() => setSourceCategory('QUALITY_KINGS')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                sourceCategory === 'QUALITY_KINGS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Quality Kings (8.0+)
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-card/80 p-1 rounded-xl border border-border/60 self-end lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={cn(
                'p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 px-2.5',
                viewMode === 'GRID' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              title="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={cn(
                'p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 px-2.5',
                viewMode === 'TABLE' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              title="Dense Data Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>

        {/* Dynamic Sub-Bar for Individual Brokers */}
        {sourceCategory === 'BROKERS' && (
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-accent/20 border border-border/60 flex-wrap text-xs animate-in fade-in duration-200">
            <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1 mr-1">
              <Briefcase className="w-3.5 h-3.5 text-emerald-400" /> Choose Broker:
            </span>
            <button
              type="button"
              onClick={() => setSelectedBroker('ALL')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all',
                selectedBroker === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-sm font-black'
                  : 'bg-card/70 text-muted-foreground hover:text-foreground border border-border/40'
              )}
            >
              All Brokers ({totalHoldingsCount})
            </button>
            {availableBrokers.map((b) => {
              const style = getBrokerBadgeStyle(b.name);
              const isSelected = selectedBroker === b.name;
              return (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => setSelectedBroker(b.name)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border',
                    isSelected
                      ? 'bg-foreground text-background font-black shadow-sm border-transparent'
                      : 'bg-card/70 text-muted-foreground hover:text-foreground border-border/40'
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full inline-block', style.dotColor)} />
                  <span>{style.label}</span>
                  <span className="font-mono text-[10px] opacity-75">({b.count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Dynamic Sub-Bar for Individual Watchlists */}
        {sourceCategory === 'WATCHLISTS' && (
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-purple-950/20 border border-purple-500/30 flex-wrap text-xs animate-in fade-in duration-200">
            <span className="text-[11px] font-bold text-purple-300 uppercase flex items-center gap-1 mr-1">
              <Eye className="w-3.5 h-3.5 text-purple-400" /> Choose Watchlist:
            </span>
            <button
              type="button"
              onClick={() => setSelectedWatchlist('ALL')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all',
                selectedWatchlist === 'ALL'
                  ? 'bg-purple-600 text-white shadow-sm font-black'
                  : 'bg-card/70 text-muted-foreground hover:text-foreground border border-border/40'
              )}
            >
              All Watchlists ({totalWatchlistCount})
            </button>
            {availableWatchlists.map((w) => {
              const isSelected = selectedWatchlist === w.name;
              return (
                <button
                  key={w.name}
                  type="button"
                  onClick={() => setSelectedWatchlist(w.name)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border',
                    isSelected
                      ? 'bg-purple-600 text-white font-black shadow-sm border-transparent'
                      : 'bg-card/70 text-muted-foreground hover:text-foreground border-border/40'
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
                  <span>{w.name}</span>
                  <span className="font-mono text-[10px] opacity-75">({w.count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Second Row: Search, Source Dropdown, Sector Selector & Sort */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search ticker or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-card/80 border-border/60 rounded-xl"
            />
          </div>

          {/* Filters & Sorters */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {/* Quick Source Filter Dropdown (Brokers & Watchlists) */}
            <select
              value={activeDropdownValue}
              onChange={(e) => handleDropdownSelect(e.target.value)}
              className="h-9 text-xs bg-card/80 border border-border/60 rounded-xl px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium shrink-0"
              title="Filter by Broker or Watchlist"
            >
              <option value="ALL">All Assets ({rawScorecards.length})</option>
              {availableBrokers.length > 0 && (
                <optgroup label="💼 Brokers & Portfolios">
                  <option value="BROKER:ALL">All Brokers ({totalHoldingsCount})</option>
                  {availableBrokers.map((b) => (
                    <option key={b.name} value={`BROKER:${b.name}`}>
                      {b.name} ({b.count})
                    </option>
                  ))}
                </optgroup>
              )}
              {availableWatchlists.length > 0 && (
                <optgroup label="👁️ Thematic Watchlists">
                  <option value="WATCHLIST:ALL">All Watchlists ({totalWatchlistCount})</option>
                  {availableWatchlists.map((w) => (
                    <option key={w.name} value={`WATCHLIST:${w.name}`}>
                      {w.name} ({w.count})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="⚡ Conviction Presets">
                <option value="PRESET:HIGH_CONVICTION">High Conviction (7.5+)</option>
                <option value="PRESET:DEEP_VALUE">Deep Value (7.5+)</option>
                <option value="PRESET:QUALITY_KINGS">Quality Kings (8.0+)</option>
              </optgroup>
            </select>

            {/* Sector Selector */}
            {sectors.length > 0 && (
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="h-9 text-xs bg-card/80 border border-border/60 rounded-xl px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary shrink-0"
              >
                <option value="ALL">All Sectors ({sectors.length})</option>
                {sectors.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5">
              <select
                value={sortBy}
                onChange={(e) => {
                  const field = e.target.value as SortOption;
                  setSortBy(field);
                  setSortDirection(field === 'RANK' || field === 'SYMBOL' ? 'asc' : 'desc');
                }}
                className="h-9 text-xs bg-card/80 border border-border/60 rounded-xl px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="RANK">Rank (#1 to #N)</option>
                <option value="SYMBOL">Ticker (A-Z)</option>
                <option value="OVERALL">Overall Score (1-10)</option>
                <option value="BUYING">Buying Conviction</option>
                <option value="FUNDAMENTALS">Quality / Fundamentals</option>
                <option value="VALUATION">Valuation Posture</option>
                <option value="FORWARD_PE">Forward P/E Multiple</option>
                <option value="UPSIDE">Fair Value Upside %</option>
                <option value="PRICE">Share Price</option>
                <option value="CHANGE">Daily % Change</option>
                <option value="MARKET_CAP">Market Cap</option>
                <option value="ANALYZED">Date of Analysis</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="h-9 px-2 text-xs border border-border/60 bg-card/80 text-foreground hover:bg-accent/40"
                title={sortDirection === 'asc' ? 'Ascending Order (click for Descending)' : 'Descending Order (click for Ascending)'}
              >
                {sortDirection === 'asc' ? (
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-mono">ASC</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <ArrowDown className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-mono">DESC</span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ACTIVE FILTER FEEDBACK BAR ================= */}
      {hasActiveSpecificFilter && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 px-4 rounded-xl bg-primary/5 border border-primary/20 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5 text-[11px]">
              <Filter className="w-3.5 h-3.5 text-primary" />
              Active Filter:
            </span>
            {/* Category / Broker / Watchlist / Preset pill */}
            {activeFilterDescription && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-primary/15 text-primary border border-primary/30 font-semibold text-[11px]">
                {sourceCategory === 'BROKERS' && <Briefcase className="w-3 h-3" />}
                {sourceCategory === 'WATCHLISTS' && <Bookmark className="w-3 h-3" />}
                <span>{activeFilterDescription}</span>
              </span>
            )}
            {/* Sector pill */}
            {selectedSector !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-secondary text-secondary-foreground border border-border/60 text-[11px]">
                <span>Sector: {selectedSector}</span>
              </span>
            )}
            {/* Search query pill */}
            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-secondary text-secondary-foreground border border-border/60 text-[11px] font-mono">
                <span>"{searchQuery.trim()}"</span>
              </span>
            )}
            <span className="text-muted-foreground text-[11px]">
              (Showing {filteredScorecards.length} of {rawScorecards.length} assets)
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="h-7 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground hover:bg-accent/40 px-2 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset to All</span>
          </Button>
        </div>
      )}

      {/* ================= EMPTY STATE ================= */}
      {rawScorecards.length === 0 && !isLoading ? (
        <div className="p-12 rounded-3xl border border-dashed border-border/80 bg-card/40 backdrop-blur-xl flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
            <Zap className="w-8 h-8" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="text-lg font-bold text-foreground">No Stock Scorecards Generated Yet</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Start institutional multi-factor analysis across your portfolio holdings and watchlists. Stocks will be analyzed one-by-one by AI agents and safely saved to your local database.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => startWorker.mutate({ forceRefresh: false })}
            disabled={startWorker.isPending}
            className="h-9 text-xs font-bold gap-2 px-5 bg-primary text-primary-foreground shadow-md"
          >
            <Zap className="w-4 h-4" />
            <span>Generate All Stocks Analysis</span>
          </Button>
        </div>
      ) : filteredScorecards.length === 0 ? (
        <div className="p-10 rounded-2xl border border-border/60 bg-card/40 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">No scorecards matched your current filters.</p>
          <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-2 text-xs font-bold gap-1.5">
            <X className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </Button>
        </div>
      ) : viewMode === 'GRID' ? (
        /* ================= GRID CARDS VIEW (1 TO 10 SCALE & RANKINGS) ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredScorecards.map((card) => {
            const isPos = card.changePercent >= 0;
            const isThisRefreshing = refreshingSymbol === card.symbol;
            const isThisAnalyzingEarnings = analyzingEarningsSymbol === card.symbol;
            const formattedDate = card.analyzedAt ? new Date(card.analyzedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }) : 'Recently';

            return (
              <Card
                key={card.symbol}
                className="bg-card/70 backdrop-blur-xl border border-border/70 hover:border-primary/40 transition-all rounded-2xl overflow-hidden shadow-md group flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar with Overall Score & Badges */}
                  <CardHeader className="p-4 pb-2 border-b border-border/40 bg-accent/10 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center font-mono font-bold text-xs text-primary group-hover:bg-primary/20 transition-colors">
                          {card.symbol.slice(0, 4)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-sm text-foreground group-hover:text-primary transition-colors">
                              {card.symbol}
                            </span>
                            {card.rank != null && (
                              <Badge className="bg-primary/20 text-primary border-primary/40 text-[9px] font-mono font-black px-1.5 py-0">
                                #{card.rank}
                              </Badge>
                            )}

                            {/* Interactive Broker Badges */}
                            {card.brokers && card.brokers.length > 0 ? (
                              card.brokers.map((broker) => {
                                const style = getBrokerBadgeStyle(broker);
                                return (
                                  <Badge
                                    key={broker}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSourceCategory('BROKERS');
                                      setSelectedBroker(broker);
                                    }}
                                    title={`Click to filter by ${broker}`}
                                    className={cn(
                                      "text-[8px] px-1.5 py-0 font-bold cursor-pointer transition-all border flex items-center gap-1",
                                      style.badgeClass
                                    )}
                                  >
                                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dotColor)} />
                                    <span>{style.label}</span>
                                  </Badge>
                                );
                              })
                            ) : card.isHolding ? (
                              <Badge
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSourceCategory('BROKERS');
                                  setSelectedBroker('ALL');
                                }}
                                className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[8px] px-1.5 py-0 uppercase font-bold cursor-pointer hover:bg-emerald-500/25"
                              >
                                Holding
                              </Badge>
                            ) : null}

                            {/* Interactive Watchlist Badges */}
                            {card.watchlistNames && card.watchlistNames.length > 0 ? (
                              card.watchlistNames.map((wl) => {
                                const style = getWatchlistBadgeStyle(wl);
                                return (
                                  <Badge
                                    key={wl}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSourceCategory('WATCHLISTS');
                                      setSelectedWatchlist(wl);
                                    }}
                                    title={`Click to filter by watchlist: ${wl}`}
                                    className={cn(
                                      "text-[8px] px-1.5 py-0 font-medium cursor-pointer transition-all border flex items-center gap-1 truncate max-w-[120px]",
                                      style.badgeClass
                                    )}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                                    <span className="truncate">{style.label}</span>
                                  </Badge>
                                );
                              })
                            ) : card.isWatchlist ? (
                              <Badge
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSourceCategory('WATCHLISTS');
                                  setSelectedWatchlist('ALL');
                                }}
                                className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-[8px] px-1.5 py-0 uppercase font-bold cursor-pointer hover:bg-purple-500/25"
                              >
                                Watchlist
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                            {card.name}
                          </p>
                        </div>
                      </div>

                      {/* Overall Conviction Score Meter (1 to 10 Scale) */}
                      <div className={cn("px-2.5 py-1 rounded-xl border flex flex-col items-center justify-center font-mono shrink-0", getScoreRingClass(card.overallScore))}>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-base font-black leading-tight">{card.overallScore.toFixed(1)}</span>
                          <span className="text-[9px] font-bold opacity-70">/10</span>
                        </div>
                        <span className="text-[8px] uppercase font-bold opacity-80">Score</span>
                      </div>
                    </div>

                    {/* Price & Analysis Timestamp */}
                    <div className="flex items-center justify-between text-xs font-mono pt-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">${card.price.toFixed(2)}</span>
                        <span className={cn("font-bold flex items-center gap-0.5 text-[11px]", isPos ? "text-emerald-400" : "text-rose-400")}>
                          {isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {isPos ? '+' : ''}{card.changePercent.toFixed(2)}%
                        </span>
                      </div>

                      {/* Date of Analysis */}
                      <span className="text-[10px] text-muted-foreground font-sans flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" /> {formattedDate}
                      </span>
                    </div>
                  </CardHeader>

                  {/* Card Body with Tri-Metric Progress (1 to 10 Scale) */}
                  <CardContent className="p-4 space-y-3">
                    {/* Tri-factor Progress Rows */}
                    <div className="space-y-1.5 text-[11px] font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-sans flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Buying Conviction
                        </span>
                        <span className="font-bold text-emerald-400">{card.buyingConvictionScore.toFixed(1)} / 10</span>
                      </div>
                      <Progress value={card.buyingConvictionScore * 10} className="h-1 bg-emerald-950/40" />

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-muted-foreground font-sans flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> Fundamentals Quality
                        </span>
                        <span className="font-bold text-teal-400">{card.fundamentalsScore.toFixed(1)} / 10</span>
                      </div>
                      <Progress value={card.fundamentalsScore * 10} className="h-1 bg-teal-950/40" />

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-muted-foreground font-sans flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Valuation Posture
                        </span>
                        <span className="font-bold text-indigo-400">{card.valuationScore.toFixed(1)} / 10</span>
                      </div>
                      <Progress value={card.valuationScore * 10} className="h-1 bg-indigo-950/40" />
                    </div>

                    {/* Score Justification / Fundamentals Preview */}
                    <div className="p-2.5 rounded-xl bg-accent/20 border border-border/40 text-[11px] text-foreground/80 leading-snug line-clamp-2">
                      <span className="font-bold text-primary mr-1">Verdict:</span>
                      {card.scoreJustification || card.fundamentalSituation || card.tacticalAction}
                    </div>

                    {/* Key Metric Chips */}
                    <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px] pt-0.5">
                      <div className="p-1.5 rounded-lg bg-accent/20 border border-border/40 text-center">
                        <span className="text-muted-foreground block text-[8px] font-sans uppercase">P/E Multiple</span>
                        <span className="font-bold text-foreground">{card.metrics.forwardPE ? `${card.metrics.forwardPE}x` : 'N/A'}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-accent/20 border border-border/40 text-center">
                        <span className="text-muted-foreground block text-[8px] font-sans uppercase">Op. Margin</span>
                        <span className="font-bold text-foreground">{card.metrics.operatingMarginPct != null ? `${card.metrics.operatingMarginPct}%` : 'N/A'}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-accent/20 border border-border/40 text-center">
                        <span className="text-muted-foreground block text-[8px] font-sans uppercase">Fair Upside</span>
                        <span className="font-bold text-emerald-400">+{card.metrics.upsideToFairValuePct}%</span>
                      </div>
                    </div>
                  </CardContent>
                </div>

                {/* Card Action Footer */}
                <div className="p-3 px-4 bg-accent/10 border-t border-border/40 flex items-center justify-between gap-2">
                  <Badge variant="outline" className={cn("text-[9px] font-mono font-bold truncate max-w-[120px]", getScoreBadgeStyle(card.overallScore))}>
                    {card.gradeLabel}
                  </Badge>

                  <div className="flex items-center gap-1.5">
                    {/* Individual Refresh Stock Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRefreshSingle(card.symbol)}
                      disabled={isThisRefreshing}
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                      title="Refresh this stock"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", isThisRefreshing && "animate-spin text-primary")} />
                    </Button>

                    {/* Analyze Latest Earnings Agent Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAnalyzeEarnings(card.symbol)}
                      disabled={isThisAnalyzingEarnings}
                      className="h-7 text-xs px-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                      title="Analyze Latest Earnings with AI Agent"
                    >
                      <Zap className={cn("w-3.5 h-3.5", isThisAnalyzingEarnings && "animate-spin")} />
                    </Button>

                    {/* Compare Stock Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenCompare([card.symbol])}
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                      title="Compare stock"
                    >
                      <Scale className="w-3.5 h-3.5" />
                    </Button>

                    {/* Open Scorecard Modal Button */}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleOpenDetail(card)}
                      className="h-7 text-xs font-bold gap-1 bg-primary text-primary-foreground px-2.5 shadow-sm"
                    >
                      <span>Scorecard</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ================= DENSE DATA TABLE VIEW (1 TO 10 SCALE & RANKINGS) ================= */
        <div className="rounded-2xl border border-border/60 overflow-hidden bg-card/60 backdrop-blur-xl shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-accent/30 border-b border-border/60 font-sans text-muted-foreground text-[10px] uppercase">
                  {renderSortHeader('Rank & Asset', 'RANK', 'left')}
                  {renderSortHeader('Price & Return', 'PRICE', 'center')}
                  {renderSortHeader('Overall (1-10)', 'OVERALL', 'center')}
                  {renderSortHeader('Buying Conviction', 'BUYING', 'center')}
                  {renderSortHeader('Quality / Fund.', 'FUNDAMENTALS', 'center')}
                  {renderSortHeader('Valuation', 'VALUATION', 'center')}
                  {renderSortHeader('Forward P/E', 'FORWARD_PE', 'center')}
                  {renderSortHeader('Fair Upside', 'UPSIDE', 'center')}
                  {renderSortHeader('Analyzed', 'ANALYZED', 'center')}
                  <th className="p-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {filteredScorecards.map((c) => {
                  const isPos = c.changePercent >= 0;
                  const isThisRefreshing = refreshingSymbol === c.symbol;
                  const isThisAnalyzingEarnings = analyzingEarningsSymbol === c.symbol;
                  const formattedDate = c.analyzedAt ? new Date(c.analyzedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  }) : '—';

                  return (
                    <tr key={c.symbol} className="hover:bg-accent/20 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {c.rank != null && (
                            <Badge className="bg-primary/20 text-primary border-primary/40 text-[9px] font-black px-1 py-0">
                              #{c.rank}
                            </Badge>
                          )}
                          <span className="font-bold text-foreground block">{c.symbol}</span>

                          {/* Interactive Broker Badges */}
                          {c.brokers && c.brokers.length > 0 ? (
                            c.brokers.map((broker) => {
                              const style = getBrokerBadgeStyle(broker);
                              return (
                                <Badge
                                  key={broker}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSourceCategory('BROKERS');
                                    setSelectedBroker(broker);
                                  }}
                                  title={`Click to filter by ${broker}`}
                                  className={cn(
                                    "text-[8px] px-1.5 py-0 font-bold cursor-pointer transition-all border flex items-center gap-1",
                                    style.badgeClass
                                  )}
                                >
                                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dotColor)} />
                                  <span>{style.label}</span>
                                </Badge>
                              );
                            })
                          ) : c.isHolding ? (
                            <Badge
                              onClick={(e) => {
                                e.stopPropagation();
                                setSourceCategory('BROKERS');
                                setSelectedBroker('ALL');
                              }}
                              className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[8px] px-1 py-0 uppercase font-bold cursor-pointer hover:bg-emerald-500/25"
                            >
                              Held
                            </Badge>
                          ) : null}

                          {/* Interactive Watchlist Badges */}
                          {c.watchlistNames && c.watchlistNames.length > 0 ? (
                            c.watchlistNames.map((wl) => {
                              const style = getWatchlistBadgeStyle(wl);
                              return (
                                <Badge
                                  key={wl}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSourceCategory('WATCHLISTS');
                                    setSelectedWatchlist(wl);
                                  }}
                                  title={`Click to filter by watchlist: ${wl}`}
                                  className={cn(
                                    "text-[8px] px-1.5 py-0 font-medium cursor-pointer transition-all border flex items-center gap-1 truncate max-w-[100px]",
                                    style.badgeClass
                                  )}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                                  <span className="truncate">{style.label}</span>
                                </Badge>
                              );
                            })
                          ) : c.isWatchlist ? (
                            <Badge
                              onClick={(e) => {
                                e.stopPropagation();
                                setSourceCategory('WATCHLISTS');
                                setSelectedWatchlist('ALL');
                              }}
                              className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-[8px] px-1 py-0 uppercase font-bold cursor-pointer hover:bg-purple-500/25"
                            >
                              Watch
                            </Badge>
                          ) : null}
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate block max-w-[130px] font-sans">
                          {c.name}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <span className="font-bold text-foreground block">${c.price.toFixed(2)}</span>
                        <span className={cn("text-[10px] font-bold", isPos ? "text-emerald-400" : "text-rose-400")}>
                          {isPos ? '+' : ''}{c.changePercent.toFixed(2)}%
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <span className={cn("text-xs font-black px-2 py-0.5 rounded-lg border", getScoreRingClass(c.overallScore))}>
                          {c.overallScore.toFixed(1)} / 10
                        </span>
                      </td>

                      <td className="p-3 text-center font-bold text-emerald-400">
                        {c.buyingConvictionScore.toFixed(1)}
                      </td>

                      <td className="p-3 text-center font-bold text-teal-400">
                        {c.fundamentalsScore.toFixed(1)}
                      </td>

                      <td className="p-3 text-center font-bold text-indigo-400">
                        {c.valuationScore.toFixed(1)}
                      </td>

                      <td className="p-3 text-center text-foreground">
                        {c.metrics.forwardPE ? `${c.metrics.forwardPE}x` : 'N/A'}
                      </td>

                      <td className="p-3 text-center font-bold text-emerald-400">
                        +{c.metrics.upsideToFairValuePct}%
                      </td>

                      <td className="p-3 text-center text-muted-foreground text-[10px] font-sans">
                        {formattedDate}
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1 font-sans">
                          {/* Refresh Stock Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRefreshSingle(c.symbol)}
                            disabled={isThisRefreshing}
                            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                            title="Refresh this stock"
                          >
                            <RefreshCw className={cn("w-3 h-3", isThisRefreshing && "animate-spin text-primary")} />
                          </Button>

                          {/* Earnings Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAnalyzeEarnings(c.symbol)}
                            disabled={isThisAnalyzingEarnings}
                            className="h-7 text-xs px-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                            title="Analyze Latest Earnings"
                          >
                            <Zap className={cn("w-3 h-3", isThisAnalyzingEarnings && "animate-spin")} />
                          </Button>

                          {/* Open Scorecard Modal Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetail(c)}
                            className="h-7 text-xs font-bold text-primary hover:bg-primary/10 px-2"
                          >
                            Scorecard
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}
      {selectedScorecard && (
        <StockScorecardModal
          scorecard={selectedScorecard}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onNavigateToResearch={onNavigateToResearch}
          onOpenCompare={(sym) => handleOpenCompare([sym])}
          onRefresh={(sym) => handleRefreshSingle(sym)}
          onAnalyzeEarnings={(sym) => handleAnalyzeEarnings(sym)}
          isRefreshing={refreshingSymbol === selectedScorecard.symbol}
        />
      )}

      <ScorecardCompareModal
        initialSymbols={compareSymbols}
        allAvailableSymbols={rawScorecards.map((s) => s.symbol)}
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        onNavigateToResearch={onNavigateToResearch}
      />

      <StockEarningsAnalysisModal
        result={earningsResult}
        isOpen={isEarningsModalOpen}
        onClose={() => setIsEarningsModalOpen(false)}
        isLoading={Boolean(analyzingEarningsSymbol)}
        onReanalyze={() => {
          if (earningsResult?.symbol) handleAnalyzeEarnings(earningsResult.symbol);
        }}
      />
    </div>
  );
}
