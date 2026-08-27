import { describe, it, expect } from 'vitest';
import { computePositionThreat } from '../components/portfolio/CriticalDefenseModal';
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

  it('should accurately flag a real losing ITM short option with low DTE as EXTREME THREAT', () => {
    const urgentThreatOption: UnifiedPosition = {
      ...baseOptionPosition,
      expiry: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 2 DTE
      underlyingPrice: 24.0, // Stock fell to 24, Strike is 27.5 (ITM breach!)
      unrealizedPL: -350,
      unrealizedPLPercent: -180.0,
    };

    const threat = computePositionThreat(urgentThreatOption);
    expect(threat.isITM).toBe(true);
    expect(threat.threatLevel).toBe('EXTREME');
    expect(threat.threatScore).toBeGreaterThanOrEqual(60);
  });
});
