import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TastytradePositionsTable } from '../components/portfolio/TastytradePositionsTable';
import { HoldingsTable } from '../components/portfolio/HoldingsTable';
import { UnifiedPosition } from '../components/portfolio/types';
import {
  groupPositionsForTastytrade,
  extractUnderlyingSymbol,
  isOptionITM,
} from '../utils/tastytradePositionsUtils';

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

const mockPositions: UnifiedPosition[] = [
  // 1. RBRK with an ITM Short Call option
  {
    id: 'pos-rbrk-opt',
    symbol: 'RBRK  261018C00120000',
    underlyingSymbol: 'RBRK',
    description: 'Rubrik Inc Call Option',
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
    theta: 9.641,
    dailyDollarTheta: 9.641,
  },
  // 2. PATH: 100 shares of stock + 1 Covered Call
  {
    id: 'pos-path-stock',
    symbol: 'PATH',
    underlyingSymbol: 'PATH',
    description: 'UiPath Inc Class A',
    quantity: 100,
    averageCost: 12.0,
    currentPrice: 13.1,
    marketValue: 1310,
    dayChange: -21.0,
    dayChangePercent: -1.58,
    unrealizedPL: 110.0,
    unrealizedPLPercent: 9.17,
    source: 'Tastytrade',
    assetType: 'Stock',
  },
  {
    id: 'pos-path-call',
    symbol: 'PATH  261018C00014000',
    underlyingSymbol: 'PATH',
    description: 'UiPath Covered Call',
    quantity: -1,
    averageCost: 0.8,
    currentPrice: 0.41,
    marketValue: -41,
    dayChange: 1.0,
    dayChangePercent: 2.3,
    unrealizedPL: 39.0,
    unrealizedPLPercent: 48.7,
    source: 'Tastytrade',
    assetType: 'Option',
    strike: 14,
    expiry: '20261018',
    dte: 14,
    optionType: 'Call',
    underlyingPrice: 13.1,
    delta: -0.32,
    theta: 1.413,
    dailyDollarTheta: 1.413,
  },
  // 3. GOOGL: 100 shares
  {
    id: 'pos-googl',
    symbol: 'GOOGL',
    underlyingSymbol: 'GOOGL',
    description: 'Alphabet Inc Class A',
    quantity: 100,
    averageCost: 280.0,
    currentPrice: 343.59,
    marketValue: 34359,
    dayChange: 113.0,
    dayChangePercent: 0.33,
    unrealizedPL: 6359.0,
    unrealizedPLPercent: 22.7,
    source: 'IBKR',
    assetType: 'Stock',
  },
];

describe('Tastytrade Positions Engine & Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('extractUnderlyingSymbol properly resolves root symbols for options and stock', () => {
    expect(extractUnderlyingSymbol(mockPositions[0])).toBe('RBRK');
    expect(extractUnderlyingSymbol(mockPositions[1])).toBe('PATH');
    expect(extractUnderlyingSymbol({
      ...mockPositions[0],
      underlyingSymbol: undefined,
      symbol: 'AAPL  261018C00200000',
    })).toBe('AAPL');
  });

  it('isOptionITM accurately flags Call and Put moneyness', () => {
    // Call: spot > strike = ITM
    expect(isOptionITM('Call', 100, 110)).toBe(true);
    expect(isOptionITM('Call', 100, 90)).toBe(false);

    // Put: spot < strike = ITM
    expect(isOptionITM('Put', 100, 90)).toBe(true);
    expect(isOptionITM('Put', 100, 110)).toBe(false);
  });

  it('groupPositionsForTastytrade merges shares and option legs under underlying ticker', () => {
    const groups = groupPositionsForTastytrade(mockPositions);
    expect(groups).toHaveLength(3); // RBRK, PATH, GOOGL

    const pathGroup = groups.find(g => g.symbol === 'PATH');
    expect(pathGroup).toBeDefined();
    // PATH should have 2 legs: stock + option
    expect(pathGroup?.legs).toHaveLength(2);
    expect(pathGroup?.hasShares).toBe(true);
    expect(pathGroup?.hasOptions).toBe(true);
    expect(pathGroup?.totalShares).toBe(100);
    expect(pathGroup?.totalOptionsCount).toBe(1);

    // Day P/L and Open P/L should be aggregate sums of both legs
    expect(pathGroup?.plDay).toBe(-20); // -21 + 1
    expect(pathGroup?.plOpen).toBe(149); // 110 + 39
  });

  it('renders TastytradePositionsTable with Tastytrade columns, dual-pill quotes, and Greeks', () => {
    renderWithClient(<TastytradePositionsTable positions={mockPositions} />);

    // Header title
    expect(screen.getByText(/TASTYTRADE POSITIONS ENGINE/i)).toBeInTheDocument();

    // Check signature Tastytrade column headers
    expect(screen.getByText('ETF Δ')).toBeInTheDocument();
    expect(screen.getAllByText('θ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('v').length).toBeGreaterThan(0);
    expect(screen.getByText('P/L Day')).toBeInTheDocument();
    expect(screen.getByText('P/L Open')).toBeInTheDocument();
    expect(screen.getByText('PoP')).toBeInTheDocument();
    expect(screen.getByText('Ext')).toBeInTheDocument();
    expect(screen.getByText('Cst')).toBeInTheDocument();
    expect(screen.getByText('NetLiq')).toBeInTheDocument();
    expect(screen.getByText('CapReq')).toBeInTheDocument();

    // Check underlying ticker rows
    expect(screen.getByText('RBRK')).toBeInTheDocument();
    expect(screen.getByText('PATH')).toBeInTheDocument();
    expect(screen.getByText('GOOGL')).toBeInTheDocument();

    // Check dual-pill quote widget renders spot price (e.g. 118.54 or 343.59)
    expect(screen.getByText('118.54')).toBeInTheDocument();
    expect(screen.getByText('343.59')).toBeInTheDocument();

    // Check Greeks symbols displayed
    expect(screen.getAllByText(/θ/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Δ/).length).toBeGreaterThan(0);
  });

  it('expands and collapses individual legs on row click', () => {
    renderWithClient(<TastytradePositionsTable positions={mockPositions} />);

    // Legs for PATH should not be rendered yet before expansion
    expect(screen.queryByText(/SHORT OPT/i)).not.toBeInTheDocument();

    // Click on PATH expand button
    const pathExpandBtn = screen.getByRole('button', { name: /toggle path legs/i });
    fireEvent.click(pathExpandBtn);

    // Now PATH's sub-legs should be visible
    expect(screen.getByText(/SHORT OPT/i)).toBeInTheDocument();
    expect(screen.getByText(/\+100 Shares/i)).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(pathExpandBtn);
    expect(screen.queryByText(/SHORT OPT/i)).not.toBeInTheDocument();
  });

  it('allows master Expand All and Collapse All', () => {
    renderWithClient(<TastytradePositionsTable positions={mockPositions} />);

    const expandAllBtn = screen.getByRole('button', { name: /expand all legs/i });
    fireEvent.click(expandAllBtn);

    // All legs across all groups should now be expanded
    expect(screen.getAllByText(/\+100 Shares/i).length).toBe(2);
    expect(screen.getAllByText(/SHORT OPT/i).length).toBe(2);

    // Button text changes to "Collapse All Legs"
    const collapseAllBtn = screen.getByRole('button', { name: /collapse all legs/i });
    expect(collapseAllBtn).toBeInTheDocument();
    fireEvent.click(collapseAllBtn);

    // Collapsed again
    expect(screen.queryByText(/SHORT OPT/i)).not.toBeInTheDocument();
  });

  it('HoldingsTable integrates the mode switch button and allows toggling to Tastytrade view', () => {
    renderWithClient(<HoldingsTable positions={mockPositions} isLoading={false} />);

    // Find the dedicated "⚡ Tastytrade View" button
    const tastyBtn = screen.getByRole('button', { name: /⚡ tastytrade view/i });
    expect(tastyBtn).toBeInTheDocument();

    // Click to switch to Tastytrade view
    fireEvent.click(tastyBtn);

    // Tastytrade table should now be rendered
    expect(screen.getByText(/TASTYTRADE POSITIONS ENGINE/i)).toBeInTheDocument();
    expect(screen.getByText('ETF Δ')).toBeInTheDocument();

    // The primary mode switcher now offers "Classic View"
    const classicBtn = screen.getByRole('button', { name: /classic view/i });
    expect(classicBtn).toBeInTheDocument();

    // Click to switch back to Classic View
    fireEvent.click(classicBtn);

    // Classic view should be active (Options & Derivatives section)
    expect(screen.getByText(/Options & Derivatives/i)).toBeInTheDocument();
  });

  it('persists layout preference to localStorage when switching views', () => {
    renderWithClient(<HoldingsTable positions={mockPositions} isLoading={false} />);

    const tastyBtn = screen.getByRole('button', { name: /⚡ tastytrade view/i });
    fireEvent.click(tastyBtn);

    expect(localStorage.getItem('finance_holdings_layout')).toBe('TASTY');

    const classicBtn = screen.getByRole('button', { name: /classic view/i });
    fireEvent.click(classicBtn);

    expect(localStorage.getItem('finance_holdings_layout')).toBe('CATEGORIZED');
  });
});
