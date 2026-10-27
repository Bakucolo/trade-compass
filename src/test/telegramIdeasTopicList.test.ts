import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseIdeasQuery,
  fetchUnifiedIdeas,
  formatIdeasTelegramMessage,
  generateIdeasPdfReport,
  handleIdeasTopicMessage,
} from '../../server/services/telegramIdeasTopicService';
import * as telegramReportService from '../../server/services/telegramReportService';

describe('Telegram Ideas Topic — Query Parsing, Timeframe Filtering & PDF Generation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.TELEGRAM_BOT_TOKEN = 'mock_telegram_token_123';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('parseIdeasQuery', () => {
    it('correctly parses basic "list" and "list all" commands as ALL timeframe', () => {
      const q1 = parseIdeasQuery('list');
      expect(q1.isQuery).toBe(true);
      expect(q1.timeframe).toBe('ALL');
      expect(q1.isPdfRequested).toBe(false);

      const q2 = parseIdeasQuery('list all');
      expect(q2.isQuery).toBe(true);
      expect(q2.timeframe).toBe('ALL');
      expect(q2.isPdfRequested).toBe(false);

      const q3 = parseIdeasQuery('/list');
      expect(q3.isQuery).toBe(true);
      expect(q3.timeframe).toBe('ALL');
    });

    it('correctly parses timeframe keywords: week, month, year', () => {
      // Month
      const qMonth1 = parseIdeasQuery('list month');
      expect(qMonth1.isQuery).toBe(true);
      expect(qMonth1.timeframe).toBe('MONTH');
      expect(qMonth1.cutoffDate).toBeInstanceOf(Date);
      expect(qMonth1.isPdfRequested).toBe(false);

      const qMonth2 = parseIdeasQuery('month');
      expect(qMonth2.isQuery).toBe(true);
      expect(qMonth2.timeframe).toBe('MONTH');

      const qMonth3 = parseIdeasQuery('ideas month');
      expect(qMonth3.isQuery).toBe(true);
      expect(qMonth3.timeframe).toBe('MONTH');

      // Week
      const qWeek1 = parseIdeasQuery('list week');
      expect(qWeek1.isQuery).toBe(true);
      expect(qWeek1.timeframe).toBe('WEEK');
      expect(qWeek1.cutoffDate).toBeInstanceOf(Date);

      const qWeek2 = parseIdeasQuery('week');
      expect(qWeek2.isQuery).toBe(true);
      expect(qWeek2.timeframe).toBe('WEEK');

      // Year
      const qYear1 = parseIdeasQuery('list year');
      expect(qYear1.isQuery).toBe(true);
      expect(qYear1.timeframe).toBe('YEAR');
      expect(qYear1.cutoffDate).toBeInstanceOf(Date);

      const qYear2 = parseIdeasQuery('year');
      expect(qYear2.isQuery).toBe(true);
      expect(qYear2.timeframe).toBe('YEAR');

      const qYear3 = parseIdeasQuery('list annual');
      expect(qYear3.isQuery).toBe(true);
      expect(qYear3.timeframe).toBe('YEAR');
    });

    it('correctly detects PDF export requests across timeframes', () => {
      const qPdf = parseIdeasQuery('list pdf');
      expect(qPdf.isQuery).toBe(true);
      expect(qPdf.isPdfRequested).toBe(true);
      expect(qPdf.timeframe).toBe('ALL');

      const qPdfMonth = parseIdeasQuery('list month pdf');
      expect(qPdfMonth.isQuery).toBe(true);
      expect(qPdfMonth.isPdfRequested).toBe(true);
      expect(qPdfMonth.timeframe).toBe('MONTH');

      const qPdfWeek = parseIdeasQuery('week pdf');
      expect(qPdfWeek.isQuery).toBe(true);
      expect(qPdfWeek.isPdfRequested).toBe(true);
      expect(qPdfWeek.timeframe).toBe('WEEK');

      const qPdfYear = parseIdeasQuery('list year pdf');
      expect(qPdfYear.isQuery).toBe(true);
      expect(qPdfYear.isPdfRequested).toBe(true);
      expect(qPdfYear.timeframe).toBe('YEAR');

      const qPdfAlone = parseIdeasQuery('pdf');
      expect(qPdfAlone.isQuery).toBe(true);
      expect(qPdfAlone.isPdfRequested).toBe(true);
    });

    it('correctly extracts symbol filter from query', () => {
      const q1 = parseIdeasQuery('list NVDA month');
      expect(q1.isQuery).toBe(true);
      expect(q1.timeframe).toBe('MONTH');
      expect(q1.symbolFilter).toBe('NVDA');

      const q2 = parseIdeasQuery('list $AAPL week pdf');
      expect(q2.isQuery).toBe(true);
      expect(q2.timeframe).toBe('WEEK');
      expect(q2.symbolFilter).toBe('AAPL');
      expect(q2.isPdfRequested).toBe(true);

      const q3 = parseIdeasQuery('ideas for TSLA');
      expect(q3.isQuery).toBe(true);
      expect(q3.symbolFilter).toBe('TSLA');
    });

    it('does NOT treat regular theses containing timeframe words as queries', () => {
      const t1 = parseIdeasQuery('PLTR looks primed for a breakout above 32 with massive government contract tailwinds');
      expect(t1.isQuery).toBe(false);

      const t2 = parseIdeasQuery('AMD semiconductor momentum building for datacenter GPU share gains next year');
      expect(t2.isQuery).toBe(false);

      const t3 = parseIdeasQuery('Bullish on NVDA into earnings next week due to strong Blackwell orders');
      expect(t3.isQuery).toBe(false);
    });
  });

  describe('fetchUnifiedIdeas & Timeframe Filtering', () => {
    it('filters ideas by date cutoff for WEEK, MONTH, YEAR', async () => {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      const mockLogs = [
        {
          id: 'log-1',
          title: '💡 Idea: PLTR Breakout',
          content: 'PLTR military contracts surging',
          symbols: 'PLTR',
          sentiment: 'BULLISH',
          folder: 'Ideas',
          createdAt: new Date(now - 2 * dayMs), // 2 days ago (Week)
        },
        {
          id: 'log-2',
          title: '💡 Idea: TSLA Robotaxi Valuation',
          content: 'TSLA margin expansion on FSD adoption',
          symbols: 'TSLA',
          sentiment: 'BULLISH',
          folder: 'Ideas',
          createdAt: new Date(now - 15 * dayMs), // 15 days ago (Month)
        },
        {
          id: 'log-3',
          title: '💡 Idea: Oil Curve Backwardation',
          content: 'Crude supply deficit risk',
          symbols: 'USO',
          sentiment: 'BEARISH',
          folder: 'Ideas',
          createdAt: new Date(now - 60 * dayMs), // 60 days ago (Year)
        },
        {
          id: 'log-4',
          title: '💡 Idea: Legacy Gold Thesis',
          content: 'Macro currency hedge',
          symbols: 'GLD',
          sentiment: 'NEUTRAL',
          folder: 'Ideas',
          createdAt: new Date(now - 500 * dayMs), // 500 days ago (Older than 1 year)
        },
      ];

      const mockPrisma: any = {
        thoughtLog: {
          findMany: vi.fn(async ({ where }: any) => {
            let res = [...mockLogs];
            if (where?.createdAt?.gte) {
              res = res.filter((item) => item.createdAt.getTime() >= where.createdAt.gte.getTime());
            }
            if (where?.OR) {
              res = res.filter((item) =>
                where.OR.some((cond: any) => {
                  if (cond.symbols?.contains) return item.symbols?.includes(cond.symbols.contains);
                  if (cond.title?.contains) return item.title?.includes(cond.title.contains);
                  if (cond.content?.contains) return item.content?.includes(cond.content.contains);
                  return false;
                })
              );
            }
            return res;
          }),
        },
      };

      // 1. Fetch Week (past 7 days)
      const weekCutoff = new Date(now - 7 * dayMs);
      const weekIdeas = await fetchUnifiedIdeas(mockPrisma, { cutoffDate: weekCutoff });
      expect(weekIdeas).toHaveLength(1);
      expect(weekIdeas[0].symbols).toContain('PLTR');

      // 2. Fetch Month (past 30 days)
      const monthCutoff = new Date(now - 30 * dayMs);
      const monthIdeas = await fetchUnifiedIdeas(mockPrisma, { cutoffDate: monthCutoff });
      expect(monthIdeas).toHaveLength(2);
      expect(monthIdeas.map((i) => i.symbols[0])).toEqual(['PLTR', 'TSLA']);

      // 3. Fetch Year (past 365 days)
      const yearCutoff = new Date(now - 365 * dayMs);
      const yearIdeas = await fetchUnifiedIdeas(mockPrisma, { cutoffDate: yearCutoff });
      expect(yearIdeas).toHaveLength(3);
      expect(yearIdeas.map((i) => i.symbols[0])).toEqual(['PLTR', 'TSLA', 'USO']);

      // 4. Fetch All (no cutoff)
      const allIdeas = await fetchUnifiedIdeas(mockPrisma, {});
      expect(allIdeas).toHaveLength(4);
    });

    it('unifies TradeIdea model if present in prisma schema', async () => {
      const mockPrisma: any = {
        thoughtLog: {
          findMany: vi.fn(async () => [
            {
              id: 'tl-1',
              title: 'Mobile Idea',
              content: 'Logged from mobile',
              symbols: 'NVDA',
              sentiment: 'BULLISH',
              folder: 'Ideas',
              createdAt: new Date(),
            },
          ]),
        },
        tradeIdea: {
          findMany: vi.fn(async () => [
            {
              id: 'ti-1',
              title: 'Desktop Swing Idea',
              content: 'Breakout above 135',
              symbol: 'AAPL',
              type: 'BULLISH',
              targetPrice: 150,
              stopLoss: 130,
              createdAt: new Date(Date.now() - 1000),
            },
          ]),
        },
      };

      const unified = await fetchUnifiedIdeas(mockPrisma);
      expect(unified).toHaveLength(2);
      expect(unified.some((i) => i.sourceType === 'THOUGHT_LOG')).toBe(true);
      expect(unified.some((i) => i.sourceType === 'TRADE_IDEA')).toBe(true);
      expect(unified.find((i) => i.sourceType === 'TRADE_IDEA')?.targetPrice).toBe(150);
    });
  });

  describe('generateIdeasPdfReport', () => {
    it('generates a valid, beautifully styled multi-page PDF buffer', async () => {
      const sampleIdeas = [
        {
          id: 'idea-1',
          sourceType: 'THOUGHT_LOG' as const,
          title: 'NVDA AI Datacenter Demand',
          content: 'Cloud hyperscalers increasing capex into next-gen inference clusters.',
          symbols: ['NVDA'],
          sentiment: 'BULLISH' as const,
          tags: ['AI', 'Datacenter'],
          createdAt: new Date(),
        },
        {
          id: 'idea-2',
          sourceType: 'TRADE_IDEA' as const,
          title: 'XLE Energy Hedging',
          content: 'Crude supply disruptions creating upside volatility.',
          symbols: ['XLE'],
          sentiment: 'BEARISH' as const,
          targetPrice: 78,
          stopLoss: 88,
          tags: ['Macro', 'Commodities'],
          createdAt: new Date(Date.now() - 86400000),
        },
      ];

      const query = parseIdeasQuery('list month pdf');
      const pdfBuffer = await generateIdeasPdfReport(sampleIdeas, query);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      // Valid PDF documents start with %PDF-
      expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });

    it('generates a clean empty-state PDF when 0 ideas exist in timeframe', async () => {
      const query = parseIdeasQuery('list week pdf');
      const pdfBuffer = await generateIdeasPdfReport([], query);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(500);
      expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });
  });

  describe('handleIdeasTopicMessage Integration', () => {
    it('dispatches PDF when "list month pdf" is sent', async () => {
      const sendPdfSpy = vi.spyOn(telegramReportService, 'sendPdfReportToTelegram').mockResolvedValue({
        success: true,
        messageId: 999,
      } as any);

      const mockPrisma: any = {
        thoughtLog: {
          findMany: vi.fn(async () => [
            {
              id: 'tl-1',
              title: '💡 Idea: PLTR Expansion',
              content: 'Government AIP contracts expanding globally',
              symbols: 'PLTR',
              sentiment: 'BULLISH',
              folder: 'Ideas',
              createdAt: new Date(),
            },
          ]),
        },
      };

      const res = await handleIdeasTopicMessage({
        text: 'list month pdf',
        chatId: '-1003872409872',
        messageThreadId: 15,
        prisma: mockPrisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('PDF_REPORT');
      expect(res.pdfGenerated).toBe(true);
      expect(res.replyText).toContain('Trade Compass — Market Ideas Dossier');
      expect(res.replyText).toContain('Last Month (30 Days)');
      expect(sendPdfSpy).toHaveBeenCalledTimes(1);

      const callArgs = sendPdfSpy.mock.calls[0];
      expect(callArgs[1]).toContain('TradeCompass_Ideas_month_');
      expect(callArgs[3]?.messageThreadId).toBe(15);
    });

    it('returns formatted chat summary when "list month" is sent without pdf', async () => {
      const sendMsgSpy = vi.spyOn(telegramReportService, 'sendTelegramMessage').mockResolvedValue({
        success: true,
        messageId: 1001,
      } as any);

      const mockPrisma: any = {
        thoughtLog: {
          findMany: vi.fn(async () => [
            {
              id: 'tl-1',
              title: '💡 Idea: AMD Datacenter',
              content: 'MI300 GPU adoption gaining share against competition',
              symbols: 'AMD',
              sentiment: 'BULLISH',
              folder: 'Ideas',
              createdAt: new Date(),
            },
            {
              id: 'tl-2',
              title: '💡 Idea: Consumer Discretionary Softness',
              content: 'Retail margins contracting under wage pressure',
              symbols: 'XLY',
              sentiment: 'BEARISH',
              folder: 'Ideas',
              createdAt: new Date(),
            },
          ]),
        },
      };

      const res = await handleIdeasTopicMessage({
        text: 'list month',
        chatId: '-1003872409872',
        messageThreadId: 15,
        prisma: mockPrisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('VIEW_IDEAS');
      expect(res.replyText).toContain('Recent Market Ideas & Catalysts');
      expect(res.replyText).toContain('Last Month (30 Days)');
      expect(res.replyText).toContain('AMD Datacenter');
      expect(res.replyText).toContain('Consumer Discretionary Softness');
      expect(res.replyText).toContain('Bullish');
      expect(res.replyText).toContain('Bearish');

      expect(sendMsgSpy).toHaveBeenCalledTimes(1);
    });

    it('returns all ideas when simply sending "list", even with large numbers of ideas', async () => {
      // 20 sample ideas
      const sample20Ideas = Array.from({ length: 20 }, (_, i) => ({
        id: `tl-${i + 1}`,
        title: `💡 Idea: Ticker Opportunity #${i + 1}`,
        content: `Detailed thesis number ${i + 1} with strategic catalyst and conviction level`,
        symbols: `SYM${i + 1}`,
        sentiment: i % 2 === 0 ? 'BULLISH' : 'BEARISH',
        folder: 'Ideas',
        createdAt: new Date(Date.now() - i * 3600000),
      }));

      const mockPrisma: any = {
        thoughtLog: {
          findMany: vi.fn(async () => sample20Ideas),
        },
      };

      const res = await handleIdeasTopicMessage({
        text: 'list',
        chatId: '-1003872409872',
        messageThreadId: 95,
        prisma: mockPrisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('VIEW_IDEAS');
      expect(res.replyText).toContain('All Ideas Sent');
      expect(res.ideasCount).toBe(20);

      // Verify ALL 20 ideas are present in the reply text and NOT truncated at 15
      for (let i = 1; i <= 20; i++) {
        expect(res.replyText).toContain(`Ticker Opportunity #${i}`);
      }
      expect(res.replyText).not.toContain('...and 5 more ideas sent');
    });

    it('replies with a nicely readable PDF when the word "pdf" or "PDF" is written', async () => {
      const sendPdfSpy = vi.spyOn(telegramReportService, 'sendPdfReportToTelegram').mockResolvedValue({
        success: true,
        messageId: 888,
      } as any);

      const mockPrisma: any = {
        thoughtLog: {
          findMany: vi.fn(async () => [
            {
              id: 'tl-1',
              title: '💡 Idea: PLTR Expansion',
              content: 'Global enterprise software deals accelerating with AIP rollout',
              symbols: 'PLTR',
              sentiment: 'BULLISH',
              folder: 'Ideas',
              createdAt: new Date(),
            },
            {
              id: 'tl-2',
              title: '💡 Idea: NVDA Blackwell GPUs',
              content: 'Hyperscaler datacenter spending surging into new architectures',
              symbols: 'NVDA',
              sentiment: 'BULLISH',
              folder: 'Ideas',
              createdAt: new Date(Date.now() - 86400000),
            },
          ]),
        },
      };

      // 1. Standalone "pdf"
      const resPdf = await handleIdeasTopicMessage({
        text: 'pdf',
        chatId: '-1003872409872',
        messageThreadId: 95,
        prisma: mockPrisma,
      });

      expect(resPdf.handled).toBe(true);
      expect(resPdf.actionTaken).toBe('PDF_REPORT');
      expect(resPdf.pdfGenerated).toBe(true);
      expect(resPdf.replyText).toContain('Trade Compass — Market Ideas Dossier');
      expect(sendPdfSpy).toHaveBeenCalledTimes(1);

      const [pdfBuffer, filename, caption, extra] = sendPdfSpy.mock.calls[0];
      expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-');
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      expect(filename).toContain('TradeCompass_Ideas_all_');
      expect(extra?.messageThreadId).toBe(95);

      // 2. Standalone uppercase "PDF"
      const resUpper = await handleIdeasTopicMessage({
        text: 'PDF',
        chatId: '-1003872409872',
        messageThreadId: 95,
        prisma: mockPrisma,
      });

      expect(resUpper.handled).toBe(true);
      expect(resUpper.actionTaken).toBe('PDF_REPORT');
      expect(resUpper.pdfGenerated).toBe(true);
      expect(sendPdfSpy).toHaveBeenCalledTimes(2);

      // 3. Short phrase "send pdf"
      const resPhrase = await handleIdeasTopicMessage({
        text: 'send pdf',
        chatId: '-1003872409872',
        messageThreadId: 95,
        prisma: mockPrisma,
      });

      expect(resPhrase.handled).toBe(true);
      expect(resPhrase.actionTaken).toBe('PDF_REPORT');
      expect(resPhrase.pdfGenerated).toBe(true);
      expect(sendPdfSpy).toHaveBeenCalledTimes(3);
    });

    it('still creates a new idea when non-query thesis is sent', async () => {
      const mockCreated: any[] = [];
      const mockPrisma: any = {
        thoughtLog: {
          create: vi.fn(async ({ data }: any) => {
            const item = { id: 'tl-new', ...data };
            mockCreated.push(item);
            return item;
          }),
        },
      };

      const res = await handleIdeasTopicMessage({
        text: 'Long $NVDA into earnings next week on robust Blackwell hyperscaler demand',
        chatId: '-1003872409872',
        prisma: mockPrisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('CREATE_IDEA');
      expect(res.replyText).toContain('Market Idea Logged');
      expect(mockCreated).toHaveLength(1);
      expect(mockCreated[0].symbols).toBe('NVDA');
      expect(mockCreated[0].folder).toBe('Ideas');
    });
  });
});
