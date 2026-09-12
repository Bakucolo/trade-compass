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

  it('ignores narrative analysis and does not extract false positives like XCEEDS, OACHES, CLOSE, FINAL, GAINS, A', () => {
    const sentences = [
      'Roll down & out if stock approaches $145 (delta rising toward 30)',
      'Stop-loss: If unrealized loss exceeds 2× premium collected',
      'Time decay works in seller\'s favor; accelerates in final 30 days',
      'Close at 21 DTE to avoid gamma risk acceleration',
      'remains profitable if PLTR closes above the breakeven at expiration',
      'Calculated as roughly 2 × Delta for a touch probability approximation',
      'Position gains $0.20 per $1 decline in PLTR (bullish bias)',
      'A 20-delta PLTR short put offers an ~80% probability of profit',
      'CALX short put top line growth 15% 22 forward PE',
      'MDB AI winner 30% growth, expensive, alert 1 year out',
      'AEHR 40-50 short put, 200% growth, forward EPS 0.75'
    ];

    for (const s of sentences) {
      const candidates = extractPriceAlertCandidates(s);
      expect(candidates).toHaveLength(0);
    }
  });

  it('rejects full financial analysis / Copilot markdown reports without explicit alert directives', () => {
    const copilotReport = `
### Financial Inquiry
> provide metrics and probabilities of a 20 delta PLTR short put
**AI Model**: \`inclusionai/ling-3.0-flash-fin:free\` • **Timestamp**: 00:26
---
### Copilot Analysis
# 20-Delta PLTR Short Put: Comprehensive Metrics & Probabilities
## Current Market Context
| Metric | Value |
|--------|-------|
| **PLTR Spot Price** | $174.33 |
| **52-Week Range** | $106.37 – $207.52 |
| **Trailing P/E** | 149.0x |
| **Forward P/E** | 74.9x |
| **Implied Volatility (Nov 2026)** | ~76% |
| **IV Percentile** | Elevated (earnings-driven spikes to ~88%) |
| **Max Pain (Nov 20)** | ~$170 |
---
## Identifying the 20-Delta Strike by Expiration
| Expiration | Days to Expiry | 20-Delta Strike | Approx. Premium |
|------------|---------------|-----------------|-----------------|
| **Sep 11, 2026** | ~13 days | **~$156** | ~$3.00 |
| **Oct 16, 2026** | ~45 days | **~$144** | ~$5.90 |
| **Nov 20, 2026** | ~120 days | **~$133** | ~$10.70 |
---
## Core Probability Metrics
### 1. **Probability of Expiring In-The-Money (ITM)**
- **≈ 20%**
### 2. **Probability of Profit (POP)**
- **≈ 80%**
### 3. **Probability of Touching Strike (POT)**
- **≈ 35–40%**
- Calculated as roughly 2 × Delta
### 4. **Probability of Maximum Loss**
- **≈ 20%**
- Tail risk: stock below breakeven ($133 – $10.70 = **$122.30**)
---
## Management Rules
- Take profit at 50% of max premium (~$5.35)
- Roll down & out if stock approaches $145 (delta rising toward 30)
- Close at 21 DTE to avoid gamma risk acceleration
- Stop-loss: If unrealized loss exceeds 2× premium collected
    `;

    const candidates = extractPriceAlertCandidates(copilotReport);
    expect(candidates).toHaveLength(0);
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
