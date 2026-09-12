import { describe, it, expect } from 'vitest';
import { runMonteCarloSimulation } from '../../server/services/monteCarloService';

describe('MonteCarloService Backend Integration', () => {
  it('successfully executes Python Monte Carlo engine and parses quantitative results', async () => {
    // Run simulation for 2,000 paths with seed for fast, deterministic unit testing
    const result = await runMonteCarloSimulation('AAPL', {
      trials: 2000,
      horizon: 5,
      seed: 42,
    });

    expect(result).toBeDefined();
    expect(result.ticker).toBe('AAPL');
    expect(result.current_market_price).toBeGreaterThan(0);
    expect(result.median_intrinsic_value).toBeGreaterThan(0);
    expect(result.mean_intrinsic_value).toBeGreaterThan(0);

    // 90% Confidence Interval Check
    expect(result.confidence_interval_90.p05).toBeLessThanOrEqual(result.median_intrinsic_value);
    expect(result.median_intrinsic_value).toBeLessThanOrEqual(result.confidence_interval_90.p95);

    // Scenarios Check (Bear <= Base <= Bull)
    expect(result.scenarios.bear.intrinsic_value).toBeLessThanOrEqual(result.scenarios.base.intrinsic_value);
    expect(result.scenarios.base.intrinsic_value).toBeLessThanOrEqual(result.scenarios.bull.intrinsic_value);
    expect(result.scenarios.base.probability).toBe(0.5);

    // Bucketed Histogram Distribution Check
    expect(result.raw_distribution.length).toBe(40);
    expect(result.raw_distribution[0].bin_start).toBeLessThan(result.raw_distribution[0].bin_end);

    // Factor Sensitivities Check
    expect(typeof result.factor_sensitivities.sensitivity_to_revenue_growth).toBe('number');
    expect(typeof result.factor_sensitivities.sensitivity_to_interest_rates).toBe('number');

    // Macro & Company Baselines Check
    expect(result.macro_baselines.risk_free_rate).toBeGreaterThan(0);
    expect(result.company_baselines.revenue).toBeGreaterThan(0);
    expect(result.company_baselines.shares_outstanding).toBeGreaterThan(0);
  }, 35000);
});
