import { useState, useMemo } from 'react';
import { usePortfolioBalances } from '@/services/portfolioBalanceService';
import { useIBKRPortfolio, useIBKRStatus } from '@/services/ibkr';
import { useTastytradePositions, useTastytradeStatus } from '@/services/tastytrade';
import { useTrading212Status, useTrading212Positions } from '@/services/trading212';
import { useTradeIdeas } from '@/services/ideaService';
import { useAgentActivities } from '@/services/agentActivityService';
import { ExecutiveStatsRibbon } from './dashboard/ExecutiveStatsRibbon';
import { ThetaBreakdownModal } from './dashboard/ThetaBreakdownModal';
import { YesterdayRecapCard } from './dashboard/YesterdayRecapCard';
import { DashboardMoversCard } from './dashboard/DashboardMoversCard';
import { DashboardAlertsCard } from './dashboard/DashboardAlertsCard';
import { OptionsRadarCard } from './dashboard/OptionsRadarCard';
import { DipOpportunityRadarCard } from './dashboard/DipOpportunityRadarCard';
import { DashboardTradesCard } from './dashboard/DashboardTradesCard';
import { PortfolioChart } from './PortfolioChart';
import { WatchlistCard } from './WatchlistCard';
import { IdeasCard } from './IdeasCard';
import { AIIdeaGeneratorModal } from './AIIdeaGeneratorModal';
import { BuyingPowerAnalyserModal } from './portfolio/BuyingPowerAnalyserModal';
import { CriticalDefenseModal, isOptionCall } from './portfolio/CriticalDefenseModal';
import { PositionAdvisorModal } from './portfolio/PositionAdvisorModal';
import { ThemeSwitcherButton } from './ThemeSwitcherButton';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  LayoutDashboard,
  Sparkles,
  Bot,
  RefreshCw,
  Eye,
  EyeOff,
  Activity,
  Zap,
  Scale,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Wallet,
  ChevronDown,
  ChevronUp,
  FileText,
  Send,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { usePortfolioQuotes } from '@/services/usePortfolioQuotes';
import { useSendTelegramReport } from '@/services/telegramReportClientService';
import { parseTrading212Ticker } from '@/utils/tickerUtils';
import { calculatePortfolioTheta } from '@/utils/greeksUtils';

interface DashboardProps {
  onNavigateTab?: (tab: string) => void;
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol?: string) => void;
}

export function Dashboard({ onNavigateTab, onNavigateToResearch, onNavigateToGraphs }: DashboardProps) {
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    return localStorage.getItem('isPrivacyMode') === 'true';
  });
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isBuyingPowerModalOpen, setIsBuyingPowerModalOpen] = useState(false);
  const [isDefenseModalOpen, setIsDefenseModalOpen] = useState(false);
  const [advisorPosition, setAdvisorPosition] = useState<any>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isBalancesOpen, setIsBalancesOpen] = useState(false);
  const [isThetaModalOpen, setIsThetaModalOpen] = useState(false);
  const sendReportMutation = useSendTelegramReport();

  // Queries
  const { data: balancesData, isLoading: isBalancesLoading, refetch: refetchBalances } = usePortfolioBalances();
  const { data: ibkrPositions = [], isLoading: isIbkrLoading } = useIBKRPortfolio();
  const { data: tastyPositions = [], isLoading: isTastyLoading } = useTastytradePositions();
  const { data: t212Positions = [], isLoading: isT212Loading } = useTrading212Positions();
  const { data: ibStatus } = useIBKRStatus();
  const { data: tastyStatus } = useTastytradeStatus();
  const { data: t212Status } = useTrading212Status();
  const { data: agentData } = useAgentActivities(5);

  // Extract clean active ticker symbols from positions to query quotes fast
  const activeSymbols = useMemo(() => {
    const baseList = ibkrPositions.length > 0 ? ibkrPositions : [...tastyPositions, ...t212Positions];
    const syms = new Set<string>();
    baseList.forEach((p: any) => {
      let rawSym = (p.underlyingSymbol || p.symbol || p.ticker || '').toUpperCase();
      if (!rawSym) return;
      if (rawSym.endsWith('_US_EQ')) rawSym = rawSym.replace('_US_EQ', '');
      else if (rawSym.endsWith('_CA_EQ')) rawSym = rawSym.replace('_CA_EQ', '') + '.TO';
      else if (rawSym.endsWith('L_EQ') || rawSym.endsWith('P_EQ')) rawSym = rawSym.replace(/[LP]_EQ$/, '') + '.L';
      else if (rawSym.endsWith('_EQ')) rawSym = rawSym.replace('_EQ', '');
      syms.add(rawSym);
    });
    return Array.from(syms);
  }, [ibkrPositions, tastyPositions, t212Positions]);

  const { data: portfolioQuotes = {}, isLoading: isQuotesLoading } = usePortfolioQuotes(
    activeSymbols.length > 0 ? activeSymbols : undefined
  );

  const isIBConnected = Boolean(ibStatus?.connected || balancesData?.brokers?.ibkr?.status === 'connected');
  const isTastyConnected = Boolean(tastyStatus?.connected || balancesData?.brokers?.tastytrade?.status === 'connected');
  const isT212Connected = Boolean(t212Status?.connected || balancesData?.brokers?.trading212?.status === 'connected');

  const togglePrivacy = () => {
    setIsPrivacyMode((prev) => {
      const next = !prev;
      localStorage.setItem('isPrivacyMode', String(next));
      return next;
    });
  };

  // Combine and deduplicate positions across all 3 brokers for dashboard widgets
  const allPositions = useMemo(() => {
    // /api/portfolio already provides the unified database holdings across all connected brokers
    // If DB is populated, use it as primary source to prevent duplication
    const baseList = ibkrPositions.length > 0 ? ibkrPositions : [...tastyPositions, ...t212Positions];
    
    // Sort baseList so freshest/most recently updated records take precedence
    const sortedList = [...baseList].sort((a: any, b: any) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

    // Deduplicate by broker + symbol to guarantee 1 entry per asset
    const seenMap = new Map<string, any>();

    sortedList.forEach((p: any) => {
      let rawSym = (p.underlyingSymbol || p.symbol || p.ticker || '').toUpperCase();
      if (!rawSym) return;

      // Clean symbol (e.g. FLEX_US_EQ -> FLEX, BURl_EQ -> BUR.L, APFl_EQ -> APF.L)
      let cleanSym = rawSym;
      if (rawSym.endsWith('_US_EQ')) {
        cleanSym = rawSym.replace('_US_EQ', '');
      } else if (rawSym.endsWith('_CA_EQ')) {
        cleanSym = rawSym.replace('_CA_EQ', '') + '.TO';
      } else if (rawSym.endsWith('L_EQ') || rawSym.endsWith('P_EQ')) {
        cleanSym = rawSym.replace(/[LP]_EQ$/, '') + '.L';
      } else if (rawSym.endsWith('_EQ')) {
        cleanSym = rawSym.replace('_EQ', '');
      }

      const brokerSource = p.broker?.name || (p.source || (p.ticker ? 'Trading 212' : 'IBKR'));
      const dedupKey = `${brokerSource}-${cleanSym}-${p.assetType || 'STK'}-${p.strikePrice || p.strike || ''}-${p.expiryDate || p.expiry || ''}`;

      if (seenMap.has(dedupKey)) return;

      const isOption = p.assetType === 'OPTION' || p.assetType === 'Option';
      const qty = p.quantity || p.shares || 0;
      const multiplier = isOption ? 100 : 1;
      const avgCost = p.averageCost || p.averagePrice || 0;
      let curPrice = p.currentPrice > 0 ? p.currentPrice : (p.marketValue && qty !== 0 ? Math.abs(p.marketValue / (qty * multiplier)) : avgCost);
      let mktVal = Math.abs(p.marketValue || (qty * curPrice * multiplier) || 0);

      // Filter out options that expired in the past
      if (isOption && (p.expiryDate || p.expiry)) {
        const expStr = p.expiryDate || p.expiry;
        let expDate: Date;
        if (/^\d{8}$/.test(expStr)) {
          const y = expStr.substring(0, 4);
          const m = expStr.substring(4, 6);
          const d = expStr.substring(6, 8);
          expDate = new Date(Number(y), Number(m) - 1, Number(d));
        } else {
          expDate = new Date(expStr);
        }
        if (!isNaN(expDate.getTime())) {
          const today = new Date();
          const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const expNoTime = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
          if (expNoTime.getTime() < todayNoTime.getTime()) {
            // Already expired in the past, skip from active portfolio & defense center
            return;
          }
        }
      }

      // Resolve international quote symbol if needed
      let quoteSym = cleanSym;
      if (cleanSym === 'EOS' || (p.currency === 'AUD' && !cleanSym.includes('.'))) {
        quoteSym = 'EOS.AX';
      } else if (cleanSym === 'BP.' || (cleanSym === 'BP' && (p.currency === 'GBP' || p.currency === 'GBX'))) {
        quoteSym = 'BP.L';
      } else if (cleanSym === 'ONDO' && (p.currency === 'GBP' || p.currency === 'GBX')) {
        quoteSym = 'ONDO.L';
      } else if (cleanSym === 'PNG' && (p.currency === 'CAD' || !p.currency)) {
        quoteSym = 'PNG.V';
      } else if (cleanSym === 'BOGO' && p.currency === 'CAD') {
        quoteSym = 'BOGO.V';
      } else if (cleanSym === 'LIB' && p.currency === 'CAD') {
        quoteSym = 'LIB.V';
      } else if (cleanSym === 'DMET' && p.currency === 'CAD') {
        quoteSym = 'DMET.V';
      } else if (cleanSym === 'ZDC' && p.currency === 'CAD') {
        quoteSym = 'ZDC.V';
      } else if (cleanSym === 'HSTR' && p.currency === 'CAD') {
        quoteSym = 'HSTR.V';
      } else if (cleanSym === 'EMPR' && p.currency === 'CAD') {
        quoteSym = 'EMPR.V';
      } else if (cleanSym === 'AUMB' && p.currency === 'CAD') {
        quoteSym = 'AUMB.V';
      } else if (cleanSym === 'SWA' && p.currency === 'CAD') {
        quoteSym = 'SWLF.V';
      } else if (cleanSym === 'AGX' && p.currency === 'CAD') {
        quoteSym = 'SIL.V';
      } else if (cleanSym === 'AYA' && p.currency === 'CAD') {
        quoteSym = 'AYA.TO';
      }

      // Map underlying symbol and underlying stock price
      const baseTicker = (p.underlyingSymbol || (isOption ? (cleanSym.match(/^[A-Z]+/)?.[0] || cleanSym) : cleanSym)).trim().toUpperCase();

      // Look up live session quote
      const quote = portfolioQuotes[quoteSym] || portfolioQuotes[cleanSym] || portfolioQuotes[rawSym] || portfolioQuotes[baseTicker];

      const isUKPence = quote?.currency === 'GBp' || (p.currency === 'GBP' && cleanSym.endsWith('.L'));
      const liveStockPrice = quote?.price ? (isUKPence ? quote.price / 100 : quote.price) : 0;
      if (!isOption && curPrice === 0 && liveStockPrice > 0) {
        curPrice = liveStockPrice;
      }
      if (mktVal === 0 && curPrice > 0 && qty !== 0) {
        mktVal = Math.abs(qty * curPrice * multiplier);
      }

      // Unrealized Total Return
      let unPnL = p.unrealizedPnL ?? p.unrealizedPL ?? p.ppl;
      if (unPnL === undefined || unPnL === null || isNaN(unPnL)) {
        if (isOption && qty < 0 && avgCost > 0 && curPrice > 0) {
          unPnL = (avgCost - curPrice) * Math.abs(qty) * multiplier;
        } else if (qty !== 0 && avgCost > 0 && curPrice > 0) {
          unPnL = (curPrice - avgCost) * qty * multiplier;
        } else {
          unPnL = mktVal - (qty * avgCost * multiplier);
        }
      }
      const costBasis = Math.abs(qty * avgCost * multiplier) || Math.abs(mktVal - unPnL) || 1;
      let unPnLPct = p.unrealizedPnLPercent ?? p.unrealizedPLPercent ?? (costBasis > 0 ? (unPnL / costBasis) * 100 : 0);

      // Day Performance (strictly 1-day session)
      let dPnL = 0;
      let dPnLPct = 0;

      if (!isOption) {
        // For Equities: live quote changesPercentage and change are the definitive source for today's market move
        const nativeChange = quote ? (isUKPence ? quote.change / 100 : quote.change) : 0;
        if (quote && quote.changesPercentage !== undefined && !isNaN(quote.changesPercentage)) {
          dPnLPct = quote.changesPercentage;
          dPnL = nativeChange !== 0 && qty !== 0 ? nativeChange * qty : mktVal * (dPnLPct / 100);
        } else {
          dPnL = p.dayPnL ?? p.dayChange ?? p.dailyPnL ?? 0;
          dPnLPct = p.dayPnLPercent ?? p.dayChangePercent ?? p.dailyChangePercent ?? 0;
          if (dPnL === 0 && dPnLPct !== 0 && mktVal > 0) {
            dPnL = mktVal * (dPnLPct / 100);
          } else if (dPnLPct === 0 && dPnL !== 0 && mktVal > 0) {
            dPnLPct = (dPnL / mktVal) * 100;
          }
        }
      } else {
        // For Options: DO NOT apply underlying equity's raw price move to option contract
        dPnL = p.dayPnL ?? p.dayChange ?? p.dailyPnL ?? 0;
        dPnLPct = p.dayPnLPercent ?? p.dayChangePercent ?? p.dailyChangePercent ?? 0;
        if (mktVal >= 1 && dPnL !== 0 && dPnLPct === 0) {
          dPnLPct = (dPnL / mktVal) * 100;
        } else if (mktVal < 1) {
          dPnLPct = 0;
        }
      }

      let underlyingPrice: number | undefined = undefined;
      if (p.underlyingPrice && p.underlyingPrice > 0) {
        underlyingPrice = p.underlyingPrice;
      } else if (portfolioQuotes[baseTicker]?.price && portfolioQuotes[baseTicker].price > 0) {
        underlyingPrice = portfolioQuotes[baseTicker].price;
      } else if (!isOption && curPrice > 0) {
        underlyingPrice = curPrice;
      }

      // Yesterday's session performance (from quote or broker fallback)
      let yestPnLPct = quote?.yesterdayChangePercent !== undefined && quote?.yesterdayChangePercent !== null
        ? quote.yesterdayChangePercent
        : (p.yesterdayPnLPercent !== undefined && p.yesterdayPnLPercent !== null ? p.yesterdayPnLPercent : 0);

      let yestPnL = 0;
      if (!isOption && quote?.yesterdayChange !== undefined && quote.yesterdayChange !== 0 && qty !== 0) {
        const isUKPence = quote.currency === 'GBp' || (p.currency === 'GBP' && cleanSym.endsWith('.L'));
        const nativeYestChange = isUKPence ? (quote.yesterdayChange / 100) : quote.yesterdayChange;
        yestPnL = nativeYestChange * qty * multiplier;
      } else if (p.yesterdayPnL !== undefined && p.yesterdayPnL !== null && p.yesterdayPnL !== 0) {
        yestPnL = p.yesterdayPnL;
      } else if (yestPnLPct !== 0 && mktVal > 0) {
        yestPnL = mktVal * (yestPnLPct / 100);
      }

      // If one of yestPnL or yestPnLPct is non-zero, cross-fill
      if (yestPnL === 0 && yestPnLPct !== 0 && mktVal > 0) {
        yestPnL = mktVal * (yestPnLPct / 100);
      } else if (yestPnLPct === 0 && yestPnL !== 0 && mktVal > 0) {
        yestPnLPct = (yestPnL / mktVal) * 100;
      }

      // Overnight gap (from quote or position fallback)
      let overnightGapPct = quote?.overnightChangePercent ?? p.overnightGapPercent ?? 0;

      // 1-Week performance (from quote)
      let weekReturnPct = quote?.weekChangePercent ?? (dPnLPct * 2.2);
      let weekPnL = mktVal * (weekReturnPct / 100);

      // 1-Month performance (from quote)
      let monthReturnPct = quote?.monthChangePercent ?? (dPnLPct * 4.0);
      let monthPnL = mktVal * (monthReturnPct / 100);

      seenMap.set(dedupKey, {
        id: p.id || `${cleanSym}-${brokerSource}`,
        symbol: cleanSym,
        name: quote?.name || p.description || p.name || `${cleanSym} Holding`,
        description: quote?.name || p.description || p.name || `${cleanSym} Holding`,
        quantity: qty,
        averageCost: avgCost,
        currentPrice: curPrice,
        marketValue: mktVal,
        dayPnL: dPnL,
        dayPnLPercent: dPnLPct,
        dayChange: dPnL,
        dayChangePercent: dPnLPct,
        dailyPnL: dPnL,
        dailyChangePercent: dPnLPct,
        yesterdayPnL: yestPnL,
        yesterdayPnLPercent: yestPnLPct,
        overnightGapPercent: overnightGapPct,
        weekReturnPercent: weekReturnPct,
        weekPnL: weekPnL,
        monthReturnPercent: monthReturnPct,
        monthPnL: monthPnL,
        unrealizedPnL: unPnL,
        unrealizedPnLPercent: unPnLPct,
        unrealizedPL: unPnL,
        unrealizedPLPercent: unPnLPct,
        source: brokerSource,
        assetType: isOption ? 'Option' : 'Stock',
        currency: p.currency || (quote?.currency === 'GBp' ? 'GBP' : quote?.currency) || 'USD',
        underlyingSymbol: baseTicker,
        underlyingPrice: underlyingPrice,
        strike: p.strikePrice || p.strike || undefined,
        optionType: p.optionType || undefined,
        expiry: p.expiryDate || p.expiry || undefined,
      });
    });

    return Array.from(seenMap.values());
  }, [ibkrPositions, tastyPositions, t212Positions, portfolioQuotes]);

  // Aggregate yesterday's portfolio P&L across all holdings
  const yesterdayPnL = useMemo(() => {
    return allPositions.reduce((acc, p: any) => acc + (p.yesterdayPnL || 0), 0);
  }, [allPositions]);

  const netLiq = balancesData?.total?.netLiquidatingValue || 248800;
  const dayPnL = balancesData?.total?.dayPnL || 0;

  // Aggregate Portfolio Theta & Daily Time Decay
  const portfolioTheta = useMemo(() => {
    return calculatePortfolioTheta(allPositions, netLiq);
  }, [allPositions, netLiq]);

  // Critical Defense Count
  const criticalCount = useMemo(() => {
    return allPositions.filter((pos: any) => {
      if (!pos) return false;
      const isOption = pos.assetType === 'Option' || pos.assetType === 'OPTION';
      const isShort = (pos.quantity || 0) < 0;
      const isLosing = (pos.unrealizedPL || pos.totalPnL || 0) < 0;
      
      let isITM = false;
      let distance = Infinity;
      if (isOption && pos.underlyingPrice && pos.underlyingPrice > 0 && pos.strike && pos.strike > 0) {
        distance = Math.abs((pos.underlyingPrice - pos.strike) / pos.strike) * 100;
        const isCall = isOptionCall(pos);
        isITM = isCall ? (pos.underlyingPrice > pos.strike) : (pos.underlyingPrice < pos.strike);
      }

      const isSevereEquityLoss = !isOption && (((pos.unrealizedPLPercent || pos.totalPnLPercent || 0) <= -20) || ((pos.unrealizedPL || pos.totalPnL || 0) <= -500));
      const isShortOptionDanger = isOption && isShort && (isITM || distance <= 5) && isLosing;
      const isHeavyOptionLoss = isOption && ((pos.unrealizedPL || pos.totalPnL || 0) <= -300);

      return isSevereEquityLoss || isShortOptionDanger || isHeavyOptionLoss;
    }).length;
  }, [allPositions]);

  const hasRunningAgent = agentData?.activities?.some((a) => a.status === 'RUNNING');

  const goToTab = (tab: string) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500 pb-24">
      {/* ================= DASHBOARD HEADER ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 via-indigo-500/20 to-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-3xl font-bold tracking-tight text-foreground glow-text-white">
                  Executive Dashboard
                </h1>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono font-bold">
                  Live Portfolio Telemetry
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Instant portfolio posture, prior-day market performance & tactical AI opportunity radar.
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Controls */}
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

          {/* Broker Connectivity Badges */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-card/60 rounded-xl border border-border/60 text-[11px] font-mono">
            <span className="flex items-center gap-1" title={`IBKR: ${isIBConnected ? 'Connected' : 'Disconnected'}`}>
              <span className={cn('w-2 h-2 rounded-full', isIBConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400')} />
              IBKR
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="flex items-center gap-1" title={`Tastytrade: ${isTastyConnected ? 'Connected' : 'Disconnected'}`}>
              <span className={cn('w-2 h-2 rounded-full', isTastyConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400')} />
              Tastytrade
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="flex items-center gap-1" title={`Trading 212: ${isT212Connected ? 'Connected' : 'Disconnected'}`}>
              <span className={cn('w-2 h-2 rounded-full', isT212Connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400')} />
              Trading 212
            </span>
          </div>

          {/* Toggle Top Portfolio Balances Ribbon */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBalancesOpen((prev) => !prev)}
            className={cn(
              "h-9 text-xs gap-1.5 border-border/70 hover:bg-accent/40 font-semibold transition-all",
              isBalancesOpen ? "bg-primary/10 border-primary/40 text-primary" : "text-muted-foreground"
            )}
            title={isBalancesOpen ? 'Hide Top Portfolio Balances' : 'Show Top Portfolio Balances'}
          >
            <Wallet className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Balances</span>
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isBalancesOpen && "rotate-180")} />
          </Button>

          {/* Privacy Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={togglePrivacy}
            className="h-9 text-xs gap-1.5 border-border/70 hover:bg-accent/40"
            title={isPrivacyMode ? 'Show Balances' : 'Hide Balances'}
          >
            {isPrivacyMode ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isPrivacyMode ? 'Masked' : 'Visible'}</span>
          </Button>

          {/* Send PDF Briefing to Telegram */}
          <div className="flex items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendReportMutation.mutate()}
              disabled={sendReportMutation.isPending}
              className="h-9 text-xs gap-1.5 font-bold bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/35 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.15)] transition-all rounded-r-none border-r-0"
              title="Synthesize and upload executive PDF briefing directly to your phone via Telegram"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              {sendReportMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Send className="w-3 h-3 text-sky-400" />
                  <span>PDF Briefing</span>
                </>
              )}
            </Button>
            <a
              href="/api/telegram/preview-report-pdf"
              target="_blank"
              rel="noreferrer"
              className="h-9 px-2 flex items-center justify-center rounded-r-lg border border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 transition-colors"
              title="Preview / Download raw PDF in browser"
            >
              <ExternalLink className="w-3 h-3 text-sky-400" />
            </a>
          </div>

          {/* Theme & Stylings Switcher */}
          <ThemeSwitcherButton variant="header" />

          {/* Refresh Balances */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchBalances()}
            className="h-9 text-xs gap-1.5 border-border/70 hover:bg-accent/40"
            title="Refresh live quotes and broker balances"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isBalancesLoading ? 'animate-spin' : '')} />
            <span className="hidden sm:inline">Sync</span>
          </Button>

          {/* Buying Power & Margin Risk Analyser Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBuyingPowerModalOpen(true)}
            className="h-9 text-xs gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 font-bold transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)]"
            title="Open Buying Power & Margin Risk Analyser"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Buying Power</span>
          </Button>

          {/* AI Idea Hunter Button */}
          <Button
            size="sm"
            onClick={() => setIsAIModalOpen(true)}
            className="h-9 px-4 gap-2 font-bold text-xs bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            AI Idea Hunter
          </Button>
        </div>
      </div>

      {/* ================= 1. EXECUTIVE KPI STATS RIBBON (COLLAPSIBLE) ================= */}
      {isBalancesOpen ? (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-primary" /> Top Portfolio Balances & Net Liquidation
            </span>
            <button
              onClick={() => setIsBalancesOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <span>Hide Balances</span>
              <ChevronUp className="w-3 h-3" />
            </button>
          </div>
          <ExecutiveStatsRibbon
            balancesData={balancesData}
            positions={allPositions}
            isPrivacyMode={isPrivacyMode}
            onTogglePrivacy={togglePrivacy}
            onOpenThetaBreakdown={() => setIsThetaModalOpen(true)}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/20 hover:bg-card/40 transition-colors p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="w-3.5 h-3.5 text-primary/80" />
            <span>Top Portfolio Balances is collapsed</span>
            {netLiq > 0 && !isPrivacyMode && (
              <span className="text-foreground font-mono font-semibold hidden md:inline">
                • Net Liq: ${netLiq.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            )}
            {portfolioTheta.totalOptionsCount > 0 && !isPrivacyMode && (
              <button
                type="button"
                onClick={() => setIsThetaModalOpen(true)}
                className="hover:underline cursor-pointer transition-transform active:scale-95 focus:outline-none"
                title="Click to view option positions providing this Theta"
              >
                <span className={cn("font-mono font-bold hidden sm:inline", portfolioTheta.totalDailyTheta >= 0 ? "text-emerald-400" : "text-amber-400")}>
                  • Theta: {portfolioTheta.totalDailyTheta >= 0 ? '+' : ''}${portfolioTheta.totalDailyTheta.toFixed(0)}/d
                </span>
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsBalancesOpen(true)}
            className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 font-semibold"
          >
            <span>Show Balances</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* ================= 2. YESTERDAY RECAP & MOVERS SPOTLIGHT ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Yesterday & Overnight Market Pulse */}
        <YesterdayRecapCard
          positions={allPositions}
          yesterdayPnL={yesterdayPnL}
          totalPortfolioValue={netLiq}
          isLoading={(isQuotesLoading && Object.keys(portfolioQuotes).length === 0) || allPositions.length === 0}
          isPrivacyMode={isPrivacyMode}
          onNavigateToPortfolio={() => goToTab('portfolio')}
          onNavigateToResearch={onNavigateToResearch}
        />

        {/* Movers Spotlight (Today, Yesterday, 1W, 1M) */}
        <DashboardMoversCard
          positions={allPositions}
          onNavigateToPortfolio={() => goToTab('portfolio')}
          onNavigateToResearch={onNavigateToResearch}
        />
      </div>

      {/* ================= 3. AI DIP & OPPORTUNITY RADAR ================= */}
      <DipOpportunityRadarCard
        onNavigateToPortfolio={() => goToTab('portfolio')}
        onNavigateToWatchlist={() => goToTab('watchlist')}
        onNavigateToResearch={onNavigateToResearch}
      />

      {/* ================= 4. EQUITY CURVE & CORE WIDGETS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Real Equity Curve, Triggered Alerts & Options Radar */}
        <div className="lg:col-span-2 space-y-6">
          {/* Unified Portfolio Equity Curve */}
          <PortfolioChart
            currentNetLiq={netLiq}
            dayPnL={dayPnL}
            onNavigateToPortfolio={() => goToTab('portfolio')}
          />

          {/* Side-by-side Alerts & Options Defense */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Triggered & Active Alerts Card */}
            <DashboardAlertsCard
              onNavigateToAlerts={() => goToTab('alerts')}
              onNavigateToResearch={onNavigateToResearch}
            />

            {/* Options Expiry & Defense Radar */}
            <OptionsRadarCard
              positions={allPositions}
              onNavigateToPortfolio={() => goToTab('portfolio')}
              onNavigateToResearch={onNavigateToResearch}
            />
          </div>

          {/* Latest Portfolio Buys & Sells */}
          <DashboardTradesCard
            onNavigateToTrades={() => goToTab('trades')}
            onNavigateToResearch={onNavigateToResearch}
          />
        </div>

        {/* Right 1 Col: Live Watchlist & Trading Ideas */}
        <div className="space-y-6">
          {/* Trading Ideas Widget */}
          <IdeasCard
            onNavigateToIdeas={() => goToTab('ideas')}
            onNavigateToResearch={onNavigateToResearch}
          />

          {/* Live Watchlist Widget */}
          <WatchlistCard
            onNavigateToWatchlist={() => goToTab('watchlist')}
            onNavigateToResearch={onNavigateToResearch}
          />
        </div>
      </div>

      {/* AI Idea Generator Modal */}
      <AIIdeaGeneratorModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
      />

      {/* Buying Power & Margin Risk Analyser Modal */}
      <BuyingPowerAnalyserModal
        isOpen={isBuyingPowerModalOpen}
        onClose={() => setIsBuyingPowerModalOpen(false)}
        onNavigateToTrades={() => goToTab('trades')}
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
        positions={allPositions}
        onOpenAdvisorForPosition={(pos) => {
          setAdvisorPosition(pos);
          setIsAdvisorOpen(true);
        }}
        onNavigateToResearch={onNavigateToResearch}
        onNavigateToGraphs={onNavigateToGraphs || ((sym?: string) => {
          goToTab('graphs');
          if (sym) {
            window.dispatchEvent(new CustomEvent('select-graphs-ticker', { detail: sym }));
          }
        })}
      />

      {/* Portfolio Theta Breakdown Modal */}
      <ThetaBreakdownModal
        isOpen={isThetaModalOpen}
        onClose={() => setIsThetaModalOpen(false)}
        positions={allPositions}
        netLiq={netLiq}
        onNavigateToResearch={onNavigateToResearch}
        onOpenAdvisorForPosition={(pos) => {
          setAdvisorPosition(pos);
          setIsAdvisorOpen(true);
        }}
      />
    </div>
  );
}
