import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseExecutionReminder,
  createExecutionReminder,
  getExecutionReminders,
  cancelExecutionReminder,
  checkAndDispatchDueReminders,
  formatReminderCreatedTelegramReply,
  formatRemindersListTelegramReply,
  formatDueReminderTelegramAlert,
} from '../../server/services/executionReminderService';
import { handleExecutionTopicMessage } from '../../server/services/telegramExecutionTopicService';

vi.mock('../../server/services/telegramReportService', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ success: true, messageId: 999 }),
}));

describe('Execution Reminder Service', () => {
  // Use a fixed reference base date: Wednesday, Oct 21, 2026 at 10:00:00 AM local
  const baseDate = new Date(2026, 9, 21, 10, 0, 0);

  describe('Natural Language Date/Time & Task Parsing', () => {
    it('parses ticker, task, and tomorrow at 10am', () => {
      const parsed = parseExecutionReminder('AAPL roll call spread tomorrow at 10am', baseDate);
      expect(parsed).not.toBeNull();
      expect(parsed!.symbol).toBe('AAPL');
      expect(parsed!.task).toBe('Roll call spread');
      expect(parsed!.remindAt.getDate()).toBe(22); // Oct 22
      expect(parsed!.remindAt.getHours()).toBe(10);
      expect(parsed!.remindAt.getMinutes()).toBe(0);
    });

    it('parses reminder with remind prefix, day of week and 24h time', () => {
      const parsed = parseExecutionReminder('remind AAPL trim 50 shares Friday at 15:30', baseDate);
      expect(parsed).not.toBeNull();
      expect(parsed!.symbol).toBe('AAPL');
      expect(parsed!.task).toBe('Trim 50 shares');
      expect(parsed!.remindAt.getDay()).toBe(5); // Friday
      expect(parsed!.remindAt.getHours()).toBe(15);
      expect(parsed!.remindAt.getMinutes()).toBe(30);
    });

    it('parses reminder with dollar ticker and explicit ISO-like date and time', () => {
      const parsed = parseExecutionReminder('reminder $NVDA buy 100 shares if above 135 on 2026-10-24 14:00', baseDate);
      expect(parsed).not.toBeNull();
      expect(parsed!.symbol).toBe('NVDA');
      expect(parsed!.task).toBe('Buy 100 shares if above 135');
      expect(parsed!.remindAt.getFullYear()).toBe(2026);
      expect(parsed!.remindAt.getMonth()).toBe(9); // Oct
      expect(parsed!.remindAt.getDate()).toBe(24);
      expect(parsed!.remindAt.getHours()).toBe(14);
      expect(parsed!.remindAt.getMinutes()).toBe(0);
    });

    it('parses relative offset: in 2 hours', () => {
      const parsed = parseExecutionReminder('TSLA check 250 resistance and sell call spread in 2 hours', baseDate);
      expect(parsed).not.toBeNull();
      expect(parsed!.symbol).toBe('TSLA');
      expect(parsed!.task).toBe('Check 250 resistance and sell call spread');
      const expectedTime = baseDate.getTime() + 2 * 3600 * 1000;
      expect(parsed!.remindAt.getTime()).toBe(expectedTime);
    });

    it('parses relative offset: in 30 mins', () => {
      const parsed = parseExecutionReminder('remind me in 30 mins to close AMZN position', baseDate);
      expect(parsed).not.toBeNull();
      expect(parsed!.symbol).toBe('AMZN');
      expect(parsed!.task).toBe('Close AMZN position');
      const expectedTime = baseDate.getTime() + 30 * 60 * 1000;
      expect(parsed!.remindAt.getTime()).toBe(expectedTime);
    });

    it('parses reminder with "remind me on Friday at 3pm to execute MSFT long calls"', () => {
      const parsed = parseExecutionReminder('remind me on Friday at 3pm to execute MSFT long calls', baseDate);
      expect(parsed).not.toBeNull();
      expect(parsed!.symbol).toBe('MSFT');
      expect(parsed!.task).toContain('long calls');
      expect(parsed!.remindAt.getDay()).toBe(5);
      expect(parsed!.remindAt.getHours()).toBe(15);
      expect(parsed!.remindAt.getMinutes()).toBe(0);
    });

    it('parses scheduled trade order: BUY 100 AAPL @ 150 tomorrow at 10am', () => {
      const parsed = parseExecutionReminder('BUY 100 AAPL @ 150 tomorrow at 10am', baseDate);
      expect(parsed).not.toBeNull();
      expect(parsed!.symbol).toBe('AAPL');
      expect(parsed!.task).toContain('BUY 100 AAPL @ 150');
      expect(parsed!.remindAt.getDate()).toBe(22);
      expect(parsed!.remindAt.getHours()).toBe(10);
    });

    it('parses month name and day: PLTR execute covered call Oct 24 at 10am', () => {
      const parsed = parseExecutionReminder('PLTR execute covered call Oct 24 at 10am', baseDate);
      expect(parsed).not.toBeNull();
      expect(parsed!.symbol).toBe('PLTR');
      expect(parsed!.task).toBe('Execute covered call');
      expect(parsed!.remindAt.getDate()).toBe(24);
      expect(parsed!.remindAt.getHours()).toBe(10);
    });

    it('does NOT match standard immediate orders that have no date or time', () => {
      const notReminder1 = parseExecutionReminder('BUY 100 AAPL @ 150 SL 145 TP 165', baseDate);
      expect(notReminder1).toBeNull();

      const notReminder2 = parseExecutionReminder('SELL 50 TSLA @ 250 STOP 260 TP 230', baseDate);
      expect(notReminder2).toBeNull();

      const notReminder3 = parseExecutionReminder('BTO 2 AAPL 250C 10/18 @ 4.50', baseDate);
      expect(notReminder3).toBeNull();
    });

    it('does NOT match query commands like queue or status', () => {
      expect(parseExecutionReminder('queue', baseDate)).toBeNull();
      expect(parseExecutionReminder('status', baseDate)).toBeNull();
      expect(parseExecutionReminder('reminders', baseDate)).toBeNull();
      expect(parseExecutionReminder('cancel AAPL', baseDate)).toBeNull();
    });
  });

  describe('Telegram Execution Topic Handler Integration', () => {
    let mockPrisma: any;
    let createdReminders: any[];

    beforeEach(() => {
      createdReminders = [];
      mockPrisma = {
        executionReminder: {
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            const item = {
              id: `rem_${Date.now()}_${Math.random()}`,
              ...data,
              status: 'PENDING',
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            createdReminders.push(item);
            return item;
          }),
          findMany: vi.fn().mockImplementation(async ({ where }: any) => {
            return createdReminders.filter((r) => {
              if (where?.status && r.status !== where.status) return false;
              if (where?.symbol && r.symbol !== where.symbol) return false;
              return true;
            });
          }),
          updateMany: vi.fn().mockImplementation(async ({ where, data }: any) => {
            let count = 0;
            createdReminders.forEach((r) => {
              if (where?.id?.in?.includes(r.id)) {
                Object.assign(r, data);
                count++;
              }
            });
            return { count };
          }),
          update: vi.fn().mockImplementation(async ({ where, data }: any) => {
            const r = createdReminders.find((item) => item.id === where.id);
            if (r) Object.assign(r, data);
            return r;
          }),
        },
        thoughtLog: {
          create: vi.fn().mockResolvedValue({ id: 'log_1' }),
        },
      };
    });

    it('schedules an execution reminder when user inputs ticker, task, and date/time', async () => {
      const res = await handleExecutionTopicMessage({
        text: 'AAPL roll call spread tomorrow at 10am',
        chatId: '123456',
        messageThreadId: 5,
        prisma: mockPrisma,
        senderLabel: 'Mobile',
        timestamp: baseDate.getTime(),
      });

      expect(res.handled).toBe(true);
      expect(res.actionTaken).toBe('SCHEDULE_REMINDER');
      expect(res.reminderCreated).toBeDefined();
      expect(res.reminderCreated?.symbol).toBe('AAPL');
      expect(res.reminderCreated?.task).toBe('Roll call spread');
      expect(res.replyText).toContain('Execution Reminder Scheduled');
      expect(res.replyText).toContain('$AAPL');
      expect(res.replyText).toContain('Roll call spread');
    });

    it('displays active execution reminders when user sends "reminders"', async () => {
      // First schedule a reminder
      await handleExecutionTopicMessage({
        text: 'TSLA sell call spread in 2 hours',
        chatId: '123456',
        messageThreadId: 5,
        prisma: mockPrisma,
        senderLabel: 'Mobile',
        timestamp: baseDate.getTime(),
      });

      // Then ask to view reminders
      const viewRes = await handleExecutionTopicMessage({
        text: 'reminders',
        chatId: '123456',
        messageThreadId: 5,
        prisma: mockPrisma,
        senderLabel: 'Mobile',
      });

      expect(viewRes.handled).toBe(true);
      expect(viewRes.actionTaken).toBe('VIEW_REMINDERS');
      expect(viewRes.replyText).toContain('Scheduled Execution Reminders');
      expect(viewRes.replyText).toContain('$TSLA');
    });

    it('cancels a scheduled reminder when user sends "cancel reminder [TICKER]"', async () => {
      // Schedule a reminder
      await handleExecutionTopicMessage({
        text: 'NVDA buy 100 shares Friday at 15:30',
        chatId: '123456',
        messageThreadId: 5,
        prisma: mockPrisma,
        senderLabel: 'Mobile',
        timestamp: baseDate.getTime(),
      });

      // Cancel it
      const cancelRes = await handleExecutionTopicMessage({
        text: 'cancel reminder NVDA',
        chatId: '123456',
        messageThreadId: 5,
        prisma: mockPrisma,
        senderLabel: 'Mobile',
      });

      expect(cancelRes.handled).toBe(true);
      expect(cancelRes.actionTaken).toBe('CANCEL_REMINDER');
      expect(cancelRes.replyText).toContain('Execution Reminder Cancelled');
      expect(cancelRes.replyText).toContain('$NVDA');
    });
  });

  describe('Background Dispatcher Worker', () => {
    it('dispatches due reminders when remindAt is <= now and updates status to TRIGGERED', async () => {
      const pastTime = new Date(Date.now() - 5000);
      const reminder = {
        id: 'rem_due_1',
        symbol: 'PLTR',
        task: 'Execute covered call',
        remindAt: pastTime,
        status: 'PENDING',
        chatId: '12345',
        messageThreadId: 5,
        sourceMessage: 'PLTR execute covered call Oct 24 at 10am',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPrisma: any = {
        executionReminder: {
          findMany: vi.fn().mockResolvedValue([reminder]),
          update: vi.fn().mockImplementation(async ({ data }: any) => {
            Object.assign(reminder, data);
            return reminder;
          }),
        },
        thoughtLog: {
          create: vi.fn().mockResolvedValue({ id: 'log_due' }),
        },
      };

      const { dispatchedCount, dispatched } = await checkAndDispatchDueReminders(mockPrisma);
      expect(dispatchedCount).toBe(1);
      expect(dispatched[0].symbol).toBe('PLTR');
      expect(reminder.status).toBe('TRIGGERED');
    });
  });
});
