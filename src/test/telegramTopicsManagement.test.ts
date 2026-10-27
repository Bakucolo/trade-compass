// src/test/telegramTopicsManagement.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isTopicsManagementRequest,
  setGenericTopicThreadId,
  buildTopicsOverviewReport,
  handleTopicsManagementMessage,
} from '../../server/services/telegramTopicsManagementService';
import { handleNotesTopicMessage, extractNoteSymbol } from '../../server/services/telegramNotesTopicService';
import { handleExecutionTopicMessage } from '../../server/services/telegramExecutionTopicService';
import { handleAlertsTopicMessage } from '../../server/services/telegramAlertsTopicService';
import { handleAppTopicMessage } from '../../server/services/telegramAppTopicService';
import { handleIdeasTopicMessage } from '../../server/services/telegramIdeasTopicService';

// Mock telegram report service
vi.mock('../../server/services/telegramReportService', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true }),
}));

// Mock prisma client factory
function createMockPrisma() {
  const notesStore: any[] = [];
  const tradesStore: any[] = [];
  const alertsStore: any[] = [];
  const appIdeasStore: any[] = [];
  const thoughtLogsStore: any[] = [];

  return {
    notesStore,
    tradesStore,
    alertsStore,
    appIdeasStore,
    thoughtLogsStore,
    prisma: {
      thoughtLog: {
        findMany: vi.fn(async (args: any) => {
          let items = [...thoughtLogsStore];
          if (args?.where?.folder) {
            items = items.filter((x) => x.folder === args.where.folder);
          }
          if (args?.where?.tags?.contains) {
            items = items.filter((x) => x.tags?.includes(args.where.tags.contains));
          }
          if (args?.where?.OR) {
            items = items.filter((x) =>
              args.where.OR.some((cond: any) => {
                if (cond.title?.contains) return x.title?.includes(cond.title.contains);
                if (cond.tags?.contains) return x.tags?.includes(cond.tags.contains);
                if (cond.content?.contains) return x.content?.includes(cond.content.contains);
                return false;
              })
            );
          }
          return items.slice(0, args?.take || 50);
        }),
        create: vi.fn(async (args: any) => {
          const item = { id: `log-${Date.now()}-${Math.random()}`, ...args.data };
          thoughtLogsStore.push(item);
          return item;
        }),
        deleteMany: vi.fn(async () => ({ count: 1 })),
        count: vi.fn(async () => thoughtLogsStore.length),
      },
      stockNote: {
        findUnique: vi.fn(async (args: any) => {
          return notesStore.find((n) => n.symbol === args?.where?.symbol) || null;
        }),
        findFirst: vi.fn(async (args: any) => {
          return notesStore.find((n) => n.symbol === args?.where?.symbol?.equals) || null;
        }),
        findMany: vi.fn(async (args: any) => {
          return notesStore.slice(0, args?.take || 50);
        }),
        upsert: vi.fn(async (args: any) => {
          const existingIdx = notesStore.findIndex((n) => n.symbol === args?.where?.symbol);
          if (existingIdx >= 0) {
            notesStore[existingIdx] = { ...notesStore[existingIdx], ...args.update };
            return notesStore[existingIdx];
          }
          const item = { id: `note-${Date.now()}`, ...args.create };
          notesStore.push(item);
          return item;
        }),
        delete: vi.fn(async (args: any) => {
          const idx = notesStore.findIndex((n) => n.symbol === args?.where?.symbol);
          if (idx >= 0) {
            const [removed] = notesStore.splice(idx, 1);
            return removed;
          }
          return null;
        }),
        deleteMany: vi.fn(async (args: any) => {
          const initialLen = notesStore.length;
          const filtered = notesStore.filter((n) => n.symbol !== args?.where?.symbol?.equals);
          const removed = initialLen - filtered.length;
          notesStore.length = 0;
          notesStore.push(...filtered);
          return { count: removed };
        }),
        count: vi.fn(async () => notesStore.length),
      },
      plannedTrade: {
        findMany: vi.fn(async (args: any) => {
          let items = [...tradesStore];
          if (args?.where?.symbol?.equals) {
            items = items.filter((t) => t.symbol === args.where.symbol.equals);
          }
          if (args?.where?.status?.in) {
            items = items.filter((t) => args.where.status.in.includes(t.status));
          }
          return items;
        }),
        create: vi.fn(async (args: any) => {
          const item = { id: `trade-${Date.now()}`, status: 'PENDING', ...args.data };
          tradesStore.push(item);
          return item;
        }),
        deleteMany: vi.fn(async (args: any) => {
          const initialLen = tradesStore.length;
          const filtered = tradesStore.filter((t) => t.symbol !== args?.where?.symbol?.equals);
          const removed = initialLen - filtered.length;
          tradesStore.length = 0;
          tradesStore.push(...filtered);
          return { count: removed };
        }),
        count: vi.fn(async () => tradesStore.length),
      },
      priceAlert: {
        findFirst: vi.fn(async (args: any) => {
          return alertsStore.find((a) => a.symbol === args?.where?.symbol?.equals) || null;
        }),
        findMany: vi.fn(async (args: any) => {
          let items = [...alertsStore];
          if (args?.where?.symbol?.equals) {
            items = items.filter((a) => a.symbol === args.where.symbol.equals);
          }
          if (args?.where?.status?.in) {
            items = items.filter((a) => args.where.status.in.includes(a.status));
          }
          return items;
        }),
        create: vi.fn(async (args: any) => {
          const item = { id: `alert-${Date.now()}`, status: 'ACTIVE', ...args.data };
          alertsStore.push(item);
          return item;
        }),
        deleteMany: vi.fn(async (args: any) => {
          const initialLen = alertsStore.length;
          const filtered = alertsStore.filter((a) => {
            if (args?.where?.symbol?.equals && a.symbol === args.where.symbol.equals) return false;
            if (!args?.where?.symbol && args?.where?.status?.in && args.where.status.in.includes(a.status)) return false;
            if (!args?.where || Object.keys(args.where).length === 0) return false;
            return true;
          });
          const removed = initialLen - filtered.length;
          alertsStore.length = 0;
          alertsStore.push(...filtered);
          return { count: removed };
        }),
        count: vi.fn(async () => alertsStore.length),
      },
      alert: {
        findMany: vi.fn(async (args: any) => {
          let items = [...alertsStore];
          if (args?.where?.symbol?.equals) {
            items = items.filter((a) => a.symbol === args.where.symbol.equals);
          }
          if (args?.where?.status?.in) {
            items = items.filter((a) => args.where.status.in.includes(a.status));
          }
          return items;
        }),
        create: vi.fn(async (args: any) => {
          const item = { id: `alert-${Date.now()}`, status: 'ACTIVE', ...args.data };
          alertsStore.push(item);
          return item;
        }),
        deleteMany: vi.fn(async (args: any) => {
          const initialLen = alertsStore.length;
          const filtered = alertsStore.filter((a) => {
            if (args?.where?.symbol?.equals && a.symbol === args.where.symbol.equals) return false;
            if (!args?.where?.symbol && args?.where?.status?.in && args.where.status.in.includes(a.status)) return false;
            if (!args?.where || Object.keys(args.where).length === 0) return false;
            return true;
          });
          const removed = initialLen - filtered.length;
          alertsStore.length = 0;
          alertsStore.push(...filtered);
          return { count: removed };
        }),
        count: vi.fn(async () => alertsStore.length),
      },
      appIdea: {
        findMany: vi.fn(async (args: any) => {
          let items = [...appIdeasStore];
          if (args?.where?.isFulfilled !== undefined) {
            items = items.filter((i) => i.isFulfilled === args.where.isFulfilled);
          }
          return items;
        }),
        create: vi.fn(async (args: any) => {
          const item = { id: `idea-${Date.now()}`, isFulfilled: false, ...args.data };
          appIdeasStore.push(item);
          return item;
        }),
        count: vi.fn(async () => appIdeasStore.length),
      },
      watchlist: {
        findMany: vi.fn(async () => [{ id: 'w1', name: 'Core Tech', symbols: JSON.stringify(['AAPL', 'MSFT', 'NVDA']) }]),
        count: vi.fn(async () => 1),
      },
    } as any,
  };
}

describe('Telegram Topics Management & Multi-Topic Interaction System', () => {
  beforeEach(() => {
    process.env.TELEGRAM_BALANCES_THREAD_ID = '101';
    process.env.TELEGRAM_POSITIONS_THREAD_ID = '102';
    process.env.TELEGRAM_WATCHLIST_THREAD_ID = '103';
    process.env.TELEGRAM_NOTES_THREAD_ID = '104';
    process.env.TELEGRAM_EXECUTION_THREAD_ID = '105';
    process.env.TELEGRAM_ALERTS_THREAD_ID = '106';
    process.env.TELEGRAM_IDEAS_THREAD_ID = '107';
    process.env.TELEGRAM_APP_THREAD_ID = '108';
    process.env.TELEGRAM_REPORT_CHAT_ID = '-10022334455';
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  });

  describe('isTopicsManagementRequest', () => {
    it('detects overview and dashboard status commands', () => {
      expect(isTopicsManagementRequest('topics')).toBe(true);
      expect(isTopicsManagementRequest('topic status')).toBe(true);
      expect(isTopicsManagementRequest('topics status')).toBe(true);
      expect(isTopicsManagementRequest('manage topics')).toBe(true);
      expect(isTopicsManagementRequest('topics overview')).toBe(true);
      expect(isTopicsManagementRequest('topics summary')).toBe(true);
      expect(isTopicsManagementRequest('topics dashboard')).toBe(true);
      expect(isTopicsManagementRequest('overview')).toBe(true);
      expect(isTopicsManagementRequest('🧭 topics')).toBe(true);
      expect(isTopicsManagementRequest('⚙️ topics status')).toBe(true);
    });

    it('detects topic thread mapping commands', () => {
      expect(isTopicsManagementRequest('set topic balances 307')).toBe(true);
      expect(isTopicsManagementRequest('set topic positions 105')).toBe(true);
      expect(isTopicsManagementRequest('link topic execution 400')).toBe(true);
      expect(isTopicsManagementRequest('map topic notes 201')).toBe(true);
      expect(isTopicsManagementRequest('config topic alerts 600')).toBe(true);
    });

    it('detects topic test / ping commands', () => {
      expect(isTopicsManagementRequest('test topic balances')).toBe(true);
      expect(isTopicsManagementRequest('ping topic positions')).toBe(true);
      expect(isTopicsManagementRequest('check topic execution')).toBe(true);
    });

    it('rejects regular market analysis, quotes, or trade messages', () => {
      expect(isTopicsManagementRequest('AAPL')).toBe(false);
      expect(isTopicsManagementRequest('BUY 100 TSLA @ 210')).toBe(false);
      expect(isTopicsManagementRequest('Alert NVDA above $150')).toBe(false);
      expect(isTopicsManagementRequest('Semiconductors NVDA AMD TSM')).toBe(false);
      expect(isTopicsManagementRequest('What is my margin requirement?')).toBe(false);
    });
  });

  describe('setGenericTopicThreadId', () => {
    it('updates balances topic thread ID', () => {
      const res = setGenericTopicThreadId('BALANCES', '991');
      expect(res).toBe(true);
      expect(process.env.TELEGRAM_BALANCES_THREAD_ID).toBe('991');
    });

    it('updates positions topic thread ID', () => {
      const res = setGenericTopicThreadId('POSITIONS', '992');
      expect(res).toBe(true);
      expect(process.env.TELEGRAM_POSITIONS_THREAD_ID).toBe('992');
    });

    it('updates watchlist topic thread ID', () => {
      const res = setGenericTopicThreadId('WATCHLIST', '993');
      expect(res).toBe(true);
      expect(process.env.TELEGRAM_WATCHLIST_THREAD_ID).toBe('993');
    });

    it('updates notes topic thread ID', () => {
      const res = setGenericTopicThreadId('NOTES', '994');
      expect(res).toBe(true);
      expect(process.env.TELEGRAM_NOTES_THREAD_ID).toBe('994');
    });

    it('updates execution topic thread ID', () => {
      const res = setGenericTopicThreadId('EXECUTION', '995');
      expect(res).toBe(true);
      expect(process.env.TELEGRAM_EXECUTION_THREAD_ID).toBe('995');
    });

    it('updates alerts topic thread ID', () => {
      const res = setGenericTopicThreadId('ALERTS', '996');
      expect(res).toBe(true);
      expect(process.env.TELEGRAM_ALERTS_THREAD_ID).toBe('996');
    });

    it('updates ideas topic thread ID', () => {
      const res = setGenericTopicThreadId('IDEAS', '997');
      expect(res).toBe(true);
      expect(process.env.TELEGRAM_IDEAS_THREAD_ID).toBe('997');
    });

    it('updates app topic thread ID', () => {
      const res = setGenericTopicThreadId('APP', '998');
      expect(res).toBe(true);
      expect(process.env.TELEGRAM_APP_THREAD_ID).toBe('998');
    });
  });

  describe('handleTopicsManagementMessage', () => {
    it('returns comprehensive overview report on "topics" command', async () => {
      const { prisma } = createMockPrisma();
      const res = await handleTopicsManagementMessage({
        text: 'topics',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('OVERVIEW');
      expect(res.replyText).toContain('Telegram Topics Control Center');
      expect(res.replyText).toContain('Balances');
      expect(res.replyText).toContain('Positions');
      expect(res.replyText).toContain('Execution');
      expect(res.replyText).toContain('Watchlist');
      expect(res.replyText).toContain('Notes');
      expect(res.replyText).toContain('Alerts');
      expect(res.replyText).toContain('Ideas');
      expect(res.replyText).toContain('App Roadmap');
    });

    it('routes "set topic [name] [id]" and updates the environment', async () => {
      const { prisma } = createMockPrisma();
      const res = await handleTopicsManagementMessage({
        text: 'set topic notes 777',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('SET_THREAD');
      expect(res.replyText).toContain('Topic Thread Updated');
      expect(res.replyText).toContain('777');
      expect(process.env.TELEGRAM_NOTES_THREAD_ID).toBe('777');
    });

    it('routes "test topic [name]" and sends verification ping', async () => {
      const { prisma } = createMockPrisma();
      const res = await handleTopicsManagementMessage({
        text: 'test topic balances',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('TEST_TOPIC');
      expect(res.replyText).toContain('Test Ping Dispatched');
    });
  });

  describe('Notes Topic Checking & Management', () => {
    it('extracts symbol from various note queries', () => {
      expect(extractNoteSymbol('AAPL')).toBe('AAPL');
      expect(extractNoteSymbol('$NVDA')).toBe('NVDA');
      expect(extractNoteSymbol('notes for AAPL')).toBe('AAPL');
      expect(extractNoteSymbol('read MSFT')).toBe('MSFT');
      expect(extractNoteSymbol('delete note TSLA')).toBe('TSLA');
    });

    it('handles "notes" command to list all notes', async () => {
      const { prisma, notesStore } = createMockPrisma();
      notesStore.push(
        { symbol: 'AAPL', notes: 'Bullish thesis on AI phone cycle', updatedAt: new Date() },
        { symbol: 'NVDA', notes: 'Blackwell chip architecture rollout', updatedAt: new Date() }
      );

      const res = await handleNotesTopicMessage({
        text: 'notes',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('LIST');
      expect(res.replyText).toContain('$AAPL');
      expect(res.replyText).toContain('$NVDA');
    });

    it('looks up a single stock note by ticker', async () => {
      const { prisma, notesStore } = createMockPrisma();
      notesStore.push({
        symbol: 'AAPL',
        content: 'Target exit 240, stop loss 210',
        catalysts: 'WWDC 2026',
        rating: 'BULLISH',
        updatedAt: new Date(),
      });

      const res = await handleNotesTopicMessage({
        text: 'read AAPL',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('LOOKUP');
      expect(res.replyText).toContain('Saved Research Note for $AAPL');
      expect(res.replyText).toContain('Target exit 240');
    });

    it('deletes a stock note by ticker', async () => {
      const { prisma, notesStore } = createMockPrisma();
      notesStore.push({ symbol: 'TSLA', content: 'Robotaxi launch' });

      const res = await handleNotesTopicMessage({
        text: 'delete note TSLA',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('DELETE');
      expect(res.replyText).toContain('Note Cleared for $TSLA');
      expect(notesStore).toHaveLength(0);
    });

    it('saves / updates a stock note when note text follows ticker', async () => {
      const { prisma, notesStore } = createMockPrisma();
      const res = await handleNotesTopicMessage({
        text: 'PLTR Enterprise AI momentum accelerates with massive US defense contracts',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('SAVE');
      expect(res.replyText).toContain('Note Saved for $PLTR');
      expect(notesStore).toHaveLength(1);
      expect(notesStore[0].symbol).toBe('PLTR');
    });
  });

  describe('Execution Topic Checking & Management', () => {
    it('handles "queue" or "orders" command to list tactical trades in the queue', async () => {
      const { prisma, tradesStore } = createMockPrisma();
      tradesStore.push({
        symbol: 'AMD',
        action: 'BUY',
        quantity: 100,
        targetPrice: 140,
        stopLoss: 130,
        targetExit: 160,
        status: 'PENDING',
        timeframe: 'SWING',
      });

      const res = await handleExecutionTopicMessage({
        text: 'queue',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('VIEW_QUEUE');
      expect(res.replyText).toContain('Tactical Execution Queue');
      expect(res.replyText).toContain('BUY 100 shares $AMD');
      expect(res.replyText).toContain('140');
    });

    it('looks up status of order for a specific ticker', async () => {
      const { prisma, tradesStore } = createMockPrisma();
      tradesStore.push({
        symbol: 'NVDA',
        action: 'BUY',
        quantity: 50,
        targetPrice: 120,
        stopLoss: 110,
        status: 'READY',
      });

      const res = await handleExecutionTopicMessage({
        text: 'status NVDA',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('STATUS_TICKER');
      expect(res.replyText).toContain('$NVDA');
      expect(res.replyText).toContain('120');
    });

    it('cancels pending order for a ticker', async () => {
      const { prisma, tradesStore } = createMockPrisma();
      tradesStore.push({ symbol: 'TSLA', action: 'SELL', quantity: 20, status: 'PENDING' });

      const res = await handleExecutionTopicMessage({
        text: 'cancel TSLA',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('CANCEL_ORDER');
      expect(res.replyText).toContain('Removed from Execution Queue: $TSLA');
      expect(tradesStore).toHaveLength(0);
    });

    it('creates and queues tactical trade from Telegram command', async () => {
      const { prisma, tradesStore } = createMockPrisma();
      const res = await handleExecutionTopicMessage({
        text: 'BUY 50 MSFT @ 410 SL 395 TP 440',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('CREATE_TRADE');
      expect(res.replyText).toContain('Added to Tactical Execution Queue');
      expect(res.replyText).toContain('$MSFT');
      expect(tradesStore).toHaveLength(1);
      expect(tradesStore[0].symbol).toBe('MSFT');
      expect(tradesStore[0].quantity).toBe(50);
    });
  });

  describe('Alerts Topic Checking & Management', () => {
    it('handles "alerts" command to view all armed price monitors', async () => {
      const { prisma, alertsStore } = createMockPrisma();
      alertsStore.push({
        symbol: 'NVDA',
        condition: 'ABOVE',
        targetPrice: 145,
        status: 'ACTIVE',
      });

      const res = await handleAlertsTopicMessage({
        text: 'alerts',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('VIEW_ALERTS');
      expect(res.replyText).toContain('Active Armed Price Alerts');
      expect(res.replyText).toContain('$NVDA');
      expect(res.replyText).toContain('145');
    });

    it('cancels armed alert for a ticker', async () => {
      const { prisma, alertsStore } = createMockPrisma();
      alertsStore.push({ symbol: 'AAPL', condition: 'BELOW', targetPrice: 200, status: 'ACTIVE' });

      const res = await handleAlertsTopicMessage({
        text: 'cancel alert AAPL',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('CANCEL_ALERT');
      expect(res.replyText).toContain('Price Alert Cancelled: $AAPL');
      expect(alertsStore).toHaveLength(0);
    });

    it('arms new price alert from conversational text', async () => {
      const { prisma, alertsStore } = createMockPrisma();
      const res = await handleAlertsTopicMessage({
        text: 'Alert TSLA above $260',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('CREATE_ALERT');
      expect(res.replyText).toContain('Price Alert Armed');
      expect(alertsStore.length).toBeGreaterThan(0);
    });

    it('arms multiple price alerts from a single message in the alerts topic', async () => {
      const { prisma, alertsStore } = createMockPrisma();
      const res = await handleAlertsTopicMessage({
        text: 'NVDA 145, AAPL 220, TSLA 260',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('CREATE_ALERT');
      expect(res.replyText).toContain('Price Alert Armed');
      expect(res.replyText).toContain('Active Monitors');
      expect(res.replyText).toContain('$NVDA');
      expect(res.replyText).toContain('$AAPL');
      expect(res.replyText).toContain('$TSLA');
      expect(alertsStore.length).toBe(3);
    });

    it('cancels multiple armed alerts in a single message', async () => {
      const { prisma, alertsStore } = createMockPrisma();
      alertsStore.push({ symbol: 'AAPL', condition: 'BELOW', targetPrice: 200, status: 'ACTIVE' });
      alertsStore.push({ symbol: 'TSLA', condition: 'ABOVE', targetPrice: 260, status: 'ACTIVE' });
      alertsStore.push({ symbol: 'NVDA', condition: 'ABOVE', targetPrice: 150, status: 'ACTIVE' });

      const res = await handleAlertsTopicMessage({
        text: 'delete alerts AAPL, TSLA',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('CANCEL_ALERT');
      expect(res.replyText).toContain('Price Alerts Cancelled: $AAPL, $TSLA');
      expect(alertsStore).toHaveLength(1);
      expect(alertsStore[0].symbol).toBe('NVDA');
    });

    it('disarms all active alerts with "clear all alerts"', async () => {
      const { prisma, alertsStore } = createMockPrisma();
      alertsStore.push({ symbol: 'AAPL', condition: 'BELOW', targetPrice: 200, status: 'ACTIVE' });
      alertsStore.push({ symbol: 'TSLA', condition: 'ABOVE', targetPrice: 260, status: 'ACTIVE' });

      const res = await handleAlertsTopicMessage({
        text: 'clear all alerts',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('CANCEL_ALERT');
      expect(res.replyText).toContain('All Price Alerts Disarmed');
      expect(alertsStore).toHaveLength(0);
    });

    it('returns topic help instructions on "?" or "help"', async () => {
      const { prisma } = createMockPrisma();
      const res = await handleAlertsTopicMessage({
        text: '?',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('HELP');
      expect(res.replyText).toContain('Set Alert Topic — Instructions & Commands');
      expect(res.replyText).toContain('Arm New Price Alerts (Single & Multiple)');
    });
  });

  describe('App Topic Checking & Management', () => {
    it('handles "roadmap" or "backlog" to inspect pending features', async () => {
      const { prisma, appIdeasStore } = createMockPrisma();
      appIdeasStore.push({
        title: 'Dark Mode Palette',
        description: 'Add OLED true black theme',
        category: 'UI',
        isFulfilled: false,
      });

      const res = await handleAppTopicMessage({
        text: 'roadmap',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('VIEW_ROADMAP');
      expect(res.replyText).toContain('Trade Compass App Roadmap');
      expect(res.replyText).toContain('Dark Mode Palette');
    });

    it('submits a feature suggestion with category tagging', async () => {
      const { prisma, appIdeasStore } = createMockPrisma();
      const res = await handleAppTopicMessage({
        text: '[UI] Add one-click sync button in sidebar header',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('CREATE_IDEA');
      expect(res.replyText).toContain('App Idea Logged to Roadmap');
      expect(appIdeasStore).toHaveLength(1);
      expect(appIdeasStore[0].category).toBe('UI/UX');
    });
  });

  describe('Ideas Topic Checking & Management', () => {
    it('handles "ideas" to list recent macro & ticker theses', async () => {
      const { prisma, thoughtLogsStore } = createMockPrisma();
      thoughtLogsStore.push({
        title: '💡 Uranium Supercycle',
        content: 'Structural supply deficits favoring nuclear power',
        folder: 'Ideas',
        tags: 'CCJ, SMR, URNM',
        sentiment: 'BULLISH',
        createdAt: new Date(),
      });

      const res = await handleIdeasTopicMessage({
        text: 'ideas',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('VIEW_IDEAS');
      expect(res.replyText).toContain('Recent Market Ideas & Catalysts');
      expect(res.replyText).toContain('Uranium Supercycle');
    });

    it('logs new market thesis with ticker and sentiment detection', async () => {
      const { prisma, thoughtLogsStore } = createMockPrisma();
      const res = await handleIdeasTopicMessage({
        text: 'Long $CCJ due to rising spot uranium prices and utility contract renewals',
        chatId: '-10022334455',
        prisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('CREATE_IDEA');
      expect(res.replyText).toContain('Market Idea Logged');
      expect(thoughtLogsStore).toHaveLength(1);
      expect(thoughtLogsStore[0].folder).toBe('Ideas');
    });
  });
});
