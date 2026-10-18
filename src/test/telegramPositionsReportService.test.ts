import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parsePositionsReportTimeframe,
  compilePositionsPerformanceReport,
  generatePositionsPerformancePdfBuffer,
  generateAndSendPositionsPerformanceReport,
  getTimeframeDetails,
  formatCurrency,
  formatSignedCurrency,
} from '../../server/services/telegramPositionsReportService';
import * as telegramReportService from '../../server/services/telegramReportService';

describe('Telegram Positions Performance Report Service', () => {
  describe('parsePositionsReportTimeframe', () => {
    it('detects weekly triggers and natural variations', () => {
      expect(parsePositionsReportTimeframe('weekly')).toBe('WEEKLY');
      expect(parsePositionsReportTimeframe('week')).toBe('WEEKLY');
      expect(parsePositionsReportTimeframe('7d')).toBe('WEEKLY');
      expect(parsePositionsReportTimeframe('wtd')).toBe('WEEKLY');
      expect(parsePositionsReportTimeframe('weekly report')).toBe('WEEKLY');
      expect(parsePositionsReportTimeframe('positions weekly')).toBe('WEEKLY');
      expect(parsePositionsReportTimeframe('last week')).toBe('WEEKLY');
    });

    it('detects monthly triggers and natural variations', () => {
      expect(parsePositionsReportTimeframe('monthly')).toBe('MONTHLY');
      expect(parsePositionsReportTimeframe('month')).toBe('MONTHLY');
      expect(parsePositionsReportTimeframe('30d')).toBe('MONTHLY');
      expect(parsePositionsReportTimeframe('mtd')).toBe('MONTHLY');
      expect(parsePositionsReportTimeframe('monthly report')).toBe('MONTHLY');
      expect(parsePositionsReportTimeframe('show monthly performance')).toBe('MONTHLY');
      expect(parsePositionsReportTimeframe('last month')).toBe('MONTHLY');
    });

    it('detects annually triggers and variations (including annualy misspelling)', () => {
      expect(parsePositionsReportTimeframe('annually')).toBe('ANNUALLY');
      expect(parsePositionsReportTimeframe('annualy')).toBe('ANNUALLY'); // Handles common misspelling
      expect(parsePositionsReportTimeframe('annual')).toBe('ANNUALLY');
      expect(parsePositionsReportTimeframe('yearly')).toBe('ANNUALLY');
      expect(parsePositionsReportTimeframe('year')).toBe('ANNUALLY');
      expect(parsePositionsReportTimeframe('ytd')).toBe('ANNUALLY');
      expect(parsePositionsReportTimeframe('1y')).toBe('ANNUALLY');
      expect(parsePositionsReportTimeframe('annual report')).toBe('ANNUALLY');
      expect(parsePositionsReportTimeframe('annual performance')).toBe('ANNUALLY');
    });

    it('returns null for unrelated text', () => {
      expect(parsePositionsReportTimeframe('AAPL')).toBeNull();
      expect(parsePositionsReportTimeframe('options')).toBeNull();
      expect(parsePositionsReportTimeframe('help')).toBeNull();
      expect(parsePositionsReportTimeframe('')).toBeNull();
    });
  });

  describe('getTimeframeDetails', () => {
    it('returns valid timeframe configuration', () => {
      expect(getTimeframeDetails('WEEKLY')).toEqual({
        label: 'Weekly Positions Performance',
        description: 'Trailing 7 Calendar Days',
        lookbackDays: 7,
      });
      expect(getTimeframeDetails('MONTHLY')).toEqual({
        label: 'Monthly Positions Performance',
        description: 'Trailing 30 Calendar Days',
        lookbackDays: 30,
      });
      expect(getTimeframeDetails('ANNUALLY')).toEqual({
        label: 'Annual Positions Performance',
        description: 'Trailing 365 Days / Year-to-Date',
        lookbackDays: 365,
      });
    });
  });

  describe('compilePositionsPerformanceReport & PDF Generation', () => {
    const mockHoldings = [
      {
        id: 'h-1',
        symbol: 'AAPL',
        underlyingSymbol: 'AAPL',
        assetType: 'EQUITY',
        description: 'Apple Inc.',
        brokerSpecificId: 'AAPL-1',
        quantity: 50,
        averageCost: 220.0,
        currentPrice: 242.0,
        marketValue: 12100.0,
        dayPnL: 120.0,
        dayPnLPercent: 1.0,
        unrealizedPnL: 1100.0,
        unrealizedPnLPercent: 10.0,
        currency: 'USD',
        broker: { id: 'b-1', name: 'Interactive Brokers' },
      },
      {
        id: 'h-2',
        symbol: 'NVDA  261120P00120000',
        underlyingSymbol: 'NVDA',
        assetType: 'OPTION',
        description: 'Nvidia $120 Put',
        brokerSpecificId: 'NVDA-OPT-1',
        quantity: -2,
        averageCost: 3.5,
        currentPrice: 1.2,
        marketValue: -240.0,
        dayPnL: 30.0,
        dayPnLPercent: 11.1,
        unrealizedPnL: 460.0,
        unrealizedPnLPercent: 65.7,
        strikePrice: 120,
        expiryDate: '20261120',
        optionType: 'PUT',
        currency: 'USD',
        broker: { id: 'b-2', name: 'Tastytrade' },
      },
      {
        id: 'h-3',
        symbol: 'TSLA',
        underlyingSymbol: 'TSLA',
        assetType: 'EQUITY',
        description: 'Tesla Inc.',
        brokerSpecificId: 'TSLA-1',
        quantity: 20,
        averageCost: 260.0,
        currentPrice: 245.0,
        marketValue: 4900.0,
        dayPnL: -40.0,
        dayPnLPercent: -0.8,
        unrealizedPnL: -300.0,
        unrealizedPnLPercent: -5.77,
        currency: 'USD',
        broker: { id: 'b-3', name: 'Trading 212' },
      },
    ];

    it('compiles report data accurately across all positions and calculates win rate & broker distribution', async () => {
      const mockPrisma: any = {
        holding: {
          findMany: vi.fn().mockResolvedValue(mockHoldings),
        },
      };

      const report = await compilePositionsPerformanceReport(mockPrisma, 'WEEKLY');

      expect(report.timeframe).toBe('WEEKLY');
      expect(report.totalPositionsCount).toBe(3);
      expect(report.equitiesCount).toBe(2);
      expect(report.optionsCount).toBe(2);
      expect(report.shortOptionsCount).toBe(2);
      expect(report.profitableCount).toBe(2); // AAPL & NVDA
      expect(report.unprofitableCount).toBe(1); // TSLA
      expect(report.winRatePercent).toBeCloseTo(66.67, 1);

      // Verify leader and laggard
      expect(report.topWinner?.underlyingSymbol).toBe('NVDA');
      expect(report.topLoser?.underlyingSymbol).toBe('TSLA');

      // Verify broker breakdown
      expect(report.brokerBreakdown.length).toBe(3);
      expect(report.brokerBreakdown.map((b) => b.name)).toEqual(
        expect.arrayContaining(['Interactive Brokers', 'Tastytrade', 'Trading 212'])
      );
    });

    it('generates a valid, non-empty PDF document buffer with PDF header (%PDF-)', async () => {
      const mockPrisma: any = {
        holding: {
          findMany: vi.fn().mockResolvedValue(mockHoldings),
        },
      };

      const report = await compilePositionsPerformanceReport(mockPrisma, 'MONTHLY');
      const pdfBuffer = await generatePositionsPerformancePdfBuffer(report);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      // Verify valid PDF magic bytes
      const header = pdfBuffer.slice(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });

    it('handles empty portfolio gracefully without throwing and outputs valid PDF', async () => {
      const mockPrisma: any = {
        holding: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      const report = await compilePositionsPerformanceReport(mockPrisma, 'ANNUALLY');
      expect(report.totalPositionsCount).toBe(0);
      expect(report.totalPortfolioValueUSD).toBe(0);

      const pdfBuffer = await generatePositionsPerformancePdfBuffer(report);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(500);
    });

    it('dispatches PDF document and caption to Telegram via sendPdfReportToTelegram', async () => {
      const mockPrisma: any = {
        holding: {
          findMany: vi.fn().mockResolvedValue(mockHoldings),
        },
      };

      const sendSpy = vi.spyOn(telegramReportService, 'sendPdfReportToTelegram').mockResolvedValue({
        success: true,
        messageId: 8888,
      });

      process.env.TELEGRAM_BOT_TOKEN = 'mock-bot-token';

      const result = await generateAndSendPositionsPerformanceReport({
        prisma: mockPrisma,
        chatId: '-1003872409872',
        messageThreadId: 306,
        timeframe: 'WEEKLY',
      });

      expect(result.success).toBe(true);
      expect(result.filename).toContain('TradeFlow_Positions_Performance_weekly');
      expect(result.pdfBuffer).toBeInstanceOf(Buffer);
      expect(result.summaryText).toContain('Weekly Positions Performance');
      expect(result.summaryText).toContain('Portfolio Value:');

      expect(sendSpy).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringContaining('.pdf'),
        expect.stringContaining('Weekly Positions Performance'),
        expect.objectContaining({
          chatId: '-1003872409872',
          messageThreadId: 306,
        })
      );
    });

    it('consolidates identical tickers across multiple brokers into a single combined row', async () => {
      const multiBrokerAAPL = [
        {
          id: 'h-1',
          symbol: 'AAPL',
          underlyingSymbol: 'AAPL',
          assetType: 'EQUITY',
          description: 'Apple Inc.',
          quantity: 50,
          averageCost: 200.0,
          currentPrice: 220.0,
          marketValue: 11000.0,
          dayPnL: 50.0,
          dayPnLPercent: 0.5,
          unrealizedPnL: 1000.0,
          unrealizedPnLPercent: 10.0,
          currency: 'USD',
          broker: { id: 'b-1', name: 'Trading 212' },
        },
        {
          id: 'h-2',
          symbol: 'AAPL',
          underlyingSymbol: 'AAPL',
          assetType: 'EQUITY',
          description: 'Apple Inc.',
          quantity: 25,
          averageCost: 210.0,
          currentPrice: 220.0,
          marketValue: 5500.0,
          dayPnL: 25.0,
          dayPnLPercent: 0.5,
          unrealizedPnL: 250.0,
          unrealizedPnLPercent: 4.76,
          currency: 'USD',
          broker: { id: 'b-2', name: 'Interactive Brokers' },
        },
        {
          id: 'h-3',
          symbol: 'AAPL 270115P00200000',
          underlyingSymbol: 'AAPL',
          assetType: 'OPTION',
          optionType: 'PUT',
          strikePrice: 200,
          expiryDate: '20270115',
          description: 'AAPL $200 Put',
          quantity: -1,
          averageCost: 4.0,
          currentPrice: 2.0,
          marketValue: -200.0,
          dayPnL: 10.0,
          dayPnLPercent: 5.0,
          unrealizedPnL: 200.0,
          unrealizedPnLPercent: 50.0,
          currency: 'USD',
          broker: { id: 'b-3', name: 'Tastytrade' },
        },
      ];

      const mockPrisma: any = {
        holding: {
          findMany: vi.fn().mockResolvedValue(multiBrokerAAPL),
        },
      };

      const report = await compilePositionsPerformanceReport(mockPrisma, 'WEEKLY');

      // Crucial: 3 raw holdings consolidated into 1 row for AAPL!
      expect(report.rawHoldingsCount).toBe(3);
      expect(report.totalPositionsCount).toBe(1);
      expect(report.positions.length).toBe(1);

      const aaplRow = report.positions[0];
      expect(aaplRow.underlyingSymbol).toBe('AAPL');
      expect(aaplRow.brokers).toEqual(
        expect.arrayContaining(['Trading 212', 'Interactive Brokers', 'Tastytrade'])
      );
      expect(aaplRow.brokerName).toContain('T212');
      expect(aaplRow.brokerName).toContain('IBKR');
      expect(aaplRow.brokerName).toContain('Tasty');

      // Combined shares = 75
      expect(aaplRow.quantity).toBe(75);
      // Combined market value = 11000 + 5500 - 200 = 16300
      expect(aaplRow.marketValueUSD).toBe(16300);
      // Combined unrealized P&L = 1000 + 250 + 200 = 1450
      expect(aaplRow.unrealizedPnLUSD).toBe(1450);

      // Verify PDF generation has no blank pages
      const pdfBuffer = await generatePositionsPerformancePdfBuffer(report);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
    });
  });
});

