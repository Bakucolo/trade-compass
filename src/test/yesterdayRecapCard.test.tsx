import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { YesterdayRecapCard } from '../components/dashboard/YesterdayRecapCard';

describe('YesterdayRecapCard Component', () => {
  const samplePositions = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      marketValue: 10000,
      yesterdayPnL: 250,
      yesterdayPnLPercent: 2.5,
      assetType: 'Stock',
      currency: 'USD',
    },
    {
      symbol: 'TSM',
      name: 'Taiwan Semiconductor',
      marketValue: 15000,
      yesterdayPnL: -300,
      yesterdayPnLPercent: -2.0,
      assetType: 'Stock',
      currency: 'USD',
    },
    {
      symbol: 'ORLA',
      name: 'Orla Mining',
      marketValue: 5000,
      yesterdayPnL: 100,
      yesterdayPnLPercent: 2.0,
      assetType: 'Stock',
      currency: 'USD',
    },
  ];

  it('renders top driver, lagging drag, and correct breadth counts when session performance data is provided', () => {
    render(
      <YesterdayRecapCard
        positions={samplePositions}
        yesterdayPnL={50}
        totalPortfolioValue={30000}
        isLoading={false}
      />
    );

    // Card title
    expect(screen.getByText('Yesterday & Overnight Market Pulse')).toBeDefined();

    // Top Driver badge and symbol
    expect(screen.getByText('Top Driver')).toBeDefined();
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);

    // Lagging Drag badge and symbol
    expect(screen.getByText('Lagging Drag')).toBeDefined();
    expect(screen.getAllByText('TSM').length).toBeGreaterThan(0);

    // Breadth counts: 2 advancing, 1 declining
    expect(screen.getByText('2 Advancing')).toBeDefined();
    expect(screen.getByText('1 Declining')).toBeDefined();
    expect(screen.getByText('(67% Advance Ratio)')).toBeDefined();
  });

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(
      <YesterdayRecapCard
        positions={[]}
        yesterdayPnL={0}
        totalPortfolioValue={0}
        isLoading={true}
      />
    );

    expect(container.querySelector('.animate-spin')).toBeDefined();
  });
});
