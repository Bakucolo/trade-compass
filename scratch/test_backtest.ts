import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { alpacaBacktestService } from '../server/services/alpacaBacktestService';

async function testBacktest() {
  console.log('Testing Alpaca Backtest Engine on AAPL (Momentum Trend Rider)...');
  try {
    const result = await alpacaBacktestService.runBacktest({
      symbol: 'AAPL',
      timeframe: '1Day',
      lookbackDays: 90,
      strategyType: 'MOMENTUM_TREND_RIDER',
      initialCapital: 10000,
      positionSizeDollar: 2000,
    });

    console.log('Backtest Complete:');
    console.log({
      symbol: result.symbol,
      strategyName: result.strategyName,
      totalReturnPercent: `${result.totalReturnPercent}%`,
      benchmarkReturnPercent: `${result.benchmarkReturnPercent}%`,
      alphaPercent: `${result.alphaPercent}%`,
      winRatePercent: `${result.winRatePercent}%`,
      sharpeRatio: result.sharpeRatio,
      maxDrawdownPercent: `${result.maxDrawdownPercent}%`,
      totalTrades: result.totalTrades,
      equityCurvePoints: result.equityCurve.length,
    });
  } catch (err) {
    console.error('Backtest Error:', err);
  }
}

testBacktest();
