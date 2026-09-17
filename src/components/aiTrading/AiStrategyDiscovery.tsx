import React, { useState } from 'react';
import { 
  useAiDiscoverStrategy, 
  useDeployStrategy, 
  useAiTradingSettings,
  BacktestResult 
} from '@/services/aiTradingService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { 
  Sparkles, 
  Bot, 
  BrainCircuit, 
  Lightbulb, 
  CheckCircle, 
  Layers, 
  ShieldCheck, 
  LineChart as LineChartIcon,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';

export const AiStrategyDiscovery: React.FC = () => {
  const { toast } = useToast();
  const { data: settings } = useAiTradingSettings();
  const aiDiscoverMutation = useAiDiscoverStrategy();
  const deployMutation = useDeployStrategy();

  const [symbol, setSymbol] = useState('TSLA');
  const [prompt, setPrompt] = useState(
    'Find high-probability swing pullbacks in an overall uptrend with tight risk management and a minimum 2:1 profit factor.'
  );
  const [lookbackDays, setLookbackDays] = useState(180);

  const [discoveryData, setDiscoveryData] = useState<{
    strategyHypothesis: {
      name: string;
      hypothesis: string;
      rationale: string;
      suggestedIndicators: string[];
      targetArchetype: string;
    };
    backtestResult: BacktestResult;
  } | null>(null);

  const presetPrompts = [
    {
      title: 'Uptrend Momentum Breakout',
      text: 'Identify trend continuation breakouts on high volume with trailing stops and fast EMA confirmations.',
    },
    {
      title: 'Oversold Dip Rebound',
      text: 'Detect multi-standard deviation oversold dips (RSI < 32 + Lower BB) and enter on the first green rebound bar.',
    },
    {
      title: 'Volatility Squeeze & Expansion',
      text: 'Scan for Bollinger Band contraction squeezes followed by Donchian 20-day high breakouts.',
    },
    {
      title: 'Low-Drawdown Capital Preserver',
      text: 'Design a conservative model prioritizing maximum drawdown under 5% with strict stop losses.',
    },
  ];

  const handleDiscover = async () => {
    if (!symbol.trim()) {
      toast({ title: 'Please enter a ticker symbol', variant: 'destructive' });
      return;
    }

    try {
      const data = await aiDiscoverMutation.mutateAsync({
        symbol: symbol.toUpperCase().trim(),
        objectivePrompt: prompt,
        lookbackDays,
        timeframe: '1Day',
      });
      setDiscoveryData(data);
      toast({
        title: `AI Model Formulated: ${data.strategyHypothesis.name}`,
        description: `Backtested on Alpaca data with ${data.backtestResult.winRatePercent}% win rate.`,
      });
    } catch (err: any) {
      toast({
        title: 'Strategy Discovery Failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeploy = async () => {
    if (!discoveryData) return;
    const { strategyHypothesis, backtestResult } = discoveryData;
    try {
      await deployMutation.mutateAsync({
        name: strategyHypothesis.name,
        symbol: backtestResult.symbol,
        strategyType: backtestResult.strategyType,
        parameters: backtestResult.parametersUsed,
        timeframe: '1Day',
        winRateBacktest: backtestResult.winRatePercent,
        totalReturnBacktest: backtestResult.totalReturnPercent,
      });
      toast({
        title: `AI Model Deployed to Paper Trading!`,
        description: `${strategyHypothesis.name} is now actively monitoring ${backtestResult.symbol} with your position size of $${settings?.fixedDollarAmount || 1000}.`,
      });
    } catch (err: any) {
      toast({ title: 'Deployment Failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Exploration Header & Prompt Box */}
      <div className="p-5 rounded-xl bg-card border border-border space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-amber-400" />
              Autonomous AI Strategy Explorer & Modeler
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
              Instruct our multi-tier LLM quantitative agent to analyze Alpaca market data structure, formulate mathematical hypotheses, and build an algorithmic strategy.
            </p>
          </div>
          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs">
            Multi-Tier LLM + Quantitative Engine
          </Badge>
        </div>

        {/* Ticker & Prompt Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div className="md:col-span-1 space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Target Stock Ticker</Label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. TSLA, NVDA"
                className="mt-1 font-bold text-sm uppercase"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Data Lookback Horizon</Label>
              <select
                value={lookbackDays}
                onChange={(e) => setLookbackDays(Number(e.target.value))}
                className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="90">90 Days (Quarterly)</option>
                <option value="180">180 Days (6 Months)</option>
                <option value="365">365 Days (1 Year)</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-3 space-y-2">
            <Label className="text-xs text-muted-foreground">
              Strategy Objective & Hypothesis Prompt for AI Agent
            </Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the type of strategy, risk appetite, or anomaly you want the AI agent to model..."
              rows={3}
              className="text-xs resize-none"
            />
          </div>
        </div>

        {/* Preset Prompt Pills */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] text-muted-foreground font-medium">Quick Prompts:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {presetPrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(p.text)}
                className="text-left p-2 rounded-lg bg-secondary/30 hover:bg-secondary/60 border border-border text-[11px] transition-colors"
              >
                <span className="font-semibold text-foreground block">{p.title}</span>
                <span className="text-muted-foreground line-clamp-2 mt-0.5">{p.text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end pt-2 border-t border-border/50">
          <Button
            onClick={handleDiscover}
            disabled={aiDiscoverMutation.isPending}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs h-9 px-4"
          >
            <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${aiDiscoverMutation.isPending ? 'animate-spin' : ''}`} />
            {aiDiscoverMutation.isPending ? 'Agent Formulating Model...' : 'Explore Data & Build AI Model'}
          </Button>
        </div>
      </div>

      {/* Discovery Result */}
      {discoveryData && (
        <div className="space-y-6">
          {/* AI Model Architecture Card */}
          <div className="p-5 rounded-xl bg-card border border-amber-500/30 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-bold text-foreground">
                    {discoveryData.strategyHypothesis.name}
                  </h3>
                  <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs uppercase font-semibold">
                    {discoveryData.strategyHypothesis.targetArchetype}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Designed autonomously for <span className="text-foreground font-semibold">{discoveryData.backtestResult.symbol}</span>
                </p>
              </div>

              <Button
                onClick={handleDeploy}
                disabled={deployMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-4 font-semibold"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                {deployMutation.isPending ? 'Deploying...' : 'Deploy AI Model to Paper Trading'}
              </Button>
            </div>

            {/* AI Hypothesis & Rationale Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-secondary/30 border border-border">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" />
                  Market Inefficiency Hypothesis
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {discoveryData.strategyHypothesis.hypothesis}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Quantitative Rationale
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {discoveryData.strategyHypothesis.rationale}
                </p>
              </div>
            </div>

            {/* Indicators Selected */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-muted-foreground font-medium">Model Indicators:</span>
              {discoveryData.strategyHypothesis.suggestedIndicators.map((ind, i) => (
                <Badge key={i} variant="outline" className="text-[11px] bg-secondary/50">
                  {ind}
                </Badge>
              ))}
            </div>
          </div>

          {/* Performance Scorecard */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[11px] text-muted-foreground block">Strategy Return</span>
              <div className={`text-xl font-extrabold mt-0.5 ${discoveryData.backtestResult.totalReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {discoveryData.backtestResult.totalReturnPercent >= 0 ? '+' : ''}{discoveryData.backtestResult.totalReturnPercent}%
              </div>
              <span className="text-[10px] text-muted-foreground">
                ${discoveryData.backtestResult.finalCapital.toLocaleString()} Final
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[11px] text-muted-foreground block">Benchmark Return</span>
              <div className="text-xl font-bold text-muted-foreground mt-0.5">
                {discoveryData.backtestResult.benchmarkReturnPercent >= 0 ? '+' : ''}{discoveryData.backtestResult.benchmarkReturnPercent}%
              </div>
              <span className={`text-[10px] font-semibold ${discoveryData.backtestResult.alphaPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                Alpha: {discoveryData.backtestResult.alphaPercent >= 0 ? '+' : ''}{discoveryData.backtestResult.alphaPercent}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[11px] text-muted-foreground block">Win Rate</span>
              <div className="text-xl font-extrabold text-foreground mt-0.5">
                {discoveryData.backtestResult.winRatePercent}%
              </div>
              <span className="text-[10px] text-muted-foreground">
                {discoveryData.backtestResult.winningTrades} W / {discoveryData.backtestResult.losingTrades} L
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[11px] text-muted-foreground block">Profit Factor</span>
              <div className="text-xl font-bold text-foreground mt-0.5">
                {discoveryData.backtestResult.profitFactor >= 90 ? '∞' : discoveryData.backtestResult.profitFactor}
              </div>
              <span className="text-[10px] text-muted-foreground">
                ${discoveryData.backtestResult.expectancyDollar}/trade
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[11px] text-muted-foreground block">Sharpe Ratio</span>
              <div className="text-xl font-bold text-foreground mt-0.5">
                {discoveryData.backtestResult.sharpeRatio}
              </div>
              <span className="text-[10px] text-muted-foreground">
                Annual: {discoveryData.backtestResult.annualizedReturnPercent}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-card border border-border">
              <span className="text-[11px] text-muted-foreground block">Max Drawdown</span>
              <div className="text-xl font-bold text-rose-400 mt-0.5">
                {discoveryData.backtestResult.maxDrawdownPercent}%
              </div>
              <span className="text-[10px] text-muted-foreground">
                Avg Hold: {discoveryData.backtestResult.avgHoldingDays} days
              </span>
            </div>
          </div>

          {/* Equity Curve Chart */}
          <div className="p-5 rounded-xl bg-card border border-border space-y-3">
            <h4 className="text-sm font-bold text-foreground">AI Strategy Equity Curve vs Benchmark</h4>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={discoveryData.backtestResult.equityCurve}>
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
                      name === 'strategyEquity' ? 'AI Strategy' : 'Benchmark',
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="strategyEquity"
                    name="strategyEquity"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmarkEquity"
                    name="benchmarkEquity"
                    stroke="#6b7280"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
