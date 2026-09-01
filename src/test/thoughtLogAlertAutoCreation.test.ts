import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractPriceAlertCandidates, autoCreateAlertsFromText } from '../../server/services/thoughtLogAlertService';

describe('ThoughtLog & Telegram Auto Price Alert Parsing & Creation', () => {
  it('extracts standard "RBRK 120" alert format', () => {
    const candidates = extractPriceAlertCandidates('RBRK 120');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].symbol).toBe('RBRK');
    expect(candidates[0].targetPrice).toBe(120);
    expect(candidates[0].condition).toBe('AUTO');
  });

  it('extracts "Alert RBRK at $120.50" format', () => {
    const candidates = extractPriceAlertCandidates('Alert RBRK at $120.50');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].symbol).toBe('RBRK');
    expect(candidates[0].targetPrice).toBe(120.5);
  });

  it('extracts explicit direction conditions: above vs below', () => {
    const aboveCandidates = extractPriceAlertCandidates('RBRK above 125');
    expect(aboveCandidates[0].condition).toBe('ABOVE');
    expect(aboveCandidates[0].targetPrice).toBe(125);

    const gtCandidates = extractPriceAlertCandidates('NVDA > 130');
    expect(gtCandidates[0].condition).toBe('ABOVE');

    const belowCandidates = extractPriceAlertCandidates('RBRK below 110');
    expect(belowCandidates[0].condition).toBe('BELOW');
    expect(belowCandidates[0].targetPrice).toBe(110);

    const ltCandidates = extractPriceAlertCandidates('AAPL < 220');
    expect(ltCandidates[0].condition).toBe('BELOW');
  });

  it('extracts multiple alerts from multi-line or comma-separated messages', () => {
    const multiCandidates = extractPriceAlertCandidates('RBRK 120, PLTR 135\nCCJ 55');
    expect(multiCandidates).toHaveLength(3);
    expect(multiCandidates.map((c) => c.symbol)).toEqual(['RBRK', 'PLTR', 'CCJ']);
    expect(multiCandidates.map((c) => c.targetPrice)).toEqual([120, 135, 55]);
  });

  it('ignores non-ticker words and casual notes', () => {
    const noiseCandidates = extractPriceAlertCandidates('Meeting at 10:30 AM today for 5 people');
    expect(noiseCandidates).toHaveLength(0);

    const casualCandidates = extractPriceAlertCandidates('The market sentiment is very bullish today');
    expect(casualCandidates).toHaveLength(0);
  });

  it('automatically creates active PriceAlert in database via autoCreateAlertsFromText', async () => {
    const mockCreatedAlerts: any[] = [];
    const mockPrisma: any = {
      priceAlert: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const alert = { id: `alert-${Date.now()}`, ...data };
          mockCreatedAlerts.push(alert);
          return alert;
        }),
      },
    };

    const results = await autoCreateAlertsFromText(mockPrisma, 'RBRK 120', 'Telegram Note');
    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('RBRK');
    expect(results[0].targetPrice).toBe(120);
    expect(mockPrisma.priceAlert.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.priceAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        symbol: 'RBRK',
        targetPrice: 120,
        status: 'ACTIVE',
      }),
    });
  });

  it('does not create duplicate active alert if identical alert exists', async () => {
    const existingAlert = {
      id: 'alert-existing-1',
      symbol: 'RBRK',
      targetPrice: 120,
      condition: 'ABOVE',
      status: 'ACTIVE',
      notes: 'Existing',
    };

    const mockPrisma: any = {
      priceAlert: {
        findFirst: vi.fn().mockResolvedValue(existingAlert),
        create: vi.fn(),
      },
    };

    const results = await autoCreateAlertsFromText(mockPrisma, 'RBRK above 120');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('alert-existing-1');
    expect(mockPrisma.priceAlert.create).not.toHaveBeenCalled();
  });
});
