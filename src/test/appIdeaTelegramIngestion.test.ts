import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  consumeTelegramBuffer,
  BufferedTelegramMessage,
} from '../../server/services/telegramBufferConsumerService';

describe('App Ideas Telegram Ingestion & Processing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should route messages from thread 10 (or with App topic) to AppIdea and App ThoughtLog', async () => {
    process.env.TELEGRAM_BUFFER_URL = 'https://telegram-thought-buffer.workers.dev/consume';
    process.env.TELEGRAM_BUFFER_SECRET = 'test_secret_123';
    process.env.TELEGRAM_APP_THREAD_ID = '10';

    const mockMessages: BufferedTelegramMessage[] = [
      {
        id: 'msg_1787815200000_2001',
        messageId: 2001,
        messageThreadId: 10,
        isTopicMessage: true,
        topicName: 'App',
        text: 'Add a dividend tracking calendar with ex-dividend dates\n- Show monthly estimated income\n- Highlight upcoming payouts',
        date: 1787815200,
        timestamp: '2026-09-07T08:00:00.000Z',
        sender: { id: 123, username: 'alex', firstName: 'Alex' },
        chat: { id: -1003872409872, type: 'supergroup', title: 'Dashboard' },
      },
      {
        id: 'msg_1787815200000_2002',
        messageId: 2002,
        messageThreadId: 10,
        isTopicMessage: true,
        topicName: 'App',
        text: '[UI] Add dark mode theme switcher toggle in navbar',
        date: 1787815260,
        timestamp: '2026-09-07T08:01:00.000Z',
        sender: { id: 123, username: 'alex', firstName: 'Alex' },
        chat: { id: -1003872409872, type: 'supergroup', title: 'Dashboard' },
      },
      {
        id: 'msg_1787815200000_2003',
        messageId: 2003,
        text: 'NVDA 120 alert',
        date: 1787815300,
        timestamp: '2026-09-07T08:02:00.000Z',
        sender: { id: 123, username: 'alex', firstName: 'Alex' },
        chat: { id: 8959044574, type: 'private' },
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        count: 3,
        messages: mockMessages,
      }),
    } as any);

    const createdThoughtLogs: any[] = [];
    const createdAppIdeas: any[] = [];

    const mockPrisma = {
      thoughtLog: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          const rec = { id: `log-${createdThoughtLogs.length + 1}`, ...data };
          createdThoughtLogs.push(rec);
          return rec;
        }),
      },
      appIdea: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => {
          const rec = { id: `idea-${createdAppIdeas.length + 1}`, ...data };
          createdAppIdeas.push(rec);
          return rec;
        }),
      },
      priceAlert: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'alert-1', symbol: 'NVDA', targetPrice: 120 }),
      },
    } as any;

    const result = await consumeTelegramBuffer(mockPrisma);

    expect(result.success).toBe(true);
    expect(result.consumedCount).toBe(3);

    // Verify ThoughtLog records
    expect(createdThoughtLogs.length).toBe(3);
    // Idea 1 routed to App folder
    expect(createdThoughtLogs[0].folder).toBe('App');
    expect(createdThoughtLogs[0].title).toContain('Add a dividend tracking calendar');
    expect(createdThoughtLogs[0].isFulfilled).toBe(false);

    // Idea 2 routed to App folder
    expect(createdThoughtLogs[1].folder).toBe('App');
    expect(createdThoughtLogs[1].title).toContain('Add dark mode');

    // Note 3 is regular note
    expect(createdThoughtLogs[2].folder).not.toBe('App');

    // Verify AppIdea records (only the 2 from App topic)
    expect(createdAppIdeas.length).toBe(2);

    // Idea 1 details
    expect(createdAppIdeas[0].title).toBe('Add a dividend tracking calendar with ex-dividend dates');
    expect(createdAppIdeas[0].description).toContain('Show monthly estimated income');
    expect(createdAppIdeas[0].topic).toBe('App');
    expect(createdAppIdeas[0].isFulfilled).toBe(false);
    expect(createdAppIdeas[0].source).toBe('TELEGRAM');

    // Idea 2 details with bracket topic
    expect(createdAppIdeas[1].title).toBe('Add dark mode theme switcher toggle in navbar');
    expect(createdAppIdeas[1].topic).toBe('UI');
    expect(createdAppIdeas[1].category).toBe('UI/UX');
    expect(createdAppIdeas[1].isFulfilled).toBe(false);
  });
});
