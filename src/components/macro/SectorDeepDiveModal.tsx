import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Sparkles,
  ExternalLink,
  LineChart,
  ShieldAlert,
  Zap,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectorItem, SectorTimeframe, useSectorsHistory } from '@/services/sectorsService';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import { TradingViewChart } from '../graphs/TradingViewChart';

interface SectorDeepDiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  sector: SectorItem | null;
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
}

export function SectorDeepDiveModal({
  isOpen,
  onClose,
  sector,
  onNavigateToResearch,
  onNavigateToGraphs,
}: SectorDeepDiveModalProps) {
  const [chartMode, setChartMode] = useState<'ALPHA_TIMELINE' | 'TRADINGVIEW'>('ALPHA_TIMELINE');
  const [historyTimeframe, setHistoryTimeframe] = useState<'1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y'>('3M');

  const { data: historyData, isLoading: isHistoryLoading } = useSectorsHistory(
    sector ? [sector.symbol] : [],
    historyTimeframe
  );

  if (!sector) return null;

  const isPositiveDay = sector.change >= 0;
  const timeframes: SectorTimeframe[] = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y'];

  const getRotationStageBadge = (stage: SectorItem['rotationStage']) => {
    switch (stage) {
      case 'Leading':
        return {
          label: 'Leading Sector',
          badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
          dotClass: 'bg-emerald-400',
          desc: 'High relative strength & positive momentum acceleration vs SPY.',
        };
      case 'Weakening':
        return {
          label: 'Weakening Momentum',
          badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
          dotClass: 'bg-amber-400',
          desc: 'Strong medium-term returns but losing short-term velocity.',
        };
      case 'Improving':
        return {
          label: 'Improving / Turnaround',
          badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
          dotClass: 'bg-cyan-400',
          desc: 'Rebounding from oversold levels with accelerating inflows.',
        };
      case 'Lagging':
        return {
          label: 'Lagging Market',
          badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
          dotClass: 'bg-rose-400',
          desc: 'Underperforming the S&P 500 across intermediate time horizons.',
        };
    }
  };

  const stageInfo = getRotationStageBadge(sector.rotationStage);
  const rangeSpan = (sector.fiftyTwoWeekHigh - sector.fiftyTwoWeekLow) || 1;
  const currentRangePosition = Math.min(100, Math.max(0, ((sector.price - sector.fiftyTwoWeekLow) / rangeSpan) * 100));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[1000px] w-[95vw] max-h-[90vh] bg-slate-950/95 border border-slate-800 text-foreground p-0 rounded-3xl overflow-hidden flex flex-col shadow-2xl backdrop-blur-2xl">
        {/* Ambient Top Glow Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 via-primary to-purple-500 shrink-0" />

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-border/40 bg-accent/5 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 via-cyan-500/20 to-purple-500/20 border border-primary/40 flex items-center justify-center font-mono font-black text-sm text-primary shadow-inner">
              {sector.symbol}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-xl font-black font-mono tracking-tight text-foreground">
                  {sector.symbol}
                </DialogTitle>
                <span className="text-sm font-bold text-muted-foreground">•</span>
                <span className="text-sm font-bold text-foreground/90">{sector.shortName}</span>
                <Badge variant="outline" className="text-[10px] font-semibold border-white/10 uppercase tracking-wider">
                  {sector.category === 'sector' ? 'GICS Sector ETF' : 'Industry ETF'}
                </Badge>
                <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5 border flex items-center gap-1.5", stageInfo.badgeClass)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", stageInfo.dotClass)} />
                  {stageInfo.label}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {sector.name} — {sector.description}
              </DialogDescription>
            </div>
          </div>

          {/* Quick Price & Action Group */}
          <div className="flex items-center gap-3">
            <div className="text-right font-mono">
              <span className="text-xl font-black text-foreground block">
                ${sector.price.toFixed(2)}
              </span>
              <div className={cn(
                "text-xs font-bold flex items-center justify-end gap-0.5",
                isPositiveDay ? "text-emerald-400" : "text-rose-400"
              )}>
                {isPositiveDay ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)} ({sector.changePercent >= 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%)</span>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => {
                onClose();
                if (onNavigateToGraphs) onNavigateToGraphs(sector.symbol);
              }}
              className="h-9 px-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-1.5 shadow-md shadow-primary/20"
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>Full Graph</span>
            </Button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* ================= 1. MULTI-TIMEFRAME RETURNS & RELATIVE ALPHA GRID ================= */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary" /> Multi-Timeframe Performance & Alpha vs S&P 500 (SPY)
              </h3>
              <span className="text-[11px] text-muted-foreground font-mono">
                Relative Strength Rank: <strong className="text-foreground">#{sector.relativeStrengthRank}</strong> of 27
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {timeframes.map((tf) => {
                const ret = sector.returns[tf];
                const alpha = sector.alphaVsSpy[tf];
                const isRetPos = ret >= 0;
                const isAlphaPos = alpha >= 0;

                return (
                  <div
                    key={tf}
                    className="p-3 rounded-2xl bg-card/60 border border-border/50 backdrop-blur-sm flex flex-col justify-between gap-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono font-bold text-muted-foreground">
                      <span>{tf}</span>
                      <span className={cn(
                        "text-[9.5px] px-1 py-0.2 rounded font-bold",
                        isAlphaPos ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                      )}>
                        {isAlphaPos ? '+' : ''}{alpha.toFixed(1)}% vs SPY
                      </span>
                    </div>

                    <div className="text-center font-mono py-0.5">
                      <span className={cn(
                        "text-base font-black tracking-tight",
                        isRetPos ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {isRetPos ? '+' : ''}{ret.toFixed(2)}%
                      </span>
                    </div>

                    {/* Visual alpha indicator bar */}
                    <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, Math.abs(alpha) * 5 + 20)}%` }}
                        className={cn(
                          "h-full rounded-full",
                          isAlphaPos ? "bg-emerald-500" : "bg-rose-500"
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= 2. INTERACTIVE COMPARATIVE PERFORMANCE CHART ================= */}
          <Card className="bg-card/40 border border-border/60 rounded-2xl overflow-hidden shadow-inner">
            <CardHeader className="p-4 pb-2 border-b border-border/30 bg-accent/5 flex flex-row items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <LineChart className="w-4 h-4 text-cyan-400" />
                <CardTitle className="text-xs font-bold text-foreground">
                  Trajectory vs S&P 500 Benchmark (Normalized Base = 0.00%)
                </CardTitle>
              </div>

              <div className="flex items-center gap-2">
                {/* Timeframe Selector */}
                <div className="flex items-center bg-slate-900/80 p-0.5 rounded-xl border border-slate-800">
                  {(['1W', '1M', '3M', '6M', 'YTD', '1Y'] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setHistoryTimeframe(tf)}
                      className={cn(
                        "px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all",
                        historyTimeframe === tf
                          ? "bg-primary text-primary-foreground shadow"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                {/* View Switcher */}
                <div className="flex items-center bg-slate-900/80 p-0.5 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setChartMode('ALPHA_TIMELINE')}
                    className={cn(
                      "px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all",
                      chartMode === 'ALPHA_TIMELINE' ? "bg-cyan-500 text-black shadow" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Relative Chart
                  </button>
                  <button
                    onClick={() => setChartMode('TRADINGVIEW')}
                    className={cn(
                      "px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all",
                      chartMode === 'TRADINGVIEW' ? "bg-cyan-500 text-black shadow" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    TradingView Canvas
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {chartMode === 'ALPHA_TIMELINE' ? (
                <div className="h-[220px] w-full">
                  {isHistoryLoading ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      Loading comparative price series...
                    </div>
                  ) : historyData?.history && historyData.history.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={historyData.history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                        <XAxis
                          dataKey="formattedDate"
                          stroke="#64748b"
                          tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#64748b"
                          tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                          tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                          domain={['auto', 'auto']}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            borderColor: 'rgba(51, 65, 85, 0.8)',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                          }}
                          formatter={(value: any, name: any) => [`${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`, name]}
                        />
                        <ReferenceLine y={0} stroke="#64748b" strokeDasharray="2 2" />
                        <Legend
                          verticalAlign="top"
                          height={28}
                          iconType="circle"
                          wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                        />
                        <Line
                          type="monotone"
                          dataKey={sector.symbol}
                          name={`${sector.symbol} (${sector.shortName})`}
                          stroke="#38bdf8"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, fill: '#38bdf8' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="SPY"
                          name="SPY (S&P 500 Index)"
                          stroke="#94a3b8"
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                          dot={false}
                          activeDot={{ r: 4, fill: '#94a3b8' }}
                        />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      No historical comparative data available for this timeframe.
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-[320px] w-full rounded-xl overflow-hidden border border-border/40">
                  <TradingViewChart symbol={sector.symbol} theme="dark" interval="D" className="w-full h-full" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ================= 3. TECHNICAL HEALTH & AI COMMENTARY SPLIT ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Technical Health Indicators */}
            <Card className="bg-card/50 border border-border/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/30 pb-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Technical Health & Trend Structure
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">Indicators</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-border/30 flex items-center justify-between">
                  <span className="text-muted-foreground">RSI (14-Day):</span>
                  <span className={cn(
                    "font-bold",
                    sector.rsi14 > 70 ? "text-rose-400" : sector.rsi14 < 30 ? "text-emerald-400" : "text-cyan-300"
                  )}>
                    {sector.rsi14} {sector.rsi14 > 70 ? '(Overbought)' : sector.rsi14 < 35 ? '(Oversold)' : '(Neutral)'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-border/30 flex items-center justify-between">
                  <span className="text-muted-foreground">50-Day MA:</span>
                  <span className={cn("font-bold", sector.above50Dma ? "text-emerald-400" : "text-rose-400")}>
                    {sector.above50Dma ? 'Above' : 'Below'} ({sector.dma50DistancePct >= 0 ? '+' : ''}{sector.dma50DistancePct}%)
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-border/30 flex items-center justify-between">
                  <span className="text-muted-foreground">200-Day MA:</span>
                  <span className={cn("font-bold", sector.above200Dma ? "text-emerald-400" : "text-rose-400")}>
                    {sector.above200Dma ? 'Above' : 'Below'} ({sector.dma200DistancePct >= 0 ? '+' : ''}{sector.dma200DistancePct}%)
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-border/30 flex items-center justify-between">
                  <span className="text-muted-foreground">Momentum Score:</span>
                  <span className={cn("font-bold", sector.momentumScore >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {sector.momentumScore >= 0 ? '+' : ''}{sector.momentumScore} / 10
                  </span>
                </div>
              </div>

              {/* 52-Week Range Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span>52W Low: ${sector.fiftyTwoWeekLow.toFixed(2)} (+{sector.distance52wLowPct}%)</span>
                  <span>52W High: ${sector.fiftyTwoWeekHigh.toFixed(2)} ({sector.distance52wHighPct}%)</span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden relative">
                  <div
                    style={{ width: `${currentRangePosition}%` }}
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isPositiveDay ? "bg-emerald-500" : "bg-rose-500"
                    )}
                  />
                </div>
              </div>
            </Card>

            {/* AI Sector Trend Commentary & Catalysts */}
            <Card className="bg-card/50 border border-border/60 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-border/30 pb-2 mb-2.5">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" /> AI Sector Rotation Commentary
                  </span>
                  <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30 font-mono">
                    Trend Engine
                  </Badge>
                </div>

                <p className="text-xs text-foreground/90 leading-relaxed">
                  {sector.aiCommentary}
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border/30">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Key Catalysts & Drivers:</span>
                <div className="flex flex-wrap gap-1.5">
                  {sector.catalysts.map((cat, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-900 border border-border/50 text-slate-300 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400" />
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* ================= 4. TOP CONSTITUENTS & HOLDINGS TABLE ================= */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5 text-purple-400" /> Top Constituent Holdings & Market Movers
              </h3>
              <span className="text-[11px] text-muted-foreground">
                Click any ticker to open in deep research
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {sector.topHoldings.map((holding) => (
                <div
                  key={holding.symbol}
                  className="p-3 rounded-2xl bg-card/60 border border-border/40 hover:border-primary/50 transition-all flex items-center justify-between group shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-900/90 border border-white/5 flex items-center justify-center font-mono font-bold text-xs text-foreground group-hover:text-primary transition-colors shrink-0">
                      {holding.symbol.slice(0, 4)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs text-foreground group-hover:text-primary transition-colors">
                          {holding.symbol}
                        </span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono">
                          {holding.weight}%
                        </span>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground truncate max-w-[140px]" title={holding.name}>
                        {holding.name}
                      </p>
                    </div>
                  </div>

                  {/* 1-Click Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        onClose();
                        if (onNavigateToResearch) onNavigateToResearch(holding.symbol);
                      }}
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                      title={`Research ${holding.symbol}`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        onClose();
                        if (onNavigateToGraphs) onNavigateToGraphs(holding.symbol);
                      }}
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-cyan-300 hover:bg-cyan-950/30"
                      title={`Open ${holding.symbol} Chart`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
