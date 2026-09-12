import { describe, it, expect, vi } from 'vitest';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateATR,
  calculateBollingerBands,
  detectPivots,
  clusterPivots,
  TechnicalAnalysisService
} from '../../server/services/technicalAnalysisService';

describe('Technical Analysis & Multi-Timeframe S/R Engine', () => {
  describe('Mathematical & Indicator Calculations', () => {
    it('calculates Simple Moving Average (SMA) accurately', () => {
      const prices = [10, 12, 14, 16, 18, 20];
      const sma3 = calculateSMA(prices, 3);
      // Last 3 prices: 16, 18, 20 -> avg = 18.00
      expect(sma3).toBe(18.00);

      const sma5 = calculateSMA(prices, 5);
      // Last 5 prices: 12, 14, 16, 18, 20 -> avg = 16.00
      expect(sma5).toBe(16.00);
    });

    it('calculates Exponential Moving Average (EMA) with proper weighting', () => {
      const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
      const ema5 = calculateEMA(prices, 5);
      expect(ema5).toBeGreaterThan(17);
      expect(ema5).toBeLessThanOrEqual(20);
    });

    it('calculates RSI bounded between 0 and 100', () => {
      // Monotonically increasing prices -> RSI should be high (> 80)
      const uptrendPrices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
      const rsiUp = calculateRSI(uptrendPrices, 14);
      expect(rsiUp).toBeGreaterThanOrEqual(80);
      expect(rsiUp).toBeLessThanOrEqual(100);

      // Monotonically decreasing prices -> RSI should be low (< 20)
      const downtrendPrices = [30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 9, 8, 7, 6, 5];
      const rsiDown = calculateRSI(downtrendPrices, 14);
      expect(rsiDown).toBeLessThanOrEqual(20);
      expect(rsiDown).toBeGreaterThanOrEqual(0);
    });

    it('calculates MACD line, signal line, and histogram', () => {
      const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 1.5);
      const macd = calculateMACD(prices);
      expect(macd.macdLine).toBeGreaterThan(0);
      expect(typeof macd.signalLine).toBe('number');
      expect(typeof macd.histogram).toBe('number');
      expect(macd.histogram).toBe(Number((macd.macdLine - macd.signalLine).toFixed(2)));
    });

    it('calculates ATR (Average True Range)', () => {
      const highs = [105, 107, 108, 110, 109, 111];
      const lows = [98, 100, 101, 103, 102, 104];
      const closes = [102, 106, 104, 108, 107, 110];

      const atr = calculateATR(highs, lows, closes, 5);
      expect(atr).toBeGreaterThan(0);
      expect(atr).toBeLessThan(15);
    });

    it('calculates Bollinger Bands with upper > middle > lower', () => {
      const prices = [100, 102, 101, 103, 104, 106, 105, 107, 108, 110, 109, 111, 112, 114, 113, 115, 116, 118, 117, 120];
      const bb = calculateBollingerBands(prices, 20, 2);

      expect(bb.upper).toBeGreaterThan(bb.middle);
      expect(bb.middle).toBeGreaterThan(bb.lower);
      expect(bb.bandwidthPct).toBeGreaterThan(0);
      expect(bb.percentB).toBeGreaterThan(0);
    });
  });

  describe('Support & Resistance Local Extrema & Clustering', () => {
    it('detects swing highs and swing lows correctly', () => {
      // Synthetic peak at index 5 and valley at index 10
      const quotes = [
        { high: 100, low: 95, close: 98, date: '2026-01-01' },
        { high: 102, low: 97, close: 100, date: '2026-01-02' },
        { high: 105, low: 99, close: 103, date: '2026-01-03' },
        { high: 108, low: 102, close: 106, date: '2026-01-04' },
        { high: 112, low: 105, close: 110, date: '2026-01-05' },
        { high: 120, low: 112, close: 118, date: '2026-01-06' }, // PEAK!
        { high: 115, low: 108, close: 112, date: '2026-01-07' },
        { high: 110, low: 104, close: 107, date: '2026-01-08' },
        { high: 106, low: 99, close: 102, date: '2026-01-09' },
        { high: 101, low: 94, close: 97, date: '2026-01-10' },
        { high: 96, low: 88, close: 91, date: '2026-01-11' }, // VALLEY!
        { high: 100, low: 92, close: 98, date: '2026-01-12' },
        { high: 104, low: 96, close: 102, date: '2026-01-13' },
        { high: 107, low: 100, close: 105, date: '2026-01-14' },
        { high: 110, low: 103, close: 108, date: '2026-01-15' },
      ];

      const pivots = detectPivots(quotes, 3, 3);
      expect(pivots.swingHighs.length).toBeGreaterThanOrEqual(1);
      expect(pivots.swingHighs.some(h => h.price === 120)).toBe(true);

      expect(pivots.swingLows.length).toBeGreaterThanOrEqual(1);
      expect(pivots.swingLows.some(l => l.price === 88)).toBe(true);
    });

    it('clusters nearby pivot levels within tolerance threshold', () => {
      // 3 touches around 100, 2 touches around 150
      const rawPivots = [99.5, 100.2, 100.8, 149.5, 150.5];
      const clusters = clusterPivots(rawPivots, 2.0);

      expect(clusters.length).toBe(2);
      expect(clusters[0].touchCount).toBe(3);
      expect(Math.abs(clusters[0].price - 100.17)).toBeLessThan(0.5);

      expect(clusters[1].touchCount).toBe(2);
      expect(Math.abs(clusters[1].price - 150)).toBeLessThan(0.5);
    });
  });

  describe('Multi-Timeframe Technical Analysis Service Output', () => {
    it('returns complete technical analysis structure with S/R levels, stage, trend, and blueprint', async () => {
      const service = new TechnicalAnalysisService();
      const analysis = await service.getTechnicalAnalysis('AAPL');

      expect(analysis).toBeDefined();
      expect(analysis.symbol).toBe('AAPL');
      expect(analysis.currentPrice).toBeGreaterThan(0);

      // Support & Resistance levels
      expect(analysis.levels.length).toBeGreaterThan(0);
      expect(analysis.levels.some(l => l.type === 'RESISTANCE')).toBe(true);
      expect(analysis.levels.some(l => l.type === 'SUPPORT')).toBe(true);

      // Immediate S/R
      if (analysis.immediateResistance) {
        expect(analysis.immediateResistance.price).toBeGreaterThan(analysis.currentPrice);
        expect(analysis.immediateResistance.distancePercent).toBeGreaterThanOrEqual(0);
      }
      if (analysis.immediateSupport) {
        expect(analysis.immediateSupport.price).toBeLessThan(analysis.currentPrice);
        expect(analysis.immediateSupport.distancePercent).toBeLessThanOrEqual(0);
      }

      // Classic Pivot Points
      expect(analysis.pivotPoints.classic.pp).toBeGreaterThan(0);
      expect(analysis.pivotPoints.classic.r1).toBeGreaterThan(analysis.pivotPoints.classic.pp);
      expect(analysis.pivotPoints.classic.s1).toBeLessThan(analysis.pivotPoints.classic.pp);

      // Market Phase / Stan Weinstein Stage
      expect(['STAGE_1_ACCUMULATION', 'STAGE_2_MARKUP', 'STAGE_3_DISTRIBUTION', 'STAGE_4_MARKDOWN']).toContain(
        analysis.marketPhase.stage
      );
      expect(analysis.marketPhase.stageName).toBeTruthy();
      expect(analysis.marketPhase.summary).toBeTruthy();

      // Trend Hierarchy
      expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(analysis.trend.primaryTrend);
      expect(analysis.trend.trendStrengthScore).toBeGreaterThanOrEqual(0);
      expect(analysis.trend.trendStrengthScore).toBeLessThanOrEqual(100);

      // Moving Averages
      expect(analysis.movingAverages.dma20).toBeGreaterThan(0);
      expect(analysis.movingAverages.dma50).toBeGreaterThan(0);
      expect(analysis.movingAverages.dma200).toBeGreaterThan(0);

      // Oscillators
      expect(analysis.oscillators.rsi14).toBeGreaterThanOrEqual(0);
      expect(analysis.oscillators.rsi14).toBeLessThanOrEqual(100);
      expect(analysis.oscillators.bollingerBands.upper).toBeGreaterThan(analysis.oscillators.bollingerBands.lower);

      // Actionable Trade Blueprint
      expect(analysis.blueprint.verdict).toBeTruthy();
      expect(analysis.blueprint.idealEntryZone.low).toBeGreaterThanOrEqual(0);
      expect(analysis.blueprint.invalidationStop.price).toBeGreaterThan(0);
      expect(analysis.blueprint.targets.length).toBeGreaterThan(0);
    });
  });
});
