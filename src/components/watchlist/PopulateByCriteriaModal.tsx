import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  Layers,
  CheckCircle2,
  FolderPlus,
  Plus,
  X,
  Search,
  Zap,
  Globe,
  TrendingUp,
  Shield,
  Flame,
  DollarSign,
  PieChart,
  Activity,
  Cpu,
  Radio,
  Atom,
  Lock,
  Pill,
  Rocket,
  Cloud,
  BatteryCharging,
  Landmark,
  Building2,
  Award,
  Filter,
  Check,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBulkCreateWatchlist, useBulkAddSymbolsToWatchlist, WatchlistSummary } from '@/services/watchlistService';
import { toast } from 'sonner';

interface PopulateByCriteriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWatchlistId?: string | null;
  watchlists?: WatchlistSummary[];
  onCreatedSuccess?: (newWatchlistId: string) => void;
}

export interface CriteriaItem {
  id: string;
  category: 'THEME' | 'STOCK_TYPE' | 'ASSET_CLASS' | 'SECTOR';
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  tickers: string[];
  marketCapHint?: string;
}

export const CRITERIA_CATALOG: CriteriaItem[] = [
  // ================= 1. THEMES =================
  {
    id: 'theme_ai',
    category: 'THEME',
    name: 'AI & Compute Infrastructure',
    description: 'Generative AI chips, cloud datacenters, interconnects & accelerator hardware',
    icon: Cpu,
    color: 'emerald',
    tickers: ['NVDA', 'MSFT', 'GOOGL', 'AMD', 'TSM', 'AVGO', 'MRVL', 'PLTR', 'ARM', 'SMCI', 'ANET', 'ALAB'],
  },
  {
    id: 'theme_nuclear_grid',
    category: 'THEME',
    name: 'Nuclear Energy, SMRs & Clean Grid',
    description: 'Uranium miners, small modular reactors, power utilities & power grid infrastructure',
    icon: Atom,
    color: 'cyan',
    tickers: ['CCJ', 'SMR', 'URA', 'CEG', 'VST', 'OKLO', 'ORA', 'GE', 'TLN', 'NLR'],
  },
  {
    id: 'theme_cybersecurity',
    category: 'THEME',
    name: 'Cybersecurity & Zero-Trust',
    description: 'Next-gen enterprise threat detection, cloud security & identity management',
    icon: Lock,
    color: 'indigo',
    tickers: ['CRWD', 'PANW', 'FTNT', 'ZS', 'NET', 'CYBR', 'SENT', 'QLYS'],
  },
  {
    id: 'theme_glp1_biopharma',
    category: 'THEME',
    name: 'GLP-1 Weight Loss & Bio-Pharma',
    description: 'Metabolic drug leaders, obesity therapeutics, diabetes care & surgical robotics',
    icon: Pill,
    color: 'rose',
    tickers: ['LLY', 'NVO', 'VKTX', 'AMGN', 'REGN', 'ISRG', 'DXCM', 'BMRN'],
  },
  {
    id: 'theme_defense_space',
    category: 'THEME',
    name: 'Defense, Aerospace & Drones',
    description: 'Defense contractors, autonomous unmanned systems, tactical comms & aerospace',
    icon: Rocket,
    color: 'amber',
    tickers: ['LMT', 'RTX', 'NOC', 'GD', 'KTOS', 'AVAV', 'RKLB', 'PLTR', 'HII'],
  },
  {
    id: 'theme_saas_cloud',
    category: 'THEME',
    name: 'Enterprise Cloud & Modern SaaS',
    description: 'High-gross-margin software platforms, data warehousing & workflow orchestration',
    icon: Cloud,
    color: 'purple',
    tickers: ['CRM', 'NOW', 'WDAY', 'SNOW', 'DDOG', 'MDB', 'TEAM', 'HUBS', 'NET'],
  },
  {
    id: 'theme_energy_transition',
    category: 'THEME',
    name: 'Energy Transition & Critical Minerals',
    description: 'Lithium, rare earths, solar, clean energy storage & EV battery materials',
    icon: BatteryCharging,
    color: 'teal',
    tickers: ['ALB', 'SQM', 'MP', 'ENPH', 'FSLR', 'TSLA', 'BYDDF', 'LAC'],
  },
  {
    id: 'theme_space_leo',
    category: 'THEME',
    name: 'Space Tech & Satellite Constellations',
    description: 'Commercial launch providers, lunar landers, direct-to-cell satellite communications',
    icon: Radio,
    color: 'blue',
    tickers: ['RKLB', 'LUNR', 'ASTS', 'BKSY', 'PL', 'IRDM', 'SPIR'],
  },
  {
    id: 'theme_fintech_payments',
    category: 'THEME',
    name: 'Fintech & Digital Payments',
    description: 'Card networks, digital brokerages, payment gateways & neo-banking leaders',
    icon: Landmark,
    color: 'sky',
    tickers: ['V', 'MA', 'PYPL', 'SQ', 'HOOD', 'SOFI', 'NU', 'COIN'],
  },
  {
    id: 'theme_gold_precious',
    category: 'THEME',
    name: 'Gold Miners & Hard Assets',
    description: 'Senior precious metal miners, gold/silver royalty companies & monetary hedges',
    icon: Flame,
    color: 'yellow',
    tickers: ['GLD', 'GDX', 'NEM', 'GOLD', 'AEM', 'SLV', 'PAAS', 'AG'],
  },
  {
    id: 'theme_infrastructure_reshoring',
    category: 'THEME',
    name: 'US Infrastructure & Capex Supercycle',
    description: 'Heavy equipment, grid electrification, aggregates & industrial automation',
    icon: Building2,
    color: 'orange',
    tickers: ['CAT', 'URI', 'ETN', 'PWR', 'EMR', 'FAST', 'GWW', 'VMC'],
  },

  // ================= 2. STOCK TYPES & ARCHETYPES =================
  {
    id: 'type_mega_compounders',
    category: 'STOCK_TYPE',
    name: 'Mega-Cap Quality Compounders',
    description: 'Unassailable balance sheets, massive cash generation, wide moats & market leadership',
    icon: Award,
    color: 'emerald',
    tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'BRK-B', 'V', 'JNJ'],
  },
  {
    id: 'type_hypergrowth_beta',
    category: 'STOCK_TYPE',
    name: 'High-Beta Hyper-Growth Tech',
    description: 'Fastest-growing revenue engines, high-multiple market darlings with explosive upside',
    icon: TrendingUp,
    color: 'purple',
    tickers: ['PLTR', 'NVDA', 'TSLA', 'AMD', 'COIN', 'MSTR', 'ARM', 'SMCI', 'APP'],
  },
  {
    id: 'type_dividend_aristocrats',
    category: 'STOCK_TYPE',
    name: 'Dividend Aristocrats & Cash Return',
    description: '25+ consecutive years of dividend increases, recession-resistant defensive cash flows',
    icon: DollarSign,
    color: 'amber',
    tickers: ['JNJ', 'PG', 'KO', 'PEP', 'ABBV', 'CVX', 'XOM', 'IBM', 'O', 'MCD', 'HD'],
  },
  {
    id: 'type_deep_value',
    category: 'STOCK_TYPE',
    name: 'Deep Value & Low Multiple Turnarounds',
    description: 'Low Price-to-Earnings, depressed sentiment, high dividend yields & restructuring plays',
    icon: Shield,
    color: 'rose',
    tickers: ['INTC', 'WBA', 'BABA', 'F', 'GM', 'KHC', 'T', 'VZ', 'C', 'BMY'],
  },
  {
    id: 'type_fcf_machines',
    category: 'STOCK_TYPE',
    name: 'Free Cash Flow (FCF) Yield Titans',
    description: 'Highest free-cash-flow generation per share with aggressive share buyback programs',
    icon: DollarSign,
    color: 'teal',
    tickers: ['GOOGL', 'META', 'MSFT', 'BRK-B', 'XOM', 'V', 'MA', 'AAPL', 'QCOM'],
  },
  {
    id: 'type_high_short_interest',
    category: 'STOCK_TYPE',
    name: 'High Short Interest & Squeeze Radar',
    description: 'Elevated short interest (>15% float), high days-to-cover & asymmetric squeeze potential',
    icon: Flame,
    color: 'rose',
    tickers: ['CVNA', 'UPST', 'LCID', 'RIVN', 'MARA', 'RIOT', 'GME', 'CHWY'],
  },
  {
    id: 'type_defensive_all_weather',
    category: 'STOCK_TYPE',
    name: 'Defensive & Low-Beta All-Weather',
    description: 'Minimal market correlation, recession-proof demand & steady compound growth',
    icon: Shield,
    color: 'blue',
    tickers: ['BRK-B', 'JNJ', 'PG', 'WMT', 'KO', 'MCD', 'COST', 'UNH', 'RSG'],
  },

  // ================= 3. ASSET CLASSES =================
  {
    id: 'asset_us_indices',
    category: 'ASSET_CLASS',
    name: 'US Equity Benchmark & Index ETFs',
    description: 'S&P 500, Nasdaq 100, Russell 2000, Dow Jones, Equal-Weight & Total Market trackers',
    icon: Globe,
    color: 'emerald',
    tickers: ['SPY', 'QQQ', 'IWM', 'DIA', 'RSP', 'VTI', 'VOO'],
  },
  {
    id: 'asset_global_em',
    category: 'ASSET_CLASS',
    name: 'Global & Emerging Markets',
    description: 'Broad emerging markets, China tech, Japan, India, Latin America & European equities',
    icon: Globe,
    color: 'cyan',
    tickers: ['EEM', 'FXI', 'EWZ', 'INDA', 'EWJ', 'VGK', 'EFA', 'KWEB'],
  },
  {
    id: 'asset_bonds_fixed_income',
    category: 'ASSET_CLASS',
    name: 'Treasuries, Corporate Bonds & Yield',
    description: '20+ Year US Treasuries, Short-Term bills, High Yield Corporate credit & TIPS',
    icon: Landmark,
    color: 'blue',
    tickers: ['TLT', 'IEF', 'SHY', 'HYG', 'LQD', 'BND', 'AGG', 'TIP', 'JNK'],
  },
  {
    id: 'asset_commodities_raw',
    category: 'ASSET_CLASS',
    name: 'Commodities, Energy & Agriculture',
    description: 'Crude oil, natural gas, broad commodities basket, copper, silver, wheat & agriculture',
    icon: Flame,
    color: 'amber',
    tickers: ['USO', 'UNG', 'DBC', 'GLD', 'SLV', 'CPER', 'WEAT', 'DBA'],
  },
  {
    id: 'asset_crypto_digital',
    category: 'ASSET_CLASS',
    name: 'Crypto & Digital Asset Proxies',
    description: 'Spot Bitcoin ETFs, MicroStrategy, Coinbase, Bitcoin miners & digital infrastructure',
    icon: Zap,
    color: 'purple',
    tickers: ['IBIT', 'FBTC', 'MSTR', 'COIN', 'MARA', 'RIOT', 'CLSK', 'CIFR'],
  },
  {
    id: 'asset_volatility_hedges',
    category: 'ASSET_CLASS',
    name: 'Volatility & Tail-Risk Hedges',
    description: 'CBOE Volatility index futures ETFs, short-term VIX spikes & hedging instruments',
    icon: Activity,
    color: 'rose',
    tickers: ['VXX', 'UVXY', 'SVXY', 'VIXY'],
  },

  // ================= 4. GICS SECTORS =================
  {
    id: 'sec_technology',
    category: 'SECTOR',
    name: 'Technology (XLK)',
    description: 'Semiconductors, enterprise software, hardware & IT infrastructure leaders',
    icon: Cpu,
    color: 'purple',
    tickers: ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'AMD', 'CRM', 'ADBE', 'INTC', 'CSCO', 'ORCL'],
  },
  {
    id: 'sec_financials',
    category: 'SECTOR',
    name: 'Financials (XLF)',
    description: 'Money center banks, investment banks, asset managers & insurance leaders',
    icon: Landmark,
    color: 'blue',
    tickers: ['JPM', 'BAC', 'WFC', 'MS', 'GS', 'BLK', 'C', 'AXP', 'SCHW', 'CB'],
  },
  {
    id: 'sec_healthcare',
    category: 'SECTOR',
    name: 'Healthcare (XLV)',
    description: 'Major pharmaceuticals, managed care, medical devices & life sciences tools',
    icon: Pill,
    color: 'emerald',
    tickers: ['LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'TMO', 'ABT', 'PFE', 'DHR', 'AMGN'],
  },
  {
    id: 'sec_consumer_disc',
    category: 'SECTOR',
    name: 'Consumer Discretionary (XLY)',
    description: 'E-commerce, automotive, home improvement, restaurants & retail chains',
    icon: TrendingUp,
    color: 'amber',
    tickers: ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', 'BKNG', 'LOW', 'TJX'],
  },
  {
    id: 'sec_communication',
    category: 'SECTOR',
    name: 'Communication Services (XLC)',
    description: 'Social media, search engines, streaming entertainment & telecom giants',
    icon: Radio,
    color: 'indigo',
    tickers: ['META', 'GOOGL', 'NFLX', 'DIS', 'CMCSA', 'TMUS', 'T', 'VZ'],
  },
  {
    id: 'sec_industrials',
    category: 'SECTOR',
    name: 'Industrials (XLI)',
    description: 'Aerospace & defense, heavy machinery, logistics, railways & conglomerates',
    icon: Building2,
    color: 'sky',
    tickers: ['GE', 'CAT', 'UNP', 'HON', 'RTX', 'BA', 'DE', 'LMT', 'UPS', 'ETN'],
  },
  {
    id: 'sec_energy',
    category: 'SECTOR',
    name: 'Energy (XLE)',
    description: 'Integrated oil majors, E&P operators, refiners & oilfield service providers',
    icon: Flame,
    color: 'orange',
    tickers: ['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'VLO', 'OXY', 'PSX', 'HAL'],
  },
  {
    id: 'sec_consumer_staples',
    category: 'SECTOR',
    name: 'Consumer Staples (XLP)',
    description: 'Household goods, discount hypermarkets, beverages, food & tobacco compounders',
    icon: Shield,
    color: 'teal',
    tickers: ['PG', 'COST', 'WMT', 'KO', 'PEP', 'PM', 'MDLZ', 'MO', 'CL', 'TGT'],
  },
  {
    id: 'sec_utilities',
    category: 'SECTOR',
    name: 'Utilities (XLU)',
    description: 'Regulated electric utilities, power producers, clean energy & gas distributors',
    icon: Atom,
    color: 'yellow',
    tickers: ['NEE', 'SO', 'DUK', 'CEG', 'SRE', 'AEP', 'D', 'EXC', 'PEG', 'VST'],
  },
  {
    id: 'sec_real_estate',
    category: 'SECTOR',
    name: 'Real Estate (XLRE)',
    description: 'Logistics warehouses, cell tower REITs, data centers & commercial property',
    icon: Building2,
    color: 'rose',
    tickers: ['PLD', 'AMT', 'EQIX', 'CCI', 'PSA', 'O', 'SPG', 'WELL', 'DLR'],
  },
  {
    id: 'sec_materials',
    category: 'SECTOR',
    name: 'Materials (XLB)',
    description: 'Industrial specialty chemicals, industrial gases, copper miners & packaging',
    icon: Layers,
    color: 'slate',
    tickers: ['LIN', 'APD', 'SHW', 'FCX', 'NEM', 'ECL', 'CTVA', 'DOW', 'DD'],
  },
];

export function PopulateByCriteriaModal({
  isOpen,
  onClose,
  activeWatchlistId,
  watchlists = [],
  onCreatedSuccess,
}: PopulateByCriteriaModalProps) {
  // Mode: CREATE_NEW vs POPULATE_EXISTING
  const [targetMode, setTargetMode] = useState<'CREATE_NEW' | 'POPULATE_EXISTING'>('CREATE_NEW');
  const [selectedExistingId, setSelectedExistingId] = useState<string>(activeWatchlistId || (watchlists[0]?.id || ''));
  const [customWatchlistName, setCustomWatchlistName] = useState('');
  
  // Selected criteria IDs
  const [selectedCriteriaIds, setSelectedCriteriaIds] = useState<string[]>(['theme_ai']);
  const [activeCategoryTab, setActiveCategoryTab] = useState<'ALL' | 'THEME' | 'STOCK_TYPE' | 'ASSET_CLASS' | 'SECTOR'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Mutations
  const bulkCreateMutation = useBulkCreateWatchlist();
  const bulkAddMutation = useBulkAddSymbolsToWatchlist();

  // Filter criteria catalog
  const filteredCatalog = useMemo(() => {
    return CRITERIA_CATALOG.filter((item) => {
      if (activeCategoryTab !== 'ALL' && item.category !== activeCategoryTab) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesTickers = item.tickers.some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc && !matchesTickers) return false;
      }
      return true;
    });
  }, [activeCategoryTab, searchQuery]);

  // Aggregate and deduplicate tickers from selected criteria
  const aggregateTickers = useMemo(() => {
    const set = new Set<string>();
    selectedCriteriaIds.forEach((id) => {
      const item = CRITERIA_CATALOG.find((c) => c.id === id);
      if (item) {
        item.tickers.forEach((t) => set.add(t.toUpperCase()));
      }
    });
    return Array.from(set);
  }, [selectedCriteriaIds]);

  // Auto-generate suggested watchlist title based on selected criteria
  const suggestedTitle = useMemo(() => {
    const selectedItems = selectedCriteriaIds
      .map((id) => CRITERIA_CATALOG.find((c) => c.id === id))
      .filter(Boolean) as CriteriaItem[];

    if (selectedItems.length === 0) return 'Custom Criteria Watchlist';
    if (selectedItems.length === 1) return selectedItems[0].name;
    if (selectedItems.length === 2) return `${selectedItems[0].name.split('&')[0].trim()} + ${selectedItems[1].name.split('&')[0].trim()}`;
    return `${selectedItems[0].name.split('&')[0].trim()} & ${selectedItems.length - 1} More Criteria`;
  }, [selectedCriteriaIds]);

  const toggleCriteria = (id: string) => {
    setSelectedCriteriaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllInView = () => {
    const viewIds = filteredCatalog.map((c) => c.id);
    const newSet = new Set([...selectedCriteriaIds, ...viewIds]);
    setSelectedCriteriaIds(Array.from(newSet));
  };

  const handleClearAll = () => {
    setSelectedCriteriaIds([]);
  };

  const handleExecute = async () => {
    if (aggregateTickers.length === 0) {
      toast.error('Please select at least one criterion with stocks to populate.');
      return;
    }

    try {
      if (targetMode === 'CREATE_NEW') {
        const finalName = customWatchlistName.trim() || suggestedTitle;
        const created = await bulkCreateMutation.mutateAsync({
          name: finalName,
          symbols: aggregateTickers,
        });

        toast.success(`Created Watchlist "${created.name}" with ${aggregateTickers.length} ticker(s)!`, {
          description: `Criteria: ${selectedCriteriaIds.length} categories populated`,
        });

        onCreatedSuccess?.(created.id);
        onClose();
      } else {
        if (!selectedExistingId) {
          toast.error('Please select a target watchlist to populate.');
          return;
        }

        const targetW = watchlists.find((w) => w.id === selectedExistingId);
        const res = await bulkAddMutation.mutateAsync({
          watchlistId: selectedExistingId,
          symbols: aggregateTickers,
        });

        toast.success(`Populated "${targetW?.name || 'Watchlist'}" with ${res.addedCount} new ticker(s)!`, {
          description: `${res.existingCount} were already in the watchlist. Total now: ${res.totalSymbols}`,
        });

        onCreatedSuccess?.(selectedExistingId);
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to populate watchlist: ${err.message}`);
    }
  };

  const isPending = bulkCreateMutation.isPending || bulkAddMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[780px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl">
        {/* ================= HEADER ================= */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-gradient-to-r from-primary/10 via-purple-500/10 to-transparent">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-primary/20">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                  <span>Populate Watchlist by Criteria</span>
                  <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 text-[10px] uppercase font-mono font-bold">
                    Smart Generator
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Select investment themes, stock archetypes, asset classes, and industry sectors to populate instantly.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* ================= BODY ================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Target Mode Toggle */}
          <div className="p-3.5 rounded-2xl bg-accent/20 border border-border/60 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-sans">
                <FolderPlus className="w-3.5 h-3.5 text-primary" /> Destination Target
              </span>

              <div className="flex items-center gap-1 bg-background/80 p-1 rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={() => setTargetMode('CREATE_NEW')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                    targetMode === 'CREATE_NEW'
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Create New Watchlist
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('POPULATE_EXISTING')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                    targetMode === 'POPULATE_EXISTING'
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Add to Existing Watchlist
                </button>
              </div>
            </div>

            {targetMode === 'CREATE_NEW' ? (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Watchlist Name</label>
                <Input
                  placeholder={suggestedTitle}
                  value={customWatchlistName}
                  onChange={(e) => setCustomWatchlistName(e.target.value)}
                  className="h-9 text-xs bg-background/80 border-border/60 focus:border-primary font-bold"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Select Target Watchlist</label>
                <select
                  value={selectedExistingId}
                  onChange={(e) => setSelectedExistingId(e.target.value)}
                  className="w-full h-9 rounded-xl px-3 bg-background/80 border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                >
                  {watchlists.map((w) => (
                    <option key={w.id} value={w.id} className="bg-popover text-popover-foreground">
                      {w.name} ({w.items?.length || 0} stocks)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Search & Category Filter Tabs */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Category Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { key: 'ALL', label: 'All Criteria', icon: Layers },
                  { key: 'THEME', label: 'Secular Themes', icon: Flame },
                  { key: 'STOCK_TYPE', label: 'Stock Types', icon: Award },
                  { key: 'ASSET_CLASS', label: 'Asset Classes', icon: Globe },
                  { key: 'SECTOR', label: 'Sectors', icon: Building2 },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeCategoryTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveCategoryTab(tab.key as any)}
                      className={cn(
                        "px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 shrink-0",
                        isActive
                          ? "bg-primary/20 text-primary border-primary/40 shadow-sm"
                          : "bg-card/60 text-muted-foreground border-border/50 hover:bg-accent/40 hover:text-foreground"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllInView}
                  className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                >
                  Select View
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-7 text-[11px] px-2 text-muted-foreground hover:text-rose-400"
                >
                  Clear All
                </Button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search themes, stock archetypes, sectors, or specific ticker symbols..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-background/60 border-border/60 focus:border-primary rounded-xl"
              />
            </div>
          </div>

          {/* Criteria Selection Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
            {filteredCatalog.map((item) => {
              const isSelected = selectedCriteriaIds.includes(item.id);
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => toggleCriteria(item.id)}
                  className={cn(
                    "p-3 rounded-2xl border cursor-pointer transition-all relative overflow-hidden flex flex-col justify-between space-y-2 group",
                    isSelected
                      ? "bg-gradient-to-br from-primary/15 via-purple-500/10 to-card/80 border-primary/50 shadow-md ring-1 ring-primary/40"
                      : "bg-card/50 border-border/60 hover:border-border hover:bg-card/80"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0",
                          isSelected
                            ? "bg-primary text-white shadow-sm"
                            : "bg-accent/40 text-muted-foreground group-hover:text-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground block leading-tight">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {item.category.replace('_', ' ')} • {item.tickers.length} tickers
                        </span>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 mt-0.5",
                        isSelected
                          ? "bg-primary border-primary text-white"
                          : "border-border/80 bg-background/50"
                      )}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                    {item.description}
                  </p>

                  {/* Tickers Chips Preview */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {item.tickers.slice(0, 5).map((t) => (
                      <span
                        key={t}
                        className={cn(
                          "text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded border",
                          isSelected
                            ? "bg-primary/20 text-primary border-primary/30"
                            : "bg-accent/30 text-muted-foreground border-border/40"
                        )}
                      >
                        {t}
                      </span>
                    ))}
                    {item.tickers.length > 5 && (
                      <span className="text-[9.5px] font-mono text-muted-foreground self-center">
                        +{item.tickers.length - 5}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Aggregated Tickers Preview Box */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-border/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-sans">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Aggregated Universe to Populate ({aggregateTickers.length} Unique Stocks)
              </span>
              <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/30 bg-primary/10">
                {selectedCriteriaIds.length} Criteria Selected
              </Badge>
            </div>

            {aggregateTickers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {aggregateTickers.map((t) => (
                  <span
                    key={t}
                    className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-primary/15 text-primary border border-primary/30"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Select one or more criteria above to preview stocks.
              </p>
            )}
          </div>
        </div>

        {/* ================= FOOTER ================= */}
        <DialogFooter className="p-5 border-t border-border/50 bg-accent/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {aggregateTickers.length > 0 ? (
              <span>
                Ready to populate <strong className="text-foreground font-mono">{aggregateTickers.length}</strong> tickers into{' '}
                <strong className="text-primary">{targetMode === 'CREATE_NEW' ? customWatchlistName.trim() || suggestedTitle : 'Selected Watchlist'}</strong>
              </span>
            ) : (
              <span>Select criteria to populate</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs font-bold">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleExecute}
              disabled={isPending || aggregateTickers.length === 0}
              className="text-xs font-bold gap-1.5 bg-gradient-to-r from-primary via-purple-600 to-indigo-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-md shadow-primary/25"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Populating Watchlist...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Populate {aggregateTickers.length} Stocks</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
