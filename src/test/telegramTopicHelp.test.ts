import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isTopicHelpRequest,
  getHelpMessageForTopic,
  handleTopicHelpMessage,
  getPositionsTopicHelp,
  getWatchlistTopicHelp,
  getNotesTopicHelp,
  getExecutionTopicHelp,
  getIdeasTopicHelp,
  getAlertsTopicHelp,
  getSetAlertTopicHelp,
  getCalendarTopicHelp,
  getAppTopicHelp,
  getGeneralTopicDirectoryHelp,
} from '../../server/services/telegramTopicHelpService';
import { handlePositionsTopicMessage } from '../../server/services/telegramPositionsQueryService';
import { handleWatchlistTopicMessage } from '../../server/services/telegramWatchlistQueryService';

vi.mock('../../server/services/telegramReportService', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true }),
  generateAndSendDailyReport: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('Telegram Topic Help Service', () => {
  describe('isTopicHelpRequest', () => {
    it('should accurately detect various forms of help keywords', () => {
      expect(isTopicHelpRequest('help')).toBe(true);
      expect(isTopicHelpRequest('/help')).toBe(true);
      expect(isTopicHelpRequest('HELP')).toBe(true);
      expect(isTopicHelpRequest('?')).toBe(true);
      expect(isTopicHelpRequest('commands')).toBe(true);
      expect(isTopicHelpRequest('/commands')).toBe(true);
      expect(isTopicHelpRequest('usage')).toBe(true);
      expect(isTopicHelpRequest('/usage')).toBe(true);
      expect(isTopicHelpRequest('info')).toBe(true);
      expect(isTopicHelpRequest('/info')).toBe(true);
      expect(isTopicHelpRequest('instructions')).toBe(true);
      expect(isTopicHelpRequest('guide')).toBe(true);
      expect(isTopicHelpRequest('#help')).toBe(true);
      expect(isTopicHelpRequest('💼 help')).toBe(true);
      expect(isTopicHelpRequest('📋 /help')).toBe(true);
    });

    it('should detect natural conversational help phrases', () => {
      expect(isTopicHelpRequest('how to use')).toBe(true);
      expect(isTopicHelpRequest('what can i do here?')).toBe(true);
      expect(isTopicHelpRequest('what can i ask here')).toBe(true);
      expect(isTopicHelpRequest('what can i do')).toBe(true);
      expect(isTopicHelpRequest('help me')).toBe(true);
      expect(isTopicHelpRequest('topic help')).toBe(true);
      expect(isTopicHelpRequest('what are the commands?')).toBe(true);
    });

    it('should not match normal financial queries, tickers, or trades', () => {
      expect(isTopicHelpRequest('AAPL')).toBe(false);
      expect(isTopicHelpRequest('$NVDA')).toBe(false);
      expect(isTopicHelpRequest('options')).toBe(false);
      expect(isTopicHelpRequest('equities')).toBe(false);
      expect(isTopicHelpRequest('brokers')).toBe(false);
      expect(isTopicHelpRequest('BUY 100 TSLA @ 200')).toBe(false);
      expect(isTopicHelpRequest('Semiconductors PE < 30')).toBe(false);
      expect(isTopicHelpRequest('AAPL great earnings beat')).toBe(false);
      expect(isTopicHelpRequest('Alert NVDA above $150')).toBe(false);
    });
  });

  describe('Topic-specific instructions content', () => {
    it('POSITIONS topic help provides complete instructions', () => {
      const msg = getPositionsTopicHelp();
      expect(msg).toContain('Positions Topic');
      expect(msg).toContain('Specific Ticker Lookup');
      expect(msg).toContain('AAPL');
      expect(msg).toContain('Asset Classes');
      expect(msg).toContain('options');
      expect(msg).toContain('equities');
      expect(msg).toContain('Broker Portfolios');
      expect(msg).toContain('Tastytrade');
      expect(msg).toContain('Trading 212');
      expect(msg).toContain('Interactive Brokers');
    });

    it('WATCHLIST topic help provides complete instructions', () => {
      const msg = getWatchlistTopicHelp();
      expect(msg).toContain('Watchlist Topic');
      expect(msg).toContain('View All Watchlists');
      expect(msg).toContain('Filter Watchlist with Criteria');
      expect(msg).toContain('Semiconductors PE < 30');
      expect(msg).toContain('Add Stocks to a Watchlist');
      expect(msg).toContain('AI Thematic Watchlist Agent');
    });

    it('NOTES topic help provides complete instructions', () => {
      const msg = getNotesTopicHelp();
      expect(msg).toContain('Notes Topic');
      expect(msg).toContain('Save or Append a Note');
      expect(msg).toContain('Pinned in App');
      expect(msg).toContain('Check / Look Up Saved Notes');
      expect(msg).toContain('Sentiment Detection');
      expect(msg).toContain('History Preserved');
    });

    it('EXECUTION topic help provides complete instructions', () => {
      const msg = getExecutionTopicHelp();
      expect(msg).toContain('Execution Topic');
      expect(msg).toContain('Equity Orders');
      expect(msg).toContain('BUY 100 AAPL');
      expect(msg).toContain('Options & Multi-Leg Strategies');
      expect(msg).toContain('Covered Call');
      expect(msg).toContain('Stop Loss');
      expect(msg).toContain('Take Profit');
    });

    it('IDEAS topic help provides complete instructions', () => {
      const msg = getIdeasTopicHelp();
      expect(msg).toContain('Ideas Topic');
      expect(msg).toContain('Earnings Catalysts');
      expect(msg).toContain('Macro Theses');
      expect(msg).toContain('Ticker Linking');
      expect(msg).toContain('Watchlist Sync');
    });

    it('ALERTS topic help provides complete instructions', () => {
      const msg = getAlertsTopicHelp();
      expect(msg).toContain('Alerts Topic');
      expect(msg).toContain('Live Alert Notifications');
      expect(msg).toContain('Setting & Managing Alerts');
    });

    it('SET_ALERT topic help provides complete instructions', () => {
      const msg = getSetAlertTopicHelp();
      expect(msg).toContain('Set Alert Topic');
      expect(msg).toContain('Alert NVDA above $145');
      expect(msg).toContain('Direction Detection');
    });

    it('CALENDAR topic help provides complete instructions', () => {
      const msg = getCalendarTopicHelp();
      expect(msg).toContain('Calendar Topic');
      expect(msg).toContain('1 Week in Advance (7 Days Out)');
      expect(msg).toContain('Previous Day (1 Day Out)');
    });

    it('APP topic help provides complete instructions', () => {
      const msg = getAppTopicHelp();
      expect(msg).toContain('App Topic');
      expect(msg).toContain('[UI]');
      expect(msg).toContain('[Bug]');
      expect(msg).toContain('[Portfolio]');
      expect(msg).toContain('Roadmap Tracking');
    });

    it('GENERAL directory help provides all topic overviews', () => {
      const msg = getGeneralTopicDirectoryHelp();
      expect(msg).toContain('Trade Compass Telegram Assistant');
      expect(msg).toContain('Positions');
      expect(msg).toContain('Watchlist');
      expect(msg).toContain('Notes');
      expect(msg).toContain('Execution');
      expect(msg).toContain('Ideas');
      expect(msg).toContain('Alerts');
      expect(msg).toContain('App');
    });
  });

  describe('handleTopicHelpMessage dispatch', () => {
    it('dispatches the correct topic instructions and returns result', async () => {
      const res = await handleTopicHelpMessage({
        topic: 'EXECUTION',
        chatId: 12345,
        messageThreadId: 100,
      });

      expect(res.handled).toBe(true);
      expect(res.topic).toBe('EXECUTION');
      expect(res.replyText).toContain('Execution Topic');
    });
  });

  describe('Integration with Positions & Watchlist Query Handlers', () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        holding: { findMany: vi.fn().mockResolvedValue([]) },
        broker: { findMany: vi.fn().mockResolvedValue([]) },
        watchlist: { findMany: vi.fn().mockResolvedValue([]) },
      };
    });

    it('handlePositionsTopicMessage handles "help" and returns Positions instructions', async () => {
      const result = await handlePositionsTopicMessage({
        text: 'help',
        chatId: 12345,
        prisma: mockPrisma,
      });

      expect(result.handled).toBe(true);
      expect(result.intent).toBe('HELP');
      expect(result.replyText).toContain('Positions Topic — Instructions & Commands');
      expect(result.replyText).toContain('Specific Ticker Lookup');
    });

    it('handleWatchlistTopicMessage handles "help" and returns Watchlist instructions', async () => {
      const result = await handleWatchlistTopicMessage({
        text: 'help',
        chatId: 12345,
        prisma: mockPrisma,
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('HELP');
      expect(result.replyText).toContain('Watchlist Topic — Instructions & Commands');
      expect(result.replyText).toContain('Filter Watchlist with Criteria');
    });
  });
});
