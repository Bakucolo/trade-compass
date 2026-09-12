import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { consumeTelegramBuffer, parseTradeExecutionCandidates } from '../../server/services/telegramBufferConsumerService';

describe('Telegram Execution Topic Ingestion & Trade Queue Processing', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.TELEGRAM_BUFFER_URL = 'https://telegram-thought-buffer.workers.dev/consume';
    process.env.TELEGRAM_BUFFER_SECRET = 'tradecompass_secret_consume_token_2026';
    process.env.TELEGRAM_EXECUTION_THREAD_ID = '5';
    process.env.TELEGRAM_ALERTS_THREAD_ID = '2';
    process.env.TELEGRAM_IDEAS_THREAD_ID = '3';
    process.env.TELEGRAM_APP_THREAD_ID = '10';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('correctly parses structured trade execution instructions from Telegram text', () => {
    // Standard limit order with TP and SL
    const trade1 = parseTradeExecutionCandidates('BUY 100 AAPL @ 150 SL 145 TP 165');
    expect(trade1).toHaveLength(1);
    expect(trade1[0].symbol).toBe('AAPL');
    expect(trade1[0].action).toBe('BUY');
    expect(trade1[0].quantity).toBe(100);
    expect(trade1[0].targetPrice).toBe(150);
    expect(trade1[0].stopLoss).toBe(145);
    expect(trade1[0].targetExit).toBe(165);
    expect(trade1[0].timeframe).toBe('DAY');

    // Weekly short execution
    const trade2 = parseTradeExecutionCandidates('SELL 50 TSLA @ 250 STOP 260 TP 230 WEEKLY');
    expect(trade2).toHaveLength(1);
    expect(trade2[0].symbol).toBe('TSLA');
    expect(trade2[0].action).toBe('SELL');
    expect(trade2[0].quantity).toBe(50);
    expect(trade2[0].targetPrice).toBe(250);
    expect(trade2[0].stopLoss).toBe(260);
    expect(trade2[0].targetExit).toBe(230);
    expect(trade2[0].timeframe).toBe('WEEK');

    // Long shorthand with commas and decimal numbers
    const trade3 = parseTradeExecutionCandidates('LONG NVDA @ 125.50, stop 120.25, target 140.75');
    expect(trade3).toHaveLength(1);
    expect(trade3[0].symbol).toBe('NVDA');
    expect(trade3[0].action).toBe('BUY');
    expect(trade3[0].quantity).toBe(100); // defaults to 100
    expect(trade3[0].targetPrice).toBe(125.5);
    expect(trade3[0].stopLoss).toBe(120.25);
    expect(trade3[0].targetExit).toBe(140.75);

    // Ticker only in execution topic: BUY 100 AMD
    const trade4 = parseTradeExecutionCandidates('BUY 200 AMD');
    expect(trade4).toHaveLength(1);
    expect(trade4[0].symbol).toBe('AMD');
    expect(trade4[0].action).toBe('BUY');
    expect(trade4[0].quantity).toBe(200);
  });

  it('routes Execution topic messages to Execution folder and adds PlannedTrade records to queue', async () => {
    const mockMessages = [
      {
        id: 'msg_exec_1',
        messageId: 501,
        messageThreadId: 5,
        isTopicMessage: true,
        topicName: 'Execution',
        type: 'text',
        text: 'BUY 150 MSFT @ 420 SL 410 TP 445',
        date: Math.floor(Date.now() / 1000),
        timestamp: new Date().toISOString(),
        sender: { id: 9999, username: 'trader_exec' },
        chat: { id: -1003872409872, type: 'supergroup' },
      },
      {
        id: 'msg_exec_2',
        messageId: 502,
        messageThreadId: 99, // custom thread id but named Execution
        isTopicMessage: true,
        topicName: 'Daily Execution Queue',
        type: 'text',
        text: 'SELL 80 QQQ @ 480 STOP 488 TARGET 465 WEEKLY',
        date: Math.floor(Date.now() / 1000),
        timestamp: new Date().toISOString(),
        sender: { id: 9999, username: 'trader_exec' },
        chat: { id: -1003872409872, type: 'supergroup' },
      },
    ];

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/consume')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            count: mockMessages.length,
            messages: mockMessages,
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const mockPlannedTrades: any[] = [];
    const mockCreatedThoughtLogs: any[] = [];

    const mockPrisma: any = {
      plannedTrade: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockImplementation(async ({ where }: any) => {
          return mockPlannedTrades.filter((t) => !where?.timeframe || t.timeframe === where.timeframe);
        }),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const record = { id: `trade-${Date.now()}-${Math.random()}`, ...data };
          mockPlannedTrades.push(record);
          return record;
        }),
      },
      thoughtLog: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const log = { id: `log-${Date.now()}-${Math.random()}`, ...data };
          mockCreatedThoughtLogs.push(log);
          return log;
        }),
      },
      priceAlert: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'dummy-alert' }),
      },
      tradeIdea: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'dummy-idea' }),
      },
    };

    const result = await consumeTelegramBuffer(mockPrisma);

    expect(result.success).toBe(true);
    expect(result.consumedCount).toBe(2);

    // Verify PlannedTrade records in SQLite
    expect(mockPlannedTrades.length).toBe(2);

    // 1st Trade: MSFT
    expect(mockPlannedTrades[0].symbol).toBe('MSFT');
    expect(mockPlannedTrades[0].action).toBe('BUY');
    expect(mockPlannedTrades[0].quantity).toBe(150);
    expect(mockPlannedTrades[0].targetPrice).toBe(420);
    expect(mockPlannedTrades[0].stopLoss).toBe(410);
    expect(mockPlannedTrades[0].targetExit).toBe(445);
    expect(mockPlannedTrades[0].timeframe).toBe('DAY');
    expect(mockPlannedTrades[0].status).toBe('PENDING');

    // 2nd Trade: QQQ (Weekly)
    expect(mockPlannedTrades[1].symbol).toBe('QQQ');
    expect(mockPlannedTrades[1].action).toBe('SELL');
    expect(mockPlannedTrades[1].quantity).toBe(80);
    expect(mockPlannedTrades[1].targetPrice).toBe(480);
    expect(mockPlannedTrades[1].stopLoss).toBe(488);
    expect(mockPlannedTrades[1].targetExit).toBe(465);
    expect(mockPlannedTrades[1].timeframe).toBe('WEEK');
    expect(mockPlannedTrades[1].status).toBe('PENDING');

    // Verify ThoughtLog records saved in 'Execution' folder
    expect(mockCreatedThoughtLogs.length).toBe(2);

    expect(mockCreatedThoughtLogs[0].folder).toBe('Execution');
    expect(mockCreatedThoughtLogs[0].title).toContain('🎯 BUY 150 MSFT');
    expect(mockCreatedThoughtLogs[0].tags).toContain('Execution');
    expect(mockCreatedThoughtLogs[0].tags).toContain('Queue');
    expect(mockCreatedThoughtLogs[0].agentOutput).toContain('Daily & Weekly Trade Execution Queue');
    expect(mockCreatedThoughtLogs[0].agentOutput).toContain('PENDING');

    expect(mockCreatedThoughtLogs[1].folder).toBe('Execution');
    expect(mockCreatedThoughtLogs[1].title).toContain('🎯 SELL 80 QQQ');
    expect(mockCreatedThoughtLogs[1].tags).toContain('Execution');
    expect(mockCreatedThoughtLogs[1].tags).toContain('Queue');
    expect(mockCreatedThoughtLogs[1].agentOutput).toContain('WEEK');
  });

  it('detects Execution topic via hashtag #execution or target emoji 🎯 even if topicName is absent', async () => {
    const mockMessages = [
      {
        id: 'msg_exec_tag',
        messageId: 601,
        messageThreadId: 0,
        isTopicMessage: false,
        type: 'text',
        text: '🎯 BUY 200 GOOGL @ 175 SL 170 TP 190 #trade-execution',
        date: Math.floor(Date.now() / 1000),
        timestamp: new Date().toISOString(),
        sender: { id: 9999, username: 'trader_exec' },
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

    const mockPlannedTrades: any[] = [];
    const mockCreatedThoughtLogs: any[] = [];

    const mockPrisma: any = {
      plannedTrade: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          mockPlannedTrades.push(data);
          return { id: 'pt-1', ...data };
        }),
      },
      thoughtLog: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          mockCreatedThoughtLogs.push(data);
          return { id: 'tl-1', ...data };
        }),
      },
    };

    const result = await consumeTelegramBuffer(mockPrisma);

    expect(result.success).toBe(true);
    expect(mockPlannedTrades.length).toBe(1);
    expect(mockPlannedTrades[0].symbol).toBe('GOOGL');
    expect(mockPlannedTrades[0].quantity).toBe(200);
    expect(mockPlannedTrades[0].targetPrice).toBe(175);
    expect(mockCreatedThoughtLogs[0].folder).toBe('Execution');
  });
});
