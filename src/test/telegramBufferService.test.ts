import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  consumeTelegramBuffer,
  getTelegramBufferStatus,
  BufferedTelegramMessage,
} from '../../server/services/telegramBufferConsumerService';

describe('Telegram Buffer Webhook Consumer Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should return unconfigured status when TELEGRAM_BUFFER_URL is missing', async () => {
    delete process.env.TELEGRAM_BUFFER_URL;
    delete process.env.TELEGRAM_BOT_TOKEN;
    const status = getTelegramBufferStatus();
    expect(status.isConfigured).toBe(false);
    expect(status.bufferUrl).toBeNull();

    const mockPrisma = {} as any;
    const result = await consumeTelegramBuffer(mockPrisma);
    expect(result.success).toBe(false);
    expect(result.consumedCount).toBe(0);
    expect(result.message).toContain('TELEGRAM_BUFFER_URL');
  });

  it('should consume and ingest messages from buffer endpoint', async () => {
    process.env.TELEGRAM_BUFFER_URL = 'https://telegram-thought-buffer.workers.dev/consume';
    process.env.TELEGRAM_BUFFER_SECRET = 'test_secret_123';

    const mockMessages: BufferedTelegramMessage[] = [
      {
        id: 'msg_1787815200000_1001',
        messageId: 1001,
        text: 'Looking at buying $NVDA and $AMD calls for next month',
        date: 1787815200,
        timestamp: '2026-08-27T08:00:00.000Z',
        sender: { id: 123, username: 'trader_alex', firstName: 'Alex' },
        chat: { id: 123, type: 'private' },
      },
      {
        id: 'msg_1787815200000_1002',
        messageId: 1002,
        text: 'Fed interest rate decision tomorrow, keep an eye on yields and $TLT',
        date: 1787815250,
        timestamp: '2026-08-27T08:00:50.000Z',
        sender: { id: 123, username: 'trader_alex', firstName: 'Alex' },
        chat: { id: 123, type: 'private' },
      },
    ];

    // Mock global fetch
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        count: 2,
        messages: mockMessages,
      }),
    } as any);

    const createdRecords: any[] = [];
    const mockPrisma = {
      thoughtLog: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          const rec = { id: `log-${createdRecords.length + 1}`, ...data };
          createdRecords.push(rec);
          return rec;
        }),
      },
    } as any;

    const result = await consumeTelegramBuffer(mockPrisma);

    expect(fetchSpy).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.consumedCount).toBe(2);
    expect(createdRecords.length).toBe(2);

    // Verify first record
    expect(createdRecords[0].symbols).toContain('NVDA');
    expect(createdRecords[0].symbols).toContain('AMD');
    expect(createdRecords[0].sentiment).toBe('BULLISH');
    expect(createdRecords[0].tags).toContain('Telegram');
    expect(createdRecords[0].tags).toContain('@trader_alex');

    // Verify second record
    expect(createdRecords[1].symbols).toContain('TLT');
    expect(createdRecords[1].sentiment).toBe('MACRO');
  });

  it('should handle empty buffer gracefully', async () => {
    process.env.TELEGRAM_BUFFER_URL = 'https://telegram-thought-buffer.workers.dev/consume';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        count: 0,
        messages: [],
      }),
    } as any);

    const mockPrisma = {
      thoughtLog: { create: vi.fn() },
    } as any;

    const result = await consumeTelegramBuffer(mockPrisma);
    expect(result.success).toBe(true);
    expect(result.consumedCount).toBe(0);
    expect(mockPrisma.thoughtLog.create).not.toHaveBeenCalled();
  });

  it('should deduplicate messages arriving simultaneously from Cloudflare buffer and direct getUpdates', async () => {
    process.env.TELEGRAM_BUFFER_URL = 'https://telegram-thought-buffer.workers.dev/consume';
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token_123';

    const duplicateMsg: BufferedTelegramMessage = {
      id: 'msg_1787815200000_9999',
      messageId: 9999,
      text: 'Oust short put 16 19 February 2027',
      date: 1787815200,
      timestamp: '2026-10-16T18:33:43.000Z',
      sender: { id: 8959, username: 'testuser' },
      chat: { id: -1003872409872, type: 'supergroup' },
    };

    // First fetch call is to TELEGRAM_BUFFER_URL
    // Second fetch call is to Telegram Bot API getUpdates
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          count: 1,
          messages: [duplicateMsg],
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: [
            {
              update_id: 555001,
              message: {
                message_id: 9999,
                date: 1787815200,
                text: 'Oust short put 16 19 February 2027',
                from: { id: 8959, username: 'testuser' },
                chat: { id: -1003872409872, type: 'supergroup' },
              },
            },
          ],
        }),
      } as any);

    const createdRecords: any[] = [];
    const mockPrisma = {
      thoughtLog: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          const rec = { id: `log-${createdRecords.length + 1}`, ...data };
          createdRecords.push(rec);
          return rec;
        }),
      },
    } as any;

    const result = await consumeTelegramBuffer(mockPrisma);

    expect(result.success).toBe(true);
    // Even though it was returned by BOTH Cloudflare Worker and Telegram getUpdates,
    // exactly ONE message was processed and ingested!
    expect(result.consumedCount).toBe(1);
    expect(createdRecords.length).toBe(1);
  });
});
