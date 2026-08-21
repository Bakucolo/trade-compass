
import { useEffect, useState, useMemo, useRef } from 'react';
import { useIBKRStatus, useIBKRPortfolio } from '../services/ibkr';
import { useTastytradePositions } from '../services/tastytrade';
import { usePortfolioBalances } from '../services/portfolioBalanceService';
import { marketDataService, StockQuote } from '../services/marketData';
import { convertIbkrToOcc } from '../utils/optionUtils';
import { PortfolioSummary } from './portfolio/PortfolioSummary';
import { HoldingsTable } from './portfolio/HoldingsTable';
import { PortfolioAuditModal } from './portfolio/PortfolioAuditModal';
import { UnifiedPosition } from './portfolio/types';

import { Button } from './ui/button';
import { RefreshCw, Plus, Settings, Wallet, Layers, ShieldAlert, Sparkles } from 'lucide-react';
import { useToast } from './ui/use-toast';

export function BrokersPage() {
  const { toast } = useToast();

  // --- Real-time Broker Balances & Buying Power ---
  const { data: balancesData } = usePortfolioBalances();

  // --- IBKR State ---
  const { data: ibStatus } = useIBKRStatus();
  const { data: ibPortfolio, isLoading: isIBLoading } = useIBKRPortfolio();
  const isIBConnected = ibStatus?.connected ?? false;

  const { data: tastyPositions, isLoading: isTastyLoading } = useTastytradePositions();

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
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  const togglePrivacyMode = () => {
    setIsPrivacyMode(prev => {
      const newValue = !prev;
      localStorage.setItem('isPrivacyMode', String(newValue));
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
        source: p.broker?.name === 'Tastytrade' ? 'Tastytrade' : 'IBKR',
        assetType: p.assetType === 'OPTION' ? 'Option' : 'Stock',
        strike: p.strikePrice || undefined,
        optionType: p.assetType === 'OPTION' ? (p.optionType === 'C' || p.optionType === 'Call' ? 'Call' : 'Put') : undefined,
        expiry: p.expiryDate || undefined,
        underlyingSymbol: p.underlyingSymbol || undefined,
        underlyingPrice: underlyingPrice,
        currency: p.currency || 'USD',
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground glow-text-white">Portfolio Command</h1>
          <p className="text-muted-foreground">Real-time cross-brokerage analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsAuditModalOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Portfolio Analyser
          </Button>

          <Button variant="outline" size="sm" onClick={refreshPrices} disabled={isAggregating} className="text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isAggregating ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        </div>
      </div>

      {/* Portfolio Summary Cards */}
      <PortfolioSummary
        netLiquidValue={balancesData?.total?.netLiquidatingValue && balancesData.total.netLiquidatingValue > 0 ? balancesData.total.netLiquidatingValue : totals.netLiquidValue}
        dailyPL={balancesData?.total?.dayPnL !== undefined && balancesData.total.dayPnL !== 0 ? balancesData.total.dayPnL : totals.dailyPL}
        dailyPLPercent={portfolioDailyPercent || 0}
        unrealizedPL={balancesData?.total?.unrealizedPnL !== undefined && balancesData.total.unrealizedPnL !== 0 ? balancesData.total.unrealizedPnL : totals.unrealizedPL}
        buyingPower={balancesData?.total?.buyingPower ?? totals.buyingPower}
        connectedSources={{
          ibkr: isIBConnected,
          tastytrade: balancesData?.brokers?.tastytrade?.status === 'connected' || balancesData?.brokers?.tastytrade?.status === 'active' || true
        }}
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacy={togglePrivacyMode}
        accountBreakdown={{
          ibkr: balancesData?.brokers?.ibkr?.netLiquidatingValue || totals.ibkrTotal,
          tastytrade: balancesData?.brokers?.tastytrade?.netLiquidatingValue || totals.tastyTotal
        }}
        brokerBalances={balancesData?.brokers}
        portfolioData={balancesData}
      />

      {/* Main Holdings Table */}
      <HoldingsTable
        positions={unifiedPositions}
        isLoading={(isIBLoading || isTastyLoading) && unifiedPositions.length === 0}
        onRefresh={refreshPrices}
        isPrivacyMode={isPrivacyMode}
      />

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

      <div className="text-xs text-muted-foreground text-center pt-4">
        Last Updated: {lastUpdated.toLocaleTimeString()}
      </div>
    </div>
  );
}
