import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StockHoverGraphCard } from '../components/dashboard/StockHoverGraphCard';
import { fetchStockMiniChart } from '../services/miniChartService';
import { YesterdayRecapCard } from '../components/dashboard/YesterdayRecapCard';
import { DashboardMoversCard } from '../components/dashboard/DashboardMoversCard';

// Mock recharts to avoid layout engine errors in jsdom
vi.mock('recharts', async () => {
  const actual: any = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div style={{ width: 300, height: 120 }}>{children}</div>,
    AreaChart: ({ children }: any) => <svg data-testid="mock-area-chart">{children}</svg>,
    Area: () => <path />,
    XAxis: () => <g />,
    YAxis: () => <g />,
    Tooltip: () => <div />,
  };
});

describe('StockHoverGraphCard & Dashboard Graphs Navigation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.restoreAllMocks();
  });

  it('renders trigger element and dispatches navigation event on click', () => {
    const handleNavigate = vi.fn();
    const eventListener = vi.fn();
    window.addEventListener('select-graphs-ticker', eventListener);

    render(
      <QueryClientProvider client={queryClient}>
        <StockHoverGraphCard symbol="NVDA" onNavigateToGraphs={handleNavigate}>
          <span data-testid="nvda-ticker">NVDA</span>
        </StockHoverGraphCard>
      </QueryClientProvider>
    );

    const tickerEl = screen.getByTestId('nvda-ticker');
    expect(tickerEl).toBeInTheDocument();
    expect(tickerEl.textContent).toBe('NVDA');

    fireEvent.click(tickerEl);
    expect(handleNavigate).toHaveBeenCalledWith('NVDA');
    expect(eventListener).toHaveBeenCalled();

    window.removeEventListener('select-graphs-ticker', eventListener);
  });

  it('fetches mini-chart data correctly via fetchStockMiniChart', async () => {
    const mockData = {
      symbol: 'AAPL',
      points: [
        { time: '2026-09-20', close: 220 },
        { time: '2026-09-21', close: 225 },
      ],
      price: 225,
      change: 5,
      changePercent: 2.27,
      currency: 'USD',
      range: '1mo',
      high52: 240,
      low52: 165,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as any);

    const result = await fetchStockMiniChart('AAPL', '1mo');
    expect(global.fetch).toHaveBeenCalledWith('/api/market/mini-chart/AAPL?range=1mo');
    expect(result.symbol).toBe('AAPL');
    expect(result.points.length).toBe(2);
    expect(result.price).toBe(225);
  });

  it('YesterdayRecapCard invokes onNavigateToGraphs when clicking top driver', () => {
    const handleNavigateGraphs = vi.fn();
    const mockPositions = [
      {
        symbol: 'TSLA',
        name: 'Tesla, Inc.',
        marketValue: 15000,
        yesterdayPnL: 520,
        yesterdayPnLPercent: 3.5,
        currency: 'USD',
      },
      {
        symbol: 'AMZN',
        name: 'Amazon.com, Inc.',
        marketValue: 12000,
        yesterdayPnL: -310,
        yesterdayPnLPercent: -2.5,
        currency: 'USD',
      },
    ];

    render(
      <QueryClientProvider client={queryClient}>
        <YesterdayRecapCard
          positions={mockPositions}
          yesterdayPnL={210}
          onNavigateToGraphs={handleNavigateGraphs}
        />
      </QueryClientProvider>
    );

    const tslaDrivers = screen.getAllByText('TSLA');
    expect(tslaDrivers.length).toBeGreaterThan(0);

    fireEvent.click(tslaDrivers[0]);
    expect(handleNavigateGraphs).toHaveBeenCalledWith('TSLA');
  });

  it('DashboardMoversCard navigates to graphs when a mover row is clicked', () => {
    const handleNavigateGraphs = vi.fn();
    const mockPositions = [
      {
        symbol: 'MSFT',
        name: 'Microsoft Corp',
        assetType: 'STK',
        marketValue: 10000,
        dayPnL: 250,
        dayPnLPercent: 2.5,
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc',
        assetType: 'STK',
        marketValue: 8000,
        dayPnL: -120,
        dayPnLPercent: -1.5,
      },
    ];

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardMoversCard
          positions={mockPositions}
          onNavigateToGraphs={handleNavigateGraphs}
        />
      </QueryClientProvider>
    );

    const msftElements = screen.getAllByText('MSFT');
    expect(msftElements.length).toBeGreaterThan(0);

    fireEvent.click(msftElements[0]);
    expect(handleNavigateGraphs).toHaveBeenCalledWith('MSFT');
  });

  it('renders hover card trigger without conflicting native title and supports portaled content', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <div style={{ overflow: 'hidden', height: 50 }}>
          <StockHoverGraphCard symbol="GRID">
            <span data-testid="grid-trigger">GRID</span>
          </StockHoverGraphCard>
        </div>
      </QueryClientProvider>
    );

    const trigger = screen.getByTestId('grid-trigger');
    expect(trigger).toBeInTheDocument();
    // Confirms native title tooltip is removed so it doesn't conflict with the hover card
    expect(trigger.parentElement?.getAttribute('title')).toBeNull();
    expect(trigger.parentElement?.getAttribute('aria-label')).toBe('Open GRID chart in Graphs section');
  });
});
