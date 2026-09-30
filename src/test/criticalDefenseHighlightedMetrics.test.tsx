import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CriticalDefenseModal, formatExpiryDate } from '../components/portfolio/CriticalDefenseModal';
import { UnifiedPosition } from '../components/portfolio/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('CriticalDefenseModal - Highlighted Data & Tactical HUD', () => {
  it('correctly formats compact OCC date and ISO date strings with formatExpiryDate', () => {
    expect(formatExpiryDate('20260918')).toContain('2026');
    expect(formatExpiryDate('20260918')).toMatch(/Sep/i);
    expect(formatExpiryDate('2025-01-17')).toContain('2025');
    expect(formatExpiryDate('2025-01-17')).toMatch(/Jan/i);
    expect(formatExpiryDate('')).toBe('');
  });

  const testPositions: UnifiedPosition[] = [
    {
      id: 'itm-put',
      symbol: 'NVDA  260918P00110000',
      underlyingSymbol: 'NVDA',
      quantity: -2,
      averageCost: 3.5,
      currentPrice: 5.0,
      marketValue: -1000,
      dayChange: -20,
      dayChangePercent: -2,
      unrealizedPL: -300,
      unrealizedPLPercent: -42.86,
      source: 'Tastytrade',
      assetType: 'Option',
      strike: 110,
      optionType: 'Put',
      underlyingPrice: 108, // ITM Put: spot 108 < strike 110 by $2.00 (1.8% breach)
      expiry: '20261018',
    },
    {
      id: 'tested-call',
      symbol: 'AAPL  261016C00250000',
      underlyingSymbol: 'AAPL',
      quantity: -1,
      averageCost: 4.0,
      currentPrice: 6.0,
      marketValue: -600,
      dayChange: 0,
      dayChangePercent: 0,
      unrealizedPL: -200,
      unrealizedPLPercent: -50.0,
      source: 'IBKR',
      assetType: 'Option',
      strike: 250,
      optionType: 'Call',
      underlyingPrice: 246, // OTM Call: spot 246 < strike 250 by $4.00 (1.6% buffer, tested)
      expiry: '20261016',
    },
  ];

  it('renders prominent hero cards highlighting Ticker, Moneyness & Distance, and DTE', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CriticalDefenseModal
          isOpen={true}
          onClose={vi.fn()}
          positions={testPositions}
          onOpenAdvisorForPosition={vi.fn()}
        />
      </QueryClientProvider>
    );

    // 1. TICKER HIGHLIGHT
    expect(screen.getByText('$NVDA')).toBeInTheDocument();
    expect(screen.getByText('$AAPL')).toBeInTheDocument();
    expect(screen.getByText(/\$110 PUT/i)).toBeInTheDocument();
    expect(screen.getByText(/\$250 CALL/i)).toBeInTheDocument();

    // 2. MONEYNESS & DISTANCE HIGHLIGHT
    // Check ITM breach for NVDA
    expect(screen.getByText(/🚨 ITM BREACH/i)).toBeInTheDocument();
    expect(screen.getByText(/-1\.8%/i)).toBeInTheDocument();
    expect(screen.getByText(/Breached by \$2\.00 beyond strike/i)).toBeInTheDocument();

    // Check Tested strike for AAPL
    expect(screen.getByText(/⚠️ TESTED/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1\.6%/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\$4\.00 buffer remaining before strike/i)).toBeInTheDocument();

    // 3. EXPIRATION & DTE HIGHLIGHT
    expect(screen.getAllByText(/Moneyness & Distance/i).length).toBe(2);
    expect(screen.getAllByText(/Expiration & DTE/i).length).toBe(2);
    expect(screen.getAllByText(/Days to Expiry/i).length).toBeGreaterThan(0);
  });

  it('filters positions instantly when typing in the quick ticker search input', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CriticalDefenseModal
          isOpen={true}
          onClose={vi.fn()}
          positions={testPositions}
          onOpenAdvisorForPosition={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Both NVDA and AAPL are initially visible
    expect(screen.getByText('$NVDA')).toBeInTheDocument();
    expect(screen.getByText('$AAPL')).toBeInTheDocument();

    // Search for AAPL
    const searchInput = screen.getByPlaceholderText(/filter ticker\.\.\./i);
    fireEvent.change(searchInput, { target: { value: 'AAPL' } });

    // Only AAPL should remain
    expect(screen.getByText('$AAPL')).toBeInTheDocument();
    expect(screen.queryByText('$NVDA')).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('$NVDA')).toBeInTheDocument();
    expect(screen.getByText('$AAPL')).toBeInTheDocument();
  });

  const fourFlavorsPositions: UnifiedPosition[] = [
    {
      id: 'short-put-pos',
      symbol: 'NVDA  260918P00110000',
      underlyingSymbol: 'NVDA',
      quantity: -2, // Short
      averageCost: 3.5,
      currentPrice: 5.0,
      marketValue: -1000,
      unrealizedPL: -300,
      unrealizedPLPercent: -42.86,
      source: 'Tastytrade',
      assetType: 'Option',
      strike: 110,
      optionType: 'Put', // Put
      underlyingPrice: 108,
      expiry: '20261018',
    },
    {
      id: 'short-call-pos',
      symbol: 'AAPL  261016C00250000',
      underlyingSymbol: 'AAPL',
      quantity: -1, // Short
      averageCost: 4.0,
      currentPrice: 6.0,
      marketValue: -600,
      unrealizedPL: -200,
      unrealizedPLPercent: -50.0,
      source: 'IBKR',
      assetType: 'Option',
      strike: 250,
      optionType: 'Call', // Call
      underlyingPrice: 246,
      expiry: '20261016',
    },
    {
      id: 'long-call-pos',
      symbol: 'TSLA  261016C00260000',
      underlyingSymbol: 'TSLA',
      quantity: 2, // Long
      averageCost: 8.0,
      currentPrice: 4.0,
      marketValue: 800,
      unrealizedPL: -800,
      unrealizedPLPercent: -50.0,
      source: 'Tastytrade',
      assetType: 'Option',
      strike: 260,
      optionType: 'Call', // Call
      underlyingPrice: 245,
      expiry: '20261016',
    },
    {
      id: 'long-put-pos',
      symbol: 'MSFT  261016P00420000',
      underlyingSymbol: 'MSFT',
      quantity: 1, // Long
      averageCost: 10.0,
      currentPrice: 5.0,
      marketValue: 500,
      unrealizedPL: -500,
      unrealizedPLPercent: -50.0,
      source: 'IBKR',
      assetType: 'Option',
      strike: 420,
      optionType: 'Put', // Put
      underlyingPrice: 435,
      expiry: '20261016',
    },
  ];

  it('allows filtering between Long and Short positions', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CriticalDefenseModal
          isOpen={true}
          onClose={vi.fn()}
          positions={fourFlavorsPositions}
          onOpenAdvisorForPosition={vi.fn()}
        />
      </QueryClientProvider>
    );

    // All 4 positions are visible initially
    expect(screen.getByText('$NVDA')).toBeInTheDocument();
    expect(screen.getByText('$AAPL')).toBeInTheDocument();
    expect(screen.getByText('$TSLA')).toBeInTheDocument();
    expect(screen.getByText('$MSFT')).toBeInTheDocument();

    // Click Long filter
    const longBtn = screen.getByTestId('filter-long');
    expect(longBtn).toHaveTextContent(/Long \(2\)/i);
    fireEvent.click(longBtn);

    // Only Long positions (TSLA long call, MSFT long put) should be shown
    expect(screen.getByText('$TSLA')).toBeInTheDocument();
    expect(screen.getByText('$MSFT')).toBeInTheDocument();
    expect(screen.queryByText('$NVDA')).not.toBeInTheDocument();
    expect(screen.queryByText('$AAPL')).not.toBeInTheDocument();

    // Click Short filter
    const shortBtn = screen.getByTestId('filter-short');
    expect(shortBtn).toHaveTextContent(/Short \(2\)/i);
    fireEvent.click(shortBtn);

    // Only Short positions (NVDA short put, AAPL short call) should be shown
    expect(screen.getByText('$NVDA')).toBeInTheDocument();
    expect(screen.getByText('$AAPL')).toBeInTheDocument();
    expect(screen.queryByText('$TSLA')).not.toBeInTheDocument();
    expect(screen.queryByText('$MSFT')).not.toBeInTheDocument();

    // Click All Sides to reset direction filter
    fireEvent.click(screen.getByTestId('filter-side-all'));
    expect(screen.getByText('$NVDA')).toBeInTheDocument();
    expect(screen.getByText('$AAPL')).toBeInTheDocument();
    expect(screen.getByText('$TSLA')).toBeInTheDocument();
    expect(screen.getByText('$MSFT')).toBeInTheDocument();
  });

  it('allows filtering between Puts and Calls positions', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CriticalDefenseModal
          isOpen={true}
          onClose={vi.fn()}
          positions={fourFlavorsPositions}
          onOpenAdvisorForPosition={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Click Puts filter
    const putsBtn = screen.getByTestId('filter-puts');
    expect(putsBtn).toHaveTextContent(/Puts \(2\)/i);
    fireEvent.click(putsBtn);

    // Only Put positions (NVDA put, MSFT put) should be shown
    expect(screen.getByText('$NVDA')).toBeInTheDocument();
    expect(screen.getByText('$MSFT')).toBeInTheDocument();
    expect(screen.queryByText('$AAPL')).not.toBeInTheDocument();
    expect(screen.queryByText('$TSLA')).not.toBeInTheDocument();

    // Click Calls filter
    const callsBtn = screen.getByTestId('filter-calls');
    expect(callsBtn).toHaveTextContent(/Calls \(2\)/i);
    fireEvent.click(callsBtn);

    // Only Call positions (AAPL call, TSLA call) should be shown
    expect(screen.getByText('$AAPL')).toBeInTheDocument();
    expect(screen.getByText('$TSLA')).toBeInTheDocument();
    expect(screen.queryByText('$NVDA')).not.toBeInTheDocument();
    expect(screen.queryByText('$MSFT')).not.toBeInTheDocument();

    // Click All Types to reset contract filter
    fireEvent.click(screen.getByTestId('filter-type-all'));
    expect(screen.getByText('$NVDA')).toBeInTheDocument();
    expect(screen.getByText('$AAPL')).toBeInTheDocument();
    expect(screen.getByText('$TSLA')).toBeInTheDocument();
    expect(screen.getByText('$MSFT')).toBeInTheDocument();
  });

  it('allows combining Direction (Short/Long) and Contract (Puts/Calls) filters and clearing them', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CriticalDefenseModal
          isOpen={true}
          onClose={vi.fn()}
          positions={fourFlavorsPositions}
          onOpenAdvisorForPosition={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Select Short AND Puts -> Short Puts (only NVDA)
    fireEvent.click(screen.getByTestId('filter-short'));
    fireEvent.click(screen.getByTestId('filter-puts'));

    expect(screen.getByText('$NVDA')).toBeInTheDocument();
    expect(screen.queryByText('$AAPL')).not.toBeInTheDocument();
    expect(screen.queryByText('$TSLA')).not.toBeInTheDocument();
    expect(screen.queryByText('$MSFT')).not.toBeInTheDocument();

    // Active indicator Clear button should be visible with description
    const clearBtn = screen.getByTestId('filter-clear-side-type');
    expect(clearBtn).toBeInTheDocument();
    expect(clearBtn).toHaveTextContent(/Short Puts/i);

    // Switch to Calls while maintaining Short -> Short Calls (only AAPL)
    fireEvent.click(screen.getByTestId('filter-calls'));
    expect(screen.getByText('$AAPL')).toBeInTheDocument();
    expect(screen.queryByText('$NVDA')).not.toBeInTheDocument();
    expect(screen.queryByText('$TSLA')).not.toBeInTheDocument();
    expect(screen.queryByText('$MSFT')).not.toBeInTheDocument();

    // Click Clear button to restore all
    fireEvent.click(screen.getByTestId('filter-clear-side-type'));
    expect(screen.getByText('$NVDA')).toBeInTheDocument();
    expect(screen.getByText('$AAPL')).toBeInTheDocument();
    expect(screen.getByText('$TSLA')).toBeInTheDocument();
    expect(screen.getByText('$MSFT')).toBeInTheDocument();
    expect(screen.queryByTestId('filter-clear-side-type')).not.toBeInTheDocument();
  });
});
