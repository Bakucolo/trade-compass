import { describe, it, expect } from 'vitest';
import { fetchFedFundsCurve, FOMC_SCHEDULE } from '../../server/services/fedFundsCurveService';

describe('Fed Funds Futures (ZQ!) Curve Service & Rate Hike/Cut Calculator', { timeout: 25000 }, () => {
  it('should fetch ZQ futures curve with expiries, implied rates and basis points', async () => {
    const data = await fetchFedFundsCurve();

    expect(data).toBeDefined();
    expect(data.contracts).toBeDefined();
    expect(data.contracts.length).toBeGreaterThanOrEqual(10);
    expect(data.summary).toBeDefined();
    expect(data.continuousZq).toBeDefined();

    // Spot EFFR should be a valid percentage
    expect(data.summary.currentEffr).toBeGreaterThan(0);
    expect(data.summary.currentEffr).toBeLessThan(15);

    // Front month
    expect(data.summary.frontMonthRate).toBeGreaterThan(0);
    expect(data.summary.frontMonthLabel).toBeDefined();

    // Policy stance & summary
    expect(data.summary.policyStance).toBeDefined();
    expect(data.summary.policyHeadline).toBeDefined();
    expect(data.summary.policyNarrative).toBeDefined();

    // Contracts verification
    data.contracts.forEach((c) => {
      expect(c.symbol).toMatch(/^ZQ[F-Z]\d{2}\.CBT$/);
      expect(c.cleanSymbol).toMatch(/^ZQ[F-Z]\d{2}$/);
      expect(c.tradingViewSymbol).toBe(`CBOT:${c.cleanSymbol}`);
      expect(c.price).toBeGreaterThan(80);
      expect(c.price).toBeLessThan(102);

      // Implied rate formula: 100 - Price
      expect(c.impliedRate).toBeCloseTo(100 - c.price, 2);

      // Cuts = bps / 25
      expect(c.cumulativeCutsFromSpot).toBeCloseTo(c.cumulativeBpsFromSpot / 25, 2);
      expect(c.marginalCuts).toBeCloseTo(c.marginalBps / 25, 2);
    });
  });

  it('should accurately map FOMC meetings and compute policy probabilities', async () => {
    const data = await fetchFedFundsCurve();
    const fomcContracts = data.contracts.filter((c) => c.hasFomc);

    expect(fomcContracts.length).toBeGreaterThan(0);

    for (const fc of fomcContracts) {
      expect(fc.fomcMeeting).toBeDefined();
      expect(fc.fomcMeeting?.date).toBeDefined();
      expect(fc.fomcMeeting?.label).toBeDefined();

      if (fc.fomcProbabilities) {
        const { cut50, cut25, pause, hike25 } = fc.fomcProbabilities;
        const totalProb = cut50 + cut25 + pause + hike25;
        expect(totalProb).toBeGreaterThanOrEqual(98);
        expect(totalProb).toBeLessThanOrEqual(102);
      }
    }
  });

  it('should calculate realistic terminal trough rate and year-end cut expectations', async () => {
    const data = await fetchFedFundsCurve();
    const { summary } = data;

    expect(summary.troughRate).toBeGreaterThan(0);
    expect(summary.troughExpiry).toBeDefined();
    expect(summary.peakRate).toBeGreaterThan(0);

    // Total cuts year-end should be finite numbers
    expect(Number.isFinite(summary.totalCutsCurrentYearBps)).toBe(true);
    expect(Number.isFinite(summary.totalCutsCurrentYearCount)).toBe(true);
    expect(Number.isFinite(summary.totalCutsNextYearBps)).toBe(true);
    expect(Number.isFinite(summary.totalCutsNextYearCount)).toBe(true);
  });
});
