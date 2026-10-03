import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isTelegramBriefingRequest,
  consumeTelegramBuffer,
  BufferedTelegramMessage,
} from '../../server/services/telegramBufferConsumerService';
import * as telegramReportService from '../../server/services/telegramReportService';

describe('On-Demand Telegram Executive Briefing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TELEGRAM_BUFFER_URL: 'https://test-worker.workers.dev/consume',
      TELEGRAM_BOT_TOKEN: 'test_bot_token_123',
      TELEGRAM_CHAT_ID: '8959044574',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('isTelegramBriefingRequest matcher', () => {
    it('correctly identifies single-word and direct commands for briefing', () => {
      expect(isTelegramBriefingRequest('briefing')).toBe(true);
      expect(isTelegramBriefingRequest('Briefing')).toBe(true);
      expect(isTelegramBriefingRequest('BRIEFING')).toBe(true);
      expect(isTelegramBriefingRequest('/briefing')).toBe(true);
      expect(isTelegramBriefingRequest('#briefing')).toBe(true);
      expect(isTelegramBriefingRequest('briefing!')).toBe(true);
      expect(isTelegramBriefingRequest('briefing?')).toBe(true);
      expect(isTelegramBriefingRequest('/daily_briefing')).toBe(true);
      expect(isTelegramBriefingRequest('/executive_briefing')).toBe(true);
    });

    it('correctly identifies natural language requests for briefing', () => {
      expect(isTelegramBriefingRequest('send briefing')).toBe(true);
      expect(isTelegramBriefingRequest('send me the briefing')).toBe(true);
      expect(isTelegramBriefingRequest('send me the daily briefing')).toBe(true);
      expect(isTelegramBriefingRequest('send me today\'s briefing')).toBe(true);
      expect(isTelegramBriefingRequest('get briefing')).toBe(true);
      expect(isTelegramBriefingRequest('give me the briefing')).toBe(true);
      expect(isTelegramBriefingRequest('generate briefing')).toBe(true);
      expect(isTelegramBriefingRequest('dispatch briefing')).toBe(true);
      expect(isTelegramBriefingRequest('briefing please')).toBe(true);
      expect(isTelegramBriefingRequest('briefing today')).toBe(true);
      expect(isTelegramBriefingRequest('today\'s briefing')).toBe(true);
      expect(isTelegramBriefingRequest('executive briefing')).toBe(true);
      expect(isTelegramBriefingRequest('daily briefing')).toBe(true);
      expect(isTelegramBriefingRequest('morning briefing')).toBe(true);
      expect(isTelegramBriefingRequest('portfolio briefing')).toBe(true);
      expect(isTelegramBriefingRequest('pdf briefing')).toBe(true);
    });

    it('rejects general sentences, alerts, trades, and conversational feedback', () => {
      expect(isTelegramBriefingRequest('')).toBe(false);
      expect(isTelegramBriefingRequest('   ')).toBe(false);
      expect(isTelegramBriefingRequest('The briefing was very insightful')).toBe(false);
      expect(isTelegramBriefingRequest('I read the briefing yesterday')).toBe(false);
      expect(isTelegramBriefingRequest('Alert: AAPL above $250')).toBe(false);
      expect(isTelegramBriefingRequest('Buy 5 calls NVDA 120')).toBe(false);
      expect(isTelegramBriefingRequest('#app add dark mode toggle')).toBe(false);
    });
  });

  describe('generateAndSendDailyReport options forwarding', () => {
    it('forwards target options (chatId, messageThreadId) to sendPdfReportToTelegram and Telegram Bot API', async () => {
      let dispatchedFormData: FormData | null = null;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
        if (typeof url === 'string' && url.includes('/sendDocument')) {
          dispatchedFormData = init?.body as FormData;
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, result: { message_id: 9988 } }),
          } as any;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as any;
      });

      const result = await telegramReportService.generateAndSendDailyReport({
        chatId: 12345678,
        messageThreadId: 42,
        requestedBy: '@trader',
      });

      expect(result.success).toBe(true);
      expect(result.filename).toContain('TradeFlow_Executive_Briefing_');
      expect(dispatchedFormData).not.toBeNull();
      expect(dispatchedFormData!.get('chat_id')).toBe('12345678');
      expect(dispatchedFormData!.get('message_thread_id')).toBe('42');
      expect(dispatchedFormData!.get('caption')).toContain('TradeFlow Daily Executive Briefing');
    });
  });

  describe('consumeTelegramBuffer on-demand briefing pipeline', () => {
    it('detects "briefing", sends immediate ack, dispatches PDF report, and creates ThoughtLog in Reports folder', async () => {
      const mockMessages: BufferedTelegramMessage[] = [
        {
          id: 'msg_1787815200000_5001',
          messageId: 5001,
          messageThreadId: 10,
          text: 'briefing',
          date: 1787815200,
          timestamp: '2026-10-03T05:30:00.000Z',
          sender: { id: 8959044574, username: 'boss_trader', firstName: 'Chief' },
          chat: { id: 8959044574, type: 'private' },
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          count: 1,
          messages: mockMessages,
        }),
      } as any);

      const sendTelegramMessageSpy = vi.spyOn(telegramReportService, 'sendTelegramMessage').mockResolvedValue({
        success: true,
        messageId: 1111,
      });

      const generateReportSpy = vi.spyOn(telegramReportService, 'generateAndSendDailyReport').mockResolvedValue({
        success: true,
        filename: 'TradeFlow_Executive_Briefing_2026-10-03.pdf',
        sizeBytes: 154200,
        messageId: 2222,
        data: {} as any,
      });

      const createdLogs: any[] = [];
      const mockPrisma = {
        thoughtLog: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            const rec = { id: `log-${createdLogs.length + 1}`, ...data };
            createdLogs.push(rec);
            return rec;
          }),
        },
      } as any;

      const result = await consumeTelegramBuffer(mockPrisma);

      expect(result.success).toBe(true);
      expect(result.consumedCount).toBe(1);

      // Verify acknowledgment text message was dispatched to the sender's chat & thread
      expect(sendTelegramMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Generating Executive Briefing PDF'),
          chatId: 8959044574,
          messageThreadId: 10,
        })
      );

      // Verify report generator was triggered with target recipient options
      expect(generateReportSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: 8959044574,
          messageThreadId: 10,
          requestedBy: '@boss_trader',
        })
      );

      // Verify ThoughtLog entry in "Reports" folder
      expect(createdLogs.length).toBe(1);
      const log = createdLogs[0];
      expect(log.folder).toBe('Reports');
      expect(log.tags).toContain('Briefing');
      expect(log.tags).toContain('OnDemand');
      expect(log.agentOutput).toContain('Executive Briefing PDF Dispatched');
      expect(log.isFulfilled).toBe(true);
    });

    it('handles natural phrase "/briefing" from a group topic', async () => {
      const mockMessages: BufferedTelegramMessage[] = [
        {
          id: 'msg_1787815200000_5002',
          messageId: 5002,
          messageThreadId: 77,
          text: '/briefing',
          date: 1787815210,
          timestamp: '2026-10-03T05:30:10.000Z',
          sender: { id: 123456, username: 'colleague', firstName: 'Sam' },
          chat: { id: -1003872409872, type: 'supergroup', title: 'Trading Group' },
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          count: 1,
          messages: mockMessages,
        }),
      } as any);

      vi.spyOn(telegramReportService, 'sendTelegramMessage').mockResolvedValue({
        success: true,
        messageId: 3333,
      });

      const generateReportSpy = vi.spyOn(telegramReportService, 'generateAndSendDailyReport').mockResolvedValue({
        success: true,
        filename: 'TradeFlow_Executive_Briefing_2026-10-03.pdf',
        sizeBytes: 154200,
        messageId: 4444,
        data: {} as any,
      });

      const mockPrisma = {
        thoughtLog: {
          create: vi.fn().mockResolvedValue({ id: 'log-group-1' }),
        },
      } as any;

      const result = await consumeTelegramBuffer(mockPrisma);

      expect(result.success).toBe(true);
      expect(generateReportSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: -1003872409872,
          messageThreadId: 77,
          requestedBy: '@colleague',
        })
      );
    });
  });
});
