import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseAssistantMessage,
  extractDateTimeFromTask,
  parseRelativeOffset,
  formatFriendlyDateTime,
  handleAssistantTopicMessage,
} from '../../server/services/telegramAssistantTopicService';
import {
  setTelegramAssistantThreadId,
  getTelegramBufferStatus,
  topicNameByThreadId,
} from '../../server/services/telegramBufferConsumerService';
import { setGenericTopicThreadId } from '../../server/services/telegramTopicsManagementService';
import {
  getAssistantTopicHelp,
  getHelpMessageForTopic,
} from '../../server/services/telegramTopicHelpService';
import {
  formatDueReminderTelegramAlert,
  checkAndDispatchDueReminders,
} from '../../server/services/executionReminderService';
import * as telegramReportService from '../../server/services/telegramReportService';

describe('Telegram Assistant & Reminders Topic Suite', () => {
  let mockPrisma: any;
  let sentMessages: any[] = [];
  const baseDate = new Date('2026-11-01T12:00:00.000Z'); // Sunday noon

  beforeEach(() => {
    vi.clearAllMocks();
    sentMessages = [];

    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token_123';
    process.env.TELEGRAM_ALERTS_CHAT_ID = '-1003872409872';
    process.env.TELEGRAM_ASSISTANT_THREAD_ID = '777';

    vi.spyOn(telegramReportService, 'sendTelegramMessage').mockImplementation(async (payload: any) => {
      sentMessages.push(payload);
      return { ok: true, result: { message_id: 9999 } };
    });

    mockPrisma = {
      executionReminder: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'rem-1', status: 'PENDING', ...data })
        ),
        update: vi.fn().mockImplementation(({ where, data }: any) =>
          Promise.resolve({ id: where.id, ...data })
        ),
        delete: vi.fn().mockResolvedValue({ id: 'rem-1' }),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        count: vi.fn().mockResolvedValue(3),
      },
      thoughtLog: {
        create: vi.fn().mockResolvedValue({ id: 'log-1', folder: 'Assistant' }),
      },
    };
  });

  describe('Natural Language Date/Time Extraction & Parsing', () => {
    it('should parse relative offsets like in 15m, in 2 hours, 1 day', () => {
      expect(parseRelativeOffset('30m')).toBe(30 * 60 * 1000);
      expect(parseRelativeOffset('2h')).toBe(2 * 60 * 60 * 1000);
      expect(parseRelativeOffset('1 day')).toBe(24 * 60 * 60 * 1000);
      expect(parseRelativeOffset('1 week')).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should extract relative time from task text', () => {
      const res = extractDateTimeFromTask('review AAPL 250 calls in 2 hours', baseDate);
      expect(res).not.toBeNull();
      expect(res?.date.getTime()).toBe(baseDate.getTime() + 2 * 60 * 60 * 1000);
      expect(res?.matchedText).toMatch(/2 hours/i);
    });

    it('should extract tomorrow with specific time', () => {
      const res = extractDateTimeFromTask('buy groceries tomorrow at 5pm', baseDate);
      expect(res).not.toBeNull();
      expect(res?.date.getHours()).toBe(17);
      expect(res?.date.getMinutes()).toBe(0);
      // Date should be advanced by 1 day
      expect(res?.date.getDate()).toBe(baseDate.getDate() + 1);
    });

    it('should extract tonight with default 8pm or specific time', () => {
      const res = extractDateTimeFromTask('prepare earnings notes tonight at 9pm', baseDate);
      expect(res).not.toBeNull();
      expect(res?.date.getHours()).toBe(21);
    });

    it('should extract day of week like Friday at 10am', () => {
      const res = extractDateTimeFromTask('call dentist Friday at 10am', baseDate);
      expect(res).not.toBeNull();
      expect(res?.date.getDay()).toBe(5); // Friday
      expect(res?.date.getHours()).toBe(10);
      expect(res?.date.getMinutes()).toBe(0);
    });

    it('should extract time only like at 4:30pm', () => {
      const res = extractDateTimeFromTask('sync with team at 4:30pm', baseDate);
      expect(res).not.toBeNull();
      expect(res?.date.getHours()).toBe(16);
      expect(res?.date.getMinutes()).toBe(30);
    });

    it('should return null when no time/date is present', () => {
      const res = extractDateTimeFromTask('prepare slide deck for investor pitch', baseDate);
      expect(res).toBeNull();
    });
  });

  describe('Assistant Command Interpretation (parseAssistantMessage)', () => {
    it('identifies HELP commands', () => {
      expect(parseAssistantMessage('help').action).toBe('HELP');
      expect(parseAssistantMessage('/help').action).toBe('HELP');
      expect(parseAssistantMessage('?').action).toBe('HELP');
      expect(parseAssistantMessage('commands').action).toBe('HELP');
      expect(parseAssistantMessage('how to use').action).toBe('HELP');
    });

    it('identifies SUMMARY commands', () => {
      expect(parseAssistantMessage('summary').action).toBe('SUMMARY');
      expect(parseAssistantMessage('briefing').action).toBe('SUMMARY');
      expect(parseAssistantMessage('overview').action).toBe('SUMMARY');
    });

    it('identifies TODAY agenda commands', () => {
      expect(parseAssistantMessage('today').action).toBe('TODAY');
      expect(parseAssistantMessage('agenda').action).toBe('TODAY');
      expect(parseAssistantMessage('schedule').action).toBe('TODAY');
    });

    it('identifies LIST commands', () => {
      expect(parseAssistantMessage('tasks').action).toBe('LIST');
      expect(parseAssistantMessage('list').action).toBe('LIST');
      expect(parseAssistantMessage('todos').action).toBe('LIST');
      expect(parseAssistantMessage('reminders').action).toBe('LIST');
    });

    it('identifies COMPLETE commands', () => {
      const parsed1 = parseAssistantMessage('done 1');
      expect(parsed1.action).toBe('COMPLETE');
      expect(parsed1.targetIdOrQuery).toBe('1');

      const parsed2 = parseAssistantMessage('complete buy groceries');
      expect(parsed2.action).toBe('COMPLETE');
      expect(parsed2.targetIdOrQuery).toBe('buy groceries');

      const parsed3 = parseAssistantMessage('check #2');
      expect(parsed3.action).toBe('COMPLETE');
      expect(parsed3.targetIdOrQuery).toBe('2');
    });

    it('identifies DELETE commands', () => {
      const parsed1 = parseAssistantMessage('del 1');
      expect(parsed1.action).toBe('DELETE');
      expect(parsed1.targetIdOrQuery).toBe('1');

      const parsed2 = parseAssistantMessage('cancel 3');
      expect(parsed2.action).toBe('DELETE');
      expect(parsed2.targetIdOrQuery).toBe('3');

      const parsed3 = parseAssistantMessage('delete call dentist');
      expect(parsed3.action).toBe('DELETE');
      expect(parsed3.targetIdOrQuery).toBe('call dentist');
    });

    it('identifies SNOOZE commands', () => {
      const parsed = parseAssistantMessage('snooze 1 2h');
      expect(parsed.action).toBe('SNOOZE');
      expect(parsed.targetIdOrQuery).toBe('1');
      expect(parsed.snoozeDurationMs).toBe(2 * 60 * 60 * 1000);
    });

    it('identifies CLEAR DONE command', () => {
      expect(parseAssistantMessage('clear done').action).toBe('CLEAR_DONE');
      expect(parseAssistantMessage('clean done').action).toBe('CLEAR_DONE');
    });

    it('creates timed reminder for text containing date/time', () => {
      const parsed = parseAssistantMessage('remind me to buy groceries tomorrow at 5pm', baseDate);
      expect(parsed.action).toBe('CREATE_REMINDER');
      expect(parsed.taskTitle).toBe('Buy groceries');
      expect(parsed.remindAt).not.toBeNull();
      expect(parsed.remindAt?.getHours()).toBe(17);
    });

    it('creates regular task when no time is given', () => {
      const parsed = parseAssistantMessage('finish reading 10-K filing', baseDate);
      expect(parsed.action).toBe('CREATE_TASK');
      expect(parsed.taskTitle).toBe('Finish reading 10-K filing');
      expect(parsed.remindAt).toBeNull();
    });
  });

  describe('Friendly Countdown Formatting', () => {
    it('formats future countdown correctly', () => {
      const future = new Date(baseDate.getTime() + 3 * 60 * 60 * 1000 + 15 * 60 * 1000); // in 3h 15m
      const text = formatFriendlyDateTime(future, baseDate);
      expect(text).toContain('in 3h 15m');
    });

    it('formats overdue countdown correctly', () => {
      const past = new Date(baseDate.getTime() - 45 * 60 * 1000); // 45m ago
      const text = formatFriendlyDateTime(past, baseDate);
      expect(text).toContain('overdue by 45m');
    });
  });

  describe('Topic Configuration & Auto-Discovery', () => {
    it('registers thread via setTelegramAssistantThreadId and updates env & cache', () => {
      const ok = setTelegramAssistantThreadId(777);
      expect(ok).toBe(true);
      expect(process.env.TELEGRAM_ASSISTANT_THREAD_ID).toBe('777');
      expect(topicNameByThreadId.get(777)).toBe('Assistant');

      const status = getTelegramBufferStatus();
      expect(status.assistantThreadId).toBe('777');
    });

    it('handles setGenericTopicThreadId for both ASSISTANT and user typo ASSITANT', () => {
      const ok1 = setGenericTopicThreadId('assistant', 888);
      expect(ok1).toBe(true);
      expect(process.env.TELEGRAM_ASSISTANT_THREAD_ID).toBe('888');

      // User's specific typo "assitant"
      const ok2 = setGenericTopicThreadId('assitant', 999);
      expect(ok2).toBe(true);
      expect(process.env.TELEGRAM_ASSISTANT_THREAD_ID).toBe('999');

      // Reset
      setTelegramAssistantThreadId(777);
    });
  });

  describe('Topic Help Instructions', () => {
    it('provides comprehensive assistant instructions and commands', () => {
      const help = getAssistantTopicHelp();
      expect(help).toContain('Personal Assistant & Reminders');
      expect(help).toContain('tasks');
      expect(help).toContain('today');
      expect(help).toContain('done 1');
      expect(help).toContain('del 1');
      expect(help).toContain('snooze 1');
      expect(help).toContain('clear done');
    });

    it('wires ASSISTANT topic to getHelpMessageForTopic', () => {
      const msg = getHelpMessageForTopic('ASSISTANT');
      expect(msg).toContain('Personal Assistant');
    });
  });

  describe('Interactive Assistant Message Handler', () => {
    it('creates a new scheduled reminder with alarm dispatch', async () => {
      const res = await handleAssistantTopicMessage({
        text: 'buy groceries tomorrow at 5pm',
        chatId: '-1003872409872',
        messageThreadId: 777,
        prisma: mockPrisma,
        senderLabel: '@TraderAlex',
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('CREATE_REMINDER');
      expect(mockPrisma.executionReminder.create).toHaveBeenCalled();
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].text).toContain('Assistant Reminder Armed');
      expect(sentMessages[0].text).toContain('Buy groceries');
    });

    it('creates a general task without date/time', async () => {
      const res = await handleAssistantTopicMessage({
        text: 'review TSLA analyst upgrade notes',
        chatId: '-1003872409872',
        messageThreadId: 777,
        prisma: mockPrisma,
        senderLabel: '@TraderAlex',
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('CREATE_TASK');
      expect(mockPrisma.executionReminder.create).toHaveBeenCalled();
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].text).toContain('To-Do Added to Assistant Checklist');
      expect(sentMessages[0].text).toContain('Review TSLA analyst upgrade notes');
    });

    it('renders task list with interactive numbering and status', async () => {
      mockPrisma.executionReminder.findMany.mockResolvedValue([
        {
          id: 'rem-1',
          task: 'Buy groceries',
          remindAt: new Date(Date.now() + 3600 * 1000),
          status: 'PENDING',
          senderLabel: '@TraderAlex',
        },
        {
          id: 'rem-2',
          task: 'Call dentist',
          remindAt: null,
          status: 'PENDING',
          senderLabel: '@TraderAlex',
        },
      ]);

      const res = await handleAssistantTopicMessage({
        text: 'tasks',
        chatId: '-1003872409872',
        messageThreadId: 777,
        prisma: mockPrisma,
        senderLabel: '@TraderAlex',
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('LIST');
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].text).toContain('PERSONAL ASSISTANT — TASKS & REMINDERS');
      expect(sentMessages[0].text).toContain('Buy groceries');
      expect(sentMessages[0].text).toContain('Call dentist');
      expect(sentMessages[0].text).toContain('Quick Assistant Tools:');
    });

    it('marks a task complete by number or id', async () => {
      mockPrisma.executionReminder.findMany.mockResolvedValue([
        {
          id: 'rem-1',
          task: 'Buy milk and eggs',
          status: 'PENDING',
        },
      ]);

      const res = await handleAssistantTopicMessage({
        text: 'done 1',
        chatId: '-1003872409872',
        messageThreadId: 777,
        prisma: mockPrisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('COMPLETE');
      expect(mockPrisma.executionReminder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rem-1' },
          data: expect.objectContaining({ status: 'DONE' }),
        })
      );
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].text).toContain('Task Completed');
    });

    it('snoozes a reminder by offset', async () => {
      mockPrisma.executionReminder.findMany.mockResolvedValue([
        {
          id: 'rem-1',
          task: 'Review NVDA options',
          remindAt: new Date(),
          status: 'PENDING',
        },
      ]);

      const res = await handleAssistantTopicMessage({
        text: 'snooze 1 2h',
        chatId: '-1003872409872',
        messageThreadId: 777,
        prisma: mockPrisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('SNOOZE');
      expect(mockPrisma.executionReminder.update).toHaveBeenCalled();
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].text).toContain('Reminder Postponed');
    });

    it('clears completed tasks via clear done', async () => {
      const res = await handleAssistantTopicMessage({
        text: 'clear done',
        chatId: '-1003872409872',
        messageThreadId: 777,
        prisma: mockPrisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('CLEAR_DONE');
      expect(mockPrisma.executionReminder.updateMany).toHaveBeenCalled();
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].text).toContain('Checklist Cleaned Up');
    });

    it('renders executive summary briefing', async () => {
      mockPrisma.executionReminder.findMany.mockResolvedValue([
        {
          id: 'rem-1',
          task: 'Prepare quarterly review',
          remindAt: new Date(),
          status: 'PENDING',
        },
      ]);

      const res = await handleAssistantTopicMessage({
        text: 'summary',
        chatId: '-1003872409872',
        messageThreadId: 777,
        prisma: mockPrisma,
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('SUMMARY');
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].text).toContain('EXECUTIVE ASSISTANT BRIEFING');
    });
  });

  describe('Automated 10-Second Due Reminder Dispatcher', () => {
    it('formats assistant alert with dedicated ⏰ reminder styling', () => {
      const alert = formatDueReminderTelegramAlert({
        id: 'rem-1',
        symbol: 'ASSISTANT',
        task: 'Submit tax documents to accountant',
        remindAt: new Date('2026-11-01T15:00:00Z'),
        senderLabel: '@TraderAlex',
      });

      expect(alert).toContain('ASSISTANT REMINDER ALERT');
      expect(alert).toContain('Submit tax documents to accountant');
      expect(alert).toContain('done rem-1');
      expect(alert).toContain('snooze rem-1 30m');
    });

    it('dispatches due assistant reminders to TELEGRAM_ASSISTANT_THREAD_ID and logs to ThoughtLog', async () => {
      const dueReminder = {
        id: 'rem-101',
        symbol: 'ASSISTANT',
        task: 'Call mortgage broker regarding rate lock',
        remindAt: new Date(Date.now() - 5000), // 5 seconds ago
        status: 'PENDING',
        chatId: '-1003872409872',
        messageThreadId: null, // should fall back to TELEGRAM_ASSISTANT_THREAD_ID = 777
        senderLabel: '@TraderAlex',
        notes: null,
      };

      mockPrisma.executionReminder.findMany.mockResolvedValue([dueReminder]);

      const result = await checkAndDispatchDueReminders(mockPrisma);

      expect(result.dispatchedCount).toBe(1);
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].messageThreadId).toBe(777); // dispatched to Assistant thread!
      expect(sentMessages[0].text).toContain('ASSISTANT REMINDER ALERT');
      expect(mockPrisma.thoughtLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            folder: 'Assistant',
            title: expect.stringContaining('Assistant Reminder'),
          }),
        })
      );
    });
  });
});

