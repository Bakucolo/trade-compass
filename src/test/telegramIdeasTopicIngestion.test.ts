import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  consumeTelegramBuffer,
  saveSymbolsToWatchlist,
  BufferedTelegramMessage,
} from '../../server/services/telegramBufferConsumerService';

describe('Telegram Ideas Topic Ingestion & Direct Watchlist Option', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.TELEGRAM_BUFFER_URL = 'https://telegram-thought-buffer.workers.dev/consume';
    process.env.TELEGRAM_BUFFER_SECRET = 'tradecompass_secret_consume_token_2026';
    process.env.TELEGRAM_ALERTS_THREAD_ID = '2';
    process.env.TELEGRAM_APP_THREAD_ID = '10';
    process.env.TELEGRAM_IDEAS_THREAD_ID = '15';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('routes messages from Telegram topic "ideas" into the Ideas folder', async () => {
    const mockMessages: BufferedTelegramMessage[] = [
      {
        id: 'msg_idea_1',
        messageId: 501,
        messageThreadId: 15,
        isTopicMessage: true,
        topicName: 'Ideas',
        type: 'text',
        text: 'PLTR looks primed for a breakout above 32 with massive government contract tailwinds',
        date: Math.floor(Date.now() / 1000),
        timestamp: new Date().toISOString(),
        sender: { id: 777, username: 'idea_scout', firstName: 'Scout' },
        chat: { id: -1003872409872, type: 'supergroup', title: 'Trading Desk' },
      },
      {
        id: 'msg_idea_2',
        messageId: 502,
        isTopicMessage: true,
        topicName: 'ideas',
        type: 'text',
        text: 'AMD semiconductor momentum building for datacenter GPU share gains',
        date: Math.floor(Date.now() / 1000),
        timestamp: new Date().toISOString(),
        sender: { id: 777, username: 'idea_scout' },
        chat: { id: -1003872409872, type: 'supergroup' },
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        count: mockMessages.length,
        messages: mockMessages,
      }),
    });

    const mockCreatedThoughtLogs: any[] = [];
    const mockPrisma: any = {
      thoughtLog: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const log = { id: `log-${Date.now()}-${Math.random()}`, ...data };
          mockCreatedThoughtLogs.push(log);
          return log;
        }),
      },
      watchlist: {
        findFirst: vi.fn().mockResolvedValue({ id: 'wl-default-1', name: 'Main Watchlist', isDefault: true }),
        create: vi.fn().mockResolvedValue({ id: 'wl-default-1', name: 'Watchlist', isDefault: true }),
      },
      watchlistItem: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'wli-1', watchlistId: 'wl-default-1', symbol: 'PLTR' }),
      },
    };

    const result = await consumeTelegramBuffer(mockPrisma);

    expect(result.success).toBe(true);
    expect(result.consumedCount).toBe(2);

    expect(mockCreatedThoughtLogs.length).toBe(2);

    // Idea 1 routed to Ideas folder
    expect(mockCreatedThoughtLogs[0].folder).toBe('Ideas');
    expect(mockCreatedThoughtLogs[0].title).toContain('PLTR');
    expect(mockCreatedThoughtLogs[0].title).toContain('💡 Idea:');
    expect(mockCreatedThoughtLogs[0].tags).toContain('Ideas');
    expect(mockCreatedThoughtLogs[0].tags).toContain('Telegram');
    expect(mockCreatedThoughtLogs[0].symbols).toContain('PLTR');

    // Idea 2 routed to Ideas folder
    expect(mockCreatedThoughtLogs[1].folder).toBe('Ideas');
    expect(mockCreatedThoughtLogs[1].title).toContain('AMD');
    expect(mockCreatedThoughtLogs[1].title).toContain('💡 Idea:');
    expect(mockCreatedThoughtLogs[1].tags).toContain('Ideas');
    expect(mockCreatedThoughtLogs[1].symbols).toContain('AMD');
  });

  it('saves symbol directly to Watchlist when #watchlist directive is included in Telegram idea', async () => {
    const mockMessages: BufferedTelegramMessage[] = [
      {
        id: 'msg_idea_wl',
        messageId: 601,
        messageThreadId: 15,
        isTopicMessage: true,
        topicName: 'Ideas',
        type: 'text',
        text: 'MSFT cloud growth re-accelerating #watchlist',
        date: Math.floor(Date.now() / 1000),
        timestamp: new Date().toISOString(),
        sender: { id: 777, username: 'trader_dan' },
        chat: { id: -1003872409872, type: 'supergroup' },
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        count: 1,
        messages: mockMessages,
      }),
    });

    const mockWatchlistItems: any[] = [];
    const mockCreatedThoughtLogs: any[] = [];

    const mockPrisma: any = {
      thoughtLog: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const log = { id: `log-${Date.now()}`, ...data };
          mockCreatedThoughtLogs.push(log);
          return log;
        }),
      },
      watchlist: {
        findFirst: vi.fn().mockResolvedValue({ id: 'wl-default-1', name: 'Primary Tech', isDefault: true }),
        create: vi.fn().mockResolvedValue({ id: 'wl-default-1', name: 'Watchlist', isDefault: true }),
      },
      watchlistItem: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const item = { id: `wli-${Date.now()}`, ...data };
          mockWatchlistItems.push(item);
          return item;
        }),
      },
    };

    const result = await consumeTelegramBuffer(mockPrisma);

    expect(result.success).toBe(true);
    expect(mockCreatedThoughtLogs.length).toBe(1);
    expect(mockCreatedThoughtLogs[0].folder).toBe('Ideas');
    expect(mockCreatedThoughtLogs[0].tags).toContain('Watchlist');
    expect(mockCreatedThoughtLogs[0].agentOutput).toContain('Saved to Watchlist');

    // Verify symbol added to Watchlist
    expect(mockWatchlistItems.length).toBe(1);
    expect(mockWatchlistItems[0].watchlistId).toBe('wl-default-1');
    expect(mockWatchlistItems[0].symbol).toBe('MSFT');
  });

  it('saveSymbolsToWatchlist helper correctly inserts symbols into default or named watchlist', async () => {
    const mockWatchlistItems: any[] = [];
    const mockPrisma: any = {
      watchlist: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          if (where?.name?.equals === 'Growth Stars') {
            return { id: 'wl-growth-1', name: 'Growth Stars', isDefault: false };
          }
          return { id: 'wl-default-1', name: 'Default Watchlist', isDefault: true };
        }),
        create: vi.fn().mockResolvedValue({ id: 'wl-default-1', name: 'Watchlist', isDefault: true }),
      },
      watchlistItem: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          mockWatchlistItems.push(data);
          return data;
        }),
      },
    };

    // Save to default watchlist
    const defaultRes = await saveSymbolsToWatchlist(mockPrisma, ['NVDA', 'AAPL']);
    expect(defaultRes?.added).toEqual(['NVDA', 'AAPL']);
    expect(defaultRes?.watchlistName).toBe('Default Watchlist');
    expect(mockWatchlistItems.length).toBe(2);

    // Save to named watchlist
    const customRes = await saveSymbolsToWatchlist(mockPrisma, ['TSLA'], 'Growth Stars');
    expect(customRes?.added).toEqual(['TSLA']);
    expect(customRes?.watchlistName).toBe('Growth Stars');
    expect(mockWatchlistItems.length).toBe(3);
  });
});
