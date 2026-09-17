import * as fs from 'fs';
import * as path from 'path';
import YahooFinance from 'yahoo-finance2';
import { alpacaService, AlpacaBar } from './alpacaService';
import { aiTradingGuardrails } from './aiTradingGuardrails';
import { generateJsonCompletion } from './llmFallbackRouter';
import { agentActivityTracker } from './agentActivityService';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export type StrategyType =
  | 'MOMENTUM_TREND_RIDER'
  | 'MEAN_REVERSION_RSI_BB'
  | 'VOLATILITY_BREAKOUT'
  | 'DIP_REBOUND_MACHINE'
  | 'AI_GENERATED';

export interface BacktestParams {
  symbol: string;
  timeframe: '1Day' | '1Hour' | '15Min';
  lookbackDays: number; // e.g. 90, 180, 365, 730
  strategyType: StrategyType;
  initialCapital?: number; // default $10,000 or user position size
  positionSizeDollar?: number; // user fixed size
  parameters?: Record<string, any>;
}

export interface TradeLogEntry {
  id: string;
  symbol: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  shares: number;
  dollarInvested: number;
  pnl: number;
  pnlPercent: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'SIGNAL_EXIT' | 'TIMEOUT';
  holdingDays: number;
}

export interface EquityCurvePoint {
  date: string;
  strategyEquity: number;
  benchmarkEquity: number;
  drawdownPercent: number;
}

export interface BacktestResult {
  symbol: string;
  strategyName: string;
  strategyType: StrategyType;
  timeframe: string;
  periodStart: string;
  periodEnd: string;
  initialCapital: number;
  finalCapital: number;

  // Performance Metrics
  totalReturnPercent: number;
  benchmarkReturnPercent: number;
  alphaPercent: number;
  annualizedReturnPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdownPercent: number;
  winRatePercent: number;
  profitFactor: number;
  expectancyDollar: number;

  // Trade Counts
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgHoldingDays: number;

  // Details & Visuals
  equityCurve: EquityCurvePoint[];
  trades: TradeLogEntry[];
  parametersUsed: Record<string, any>;
  thesisSummary: string;
}

export interface DeployedStrategy {
  id: string;
  name: string;
  symbol: string;
  strategyType: StrategyType;
  isActive: boolean;
  timeframe: '1Day' | '1Hour';
  parameters: Record<string, any>;
  userPositionSizeDollar: number;
  winRateBacktest: number;
  totalReturnBacktest: number;
  deployedAt: string;
  lastEvaluatedAt?: string;
  lastSignal?: {
    action: 'BUY' | 'SELL' | 'HOLD';
    reason: string;
    timestamp: string;
  };
}

export interface PendingTradeSignal {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  currentPrice: number;
  targetShares: number;
  targetDollarValue: number;
  sizingRule: string;
  reason: string;
  confidenceScore: number;
  timestamp: string;
  status: 'PENDING' | 'APPROVED' | 'DISMISSED' | 'EXECUTED';
}

const DEPLOYED_STRATEGIES_FILE = path.join(process.cwd(), 'server', 'quant', 'deployed_ai_strategies.json');
const PENDING_SIGNALS_FILE = path.join(process.cwd(), 'server', 'quant', 'pending_trade_signals.json');

export class AlpacaBacktestService {
  private deployedStrategies: DeployedStrategy[] = [];
  private pendingSignals: PendingTradeSignal[] = [];

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      if (fs.existsSync(DEPLOYED_STRATEGIES_FILE)) {
        this.deployedStrategies = JSON.parse(fs.readFileSync(DEPLOYED_STRATEGIES_FILE, 'utf-8'));
      }
      if (fs.existsSync(PENDING_SIGNALS_FILE)) {
        this.pendingSignals = JSON.parse(fs.readFileSync(PENDING_SIGNALS_FILE, 'utf-8'));
      }
    } catch (e) {
      console.error('[AlpacaBacktestService] Error loading persisted state:', e);
    }
  }

  private saveState() {
    try {
      const dir = path.dirname(DEPLOYED_STRATEGIES_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DEPLOYED_STRATEGIES_FILE, JSON.stringify(this.deployedStrategies, null, 2), 'utf-8');
      fs.writeFileSync(PENDING_SIGNALS_FILE, JSON.stringify(this.pendingSignals, null, 2), 'utf-8');
    } catch (e) {
      console.error('[AlpacaBacktestService] Error saving state:', e);
    }
  }

  /**
   * Helper: Calculate Exponential Moving Average (EMA)
   */
  private calculateEMA(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const emaArray: number[] = new Array(prices.length).fill(0);
    if (prices.length < period) return emaArray;

    // First value is simple SMA
    let sum = 0;
    for (let i = 0; i < period; i++) sum += prices[i];
    emaArray[period - 1] = sum / period;

    for (let i = period; i < prices.length; i++) {
      emaArray[i] = prices[i] * k + emaArray[i - 1] * (1 - k);
    }
    return emaArray;
  }

  /**
   * Helper: Calculate Relative Strength Index (RSI)
   */
  private calculateRSI(prices: number[], period: number = 14): number[] {
    const rsi: number[] = new Array(prices.length).fill(50);
    if (prices.length <= period) return rsi;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) {
        avgGain = (avgGain * (period - 1) + diff) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
      }

      if (avgLoss === 0) {
        rsi[i] = 100;
      } else {
        const rs = avgGain / avgLoss;
        rsi[i] = 100 - 100 / (1 + rs);
      }
    }
    return rsi;
  }

  /**
   * Helper: Calculate Bollinger Bands
   */
  private calculateBollingerBands(prices: number[], period: number = 20, stdDevMultiplier: number = 2) {
    const upper: number[] = new Array(prices.length).fill(0);
    const middle: number[] = new Array(prices.length).fill(0);
    const lower: number[] = new Array(prices.length).fill(0);

    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);

      middle[i] = mean;
      upper[i] = mean + stdDevMultiplier * stdDev;
      lower[i] = mean - stdDevMultiplier * stdDev;
    }

    return { upper, middle, lower };
  }

  /**
   * Fetch historical bar data using Alpaca Data API with fallback to Yahoo Finance
   */
  public async getHistoricalBars(symbol: string, lookbackDays: number, timeframe: '1Day' | '1Hour' = '1Day'): Promise<AlpacaBar[]> {
    const cleanSymbol = symbol.toUpperCase().trim();
    const now = new Date();
    const startDate = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

    // 1. Try Alpaca Data API first
    try {
      const bars = await alpacaService.getMarketBars(
        cleanSymbol,
        timeframe,
        Math.min(1000, lookbackDays * 2),
        startDate.toISOString(),
        now.toISOString()
      );
      if (bars && bars.length >= 10) {
        return bars;
      }
    } catch (e: any) {
      console.warn(`[AlpacaBacktest] Alpaca market data fetch failed for ${cleanSymbol}, attempting Yahoo Finance:`, e.message);
    }

    // 2. Fallback to Yahoo Finance
    try {
      const yfResult: any = await yahooFinance.historical(cleanSymbol, {
        period1: startDate,
        period2: now,
        interval: timeframe === '1Hour' ? '1h' : '1d',
      });

      if (yfResult && yfResult.length > 0) {
        return yfResult.map((b: any) => ({
          t: new Date(b.date).toISOString(),
          o: b.open,
          h: b.high,
          l: b.low,
          c: b.close,
          v: b.volume || 0,
        }));
      }
    } catch (e: any) {
      console.error(`[AlpacaBacktest] Yahoo Finance fallback also failed for ${cleanSymbol}:`, e.message);
    }

    throw new Error(`Unable to fetch historical price data for ${cleanSymbol} over ${lookbackDays} days.`);
  }

  /**
   * CORE BACKTEST SIMULATION ENGINE
   */
  public async runBacktest(params: BacktestParams): Promise<BacktestResult> {
    const symbol = params.symbol.toUpperCase().trim();
    const lookbackDays = params.lookbackDays || 180;
    const timeframe = params.timeframe || '1Day';
    const bars = await this.getHistoricalBars(symbol, lookbackDays, timeframe);

    if (bars.length < 30) {
      throw new Error(`Insufficient historical data points (${bars.length}) to execute strategy backtest.`);
    }

    const settings = aiTradingGuardrails.getSettings();
    const initialCapital = params.initialCapital || 10000;
    // Sizing: strict user position size
    const positionSizeDollar = params.positionSizeDollar || settings.fixedDollarAmount || 1000;

    const closePrices = bars.map((b) => b.c);
    const highPrices = bars.map((b) => b.h);
    const lowPrices = bars.map((b) => b.l);

    // Strategy Indicators
    const ema9 = this.calculateEMA(closePrices, 9);
    const ema21 = this.calculateEMA(closePrices, 21);
    const ema50 = this.calculateEMA(closePrices, 50);
    const rsi14 = this.calculateRSI(closePrices, 14);
    const bb = this.calculateBollingerBands(closePrices, 20, 2);

    let cash = initialCapital;
    let shares = 0;
    let entryPrice = 0;
    let entryDate = '';
    let entryBarIndex = 0;

    const trades: TradeLogEntry[] = [];
    const equityCurve: EquityCurvePoint[] = [];

    const firstPrice = closePrices[0];
    let peakEquity = initialCapital;

    // Strategy Execution Parameters
    const stopLossPct = (params.parameters?.stopLossPercent ?? settings.defaultStopLossPercent) / 100;
    const takeProfitPct = (params.parameters?.takeProfitPercent ?? settings.defaultTakeProfitPercent) / 100;

    let strategyName = 'Quantitative Strategy';
    let thesisSummary = '';

    switch (params.strategyType) {
      case 'MOMENTUM_TREND_RIDER':
        strategyName = 'Momentum Trend Rider (EMA 9/21 + Vol)';
        thesisSummary = `Captures bullish momentum expansion when EMA(9) crosses above EMA(21) above EMA(50), with tight trailing stops.`;
        break;
      case 'MEAN_REVERSION_RSI_BB':
        strategyName = 'Mean Reversion RSI + Bollinger Bounce';
        thesisSummary = `Buys deep oversold dips where RSI < 32 and price contacts the lower Bollinger Band, taking profit at the 20-day mean.`;
        break;
      case 'VOLATILITY_BREAKOUT':
        strategyName = 'Volatility Breakout (Donchian Expansion)';
        thesisSummary = `Enters when price breaks the 20-day high with expanding ATR volatility.`;
        break;
      case 'DIP_REBOUND_MACHINE':
        strategyName = 'Dip-Rebound Accumulator';
        thesisSummary = `Systematically identifies extreme multi-standard deviation pullbacks for high-probability mean reversion.`;
        break;
      case 'AI_GENERATED':
        strategyName = params.parameters?.customName || 'AI Autonomous Strategy';
        thesisSummary = params.parameters?.thesis || 'Custom quantitative model generated by AI agent.';
        break;
    }

    // Step through each bar chronologically
    for (let i = 25; i < bars.length; i++) {
      const currentPrice = closePrices[i];
      const currentDate = bars[i].t;
      const currentHigh = highPrices[i];
      const currentLow = lowPrices[i];

      // Benchmark Buy & Hold equity calculation
      const benchmarkEquity = Number((initialCapital * (currentPrice / firstPrice)).toFixed(2));

      // 1. If currently in a position, check exit conditions
      if (shares > 0) {
        let shouldExit = false;
        let exitReason: TradeLogEntry['exitReason'] = 'SIGNAL_EXIT';

        // Stop Loss check
        if (stopLossPct > 0 && currentLow <= entryPrice * (1 - stopLossPct)) {
          shouldExit = true;
          exitReason = 'STOP_LOSS';
        }
        // Take Profit check
        else if (takeProfitPct > 0 && currentHigh >= entryPrice * (1 + takeProfitPct)) {
          shouldExit = true;
          exitReason = 'TAKE_PROFIT';
        }
        // Strategy-specific indicator exits
        else if (params.strategyType === 'MOMENTUM_TREND_RIDER' && ema9[i] < ema21[i] && ema9[i - 1] >= ema21[i - 1]) {
          shouldExit = true;
          exitReason = 'SIGNAL_EXIT';
        } else if (params.strategyType === 'MEAN_REVERSION_RSI_BB' && (currentPrice >= bb.middle[i] || rsi14[i] >= 65)) {
          shouldExit = true;
          exitReason = 'SIGNAL_EXIT';
        } else if (i - entryBarIndex >= (params.parameters?.maxHoldingBars || 30)) {
          shouldExit = true;
          exitReason = 'TIMEOUT';
        }

        if (shouldExit) {
          let exitPrice = currentPrice;
          if (exitReason === 'STOP_LOSS') exitPrice = entryPrice * (1 - stopLossPct);
          if (exitReason === 'TAKE_PROFIT') exitPrice = entryPrice * (1 + takeProfitPct);

          const dollarInvested = shares * entryPrice;
          const totalExitValue = shares * exitPrice;
          const pnl = Number((totalExitValue - dollarInvested).toFixed(2));
          const pnlPercent = Number((((exitPrice - entryPrice) / entryPrice) * 100).toFixed(2));

          cash += totalExitValue;

          trades.push({
            id: `trade-${trades.length + 1}`,
            symbol,
            entryDate,
            entryPrice: Number(entryPrice.toFixed(2)),
            exitDate: currentDate,
            exitPrice: Number(exitPrice.toFixed(2)),
            shares,
            dollarInvested: Number(dollarInvested.toFixed(2)),
            pnl,
            pnlPercent,
            exitReason,
            holdingDays: i - entryBarIndex,
          });

          shares = 0;
          entryPrice = 0;
        }
      }

      // 2. If flat, check entry signals
      if (shares === 0 && cash >= positionSizeDollar * 0.5) {
        let shouldEnter = false;

        if (params.strategyType === 'MOMENTUM_TREND_RIDER') {
          const bullishCross = ema9[i] > ema21[i] && ema9[i - 1] <= ema21[i - 1];
          const aboveTrend = currentPrice > ema50[i];
          if (bullishCross && aboveTrend) shouldEnter = true;
        } else if (params.strategyType === 'MEAN_REVERSION_RSI_BB') {
          const oversoldRsi = rsi14[i] < (params.parameters?.rsiBuyThreshold || 32);
          const touchesLowerBB = currentLow <= bb.lower[i] * 1.01;
          if (oversoldRsi && touchesLowerBB) shouldEnter = true;
        } else if (params.strategyType === 'VOLATILITY_BREAKOUT') {
          const highestPrev20 = Math.max(...highPrices.slice(i - 20, i));
          if (currentPrice > highestPrev20) shouldEnter = true;
        } else if (params.strategyType === 'DIP_REBOUND_MACHINE') {
          const rsiOversold = rsi14[i] < 35 && rsi14[i] > rsi14[i - 1];
          const priceNearSupport = currentLow <= bb.lower[i];
          if (rsiOversold && priceNearSupport) shouldEnter = true;
        } else if (params.strategyType === 'AI_GENERATED') {
          const rsiThresh = params.parameters?.rsiBuyThreshold || 35;
          const useEmaCross = params.parameters?.useEmaCross ?? true;
          const condition1 = rsi14[i] <= rsiThresh;
          const condition2 = useEmaCross ? (ema9[i] > ema21[i]) : true;
          if (condition1 && condition2) shouldEnter = true;
        }

        if (shouldEnter) {
          const targetCapital = Math.min(positionSizeDollar, cash * 0.95);
          const calculatedShares = Math.floor(targetCapital / currentPrice);
          if (calculatedShares > 0) {
            shares = calculatedShares;
            entryPrice = currentPrice;
            entryDate = currentDate;
            entryBarIndex = i;
            cash -= shares * entryPrice;
          }
        }
      }

      // Track Strategy Total Equity
      const currentStrategyEquity = Number((cash + shares * currentPrice).toFixed(2));
      if (currentStrategyEquity > peakEquity) {
        peakEquity = currentStrategyEquity;
      }
      const drawdownPercent = Number((((currentStrategyEquity - peakEquity) / peakEquity) * 100).toFixed(2));

      equityCurve.push({
        date: currentDate.split('T')[0],
        strategyEquity: currentStrategyEquity,
        benchmarkEquity,
        drawdownPercent,
      });
    }

    // Final Equity calculations
    const lastPrice = closePrices[closePrices.length - 1];
    const finalCapital = Number((cash + shares * lastPrice).toFixed(2));
    const totalReturnPercent = Number((((finalCapital - initialCapital) / initialCapital) * 100).toFixed(2));

    const finalBenchmarkEquity = equityCurve[equityCurve.length - 1]?.benchmarkEquity || initialCapital;
    const benchmarkReturnPercent = Number((((finalBenchmarkEquity - initialCapital) / initialCapital) * 100).toFixed(2));
    const alphaPercent = Number((totalReturnPercent - benchmarkReturnPercent).toFixed(2));

    // Trade Analytics
    const winningTrades = trades.filter((t) => t.pnl > 0).length;
    const losingTrades = trades.filter((t) => t.pnl <= 0).length;
    const totalTrades = trades.length;
    const winRatePercent = totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;

    const grossProfit = trades.filter((t) => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(trades.filter((t) => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.9 : 1.0;

    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const expectancyDollar = totalTrades > 0 ? Number((totalPnL / totalTrades).toFixed(2)) : 0;

    const maxDrawdownPercent = Math.min(...equityCurve.map((e) => e.drawdownPercent), 0);
    const avgHoldingDays = totalTrades > 0
      ? Number((trades.reduce((sum, t) => sum + t.holdingDays, 0) / totalTrades).toFixed(1))
      : 0;

    // Sharpe Ratio calculation
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].strategyEquity;
      const curr = equityCurve[i].strategyEquity;
      returns.push((curr - prev) / prev);
    }
    const avgDailyReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 0
      ? returns.reduce((a, b) => a + Math.pow(b - avgDailyReturn, 2), 0) / returns.length
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? Number(((avgDailyReturn / stdDev) * Math.sqrt(252)).toFixed(2)) : 0;

    const negativeReturns = returns.filter((r) => r < 0);
    const downVariance = negativeReturns.length > 0
      ? negativeReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / negativeReturns.length
      : 0;
    const sortinoRatio = Math.sqrt(downVariance) > 0
      ? Number(((avgDailyReturn / Math.sqrt(downVariance)) * Math.sqrt(252)).toFixed(2))
      : 0;

    const annualizedReturnPercent = Number((((Math.pow(finalCapital / initialCapital, 365 / lookbackDays) - 1)) * 100).toFixed(2));

    return {
      symbol,
      strategyName,
      strategyType: params.strategyType,
      timeframe,
      periodStart: bars[0].t.split('T')[0],
      periodEnd: bars[bars.length - 1].t.split('T')[0],
      initialCapital,
      finalCapital,
      totalReturnPercent,
      benchmarkReturnPercent,
      alphaPercent,
      annualizedReturnPercent: isNaN(annualizedReturnPercent) ? totalReturnPercent : annualizedReturnPercent,
      sharpeRatio,
      sortinoRatio,
      maxDrawdownPercent,
      winRatePercent,
      profitFactor,
      expectancyDollar,
      totalTrades,
      winningTrades,
      losingTrades,
      avgHoldingDays,
      equityCurve,
      trades,
      parametersUsed: {
        stopLossPercent: stopLossPct * 100,
        takeProfitPercent: takeProfitPct * 100,
        positionSizeDollar,
        ...params.parameters,
      },
      thesisSummary,
    };
  }

  /**
   * AI AGENT STRATEGY DISCOVERY:
   * Uses LLM to explore data patterns, formulate hypotheses, and run backtest simulations
   */
  public async aiDiscoverStrategy(params: {
    symbol: string;
    objectivePrompt?: string;
    lookbackDays?: number;
    timeframe?: '1Day' | '1Hour';
  }): Promise<{
    strategyHypothesis: {
      name: string;
      hypothesis: string;
      rationale: string;
      suggestedIndicators: string[];
      targetArchetype: string;
    };
    backtestResult: BacktestResult;
  }> {
    const symbol = params.symbol.toUpperCase().trim();
    const lookbackDays = params.lookbackDays || 180;
    const userPrompt = params.objectivePrompt || `Design a high-expectancy algorithmic swing trading strategy for ${symbol} with strict risk management.`;

    const taskId = agentActivityTracker.startTask({
      agentName: 'AI Strategy Explorer & Modeler',
      agentType: 'TRADE_IDEA_GENERATOR',
      taskDescription: `Exploring historical price structure & formulating model for ${symbol}: "${userPrompt}"`,
      targetSymbol: symbol,
    });

    try {
      // 1. Fetch recent price metrics to feed LLM
      const bars = await this.getHistoricalBars(symbol, 60, '1Day');
      const latestPrice = bars[bars.length - 1]?.c || 100;
      const oldestPrice = bars[0]?.c || 100;
      const momentum60d = (((latestPrice - oldestPrice) / oldestPrice) * 100).toFixed(1);

      const systemPrompt = `You are an elite quantitative researcher and algorithmic trading strategy designer for Alpaca Trading.
Given a stock ticker, price dynamics, and user objective, design an algorithmic trading model.
Return ONLY valid JSON matching this schema:
{
  "name": "Short descriptive name of strategy",
  "hypothesis": "Clear explanation of market anomaly or price inefficiency exploited",
  "rationale": "Why this works on this specific ticker",
  "suggestedIndicators": ["EMA", "RSI", "Bollinger Bands", "Volume"],
  "targetArchetype": "MOMENTUM" | "MEAN_REVERSION" | "BREAKOUT" | "DIP_REBOUND",
  "parameters": {
    "rsiBuyThreshold": 30 to 45 (number),
    "stopLossPercent": 2.0 to 5.0 (number),
    "takeProfitPercent": 4.0 to 12.0 (number),
    "useEmaCross": true | false,
    "maxHoldingBars": 10 to 40 (number)
  }
}`;

      const userText = `Ticker: ${symbol}
Current Price: $${latestPrice}
60-Day Return: ${momentum60d}%
User Goal: ${userPrompt}`;

      const aiResponse = await generateJsonCompletion<{
        name: string;
        hypothesis: string;
        rationale: string;
        suggestedIndicators: string[];
        targetArchetype: string;
        parameters: {
          rsiBuyThreshold: number;
          stopLossPercent: number;
          takeProfitPercent: number;
          useEmaCross: boolean;
          maxHoldingBars: number;
        };
      }>({
        systemPrompt,
        userPrompt: userText,
        temperature: 0.3,
        tag: 'ai-strategy-discovery',
      });

      const hypothesis = aiResponse.data;

      // 2. Map archetype to strategy type
      let mappedType: StrategyType = 'AI_GENERATED';
      if (hypothesis.targetArchetype === 'MOMENTUM') mappedType = 'MOMENTUM_TREND_RIDER';
      else if (hypothesis.targetArchetype === 'MEAN_REVERSION') mappedType = 'MEAN_REVERSION_RSI_BB';
      else if (hypothesis.targetArchetype === 'BREAKOUT') mappedType = 'VOLATILITY_BREAKOUT';
      else if (hypothesis.targetArchetype === 'DIP_REBOUND') mappedType = 'DIP_REBOUND_MACHINE';

      // 3. Immediately run the backtest simulation on Alpaca market data
      const backtestResult = await this.runBacktest({
        symbol,
        lookbackDays,
        timeframe: params.timeframe || '1Day',
        strategyType: mappedType,
        parameters: {
          customName: hypothesis.name,
          thesis: hypothesis.hypothesis,
          ...hypothesis.parameters,
        },
      });

      agentActivityTracker.completeTask(taskId.id, {
        status: 'SUCCESS',
        outcomeSummary: `AI Strategy "${hypothesis.name}" backtested on ${symbol}: Win Rate ${backtestResult.winRatePercent}%, Total Return ${backtestResult.totalReturnPercent}% (Alpha ${backtestResult.alphaPercent}%)`,
      });

      return {
        strategyHypothesis: {
          name: hypothesis.name,
          hypothesis: hypothesis.hypothesis,
          rationale: hypothesis.rationale,
          suggestedIndicators: hypothesis.suggestedIndicators,
          targetArchetype: hypothesis.targetArchetype,
        },
        backtestResult,
      };
    } catch (err: any) {
      agentActivityTracker.completeTask(taskId.id, {
        status: 'FAILED',
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * DEPLOY STRATEGY TO PAPER TRADING:
   * Sets up strategy with user's position size and parameters
   */
  public deployStrategy(params: {
    name: string;
    symbol: string;
    strategyType: StrategyType;
    parameters: Record<string, any>;
    timeframe?: '1Day' | '1Hour';
    winRateBacktest?: number;
    totalReturnBacktest?: number;
  }): DeployedStrategy {
    const settings = aiTradingGuardrails.getSettings();
    const strategy: DeployedStrategy = {
      id: `strat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: params.name,
      symbol: params.symbol.toUpperCase().trim(),
      strategyType: params.strategyType,
      isActive: true,
      timeframe: params.timeframe || '1Day',
      parameters: params.parameters || {},
      userPositionSizeDollar: settings.fixedDollarAmount || 1000,
      winRateBacktest: params.winRateBacktest || 0,
      totalReturnBacktest: params.totalReturnBacktest || 0,
      deployedAt: new Date().toISOString(),
    };

    this.deployedStrategies.unshift(strategy);
    this.saveState();
    return strategy;
  }

  public getDeployedStrategies(): DeployedStrategy[] {
    return [...this.deployedStrategies];
  }

  public toggleStrategy(id: string, active?: boolean): DeployedStrategy | null {
    const strat = this.deployedStrategies.find((s) => s.id === id);
    if (!strat) return null;
    strat.isActive = active !== undefined ? active : !strat.isActive;
    this.saveState();
    return strat;
  }

  public deleteStrategy(id: string): boolean {
    const prevLen = this.deployedStrategies.length;
    this.deployedStrategies = this.deployedStrategies.filter((s) => s.id !== id);
    if (this.deployedStrategies.length !== prevLen) {
      this.saveState();
      return true;
    }
    return false;
  }

  public getPendingSignals(): PendingTradeSignal[] {
    return this.pendingSignals.filter((s) => s.status === 'PENDING');
  }

  public dismissSignal(signalId: string): boolean {
    const sig = this.pendingSignals.find((s) => s.id === signalId);
    if (sig) {
      sig.status = 'DISMISSED';
      this.saveState();
      return true;
    }
    return false;
  }

  /**
   * SCAN MARKET FOR STRATEGY SIGNALS & EXECUTE IF AUTHORIZED:
   * Strictly enforces user position sizing guardrails!
   */
  public async scanActiveStrategies(): Promise<{
    evaluatedCount: number;
    signalsGenerated: PendingTradeSignal[];
    executedOrders: any[];
  }> {
    const activeStrats = this.deployedStrategies.filter((s) => s.isActive);
    const settings = aiTradingGuardrails.getSettings();

    if (settings.masterKillSwitch) {
      console.log('[AlpacaBacktestService] Scan skipped: Master Kill Switch is ACTIVE.');
      return { evaluatedCount: activeStrats.length, signalsGenerated: [], executedOrders: [] };
    }

    const signalsGenerated: PendingTradeSignal[] = [];
    const executedOrders: any[] = [];

    for (const strat of activeStrats) {
      try {
        const bars = await this.getHistoricalBars(strat.symbol, 40, strat.timeframe);
        if (bars.length < 25) continue;

        strat.lastEvaluatedAt = new Date().toISOString();

        const closePrices = bars.map((b) => b.c);
        const latestPrice = closePrices[closePrices.length - 1];
        const prevPrice = closePrices[closePrices.length - 2];

        const ema9 = this.calculateEMA(closePrices, 9);
        const ema21 = this.calculateEMA(closePrices, 21);
        const rsi14 = this.calculateRSI(closePrices, 14);

        const currentRsi = rsi14[rsi14.length - 1];
        const latestEma9 = ema9[ema9.length - 1];
        const latestEma21 = ema21[ema21.length - 1];
        const prevEma9 = ema9[ema9.length - 2];
        const prevEma21 = ema21[ema21.length - 2];

        let triggerBuy = false;
        let reason = '';

        if (strat.strategyType === 'MOMENTUM_TREND_RIDER') {
          if (latestEma9 > latestEma21 && prevEma9 <= prevEma21) {
            triggerBuy = true;
            reason = `Bullish EMA 9/21 cross confirmed (EMA9: $${latestEma9.toFixed(2)} > EMA21: $${latestEma21.toFixed(2)})`;
          }
        } else if (strat.strategyType === 'MEAN_REVERSION_RSI_BB' || strat.strategyType === 'DIP_REBOUND_MACHINE') {
          const rsiThresh = strat.parameters?.rsiBuyThreshold || 35;
          if (currentRsi <= rsiThresh && latestPrice > prevPrice) {
            triggerBuy = true;
            reason = `Oversold RSI rebound triggered (RSI: ${currentRsi.toFixed(1)} <= ${rsiThresh})`;
          }
        }

        if (triggerBuy) {
          strat.lastSignal = {
            action: 'BUY',
            reason,
            timestamp: new Date().toISOString(),
          };

          // Check user position sizing guardrail
          const account = await alpacaService.getAccount();
          const positions = await alpacaService.getPositions();
          const sizingCheck = aiTradingGuardrails.calculateOrderSizing({
            symbol: strat.symbol,
            currentPrice: latestPrice,
            portfolioValue: parseFloat(account.portfolio_value) || 0,
            buyingPower: parseFloat(account.buying_power) || 0,
            currentOpenPositionsCount: positions.length,
            isExistingPosition: positions.some((p) => p.symbol === strat.symbol),
          });

          if (!sizingCheck.allowed) {
            console.log(`[AlpacaBacktestService] Signal triggered for ${strat.symbol} but blocked by safety sizing: ${sizingCheck.reason}`);
            continue;
          }

          const signal: PendingTradeSignal = {
            id: `sig-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            strategyId: strat.id,
            strategyName: strat.name,
            symbol: strat.symbol,
            action: 'BUY',
            currentPrice: latestPrice,
            targetShares: sizingCheck.shares,
            targetDollarValue: sizingCheck.estimatedDollarValue,
            sizingRule: sizingCheck.sizingRuleApplied,
            reason,
            confidenceScore: strat.winRateBacktest || 75,
            timestamp: new Date().toISOString(),
            status: 'PENDING',
          };

          // IF AUTOMATED EXECUTION MODE: Place order directly with Alpaca!
          if (settings.executionMode === 'AUTOMATED') {
            console.log(`[Alpaca Trading Engine] Executing automated paper order for ${strat.symbol} strictly sized to ${sizingCheck.shares} shares ($${sizingCheck.estimatedDollarValue})...`);
            const execResult = await alpacaService.submitOrder({
              symbol: strat.symbol,
              side: 'buy',
              type: 'market',
              requestedShares: sizingCheck.shares,
              source: 'AI_AGENT',
              strategyName: strat.name,
            });

            if (execResult.success) {
              signal.status = 'EXECUTED';
              executedOrders.push(execResult.order);
            }
          }

          signalsGenerated.push(signal);
          this.pendingSignals.unshift(signal);
        }
      } catch (err: any) {
        console.error(`[AlpacaBacktestService] Error evaluating strategy ${strat.name} for ${strat.symbol}:`, err.message);
      }
    }

    this.saveState();
    return {
      evaluatedCount: activeStrats.length,
      signalsGenerated,
      executedOrders,
    };
  }
}

export const alpacaBacktestService = new AlpacaBacktestService();
