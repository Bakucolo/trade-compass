import { describe, it, expect } from 'vitest';
import {
  calculateGreeks,
  parseDteFromExpiry,
  calculatePositionTheta,
  calculatePortfolioTheta,
} from '../utils/greeksUtils';

describe('Options Greeks & Portfolio Theta Analytics Utility', () => {
  describe('calculateGreeks', () => {
    it('should compute valid Black-Scholes Greeks for an ATM Call option', () => {
      const greeks = calculateGreeks(100, 100, 30, 0.30, 'CALL', 0.045);
      expect(greeks.delta).toBeGreaterThan(0.4);
      expect(greeks.delta).toBeLessThan(0.65);
      expect(greeks.gamma).toBeGreaterThan(0);
      expect(greeks.theta).toBeLessThan(0); // Standard per-share theta decay is negative
      expect(greeks.vega).toBeGreaterThan(0);
    });

    it('should compute valid Black-Scholes Greeks for an OTM Put option', () => {
      const greeks = calculateGreeks(100, 90, 45, 0.35, 'PUT', 0.045);
      expect(greeks.delta).toBeLessThan(0);
      expect(greeks.delta).toBeGreaterThan(-0.5);
      expect(greeks.theta).toBeLessThan(0);
      expect(greeks.vega).toBeGreaterThan(0);
    });

    it('should handle zero/invalid inputs gracefully without crashing', () => {
      const greeks = calculateGreeks(0, 100, 0, 0, 'CALL');
      expect(greeks).toBeDefined();
      expect(greeks.delta).toBe(0.5);
      expect(greeks.theta).toBe(0);
    });
  });

  describe('parseDteFromExpiry', () => {
    it('should parse YYYYMMDD format', () => {
      const dte = parseDteFromExpiry('20261218');
      expect(dte).toBeGreaterThan(0);
    });

    it('should parse YYYY-MM-DD format', () => {
      const dte = parseDteFromExpiry('2026-10-16');
      expect(dte).toBeGreaterThan(0);
    });

    it('should return fallback 30 DTE for empty/invalid strings', () => {
      expect(parseDteFromExpiry('')).toBe(30);
      expect(parseDteFromExpiry('invalid-date')).toBe(30);
    });
  });

  describe('calculatePositionTheta', () => {
    it('should return positive daily cash flow for short option positions', () => {
      const shortCall = {
        symbol: 'AAPL260918C00220000',
        underlyingSymbol: 'AAPL',
        underlyingPrice: 220,
        strike: 220,
        optionType: 'CALL',
        quantity: -2, // 2 Short Call contracts
        assetType: 'Option',
        dte: 30,
      };

      const result = calculatePositionTheta(shortCall);
      expect(result).not.toBeNull();
      expect(result?.isShort).toBe(true);
      expect(result?.quantity).toBe(-2);
      expect(result?.dailyDollarTheta).toBeGreaterThan(0); // Selling options collects time decay (+$/day)
      expect(result?.monthlyDollarTheta).toBeCloseTo(result!.dailyDollarTheta * 30, 1);
    });

    it('should return negative daily decay for long option positions', () => {
      const longPut = {
        symbol: 'NVDA261016P00115000',
        underlyingSymbol: 'NVDA',
        underlyingPrice: 120,
        strike: 115,
        optionType: 'PUT',
        quantity: 1, // 1 Long Put contract
        assetType: 'Option',
        dte: 45,
      };

      const result = calculatePositionTheta(longPut);
      expect(result).not.toBeNull();
      expect(result?.isShort).toBe(false);
      expect(result?.quantity).toBe(1);
      expect(result?.dailyDollarTheta).toBeLessThan(0); // Buying options incurs theta decay (-$/day)
    });

    it('should return null for non-option holdings', () => {
      const stock = {
        symbol: 'MSFT',
        quantity: 50,
        assetType: 'Stock',
      };
      expect(calculatePositionTheta(stock)).toBeNull();
    });
  });

  describe('calculatePortfolioTheta', () => {
    it('should aggregate net theta, monthly run-rate, and annualized yield across mixed positions', () => {
      const positions = [
        {
          symbol: 'AAPL260918C00220000',
          underlyingSymbol: 'AAPL',
          underlyingPrice: 220,
          strike: 220,
          optionType: 'CALL',
          quantity: -3, // Short calls (harvesting theta)
          assetType: 'Option',
          dte: 30,
        },
        {
          symbol: 'TSLA260918P00200000',
          underlyingSymbol: 'TSLA',
          underlyingPrice: 210,
          strike: 200,
          optionType: 'PUT',
          quantity: 1, // Long put (decaying theta)
          assetType: 'Option',
          dte: 30,
        },
        {
          symbol: 'GOOGL',
          quantity: 100,
          assetType: 'Stock', // Equities ignored in option theta sum
        },
      ];

      const netLiq = 150000;
      const summary = calculatePortfolioTheta(positions, netLiq);

      expect(summary.totalOptionsCount).toBe(2);
      expect(summary.shortOptionsCount).toBe(3);
      expect(summary.longOptionsCount).toBe(1);
      expect(summary.shortOptionsTheta).toBeGreaterThan(0);
      expect(summary.longOptionsTheta).toBeLessThan(0);
      expect(summary.totalDailyTheta).toBeCloseTo(summary.shortOptionsTheta + summary.longOptionsTheta, 2);
      expect(summary.totalMonthlyTheta).toBeCloseTo(summary.totalDailyTheta * 30, 1);
      expect(summary.annualizedThetaYieldPercent).toBeCloseTo((summary.totalDailyTheta * 365 / netLiq) * 100, 2);
      expect(['POSITIVE_INCOME', 'THETA_DRAG', 'BALANCED']).toContain(summary.regime);
    });

    it('should return zero defaults when portfolio has no options', () => {
      const positions = [
        { symbol: 'AMZN', quantity: 20, assetType: 'Stock' },
        { symbol: 'META', quantity: 10, assetType: 'Stock' },
      ];

      const summary = calculatePortfolioTheta(positions, 100000);
      expect(summary.totalDailyTheta).toBe(0);
      expect(summary.totalMonthlyTheta).toBe(0);
      expect(summary.totalOptionsCount).toBe(0);
      expect(summary.regime).toBe('NO_OPTIONS');
    });
  });
});
