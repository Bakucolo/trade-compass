import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleCopilotTopicMessage,
  getCopilotSession,
  clearCopilotSessionForTesting,
  generateCopilotBriefingPdf,
  splitTelegramMessage,
} from '../../server/services/telegramCopilotTopicService';
import {
  topicNameByThreadId,
  setTelegramCopilotThreadId,
  getTelegramBufferStatus,
} from '../../server/services/telegramBufferConsumerService';
import { setGenericTopicThreadId } from '../../server/services/telegramTopicsManagementService';
import { getCopilotTopicHelp } from '../../server/services/telegramTopicHelpService';
import * as telegramReportService from '../../server/services/telegramReportService';
import * as tastytradeToolService from '../../server/services/tastytradeToolService';

describe('Telegram AI Copilot Topic Suite', () => {
  let mockPrisma: any;
  let sentMessages: any[] = [];
  let sentPdfs: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    clearCopilotSessionForTesting();
    sentMessages = [];
    sentPdfs = [];

    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token_123';
    process.env.TELEGRAM_COPILOT_THREAD_ID = '624';
    process.env.TELEGRAM_ALERTS_CHAT_ID = '-1003872409872';

    vi.spyOn(telegramReportService, 'sendTelegramMessage').mockImplementation(async (payload: any) => {
      sentMessages.push(payload);
      return { ok: true, result: { message_id: 999 } };
    });

    vi.spyOn(telegramReportService, 'sendPdfReportToTelegram').mockImplementation(
      async (buf: Buffer, filename: string, caption?: string, options?: any) => {
        sentPdfs.push({ filename, caption, options, size: buf.length });
        return { ok: true, result: { message_id: 1000 } };
      }
    );

    mockPrisma = {
      thoughtLog: {
        create: vi.fn().mockResolvedValue({ id: 'log-1', title: 'AI Copilot' }),
      },
    };
  });

  describe('Topic Configuration & Routing', () => {
    it('should map thread 624 to AI Copilot in topicNameByThreadId', () => {
      expect(topicNameByThreadId.get(624)).toBe('AI Copilot');
    });

    it('should update TELEGRAM_COPILOT_THREAD_ID via setTelegramCopilotThreadId', () => {
      const res = setTelegramCopilotThreadId(750);
      expect(res).toBe(true);
      expect(process.env.TELEGRAM_COPILOT_THREAD_ID).toBe('750');
      expect(topicNameByThreadId.get(750)).toBe('AI Copilot');

      // Reset back to 624
      setTelegramCopilotThreadId(624);
      expect(process.env.TELEGRAM_COPILOT_THREAD_ID).toBe('624');
    });

    it('should route setGenericTopicThreadId for copilot and ai_copilot', () => {
      const ok1 = setGenericTopicThreadId('copilot', 624);
      expect(ok1).toBe(true);

      const ok2 = setGenericTopicThreadId('ai_copilot', 624);
      expect(ok2).toBe(true);

      const status = getTelegramBufferStatus();
      expect(status.copilotThreadId).toBe('624');
    });

    it('should return rich instructions in getCopilotTopicHelp', () => {
      const help = getCopilotTopicHelp();
      expect(help).toContain('AI Copilot Topic — Quantitative Financial Intelligence');
      expect(help).toContain('Conversational Financial Intelligence');
      expect(help).toContain('Multi-Broker Telemetry');
      expect(help).toContain('Safe Draft Orders');
      expect(help).toContain('broker ibkr');
      expect(help).toContain('reset');
    });
  });

  describe('Session Management & Shortcuts', () => {
    it('should handle help request (? or help)', async () => {
      const result = await handleCopilotTopicMessage({
        text: 'help',
        chatId: '-1003872409872',
        messageThreadId: 624,
        prisma: mockPrisma,
        senderLabel: '@Trader',
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('HELP');
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].text).toContain('AI Copilot Topic — Quantitative Financial Intelligence');
      expect(sentMessages[0].messageThreadId).toBe(624);
    });

    it('should switch active broker gateway with "broker ibkr" and "broker tasty"', async () => {
      const res1 = await handleCopilotTopicMessage({
        text: 'broker ibkr',
        chatId: '-1003872409872',
        messageThreadId: 624,
        prisma: mockPrisma,
        senderLabel: '@Trader',
      });

      expect(res1.actionTaken).toBe('SWITCH_BROKER');
      expect(sentMessages[0].text).toContain('Active Broker Switched to IBKR');
      const session = getCopilotSession('-1003872409872', 624);
      expect(session.activeBroker).toBe('ibkr');

      const res2 = await handleCopilotTopicMessage({
        text: 'broker tastytrade',
        chatId: '-1003872409872',
        messageThreadId: 624,
        prisma: mockPrisma,
        senderLabel: '@Trader',
      });

      expect(res2.actionTaken).toBe('SWITCH_BROKER');
      expect(sentMessages[1].text).toContain('Active Broker Switched to TASTYTRADE');
      expect(session.activeBroker).toBe('tastytrade');
    });

    it('should clear conversation context with "reset"', async () => {
      const session = getCopilotSession('-1003872409872', 624);
      session.chatHistory.push({ role: 'user', content: 'prior question' });
      session.chatHistory.push({ role: 'assistant', content: 'prior answer' });

      const res = await handleCopilotTopicMessage({
        text: 'reset',
        chatId: '-1003872409872',
        messageThreadId: 624,
        prisma: mockPrisma,
        senderLabel: '@Trader',
      });

      expect(res.actionTaken).toBe('RESET_SESSION');
      expect(session.chatHistory.length).toBe(0);
      expect(sentMessages[0].text).toContain('Copilot Memory Cleared');
    });

    it('should display status inquiry with "status"', async () => {
      const res = await handleCopilotTopicMessage({
        text: 'status',
        chatId: '-1003872409872',
        messageThreadId: 624,
        prisma: mockPrisma,
        senderLabel: '@Trader',
      });

      expect(res.actionTaken).toBe('STATUS');
      expect(sentMessages[0].text).toContain('Trade Compass AI Copilot — Session Status');
      expect(sentMessages[0].text).toContain('Active Target Broker');
    });
  });

  describe('Interactive Copilot Query Execution', () => {
    it('should run multi-turn agent for general financial questions', async () => {
      vi.spyOn(tastytradeToolService, 'runTastyCopilotAgent').mockResolvedValueOnce({
        success: true,
        response: 'Apple ($AAPL) demonstrates solid gross margins of 46.2% and accelerated services growth.',
        model: 'gemini-2.5-flash',
        tools_used: ['get_market_quote'],
        execution_time_seconds: 1.25,
      });

      const result = await handleCopilotTopicMessage({
        text: 'What is the fundamental margin outlook for AAPL?',
        chatId: '-1003872409872',
        messageThreadId: 624,
        prisma: mockPrisma,
        senderLabel: '@Trader',
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('CHAT_QUERY');
      expect(result.symbol).toBe('AAPL');
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].text).toContain('Apple ($AAPL) demonstrates solid gross margins');
      expect(sentMessages[0].text).toContain('Model: gemini-2.5-flash');

      // Verify conversation memory retained
      const session = getCopilotSession('-1003872409872', 624);
      expect(session.chatHistory.length).toBe(2);
      expect(session.chatHistory[0].role).toBe('user');
      expect(session.chatHistory[1].role).toBe('assistant');
    });

    it('should format staged draft orders with safety warnings and human confirmation rules', async () => {
      vi.spyOn(tastytradeToolService, 'runTastyCopilotAgent').mockResolvedValueOnce({
        success: true,
        response: 'I have staged your limit buy order for approval.',
        model: 'gemini-2.5-flash',
        tools_used: ['draft_order'],
        execution_time_seconds: 1.5,
        draftOrder: {
          draftId: 'draft_test_12345',
          broker: 'tastytrade',
          accountNumber: '5WT67220',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          status: 'PENDING_APPROVAL',
          symbol: 'AAPL',
          action: 'BUY',
          instrumentType: 'Equity',
          quantity: 10,
          orderType: 'Limit',
          price: 220,
          timeInForce: 'Day',
          dryRunResult: {
            buyingPowerEffect: 2200,
            estimatedCommission: 0,
          },
        },
      });

      const result = await handleCopilotTopicMessage({
        text: 'Draft limit buy 10 AAPL @ 220',
        chatId: '-1003872409872',
        messageThreadId: 624,
        prisma: mockPrisma,
        senderLabel: '@Trader',
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('DRAFT_ORDER');
      expect(result.draftOrder).toBeDefined();
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].text).toContain('ORDER DRAFTED & STAGED IN TRADE COMPASS');
      expect(sentMessages[0].text).toContain('BUY 10 AAPL');
      expect(sentMessages[0].text).toContain('$220.00');
      expect(sentMessages[0].text).toContain('draft_test_12345');
      expect(sentMessages[0].text).toContain('Human-in-the-Loop Security Rule');
    });

    it('should generate and dispatch an institutional PDF when pdf is requested', async () => {
      vi.spyOn(tastytradeToolService, 'runTastyCopilotAgent').mockResolvedValueOnce({
        success: true,
        response: 'NVDA Blackwell architecture provides 4x training compute performance with unprecedented data center demand.',
        model: 'groq-llama-3.3-70b',
        tools_used: ['get_market_metrics'],
        execution_time_seconds: 0.85,
      });

      const result = await handleCopilotTopicMessage({
        text: 'NVDA Blackwell thesis pdf',
        chatId: '-1003872409872',
        messageThreadId: 624,
        prisma: mockPrisma,
        senderLabel: '@Trader',
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('PDF_REPORT');
      expect(result.pdfGenerated).toBe(true);
      expect(sentPdfs.length).toBe(1);
      expect(sentPdfs[0].filename).toContain('TradeCompass_Copilot_NVDA');
      expect(sentPdfs[0].caption).toContain('AI Copilot Quantitative Briefing');
    });
  });

  describe('Message Splitting & PDF Generation', () => {
    it('should split long messages exceeding 3900 characters cleanly', () => {
      const longText = 'Line 1: Quantitative insight\n\n' + 'A'.repeat(5000);
      const chunks = splitTelegramMessage(longText, 3900);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBeLessThanOrEqual(3900);
    });

    it('should generate a valid PDF buffer with briefing formatting', async () => {
      const pdfBuf = await generateCopilotBriefingPdf(
        'TSLA Robotaxi valuation thesis',
        'Detailed quantitative analysis of autonomous vehicle margins.',
        'gemini-2.5-flash',
        'tastytrade',
        ['get_market_quote']
      );

      expect(pdfBuf).toBeInstanceOf(Buffer);
      expect(pdfBuf.length).toBeGreaterThan(1000);
      expect(pdfBuf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    });
  });
});
