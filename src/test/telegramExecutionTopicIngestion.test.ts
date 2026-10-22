import {
  consumeTelegramBuffer,
  parseTradeExecutionCandidates,
  formatTelegramExecutionSummary,
  clearPersistedDedupKeysForTest,
} from '../../server/services/telegramBufferConsumerService';

describe('Telegram Execution Topic Ingestion & Trade Queue Processing', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearPersistedDedupKeysForTest();
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

    // Lowercase ticker: buy 100 aapl @ 150
    const trade5 = parseTradeExecutionCandidates('buy 100 aapl @ 150 sl 140');
    expect(trade5).toHaveLength(1);
    expect(trade5[0].symbol).toBe('AAPL');
    expect(trade5[0].action).toBe('BUY');
    expect(trade5[0].quantity).toBe(100);
    expect(trade5[0].targetPrice).toBe(150);
    expect(trade5[0].stopLoss).toBe(140);

    // Options trade: BTO 2 AAPL 250C 10/18 @ 4.50
    const trade6 = parseTradeExecutionCandidates('BTO 2 AAPL 250C 10/18 @ 4.50');
    expect(trade6).toHaveLength(1);
    expect(trade6[0].assetType).toBe('OPTION');
    expect(trade6[0].symbol).toBe('AAPL 250C 10/18');
    expect(trade6[0].underlyingSymbol).toBe('AAPL');
    expect(trade6[0].action).toBe('BTO');
    expect(trade6[0].quantity).toBe(2);
    expect(trade6[0].targetPrice).toBe(4.5);

    // Multi-line batch trade orders
    const multiTrades = parseTradeExecutionCandidates('BUY 100 MSFT @ 420\nSELL 50 TSLA @ 250\nBUY 20 AMD');
    expect(multiTrades).toHaveLength(3);
    expect(multiTrades[0].symbol).toBe('MSFT');
    expect(multiTrades[0].action).toBe('BUY');
    expect(multiTrades[0].quantity).toBe(100);
    expect(multiTrades[0].targetPrice).toBe(420);

    expect(multiTrades[1].symbol).toBe('TSLA');
    expect(multiTrades[1].action).toBe('SELL');
    expect(multiTrades[1].quantity).toBe(50);
    expect(multiTrades[1].targetPrice).toBe(250);

    expect(multiTrades[2].symbol).toBe('AMD');
    expect(multiTrades[2].action).toBe('BUY');
    expect(multiTrades[2].quantity).toBe(20);
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

  it('correctly parses option strategies (short put, covered call, cash-secured put, spreads) and avoids defaulting to BUY 100 shares', () => {
    // 1. Short Put: short put AAPL 150
    const spTrade = parseTradeExecutionCandidates('short put AAPL 150');
    expect(spTrade).toHaveLength(1);
    expect(spTrade[0].symbol).toBe('AAPL 150P');
    expect(spTrade[0].underlyingSymbol).toBe('AAPL');
    expect(spTrade[0].strategy).toBe('Short Put');
    expect(spTrade[0].action).toBe('STO');
    expect(spTrade[0].assetType).toBe('OPTION');
    expect(spTrade[0].quantity).toBe(1); // 1 contract, NOT 100 shares!
    expect(spTrade[0].strikePrice).toBe(150);

    // 2. Covered Call: covered call AAPL 250
    const ccTrade = parseTradeExecutionCandidates('covered call AAPL 250');
    expect(ccTrade).toHaveLength(1);
    expect(ccTrade[0].symbol).toBe('AAPL 250C (Covered Call)');
    expect(ccTrade[0].underlyingSymbol).toBe('AAPL');
    expect(ccTrade[0].strategy).toBe('Covered Call');
    expect(ccTrade[0].action).toBe('COVERED_CALL');
    expect(ccTrade[0].assetType).toBe('OPTION');
    expect(ccTrade[0].quantity).toBe(1);
    expect(ccTrade[0].strikePrice).toBe(250);

    // 3. Covered Call without strike: covered call on TSLA
    const ccTradeNoStrike = parseTradeExecutionCandidates('covered call on TSLA');
    expect(ccTradeNoStrike).toHaveLength(1);
    expect(ccTradeNoStrike[0].symbol).toBe('TSLA Covered Call');
    expect(ccTradeNoStrike[0].underlyingSymbol).toBe('TSLA');
    expect(ccTradeNoStrike[0].strategy).toBe('Covered Call');
    expect(ccTradeNoStrike[0].quantity).toBe(1);

    // 4. Cash-Secured Put: cash secured put NVDA 120
    const cspTrade = parseTradeExecutionCandidates('cash secured put NVDA 120');
    expect(cspTrade).toHaveLength(1);
    expect(cspTrade[0].symbol).toBe('NVDA 120P');
    expect(cspTrade[0].underlyingSymbol).toBe('NVDA');
    expect(cspTrade[0].strategy).toBe('Cash-Secured Put');
    expect(cspTrade[0].action).toBe('STO');
    expect(cspTrade[0].quantity).toBe(1);
    expect(cspTrade[0].strikePrice).toBe(120);

    // 5. Short Put with preposition: short put on SOFI @ 10
    const spPreposition = parseTradeExecutionCandidates('short put on SOFI @ 10');
    expect(spPreposition).toHaveLength(1);
    expect(spPreposition[0].symbol).toBe('SOFI 10P');
    expect(spPreposition[0].underlyingSymbol).toBe('SOFI');
    expect(spPreposition[0].strategy).toBe('Short Put');
    expect(spPreposition[0].quantity).toBe(1);

    // 6. Bull Put Spread: bull put spread AAPL 150/145
    const spreadTrade = parseTradeExecutionCandidates('bull put spread AAPL 150/145');
    expect(spreadTrade).toHaveLength(1);
    expect(spreadTrade[0].symbol).toBe('AAPL 150/145 Spread');
    expect(spreadTrade[0].underlyingSymbol).toBe('AAPL');
    expect(spreadTrade[0].strategy).toBe('Bull Put Spread');
    expect(spreadTrade[0].action).toBe('STO');
    expect(spreadTrade[0].quantity).toBe(1);

    // 7. Multi-contract: 3 short puts AMD 140
    const multiContract = parseTradeExecutionCandidates('3 short puts AMD 140');
    expect(multiContract).toHaveLength(1);
    expect(multiContract[0].symbol).toBe('AMD 140P');
    expect(multiContract[0].underlyingSymbol).toBe('AMD');
    expect(multiContract[0].strategy).toBe('Short Put');
    expect(multiContract[0].quantity).toBe(3);
  });

  it('formats Telegram execution confirmation responses with strategy names instead of generic BUY 100', () => {
    // 1. Short Put confirmation formatting
    const spSummary = formatTelegramExecutionSummary({
      id: 'pt-1',
      symbol: 'AAPL 150P',
      underlyingSymbol: 'AAPL',
      action: 'STO',
      assetType: 'OPTION',
      timeframe: 'DAY',
      orderType: 'LIMIT',
      quantity: 1,
      targetPrice: 2.50,
      conviction: 'HIGH',
      rank: 1,
      status: 'PENDING',
      notes: '[Strategy: Short Put] Strike: $150',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, 'Short Put');

    expect(spSummary).toContain('Short Put: 1 Contract $AAPL 150P');
    expect(spSummary).toContain('@ $2.5 Premium');
    expect(spSummary).not.toContain('BUY 100');
    expect(spSummary).not.toContain('SELL 100');

    // 2. Covered Call confirmation formatting
    const ccSummary = formatTelegramExecutionSummary({
      id: 'pt-2',
      symbol: 'AAPL 250C (Covered Call)',
      underlyingSymbol: 'AAPL',
      action: 'COVERED_CALL',
      assetType: 'OPTION',
      timeframe: 'DAY',
      orderType: 'LIMIT',
      quantity: 1,
      conviction: 'HIGH',
      rank: 2,
      status: 'PENDING',
      notes: '[Strategy: Covered Call] Strike: $250',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, 'Covered Call');

    expect(ccSummary).toContain('Covered Call: 100 Shares + 1x Short Call $AAPL 250C (Covered Call)');
    expect(ccSummary).not.toContain('BUY 100 $AAPL');

    // 3. Cash-Secured Put confirmation formatting
    const cspSummary = formatTelegramExecutionSummary({
      id: 'pt-3',
      symbol: 'NVDA 120P',
      underlyingSymbol: 'NVDA',
      action: 'STO',
      assetType: 'OPTION',
      timeframe: 'DAY',
      orderType: 'LIMIT',
      quantity: 2,
      conviction: 'HIGH',
      rank: 3,
      status: 'PENDING',
      notes: '[Strategy: Cash-Secured Put]',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, 'Cash-Secured Put');

    expect(cspSummary).toContain('Cash-Secured Put: 2 Contracts $NVDA 120P');
    expect(cspSummary).not.toContain('BUY 100');

    // 4. Outright Stock confirmation formatting
    const stockSummary = formatTelegramExecutionSummary({
      id: 'pt-4',
      symbol: 'MSFT',
      underlyingSymbol: 'MSFT',
      action: 'BUY',
      assetType: 'STOCK',
      timeframe: 'DAY',
      orderType: 'LIMIT',
      quantity: 100,
      targetPrice: 420,
      conviction: 'HIGH',
      rank: 4,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(stockSummary).toContain('BUY 100 Shares $MSFT');
  });

  it('dispatches confirmation message with strategy when receiving short put or covered call via execution topic', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token_123';
    const mockMessages = [
      {
        id: 'msg_exec_strategy',
        messageId: 701,
        messageThreadId: 5,
        isTopicMessage: true,
        topicName: 'Execution',
        type: 'text',
        text: 'short put AAPL 150',
        date: Math.floor(Date.now() / 1000),
        timestamp: new Date().toISOString(),
        sender: { id: 9999, username: 'trader_exec' },
        chat: { id: -1003872409872, type: 'supergroup' },
      },
    ];

    let dispatchedTelegramBody: any = null;
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: any) => {
      if (url.includes('/consume')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            count: 1,
            messages: mockMessages,
          }),
        };
      }
      if (url.includes('api.telegram.org')) {
        if (init?.body) {
          dispatchedTelegramBody = JSON.parse(init.body);
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { message_id: 888 } }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const mockPlannedTrades: any[] = [];
    const mockCreatedThoughtLogs: any[] = [];

    const mockPrisma: any = {
      plannedTrade: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const record = { id: 'pt-strat-1', rank: 1, ...data };
          mockPlannedTrades.push(record);
          return record;
        }),
      },
      thoughtLog: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          mockCreatedThoughtLogs.push(data);
          return { id: 'tl-strat-1', ...data };
        }),
      },
    };

    const result = await consumeTelegramBuffer(mockPrisma);

    expect(result.success).toBe(true);
    expect(mockPlannedTrades.length).toBe(1);
    expect(mockPlannedTrades[0].symbol).toBe('AAPL 150P');
    expect(mockPlannedTrades[0].action).toBe('STO');
    expect(mockPlannedTrades[0].quantity).toBe(1);
    expect(mockPlannedTrades[0].notes).toContain('Short Put');

    // Verify Telegram dispatched reply contains strategy name and NOT "BUY 100"
    expect(dispatchedTelegramBody).not.toBeNull();
    expect(dispatchedTelegramBody.text).toContain('Short Put: 1 Contract $AAPL 150P');
    expect(dispatchedTelegramBody.text).not.toContain('BUY 100');
    expect(dispatchedTelegramBody.text).not.toContain('SELL 100');
  });

  it('routes Execution topic reminders to ExecutionReminder model and saves to Execution ThoughtLog', async () => {
    const mockMessages = [
      {
        id: 'msg_rem_1',
        sender: 'trader_user',
        senderLabel: '@trader_user',
        text: 'AAPL roll call spread tomorrow at 10am',
        topicName: 'Execution',
        messageThreadId: 5,
        timestamp: Date.now(),
      },
    ];

    let dispatchedTelegramBody: any = null;

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: any) => {
      if (url.includes('telegram-thought-buffer.workers.dev/consume')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, count: mockMessages.length, messages: mockMessages }),
        };
      }
      if (url.includes('api.telegram.org')) {
        if (init?.body) {
          dispatchedTelegramBody = JSON.parse(init.body);
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { message_id: 777 } }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const mockCreatedReminders: any[] = [];
    const mockCreatedThoughtLogs: any[] = [];

    const mockPrisma: any = {
      executionReminder: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const rec = { id: 'rem-ingest-1', ...data };
          mockCreatedReminders.push(rec);
          return rec;
        }),
      },
      thoughtLog: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          mockCreatedThoughtLogs.push(data);
          return { id: 'tl-rem-1', ...data };
        }),
      },
    };

    const result = await consumeTelegramBuffer(mockPrisma);

    expect(result.success).toBe(true);
    expect(mockCreatedReminders.length).toBe(1);
    expect(mockCreatedReminders[0].symbol).toBe('AAPL');
    expect(mockCreatedReminders[0].task).toBe('Roll call spread');

    // Check Telegram confirmation message
    expect(dispatchedTelegramBody).not.toBeNull();
    expect(dispatchedTelegramBody.text).toContain('Execution Reminder Scheduled');
    expect(dispatchedTelegramBody.text).toContain('$AAPL');
    expect(dispatchedTelegramBody.text).toContain('Roll call spread');

    // Check ThoughtLog
    expect(mockCreatedThoughtLogs.length).toBe(1);
    expect(mockCreatedThoughtLogs[0].folder).toBe('Execution');
    expect(mockCreatedThoughtLogs[0].tags).toContain('SCHEDULE_REMINDER');
    expect(mockCreatedThoughtLogs[0].symbols).toContain('AAPL');
  });
});
