import { describe, it, expect, vi, beforeEach } from 'vitest';
import zlib from 'zlib';
import {
  fetchComprehensiveReportData,
  generateExecutivePdfBuffer,
  sendPdfReportToTelegram,
  ExecutiveReportData,
} from '../../server/services/telegramReportService';

describe('Telegram PDF Executive Report & Dispatcher Service', () => {
  const mockReportData: ExecutiveReportData = {
    generatedAt: new Date('2026-08-27T10:00:00Z'),
    reportTitle: 'TradeFlow Executive Portfolio & Market Briefing',
    portfolio: {
      totalValue: 285450.75,
      totalUnrealizedPL: 34210.5,
      totalUnrealizedPLPercent: 13.6,
      totalDayPL: 1820.25,
      equitiesCount: 8,
      optionsCount: 4,
      brokersCount: 2,
      holdings: [
        {
          symbol: 'PLTR',
          assetType: 'EQUITY',
          quantity: 200,
          currentPrice: 124.5,
          marketValue: 24900,
          unrealizedPL: 4500,
          unrealizedPLPercent: 22.05,
          brokerName: 'Interactive Brokers',
        },
        {
          symbol: 'NVDA 260918P00115000',
          assetType: 'OPTION',
          quantity: -2,
          currentPrice: 3.4,
          marketValue: -680,
          unrealizedPL: -220,
          unrealizedPLPercent: -47.8,
          strikePrice: 115,
          expiryDate: '20260918',
          optionType: 'PUT',
          brokerName: 'Tastytrade',
        },
      ],
    },
    defensePositions: [
      {
        symbol: 'NVDA 260918P00115000',
        underlyingSymbol: 'NVDA',
        optionType: 'PUT',
        strikePrice: 115,
        expiryDate: '20260918',
        daysToExpiry: 22,
        quantity: -2,
        unrealizedPL: -220,
        unrealizedPLPercent: -47.8,
        currentUnderlyingPrice: 118.5,
        threatLevel: 'HIGH',
        threatReason: 'Within 3.0% buffer of strike price.',
        suggestedAction: 'Monitor gamma; consider rolling to lower strike for credit.',
      },
    ],
    topDipBuys: [
      {
        symbol: 'CCJ',
        name: 'Cameco Corporation',
        currentPrice: 48.5,
        dayChange: -1.2,
        dayChangePercent: -2.4,
        fiftyTwoWeekHigh: 58.2,
        fiftyTwoWeekLow: 37.1,
        distanceFrom52WHigh: -16.6,
        volume: 3500000,
        avgVolume: 2800000,
        volumeMultiplier: 1.25,
        sector: 'Energy / Nuclear',
        source: 'WATCHLIST',
        heuristicSignal: {
          relativeDropVsMarket: -2.1,
          potentialDriver: 'LIKELY_VOLATILITY',
          preliminaryOpportunityScore: 84,
        },
        scoreBreakdown: {
          totalScore: 88,
          valuationScore: 22,
          fundamentalScore: 24,
          technicalScore: 16,
          driverScore: 13,
          portfolioFitScore: 13,
          targetUpsidePercent: 28.5,
          targetPrice: 62.3,
          forwardPE: 24.5,
          trailingPE: 32.1,
          pegRatio: 1.15,
          freeCashflow: 650000000,
          debtToEquity: 0.22,
          operatingMargins: 0.28,
          valuationGrade: 'UNDERVALUED',
          fundamentalGrade: 'PRISTINE',
          technicalSetup: 'DEEP_VALUE_SUPPORT',
          analystRating: 'STRONG_BUY',
          highlightBadges: ['Baseload Nuclear Demand', 'Free Cash Flow Ramp'],
        },
      },
    ],
    alerts: {
      triggered: [
        {
          id: 'alert-1',
          symbol: 'PLTR',
          targetPrice: 120.0,
          condition: 'BELOW',
          note: 'Key support level buy trigger',
          status: 'TRIGGERED',
          triggeredAt: '2026-08-27T08:30:00Z',
        },
      ],
      activeCount: 6,
    },
    macro: {
      regimeTitle: 'Late-Cycle Disinflation & Policy Normalization',
      regimeTone: 'neutral',
      macroScore: 72,
      vixLevel: 15.4,
      yield10y: 4.35,
      spread2y10y: 0.32,
      dxyLevel: 103.8,
      oilPrice: 71.8,
      sp500Price: 5860,
      executiveSummary:
        'The macroeconomic landscape is anchored by disinflationary momentum and central bank rate cuts.',
      keyTakeaways: [
        'Monetary policy easing provides supportive liquidity for high-quality balance sheets.',
        'Yield curve normalisation favors mid-duration fixed income and defensive equities.',
        'Volatility regime remains controlled, creating favorable options premium selling conditions.',
      ],
    },
  };

  it('should compile comprehensive report data structure with all 5 core sections', async () => {
    const data = await fetchComprehensiveReportData();

    expect(data).toBeDefined();
    expect(data.portfolio).toBeDefined();
    expect(typeof data.portfolio.totalValue).toBe('number');
    expect(Array.isArray(data.defensePositions)).toBe(true);
    expect(Array.isArray(data.topDipBuys)).toBe(true);
    expect(data.alerts).toBeDefined();
    expect(typeof data.alerts.activeCount).toBe('number');
    expect(data.macro).toBeDefined();
    expect(typeof data.macro.vixLevel).toBe('number');
  }, 30000);

  it('should generate a valid binary PDF document Buffer with proper header signature', async () => {
    const buffer = await generateExecutivePdfBuffer(mockReportData);

    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000); // Standard multi-page PDF is > 1KB

    // Check PDF magic header %PDF-1.
    const headerString = buffer.subarray(0, 8).toString('utf-8');
    expect(headerString).toContain('%PDF-');

    // Check PDF metadata
    const rawBinary = buffer.toString('binary');
    expect(rawBinary).toContain('TradeFlow Executive Portfolio & Market Briefing');
    expect(rawBinary).toContain('PDFKit');
  });

  it('should format multipart/form-data and send document to Telegram endpoint', async () => {
    const originalFetch = global.fetch;

    // Mock fetch for Telegram sendDocument API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        result: {
          message_id: 9942,
          chat: { id: 8755167543, type: 'private' },
          document: { file_name: 'TradeFlow_Briefing.pdf', file_size: 15420 },
        },
      }),
    } as any);

    try {
      const dummyPdfBuffer = Buffer.from('%PDF-1.4 dummy content %%EOF');
      process.env.TELEGRAM_BOT_TOKEN = 'mock-bot-token';
      process.env.TELEGRAM_CHAT_ID = '8755167543';

      const result = await sendPdfReportToTelegram(dummyPdfBuffer, 'Test_Report.pdf', 'Test Caption');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(9942);
      expect(global.fetch).toHaveBeenCalled();

      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[0]).toContain('https://api.telegram.org/botmock-bot-token/sendDocument');
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].body).toBeInstanceOf(FormData);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should throw an informative error if Telegram credentials are missing', async () => {
    const savedToken = process.env.TELEGRAM_BOT_TOKEN;
    const savedChat = process.env.TELEGRAM_CHAT_ID;

    try {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;

      const dummyPdfBuffer = Buffer.from('%PDF-1.4 dummy');
      await expect(sendPdfReportToTelegram(dummyPdfBuffer)).rejects.toThrow(
        /Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID/
      );
    } finally {
      if (savedToken) process.env.TELEGRAM_BOT_TOKEN = savedToken;
      if (savedChat) process.env.TELEGRAM_CHAT_ID = savedChat;
    }
  });
});
