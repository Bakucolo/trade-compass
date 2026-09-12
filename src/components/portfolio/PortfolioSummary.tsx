import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  EyeOff,
  ShieldAlert,
  Zap,
  Layers,
  CircleDollarSign,
  Maximize2,
  Scale,
  Calendar,
  Wallet,
  TrendingUp,
  PieChart,
  Activity,
  Coins,
  ChevronDown,
  ChevronUp,
  Globe2,
  DollarSign
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BrokerAccountBalance, IBKRCombinedBalance, IBKRAccountDetails, PortfolioBalancesData, CurrencyBalance } from "@/services/portfolioBalanceService";
import { BrokerDeepDiveModal } from "./BrokerDeepDiveModal";
import { CurrencyAssetsModal } from "./CurrencyAssetsModal";
import { BuyingPowerAnalyserModal } from "./BuyingPowerAnalyserModal";
import { DualCurrencyComparisonCard } from "./DualCurrencyComparisonCard";
import { UnifiedPosition } from "./types";
import { calculatePortfolioTheta } from "@/utils/greeksUtils";
import { ThetaBreakdownModal } from "@/components/dashboard/ThetaBreakdownModal";

interface PortfolioSummaryProps {
  netLiquidValue: number;
  dailyPL: number;
  dailyPLPercent: number;
  unrealizedPL: number;
  buyingPower: number;
  connectedSources: {
    ibkr: boolean;
    tastytrade: boolean;
    trading212?: boolean;
  };
  isPrivacyMode: boolean;
  onTogglePrivacy: () => void;
  accountBreakdown: {
    ibkr: number;
    tastytrade: number;
    trading212?: number;
  };
  brokerBalances?: {
    ibkr?: IBKRCombinedBalance;
    tastytrade?: BrokerAccountBalance;
    trading212?: BrokerAccountBalance;
  };
  portfolioData?: PortfolioBalancesData;
  positions?: UnifiedPosition[];
  onNavigateToResearch?: (symbol: string) => void;
}

export function PortfolioSummary({
  netLiquidValue,
  dailyPL,
  dailyPLPercent,
  unrealizedPL,
  buyingPower,
  connectedSources,
  isPrivacyMode,
  onTogglePrivacy,
  accountBreakdown,
  brokerBalances,
  portfolioData,
  positions = [],
  onNavigateToResearch
}: PortfolioSummaryProps) {
  const [selectedBrokerKey, setSelectedBrokerKey] = useState<'ibkr' | 'tastytrade' | 'trading212' | null>(null);
  const [activeIbkrAccountTab, setActiveIbkrAccountTab] = useState<string>('combined');
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'GBP' | 'DUAL'>('DUAL');
  const [isCurrencyBreakdownOpen, setIsCurrencyBreakdownOpen] = useState(true);
  const [selectedCurrencyForModal, setSelectedCurrencyForModal] = useState<string | null>(null);
  const [isBuyingPowerModalOpen, setIsBuyingPowerModalOpen] = useState(false);
  const [isThetaModalOpen, setIsThetaModalOpen] = useState(false);

  const isPositiveDay = dailyPL >= 0;
  const isPositiveTotal = unrealizedPL >= 0;

  // FX Rates & Conversion factors
  const fxRateGbpUsd = portfolioData?.dualCurrency?.fxRateGbpUsd || 1.302;
  const fxRateUsdGbp = portfolioData?.dualCurrency?.fxRateUsdGbp || (1 / fxRateGbpUsd);

  // Derived Combined IBKR numbers
  const ibkrCombined = brokerBalances?.ibkr;
  const ibkrAccounts: IBKRAccountDetails[] = ibkrCombined?.accounts || [];
  
  const fallbackIbkr: BrokerAccountBalance = {
    name: 'Interactive Brokers',
    status: 'disconnected',
    accountNumber: 'Combined (2 Accounts)',
    netLiquidatingValue: accountBreakdown?.ibkr || 0,
    cash: 0,
    buyingPower: (accountBreakdown?.ibkr || 0) * 0.5,
    unrealizedPnL: 0,
    dayPnL: 0,
    optionsCount: 0,
    optionsValue: 0,
    equitiesCount: 0,
    equitiesValue: 0,
  };

  // Active selected IBKR account or combined
  const activeIbkrAcct: BrokerAccountBalance | IBKRAccountDetails = (
    activeIbkrAccountTab === 'combined'
      ? (ibkrCombined || fallbackIbkr)
      : (ibkrAccounts.find(a => a.accountKey === activeIbkrAccountTab || a.accountNumber === activeIbkrAccountTab) || ibkrAccounts[0] || ibkrCombined || fallbackIbkr)
  ) || fallbackIbkr;

  const ibkrNet = activeIbkrAcct?.netLiquidatingValue ?? accountBreakdown?.ibkr ?? 0;
  const ibkrCash = activeIbkrAcct?.cash ?? 0;
  const ibkrBP = activeIbkrAcct?.buyingPower ?? (ibkrNet * 0.5);
  const ibkrMaint = activeIbkrAcct?.maintMargin ?? 0;
  const ibkrExcess = activeIbkrAcct?.excessLiquidity ?? 0;
  const ibkrCushion = activeIbkrAcct?.cushion ?? (ibkrNet > 0 ? (ibkrExcess / ibkrNet) * 100 : 50);
  const ibkrOptCount = activeIbkrAcct?.optionsCount ?? 0;
  const ibkrOptVal = activeIbkrAcct?.optionsValue ?? 0;
  const ibkrEqCount = activeIbkrAcct?.equitiesCount ?? 0;
  const ibkrEqVal = activeIbkrAcct?.equitiesValue ?? 0;

  // Combined totals across all IBKR accounts (for portfolio-level share)
  const ibkrTotalNetCombined = ibkrCombined?.netLiquidatingValue ?? accountBreakdown?.ibkr ?? 0;

  // Derived Tastytrade numbers
  const tasty = brokerBalances?.tastytrade;
  const tastyNet = tasty?.netLiquidatingValue ?? accountBreakdown?.tastytrade ?? 0;
  const tastyCash = tasty?.cash ?? 0;
  const tastyDerivBP = tasty?.derivativeBuyingPower ?? tasty?.buyingPower ?? (tastyNet * 0.5);
  const tastyEqBP = tasty?.equityBuyingPower ?? (tastyNet * 0.5);
  const tastyDayTradingBP = tasty?.dayTradingBuyingPower ?? 0;
  const tastyMaint = tasty?.maintMargin ?? 0;
  const tastyCushion = tasty?.cushion ?? 50;
  const tastyOptCount = tasty?.optionsCount ?? 0;
  const tastyOptVal = tasty?.optionsValue ?? 0;
  const tastyEqCount = tasty?.equitiesCount ?? 0;
  const tastyEqVal = tasty?.equitiesValue ?? 0;

  // Derived Trading 212 numbers
  const t212 = brokerBalances?.trading212;
  const t212NetUSD = t212?.netLiquidatingValue ?? accountBreakdown?.trading212 ?? 0;
  const t212NetGBP = t212?.netLiquidatingValueGBP ?? (t212NetUSD * fxRateUsdGbp);
  const t212CashUSD = t212?.cash ?? 0;
  const t212CashGBP = t212?.cashGBP ?? (t212CashUSD * fxRateUsdGbp);
  const t212InvestedGBP = t212?.investedGBP ?? (t212NetGBP - t212CashGBP);
  const t212UnPnLUSD = t212?.unrealizedPnL ?? 0;
  const t212UnPnLGBP = t212?.unrealizedPnLGBP ?? (t212UnPnLUSD * fxRateUsdGbp);
  const t212EqCount = t212?.equitiesCount ?? 0;
  const t212EqValUSD = t212?.equitiesValue ?? (t212InvestedGBP * fxRateGbpUsd);
  const isT212Connected = connectedSources.trading212 ?? (t212?.status === 'connected' || t212NetUSD > 0);

  // Global Unified Aggregates & Allocation in USD
  const totalCalculatedBP = (ibkrCombined?.buyingPower || ibkrBP) + tastyDerivBP + t212CashUSD;
  const totalNet = netLiquidValue > 0 ? netLiquidValue : (ibkrTotalNetCombined + tastyNet + t212NetUSD);

  // Overall Portfolio Theta Time Decay / Yield
  const portfolioTheta = useMemo(() => {
    return calculatePortfolioTheta(positions, totalNet);
  }, [positions, totalNet]);

  const ibkrPct = totalNet > 0 ? (ibkrTotalNetCombined / totalNet) * 100 : 33.3;
  const tastyPct = totalNet > 0 ? (tastyNet / totalNet) * 100 : 33.3;
  const t212Pct = totalNet > 0 ? (t212NetUSD / totalNet) * 100 : 33.3;

  const totalOptionsValue = Math.abs(ibkrCombined?.optionsValue ?? ibkrOptVal) + Math.abs(tastyOptVal);
  const totalEquitiesValue = Math.abs(ibkrCombined?.equitiesValue ?? ibkrEqVal) + Math.abs(tastyEqVal) + t212EqValUSD;
  const totalCashValue = Math.max(0, (ibkrCombined?.cash ?? ibkrCash) + tastyCash + t212CashUSD);

  const optionsPct = totalNet > 0 ? Math.min(100, (totalOptionsValue / totalNet) * 100) : 0;
  const equitiesPct = totalNet > 0 ? Math.min(100, (totalEquitiesValue / totalNet) * 100) : 0;
  const cashPct = totalNet > 0 ? Math.min(100, (totalCashValue / totalNet) * 100) : 0;

  const formatCurr = (val?: number, decimals = 2) => {
    if (val === undefined || val === null || isNaN(val)) return '$0.00';
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  const formatDynamicCurr = (valUSD?: number, decimals = 2) => {
    if (valUSD === undefined || valUSD === null || isNaN(valUSD)) {
      return currencyMode === 'GBP' ? '£0.00' : '$0.00';
    }
    if (currencyMode === 'GBP') {
      const valGBP = valUSD * fxRateUsdGbp;
      return `£${valGBP.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    }
    return `$${valUSD.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  const formatNativeCurr = (val?: number, currency = 'USD', decimals = 2) => {
    if (val === undefined || val === null || isNaN(val)) val = 0;
    const symbols: Record<string, string> = {
      USD: '$',
      CAD: 'CA$',
      EUR: '€',
      GBP: '£',
      AUD: 'A$',
    };
    const sym = symbols[(currency || 'USD').toUpperCase()] || `${currency} `;
    return `${sym}${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  const getCushionBadge = (cushionVal: number) => {
    if (cushionVal >= 25) {
      return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">Healthy Cushion ({(cushionVal || 0).toFixed(1)}%)</Badge>;
    }
    if (cushionVal >= 15) {
      return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">Moderate ({(cushionVal || 0).toFixed(1)}%)</Badge>;
    }
    return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]">Critical ({(cushionVal || 0).toFixed(1)}%)</Badge>;
  };

  // Currency breakdown list
  const currencyEntries: [string, CurrencyBalance][] = portfolioData?.currencies
    ? (Object.entries(portfolioData.currencies) as [string, CurrencyBalance][]).filter(([_, c]) => c && ((c.netLiqUSD || 0) > 0 || (c.cashUSD || 0) > 0 || (c.holdingsCount || 0) > 0))
    : [];

  const currencyColorMap: Record<string, { bg: string; text: string; border: string; bar: string }> = {
    USD: { bg: 'bg-cyan-500/10', text: 'text-cyan-300', border: 'border-cyan-500/30', bar: 'bg-cyan-400' },
    CAD: { bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/30', bar: 'bg-amber-500' },
    EUR: { bg: 'bg-indigo-500/10', text: 'text-indigo-300', border: 'border-indigo-500/30', bar: 'bg-indigo-400' },
    GBP: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/30', bar: 'bg-emerald-400' },
    AUD: { bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/30', bar: 'bg-purple-400' },
  };

  return (
    <div className="space-y-4 mb-6">
      {/* ================= 1. DEDICATED TOTAL CURRENCY BALANCES & BRIDGE CARD ================= */}
      <DualCurrencyComparisonCard
        portfolioData={portfolioData}
        currencyMode={currencyMode}
        onCurrencyModeChange={setCurrencyMode}
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacy={onTogglePrivacy}
      />

      {/* Top Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* 1. Net Liquidating Value */}
        <Card className="glass-card border-l-4 border-l-cyan-500 p-5 relative overflow-hidden group hover:border-cyan-500/80 transition-all">
          <div className="flex items-center justify-between mb-1 relative z-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CircleDollarSign className="w-3.5 h-3.5 text-cyan-400" />
              {currencyMode === 'GBP' ? 'Net Liquidation (GBP)' : 'Net Liquidation (USD)'}
            </span>
            <div className="flex items-center gap-1.5">
              <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-[9px] font-mono px-1.5 py-0">
                {currencyMode === 'GBP' ? 'GBP (£)' : currencyMode === 'DUAL' ? 'DUAL ($ / £)' : 'USD ($)'}
              </Badge>
              <button
                onClick={onTogglePrivacy}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                title={isPrivacyMode ? "Show Balances" : "Hide Balances"}
              >
                {isPrivacyMode ? <EyeOff className="w-3.5 h-3.5 text-cyan-400" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className={cn("space-y-0.5", isPrivacyMode && "blur-md select-none opacity-60")}>
            <div className="text-3xl font-black font-mono text-foreground tracking-tight">
              {formatDynamicCurr(totalNet)}
            </div>
            {currencyMode === 'DUAL' ? (
              <div className="text-sm font-bold font-mono text-emerald-400">
                £{(totalNet * fxRateUsdGbp).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GBP
              </div>
            ) : (
              <div className="text-xs font-mono text-muted-foreground">
                {currencyMode === 'GBP' ? `$${totalNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD eq.` : `£${(totalNet * fxRateUsdGbp).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GBP eq.`}
              </div>
            )}
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5 font-mono">
            <span className="text-orange-400">IBKR: {formatDynamicCurr(ibkrTotalNetCombined, 0)}</span>
            <span className="text-rose-400">Tasty: {formatDynamicCurr(tastyNet, 0)}</span>
            <span className="text-blue-400">T212: {formatDynamicCurr(t212NetUSD, 0)}</span>
          </div>
        </Card>

        {/* 2. Total Buying Power */}
        <Card
          onClick={() => setIsBuyingPowerModalOpen(true)}
          className="glass-card border-l-4 border-l-amber-500 p-5 relative overflow-hidden group hover:border-amber-500/80 hover:shadow-lg transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 group-hover:text-amber-400 transition-colors">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Total Buying Power
            </span>
            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[9px] font-mono px-1.5 py-0 group-hover:bg-amber-500 group-hover:text-black transition-all">
              ANALYSE RISK ↗
            </Badge>
          </div>

          <div className={cn("space-y-0.5", isPrivacyMode && "blur-md select-none opacity-60")}>
            <div className="text-3xl font-black font-mono text-amber-400 tracking-tight">
              {formatDynamicCurr(totalCalculatedBP)}
            </div>
            {currencyMode === 'DUAL' && (
              <div className="text-sm font-bold font-mono text-amber-300/80">
                £{(totalCalculatedBP * fxRateUsdGbp).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GBP
              </div>
            )}
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5 font-mono">
            <span>Cash: {formatDynamicCurr(totalCashValue, 0)}</span>
            <span>Excess: {formatDynamicCurr(ibkrExcess + tastyCash + t212CashUSD, 0)}</span>
          </div>
        </Card>

        {/* 3. Daily P&L */}
        <Card
          className={cn(
            "glass-card p-5 relative overflow-hidden border-l-4 transition-all",
            isPositiveDay ? "border-l-emerald-500 hover:border-emerald-500/80" : "border-l-rose-500 hover:border-rose-500/80"
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-primary" /> Today's P&L
            </span>
            {isPositiveDay ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-rose-400" />}
          </div>

          <div className={cn("space-y-0.5 font-mono", isPrivacyMode && "blur-md select-none opacity-60")}>
            <div className={cn("text-2xl font-bold flex items-baseline gap-2", isPositiveDay ? "text-emerald-400" : "text-rose-400")}>
              <span>
                {isPositiveDay ? '+' : '-'}{formatDynamicCurr(Math.abs(dailyPL))}
              </span>
              <span className="text-xs font-sans font-semibold opacity-90">
                ({isPositiveDay ? '+' : ''}{dailyPLPercent.toFixed(2)}%)
              </span>
            </div>
            {currencyMode === 'DUAL' && (
              <div className={cn("text-xs font-bold", isPositiveDay ? "text-emerald-300" : "text-rose-300")}>
                {isPositiveDay ? '+' : '-'}£{(Math.abs(dailyPL) * fxRateUsdGbp).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GBP
              </div>
            )}
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5 font-mono">
            <span>IBKR: {formatDynamicCurr(ibkrCombined?.dayPnL ?? activeIbkrAcct?.dayPnL ?? 0, 0)}</span>
            <span>Tasty: {formatDynamicCurr(tasty?.dayPnL ?? 0, 0)}</span>
          </div>
        </Card>

        {/* 4. Overall Portfolio Theta & Time Decay */}
        <Card
          onClick={() => setIsThetaModalOpen(true)}
          className={cn(
            "glass-card p-5 relative overflow-hidden border-l-4 transition-all cursor-pointer group active:scale-[0.99]",
            portfolioTheta.totalDailyTheta > 0
              ? "border-l-purple-500 hover:border-purple-500/80 shadow-purple-500/10"
              : portfolioTheta.totalDailyTheta < 0
              ? "border-l-amber-500 hover:border-amber-500/80"
              : "border-l-slate-600 hover:border-slate-500"
          )}
          title="Click to view which positions provide this Theta"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-purple-400" /> Portfolio Theta (Θ)
            </span>
            <Badge
              className={cn(
                "text-[9px] font-mono font-bold px-1.5 py-0",
                portfolioTheta.totalDailyTheta > 0
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10"
                  : portfolioTheta.totalDailyTheta < 0
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-800 text-slate-300 border-slate-700"
              )}
            >
              {portfolioTheta.totalDailyTheta > 0
                ? `+${portfolioTheta.annualizedThetaYieldPercent.toFixed(1)}% Yield`
                : portfolioTheta.totalDailyTheta < 0
                ? `${portfolioTheta.annualizedThetaYieldPercent.toFixed(1)}% Drag`
                : 'Neutral Θ'}
            </Badge>
          </div>

          <div className={cn("space-y-0.5 font-mono", isPrivacyMode && "blur-md select-none opacity-60")}>
            <div
              className={cn(
                "text-2xl font-bold flex items-baseline gap-1",
                portfolioTheta.totalDailyTheta > 0
                  ? "text-emerald-400"
                  : portfolioTheta.totalDailyTheta < 0
                  ? "text-amber-400"
                  : "text-foreground"
              )}
            >
              <span>{portfolioTheta.totalDailyTheta >= 0 ? '+' : ''}{formatDynamicCurr(portfolioTheta.totalDailyTheta)}</span>
              <span className="text-xs font-sans font-medium text-muted-foreground">/ day</span>
            </div>
            {currencyMode === 'DUAL' ? (
              <div className="text-xs font-bold font-mono text-purple-300/90">
                {portfolioTheta.totalDailyTheta >= 0 ? '+' : ''}£{(portfolioTheta.totalDailyTheta * fxRateUsdGbp).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GBP/day
              </div>
            ) : (
              <div className="text-xs font-mono text-muted-foreground">
                Run-rate:{' '}
                <strong className={portfolioTheta.totalMonthlyTheta >= 0 ? "text-emerald-400" : "text-amber-400"}>
                  {portfolioTheta.totalMonthlyTheta >= 0 ? '+' : ''}{formatDynamicCurr(portfolioTheta.totalMonthlyTheta)}/mo
                </strong>
              </div>
            )}
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5 font-mono">
            <span className="text-emerald-400/90" title="Short options time premium harvested per day">
              Short: +${portfolioTheta.shortOptionsTheta.toFixed(0)}/d
            </span>
            <span className="text-purple-300/80" title="Total active option contracts in portfolio">
              {portfolioTheta.totalOptionsCount} contracts ({portfolioTheta.shortOptionsCount}S/{portfolioTheta.longOptionsCount}L)
            </span>
          </div>
        </Card>

        {/* 5. Total Unrealized Return */}
        <Card
          className={cn(
            "glass-card p-5 relative overflow-hidden border-l-4 transition-all",
            isPositiveTotal ? "border-l-purple-500 hover:border-purple-500/80" : "border-l-rose-500 hover:border-rose-500/80"
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-400" /> Total Open P&L
            </span>
            <CircleDollarSign className="w-4 h-4 text-purple-400" />
          </div>

          <div className={cn("space-y-0.5 font-mono", isPrivacyMode && "blur-md select-none opacity-60")}>
            <div className={cn("text-2xl font-bold", isPositiveTotal ? "text-purple-400" : "text-rose-400")}>
              {isPositiveTotal ? '+' : '-'}{formatDynamicCurr(Math.abs(unrealizedPL))}
            </div>
            {currencyMode === 'DUAL' && (
              <div className={cn("text-xs font-bold", isPositiveTotal ? "text-purple-300" : "text-rose-300")}>
                {isPositiveTotal ? '+' : '-'}£{(Math.abs(unrealizedPL) * fxRateUsdGbp).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GBP
              </div>
            )}
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5 font-mono">
            <span>{ibkrOptCount + tastyOptCount + ibkrEqCount + tastyEqCount + t212EqCount} Positions</span>
            <span>3 Connected Brokers</span>
          </div>
        </Card>
      </div>

      {/* Cross-Broker & Multi-Currency Allocation Dashboard Bar */}
      <Card className="glass-card p-4 border border-border/40 bg-slate-950/40 space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">Global Capital & Asset Allocation</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">IBKR:</span>
              <strong className="text-foreground">{ibkrPct.toFixed(1)}% ({formatCurr(ibkrTotalNetCombined, 0)})</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-muted-foreground">Tastytrade:</span>
              <strong className="text-foreground">{tastyPct.toFixed(1)}% ({formatCurr(tastyNet, 0)})</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Trading 212:</span>
              <strong className="text-foreground">{t212Pct.toFixed(1)}% ({formatCurr(t212NetUSD, 0)})</strong>
            </div>
          </div>
        </div>

        {/* 3-Broker Progress Bar: Broker Capital Share */}
        <div className="space-y-1.5">
          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="bg-orange-500 transition-all duration-500 h-full hover:opacity-90"
              style={{ width: `${Math.max(2, ibkrPct)}%` }}
              title={`Interactive Brokers: ${ibkrPct.toFixed(1)}% ($${ibkrTotalNetCombined.toLocaleString()})`}
            />
            <div
              className="bg-rose-500 transition-all duration-500 h-full hover:opacity-90"
              style={{ width: `${Math.max(2, tastyPct)}%` }}
              title={`Tastytrade: ${tastyPct.toFixed(1)}% ($${tastyNet.toLocaleString()})`}
            />
            <div
              className="bg-blue-500 transition-all duration-500 h-full hover:opacity-90"
              style={{ width: `${Math.max(2, t212Pct)}%` }}
              title={`Trading 212: ${t212Pct.toFixed(1)}% ($${t212NetUSD.toLocaleString()})`}
            />
          </div>

          {/* Asset Allocation Tags */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> Equities: <strong className="text-foreground font-mono">{equitiesPct.toFixed(0)}%</strong> ({formatCurr(totalEquitiesValue, 0)})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-400" /> Options: <strong className="text-foreground font-mono">{optionsPct.toFixed(0)}%</strong> ({formatCurr(totalOptionsValue, 0)})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Cash: <strong className="text-foreground font-mono">{cashPct.toFixed(0)}%</strong> ({formatCurr(totalCashValue, 0)})
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">Unified in USD (Real-time FX Converted)</span>
          </div>
        </div>

        {/* Multi-Currency Breakdown Widget */}
        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Globe2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Multi-Currency Balances & Live FX Exposure</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCurrencyBreakdownOpen(prev => !prev)}
              className="h-6 text-[11px] px-2 gap-1 text-muted-foreground hover:text-foreground"
            >
              <span>{isCurrencyBreakdownOpen ? "Hide Ledger" : "Show Currency Breakdown"}</span>
              {isCurrencyBreakdownOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
          </div>

          {/* Currency Exposure Progress Bar */}
          {totalNet > 0 && currencyEntries.length > 0 && (
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex mb-2.5 cursor-pointer shadow-inner" title="Click any currency slice to view its assets">
              {currencyEntries.map(([curr, c]) => {
                const share = (c.netLiqUSD / totalNet) * 100;
                if (share <= 0) return null;
                const colors = currencyColorMap[curr] || { bar: 'bg-slate-400' };
                return (
                  <div
                    key={curr}
                    onClick={() => setSelectedCurrencyForModal(curr)}
                    className={cn(colors.bar, "transition-all duration-300 h-full hover:opacity-80 hover:scale-y-125")}
                    style={{ width: `${Math.max(1.5, share)}%` }}
                    title={`${curr}: ${share.toFixed(1)}% ($${c.netLiqUSD.toLocaleString()} USD) - Click to inspect assets`}
                  />
                );
              })}
            </div>
          )}

          {/* Expandable Multi-Currency Ledger Table */}
          {isCurrencyBreakdownOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
              {currencyEntries.map(([curr, c]) => {
                const colors = currencyColorMap[curr] || { bg: 'bg-card/50', text: 'text-foreground', border: 'border-border/40', bar: 'bg-slate-400' };
                const sharePct = totalNet > 0 ? (c.netLiqUSD / totalNet) * 100 : 0;
                return (
                  <div
                    key={curr}
                    onClick={() => setSelectedCurrencyForModal(curr)}
                    className={cn(
                      "p-2.5 rounded-xl border transition-all text-xs flex flex-col justify-between cursor-pointer group hover:border-primary/60 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
                      colors.bg,
                      colors.border
                    )}
                    title={`Click to inspect all ${curr} assets & FX exposure`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className={cn("text-[10px] font-mono font-bold px-1.5 py-0 group-hover:border-primary/50 transition-colors", colors.border, colors.text)}>
                        {curr}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                        {sharePct.toFixed(1)}%
                      </span>
                    </div>

                    <div className="space-y-0.5 my-1 font-mono">
                      <div className={cn("text-sm font-bold text-foreground group-hover:text-primary transition-colors", isPrivacyMode && "blur-xs")}>
                        {formatCurr(c.netLiqUSD)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Native: {formatNativeCurr(c.positionsMarketValue + c.cash, curr, 0)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-white/5 font-mono">
                      <span className="group-hover:text-foreground underline decoration-dotted transition-colors">
                        {c.holdingsCount} assets &rarr;
                      </span>
                      <span>FX: {c.fxRateToUSD.toFixed(3)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* ================= 4-ACCOUNT INDIVIDUAL BALANCES MATRIX ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ACCOUNT 1: IBKR ISA */}
        <div className="p-4 rounded-2xl bg-slate-950/50 border border-amber-500/30 hover:border-amber-500/60 transition-all shadow-md flex flex-col justify-between group">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-xs font-bold text-foreground">IBKR ISA</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono text-amber-300/80 border-amber-500/30">
                  U14522424
                </Badge>
              </div>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] font-mono font-bold">
                TAX-FREE
              </Badge>
            </div>
            <div className={cn("text-xl font-black font-mono text-amber-300", isPrivacyMode && "blur-sm")}>
              {formatCurr(ibkrAccounts.find(a => a.accountKey === 'ibkr_isa' || a.accountNumber === 'U14522424' || a.accountNumber?.includes('ISA'))?.netLiquidatingValue ?? (ibkrTotalNetCombined * 0.4))}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between font-mono pt-1">
              <span>Stocks & Shares ISA</span>
              <span className="text-emerald-400 font-bold">{ibkrAccounts.find(a => a.accountKey === 'ibkr_isa' || a.accountNumber === 'U14522424')?.equitiesCount ?? 'Cash Equities'}</span>
            </div>
          </div>
          <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>Wrapper: UK ISA</span>
            <span className="text-foreground font-bold">No Cap Gains Tax</span>
          </div>
        </div>

        {/* ACCOUNT 2: IBKR GIA */}
        <div className="p-4 rounded-2xl bg-slate-950/50 border border-purple-500/30 hover:border-purple-500/60 transition-all shadow-md flex flex-col justify-between group">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                <span className="text-xs font-bold text-foreground">IBKR GIA</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono text-purple-300/80 border-purple-500/30">
                  U15491236
                </Badge>
              </div>
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[9px] font-mono font-bold">
                MARGIN
              </Badge>
            </div>
            <div className={cn("text-xl font-black font-mono text-purple-300", isPrivacyMode && "blur-sm")}>
              {formatCurr(ibkrAccounts.find(a => a.accountKey === 'ibkr_gia' || a.accountNumber === 'U15491236' || a.accountNumber?.includes('GIA'))?.netLiquidatingValue ?? (ibkrTotalNetCombined * 0.6))}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between font-mono pt-1">
              <span>Global Margin & Options</span>
              <span className="text-cyan-300 font-bold">Options & Equities</span>
            </div>
          </div>
          <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>Buying Power:</span>
            <span className="text-cyan-300 font-bold">{formatCurr(ibkrAccounts.find(a => a.accountKey === 'ibkr_gia' || a.accountNumber === 'U15491236')?.buyingPower ?? (ibkrBP))}</span>
          </div>
        </div>

        {/* ACCOUNT 3: TASTYTRADE MARGIN */}
        <div className="p-4 rounded-2xl bg-slate-950/50 border border-rose-500/30 hover:border-rose-500/60 transition-all shadow-md flex flex-col justify-between group">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="text-xs font-bold text-foreground">Tastytrade Margin</span>
              </div>
              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[9px] font-mono font-bold">
                DERIVATIVES (USD)
              </Badge>
            </div>
            <div className={cn("text-xl font-black font-mono text-rose-300", isPrivacyMode && "blur-sm")}>
              {formatCurr(tastyNet)}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between font-mono pt-1">
              <span>Options & Derivatives</span>
              <span className="text-purple-300 font-bold">{tastyOptCount} Options</span>
            </div>
          </div>
          <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>Deriv BP:</span>
            <span className="text-amber-300 font-bold">{formatCurr(tastyDerivBP)}</span>
          </div>
        </div>

        {/* ACCOUNT 4: TRADING 212 ISA */}
        <div className="p-4 rounded-2xl bg-slate-950/50 border border-blue-500/30 hover:border-blue-500/60 transition-all shadow-md flex flex-col justify-between group">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span className="text-xs font-bold text-foreground">Trading 212 ISA</span>
              </div>
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[9px] font-mono font-bold">
                TAX-FREE (GBP)
              </Badge>
            </div>
            <div className={cn("text-xl font-black font-mono text-blue-300", isPrivacyMode && "blur-sm")}>
              {formatCurr(t212NetUSD)}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between font-mono pt-1">
              <span>{formatNativeCurr(t212NetGBP, 'GBP')} Native</span>
              <span className="text-emerald-300 font-bold">{t212EqCount} Holdings</span>
            </div>
          </div>
          <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>Cash:</span>
            <span className="text-foreground font-bold">{formatNativeCurr(t212CashGBP, 'GBP')}</span>
          </div>
        </div>
      </div>

      {/* Dedicated Comprehensive Broker Balances Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* BROKER 1: INTERACTIVE BROKERS (WITH ACCOUNT SWITCHER) */}
        <Card className="glass-card p-5 border border-orange-500/30 relative overflow-hidden bg-slate-950/40 flex flex-col justify-between group hover:border-orange-500/60 transition-all">
          <div>
            {/* Header with Account Tabs */}
            <div className="flex items-start justify-between mb-3.5 flex-wrap gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground text-base flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-orange-400" /> Interactive Brokers
                  </span>
                  <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 text-[10px] px-2 font-mono">
                    {activeIbkrAcct?.accountNumber || 'IBKR Combined'}
                  </Badge>
                  {activeIbkrAcct?.accountType && (
                    <Badge variant="secondary" className="text-[10px] bg-secondary/50">
                      {activeIbkrAcct.accountType}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Multi-Account Hub: ISA (Tax-Free) & GIA (Margin)</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-background/60 px-2.5 py-1 rounded-full border border-border/50 text-xs">
                  <span className={cn("w-2 h-2 rounded-full", connectedSources.ibkr ? "bg-emerald-400 animate-pulse" : "bg-zinc-500")} />
                  <span className="font-medium">{connectedSources.ibkr ? 'Connected' : 'Offline'}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedBrokerKey('ibkr')}
                  className="h-7 text-xs border-orange-500/40 hover:bg-orange-500/10 text-orange-300 px-2.5"
                >
                  <Maximize2 className="w-3.5 h-3.5 mr-1" />
                  Deep Dive
                </Button>
              </div>
            </div>

            {/* Account Switcher Tabs */}
            {ibkrAccounts.length > 0 && (
              <div className="flex items-center gap-1.5 mb-3 p-1 bg-background/50 rounded-lg border border-border/30 overflow-x-auto">
                <button
                  onClick={() => setActiveIbkrAccountTab('combined')}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-semibold font-mono transition-all whitespace-nowrap",
                    activeIbkrAccountTab === 'combined'
                      ? "bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Combined ({ibkrAccounts.length} Accts)
                </button>
                {ibkrAccounts.map(acct => (
                  <button
                    key={acct.accountKey || acct.accountNumber}
                    onClick={() => setActiveIbkrAccountTab(acct.accountKey || acct.accountNumber)}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs font-semibold font-mono transition-all whitespace-nowrap flex items-center gap-1",
                      activeIbkrAccountTab === (acct.accountKey || acct.accountNumber)
                        ? "bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>{acct.nickname || acct.name || acct.accountNumber}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-white/20">
                      {acct.baseCurrency || 'USD'}
                    </Badge>
                  </button>
                ))}
              </div>
            )}

            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-card/50 rounded-xl p-3 border border-border/40">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Net Liquidation (USD)</span>
                <p className={cn("text-lg font-black font-mono text-foreground mt-0.5", isPrivacyMode && "blur-sm")}>
                  {formatCurr(ibkrNet)}
                </p>
              </div>

              <div className="bg-card/50 rounded-xl p-3 border border-emerald-500/30">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Total Cash</span>
                <p className={cn("text-lg font-black font-mono text-emerald-400 mt-0.5", isPrivacyMode && "blur-sm")}>
                  {formatCurr(ibkrCash)}
                </p>
              </div>

              <div className="bg-card/50 rounded-xl p-3 border border-border/40 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Buying Power (USD)</span>
                <p className={cn("text-lg font-black font-mono text-cyan-300 mt-0.5", isPrivacyMode && "blur-sm")}>
                  {formatCurr(ibkrBP)}
                </p>
              </div>
            </div>

            {/* In-Card Tabbed Telemetry */}
            <Tabs defaultValue="liquidity" className="w-full">
              <TabsList className="bg-background/40 border border-border/30 p-0.5 grid grid-cols-4 h-8 text-[11px] mb-3">
                <TabsTrigger value="liquidity" className="text-[10px] px-1 py-1">Liquidity</TabsTrigger>
                <TabsTrigger value="margin" className="text-[10px] px-1 py-1">Margin</TabsTrigger>
                <TabsTrigger value="assets" className="text-[10px] px-1 py-1">Assets</TabsTrigger>
                <TabsTrigger value="currencies" className="text-[10px] px-1 py-1">FX</TabsTrigger>
              </TabsList>

              {/* Liquidity Tab */}
              <TabsContent value="liquidity" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Available Funds:</span>
                    <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-xs")}>{formatCurr(activeIbkrAcct?.availableFunds ?? ibkrBP)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Excess Liquidity:</span>
                    <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-xs")}>{formatCurr(ibkrExcess)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Equity Buying Power:</span>
                    <strong className={cn("font-mono text-cyan-300", isPrivacyMode && "blur-xs")}>{formatCurr(ibkrBP)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">SMA Credit Line:</span>
                    <strong className={cn("font-mono text-purple-300", isPrivacyMode && "blur-xs")}>{formatCurr(activeIbkrAcct?.sma ?? 0)}</strong>
                  </div>
                </div>
              </TabsContent>

              {/* Margin Tab */}
              <TabsContent value="margin" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Maintenance Req:</span>
                    <strong className={cn("font-mono text-amber-300", isPrivacyMode && "blur-xs")}>{formatCurr(ibkrMaint)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Initial Margin:</span>
                    <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-xs")}>{formatCurr(activeIbkrAcct?.initMargin ?? 0)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Margin Utilization:</span>
                    <strong className="font-mono text-foreground">{activeIbkrAcct?.marginUtilization?.toFixed(1) ?? '0.0'}%</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Margin Buffer:</span>
                    <div>{getCushionBadge(ibkrCushion)}</div>
                  </div>
                </div>
              </TabsContent>

              {/* Assets Tab */}
              <TabsContent value="assets" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Options ({ibkrOptCount}):</span>
                    <strong className={cn("font-mono text-purple-300", isPrivacyMode && "blur-xs")}>{formatCurr(ibkrOptVal)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Equities ({ibkrEqCount}):</span>
                    <strong className={cn("font-mono text-cyan-300", isPrivacyMode && "blur-xs")}>{formatCurr(ibkrEqVal)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Today's P&L:</span>
                    <strong className={cn("font-mono", (activeIbkrAcct?.dayPnL || 0) >= 0 ? "text-emerald-400" : "text-rose-400", isPrivacyMode && "blur-xs")}>
                      {(activeIbkrAcct?.dayPnL || 0) >= 0 ? '+' : ''}{formatCurr(activeIbkrAcct?.dayPnL || 0)}
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Open Unrealized P&L:</span>
                    <strong className={cn("font-mono", (activeIbkrAcct?.unrealizedPnL || 0) >= 0 ? "text-emerald-400" : "text-rose-400", isPrivacyMode && "blur-xs")}>
                      {(activeIbkrAcct?.unrealizedPnL || 0) >= 0 ? '+' : ''}{formatCurr(activeIbkrAcct?.unrealizedPnL || 0)}
                    </strong>
                  </div>
                </div>
              </TabsContent>

              {/* Currencies Tab */}
              <TabsContent value="currencies" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries((activeIbkrAcct as any)?.currencies || ibkrCombined?.currencies || {}).map(([currKey, c]: [string, any]) => {
                    if (c.netLiqUSD <= 0 && c.holdingsCount === 0) return null;
                    return (
                      <div key={currKey} className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center font-mono">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                          {currKey} ({c.holdingsCount} pos):
                        </span>
                        <strong className={cn("text-foreground", isPrivacyMode && "blur-xs")}>
                          {formatCurr(c.netLiqUSD)}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="mt-3.5 flex items-center justify-between text-xs text-muted-foreground pt-2.5 border-t border-border/30 font-mono">
            <span>Portfolio Share: <strong className="text-orange-300">{((ibkrNet / totalNet) * 100).toFixed(1)}%</strong></span>
            <span>Leverage: <strong className="text-foreground">{activeIbkrAcct?.leverage ? `${activeIbkrAcct.leverage.toFixed(2)}x` : '1.00x'}</strong></span>
          </div>
        </Card>

        {/* BROKER 2: TASTYTRADE */}
        <Card className="glass-card p-5 border border-red-500/30 relative overflow-hidden bg-slate-950/40 flex flex-col justify-between group hover:border-red-500/60 transition-all">
          <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-3.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground text-base flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-rose-400" /> Tastytrade
                  </span>
                  <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px] px-2 font-mono">
                    {tasty?.accountNumber || 'Tastytrade Account'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Derivatives & Options Fast Execution (USD)</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-background/60 px-2.5 py-1 rounded-full border border-border/50 text-xs">
                  <span className={cn("w-2 h-2 rounded-full", connectedSources.tastytrade ? "bg-emerald-400 animate-pulse" : "bg-zinc-500")} />
                  <span className="font-medium">{connectedSources.tastytrade ? 'Connected' : 'Offline'}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedBrokerKey('tastytrade')}
                  className="h-7 text-xs border-rose-500/40 hover:bg-rose-500/10 text-rose-300 px-2.5"
                >
                  <Maximize2 className="w-3.5 h-3.5 mr-1" />
                  Deep Dive
                </Button>
              </div>
            </div>

            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-card/50 rounded-xl p-3 border border-border/40">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Net Liquidation (USD)</span>
                <p className={cn("text-lg font-black font-mono text-foreground mt-0.5", isPrivacyMode && "blur-sm")}>
                  {formatCurr(tastyNet)}
                </p>
              </div>

              <div className="bg-card/50 rounded-xl p-3 border border-amber-500/30">
                <span className="text-[10px] uppercase font-bold text-amber-400 block">Options Buying Power</span>
                <p className={cn("text-lg font-black font-mono text-amber-300 mt-0.5", isPrivacyMode && "blur-sm")}>
                  {formatCurr(tastyDerivBP)}
                </p>
              </div>

              <div className="bg-card/50 rounded-xl p-3 border border-border/40 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Stock Buying Power</span>
                <p className={cn("text-lg font-black font-mono text-cyan-300 mt-0.5", isPrivacyMode && "blur-sm")}>
                  {formatCurr(tastyEqBP)}
                </p>
              </div>
            </div>

            {/* In-Card Tabbed Telemetry */}
            <Tabs defaultValue="liquidity" className="w-full">
              <TabsList className="bg-background/40 border border-border/30 p-0.5 grid grid-cols-4 h-8 text-[11px] mb-3">
                <TabsTrigger value="liquidity" className="text-[10px] px-1 py-1">Liquidity</TabsTrigger>
                <TabsTrigger value="margin" className="text-[10px] px-1 py-1">Margin</TabsTrigger>
                <TabsTrigger value="assets" className="text-[10px] px-1 py-1">Assets</TabsTrigger>
                <TabsTrigger value="compliance" className="text-[10px] px-1 py-1">Day Trades</TabsTrigger>
              </TabsList>

              {/* Liquidity Tab */}
              <TabsContent value="liquidity" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Cash Balance:</span>
                    <strong className={cn("font-mono text-emerald-400", isPrivacyMode && "blur-xs")}>{formatCurr(tastyCash)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Available to Withdraw:</span>
                    <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-xs")}>{formatCurr(tasty?.cashAvailableForWithdrawal ?? tastyCash)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Day Trading BP:</span>
                    <strong className={cn("font-mono text-amber-300", isPrivacyMode && "blur-xs")}>{formatCurr(tastyDayTradingBP)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Open Order Reserve:</span>
                    <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-xs")}>{formatCurr(tasty?.openOrderReserve ?? 0)}</strong>
                  </div>
                </div>
              </TabsContent>

              {/* Margin Tab */}
              <TabsContent value="margin" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Maintenance Req:</span>
                    <strong className={cn("font-mono text-amber-300", isPrivacyMode && "blur-xs")}>{formatCurr(tastyMaint)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Margin Utilization:</span>
                    <strong className="font-mono text-foreground">{tasty?.marginUtilization?.toFixed(1) ?? '0.0'}%</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Margin Cushion:</span>
                    <div>{getCushionBadge(tastyCushion)}</div>
                  </div>
                </div>
              </TabsContent>

              {/* Assets Tab */}
              <TabsContent value="assets" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Equities ({tastyEqCount}):</span>
                    <strong className={cn("font-mono text-cyan-300", isPrivacyMode && "blur-xs")}>{formatCurr(tastyEqVal)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Long Options:</span>
                    <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-xs")}>{formatCurr(tasty?.longDerivativeValue ?? 0)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Short Options:</span>
                    <strong className={cn("font-mono text-rose-400", isPrivacyMode && "blur-xs")}>{formatCurr(tasty?.shortDerivativeValue ?? 0)}</strong>
                  </div>
                </div>
              </TabsContent>

              {/* Day Trades & Compliance Tab */}
              <TabsContent value="compliance" className="m-0 space-y-2">
                <div className="p-2 rounded-lg bg-background/50 border border-border/30 text-xs flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" /> PDT Flag Status:
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className={cn("font-bold", tasty?.dayTrading?.isDayTrader ? "text-amber-400" : "text-emerald-400")}>
                      {tasty?.dayTrading?.isDayTrader ? 'Marked Pattern Day Trader' : 'Standard Non-PDT'}
                    </span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="mt-3.5 flex items-center justify-between text-xs text-muted-foreground pt-2.5 border-t border-border/30 font-mono">
            <span>Portfolio Share: <strong className="text-rose-300">{tastyPct.toFixed(1)}%</strong></span>
            <span>Margin Health: <strong className="text-emerald-400">{tastyCushion.toFixed(1)}%</strong></span>
          </div>
        </Card>

        {/* BROKER 3: TRADING 212 */}
        <Card className="glass-card p-5 border border-blue-500/30 relative overflow-hidden bg-slate-950/40 flex flex-col justify-between group hover:border-blue-500/60 transition-all">
          <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-3.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground text-base flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-blue-400" /> Trading 212
                  </span>
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px] px-2 font-mono">
                    {t212?.accountNumber || '22885001'}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] bg-secondary/50">
                    Invest / ISA (GBP)
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">UK & Global Equities (GBP / £ Base)</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-background/60 px-2.5 py-1 rounded-full border border-border/50 text-xs">
                  <span className={cn("w-2 h-2 rounded-full", isT212Connected ? "bg-emerald-400 animate-pulse" : "bg-zinc-500")} />
                  <span className="font-medium">{isT212Connected ? 'Connected' : 'Offline'}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedBrokerKey('trading212')}
                  className="h-7 text-xs border-blue-500/40 hover:bg-blue-500/10 text-blue-300 px-2.5"
                >
                  <Maximize2 className="w-3.5 h-3.5 mr-1" />
                  Deep Dive
                </Button>
              </div>
            </div>

            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-card/50 rounded-xl p-3 border border-border/40">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Net Value (GBP)</span>
                <p className={cn("text-lg font-black font-mono text-emerald-400 mt-0.5", isPrivacyMode && "blur-sm")}>
                  £{t212NetGBP.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ({formatCurr(t212NetUSD)} USD)
                </span>
              </div>

              <div className="bg-card/50 rounded-xl p-3 border border-emerald-500/30">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Free Cash</span>
                <p className={cn("text-lg font-black font-mono text-emerald-400 mt-0.5", isPrivacyMode && "blur-sm")}>
                  £{t212CashGBP.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ({formatCurr(t212CashUSD)} USD)
                </span>
              </div>

              <div className="bg-card/50 rounded-xl p-3 border border-border/40 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Invested Capital</span>
                <p className={cn("text-lg font-black font-mono text-cyan-300 mt-0.5", isPrivacyMode && "blur-sm")}>
                  £{t212InvestedGBP.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {t212EqCount} Positions
                </span>
              </div>
            </div>

            {/* In-Card Tabbed Telemetry */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="bg-background/40 border border-border/30 p-0.5 grid grid-cols-3 h-8 text-[11px] mb-3">
                <TabsTrigger value="overview" className="text-[10px] px-1 py-1">Liquidity</TabsTrigger>
                <TabsTrigger value="performance" className="text-[10px] px-1 py-1">Performance</TabsTrigger>
                <TabsTrigger value="assets" className="text-[10px] px-1 py-1">Holdings</TabsTrigger>
              </TabsList>

              {/* Liquidity Tab */}
              <TabsContent value="overview" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Free Cash (GBP):</span>
                    <strong className={cn("font-mono text-emerald-400", isPrivacyMode && "blur-xs")}>
                      £{t212CashGBP.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Total Invested:</span>
                    <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-xs")}>
                      £{t212InvestedGBP.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">FX Rate (GBP/USD):</span>
                    <strong className="font-mono text-cyan-300">1.302</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Net Liq (USD):</span>
                    <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-xs")}>
                      {formatCurr(t212NetUSD)}
                    </strong>
                  </div>
                </div>
              </TabsContent>

              {/* Performance Tab */}
              <TabsContent value="performance" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Open Profit (P&L):</span>
                    <strong className={cn("font-mono", t212UnPnLGBP >= 0 ? "text-emerald-400" : "text-rose-400", isPrivacyMode && "blur-xs")}>
                      {t212UnPnLGBP >= 0 ? '+' : ''}£{t212UnPnLGBP.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Open Return %:</span>
                    <strong className={cn("font-mono", t212UnPnLGBP >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {t212InvestedGBP > 0 ? `${((t212UnPnLGBP / t212InvestedGBP) * 100).toFixed(2)}%` : '+0.00%'}
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Unrealized (USD):</span>
                    <strong className={cn("font-mono", t212UnPnLUSD >= 0 ? "text-emerald-400" : "text-rose-400", isPrivacyMode && "blur-xs")}>
                      {t212UnPnLUSD >= 0 ? '+' : ''}{formatCurr(t212UnPnLUSD)}
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Account Status:</span>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">Active Live</Badge>
                  </div>
                </div>
              </TabsContent>

              {/* Assets Tab */}
              <TabsContent value="assets" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Total Equities:</span>
                    <strong className={cn("font-mono text-cyan-300", isPrivacyMode && "blur-xs")}>{t212EqCount} Positions</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Account Type:</span>
                    <strong className="font-mono text-foreground">Invest / Non-Margin</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Base Currency:</span>
                    <strong className="font-mono text-amber-300">GBP (£)</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Equities Value (USD):</span>
                    <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-xs")}>{formatCurr(t212EqValUSD)}</strong>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="mt-3.5 flex items-center justify-between text-xs text-muted-foreground pt-2.5 border-t border-border/30 font-mono">
            <span>Portfolio Share: <strong className="text-blue-300">{t212Pct.toFixed(1)}%</strong></span>
            <span>Account: <strong className="text-foreground">22885001</strong></span>
          </div>
        </Card>
      </div>

      {/* Deep-Dive Inspection Modal */}
      {selectedBrokerKey && (
        <BrokerDeepDiveModal
          isOpen={!!selectedBrokerKey}
          onClose={() => setSelectedBrokerKey(null)}
          broker={
            selectedBrokerKey === 'ibkr'
              ? (activeIbkrAccountTab === 'combined' ? ibkrCombined : activeIbkrAcct)
              : selectedBrokerKey === 'tastytrade'
              ? tasty
              : t212
          }
          brokerKey={selectedBrokerKey as any}
          isPrivacyMode={isPrivacyMode}
        />
      )}

      {/* Multi-Currency Asset Inspector Modal */}
      <CurrencyAssetsModal
        isOpen={Boolean(selectedCurrencyForModal)}
        onClose={() => setSelectedCurrencyForModal(null)}
        selectedCurrency={selectedCurrencyForModal}
        onSelectCurrency={setSelectedCurrencyForModal}
        positions={positions || []}
        portfolioData={portfolioData}
        isPrivacyMode={isPrivacyMode}
        onNavigateToResearch={onNavigateToResearch}
      />

      {/* Buying Power & Margin Risk Analyser Modal */}
      <BuyingPowerAnalyserModal
        isOpen={isBuyingPowerModalOpen}
        onClose={() => setIsBuyingPowerModalOpen(false)}
      />

      {/* Portfolio Theta Breakdown Modal */}
      <ThetaBreakdownModal
        isOpen={isThetaModalOpen}
        onClose={() => setIsThetaModalOpen(false)}
        positions={positions || []}
        netLiq={totalNet}
        onNavigateToResearch={onNavigateToResearch}
      />
    </div>
  );
}
