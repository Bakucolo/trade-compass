import { describe, it, expect, vi } from 'vitest';
import {
  fetchThoughtLogs,
  fetchThoughtLogFolders,
  createThoughtLog,
  updateThoughtLog,
  bulkMoveThoughtLogs,
  markThoughtLogAsRead,
  markAllThoughtLogsAsRead,
} from '../../src/services/thoughtLogService';
import { consumeTelegramBuffer } from '../../server/services/telegramBufferConsumerService';

describe('ThoughtLog Folder Management & Telegram Categorization', () => {
  it('should query thought logs by specific folder filter', async () => {
    const originalFetch = global.fetch;
    let requestedUrl = '';

    global.fetch = vi.fn().mockImplementation((url: string) => {
      requestedUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: 'log-1',
            title: 'Energy DCA Thesis',
            content: 'Scaling into $CCJ',
            folder: 'Ideas',
            tags: 'Nuclear, Energy',
            symbols: 'CCJ',
            sentiment: 'BULLISH',
            isPinned: false,
            createdAt: '2026-08-27T10:00:00Z',
          },
        ],
      });
    }) as any;

    try {
      const logs = await fetchThoughtLogs({ folder: 'Ideas' });

      expect(requestedUrl).toContain('/api/thought-logs?folder=Ideas');
      expect(logs.length).toBe(1);
      expect(logs[0].folder).toBe('Ideas');

      // Test querying ALL folder
      await fetchThoughtLogs({ folder: 'ALL' });
      expect(requestedUrl).toContain('/api/thought-logs?folder=ALL');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should fetch folder statistics including baseline and custom folders', async () => {
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        totalCount: 15,
        unfiledCount: 4,
        telegramCount: 6,
        voiceCount: 2,
        folders: [
          { name: 'Ideas', count: 5 },
          { name: 'Research', count: 4 },
          { name: 'Telegram', count: 4 },
          { name: 'Voice Notes', count: 2 },
        ],
      }),
    } as any);

    try {
      const stats = await fetchThoughtLogFolders();

      expect(stats).toBeDefined();
      expect(stats.totalCount).toBe(15);
      expect(stats.unfiledCount).toBe(4);
      expect(stats.telegramCount).toBe(6);
      expect(stats.folders.find((f) => f.name === 'Ideas')?.count).toBe(5);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should create and update thought log with designated folder', async () => {
    const originalFetch = global.fetch;
    let sentBody: any = null;

    global.fetch = vi.fn().mockImplementation((url: string, options: any) => {
      sentBody = JSON.parse(options.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'log-created-1',
          ...sentBody,
          createdAt: new Date().toISOString(),
        }),
      });
    }) as any;

    try {
      const created = await createThoughtLog({
        title: 'Macro Policy Pivot',
        content: 'Fed cutting 50bps in September',
        folder: 'Macro',
      });

      expect(sentBody.folder).toBe('Macro');
      expect(created.folder).toBe('Macro');

      // Update folder
      const updated = await updateThoughtLog('log-created-1', {
        folder: 'Research',
      });

      expect(sentBody.folder).toBe('Research');
      expect(updated.folder).toBe('Research');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should support bulk moving multiple thought logs to a target folder', async () => {
    const originalFetch = global.fetch;
    let sentPayload: any = null;

    global.fetch = vi.fn().mockImplementation((url: string, options: any) => {
      sentPayload = JSON.parse(options.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          count: 3,
          folder: 'Watchlist',
        }),
      });
    }) as any;

    try {
      const result = await bulkMoveThoughtLogs({
        ids: ['log-1', 'log-2', 'log-3'],
        folder: 'Watchlist',
      });

      expect(sentPayload.ids).toEqual(['log-1', 'log-2', 'log-3']);
      expect(sentPayload.folder).toBe('Watchlist');
      expect(result.count).toBe(3);
      expect(result.folder).toBe('Watchlist');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should auto-categorize incoming Telegram notes into folders via hashtags', async () => {
    const originalFetch = global.fetch;

    const savedLogs: any[] = [];
    const mockPrisma = {
      thoughtLog: {
        create: vi.fn().mockImplementation(({ data }) => {
          const item = { id: `log-${Date.now()}`, ...data };
          savedLogs.push(item);
          return Promise.resolve(item);
        }),
      },
    } as any;

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/consume')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            count: 2,
            messages: [
              {
                id: 'msg_1',
                messageId: 101,
                type: 'text',
                text: '#Ideas Looking at $CEG nuclear contracts for Amazon datacenters',
                timestamp: '2026-08-27T10:00:00.000Z',
                sender: { id: 1, username: 'trader' },
              },
              {
                id: 'msg_2',
                messageId: 102,
                type: 'text',
                text: 'Standard thought without hashtag for $NVDA',
                timestamp: '2026-08-27T10:05:00.000Z',
                sender: { id: 1, username: 'trader' },
              },
            ],
          }),
        });
      }
      return Promise.reject(new Error('Unknown fetch: ' + url));
    }) as any;

    try {
      process.env.TELEGRAM_BUFFER_URL = 'https://telegram-thought-buffer.financy-appy-bot.workers.dev';

      const result = await consumeTelegramBuffer(mockPrisma);

      expect(result.success).toBe(true);
      expect(savedLogs.length).toBe(2);

      // First note with hashtag should be routed to "Ideas"
      expect(savedLogs[0].folder).toBe('Ideas');

      // Second note without hashtag should default to "Telegram"
      expect(savedLogs[1].folder).toBe('Telegram');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should support drag-and-drop moving a note to a new target folder', async () => {
    const originalFetch = global.fetch;
    let sentBody: any = null;

    global.fetch = vi.fn().mockImplementation((url: string, options: any) => {
      sentBody = JSON.parse(options.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'log-drag-1',
          title: 'Quantum Computing Overhang',
          content: 'IBM & IONQ roadmap',
          folder: sentBody.folder,
          updatedAt: new Date().toISOString(),
        }),
      });
    }) as any;

    try {
      // Simulate drag and drop from General -> Research
      const updated = await updateThoughtLog('log-drag-1', {
        folder: 'Research',
      });

      expect(sentBody.folder).toBe('Research');
      expect(updated.folder).toBe('Research');
      expect(updated.id).toBe('log-drag-1');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should query unread thought logs using the UNREAD folder filter', async () => {
    const originalFetch = global.fetch;
    let requestedUrl = '';

    global.fetch = vi.fn().mockImplementation((url: string) => {
      requestedUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: 'unread-log-1',
            title: 'Unread Telegram message',
            content: 'Check $SMCI earnings',
            folder: 'Telegram',
            isRead: false,
            createdAt: '2026-09-03T10:00:00Z',
          },
        ],
      });
    }) as any;

    try {
      const logs = await fetchThoughtLogs({ folder: 'UNREAD' });
      expect(requestedUrl).toContain('/api/thought-logs?folder=UNREAD');
      expect(logs.length).toBe(1);
      expect(logs[0].isRead).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should mark a thought log as read via markThoughtLogAsRead', async () => {
    const originalFetch = global.fetch;
    let requestedUrl = '';
    let requestOptions: any = null;

    global.fetch = vi.fn().mockImplementation((url: string, options: any) => {
      requestedUrl = url;
      requestOptions = options;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'unread-log-1',
          title: 'Opened note',
          isRead: true,
          readAt: '2026-09-03T11:00:00Z',
        }),
      });
    }) as any;

    try {
      const result = await markThoughtLogAsRead('unread-log-1', true);
      expect(requestedUrl).toContain('/api/thought-logs/unread-log-1/read');
      expect(requestOptions.method).toBe('PATCH');
      expect(JSON.parse(requestOptions.body)).toEqual({ isRead: true });
      expect(result.isRead).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should mark all unread thought logs as read via markAllThoughtLogsAsRead', async () => {
    const originalFetch = global.fetch;
    let requestedUrl = '';
    let requestOptions: any = null;

    global.fetch = vi.fn().mockImplementation((url: string, options: any) => {
      requestedUrl = url;
      requestOptions = options;
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, count: 5 }),
      });
    }) as any;

    try {
      const result = await markAllThoughtLogsAsRead();
      expect(requestedUrl).toContain('/api/thought-logs/mark-all-read');
      expect(requestOptions.method).toBe('POST');
      expect(result.success).toBe(true);
      expect(result.count).toBe(5);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

