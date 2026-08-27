import { describe, it, expect } from 'vitest';
import { shortCandidateService } from '../../server/services/shortCandidateService';

describe('AI Short Finding & Bearish Catalyst Agent Service', { timeout: 25000 }, () => {
  it('should scan universe and return rich short candidates with market context', async () => {
    const result = await shortCandidateService.scanShortCandidates();

    expect(result).toBeDefined();
    expect(result.totalUniverseScanned).toBeGreaterThan(0);
    expect(result.matchedCount).toBeGreaterThan(0);
    expect(result.marketContext).toBeDefined();
    expect(result.candidates.length).toBeGreaterThan(0);

    const first = result.candidates[0];
    expect(first.symbol).toBeTruthy();
    expect(first.convictionScore).toBeGreaterThanOrEqual(65);
    expect(first.shortThesis).toBeTruthy();
    expect(first.keyVulnerabilities.length).toBeGreaterThan(0);
    expect(first.catalysts.length).toBeGreaterThan(0);
    expect(first.tradeBlueprint.entryTriggerPrice).toBeGreaterThan(0);
    expect(first.tradeBlueprint.targetPrice1).toBeLessThan(first.currentPrice);
    expect(first.tradeBlueprint.stopLossPrice).toBeGreaterThan(first.currentPrice);
  });

  it('should filter candidates accurately by Archetype', async () => {
    const valuationResult = await shortCandidateService.scanShortCandidates({
      archetype: 'FUNDAMENTAL_OVERVALUATION'
    });

    expect(valuationResult.candidates.length).toBeGreaterThan(0);
    valuationResult.candidates.forEach(c => {
      expect(c.archetype).toBe('FUNDAMENTAL_OVERVALUATION');
    });

    const distressResult = await shortCandidateService.scanShortCandidates({
      archetype: 'BALANCE_SHEET_DISTRESS'
    });

    expect(distressResult.candidates.length).toBeGreaterThan(0);
    distressResult.candidates.forEach(c => {
      expect(c.archetype).toBe('BALANCE_SHEET_DISTRESS');
    });
  });

  it('should filter candidates by Execution Vehicle', async () => {
    const spreadsResult = await shortCandidateService.scanShortCandidates({
      executionVehicle: 'BEAR_PUT_SPREAD'
    });

    expect(spreadsResult.candidates.length).toBeGreaterThan(0);
    spreadsResult.candidates.forEach(c => {
      expect(c.tradeBlueprint.recommendedVehicle).toBe('BEAR_PUT_SPREAD');
    });
  });

  it('should filter candidates by Market Cap Category', async () => {
    const largeCapResult = await shortCandidateService.scanShortCandidates({
      marketCapCategory: 'LARGE_CAP'
    });

    expect(largeCapResult.candidates.length).toBeGreaterThan(0);
    largeCapResult.candidates.forEach(c => {
      expect(c.marketCapCategory).toBe('LARGE_CAP');
    });
  });

  it('should boost conviction for matches under custom prompt', async () => {
    const promptResult = await shortCandidateService.scanShortCandidates({
      customPrompt: 'Carvana auto loan debt'
    });

    const cvna = promptResult.candidates.find(c => c.symbol === 'CVNA');
    expect(cvna).toBeDefined();
    expect(cvna?.convictionScore).toBeGreaterThanOrEqual(90);
  });
});
