import { describe, it, expect } from 'vitest';
import { trendFinderService } from '../../server/services/trendFinderService';

describe('Macro Trend Finder & Lifecycle Scanner Service', () => {
  it('should scan macro universe and return structured trend lifecycle overview', async () => {
    const summary = await trendFinderService.getTrendFinderOverview();

    expect(summary).toBeDefined();
    expect(summary.items.length).toBeGreaterThan(0);
    expect(typeof summary.startingCount).toBe('number');
    expect(typeof summary.ongoingCount).toBe('number');
    expect(typeof summary.exhaustedCount).toBe('number');
    expect(summary.startingCount + summary.ongoingCount + summary.exhaustedCount).toBe(summary.items.length);
  }, 25000);

  it('should include asset classes, sectors, and industries in scan results', async () => {
    const summary = await trendFinderService.getTrendFinderOverview();

    const assetClasses = summary.items.filter((x) => x.scope === 'ASSET_CLASS');
    const sectors = summary.items.filter((x) => x.scope === 'SECTOR');
    const industries = summary.items.filter((x) => x.scope === 'INDUSTRY_THEME');

    expect(assetClasses.length).toBeGreaterThan(0);
    expect(sectors.length).toBeGreaterThan(0);
    expect(industries.length).toBeGreaterThan(0);

    // Verify key instruments are present
    const symbols = summary.items.map((x) => x.symbol);
    expect(symbols).toContain('SPY');
    expect(symbols).toContain('XLK');
    expect(symbols).toContain('SMH');
  }, 25000);

  it('should compute valid technical indicators, scores, and actionable playbooks', async () => {
    const summary = await trendFinderService.getTrendFinderOverview();
    const item = summary.items[0];

    expect(item).toBeDefined();
    expect(['STARTING', 'ONGOING', 'EXHAUSTED']).toContain(item.stage);
    expect(['BULLISH', 'BEARISH']).toContain(item.direction);

    expect(item.trendStrengthScore).toBeGreaterThanOrEqual(0);
    expect(item.trendStrengthScore).toBeLessThanOrEqual(100);
    expect(item.exhaustionRiskScore).toBeGreaterThanOrEqual(0);
    expect(item.exhaustionRiskScore).toBeLessThanOrEqual(100);

    expect(typeof item.rsi14).toBe('number');
    expect(typeof item.dma20).toBe('number');
    expect(typeof item.dma50).toBe('number');
    expect(typeof item.dma200).toBe('number');

    expect(item.signals.length).toBeGreaterThan(0);
    expect(item.macroDriver.length).toBeGreaterThan(5);
    expect(item.actionablePlaybook.length).toBeGreaterThan(5);
  }, 25000);

  it('should populate topOpportunities buckets for starting, ongoing, and exhausted trends', async () => {
    const summary = await trendFinderService.getTrendFinderOverview();

    expect(summary.topOpportunities).toBeDefined();
    expect(Array.isArray(summary.topOpportunities.startingBreakouts)).toBe(true);
    expect(Array.isArray(summary.topOpportunities.strongestTrends)).toBe(true);
    expect(Array.isArray(summary.topOpportunities.exhaustionReversals)).toBe(true);
  }, 25000);

  it('should compute trend start dates, days in trend, and exhaustion dates', async () => {
    const summary = await trendFinderService.getTrendFinderOverview();
    expect(summary.items.length).toBeGreaterThan(0);

    for (const item of summary.items) {
      expect(item.trendStartDate).toBeDefined();
      expect(typeof item.trendStartDate).toBe('string');
      expect(typeof item.daysInTrend).toBe('number');
      expect(item.daysInTrend).toBeGreaterThanOrEqual(1);

      if (item.stage === 'EXHAUSTED') {
        expect(item.exhaustionStartDate).toBeDefined();
        expect(typeof item.exhaustionStartDate).toBe('string');
        expect(typeof item.daysExhausted).toBe('number');
        expect(item.daysExhausted).toBeGreaterThanOrEqual(1);
      }
    }
  }, 25000);
});
