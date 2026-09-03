import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CriticalDefenseModal } from '../components/portfolio/CriticalDefenseModal';
import { UnifiedPosition } from '../components/portfolio/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('CriticalDefenseModal - Default Asset Filter', () => {
  const samplePositions: UnifiedPosition[] = [
    {
      id: 'opt-1',
      symbol: 'NVDA  260918C00140000',
      quantity: -2,
      averageCost: 5.5,
      currentPrice: 8.0,
      marketValue: -1600,
      dayChange: 0,
      dayChangePercent: 0,
      unrealizedPL: -500,
      unrealizedPLPercent: -45.45,
      source: 'Tastytrade',
      assetType: 'Option',
      strike: 140,
      optionType: 'Call',
      expiry: '20260918',
      underlyingSymbol: 'NVDA',
      underlyingPrice: 138,
      currency: 'USD',
    },
    {
      id: 'eq-1',
      symbol: 'TSLA',
      quantity: 50,
      averageCost: 250,
      currentPrice: 210,
      marketValue: 10500,
      dayChange: 0,
      dayChangePercent: 0,
      unrealizedPL: -2000,
      unrealizedPLPercent: -16.0,
      source: 'IBKR',
      assetType: 'Equity',
      currency: 'USD',
    },
  ];

  it('defaults to showing Options when opened, filtering out equities', () => {
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <CriticalDefenseModal
          isOpen={true}
          onClose={vi.fn()}
          positions={samplePositions}
          onOpenAdvisorForPosition={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Options button should be selected with active purple styling
    const optionsBtn = screen.getByRole('button', { name: /options \(1\)/i });
    expect(optionsBtn).toBeDefined();
    expect(optionsBtn.className).toContain('text-purple-300');

    // Option position should be visible in the list ($NVDA)
    expect(screen.getByText('$NVDA')).toBeDefined();

    // Equity position ($TSLA) should NOT be visible under Options default filter
    expect(screen.queryByText('$TSLA')).toBeNull();

    // Clicking "All" filter should reveal the equity position
    const allBtn = screen.getByRole('button', { name: /all \(2\)/i });
    fireEvent.click(allBtn);
    expect(screen.getByText('$TSLA')).toBeDefined();

    // If modal is closed and re-opened, it should reset back to Options by default
    rerender(
      <QueryClientProvider client={queryClient}>
        <CriticalDefenseModal
          isOpen={false}
          onClose={vi.fn()}
          positions={samplePositions}
          onOpenAdvisorForPosition={vi.fn()}
        />
      </QueryClientProvider>
    );

    rerender(
      <QueryClientProvider client={queryClient}>
        <CriticalDefenseModal
          isOpen={true}
          onClose={vi.fn()}
          positions={samplePositions}
          onOpenAdvisorForPosition={vi.fn()}
        />
      </QueryClientProvider>
    );

    // When re-opened, Options filter is active again and TSLA equity is hidden
    const reOpenedOptionsBtn = screen.getByRole('button', { name: /options \(1\)/i });
    expect(reOpenedOptionsBtn.className).toContain('text-purple-300');
    expect(screen.queryByText('$TSLA')).toBeNull();
  }, 15000);
});
