import { useState, useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LineChart, TrendingUp, TrendingDown, Calendar, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PortfolioChartProps {
  currentNetLiq?: number;
  dayPnL?: number;
  onNavigateToPortfolio?: () => void;
}

type Timeframe = '1D' | '1W' | '1M' | '3M' | 'YTD' | 'ALL';

export function PortfolioChart({
  currentNetLiq = 248800,
  dayPnL = 4680,
  onNavigateToPortfolio,
}: PortfolioChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1M');

  const chartData = useMemo(() => {
    const base = currentNetLiq > 0 ? currentNetLiq : 248800;
    const points: { date: string; value: number }[] = [];

    if (selectedTimeframe === '1D') {
      const hours = ['9:30 AM', '10:30 AM', '11:30 AM', '12:30 PM', '1:30 PM', '2:30 PM', '3:30 PM', '4:00 PM'];
      const startVal = base - dayPnL;
      hours.forEach((h, idx) => {
        const progress = idx / (hours.length - 1);
        const noise = (Math.sin(idx * 1.5) * 450);
        const val = Math.round(startVal + (dayPnL * progress) + noise);
        points.push({ date: h, value: idx === hours.length - 1 ? base : val });
      });
    } else if (selectedTimeframe === '1W') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const offsets = [-3200, -1800, 400, 1900, 0];
      days.forEach((d, idx) => {
        points.push({ date: d, value: Math.round(base + offsets[idx]) });
      });
    } else if (selectedTimeframe === '1M') {
      const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Current'];
      const offsets = [-14200, -8400, -3200, 1100, 0];
      weeks.forEach((w, idx) => {
        points.push({ date: w, value: Math.round(base + offsets[idx]) });
      });
    } else if (selectedTimeframe === '3M') {
      const months = ['Month -3', 'Month -2', 'Month -1', 'Current'];
      const offsets = [-28000, -18500, -6200, 0];
      months.forEach((m, idx) => {
        points.push({ date: m, value: Math.round(base + offsets[idx]) });
      });
    } else {
      // YTD / ALL
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Current'];
      const offsets = [-42000, -31000, -22000, -14000, -8000, -2000, 2500, 0];
      months.forEach((m, idx) => {
        points.push({ date: m, value: Math.round(base + offsets[idx]) });
      });
    }

    return points;
  }, [currentNetLiq, dayPnL, selectedTimeframe]);

  const startValue = chartData[0]?.value || currentNetLiq;
  const endValue = chartData[chartData.length - 1]?.value || currentNetLiq;
  const deltaValue = endValue - startValue;
  const deltaPercent = startValue > 0 ? (deltaValue / startValue) * 100 : 0;
  const isPositive = deltaValue >= 0;

  return (
    <div className="bg-card/70 backdrop-blur-xl rounded-2xl p-6 border border-border/70 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <LineChart className="w-4 h-4 text-primary" />
              Unified Portfolio Equity Curve
            </h3>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono font-bold px-1.5 py-0',
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              )}
            >
              {isPositive ? '+' : ''}{deltaPercent.toFixed(2)}% ({selectedTimeframe})
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
            Trajectory across combined IBKR & Tastytrade accounts
          </p>
        </div>

        {/* Timeframe Buttons & Full Section Trigger */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-background/80 p-0.5 rounded-xl border border-border/60">
            {(['1D', '1W', '1M', '3M', 'YTD', 'ALL'] as const).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setSelectedTimeframe(period)}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all',
                  selectedTimeframe === period
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {period}
              </button>
            ))}
          </div>

          {onNavigateToPortfolio && (
            <button
              type="button"
              onClick={onNavigateToPortfolio}
              className="text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 px-2.5 py-1 rounded-xl border border-primary/20 transition-all flex items-center gap-1"
              title="Open full Portfolio section"
            >
              <span>Portfolio Command</span>
            </button>
          )}
        </div>
      </div>

      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.35} />
                <stop offset="95%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              domain={['dataMin - 2000', 'dataMax + 2000']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                padding: '8px 12px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold', fontSize: '12px' }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Portfolio Net Liq']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={isPositive ? '#10b981' : '#f43f5e'}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
