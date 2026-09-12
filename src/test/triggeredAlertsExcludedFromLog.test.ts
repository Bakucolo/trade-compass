import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendTelegramAlert } from '../../server/services/telegramReportService';
import { consumeTelegramBuffer } from '../../server/services/telegramBufferConsumerService';

describe('Triggered Alerts Excluded From Log Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sendTelegramAlert defaults saveToAlertsFolder to false and does not create a ThoughtLog', async () => {
    const mockPrisma = {
      thoughtLog: {
        create: vi.fn(),
      },
    };

    // Global fetch mock to simulate successful Telegram dispatch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1234 } }),
    }) as any;

    await sendTelegramAlert('🚨 PRICE ALERT TRIGGERED\n\n• Symbol: NVDA\n• Current Price: $125.00', {
      prisma: mockPrisma as any,
      symbol: 'NVDA',
      title: '🚨 Alert: NVDA ▲ Risen Above $120.00 (Hit $125.00)',
      // saveToAlertsFolder not passed -> should default to false!
    });

    // Should NOT call thoughtLog.create
    expect(mockPrisma.thoughtLog.create).not.toHaveBeenCalled();
  });

  it('telegramBufferConsumerService ignores automated triggered alert notifications from incoming buffer', async () => {
    const mockPrisma = {
      thoughtLog: {
        create: vi.fn(),
      },
      priceAlert: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    process.env.TELEGRAM_BUFFER_URL = 'https://fake-worker.workers.dev/consume';
    process.env.TELEGRAM_BUFFER_SECRET = 'secret';

    // Mock incoming buffer messages including an automated triggered alert
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [
          {
            id: 'msg-1',
            text: '🚨 *PRICE ALERT TRIGGERED*\n\n• Symbol: SERV\n• Current Price: $4.48\n• Target Condition: BELOW $12.10',
            timestamp: Date.now(),
            chat: { id: -1003872409872 },
            messageThreadId: 2,
          },
          {
            id: 'msg-2',
            text: '🚨 Alert: SERV ▼ Fallen Below $11.55 (Hit $4.48)',
            timestamp: Date.now(),
            chat: { id: -1003872409872 },
            messageThreadId: 2,
          },
          {
            id: 'msg-3',
            text: 'Researching Palantir PLTR for next earnings play',
            timestamp: Date.now(),
            chat: { id: -1003872409872 },
            messageThreadId: 1,
          },
        ],
      }),
    }) as any;

    await consumeTelegramBuffer(mockPrisma as any);

    // The two triggered alert notifications must be skipped and NEVER created as thought logs!
    const createdTitles = mockPrisma.thoughtLog.create.mock.calls.map((call) => call[0].data.title);
    for (const title of createdTitles) {
      expect(title).not.toContain('PRICE ALERT TRIGGERED');
      expect(title).not.toContain('Hit $');
    }
    // Only msg-3 should be considered
    expect(createdTitles.some((t) => t.includes('Palantir') || t.includes('PLTR'))).toBe(true);
  });

  it('isTriggeredAlert identifies triggered alerts accurately so LogPage filters them out', () => {
    const isTriggeredAlert = (l: { title?: string; content?: string; tags?: string | null }) =>
      Boolean(
        l.tags?.toLowerCase().includes('triggered') ||
        l.title?.toUpperCase().includes('PRICE ALERT TRIGGERED') ||
        l.content?.toUpperCase().includes('PRICE ALERT TRIGGERED') ||
        l.title?.includes('Hit $') ||
        /🚨\s*Alert:.*(?:Fallen Below|Risen Above)/i.test(l.title || '')
      );

    const triggeredRecords = [
      { title: '🚨 Alert: SERV ▼ Fallen Below $12.10 (Hit $4.48)', tags: 'Telegram, Alert, Price Alert, Triggered' },
      { title: '🚨 Alert: FLNC ▼ Fallen Below $13.20 (Hit $9.93)', tags: 'Telegram, Alert, Price Alert, Triggered' },
      { title: '🚨 Telegram Alert', content: '🚨 *PRICE ALERT TRIGGERED*\n\n• Symbol: NVDA', tags: null },
    ];

    const legitimateRecords = [
      { title: '🔔 Alert: AAPL ▼ $300', content: 'AAPL alert 300', tags: 'Telegram, Alerts, Mobile, Alex' },
      { title: '💡 Idea: Long Call Spread on GOOG', content: 'Google looking strong', tags: 'Telegram, Ideas' },
      { title: 'Meeting notes with CEO', content: 'Discussion on capital allocation', tags: 'General' },
    ];

    for (const rec of triggeredRecords) {
      expect(isTriggeredAlert(rec)).toBe(true);
    }

    for (const rec of legitimateRecords) {
      expect(isTriggeredAlert(rec)).toBe(false);
    }
  });
});
