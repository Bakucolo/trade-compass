
import { useEffect, useState, useMemo, useRef } from 'react';
import { useIBKRStatus, useIBKRPortfolio } from '../services/ibkr';
import { useTastytradePositions } from '../services/tastytrade';
import { useTrading212Status, useTrading212Positions } from '../services/trading212';
import { usePortfolioBalances } from '../services/portfolioBalanceService';
import { marketDataService, StockQuote } from '../services/marketData';
import { convertIbkrToOcc } from '../utils/optionUtils';
import { PortfolioSummary } from './portfolio/PortfolioSummary';
import { PerformanceLeaderboard } from './portfolio/PerformanceLeaderboard';
import { HoldingsTable } from './portfolio/HoldingsTable';
import { PortfolioAuditModal } from './portfolio/PortfolioAuditModal';
import { PortfolioValuationModal } from './portfolio/PortfolioValuationModal';
import { CriticalDefenseModal } from './portfolio/CriticalDefenseModal';
import { PositionAdvisorModal } from './portfolio/PositionAdvisorModal';
import { UnifiedPosition } from './portfolio/types';
import { getCompanyStyleAndThemes } from '../services/stockThematics';
import { ErrorBoundary } from './ErrorBoundary';

import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  RefreshCw,
  Plus,
  Settings,
  Wallet,
  Layers,
  ShieldAlert,
  Sparkles,
  Bot,
  Activity,
  Scale,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from './ui/use-toast';
import { AgentActivityDrawer } from './AgentActivityDrawer';
import { useAgentActivities } from '../services/agentActivityService';
interface BrokersPageProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol?: string) => void;
}

export function BrokersPage({ onNavigateToResearch, onNavigateToGraphs }: BrokersPageProps = {}) {
  const { toast } = useToast();

  // --- Real-time Broker Balances & Buying Power ---
  const { data: balancesData } = usePortfolioBalances();

  // --- IBKR State ---
  const { data: ibStatus } = useIBKRStatus();
  const { data: ibPortfolio, isLoading: isIBLoading } = useIBKRPortfolio();
  const isIBConnected = ibStatus?.connected ?? false;

  const { data: tastyPositions, isLoading: isTastyLoading } = useTastytradePositions();
  const { data: t212Status, isLoading: isT212Loading } = useTrading212Status();
  const isT212Connected = t212Status?.connected || balancesData?.brokers?.trading212?.status === 'connected' || false;

  // --- Aggregation State ---
  // --- Aggregation State ---
  // const [unifiedPositions, setUnifiedPositions] = useState<UnifiedPosition[]>([]); // Converted to useMemo
  const [isAggregating, setIsAggregating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [liveQuotes, setLiveQuotes] = useState<Map<string, StockQuote>>(() => {
    try {
      const saved = localStorage.getItem('finance_liveQuotes');
      if (saved) {
        const parsed: [string, StockQuote][] = JSON.parse(saved);
        // Filter out legacy mock data
        const cleanEntries = parsed.filter(([_, q]) => q && q.source !== 'Mock Data (Tasty Offline)' && q.exchange !== 'MOCK');
        return new Map(cleanEntries);
      }
    } catch (e) { }
    return new Map();
  });

  // Privacy Mode (Persisted)
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    return localStorage.getItem('isPrivacyMode') !== 'false'; // Default true
  });

  // Balances Open state (Persisted - Hidden by default)
  const [isBalancesOpen, setIsBalancesOpen] = useState<boolean>(() => {
    return localStorage.getItem('isPortfolioBalancesOpen') === 'true'; // Default false (hidden)
  });

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isValuationModalOpen, setIsValuationModalOpen] = useState(false);
  const [isDefenseModalOpen, setIsDefenseModalOpen] = useState(false);
  const [advisorPosition, setAdvisorPosition] = useState<UnifiedPosition | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isAgentDrawerOpen, setIsAgentDrawerOpen] = useState(false);
  const { data: agentData } = useAgentActivities(10);
  const hasRunningAgent = agentData?.activities?.some(a => a.status === 'RUNNING');

  const togglePrivacyMode = () => {
    setIsPrivacyMode(prev => {
      const newValue = !prev;
      localStorage.setItem('isPrivacyMode', String(newValue));
      return newValue;
    });
  };

  const toggleBalancesOpen = () => {
    setIsBalancesOpen(prev => {
      const newValue = !prev;
      localStorage.setItem('isPortfolioBalancesOpen', String(newValue));
      return newValue;
    });
  };

  // --- Aggregation Logic ---
  // Transform DB holdings to UnifiedPosition
  // This runs whenever ibPortfolio updates (e.g. from DB poll), but DOES NOT fetch new quotes.
  const unifiedPositions = useMemo(() => {
    const tempPositions: UnifiedPosition[] = [];
    if (!ibPortfolio) return tempPositions;

    for (const p of ibPortfolio) {
      if (p.quantity === 0) continue;

      const isOption = p.assetType === 'OPTION' || p.assetType === 'Option';

      let isExpired = false;
      if (isOption && p.expiryDate) {
        let expiryDate: Date;
        if (/^\d{8}$/.test(p.expiryDate)) {
          const y = p.expiryDate.substring(0, 4);
          const m = p.expiryDate.substring(4, 6);
          const d = p.expiryDate.substring(6, 8);
          expiryDate = new Date(Number(y), Number(m) - 1, Number(d));
        } else {
          expiryDate = new Date(p.expiryDate);
        }

        if (!isNaN(expiryDate.getTime())) {
          const today = new Date();
          const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const expiryNoTime = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());

          if (expiryNoTime.getTime() < todayNoTime.getTime()) {
            isExpired = true;
          }
        }
      }

      if (isExpired) continue;

      let unifiedSymbol = p.symbol;

      if (p.assetType === 'OPTION' && p.expiryDate && p.strikePrice && p.optionType) {
        const type = p.optionType === 'C' || p.optionType === 'Call' ? 'Call' : 'Put';
        const occ = convertIbkrToOcc(
          p.symbol,
          p.expiryDate,
          p.strikePrice,
          type
        );
        unifiedSymbol = occ;
      } else if (p.assetType === 'OPTION' && p.brokerSpecificId && p.broker?.name === 'Tastytrade') {
        unifiedSymbol = p.brokerSpecificId;
      }

      const multiplier = isOption ? 100 : 1;
      const costBasis = p.averageCost * p.quantity * multiplier;

      const derivedUnderlyingSymbol = p.underlyingSymbol || (isOption ? p.symbol : undefined);
      const underlyingQuote = derivedUnderlyingSymbol ? liveQuotes.get(derivedUnderlyingSymbol) : undefined;
      let underlyingPrice = underlyingQuote?.price || undefined;

      // Fallback: If we don't have a live quote, see if we hold the underlying stock natively
      if (!underlyingPrice && derivedUnderlyingSymbol) {
        const stockHolding = ibPortfolio.find(h => h.symbol === derivedUnderlyingSymbol && (h.assetType === 'EQUITY' || h.assetType === 'Stock'));
        if (stockHolding && stockHolding.currentPrice > 0) {
          underlyingPrice = stockHolding.currentPrice;
        }
      }

      // Priority 1: Official broker DB values (audited market value and unrealized PnL)
      let currentPrice = p.currentPrice > 0 ? p.currentPrice : (p.quantity !== 0 && p.marketValue ? Math.abs(p.marketValue / (p.quantity * multiplier)) : p.averageCost);
      let marketValue = p.marketValue || 0;
      let unrealizedPL = p.unrealizedPnL || 0;
      let unrealizedPLPercent = p.unrealizedPnLPercent || 0;

      // If we have live quote and position has no DB marketValue, or for live USD stock updating:
      const quote = liveQuotes.get(unifiedSymbol);
      const isUSD = !p.currency || p.currency === 'USD';

      if (p.marketValue !== 0 || p.unrealizedPnL !== 0) {
        // Use verified broker values from database
        marketValue = p.marketValue;
        unrealizedPL = p.unrealizedPnL;
        // Accurate cost basis: |marketValue - unrealizedPL|
        const costBasisAccurate = Math.abs(marketValue - unrealizedPL);
        unrealizedPLPercent = p.unrealizedPnLPercent !== 0 && Math.abs(p.unrealizedPnLPercent) > 1
          ? p.unrealizedPnLPercent
          : (costBasisAccurate > 0 ? (unrealizedPL / costBasisAccurate) * 100 : 0);
        
        if (quote && quote.price > 0 && isUSD && !isOption) {
          // For US stocks, can reflect latest live price tick
          currentPrice = quote.price;
        } else if (p.currentPrice > 0) {
          currentPrice = p.currentPrice;
        }
      } else if (quote && quote.price > 0 && isUSD) {
        currentPrice = quote.price;
        marketValue = currentPrice * p.quantity * multiplier;
        unrealizedPL = marketValue - costBasis;
        unrealizedPLPercent = costBasis !== 0 ? (unrealizedPL / Math.abs(costBasis)) * 100 : 0;
      } else if (p.currentPrice > 0) {
        currentPrice = p.currentPrice;
        marketValue = currentPrice * p.quantity * multiplier;
        unrealizedPL = marketValue - costBasis;
        unrealizedPLPercent = costBasis !== 0 ? (unrealizedPL / Math.abs(costBasis)) * 100 : 0;
      } else {
        // Intrinsic estimate fallback if underlying price is known and option is ITM
        if (isOption && underlyingPrice && p.strikePrice) {
          const isCall = p.optionType === 'C' || p.optionType === 'Call';
          const intrinsic = isCall ? Math.max(0, underlyingPrice - p.strikePrice) : Math.max(0, p.strikePrice - underlyingPrice);
          if (intrinsic > 0) {
            currentPrice = Math.max(p.averageCost || 0, intrinsic);
          } else {
            currentPrice = p.averageCost || 0;
          }
        } else {
          currentPrice = p.averageCost || 0;
        }
        marketValue = currentPrice * p.quantity * multiplier;
        unrealizedPL = marketValue - costBasis;
        unrealizedPLPercent = costBasis !== 0 ? (unrealizedPL / Math.abs(costBasis)) * 100 : 0;
      }

      // Day P/L from quote if available, else DB
      const dayChangePerShare = quote?.change || 0;
      const dayChange = (quote && isUSD) ? (dayChangePerShare * p.quantity * multiplier) : (p.dayPnL || 0);
      const dayChangePercent = (quote && isUSD) ? (quote.changesPercentage || 0) : (p.dayPnLPercent || 0);

      const thematicInfo = getCompanyStyleAndThemes(p.underlyingSymbol || unifiedSymbol, p.description || undefined);

      let accountType: 'ISA' | 'GIA' | 'MARGIN' | 'CASH' = 'GIA';
      let accountName = 'IBKR GIA';
      let accountBadge = 'IBKR (GIA)';

      if (p.broker?.name === 'Tastytrade') {
        accountType = 'MARGIN';
        accountName = 'Tastytrade Margin';
        accountBadge = 'Tastytrade';
      } else if (p.broker?.name === 'Trading 212') {
        accountType = 'ISA';
        accountName = 'Trading 212 ISA';
        accountBadge = 'Trading 212';
      } else {
        // IBKR: Determine ISA (U14522424) vs GIA (U15491236)
        const isIsa = p.accountNumber === 'U14522424' ||
                      p.brokerSpecificId?.includes('U14522424') ||
                      p.accountName?.includes('U14522424') ||
                      p.accountName?.includes('ISA') ||
                      p.accountBadge?.includes('ISA') ||
                      (p.assetType !== 'OPTION' && p.quantity > 0 && !p.brokerSpecificId?.includes('U15491236') && p.accountNumber !== 'U15491236');

        if (isIsa) {
          accountType = 'ISA';
          accountName = 'IBKR ISA (U14522424)';
          accountBadge = 'IBKR (ISA)';
        } else {
          accountType = 'GIA';
          accountName = 'IBKR GIA (U15491236)';
          accountBadge = 'IBKR (GIA)';
        }
      }

      tempPositions.push({
        id: p.id,
        symbol: unifiedSymbol,
        quantity: p.quantity,
        averageCost: p.averageCost,
        currentPrice: currentPrice,
        marketValue: marketValue,
        dayChange: dayChange,
        dayChangePercent: dayChangePercent,
        unrealizedPL: unrealizedPL,
        unrealizedPLPercent: unrealizedPLPercent,
        source: p.broker?.name === 'Tastytrade' ? 'Tastytrade' : p.broker?.name === 'Trading 212' ? 'Trading 212' : 'IBKR',
        accountType,
        accountName,
        accountBadge,
        accountNumber: p.broker?.name === 'Tastytrade' ? 'Tastytrade' : p.broker?.name === 'Trading 212' ? 'Trading 212' : (accountType === 'ISA' ? 'U14522424' : 'U15491236'),
        assetType: p.assetType === 'OPTION' ? 'Option' : 'Stock',
        strike: p.strikePrice || undefined,
        optionType: p.assetType === 'OPTION' ? (p.optionType === 'C' || p.optionType === 'Call' ? 'Call' : 'Put') : undefined,
        expiry: p.expiryDate || undefined,
        underlyingSymbol: p.underlyingSymbol || undefined,
        underlyingPrice: underlyingPrice,
        currency: p.currency || 'USD',
        investmentStyle: thematicInfo.style,
        themes: thematicInfo.themes,
        primaryTheme: thematicInfo.primaryTheme,
      });
    }
    return tempPositions;
  }, [ibPortfolio, liveQuotes]);

  const refreshPrices = async () => {
    if (isAggregating || unifiedPositions.length === 0) return;
    setIsAggregating(true);

    try {
      const uniqueSymbols = new Set<string>();
      unifiedPositions.forEach(p => {
        uniqueSymbols.add(p.symbol);
        if (p.assetType === 'Option') {
          if (p.underlyingSymbol) {
            uniqueSymbols.add(p.underlyingSymbol);
          } else {
            // For Tastytrade options where the DB might miss the underlyingSymbol
            // Extract the symbol from the OCC format or use the original stock string
            // We know p.symbol here is unifiedSymbol (e.g., OCC string).
            // But wait, we don't have access to the original raw p.symbol here directly anymore.
            // But p.symbol (OCC) starts with the underlying symbol, up to 6 characters!
            const root = p.symbol.substring(0, 6).trim();
            if (root) {
              uniqueSymbols.add(root);
            }
          }
        }
      });

      const newQuotes = new Map(liveQuotes);

      const symbolsArray = Array.from(uniqueSymbols);
      // Batch promises sequentially to avoid rate limits / WAF Blocks
      for (const sym of symbolsArray) {
        try {
          if (!sym) continue;
          const cleanSym = String(sym).trim();
          if (!cleanSym) continue;

          // Artificial delay to prevent Yahoo Edge 429 blocks
          await new Promise(resolve => setTimeout(resolve, 80));

          const quote = await marketDataService.getQuote(cleanSym);
          if (quote) {
            newQuotes.set(sym, quote);
          }
        } catch (e) {
          console.warn(`Error resolving quote for ${sym}:`, e);
        }
      }

      setLiveQuotes(newQuotes);
      try {
        localStorage.setItem('finance_liveQuotes', JSON.stringify(Array.from(newQuotes.entries())));
      } catch (e) {
        console.warn('Failed to cache live quotes', e);
      }

    } catch (error) {
      console.error("Price Refresh Error:", error);
    } finally {
      setIsAggregating(false);
      setLastUpdated(new Date());
    }
  };

  // The server loop updates the DB. The UI polls the DB (via useIBKRPortfolio).
  // This UI just renders what is in the DB.
  const hasSyncedOnce = useRef(false);
  useEffect(() => {
    // If we have positions but no quotes yet, do an initial sync so that things like underlyingPrice populate
    if (unifiedPositions.length > 0 && !hasSyncedOnce.current && !isAggregating) {
      hasSyncedOnce.current = true;
      refreshPrices();
    }
  }, [unifiedPositions.length, isAggregating]);



  // --- Totals Calculation ---
  const totals = useMemo(() => {
    return unifiedPositions.reduce((acc, pos) => {
      const isIBKR = pos.source === 'IBKR';
      const isTasty = pos.source === 'Tastytrade';

      return {
        netLiquidValue: acc.netLiquidValue + pos.marketValue,
        dailyPL: acc.dailyPL + pos.dayChange,
        unrealizedPL: acc.unrealizedPL + pos.unrealizedPL,
        buyingPower: acc.buyingPower, // Mock BP 
        ibkrTotal: acc.ibkrTotal + (isIBKR ? pos.marketValue : 0),
        tastyTotal: acc.tastyTotal + (isTasty ? pos.marketValue : 0),
      };
    }, {
      netLiquidValue: 0,
      dailyPL: 0,
      unrealizedPL: 0,
      buyingPower: 100000, // Mock BP
      ibkrTotal: 0,
      tastyTotal: 0
    });
  }, [unifiedPositions]);

  // Daily PL Percent for the whole portfolio (weighted)
  // Simple approx: DailyPL / (NetLiq - DailyPL) (Start of day Value)
  const portfolioDailyPercent = totals.netLiquidValue !== 0
    ? (totals.dailyPL / (totals.netLiquidValue - totals.dailyPL)) * 100
    : 0;

  // Critical Defense Count
  const criticalCount = useMemo(() => {
    return unifiedPositions.filter(pos => {
      if (!pos) return false;
      const isOption = pos.assetType === 'Option';
      const isShort = (pos.quantity || 0) < 0;
      const isLosing = (pos.unrealizedPL || 0) < 0;
      
      let isITM = false;
      let distance = Infinity;
      if (isOption && pos.underlyingPrice && pos.strike) {
        distance = Math.abs((pos.underlyingPrice - pos.strike) / pos.strike) * 100;
        const isCall = pos.optionType === 'Call' || pos.optionType === 'C';
        isITM = isCall ? (pos.underlyingPrice > pos.strike) : (pos.underlyingPrice < pos.strike);
      }

      const isSevereEquityLoss = !isOption && ((pos.unrealizedPLPercent || 0) <= -20 || (pos.unrealizedPL || 0) <= -500);
      const isShortOptionDanger = isOption && isShort && (isITM || distance <= 5) && isLosing;
      const isHeavyOptionLoss = isOption && (pos.unrealizedPL || 0) <= -300;

      return isSevereEquityLoss || isShortOptionDanger || isHeavyOptionLoss;
    }).length;
  }, [unifiedPositions]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground glow-text-white">Portfolio Command</h1>
          <p className="text-muted-foreground">Real-time cross-brokerage analysis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Critical Defense Center Button (Top of Page) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDefenseModalOpen(true)}
            className={cn(
              "h-9 text-xs font-bold gap-1.5 transition-all shadow-sm",
              criticalCount > 0
                ? "bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.25)]"
                : "bg-background/60 text-muted-foreground border-border/70 hover:bg-accent/40"
            )}
            title="Open Critical Defense Center"
          >
            <ShieldAlert className={cn("w-3.5 h-3.5", criticalCount > 0 ? "text-rose-400" : "text-muted-foreground")} />
            <span>Critical Defense</span>
            {criticalCount > 0 && (
              <Badge className="bg-rose-500 text-white text-[10px] font-mono px-1.5 py-0 h-4 ml-0.5 animate-pulse">
                {criticalCount}
              </Badge>
            )}
          </Button>

          {/* Balances Collapsible Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleBalancesOpen}
            className={cn(
              "h-9 text-xs gap-1.5 border-border/70 hover:bg-accent/40 font-semibold transition-all",
              isBalancesOpen ? "bg-primary/10 border-primary/40 text-primary" : "text-muted-foreground"
            )}
            title={isBalancesOpen ? 'Hide Portfolio Balances' : 'Show Portfolio Balances'}
          >
            <Wallet className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Balances</span>
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isBalancesOpen && "rotate-180")} />
          </Button>

          {/* Privacy Toggle (Masked / Visible) */}
          <Button
            variant="outline"
            size="sm"
            onClick={togglePrivacyMode}
            className="h-9 text-xs gap-1.5 border-border/70 hover:bg-accent/40"
            title={isPrivacyMode ? 'Show Balances' : 'Hide Balances'}
          >
            {isPrivacyMode ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isPrivacyMode ? 'Masked' : 'Visible'}</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setIsValuationModalOpen(true)}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md gap-1.5"
          >
            <Scale className="w-3.5 h-3.5" />
            AI Valuation Agent
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setIsAuditModalOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Risk Analyser
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAgentDrawerOpen(true)}
            className="text-xs gap-1.5 relative border-purple-500/30 hover:bg-purple-950/20"
          >
            <Bot className="w-3.5 h-3.5 text-purple-400" />
            <span>Agent Activity</span>
            {hasRunningAgent && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
            {!hasRunningAgent && (agentData?.count || 0) > 0 && (
              <Badge variant="secondary" className="text-[9px] font-mono px-1 py-0 h-4 bg-muted">
                {agentData?.count}
              </Badge>
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={refreshPrices} disabled={isAggregating} className="text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isAggregating ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        </div>
      </div>

      {/* Portfolio Summary Cards (Collapsible) */}
      {isBalancesOpen ? (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-primary" /> Broker Balances & Portfolio Summary
            </span>
            <button
              onClick={() => setIsBalancesOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <span>Hide Balances</span>
              <ChevronUp className="w-3 h-3" />
            </button>
          </div>
          <ErrorBoundary fallbackTitle="Portfolio Summary">
            <PortfolioSummary
              netLiquidValue={balancesData?.total?.netLiquidatingValue && balancesData.total.netLiquidatingValue > 0 ? balancesData.total.netLiquidatingValue : totals.netLiquidValue}
              dailyPL={balancesData?.total?.dayPnL !== undefined && balancesData.total.dayPnL !== 0 ? balancesData.total.dayPnL : totals.dailyPL}
              dailyPLPercent={portfolioDailyPercent || 0}
              unrealizedPL={balancesData?.total?.unrealizedPnL !== undefined && balancesData.total.unrealizedPnL !== 0 ? balancesData.total.unrealizedPnL : totals.unrealizedPL}
              buyingPower={balancesData?.total?.buyingPower ?? totals.buyingPower}
              connectedSources={{
                ibkr: isIBConnected,
                tastytrade: balancesData?.brokers?.tastytrade?.status === 'connected' || balancesData?.brokers?.tastytrade?.status === 'active' || true,
                trading212: isT212Connected
              }}
              isPrivacyMode={isPrivacyMode}
              onTogglePrivacy={togglePrivacyMode}
              accountBreakdown={{
                ibkr: balancesData?.brokers?.ibkr?.netLiquidatingValue || totals.ibkrTotal || 0,
                tastytrade: balancesData?.brokers?.tastytrade?.netLiquidatingValue || totals.tastyTotal || 0,
                trading212: balancesData?.brokers?.trading212?.netLiquidatingValue || 0
              }}
              brokerBalances={balancesData?.brokers}
              portfolioData={balancesData}
              positions={unifiedPositions}
              onNavigateToResearch={onNavigateToResearch}
            />
          </ErrorBoundary>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/20 hover:bg-card/40 transition-colors p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-foreground">Broker Balances is collapsed</span>
              {((balancesData?.total?.netLiquidatingValue || totals.netLiquidValue) > 0) && !isPrivacyMode && (
                <span className="text-muted-foreground font-mono ml-2 hidden sm:inline">
                  • Net Liq: ${(balancesData?.total?.netLiquidatingValue || totals.netLiquidValue).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsBalancesOpen(true)}
            className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1.5 font-bold rounded-xl"
          >
            <span>Show Balances</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Portfolio Movers & Performance Leaderboard (Day, Week, Month, YTD) */}
      <ErrorBoundary fallbackTitle="Movers & Performance Leaderboard">
        <PerformanceLeaderboard
          positions={unifiedPositions}
          isPrivacyMode={isPrivacyMode}
          onSelectPosition={(pos) => {
            const sym = pos.underlyingSymbol || (pos.assetType === 'Option' ? pos.symbol.match(/^[A-Z0-9.\-]+/)?.[0] : pos.symbol) || pos.symbol;
            onNavigateToResearch?.(sym);
          }}
        />
      </ErrorBoundary>

      {/* Main Holdings Table */}
      <ErrorBoundary fallbackTitle="Holdings Table">
        <HoldingsTable
          positions={unifiedPositions}
          isLoading={(isIBLoading || isTastyLoading) && unifiedPositions.length === 0}
          onRefresh={refreshPrices}
          isPrivacyMode={isPrivacyMode}
          onNavigateToResearch={onNavigateToResearch}
          onNavigateToGraphs={onNavigateToGraphs}
        />
      </ErrorBoundary>

      {/* AI Portfolio Tactical Audit & Risk Modal */}
      {isAuditModalOpen && (
        <PortfolioAuditModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          positions={unifiedPositions}
          balancesData={balancesData}
          totals={totals}
          isPrivacyMode={isPrivacyMode}
        />
      )}

      {/* AI Portfolio Valuation Audit Modal */}
      {isValuationModalOpen && (
        <PortfolioValuationModal
          isOpen={isValuationModalOpen}
          onClose={() => setIsValuationModalOpen(false)}
          positions={unifiedPositions}
          balancesData={balancesData}
          isPrivacyMode={isPrivacyMode}
          onNavigateToResearch={onNavigateToResearch}
        />
      )}

      {/* Real-Time AI Agent Activity Drawer */}
      <AgentActivityDrawer
        isOpen={isAgentDrawerOpen}
        onClose={() => setIsAgentDrawerOpen(false)}
      />

      {/* AI Position Defense Advisor Modal */}
      <PositionAdvisorModal
        position={advisorPosition}
        isOpen={isAdvisorOpen}
        onClose={() => {
          setIsAdvisorOpen(false);
          setAdvisorPosition(null);
        }}
      />

      {/* Critical Position Defense Center Modal */}
      <CriticalDefenseModal
        isOpen={isDefenseModalOpen}
        onClose={() => setIsDefenseModalOpen(false)}
        positions={unifiedPositions}
        onOpenAdvisorForPosition={(pos) => {
          setAdvisorPosition(pos);
          setIsAdvisorOpen(true);
        }}
        onNavigateToResearch={onNavigateToResearch}
        onNavigateToGraphs={onNavigateToGraphs}
      />

      <div className="text-xs text-muted-foreground text-center pt-4">
        Last Updated: {lastUpdated.toLocaleTimeString()}
      </div>
    </div>
  );
}
