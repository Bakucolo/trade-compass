import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Globe,
  ArrowRightLeft,
  DollarSign,
  Coins,
  TrendingUp,
  TrendingDown,
  Wallet,
  Zap,
  Layers,
  PieChart,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DualCurrencySummary, PortfolioBalancesData } from '@/services/portfolioBalanceService';

interface DualCurrencyComparisonCardProps {
  portfolioData?: PortfolioBalancesData;
  currencyMode: 'USD' | 'GBP' | 'DUAL';
  onCurrencyModeChange: (mode: 'USD' | 'GBP' | 'DUAL') => void;
  isPrivacyMode: boolean;
  onTogglePrivacy: () => void;
}

export function DualCurrencyComparisonCard({
  portfolioData,
  currencyMode,
  onCurrencyModeChange,
  isPrivacyMode,
  onTogglePrivacy,
}: DualCurrencyComparisonCardProps) {
  const dual = portfolioData?.dualCurrency;
  const total = portfolioData?.total;

  const fxRateGbpUsd = dual?.fxRateGbpUsd || 1.302;
  const fxRateUsdGbp = dual?.fxRateUsdGbp || (1 / fxRateGbpUsd);

  // USD Numbers
  const totalNetUSD = dual?.totalNetLiqUSD ?? total?.netLiquidatingValue ?? 0;
  const totalCashUSD = dual?.totalCashUSD ?? total?.cash ?? 0;
  const totalPositionsUSD = dual?.totalPositionsValueUSD ?? ((total?.equitiesValue || 0) + (total?.optionsValue || 0));
  const totalBPUSD = dual?.totalBPUSD ?? total?.buyingPower ?? 0;
  const totalUnrealizedPnLUSD = dual?.totalUnrealizedPnLUSD ?? total?.unrealizedPnL ?? 0;
  const totalDayPnLUSD = dual?.totalDayPnLUSD ?? total?.dayPnL ?? 0;

  // GBP Numbers
  const totalNetGBP = dual?.totalNetLiqGBP ?? (totalNetUSD * fxRateUsdGbp);
  const totalCashGBP = dual?.totalCashGBP ?? (totalCashUSD * fxRateUsdGbp);
  const totalPositionsGBP = dual?.totalPositionsValueGBP ?? (totalPositionsUSD * fxRateUsdGbp);
  const totalBPGBP = dual?.totalBPGBP ?? (totalBPUSD * fxRateUsdGbp);
  const totalUnrealizedPnLGBP = dual?.totalUnrealizedPnLGBP ?? (totalUnrealizedPnLUSD * fxRateUsdGbp);
  const totalDayPnLGBP = dual?.totalDayPnLGBP ?? (totalDayPnLUSD * fxRateUsdGbp);

  // Native Split
  const nativeUsdValUSD = dual?.nativeUsdHoldingsUSD || 0;
  const nativeGbpValUSD = dual?.nativeGbpHoldingsUSD || 0;
  const nativeUsdShare = totalNetUSD > 0 ? (nativeUsdValUSD / totalNetUSD) * 100 : 70;
  const nativeGbpShare = totalNetUSD > 0 ? (nativeGbpValUSD / totalNetUSD) * 100 : 30;

  const fmtUSD = (val: number, isPnL = false) => {
    if (isPrivacyMode) return '••••••';
    const prefix = isPnL ? (val >= 0 ? '+' : '-') : '';
    return `${prefix}$${Math.abs(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const fmtGBP = (val: number, isPnL = false) => {
    if (isPrivacyMode) return '••••••';
    const prefix = isPnL ? (val >= 0 ? '+' : '-') : '';
    return `${prefix}£${Math.abs(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <Card className="glass-card border border-border/60 bg-gradient-to-br from-card/80 via-card/50 to-background/90 shadow-xl rounded-2xl overflow-hidden relative">
      <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-indigo-500" />

      <CardHeader className="p-5 pb-3 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  Total Currency Balances & Bridge
                </CardTitle>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[10px] font-mono">
                  GBP (£) ⇄ USD ($)
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Real-time unified totals cross-converted between British Pounds (GBP) and US Dollars (USD)
              </CardDescription>
            </div>
          </div>

          {/* Mode Switcher & FX Pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-background/60 p-1 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => onCurrencyModeChange('USD')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all",
                  currencyMode === 'USD'
                    ? "bg-cyan-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                🇺🇸 USD ($)
              </button>
              <button
                type="button"
                onClick={() => onCurrencyModeChange('GBP')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all",
                  currencyMode === 'GBP'
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                🇬🇧 GBP (£)
              </button>
              <button
                type="button"
                onClick={() => onCurrencyModeChange('DUAL')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all",
                  currencyMode === 'DUAL'
                    ? "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                💱 Dual View
              </button>
            </div>

            <button
              type="button"
              onClick={onTogglePrivacy}
              className="p-1.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              title={isPrivacyMode ? 'Show Balances' : 'Hide Balances'}
            >
              {isPrivacyMode ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Live FX Rates Ribbon */}
        <div className="flex items-center justify-between gap-2 pt-2 text-[11px] font-mono text-muted-foreground flex-wrap">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 bg-background/40 px-2 py-0.5 rounded-md border border-border/40">
              <span className="text-foreground font-bold">1 GBP</span> = <strong className="text-emerald-400">${fxRateGbpUsd.toFixed(4)} USD</strong>
            </span>
            <span className="flex items-center gap-1 bg-background/40 px-2 py-0.5 rounded-md border border-border/40">
              <span className="text-foreground font-bold">1 USD</span> = <strong className="text-cyan-400">£{fxRateUsdGbp.toFixed(4)} GBP</strong>
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Synchronized across IBKR, Tastytrade & Trading 212
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* ================= 1. PRIMARY TOTALS DUAL DISPLAY ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Net Liquidation */}
          <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1.5 relative group hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-primary" /> Net Liquidation
              </span>
              <Badge className="bg-primary/10 text-primary border-primary/30 text-[9px] font-mono">
                Total Wealth
              </Badge>
            </div>
            <div className={cn("space-y-0.5", isPrivacyMode && "blur-md select-none opacity-60")}>
              <div className="text-2xl font-black font-mono text-cyan-300">
                {fmtUSD(totalNetUSD)}
              </div>
              <div className="text-lg font-bold font-mono text-emerald-400">
                {fmtGBP(totalNetGBP)}
              </div>
            </div>
          </div>

          {/* Cash Reserves */}
          <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1.5 relative group hover:border-emerald-500/50 transition-all">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-400" /> Cash Reserves
              </span>
              <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[9px] font-mono">
                Uninvested
              </Badge>
            </div>
            <div className={cn("space-y-0.5", isPrivacyMode && "blur-md select-none opacity-60")}>
              <div className="text-2xl font-black font-mono text-cyan-300">
                {fmtUSD(totalCashUSD)}
              </div>
              <div className="text-lg font-bold font-mono text-emerald-400">
                {fmtGBP(totalCashGBP)}
              </div>
            </div>
          </div>

          {/* Total Buying Power */}
          <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1.5 relative group hover:border-amber-500/50 transition-all">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Buying Power
              </span>
              <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-[9px] font-mono">
                Leverage
              </Badge>
            </div>
            <div className={cn("space-y-0.5", isPrivacyMode && "blur-md select-none opacity-60")}>
              <div className="text-2xl font-black font-mono text-amber-400">
                {fmtUSD(totalBPUSD)}
              </div>
              <div className="text-lg font-bold font-mono text-amber-300/80">
                {fmtGBP(totalBPGBP)}
              </div>
            </div>
          </div>

          {/* Total Open P&L */}
          <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1.5 relative group hover:border-purple-500/50 transition-all">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-purple-400" /> Open P&L
              </span>
              <Badge className={cn("text-[9px] font-mono", totalUnrealizedPnLUSD >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
                Cumulative
              </Badge>
            </div>
            <div className={cn("space-y-0.5 font-mono", isPrivacyMode && "blur-md select-none opacity-60")}>
              <div className={cn("text-2xl font-black", totalUnrealizedPnLUSD >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {fmtUSD(totalUnrealizedPnLUSD, true)}
              </div>
              <div className={cn("text-lg font-bold opacity-90", totalUnrealizedPnLGBP >= 0 ? "text-emerald-300" : "text-rose-300")}>
                {fmtGBP(totalUnrealizedPnLGBP, true)}
              </div>
            </div>
          </div>
        </div>

        {/* ================= 2. NATIVE ASSET CURRENCY SPLIT BAR ================= */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-border/40 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-muted-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-cyan-400" />
              Native Underlying Currency Allocation
            </span>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="text-cyan-400">🇺🇸 USD Assets: {nativeUsdShare.toFixed(1)}%</span>
              <span className="text-emerald-400">🇬🇧 GBP Assets: {nativeGbpShare.toFixed(1)}%</span>
            </div>
          </div>

          {/* Allocation Bar */}
          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
            <div
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-500"
              style={{ width: `${Math.max(5, nativeUsdShare)}%` }}
              title={`USD Assets: ${fmtUSD(nativeUsdValUSD)} (${nativeUsdShare.toFixed(1)}%)`}
            />
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all duration-500"
              style={{ width: `${Math.max(5, nativeGbpShare)}%` }}
              title={`GBP Assets: ${fmtGBP(dual?.nativeGbpHoldingsGBP || 0)} (${nativeGbpShare.toFixed(1)}%)`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 flex-wrap gap-2 font-mono">
            <span>
              🇺🇸 US Equities & Options: <strong className="text-foreground">{fmtUSD(nativeUsdValUSD)}</strong> ({fmtGBP(dual?.nativeUsdHoldingsGBP || 0)})
            </span>
            <span>
              🇬🇧 UK Equities & Cash: <strong className="text-foreground">{fmtGBP(dual?.nativeGbpHoldingsGBP || 0)}</strong> ({fmtUSD(nativeGbpValUSD)})
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
