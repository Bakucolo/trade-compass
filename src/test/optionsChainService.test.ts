import { describe, it, expect } from 'vitest';
import { optionsChainService } from '../../server/services/optionsChainService';

describe('Options Chain & Volatility Greeks Service', { timeout: 25000 }, () => {
  it('should fetch full options chain matrix with Greeks, Max Pain, Call/Put Walls, and Big OI analytics for AAPL', async () => {
    const chain = await optionsChainService.getOptionsChain('AAPL');

    expect(chain).toBeDefined();
    expect(chain.symbol).toBe('AAPL');
    expect(chain.underlyingPrice).toBeGreaterThan(0);
    expect(chain.selectedExpiration).toBeDefined();
    expect(chain.selectedDte).toBeGreaterThanOrEqual(0);

    // Expirations
    expect(chain.expirations.length).toBeGreaterThan(0);
    const firstExp = chain.expirations[0];
    expect(firstExp.date).toBeDefined();
    expect(firstExp.formattedDate).toBeDefined();
    expect(firstExp.type).toBeDefined();

    // Strikes Matrix
    expect(chain.strikes.length).toBeGreaterThan(0);
    const atmRow = chain.strikes.find(s => s.isAtm);
    expect(atmRow).toBeDefined();
    expect(atmRow?.strike).toBeGreaterThan(0);

    // Check Calls & Puts enriched data
    if (atmRow?.call) {
      expect(atmRow.call.optionType).toBe('CALL');
      expect(atmRow.call.strike).toBe(atmRow.strike);
      expect(atmRow.call.mid).toBeGreaterThanOrEqual(0);
      expect(atmRow.call.delta).toBeGreaterThanOrEqual(0);
      expect(atmRow.call.delta).toBeLessThanOrEqual(1.0);
      expect(atmRow.call.impliedVolatility).toBeGreaterThan(0);
    }

    if (atmRow?.put) {
      expect(atmRow.put.optionType).toBe('PUT');
      expect(atmRow.put.strike).toBe(atmRow.strike);
      expect(atmRow.put.mid).toBeGreaterThanOrEqual(0);
      expect(atmRow.put.delta).toBeLessThanOrEqual(0);
      expect(atmRow.put.delta).toBeGreaterThanOrEqual(-1.0);
    }

    // Analytics
    expect(chain.analytics).toBeDefined();
    expect(chain.analytics.impliedVolatilityAtm).toBeGreaterThan(0);
    expect(chain.analytics.expectedMoveDollars).toBeGreaterThanOrEqual(0);
    expect(chain.analytics.maxPainStrike).toBeGreaterThan(0);

    // Key Levels (Max Pain, Call Wall, Put Wall, Gamma Flip)
    expect(chain.keyLevels).toBeDefined();
    expect(chain.keyLevels.maxPain.strike).toBeGreaterThan(0);
    expect(chain.keyLevels.maxPain.pullDirection).toBeDefined();
    expect(chain.keyLevels.callWall.strike).toBeGreaterThan(0);
    expect(chain.keyLevels.callWall.openInterest).toBeGreaterThanOrEqual(0);
    expect(chain.keyLevels.putWall.strike).toBeGreaterThan(0);
    expect(chain.keyLevels.putWall.openInterest).toBeGreaterThanOrEqual(0);
    expect(chain.keyLevels.gammaFlip.estimatedStrike).toBeGreaterThan(0);

    // Big OI Strikes & Expirations
    expect(chain.bigOiStrikes).toBeDefined();
    expect(chain.bigOiStrikes.length).toBeGreaterThan(0);
    expect(chain.bigOiExpirations).toBeDefined();
    expect(chain.bigOiExpirations.length).toBeGreaterThan(0);

    // Underlying Dynamics Narrative
    expect(chain.underlyingDynamics).toBeDefined();
    expect(chain.underlyingDynamics.headline).toBeDefined();
    expect(chain.underlyingDynamics.pinningPressure).toBeDefined();
  });

  it('should fetch target specific expiration when specified', async () => {
    const mainChain = await optionsChainService.getOptionsChain('NVDA');
    expect(mainChain.expirations.length).toBeGreaterThan(1);

    const secondExp = mainChain.expirations[1].date;
    const targetChain = await optionsChainService.getOptionsChain('NVDA', secondExp);

    expect(targetChain.selectedExpiration).toBe(secondExp);
    expect(targetChain.strikes.length).toBeGreaterThan(0);
    expect(targetChain.keyLevels.maxPain.strike).toBeGreaterThan(0);
  });

  it('should gracefully provide structured fallback for invalid tickers with key levels', async () => {
    const fallback = await optionsChainService.getOptionsChain('INVALIDXYZ999');

    expect(fallback).toBeDefined();
    expect(fallback.symbol).toBe('INVALIDXYZ999');
    expect(fallback.expirations.length).toBeGreaterThan(0);
    expect(fallback.strikes.length).toBeGreaterThan(0);
    expect(fallback.analytics.maxPainStrike).toBeGreaterThan(0);
    expect(fallback.keyLevels.callWall.strike).toBeGreaterThan(0);
    expect(fallback.keyLevels.putWall.strike).toBeGreaterThan(0);
  });
});
