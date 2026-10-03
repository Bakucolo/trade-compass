import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HoldingsTable } from '../components/portfolio/HoldingsTable';
import { UnifiedPosition } from '../components/portfolio/types';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithClient(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

const samplePositions: UnifiedPosition[] = [
  // 1. RBRK - Option only
  {
    id: 'pos-rbrk-opt',
    symbol: 'RBRK  261018C00120000',
    underlyingSymbol: 'RBRK',
    description: 'Rubrik Call Option',
    quantity: -1,
    averageCost: 25.65,
    currentPrice: 27.15,
    marketValue: -2715,
    dayChange: -65.0,
    dayChangePercent: -2.4,
    unrealizedPL: -150.0,
    unrealizedPLPercent: -5.8,
    source: 'Tastytrade',
    assetType: 'Option',
    strike: 120,
    expiry: '20261018',
    dte: 49,
    optionType: 'Call',
    underlyingPrice: 118.54,
    delta: -0.56,
  },
  // 2. AAPL - Stock only
  {
    id: 'pos-aapl-stock',
    symbol: 'AAPL',
    underlyingSymbol: 'AAPL',
    description: 'Apple Inc',
    quantity: 50,
    averageCost: 210.0,
    currentPrice: 225.0,
    marketValue: 11250,
    dayChange: 45.0,
    dayChangePercent: 0.4,
    unrealizedPL: 750.0,
    unrealizedPLPercent: 7.1,
    source: 'Tastytrade',
    assetType: 'Stock',
  },
  // 3. TSLA - Option only
  {
    id: 'pos-tsla-opt',
    symbol: 'TSLA  261120P00200000',
    underlyingSymbol: 'TSLA',
    description: 'Tesla Put Option',
    quantity: -1,
    averageCost: 8.5,
    currentPrice: 7.0,
    marketValue: -700,
    dayChange: 20.0,
    dayChangePercent: 2.8,
    unrealizedPL: 150.0,
    unrealizedPLPercent: 17.6,
    source: 'Tastytrade',
    assetType: 'Option',
    strike: 200,
    expiry: '20261120',
    dte: 55,
    optionType: 'Put',
    underlyingPrice: 215.0,
    delta: 0.35,
  }
];

describe('Tastytrade Positions View - Options Filter & Full Window', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders Tastytrade view by default when no saved preference exists', () => {
    renderWithClient(<HoldingsTable positions={samplePositions} isLoading={false} />);

    // Tastytrade positions engine header is present by default
    expect(screen.getByText(/TASTYTRADE POSITIONS ENGINE/i)).toBeInTheDocument();
    expect(screen.getByText('ETF Δ')).toBeInTheDocument();
  });

  it('filters by Options while STAYING in Tastytrade view (does not drop back to Classic view)', () => {
    renderWithClient(<HoldingsTable positions={samplePositions} isLoading={false} />);

    // Initially in Tastytrade view with all positions (RBRK, AAPL, TSLA)
    expect(screen.getByText(/TASTYTRADE POSITIONS ENGINE/i)).toBeInTheDocument();
    expect(screen.getByText('AAPL')).toBeInTheDocument();

    // Click "Options (2)" button in the layout tabs
    const optionsTab = screen.getByRole('button', { name: /options \(2\)/i });
    fireEvent.click(optionsTab);

    // Stays in Tastytrade view!
    expect(screen.getByText(/TASTYTRADE POSITIONS ENGINE/i)).toBeInTheDocument();

    // Only options underlyings (RBRK and TSLA) should be shown, AAPL (equity only) is filtered out
    expect(screen.getByText('RBRK')).toBeInTheDocument();
    expect(screen.getByText('TSLA')).toBeInTheDocument();
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
  });

  it('filters by Equities while staying in Tastytrade view', () => {
    renderWithClient(<HoldingsTable positions={samplePositions} isLoading={false} />);

    const equitiesTab = screen.getByRole('button', { name: /equities \(1\)/i });
    fireEvent.click(equitiesTab);

    // Stays in Tastytrade view
    expect(screen.getByText(/TASTYTRADE POSITIONS ENGINE/i)).toBeInTheDocument();

    // Only AAPL is shown
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.queryByText('RBRK')).not.toBeInTheDocument();
    expect(screen.queryByText('TSLA')).not.toBeInTheDocument();
  });

  it('allows switching to Classic view while preserving the Options filter, and switching back to Tastytrade view', () => {
    renderWithClient(<HoldingsTable positions={samplePositions} isLoading={false} />);

    // Filter to Options in Tastytrade view
    const optionsTab = screen.getByRole('button', { name: /options \(2\)/i });
    fireEvent.click(optionsTab);
    expect(screen.getByText(/TASTYTRADE POSITIONS ENGINE/i)).toBeInTheDocument();

    // Switch to Classic view
    const classicBtn = screen.getByRole('button', { name: /classic view/i });
    fireEvent.click(classicBtn);

    // Classic options section is visible, equities section is hidden
    expect(screen.getByText(/Options & Derivatives/i)).toBeInTheDocument();
    expect(screen.queryByText(/Equities & Stocks/i)).not.toBeInTheDocument();

    // Switch back to Tastytrade view
    const tastyBtn = screen.getByRole('button', { name: /⚡ tastytrade view/i });
    fireEvent.click(tastyBtn);

    // Back in Tastytrade view with Options filter preserved!
    expect(screen.getByText(/TASTYTRADE POSITIONS ENGINE/i)).toBeInTheDocument();
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    expect(screen.getByText('RBRK')).toBeInTheDocument();
  });

  it('expands to Full Window mode on button click and exits on Exit button click or Escape key', () => {
    renderWithClient(<HoldingsTable positions={samplePositions} isLoading={false} />);

    // Click "Full Window" button in toolbar
    const fullWindowBtns = screen.getAllByRole('button', { name: /full window/i });
    expect(fullWindowBtns.length).toBeGreaterThan(0);
    fireEvent.click(fullWindowBtns[0]);

    // Full Window banner is rendered
    expect(screen.getByText(/FULL WINDOW POSITIONS VIEW/i)).toBeInTheDocument();

    // Click Exit Full Window (from banner or subheader)
    const exitBtns = screen.getAllByRole('button', { name: /exit full window/i });
    expect(exitBtns.length).toBeGreaterThan(0);
    fireEvent.click(exitBtns[0]);

    // Banner is gone
    expect(screen.queryByText(/FULL WINDOW POSITIONS VIEW/i)).not.toBeInTheDocument();

    // Re-open and test Escape key
    const fullWindowBtnAgain = screen.getAllByRole('button', { name: /full window/i })[0];
    fireEvent.click(fullWindowBtnAgain);
    expect(screen.getByText(/FULL WINDOW POSITIONS VIEW/i)).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText(/FULL WINDOW POSITIONS VIEW/i)).not.toBeInTheDocument();
  });
});
