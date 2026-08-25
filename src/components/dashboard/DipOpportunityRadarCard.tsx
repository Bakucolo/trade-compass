import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Flame,
  Zap,
  ShieldCheck,
  ShieldAlert,
  ArrowDownRight,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Activity,
  Layers,
  Scale,
  Database,
  History,
  AlertTriangle,
  Target,
  BarChart3,
  DollarSign,
  PieChart,
  Info,
  Bookmark,
  FolderPlus,
  ListPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDipRadar, useSavedDipReports, DipCandidateItem, BuyScoreBreakdown } from '@/services/dipRadarService';
import { DipDiagnosticModal } from './DipDiagnosticModal';
import { AddToWatchlistModal } from '@/components/AddToWatchlistModal';
import { BulkSaveDipsToWatchlistModal } from './BulkSaveDipsToWatchlistModal';

type FilterTab = 'ALL' | 'SAVED' | 'HOLDINGS' | 'WATCHLIST' | 'HIGH_SCORE';
type SensitivityFilter = 'ALL' | 'DAY_DROP' | 'DEEP_PULLBACK';
type SortOption = 'BUY_SCORE' | 'DAY_DROP' | 'DRAWDOWN';

interface DipOpportunityRadarCardProps {
  onNavigateToPortfolio?: () => void;
  onNavigateToWatchlist?: () => void;
  onNavigateToResearch?: (symbol: string) => void;
}

export function getBuyScoreDetails(score: number) {
  if (score >= 85) {
    return {
      tier: 'Strong Conviction',
      badgeClass: 'text-emerald-300 bg-emerald-500/20 border-emerald-500/50 shadow-sm shadow-emerald-500/10',
      pillClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      borderGlow: 'hover:border-emerald-500/60',
      dotColor: 'bg-emerald-400 animate-pulse',
      desc: 'High asymmetric upside with pristine fundamentals & margin of safety',
    };
  }
  if (score >= 70) {
    return {
      tier: 'Quality Dip',
      badgeClass: 'text-teal-300 bg-teal-500/20 border-teal-500/50',
      pillClass: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
      borderGlow: 'hover:border-teal-500/60',
      dotColor: 'bg-teal-400',
      desc: 'Solid risk/reward pullback in durable business model',
    };
  }
  if (score >= 55) {
    return {
      tier: 'Moderate Opportunity',
      badgeClass: 'text-cyan-300 bg-cyan-500/20 border-cyan-500/50',
      pillClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      borderGlow: 'hover:border-cyan-500/60',
      dotColor: 'bg-cyan-400',
      desc: 'Reasonable valuation; tranche accumulation recommended',
    };
  }
  if (score >= 40) {
    return {
      tier: 'Neutral Base',
      badgeClass: 'text-amber-300 bg-amber-500/20 border-amber-500/50',
      pillClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      borderGlow: 'hover:border-amber-500/60',
      dotColor: 'bg-amber-400',
      desc: 'Mixed indicators; wait for support consolidation',
    };
  }
  return {
    tier: 'Elevated Risk',
    badgeClass: 'text-rose-300 bg-rose-500/20 border-rose-500/50',
    pillClass: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    borderGlow: 'hover:border-rose-500/60',
    dotColor: 'bg-rose-400',
    desc: 'Potential falling knife or structural impairment warning',
  };
}

export function DipOpportunityRadarCard({
  onNavigateToPortfolio,
  onNavigateToWatchlist,
  onNavigateToResearch,
}: DipOpportunityRadarCardProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [sensitivity, setSensitivity] = useState<SensitivityFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('BUY_SCORE');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSymbolForModal, setSelectedSymbolForModal] = useState<string | null>(null);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [watchlistTargetStock, setWatchlistTargetStock] = useState<{ symbol: string; name?: string } | null>(null);
  const [isBulkSaveModalOpen, setIsBulkSaveModalOpen] = useState(false);

  // Fetch Radar scan data
  const { data: radarData, isLoading, isFetching, refetch } = useDipRadar();
  // Fetch Saved Reports data
  const { data: savedReports = [], refetch: refetchSaved } = useSavedDipReports(50);

  const dips = radarData?.dips || [];
  const benchmarks = radarData?.benchmarks;

  // Filter & sort dips
  const filteredDips = useMemo(() => {
    const list = dips.filter((item) => {
      const oppScore = item.savedReportInfo?.opportunityScore ?? item.heuristicSignal.preliminaryOpportunityScore;

      // Tab filter
      if (activeTab === 'SAVED' && !item.savedReportInfo) return false;
      if (activeTab === 'HOLDINGS' && item.source !== 'HOLDING') return false;
      if (activeTab === 'WATCHLIST' && item.source !== 'WATCHLIST') return false;
      if (activeTab === 'HIGH_SCORE' && oppScore < 70) return false;

      // Sensitivity filter
      if (sensitivity === 'DAY_DROP' && item.dayChangePercent > -2.0) return false;
      if (sensitivity === 'DEEP_PULLBACK' && item.distanceFrom52WHigh > -15.0) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sym = item.symbol.toLowerCase();
        const name = (item.name || '').toLowerCase();
        return sym.includes(q) || name.includes(q);
      }

      return true;
    });

    return list.sort((a, b) => {
      const scoreA = a.savedReportInfo?.opportunityScore ?? a.heuristicSignal.preliminaryOpportunityScore;
      const scoreB = b.savedReportInfo?.opportunityScore ?? b.heuristicSignal.preliminaryOpportunityScore;

      if (sortBy === 'BUY_SCORE') {
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.dayChangePercent - b.dayChangePercent;
      }
      if (sortBy === 'DAY_DROP') {
        return a.dayChangePercent - b.dayChangePercent;
      }
      if (sortBy === 'DRAWDOWN') {
        return a.distanceFrom52WHigh - b.distanceFrom52WHigh;
      }
      return 0;
    });
  }, [dips, activeTab, sensitivity, sortBy, searchQuery]);

  const savedDipsCount = useMemo(() => dips.filter(d => Boolean(d.savedReportInfo)).length, [dips]);
  const holdingsDipCount = useMemo(() => dips.filter(d => d.source === 'HOLDING').length, [dips]);
  const watchlistDipCount = useMemo(() => dips.filter(d => d.source === 'WATCHLIST').length, [dips]);
  const highScoreCount = useMemo(() => {
    return dips.filter(d => {
      const score = d.savedReportInfo?.opportunityScore ?? d.heuristicSignal.preliminaryOpportunityScore;
      return score >= 70;
    }).length;
  }, [dips]);

  const handleRescan = () => {
    refetch();
    refetchSaved();
  };

  const toggleFactorExpand = (sym: string) => {
    setExpandedSymbol(prev => (prev === sym ? null : sym));
  };

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-md shadow-xl overflow-hidden relative">
      {/* Decorative top accent glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500" />

      {/* ================= CARD HEADER ================= */}
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 via-indigo-500/20 to-emerald-500/20 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <span>AI Dip & Opportunity Radar</span>
                </CardTitle>
                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] font-mono font-bold">
                  {dips.length} Dips Detected
                </Badge>
                {savedReports.length > 0 && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                    <Database className="w-2.5 h-2.5" />
                    <span>{savedReports.length} Saved in DB</span>
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Multi-pillar quantitative & fundamental buy score engine across Holdings & Watchlists.
              </p>
            </div>
          </div>

          {/* Benchmark context & Refresh */}
          <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
            {benchmarks && (
              <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono bg-card/80 border border-border/70 rounded-lg px-2.5 py-1">
                <span className="text-muted-foreground">Market:</span>
                <span className={cn(benchmarks.spy.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                  SPY {benchmarks.spy.changePercent >= 0 ? '+' : ''}{benchmarks.spy.changePercent.toFixed(2)}%
                </span>
                <span className="text-muted-foreground">•</span>
                <span className={cn(benchmarks.qqq.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                  QQQ {benchmarks.qqq.changePercent >= 0 ? '+' : ''}{benchmarks.qqq.changePercent.toFixed(2)}%
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-amber-400">
                  VIX {benchmarks.vix.price.toFixed(1)}
                </span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkSaveModalOpen(true)}
              disabled={dips.length === 0}
              className="h-8 text-xs gap-1.5 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 bg-purple-950/20 shadow-sm"
              title="Save selected radar dips into a watchlist"
            >
              <Bookmark className="w-3.5 h-3.5 text-purple-400" />
              <span>Save Dips to Watchlist</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRescan}
              disabled={isLoading || isFetching}
              className="h-8 text-xs gap-1.5 border-border/70 hover:bg-accent/40"
              title="Rescan Holdings and Watchlists"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', (isLoading || isFetching) && 'animate-spin')} />
              <span className="hidden sm:inline">Rescan</span>
            </Button>
          </div>
        </div>

        {/* Filter & Sort Controls Bar */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 pt-3">
          {/* Tab Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={activeTab === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('ALL')}
              className={cn('h-7 text-xs px-2.5 font-semibold', activeTab === 'ALL' ? 'bg-primary text-primary-foreground' : 'border-border/70 text-muted-foreground')}
            >
              All Dips ({dips.length})
            </Button>

            <Button
              variant={activeTab === 'HIGH_SCORE' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('HIGH_SCORE')}
              className={cn('h-7 text-xs px-2.5 font-semibold gap-1', activeTab === 'HIGH_SCORE' ? 'bg-indigo-600 text-white' : 'border-border/70 text-indigo-400')}
            >
              <Flame className="w-3 h-3 text-amber-300" />
              High Buy Score ({highScoreCount})
            </Button>

            <Button
              variant={activeTab === 'SAVED' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('SAVED')}
              className={cn(
                'h-7 text-xs px-2.5 font-semibold gap-1',
                activeTab === 'SAVED'
                  ? 'bg-emerald-600 text-white'
                  : 'border-border/70 text-emerald-400'
              )}
            >
              <Database className="w-3 h-3" />
              Saved Reports ({savedDipsCount || savedReports.length})
            </Button>

            <Button
              variant={activeTab === 'HOLDINGS' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('HOLDINGS')}
              className={cn('h-7 text-xs px-2.5 font-semibold', activeTab === 'HOLDINGS' ? 'bg-primary text-primary-foreground' : 'border-border/70 text-muted-foreground')}
            >
              Holdings ({holdingsDipCount})
            </Button>

            <Button
              variant={activeTab === 'WATCHLIST' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('WATCHLIST')}
              className={cn('h-7 text-xs px-2.5 font-semibold', activeTab === 'WATCHLIST' ? 'bg-primary text-primary-foreground' : 'border-border/70 text-muted-foreground')}
            >
              Watchlist ({watchlistDipCount})
            </Button>
          </div>

          {/* Sort & Sensitivity Filters */}
          <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-7 text-xs bg-background/80 border border-border/70 rounded-md px-2 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            >
              <option value="BUY_SCORE">Sort: Highest Buy Score</option>
              <option value="DAY_DROP">Sort: Deepest Day Drop</option>
              <option value="DRAWDOWN">Sort: 52W Drawdown</option>
            </select>

            {/* Sensitivity Selector */}
            <select
              value={sensitivity}
              onChange={(e) => setSensitivity(e.target.value as SensitivityFilter)}
              className="h-7 text-xs bg-background/80 border border-border/70 rounded-md px-2 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">Sensitivity: All Pullbacks</option>
              <option value="DAY_DROP">Day Drop &le; -2%</option>
              <option value="DEEP_PULLBACK">Drawdown &ge; 15% from High</option>
            </select>
          </div>
        </div>
      </CardHeader>

      {/* ================= CARD CONTENT ================= */}
      <CardContent className="p-4 pt-3">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">
              Scanning all portfolio holdings and watchlists with multi-factor valuation engine...
            </p>
          </div>
        ) : filteredDips.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-70" />
            <p className="text-sm font-semibold text-foreground">
              {activeTab === 'SAVED' ? 'No Saved Reports Yet' : 'No Pullbacks Match Current Criteria'}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {activeTab === 'SAVED'
                ? 'Run an AI diagnosis on any dip candidate to save its full institutional report to the database.'
                : 'Try adjusting the sensitivity or tab filters to see all dipping assets.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[520px] overflow-y-auto pr-1">
            {filteredDips.slice(0, 16).map((item) => {
              const isVolatility = item.heuristicSignal.potentialDriver === 'LIKELY_VOLATILITY' || item.heuristicSignal.potentialDriver === 'MARKET_WIDE_CORRECTION';
              const oppScore = item.savedReportInfo?.opportunityScore ?? item.heuristicSignal.preliminaryOpportunityScore;
              const hasSavedReport = Boolean(item.savedReportInfo);
              const scoreTier = getBuyScoreDetails(oppScore);
              const breakdown = item.scoreBreakdown;
              const isExpanded = expandedSymbol === item.symbol;

              return (
                <div
                  key={item.symbol}
                  className={cn(
                    'group rounded-xl border transition-all p-3.5 flex flex-col justify-between gap-3 relative shadow-sm',
                    hasSavedReport
                      ? 'bg-emerald-950/10 border-emerald-500/40 hover:border-emerald-500/60'
                      : 'bg-card/40 border-border/60 hover:bg-card/75',
                    scoreTier.borderGlow
                  )}
                >
                  {/* Top Bar: Symbol, Name, Badges & Price */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/10 to-indigo-500/10 border border-primary/20 flex items-center justify-center text-foreground font-black text-xs font-mono shadow-inner">
                        {item.symbol.slice(0, 4)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                            {item.symbol}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[9px] px-1.5 py-0 font-semibold',
                              item.source === 'HOLDING' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' :
                              'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                            )}
                          >
                            {item.source === 'HOLDING' ? 'Holding' : 'Watchlist'}
                          </Badge>

                          {hasSavedReport && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 font-semibold bg-emerald-500/15 text-emerald-300 border-emerald-500/40 flex items-center gap-1"
                              title={`Saved report from ${new Date(item.savedReportInfo!.analyzedAt).toLocaleDateString()}`}
                            >
                              <Database className="w-2.5 h-2.5 text-emerald-400" />
                              <span>Saved</span>
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[160px]" title={item.name}>
                          {item.name}
                        </div>
                      </div>
                    </div>

                    {/* Price & Day Change */}
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-foreground">
                        ${item.currentPrice.toFixed(2)}
                      </div>
                      <div className={cn(
                        'flex items-center justify-end gap-0.5 text-[11px] font-mono font-medium',
                        item.dayChangePercent < 0 ? 'text-rose-400' : 'text-emerald-400'
                      )}>
                        {item.dayChangePercent < 0 ? <ArrowDownRight className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        <span>{item.dayChangePercent >= 0 ? '+' : ''}{item.dayChangePercent.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Mid Bar: Dynamic Buy Score & Telemetry Pills */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs flex-wrap">
                    {/* Driver & Drawdown */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-semibold gap-1 py-0 px-1.5',
                          isVolatility
                            ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        )}
                      >
                        {isVolatility ? <Zap className="w-2.5 h-2.5 text-indigo-400" /> : <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />}
                        {isVolatility ? 'Market Beta' : 'Fundamental'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {item.distanceFrom52WHigh.toFixed(1)}% from High
                      </span>
                    </div>

                    {/* Institutional Buy Score Pill with Expand Trigger */}
                    <button
                      onClick={() => toggleFactorExpand(item.symbol)}
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs font-mono font-bold transition-transform active:scale-95 cursor-pointer',
                        scoreTier.badgeClass
                      )}
                      title={`${scoreTier.tier} — Click to view factor breakdown`}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full', scoreTier.dotColor)} />
                      <span className="text-[10px] font-sans font-semibold opacity-90">{scoreTier.tier}:</span>
                      <span className="text-xs font-black">{oppScore}</span>
                      <span className="text-[9px] opacity-70">/100</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3 opacity-70 ml-0.5" /> : <ChevronDown className="w-3 h-3 opacity-70 ml-0.5" />}
                    </button>
                  </div>

                  {/* Factor Highlights (Target Upside, FCF, 50D SMA, P/E) */}
                  {breakdown && breakdown.highlightBadges && breakdown.highlightBadges.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {breakdown.highlightBadges.map((badgeText, bIdx) => (
                        <Badge
                          key={bIdx}
                          variant="outline"
                          className={cn(
                            'text-[9px] px-1.5 py-0 font-mono font-medium',
                            badgeText.startsWith('Target') ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                            badgeText.startsWith('FCF') ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' :
                            badgeText.includes('50-Day') ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' :
                            'bg-muted/40 text-muted-foreground border-border/60'
                          )}
                        >
                          {badgeText}
                        </Badge>
                      ))}

                      {breakdown.valuationGrade && (
                        <span className="text-[9px] text-muted-foreground font-mono ml-auto">
                          {breakdown.valuationGrade.replace('_', ' ')} • {breakdown.fundamentalGrade}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expandable 5-Pillar Score Breakdown Drawer */}
                  {isExpanded && breakdown && (
                    <div className="p-2.5 rounded-lg bg-background/80 border border-border/60 text-xs space-y-2 animate-in fade-in-50 duration-200">
                      <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
                        <span className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3 text-primary" />
                          <span>5-Pillar Institutional Scoring</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Score: {oppScore}/100
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                        {/* 1. Valuation */}
                        <div className="p-1.5 rounded bg-muted/20 border border-border/40">
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>Valuation & Safety:</span>
                            <span className="font-bold text-foreground">{breakdown.valuationScore}/25</span>
                          </div>
                          <div className="text-[9px] text-primary truncate mt-0.5">
                            {breakdown.targetUpsidePercent !== null ? `Upside: +${breakdown.targetUpsidePercent}%` : breakdown.forwardPE ? `Fwd P/E: ${breakdown.forwardPE}x` : 'Fair Multiple'}
                          </div>
                        </div>

                        {/* 2. Fundamental Quality */}
                        <div className="p-1.5 rounded bg-muted/20 border border-border/40">
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>Fundamentals:</span>
                            <span className="font-bold text-foreground">{breakdown.fundamentalScore}/25</span>
                          </div>
                          <div className="text-[9px] text-emerald-400 truncate mt-0.5">
                            {breakdown.freeCashflow && breakdown.freeCashflow > 0 ? 'Positive FCF Moat' : 'Solvent Balance Sheet'}
                          </div>
                        </div>

                        {/* 3. Technical Confluence */}
                        <div className="p-1.5 rounded bg-muted/20 border border-border/40">
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>Technicals & MA:</span>
                            <span className="font-bold text-foreground">{breakdown.technicalScore}/20</span>
                          </div>
                          <div className="text-[9px] text-indigo-300 truncate mt-0.5">
                            {breakdown.technicalSetup.replace(/_/g, ' ')}
                          </div>
                        </div>

                        {/* 4. Volume Driver & Sizing */}
                        <div className="p-1.5 rounded bg-muted/20 border border-border/40">
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>Driver & Fit:</span>
                            <span className="font-bold text-foreground">{breakdown.driverScore + breakdown.portfolioFitScore}/30</span>
                          </div>
                          <div className="text-[9px] text-cyan-300 truncate mt-0.5">
                            {item.holdingPosition ? 'Held DCA Position' : 'Fresh Watchlist Entry'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons & Holding Summary */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30">
                    {item.holdingPosition ? (
                      <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                        Held: {item.holdingPosition.quantity} @ ${item.holdingPosition.averageCost.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                        {item.sector || 'Equities'}
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      {/* Save to Watchlist Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setWatchlistTargetStock({ symbol: item.symbol, name: item.name });
                        }}
                        className="h-7 px-2 text-[10px] font-semibold text-muted-foreground hover:text-purple-300 hover:bg-purple-500/10 gap-1"
                        title={`Save ${item.symbol} to a watchlist`}
                      >
                        <Bookmark className="w-3 h-3 text-purple-400" />
                        <span className="hidden sm:inline">+Watchlist</span>
                      </Button>

                      {onNavigateToResearch && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onNavigateToResearch(item.symbol)}
                          className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                          title="Open in Research"
                        >
                          Research
                        </Button>
                      )}

                      {/* Main Button: "View Saved Report" if already in DB, or "AI Diagnose" if fresh */}
                      {hasSavedReport ? (
                        <Button
                          size="sm"
                          onClick={() => setSelectedSymbolForModal(item.symbol)}
                          className="h-7 px-2.5 text-[11px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                          title="View saved diagnostic report (instant DB lookup)"
                        >
                          <Database className="w-3 h-3 text-emerald-200" />
                          View Saved Report
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setSelectedSymbolForModal(item.symbol)}
                          className="h-7 px-2.5 text-[11px] font-bold gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-sm"
                        >
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          AI Diagnose
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Summary / Quick Action */}
        {dips.length > 0 && (
          <div className="mt-3 pt-2 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center text-xs text-muted-foreground gap-2">
            <span>
              Showing {filteredDips.length} of {dips.length} pullbacks • Sorted by {sortBy === 'BUY_SCORE' ? 'Highest Buy Score' : sortBy === 'DAY_DROP' ? 'Day Drop' : '52W Drawdown'}.
            </span>
            <div className="flex items-center gap-2">
              {onNavigateToPortfolio && (
                <button
                  onClick={onNavigateToPortfolio}
                  className="text-primary hover:underline font-semibold inline-flex items-center gap-1 text-xs"
                >
                  View Holdings <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Deep AI Diagnostic Modal */}
      {selectedSymbolForModal && (
        <DipDiagnosticModal
          isOpen={Boolean(selectedSymbolForModal)}
          onClose={() => setSelectedSymbolForModal(null)}
          symbol={selectedSymbolForModal}
          onNavigateToResearch={onNavigateToResearch}
        />
      )}

      {/* Single Stock Add To Watchlist Modal */}
      {watchlistTargetStock && (
        <AddToWatchlistModal
          isOpen={Boolean(watchlistTargetStock)}
          onClose={() => setWatchlistTargetStock(null)}
          symbol={watchlistTargetStock.symbol}
          companyName={watchlistTargetStock.name}
        />
      )}

      {/* Bulk Save Dips to Watchlist Modal */}
      <BulkSaveDipsToWatchlistModal
        isOpen={isBulkSaveModalOpen}
        onClose={() => setIsBulkSaveModalOpen(false)}
        dips={filteredDips}
      />
    </Card>
  );
}
