
import React, { useState } from "react";
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
  Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BrokerAccountBalance, PortfolioBalancesData } from "@/services/portfolioBalanceService";
import { BrokerDeepDiveModal } from "./BrokerDeepDiveModal";

interface PortfolioSummaryProps {
  netLiquidValue: number;
  dailyPL: number;
  dailyPLPercent: number;
  unrealizedPL: number;
  buyingPower: number;
  connectedSources: {
    ibkr: boolean;
    tastytrade: boolean;
  };
  isPrivacyMode: boolean;
  onTogglePrivacy: () => void;
  accountBreakdown: {
    ibkr: number;
    tastytrade: number;
  };
  brokerBalances?: {
    ibkr?: BrokerAccountBalance;
    tastytrade?: BrokerAccountBalance;
  };
  portfolioData?: PortfolioBalancesData;
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
  portfolioData
}: PortfolioSummaryProps) {
  const [selectedBrokerKey, setSelectedBrokerKey] = useState<'ibkr' | 'tastytrade' | null>(null);

  const isPositiveDay = dailyPL >= 0;
  const isPositiveTotal = unrealizedPL >= 0;

  // Derived IBKR numbers
  const ibkr = brokerBalances?.ibkr;
  const ibkrNet = ibkr?.netLiquidatingValue ?? accountBreakdown.ibkr ?? 0;
  const ibkrCash = ibkr?.cash ?? 0;
  const ibkrBP = ibkr?.buyingPower ?? (ibkrNet * 0.5);
  const ibkrMaint = ibkr?.maintMargin ?? 0;
  const ibkrExcess = ibkr?.excessLiquidity ?? 0;
  const ibkrCushion = ibkr?.cushion ?? (ibkrNet > 0 ? (ibkrExcess / ibkrNet) * 100 : 50);
  const ibkrOptCount = ibkr?.optionsCount ?? 0;
  const ibkrOptVal = ibkr?.optionsValue ?? 0;
  const ibkrEqCount = ibkr?.equitiesCount ?? 0;
  const ibkrEqVal = ibkr?.equitiesValue ?? 0;

  // Derived Tastytrade numbers
  const tasty = brokerBalances?.tastytrade;
  const tastyNet = tasty?.netLiquidatingValue ?? accountBreakdown.tastytrade ?? 0;
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

  // Aggregates & Allocation
  const totalCalculatedBP = ibkrBP + tastyDerivBP;
  const totalNet = netLiquidValue > 0 ? netLiquidValue : (ibkrNet + tastyNet);

  const ibkrPct = totalNet > 0 ? (ibkrNet / totalNet) * 100 : 50;
  const tastyPct = totalNet > 0 ? (tastyNet / totalNet) * 100 : 50;

  const totalOptionsValue = Math.abs(ibkrOptVal) + Math.abs(tastyOptVal);
  const totalEquitiesValue = Math.abs(ibkrEqVal) + Math.abs(tastyEqVal);
  const totalCashValue = Math.max(0, ibkrCash + tastyCash);

  const optionsPct = totalNet > 0 ? Math.min(100, (totalOptionsValue / totalNet) * 100) : 0;
  const equitiesPct = totalNet > 0 ? Math.min(100, (totalEquitiesValue / totalNet) * 100) : 0;
  const cashPct = totalNet > 0 ? Math.min(100, (totalCashValue / totalNet) * 100) : 0;

  const formatCurr = (val: number, decimals = 2) => {
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  const getCushionBadge = (cushionVal: number) => {
    if (cushionVal >= 25) {
      return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">Healthy Cushion ({cushionVal.toFixed(1)}%)</Badge>;
    }
    if (cushionVal >= 15) {
      return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">Moderate ({cushionVal.toFixed(1)}%)</Badge>;
    }
    return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]">Critical ({cushionVal.toFixed(1)}%)</Badge>;
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Top Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Net Liquidating Value */}
        <Card className="glass-card border-l-4 border-l-cyan-500 p-5 relative overflow-hidden group hover:border-cyan-500/80 transition-all">
          <div className="flex items-center justify-between mb-1 relative z-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CircleDollarSign className="w-3.5 h-3.5 text-cyan-400" />
              Net Liquidating Value
            </span>
            <button
              onClick={onTogglePrivacy}
              className="text-cyan-400 hover:text-cyan-300 transition-colors p-1.5 rounded-full hover:bg-cyan-500/10"
              aria-label={isPrivacyMode ? "Show Values" : "Hide Values"}
              title="Toggle Privacy Mode"
            >
              {isPrivacyMode ? <EyeOff className="w-4 h-4 text-cyan-400" /> : <Eye className="w-4 h-4 text-cyan-400" />}
            </button>
          </div>

          <h2 className={cn("text-3xl font-black font-mono tracking-tight text-foreground", isPrivacyMode && "blur-md select-none opacity-50")}>
            {formatCurr(totalNet)}
          </h2>

          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5 font-mono">
            <span>IBKR: <strong className={cn("text-cyan-300", isPrivacyMode && "blur-sm")}>{formatCurr(ibkrNet, 0)}</strong> ({ibkrPct.toFixed(0)}%)</span>
            <span>Tasty: <strong className={cn("text-cyan-300", isPrivacyMode && "blur-sm")}>{formatCurr(tastyNet, 0)}</strong> ({tastyPct.toFixed(0)}%)</span>
          </div>
        </Card>

        {/* 2. Total Buying Power */}
        <Card className="glass-card border-l-4 border-l-amber-500 p-5 relative overflow-hidden hover:border-amber-500/80 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Total Buying Power
            </span>
            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px]">
              Available Capital
            </Badge>
          </div>

          <h2 className={cn("text-3xl font-black font-mono tracking-tight text-amber-300", isPrivacyMode && "blur-md select-none opacity-50")}>
            {formatCurr(buyingPower > 0 ? buyingPower : totalCalculatedBP)}
          </h2>

          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5 font-mono">
            <span>IBKR BP: <strong className={cn("text-amber-200/90", isPrivacyMode && "blur-sm")}>{formatCurr(ibkrBP, 0)}</strong></span>
            <span>Tasty BP: <strong className={cn("text-amber-200/90", isPrivacyMode && "blur-sm")}>{formatCurr(tastyDerivBP, 0)}</strong></span>
          </div>
        </Card>

        {/* 3. Daily P/L */}
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

          <div className={cn("text-2xl font-bold font-mono flex items-baseline gap-2", isPositiveDay ? "text-emerald-400" : "text-rose-400")}>
            <span className={cn(isPrivacyMode && "blur-md select-none opacity-60")}>
              {isPositiveDay ? '+' : ''}{formatCurr(dailyPL)}
            </span>
            <span className="text-xs font-sans font-semibold opacity-90">
              ({isPositiveDay ? '+' : ''}{dailyPLPercent.toFixed(2)}%)
            </span>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5 font-mono">
            <span>IBKR: {formatCurr(ibkr?.dayPnL || 0, 0)}</span>
            <span>Tasty: {formatCurr(tasty?.dayPnL || 0, 0)}</span>
          </div>
        </Card>

        {/* 4. Total Unrealized Return */}
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

          <div className={cn("text-2xl font-bold font-mono", isPositiveTotal ? "text-purple-400" : "text-rose-400", isPrivacyMode && "blur-md select-none opacity-60")}>
            {isPositiveTotal ? '+' : ''}{formatCurr(unrealizedPL)}
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5 font-mono">
            <span>Positions: {ibkrOptCount + tastyOptCount + ibkrEqCount + tastyEqCount}</span>
            <span>All Brokers</span>
          </div>
        </Card>
      </div>

      {/* Cross-Broker Capital & Allocation Dashboard Bar */}
      <Card className="glass-card p-4 border border-border/40 bg-slate-950/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">Cross-Broker Capital & Asset Allocation</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Interactive Brokers:</span>
              <strong className="text-foreground">{ibkrPct.toFixed(1)}%</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-muted-foreground">Tastytrade:</span>
              <strong className="text-foreground">{tastyPct.toFixed(1)}%</strong>
            </div>
          </div>
        </div>

        {/* Dual Progress Bars: Broker Capital Share & Asset Allocation */}
        <div className="space-y-2">
          {/* Broker Distribution Bar */}
          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="bg-orange-500 transition-all duration-500 h-full hover:opacity-90"
              style={{ width: `${Math.max(2, ibkrPct)}%` }}
              title={`Interactive Brokers: ${ibkrPct.toFixed(1)}% ($${ibkrNet.toLocaleString()})`}
            />
            <div
              className="bg-rose-500 transition-all duration-500 h-full hover:opacity-90"
              style={{ width: `${Math.max(2, tastyPct)}%` }}
              title={`Tastytrade: ${tastyPct.toFixed(1)}% ($${tastyNet.toLocaleString()})`}
            />
          </div>

          {/* Asset Allocation Tags */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
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
            <span className="text-[10px] text-muted-foreground hidden sm:inline">Auto-synced across live feeds</span>
          </div>
        </div>
      </Card>

      {/* Dedicated Comprehensive Broker Balances Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* BROKER 1: INTERACTIVE BROKERS */}
        <Card className="glass-card p-5 border border-orange-500/30 relative overflow-hidden bg-slate-950/40 flex flex-col justify-between group hover:border-orange-500/60 transition-all">
          <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-3.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground text-base flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-orange-400" /> Interactive Brokers
                  </span>
                  <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 text-[10px] px-2 font-mono">
                    {ibkr?.accountNumber || 'IBKR Account'}
                  </Badge>
                  {ibkr?.accountType && (
                    <Badge variant="secondary" className="text-[10px] bg-secondary/50">
                      {ibkr.accountType}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">TWS / Client Portal Live Connection ({ibkr?.currency || 'USD'})</p>
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
                  title="Inspect full telemetry, raw feeds, and margin formulas"
                >
                  <Maximize2 className="w-3.5 h-3.5 mr-1" />
                  Deep Dive
                </Button>
              </div>
            </div>

            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-card/50 rounded-xl p-3 border border-border/40">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Net Liquidation</span>
                <p className={cn("text-lg font-black font-mono text-foreground mt-0.5", isPrivacyMode && "blur-sm")}>
                  {formatCurr(ibkrNet)}
                </p>
              </div>

              <div className="bg-card/50 rounded-xl p-3 border border-amber-500/30">
                <span className="text-[10px] uppercase font-bold text-amber-400 block">Total Buying Power</span>
                <p className={cn("text-lg font-black font-mono text-amber-300 mt-0.5", isPrivacyMode && "blur-sm")}>
                  {formatCurr(ibkrBP)}
                </p>
              </div>

              <div className="bg-card/50 rounded-xl p-3 border border-border/40 col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Cash Balance</span>
                <p className={cn("text-lg font-black font-mono text-emerald-400 mt-0.5", isPrivacyMode && "blur-sm")}>
                  {formatCurr(ibkrCash)}
                </p>
              </div>
            </div>

            {/* In-Card Tabbed Telemetry */}
            <Tabs defaultValue="liquidity" className="w-full">
              <TabsList className="bg-background/40 border border-border/30 p-0.5 grid grid-cols-4 h-8 text-[11px] mb-3">
                <TabsTrigger value="liquidity" className="text-[10px] px-1 py-1">Liquidity</TabsTrigger>
                <TabsTrigger value="margin" className="text-[10px] px-1 py-1">Margin & Risk</TabsTrigger>
                <TabsTrigger value="assets" className="text-[10px] px-1 py-1">Assets</TabsTrigger>
                <TabsTrigger value="compliance" className="text-[10px] px-1 py-1">Day Trades</TabsTrigger>
              </TabsList>

              {/* Liquidity Tab */}
              <TabsContent value="liquidity" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Available Funds:</span>
                    <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-xs")}>{formatCurr(ibkr?.availableFunds ?? ibkrBP)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Excess Liquidity:</span>
                    <strong className={cn("font-mono text-emerald-400", isPrivacyMode && "blur-xs")}>{formatCurr(ibkrExcess)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Stock BP (Leveraged):</span>
                    <strong className={cn("font-mono text-cyan-300", isPrivacyMode && "blur-xs")}>{formatCurr(ibkrBP)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">SMA Credit Line:</span>
                    <strong className={cn("font-mono text-purple-300", isPrivacyMode && "blur-xs")}>{formatCurr(ibkr?.sma ?? 0)}</strong>
                  </div>
                </div>
              </TabsContent>

              {/* Margin & Risk Tab */}
              <TabsContent value="margin" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Maintenance Req:</span>
                    <strong className={cn("font-mono text-amber-300", isPrivacyMode && "blur-xs")}>{formatCurr(ibkrMaint)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Initial Margin:</span>
                    <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-xs")}>{formatCurr(ibkr?.initMargin ?? 0)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Margin Utilization:</span>
                    <strong className="font-mono text-foreground">{ibkr?.marginUtilization?.toFixed(1) ?? '0.0'}%</strong>
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
                    <strong className={cn("font-mono", (ibkr?.dayPnL || 0) >= 0 ? "text-emerald-400" : "text-rose-400", isPrivacyMode && "blur-xs")}>
                      {(ibkr?.dayPnL || 0) >= 0 ? '+' : ''}{formatCurr(ibkr?.dayPnL || 0)}
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Open Unrealized P&L:</span>
                    <strong className={cn("font-mono", (ibkr?.unrealizedPnL || 0) >= 0 ? "text-emerald-400" : "text-rose-400", isPrivacyMode && "blur-xs")}>
                      {(ibkr?.unrealizedPnL || 0) >= 0 ? '+' : ''}{formatCurr(ibkr?.unrealizedPnL || 0)}
                    </strong>
                  </div>
                </div>
              </TabsContent>

              {/* Day Trades & Compliance Tab */}
              <TabsContent value="compliance" className="m-0 space-y-2">
                <div className="p-2 rounded-lg bg-background/50 border border-border/30 text-xs flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" /> Rolling Day Trades Available:
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-cyan-300 font-bold">Today: {ibkr?.dayTrading?.dayTradesRemaining !== undefined && ibkr.dayTrading.dayTradesRemaining >= 0 ? ibkr.dayTrading.dayTradesRemaining : 'Unlimited / None'}</span>
                    {ibkr?.dayTrading?.dayTradesRemainingT1 !== undefined && ibkr.dayTrading.dayTradesRemainingT1 >= 0 && (
                      <span className="text-muted-foreground">T+1: {ibkr.dayTrading.dayTradesRemainingT1}</span>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="mt-3.5 flex items-center justify-between text-xs text-muted-foreground pt-2.5 border-t border-border/30 font-mono">
            <span>Portfolio Share: <strong className="text-orange-300">{ibkrPct.toFixed(1)}%</strong></span>
            <span>Leverage: <strong className="text-foreground">{ibkr?.leverage ? `${ibkr.leverage.toFixed(2)}x` : '1.00x'}</strong></span>
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
                  {tasty?.nickname && (
                    <Badge variant="outline" className="text-[10px] border-border/60 text-muted-foreground">
                      {tasty.nickname}
                    </Badge>
                  )}
                  {tasty?.accountType && (
                    <Badge variant="secondary" className="text-[10px] bg-secondary/50">
                      {tasty.accountType}
                    </Badge>
                  )}
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
                  title="Inspect full telemetry, raw feeds, and margin formulas"
                >
                  <Maximize2 className="w-3.5 h-3.5 mr-1" />
                  Deep Dive
                </Button>
              </div>
            </div>

            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-card/50 rounded-xl p-3 border border-border/40">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Net Liquidation</span>
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
                <TabsTrigger value="margin" className="text-[10px] px-1 py-1">Margin & Risk</TabsTrigger>
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
                    <span className="text-muted-foreground">Withdrawable Cash:</span>
                    <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-xs")}>{formatCurr(tasty?.cashAvailableForWithdrawal ?? tastyCash)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Derivative BP:</span>
                    <strong className={cn("font-mono text-amber-300", isPrivacyMode && "blur-xs")}>{formatCurr(tastyDerivBP)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Equity BP:</span>
                    <strong className={cn("font-mono text-cyan-300", isPrivacyMode && "blur-xs")}>{formatCurr(tastyEqBP)}</strong>
                  </div>
                </div>
              </TabsContent>

              {/* Margin & Risk Tab */}
              <TabsContent value="margin" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Maintenance Req:</span>
                    <strong className={cn("font-mono text-amber-300", isPrivacyMode && "blur-xs")}>{formatCurr(tastyMaint)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Margin Equity:</span>
                    <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-xs")}>{formatCurr(tasty?.marginEquity ?? (tastyNet - tastyMaint))}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Margin Utilization:</span>
                    <strong className="font-mono text-foreground">{tasty?.marginUtilization?.toFixed(1) ?? '0.0'}%</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Margin Buffer:</span>
                    <div>{getCushionBadge(tastyCushion)}</div>
                  </div>
                </div>
              </TabsContent>

              {/* Assets Tab */}
              <TabsContent value="assets" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Options ({tastyOptCount}):</span>
                    <strong className={cn("font-mono text-purple-300", isPrivacyMode && "blur-xs")}>{formatCurr(tastyOptVal)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Equities ({tastyEqCount}):</span>
                    <strong className={cn("font-mono text-cyan-300", isPrivacyMode && "blur-xs")}>{formatCurr(tastyEqVal)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Long Derivatives:</span>
                    <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-xs")}>{formatCurr(tasty?.longDerivativeValue || 0)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Short Derivatives:</span>
                    <strong className={cn("font-mono text-rose-300", isPrivacyMode && "blur-xs")}>{formatCurr(tasty?.shortDerivativeValue || 0)}</strong>
                  </div>
                </div>
              </TabsContent>

              {/* Day Trades & Compliance Tab */}
              <TabsContent value="compliance" className="m-0 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Day Trader Status:</span>
                    <strong className="text-foreground">{tasty?.dayTrading?.isDayTrader ? 'Marked PDT' : 'Standard'}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50 border border-border/30 flex justify-between items-center">
                    <span className="text-muted-foreground">Day Trading BP:</span>
                    <strong className={cn("font-mono text-cyan-300", isPrivacyMode && "blur-xs")}>{formatCurr(tastyDayTradingBP)}</strong>
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
      </div>

      {/* Deep-Dive Inspection Modal */}
      {selectedBrokerKey && (
        <BrokerDeepDiveModal
          isOpen={!!selectedBrokerKey}
          onClose={() => setSelectedBrokerKey(null)}
          broker={brokerBalances?.[selectedBrokerKey] || null}
          brokerKey={selectedBrokerKey}
          isPrivacyMode={isPrivacyMode}
        />
      )}
    </div>
  );
}


