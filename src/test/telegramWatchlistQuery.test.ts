import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isListAllWatchlistsQuery,
  parseCriteriaFilter,
  matchesStockCriteria,
  handleWatchlistTopicMessage,
  WatchlistStockWithQuote,
} from '../../server/services/telegramWatchlistQueryService';

describe('Telegram Watchlist Query Service', () => {
  describe('isListAllWatchlistsQuery', () => {
    it('should identify list all watchlists commands and queries', () => {
      expect(isListAllWatchlistsQuery('/watchlists')).toBe(true);
      expect(isListAllWatchlistsQuery('watchlists')).toBe(true);
      expect(isListAllWatchlistsQuery('all watchlists')).toBe(true);
      expect(isListAllWatchlistsQuery('show watchlists')).toBe(true);
      expect(isListAllWatchlistsQuery('get watchlists')).toBe(true);
      expect(isListAllWatchlistsQuery('list watchlists')).toBe(true);
      expect(isListAllWatchlistsQuery('my watchlists')).toBe(true);
      expect(isListAllWatchlistsQuery('what watchlists do I have?')).toBe(true);
      expect(isListAllWatchlistsQuery('list')).toBe(true);
      expect(isListAllWatchlistsQuery('all')).toBe(true);
      expect(isListAllWatchlistsQuery('show all')).toBe(true);
    });

    it('should not match specific watchlist queries or stock additions', () => {
      expect(isListAllWatchlistsQuery('Semiconductors PE < 30')).toBe(false);
      expect(isListAllWatchlistsQuery('show Semiconductors')).toBe(false);
      expect(isListAllWatchlistsQuery('Tech NVDA AAPL')).toBe(false);
      expect(isListAllWatchlistsQuery('Nuclear Energy')).toBe(false);
    });
  });

  describe('parseCriteriaFilter', () => {
    it('should parse P/E ratio criteria', () => {
      const f1 = parseCriteriaFilter('PE < 30');
      expect(f1.maxPe).toBe(30);

      const f2 = parseCriteriaFilter('p/e under 25');
      expect(f2.maxPe).toBe(25);

      const f3 = parseCriteriaFilter('pe > 15');
      expect(f3.minPe).toBe(15);

      const f4 = parseCriteriaFilter('pe between 12 and 28');
      expect(f4.minPe).toBe(12);
      expect(f4.maxPe).toBe(28);

      const f5 = parseCriteriaFilter('lowest pe');
      expect(f5.sortBy).toBe('pe');
      expect(f5.sortOrder).toBe('asc');
    });

    it('should parse price criteria', () => {
      const f1 = parseCriteriaFilter('price < 100');
      expect(f1.maxPrice).toBe(100);

      const f2 = parseCriteriaFilter('price under $150.50');
      expect(f2.maxPrice).toBe(150.5);

      const f3 = parseCriteriaFilter('price > 50');
      expect(f3.minPrice).toBe(50);
    });

    it('should parse day change and direction criteria', () => {
      const f1 = parseCriteriaFilter('green');
      expect(f1.direction).toBe('UP');
      expect(f1.minChangePercent).toBe(0);

      const f2 = parseCriteriaFilter('up today');
      expect(f2.direction).toBe('UP');

      const f3 = parseCriteriaFilter('red');
      expect(f3.direction).toBe('DOWN');
      expect(f3.maxChangePercent).toBe(0);

      const f4 = parseCriteriaFilter('dip');
      expect(f4.direction).toBe('DOWN');

      const f5 = parseCriteriaFilter('up > 2%');
      expect(f5.direction).toBe('UP');
      expect(f5.minChangePercent).toBe(2);

      const f6 = parseCriteriaFilter('down > 3%');
      expect(f6.direction).toBe('DOWN');
      expect(f6.maxChangePercent).toBe(-3);
    });

    it('should parse market cap and sorting criteria', () => {
      const f1 = parseCriteriaFilter('mcap > 500B');
      expect(f1.minMarketCap).toBe(500e9);

      const f2 = parseCriteriaFilter('market cap < 2T');
      expect(f2.maxMarketCap).toBe(2e12);

      const f3 = parseCriteriaFilter('mega cap');
      expect(f3.minMarketCap).toBe(200e9);

      const f4 = parseCriteriaFilter('top 5 best performers');
      expect(f4.limit).toBe(5);
      expect(f4.sortBy).toBe('change');
      expect(f4.sortOrder).toBe('desc');
    });
  });

  describe('matchesStockCriteria', () => {
    const mockStockA: WatchlistStockWithQuote = {
      symbol: 'TSM',
      name: 'Taiwan Semiconductor',
      price: 185.0,
      change: 2.5,
      changePercent: 1.37,
      marketCap: 960e9,
      pe: 24.2,
    };

    const mockStockB: WatchlistStockWithQuote = {
      symbol: 'NVDA',
      name: 'NVIDIA Corp',
      price: 130.0,
      change: -1.2,
      changePercent: -0.91,
      marketCap: 3.2e12,
      pe: 48.5,
    };

    it('should correctly filter by P/E ratio', () => {
      const filter = { maxPe: 30 };
      expect(matchesStockCriteria(mockStockA, filter)).toBe(true);
      expect(matchesStockCriteria(mockStockB, filter)).toBe(false);
    });

    it('should correctly filter by price', () => {
      const filter = { maxPrice: 150 };
      expect(matchesStockCriteria(mockStockA, filter)).toBe(false);
      expect(matchesStockCriteria(mockStockB, filter)).toBe(true);
    });

    it('should correctly filter by direction', () => {
      const upFilter = { direction: 'UP' as const, minChangePercent: 0 };
      expect(matchesStockCriteria(mockStockA, upFilter)).toBe(true);
      expect(matchesStockCriteria(mockStockB, upFilter)).toBe(false);

      const downFilter = { direction: 'DOWN' as const, maxChangePercent: 0 };
      expect(matchesStockCriteria(mockStockA, downFilter)).toBe(false);
      expect(matchesStockCriteria(mockStockB, downFilter)).toBe(true);
    });

    it('should correctly filter by market cap', () => {
      const filter = { minMarketCap: 1e12 };
      expect(matchesStockCriteria(mockStockA, filter)).toBe(false);
      expect(matchesStockCriteria(mockStockB, filter)).toBe(true);
    });
  });

  describe('handleWatchlistTopicMessage integration', () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        watchlist: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'wl-1',
              name: 'Semiconductors',
              items: [
                { symbol: 'NVDA', watchlistId: 'wl-1' },
                { symbol: 'TSM', watchlistId: 'wl-1' },
                { symbol: 'AMD', watchlistId: 'wl-1' },
              ],
            },
            {
              id: 'wl-2',
              name: 'Nuclear Energy',
              items: [
                { symbol: 'CCJ', watchlistId: 'wl-2' },
                { symbol: 'CEG', watchlistId: 'wl-2' },
              ],
            },
          ]),
        },
      };
    });

    it('should handle "all watchlists" query and return formatted summary', async () => {
      const result = await handleWatchlistTopicMessage({
        text: 'all watchlists',
        chatId: 12345,
        prisma: mockPrisma,
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('LIST_ALL');
      expect(result.replyText).toContain('Your Trade Compass Watchlists');
      expect(result.replyText).toContain('Semiconductors');
      expect(result.replyText).toContain('Nuclear Energy');
    });

    it('should identify a query for a specific watchlist and filter with criteria', async () => {
      const result = await handleWatchlistTopicMessage({
        text: 'Semiconductors PE < 50',
        chatId: 12345,
        prisma: mockPrisma,
      });

      expect(result.handled).toBe(true);
      expect(result.actionTaken).toBe('CRITERIA_QUERY');
      expect(result.replyText).toContain('Semiconductors');
    });

    it('should not intercept stock additions e.g. "Semiconductors NVDA TSM AMD"', async () => {
      const result = await handleWatchlistTopicMessage({
        text: 'Semiconductors NVDA TSM AMD',
        chatId: 12345,
        prisma: mockPrisma,
      });

      // Pure tickers should be deferred to the ADD STOCKS handler!
      expect(result.handled).toBe(false);
      expect(result.actionTaken).toBe('NOT_QUERY');
    });
  });
});
