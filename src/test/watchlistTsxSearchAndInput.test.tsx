import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { normalizeTickerSymbol, searchKnownTickers, getKnownCompanyName } from '../services/commonTickers';
import { marketDataService } from '../services/marketData';
import { WatchlistPage } from '../components/WatchlistPage';

// Mock child modals & drawer modals to avoid rendering deep DOM
vi.mock('../components/PriceAlertModal', () => ({
  PriceAlertModal: () => null,
}));
vi.mock('../components/StockNoteModal', () => ({
  StockNoteModal: () => null,
}));
vi.mock('../components/AutonomousReportViewerModal', () => ({
  AutonomousReportViewerModal: () => null,
}));
vi.mock('../components/AutonomousReportsList', () => ({
  AutonomousReportsList: () => null,
}));
vi.mock('../components/watchlist/BulkWatchlistAlertModal', () => ({
  BulkWatchlistAlertModal: () => null,
}));
vi.mock('../components/watchlist/CreateWatchlistModal', () => ({
  CreateWatchlistModal: () => null,
}));
vi.mock('../components/watchlist/PopulateByCriteriaModal', () => ({
  PopulateByCriteriaModal: () => null,
}));
vi.mock('../components/watchlist/OddLotTenderModal', () => ({
  OddLotTenderModal: () => null,
}));
vi.mock('../components/watchlist/AiThematicWatchlistModal', () => ({
  AiThematicWatchlistModal: () => null,
}));

// Hoist mock functions for vitest
const { mockAddSymbolMutateAsync } = vi.hoisted(() => ({
  mockAddSymbolMutateAsync: vi.fn().mockResolvedValue({ success: true })
}));
vi.mock('../services/watchlistService', () => ({
  useWatchlists: vi.fn().mockReturnValue({
    data: [
      { id: 'wl-1', name: 'Micro caps', isDefault: false, items: [{ id: '1', symbol: 'YTY.V' }] }
    ],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useWatchlistData: vi.fn().mockReturnValue({
    data: {
      watchlist: { id: 'wl-1', name: 'Micro caps', isDefault: false, createdAt: '2026-01-01' },
      items: [
        {
          id: 'item-1',
          watchlistId: 'wl-1',
          addedAt: '2026-01-01',
          symbol: 'YTY.V',
          name: 'Wi2Wi Corporation',
          price: 0.13,
          change: 0.01,
          changePercent: 8.33,
          sector: 'Technology',
          industry: 'Semiconductors',
          currency: 'CAD',
          exchange: 'TSXV',
          marketCap: 4500000,
          pe: null,
          ps: 0.8,
          eps: null,
          operatingMargin: null,
          roe: null,
          debtToEquity: null,
          fiftyTwoWeekHigh: 0.25,
          fiftyTwoWeekLow: 0.08,
          volume: 50000,
        }
      ]
    },
    isLoading: false,
    isRefetching: false,
    refetch: vi.fn(),
  }),
  useCreateWatchlist: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
  useRenameWatchlist: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
  useDeleteWatchlist: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
  useAddSymbolToWatchlist: vi.fn().mockReturnValue({
    mutateAsync: mockAddSymbolMutateAsync,
    isPending: false,
  }),
  useRemoveSymbolFromWatchlist: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
}));

vi.mock('../services/alertService', () => ({
  useAlerts: vi.fn().mockReturnValue({ data: [] }),
}));
vi.mock('../services/promptService', () => ({
  useReportPrompts: vi.fn().mockReturnValue({ data: [] }),
}));
vi.mock('../services/noteService', () => ({
  useStockNotesMap: vi.fn().mockReturnValue({ notesMap: {} }),
}));
vi.mock('../services/reportService', () => ({
  useAutonomousReports: vi.fn().mockReturnValue({ data: [] }),
  reportService: { generateReport: vi.fn() },
}));
vi.mock('../services/researchData', () => ({
  useResearchDossier: vi.fn().mockReturnValue({ data: null, isLoading: false }),
  useAIAnalysis: vi.fn().mockReturnValue({ data: null, isLoading: false }),
}));

describe('Toronto Stock Exchange (TSX) Normalization & Searchbox Visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. normalizeTickerSymbol Helper', () => {
    it('normalizes TSX prefix and suffix variants to .TO', () => {
      expect(normalizeTickerSymbol('TSX:SHOP')).toBe('SHOP.TO');
      expect(normalizeTickerSymbol('SHOP:TSX')).toBe('SHOP.TO');
      expect(normalizeTickerSymbol('TSE:SHOP')).toBe('SHOP.TO');
      expect(normalizeTickerSymbol('SHOP:TSE')).toBe('SHOP.TO');
      expect(normalizeTickerSymbol('SHOP.TSX')).toBe('SHOP.TO');
      expect(normalizeTickerSymbol('SHOP-TO')).toBe('SHOP.TO');
      expect(normalizeTickerSymbol('SHOP:TO')).toBe('SHOP.TO');
      expect(normalizeTickerSymbol('TSX:RY')).toBe('RY.TO');
      expect(normalizeTickerSymbol('RY:TSX')).toBe('RY.TO');
    });

    it('normalizes TSX Venture prefix and suffix variants to .V', () => {
      expect(normalizeTickerSymbol('TSXV:YTY')).toBe('YTY.V');
      expect(normalizeTickerSymbol('YTY:TSXV')).toBe('YTY.V');
      expect(normalizeTickerSymbol('YTY:V')).toBe('YTY.V');
      expect(normalizeTickerSymbol('YTY.V')).toBe('YTY.V');
      expect(normalizeTickerSymbol('TSX-V:YTY')).toBe('YTY.V');
      expect(normalizeTickerSymbol('YTY:TSX-V')).toBe('YTY.V');
    });

    it('normalizes NEO and CSE formats', () => {
      expect(normalizeTickerSymbol('NEO:SHPY')).toBe('SHPY.NE');
      expect(normalizeTickerSymbol('SHPY:NEO')).toBe('SHPY.NE');
      expect(normalizeTickerSymbol('CSE:XYZ')).toBe('XYZ.CN');
      expect(normalizeTickerSymbol('XYZ:CSE')).toBe('XYZ.CN');
    });

    it('leaves standard US tickers and class shares intact', () => {
      expect(normalizeTickerSymbol('AAPL')).toBe('AAPL');
      expect(normalizeTickerSymbol('NVDA')).toBe('NVDA');
      expect(normalizeTickerSymbol('BRK.B')).toBe('BRK.B');
    });
  });

  describe('2. searchKnownTickers Instant Autocomplete', () => {
    it('finds Canadian TSX tickers by prefix, normalized prefix, or company name', () => {
      const shopMatches = searchKnownTickers('TSX:SHOP');
      expect(shopMatches.some(m => m.symbol === 'SHOP.TO')).toBe(true);

      const ryMatches = searchKnownTickers('Royal Bank');
      expect(ryMatches.some(m => m.symbol === 'RY.TO' && m.stockExchange === 'TSX')).toBe(true);

      const ytyMatches = searchKnownTickers('Wi2Wi');
      expect(ytyMatches.some(m => m.symbol === 'YTY.V' && m.stockExchange === 'TSXV')).toBe(true);
    });
  });

  describe('3. marketDataService.searchSymbols for TSX', () => {
    it('normalizes TSX colon input and returns Canadian exchange info', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { symbol: 'SHOP.TO', name: 'Shopify Inc.', stockExchange: 'TOR', exchangeShortName: 'TOR' }
        ]
      });
      global.fetch = mockFetch;

      const results = await marketDataService.searchSymbols('TSX:SHOP');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].symbol).toBe('SHOP.TO');
      expect(results[0].stockExchange).toBe('TSX');
      expect(results[0].currency).toBe('CAD');
    });
  });

  describe('4. WatchlistPage Searchbox Layout & Input Visibility', () => {
    it('renders the searchbox with clearly visible input, placeholder, and handles typing and adding TSX ticker', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <WatchlistPage />
        </QueryClientProvider>
      );

      // Search input should have high-visibility class and clear placeholder
      const searchInput = screen.getByPlaceholderText(/Search or add ticker/i) as HTMLInputElement;
      expect(searchInput).toBeDefined();
      expect(searchInput.className).toContain('text-foreground');
      expect(searchInput.className).toContain('pl-10');

      // User types a TSX ticker into the searchbox
      fireEvent.change(searchInput, { target: { value: 'TSX:SHOP' } });
      expect(searchInput.value).toBe('TSX:SHOP');

      // User presses Enter
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      // Verify that the ticker was normalized to SHOP.TO before adding to the watchlist
      await waitFor(() => {
        expect(mockAddSymbolMutateAsync).toHaveBeenCalledWith({
          watchlistId: 'wl-1',
          symbol: 'SHOP.TO',
        });
      });
    });

    it('renders Canadian TSX badge and C$ currency symbol in watchlist table row', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <WatchlistPage />
        </QueryClientProvider>
      );

      // Table row for YTY.V should display TSXV badge
      expect(screen.getAllByText('TSXV').length).toBeGreaterThan(0);
      // Price should be formatted with C$ prefix for Canadian currency
      expect(screen.getByText('C$0.13')).toBeDefined();
    });
  });
});
