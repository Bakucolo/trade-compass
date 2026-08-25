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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScorecards, StockScorecard } from '@/services/scorecardService';
import { StockScorecardModal } from './scorecards/StockScorecardModal';
import { ScorecardCompareModal } from './scorecards/ScorecardCompareModal';

interface ScorecardsPageProps {
  onNavigateToResearch?: (symbol: string) => void;
}

type SourceFilter = 'ALL' | 'HOLDINGS' | 'WATCHLIST' | 'HIGH_CONVICTION' | 'DEEP_VALUE' | 'QUALITY_KINGS';
type SortOption = 'OVERALL' | 'BUYING' | 'FUNDAMENTALS' | 'VALUATION' | 'UPSIDE' | 'MARKET_CAP' | 'CHANGE';
type ViewMode = 'GRID' | 'TABLE';

export function ScorecardsPage({ onNavigateToResearch }: ScorecardsPageProps) {
  const { data: scorecardsData, isLoading, refetch, isRefetching } = useScorecards();

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('OVERALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('GRID');

  // Modal states
  const [selectedScorecard, setSelectedScorecard] = useState<StockScorecard | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const rawScorecards = scorecardsData?.scorecards || [];
  const summary = scorecardsData?.summary;
  const sectors = scorecardsData?.sectors || [];

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

        // Source Filter
        if (sourceFilter === 'HOLDINGS' && !item.isHolding) return false;
        if (sourceFilter === 'WATCHLIST' && !item.isWatchlist) return false;
        if (sourceFilter === 'HIGH_CONVICTION' && item.overallScore < 75) return false;
        if (sourceFilter === 'DEEP_VALUE' && item.valuationScore < 75) return false;
        if (sourceFilter === 'QUALITY_KINGS' && item.fundamentalsScore < 80) return false;

        // Sector Filter
        if (selectedSector !== 'ALL' && item.sector !== selectedSector) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'OVERALL') return b.overallScore - a.overallScore;
        if (sortBy === 'BUYING') return b.buyingConvictionScore - a.buyingConvictionScore;
        if (sortBy === 'FUNDAMENTALS') return b.fundamentalsScore - a.fundamentalsScore;
        if (sortBy === 'VALUATION') return b.valuationScore - a.valuationScore;
        if (sortBy === 'UPSIDE') return b.metrics.upsideToFairValuePct - a.metrics.upsideToFairValuePct;
        if (sortBy === 'MARKET_CAP') return b.marketCap - a.marketCap;
        if (sortBy === 'CHANGE') return b.changePercent - a.changePercent;
        return b.overallScore - a.overallScore;
      });
  }, [rawScorecards, sourceFilter, selectedSector, sortBy, searchQuery]);

  // Find Upgrade Opportunities: Watchlist stock that has higher overall score than a held position in the same sector
  const upgradeOpportunities = useMemo(() => {
    const opportunities: { watchlistStock: StockScorecard; holdingStock: StockScorecard; scoreDelta: number }[] = [];
    const holdingsBySector = new Map<string, StockScorecard[]>();

    rawScorecards.filter((s) => s.isHolding).forEach((h) => {
      const list = holdingsBySector.get(h.sector) || [];
      list.push(h);
      holdingsBySector.set(h.sector, list);
    });

    rawScorecards.filter((s) => s.isWatchlist && !s.isHolding && s.overallScore >= 75).forEach((w) => {
      const heldPeers = holdingsBySector.get(w.sector) || [];
      heldPeers.forEach((h) => {
        const delta = w.overallScore - h.overallScore;
        if (delta >= 15) {
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

  const getScoreBadgeStyle = (score: number) => {
    if (score >= 84) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (score >= 70) return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
    if (score >= 50) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (score >= 35) return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  };

  const getScoreRingClass = (score: number) => {
    if (score >= 84) return 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
    if (score >= 70) return 'text-teal-400 border-teal-500/50 bg-teal-500/10';
    if (score >= 50) return 'text-amber-400 border-amber-500/50 bg-amber-500/10';
    if (score >= 35) return 'text-orange-400 border-orange-500/50 bg-orange-500/10';
    return 'text-rose-400 border-rose-500/50 bg-rose-500/10';
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
              Comprehensive multi-factor conviction ranking, fundamental quality & valuation benchmarking across portfolio holdings and watchlists.
            </p>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-9 text-xs font-bold gap-1.5 border-border/70 bg-card/60"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefetching && "animate-spin text-primary")} />
            <span>{isRefetching ? 'Recalculating...' : 'Refresh Scores'}</span>
          </Button>
        </div>
      </div>

      {/* ================= EXECUTIVE SUMMARY CARDS ================= */}
      {summary && (
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
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] font-mono">
                    {summary.topConvictionPick.overallScore}/100
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

          {/* 2. Top Value Multiple Pick */}
          <Card className="bg-card/70 backdrop-blur-xl border border-indigo-500/30 shadow-lg rounded-2xl overflow-hidden relative group">
            <div className="h-1 w-full bg-indigo-500" />
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-muted-foreground uppercase text-[10px] flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-400" /> Top Value Leader
                </span>
                {summary.topValuePick && (
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[9px] font-mono">
                    Val: {summary.topValuePick.valuationScore}/100
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
                  <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/40 text-[9px] font-mono">
                    Fund: {summary.topQualityPick.fundamentalsScore}/100
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

          {/* 4. Watchlist vs Holdings Conviction Delta */}
          <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden relative group">
            <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-primary" />
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-muted-foreground uppercase text-[10px] flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-primary" /> Watchlist vs Holdings
                </span>
                <span className="text-xs font-mono font-bold text-foreground">
                  Avg {summary.avgOverallScore}/100
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs pt-1">
                <div>
                  <span className="text-[10px] text-muted-foreground block font-sans">Holdings ({summary.holdingsCount})</span>
                  <span className="text-sm font-bold text-foreground">{summary.avgHoldingsScore}/100</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block font-sans">Watchlist ({summary.watchlistCount})</span>
                  <span className="text-sm font-bold text-primary">{summary.avgWatchlistScore}/100</span>
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
                    <span className="text-[9px] text-muted-foreground">{opp.watchlistStock.overallScore} pts</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div className="text-center font-mono">
                    <span className="text-xs font-bold text-muted-foreground block">{opp.holdingStock.symbol}</span>
                    <span className="text-[9px] text-muted-foreground">{opp.holdingStock.overallScore} pts</span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] font-bold">
                    +{opp.scoreDelta} Delta
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
          {/* Source Tabs */}
          <div className="flex items-center bg-card/80 p-1 rounded-xl border border-border/60 flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setSourceFilter('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                sourceFilter === 'ALL'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All ({rawScorecards.length})
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('HOLDINGS')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                sourceFilter === 'HOLDINGS'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Holdings ({summary?.holdingsCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('WATCHLIST')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                sourceFilter === 'WATCHLIST'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Watchlist ({summary?.watchlistCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('HIGH_CONVICTION')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                sourceFilter === 'HIGH_CONVICTION'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              High Conviction (75+)
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('DEEP_VALUE')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                sourceFilter === 'DEEP_VALUE'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Deep Value (75+)
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('QUALITY_KINGS')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                sourceFilter === 'QUALITY_KINGS'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Quality Kings (80+)
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

        {/* Second Row: Search, Sector Selector & Sort */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search ticker or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-xs bg-card/80 border-border/60"
            />
          </div>

          {/* Sector & Sort Dropdowns */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
            {/* Sector Selector */}
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="h-9 px-3 text-xs bg-card/80 border border-border/60 rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Sectors ({sectors.length})</option>
              {sectors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 px-3 text-xs bg-card/80 border border-border/60 rounded-xl text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="OVERALL">Sort: Overall Conviction</option>
              <option value="BUYING">Sort: Buying Conviction</option>
              <option value="FUNDAMENTALS">Sort: Fundamentals Quality</option>
              <option value="VALUATION">Sort: Valuation Score</option>
              <option value="UPSIDE">Sort: Target Upside %</option>
              <option value="MARKET_CAP">Sort: Market Cap</option>
              <option value="CHANGE">Sort: Day Return %</option>
            </select>
          </div>
        </div>
      </div>

      {/* ================= SCORECARDS LISTING ================= */}
      {isLoading ? (
        <div className="p-20 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-3">
          <ShieldCheck className="w-10 h-10 text-primary animate-pulse" />
          <span>Computing institutional multi-factor scorecards...</span>
        </div>
      ) : filteredScorecards.length === 0 ? (
        <div className="p-16 text-center text-sm text-muted-foreground bg-card/40 rounded-2xl border border-border/40 space-y-2">
          <p className="font-bold text-foreground">No scorecards match the selected filter criteria.</p>
          <p className="text-xs">Try resetting search filters or selecting 'All Stocks'.</p>
          <Button variant="outline" size="sm" onClick={() => { setSourceFilter('ALL'); setSelectedSector('ALL'); setSearchQuery(''); }} className="mt-2 text-xs font-bold">
            Reset Filters
          </Button>
        </div>
      ) : viewMode === 'GRID' ? (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredScorecards.map((card) => {
            const isPos = card.changePercent >= 0;
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
                            {card.isHolding && (
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[8px] px-1 py-0 uppercase">
                                Holding
                              </Badge>
                            )}
                            {card.isWatchlist && (
                              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[8px] px-1 py-0 uppercase">
                                Watchlist
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                            {card.name}
                          </p>
                        </div>
                      </div>

                      {/* Overall Conviction Score Meter */}
                      <div className={cn("px-2.5 py-1 rounded-xl border flex flex-col items-center justify-center font-mono shrink-0", getScoreRingClass(card.overallScore))}>
                        <span className="text-base font-black leading-tight">{card.overallScore}</span>
                        <span className="text-[8px] uppercase font-bold opacity-80">Score</span>
                      </div>
                    </div>

                    {/* Price & Subtitle */}
                    <div className="flex items-center justify-between text-xs font-mono pt-1">
                      <span className="font-bold text-foreground">${card.price.toFixed(2)}</span>
                      <span className={cn("font-bold flex items-center gap-0.5", isPos ? "text-emerald-400" : "text-rose-400")}>
                        {isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {isPos ? '+' : ''}{card.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </CardHeader>

                  {/* Card Body with Tri-Metric Progress */}
                  <CardContent className="p-4 space-y-3">
                    {/* Tri-factor Progress Rows */}
                    <div className="space-y-1.5 text-[11px] font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-sans flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Buying Conviction
                        </span>
                        <span className="font-bold text-emerald-400">{card.buyingConvictionScore}/100</span>
                      </div>
                      <Progress value={card.buyingConvictionScore} className="h-1 bg-emerald-950/40" />

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-muted-foreground font-sans flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> Fundamentals Quality
                        </span>
                        <span className="font-bold text-teal-400">{card.fundamentalsScore}/100</span>
                      </div>
                      <Progress value={card.fundamentalsScore} className="h-1 bg-teal-950/40" />

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-muted-foreground font-sans flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Valuation Posture
                        </span>
                        <span className="font-bold text-indigo-400">{card.valuationScore}/100</span>
                      </div>
                      <Progress value={card.valuationScore} className="h-1 bg-indigo-950/40" />
                    </div>

                    {/* Key Metric Chips */}
                    <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px] pt-1">
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
                  <Badge variant="outline" className={cn("text-[9px] font-mono font-bold", getScoreBadgeStyle(card.overallScore))}>
                    {card.gradeLabel}
                  </Badge>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenCompare([card.symbol])}
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                      title="Compare stock"
                    >
                      <Scale className="w-3 h-3" />
                    </Button>
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
        /* DENSE DATA TABLE VIEW */
        <div className="rounded-2xl border border-border/60 overflow-hidden bg-card/60 backdrop-blur-xl shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-accent/30 border-b border-border/60 font-sans text-muted-foreground text-[10px] uppercase">
                  <th className="p-3.5 font-bold">Asset</th>
                  <th className="p-3.5 font-bold text-center">Price & Return</th>
                  <th className="p-3.5 font-bold text-center">Overall Score</th>
                  <th className="p-3.5 font-bold text-center">Buying Conviction</th>
                  <th className="p-3.5 font-bold text-center">Quality / Fund.</th>
                  <th className="p-3.5 font-bold text-center">Valuation</th>
                  <th className="p-3.5 font-bold text-center">Forward P/E</th>
                  <th className="p-3.5 font-bold text-center">Op. Margin</th>
                  <th className="p-3.5 font-bold text-center">Fair Upside</th>
                  <th className="p-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {filteredScorecards.map((c) => {
                  const isPos = c.changePercent >= 0;
                  return (
                    <tr key={c.symbol} className="hover:bg-accent/20 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground block">{c.symbol}</span>
                          {c.isHolding && (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[8px] px-1 py-0 uppercase">
                              Held
                            </Badge>
                          )}
                          {c.isWatchlist && (
                            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[8px] px-1 py-0 uppercase">
                              Watch
                            </Badge>
                          )}
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
                        <span className={cn("text-sm font-black px-2 py-0.5 rounded-lg border", getScoreRingClass(c.overallScore))}>
                          {c.overallScore}
                        </span>
                      </td>

                      <td className="p-3 text-center font-bold text-emerald-400">
                        {c.buyingConvictionScore}/100
                      </td>

                      <td className="p-3 text-center font-bold text-teal-400">
                        {c.fundamentalsScore}/100
                      </td>

                      <td className="p-3 text-center font-bold text-indigo-400">
                        {c.valuationScore}/100
                      </td>

                      <td className="p-3 text-center text-foreground">
                        {c.metrics.forwardPE ? `${c.metrics.forwardPE}x` : 'N/A'}
                      </td>

                      <td className="p-3 text-center text-foreground">
                        {c.metrics.operatingMarginPct != null ? `${c.metrics.operatingMarginPct}%` : 'N/A'}
                      </td>

                      <td className="p-3 text-center font-bold text-emerald-400">
                        +{c.metrics.upsideToFairValuePct}%
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1 font-sans">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetail(c)}
                            className="h-7 text-xs font-bold text-primary hover:bg-primary/10 px-2"
                          >
                            Scorecard
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenCompare([c.symbol])}
                            className="h-7 text-xs px-1.5 text-muted-foreground hover:text-foreground"
                            title="Compare"
                          >
                            <Scale className="w-3.5 h-3.5" />
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
        />
      )}

      <ScorecardCompareModal
        initialSymbols={compareSymbols}
        allAvailableSymbols={rawScorecards.map((s) => s.symbol)}
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        onNavigateToResearch={onNavigateToResearch}
      />
    </div>
  );
}
