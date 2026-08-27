import React, { useState, useMemo } from 'react';
import {
  Filter,
  Search,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Globe,
  Layers,
  ArrowUpDown,
  RefreshCw,
  FolderPlus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  DollarSign,
  PieChart,
  Percent,
  Activity,
  Zap,
  Award,
  Shield,
  Flame,
  Check,
  X,
  Plus,
  Loader2,
  Bell,
  LineChart,
  NotebookPen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ScannerCriteria,
  ScannedStockResult,
  useScanner,
  useScannerMeta,
} from '@/services/stockScannerService';
import { useWatchlists, useBulkCreateWatchlist } from '@/services/watchlistService';
import { PriceAlertModal } from './PriceAlertModal';

interface ScannerPageProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
  onNavigateToLog?: () => void;
  onNavigateToWatchlist?: () => void;
}

const PRESET_STRATEGIES: Array<{
  id: string;
  name: string;
  shortDesc: string;
  icon: React.ElementType;
  color: string;
  criteria: Partial<ScannerCriteria>;
}> = [
  {
    id: 'quality_compounders',
    name: '💎 Quality Compounders',
    shortDesc: 'High ROE (>15%), Margins (>20%), Low Debt (<80% D/E)',
    icon: Award,
    color: 'emerald',
    criteria: {
      minRoe: 15,
      minOperatingMargin: 20,
      maxDebtToEquity: 80,
      maxPe: 40,
    },
  },
  {
    id: 'hypergrowth_breakouts',
    name: '🚀 Hyper-Growth Tech',
    shortDesc: 'Above 50 & 200 DMA, Tech/AI leaders with strong momentum',
    icon: TrendingUp,
    color: 'purple',
    criteria: {
      sectors: ['Technology', 'Communication Services'],
      movingAverageCondition: 'ABOVE_50DMA',
      minDayChange: -2,
    },
  },
  {
    id: 'deep_value',
    name: '🏷️ Deep Value Turnarounds',
    shortDesc: 'P/E < 18, Drawdown > 15% from highs, profitable margins',
    icon: Shield,
    color: 'rose',
    criteria: {
      maxPe: 18,
      minOperatingMargin: 5,
      maxDistance52wHigh: -15,
    },
  },
  {
    id: 'dividend_aristocrats',
    name: '💰 Dividend & Cash Flow',
    shortDesc: 'Yield > 2.2%, Margins > 15%, Moderate Leverage',
    icon: DollarSign,
    color: 'amber',
    criteria: {
      minDividendYield: 2.2,
      minOperatingMargin: 15,
      maxDebtToEquity: 120,
    },
  },
  {
    id: 'oversold_dip',
    name: '🌊 Oversold Dip-Buy',
    shortDesc: 'Distance from 52W High < -15%, RSI Oversold/Low',
    icon: Activity,
    color: 'cyan',
    criteria: {
      maxDistance52wHigh: -15,
      rsiCondition: 'OVERSOLD',
    },
  },
  {
    id: 'ai_power_grid',
    name: '⚡ AI & Clean Power Grid',
    shortDesc: 'Semis, Datacenters, Nuclear & Grid Infrastructure',
    icon: Zap,
    color: 'yellow',
    criteria: {
      themes: ['AI & Compute', 'Nuclear Energy', 'Clean Grid', 'Semiconductors'],
    },
  },
];

type SortField =
  | 'symbol'
  | 'price'
  | 'changePercent'
  | 'marketCap'
  | 'pe'
  | 'operatingMargin'
  | 'roe'
  | 'dividendYield'
  | 'distance52wHighPercent';

export function ScannerPage({
  onNavigateToResearch,
  onNavigateToGraphs,
  onNavigateToLog,
  onNavigateToWatchlist,
}: ScannerPageProps) {
  // Criteria State
  const [criteria, setCriteria] = useState<ScannerCriteria>({
    search: '',
    sectors: [],
    themes: [],
    marketCapTier: 'ALL',
    minPe: undefined,
    maxPe: undefined,
    minOperatingMargin: undefined,
    minRoe: undefined,
    maxDebtToEquity: undefined,
    minDividendYield: undefined,
    minDayChange: undefined,
    maxDayChange: undefined,
    minDistance52wHigh: undefined,
    maxDistance52wHigh: undefined,
    movingAverageCondition: 'ALL',
    rsiCondition: 'ALL',
    sortBy: 'marketCap',
    sortDirection: 'desc',
    limit: 100,
  });

  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [isFilterDeckOpen, setIsFilterDeckOpen] = useState(true);

  // Queries
  const { data: scannerData, isLoading, isRefetching, refetch } = useScanner(criteria);
  const { data: metaData } = useScannerMeta();
  const { data: watchlists = [] } = useWatchlists();
  const bulkCreateWatchlistMutation = useBulkCreateWatchlist();

  // Price Alert Modal
  const [alertModalStock, setAlertModalStock] = useState<{ symbol: string; price: number; name: string } | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  const results = scannerData?.results || [];

  // Apply Preset Strategy
  const handleApplyPreset = (preset: typeof PRESET_STRATEGIES[0]) => {
    if (activePresetId === preset.id) {
      // Toggle off
      setActivePresetId(null);
      handleResetFilters();
    } else {
      setActivePresetId(preset.id);
      setCriteria((prev) => ({
        ...prev,
        ...preset.criteria,
        search: '',
      }));
      toast.success(`Applied "${preset.name}" criteria preset!`);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setActivePresetId(null);
    setCriteria({
      search: '',
      sectors: [],
      themes: [],
      marketCapTier: 'ALL',
      minPe: undefined,
      maxPe: undefined,
      minOperatingMargin: undefined,
      minRoe: undefined,
      maxDebtToEquity: undefined,
      minDividendYield: undefined,
      minDayChange: undefined,
      maxDayChange: undefined,
      minDistance52wHigh: undefined,
      maxDistance52wHigh: undefined,
      movingAverageCondition: 'ALL',
      rsiCondition: 'ALL',
      sortBy: 'marketCap',
      sortDirection: 'desc',
      limit: 100,
    });
    toast.info('Reset all scanner filters to default.');
  };

  // Sort Handler
  const handleSort = (field: SortField) => {
    setCriteria((prev) => ({
      ...prev,
      sortBy: field,
      sortDirection: prev.sortBy === field && prev.sortDirection === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Toggle Sector
  const toggleSector = (sector: string) => {
    setCriteria((prev) => {
      const current = prev.sectors || [];
      const updated = current.includes(sector)
        ? current.filter((s) => s !== sector)
        : [...current, sector];
      return { ...prev, sectors: updated };
    });
  };

  // Toggle Theme
  const toggleTheme = (theme: string) => {
    setCriteria((prev) => {
      const current = prev.themes || [];
      const updated = current.includes(theme)
        ? current.filter((t) => t !== theme)
        : [...current, theme];
      return { ...prev, themes: updated };
    });
  };

  // Save All Filtered Results as a New Watchlist
  const handleSaveToWatchlist = async () => {
    if (results.length === 0) {
      toast.error('No matched stocks to save.');
      return;
    }

    const presetName = PRESET_STRATEGIES.find((p) => p.id === activePresetId)?.name.replace(/[^a-zA-Z0-9 &]/g, '').trim();
    const defaultName = presetName ? `Scanner: ${presetName}` : `Scanner Matches (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;

    try {
      const symbols = results.map((r) => r.symbol);
      const created = await bulkCreateWatchlistMutation.mutateAsync({
        name: defaultName,
        symbols,
      });

      toast.success(`Created Watchlist "${created.name}" with ${symbols.length} stocks!`, {
        action: {
          label: 'View Watchlist',
          onClick: () => onNavigateToWatchlist?.(),
        },
      });
    } catch (err: any) {
      toast.error(`Failed to create watchlist: ${err.message}`);
    }
  };

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (criteria.search) count++;
    if (criteria.sectors && criteria.sectors.length > 0) count += criteria.sectors.length;
    if (criteria.themes && criteria.themes.length > 0) count += criteria.themes.length;
    if (criteria.marketCapTier && criteria.marketCapTier !== 'ALL') count++;
    if (criteria.minPe !== undefined || criteria.maxPe !== undefined) count++;
    if (criteria.minOperatingMargin !== undefined) count++;
    if (criteria.minRoe !== undefined) count++;
    if (criteria.maxDebtToEquity !== undefined) count++;
    if (criteria.minDividendYield !== undefined) count++;
    if (criteria.minDayChange !== undefined || criteria.maxDayChange !== undefined) count++;
    if (criteria.minDistance52wHigh !== undefined || criteria.maxDistance52wHigh !== undefined) count++;
    if (criteria.movingAverageCondition && criteria.movingAverageCondition !== 'ALL') count++;
    if (criteria.rsiCondition && criteria.rsiCondition !== 'ALL') count++;
    return count;
  }, [criteria]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* ================= 1. HEADER RIBBON ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-primary/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
            <Filter className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground glow-text-white">
                Multi-Factor Stock Scanner
              </h1>
              <Badge variant="outline" className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30 text-[10px] font-mono uppercase font-bold">
                {scannerData?.totalUniverseSize || 95} Equities Scanned
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Screen the market universe across fundamental valuation ratios, margin health, technical moving averages, RSI, and secular themes.
            </p>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            className="gap-1.5 h-9"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", (isRefetching || isLoading) && "animate-spin text-primary")} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetFilters}
            className="gap-1.5 h-9 border-border/60 hover:bg-accent/40 text-xs font-bold"
          >
            <RotateCcwIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Reset Filters</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSaveToWatchlist}
            disabled={results.length === 0 || bulkCreateWatchlistMutation.isPending}
            className="h-9 gap-1.5 bg-gradient-to-r from-primary via-purple-600 to-indigo-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-bold text-xs shadow-md shadow-primary/20"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Save ({results.length}) to Watchlist</span>
          </Button>
        </div>
      </div>

      {/* ================= 2. INSTITUTIONAL STRATEGY PRESETS ================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-sans">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            1-Click Institutional Strategy Presets
          </span>
          {activePresetId && (
            <button
              onClick={handleResetFilters}
              className="text-[11px] font-mono text-primary hover:underline flex items-center gap-1"
            >
              Clear Active Preset <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {PRESET_STRATEGIES.map((preset) => {
            const isSelected = activePresetId === preset.id;
            const Icon = preset.icon;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={cn(
                  "p-3 rounded-2xl border text-left transition-all space-y-1 relative group overflow-hidden flex flex-col justify-between",
                  isSelected
                    ? "bg-primary/20 border-primary/60 shadow-md ring-1 ring-primary/40"
                    : "bg-card/60 hover:bg-card/90 border-border/60 hover:border-border/90"
                )}
              >
                <div className="flex items-center justify-between">
                  <Icon className={cn("w-4 h-4", isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary stroke-[3]" />}
                </div>
                <div>
                  <span className="text-xs font-bold text-foreground block leading-tight">
                    {preset.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2 mt-0.5">
                    {preset.shortDesc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= 3. COLLAPSIBLE MULTI-FACTOR FILTER DECK ================= */}
      <Card className="bg-card/70 backdrop-blur-2xl border border-border/70 shadow-lg rounded-2xl overflow-hidden">
        <CardHeader
          onClick={() => setIsFilterDeckOpen(!isFilterDeckOpen)}
          className="p-4 px-5 border-b border-border/40 bg-accent/15 cursor-pointer flex flex-row items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-bold text-foreground">
              Multi-Factor Criteria Builder
            </CardTitle>
            {activeFiltersCount > 0 && (
              <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] font-mono font-bold">
                {activeFiltersCount} Active Filters
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              {isFilterDeckOpen ? 'Collapse' : 'Expand Controls'}
            </span>
            {isFilterDeckOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </CardHeader>

        {isFilterDeckOpen && (
          <CardContent className="p-5 space-y-5">
            {/* Search & Market Cap Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Quick Search */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Search Ticker / Company / Theme
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search e.g. NVDA, AI, Uranium, Apple..."
                    value={criteria.search || ''}
                    onChange={(e) => setCriteria((prev) => ({ ...prev, search: e.target.value }))}
                    className="pl-9 h-9 text-xs bg-background/60 border-border/60 focus:border-primary rounded-xl font-semibold"
                  />
                </div>
              </div>

              {/* Market Cap Tier */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Market Cap Tier
                </label>
                <div className="grid grid-cols-5 gap-1 text-[11px]">
                  {[
                    { id: 'ALL', label: 'All' },
                    { id: 'MEGA', label: 'Mega ($200B+)' },
                    { id: 'LARGE', label: 'Large ($10B+)' },
                    { id: 'MID', label: 'Mid ($2B+)' },
                    { id: 'SMALL', label: 'Small (<$2B)' },
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setCriteria((prev) => ({ ...prev, marketCapTier: tier.id as any }))}
                      className={cn(
                        "py-1.5 px-1 rounded-xl font-bold border transition-all text-center truncate",
                        criteria.marketCapTier === tier.id
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background/50 border-border/50 text-muted-foreground hover:text-foreground"
                      )}
                      title={tier.label}
                    >
                      {tier.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Moving Average Alignment */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Moving Average Trend
                </label>
                <select
                  value={criteria.movingAverageCondition || 'ALL'}
                  onChange={(e) => setCriteria((prev) => ({ ...prev, movingAverageCondition: e.target.value as any }))}
                  className="w-full h-9 rounded-xl px-3 bg-background/60 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="ALL">Any Moving Average Trend</option>
                  <option value="ABOVE_50DMA">Above 50-Day Moving Average (Bullish)</option>
                  <option value="ABOVE_200DMA">Above 200-Day Moving Average (Long-Term Up)</option>
                  <option value="GOLDEN_CROSS">Golden Cross (50 DMA &gt; 200 DMA)</option>
                  <option value="BELOW_200DMA">Below 200-Day Moving Average (Deep Value/Discount)</option>
                </select>
              </div>
            </div>

            {/* Numerical Sliders / Inputs Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1 text-xs">
              {/* Max P/E */}
              <div className="space-y-1 p-2.5 rounded-xl bg-accent/20 border border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground block uppercase">Max Trailing P/E</span>
                <Input
                  type="number"
                  placeholder="e.g. 35"
                  value={criteria.maxPe ?? ''}
                  onChange={(e) => setCriteria((prev) => ({ ...prev, maxPe: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  className="h-7 text-xs bg-background/60 border-border/50 font-bold"
                />
              </div>

              {/* Min Operating Margin */}
              <div className="space-y-1 p-2.5 rounded-xl bg-accent/20 border border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground block uppercase">Min Operating Margin (%)</span>
                <Input
                  type="number"
                  placeholder="e.g. 15"
                  value={criteria.minOperatingMargin ?? ''}
                  onChange={(e) => setCriteria((prev) => ({ ...prev, minOperatingMargin: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  className="h-7 text-xs bg-background/60 border-border/50 font-bold"
                />
              </div>

              {/* Min ROE */}
              <div className="space-y-1 p-2.5 rounded-xl bg-accent/20 border border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground block uppercase">Min ROE (%)</span>
                <Input
                  type="number"
                  placeholder="e.g. 15"
                  value={criteria.minRoe ?? ''}
                  onChange={(e) => setCriteria((prev) => ({ ...prev, minRoe: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  className="h-7 text-xs bg-background/60 border-border/50 font-bold"
                />
              </div>

              {/* Max Debt/Equity */}
              <div className="space-y-1 p-2.5 rounded-xl bg-accent/20 border border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground block uppercase">Max Debt/Equity (%)</span>
                <Input
                  type="number"
                  placeholder="e.g. 100"
                  value={criteria.maxDebtToEquity ?? ''}
                  onChange={(e) => setCriteria((prev) => ({ ...prev, maxDebtToEquity: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  className="h-7 text-xs bg-background/60 border-border/50 font-bold"
                />
              </div>

              {/* Min Dividend Yield */}
              <div className="space-y-1 p-2.5 rounded-xl bg-accent/20 border border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground block uppercase">Min Dividend Yield (%)</span>
                <Input
                  type="number"
                  placeholder="e.g. 2.0"
                  value={criteria.minDividendYield ?? ''}
                  onChange={(e) => setCriteria((prev) => ({ ...prev, minDividendYield: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  className="h-7 text-xs bg-background/60 border-border/50 font-bold"
                />
              </div>

              {/* RSI Condition */}
              <div className="space-y-1 p-2.5 rounded-xl bg-accent/20 border border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground block uppercase">RSI (14) Signal</span>
                <select
                  value={criteria.rsiCondition || 'ALL'}
                  onChange={(e) => setCriteria((prev) => ({ ...prev, rsiCondition: e.target.value as any }))}
                  className="w-full h-7 rounded-lg px-2 bg-background/60 border border-border/50 text-[11px] font-bold text-foreground focus:outline-none"
                >
                  <option value="ALL">Any RSI</option>
                  <option value="OVERSOLD">Oversold (&lt;35)</option>
                  <option value="NEUTRAL">Neutral (35-65)</option>
                  <option value="OVERBOUGHT">Overbought (&gt;65)</option>
                </select>
              </div>
            </div>

            {/* Sectors Pills */}
            {metaData?.sectors && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Filter by GICS Sectors
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {metaData.sectors.map((sec) => {
                    const isSelected = criteria.sectors?.includes(sec);
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => toggleSector(sec)}
                        className={cn(
                          "px-2.5 py-1 rounded-xl text-xs font-bold border transition-all",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background/40 border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                        )}
                      >
                        {sec}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ================= 4. SCANNER RESULTS MATRIX ================= */}
      <div className="space-y-3">
        {/* Results Header Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">
              Matching Equities ({results.length})
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              Sorted by <b className="text-primary ml-1">{criteria.sortBy}</b> ({criteria.sortDirection})
            </Badge>
          </div>

          <div className="text-xs text-muted-foreground font-mono">
            Live quotes from Yahoo Finance
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-card/70 backdrop-blur-2xl border border-border/70 rounded-2xl shadow-xl overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-xs text-muted-foreground font-mono">
                Scanning multi-factor market universe & calculating metrics...
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Filter className="w-8 h-8 text-muted-foreground/50 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">No Equities Matched This Scanner Criteria</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Try widening your P/E range, clearing sector restrictions, or clicking one of the 1-Click Strategy Presets above.
              </p>
              <Button size="sm" variant="outline" onClick={handleResetFilters} className="text-xs font-bold">
                Reset All Filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-accent/25 border-b border-border/60 text-muted-foreground font-mono uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5 pl-4 cursor-pointer hover:text-foreground" onClick={() => handleSort('symbol')}>
                      <div className="flex items-center gap-1">
                        <span>Symbol</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort('price')}>
                      <div className="flex items-center gap-1">
                        <span>Price</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort('changePercent')}>
                      <div className="flex items-center gap-1">
                        <span>1D %</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort('marketCap')}>
                      <div className="flex items-center gap-1">
                        <span>Market Cap</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort('pe')}>
                      <div className="flex items-center gap-1">
                        <span>P/E</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort('operatingMargin')}>
                      <div className="flex items-center gap-1">
                        <span>Op. Margin</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort('roe')}>
                      <div className="flex items-center gap-1">
                        <span>ROE</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort('dividendYield')}>
                      <div className="flex items-center gap-1">
                        <span>Div. Yield</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort('distance52wHighPercent')}>
                      <div className="flex items-center gap-1">
                        <span>vs 52W High</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-3.5">Trend & RSI</th>
                    <th className="p-3.5 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {results.map((stock) => {
                    const isUp = stock.changePercent >= 0;
                    return (
                      <tr
                        key={stock.symbol}
                        className="hover:bg-accent/20 transition-colors group cursor-pointer"
                        onClick={() => onNavigateToResearch?.(stock.symbol)}
                      >
                        {/* Symbol & Name */}
                        <td className="p-3.5 pl-4 font-sans">
                          <div className="flex items-center gap-2">
                            <div>
                              <span className="font-bold text-foreground group-hover:text-primary font-mono text-sm block">
                                ${stock.symbol}
                              </span>
                              <span className="text-[11px] text-muted-foreground truncate max-w-[140px] block">
                                {stock.name}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="p-3.5 font-bold text-foreground">
                          ${stock.price.toFixed(2)}
                        </td>

                        {/* Change % */}
                        <td className="p-3.5">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-lg text-xs font-bold inline-flex items-center gap-0.5",
                              isUp
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                            )}
                          >
                            {isUp ? '+' : ''}{stock.changePercent.toFixed(2)}%
                          </span>
                        </td>

                        {/* Market Cap */}
                        <td className="p-3.5 text-foreground font-bold">
                          {stock.marketCapFormatted}
                        </td>

                        {/* P/E */}
                        <td className="p-3.5">
                          {stock.pe ? (
                            <span className={cn("font-bold", stock.pe < 20 ? "text-emerald-400" : stock.pe > 50 ? "text-amber-400" : "text-foreground")}>
                              {stock.pe.toFixed(1)}x
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">N/A</span>
                          )}
                        </td>

                        {/* Op Margin */}
                        <td className="p-3.5">
                          {stock.operatingMargin !== null ? (
                            <span className={cn("font-bold", stock.operatingMargin > 20 ? "text-emerald-400" : stock.operatingMargin < 0 ? "text-rose-400" : "text-foreground")}>
                              {stock.operatingMargin.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">N/A</span>
                          )}
                        </td>

                        {/* ROE */}
                        <td className="p-3.5">
                          {stock.roe !== null ? (
                            <span className={cn("font-bold", stock.roe > 15 ? "text-emerald-400" : "text-foreground")}>
                              {stock.roe.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">N/A</span>
                          )}
                        </td>

                        {/* Dividend Yield */}
                        <td className="p-3.5">
                          {stock.dividendYield !== null && stock.dividendYield > 0 ? (
                            <span className="font-bold text-amber-300">
                              {stock.dividendYield.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* vs 52W High */}
                        <td className="p-3.5">
                          <span
                            className={cn(
                              "font-bold",
                              stock.distance52wHighPercent > -5
                                ? "text-emerald-400"
                                : stock.distance52wHighPercent < -25
                                ? "text-rose-400"
                                : "text-foreground"
                            )}
                          >
                            {stock.distance52wHighPercent.toFixed(1)}%
                          </span>
                        </td>

                        {/* Trend & RSI */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] px-1.5 py-0",
                                stock.above50Dma ? "text-emerald-400 border-emerald-500/30" : "text-muted-foreground"
                              )}
                            >
                              50D {stock.above50Dma ? '▲' : '▼'}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] px-1.5 py-0 font-mono",
                                stock.estimatedRsi < 35
                                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                  : stock.estimatedRsi > 65
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : "text-muted-foreground"
                              )}
                            >
                              RSI {stock.estimatedRsi}
                            </Badge>
                          </div>
                        </td>

                        {/* Action Buttons */}
                        <td className="p-3.5 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onNavigateToResearch?.(stock.symbol)}
                              className="h-7 px-2 text-[11px] font-bold text-primary hover:bg-primary/20"
                              title="Open in Research Dossier"
                            >
                              Research
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onNavigateToGraphs?.(stock.symbol)}
                              className="h-7 px-1.5 text-muted-foreground hover:text-foreground"
                              title="View Chart"
                            >
                              <LineChart className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAlertModalStock({
                                  symbol: stock.symbol,
                                  price: stock.price,
                                  name: stock.name,
                                });
                                setIsAlertModalOpen(true);
                              }}
                              className="h-7 px-1.5 text-muted-foreground hover:text-amber-400"
                              title="Set Price Alert"
                            >
                              <Bell className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Standalone Price Alert Modal */}
      {alertModalStock && (
        <PriceAlertModal
          isOpen={isAlertModalOpen}
          onClose={() => {
            setIsAlertModalOpen(false);
            setAlertModalStock(null);
          }}
          symbol={alertModalStock.symbol}
          currentPrice={alertModalStock.price}
          companyName={alertModalStock.name}
        />
      )}
    </div>
  );
}

function RotateCcwIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
