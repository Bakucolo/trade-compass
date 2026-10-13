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
  sendPdfReportToTelegram: vi.fn().mockResolvedValue({ ok: true, messageId: 999 }),
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
      expect(parseBalancesQuery('isa')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'ibkr_isa' });
      expect(parseBalancesQuery('ibkr isa')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'ibkr_isa' });
      expect(parseBalancesQuery('stocks & shares isa')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'ibkr_isa' });
      expect(parseBalancesQuery('gia')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'ibkr_gia' });
      expect(parseBalancesQuery('ibkr gia')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'ibkr_gia' });
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

    it('should parse fee and commission inquiries across timeframes and accounts', () => {
      expect(parseBalancesQuery('fee')).toEqual({ intent: 'FEES' });
      expect(parseBalancesQuery('fees')).toEqual({ intent: 'FEES' });
      expect(parseBalancesQuery('commissions')).toEqual({ intent: 'FEES' });
      expect(parseBalancesQuery('fees today')).toEqual({ intent: 'FEES', timeframe: 'today' });
      expect(parseBalancesQuery('fees 7d')).toEqual({ intent: 'FEES', timeframe: '7d' });
      expect(parseBalancesQuery('fees this month')).toEqual({ intent: 'FEES', timeframe: '30d' });
      expect(parseBalancesQuery('fees ytd')).toEqual({ intent: 'FEES', timeframe: 'ytd' });
      expect(parseBalancesQuery('fees all time')).toEqual({ intent: 'FEES', timeframe: 'all' });
      expect(parseBalancesQuery('fees ibkr')).toEqual({ intent: 'FEES', brokerName: 'ibkr' });
      expect(parseBalancesQuery('fees isa')).toEqual({ intent: 'FEES', brokerName: 'ibkr_isa' });
      expect(parseBalancesQuery('fees gia')).toEqual({ intent: 'FEES', brokerName: 'ibkr_gia' });
      expect(parseBalancesQuery('tasty fees')).toEqual({ intent: 'FEES', brokerName: 'tastytrade' });
    });
  });

  describe('Topic Help Service for BALANCES', () => {
    it('should return complete instructions in getBalancesTopicHelp', () => {
      const help = getBalancesTopicHelp();
      expect(help).toContain('Balances Topic — Instructions & Commands');
      expect(help).toContain('Tastytrade');
      expect(help).toContain('Trading 212');
      expect(help).toContain('Interactive Brokers');
      expect(help).toContain('isa');
      expect(help).toContain('gia');
      expect(help).toContain('fees');
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
    const mockIsaAccount = {
      name: 'Interactive Brokers (ISA)',
      accountKey: 'ibkr_isa',
      accountNumber: 'U14522424',
      accountType: 'Stocks & Shares ISA (Tax-Free)',
      netLiquidatingValueGBP: 73853.98,
      netLiquidatingValue: 96157.88,
      cashGBP: 1187.72,
      cash: 1546.41,
      buyingPowerGBP: 1187.72,
      buyingPower: 1546.41,
      maintMarginGBP: 0,
      maintMargin: 0,
      marginUtilization: 0,
      cushion: 100,
    };

    const mockGiaAccount = {
      name: 'Interactive Brokers (GIA)',
      accountKey: 'ibkr_gia',
      accountNumber: 'U15491236',
      accountType: 'General Investment Account (Margin)',
      netLiquidatingValueGBP: 26820.59,
      netLiquidatingValue: 34920.41,
      cashGBP: 468.31,
      cash: 609.74,
      buyingPowerGBP: 46574.74,
      buyingPower: 60640.31,
      maintMarginGBP: 6592.17,
      maintMargin: 8583.01,
      marginUtilization: 24.6,
      cushion: 75.4,
    };

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
              netLiquidatingValueGBP: 104582.93,
              cash: 2156.15,
              cashGBP: 1656.03,
              buyingPower: 62186.72,
              buyingPowerGBP: 47762.46,
              maintMargin: 8583.01,
              maintMarginGBP: 6592.17,
              marginUtilization: 6.3,
              cushion: 93.7,
              accounts: [mockIsaAccount, mockGiaAccount],
            },
            ibkr_isa: mockIsaAccount,
            ibkr_gia: mockGiaAccount,
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

    it('should handle ALL_BROKERS intent with separate IBKR ISA and GIA metrics', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'balances',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('ALL_BROKERS');
      expect(res.replyText).toContain('Multi-Broker Balances & Buying Power');
      expect(res.replyText).toContain('Interactive Brokers — ISA (U14522424)');
      expect(res.replyText).toContain('Interactive Brokers — GIA (U15491236)');
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

    it('should handle SPECIFIC_BROKER for Interactive Brokers with dual accounts breakdown', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'ibkr',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('SPECIFIC_BROKER');
      expect(res.replyText).toContain('Interactive Brokers — Dual Account Balances & Margin');
      expect(res.replyText).toContain('Stocks & Shares ISA (U14522424)');
      expect(res.replyText).toContain('General Investment Account (U15491236)');
      expect(res.replyText).toContain('Interactive Brokers Combined Subtotal:');
    });

    it('should handle SPECIFIC_BROKER for IBKR ISA separately', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'isa',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('SPECIFIC_BROKER');
      expect(res.replyText).toContain('Interactive Brokers — Stocks & Shares ISA');
      expect(res.replyText).toContain('U14522424');
      expect(res.replyText).toContain('£1,187.72');
      expect(res.replyText).toContain('Cash / Non-Margin (100% Cushion)');
    });

    it('should handle SPECIFIC_BROKER for IBKR GIA separately', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'gia',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('SPECIFIC_BROKER');
      expect(res.replyText).toContain('Interactive Brokers — Margin GIA');
      expect(res.replyText).toContain('U15491236');
      expect(res.replyText).toContain('£468.31');
      expect(res.replyText).toContain('£46,574.74');
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

    it('should handle CASH intent with separate IBKR ISA and GIA line items', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'cash',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('CASH');
      expect(res.replyText).toContain('Cash Balances by Broker');
      expect(res.replyText).toContain('IBKR Stocks & Shares ISA (U14522424):');
      expect(res.replyText).toContain('IBKR Margin GIA (U15491236):');
      expect(res.replyText).toContain('Grand Total Cash:');
    });

    it('should handle MARGIN intent across brokers and separate IBKR accounts', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'margins',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('MARGIN');
      expect(res.replyText).toContain('Margin Requirements & Risk Metrics');
      expect(res.replyText).toContain('IBKR Margin GIA (U15491236):');
      expect(res.replyText).toContain('IBKR Stocks & Shares ISA (U14522424):');
      expect(res.replyText).toContain('Grand Portfolio Margin Health:');
      expect(res.replyText).toContain('Combined Margin Utilization:');
    });

    it('should handle BUYING_POWER intent with separate IBKR ISA and GIA accounts', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'buying power',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('BUYING_POWER');
      expect(res.replyText).toContain('Available Buying Power by Broker');
      expect(res.replyText).toContain('IBKR Margin GIA (U15491236):');
      expect(res.replyText).toContain('IBKR ISA (U14522424):');
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

    it('should handle FEES intent with multi-timeframe comparison across all accounts', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'fees',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('FEES');
      expect(res.replyText).toContain('Broker Fees & Commissions Summary');
      expect(res.replyText).toContain('Fees by Timeframe (All Accounts Combined):');
      expect(res.replyText).toContain('Today (24h):');
      expect(res.replyText).toContain('Last 7 Days:');
      expect(res.replyText).toContain('Last 30 Days:');
      expect(res.replyText).toContain('Year to Date (YTD):');
      expect(res.replyText).toContain('Tastytrade');
      expect(res.replyText).toContain('IBKR — Margin GIA');
      expect(res.replyText).toContain('IBKR — Stocks & Shares ISA');
      expect(res.replyText).toContain('Trading 212');
      expect(res.replyText).toContain('Grand Total YTD Fees:');
    });

    it('should handle FEES intent for specific timeframe (fees 7d)', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'fees 7d',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('FEES');
      expect(res.replyText).toContain('Fees & Commissions — Last 7 Days');
      expect(res.replyText).toContain('Total Fees (7D):');
      expect(res.replyText).toContain('Tastytrade (5WT67220):');
      expect(res.replyText).toContain('Timeframe Quick Matrix:');
    });

    it('should handle FEES intent for specific broker (fees ibkr)', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'fees ibkr',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('FEES');
      expect(res.replyText).toContain('Interactive Brokers — Fees & Commissions');
      expect(res.replyText).toContain('Stocks & Shares ISA (U14522424)');
      expect(res.replyText).toContain('Margin GIA (U15491236)');
      expect(res.replyText).toContain('Fees by Timeframe');
    });

    it('should handle FEES intent for specific account (fees isa)', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'fees isa',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('FEES');
      expect(res.replyText).toContain('IBKR — Stocks & Shares ISA Fees');
      expect(res.replyText).toContain('U14522424');
      expect(res.replyText).toContain('ISA Fees by Timeframe:');
    });

    it('should parse Dividend and Capital Gains queries with timeframes, accounts, and pdf flag', () => {
      expect(parseBalancesQuery('dividend')).toEqual({ intent: 'DIVIDENDS_GAINS' });
      expect(parseBalancesQuery('dividends')).toEqual({ intent: 'DIVIDENDS_GAINS' });
      expect(parseBalancesQuery('capital gains')).toEqual({ intent: 'DIVIDENDS_GAINS' });
      expect(parseBalancesQuery('gains')).toEqual({ intent: 'DIVIDENDS_GAINS' });
      expect(parseBalancesQuery('pnl')).toEqual({ intent: 'DIVIDENDS_GAINS' });
      expect(parseBalancesQuery('realized gains')).toEqual({ intent: 'DIVIDENDS_GAINS' });
      expect(parseBalancesQuery('dividends and gains')).toEqual({ intent: 'DIVIDENDS_GAINS' });

      // Timeframe queries
      expect(parseBalancesQuery('dividends today')).toEqual({ intent: 'DIVIDENDS_GAINS', timeframe: 'today' });
      expect(parseBalancesQuery('gains 7d')).toEqual({ intent: 'DIVIDENDS_GAINS', timeframe: '7d' });
      expect(parseBalancesQuery('pnl 30d')).toEqual({ intent: 'DIVIDENDS_GAINS', timeframe: '30d' });
      expect(parseBalancesQuery('dividends ytd')).toEqual({ intent: 'DIVIDENDS_GAINS', timeframe: 'ytd' });
      expect(parseBalancesQuery('capital gains all time')).toEqual({ intent: 'DIVIDENDS_GAINS', timeframe: 'all' });

      // Broker/Account queries
      expect(parseBalancesQuery('dividends isa')).toEqual({ intent: 'DIVIDENDS_GAINS', brokerName: 'ibkr_isa' });
      expect(parseBalancesQuery('gains gia')).toEqual({ intent: 'DIVIDENDS_GAINS', brokerName: 'ibkr_gia' });
      expect(parseBalancesQuery('pnl tasty')).toEqual({ intent: 'DIVIDENDS_GAINS', brokerName: 'tastytrade' });
      expect(parseBalancesQuery('dividends t212')).toEqual({ intent: 'DIVIDENDS_GAINS', brokerName: 'trading212' });
      expect(parseBalancesQuery('gains ibkr')).toEqual({ intent: 'DIVIDENDS_GAINS', brokerName: 'ibkr' });

      // PDF triggers
      expect(parseBalancesQuery('pdf')).toEqual({ intent: 'DIVIDENDS_GAINS', isPdfRequested: true });
      expect(parseBalancesQuery('balances pdf')).toEqual({ intent: 'DIVIDENDS_GAINS', isPdfRequested: true });
      expect(parseBalancesQuery('dividend pdf')).toEqual({ intent: 'DIVIDENDS_GAINS', isPdfRequested: true });
      expect(parseBalancesQuery('capital gains pdf')).toEqual({ intent: 'DIVIDENDS_GAINS', isPdfRequested: true });
      expect(parseBalancesQuery('pnl 30d pdf')).toEqual({ intent: 'DIVIDENDS_GAINS', timeframe: '30d', isPdfRequested: true });
      expect(parseBalancesQuery('gains isa pdf')).toEqual({ intent: 'DIVIDENDS_GAINS', brokerName: 'ibkr_isa', isPdfRequested: true });
    });

    it('should handle DIVIDENDS_GAINS intent and generate text message', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'dividends and capital gains',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('DIVIDENDS_GAINS');
      expect(res.replyText).toContain('Multi-Broker Dividend & Capital Gains Report');
      expect(res.replyText).toContain('IBKR Stocks & Shares ISA (U14522424)');
      expect(res.replyText).toContain('IBKR Margin GIA (U15491236)');
      expect(res.replyText).toContain('Tastytrade (5WT67220)');
      expect(res.replyText).toContain('Trading 212 (22885001)');
      expect(res.replyText).toContain('Timeframe Comparison Matrix');
      expect(res.replyText).toContain('Grand Portfolio Net Return');
    });

    it('should handle DIVIDENDS_GAINS intent for specific broker (dividends isa)', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'dividends isa',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('DIVIDENDS_GAINS');
      expect(res.replyText).toContain('Interactive Brokers (ISA) — Dividend & Capital Gains Report');
      expect(res.replyText).toContain('U14522424');
      expect(res.replyText).toContain('Dividend Income:');
      expect(res.replyText).toContain('Capital Gains & P&L:');
    });

    it('should handle DIVIDENDS_GAINS intent for dual IBKR accounts (gains ibkr)', async () => {
      const res = await handleBalancesTopicMessage({
        text: 'gains ibkr',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('DIVIDENDS_GAINS');
      expect(res.replyText).toContain('Interactive Brokers — Dual Account Dividend & Capital Gains');
      expect(res.replyText).toContain('Stocks & Shares ISA (U14522424)');
      expect(res.replyText).toContain('General Investment Account (U15491236)');
      expect(res.replyText).toContain('Interactive Brokers Subtotal:');
    });

    it('should generate and dispatch PDF when user requests pdf (dividend pdf)', async () => {
      const sendPdfSpy = vi.spyOn(telegramReportService, 'sendPdfReportToTelegram');

      const res = await handleBalancesTopicMessage({
        text: 'dividend and capital gains pdf',
        chatId: 12345,
        messageThreadId: 99,
      });

      expect(res.handled).toBe(true);
      expect(res.intent).toBe('DIVIDENDS_GAINS');
      expect(res.replyText).toContain('Institutional PDF Briefing attached below!');
      expect(sendPdfSpy).toHaveBeenCalled();

      const lastCall = sendPdfSpy.mock.calls[sendPdfSpy.mock.calls.length - 1];
      const buffer = lastCall[0] as Buffer;
      const filename = lastCall[1] as string;
      const options = lastCall[3] as any;

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
      expect(filename).toContain('TradeFlow_Dividend_CapitalGains');
      expect(filename).toContain('.pdf');
      expect(options.chatId).toBe(12345);
      expect(options.messageThreadId).toBe(99);
    });
  });
});
