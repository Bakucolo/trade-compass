import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseOptionTradeQuery, handleTradeTopicMessage } from '../../server/services/telegramTradeTopicService';
import { optionsChainService } from '../../server/services/optionsChainService';
import * as telegramReportService from '../../server/services/telegramReportService';

describe('Telegram Trade Topic Service & AI Strike Optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseOptionTradeQuery()', () => {
    it('parses standard short put trade setup', () => {
      const q = parseOptionTradeQuery('AAPL short put 300');
      expect(q.symbol).toBe('AAPL');
      expect(q.side).toBe('SELL');
      expect(q.optionType).toBe('PUT');
      expect(q.targetStrike).toBe(300);
      expect(q.isAiRequested).toBe(false);
      expect(q.objective).toBe('BALANCED');
    });

    it('detects AI request and income objective', () => {
      const q = parseOptionTradeQuery('AAPL 300 put ai income');
      expect(q.symbol).toBe('AAPL');
      expect(q.side).toBe('SELL');
      expect(q.optionType).toBe('PUT');
      expect(q.targetStrike).toBe(300);
      expect(q.isAiRequested).toBe(true);
      expect(q.objective).toBe('INCOME');
    });

    it('detects assignment / wheel objective to maximize premium', () => {
      const q = parseOptionTradeQuery('NVDA 125 put assignment maximize premium');
      expect(q.symbol).toBe('NVDA');
      expect(q.side).toBe('SELL');
      expect(q.optionType).toBe('PUT');
      expect(q.targetStrike).toBe(125);
      expect(q.isAiRequested).toBe(true);
      expect(q.objective).toBe('ASSIGNMENT');
    });

    it('parses covered calls and buy orders', () => {
      const q1 = parseOptionTradeQuery('TSLA covered call 250');
      expect(q1.symbol).toBe('TSLA');
      expect(q1.side).toBe('SELL');
      expect(q1.optionType).toBe('CALL');
      expect(q1.targetStrike).toBe(250);

      const q2 = parseOptionTradeQuery('buy 1 MSFT 450 call');
      expect(q2.symbol).toBe('MSFT');
      expect(q2.side).toBe('BUY');
      expect(q2.optionType).toBe('CALL');
      expect(q2.targetStrike).toBe(450);
    });

    it('handles help and history intents', () => {
      const qHelp = parseOptionTradeQuery('help');
      expect(qHelp.isHelp).toBe(true);

      const qHist = parseOptionTradeQuery('history');
      expect(qHist.isViewHistory).toBe(true);
    });

    it('parses natural language dates and isolates strike from date numbers', () => {
      const q1 = parseOptionTradeQuery('Oust short put 16 19 February 2027');
      expect(q1.symbol).toBe('OUST');
      expect(q1.side).toBe('SELL');
      expect(q1.optionType).toBe('PUT');
      expect(q1.targetStrike).toBe(16);
      expect(q1.targetExpirationDate).toBe('2027-02-19');
      expect(q1.targetYear).toBe(2027);
      expect(q1.targetMonth).toBe(2);
      expect(q1.targetDte).toBeGreaterThanOrEqual(100);

      const q2 = parseOptionTradeQuery('OUST 16 put 126 dte');
      expect(q2.symbol).toBe('OUST');
      expect(q2.targetStrike).toBe(16);
      expect(q2.targetDte).toBe(126);

      const q3 = parseOptionTradeQuery('TSLA covered call 250 Feb 2027');
      expect(q3.symbol).toBe('TSLA');
      expect(q3.side).toBe('SELL');
      expect(q3.optionType).toBe('CALL');
      expect(q3.targetStrike).toBe(250);
      expect(q3.targetYear).toBe(2027);
      expect(q3.targetMonth).toBe(2);

      const q4 = parseOptionTradeQuery('NVDA 125 put 2027-02-19');
      expect(q4.symbol).toBe('NVDA');
      expect(q4.targetStrike).toBe(125);
      expect(q4.targetExpirationDate).toBe('2027-02-19');

      const q5 = parseOptionTradeQuery('AAPL 220 put 19/02/2027');
      expect(q5.symbol).toBe('AAPL');
      expect(q5.targetStrike).toBe(220);
      expect(q5.targetExpirationDate).toBe('2027-02-19');
    });
  });

  describe('handleTradeTopicMessage()', () => {
    it('returns comprehensive help guide on help request', async () => {
      const mockPrisma: any = {};
      const sendSpy = vi.spyOn(telegramReportService, 'sendTelegramMessage').mockResolvedValue({} as any);

      const res = await handleTradeTopicMessage({
        text: 'help',
        chatId: '-1003872409872',
        messageThreadId: 406,
        prisma: mockPrisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('HELP');
      expect(res.replyText).toContain('Options Analysis & AI Suggestions');
      expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({
        chatId: '-1003872409872',
        messageThreadId: 406,
      }));
    });

    it('fetches option chain, computes Greeks & RoC, and formats matrix table and AI advice', async () => {
      const mockChain = {
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        underlyingPrice: 340.0,
        underlyingChange: 1.5,
        underlyingChangePercent: 0.44,
        selectedExpiration: '2026-11-20',
        selectedDte: 35,
        expirations: [{ date: '2026-11-20', dte: 35, type: 'MONTHLY' }],
        strikes: [
          {
            strike: 290,
            put: { bid: 0.70, ask: 0.75, mid: 0.725, lastPrice: 0.72, delta: -0.05, theta: -0.04, impliedVolatility: 29.5, openInterest: 1200 },
          },
          {
            strike: 300,
            put: { bid: 1.20, ask: 1.30, mid: 1.25, lastPrice: 1.24, delta: -0.08, theta: -0.06, impliedVolatility: 30.2, openInterest: 4500 },
          },
          {
            strike: 310,
            put: { bid: 2.10, ask: 2.20, mid: 2.15, lastPrice: 2.15, delta: -0.14, theta: -0.09, impliedVolatility: 31.0, openInterest: 3200 },
          },
          {
            strike: 320,
            put: { bid: 3.80, ask: 4.00, mid: 3.90, lastPrice: 3.85, delta: -0.25, theta: -0.13, impliedVolatility: 32.5, openInterest: 5600 },
          },
          {
            strike: 330,
            put: { bid: 7.20, ask: 7.50, mid: 7.35, lastPrice: 7.30, delta: -0.38, theta: -0.16, impliedVolatility: 34.0, openInterest: 8900 },
          },
        ],
      };

      vi.spyOn(optionsChainService, 'getOptionsChain').mockResolvedValue(mockChain as any);
      const sendSpy = vi.spyOn(telegramReportService, 'sendTelegramMessage').mockResolvedValue({} as any);

      const mockPrisma: any = {};

      const res = await handleTradeTopicMessage({
        text: 'AAPL short put 300 ai income',
        chatId: '-1003872409872',
        messageThreadId: 406,
        prisma: mockPrisma,
        senderLabel: 'Alex',
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('ANALYZE_TRADE');
      expect(res.hasAiAnalysis).toBe(true);
      expect(res.analysis).toBeDefined();

      // Check metrics
      expect(res.analysis?.symbol).toBe('AAPL');
      expect(res.analysis?.targetStrike).toBe(300);
      expect(res.analysis?.targetMetrics.mid).toBe(1.25);
      expect(res.analysis?.targetMetrics.delta).toBe(-0.08);
      expect(res.analysis?.targetMetrics.premiumPerContract).toBe(125.0);
      expect(res.analysis?.targetMetrics.bufferPct).toBe(11.8); // (340 - 300)/340 * 100
      expect(res.analysis?.targetMetrics.breakeven).toBe(298.75); // 300 - 1.25

      // Check formatted output contains matrix and playbook
      expect(res.replyText).toContain('TRADE ANALYSIS: $AAPL');
      expect(res.replyText).toContain('Short $300 Put');
      expect(res.replyText).toContain('Strike | Delta |  Mid  |  Ann %  | Buffer |  PoP');
      expect(res.replyText).toContain('👉$300');
      expect(res.replyText).toContain('AI Options Playbook for AAPL');
      expect(res.replyText).toContain('Pure Income Pick');
      expect(res.replyText).toContain('Assignment / Wheel Maximizer');

      // Verify Telegram dispatch
      expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({
        chatId: '-1003872409872',
        messageThreadId: 406,
      }));
    });

    it('matches custom target expiration date (126 DTE) and notes strike snapping when requested strike is unavailable', async () => {
      const defaultChain = {
        symbol: 'OUST',
        companyName: 'Ouster Inc.',
        underlyingPrice: 22.5,
        underlyingChange: -0.3,
        underlyingChangePercent: -1.3,
        selectedExpiration: '2026-11-20',
        selectedDte: 35,
        expirations: [
          { date: '2026-11-20', dte: 35, type: 'MONTHLY' },
          { date: '2027-02-19', dte: 126, type: 'MONTHLY' },
        ],
        strikes: [
          {
            strike: 20,
            put: { bid: 1.0, ask: 1.2, mid: 1.1, lastPrice: 1.1, delta: -0.25, theta: -0.02, impliedVolatility: 45.0, openInterest: 500 },
          },
        ],
      };

      const feb2027Chain = {
        symbol: 'OUST',
        companyName: 'Ouster Inc.',
        underlyingPrice: 22.5,
        underlyingChange: -0.3,
        underlyingChangePercent: -1.3,
        selectedExpiration: '2027-02-19',
        selectedDte: 126,
        expirations: [
          { date: '2026-11-20', dte: 35, type: 'MONTHLY' },
          { date: '2027-02-19', dte: 126, type: 'MONTHLY' },
        ],
        strikes: [
          {
            strike: 20,
            put: { bid: 1.8, ask: 2.2, mid: 2.0, lastPrice: 2.0, delta: -0.30, theta: -0.015, impliedVolatility: 48.0, openInterest: 1200 },
          },
          {
            strike: 25,
            put: { bid: 4.5, ask: 5.0, mid: 4.75, lastPrice: 4.8, delta: -0.60, theta: -0.012, impliedVolatility: 50.0, openInterest: 800 },
          },
        ],
      };

      const getOptionsChainSpy = vi.spyOn(optionsChainService, 'getOptionsChain')
        .mockImplementation(async (sym, exp) => {
          if (exp === '2027-02-19') return feb2027Chain as any;
          return defaultChain as any;
        });

      const sendSpy = vi.spyOn(telegramReportService, 'sendTelegramMessage').mockResolvedValue({} as any);

      const res = await handleTradeTopicMessage({
        text: 'Oust short put 16 19 February 2027',
        chatId: '-1003872409872',
        messageThreadId: 406,
        prisma: {} as any,
      });

      expect(res.handled).toBe(true);
      expect(getOptionsChainSpy).toHaveBeenCalledWith('OUST', '2027-02-19');
      expect(res.analysis?.selectedExpiration).toBe('2027-02-19');
      expect(res.analysis?.selectedDte).toBe(126);
      expect(res.analysis?.targetStrike).toBe(20); // Snapped from 16 to closest available strike 20

      // Formatted text checks
      expect(res.replyText).toContain('TRADE ANALYSIS: $OUST');
      expect(res.replyText).toContain('Feb 19, 2027');
      expect(res.replyText).toContain('126 DTE');
      expect(res.replyText).toContain('Short $20 Put');
      expect(res.replyText).toContain('(Closest available strike to requested $16)');
    });

    it('prevents duplicate trade replies when query arrives within 15 seconds', async () => {
      const mockPrisma: any = {
        thoughtLog: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'log-1',
            agentOutput: '⚡ *TRADE ANALYSIS: $OUST*\nExisting answer...',
          }),
        },
      };

      const sendSpy = vi.spyOn(telegramReportService, 'sendTelegramMessage').mockResolvedValue({} as any);

      const res = await handleTradeTopicMessage({
        text: 'Oust short put 16 19 February 2027',
        chatId: '-1003872409872',
        messageThreadId: 406,
        prisma: mockPrisma,
      });

      expect(res.handled).toBe(true);
      expect(sendSpy).not.toHaveBeenCalled(); // Dedup guard blocked redundant Telegram message dispatch
      expect(res.replyText).toContain('Existing answer');
    });
  });
});
