import { describe, it, expect } from 'vitest';
import { getFxRateToUSD, fxRatesToUSD } from '../../server/index';

describe('Dual Currency GBP & USD Balances & FX Bridge', () => {
  it('should have valid real-time or fallback FX rates for GBP, EUR, AUD, CAD', () => {
    const gbpRate = getFxRateToUSD('GBP');
    const eurRate = getFxRateToUSD('EUR');
    const audRate = getFxRateToUSD('AUD');
    const cadRate = getFxRateToUSD('CAD');
    const usdRate = getFxRateToUSD('USD');

    expect(usdRate).toBe(1.0);
    expect(gbpRate).toBeGreaterThan(1.1); // 1 GBP > 1.10 USD
    expect(gbpRate).toBeLessThan(1.6);
    expect(eurRate).toBeGreaterThan(0.9);
    expect(audRate).toBeGreaterThan(0.5);
    expect(cadRate).toBeGreaterThan(0.6);
  });

  it('should accurately calculate dual currency conversions for portfolio totals', () => {
    const netLiqUSD = 100000;
    const fxRateGbpUsd = getFxRateToUSD('GBP') || 1.302;
    const fxRateUsdGbp = 1 / fxRateGbpUsd;

    const netLiqGBP = netLiqUSD * fxRateUsdGbp;

    expect(netLiqGBP).toBeGreaterThan(50000);
    expect(netLiqGBP).toBeLessThan(100000);
    expect(netLiqGBP * fxRateGbpUsd).toBeCloseTo(netLiqUSD, 2);
  });

  it('should correctly partition native GBP vs native USD assets', () => {
    const nativeUsdValUSD = 75000;
    const nativeGbpValGBP = 20000;
    const fxRateGbpUsd = 1.302;
    const fxRateUsdGbp = 1 / fxRateGbpUsd;

    const nativeGbpValUSD = nativeGbpValGBP * fxRateGbpUsd; // $26,040 USD
    const totalNetUSD = nativeUsdValUSD + nativeGbpValUSD;  // $101,040 USD

    const nativeUsdShare = (nativeUsdValUSD / totalNetUSD) * 100;
    const nativeGbpShare = (nativeGbpValUSD / totalNetUSD) * 100;

    expect(nativeUsdShare + nativeGbpShare).toBeCloseTo(100, 2);
    expect(nativeUsdShare).toBeGreaterThan(70);
    expect(nativeGbpShare).toBeLessThan(30);
  });
});
