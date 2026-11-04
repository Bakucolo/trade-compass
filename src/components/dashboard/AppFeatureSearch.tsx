import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Sparkles,
  CandlestickChart,
  LineChart,
  Wallet,
  Bot,
  ShieldCheck,
  Briefcase,
  Globe,
  Calendar,
  Radar,
  NotebookPen,
  Bell,
  History,
  Lightbulb,
  TrendingUp,
  Settings,
  Zap,
  ShieldAlert,
  Scale,
  Clock,
  Flame,
  CornerDownLeft,
  X,
  Layers,
  Activity,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useWatchlists, WatchlistSummary } from '@/services/watchlistService';

export interface AppFeatureSearchProps {
  onNavigateTab?: (tab: string) => void;
  onSelectWatchlist?: (watchlistId: string) => void;
  watchlists?: WatchlistSummary[];
  onOpenBuyingPower?: () => void;
  onOpenCriticalDefense?: () => void;
  onOpenAIHunter?: () => void;
  onOpenPositionAdvisor?: () => void;
  onOpenThetaBreakdown?: () => void;
  onOpenCopilot?: () => void;
  onOpenTelegramHub?: () => void;
  className?: string;
}

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  category: 'SECTIONS' | 'TOOLS' | 'ANALYTICS' | 'WATCHLISTS';
  badge?: string;
  badgeColor?: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  actionType: 'NAVIGATE' | 'MODAL' | 'CUSTOM' | 'WATCHLIST';
  target?: string;
}

const RECENT_STORAGE_KEY = 'tradeflow_recent_features';
const USAGE_STORAGE_KEY = 'tradeflow_feature_usage';

export function AppFeatureSearch({
  onNavigateTab,
  onSelectWatchlist,
  watchlists: propWatchlists,
  onOpenBuyingPower,
  onOpenCriticalDefense,
  onOpenAIHunter,
  onOpenPositionAdvisor,
  onOpenThetaBreakdown,
  onOpenCopilot,
  onOpenTelegramHub,
  className
}: AppFeatureSearchProps) {
  // Query watchlists safely (handles test environments lacking QueryClientProvider)
  let queriedWatchlists: WatchlistSummary[] | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const res = useWatchlists();
    queriedWatchlists = res?.data;
  } catch {
    queriedWatchlists = undefined;
  }
  const watchlists = propWatchlists ?? queriedWatchlists ?? [];

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recents and usage counts from localStorage
  useEffect(() => {
    try {
      const storedRecents = localStorage.getItem(RECENT_STORAGE_KEY);
      if (storedRecents) setRecentIds(JSON.parse(storedRecents));

      const storedUsage = localStorage.getItem(USAGE_STORAGE_KEY);
      if (storedUsage) setUsageCounts(JSON.parse(storedUsage));
    } catch (e) {
      console.warn('Failed to parse feature search localStorage', e);
    }
  }, []);

  // Global Ctrl+K / Cmd+K shortcut listener to focus search bar
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Feature Catalog Definition
  const baseFeatures: FeatureItem[] = useMemo(() => [
    // 1. Core Sections
    {
      id: 'fast-graphs',
      title: 'FAST Graphs Fundamental Valuation',
      description: 'Peter Lynch & Graham-Dodd fair value lines, earnings fill, historical normal P/E and rate of return tool',
      category: 'SECTIONS',
      badge: 'NEW',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: Sparkles,
      keywords: ['fast graphs', 'valuation', 'fundamental', 'pe ratio', 'peter lynch', 'intrinsic', 'earnings', 'dividend', 'fair value'],
      actionType: 'CUSTOM',
      target: 'FAST_GRAPHS'
    },
    {
      id: 'watchlist',
      title: 'Watchlists & Canadian TSX Tickers',
      description: 'Real-time ticker tracking, bulk addition, Odd Lots agent and Canadian TSX/TSXV market quotes',
      category: 'SECTIONS',
      badge: 'UPDATED',
      badgeColor: 'bg-primary/20 text-primary border-primary/40',
      icon: LineChart,
      keywords: ['watchlist', 'tickers', 'stocks', 'quote', 'tsx', 'prices', 'shares', 'add stock'],
      actionType: 'NAVIGATE',
      target: 'watchlist'
    },
    {
      id: 'graphs',
      title: 'Technicals & Candlestick Charts',
      description: 'Interactive TradingView charts with moving averages, RSI indicator and technical stage levels',
      category: 'SECTIONS',
      icon: CandlestickChart,
      keywords: ['charts', 'tradingview', 'candlesticks', 'technical analysis', 'rsi', 'indicators', 'graph'],
      actionType: 'NAVIGATE',
      target: 'graphs'
    },
    {
      id: 'portfolio',
      title: 'Portfolio & Unified Broker Holdings',
      description: 'Unified positions across IBKR, Tastytrade and Trading 212 with live P&L and asset allocations',
      category: 'SECTIONS',
      icon: Wallet,
      keywords: ['portfolio', 'positions', 'holdings', 'ibkr', 'tastytrade', 'trading 212', 'balances', 'pnl'],
      actionType: 'NAVIGATE',
      target: 'portfolio'
    },
    {
      id: 'macro',
      title: 'Macro Intelligence & Sector Heatmaps',
      description: 'Treasury yield curves, sector rotation heatmaps, global indices, commodities, and FX rates',
      category: 'SECTIONS',
      icon: Globe,
      keywords: ['macro', 'yield curve', 'sectors', 'heatmaps', 'commodities', 'rates', 'fed', 'treasury'],
      actionType: 'NAVIGATE',
      target: 'macro'
    },
    {
      id: 'scanner',
      title: 'Market Scanner & Breakout Radar',
      description: 'Stage 2 markup phase filters, RSI divergence, unusual volume, and momentum breakouts',
      category: 'SECTIONS',
      icon: Radar,
      keywords: ['scanner', 'screener', 'breakouts', 'momentum', 'volume', 'rsi', 'filter'],
      actionType: 'NAVIGATE',
      target: 'scanner'
    },
    {
      id: 'earnings',
      title: 'Earnings Calendar & Consensus Estimates',
      description: 'Calendar of companies reporting this week, EPS beat/miss history, and implied volatility moves',
      category: 'SECTIONS',
      icon: Calendar,
      keywords: ['earnings', 'calendar', 'eps', 'revenue', 'reports', 'quarterly', 'guidance'],
      actionType: 'NAVIGATE',
      target: 'earnings'
    },
    {
      id: 'scorecards',
      title: 'Fundamental Scorecards & Solvency',
      description: 'DuPont ROE decomposition, Piotroski F-Score, and Altman Z-Score financial health checks',
      category: 'ANALYTICS',
      icon: ShieldCheck,
      keywords: ['scorecards', 'piotroski', 'altman', 'dupont', 'solvency', 'balance sheet', 'health'],
      actionType: 'NAVIGATE',
      target: 'scorecards'
    },
    {
      id: 'ai-trading',
      title: 'AI Trading & Quantitative Automations',
      description: 'Autonomous quant strategies, algorithmic order execution, and real-time execution logs',
      category: 'SECTIONS',
      badge: 'AI',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      icon: Bot,
      keywords: ['quant', 'algo', 'bots', 'ai trading', 'automation', 'strategies'],
      actionType: 'NAVIGATE',
      target: 'ai-trading'
    },
    {
      id: 'trades',
      title: 'Trades Log & Fills Execution',
      description: 'Multi-broker order history, trade fills, execution logs, and transaction timestamps',
      category: 'SECTIONS',
      icon: History,
      keywords: ['trades', 'orders', 'fills', 'history', 'executions', 'transactions'],
      actionType: 'NAVIGATE',
      target: 'trades'
    },
    {
      id: 'ideas',
      title: 'Trade Ideas & Theses',
      description: 'High-conviction trade setups, risk-reward ratios, stop invalidation, and price targets',
      category: 'SECTIONS',
      icon: Lightbulb,
      keywords: ['ideas', 'trade setups', 'theses', 'targets', 'risk reward'],
      actionType: 'NAVIGATE',
      target: 'ideas'
    },
    {
      id: 'log',
      title: 'Thought Log & Research Journal',
      description: 'Structured market notes, saved AI Copilot answers, and Telegram mobile notes ingestion',
      category: 'SECTIONS',
      icon: NotebookPen,
      keywords: ['log', 'notes', 'journal', 'research notes', 'telegram notes', 'diary'],
      actionType: 'NAVIGATE',
      target: 'log'
    },
    {
      id: 'alerts',
      title: 'Price & Technical Level Alerts',
      description: 'Active price thresholds, condition alerts, and automated Telegram push notifications',
      category: 'SECTIONS',
      icon: Bell,
      keywords: ['alerts', 'notifications', 'price target', 'triggers', 'push alerts'],
      actionType: 'NAVIGATE',
      target: 'alerts'
    },
    {
      id: 'management',
      title: 'Portfolio Risk Management & Exposure',
      description: 'Portfolio beta exposure, Value-at-Risk (VaR), concentration limits, and stress testing',
      category: 'ANALYTICS',
      icon: Briefcase,
      keywords: ['risk management', 'beta', 'exposure', 'var', 'stress test', 'concentration'],
      actionType: 'NAVIGATE',
      target: 'management'
    },
    {
      id: 'research',
      title: 'Institutional Research Dossier',
      description: 'Deep company dossiers, SEC filings, analyst ratings, and valuation metrics',
      category: 'ANALYTICS',
      icon: TrendingUp,
      keywords: ['research', 'dossier', 'filings', 'sec', 'analyst', 'valuation'],
      actionType: 'NAVIGATE',
      target: 'research'
    },
    {
      id: 'brokers',
      title: 'Broker Connections & API Credentials',
      description: 'Live connectivity status for Interactive Brokers Gateway, Tastytrade, and Trading 212',
      category: 'SECTIONS',
      icon: Settings,
      keywords: ['brokers', 'ibkr', 'tastytrade', 'trading 212', 'api keys', 'connection'],
      actionType: 'NAVIGATE',
      target: 'brokers'
    },
    {
      id: 'settings',
      title: 'Application Preferences & Settings',
      description: 'Display themes, risk thresholds, Telegram bot tokens, and user profile configuration',
      category: 'SECTIONS',
      icon: Settings,
      keywords: ['settings', 'preferences', 'theme', 'config', 'profile'],
      actionType: 'NAVIGATE',
      target: 'settings'
    },

    // 2. Interactive Modals & Tools
    {
      id: 'copilot',
      title: 'AI Copilot (TradeFlow Hybrid)',
      description: 'Autonomous financial intelligence assistant powered by LangGraph, IBKR telemetry & live quotes',
      category: 'TOOLS',
      badge: 'HYBRID AI',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      icon: Bot,
      keywords: ['copilot', 'ai copilot', 'chat', 'assistant', 'langgraph', 'intelligence', 'ask'],
      actionType: 'MODAL',
      target: 'COPILOT'
    },
    {
      id: 'buying-power',
      title: 'Buying Power & Margin Risk Analyser',
      description: 'Interactive margin calculation, purchasing power leverage check, and maintenance buffer simulations',
      category: 'TOOLS',
      badge: 'TOOL',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: Zap,
      keywords: ['buying power', 'margin', 'leverage', 'cash', 'maintenance', 'liquidity'],
      actionType: 'MODAL',
      target: 'BUYING_POWER'
    },
    {
      id: 'critical-defense',
      title: 'Critical Defense Center',
      description: 'Instant danger radar alerting to stop-loss breaches, heavy drawdowns, and near-term options expiry',
      category: 'TOOLS',
      badge: 'RISK',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      icon: ShieldAlert,
      keywords: ['defense', 'critical defense', 'stop loss', 'drawdown', 'danger', 'risk alert', 'expiry'],
      actionType: 'MODAL',
      target: 'CRITICAL_DEFENSE'
    },
    {
      id: 'position-advisor',
      title: 'AI Position Advisor & Sizing',
      description: 'Context-aware position sizing recommendations, trailing stops, and scaling-out guidance',
      category: 'TOOLS',
      icon: Scale,
      keywords: ['position advisor', 'sizing', 'trailing stop', 'profit target', 'advisor'],
      actionType: 'MODAL',
      target: 'POSITION_ADVISOR'
    },
    {
      id: 'theta-breakdown',
      title: 'Theta Options Decay Breakdown',
      description: 'Daily portfolio time decay matrix, net theta dollar collection, and contract expiration schedule',
      category: 'TOOLS',
      icon: Activity,
      keywords: ['theta', 'greeks', 'decay', 'time decay', 'options theta', 'premium'],
      actionType: 'MODAL',
      target: 'THETA_BREAKDOWN'
    },
    {
      id: 'ai-idea-hunter',
      title: 'AI Idea Hunter Generator',
      description: 'Synthesizes real-time market data, technical setups, and macro catalysts into asymmetric trade ideas',
      category: 'TOOLS',
      badge: 'AI',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      icon: Sparkles,
      keywords: ['idea hunter', 'ai ideas', 'generator', 'asymmetric', 'opportunity'],
      actionType: 'MODAL',
      target: 'AI_IDEA_HUNTER'
    },
    {
      id: 'telegram-hub',
      title: 'Telegram Operations & Mobile Hub',
      description: 'Topic mapping, Telegram bot test dispatch, PDF briefings, and mobile quick-note capture',
      category: 'TOOLS',
      icon: Globe,
      keywords: ['telegram', 'topics', 'mobile', 'bot', 'channel', 'notifications'],
      actionType: 'MODAL',
      target: 'TELEGRAM_HUB'
    }
  ], []);

  // Dynamic Watchlist Features
  const watchlistFeatures: FeatureItem[] = useMemo(() => {
    return (watchlists || []).map((w) => {
      const tickerCount = w.items?.length || 0;
      const tickerSample = (w.items || [])
        .slice(0, 5)
        .map((item) => (typeof item === 'string' ? item : (item as { symbol?: string })?.symbol))
        .filter(Boolean) as string[];
      const tickersText = tickerSample.length > 0 ? ` (${tickerSample.join(', ')}${tickerCount > 5 ? '…' : ''})` : '';

      return {
        id: `watchlist-${w.id}`,
        title: `Watchlist: ${w.name}`,
        description: `${tickerCount} ${tickerCount === 1 ? 'symbol' : 'symbols'} tracked${tickersText}${w.isDefault ? ' • Default Watchlist' : ''}`,
        category: 'WATCHLISTS',
        badge: w.isDefault ? 'DEFAULT' : `${tickerCount} STOCKS`,
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        icon: LineChart,
        keywords: [
          w.name.toLowerCase(),
          'watchlist',
          'watchlists',
          ...tickerSample.map((t) => t.toLowerCase())
        ],
        actionType: 'WATCHLIST',
        target: w.id
      };
    });
  }, [watchlists]);

  // Combined Features Catalog
  const allFeatures: FeatureItem[] = useMemo(() => [
    ...baseFeatures,
    ...watchlistFeatures
  ], [baseFeatures, watchlistFeatures]);

  // Map of features by ID
  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureItem>();
    allFeatures.forEach((f) => map.set(f.id, f));
    return map;
  }, [allFeatures]);

  // Execute feature action & record history
  const handleSelectFeature = (feature: FeatureItem) => {
    // Record to recents (deduped, max 5)
    setRecentIds((prev) => {
      const next = [feature.id, ...prev.filter((id) => id !== feature.id)].slice(0, 5);
      try {
        localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });

    // Record to usage counts
    setUsageCounts((prev) => {
      const next = { ...prev, [feature.id]: (prev[feature.id] || 0) + 1 };
      try {
        localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });

    // Close search & clear input
    setIsOpen(false);
    setQuery('');

    // Trigger corresponding action
    if (feature.actionType === 'WATCHLIST' && feature.target) {
      const targetWatchlistId = feature.target;
      try {
        localStorage.setItem('tradeflow_active_watchlist_id', targetWatchlistId);
        localStorage.setItem('dashboard_selected_watchlist', targetWatchlistId);
      } catch (e) {
        console.warn(e);
      }
      window.dispatchEvent(
        new CustomEvent('select-watchlist', {
          detail: { id: targetWatchlistId, name: feature.title }
        })
      );
      if (onSelectWatchlist) {
        onSelectWatchlist(targetWatchlistId);
      } else if (onNavigateTab) {
        onNavigateTab('watchlist');
      }
    } else if (feature.actionType === 'NAVIGATE' && feature.target && onNavigateTab) {
      onNavigateTab(feature.target);
    } else if (feature.actionType === 'CUSTOM') {
      if (feature.id === 'fast-graphs') {
        localStorage.setItem('graphs_view_mode', 'FAST_GRAPHS');
        if (onNavigateTab) onNavigateTab('graphs');
      }
    } else if (feature.actionType === 'MODAL') {
      switch (feature.target) {
        case 'COPILOT':
          if (onOpenCopilot) onOpenCopilot();
          else window.dispatchEvent(new CustomEvent('open-hybrid-copilot'));
          break;
        case 'BUYING_POWER':
          if (onOpenBuyingPower) onOpenBuyingPower();
          break;
        case 'CRITICAL_DEFENSE':
          if (onOpenCriticalDefense) onOpenCriticalDefense();
          break;
        case 'POSITION_ADVISOR':
          if (onOpenPositionAdvisor) onOpenPositionAdvisor();
          break;
        case 'THETA_BREAKDOWN':
          if (onOpenThetaBreakdown) onOpenThetaBreakdown();
          break;
        case 'AI_IDEA_HUNTER':
          if (onOpenAIHunter) onOpenAIHunter();
          break;
        case 'TELEGRAM_HUB':
          if (onOpenTelegramHub) onOpenTelegramHub();
          else window.dispatchEvent(new CustomEvent('open-telegram-topics'));
          break;
      }
    }
  };

  // Recent Features List
  const recentFeatures = useMemo(() => {
    return recentIds
      .map((id) => featureMap.get(id))
      .filter((f): f is FeatureItem => Boolean(f));
  }, [recentIds, featureMap]);

  // Most Used Features (sorted by recorded usage counts, with curated fallbacks)
  const mostUsedFeatures = useMemo(() => {
    const defaultPriorityIds = [
      'fast-graphs',
      'watchlist',
      'copilot',
      'buying-power',
      'scanner',
      'macro',
      'critical-defense',
      'earnings'
    ];

    return [...allFeatures]
      .sort((a, b) => {
        const countA = usageCounts[a.id] || 0;
        const countB = usageCounts[b.id] || 0;
        if (countA !== countB) return countB - countA;
        const indexA = defaultPriorityIds.indexOf(a.id);
        const indexB = defaultPriorityIds.indexOf(b.id);
        const rankA = indexA === -1 ? 999 : indexA;
        const rankB = indexB === -1 ? 999 : indexB;
        return rankA - rankB;
      })
      .slice(0, 6);
  }, [allFeatures, usageCounts]);

  // Filtered Results when typing
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matched = allFeatures.filter((f) => {
      const cleanTitle = f.title.replace(/^Watchlist:\s*/i, '').toLowerCase();
      const matchTitle = f.title.toLowerCase().includes(q) || cleanTitle.includes(q);
      const matchDesc = f.description.toLowerCase().includes(q);
      const matchKeywords = f.keywords.some((k) => k.toLowerCase().includes(q));
      const matchCategory = f.category.toLowerCase().includes(q);
      return matchTitle || matchDesc || matchKeywords || matchCategory;
    });

    // Score & sort so exact title or title-starts-with / watchlist-match ranks first
    return matched.sort((a, b) => {
      const rawTitleA = a.title.toLowerCase();
      const rawTitleB = b.title.toLowerCase();
      const titleA = rawTitleA.replace(/^watchlist:\s*/i, '').trim();
      const titleB = rawTitleB.replace(/^watchlist:\s*/i, '').trim();

      // 1. Exact match with clean title or raw title
      const exactA = titleA === q || rawTitleA === q;
      const exactB = titleB === q || rawTitleB === q;
      if (exactA && !exactB) return -1;
      if (!exactA && exactB) return 1;

      // 2. Starts with query
      const startsA = titleA.startsWith(q) || rawTitleA.startsWith(q);
      const startsB = titleB.startsWith(q) || rawTitleB.startsWith(q);
      if (startsA && !startsB) return -1;
      if (!startsA && startsB) return 1;

      // 3. Category match priority when typing "watch..."
      if (q.startsWith('watch')) {
        if (a.category === 'WATCHLISTS' && b.category !== 'WATCHLISTS') return -1;
        if (a.category !== 'WATCHLISTS' && b.category === 'WATCHLISTS') return 1;
      }

      return 0;
    });
  }, [query, allFeatures]);

  // Active items list to navigate via keyboard arrows
  const currentNavigableList = useMemo(() => {
    if (query.trim()) return searchResults;
    const combined = [...recentFeatures];
    mostUsedFeatures.forEach((f) => {
      if (!combined.some((item) => item.id === f.id)) {
        combined.push(f);
      }
    });
    return combined;
  }, [query, searchResults, recentFeatures, mostUsedFeatures]);

  // Handle keyboard navigation inside dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, currentNavigableList.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + currentNavigableList.length) % Math.max(1, currentNavigableList.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentNavigableList.length > 0 && currentNavigableList[selectedIndex]) {
        handleSelectFeature(currentNavigableList[selectedIndex]);
      }
    }
  };

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const clearRecentHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentIds([]);
    try {
      localStorage.removeItem(RECENT_STORAGE_KEY);
    } catch (err) {
      console.warn(err);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full z-30", className)}>
      {/* Primary Search Input Container */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-indigo-500/20 to-purple-500/20 rounded-2xl blur-md opacity-40 group-hover:opacity-75 transition-opacity pointer-events-none" />

        <div className="relative flex items-center bg-card/90 border border-primary/30 rounded-2xl shadow-xl backdrop-blur-xl px-4 h-12 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
          <Search className="w-5 h-5 text-primary shrink-0 mr-3 pointer-events-none" />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search all sections, tools & watchlists (e.g. FAST Graphs, Micro caps, Scanner, Buying Power)..."
            className="w-full bg-transparent text-sm sm:text-base font-medium text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            spellCheck="false"
            autoComplete="off"
          />

          {/* Quick Clear Button */}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors mr-2 cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Keyboard Shortcut Pill (Cmd+K / Ctrl+K) */}
          <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-border/60 text-[11px] font-mono text-muted-foreground select-none">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 font-bold shadow-xs">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 font-bold shadow-xs">
              K
            </kbd>
          </div>
        </div>
      </div>

      {/* ================= INTERACTIVE DROPDOWN PANEL ================= */}
      {isOpen && (
        <div
          data-testid="app-feature-search-dropdown"
          className="absolute left-0 right-0 top-full mt-2 bg-slate-950/95 border border-primary/30 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden p-2.5 max-h-[460px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 z-50 divide-y divide-border/30"
        >
          {/* STATE A: ACTIVE QUERY SEARCH RESULTS */}
          {query.trim() ? (
            <div className="space-y-1 pb-1">
              <div className="px-3 py-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-primary" />
                  <span>Matching Features & Tools ({searchResults.length})</span>
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/70">
                  Press Enter to open
                </span>
              </div>

              {searchResults.length > 0 ? (
                searchResults.map((item, index) => {
                  const Icon = item.icon;
                  const isSelected = selectedIndex === index;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectFeature(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer group",
                        isSelected
                          ? "bg-primary/20 text-white shadow-sm border border-primary/40"
                          : "hover:bg-white/5 text-slate-200 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                          isSelected
                            ? (item.category === 'WATCHLISTS' ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-primary text-primary-foreground border-primary")
                            : (item.category === 'WATCHLISTS' ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 group-hover:border-emerald-400" : "bg-card/80 text-primary border-border/80 group-hover:border-primary/50")
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                              {item.title}
                            </span>
                            {item.badge && (
                              <Badge
                                variant="outline"
                                className={cn("text-[9px] px-1.5 py-0 font-mono font-bold", item.badgeColor)}
                              >
                                {item.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate max-w-[460px] sm:max-w-[620px] mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pl-3 shrink-0">
                        <span className={cn(
                          "text-[10px] font-mono px-2 py-0.5 rounded-md border uppercase font-bold",
                          item.category === 'WATCHLISTS'
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                            : "bg-slate-900 border-white/10 text-muted-foreground"
                        )}>
                          {item.category}
                        </span>
                        <ChevronRight className={cn(
                          "w-4 h-4 transition-transform",
                          isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground opacity-40"
                        )} />
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-8 text-center space-y-2">
                  <p className="text-sm font-semibold text-foreground">No matching features found</p>
                  <p className="text-xs text-muted-foreground">
                    Try searching for <span className="text-primary font-mono font-bold">"FAST Graphs"</span>, <span className="text-primary font-mono font-bold">"Watchlist"</span>, or <span className="text-primary font-mono font-bold">"Buying Power"</span>.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* STATE B: NO QUERY (SHOW RECENT + MOST USED FEATURES) */
            <div className="space-y-3 pt-1">
              {/* Section 1: Recent Features */}
              {recentFeatures.length > 0 && (
                <div className="space-y-1 pb-2">
                  <div className="px-3 py-1 flex items-center justify-between text-xs font-bold text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Recent Features</span>
                    </span>
                    <button
                      onClick={clearRecentHistory}
                      className="text-[11px] text-muted-foreground hover:text-rose-400 transition-colors"
                      title="Clear recent features history"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {recentFeatures.map((item, index) => {
                      const Icon = item.icon;
                      const isSelected = selectedIndex === index;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectFeature(item)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all cursor-pointer border",
                            isSelected
                              ? "bg-cyan-500/20 text-white border-cyan-500/50 shadow-sm"
                              : "bg-slate-900/60 hover:bg-slate-900 border-white/5 text-slate-200"
                          )}
                        >
                          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs truncate text-foreground">{item.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{item.category}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 2: Most Used & Popular Features */}
              <div className="space-y-1 pt-2">
                <div className="px-3 py-1 flex items-center justify-between text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>Most Used & Recommended Features</span>
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/60">
                    Quick Access
                  </span>
                </div>

                <div className="space-y-1">
                  {mostUsedFeatures.map((item, index) => {
                    const Icon = item.icon;
                    const adjustedIndex = index + recentFeatures.length;
                    const isSelected = selectedIndex === adjustedIndex;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectFeature(item)}
                        onMouseEnter={() => setSelectedIndex(adjustedIndex)}
                        className={cn(
                          "w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-left transition-all cursor-pointer group",
                          isSelected
                            ? "bg-amber-500/20 text-white shadow-sm border border-amber-500/40"
                            : "hover:bg-white/5 text-slate-200 border border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                            isSelected
                              ? "bg-amber-500 text-slate-950 font-bold border-amber-400"
                              : "bg-card/70 text-amber-400 border-amber-500/30 group-hover:border-amber-400"
                          )}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs sm:text-sm text-foreground group-hover:text-amber-300 transition-colors">
                                {item.title}
                              </span>
                              {item.badge && (
                                <Badge
                                  variant="outline"
                                  className={cn("text-[9px] px-1.5 py-0 font-mono font-bold", item.badgeColor)}
                                >
                                  {item.badge}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[420px] sm:max-w-[580px]">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          {usageCounts[item.id] ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              {usageCounts[item.id]}x used
                            </span>
                          ) : null}
                          <ChevronRight className={cn(
                            "w-3.5 h-3.5 transition-transform",
                            isSelected ? "text-amber-400 translate-x-0.5" : "text-muted-foreground opacity-40"
                          )} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Footer Keyboard Guide */}
          <div className="pt-2 mt-2 px-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground border-t border-border/40 bg-slate-950/40">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.2 rounded bg-slate-900 border border-white/10 text-[10px]">↑</kbd>
                <kbd className="px-1 py-0.2 rounded bg-slate-900 border border-white/10 text-[10px]">↓</kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.2 rounded bg-slate-900 border border-white/10 text-[10px]">↵</kbd>
                <span>Open</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.2 rounded bg-slate-900 border border-white/10 text-[10px]">ESC</kbd>
                <span>Close</span>
              </span>
            </div>

            <span className="hidden sm:inline text-[10px] text-primary/80 font-bold">
              TradeFlow Command Hub
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
