import { useState, useMemo } from 'react';
import {
  TrendingUp,
  ShieldCheck,
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
  ArrowUpRight
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

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNCOVERED' | 'PARTIAL' | 'COVERED'>('UNCOVERED');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'CAPACITY' | 'YIELD' | 'MARKET_VALUE' | 'DELTA'>('CAPACITY');
  const [selectedChainSymbol, setSelectedChainSymbol] = useState<string | null>(null);
  const [expandedPositionId, setExpandedPositionId] = useState<string | null>(null);

  const { data: chainData, isLoading: isChainLoading } = useDetailedOptionChain(
    selectedChainSymbol || undefined
  );

  const allCandidates = Array.isArray(analysisData?.candidates)
    ? analysisData.candidates.filter(Boolean)
    : [];

  // Filter and sort candidates
  const filteredCandidates = useMemo(() => {
    return allCandidates
      .filter((c) => {
        // Status filter
        if (statusFilter === 'UNCOVERED' && c.coverageStatus !== 'UNCOVERED_OPPORTUNITY') return false;
        if (statusFilter === 'PARTIAL' && c.coverageStatus !== 'PARTIALLY_COVERED') return false;
        if (statusFilter === 'COVERED' && c.coverageStatus !== 'FULLY_COVERED') return false;

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
  }, [allCandidates, statusFilter, searchQuery, sortBy]);

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

  const getStatusBadge = (status: CoverageStatus, capacity: number) => {
    switch (status) {
      case 'UNCOVERED_OPPORTUNITY':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-bold gap-1 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span>Uncovered Opportunity ({capacity}x Calls Available)</span>
          </Badge>
        );
      case 'PARTIALLY_COVERED':
        return (
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-bold gap-1">
            <span>Partially Covered (+{capacity}x Calls Available)</span>
          </Badge>
        );
      case 'FULLY_COVERED':
        return (
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs font-bold gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Fully Covered (100% Hedged)</span>
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
                {analysisData?.totalUncoveredCallCapacity ?? 0}
              </span>
              <span className="text-xs text-emerald-400/80 font-medium">Contracts Available</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Across {analysisData?.uncoveredPositionsCount ?? 0} unhedged stock/LEAPs positions with &ge;100 Delta
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
                +${analysisData?.potentialMonthlyIncomeEstimate ? analysisData.potentialMonthlyIncomeEstimate.toLocaleString() : '0'}
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
                {analysisData?.totalEligiblePositionsCount ?? 0}
              </span>
              <span className="text-xs text-muted-foreground font-medium">Holdings</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {analysisData?.uncoveredPositionsCount ?? 0} Uncovered • {analysisData?.partiallyCoveredCount ?? 0} Partial • {analysisData?.fullyCoveredCount ?? 0} Fully Covered
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
                +{analysisData?.totalPortfolioNetDelta ? Math.round(analysisData.totalPortfolioNetDelta).toLocaleString() : '0'} &Delta;
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
            <span>Uncovered Opportunities ({analysisData?.uncoveredPositionsCount ?? 0})</span>
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
            <span>Partially Covered ({analysisData?.partiallyCoveredCount ?? 0})</span>
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
            <span>Fully Covered ({analysisData?.fullyCoveredCount ?? 0})</span>
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
            All Holdings ({allCandidates.length})
          </Button>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-56">
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
            <option value="CAPACITY">Sort: Uncovered Calls (High &rarr; Low)</option>
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
          <h3 className="font-bold text-foreground text-base">No Matching Positions Found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {statusFilter === 'UNCOVERED'
              ? 'Great job! You have no unhedged positions with 100+ Delta without short call coverage, or your current positions have fewer than 100 shares.'
              : 'Try clearing your filters or adding positions with 100+ shares to analyze covered call income opportunities.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusFilter('ALL');
              setSearchQuery('');
            }}
            className="text-xs"
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCandidates.map((candidate) => {
            const isExpanded = expandedPositionId === candidate.symbol;
            const hasCapacity = candidate.coveredCallCapacity >= 1;
            const isUncovered = candidate.coverageStatus === 'UNCOVERED_OPPORTUNITY';

            return (
              <div
                key={candidate.symbol}
                className={cn(
                  'glass-card rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm hover:border-primary/40',
                  isUncovered && hasCapacity
                    ? 'border-emerald-500/40 bg-emerald-950/10'
                    : 'border-border/60 bg-card/60'
                )}
              >
                {/* Main Card Header / Bar */}
                <div className="p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  {/* Left: Ticker & Position Telemetry */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      onClick={() => handleRowClick(candidate.symbol)}
                      className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center font-mono font-black text-sm text-primary shrink-0 cursor-pointer hover:bg-primary/20 transition-colors shadow-sm"
                      title="Open in Research Suite"
                    >
                      {candidate.symbol.slice(0, 4)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          onClick={() => handleRowClick(candidate.symbol)}
                          className="font-black text-base font-mono text-foreground hover:text-primary transition-colors cursor-pointer"
                        >
                          {candidate.symbol}
                        </span>

                        {getStatusBadge(candidate.coverageStatus, candidate.coveredCallCapacity)}

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
                          {Math.round(candidate.shareCount)} Shares
                        </span>
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

                {/* ================= 3 PROPOSED CALL STRIKE TIERS (EXPANDABLE OR DEFAULT FOR UNCOVERED) ================= */}
                {(isExpanded || (isUncovered && hasCapacity)) && candidate.proposedCalls && (
                  <div className="px-5 pb-5 pt-1 border-t border-border/40 bg-accent/5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Proposed Call-Selling Playbooks ({candidate.coveredCallCapacity}x Contracts)
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
