// src/components/dashboard/StockHoverGraphCard.tsx
import React, { useState, useId } from 'react';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  LineChart,
  Loader2,
  ExternalLink,
  Activity,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useStockMiniChart, MiniChartRange } from '@/services/miniChartService';

interface StockHoverGraphCardProps {
  symbol: string;
  name?: string;
  price?: number;
  changePercent?: number;
  onNavigateToGraphs?: (symbol: string) => void;
  children?: React.ReactNode;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export const StockHoverGraphCard: React.FC<StockHoverGraphCardProps> = ({
  symbol,
  name,
  price,
  changePercent,
  onNavigateToGraphs,
  children,
  className,
  side = 'top',
  align = 'start',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<MiniChartRange>('1mo');
  const gradientId = useId();

  const cleanSymbol = (symbol || '').trim().toUpperCase();

  // Lazy query: Only fetch historical price points when hover card is triggered
  const { data: chartData, isLoading, isError } = useStockMiniChart(
    cleanSymbol,
    selectedRange,
    { enabled: isOpen && Boolean(cleanSymbol) }
  );

  const handleNavigate = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!cleanSymbol) return;

    if (onNavigateToGraphs) {
      onNavigateToGraphs(cleanSymbol);
    }
    window.dispatchEvent(
      new CustomEvent('select-graphs-ticker', { detail: cleanSymbol })
    );
  };

  const effectivePrice = chartData?.currentPrice ?? price ?? 0;
  const effectiveDayChange = chartData?.dayChangePercent ?? changePercent ?? 0;
  const isDayPositive = effectiveDayChange >= 0;

  const periodChange = chartData?.periodChangePercent ?? effectiveDayChange;
  const isPeriodPositive = periodChange >= 0;

  const points = chartData?.points || [];

  return (
    <HoverCard openDelay={200} closeDelay={150} onOpenChange={setIsOpen}>
      <HoverCardTrigger asChild>
        <span
          onClick={handleNavigate}
          className={cn(
            'cursor-pointer transition-all inline-flex items-center gap-1 select-none',
            className
          )}
          aria-label={`Open ${cleanSymbol} chart in Graphs section`}
        >
          {children || cleanSymbol}
        </span>
      </HoverCardTrigger>

      <HoverCardContent
        side={side}
        align={align}
        sideOffset={8}
        avoidCollisions={true}
        collisionPadding={16}
        className="w-80 sm:w-96 p-3.5 bg-slate-950/98 border border-purple-500/40 text-slate-100 shadow-2xl backdrop-blur-2xl rounded-2xl z-[9999] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top Header: Symbol, Name, Price, and Day Change */}
        <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-border/50">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-black text-sm tracking-wider text-white">
                {cleanSymbol}
              </span>
              <Badge
                variant="outline"
                className="text-[9px] font-mono px-1.5 py-0 bg-purple-500/10 text-purple-300 border-purple-500/30"
              >
                {chartData?.currency || 'USD'}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[190px] mt-0.5">
              {chartData?.name || name || `${cleanSymbol} Asset`}
            </p>
          </div>

          <div className="text-right">
            <div className="font-mono font-bold text-sm text-white">
              {effectivePrice > 0 ? `$${effectivePrice.toFixed(2)}` : '—'}
            </div>
            <div
              className={cn(
                'flex items-center justify-end gap-0.5 font-mono text-[11px] font-semibold',
                isDayPositive ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {isDayPositive ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              <span>
                {isDayPositive ? '+' : ''}
                {effectiveDayChange.toFixed(2)}% Today
              </span>
            </div>
          </div>
        </div>

        {/* Timeframe Selector & Period Performance */}
        <div className="flex items-center justify-between pt-2 pb-1.5 text-xs">
          <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
            {(['1w', '1mo', '3mo', '1y'] as MiniChartRange[]).map((range) => {
              const label =
                range === '1w'
                  ? '1W'
                  : range === '1mo'
                  ? '1M'
                  : range === '3mo'
                  ? '3M'
                  : '1Y';
              const isSelected = selectedRange === range;

              return (
                <button
                  key={range}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRange(range);
                  }}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-mono font-bold rounded-md transition-all cursor-pointer',
                    isSelected
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {chartData?.periodChangePercent !== undefined && (
            <div
              className={cn(
                'text-[10px] font-mono font-semibold',
                isPeriodPositive ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              <span>{selectedRange.toUpperCase()}: </span>
              <strong>
                {isPeriodPositive ? '+' : ''}
                {chartData.periodChangePercent.toFixed(2)}%
              </strong>
            </div>
          )}
        </div>

        {/* Mini Chart Canvas */}
        <div className="h-28 w-full mt-1 relative bg-slate-900/40 rounded-xl border border-slate-800/80 overflow-hidden flex items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              <span className="text-[10px] font-mono">Loading chart...</span>
            </div>
          ) : isError || points.length === 0 ? (
            <div className="text-center p-3 text-[11px] text-slate-400 font-mono">
              Chart data unavailable for {cleanSymbol}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={points}
                margin={{ top: 8, right: 6, left: 6, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={isPeriodPositive ? '#10b981' : '#f43f5e'}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor={isPeriodPositive ? '#10b981' : '#f43f5e'}
                      stopOpacity={0.0}
                    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis
                  domain={['dataMin', 'dataMax']}
                  hide
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-950/95 border border-slate-700/80 p-1.5 rounded-lg shadow-xl text-[10px] font-mono">
                          <div className="text-slate-400">{data.date}</div>
                          <div className="font-bold text-white">
                            ${Number(data.close).toFixed(2)}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={isPeriodPositive ? '#10b981' : '#f43f5e'}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Telemetry Summary Strip */}
        <div className="grid grid-cols-3 gap-2 pt-2.5 pb-1 text-[10px] font-mono text-slate-300 border-t border-border/40 mt-2">
          <div>
            <span className="text-slate-500 uppercase block text-[8.5px]">Low</span>
            <span className="font-semibold text-slate-200">
              {chartData?.periodLow ? `$${chartData.periodLow.toFixed(2)}` : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 uppercase block text-[8.5px]">High</span>
            <span className="font-semibold text-slate-200">
              {chartData?.periodHigh ? `$${chartData.periodHigh.toFixed(2)}` : '—'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 uppercase block text-[8.5px]">52W High</span>
            <span className="font-semibold text-slate-200">
              {chartData?.fiftyTwoWeekHigh ? `$${chartData.fiftyTwoWeekHigh.toFixed(2)}` : '—'}
            </span>
          </div>
        </div>

        {/* 1-Click Action to open full graph */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleNavigate}
          className="w-full mt-2 h-7 text-xs font-semibold gap-1.5 border-purple-500/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 hover:text-white transition-all cursor-pointer"
        >
          <LineChart className="w-3.5 h-3.5 text-purple-300" />
          <span>Open Full Graph in TradingView</span>
          <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
        </Button>
      </HoverCardContent>
    </HoverCard>
  );
};
