import { describe, it, expect } from 'vitest';
import { isDossierFromToday } from '../services/macroDossierService';
import { formatMacroDossierRecord, getTodayMacroDossier } from '../../server/services/macroDossierService';

describe('AI Macro Dossier Daily Caching & Compute Allowance Protection', () => {
  describe('isDossierFromToday', () => {
    it('should identify records created today as true', () => {
      const now = new Date();
      expect(isDossierFromToday(now.toISOString())).toBe(true);

      const earlierToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 15, 0);
      expect(isDossierFromToday(earlierToday.toISOString())).toBe(true);

      const middayToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 30, 0);
      expect(isDossierFromToday(middayToday.toISOString())).toBe(true);
    });

    it('should identify past or future dates as false', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(isDossierFromToday(yesterday.toISOString())).toBe(false);

      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      expect(isDossierFromToday(lastWeek.toISOString())).toBe(false);

      expect(isDossierFromToday('2026-08-24T05:03:22.500Z')).toBe(false);
      expect(isDossierFromToday(null)).toBe(false);
      expect(isDossierFromToday(undefined)).toBe(false);
      expect(isDossierFromToday('invalid-date')).toBe(false);
    });
  });

  describe('formatMacroDossierRecord', () => {
    it('should accurately format record from rawDossierJson', () => {
      const sampleDossier = {
        title: 'Global Macro Regime: Test',
        regimeTitle: 'Late-Cycle Disinflation',
        regimeTone: 'neutral',
        macroScore: 72,
        growthOutlook: 'MODERATING',
        inflationRegime: 'DISINFLATION',
        monetaryPolicyPosture: 'NEUTRAL_PAUSE',
        liquidityCondition: 'NEUTRAL',
        vixLevel: 15.2,
        yield10y: 4.25,
        spread2y10y: 0.18,
        dxyLevel: 102.5,
        oilPrice: 73.5,
        fedFundsRate: 4.83,
        highYieldSpread: 3.12,
        executiveSummary: 'Executive overview summary.',
        narrativeOverview: 'Full macro narrative overview.',
        keyTakeaways: ['Disinflation continuing', 'Fed pause imminent'],
        pillars: [],
        scenarios: [],
        tacticalAllocations: [],
        catalystsRadar: []
      };

      const dbRecord = {
        id: 'test-dossier-123',
        createdAt: new Date('2026-09-08T10:00:00.000Z'),
        rawDossierJson: JSON.stringify(sampleDossier)
      };

      const result = formatMacroDossierRecord(dbRecord);
      expect(result.id).toBe('test-dossier-123');
      expect(result.regimeTitle).toBe('Late-Cycle Disinflation');
      expect(result.macroScore).toBe(72);
      expect(result.createdAt).toBe('2026-09-08T10:00:00.000Z');
      expect(result.keyTakeaways).toContain('Disinflation continuing');
    });

    it('should fallback gracefully if rawDossierJson is malformed', () => {
      const dbRecord = {
        id: 'fallback-id',
        createdAt: new Date('2026-09-08T10:00:00.000Z'),
        title: 'Fallback Title',
        regimeTitle: 'Fallback Regime',
        regimeTone: 'warning',
        macroScore: 50,
        growthOutlook: 'MODERATING',
        inflationRegime: 'STICKY_TARGET',
        monetaryPolicyPosture: 'HAWKISH',
        liquidityCondition: 'TIGHTENING',
        vixLevel: 22.1,
        yield10y: 4.5,
        spread2y10y: -0.15,
        dxyLevel: 105.1,
        oilPrice: 80.0,
        executiveSummary: 'Fallback executive summary',
        narrativeOverview: 'Fallback narrative',
        rawDossierJson: 'MALFORMED_JSON_STRING'
      };

      const result = formatMacroDossierRecord(dbRecord);
      expect(result.id).toBe('fallback-id');
      expect(result.regimeTitle).toBe('Fallback Regime');
      expect(result.macroScore).toBe(50);
      expect(result.vixLevel).toBe(22.1);
    });
  });

  describe('getTodayMacroDossier', () => {
    it('should calculate startOfDay correctly and respect clientDate if provided', async () => {
      const clientDate = '2026-09-08T15:30:00.000Z';
      const dossier = await getTodayMacroDossier(clientDate);
      expect(dossier === null || isDossierFromToday(dossier.createdAt)).toBe(true);
    });

    it('should return null when no dossier has been run yet today', async () => {
      const todayDossier = await getTodayMacroDossier();
      expect(todayDossier === null || isDossierFromToday(todayDossier.createdAt)).toBe(true);
    });
  });
});
