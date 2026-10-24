import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleCalendarTopicMessage,
  checkAndDispatchEarningsReminders,
  formatCalendarScheduleMessage,
  formatSingleTickerEarningsMessage,
  generateCalendarDossierPdf,
  hasReminderBeenSent,
  markReminderAsSent,
  clearRemindersCacheForTesting,
} from '../../server/services/telegramCalendarTopicService';
import {
  topicNameByThreadId,
  setTelegramCalendarThreadId,
  getTelegramBufferStatus,
} from '../../server/services/telegramBufferConsumerService';
import { setGenericTopicThreadId } from '../../server/services/telegramTopicsManagementService';
import { getCalendarTopicHelp } from '../../server/services/telegramTopicHelpService';
import * as telegramReportService from '../../server/services/telegramReportService';
import * as earningsService from '../../server/services/earningsService';

describe('Telegram Calendar Topic & Earnings Reminders Suite', () => {
  let mockPrisma: any;
  let sentMessages: any[] = [];
  let sentPdfs: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    clearRemindersCacheForTesting();
    sentMessages = [];
    sentPdfs = [];

    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token_123';
    process.env.TELEGRAM_CALENDAR_THREAD_ID = '607';
    process.env.TELEGRAM_ALERTS_CHAT_ID = '-1003872409872';

    vi.spyOn(telegramReportService, 'sendTelegramMessage').mockImplementation(async (payload: any) => {
      sentMessages.push(payload);
      return { ok: true, result: { message_id: 999 } };
    });

    vi.spyOn(telegramReportService, 'sendPdfReportToTelegram').mockImplementation(
      async (buf: Buffer, filename: string, caption: string, options: any) => {
        sentPdfs.push({ filename, caption, options, size: buf.length });
        return { ok: true, result: { message_id: 1000 } };
      }
    );

    mockPrisma = {
      holding: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'h1',
            symbol: 'NVDA',
            underlyingSymbol: 'NVDA',
            assetType: 'EQUITY',
            quantity: 50,
            marketValue: 7000,
            unrealizedPnL: 1200,
            broker: { name: 'Interactive Brokers' },
          },
          {
            id: 'h2',
            symbol: 'AAPL',
            underlyingSymbol: 'AAPL',
            assetType: 'EQUITY',
            quantity: 100,
            marketValue: 22000,
            unrealizedPnL: 3500,
            broker: { name: 'Tastytrade' },
          },
        ]),
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          const sym = where?.OR?.[0]?.symbol?.equals;
          if (sym === 'NVDA') {
            return {
              id: 'h1',
              symbol: 'NVDA',
              quantity: 50,
              marketValue: 7000,
              dayPnL: 150,
            };
          }
          return null;
        }),
      },
      earningsReminderLog: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: 'rem-1' }),
      },
    };
  });

  describe('Topic Configuration & Routing', () => {
    it('should map thread 607 to Calendar in topicNameByThreadId', () => {
      expect(topicNameByThreadId.get(607)).toBe('Calendar');
    });

    it('should update TELEGRAM_CALENDAR_THREAD_ID via setTelegramCalendarThreadId', () => {
      const res = setTelegramCalendarThreadId(701);
      expect(res).toBe(true);
      expect(process.env.TELEGRAM_CALENDAR_THREAD_ID).toBe('701');
      expect(topicNameByThreadId.get(701)).toBe('Calendar');

      // Reset back
      setTelegramCalendarThreadId(607);
      expect(process.env.TELEGRAM_CALENDAR_THREAD_ID).toBe('607');
    });

    it('should route setGenericTopicThreadId for calendar and earnings', () => {
      const ok1 = setGenericTopicThreadId('calendar', 607);
      expect(ok1).toBe(true);

      const ok2 = setGenericTopicThreadId('earnings', 607);
      expect(ok2).toBe(true);

      const status = getTelegramBufferStatus();
      expect(status.calendarThreadId).toBe('607');
    });

    it('should return rich instructions in getCalendarTopicHelp', () => {
      const help = getCalendarTopicHelp();
      expect(help).toContain('Calendar Topic — Instructions & Commands');
      expect(help).toContain('1 Week in Advance (7 Days Out)');
      expect(help).toContain('Previous Day (1 Day Out)');
      expect(help).toContain('calendar pdf');
    });
  });

  describe('Interactive Calendar Topic Dispatcher', () => {
    it('should handle help request (? or help)', async () => {
      const result = await handleCalendarTopicMessage({
        text: 'help',
        chatId: '-1003872409872',
        messageThreadId: 607,
        prisma: mockPrisma,
        senderLabel: '@Trader',
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('HELP');
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].text).toContain('Calendar Topic — Instructions & Commands');
      expect(sentMessages[0].messageThreadId).toBe(607);
    });

    it('should return upcoming schedule when sending calendar or list', async () => {
      vi.spyOn(earningsService, 'fetchEarningsData').mockResolvedValueOnce({
        items: [
          {
            symbol: 'NVDA',
            resolvedSymbol: 'NVDA',
            companyName: 'NVIDIA Corporation',
            price: 140,
            dayChangePercent: 2.5,
            currency: 'USD',
            earningsDate: '2026-11-18T21:00:00.000Z',
            earningsDateFormatted: 'Nov 18, 2026',
            daysUntil: 7,
            timing: 'AMC',
            isEstimate: false,
            epsEstimate: 0.75,
            epsLow: 0.7,
            epsHigh: 0.8,
            revenueEstimate: 33000000000,
            revenueLow: null,
            revenueHigh: null,
            exDividendDate: null,
            dividendDate: null,
            isPortfolioHolding: true,
            portfolioMarketValue: 7000,
            portfolioQuantity: 50,
            portfolioDayPnL: 150,
            isWatchlist: false,
          },
        ],
        summary: {
          totalMonitored: 1,
          portfolioCount: 1,
          watchlistCount: 0,
          reportingThisWeek: 1,
          reportingNextWeek: 0,
          reportingThisMonth: 1,
          nextReportingHolding: null,
          totalPortfolioValueAtRisk: 7000,
        },
        timestamp: new Date().toISOString(),
      });

      const result = await handleCalendarTopicMessage({
        text: 'calendar',
        chatId: '-1003872409872',
        messageThreadId: 607,
        prisma: mockPrisma,
        senderLabel: '@Trader',
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('UPCOMING_SCHEDULE');
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].text).toContain('Trade Compass — Portfolio Earnings Calendar');
      expect(sentMessages[0].text).toContain('$NVDA');
      expect(sentMessages[0].text).toContain('in *7d*');
    });

    it('should generate and dispatch an executive PDF when pdf is requested', async () => {
      vi.spyOn(earningsService, 'fetchEarningsData').mockResolvedValueOnce({
        items: [
          {
            symbol: 'AAPL',
            resolvedSymbol: 'AAPL',
            companyName: 'Apple Inc.',
            price: 220,
            dayChangePercent: 1.2,
            currency: 'USD',
            earningsDate: '2026-11-05T21:30:00.000Z',
            earningsDateFormatted: 'Nov 5, 2026',
            daysUntil: 1,
            timing: 'AMC',
            isEstimate: false,
            epsEstimate: 1.6,
            epsLow: 1.55,
            epsHigh: 1.65,
            revenueEstimate: 94000000000,
            revenueLow: null,
            revenueHigh: null,
            exDividendDate: null,
            dividendDate: null,
            isPortfolioHolding: true,
            portfolioMarketValue: 22000,
            portfolioQuantity: 100,
            portfolioDayPnL: 250,
            isWatchlist: false,
          },
        ],
        summary: {
          totalMonitored: 1,
          portfolioCount: 1,
          watchlistCount: 0,
          reportingThisWeek: 1,
          reportingNextWeek: 0,
          reportingThisMonth: 1,
          nextReportingHolding: null,
          totalPortfolioValueAtRisk: 22000,
        },
        timestamp: new Date().toISOString(),
      });

      const result = await handleCalendarTopicMessage({
        text: 'calendar pdf',
        chatId: '-1003872409872',
        messageThreadId: 607,
        prisma: mockPrisma,
        senderLabel: '@Trader',
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('PDF_REPORT');
      expect(result.pdfGenerated).toBe(true);
      expect(sentPdfs.length).toBe(1);
      expect(sentPdfs[0].filename).toContain('TradeCompass_Earnings_Calendar');
      expect(sentPdfs[0].caption).toContain('Portfolio Earnings Calendar Dossier');
    });

    it('should display specific stock earnings catalyst when querying a ticker like NVDA', async () => {
      vi.spyOn(earningsService, 'lookupSymbolEarnings').mockResolvedValueOnce({
        symbol: 'NVDA',
        resolvedSymbol: 'NVDA',
        companyName: 'NVIDIA Corporation',
        price: 140,
        dayChangePercent: 2.1,
        currency: 'USD',
        earningsDate: '2026-11-18T21:00:00.000Z',
        earningsDateFormatted: 'Nov 18, 2026',
        daysUntil: 7,
        timing: 'AMC',
        isEstimate: false,
        epsEstimate: 0.75,
        epsLow: 0.7,
        epsHigh: 0.8,
        revenueEstimate: 33000000000,
        revenueLow: null,
        revenueHigh: null,
        peRatio: 45.2,
        exDividendDate: null,
        dividendDate: null,
        isPortfolioHolding: false,
        isWatchlist: false,
      });

      const result = await handleCalendarTopicMessage({
        text: 'NVDA',
        chatId: '-1003872409872',
        messageThreadId: 607,
        prisma: mockPrisma,
        senderLabel: '@Trader',
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('TICKER_EARNINGS');
      expect(result.symbol).toBe('NVDA');
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].text).toContain('Earnings Catalyst Diagnostic: $NVDA');
      expect(sentMessages[0].text).toContain('NVIDIA Corporation');
      expect(sentMessages[0].text).toContain('Nov 18, 2026');
      expect(sentMessages[0].text).toContain('*EPS Estimate:* $0.75');
    });

    it('should run on-demand scan when sending scan or check', async () => {
      vi.spyOn(earningsService, 'lookupSymbolEarnings').mockImplementation(async (sym: string) => {
        if (sym === 'NVDA') {
          return {
            symbol: 'NVDA',
            resolvedSymbol: 'NVDA',
            companyName: 'NVIDIA Corporation',
            price: 140,
            dayChangePercent: 0,
            currency: 'USD',
            earningsDate: '2026-11-18T00:00:00.000Z',
            earningsDateFormatted: 'Nov 18, 2026',
            daysUntil: 20,
            timing: 'AMC',
            isEstimate: false,
            epsEstimate: 0.75,
            epsLow: null,
            epsHigh: null,
            revenueEstimate: 33000000000,
            revenueLow: null,
            revenueHigh: null,
            exDividendDate: null,
            dividendDate: null,
            isPortfolioHolding: true,
            isWatchlist: false,
          };
        }
        return null;
      });

      const result = await handleCalendarTopicMessage({
        text: 'scan',
        chatId: '-1003872409872',
        messageThreadId: 607,
        prisma: mockPrisma,
        senderLabel: '@Trader',
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('SCAN_DISPATCH');
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].text).toContain('Earnings Reminder Audit Complete');
    });
  });

  describe('Automated 1-Week and 1-Day Earnings Alerts Dispatcher', () => {
    it('should dispatch a 1-Week advance reminder for a position reporting in 7 days', async () => {
      vi.spyOn(earningsService, 'lookupSymbolEarnings').mockImplementation(async (sym: string) => {
        if (sym === 'NVDA') {
          return {
            symbol: 'NVDA',
            resolvedSymbol: 'NVDA',
            companyName: 'NVIDIA Corporation',
            price: 142.5,
            dayChangePercent: 1.5,
            currency: 'USD',
            earningsDate: '2026-11-18T21:00:00.000Z',
            earningsDateFormatted: 'Nov 18, 2026',
            daysUntil: 7,
            timing: 'AMC',
            isEstimate: false,
            epsEstimate: 0.75,
            epsLow: 0.7,
            epsHigh: 0.82,
            revenueEstimate: 34000000000,
            revenueLow: null,
            revenueHigh: null,
            peRatio: 46.0,
            exDividendDate: null,
            dividendDate: null,
            isPortfolioHolding: true,
            isWatchlist: false,
          };
        }
        return null;
      });

      const scanResult = await checkAndDispatchEarningsReminders(
        mockPrisma,
        'mock_bot_token',
        '-1003872409872',
        607
      );

      expect(scanResult.checkedHoldingsCount).toBe(2);
      expect(scanResult.remindersDispatched).toBe(1);
      expect(scanResult.dispatchedList[0]).toContain('NVDA (1-Week: 7d out)');

      // Verify telegram alert dispatched to thread 607
      expect(sentMessages.length).toBe(1);
      const msg = sentMessages[0];
      expect(msg.messageThreadId).toBe(607);
      expect(msg.text).toContain('UPCOMING EARNINGS ALERT — 1 WEEK NOTICE');
      expect(msg.text).toContain('NVIDIA Corporation');
      expect(msg.text).toContain('$NVDA');
      expect(msg.text).toContain('Nov 18, 2026');
      expect(msg.text).toContain('After Market Close (AMC)');
      expect(msg.text).toContain('50 Shares');
      expect(msg.text).toContain('$7,000.00');
      expect(msg.text).toContain('Tactical Considerations (1-Week Window)');

      // Calling again should be deduplicated and not send another message
      const scanResult2 = await checkAndDispatchEarningsReminders(
        mockPrisma,
        'mock_bot_token',
        '-1003872409872',
        607
      );
      expect(scanResult2.remindersDispatched).toBe(0);
      expect(sentMessages.length).toBe(1); // Still 1, no duplicate
    });

    it('should dispatch a 1-Day advance reminder for a position reporting tomorrow', async () => {
      vi.spyOn(earningsService, 'lookupSymbolEarnings').mockImplementation(async (sym: string) => {
        if (sym === 'AAPL') {
          return {
            symbol: 'AAPL',
            resolvedSymbol: 'AAPL',
            companyName: 'Apple Inc.',
            price: 224,
            dayChangePercent: 0.8,
            currency: 'USD',
            earningsDate: '2026-11-06T21:00:00.000Z',
            earningsDateFormatted: 'Nov 6, 2026',
            daysUntil: 1,
            timing: 'AMC',
            isEstimate: false,
            epsEstimate: 1.62,
            epsLow: 1.58,
            epsHigh: 1.65,
            revenueEstimate: 95000000000,
            revenueLow: null,
            revenueHigh: null,
            exDividendDate: null,
            dividendDate: null,
            isPortfolioHolding: true,
            isWatchlist: false,
          };
        }
        return null;
      });

      const scanResult = await checkAndDispatchEarningsReminders(
        mockPrisma,
        'mock_bot_token',
        '-1003872409872',
        607
      );

      expect(scanResult.remindersDispatched).toBe(1);
      expect(scanResult.dispatchedList[0]).toContain('AAPL (1-Day: Tomorrow)');

      expect(sentMessages.length).toBe(1);
      const msg = sentMessages[0];
      expect(msg.messageThreadId).toBe(607);
      expect(msg.text).toContain('IMMINENT EARNINGS ALERT — REPORTING TOMORROW');
      expect(msg.text).toContain('Apple Inc.');
      expect(msg.text).toContain('$AAPL');
      expect(msg.text).toContain('Immediate Action Window');
      expect(msg.text).toContain('100 Shares');
    });
  });

  describe('PDF Generation Engine', () => {
    it('should generate valid PDF buffer with earnings items and summary statistics', async () => {
      const mockItems: any[] = [
        {
          symbol: 'NVDA',
          companyName: 'NVIDIA Corp',
          price: 140,
          earningsDateFormatted: 'Nov 18, 2026',
          daysUntil: 7,
          timing: 'AMC',
          isPortfolioHolding: true,
          portfolioMarketValue: 7000,
          epsEstimate: 0.75,
        },
      ];
      const mockSummary = {
        portfolioCount: 1,
        reportingThisWeek: 1,
        reportingNextWeek: 0,
        reportingThisMonth: 1,
        totalPortfolioValueAtRisk: 7000,
      };

      const pdfBuf = await generateCalendarDossierPdf(mockItems, mockSummary);
      expect(pdfBuf).toBeInstanceOf(Buffer);
      expect(pdfBuf.length).toBeGreaterThan(1000);
      // PDF header magic bytes %PDF-
      expect(pdfBuf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    });
  });
});
