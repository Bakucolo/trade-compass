import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseBalancesQuery,
  handleBalancesTopicMessage,
  getPortfolioBalances,
} from '../../server/services/telegramBalancesQueryService';
import {
  getBalancesTopicHelp,
  getHelpMessageForTopic,
  isTopicHelpRequest,
} from '../../server/services/telegramTopicHelpService';
import * as telegramReportService from '../../server/services/telegramReportService';

vi.mock('../../server/services/telegramReportService', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true }),
  generateAndSendDailyReport: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('Telegram Balances Query Service', () => {
  describe('parseBalancesQuery', () => {
    it('should default to ALL_BROKERS on empty or generic queries', () => {
      expect(parseBalancesQuery('')).toEqual({ intent: 'ALL_BROKERS' });
      expect(parseBalancesQuery('balances')).toEqual({ intent: 'ALL_BROKERS' });
      expect(parseBalancesQuery('summary')).toEqual({ intent: 'ALL_BROKERS' });
      expect(parseBalancesQuery('all')).toEqual({ intent: 'ALL_BROKERS' });
      expect(parseBalancesQuery('portfolio')).toEqual({ intent: 'ALL_BROKERS' });
      expect(parseBalancesQuery('show balances')).toEqual({ intent: 'ALL_BROKERS' });
    });

    it('should strip topic hashtags and leading emojis', () => {
      expect(parseBalancesQuery('#balances')).toEqual({ intent: 'ALL_BROKERS' });
      expect(parseBalancesQuery('#topic:balances all')).toEqual({ intent: 'ALL_BROKERS' });
      expect(parseBalancesQuery('🏦 balances')).toEqual({ intent: 'ALL_BROKERS' });
      expect(parseBalancesQuery('💰 cash')).toEqual({ intent: 'CASH' });
      expect(parseBalancesQuery('🛡️ margins')).toEqual({ intent: 'MARGIN' });
      expect(parseBalancesQuery('⚡ buying power')).toEqual({ intent: 'BUYING_POWER' });
    });

    it('should parse help queries', () => {
      expect(parseBalancesQuery('help')).toEqual({ intent: 'HELP' });
      expect(parseBalancesQuery('?')).toEqual({ intent: 'HELP' });
      expect(parseBalancesQuery('commands')).toEqual({ intent: 'HELP' });
      expect(parseBalancesQuery('usage')).toEqual({ intent: 'HELP' });
      expect(parseBalancesQuery('how to use')).toEqual({ intent: 'HELP' });
      expect(parseBalancesQuery('what can i ask')).toEqual({ intent: 'HELP' });
    });

    it('should parse specific broker queries', () => {
      expect(parseBalancesQuery('tastytrade')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'tastytrade' });
      expect(parseBalancesQuery('tasty')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'tastytrade' });
      expect(parseBalancesQuery('tasty balances')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'tastytrade' });
      expect(parseBalancesQuery('ibkr')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'ibkr' });
      expect(parseBalancesQuery('interactive brokers')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'ibkr' });
      expect(parseBalancesQuery('ibkr cash and margin')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'ibkr' });
      expect(parseBalancesQuery('trading 212')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'trading212' });
      expect(parseBalancesQuery('t212')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'trading212' });
      expect(parseBalancesQuery('trading212')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'trading212' });
    });

    it('should parse cash balance inquiries', () => {
      expect(parseBalancesQuery('cash')).toEqual({ intent: 'CASH' });
      expect(parseBalancesQuery('cash balance')).toEqual({ intent: 'CASH' });
      expect(parseBalancesQuery('free cash')).toEqual({ intent: 'CASH' });
      expect(parseBalancesQuery('available cash')).toEqual({ intent: 'CASH' });
      expect(parseBalancesQuery('uninvested')).toEqual({ intent: 'CASH' });
    });

    it('should parse margin and cushion inquiries', () => {
      expect(parseBalancesQuery('margin')).toEqual({ intent: 'MARGIN' });
      expect(parseBalancesQuery('margins')).toEqual({ intent: 'MARGIN' });
      expect(parseBalancesQuery('maintenance margin')).toEqual({ intent: 'MARGIN' });
      expect(parseBalancesQuery('margin cushion')).toEqual({ intent: 'MARGIN' });
      expect(parseBalancesQuery('margin utilization')).toEqual({ intent: 'MARGIN' });
      expect(parseBalancesQuery('margin requirement')).toEqual({ intent: 'MARGIN' });
    });

    it('should parse buying power inquiries', () => {
      expect(parseBalancesQuery('buying power')).toEqual({ intent: 'BUYING_POWER' });
      expect(parseBalancesQuery('bp')).toEqual({ intent: 'BUYING_POWER' });
      expect(parseBalancesQuery('purchasing power')).toEqual({ intent: 'BUYING_POWER' });
      expect(parseBalancesQuery('derivative bp')).toEqual({ intent: 'BUYING_POWER' });
      expect(parseBalancesQuery('equity bp')).toEqual({ intent: 'BUYING_POWER' });
    });
  });

  describe('Topic Help Service for BALANCES', () => {
    it('should return complete instructions in getBalancesTopicHelp', () => {
      const help = getBalancesTopicHelp();
      expect(help).toContain('Balances Topic — Instructions & Commands');
      expect(help).toContain('Tastytrade');
      expect(help).toContain('Trading 212');
      expect(help).toContain('Interactive Brokers');
      expect(help).toContain('General Portfolio Overview');
      expect(help).toContain('cash');
      expect(help).toContain('margins');
      expect(help).toContain('buying power');
    });

    it('should route BALANCES topic help via getHelpMessageForTopic', () => {
      const help = getHelpMessageForTopic('BALANCES');
      expect(help).toContain('Balances Topic');
      expect(help).toContain('Tastytrade');
    });

    it('should recognize help triggers in Balances context', () => {
      expect(isTopicHelpRequest('help')).toBe(true);
      expect(isTopicHelpRequest('?')).toBe(true);
      expect(isTopicHelpRequest('🏦 help')).toBe(true);
      expect(isTopicHelpRequest('how to use')).toBe(true);
    });
  });

  describe('handleBalancesTopicMessage', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      process.env.TELEGRAM_BOT_TOKEN = 'test_token';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total: {
            netLiquidatingValue: 305419.76,
            cash: 1881.76,
            buyingPower: 84898.81,
            maintenanceMargin: 63508.79,
            marginUtilization: 20.8,
            marginCushion: 79.2,
          },
          brokers: {
            ibkr: {
              name: 'Interactive Brokers',
              netLiquidatingValue: 136166.97,
              cash: 0,
              buyingPower: 69616.16,
              maintMargin: 8583.01,
              marginUtilization: 6.3,
              cushion: 93.7,
            },
            tastytrade: {
              name: 'Tastytrade',
              accountNumber: '5WT67220',
              netLiquidatingValue: 62997.65,
              cash: 152.87,
              buyingPower: 13554.10,
              derivativeBuyingPower: 13554.10,
              equityBuyingPower: 27108.20,
              maintMargin: 54925.78,
              marginUtilization: 87.2,
              cushion: 12.8,
            },
            trading212: {
              name: 'Trading 212',
              netLiquidatingValue: 106255.14,
              netLiquidatingValueGBP: 80255.14,
              cash: 1728.89,
              cashGBP: 1305.44,
              investedGBP: 66671.01,
              buyingPower: 1728.89,
              marginUtilization: 0,
              cushion: 100,
            },
          },
        }),
      }));
    });

    it('should handle ALL_BROKERS intent with comprehensive metrics', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'balances',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('ALL_BROKERS');
      expect(res.replyText).toContain('Multi-Broker Balances & Buying Power');
      expect(res.replyText).toContain('Interactive Brokers');
      expect(res.replyText).toContain('Tastytrade');
      expect(res.replyText).toContain('Trading 212');
      expect(res.replyText).toContain('Grand Portfolio Totals:');
      expect(res.replyText).toContain('Total Portfolio Value:');
      expect(telegramReportService.sendTelegramMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: 12345,
          messageThreadId: 99,
          parseMode: 'Markdown',
        })
      );
    });

    it('should handle SPECIFIC_BROKER for Tastytrade', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'tastytrade',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('SPECIFIC_BROKER');
      expect(res.replyText).toContain('Tastytrade — Balances & Margin');
      expect(res.replyText).toContain('Derivatives BP');
      expect(res.replyText).toContain('Maintenance Requirement');
      expect(res.replyText).toContain('Margin Utilization');
    });

    it('should handle SPECIFIC_BROKER for Interactive Brokers', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'ibkr',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('SPECIFIC_BROKER');
      expect(res.replyText).toContain('Interactive Brokers — Balances & Margin');
      expect(res.replyText).toContain('Net Liquidating Value:');
      expect(res.replyText).toContain('Maintenance Margin:');
    });

    it('should handle SPECIFIC_BROKER for Trading 212', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'trading 212',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('SPECIFIC_BROKER');
      expect(res.replyText).toContain('Trading 212 — Cash & Balances');
      expect(res.replyText).toContain('Free Cash');
      expect(res.replyText).toContain('Invested Capital');
      expect(res.replyText).toContain('Cash / Non-Margin');
    });

    it('should handle CASH intent across all brokers', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'cash',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('CASH');
      expect(res.replyText).toContain('Cash Balances by Broker');
      expect(res.replyText).toContain('Grand Total Cash:');
    });

    it('should handle MARGIN intent across brokers and risk metrics', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'margins',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('MARGIN');
      expect(res.replyText).toContain('Margin Requirements & Risk Metrics');
      expect(res.replyText).toContain('Grand Portfolio Margin Health:');
      expect(res.replyText).toContain('Combined Margin Utilization:');
    });

    it('should handle BUYING_POWER intent', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'buying power',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('BUYING_POWER');
      expect(res.replyText).toContain('Available Buying Power by Broker');
      expect(res.replyText).toContain('Combined Total Buying Power:');
    });

    it('should handle HELP intent and send instructions', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'help',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('HELP');
      expect(res.replyText).toContain('Balances Topic — Instructions & Commands');
    });
  });
});
