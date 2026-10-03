import { describe, it, expect } from 'vitest';
import { computePositionThreat, isOptionCall } from '../components/portfolio/CriticalDefenseModal';
import { UnifiedPosition } from '../components/portfolio/types';

describe('Critical Position Defense Threat Evaluation', () => {
  const baseOptionPosition: UnifiedPosition = {
    id: 'pos-1',
    symbol: 'Z     260821P00027500',
    quantity: -1,
    averageCost: 1.89,
    currentPrice: 0.0001,
    marketValue: -0.01,
    dayChange: 0,
    dayChangePercent: 0,
    unrealizedPL: 189.51,
    unrealizedPLPercent: 99.99,
    source: 'IBKR',
    assetType: 'Option',
    strike: 27.5,
    optionType: 'Put',
    expiry: '20260821', // Past expired (August 21, 2026)
    underlyingSymbol: 'Z',
    underlyingPrice: 0, // Unset or 0
    currency: 'USD',
  };

  it('should assign threatScore 0 to options that expired in the past', () => {
    const threat = computePositionThreat(baseOptionPosition);
    expect(threat.threatScore).toBe(0);
    expect(threat.threatLevel).toBe('LOW');
    expect(threat.isITM).toBe(false);
  });

  it('should not mark an option as 100% ITM when underlying price is unknown or zero', () => {
    const futureOption: UnifiedPosition = {
      ...baseOptionPosition,
      expiry: '20261218', // Future expiration
      underlyingPrice: 0,
      unrealizedPL: 50,
      unrealizedPLPercent: 40,
    };

    const threat = computePositionThreat(futureOption);
    expect(threat.isITM).toBe(false);
    expect(threat.distancePct).toBe(Infinity);
    expect(threat.threatLevel).not.toBe('EXTREME');
  });

  it('should not mark a +99% max profit decaying short option as an extreme threat', () => {
    const winningShortPut: UnifiedPosition = {
      ...baseOptionPosition,
      expiry: '20260918',
      underlyingPrice: 35.0, // Stock is at 35, Put is at 27.5 (OTM)
      unrealizedPL: 180,
      unrealizedPLPercent: 95.0,
    };

    const threat = computePositionThreat(winningShortPut);
    expect(threat.isITM).toBe(false);
    expect(threat.threatLevel).not.toBe('EXTREME');
    expect(threat.threatScore).toBeLessThan(20);
  });

  it('should accurately evaluate short puts on tickers containing C (e.g. OSCR, CCJ, COIN) when underlying is above strike', () => {
    // OSCR Short Put $15 with underlying at $30.05
    const oscrShortPut: UnifiedPosition = {
      id: 'pos-oscr-1',
      symbol: 'OSCR',
      quantity: -1,
      averageCost: 1.20,
      currentPrice: 0.15,
      marketValue: -15,
      dayChange: 0,
      dayChangePercent: 0,
      unrealizedPL: 105,
      unrealizedPLPercent: 87.5,
      source: 'Tastytrade',
      assetType: 'Option',
      strike: 15.0,
      optionType: 'Put',
      expiry: new Date(Date.now() + 140 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 140 DTE
      underlyingSymbol: 'OSCR',
      underlyingPrice: 30.05,
      currency: 'USD',
    };

    const threat = computePositionThreat(oscrShortPut);
    expect(threat.isITM).toBe(false);
    expect(threat.distancePct).toBeCloseTo(100.33, 1);
    expect(threat.threatLevel).toBe('LOW');
    expect(threat.threatScore).toBe(0);
    expect(threat.threatReason).not.toContain('ITM');
    expect(threat.threatReason).not.toContain('Assignment risk');
  });

  it('should correctly classify option type using isOptionCall helper', () => {
    expect(isOptionCall({ optionType: 'Put', symbol: 'OSCR' })).toBe(false);
    expect(isOptionCall({ optionType: 'P', symbol: 'CCJ' })).toBe(false);
    expect(isOptionCall({ optionType: 'PUT', symbol: 'COIN' })).toBe(false);
    expect(isOptionCall({ optionType: 'Call', symbol: 'OSCR' })).toBe(true);
    expect(isOptionCall({ optionType: 'C', symbol: 'AAPL' })).toBe(true);
    expect(isOptionCall({ symbol: 'OSCR  260116P00015000' })).toBe(false);
    expect(isOptionCall({ symbol: 'OSCR  260116C00015000' })).toBe(true);
  });

  it('evaluates Long Calls OTM as danger positions with elevated threat score and 0 intrinsic value', () => {
    // TSLA Long Call $260 Strike, Spot is $245 (OTM by $15), Loss -50%
    const otmLongCall: UnifiedPosition = {
      id: 'tsla-long-call-otm',
      symbol: 'TSLA  261016C00260000',
      underlyingSymbol: 'TSLA',
      quantity: 2, // Long
      averageCost: 8.0,
      currentPrice: 4.0,
      marketValue: 800,
      dayChange: 0,
      dayChangePercent: 0,
      unrealizedPL: -800,
      unrealizedPLPercent: -50.0,
      source: 'Tastytrade',
      assetType: 'Option',
      strike: 260,
      optionType: 'Call',
      underlyingPrice: 245, // OTM: 245 < 260
      expiry: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 6 DTE
      currency: 'USD',
    };

    const threat = computePositionThreat(otmLongCall);
    expect(threat.isITM).toBe(false);
    expect(threat.distancePct).toBeCloseTo(5.77, 1);
    // Should have substantial threat score: OTM losing (40) + drawdown (15) + DTE <= 7 (15) = 70
    expect(threat.threatScore).toBeGreaterThanOrEqual(40);
    expect(threat.threatLevel).toMatch(/HIGH|EXTREME/);
    expect(threat.threatReason).toContain('OTM (Losing trade with 0 intrinsic value)');
  });

  it('evaluates Long Calls ITM as safe winning positions with intrinsic value and low threat score', () => {
    // NVDA Long Call $100 Strike, Spot is $120 (ITM by $20), Profit +100%
    const itmLongCall: UnifiedPosition = {
      id: 'nvda-long-call-itm',
      symbol: 'NVDA  261016C00100000',
      underlyingSymbol: 'NVDA',
      quantity: 1, // Long
      averageCost: 10.0,
      currentPrice: 22.0,
      marketValue: 2200,
      dayChange: 0,
      dayChangePercent: 0,
      unrealizedPL: 1200,
      unrealizedPLPercent: 120.0,
      source: 'IBKR',
      assetType: 'Option',
      strike: 100,
      optionType: 'Call',
      underlyingPrice: 120, // ITM: 120 > 100
      expiry: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 45 DTE
      currency: 'USD',
    };

    const threat = computePositionThreat(itmLongCall);
    expect(threat.isITM).toBe(true);
    expect(threat.distancePct).toBeCloseTo(20.0, 1);
    expect(threat.threatScore).toBe(0);
    expect(threat.threatLevel).toBe('LOW');
  });
});
