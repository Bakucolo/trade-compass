import { describe, it, expect } from 'vitest';
import {
  calculateValuationForecast,
  getScenarioPresets,
  ValuationInputs,
} from '../services/valuationForecastEngine';

describe('valuationForecastEngine', () => {
  const baseInputs: ValuationInputs = {
    startingPrice: 100.0,
    startingRevenue: 50.0, // $50B
    startingMargin: 20.0, // 20%
    startingShares: 1.0, // 1B shares -> EPS = (50 * 0.20) / 1.0 = $10.00
    revenueGrowthRate: 10.0, // 10% CAGR
    targetMargin: 25.0, // expands from 20% to 25%
    exitMultiple: 20.0, // 20x P/E
    discountRate: 10.0, // 10% WACC
    annualShareChangePct: -1.0, // -1% buyback per year
    horizonYears: 5,
  };

  it('correctly initializes Year 0 point matching starting financials', () => {
    const result = calculateValuationForecast(baseInputs);

    expect(result.path.length).toBe(6); // Year 0 through Year 5
    const y0 = result.path[0];
    expect(y0.year).toBe(0);
    expect(y0.revenue).toBe(50.0);
    expect(y0.margin).toBe(20.0);
    expect(y0.earningsOrFcf).toBe(10.0);
    expect(y0.shares).toBe(1.0);
    expect(y0.epsOrFcfPerShare).toBe(10.0);
    expect(y0.projectedPrice).toBe(100.0);
    expect(y0.cumulativeReturnPct).toBe(0.0);
  });

  it('calculates compound revenue growth and margin glide path at Year 5', () => {
    const result = calculateValuationForecast(baseInputs);
    const y5 = result.path[5];

    // Expected revenue: 50 * (1.10)^5 = 50 * 1.61051 = 80.5255 -> ~80.53B
    expect(y5.revenue).toBeCloseTo(80.53, 1);

    // Target margin at Year 5 should be targetMargin = 25%
    expect(y5.margin).toBe(25.0);

    // Earnings: 80.5255 * 0.25 = 20.131B
    expect(y5.earningsOrFcf).toBeCloseTo(20.13, 1);

    // Shares: 1.0 * (1 - 0.01)^5 = 0.95099
    expect(y5.shares).toBeCloseTo(0.95, 2);

    // EPS: 20.131 / 0.95099 = ~21.17
    expect(y5.epsOrFcfPerShare).toBeCloseTo(21.17, 1);

    // Projected Stock Price: 21.17 * 20x exitMultiple = ~$423.37
    expect(y5.projectedPrice).toBeCloseTo(423.37, 0);

    // Cumulative Return from $100 -> ~+323%
    expect(y5.cumulativeReturnPct).toBeGreaterThan(300);
    expect(result.projectedTargetPrice).toBe(y5.projectedPrice);
  });

  it('calculates discounted fair value and margin of safety', () => {
    const result = calculateValuationForecast(baseInputs);

    // Discounted target price back 5 years at 10%:
    // PV = 423.37 / (1.10)^5 = 423.37 / 1.61051 = ~$262.88
    expect(result.discountedFairValue).toBeGreaterThan(200);
    // Since starting price is $100 and fair value is ~$262.88, margin of safety should be positive (undervalued)
    expect(result.marginOfSafetyPct).toBeGreaterThan(50);
    expect(result.isUndervalued).toBe(true);
  });

  it('computes 2D sensitivity matrix with 5x5 variations', () => {
    const result = calculateValuationForecast(baseInputs);

    expect(result.sensitivityMatrix.growthRates.length).toBe(5);
    expect(result.sensitivityMatrix.multiples.length).toBe(5);
    expect(result.sensitivityMatrix.cells.length).toBe(5);
    expect(result.sensitivityMatrix.cells[0].length).toBe(5);

    // The center cell (2, 2) is the base case
    const baseCell = result.sensitivityMatrix.cells[2][2];
    expect(baseCell.isBaseCase).toBe(true);
    expect(baseCell.growthRate).toBe(baseInputs.revenueGrowthRate);
    expect(baseCell.multiple).toBe(baseInputs.exitMultiple);
    expect(baseCell.projectedPrice).toBeCloseTo(result.projectedTargetPrice, 0);
  });

  it('generates Bear, Base, and Bull scenario presets', () => {
    const presets = getScenarioPresets(baseInputs);

    expect(presets.BEAR.revenueGrowthRate).toBeLessThan(baseInputs.revenueGrowthRate);
    expect(presets.BEAR.exitMultiple).toBeLessThan(baseInputs.exitMultiple);

    expect(presets.BULL.revenueGrowthRate).toBeGreaterThan(baseInputs.revenueGrowthRate);
    expect(presets.BULL.exitMultiple).toBeGreaterThan(baseInputs.exitMultiple);
  });
});
