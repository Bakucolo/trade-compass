import { useState, useMemo } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Zap,
  ArrowRight,
  DollarSign,
  Layers,
  Sparkles,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  ExternalLink,
  Copy,
  Sliders,
  Flame,
  Clock,
  ArrowUpRight,
  Eye,
  EyeOff,
  RotateCcw,
  Activity,
  AlertCircle
} from 'lucide-react';
import {
  useCoveredCallsAnalysis,
  useDetailedOptionChain,
  CoveredCallPositionCandidate,
  ProposedCallStrike,
  CoverageStatus,
} from '@/services/coveredCallService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CoveredCallsAnalyserProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToPortfolio?: () => void;
}

export function CoveredCallsAnalyser({
  onNavigateToResearch,
  onNavigateToPortfolio,
}: CoveredCallsAnalyserProps) {
  const { data: analysisData, isLoading, isFetching, refetch } = useCoveredCallsAnalysis();

  const COVERED_CALLS_HIDDEN_STORAGE_KEY = 'coveredCalls_hidden_symbols';

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNCOVERED' | 'PARTIAL' | 'COVERED' | 'ACTIVE_CALLS' | 'HIDDEN'>('UNCOVERED');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'CAPACITY' | 'ACTIVE_CALLS' | 'YIELD' | 'MARKET_VALUE' | 'DELTA' | 'IVR' | 'IV' | 'EARNINGS'>('CAPACITY');
  const [onlyOptimalIV, setOnlyOptimalIV] = useState(false);
  const [selectedChainSymbol, setSelectedChainSymbol] = useState<string | null>(null);
  const [expandedPositionId, setExpandedPositionId] = useState<string | null>(null);

  // Hidden Stocks Persistence (LocalStorage)
  const [hiddenSymbols, setHiddenSymbols] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(COVERED_CALLS_HIDDEN_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return new Set(arr);
        }
      }
    } catch (e) {
      console.error('Failed to parse hidden symbols from localStorage', e);
    }
    return new Set<string>();
  });

  const handleHideStock = (symbol: string) => {
    setHiddenSymbols((prev) => {
      const next = new Set(prev);
      next.add(symbol);
      try {
        localStorage.setItem(COVERED_CALLS_HIDDEN_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });

    toast.info(`${symbol} hidden from Covered Call Harvester`, {
      description: `Temporarily paused call-selling proposals on ${symbol}.`,
      action: {
        label: 'Undo',
        onClick: () => handleUnhideStock(symbol),
      },
      duration: 5000,
    });
  };

  const handleUnhideStock = (symbol: string) => {
    setHiddenSymbols((prev) => {
      const next = new Set(prev);
      next.delete(symbol);
      try {
        localStorage.setItem(COVERED_CALLS_HIDDEN_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });
    toast.success(`${symbol} restored to Covered Call Harvester`);
  };

  const handleUnhideAll = () => {
    setHiddenSymbols(new Set());
    try {
      localStorage.removeItem(COVERED_CALLS_HIDDEN_STORAGE_KEY);
    } catch (e) {}
    toast.success('All hidden stocks restored to Covered Call Harvester');
  };

  const { data: chainData, isLoading: isChainLoading } = useDetailedOptionChain(
    selectedChainSymbol || undefined
  );

  const allCandidates = Array.isArray(analysisData?.candidates)
    ? analysisData.candidates.filter(Boolean)
    : [];

  const activeCandidates = useMemo(() => {
    return allCandidates.filter((c) => !hiddenSymbols.has(c.symbol));
  }, [allCandidates, hiddenSymbols]);

  const hiddenCandidates = useMemo(() => {
    return allCandidates.filter((c) => hiddenSymbols.has(c.symbol));
  }, [allCandidates, hiddenSymbols]);

  // Dynamically compute KPI summary metrics from active (unhidden) positions
  const displayMetrics = useMemo(() => {
    if (allCandidates.length === 0) {
      return {
        totalEligiblePositionsCount: analysisData?.totalEligiblePositionsCount ?? 0,
        uncoveredPositionsCount: analysisData?.uncoveredPositionsCount ?? 0,
        partiallyCoveredCount: analysisData?.partiallyCoveredCount ?? 0,
        fullyCoveredCount: analysisData?.fullyCoveredCount ?? 0,
        activePositionsCount: analysisData?.activePositionsCount ?? 0,
        totalUncoveredCallCapacity: analysisData?.totalUncoveredCallCapacity ?? 0,
        potentialMonthlyIncomeEstimate: analysisData?.potentialMonthlyIncomeEstimate ?? 0,
        totalPortfolioNetDelta: analysisData?.totalPortfolioNetDelta ?? 0,
      };
    }

    const uncoveredPositions = activeCandidates.filter((c) => c.coverageStatus === 'UNCOVERED_OPPORTUNITY');
    const partiallyCoveredPositions = activeCandidates.filter((c) => c.coverageStatus === 'PARTIALLY_COVERED');
    const fullyCoveredPositions = activeCandidates.filter((c) => c.coverageStatus === 'FULLY_COVERED');
    const activePositions = activeCandidates.filter(
      (c) => c.hasActiveCalls || (c.shortCallsCount || 0) > 0 || (c.activeCoveredCalls && c.activeCoveredCalls.length > 0)
    );

    const totalUncoveredCallCapacity = activeCandidates.reduce((sum, c) => sum + (c.coveredCallCapacity || 0), 0);
    const potentialMonthlyIncomeEstimate = activeCandidates.reduce(
      (sum, c) => sum + (c.proposedCalls?.balanced?.totalPotentialIncome || 0),
      0
    );
    const totalPortfolioNetDelta = activeCandidates.reduce((sum, c) => sum + (c.netPositionDelta || 0), 0);

    return {
      totalEligiblePositionsCount: activeCandidates.length,
      uncoveredPositionsCount: uncoveredPositions.length,
      partiallyCoveredCount: partiallyCoveredPositions.length,
      fullyCoveredCount: fullyCoveredPositions.length,
      activePositionsCount: activePositions.length,
      totalUncoveredCallCapacity,
      potentialMonthlyIncomeEstimate,
      totalPortfolioNetDelta,
    };
  }, [allCandidates, activeCandidates, analysisData]);

  // Filter and sort candidates
  const filteredCandidates = useMemo(() => {
    const candidatePool = statusFilter === 'HIDDEN' ? hiddenCandidates : activeCandidates;

    return candidatePool
      .filter((c) => {
        // Status filter
        if (statusFilter === 'UNCOVERED' && c.coverageStatus !== 'UNCOVERED_OPPORTUNITY') return false;
        if (statusFilter === 'PARTIAL' && c.coverageStatus !== 'PARTIALLY_COVERED') return false;
        if (statusFilter === 'COVERED' && c.coverageStatus !== 'FULLY_COVERED') return false;
        if (statusFilter === 'ACTIVE_CALLS' && !c.hasActiveCalls && (c.shortCallsCount || 0) === 0 && (!c.activeCoveredCalls || c.activeCoveredCalls.length === 0)) return false;

        // Optional Optimal IV filter
        if (onlyOptimalIV && !c.isOptimalToSellCalls && (c.ivRank || 0) < 50) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          return (
            c.symbol.toLowerCase().includes(q) ||
            c.companyName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'CAPACITY') {
          return (b.coveredCallCapacity || 0) - (a.coveredCallCapacity || 0) || (b.totalMarketValue || 0) - (a.totalMarketValue || 0);
        }
        if (sortBy === 'IVR') {
          return (b.ivRank || 0) - (a.ivRank || 0) || (b.impliedVolatility || 0) - (a.impliedVolatility || 0);
        }
        if (sortBy === 'IV') {
          return (b.impliedVolatility || 0) - (a.impliedVolatility || 0) || (b.ivRank || 0) - (a.ivRank || 0);
        }
        if (sortBy === 'EARNINGS') {
          const daysA = a.daysUntilEarnings !== undefined && a.daysUntilEarnings >= 0 ? a.daysUntilEarnings : 999;
          const daysB = b.daysUntilEarnings !== undefined && b.daysUntilEarnings >= 0 ? b.daysUntilEarnings : 999;
          return daysA - daysB;
        }
        if (sortBy === 'ACTIVE_CALLS') {
          return (b.shortCallsCount || 0) - (a.shortCallsCount || 0) || (b.totalMarketValue || 0) - (a.totalMarketValue || 0);
        }
        if (sortBy === 'YIELD') {
          const yieldA = a.proposedCalls?.balanced?.annualizedYieldPercent || 0;
          const yieldB = b.proposedCalls?.balanced?.annualizedYieldPercent || 0;
          return yieldB - yieldA;
        }
        if (sortBy === 'MARKET_VALUE') {
          return (b.totalMarketValue || 0) - (a.totalMarketValue || 0);
        }
        if (sortBy === 'DELTA') {
          return (b.netPositionDelta || 0) - (a.netPositionDelta || 0);
        }
        return 0;
      });
  }, [statusFilter, hiddenCandidates, activeCandidates, searchQuery, sortBy, onlyOptimalIV]);

  const handleCopyPlan = (candidate: CoveredCallPositionCandidate, strike: ProposedCallStrike) => {
    const text = `Covered Call Plan for ${candidate.symbol}:\nSell ${candidate.coveredCallCapacity || 1}x ${candidate.symbol} $${strike.strike} Call exp ${strike.expiration} (${strike.dte} DTE)\nEstimated Mid: $${strike.estimatedMid.toFixed(2)} ($${strike.premiumPerContract} / contract)\nTotal Est. Premium: $${strike.totalPotentialIncome.toFixed(2)}\nAnnualized Yield: ${strike.annualizedYieldPercent}% APY\nOTM Buffer: +${strike.otmBufferPercent}% | POP: ${strike.probabilityOfProfitPercent}%`;
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${candidate.symbol} Covered Call Plan!`, {
      description: `Sell $${strike.strike} Call for ~$${strike.totalPotentialIncome.toFixed(2)} premium`,
    });
  };

  const handleRowClick = (symbol: string) => {
    if (onNavigateToResearch) {
      onNavigateToResearch(symbol);
    } else {
      window.dispatchEvent(new CustomEvent('select-research-ticker', { detail: symbol }));
    }
  };

  const getStatusBadge = (status: CoverageStatus, capacity: number, shortCallsCount = 0) => {
    switch (status) {
      case 'UNCOVERED_OPPORTUNITY':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-bold gap-1 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span>Uncovered Opportunity ({capacity}x Real Capacity)</span>
          </Badge>
        );
      case 'PARTIALLY_COVERED':
        return (
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-bold gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Partially Covered ({shortCallsCount}x Active, +{capacity}x Real Remaining)</span>
          </Badge>
        );
      case 'FULLY_COVERED':
        return (
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs font-bold gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Fully Covered ({shortCallsCount}x Active • 0x New Capacity)</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-xs">
            <span>Delta Deficit (&lt;100 Delta)</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ================= 1. EXECUTIVE KPI SUMMARY RIBBON ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Uncovered Capacity */}
        <div className="glass-card rounded-2xl p-5 border border-emerald-500/30 bg-emerald-950/15 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-emerald-400/90 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" /> Uncovered Call Capacity
            </span>
            <Badge className="bg-emerald-500/25 text-emerald-300 text-[10px] font-mono font-bold">
              High Income
            </Badge>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-emerald-300">
                {displayMetrics.totalUncoveredCallCapacity}
              </span>
              <span className="text-xs text-emerald-400/80 font-medium">Contracts Available</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Across {displayMetrics.uncoveredPositionsCount} unhedged stock/LEAPs positions with &ge;100 Delta
            </p>
          </div>
        </div>

        {/* Potential Monthly Cash Flow */}
        <div className="glass-card rounded-2xl p-5 border border-primary/30 bg-primary/10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-primary" /> Potential Monthly Income
            </span>
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-mono font-bold">
              {analysisData?.potentialAnnualizedYieldEstimate ?? 0}% APY Est.
            </Badge>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-foreground">
                +${displayMetrics.potentialMonthlyIncomeEstimate ? Math.round(displayMetrics.potentialMonthlyIncomeEstimate).toLocaleString() : '0'}
              </span>
              <span className="text-xs text-muted-foreground font-medium">/ 30-day cycle</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Estimated conservative/balanced theta premium harvest
            </p>
          </div>
        </div>

        {/* Total Eligible Positions */}
        <div className="glass-card rounded-2xl p-5 border border-border/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" /> Eligible Positions
            </span>
            <span className="text-xs text-muted-foreground font-mono font-bold">
              &ge;100 Delta
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-foreground">
                {displayMetrics.totalEligiblePositionsCount}
              </span>
              <span className="text-xs text-muted-foreground font-medium">Holdings</span>
              {hiddenSymbols.size > 0 && (
                <span className="text-[10px] text-rose-400 font-mono font-semibold ml-1">
                  ({hiddenSymbols.size} hidden)
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {displayMetrics.uncoveredPositionsCount} Uncovered • {displayMetrics.partiallyCoveredCount} Partial • {displayMetrics.fullyCoveredCount} Fully Covered
            </p>
          </div>
        </div>

        {/* Total Net Portfolio Delta */}
        <div className="glass-card rounded-2xl p-5 border border-border/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-400" /> Portfolio Net Delta
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
              title="Refresh covered call scan"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            </Button>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-foreground">
                +{displayMetrics.totalPortfolioNetDelta ? Math.round(displayMetrics.totalPortfolioNetDelta).toLocaleString() : '0'} &Delta;
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Total long equity & options directional exposure
            </p>
          </div>
        </div>
      </div>

      {/* ================= 2. FILTER & SORT CONTROLS ================= */}
      <div className="glass-card rounded-2xl p-4 border border-border/60 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant={statusFilter === 'UNCOVERED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('UNCOVERED')}
            className={cn(
              'h-8 text-xs font-semibold gap-1.5 transition-all',
              statusFilter === 'UNCOVERED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'border-border/70 text-emerald-400/90 hover:bg-accent'
            )}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Uncovered Opportunities ({displayMetrics.uncoveredPositionsCount})</span>
          </Button>

          <Button
            variant={statusFilter === 'PARTIAL' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('PARTIAL')}
            className={cn(
              'h-8 text-xs font-semibold gap-1.5',
              statusFilter === 'PARTIAL'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'border-border/70 text-amber-400/90 hover:bg-accent'
            )}
          >
            <span>Partially Covered ({displayMetrics.partiallyCoveredCount})</span>
          </Button>

          <Button
            variant={statusFilter === 'COVERED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('COVERED')}
            className={cn(
              'h-8 text-xs font-semibold gap-1.5',
              statusFilter === 'COVERED'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'border-border/70 text-blue-400/90 hover:bg-accent'
            )}
          >
            <span>Fully Covered ({displayMetrics.fullyCoveredCount})</span>
          </Button>

          <Button
            variant={statusFilter === 'ACTIVE_CALLS' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('ACTIVE_CALLS')}
            className={cn(
              'h-8 text-xs font-semibold gap-1.5',
              statusFilter === 'ACTIVE_CALLS'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'border-border/70 text-amber-300 hover:bg-accent'
            )}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Active Calls Open ({displayMetrics.activePositionsCount})</span>
          </Button>

          <Button
            variant={statusFilter === 'ALL' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('ALL')}
            className={cn(
              'h-8 text-xs font-semibold',
              statusFilter === 'ALL' ? 'bg-primary text-primary-foreground' : 'border-border/70 text-muted-foreground'
            )}
          >
            All Holdings ({activeCandidates.length})
          </Button>

          {hiddenSymbols.size > 0 && (
            <Button
              variant={statusFilter === 'HIDDEN' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('HIDDEN')}
              className={cn(
                'h-8 text-xs font-semibold gap-1.5 transition-all',
                statusFilter === 'HIDDEN'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'border-rose-500/40 text-rose-300 bg-rose-950/20 hover:bg-rose-950/40'
              )}
            >
              <EyeOff className="w-3.5 h-3.5 text-rose-400" />
              <span>Hidden ({hiddenCandidates.length})</span>
            </Button>
          )}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={onlyOptimalIV ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlyOptimalIV(!onlyOptimalIV)}
            className={cn(
              'h-8 text-xs font-semibold gap-1.5 transition-all',
              onlyOptimalIV
                ? 'bg-amber-600 text-white shadow-sm'
                : 'border-amber-500/40 text-amber-300 bg-amber-950/20 hover:bg-amber-950/40'
            )}
            title="Filter to only positions with IV Rank >= 50% (optimal call selling)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Optimal IV (IVR &ge; 50%)</span>
          </Button>

          <div className="relative flex-1 md:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker..."
              className="h-8 text-xs pl-8 bg-card/60 border-border/70 uppercase font-mono"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-8 text-xs font-semibold bg-card/80 border border-border/70 rounded-xl px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
          >
            <option value="CAPACITY">Sort: Real Capacity (High &rarr; Low)</option>
            <option value="IVR">Sort: IV Rank (IVR High &rarr; Low)</option>
            <option value="IV">Sort: Implied Volatility (IV High &rarr; Low)</option>
            <option value="EARNINGS">Sort: Next Earnings Date</option>
            <option value="ACTIVE_CALLS">Sort: Active Short Calls First</option>
            <option value="YIELD">Sort: APY Yield (% High &rarr; Low)</option>
            <option value="MARKET_VALUE">Sort: Position Market Value</option>
            <option value="DELTA">Sort: Net Delta (&Delta; High &rarr; Low)</option>
          </select>
        </div>
      </div>

      {/* ================= 3. CANDIDATES LIST ================= */}
      {isLoading ? (
        <div className="glass-card rounded-2xl p-16 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary animate-pulse">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">Scanning Portfolio for Covered Call Candidates...</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Aggregating share counts, net deltas, active short call coverage, and calculating optimal 3-tier strike proposals.
            </p>
          </div>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-3">
          <ShieldCheck className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <h3 className="font-bold text-foreground text-base">
            {statusFilter === 'HIDDEN' ? 'No Hidden Stocks' : 'No Matching Positions Found'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {statusFilter === 'HIDDEN'
              ? 'All eligible covered call candidates are currently active. If there are stocks you temporarily don\'t want to sell calls against, click "Don\'t Sell Calls" on their card.'
              : statusFilter === 'UNCOVERED'
              ? 'Great job! You have no unhedged positions with 100+ Delta without short call coverage, or your current positions have fewer than 100 shares.'
              : 'Try clearing your filters or adding positions with 100+ shares to analyze covered call income opportunities.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusFilter('UNCOVERED');
              setSearchQuery('');
            }}
            className="text-xs"
          >
            {statusFilter === 'HIDDEN' ? 'View Uncovered Opportunities' : 'Reset Filters'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top Banner when viewing Hidden Tab */}
          {statusFilter === 'HIDDEN' && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-950/15 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2.5">
                <EyeOff className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    Temporarily Excluded Stocks ({hiddenCandidates.length})
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    These positions are temporarily hidden from covered call selling. Click &quot;Unhide Stock&quot; to restore them to active proposals.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnhideAll}
                disabled={hiddenCandidates.length === 0}
                className="h-8 text-xs font-semibold border-rose-500/40 text-rose-300 hover:bg-rose-950/40 gap-1.5 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore All ({hiddenCandidates.length})</span>
              </Button>
            </div>
          )}

          {filteredCandidates.map((candidate) => {
            const isExpanded = expandedPositionId === candidate.symbol;
            const hasCapacity = candidate.coveredCallCapacity >= 1;
            const isUncovered = candidate.coverageStatus === 'UNCOVERED_OPPORTUNITY';
            const isHidden = hiddenSymbols.has(candidate.symbol);

            return (
              <div
                key={candidate.symbol}
                className={cn(
                  'glass-card rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm hover:border-primary/40',
                  isHidden
                    ? 'border-rose-500/30 bg-rose-950/10'
                    : isUncovered && hasCapacity
                    ? 'border-emerald-500/40 bg-emerald-950/10'
                    : 'border-border/60 bg-card/60'
                )}
              >
                {/* Main Card Header / Bar */}
                <div className="p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  {/* Left: Ticker & Position Telemetry */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div
                      onClick={() => handleRowClick(candidate.symbol)}
                      className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center font-mono font-black text-sm text-primary shrink-0 cursor-pointer hover:bg-primary/20 transition-colors shadow-sm mt-0.5"
                      title="Open in Research Suite"
                    >
                      {candidate.symbol.slice(0, 4)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          onClick={() => handleRowClick(candidate.symbol)}
                          className="font-black text-base font-mono text-foreground hover:text-primary transition-colors cursor-pointer"
                        >
                          {candidate.symbol}
                        </span>

                        {getStatusBadge(candidate.coverageStatus, candidate.coveredCallCapacity, candidate.shortCallsCount)}

                        {isHidden && (
                          <Badge variant="outline" className="text-rose-300 border-rose-500/40 text-xs font-bold gap-1 bg-rose-950/30">
                            <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                            <span>Call Selling Paused</span>
                          </Badge>
                        )}

                        {candidate.hasActiveCalls && (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-bold gap-1 shadow-xs">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                            <span>{candidate.shortCallsCount}x Active Call{candidate.shortCallsCount > 1 ? 's' : ''} Open</span>
                          </Badge>
                        )}

                        {!candidate.hasActiveCalls && candidate.shareCount >= 100 && (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px] font-medium gap-1 bg-emerald-950/20">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>No Active Calls (100% Real Capacity)</span>
                          </Badge>
                        )}

                        {(candidate.brokers || []).map((b) => (
                          <span
                            key={b}
                            className="text-[9px] font-mono text-muted-foreground bg-slate-900/60 px-1.5 py-0.5 rounded border border-white/5"
                          >
                            {b}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap font-mono">
                        <span className="text-foreground font-semibold">
                          ${candidate.currentPrice.toFixed(2)}
                        </span>
                        <span>•</span>
                        <span>
                          {Math.round(candidate.shareCount)} Shares ({candidate.totalCapacity || Math.floor(candidate.shareCount / 100)}x Max Capacity)
                        </span>
                        <span>•</span>
                        <span className={candidate.coveredCallCapacity > 0 ? "text-emerald-400 font-bold" : "text-muted-foreground font-bold"}>
                          Real Capacity: {candidate.coveredCallCapacity}x ({candidate.uncoveredSharesCount ?? candidate.shareCount} shs free)
                        </span>
                        {candidate.shortCallsCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-amber-300 font-semibold flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3 text-amber-400" />
                              Covered: {candidate.shortCallsCount}x ({candidate.coveredSharesCount ?? (candidate.shortCallsCount * 100)} shs committed)
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-primary font-bold">
                          +{candidate.netPositionDelta} &Delta; Net Delta
                        </span>
                        <span>•</span>
                        <span>
                          Value: ${candidate.totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        {candidate.distanceFrom52WHigh !== undefined && (
                          <>
                            <span>•</span>
                            <span className={candidate.distanceFrom52WHigh >= -10 ? 'text-emerald-400' : 'text-amber-400'}>
                              {candidate.distanceFrom52WHigh.toFixed(1)}% 52W
                            </span>
                          </>
                        )}
                      </div>

                      {/* ================= VOLATILITY (IV / IVR / IVP) & EARNINGS CATALYST BAR ================= */}
                      <div className="mt-2.5 pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                        {/* Left: Volatility Matrix & Optimal Verdict */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* IV */}
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/60 border border-border/50 font-mono text-[11px]" title="Current 30-day / Front-Month Implied Volatility">
                            <Activity className="w-3 h-3 text-cyan-400" />
                            <span className="text-muted-foreground">IV:</span>
                            <span className="text-foreground font-bold">{candidate.impliedVolatility !== undefined ? `${candidate.impliedVolatility}%` : '---'}</span>
                          </div>

                          {/* IVR (IV Rank) */}
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/60 border border-border/50 font-mono text-[11px]" title="Implied Volatility Rank: where current IV sits within 52-week range (0-100%)">
                            <span className="text-muted-foreground">IVR:</span>
                            <span className={cn(
                              "font-bold",
                              (candidate.ivRank || 0) >= 50 ? "text-emerald-400" : (candidate.ivRank || 0) >= 30 ? "text-amber-300" : "text-muted-foreground"
                            )}>
                              {candidate.ivRank !== undefined ? `${candidate.ivRank}%` : '---'}
                            </span>
                          </div>

                          {/* IVP (IV Percentile) */}
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/60 border border-border/50 font-mono text-[11px]" title="Implied Volatility Percentile: % of days in the past year IV was lower than today">
                            <span className="text-muted-foreground">IVP:</span>
                            <span className={cn(
                              "font-bold",
                              (candidate.ivPercentile || 0) >= 50 ? "text-emerald-400" : (candidate.ivPercentile || 0) >= 30 ? "text-amber-300" : "text-muted-foreground"
                            )}>
                              {candidate.ivPercentile !== undefined ? `${candidate.ivPercentile}%` : '---'}
                            </span>
                          </div>

                          {/* Optimal Call Selling Verdict Badge */}
                          {candidate.callSellingEnvironment === 'OPTIMAL' || (candidate.ivRank !== undefined && candidate.ivRank >= 50) ? (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold gap-1 shadow-xs" title={candidate.optimalSellingVerdict || "Elevated IV: High options premium provides optimal call selling environment"}>
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span>Optimal to Sell Calls (High IV Premia)</span>
                            </Badge>
                          ) : candidate.callSellingEnvironment === 'EXTREME' ? (
                            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] font-bold gap-1 shadow-xs" title={candidate.optimalSellingVerdict || "Extreme IV: Peak options premium, watch for binary catalyst"}>
                              <Flame className="w-3 h-3 text-purple-400 animate-pulse" />
                              <span>Peak IV (Max Premium • Event Risk)</span>
                            </Badge>
                          ) : candidate.callSellingEnvironment === 'SUBOPTIMAL' || (candidate.ivRank !== undefined && candidate.ivRank < 30) ? (
                            <Badge variant="outline" className="text-muted-foreground border-border/70 text-[10px] font-medium gap-1 bg-slate-900/40" title={candidate.optimalSellingVerdict || "Low IV: Options are cheap/underpriced"}>
                              <AlertCircle className="w-3 h-3 text-amber-400/80" />
                              <span>Sub-Optimal (Low IV / Cheap Calls)</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-cyan-300 border-cyan-500/30 text-[10px] font-medium gap-1 bg-cyan-950/20" title={candidate.optimalSellingVerdict || "Moderate IV: Normal options pricing"}>
                              <span>Moderate IV (Steady Harvest)</span>
                            </Badge>
                          )}
                        </div>

                        {/* Right: Next Earnings Catalyst */}
                        <div className="flex items-center gap-2 font-mono text-[11px] flex-wrap">
                          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-card/80 border border-border/60" title="Next corporate quarterly earnings announcement date">
                            <Calendar className="w-3 h-3 text-indigo-400" />
                            <span className="text-muted-foreground">Next Earnings:</span>
                            <span className="text-foreground font-semibold">
                              {candidate.nextEarningsDate || 'Date Pending'}
                            </span>
                            {candidate.daysUntilEarnings !== undefined && candidate.daysUntilEarnings >= 0 && (
                              <span className="text-muted-foreground">({candidate.daysUntilEarnings}d)</span>
                            )}
                          </div>

                          {candidate.earningsBeforeExpiration ? (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold gap-1" title={`Earnings falls within proposed expiration (${candidate.proposedCalls?.balanced?.dte || 35}d DTE). Option pricing reflects binary earnings event.`}>
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>Earnings Inside Cycle (&le;{candidate.proposedCalls?.balanced?.dte || 35}d)</span>
                            </Badge>
                          ) : candidate.nextEarningsDate && candidate.nextEarningsDate !== 'Date Pending' && candidate.daysUntilEarnings !== undefined && candidate.daysUntilEarnings > 0 ? (
                            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px] font-medium gap-1 bg-emerald-950/20" title={`Earnings occurs after option expiration (${candidate.proposedCalls?.balanced?.dte || 35}d DTE). Clean theta decay without binary gap risk.`}>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Safe: Post-Exp ({candidate.daysUntilEarnings}d)</span>
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Income Harvest Action Banner */}
                  <div className="flex items-center gap-2.5 self-end lg:self-auto flex-wrap">
                    {hasCapacity && candidate.proposedCalls?.balanced && (
                      <div className="text-right font-mono pr-2 hidden sm:block">
                        <div className="text-xs font-bold text-emerald-400">
                          +${(candidate.proposedCalls.balanced.totalPotentialIncome || 0).toFixed(0)} Est. Income
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {candidate.proposedCalls.balanced.annualizedYieldPercent || 0}% APY (Balanced)
                        </div>
                      </div>
                    )}

                    {isHidden ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnhideStock(candidate.symbol)}
                        className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-300 bg-emerald-950/20 hover:bg-emerald-900/40 font-semibold"
                        title={`Restore ${candidate.symbol} to Covered Call Harvester`}
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Unhide Stock</span>
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleHideStock(candidate.symbol)}
                        className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-rose-300 hover:bg-rose-950/30 font-medium transition-colors"
                        title={`Temporarily hide ${candidate.symbol} (don't sell calls)`}
                      >
                        <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="hidden sm:inline">Don&apos;t Sell Calls</span>
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedChainSymbol(candidate.symbol)}
                      className="h-8 text-xs gap-1.5 border-border/70 bg-card hover:bg-accent/40 font-semibold"
                      title="Inspect full call options chain"
                    >
                      <Sliders className="w-3.5 h-3.5 text-primary" />
                      <span>Live Chain</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedPositionId(isExpanded ? null : candidate.symbol)}
                      className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <span>{isExpanded ? 'Hide Tiers' : 'View 3 Tiers'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* ================= ACTIVE SHORT CALL POSITIONS (REAL CAPACITY VERIFICATION) ================= */}
                {candidate.activeCoveredCalls && candidate.activeCoveredCalls.length > 0 && (
                  <div className="mx-5 mb-3 p-4 rounded-xl border border-amber-500/30 bg-amber-950/15 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                          Active Short Call Positions ({candidate.activeCoveredCalls.reduce((s, c) => s + c.quantity, 0)}x Contracts Open)
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground bg-slate-900/60 px-2.5 py-0.5 rounded border border-white/5">
                        Capacity Real Check: <span className="text-foreground font-semibold">{candidate.shareCount} shs</span> &minus; <span className="text-amber-300 font-semibold">{candidate.coveredSharesCount ?? (candidate.shortCallsCount * 100)} covered</span> = <span className="text-emerald-400 font-bold">{candidate.uncoveredSharesCount ?? 0} free ({candidate.coveredCallCapacity}x Real Remaining Capacity)</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                      {candidate.activeCoveredCalls.map((call, idx) => (
                        <div key={idx} className="p-3 rounded-lg border border-amber-500/25 bg-card/80 font-mono text-xs space-y-1.5 shadow-xs">
                          <div className="flex items-center justify-between font-bold text-foreground">
                            <span className="text-amber-300 text-sm">${call.strike.toFixed(2)} Call</span>
                            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-300 bg-amber-500/10">
                              {call.broker || 'Tastytrade'}
                            </Badge>
                          </div>
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Contract:</span>
                            <span className="text-foreground truncate max-w-[170px]" title={call.contractSymbol}>{call.contractSymbol}</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Expiration:</span>
                            <span className="text-foreground font-semibold">{call.expiration} ({call.dte}d DTE)</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Position Size:</span>
                            <span className="text-amber-200 font-semibold">{call.quantity}x Short (-{call.quantity * 100} shs)</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Option Price / Val:</span>
                            <span className="text-foreground">${call.currentPrice.toFixed(2)} (${call.marketValue.toFixed(2)})</span>
                          </div>
                          {call.unrealizedPL !== undefined && (
                            <div className="flex justify-between text-[11px] pt-1 border-t border-border/40">
                              <span className="text-muted-foreground">Unrealized P&L:</span>
                              <span className={call.unrealizedPL >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                {call.unrealizedPL >= 0 ? '+' : ''}${call.unrealizedPL.toFixed(2)}
                                {call.unrealizedPLPercent !== undefined ? ` (${call.unrealizedPLPercent >= 0 ? '+' : ''}${call.unrealizedPLPercent.toFixed(1)}%)` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ================= 3 PROPOSED CALL STRIKE TIERS (EXPANDABLE OR DEFAULT FOR UNCOVERED) ================= */}
                {(isExpanded || (isUncovered && hasCapacity)) && candidate.proposedCalls && (
                  <div className="px-5 pb-5 pt-1 border-t border-border/40 bg-accent/5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    {/* Capacity Verification Banner when 0 active calls */}
                    {(!candidate.activeCoveredCalls || candidate.activeCoveredCalls.length === 0) && candidate.shareCount >= 100 && (
                      <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-950/15 text-xs text-emerald-300 flex items-center justify-between font-mono">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Capacity Verified Real: 0 active call positions on {candidate.symbol}. All {candidate.shareCount} shares ({candidate.coveredCallCapacity}x contracts) are completely unhedged and 100% available.</span>
                        </div>
                        <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono shrink-0">
                          {candidate.coveredCallCapacity}x Real Capacity
                        </Badge>
                      </div>
                    )}

                    {/* Fully covered notice */}
                    {candidate.coveredCallCapacity === 0 && candidate.shareCount >= 100 && (
                      <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-950/20 text-xs flex items-center gap-2.5 text-blue-200 font-mono">
                        <Info className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>
                          <strong>Position 100% Covered:</strong> All {candidate.shareCount} shares are currently pledged to {candidate.shortCallsCount}x active short call positions. <strong>Remaining new capacity is 0 contracts</strong>. The playbooks below represent potential roll or replacement targets when managing your active call.
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        {candidate.coveredCallCapacity > 0
                          ? `Proposed Call-Selling Playbooks (${candidate.coveredCallCapacity}x Real Available Contracts)`
                          : `Proposed Call Management / Roll Playbooks (0x New Capacity)`}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Select a strike to copy plan or review telemetry
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      {/* 1. Conservative Tier */}
                      {candidate.proposedCalls.conservative && (
                        <div className="rounded-xl border border-border/70 bg-card/60 p-4 flex flex-col justify-between gap-3 hover:border-border transition-all">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] uppercase tracking-wider font-bold text-blue-400">
                                1. Conservative
                              </span>
                              <Badge variant="outline" className="text-[10px] font-mono border-blue-500/30 text-blue-300">
                                &Delta; {candidate.proposedCalls.conservative.targetDelta?.toFixed(2) || '0.18'}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Capital preservation with high upside cushion
                            </p>

                            <div className="mt-3 space-y-1.5 font-mono text-xs">
                              <div className="flex justify-between items-baseline">
                                <span className="text-muted-foreground">Target Strike:</span>
                                <span className="font-bold text-sm text-foreground">
                                  ${candidate.proposedCalls.conservative.strike?.toFixed(2)} Call
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Expiration:</span>
                                <span className="text-foreground">
                                  {candidate.proposedCalls.conservative.expiration} ({candidate.proposedCalls.conservative.dte}d)
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">OTM Buffer:</span>
                                <span className="text-emerald-400 font-semibold">
                                  +{candidate.proposedCalls.conservative.otmBufferPercent}%
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">POP (Prob. OTM):</span>
                                <span className="text-blue-300 font-semibold">
                                  {candidate.proposedCalls.conservative.probabilityOfProfitPercent}%
                                </span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-border/40">
                                <span className="text-muted-foreground">Est. Total Premium:</span>
                                <span className="font-bold text-emerald-400">
                                  +${(candidate.proposedCalls.conservative.totalPotentialIncome || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Annualized Yield:</span>
                                <span className="font-bold text-foreground">
                                  {candidate.proposedCalls.conservative.annualizedYieldPercent}% APY
                                </span>
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyPlan(candidate, candidate.proposedCalls.conservative)}
                            className="w-full h-8 text-xs font-semibold gap-1.5 border-border/60 hover:bg-accent/40"
                          >
                            <Copy className="w-3 h-3" /> Copy Conservative Plan
                          </Button>
                        </div>
                      )}

                      {/* 2. Balanced Sweet Spot Tier (Highlighted) */}
                      {candidate.proposedCalls.balanced && (
                        <div className="rounded-xl border border-primary/60 bg-primary/10 p-4 flex flex-col justify-between gap-3 shadow-md shadow-primary/5 ring-1 ring-primary/40 relative">
                          <div className="absolute -top-2.5 right-4 bg-primary text-primary-foreground font-mono font-bold text-[9px] px-2 py-0.5 rounded-full shadow-sm">
                            INSTITUTIONAL SWEET SPOT
                          </div>

                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] uppercase tracking-wider font-bold text-primary">
                                2. Balanced Yield
                              </span>
                              <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] font-mono font-bold">
                                &Delta; {candidate.proposedCalls.balanced.targetDelta?.toFixed(2) || '0.28'}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Optimal risk/reward & theta decay balance
                            </p>

                            <div className="mt-3 space-y-1.5 font-mono text-xs">
                              <div className="flex justify-between items-baseline">
                                <span className="text-muted-foreground">Target Strike:</span>
                                <span className="font-bold text-sm text-foreground">
                                  ${candidate.proposedCalls.balanced.strike?.toFixed(2)} Call
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Expiration:</span>
                                <span className="text-foreground">
                                  {candidate.proposedCalls.balanced.expiration} ({candidate.proposedCalls.balanced.dte}d)
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">OTM Buffer:</span>
                                <span className="text-emerald-400 font-semibold">
                                  +{candidate.proposedCalls.balanced.otmBufferPercent}%
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">POP (Prob. OTM):</span>
                                <span className="text-primary font-semibold">
                                  {candidate.proposedCalls.balanced.probabilityOfProfitPercent}%
                                </span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-border/40">
                                <span className="text-muted-foreground">Est. Total Premium:</span>
                                <span className="font-bold text-emerald-400 text-sm">
                                  +${(candidate.proposedCalls.balanced.totalPotentialIncome || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Annualized Yield:</span>
                                <span className="font-bold text-primary text-sm">
                                  {candidate.proposedCalls.balanced.annualizedYieldPercent}% APY
                                </span>
                              </div>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleCopyPlan(candidate, candidate.proposedCalls.balanced)}
                            className="w-full h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-sm"
                          >
                            <Copy className="w-3 h-3" /> Copy Sweet Spot Plan
                          </Button>
                        </div>
                      )}

                      {/* 3. Aggressive Income Tier */}
                      {candidate.proposedCalls.aggressive && (
                        <div className="rounded-xl border border-border/70 bg-card/60 p-4 flex flex-col justify-between gap-3 hover:border-border transition-all">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] uppercase tracking-wider font-bold text-amber-400">
                                3. Max Income Yield
                              </span>
                              <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-300">
                                &Delta; {candidate.proposedCalls.aggressive.targetDelta?.toFixed(2) || '0.40'}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Closer to ATM for aggressive cash flow
                            </p>

                            <div className="mt-3 space-y-1.5 font-mono text-xs">
                              <div className="flex justify-between items-baseline">
                                <span className="text-muted-foreground">Target Strike:</span>
                                <span className="font-bold text-sm text-foreground">
                                  ${candidate.proposedCalls.aggressive.strike?.toFixed(2)} Call
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Expiration:</span>
                                <span className="text-foreground">
                                  {candidate.proposedCalls.aggressive.expiration} ({candidate.proposedCalls.aggressive.dte}d)
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">OTM Buffer:</span>
                                <span className="text-amber-400 font-semibold">
                                  +{candidate.proposedCalls.aggressive.otmBufferPercent}%
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">POP (Prob. OTM):</span>
                                <span className="text-amber-300 font-semibold">
                                  {candidate.proposedCalls.aggressive.probabilityOfProfitPercent}%
                                </span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-border/40">
                                <span className="text-muted-foreground">Est. Total Premium:</span>
                                <span className="font-bold text-emerald-400">
                                  +${(candidate.proposedCalls.aggressive.totalPotentialIncome || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Annualized Yield:</span>
                                <span className="font-bold text-amber-400 font-bold">
                                  {candidate.proposedCalls.aggressive.annualizedYieldPercent}% APY
                                </span>
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyPlan(candidate, candidate.proposedCalls.aggressive)}
                            className="w-full h-8 text-xs font-semibold gap-1.5 border-border/60 hover:bg-accent/40"
                          >
                            <Copy className="w-3 h-3" /> Copy Max Income Plan
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ================= LIVE OPTION CHAIN MODAL DIALOG ================= */}
      {selectedChainSymbol && (
        <Dialog open={Boolean(selectedChainSymbol)} onOpenChange={(open) => !open && setSelectedChainSymbol(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-card/95 border-border/80 p-6 backdrop-blur-xl">
            <DialogHeader className="space-y-1.5 pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center font-mono font-bold text-primary">
                    {selectedChainSymbol.slice(0, 3)}
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-foreground">
                      {selectedChainSymbol} Live Call Options Chain
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      {chainData?.companyName} • Current Price: ${chainData?.currentPrice ? chainData.currentPrice.toFixed(2) : '---'}
                    </DialogDescription>
                  </div>
                </div>
              </div>
            </DialogHeader>

            {isChainLoading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-xs">Fetching live options chain for {selectedChainSymbol}...</p>
              </div>
            ) : !chainData || (chainData.expirations || []).length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No active call option contracts available for {selectedChainSymbol}.
              </div>
            ) : (
              <div className="space-y-6 pt-2">
                {(chainData.expirations || []).map((exp) => (
                  <div key={exp.date} className="rounded-xl border border-border/60 overflow-hidden">
                    <div className="px-4 py-2.5 bg-accent/20 border-b border-border/50 flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        Exp: {exp.date} ({exp.dte} DTE)
                      </span>
                      <span className="text-muted-foreground">
                        {(exp.calls || []).length} Strikes
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left font-mono">
                        <thead className="bg-card/80 text-muted-foreground border-b border-border/40 text-[10px] uppercase">
                          <tr>
                            <th className="p-2.5 pl-4">Strike</th>
                            <th className="p-2.5">Delta</th>
                            <th className="p-2.5">OTM Buffer</th>
                            <th className="p-2.5">Bid / Ask</th>
                            <th className="p-2.5">Mid ($)</th>
                            <th className="p-2.5">Est. APY</th>
                            <th className="p-2.5">POP</th>
                            <th className="p-2.5 pr-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {(exp.calls || []).slice(0, 12).map((call) => {
                            const isSweetSpot = call.delta >= 0.22 && call.delta <= 0.32;
                            const apy = chainData.currentPrice > 0
                              ? (call.mid / chainData.currentPrice) * (365 / exp.dte) * 100
                              : 0;

                            return (
                              <tr
                                key={call.strike}
                                className={cn(
                                  'hover:bg-accent/30 transition-colors',
                                  isSweetSpot && 'bg-primary/5'
                                )}
                              >
                                <td className="p-2.5 pl-4 font-bold text-foreground">
                                  ${call.strike.toFixed(2)}
                                  {isSweetSpot && (
                                    <span className="ml-1.5 text-[8.5px] bg-primary/20 text-primary px-1 py-0.2 rounded">
                                      Sweet Spot
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 text-foreground font-semibold">
                                  {call.delta.toFixed(2)}
                                </td>
                                <td className="p-2.5 text-emerald-400">
                                  +{call.otmPercent.toFixed(1)}%
                                </td>
                                <td className="p-2.5 text-muted-foreground">
                                  ${call.bid.toFixed(2)} / ${call.ask.toFixed(2)}
                                </td>
                                <td className="p-2.5 font-bold text-foreground">
                                  ${call.mid.toFixed(2)}
                                </td>
                                <td className="p-2.5 font-bold text-primary">
                                  {apy.toFixed(1)}%
                                </td>
                                <td className="p-2.5 text-muted-foreground">
                                  {call.pop}%
                                </td>
                                <td className="p-2.5 pr-4 text-right">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const text = `Covered Call: Sell 1x ${selectedChainSymbol} $${call.strike} Call exp ${exp.date} @ $${call.mid.toFixed(2)}`;
                                      navigator.clipboard.writeText(text);
                                      toast.success(`Copied $${call.strike} Call Plan!`);
                                    }}
                                    className="h-6 px-2 text-[10px] text-primary hover:bg-primary/20"
                                  >
                                    Copy
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
