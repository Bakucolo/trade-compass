import { describe, it, expect } from 'vitest';
import { volatilityMacroService } from '../../server/services/volatilityMacroService';

describe('Macro Volatility, Term Structure & Extreme Signals Service', { timeout: 25000 }, () => {
  it('should fetch comprehensive volatility intelligence with live market metrics', async () => {
    const data = await volatilityMacroService.getVolatilityIntelligence();

    expect(data).toBeDefined();
    expect(data.regime).toBeDefined();
    expect(data.regime.type).toBeDefined();
    expect(data.regime.label).toBeDefined();

    // Spot Metrics
    expect(data.spotMetrics.vix.current).toBeGreaterThan(0);
    expect(data.spotMetrics.vvix.current).toBeGreaterThan(0);
    expect(data.spotMetrics.skew.current).toBeGreaterThan(0);
    expect(data.spotMetrics.impliedCorrelation.current).toBeGreaterThan(0);
    expect(data.spotMetrics.volatilityRiskPremium.iv30).toBeGreaterThan(0);

    // Term Structure
    expect(data.termStructure).toBeDefined();
    expect(data.termStructure.points.length).toBeGreaterThanOrEqual(5);
    expect(data.termStructure.structureType).toBeDefined();
    expect(data.termStructure.vx1FrontMonth).toBeGreaterThan(0);

    // Dispersion
    expect(data.dispersion).toBeDefined();
    expect(data.dispersion.stockDispersionScore).toBeGreaterThanOrEqual(0);
    expect(data.dispersion.topSectorDispersion.length).toBeGreaterThan(0);

    // Active Signals & Trade Playbooks
    expect(data.activeSignals.length).toBeGreaterThan(0);
    const firstSignal = data.activeSignals[0];
    expect(firstSignal.title).toBeDefined();
    expect(firstSignal.severity).toBeDefined();
    expect(firstSignal.recommendedTrade).toBeDefined();
    expect(firstSignal.recommendedTrade.strategyName).toBeDefined();
    expect(firstSignal.recommendedTrade.targetAsset).toBeDefined();
    expect(firstSignal.recommendedTrade.tradeConstruction).toBeDefined();
  });

  it('should calculate term structure points with positive DTE and realistic values', async () => {
    const data = await volatilityMacroService.getVolatilityIntelligence();
    const points = data.termStructure.points;

    for (const pt of points) {
      expect(pt.tenor).toBeDefined();
      expect(pt.dte).toBeGreaterThanOrEqual(0);
      expect(pt.value).toBeGreaterThan(0);
    }
  });

  it('should provide actionable trade setups on all triggered signals', async () => {
    const data = await volatilityMacroService.getVolatilityIntelligence();
    
    data.activeSignals.forEach(signal => {
      expect(signal.recommendedTrade.bias).toBeDefined();
      expect(signal.recommendedTrade.entryTrigger).toBeDefined();
      expect(signal.recommendedTrade.targetProfit).toBeDefined();
      expect(signal.recommendedTrade.invalidationStop).toBeDefined();
    });
  });
});
