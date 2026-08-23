import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShieldCheck,
  Eye,
  EyeOff,
  Clock,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PortfolioBalancesResponse } from '@/services/portfolioBalanceService';

interface ExecutiveStatsRibbonProps {
  balancesData?: PortfolioBalancesResponse;
  positions?: any[];
  isPrivacyMode: boolean;
  onTogglePrivacy: () => void;
}

export function ExecutiveStatsRibbon({
  balancesData,
  positions = [],
  isPrivacyMode,
  onTogglePrivacy,
}: ExecutiveStatsRibbonProps) {
  const total = balancesData?.total;
  const netLiq = total?.netLiquidatingValue || 0;
  const dayPnL = total?.dayPnL || 0;
  const buyingPower = total?.buyingPower || 0;
  const unrealizedPnL = total?.unrealizedPnL || 0;

  // Day P&L %
  const prevCloseNetLiq = netLiq - dayPnL;
  const dayPnLPercent = prevCloseNetLiq > 0 ? (dayPnL / prevCloseNetLiq) * 100 : 0;
  const isDayPositive = dayPnL >= 0;

  // Calculate Yesterday's / Prior Day Estimate from position data
  // Using positions daily change and prior day close delta
  const yesterdayPnLEstimate = positions.reduce((acc, pos) => {
    // If dailyPnL is available, calculate prior day delta
    const val = pos.marketValue || 0;
    const changePct = pos.dailyChangePercent || 0;
    return acc + (val * (changePct / 100));
  }, 0) || dayPnL;

  const yesterdayPctEstimate = netLiq > 0 ? (yesterdayPnLEstimate / (netLiq - yesterdayPnLEstimate)) * 100 : 0;
  const isYesterdayPositive = yesterdayPnLEstimate >= 0;

  // Margin Cushion & Health
  const ibkrCushion = balancesData?.brokers?.ibkr?.cushion ? balancesData.brokers.ibkr.cushion * 100 : 85;
  const marginCushionPercent = Math.min(100, Math.max(0, ibkrCushion));
  const isMarginHealthy = marginCushionPercent >= 30;

  // Currency Formatter with Privacy Masking
  const fmt = (val: number, isPercent = false) => {
    if (isPrivacyMode) return '••••••';
    if (isPercent) return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
    return `${val >= 0 ? '+' : '-'}$${Math.abs(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const fmtCurrencyOnly = (val: number) => {
    if (isPrivacyMode) return '••••••';
    return `$${val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Net Liquidating Value */}
      <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-md hover:border-primary/40 transition-all rounded-2xl overflow-hidden relative group">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-indigo-400 to-primary" />
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-primary" /> Net Liquidating Value
            </span>
            <button
              type="button"
              onClick={onTogglePrivacy}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent/50"
              title={isPrivacyMode ? 'Show Balances' : 'Hide Balances (Privacy Mode)'}
            >
              {isPrivacyMode ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div>
            <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-foreground">
              {fmtCurrencyOnly(netLiq)}
            </p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground font-mono flex-wrap">
              <span className="text-orange-400">IBKR: {fmtCurrencyOnly(balancesData?.brokers?.ibkr?.netLiquidatingValue || 0)}</span>
              <span>•</span>
              <span className="text-rose-400">Tasty: {fmtCurrencyOnly(balancesData?.brokers?.tastytrade?.netLiquidatingValue || 0)}</span>
              <span>•</span>
              <span className="text-blue-400">T212: {fmtCurrencyOnly(balancesData?.brokers?.trading212?.netLiquidatingValue || 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Today's Real-Time P&L */}
      <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-md hover:border-primary/40 transition-all rounded-2xl overflow-hidden relative group">
        <div
          className={cn(
            'h-1 w-full',
            isDayPositive
              ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600'
              : 'bg-gradient-to-r from-rose-500 via-pink-400 to-rose-600'
          )}
        />
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-primary" /> Today's Performance
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono font-bold px-1.5 py-0',
                isDayPositive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              )}
            >
              {isDayPositive ? <ArrowUpRight className="w-3 h-3 inline mr-0.5" /> : <ArrowDownRight className="w-3 h-3 inline mr-0.5" />}
              {fmt(dayPnLPercent, true)}
            </Badge>
          </div>

          <div>
            <p
              className={cn(
                'text-2xl sm:text-3xl font-black font-mono tracking-tight',
                isDayPositive ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {fmt(dayPnL)}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono mt-1">
              Unrealized: {fmt(unrealizedPnL)} all-time
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3. Yesterday / Prior Day Performance */}
      <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-md hover:border-primary/40 transition-all rounded-2xl overflow-hidden relative group">
        <div
          className={cn(
            'h-1 w-full',
            isYesterdayPositive
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
              : 'bg-gradient-to-r from-rose-500 to-pink-500'
          )}
        />
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" /> Yesterday's Return
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/60 text-muted-foreground">
              Prior Close
            </span>
          </div>

          <div>
            <p
              className={cn(
                'text-2xl sm:text-3xl font-black font-mono tracking-tight',
                isYesterdayPositive ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {fmt(yesterdayPnLEstimate)}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono mt-1">
              Prior Day Close: {fmtCurrencyOnly(prevCloseNetLiq > 0 ? prevCloseNetLiq : netLiq)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 4. Unified Buying Power & Margin Cushion */}
      <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-md hover:border-primary/40 transition-all rounded-2xl overflow-hidden relative group">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-blue-400 to-indigo-500" />
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Buying Power & Margin
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono font-bold px-1.5 py-0',
                isMarginHealthy
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              )}
            >
              {marginCushionPercent.toFixed(0)}% Cushion
            </Badge>
          </div>

          <div>
            <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-foreground">
              {fmtCurrencyOnly(buyingPower)}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono mt-1">
              Active Positions: {positions.length} holdings
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
