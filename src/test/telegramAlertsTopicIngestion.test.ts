import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { consumeTelegramBuffer } from '../../server/services/telegramBufferConsumerService';
import { extractPriceAlertCandidates, autoCreateAlertsFromText } from '../../server/services/thoughtLogAlertService';

describe('Telegram Alerts Topic Ingestion & Processing', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.TELEGRAM_BUFFER_URL = 'https://telegram-thought-buffer.workers.dev/consume';
    process.env.TELEGRAM_BUFFER_SECRET = 'tradecompass_secret_consume_token_2026';
    process.env.TELEGRAM_ALERTS_THREAD_ID = '2';
    process.env.TELEGRAM_APP_THREAD_ID = '10';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('extracts percentage-based alerts correctly in extractPriceAlertCandidates', () => {
    const pctBelow = extractPriceAlertCandidates('NVDA -5%');
    expect(pctBelow).toHaveLength(1);
    expect(pctBelow[0].symbol).toBe('NVDA');
    expect(pctBelow[0].percentageOffset).toBe(-5);
    expect(pctBelow[0].condition).toBe('BELOW');

    const pctAbove = extractPriceAlertCandidates('Alert AAPL +10%');
    expect(pctAbove).toHaveLength(1);
    expect(pctAbove[0].symbol).toBe('AAPL');
    expect(pctAbove[0].percentageOffset).toBe(10);
    expect(pctAbove[0].condition).toBe('ABOVE');

    const pctDip = extractPriceAlertCandidates('TSLA 5% dip');
    expect(pctDip).toHaveLength(1);
    expect(pctDip[0].symbol).toBe('TSLA');
    expect(pctDip[0].percentageOffset).toBe(-5);
    expect(pctDip[0].condition).toBe('BELOW');
  });

  it('routes messages from thread 2 (Alerts topic) into Alerts folder and creates PriceAlert', async () => {
    const mockMessages = [
      {
        id: 'msg_alerts_1',
        messageId: 201,
        messageThreadId: 2,
        isTopicMessage: true,
        topicName: 'Alerts',
        type: 'text',
        text: 'NVDA 120',
        date: Math.floor(Date.now() / 1000),
        timestamp: new Date().toISOString(),
        sender: { id: 12345, username: 'trader_dan' },
        chat: { id: -1003872409872, type: 'supergroup' },
      },
      {
        id: 'msg_alerts_2',
        messageId: 202,
        messageThreadId: 2,
        isTopicMessage: true,
        topicName: 'Alerts',
        type: 'text',
        text: 'Alert TSLA below 210',
        date: Math.floor(Date.now() / 1000),
        timestamp: new Date().toISOString(),
        sender: { id: 12345, username: 'trader_dan' },
        chat: { id: -1003872409872, type: 'supergroup' },
      }
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

    const mockCreatedThoughtLogs: any[] = [];
    const mockCreatedPriceAlerts: any[] = [];

    const mockPrisma: any = {
      priceAlert: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const alert = { id: `alert-${Date.now()}-${Math.random()}`, ...data };
          mockCreatedPriceAlerts.push(alert);
          return alert;
        }),
      },
      thoughtLog: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const log = { id: `log-${Date.now()}-${Math.random()}`, ...data };
          mockCreatedThoughtLogs.push(log);
          return log;
        }),
      },
    };

    const result = await consumeTelegramBuffer(mockPrisma);

    expect(result.success).toBe(true);
    expect(result.consumedCount).toBe(2);

    // Verify PriceAlerts created
    expect(mockCreatedPriceAlerts.length).toBe(2);
    expect(mockCreatedPriceAlerts[0].symbol).toBe('NVDA');
    expect(mockCreatedPriceAlerts[0].targetPrice).toBe(120);
    expect(mockCreatedPriceAlerts[0].status).toBe('ACTIVE');

    expect(mockCreatedPriceAlerts[1].symbol).toBe('TSLA');
    expect(mockCreatedPriceAlerts[1].targetPrice).toBe(210);
    expect(mockCreatedPriceAlerts[1].condition).toBe('BELOW');

    // Verify ThoughtLog records saved into 'Alerts' folder
    expect(mockCreatedThoughtLogs.length).toBe(2);
    expect(mockCreatedThoughtLogs[0].folder).toBe('Alerts');
    expect(mockCreatedThoughtLogs[0].title).toContain('NVDA');
    expect(mockCreatedThoughtLogs[0].title).toContain('120');
    expect(mockCreatedThoughtLogs[0].tags).toContain('Alert');

    expect(mockCreatedThoughtLogs[1].folder).toBe('Alerts');
    expect(mockCreatedThoughtLogs[1].title).toContain('TSLA');
    expect(mockCreatedThoughtLogs[1].title).toContain('210');
    expect(mockCreatedThoughtLogs[1].tags).toContain('Alert');
  });

  it('arms proximity alert for ticker-only message in Alerts topic', async () => {
    const mockPrisma: any = {
      priceAlert: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          return { id: 'alert-proximity-1', ...data };
        }),
      },
    };

    // Message sent to alerts topic with just a symbol "AAPL"
    const results = await autoCreateAlertsFromText(mockPrisma, 'AAPL', 'Telegram Note', { isAlertsTopic: true });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].symbol).toBe('AAPL');
    expect(results[0].targetPrice).toBeGreaterThan(0);
    expect(results[0].condition).toBe('BELOW');
  });

  it('saves outbound dispatched alerts into the Alerts folder via sendTelegramAlert', async () => {
    const { sendTelegramAlert } = await import('../../server/services/telegramReportService');
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token';
    process.env.TELEGRAM_CHAT_ID = '-1003872409872';

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 888 } }),
    });

    const mockCreatedThoughtLogs: any[] = [];
    const mockPrisma: any = {
      thoughtLog: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const record = { id: `log-alert-${Date.now()}`, ...data };
          mockCreatedThoughtLogs.push(record);
          return record;
        }),
      },
    };

    const alertText = '🚨 Price Alert Triggered: TSLA crossed $215 (Target: $210)';
    const result = await sendTelegramAlert(alertText, {
      prisma: mockPrisma,
      symbol: 'TSLA',
      title: '🚨 Price Alert: TSLA',
      saveToAlertsFolder: true,
    });

    expect(result.success).toBe(true);
    expect(mockCreatedThoughtLogs.length).toBe(1);
    expect(mockCreatedThoughtLogs[0].folder).toBe('Alerts');
    expect(mockCreatedThoughtLogs[0].title).toBe('🚨 Price Alert: TSLA');
    expect(mockCreatedThoughtLogs[0].content).toBe(alertText);
    expect(mockCreatedThoughtLogs[0].tags).toContain('Alert');
    expect(mockCreatedThoughtLogs[0].symbols).toBe('TSLA');
  });

  it('routes voice notes in the Alerts topic directly into the Alerts folder', async () => {
    const mockVoiceMessage = [
      {
        id: 'msg_alerts_voice',
        messageId: 301,
        messageThreadId: 2,
        isTopicMessage: true,
        topicName: 'Alerts',
        type: 'voice',
        text: 'Watch out for NVDA breaking below 118',
        fileId: 'mock_voice_file_id',
        date: Math.floor(Date.now() / 1000),
        timestamp: new Date().toISOString(),
        sender: { id: 12345, username: 'trader_dan' },
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
            count: 1,
            messages: mockVoiceMessage,
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const mockCreatedThoughtLogs: any[] = [];
    const mockPrisma: any = {
      priceAlert: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: 'alert-1', ...data })),
      },
      thoughtLog: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const log = { id: `log-${Date.now()}`, ...data };
          mockCreatedThoughtLogs.push(log);
          return log;
        }),
      },
    };

    const result = await consumeTelegramBuffer(mockPrisma);
    expect(result.success).toBe(true);
    expect(mockCreatedThoughtLogs.length).toBe(1);
    expect(mockCreatedThoughtLogs[0].folder).toBe('Alerts');
    expect(mockCreatedThoughtLogs[0].tags).toContain('Alerts');
    expect(mockCreatedThoughtLogs[0].tags).toContain('Voice');
  });
});

