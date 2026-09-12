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

  it('should compile dilution analysis for mega-cap AAPL with buybacks and non-zero SBC', async () => {
    const analysis = await fetchDilutionAnalysis('AAPL');

    expect(analysis.symbol).toBe('AAPL');
    expect(analysis.annualSbcUSD).toBeGreaterThan(5_000_000_000); // AAPL SBC > $5B
    expect(analysis.annualBuybacksUSD).toBeGreaterThan(50_000_000_000); // AAPL Buybacks > $50B
    expect(analysis.netDilutionRateYoY).toBeLessThan(0); // Net accretive
    expect(analysis.sharesOutstanding).toBeGreaterThan(10_000_000_000);
    expect(analysis.sbcHistoryAnnual.length).toBeGreaterThan(0);
    expect(analysis.sharesHistory.length).toBeGreaterThan(0);
  }, 25000);

  it('should gracefully compile dilution metrics for foreign ADR (TSM)', async () => {
    const analysis = await fetchDilutionAnalysis('TSM');

    expect(analysis.symbol).toBe('TSM');
    expect(analysis.sharesOutstanding).toBeGreaterThan(1_000_000_000);
    expect(analysis.sharesHistory.length).toBeGreaterThan(0);
    expect(analysis.dilutionRiskTier).toBeDefined();
  }, 25000);
});
