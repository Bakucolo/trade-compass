// src/test/commoditiesService.test.ts
import { describe, it, expect } from 'vitest';
import { getCommoditiesIntelligence } from '../../server/services/commoditiesService';

describe('Commodities Intelligence & Forward Curves Engine', () => {
  it('fetches complete commodities intelligence payload', async () => {
    const data = await getCommoditiesIntelligence();

    expect(data).toBeDefined();
    expect(data.timestamp).toBeDefined();
    expect(data.marketRegime).toBeDefined();
    expect(data.marketRegime.overallPosture).toBeDefined();
    expect(data.marketRegime.energyRegime).toBeDefined();
    expect(data.marketRegime.metalsRegime).toBeDefined();
    expect(data.marketRegime.agricultureRegime).toBeDefined();
    expect(data.marketRegime.inflationaryImpulseScore).toBeGreaterThanOrEqual(0);
    expect(data.marketRegime.inflationaryImpulseScore).toBeLessThanOrEqual(100);
  });

  it('includes full universe of 21 commodities across all 5 complexes', async () => {
    const data = await getCommoditiesIntelligence();
    expect(data.commodities.length).toBe(21);

    const categories = new Set(data.commodities.map((c) => c.category));
    expect(categories.has('energy')).toBe(true);
    expect(categories.has('precious_metals')).toBe(true);
    expect(categories.has('industrial_metals')).toBe(true);
    expect(categories.has('agriculture')).toBe(true);
    expect(categories.has('livestock')).toBe(true);

    const wti = data.commodities.find((c) => c.id === 'CL');
    expect(wti).toBeDefined();
    expect(wti?.name).toContain('Crude');
    expect(wti?.price).toBeGreaterThan(0);
    expect(wti?.curveStructure).toBeDefined();

    const gold = data.commodities.find((c) => c.id === 'GC');
    expect(gold).toBeDefined();
    expect(gold?.price).toBeGreaterThan(1000);
  });

  it('generates forward curves with M1 to M24 strips and roll yields for core benchmarks', async () => {
    const data = await getCommoditiesIntelligence();
    const benchmarkIds = ['CL', 'BZ', 'NG', 'GC', 'SI', 'HG', 'ZC', 'ZW', 'KC'];

    for (const id of benchmarkIds) {
      const curve = data.forwardCurves[id];
      expect(curve).toBeDefined();
      expect(curve.points.length).toBe(10); // M1, M2, M3, M4, M5, M6, M9, M12, M18, M24
      expect(curve.points[0].tenor).toBe('M1');
      expect(curve.points[7].tenor).toBe('M12');
      expect(curve.structure).toMatch(/^(BACKWARDATION|CONTANGO|FLAT)$/);
      expect(curve.slopePercent).toBeDefined();
      expect(curve.annualizedRollYield).toBeDefined();

      // Calendar spreads
      expect(curve.calendarSpreads.length).toBe(3);
      expect(curve.calendarSpreads[0].name).toContain('M1 - M2');

      // Key stats
      expect(curve.keyStats.inventoryContext).toBeTruthy();
      expect(curve.keyStats.supplyCatalyst).toBeTruthy();
      expect(curve.keyStats.demandCatalyst).toBeTruthy();
    }
  });

  it('computes essential macro commodity cross-ratios', async () => {
    const data = await getCommoditiesIntelligence();
    expect(data.macroRatios.length).toBe(5);

    const gsr = data.macroRatios.find((r) => r.id === 'GSR');
    expect(gsr).toBeDefined();
    expect(gsr?.currentValue).toBeGreaterThan(40);
    expect(gsr?.currentValue).toBeLessThan(120);

    const cgr = data.macroRatios.find((r) => r.id === 'CGR');
    expect(cgr).toBeDefined();
    expect(cgr?.currentValue).toBeGreaterThan(0.5);

    const ogr = data.macroRatios.find((r) => r.id === 'OGR');
    expect(ogr).toBeDefined();
    expect(ogr?.currentValue).toBeGreaterThan(5);

    const crack = data.macroRatios.find((r) => r.id === 'CRACK_321');
    expect(crack).toBeDefined();
    expect(crack?.currentValue).toBeGreaterThan(0);

    const gor = data.macroRatios.find((r) => r.id === 'GOR');
    expect(gor).toBeDefined();
    expect(gor?.currentValue).toBeGreaterThan(10);
  });
});
