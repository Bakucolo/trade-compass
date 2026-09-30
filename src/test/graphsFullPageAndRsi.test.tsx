import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GraphsPage } from '../components/GraphsPage';
import { TradingViewChart } from '../components/graphs/TradingViewChart';

// Mock child modals
vi.mock('../components/StockNoteModal', () => ({
  StockNoteModal: () => <div data-testid="stock-note-modal" />,
}));

vi.mock('../components/PriceAlertModal', () => ({
  PriceAlertModal: () => <div data-testid="price-alert-modal" />,
}));

vi.mock('../components/graphs/TechnicalAnalysisModal', () => ({
  TechnicalAnalysisModal: () => <div data-testid="technical-modal" />,
}));

vi.mock('../components/graphs/ImpliedExpectationsModal', () => ({
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

vi.mock('../services/ibkr', () => ({
  useIBKRPortfolio: () => ({ data: [] }),
}));
vi.mock('../services/tastytrade', () => ({
  useTastytradePositions: () => ({ data: [] }),
}));
vi.mock('../services/trading212', () => ({
  useTrading212Positions: () => ({ data: [] }),
}));

vi.mock('../services/alertService', () => ({
  useAlerts: () => ({ data: [] }),
  useCreateAlert: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../services/noteService', () => ({
  useStockNotesMap: () => ({ notesMap: {} }),
}));

vi.mock('../services/technicalAnalysisService', () => ({
  useTechnicalAnalysis: () => ({
    data: {
      marketPhase: { stage: 2, stageName: 'Stage 2 - Markup', subPhaseName: 'Early Uptrend' },
      immediateResistance: { price: 240, distancePercent: 4.3 },
      immediateSupport: { price: 220, distancePercent: -4.3 },
      movingAverages: { dma20: 225 },
      oscillators: { rsi14: 55 },
    },
  }),
  getStageColor: () => ({ badge: 'bg-emerald-500/20 text-emerald-400' }),
}));

vi.mock('../services/impliedExpectationsService', () => ({
  useImpliedExpectations: () => ({ data: null }),
}));

describe('TradingViewChart component studies & RSI behavior', () => {
  let mockWidgetConstructor: any;

  beforeEach(() => {
    mockWidgetConstructor = vi.fn();
    (window as any).TradingView = {
      widget: mockWidgetConstructor,
    };
  });

  it('does NOT include RSI in default studies when showRsi is omitted or false', () => {
    render(<TradingViewChart symbol="AAPL" />);
    expect(mockWidgetConstructor).toHaveBeenCalled();
    const callArgs = mockWidgetConstructor.mock.calls[0][0];
    expect(callArgs.studies).toEqual(['MASimple@tv-basicstudies', 'Volume@tv-basicstudies']);
    expect(callArgs.studies).not.toContain('RSI@tv-basicstudies');
  });

  it('includes RSI in studies when showRsi is explicitly set to true', () => {
    render(<TradingViewChart symbol="NVDA" showRsi={true} />);
    expect(mockWidgetConstructor).toHaveBeenCalled();
    const callArgs = mockWidgetConstructor.mock.calls[0][0];
    expect(callArgs.studies).toContain('RSI@tv-basicstudies');
  });

  it('does NOT include RSI when showRsi is explicitly set to false', () => {
    render(<TradingViewChart symbol="TSLA" showRsi={false} />);
    expect(mockWidgetConstructor).toHaveBeenCalled();
    const callArgs = mockWidgetConstructor.mock.calls[0][0];
    expect(callArgs.studies).not.toContain('RSI@tv-basicstudies');
  });
});

describe('GraphsPage Full Page Chart Mode and RSI Toggle', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    localStorage.setItem('graphs_selected_watchlist', 'w1');
  });

  it('renders with RSI OFF by default and allows toggling RSI ON and OFF', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GraphsPage initialSymbol="AAPL" />
      </QueryClientProvider>
    );

    // RSI should be OFF by default
    const rsiButtons = screen.getAllByRole('button', { name: /RSI: OFF/i });
    expect(rsiButtons.length).toBeGreaterThan(0);

    // Click RSI toggle button
    fireEvent.click(rsiButtons[0]);

    // RSI button should now indicate ON
    const rsiOnButtons = screen.getAllByRole('button', { name: /RSI: ON/i });
    expect(rsiOnButtons.length).toBeGreaterThan(0);

    // Click again to turn it OFF
    fireEvent.click(rsiOnButtons[0]);
    expect(screen.getAllByRole('button', { name: /RSI: OFF/i }).length).toBeGreaterThan(0);
  });

  it('opens Full Page chart overlay when clicking the Full Page button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GraphsPage initialSymbol="AAPL" />
      </QueryClientProvider>
    );

    // Initially full page overlay is not mounted
    expect(screen.queryByTestId('full-page-chart-overlay')).toBeNull();

    // Click "Full Page" button in action bar or chart HUD
    const fullPageButtons = screen.getAllByRole('button', { name: /Full Page/i });
    expect(fullPageButtons.length).toBeGreaterThan(0);
    fireEvent.click(fullPageButtons[0]);

    // Full page overlay is now visible
    const overlay = screen.getByTestId('full-page-chart-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay).toHaveTextContent('$AAPL');

    // Controls inside full page overlay
    expect(screen.getByRole('button', { name: /Exit Full Page/i })).toBeTruthy();
  });

  it('exits Full Page mode when clicking the Exit Full Page button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GraphsPage initialSymbol="AAPL" />
      </QueryClientProvider>
    );

    // Open full page
    const fullPageButtons = screen.getAllByRole('button', { name: /Full Page/i });
    fireEvent.click(fullPageButtons[0]);
    expect(screen.getByTestId('full-page-chart-overlay')).toBeTruthy();

    // Click exit button
    const exitBtn = screen.getByRole('button', { name: /Exit Full Page/i });
    fireEvent.click(exitBtn);

    // Overlay is closed
    expect(screen.queryByTestId('full-page-chart-overlay')).toBeNull();
  });

  it('exits Full Page mode when pressing the Escape key', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GraphsPage initialSymbol="AAPL" />
      </QueryClientProvider>
    );

    // Open full page
    const fullPageButtons = screen.getAllByRole('button', { name: /Full Page/i });
    fireEvent.click(fullPageButtons[0]);
    expect(screen.getByTestId('full-page-chart-overlay')).toBeTruthy();

    // Press Escape key on window
    fireEvent.keyDown(window, { key: 'Escape' });

    // Overlay is closed
    expect(screen.queryByTestId('full-page-chart-overlay')).toBeNull();
  });

  it('allows switching ticker inside Full Page mode', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GraphsPage initialSymbol="AAPL" />
      </QueryClientProvider>
    );

    // Open full page
    const fullPageButtons = screen.getAllByRole('button', { name: /Full Page/i });
    fireEvent.click(fullPageButtons[0]);
    const overlay = screen.getByTestId('full-page-chart-overlay');
    expect(overlay).toHaveTextContent('$AAPL');

    // Find quick ticker switcher input inside overlay
    const switchInput = screen.getByPlaceholderText('Switch ticker...');
    fireEvent.change(switchInput, { target: { value: 'NVDA' } });
    fireEvent.keyDown(switchInput, { key: 'Enter' });

    // Overlay should now display NVDA
    expect(screen.getByTestId('full-page-chart-overlay')).toHaveTextContent('$NVDA');
  });

  it('allows toggling RSI inside Full Page mode', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GraphsPage initialSymbol="AAPL" />
      </QueryClientProvider>
    );

    // Open full page
    const fullPageButtons = screen.getAllByRole('button', { name: /Full Page/i });
    fireEvent.click(fullPageButtons[0]);

    // Inside overlay, find RSI button
    const overlay = screen.getByTestId('full-page-chart-overlay');
    const rsiBtn = overlay.querySelector('button[title*="RSI"]');
    expect(rsiBtn).toBeTruthy();
    expect(rsiBtn?.textContent).toContain('RSI: OFF');

    // Click to turn ON
    fireEvent.click(rsiBtn!);
    expect(rsiBtn?.textContent).toContain('RSI: ON');
  });
});
