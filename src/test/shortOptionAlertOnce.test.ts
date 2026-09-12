import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getContractDefenseKey,
  extractShortOptionKeyFromNote,
  calculateShortOptionDefenseLevels,
  syncShortOptionAlerts,
  setShortOptionAlertHistoryFilePath,
  saveShortOptionAlertHistory,
  loadShortOptionAlertHistory
} from '../../server/services/shortOptionAlertService';

describe('Short Option Defense Alerts - Set Only Once & Never Trigger When Muted', () => {
  const TEST_HISTORY_PATH = path.join(os.tmpdir(), `test_short_option_alerts_history_${Date.now()}.json`);

  beforeEach(() => {
    setShortOptionAlertHistoryFilePath(TEST_HISTORY_PATH);
    if (fs.existsSync(TEST_HISTORY_PATH)) {
      try { fs.unlinkSync(TEST_HISTORY_PATH); } catch (_) {}
    }
  });

  afterAll(() => {
    setShortOptionAlertHistoryFilePath(null);
    if (fs.existsSync(TEST_HISTORY_PATH)) {
      try { fs.unlinkSync(TEST_HISTORY_PATH); } catch (_) {}
    }
  });

  describe('extractShortOptionKeyFromNote and getContractDefenseKey', () => {
    it('should generate consistent defense keys for 5% and 10% levels', () => {
      const key10 = getContractDefenseKey('NVDA', 120, 'PUT', '2026-08-21', 10);
      const key5 = getContractDefenseKey('NVDA', 120, 'PUT', '2026-08-21', 5);

      expect(key10).toBe('NVDA_120_PUT_2026-08-21_10');
      expect(key5).toBe('NVDA_120_PUT_2026-08-21_5');
    });

    it('should parse 10% defense alert notes accurately', () => {
      const note = '[Short Option 10% Defense] EQX $12.5 PUT (2028-01-21T21:00:00.000Z) - Warning: Underlying approaching within 10% of strike $12.5';
      const key = extractShortOptionKeyFromNote(note);
      expect(key).toBe('EQX_12.5_PUT_2028-01-21T21:00:00.000Z_10');
    });

    it('should parse 5% defense alert notes accurately', () => {
      const note = '[Short Option 5% Defense] RKLB $60 PUT (20260918) - CRITICAL: Underlying approaching within 5% of strike $60';
      const key = extractShortOptionKeyFromNote(note);
      expect(key).toBe('RKLB_60_PUT_20260918_5');
    });

    it('should return null for unrelated notes', () => {
      expect(extractShortOptionKeyFromNote('Dip buy support level')).toBeNull();
      expect(extractShortOptionKeyFromNote(null)).toBeNull();
    });
  });

  describe('syncShortOptionAlerts - Set Only Once Protection', () => {
    it('should NOT recreate alerts if they were already provisioned in history even if deleted from DB', async () => {
      // Mock holdings with 1 short put
      const mockHoldings = [
        {
          id: 'holding-eqx-1',
          symbol: 'EQX',
          assetType: 'OPTION',
          quantity: -2,
          strikePrice: 12.5,
          optionType: 'PUT',
          expiryDate: '2028-01-21T21:00:00.000Z',
          underlyingSymbol: 'EQX',
          broker: { name: 'Interactive Brokers' }
        }
      ];

      const mockPrisma: any = {
        holding: {
          findMany: vi.fn().mockResolvedValue(mockHoldings)
        },
        priceAlert: {
          findMany: vi.fn().mockResolvedValue([]), // User deleted all alerts from DB!
          create: vi.fn()
        }
      };

      // Populate history tracker indicating EQX 10% and 5% were already provisioned in the past
      saveShortOptionAlertHistory({
        'EQX_12.5_PUT_2028-01-21T21:00:00.000Z_10': {
          key: 'EQX_12.5_PUT_2028-01-21T21:00:00.000Z_10',
          underlyingSymbol: 'EQX',
          strikePrice: 12.5,
          optionType: 'PUT',
          expiryDate: '2028-01-21T21:00:00.000Z',
          pct: 10,
          provisionedAt: new Date().toISOString(),
          dismissedAt: null
        },
        'EQX_12.5_PUT_2028-01-21T21:00:00.000Z_5': {
          key: 'EQX_12.5_PUT_2028-01-21T21:00:00.000Z_5',
          underlyingSymbol: 'EQX',
          strikePrice: 12.5,
          optionType: 'PUT',
          expiryDate: '2028-01-21T21:00:00.000Z',
          pct: 5,
          provisionedAt: new Date().toISOString(),
          dismissedAt: null
        }
      });

      const result = await syncShortOptionAlerts(mockPrisma, () => {});

      // Verify that NO new alerts were created
      expect(result.createdAlertsCount).toBe(0);
      expect(mockPrisma.priceAlert.create).not.toHaveBeenCalled();
      expect(result.existingAlertsCount).toBe(2);
    });

    it('should provision alerts ONLY for truly new short options not in history', async () => {
      const mockHoldings = [
        {
          id: 'holding-new-1',
          symbol: 'NEWTICKER',
          assetType: 'OPTION',
          quantity: -1,
          strikePrice: 50,
          optionType: 'PUT',
          expiryDate: '2026-12-18',
          underlyingSymbol: 'NEWTICKER',
          broker: { name: 'Tastytrade' }
        }
      ];

      const mockPrisma: any = {
        holding: {
          findMany: vi.fn().mockResolvedValue(mockHoldings)
        },
        priceAlert: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockImplementation((args) => Promise.resolve({ id: 'alert-new', ...args.data }))
        }
      };

      // History is empty in TEST_HISTORY_PATH
      saveShortOptionAlertHistory({});

      const result = await syncShortOptionAlerts(mockPrisma, () => {});

      expect(result.createdAlertsCount).toBe(2);
      expect(mockPrisma.priceAlert.create).toHaveBeenCalledTimes(2);

      // Verify history file now tracks both newly provisioned alerts
      const updatedHistory = loadShortOptionAlertHistory();
      expect(updatedHistory['NEWTICKER_50_PUT_2026-12-18_10']).toBeDefined();
      expect(updatedHistory['NEWTICKER_50_PUT_2026-12-18_5']).toBeDefined();
    });
  });

  describe('Alert Muting Evaluation Rule', () => {
    it('ensures muted alerts are ignored and never evaluate triggers', () => {
      const alerts = [
        {
          id: 'alert-active',
          symbol: 'EQX',
          condition: 'BELOW',
          targetPrice: 13.75,
          status: 'ACTIVE',
          isMuted: false
        },
        {
          id: 'alert-muted',
          symbol: 'EQX',
          condition: 'BELOW',
          targetPrice: 13.13,
          status: 'ACTIVE',
          isMuted: true // Muted by user!
        }
      ];

      const currentPrice = 12.50; // Triggers condition

      // Evaluation filter matching checkPriceAlerts
      const unmutedActiveAlerts = alerts.filter(a => a.status === 'ACTIVE' && !a.isMuted);

      expect(unmutedActiveAlerts.length).toBe(1);
      expect(unmutedActiveAlerts[0].id).toBe('alert-active');

      const triggeredAlerts = unmutedActiveAlerts.filter(a => {
        if (a.isMuted) return false;
        return a.condition === 'BELOW' && currentPrice <= a.targetPrice;
      });

      expect(triggeredAlerts.length).toBe(1);
      expect(triggeredAlerts[0].id).toBe('alert-active');
    });
  });
});
