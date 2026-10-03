import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateBracketTargetPrices,
  createAutoBracketAlerts,
} from '../../server/services/alertFollowUpService';

describe('Auto-Bracket Price Alert Service (+5% and -5% on Trigger)', () => {
  describe('calculateBracketTargetPrices', () => {
    it('calculates exact +5% above and -5% below for typical stock prices', () => {
      const { upperTarget, lowerTarget } = calculateBracketTargetPrices(100.0);
      expect(upperTarget).toBe(105.0);
      expect(lowerTarget).toBe(95.0);
    });

    it('accurately rounds prices with floating point precision', () => {
      // 13.10 * 1.05 = 13.755 -> 13.76
      // 13.10 * 0.95 = 12.445 -> 12.45
      const { upperTarget, lowerTarget } = calculateBracketTargetPrices(13.1);
      expect(upperTarget).toBe(13.76);
      expect(lowerTarget).toBe(12.45);
    });

    it('enforces upper strictly above and lower strictly below even on small prices', () => {
      const { upperTarget, lowerTarget } = calculateBracketTargetPrices(0.1);
      expect(upperTarget).toBeGreaterThan(0.1);
      expect(lowerTarget).toBeLessThan(0.1);
      expect(lowerTarget).toBeGreaterThanOrEqual(0.01);
    });

    it('handles zero or negative prices gracefully', () => {
      expect(calculateBracketTargetPrices(0)).toEqual({ upperTarget: 0, lowerTarget: 0 });
      expect(calculateBracketTargetPrices(-50)).toEqual({ upperTarget: 0, lowerTarget: 0 });
    });
  });

  describe('createAutoBracketAlerts', () => {
    let mockPrisma: any;
    let createdAlerts: any[];

    beforeEach(() => {
      createdAlerts = [];
      mockPrisma = {
        priceAlert: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            return (
              createdAlerts.find(
                (a) =>
                  a.symbol === where.symbol &&
                  a.condition === where.condition &&
                  a.status === 'ACTIVE' &&
                  a.targetPrice >= where.targetPrice.gte &&
                  a.targetPrice <= where.targetPrice.lte
              ) || null
            );
          }),
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            const newRecord = {
              id: `alert-${Date.now()}-${Math.random()}`,
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            createdAlerts.push(newRecord);
            return newRecord;
          }),
        },
      };
    });

    it('creates both +5% ABOVE and -5% BELOW alerts when an alert is triggered', async () => {
      const triggeredAlert = {
        id: 'alert-initial-1',
        symbol: 'NVDA',
        targetPrice: 120.0,
        condition: 'ABOVE',
      };

      const result = await createAutoBracketAlerts(mockPrisma, triggeredAlert, 120.0, () => {});

      expect(result.createdCount).toBe(2);
      expect(result.upperTarget).toBe(126.0); // 120 * 1.05
      expect(result.lowerTarget).toBe(114.0); // 120 * 0.95
      expect(result.upperAlert).toBeDefined();
      expect(result.lowerAlert).toBeDefined();

      expect(mockPrisma.priceAlert.create).toHaveBeenCalledTimes(2);

      // Verify upper alert specs
      expect(result.upperAlert.symbol).toBe('NVDA');
      expect(result.upperAlert.condition).toBe('ABOVE');
      expect(result.upperAlert.targetPrice).toBe(126.0);
      expect(result.upperAlert.status).toBe('ACTIVE');
      expect(result.upperAlert.notes).toContain('[Auto-Bracket +5%]');

      // Verify lower alert specs
      expect(result.lowerAlert.symbol).toBe('NVDA');
      expect(result.lowerAlert.condition).toBe('BELOW');
      expect(result.lowerAlert.targetPrice).toBe(114.0);
      expect(result.lowerAlert.status).toBe('ACTIVE');
      expect(result.lowerAlert.notes).toContain('[Auto-Bracket -5%]');
    });

    it('does NOT create duplicate alerts if active alerts already exist around target prices', async () => {
      // Pre-seed an existing active +5% alert around $126.0
      createdAlerts.push({
        id: 'existing-up-alert',
        symbol: 'NVDA',
        condition: 'ABOVE',
        targetPrice: 126.0,
        status: 'ACTIVE',
      });

      const triggeredAlert = {
        id: 'alert-initial-2',
        symbol: 'NVDA',
        targetPrice: 120.0,
        condition: 'ABOVE',
      };

      const result = await createAutoBracketAlerts(mockPrisma, triggeredAlert, 120.0, () => {});

      // Only the lower (-5%) alert should be created because upper already exists
      expect(result.createdCount).toBe(1);
      expect(result.upperAlert).toBeNull();
      expect(result.lowerAlert).toBeDefined();
      expect(result.lowerAlert.condition).toBe('BELOW');
      expect(result.lowerAlert.targetPrice).toBe(114.0);
    });

    it('safely skips invalid tickers or non-positive current prices', async () => {
      const invalidAlert = { symbol: '' };
      const res1 = await createAutoBracketAlerts(mockPrisma, invalidAlert, 100, () => {});
      expect(res1.createdCount).toBe(0);

      const validAlert = { symbol: 'AAPL' };
      const res2 = await createAutoBracketAlerts(mockPrisma, validAlert, 0, () => {});
      expect(res2.createdCount).toBe(0);

      expect(mockPrisma.priceAlert.create).not.toHaveBeenCalled();
    });
  });
});
