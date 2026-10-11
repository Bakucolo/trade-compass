import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parsePositionQuery,
  extractTickerCandidate,
  getUnderlyingFromSymbol,
  handlePositionsTopicMessage,
} from '../../server/services/telegramPositionsQueryService';

vi.mock('../../server/services/telegramReportService', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true }),
  generateAndSendDailyReport: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('Telegram Positions Query Service', () => {
  describe('extractTickerCandidate & parsePositionQuery', () => {
    it('should parse single ticker queries in uppercase and lowercase', () => {
      expect(parsePositionQuery('AAPL')).toEqual({ intent: 'TICKER', ticker: 'AAPL' });
      expect(parsePositionQuery('aapl')).toEqual({ intent: 'TICKER', ticker: 'AAPL' });
      expect(parsePositionQuery('$NVDA')).toEqual({ intent: 'TICKER', ticker: 'NVDA' });
      expect(parsePositionQuery('$pltr')).toEqual({ intent: 'TICKER', ticker: 'PLTR' });
      expect(parsePositionQuery('TSLA')).toEqual({ intent: 'TICKER', ticker: 'TSLA' });
    });

    it('should parse conversational ticker requests', () => {
      expect(parsePositionQuery('positions in NVDA')).toEqual({ intent: 'TICKER', ticker: 'NVDA' });
      expect(parsePositionQuery('positions in nvda')).toEqual({ intent: 'TICKER', ticker: 'NVDA' });
      expect(parsePositionQuery('show AAPL')).toEqual({ intent: 'TICKER', ticker: 'AAPL' });
      expect(parsePositionQuery('show pltr')).toEqual({ intent: 'TICKER', ticker: 'PLTR' });
      expect(parsePositionQuery('MSFT positions')).toEqual({ intent: 'TICKER', ticker: 'MSFT' });
      expect(parsePositionQuery('what is my TSLA position?')).toEqual({ intent: 'TICKER', ticker: 'TSLA' });
      expect(parsePositionQuery('do I have any AMZN?')).toEqual({ intent: 'TICKER', ticker: 'AMZN' });
      expect(parsePositionQuery('how many GOOGL shares')).toEqual({ intent: 'TICKER', ticker: 'GOOGL' });
    });

    it('should prioritize ticker when asking for ticker options or calls/puts', () => {
      expect(parsePositionQuery('AAPL options')).toEqual({ intent: 'TICKER', ticker: 'AAPL' });
      expect(parsePositionQuery('NVDA calls')).toEqual({ intent: 'TICKER', ticker: 'NVDA' });
      expect(parsePositionQuery('TSLA puts')).toEqual({ intent: 'TICKER', ticker: 'TSLA' });
      expect(parsePositionQuery('positions in MSFT contracts')).toEqual({ intent: 'TICKER', ticker: 'MSFT' });
    });

    it('should parse asset class queries for options', () => {
      expect(parsePositionQuery('options')).toEqual({ intent: 'OPTIONS' });
      expect(parsePositionQuery('all options')).toEqual({ intent: 'OPTIONS' });
      expect(parsePositionQuery('my options')).toEqual({ intent: 'OPTIONS' });
      expect(parsePositionQuery('contracts')).toEqual({ intent: 'OPTIONS' });
      expect(parsePositionQuery('calls')).toEqual({ intent: 'OPTIONS' });
      expect(parsePositionQuery('puts')).toEqual({ intent: 'OPTIONS' });
      expect(parsePositionQuery('option positions')).toEqual({ intent: 'OPTIONS' });
    });

    it('should parse asset class queries for equities/stocks', () => {
      expect(parsePositionQuery('equities')).toEqual({ intent: 'EQUITIES' });
      expect(parsePositionQuery('all equities')).toEqual({ intent: 'EQUITIES' });
      expect(parsePositionQuery('stocks')).toEqual({ intent: 'EQUITIES' });
      expect(parsePositionQuery('all stocks')).toEqual({ intent: 'EQUITIES' });
      expect(parsePositionQuery('shares')).toEqual({ intent: 'EQUITIES' });
      expect(parsePositionQuery('my stocks')).toEqual({ intent: 'EQUITIES' });
      expect(parsePositionQuery('equity positions')).toEqual({ intent: 'EQUITIES' });
    });

    it('should parse general brokers and portfolio summary queries', () => {
      expect(parsePositionQuery('brokers')).toEqual({ intent: 'BROKERS' });
      expect(parsePositionQuery('all brokers')).toEqual({ intent: 'BROKERS' });
      expect(parsePositionQuery('portfolio')).toEqual({ intent: 'BROKERS' });
      expect(parsePositionQuery('summary')).toEqual({ intent: 'BROKERS' });
      expect(parsePositionQuery('all')).toEqual({ intent: 'BROKERS' });
      expect(parsePositionQuery('all positions')).toEqual({ intent: 'BROKERS' });
      expect(parsePositionQuery('my portfolio')).toEqual({ intent: 'BROKERS' });
    });

    it('should parse specific broker queries', () => {
      expect(parsePositionQuery('tastytrade')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'Tastytrade' });
      expect(parsePositionQuery('tasty')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'Tastytrade' });
      expect(parsePositionQuery('trading 212')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'Trading 212' });
      expect(parsePositionQuery('t212')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'Trading 212' });
      expect(parsePositionQuery('ibkr')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'Interactive Brokers' });
      expect(parsePositionQuery('interactive brokers')).toEqual({ intent: 'SPECIFIC_BROKER', brokerName: 'Interactive Brokers' });
    });

    it('should parse help commands', () => {
      expect(parsePositionQuery('help')).toEqual({ intent: 'HELP' });
      expect(parsePositionQuery('?')).toEqual({ intent: 'HELP' });
      expect(parsePositionQuery('commands')).toEqual({ intent: 'HELP' });
      expect(parsePositionQuery('info')).toEqual({ intent: 'HELP' });
    });

    it('should strip topic tags before parsing', () => {
      expect(parsePositionQuery('#positions AAPL')).toEqual({ intent: 'TICKER', ticker: 'AAPL' });
      expect(parsePositionQuery('#topic:positions options')).toEqual({ intent: 'OPTIONS' });
      expect(parsePositionQuery('💼 brokers')).toEqual({ intent: 'BROKERS' });
    });
  });

  describe('getUnderlyingFromSymbol', () => {
    it('should extract underlying from plain equity symbols', () => {
      expect(getUnderlyingFromSymbol('AAPL')).toBe('AAPL');
      expect(getUnderlyingFromSymbol('NVDA')).toBe('NVDA');
    });

    it('should extract underlying from OCC formatted option symbols', () => {
      expect(getUnderlyingFromSymbol('AAPL250117C00230000')).toBe('AAPL');
      expect(getUnderlyingFromSymbol('PLTR250221P00055000')).toBe('PLTR');
    });

    it('should prefer explicit underlyingSymbol parameter when provided', () => {
      expect(getUnderlyingFromSymbol('AAPL 250117C230', 'AAPL')).toBe('AAPL');
      expect(getUnderlyingFromSymbol('RANDOM_OPTION_CODE', 'TSLA')).toBe('TSLA');
    });

    it('should extract underlying before spaces, underscores, or dots', () => {
      expect(getUnderlyingFromSymbol('MSFT 250117 C420')).toBe('MSFT');
      expect(getUnderlyingFromSymbol('AMZN_CALL_180')).toBe('AMZN');
      expect(getUnderlyingFromSymbol('BRK.B')).toBe('BRK');
    });
  });

  describe('handlePositionsTopicMessage Integration', () => {
    const mockHoldings = [
      {
        id: 'h-1',
        symbol: 'AAPL',
        underlyingSymbol: 'AAPL',
        assetType: 'EQUITY',
        quantity: 50,
        averageCost: 180.0,
        currentPrice: 220.0,
        marketValue: 11000.0,
        unrealizedPnL: 2000.0,
        unrealizedPnLPercent: 22.22,
        currency: 'USD',
        broker: { id: 'b-1', name: 'Trading 212' },
      },
      {
        id: 'h-2',
        symbol: 'AAPL',
        underlyingSymbol: 'AAPL',
        assetType: 'EQUITY',
        quantity: 25,
        averageCost: 195.0,
        currentPrice: 220.0,
        marketValue: 5500.0,
        unrealizedPnL: 625.0,
        unrealizedPnLPercent: 12.82,
        currency: 'USD',
        broker: { id: 'b-2', name: 'Tastytrade' },
      },
      {
        id: 'h-3',
        symbol: 'AAPL 250117C230',
        underlyingSymbol: 'AAPL',
        assetType: 'OPTION',
        optionType: 'Call',
        strikePrice: 230,
        expiryDate: '2025-01-17',
        quantity: 2,
        averageCost: 4.5,
        currentPrice: 6.2,
        marketValue: 1240.0,
        unrealizedPnL: 340.0,
        unrealizedPnLPercent: 37.78,
        currency: 'USD',
        broker: { id: 'b-2', name: 'Tastytrade' },
      },
      {
        id: 'h-4',
        symbol: 'NVDA',
        underlyingSymbol: 'NVDA',
        assetType: 'EQUITY',
        quantity: 100,
        averageCost: 115.0,
        currentPrice: 135.0,
        marketValue: 13500.0,
        unrealizedPnL: 2000.0,
        unrealizedPnLPercent: 17.39,
        currency: 'USD',
        broker: { id: 'b-3', name: 'Interactive Brokers' },
      },
      {
        id: 'h-5',
        symbol: 'NVDA250321P00120000',
        underlyingSymbol: 'NVDA',
        assetType: 'OPTION',
        optionType: 'Put',
        strikePrice: 120,
        expiryDate: '2025-03-21',
        quantity: -1,
        averageCost: 5.0,
        currentPrice: 3.2,
        marketValue: -320.0,
        unrealizedPnL: 180.0,
        unrealizedPnLPercent: 36.0,
        currency: 'USD',
        broker: { id: 'b-2', name: 'Tastytrade' },
      },
    ];

    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        holding: {
          findMany: vi.fn().mockResolvedValue(mockHoldings),
        },
        broker: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'b-1', name: 'Trading 212' },
            { id: 'b-2', name: 'Tastytrade' },
            { id: 'b-3', name: 'Interactive Brokers' },
          ]),
        },
      };
    });

    it('should aggregate multi-broker positions for a specific ticker (AAPL)', async () => {
      const result = await handlePositionsTopicMessage({
        text: 'AAPL',
        chatId: 123456,
        prisma: mockPrisma,
      });

      expect(result.handled).toBe(true);
      expect(result.intent).toBe('TICKER');
      expect(result.replyText).toContain('Positions for $AAPL');
      expect(result.replyText).toContain('Trading 212');
      expect(result.replyText).toContain('Tastytrade');
      expect(result.replyText).toContain('50 share(s)');
      expect(result.replyText).toContain('25 share(s)');
      expect(result.replyText).toContain('2 contract(s)');
      expect(result.replyText).toContain('Aggregated Exposure');
      expect(result.replyText).toContain('Net Shares: *75 shares*');
      expect(result.replyText).toContain('Options: *2 contract(s)*');
    });

    it('should return a friendly message when ticker has no positions', async () => {
      const result = await handlePositionsTopicMessage({
        text: 'PLTR',
        chatId: 123456,
        prisma: mockPrisma,
      });

      expect(result.handled).toBe(true);
      expect(result.intent).toBe('TICKER');
      expect(result.replyText).toContain('No open positions found for $PLTR');
      expect(result.replyText).toContain('Tastytrade, Trading 212, Interactive Brokers');
    });

    it('should return all option positions when asking for "options"', async () => {
      const result = await handlePositionsTopicMessage({
        text: 'options',
        chatId: 123456,
        prisma: mockPrisma,
      });

      expect(result.handled).toBe(true);
      expect(result.intent).toBe('OPTIONS');
      expect(result.replyText).toContain('All Option Positions');
      expect(result.replyText).toContain('$AAPL');
      expect(result.replyText).toContain('$NVDA');
      expect(result.replyText).toContain('Options Total');
    });

    it('should return all equity positions when asking for "equities"', async () => {
      const result = await handlePositionsTopicMessage({
        text: 'equities',
        chatId: 123456,
        prisma: mockPrisma,
      });

      expect(result.handled).toBe(true);
      expect(result.intent).toBe('EQUITIES');
      expect(result.replyText).toContain('All Stock / Equity Positions');
      expect(result.replyText).toContain('$AAPL');
      expect(result.replyText).toContain('$NVDA');
      expect(result.replyText).toContain('Equities Total');
    });

    it('should return unified broker breakdown when asking for "brokers" or "all"', async () => {
      const result = await handlePositionsTopicMessage({
        text: 'brokers',
        chatId: 123456,
        prisma: mockPrisma,
      });

      expect(result.handled).toBe(true);
      expect(result.intent).toBe('BROKERS');
      expect(result.replyText).toContain('Unified Broker Portfolio Summary');
      expect(result.replyText).toContain('Trading 212');
      expect(result.replyText).toContain('Tastytrade');
      expect(result.replyText).toContain('Interactive Brokers');
      expect(result.replyText).toContain('Grand Portfolio Totals');
    });

    it('should filter by specific broker when asking for "tastytrade"', async () => {
      const result = await handlePositionsTopicMessage({
        text: 'tastytrade',
        chatId: 123456,
        prisma: mockPrisma,
      });

      expect(result.handled).toBe(true);
      expect(result.intent).toBe('SPECIFIC_BROKER');
      expect(result.replyText).toContain('Tastytrade Holdings');
      expect(result.replyText).toContain('25 shares');
      expect(result.replyText).toContain('Call');
    });

    it('should show help guide when asking for "help"', async () => {
      const result = await handlePositionsTopicMessage({
        text: 'help',
        chatId: 123456,
        prisma: mockPrisma,
      });

      expect(result.handled).toBe(true);
      expect(result.intent).toBe('HELP');
      expect(result.replyText).toContain('Positions Intelligence Assistant');
      expect(result.replyText).toContain('Ticker Lookup');
      expect(result.replyText).toContain('Asset Classes');
      expect(result.replyText).toContain('Brokers Breakdown');
    });
  });
});
