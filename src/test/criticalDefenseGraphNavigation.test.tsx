import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CriticalDefenseModal } from '../components/portfolio/CriticalDefenseModal';
import { UnifiedPosition } from '../components/portfolio/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('CriticalDefenseModal - Graph Navigation', () => {
  const samplePositions: UnifiedPosition[] = [
    {
      id: 'opt-nvda',
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
      id: 'opt-occ-no-underlying',
      symbol: 'PLTR250117C00030000',
      quantity: -5,
      averageCost: 1.2,
      currentPrice: 3.5,
      marketValue: -1750,
      dayChange: 0,
      dayChangePercent: 0,
      unrealizedPL: -1150,
      unrealizedPLPercent: -191.6,
      source: 'IBKR',
      assetType: 'Option',
      strike: 30,
      optionType: 'Call',
      expiry: '20250117',
      currency: 'USD',
    },
    {
      id: 't212-flex',
      symbol: 'FLEX_US_EQ',
      quantity: 100,
      averageCost: 35,
      currentPrice: 24,
      marketValue: 2400,
      dayChange: 0,
      dayChangePercent: 0,
      unrealizedPL: -1100,
      unrealizedPLPercent: -31.4,
      source: 'Trading 212',
      ticker: 'FLEX_US_EQ',
      assetType: 'Equity',
      currency: 'USD',
    }
  ];

  it('navigates to Graphs with NVDA (underlying) when clicking Graph button on NVDA position', () => {
    const handleGraphs = vi.fn();
    const handleClose = vi.fn();
    const eventHandler = vi.fn();

    window.addEventListener('select-graphs-ticker', eventHandler);

    render(
      <QueryClientProvider client={queryClient}>
        <CriticalDefenseModal
          isOpen={true}
          onClose={handleClose}
          positions={samplePositions}
          onOpenAdvisorForPosition={vi.fn()}
          onNavigateToGraphs={handleGraphs}
        />
      </QueryClientProvider>
    );

    // Click Graph button on NVDA
    const graphBtns = screen.getAllByRole('button', { name: /graph/i });
    expect(graphBtns.length).toBeGreaterThan(0);
    fireEvent.click(graphBtns[0]);

    expect(handleGraphs).toHaveBeenCalledWith('NVDA');
    expect(handleClose).toHaveBeenCalled();
    expect(eventHandler).toHaveBeenCalled();
    const customEvt = eventHandler.mock.calls[0][0] as CustomEvent;
    expect(customEvt.detail).toBe('NVDA');

    window.removeEventListener('select-graphs-ticker', eventHandler);
  });

  it('extracts base ticker PLTR for option when underlyingSymbol is missing', () => {
    const handleGraphs = vi.fn();
    const eventHandler = vi.fn();

    window.addEventListener('select-graphs-ticker', eventHandler);

    render(
      <QueryClientProvider client={queryClient}>
        <CriticalDefenseModal
          isOpen={true}
          onClose={vi.fn()}
          positions={samplePositions}
          onOpenAdvisorForPosition={vi.fn()}
          onNavigateToGraphs={handleGraphs}
        />
      </QueryClientProvider>
    );

    // Find the Graph button for the second option (PLTR)
    const graphBtns = screen.getAllByRole('button', { name: /graph/i });
    expect(graphBtns.length).toBeGreaterThan(1);
    fireEvent.click(graphBtns[1]);

    expect(handleGraphs).toHaveBeenCalledWith('PLTR');
    expect(eventHandler).toHaveBeenCalled();
    const customEvt = eventHandler.mock.calls[0][0] as CustomEvent;
    expect(customEvt.detail).toBe('PLTR');

    window.removeEventListener('select-graphs-ticker', eventHandler);
  });

  it('cleans T212 suffix FLEX_US_EQ to FLEX when navigating to Graphs', () => {
    const handleGraphs = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <CriticalDefenseModal
          isOpen={true}
          onClose={vi.fn()}
          positions={samplePositions}
          onOpenAdvisorForPosition={vi.fn()}
          onNavigateToGraphs={handleGraphs}
        />
      </QueryClientProvider>
    );

    // Switch to Equities filter
    const equitiesFilterBtn = screen.getByRole('button', { name: /equities \(1\)/i });
    fireEvent.click(equitiesFilterBtn);

    const graphBtns = screen.getAllByRole('button', { name: /graph/i });
    expect(graphBtns.length).toBe(1);
    fireEvent.click(graphBtns[0]);

    expect(handleGraphs).toHaveBeenCalledWith('FLEX');
  });
});
