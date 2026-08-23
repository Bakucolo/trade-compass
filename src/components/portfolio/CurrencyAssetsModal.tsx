import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Globe2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowRight,
  ExternalLink,
  Wallet,
  Coins,
  Search,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { UnifiedPosition } from './types';
import { CurrencyBalance, PortfolioBalancesData } from '@/services/portfolioBalanceService';
import { cn } from '@/lib/utils';

interface CurrencyAssetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCurrency: string | null;
  onSelectCurrency: (currency: string) => void;
  positions: UnifiedPosition[];
  portfolioData?: PortfolioBalancesData;
  isPrivacyMode?: boolean;
  onNavigateToResearch?: (symbol: string) => void;
}

const currencyColorMap: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  USD: { bg: 'bg-emerald-950/20', text: 'text-emerald-400', border: 'border-emerald-500/40', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  GBP: { bg: 'bg-amber-950/20', text: 'text-amber-400', border: 'border-amber-500/40', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  EUR: { bg: 'bg-blue-950/20', text: 'text-blue-400', border: 'border-blue-500/40', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  CAD: { bg: 'bg-purple-950/20', text: 'text-purple-400', border: 'border-purple-500/40', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  AUD: { bg: 'bg-cyan-950/20', text: 'text-cyan-400', border: 'border-cyan-500/40', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  CHF: { bg: 'bg-rose-950/20', text: 'text-rose-400', border: 'border-rose-500/40', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  JPY: { bg: 'bg-indigo-950/20', text: 'text-indigo-400', border: 'border-indigo-500/40', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
};

const currencySymbols: Record<string, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
  CAD: 'CA$',
  AUD: 'A$',
  CHF: 'Fr.',
  JPY: '¥',
};

export function CurrencyAssetsModal({
  isOpen,
  onClose,
  selectedCurrency,
  onSelectCurrency,
  positions = [],
  portfolioData,
  isPrivacyMode = false,
  onNavigateToResearch,
}: CurrencyAssetsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState<'ALL' | 'STOCK' | 'OPTION'>('ALL');

  const currKey = (selectedCurrency || 'USD').toUpperCase();
  const colors = currencyColorMap[currKey] || {
    bg: 'bg-slate-900/40',
    text: 'text-foreground',
    border: 'border-border/60',
    badge: 'bg-muted/40 text-muted-foreground border-border/60'
  };

  const currencySymbol = currencySymbols[currKey] || currKey;

  // Multi-currency ledger data from server
  const allCurrencies = portfolioData?.currencies || {};
  const currentCurrencyData: CurrencyBalance | undefined = allCurrencies[currKey];
  const fxRate = currentCurrencyData?.fxRateToUSD || (currKey === 'USD' ? 1.0 : 1.0);
  const totalPortfolioNetLiq = portfolioData?.total?.netLiquidatingValue || 1;

  // Filter positions belonging to this currency
  const currencyPositions = useMemo(() => {
    return positions.filter((p) => {
      if (!p) return false;
      const pCurr = (p.currency || '').toUpperCase();
      const sym = (p.symbol || '').toUpperCase();

      if (currKey === 'GBP') {
        if (pCurr === 'GBP' || pCurr === 'GBX' || sym.endsWith('.L')) return true;
      } else if (currKey === 'CAD') {
        if (pCurr === 'CAD' || sym.endsWith('.TO') || sym.endsWith('.V')) return true;
      } else if (currKey === 'EUR') {
        if (pCurr === 'EUR' || sym.endsWith('.PA') || sym.endsWith('.DE') || sym.endsWith('.AS') || sym.endsWith('.MC') || sym.endsWith('.MI')) return true;
      } else if (currKey === 'AUD') {
        if (pCurr === 'AUD' || sym.endsWith('.AX')) return true;
      } else if (currKey === 'USD') {
        if (pCurr === 'USD' || (!pCurr && !sym.includes('.')) || p.source === 'Tastytrade') {
          // Exclude foreign suffixes
          if (sym.endsWith('.L') || sym.endsWith('.TO') || sym.endsWith('.PA') || sym.endsWith('.DE')) return false;
          return true;
        }
      } else {
        if (pCurr === currKey) return true;
      }
      return false;
    });
  }, [positions, currKey]);

  // Apply search and asset type filters
  const filteredPositions = useMemo(() => {
    return currencyPositions.filter((p) => {
      if (assetTypeFilter === 'STOCK' && p.assetType === 'Option') return false;
      if (assetTypeFilter === 'OPTION' && p.assetType !== 'Option') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.symbol.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.underlyingSymbol && p.underlyingSymbol.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [currencyPositions, searchQuery, assetTypeFilter]);

  // Aggregated totals in this currency
  const totalMarketValueUSD = useMemo(() => {
    return currencyPositions.reduce((sum, p) => sum + (p.marketValue || 0), 0);
  }, [currencyPositions]);

  const totalUnrealizedPLUSD = useMemo(() => {
    return currencyPositions.reduce((sum, p) => sum + (p.unrealizedPL || 0), 0);
  }, [currencyPositions]);

  const totalDayPLUSD = useMemo(() => {
    return currencyPositions.reduce((sum, p) => sum + (p.dayChange || 0), 0);
  }, [currencyPositions]);

  const cashUSD = currentCurrencyData?.cash ? currentCurrencyData.cash * fxRate : 0;
  const netLiqUSD = currentCurrencyData?.netLiqUSD || (totalMarketValueUSD + cashUSD);
  const shareOfPortfolio = totalPortfolioNetLiq > 0 ? (netLiqUSD / totalPortfolioNetLiq) * 100 : 0;

  const formatUSD = (val?: number) => {
    if (val === undefined || isNaN(val)) return '$0.00';
    if (isPrivacyMode) return '****';
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNative = (valInUSD?: number) => {
    if (valInUSD === undefined || isNaN(valInUSD)) return `${currencySymbol}0.00`;
    if (isPrivacyMode) return '****';
    const nativeVal = fxRate > 0 ? valInUSD / fxRate : valInUSD;
    return `${currencySymbol}${nativeVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleAssetClick = (symbol: string) => {
    const cleanSym = symbol.includes(' ') ? symbol.split(' ')[0] : symbol;
    if (onNavigateToResearch) {
      onNavigateToResearch(cleanSym);
      onClose();
    } else {
      window.dispatchEvent(new CustomEvent('select-research-ticker', { detail: cleanSym }));
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-card/95 border-border/80 backdrop-blur-2xl shadow-2xl rounded-2xl">
        {/* ================= MODAL HEADER ================= */}
        <DialogHeader className="p-5 pb-4 border-b border-border/60 bg-slate-950/40 relative shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-6">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-2xl border flex items-center justify-center font-mono font-black text-base shadow-sm", colors.bg, colors.border, colors.text)}>
                {currKey}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                    {currKey} Holdings & FX Exposure
                  </DialogTitle>
                  <Badge variant="outline" className={cn("text-[10px] font-mono font-bold", colors.badge)}>
                    {currencySymbol} • {shareOfPortfolio.toFixed(1)}% of Portfolio
                  </Badge>
                  {fxRate !== 1.0 && (
                    <Badge variant="secondary" className="text-[10px] font-mono text-muted-foreground">
                      1 {currKey} = ${fxRate.toFixed(4)} USD
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  All equity holdings, option contracts, and liquid cash balances denominated in {currKey}.
                </DialogDescription>
              </div>
            </div>

            {/* Quick Currency Switcher Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {Object.keys(allCurrencies).map((currencyCode) => {
                const isSelected = currencyCode.toUpperCase() === currKey;
                const cColors = currencyColorMap[currencyCode.toUpperCase()] || { text: 'text-foreground', border: 'border-border/50' };
                return (
                  <button
                    key={currencyCode}
                    onClick={() => onSelectCurrency(currencyCode.toUpperCase())}
                    className={cn(
                      "px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm ring-1 ring-primary/40"
                        : "bg-card/60 border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    )}
                  >
                    {currencyCode}
                  </button>
                );
              })}
            </div>
          </div>
        </DialogHeader>

        {/* ================= TELEMETRY STATS BAR ================= */}
        <div className="p-5 border-b border-border/40 bg-accent/5 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          {/* Total Net Liq */}
          <div className="p-3 rounded-xl bg-card/60 border border-border/50 font-mono">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">
              Total {currKey} Net Liq
            </span>
            <div className="text-base font-bold text-foreground mt-0.5">
              {formatUSD(netLiqUSD)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Native: {formatNative(netLiqUSD)}
            </div>
          </div>

          {/* Asset Market Value */}
          <div className="p-3 rounded-xl bg-card/60 border border-border/50 font-mono">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">
              Equities & Options
            </span>
            <div className="text-base font-bold text-foreground mt-0.5">
              {formatUSD(totalMarketValueUSD)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {currencyPositions.length} Positions
            </div>
          </div>

          {/* Cash Balance */}
          <div className="p-3 rounded-xl bg-card/60 border border-border/50 font-mono">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">
              Cash Balance ({currKey})
            </span>
            <div className="text-base font-bold text-foreground mt-0.5">
              {formatUSD(cashUSD)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Native: {formatNative(cashUSD)}
            </div>
          </div>

          {/* Unrealized P&L */}
          <div className="p-3 rounded-xl bg-card/60 border border-border/50 font-mono">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">
              Total Unrealized P&L
            </span>
            <div className={cn("text-base font-bold mt-0.5", totalUnrealizedPLUSD >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {totalUnrealizedPLUSD >= 0 ? '+' : ''}{formatUSD(totalUnrealizedPLUSD)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Day: {totalDayPLUSD >= 0 ? '+' : ''}{formatUSD(totalDayPLUSD)}
            </div>
          </div>
        </div>

        {/* ================= FILTER & SEARCH BAR ================= */}
        <div className="p-4 border-b border-border/40 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <Button
              variant={assetTypeFilter === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAssetTypeFilter('ALL')}
              className="h-7 text-xs font-semibold"
            >
              All ({currencyPositions.length})
            </Button>
            <Button
              variant={assetTypeFilter === 'STOCK' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAssetTypeFilter('STOCK')}
              className="h-7 text-xs font-semibold"
            >
              Stocks ({currencyPositions.filter(p => p.assetType !== 'Option').length})
            </Button>
            <Button
              variant={assetTypeFilter === 'OPTION' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAssetTypeFilter('OPTION')}
              className="h-7 text-xs font-semibold"
            >
              Options ({currencyPositions.filter(p => p.assetType === 'Option').length})
            </Button>
          </div>

          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${currKey} assets...`}
              className="w-full h-7 text-xs pl-8 pr-3 bg-card/60 border border-border/70 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 uppercase font-mono"
            />
          </div>
        </div>

        {/* ================= ASSETS TABLE ================= */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredPositions.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Coins className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <h4 className="text-sm font-bold text-foreground">No Assets Found in {currKey}</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {currencyPositions.length > 0
                  ? 'No positions match your search or asset type filter.'
                  : `You hold ${formatNative(cashUSD)} in ${currKey} cash, with no active stock or option holdings.`}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden bg-card/40">
              <table className="w-full text-xs text-left font-mono">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border/40 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3 pl-4">Asset / Ticker</th>
                    <th className="p-3">Type / Broker</th>
                    <th className="p-3 text-right">Shares / Qty</th>
                    <th className="p-3 text-right">Price ({currKey})</th>
                    <th className="p-3 text-right">Market Value ({currKey} & USD)</th>
                    <th className="p-3 text-right">Unrealized P&L</th>
                    <th className="p-3 text-right">Day Change</th>
                    <th className="p-3 pr-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredPositions.map((pos) => {
                    const isPositivePL = (pos.unrealizedPL || 0) >= 0;
                    const isPositiveDay = (pos.dayChange || 0) >= 0;
                    const shareInCurr = totalMarketValueUSD > 0 ? (pos.marketValue / totalMarketValueUSD) * 100 : 0;

                    return (
                      <tr
                        key={pos.id || pos.symbol}
                        className="hover:bg-accent/30 transition-colors group cursor-pointer"
                        onClick={() => handleAssetClick(pos.symbol)}
                      >
                        {/* Symbol & Name */}
                        <td className="p-3 pl-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                              {pos.symbol}
                            </span>
                            {pos.primaryTheme && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-white/10 text-muted-foreground hidden sm:inline-block">
                                {pos.primaryTheme}
                              </Badge>
                            )}
                          </div>
                          {pos.description && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                              {pos.description}
                            </div>
                          )}
                        </td>

                        {/* Type & Broker */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] font-bold px-1.5 py-0",
                                pos.assetType === 'Option'
                                  ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                                  : "bg-blue-500/10 text-blue-300 border-blue-500/30"
                              )}
                            >
                              {pos.assetType}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {pos.source}
                            </span>
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="p-3 text-right font-semibold text-foreground">
                          {pos.quantity}
                        </td>

                        {/* Native Price */}
                        <td className="p-3 text-right">
                          <div className="font-bold text-foreground">
                            {formatNative(pos.currentPrice * (fxRate || 1))}
                          </div>
                          {fxRate !== 1.0 && (
                            <div className="text-[10px] text-muted-foreground">
                              ${pos.currentPrice.toFixed(2)} USD
                            </div>
                          )}
                        </td>

                        {/* Market Value */}
                        <td className="p-3 text-right">
                          <div className="font-bold text-foreground">
                            {formatNative(pos.marketValue)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatUSD(pos.marketValue)} • {shareInCurr.toFixed(1)}%
                          </div>
                        </td>

                        {/* Unrealized P&L */}
                        <td className="p-3 text-right">
                          <div className={cn("font-bold flex items-center justify-end gap-1", isPositivePL ? "text-emerald-400" : "text-rose-400")}>
                            {isPositivePL ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            <span>{isPositivePL ? '+' : ''}{formatNative(pos.unrealizedPL)}</span>
                          </div>
                          <div className={cn("text-[10px]", isPositivePL ? "text-emerald-400/80" : "text-rose-400/80")}>
                            {isPositivePL ? '+' : ''}{pos.unrealizedPLPercent?.toFixed(2)}%
                          </div>
                        </td>

                        {/* Day Change */}
                        <td className="p-3 text-right">
                          <div className={cn("font-semibold", isPositiveDay ? "text-emerald-400" : "text-rose-400")}>
                            {isPositiveDay ? '+' : ''}{formatNative(pos.dayChange)}
                          </div>
                          <div className={cn("text-[10px]", isPositiveDay ? "text-emerald-400/80" : "text-rose-400/80")}>
                            {isPositiveDay ? '+' : ''}{pos.dayChangePercent?.toFixed(2)}%
                          </div>
                        </td>

                        {/* Action */}
                        <td className="p-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAssetClick(pos.symbol)}
                            className="h-7 px-2 text-[10px] text-primary hover:bg-primary/20 gap-1"
                            title="Open in Research Suite"
                          >
                            <span>Research</span>
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
