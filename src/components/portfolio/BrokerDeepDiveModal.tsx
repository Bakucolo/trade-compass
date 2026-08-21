import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Wallet,
  ShieldAlert,
  Zap,
  Layers,
  Search,
  Copy,
  Check,
  Scale,
  Calendar,
  TrendingUp,
  Activity
} from 'lucide-react';
import { BrokerAccountBalance } from '@/services/portfolioBalanceService';
import { cn } from '@/lib/utils';

interface BrokerDeepDiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  broker: BrokerAccountBalance | null;
  brokerKey: 'ibkr' | 'tastytrade';
  isPrivacyMode?: boolean;
}

export function BrokerDeepDiveModal({
  isOpen,
  onClose,
  broker,
  brokerKey,
  isPrivacyMode = false,
}: BrokerDeepDiveModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  if (!broker) return null;

  const isIBKR = brokerKey === 'ibkr';
  const rawMetrics = broker.rawMetrics || {};
  const rawKeys = Object.keys(rawMetrics).sort();

  const filteredKeys = rawKeys.filter((key) =>
    key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(rawMetrics[key]).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(JSON.stringify(rawMetrics, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurr = (val?: number) => {
    if (val === undefined || isNaN(val)) return '$0.00';
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPct = (val?: number) => {
    if (val === undefined || isNaN(val)) return '0.00%';
    return `${val.toFixed(2)}%`;
  };

  // Cushion status indicator
  const cushion = broker.cushion ?? 50;
  const isHealthyCushion = cushion > 25;
  const isModerateCushion = cushion >= 15 && cushion <= 25;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 bg-slate-950/95 border-border/60 backdrop-blur-xl">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/40 bg-card/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2.5 rounded-xl border flex items-center justify-center",
                  isIBKR
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                )}
              >
                {isIBKR ? <Wallet className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <span>{broker.name}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs px-2",
                      isIBKR ? "border-orange-500/40 text-orange-300" : "border-rose-500/40 text-rose-300"
                    )}
                  >
                    {broker.accountNumber}
                  </Badge>
                  {broker.accountType && (
                    <Badge variant="secondary" className="text-[11px] bg-secondary/60">
                      {broker.accountType}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Deep-dive financial telemetry, margin requirements, liquidity breakdown, and raw broker feeds.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  "text-xs font-semibold px-2.5 py-1",
                  broker.status === 'connected' || broker.status === 'active'
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                )}
              >
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full mr-1.5 inline-block",
                  broker.status === 'connected' || broker.status === 'active' ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                )} />
                {broker.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        {/* Modal Body with Tabs */}
        <Tabs defaultValue="margin" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-3 border-b border-border/30 bg-muted/20">
            <TabsList className="bg-background/50 border border-border/40 p-1 w-full sm:w-auto grid grid-cols-4 sm:flex gap-1">
              <TabsTrigger value="margin" className="text-xs data-[state=active]:bg-primary/20">
                <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                Margin & Risk
              </TabsTrigger>
              <TabsTrigger value="liquidity" className="text-xs data-[state=active]:bg-primary/20">
                <Zap className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
                Buying Power
              </TabsTrigger>
              <TabsTrigger value="assets" className="text-xs data-[state=active]:bg-primary/20">
                <Layers className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                Assets & P&L
              </TabsTrigger>
              <TabsTrigger value="raw" className="text-xs data-[state=active]:bg-primary/20">
                <Activity className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                Raw Telemetry ({rawKeys.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 p-6">
            {/* 1. MARGIN & RISK TAB */}
            <TabsContent value="margin" className="m-0 space-y-5">
              {/* Cushion & Utilization Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border/50 bg-card/40 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-cyan-400" /> Margin Cushion / Buffer
                    </span>
                    <Badge
                      className={cn(
                        "text-[10px] px-2 py-0.5",
                        isHealthyCushion
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : isModerateCushion
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      )}
                    >
                      {isHealthyCushion ? 'Healthy' : isModerateCushion ? 'Moderate Risk' : 'Critical Margin'}
                    </Badge>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className={cn("text-2xl font-bold font-mono text-foreground", isPrivacyMode && "blur-sm")}>
                      {formatPct(broker.cushion)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Excess buffer before liquidation
                    </span>
                  </div>
                  {/* Visual Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-2">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isHealthyCushion ? "bg-emerald-500" : isModerateCushion ? "bg-amber-500" : "bg-rose-500"
                      )}
                      style={{ width: `${Math.min(100, Math.max(5, broker.cushion || 0))}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border/50 bg-card/40 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-400" /> Margin Utilization
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      Maint Req / Net Liq
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className={cn("text-2xl font-bold font-mono text-amber-300", isPrivacyMode && "blur-sm")}>
                      {formatPct(broker.marginUtilization)}
                    </span>
                    <span className={cn("text-xs font-mono text-muted-foreground", isPrivacyMode && "blur-sm")}>
                      Req: {formatCurr(broker.maintMargin)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-2">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        (broker.marginUtilization || 0) < 50
                          ? "bg-cyan-500"
                          : (broker.marginUtilization || 0) < 80
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, broker.marginUtilization || 0))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Detailed Metrics Table */}
              <div className="border border-border/40 rounded-xl overflow-hidden bg-card/20">
                <div className="p-3 bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Scale className="w-4 h-4 text-primary" /> Margin Collateral & Regulatory Metrics
                </div>
                <div className="divide-y divide-border/20 text-xs">
                  <div className="p-3 flex items-center justify-between hover:bg-card/40 transition-colors">
                    <div>
                      <span className="font-semibold text-foreground">Maintenance Margin Requirement</span>
                      <p className="text-[11px] text-muted-foreground">Minimum equity needed to maintain open derivative & equity positions.</p>
                    </div>
                    <span className={cn("font-mono font-bold text-amber-300 text-sm", isPrivacyMode && "blur-sm")}>
                      {formatCurr(broker.maintMargin)}
                    </span>
                  </div>

                  <div className="p-3 flex items-center justify-between hover:bg-card/40 transition-colors">
                    <div>
                      <span className="font-semibold text-foreground">Initial Margin Requirement</span>
                      <p className="text-[11px] text-muted-foreground">Capital buffer required to open new positions.</p>
                    </div>
                    <span className={cn("font-mono font-bold text-foreground text-sm", isPrivacyMode && "blur-sm")}>
                      {formatCurr(broker.initMargin)}
                    </span>
                  </div>

                  {broker.regTMargin !== undefined && (
                    <div className="p-3 flex items-center justify-between hover:bg-card/40 transition-colors">
                      <div>
                        <span className="font-semibold text-foreground">Reg-T Margin Requirement</span>
                        <p className="text-[11px] text-muted-foreground">Federal Reserve Regulation T overnight requirement for margined assets.</p>
                      </div>
                      <span className={cn("font-mono font-bold text-cyan-300 text-sm", isPrivacyMode && "blur-sm")}>
                        {formatCurr(broker.regTMargin)}
                      </span>
                    </div>
                  )}

                  {broker.excessLiquidity !== undefined && (
                    <div className="p-3 flex items-center justify-between hover:bg-card/40 transition-colors">
                      <div>
                        <span className="font-semibold text-foreground">Excess Liquidity</span>
                        <p className="text-[11px] text-muted-foreground">Available surplus cushion over maintenance margin requirements.</p>
                      </div>
                      <span className={cn("font-mono font-bold text-emerald-400 text-sm", isPrivacyMode && "blur-sm")}>
                        {formatCurr(broker.excessLiquidity)}
                      </span>
                    </div>
                  )}

                  {broker.sma !== undefined && broker.sma > 0 && (
                    <div className="p-3 flex items-center justify-between hover:bg-card/40 transition-colors">
                      <div>
                        <span className="font-semibold text-foreground">Special Memorandum Account (SMA)</span>
                        <p className="text-[11px] text-muted-foreground">Regulatory credit line balance preserved from prior market gains.</p>
                      </div>
                      <span className={cn("font-mono font-bold text-purple-300 text-sm", isPrivacyMode && "blur-sm")}>
                        {formatCurr(broker.sma)}
                      </span>
                    </div>
                  )}

                  {broker.leverage !== undefined && (
                    <div className="p-3 flex items-center justify-between hover:bg-card/40 transition-colors">
                      <div>
                        <span className="font-semibold text-foreground">Effective Leverage Ratio</span>
                        <p className="text-[11px] text-muted-foreground">Gross position exposure relative to total net liquidation.</p>
                      </div>
                      <span className={cn("font-mono font-bold text-foreground text-sm", isPrivacyMode && "blur-sm")}>
                        {broker.leverage.toFixed(2)}x
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* 2. LIQUIDITY & BUYING POWER TAB */}
            <TabsContent value="liquidity" className="m-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-500/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-cyan-400">Derivative / Option BP</span>
                  <p className={cn("text-xl font-bold font-mono text-cyan-300", isPrivacyMode && "blur-sm")}>
                    {formatCurr(broker.derivativeBuyingPower ?? broker.buyingPower)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Capital for option trades</p>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-blue-400">Equity / Stock BP</span>
                  <p className={cn("text-xl font-bold font-mono text-blue-300", isPrivacyMode && "blur-sm")}>
                    {formatCurr(broker.equityBuyingPower ?? broker.buyingPower)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Leveraged stock purchasing power</p>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-emerald-400">Cash Available for Withdrawal</span>
                  <p className={cn("text-xl font-bold font-mono text-emerald-300", isPrivacyMode && "blur-sm")}>
                    {formatCurr(broker.cashAvailableForWithdrawal ?? broker.cash)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Settled cash ready to transfer</p>
                </div>
              </div>

              <div className="border border-border/40 rounded-xl overflow-hidden bg-card/20 divide-y divide-border/20 text-xs">
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground">Total Cash Balance</span>
                    <p className="text-[11px] text-muted-foreground">Raw cash in account currency ({broker.currency || 'USD'}).</p>
                  </div>
                  <span className={cn("font-mono font-bold text-foreground text-sm", isPrivacyMode && "blur-sm")}>
                    {formatCurr(broker.cash)}
                  </span>
                </div>

                {broker.availableFunds !== undefined && (
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground">Available Funds</span>
                      <p className="text-[11px] text-muted-foreground">IBKR equity with loan value minus initial margin requirement.</p>
                    </div>
                    <span className={cn("font-mono font-bold text-foreground text-sm", isPrivacyMode && "blur-sm")}>
                      {formatCurr(broker.availableFunds)}
                    </span>
                  </div>
                )}

                {broker.dayTrading?.dayTradingBuyingPower !== undefined && (
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground">Day Trading Buying Power</span>
                      <p className="text-[11px] text-muted-foreground">Intraday 4x leverage for pattern day traders.</p>
                    </div>
                    <span className={cn("font-mono font-bold text-foreground text-sm", isPrivacyMode && "blur-sm")}>
                      {formatCurr(broker.dayTrading.dayTradingBuyingPower)}
                    </span>
                  </div>
                )}

                {broker.openOrderReserve !== undefined && broker.openOrderReserve > 0 && (
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground">Open Order Reserve Requirement</span>
                      <p className="text-[11px] text-muted-foreground">Capital reserved for active resting unfilled orders.</p>
                    </div>
                    <span className={cn("font-mono font-bold text-amber-300 text-sm", isPrivacyMode && "blur-sm")}>
                      {formatCurr(broker.openOrderReserve)}
                    </span>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 3. ASSETS & P&L TAB */}
            <TabsContent value="assets" className="m-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Options Exposure */}
                <div className="p-4 rounded-xl border border-border/50 bg-card/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-400" /> Options Exposure
                    </span>
                    <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-300">
                      {broker.optionsCount} Contracts
                    </Badge>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Net Options Value</span>
                    <span className={cn("text-xl font-bold font-mono text-purple-300", isPrivacyMode && "blur-sm")}>
                      {formatCurr(broker.optionsValue)}
                    </span>
                  </div>
                  {broker.longDerivativeValue !== undefined && broker.shortDerivativeValue !== undefined && (
                    <div className="text-[11px] text-muted-foreground space-y-1 pt-2 border-t border-border/20">
                      <div className="flex justify-between">
                        <span>Long Derivatives:</span>
                        <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-sm")}>
                          {formatCurr(broker.longDerivativeValue)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Short Derivatives:</span>
                        <strong className={cn("font-mono text-rose-300", isPrivacyMode && "blur-sm")}>
                          {formatCurr(broker.shortDerivativeValue)}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Equities Exposure */}
                <div className="p-4 rounded-xl border border-border/50 bg-card/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-cyan-400" /> Equities Exposure
                    </span>
                    <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-300">
                      {broker.equitiesCount} Holdings
                    </Badge>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Net Stock Value</span>
                    <span className={cn("text-xl font-bold font-mono text-cyan-300", isPrivacyMode && "blur-sm")}>
                      {formatCurr(broker.equitiesValue)}
                    </span>
                  </div>
                  {broker.longEquityValue !== undefined && (
                    <div className="text-[11px] text-muted-foreground space-y-1 pt-2 border-t border-border/20">
                      <div className="flex justify-between">
                        <span>Long Stock Value:</span>
                        <strong className={cn("font-mono text-foreground", isPrivacyMode && "blur-sm")}>
                          {formatCurr(broker.longEquityValue)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Short Stock Value:</span>
                        <strong className={cn("font-mono text-rose-300", isPrivacyMode && "blur-sm")}>
                          {formatCurr(broker.shortEquityValue || 0)}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* P&L Breakdown */}
              <div className="border border-border/40 rounded-xl p-4 bg-card/20 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">P&L & Return Metrics</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-background/40 p-3 rounded-lg border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Today's P&L</span>
                    <p className={cn("text-base font-bold font-mono mt-0.5", broker.dayPnL >= 0 ? "text-emerald-400" : "text-rose-400", isPrivacyMode && "blur-sm")}>
                      {broker.dayPnL >= 0 ? '+' : ''}{formatCurr(broker.dayPnL)}
                    </p>
                  </div>
                  <div className="bg-background/40 p-3 rounded-lg border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Unrealized Total P&L</span>
                    <p className={cn("text-base font-bold font-mono mt-0.5", broker.unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400", isPrivacyMode && "blur-sm")}>
                      {broker.unrealizedPnL >= 0 ? '+' : ''}{formatCurr(broker.unrealizedPnL)}
                    </p>
                  </div>
                  <div className="bg-background/40 p-3 rounded-lg border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Realized Day P&L</span>
                    <p className={cn("text-base font-bold font-mono mt-0.5 text-foreground", isPrivacyMode && "blur-sm")}>
                      {formatCurr(broker.realizedDayPnL ?? broker.realizedPnL ?? 0)}
                    </p>
                  </div>
                  <div className="bg-background/40 p-3 rounded-lg border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Accrued Cash/Div</span>
                    <p className={cn("text-base font-bold font-mono mt-0.5 text-foreground", isPrivacyMode && "blur-sm")}>
                      {formatCurr((broker.accruedCash || 0) + (broker.accruedDividend || 0))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Day Trading Schedule (IBKR & Tasty) */}
              {broker.dayTrading && (
                <div className="border border-border/40 rounded-xl p-4 bg-card/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-400" /> Pattern Day Trading & Rolling Schedule
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {broker.dayTrading.isDayTrader ? 'PDT Flagged' : 'Standard Account'}
                    </Badge>
                  </div>
                  {broker.dayTrading.dayTradesRemaining !== undefined && broker.dayTrading.dayTradesRemaining >= 0 && (
                    <div className="grid grid-cols-5 gap-2 pt-2 text-center">
                      <div className="bg-background/60 p-2 rounded-lg border border-border/30">
                        <span className="text-[10px] text-muted-foreground block">Today</span>
                        <strong className="text-sm font-mono text-cyan-300">{broker.dayTrading.dayTradesRemaining} left</strong>
                      </div>
                      <div className="bg-background/60 p-2 rounded-lg border border-border/30">
                        <span className="text-[10px] text-muted-foreground block">T+1</span>
                        <strong className="text-sm font-mono text-foreground">{broker.dayTrading.dayTradesRemainingT1 ?? '-'}</strong>
                      </div>
                      <div className="bg-background/60 p-2 rounded-lg border border-border/30">
                        <span className="text-[10px] text-muted-foreground block">T+2</span>
                        <strong className="text-sm font-mono text-foreground">{broker.dayTrading.dayTradesRemainingT2 ?? '-'}</strong>
                      </div>
                      <div className="bg-background/60 p-2 rounded-lg border border-border/30">
                        <span className="text-[10px] text-muted-foreground block">T+3</span>
                        <strong className="text-sm font-mono text-foreground">{broker.dayTrading.dayTradesRemainingT3 ?? '-'}</strong>
                      </div>
                      <div className="bg-background/60 p-2 rounded-lg border border-border/30">
                        <span className="text-[10px] text-muted-foreground block">T+4</span>
                        <strong className="text-sm font-mono text-foreground">{broker.dayTrading.dayTradesRemainingT4 ?? '-'}</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* 4. RAW TELEMETRY TAB */}
            <TabsContent value="raw" className="m-0 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search raw keys or values (e.g. NetLiquidation, SMA, CashBalance)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 text-xs h-9 bg-background/50"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyRaw} className="text-xs h-9">
                  {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                  {copied ? 'Copied' : 'Copy JSON'}
                </Button>
              </div>

              {filteredKeys.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-xl">
                  No metrics match "{searchTerm}". Try a different term or clear the filter.
                </div>
              ) : (
                <div className="border border-border/40 rounded-xl overflow-hidden bg-card/20 divide-y divide-border/20 text-xs">
                  {filteredKeys.map((key) => {
                    const val = rawMetrics[key];
                    const displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                    return (
                      <div key={key} className="p-2.5 px-3.5 flex items-center justify-between hover:bg-card/50 transition-colors font-mono">
                        <span className="text-muted-foreground font-semibold select-all text-[11px] truncate max-w-[50%]">
                          {key}
                        </span>
                        <span className={cn("text-foreground font-bold text-[11px] select-all truncate max-w-[45%]", isPrivacyMode && "blur-xs")}>
                          {displayVal}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
