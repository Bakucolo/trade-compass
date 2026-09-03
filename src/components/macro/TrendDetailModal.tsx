import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Target,
  Sparkles,
  Layers,
  Compass,
  AlertTriangle,
  CheckCircle2,
  LineChart as LineChartIcon,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TrendItem } from '@/services/trendFinderService';
import { TradingViewChart } from '../graphs/TradingViewChart';

function formatTrendDate(dateStr?: string): string {
  if (!dateStr) return 'Recent';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

interface TrendDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: TrendItem | null;
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
}

export function TrendDetailModal({
  isOpen,
  onClose,
  item,
  onNavigateToResearch,
  onNavigateToGraphs,
}: TrendDetailModalProps) {
  if (!item) return null;

  const isBullish = item.direction === 'BULLISH';
  const isStarting = item.stage === 'STARTING';
  const isOngoing = item.stage === 'ONGOING';
  const isExhausted = item.stage === 'EXHAUSTED';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card/95 backdrop-blur-2xl border-border/70 p-6">
        <DialogHeader className="space-y-3 pb-4 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center font-mono font-black text-base border shadow-inner',
                  isBullish
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                )}
              >
                {isBullish ? (
                  <TrendingUp className="w-6 h-6" />
                ) : (
                  <TrendingDown className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl font-black font-mono tracking-tight text-foreground">
                    {item.symbol}
                  </DialogTitle>
                  <span className="text-sm font-semibold text-muted-foreground">
                    • {item.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-accent/40 text-muted-foreground border-border/60"
                  >
                    {item.subCategory}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {item.description}
                </DialogDescription>
              </div>
            </div>

            {/* Price & Stage Badges */}
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="text-right">
                <span className="text-xl font-black font-mono text-foreground block">
                  ${item.price.toFixed(2)}
                </span>
                <span
                  className={cn(
                    'text-xs font-mono font-bold flex items-center justify-end gap-0.5',
                    item.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {item.changePercent >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {item.changePercent >= 0 ? '+' : ''}
                  {item.changePercent.toFixed(2)}% (1D)
                </span>
              </div>
            </div>
          </div>

          {/* Lifecycle & Direction Badges Row */}
          <div className="flex items-center gap-2 flex-wrap pt-2">
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-bold px-2.5 py-1 rounded-lg border gap-1.5',
                isStarting
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                  : isOngoing
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
              )}
            >
              {isStarting && <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />}
              {isOngoing && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
              {isExhausted && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
              <span>
                {isStarting ? '🌱 Trend Starting (Emerging / Breakout)' : ''}
                {isOngoing ? '🚀 Trend Ongoing (Strong Established Momentum)' : ''}
                {isExhausted ? '⚠️ Trend Exhausted (Reversal / Pullback Watch)' : ''}
              </span>
            </Badge>

            <Badge
              variant="outline"
              className={cn(
                'text-xs font-bold px-2.5 py-1 rounded-lg border uppercase',
                isBullish
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              )}
            >
              {item.direction} BIAS
            </Badge>

            <span className="text-xs font-mono text-muted-foreground ml-auto">
              Strength: <strong className="text-foreground">{item.trendStrengthScore}/100</strong> • Exhaustion Risk: <strong className={item.exhaustionRiskScore > 65 ? 'text-amber-400' : 'text-emerald-400'}>{item.exhaustionRiskScore}/100</strong>
            </span>
          </div>

          {/* Lifecycle Timing Banner */}
          {isStarting && (
            <div className="flex items-center gap-2.5 text-xs font-medium text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-3.5 py-2 rounded-xl mt-2 shadow-sm">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                <strong>Trend Start Date:</strong> <span className="font-mono text-cyan-100">{formatTrendDate(item.trendStartDate)}</span> • <strong>Duration:</strong> {item.daysInTrend ?? 1} days in trend (early stage momentum inflection)
              </span>
            </div>
          )}
          {isOngoing && (
            <div className="flex items-center gap-2.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-3.5 py-2 rounded-xl mt-2 shadow-sm">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Trend Duration:</strong> <span className="font-mono text-emerald-100">{item.daysInTrend ?? 1} days</span> in sustained trend • <strong>Started:</strong> {formatTrendDate(item.trendStartDate)}
              </span>
            </div>
          )}
          {isExhausted && (
            <div className="flex items-center gap-2.5 text-xs font-medium text-amber-300 bg-amber-950/40 border border-amber-500/30 px-3.5 py-2 rounded-xl mt-2 shadow-sm">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Exhaustion Began:</strong> <span className="font-mono text-amber-100">{formatTrendDate(item.exhaustionStartDate)}</span> ({item.daysExhausted ?? 1} days ago) • <strong>Total Trend Duration:</strong> {item.daysInTrend ?? 1} days (started {formatTrendDate(item.trendStartDate)})
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* ================= 1. TRADINGVIEW LIVE CHART ================= */}
          <div className="rounded-2xl border border-border/70 overflow-hidden bg-card/60 shadow-lg h-[360px]">
            <TradingViewChart symbol={item.symbol} timeframe="D" height={360} />
          </div>

          {/* ================= 2. TECHNICAL TELEMETRY & MOVING AVERAGE ALIGNMENT ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* 14 RSI Gauge */}
            <div className="p-3.5 rounded-2xl bg-accent/20 border border-border/50">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center justify-between">
                <span>14-Period RSI</span>
                <Activity className="w-3 h-3 text-primary" />
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={cn(
                    'text-xl font-black font-mono',
                    item.rsi14 >= 70
                      ? 'text-rose-400'
                      : item.rsi14 <= 30
                      ? 'text-emerald-400'
                      : 'text-foreground'
                  )}
                >
                  {item.rsi14.toFixed(1)}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold">
                  {item.rsi14 >= 75
                    ? 'Extreme Overbought'
                    : item.rsi14 >= 60
                    ? 'Bullish Momentum'
                    : item.rsi14 <= 30
                    ? 'Oversold'
                    : 'Neutral Zone'}
                </span>
              </div>
              <div className="w-full bg-accent/50 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    item.rsi14 >= 70
                      ? 'bg-rose-400'
                      : item.rsi14 <= 30
                      ? 'bg-emerald-400'
                      : 'bg-primary'
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, item.rsi14))}%` }}
                />
              </div>
            </div>

            {/* 20 EMA Distance */}
            <div className="p-3.5 rounded-2xl bg-accent/20 border border-border/50">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">
                20-Day EMA
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-black font-mono text-foreground">
                  ${item.dma20.toFixed(2)}
                </span>
                <span
                  className={cn(
                    'text-[11px] font-mono font-bold',
                    item.dist20DmaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {item.dist20DmaPct >= 0 ? '+' : ''}
                  {item.dist20DmaPct.toFixed(1)}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Short-term trend trail</p>
            </div>

            {/* 50 SMA Distance */}
            <div className="p-3.5 rounded-2xl bg-accent/20 border border-border/50">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">
                50-Day SMA
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-black font-mono text-foreground">
                  ${item.dma50.toFixed(2)}
                </span>
                <span
                  className={cn(
                    'text-[11px] font-mono font-bold',
                    item.dist50DmaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {item.dist50DmaPct >= 0 ? '+' : ''}
                  {item.dist50DmaPct.toFixed(1)}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Intermediate institutional base</p>
            </div>

            {/* 200 SMA Distance */}
            <div className="p-3.5 rounded-2xl bg-accent/20 border border-border/50">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">
                200-Day SMA
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-black font-mono text-foreground">
                  ${item.dma200.toFixed(2)}
                </span>
                <span
                  className={cn(
                    'text-[11px] font-mono font-bold',
                    item.dist200DmaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {item.dist200DmaPct >= 0 ? '+' : ''}
                  {item.dist200DmaPct.toFixed(1)}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Primary secular trend boundary</p>
            </div>
          </div>

          {/* ================= 3. MULTI-TIMEFRAME RETURNS STRIP ================= */}
          <div className="p-4 rounded-2xl bg-accent/10 border border-border/50">
            <span className="text-[11px] uppercase font-bold text-muted-foreground block mb-2.5">
              Multi-Timeframe Momentum Profile
            </span>
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="p-2 rounded-xl bg-card/60 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">1 Day</span>
                <span
                  className={cn(
                    'font-mono font-bold text-xs',
                    item.returns['1D'] >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {item.returns['1D'] >= 0 ? '+' : ''}
                  {item.returns['1D'].toFixed(2)}%
                </span>
              </div>
              <div className="p-2 rounded-xl bg-card/60 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">1 Week</span>
                <span
                  className={cn(
                    'font-mono font-bold text-xs',
                    item.returns['1W'] >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {item.returns['1W'] >= 0 ? '+' : ''}
                  {item.returns['1W'].toFixed(2)}%
                </span>
              </div>
              <div className="p-2 rounded-xl bg-card/60 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">1 Month</span>
                <span
                  className={cn(
                    'font-mono font-bold text-xs',
                    item.returns['1M'] >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {item.returns['1M'] >= 0 ? '+' : ''}
                  {item.returns['1M'].toFixed(2)}%
                </span>
              </div>
              <div className="p-2 rounded-xl bg-card/60 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">3 Months</span>
                <span
                  className={cn(
                    'font-mono font-bold text-xs',
                    item.returns['3M'] >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {item.returns['3M'] >= 0 ? '+' : ''}
                  {item.returns['3M'].toFixed(2)}%
                </span>
              </div>
              <div className="p-2 rounded-xl bg-card/60 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">YTD</span>
                <span
                  className={cn(
                    'font-mono font-bold text-xs',
                    item.returns['YTD'] >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {item.returns['YTD'] >= 0 ? '+' : ''}
                  {item.returns['YTD'].toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* ================= 4. TECHNICAL SIGNALS & MACRO DRIVER ================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-card/60 border border-border/50 space-y-2.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Active Technical Signals
              </span>
              <div className="flex flex-wrap gap-1.5">
                {item.signals.map((sig, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-[11px] font-mono px-2 py-0.5 bg-accent/40 text-foreground/90 border-border/60"
                  >
                    {sig}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-card/60 border border-border/50 space-y-1.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-cyan-400" /> Fundamental / Macro Driver
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {item.macroDriver}
              </p>
            </div>
          </div>

          {/* ================= 5. INSTITUTIONAL ACTIONABLE PLAYBOOK ================= */}
          <div className="p-4.5 rounded-2xl bg-gradient-to-br from-primary/10 via-accent/20 to-purple-500/10 border border-primary/30 space-y-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Tactical Execution Playbook
              </span>
            </div>
            <p className="text-xs text-foreground/90 leading-relaxed font-mono">
              {item.actionablePlaybook}
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Close
            </Button>

            <div className="flex items-center gap-2">
              {onNavigateToResearch && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onNavigateToResearch(item.symbol);
                  }}
                  className="text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Research {item.symbol}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
