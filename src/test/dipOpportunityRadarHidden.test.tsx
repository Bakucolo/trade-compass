import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DipOpportunityRadarCard } from '../components/dashboard/DipOpportunityRadarCard';

// Mock dipRadarService
vi.mock('@/services/dipRadarService', () => ({
  useDipRadar: vi.fn(() => ({
    data: {
      timestamp: new Date().toISOString(),
      dips: [
        {
          symbol: 'NVDA',
          name: 'NVIDIA Corporation',
          currentPrice: 120.5,
          dayChangePercent: -3.5,
          distanceFrom52WHigh: -18.2,
          source: 'HOLDING',
          sector: 'Technology',
          heuristicSignal: {
            isDip: true,
            severity: 'MODERATE',
            potentialDriver: 'LIKELY_VOLATILITY',
            preliminaryOpportunityScore: 82,
          },
          holdingPosition: {
            quantity: 20,
            averageCost: 110.0,
            marketValue: 2410.0,
            unrealizedPnL: 210.0,
            unrealizedPnLPercent: 9.5,
          },
        },
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          currentPrice: 220.0,
          dayChangePercent: -2.1,
          distanceFrom52WHigh: -8.5,
          source: 'WATCHLIST',
          sector: 'Technology',
          heuristicSignal: {
            isDip: true,
            severity: 'MILD',
            potentialDriver: 'MARKET_WIDE_CORRECTION',
            preliminaryOpportunityScore: 74,
          },
        },
      ],
    },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  })),
  useSavedDipReports: vi.fn(() => ({
    data: [],
    isLoading: false,
    refetch: vi.fn(),
  })),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('DipOpportunityRadarCard - Hide Stocks Feature', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders dip candidates with "Don\'t Show" button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DipOpportunityRadarCard />
      </QueryClientProvider>
    );

    expect(screen.getAllByText('NVDA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);

    const hideButtons = screen.getAllByRole('button', { name: /mark nvda to not be shown anymore/i });
    expect(hideButtons.length).toBeGreaterThan(0);
  });

  it('hides a stock when "Don\'t Show" is clicked, stores in localStorage, and shows Hidden tab', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DipOpportunityRadarCard />
      </QueryClientProvider>
    );

    expect(screen.getAllByText('NVDA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);

    // Click "Don't Show" on NVDA
    const nvdaHideBtn = screen.getAllByRole('button', { name: /mark nvda to not be shown anymore/i })[0];
    fireEvent.click(nvdaHideBtn);

    // NVDA should be hidden from active list
    expect(screen.queryAllByText('NVDA').length).toBe(0);
    // AAPL should remain visible
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);

    // LocalStorage should now record NVDA
    const stored = JSON.parse(localStorage.getItem('dipRadar_hidden_symbols') || '[]');
    expect(stored).toContain('NVDA');

    // "Hidden (1)" tab should now exist
    const hiddenTab = screen.getByRole('button', { name: /hidden \(1\)/i });
    expect(hiddenTab).toBeDefined();

    // Click "Hidden (1)" tab
    fireEvent.click(hiddenTab);

    // NVDA should now appear in the Hidden tab with "Show Again" button
    expect(screen.getAllByText('NVDA').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('AAPL').length).toBe(0);

    const showAgainBtn = screen.getAllByRole('button', { name: /show again/i })[0];
    expect(showAgainBtn).toBeDefined();

    // Click "Show Again"
    fireEvent.click(showAgainBtn);

    // LocalStorage should now be empty of NVDA
    const storedAfter = JSON.parse(localStorage.getItem('dipRadar_hidden_symbols') || '[]');
    expect(storedAfter).not.toContain('NVDA');
  });
});
