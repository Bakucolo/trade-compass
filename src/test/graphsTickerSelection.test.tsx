import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GraphsPage } from '../components/GraphsPage';

// Mock child modals and chart to isolate GraphsPage logic
vi.mock('../components/graphs/TradingViewChart', () => ({
  TradingViewChart: ({ symbol }: { symbol: string }) => (
    <div data-testid="tradingview-chart" data-symbol={symbol}>
      Chart for {symbol}
    </div>
  ),
}));

vi.mock('../components/StockNoteModal', () => ({
  StockNoteModal: () => <div data-testid="stock-note-modal" />,
}));

vi.mock('../components/PriceAlertModal', () => ({
  PriceAlertModal: () => <div data-testid="price-alert-modal" />,
}));

vi.mock('../components/TechnicalAnalysisModal', () => ({
  TechnicalAnalysisModal: () => <div data-testid="technical-modal" />,
}));

vi.mock('../components/ImpliedExpectationsModal', () => ({
  ImpliedExpectationsModal: () => <div data-testid="expectations-modal" />,
}));

// Mock watchlistService
vi.mock('../services/watchlistService', () => ({
  useWatchlists: () => ({
    data: [
      { id: 'w1', name: 'Tech Leaders', isDefault: true },
    ],
    isLoading: false,
  }),
  useWatchlistData: () => ({
    data: {
      id: 'w1',
      name: 'Tech Leaders',
      items: [
        { symbol: 'AAPL', name: 'Apple Inc.', price: 230, change: 1.5, changePercent: 0.65 },
        { symbol: 'MSFT', name: 'Microsoft Corp.', price: 420, change: -2.0, changePercent: -0.47 },
      ],
    },
    isLoading: false,
  }),
  useAddSymbolToWatchlist: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock('../hooks/usePortfolio', () => ({
  useIBKRPortfolio: () => ({ data: [] }),
  useTastytradePositions: () => ({ data: [] }),
  useTrading212Positions: () => ({ data: [] }),
}));

vi.mock('../hooks/useAlerts', () => ({
  useAlerts: () => ({ data: [] }),
  useCreateAlert: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../hooks/useStockNotes', () => ({
  useStockNotesMap: () => ({ notesMap: {} }),
}));

vi.mock('../hooks/useTechnicalAnalysis', () => ({
  useTechnicalAnalysis: () => ({ data: null }),
}));

vi.mock('../hooks/useImpliedExpectations', () => ({
  useImpliedExpectations: () => ({ data: null }),
}));

describe('GraphsPage Ticker Search & Selection', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    localStorage.setItem('graphs_selected_watchlist', 'w1');
  });

  it('updates the active ticker and TradingView chart when clicking a stock in the list', async () => {
    const onSelectSymbol = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <GraphsPage
          initialSymbol="AAPL"
          onSelectSymbol={onSelectSymbol}
        />
      </QueryClientProvider>
    );

    // Initial symbol is AAPL
    expect(screen.getByTestId('tradingview-chart')).toHaveAttribute('data-symbol', 'AAPL');

    // Wait for watchlist items to be available and click MSFT
    const msftItem = await screen.findByText('MSFT');
    fireEvent.click(msftItem);

    // Verify chart and selection updated to MSFT
    await waitFor(() => {
      expect(screen.getByTestId('tradingview-chart')).toHaveAttribute('data-symbol', 'MSFT');
    });
    expect(onSelectSymbol).toHaveBeenCalledWith('MSFT');
  });

  it('updates the active ticker when searching for a ticker not currently in the watchlist', async () => {
    const onSelectSymbol = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <GraphsPage
          initialSymbol="AAPL"
          onSelectSymbol={onSelectSymbol}
        />
      </QueryClientProvider>
    );

    // Search for NVDA
    const searchInput = screen.getByPlaceholderText(/Look up any ticker/i);
    fireEvent.change(searchInput, { target: { value: 'NVDA' } });
    fireEvent.submit(searchInput.closest('form')!);

    // Should immediately switch to NVDA
    await waitFor(() => {
      expect(screen.getByTestId('tradingview-chart')).toHaveAttribute('data-symbol', 'NVDA');
    });
    expect(onSelectSymbol).toHaveBeenCalledWith('NVDA');
  });

  it('allows clicking the exact Chart button on unlisted ticker quick-card', async () => {
    const onSelectSymbol = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <GraphsPage
          initialSymbol="AAPL"
          onSelectSymbol={onSelectSymbol}
        />
      </QueryClientProvider>
    );

    const searchInput = screen.getByPlaceholderText(/Look up any ticker/i);
    fireEvent.change(searchInput, { target: { value: 'CCJ' } });

    // The quick add card should show with an exact "Chart" button
    const chartButton = await screen.findByRole('button', { name: /^Chart$/i });
    fireEvent.click(chartButton);

    await waitFor(() => {
      expect(screen.getByTestId('tradingview-chart')).toHaveAttribute('data-symbol', 'CCJ');
    });
    expect(onSelectSymbol).toHaveBeenCalledWith('CCJ');
  });

  it('does NOT reset back to AAPL when parent re-renders or background updates occur', async () => {
    const onSelectSymbol = vi.fn();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <GraphsPage
          initialSymbol="AAPL"
          onSelectSymbol={onSelectSymbol}
        />
      </QueryClientProvider>
    );

    // Search and select TSLA
    const searchInput = screen.getByPlaceholderText(/Look up any ticker/i);
    fireEvent.change(searchInput, { target: { value: 'TSLA' } });
    fireEvent.submit(searchInput.closest('form')!);

    await waitFor(() => {
      expect(screen.getByTestId('tradingview-chart')).toHaveAttribute('data-symbol', 'TSLA');
    });

    // Simulate parent re-render with identical initialSymbol="AAPL"
    rerender(
      <QueryClientProvider client={queryClient}>
        <GraphsPage
          initialSymbol="AAPL"
          onSelectSymbol={onSelectSymbol}
        />
      </QueryClientProvider>
    );

    // Should remain TSLA, NOT revert back to AAPL!
    expect(screen.getByTestId('tradingview-chart')).toHaveAttribute('data-symbol', 'TSLA');
  });

  describe('formatTradingViewSymbol', () => {
    it('resolves NASDAQ leaders with NASDAQ: prefix', async () => {
      const { formatTradingViewSymbol } = await vi.importActual<any>('../components/graphs/TradingViewChart');
      expect(formatTradingViewSymbol('AAPL')).toBe('NASDAQ:AAPL');
      expect(formatTradingViewSymbol('NVDA')).toBe('NASDAQ:NVDA');
      expect(formatTradingViewSymbol('TSLA')).toBe('NASDAQ:TSLA');
      expect(formatTradingViewSymbol('QQQ')).toBe('NASDAQ:QQQ');
    });

    it('resolves NYSE leaders with NYSE: prefix', async () => {
      const { formatTradingViewSymbol } = await vi.importActual<any>('../components/graphs/TradingViewChart');
      expect(formatTradingViewSymbol('CCJ')).toBe('NYSE:CCJ');
      expect(formatTradingViewSymbol('SMR')).toBe('NYSE:SMR');
      expect(formatTradingViewSymbol('OKLO')).toBe('NYSE:OKLO');
      expect(formatTradingViewSymbol('BABA')).toBe('NYSE:BABA');
    });

    it('resolves major ETFs with AMEX: prefix', async () => {
      const { formatTradingViewSymbol } = await vi.importActual<any>('../components/graphs/TradingViewChart');
      expect(formatTradingViewSymbol('SPY')).toBe('AMEX:SPY');
      expect(formatTradingViewSymbol('IWM')).toBe('AMEX:IWM');
      expect(formatTradingViewSymbol('URA')).toBe('AMEX:URA');
    });

    it('resolves international suffixes correctly', async () => {
      const { formatTradingViewSymbol } = await vi.importActual<any>('../components/graphs/TradingViewChart');
      expect(formatTradingViewSymbol('VOD.L')).toBe('LON:VOD');
      expect(formatTradingViewSymbol('BHP.AX')).toBe('ASX:BHP');
      expect(formatTradingViewSymbol('SHOP.TO')).toBe('TSX:SHOP');
      expect(formatTradingViewSymbol('SAP.DE')).toBe('XETR:SAP');
    });

    it('handles OCC option strings by extracting underlying', async () => {
      const { formatTradingViewSymbol } = await vi.importActual<any>('../components/graphs/TradingViewChart');
      expect(formatTradingViewSymbol('AAPL250117C00200000')).toBe('NASDAQ:AAPL');
    });
  });
});
