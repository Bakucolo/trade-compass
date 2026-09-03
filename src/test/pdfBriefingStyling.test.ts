import { describe, it, expect } from 'vitest';
import {
  formatOptionExpiryDate,
  generateExecutivePdfBuffer,
  ExecutiveReportData,
} from '../../server/services/telegramReportService';

describe('PDF Briefing Styling & Formatting', () => {
  describe('formatOptionExpiryDate', () => {
    it('formats 8-digit YYYYMMDD dates into clean readable strings', () => {
      expect(formatOptionExpiryDate('20260918')).toBe('Sep 18, 2026');
      expect(formatOptionExpiryDate('20261016')).toBe('Oct 16, 2026');
      expect(formatOptionExpiryDate('20270115')).toBe('Jan 15, 2027');
    });

    it('formats 6-digit YYMMDD OCC option symbol dates into clean readable strings', () => {
      expect(formatOptionExpiryDate('260918')).toBe('Sep 18, 2026');
      expect(formatOptionExpiryDate('261120')).toBe('Nov 20, 2026');
    });

    it('formats ISO dates into clean readable strings', () => {
      expect(formatOptionExpiryDate('2026-09-18')).toBe('Sep 18, 2026');
      expect(formatOptionExpiryDate('2026-09-18T00:00:00.000Z')).toBe('Sep 18, 2026');
    });

    it('handles empty, null, or unknown date gracefully', () => {
      expect(formatOptionExpiryDate(null)).toBe('N/A');
      expect(formatOptionExpiryDate(undefined)).toBe('N/A');
      expect(formatOptionExpiryDate('')).toBe('N/A');
      expect(formatOptionExpiryDate('PERPETUAL')).toBe('PERPETUAL');
    });
  });

  describe('generateExecutivePdfBuffer page count & layout', () => {
    it('generates exactly 2 pages with 0 blank pages and valid PDF structure', async () => {
      const mockReportData: ExecutiveReportData = {
        generatedAt: new Date('2026-09-03T10:00:00Z'),
        reportTitle: 'TradeFlow Executive Portfolio & Market Briefing',
        portfolio: {
          totalValue: 154200,
          currency: 'USD',
          cashBalance: 42000,
          unrealizedPnL: 8400,
          positionsCount: 12,
          positions: [],
        },
        defensePositions: [
          {
            symbol: 'PLTR  260918P00030000',
            underlyingSymbol: 'PLTR',
            optionType: 'PUT',
            strikePrice: 30,
            expiryDate: '20260918',
            daysToExpiry: 15,
            quantity: -2,
            unrealizedPL: 140,
            unrealizedPLPercent: 28,
            currentUnderlyingPrice: 33.2,
            threatLevel: 'HIGH',
            threatReason: 'Strike proximity within 10%',
            suggestedAction: 'Prepare roll to wider strike before gamma ramp.',
          },
          {
            symbol: 'TSLA  261016C00250000',
            underlyingSymbol: 'TSLA',
            optionType: 'CALL',
            strikePrice: 250,
            expiryDate: '20261016',
            daysToExpiry: 43,
            quantity: -1,
            unrealizedPL: -320,
            unrealizedPLPercent: -18,
            currentUnderlyingPrice: 242.5,
            threatLevel: 'MODERATE',
            threatReason: 'Approaching resistance',
            suggestedAction: 'Monitor underlying resistance at $245.',
          },
        ],
        topDipBuys: [
          {
            symbol: 'NVDA',
            name: 'NVIDIA Corporation',
            currentPrice: 224.41,
            distanceFrom52WHigh: -5.2,
            sector: 'Technology',
            scoreBreakdown: { totalScore: 88, technicalSetup: 'SUPPORT_REBOUND' },
          },
        ],
        alerts: {
          triggered: [
            {
              id: 'a1',
              symbol: 'LUNR',
              targetPrice: 15,
              condition: 'BELOW',
              note: 'Take profit level',
              status: 'TRIGGERED',
            },
          ],
          activeCount: 14,
        },
        macro: {
          regimeTitle: 'LATE EXPANSION',
          regimeTone: 'neutral',
          macroScore: 78,
          vixLevel: 15.2,
          yield10y: 4.25,
          spread2y10y: 0.15,
          dxyLevel: 103.5,
          oilPrice: 74.2,
          sp500Price: 5880,
          executiveSummary:
            'Economy displaying robust resilient consumer demand and contained financial distress.',
          keyTakeaways: [
            'Maintain long equity core exposure tilted toward cash-generative technology.',
            'Actively hedge short volatility and covered call books.',
            'Capitalize on extreme dip-buying signals on quality dividend aristocrats.',
          ],
        },
      };

      const pdfBuffer = await generateExecutivePdfBuffer(mockReportData);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(4000);

      const pdfString = pdfBuffer.toString('latin1');

      // 1. Valid PDF header and trailer
      expect(pdfString.startsWith('%PDF-')).toBe(true);
      expect(pdfString).toContain('%%EOF');

      // 2. Verify the PDF has exactly 2 pages (zero blank overflow pages)
      const countMatch = pdfString.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
      const totalPages = countMatch ? parseInt(countMatch[1], 10) : 0;
      expect(totalPages).toBe(2);

      const pageObjects = pdfString.match(/\/Type\s*\/Page\b/g);
      expect(pageObjects?.length).toBe(2);

      // 3. Document metadata inspection
      expect(pdfString).toContain('TradeFlow Executive Portfolio & Market Briefing');
      expect(pdfString).toContain('Institutional Portfolio & Market Briefing');
      expect(pdfString).toContain('TradeFlow AI Executive Intelligence');
    });
  });
});
