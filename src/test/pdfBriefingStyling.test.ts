import { describe, it, expect } from 'vitest';
import zlib from 'zlib';
import {
  parseOptionExpiryDate,
  formatOptionExpiryDate,
  generateExecutivePdfBuffer,
  ExecutiveReportData,
} from '../../server/services/telegramReportService';

describe('PDF Briefing Styling & Formatting', () => {
  describe('parseOptionExpiryDate & formatOptionExpiryDate', () => {
    it('accurately parses 8-digit YYYYMMDD dates', () => {
      const dt = parseOptionExpiryDate('20261016');
      expect(dt).not.toBeNull();
      expect(dt?.getFullYear()).toBe(2026);
      expect(dt?.getMonth()).toBe(9); // Oct is 9
      expect(dt?.getDate()).toBe(16);
    });

    it('accurately parses 6-digit OCC symbol dates', () => {
      const dt = parseOptionExpiryDate('261120');
      expect(dt).not.toBeNull();
      expect(dt?.getFullYear()).toBe(2026);
      expect(dt?.getMonth()).toBe(10); // Nov is 10
      expect(dt?.getDate()).toBe(20);
    });

    it('accurately parses ISO dates', () => {
      const dt = parseOptionExpiryDate('2027-01-15T21:00:00.000Z');
      expect(dt).not.toBeNull();
      expect(dt?.getFullYear()).toBe(2027);
    });

    it('identifies expired dates in the past vs future', () => {
      const today = new Date('2026-10-03T12:00:00Z');
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

      const expired = parseOptionExpiryDate('20260821');
      expect(expired).not.toBeNull();
      const expiredStart = new Date(expired!.getFullYear(), expired!.getMonth(), expired!.getDate()).getTime();
      expect(expiredStart < todayStart).toBe(true);

      const active = parseOptionExpiryDate('20261016');
      expect(active).not.toBeNull();
      const activeStart = new Date(active!.getFullYear(), active!.getMonth(), active!.getDate()).getTime();
      expect(activeStart >= todayStart).toBe(true);
    });

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
          totalUnrealizedPL: 8400,
          totalUnrealizedPLPercent: 5.76,
          totalDayPL: 1200,
          equitiesCount: 8,
          optionsCount: 4,
          brokersCount: 2,
          holdings: [],
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
            dayChange: -2.1,
            dayChangePercent: -0.9,
            fiftyTwoWeekHigh: 235.0,
            fiftyTwoWeekLow: 110.0,
            distanceFrom52WHigh: -5.2,
            volume: 5000000,
            avgVolume: 4500000,
            volumeMultiplier: 1.1,
            sector: 'Technology',
            source: 'WATCHLIST',
            heuristicSignal: {
              relativeDropVsMarket: -1.5,
              potentialDriver: 'VOLATILITY_DRIVEN',
              preliminaryOpportunityScore: 88,
            },
            scoreBreakdown: { totalScore: 88, technicalSetup: 'SUPPORT_REBOUND' } as any,
          },
        ],
        alerts: {
          triggered: [
            {
              id: 'a1',
              symbol: 'OUST',
              targetPrice: 21,
              condition: 'BELOW',
              note: '[Short Option 5% Defense] OUST $20 PUT - Approaching strike',
              status: 'TRIGGERED',
              currentPrice: 20.4,
            },
          ],
          activeCount: 156,
        },
        macro: {
          regimeTitle: 'Late-Cycle Disinflation & Policy Normalization',
          regimeTone: 'neutral',
          macroScore: 78,
          growthOutlook: 'MODERATING',
          inflationRegime: 'DISINFLATION',
          monetaryPolicyPosture: 'DOVISH_EASING',
          liquidityCondition: 'EXPANDING',
          vixLevel: 15.2,
          yield10y: 4.25,
          yield2y: 4.05,
          spread2y10y: 0.20,
          fedFundsRate: 4.83,
          highYieldSpread: 3.12,
          dxyLevel: 103.5,
          oilPrice: 74.2,
          goldPrice: 2685.0,
          sp500Price: 5880,
          executiveSummary:
            'Economy displaying robust resilient consumer demand and contained financial distress alongside central bank rate normalization.',
          keyTakeaways: [
            'Maintain long equity core exposure tilted toward cash-generative technology.',
            'Actively hedge short volatility and covered call books.',
            'Capitalize on extreme dip-buying signals on quality dividend aristocrats.',
          ],
          tacticalAllocations: [
            { category: 'Equities & Core Growth', subAsset: 'AI Power & Cloud', stance: 'OVERWEIGHT', rationale: 'Secular infrastructure power demand.' },
            { category: 'Fixed Income & Duration', subAsset: '4-6y Treasuries', stance: 'NEUTRAL', rationale: 'Disinflation yield roll-down.' },
            { category: 'Real Assets & Gold', subAsset: 'Physical Gold', stance: 'OVERWEIGHT', rationale: 'Central bank de-dollarization.' },
            { category: 'Options & Hedging', subAsset: 'Theta Harvesting', stance: 'TACTICAL_HEDGE', rationale: 'Subdued VIX option premium capture.' },
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

      // 4. Decode hex tokens and normalize kerning/whitespace to verify content
      const decodedPdfText = pdfString.replace(/<([0-9a-fA-F]+)>/g, (_, hex) => {
        try {
          return Buffer.from(hex, 'hex').toString('latin1');
        } catch {
          return '';
        }
      });
      const normalized = decodedPdfText.replace(/-?\d+(\.\d+)?/g, '').replace(/[^A-Za-z0-9%&\/-]/g, '').toUpperCase();

      // Verify enriched Section 3 Triggered Alerts & Proximity Warnings
      expect(normalized).toContain('TRIGGERED&ACTIVECRITICALPROXIMITYALERTS');
      expect(normalized).toContain('TRIGGERED/ACTIVERULES');
      expect(normalized).toContain('CRITICAL');

      // Verify enhanced Page 2 Macro Dossier
      expect(normalized).toContain('GLOBALMACROENVIRONMENT&MULTI-ASSETDOSSIER');
      expect(normalized).toContain('TACTICALMULTI-ASSETALLOCATION');
      expect(normalized).toContain('ECONOMICCYCLESIGNALS');
    });
  });
});
