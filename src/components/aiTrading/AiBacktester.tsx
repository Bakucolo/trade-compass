import React, { useState } from 'react';
import { 
  useRunBacktest, 
  useDeployStrategy, 
  useAiTradingSettings,
  BacktestResult 
} from '@/services/aiTradingService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { 
  Play, 
  TrendingUp, 
  ShieldCheck, 
  BarChart3, 
  Zap, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle,
  Clock,
  Sparkles
} from 'lucide-react';

export const AiBacktester: React.FC = () => {
  const { toast } = useToast();
  const { data: settings } = useAiTradingSettings();
  const runBacktestMutation = useRunBacktest();
  const deployMutation = useDeployStrategy();

  const [symbol, setSymbol] = useState('NVDA');
  const [strategyType, setStrategyType] = useState('MOMENTUM_TREND_RIDER');
  const [timeframe, setTimeframe] = useState<'1Day' | '1Hour'>('1Day');
  const [lookbackDays, setLookbackDays] = useState(180);
  const [positionSizeDollar, setPositionSizeDollar] = useState<number>(settings?.fixedDollarAmount || 1000);

  const [result, setResult] = useState<BacktestResult | null>(null);

  const handleRunBacktest = async () => {
    if (!symbol.trim()) {
      toast({ title: 'Please enter a ticker symbol', variant: 'destructive' });
      return;
    }

    try {
      const data = await runBacktestMutation.mutateAsync({
        symbol: symbol.toUpperCase().trim(),
        strategyType,
        timeframe,
        lookbackDays,
        positionSizeDollar: Number(positionSizeDollar) || 1000,
      });
      setResult(data);
      toast({
        title: `Backtest Complete: ${data.symbol}`,
        description: `Strategy achieved ${data.totalReturnPercent}% return (Win Rate: ${data.winRatePercent}%).`,
      });
    } catch (err: any) {
      toast({
        title: 'Backtest Failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeploy = async () => {
    if (!result) return;
    try {
      await deployMutation.mutateAsync({
        name: result.strategyName,
        symbol: result.symbol,
        strategyType: result.strategyType,
        parameters: result.parametersUsed,
        timeframe: result.timeframe as any,
        winRateBacktest: result.winRatePercent,
        totalReturnBacktest: result.totalReturnPercent,
      });
      toast({
        title: `Deployed to Paper Trading: ${result.strategyName}`,
        description: `Now actively monitoring ${result.symbol} with your position size of $${positionSizeDollar}.`,
      });
    } catch (err: any) {
      toast({ title: 'Deploy Failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Form Card */}
      <div className="p-5 rounded-xl bg-card border border-border space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Alpaca Strategy Backtester & Modeler
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Simulate quantitative strategies against historical Alpaca market data with your exact position sizing rules.
            </p>
          </div>
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            Alpaca Market Data API (feed: IEX)
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {/* Ticker Symbol */}
          <div>
            <Label className="text-xs text-muted-foreground">Ticker Symbol</Label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. NVDA, AAPL"
              className="mt-1 font-bold uppercase text-sm"
            />
          </div>

          {/* Strategy Model */}
          <div>
            <Label className="text-xs text-muted-foreground">Strategy Model</Label>
            <Select value={strategyType} onValueChange={setStrategyType}>
              <SelectTrigger className="mt-1 text-xs">
                <SelectValue placeholder="Select Strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MOMENTUM_TREND_RIDER">Momentum Trend Rider (EMA 9/21)</SelectItem>
                <SelectItem value="MEAN_REVERSION_RSI_BB">Mean Reversion (RSI + BB)</SelectItem>
                <SelectItem value="VOLATILITY_BREAKOUT">Volatility Breakout (Donchian)</SelectItem>
                <SelectItem value="DIP_REBOUND_MACHINE">Dip-Rebound Accumulator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Timeframe */}
          <div>
            <Label className="text-xs text-muted-foreground">Bar Timeframe</Label>
            <Select value={timeframe} onValueChange={(val: any) => setTimeframe(val)}>
              <SelectTrigger className="mt-1 text-xs">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1Day">1-Day Bars</SelectItem>
                <SelectItem value="1Hour">1-Hour Bars</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lookback Horizon */}
          <div>
            <Label className="text-xs text-muted-foreground">Historical Horizon</Label>
            <Select value={String(lookbackDays)} onValueChange={(v) => setLookbackDays(Number(v))}>
              <SelectTrigger className="mt-1 text-xs">
                <SelectValue placeholder="Horizon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="90">90 Days (Quarterly)</SelectItem>
                <SelectItem value="180">180 Days (6 Months)</SelectItem>
                <SelectItem value="365">365 Days (1 Year)</SelectItem>
                <SelectItem value="730">730 Days (2 Years)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Strict Position Sizing */}
          <div>
            <Label className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Position Size ($)</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" title="Strict User Size" />
            </Label>
            <Input
              type="number"
              value={positionSizeDollar}
              onChange={(e) => setPositionSizeDollar(Number(e.target.value))}
              className="mt-1 text-sm font-medium"
              placeholder="1000"
            />
          </div>
        </div>

        {/* Quick Ticker Pills & Run Action */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground mr-1">Popular:</span>
            {['NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMZN', 'AMD', 'SPY', 'QQQ'].map((t) => (
              <button
                key={t}
                onClick={() => setSymbol(t)}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  symbol === t
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <Button
            onClick={handleRunBacktest}
            disabled={runBacktestMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9 px-4 font-semibold"
          >
            <Play className={`w-3.5 h-3.5 mr-1.5 ${runBacktestMutation.isPending ? 'animate-spin' : ''}`} />
            {runBacktestMutation.isPending ? 'Running Backtest...' : 'Run Backtest'}
          </Button>
        </div>
      </div>

      {/* Backtest Results Area */}
      {result && (
        <div className="space-y-6">
          {/* Header & Deploy Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">{result.strategyName}</h3>
                <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs">
                  {result.symbol} • {result.timeframe}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                {result.thesisSummary}
              </p>
            </div>

            <Button
              onClick={handleDeploy}
              disabled={deployMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-4 font-semibold whitespace-nowrap"
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
              {deployMutation.isPending ? 'Deploying...' : 'Deploy to Paper Trading'}
            </Button>
          </div>

          {/* Performance Scorecard Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Return */}
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[11px] text-muted-foreground block">Strategy Return</span>
              <div className={`text-xl font-extrabold mt-0.5 ${result.totalReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.totalReturnPercent >= 0 ? '+' : ''}{result.totalReturnPercent}%
              </div>
              <span className="text-[10px] text-muted-foreground">
                ${result.finalCapital.toLocaleString()} / ${result.initialCapital.toLocaleString()}
              </span>
            </div>

            {/* Benchmark vs Alpha */}
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[11px] text-muted-foreground block">Benchmark (Buy & Hold)</span>
              <div className={`text-xl font-bold mt-0.5 ${result.benchmarkReturnPercent >= 0 ? 'text-muted-foreground' : 'text-rose-400'}`}>
                {result.benchmarkReturnPercent >= 0 ? '+' : ''}{result.benchmarkReturnPercent}%
              </div>
              <span className={`text-[10px] font-semibold ${result.alphaPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                Alpha: {result.alphaPercent >= 0 ? '+' : ''}{result.alphaPercent}%
              </span>
            </div>

            {/* Win Rate */}
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[11px] text-muted-foreground block">Win Rate</span>
              <div className="text-xl font-extrabold text-foreground mt-0.5">
                {result.winRatePercent}%
              </div>
              <span className="text-[10px] text-muted-foreground">
                {result.winningTrades} W / {result.losingTrades} L ({result.totalTrades} total)
              </span>
            </div>

            {/* Profit Factor */}
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[11px] text-muted-foreground block">Profit Factor</span>
              <div className="text-xl font-bold text-foreground mt-0.5">
                {result.profitFactor >= 90 ? '∞' : result.profitFactor}
              </div>
              <span className="text-[10px] text-muted-foreground">
                Expectancy: ${result.expectancyDollar}/trade
              </span>
            </div>

            {/* Sharpe Ratio */}
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[11px] text-muted-foreground block">Sharpe Ratio</span>
              <div className={`text-xl font-bold mt-0.5 ${result.sharpeRatio >= 1.0 ? 'text-emerald-400' : 'text-foreground'}`}>
                {result.sharpeRatio}
              </div>
              <span className="text-[10px] text-muted-foreground">
                Sortino: {result.sortinoRatio}
              </span>
            </div>

            {/* Max Drawdown */}
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[11px] text-muted-foreground block">Max Drawdown</span>
              <div className="text-xl font-bold text-rose-400 mt-0.5">
                {result.maxDrawdownPercent}%
              </div>
              <span className="text-[10px] text-muted-foreground">
                Avg Hold: {result.avgHoldingDays} days
              </span>
            </div>
          </div>

          {/* Equity Curve Recharts Graph */}
          <div className="p-5 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-foreground">Equity Curve Performance</h4>
                <p className="text-xs text-muted-foreground">
                  Strategy Portfolio Equity vs Benchmark Buy & Hold Equity over time
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-muted-foreground">Strategy Equity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
                  <span className="text-muted-foreground">Benchmark (B&H)</span>
                </div>
              </div>
            </div>

            <div className="h-[280px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2e39" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} />
                  <YAxis 
                    stroke="#6b7280" 
                    fontSize={11} 
                    tickLine={false} 
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => `$${v.toLocaleString()}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: any, name: any) => [
                      `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                      name === 'strategyEquity' ? 'Strategy' : 'Benchmark',
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="strategyEquity"
                    name="strategyEquity"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmarkEquity"
                    name="benchmarkEquity"
                    stroke="#8b5cf6"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trade Log Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground">
                Executed Trades Log ({result.trades.length})
              </h4>
              <span className="text-xs text-muted-foreground">
                Period: {result.periodStart} to {result.periodEnd}
              </span>
            </div>

            {result.trades.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No trades were triggered during this backtest window.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-secondary/30 text-muted-foreground font-medium border-b border-border sticky top-0 bg-card">
                    <tr>
                      <th className="py-2.5 px-4">#</th>
                      <th className="py-2.5 px-3">Entry Date</th>
                      <th className="py-2.5 px-3">Entry Price</th>
                      <th className="py-2.5 px-3">Exit Date</th>
                      <th className="py-2.5 px-3">Exit Price</th>
                      <th className="py-2.5 px-3">Shares</th>
                      <th className="py-2.5 px-3 text-right">P&L ($)</th>
                      <th className="py-2.5 px-3 text-right">Return (%)</th>
                      <th className="py-2.5 px-4 text-center">Exit Trigger</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {result.trades.map((t, idx) => (
                      <tr key={t.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="py-2.5 px-4 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2.5 px-3">{t.entryDate.split('T')[0]}</td>
                        <td className="py-2.5 px-3 font-medium">${t.entryPrice.toFixed(2)}</td>
                        <td className="py-2.5 px-3">{t.exitDate.split('T')[0]}</td>
                        <td className="py-2.5 px-3 font-medium">${t.exitPrice.toFixed(2)}</td>
                        <td className="py-2.5 px-3">{t.shares}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${t.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent}%
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase ${
                              t.exitReason === 'TAKE_PROFIT'
                                ? 'border-emerald-500/30 text-emerald-400'
                                : t.exitReason === 'STOP_LOSS'
                                ? 'border-rose-500/30 text-rose-400'
                                : 'border-border text-muted-foreground'
                            }`}
                          >
                            {t.exitReason}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
