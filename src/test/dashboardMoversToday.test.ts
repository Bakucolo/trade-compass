import { describe, it, expect } from 'vitest';

describe('Portfolio Movers Spotlight - Today Timeframe Calculations', () => {
  it('should compute true today session percentage and dollar return for equities', () => {
    // Simulated equity position
    const equityPosition = {
      id: 'crm-holding',
      symbol: 'CRM',
      assetType: 'EQUITY',
      quantity: 6.07881,
      averageCost: 240,
      currentPrice: 259.5,
      marketValue: 1577.45,
      currency: 'USD',
    };

    // Live quote with genuine intraday move
    const quote = {
      price: 259.5,
      previousClose: 256.93,
      change: 2.57,
      changesPercentage: 1.0003,
      yesterdayChange: -1.18,
      yesterdayChangePercent: -0.457,
      currency: 'USD',
    };

    const isOption = equityPosition.assetType === 'Option' || equityPosition.assetType === 'OPTION';
    const isUKPence = quote.currency === 'GBp' || (equityPosition.currency === 'GBP' && equityPosition.symbol.endsWith('.L'));
    const nativeChange = isUKPence ? (quote.change / 100) : quote.change;

    let dPnLPct = 0;
    let dPnL = 0;

    if (!isOption && quote.changesPercentage !== undefined) {
      dPnLPct = quote.changesPercentage;
      dPnL = nativeChange * equityPosition.quantity;
    }

    expect(dPnLPct).toBeCloseTo(1.0003, 3);
    expect(dPnL).toBeCloseTo(15.62, 1);
    expect(dPnLPct).toBeLessThan(5); // Must not be the distorted 50% 45-day return!
  });

  it('should properly handle UK stocks in pence (GBp) without 100x multiplication errors', () => {
    const ukPosition = {
      id: 'hoc-holding',
      symbol: 'HOC.L',
      assetType: 'EQUITY',
      quantity: 272.06,
      averageCost: 6.40,
      currentPrice: 6.51,
      marketValue: 1771.11,
      currency: 'GBP',
    };

    // Quote in GBp (pence)
    const quote = {
      price: 651.0,
      previousClose: 647.0,
      change: 4.0, // 4 pence
      changesPercentage: 0.618,
      currency: 'GBp',
    };

    const isUKPence = quote.currency === 'GBp' || (ukPosition.currency === 'GBP' && ukPosition.symbol.endsWith('.L'));
    const nativeChange = isUKPence ? (quote.change / 100) : quote.change;
    const dPnL = nativeChange * ukPosition.quantity;

    expect(isUKPence).toBe(true);
    expect(nativeChange).toBe(0.04); // £0.04 per share
    expect(dPnL).toBeCloseTo(10.88, 1); // £10.88 total, NOT £1,088 or £60,000!
  });

  it('should not apply underlying stock price change directly to option contracts', () => {
    const optionPosition = {
      id: 'z-put-option',
      symbol: 'Z',
      assetType: 'OPTION',
      quantity: -1,
      averageCost: 189.5,
      currentPrice: 0.00001,
      marketValue: 0.001,
      dayPnL: 6.60,
      dayPnLPercent: 0,
      currency: 'USD',
    };

    const underlyingQuote = {
      symbol: 'Z',
      price: 65.0,
      change: 2.50,
      changesPercentage: 4.0,
    };

    const isOption = optionPosition.assetType === 'Option' || optionPosition.assetType === 'OPTION';

    let dPnL = 0;
    let dPnLPct = 0;

    if (!isOption) {
      dPnLPct = underlyingQuote.changesPercentage;
      dPnL = underlyingQuote.change * optionPosition.quantity;
    } else {
      dPnL = optionPosition.dayPnL ?? 0;
      dPnLPct = optionPosition.dayPnLPercent ?? 0;
      if (optionPosition.marketValue >= 1 && dPnL !== 0 && dPnLPct === 0) {
        dPnLPct = (dPnL / optionPosition.marketValue) * 100;
      } else if (optionPosition.marketValue < 1) {
        dPnLPct = 0; // Guard against division by 0.000001 resulting in billions of percent
      }
    }

    expect(dPnL).toBe(6.60);
    expect(dPnLPct).toBe(0); // Guarded: not 98 billion percent
  });
});
