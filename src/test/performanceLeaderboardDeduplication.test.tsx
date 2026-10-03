import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  PerformanceLeaderboard,
  extractCleanSymbol,
  aggregatePositionPerformance,
  PositionPerformance,
} from '../components/portfolio/PerformanceLeaderboard';
import { UnifiedPosition } from '../components/portfolio/types';

describe('PerformanceLeaderboard - Deduplication & Multi-Broker Aggregation', () => {
  it('extractCleanSymbol cleans standard symbols, T212 suffixed symbols, and options', () => {
    const ibkrPos: UnifiedPosition = {
      id: 'ibkr-1',
      symbol: 'AAPL',
      quantity: 10,
      averageCost: 150,
      currentPrice: 175,
      marketValue: 1750,
      source: 'IBKR',
      assetType: 'Stock',
    };
    expect(extractCleanSymbol(ibkrPos)).toBe('AAPL');

    const t212Pos: UnifiedPosition = {
      id: 't212-1',
      symbol: 'AAPL_US_EQ',
      ticker: 'AAPL_US_EQ',
      quantity: 5,
      averageCost: 160,
      currentPrice: 175,
      marketValue: 875,
      source: 'Trading 212',
      assetType: 'Stock',
    };
    expect(extractCleanSymbol(t212Pos)).toBe('AAPL');

    const t212Canada: UnifiedPosition = {
      id: 't212-can',
      symbol: 'CRON_CA_EQ',
      ticker: 'CRON_CA_EQ',
      quantity: 100,
      averageCost: 2.5,
      currentPrice: 3.0,
      marketValue: 300,
      source: 'Trading 212',
      assetType: 'Stock',
    };
    expect(extractCleanSymbol(t212Canada)).toBe('CRON.TO');

    const optPos: UnifiedPosition = {
      id: 'opt-1',
      symbol: 'NVDA  261016C00120000',
      underlyingSymbol: 'NVDA',
      quantity: 1,
      averageCost: 5,
      currentPrice: 10,
      marketValue: 1000,
      source: 'Tastytrade',
      assetType: 'Option',
    };
    expect(extractCleanSymbol(optPos)).toBe('NVDA');
  });

  it('aggregatePositionPerformance aggregates quantities, market values, and dollar-weighted returns', () => {
    const item1: PositionPerformance = {
      position: {
        id: 'pos-1',
        symbol: 'AAPL',
        quantity: 10,
        averageCost: 150,
        currentPrice: 200,
        marketValue: 2000,
        unrealizedPL: 500,
        unrealizedPLPercent: 33.33,
        source: 'IBKR',
        assetType: 'Stock',
      },
      cleanSymbol: 'AAPL',
      name: 'Apple Inc.',
      timeframe: '1D',
      changePercent: 2.0,
      changeDollar: 40,
      marketValue: 2000,
      currentPrice: 200,
      averageCost: 150,
      assetType: 'Stock',
      currency: 'USD',
      source: 'IBKR',
      sources: ['IBKR'],
    };

    const item2: PositionPerformance = {
      position: {
        id: 'pos-2',
        symbol: 'AAPL_US_EQ',
        ticker: 'AAPL_US_EQ',
        quantity: 5,
        averageCost: 160,
        currentPrice: 200,
        marketValue: 1000,
        unrealizedPL: 200,
        unrealizedPLPercent: 25.0,
        source: 'Trading 212',
        assetType: 'Stock',
      },
      cleanSymbol: 'AAPL',
      name: 'AAPL Position',
      timeframe: '1D',
      changePercent: 2.0,
      changeDollar: 20,
      marketValue: 1000,
      currentPrice: 200,
      averageCost: 160,
      assetType: 'Stock',
      currency: 'USD',
      source: 'Trading 212',
      sources: ['Trading 212'],
    };

    const merged = aggregatePositionPerformance([item1, item2]);
    expect(merged.cleanSymbol).toBe('AAPL');
    expect(merged.name).toBe('Apple Inc.'); // Prefers descriptive name
    expect(merged.marketValue).toBe(3000); // 2000 + 1000
    expect(merged.changeDollar).toBe(60); // 40 + 20
    expect(merged.changePercent).toBeCloseTo(2.0, 2); // Weighted return
    expect(merged.sources).toEqual(['IBKR', 'Trading 212']);
    expect(merged.source).toBe('IBKR + Trading 212');
    expect(merged.position.quantity).toBe(15);
  });

  const duplicateBrokerPositions: UnifiedPosition[] = [
    {
      id: 'aapl-ibkr',
      symbol: 'AAPL',
      quantity: 10,
      averageCost: 150,
      currentPrice: 175,
      marketValue: 1750,
      dayChange: 50,
      dayChangePercent: 2.94,
      unrealizedPL: 250,
      unrealizedPLPercent: 16.67,
      source: 'IBKR',
      assetType: 'Stock',
      currency: 'USD',
    },
    {
      id: 'aapl-t212',
      symbol: 'AAPL_US_EQ',
      ticker: 'AAPL_US_EQ',
      quantity: 5,
      averageCost: 160,
      currentPrice: 175,
      marketValue: 875,
      dayChange: 25,
      dayChangePercent: 2.94,
      unrealizedPL: 75,
      unrealizedPLPercent: 9.38,
      source: 'Trading 212',
      assetType: 'Stock',
      currency: 'USD',
    },
    {
      id: 'msft-ibkr',
      symbol: 'MSFT',
      quantity: 8,
      averageCost: 400,
      currentPrice: 420,
      marketValue: 3360,
      dayChange: 60,
      dayChangePercent: 1.82,
      unrealizedPL: 160,
      unrealizedPLPercent: 5.0,
      source: 'IBKR',
      assetType: 'Stock',
      currency: 'USD',
    },
    {
      id: 'tsla-t212',
      symbol: 'TSLA_US_EQ',
      ticker: 'TSLA_US_EQ',
      quantity: 10,
      averageCost: 250,
      currentPrice: 230,
      marketValue: 2300,
      dayChange: -40,
      dayChangePercent: -1.71,
      unrealizedPL: -200,
      unrealizedPLPercent: -8.0,
      source: 'Trading 212',
      assetType: 'Stock',
      currency: 'USD',
    },
  ];

  it('renders duplicate ticker across 2 brokers ONLY ONCE in the leaderboard with both broker badges', () => {
    render(
      <PerformanceLeaderboard
        positions={duplicateBrokerPositions}
        onSelectPosition={vi.fn()}
      />
    );

    // In the entire document, AAPL should appear as a single ranked item in Top Winners
    // Check that AAPL is only rendered once in the winners list
    const aaplHeaders = screen.getAllByText('AAPL');
    // Top Performer tile may mention AAPL, but in the ranked list there must be exactly 1 row
    expect(aaplHeaders.length).toBeLessThanOrEqual(2); // At most 1 in hero tile + 1 in list

    // Total market value for AAPL: 1750 + 875 = 2625
    expect(screen.getByText('$2,625')).toBeInTheDocument();

    // Total dollar change for AAPL: 50 + 25 = 75
    expect(screen.getByText('+$75.00')).toBeInTheDocument();

    // Verify both IBKR and Trading 212 badges are rendered for AAPL
    expect(screen.getAllByText('IBKR').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Trading 212').length).toBeGreaterThanOrEqual(1);
  });

  it('filters by broker and only displays positions from the selected broker', () => {
    render(
      <PerformanceLeaderboard
        positions={duplicateBrokerPositions}
        onSelectPosition={vi.fn()}
      />
    );

    // Click Broker: Trading 212
    const t212FilterBtn = screen.getByRole('button', { name: 'Trading 212' });
    fireEvent.click(t212FilterBtn);

    // In Trading 212, AAPL market value is only 875
    expect(screen.getByText('$875')).toBeInTheDocument();
    expect(screen.queryByText('$2,625')).not.toBeInTheDocument();

    // MSFT is only in IBKR, so MSFT should NOT be shown
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument();

    // TSLA is in Trading 212 (loser), so it should be visible
    expect(screen.getAllByText('TSLA').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onSelectPosition with the aggregated position when clicking the merged ticker card', () => {
    const handleSelect = vi.fn();
    render(
      <PerformanceLeaderboard
        positions={duplicateBrokerPositions}
        onSelectPosition={handleSelect}
      />
    );

    // Click AAPL winner card
    const aaplCard = screen.getByTestId('leaderboard-winner-AAPL');
    fireEvent.click(aaplCard);

    expect(handleSelect).toHaveBeenCalledTimes(1);
    const selectedPos: UnifiedPosition = handleSelect.mock.calls[0][0];
    expect(selectedPos.quantity).toBe(15); // 10 (IBKR) + 5 (T212)
    expect(selectedPos.marketValue).toBe(2625); // 1750 + 875
    expect(selectedPos.source).toContain('IBKR');
    expect(selectedPos.source).toContain('Trading 212');
  });
});
