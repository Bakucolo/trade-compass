import { describe, it, expect } from 'vitest';
import { optionsLiquidityService } from '../../server/services/optionsLiquidityService';

describe('Options Liquidity Scoring Service', { timeout: 25000 }, () => {
  it('should compute comprehensive options liquidity score for liquid mega-cap stock (AAPL)', async () => {
    const result = await optionsLiquidityService.getOptionsLiquidityScore('AAPL');

    expect(result).toBeDefined();
    expect(result.symbol).toBe('AAPL');
    expect(result.hasOptions).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.stars).toBeGreaterThanOrEqual(3.0);
    expect(result.tier).toBeDefined();
    expect(result.tierLabel).toBeDefined();
    expect(result.badgeColor).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.tradingGuidance).toBeDefined();

    // Check Metrics
    expect(result.metrics.totalOpenInterest).toBeGreaterThan(0);
    expect(result.metrics.totalDailyVolume).toBeGreaterThan(0);
    expect(result.metrics.availableExpirationsCount).toBeGreaterThan(0);
    expect(result.metrics.underlyingPrice).toBeGreaterThan(0);

    // Component Scores
    expect(result.componentScores.spreadScore).toBeGreaterThanOrEqual(0);
    expect(result.componentScores.oiDepthScore).toBeGreaterThanOrEqual(0);
    expect(result.componentScores.volumeScore).toBeGreaterThanOrEqual(0);
    expect(result.componentScores.breadthScore).toBeGreaterThanOrEqual(0);
    expect(result.componentScores.balanceScore).toBeGreaterThanOrEqual(0);

    // Strategy Suitability
    expect(result.strategySuitability.length).toBeGreaterThan(0);
    expect(result.strategySuitability.some(s => s.strategyName.includes('Covered Calls'))).toBe(true);
    expect(result.strategySuitability.some(s => s.strategyName.includes('Vertical Debit / Credit Spreads'))).toBe(true);
  });

  it('should return valid ATM contracts snapshot when options exist', async () => {
    const result = await optionsLiquidityService.getOptionsLiquidityScore('NVDA');

    expect(result.hasOptions).toBe(true);
    if (result.metrics.nearestAtmCall) {
      expect(result.metrics.nearestAtmCall.strike).toBeGreaterThan(0);
      expect(result.metrics.nearestAtmCall.mid).toBeGreaterThanOrEqual(0);
      expect(result.metrics.nearestAtmCall.spread).toBeGreaterThanOrEqual(0);
      expect(result.metrics.nearestAtmCall.expiration).toBeDefined();
    }
  });

  it('should gracefully handle non-optionable or invalid tickers', async () => {
    const result = await optionsLiquidityService.getOptionsLiquidityScore('NONEXISTENTTICKER999XYZ');

    expect(result).toBeDefined();
    expect(result.hasOptions).toBe(false);
    expect(result.score).toBe(0);
    expect(result.tier).toBe('NO_OPTIONS_CHAIN');
    expect(result.tierLabel).toContain('No Options Chain');
  });
});
