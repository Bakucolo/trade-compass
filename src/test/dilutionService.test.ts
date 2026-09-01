import { describe, it, expect } from 'vitest';
import { getSecCikForSymbol, fetchDilutionAnalysis } from '../../server/services/dilutionService';

describe('Stock-Based Compensation & ATM Offerings Dilution Analysis', () => {
  it('should resolve SEC CIK for major public companies', async () => {
    const pltrCik = await getSecCikForSymbol('PLTR');
    const nvdaCik = await getSecCikForSymbol('NVDA');
    const tslaCik = await getSecCikForSymbol('TSLA');

    expect(pltrCik).not.toBeNull();
    expect(pltrCik?.cik).toBe('0001321655');

    expect(nvdaCik).not.toBeNull();
    expect(nvdaCik?.cik).toBe('0001045810');

    expect(tslaCik).not.toBeNull();
    expect(tslaCik?.cik).toBe('0001318605');
  }, 15000);

  it('should compile comprehensive dilution analysis for a high-SBC tech company (PLTR)', async () => {
    const analysis = await fetchDilutionAnalysis('PLTR');

    expect(analysis.symbol).toBe('PLTR');
    expect(analysis.cik).toBe('0001321655');
    expect(analysis.annualSbcUSD).toBeGreaterThan(100_000_000); // Over $100M SBC
    expect(analysis.sbcPercentOfRevenue).toBeGreaterThan(5.0);  // >5% of revenue
    expect(analysis.sharesOutstanding).toBeGreaterThan(1_000_000_000);
    expect(analysis.dilutionRiskTier).toBeDefined();
    expect(analysis.dilutionRiskScore).toBeGreaterThanOrEqual(0);
    expect(analysis.dilutionRiskScore).toBeLessThanOrEqual(100);
    expect(analysis.dilutionVerdict).toContain('dilution');

    // Quarterly & Annual SBC arrays
    expect(analysis.sbcHistoryQuarterly.length).toBeGreaterThan(0);
    expect(analysis.sharesHistory.length).toBeGreaterThan(0);
  }, 25000);

  it('should compile dilution analysis for net-buyback large-cap company (NVDA)', async () => {
    const analysis = await fetchDilutionAnalysis('NVDA');

    expect(analysis.symbol).toBe('NVDA');
    expect(analysis.annualSbcUSD).toBeGreaterThan(0);
    expect(analysis.sharesOutstanding).toBeGreaterThan(10_000_000_000);
    expect(analysis.dilutionRiskTier).toBeDefined();
  }, 25000);
});
