import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '../components/Dashboard';

vi.mock('@/services/ibkr', () => ({
  useIBKRPortfolio: vi.fn(),
  useIBKRStatus: vi.fn(),
}));

vi.mock('@/services/tastytrade', () => ({
  useTastytradePositions: vi.fn(),
  useTastytradeStatus: vi.fn(),
}));

vi.mock('@/services/trading212', () => ({
  useTrading212Positions: vi.fn(),
  useTrading212Status: vi.fn(),
}));

vi.mock('@/services/portfolioBalanceService', () => ({
  usePortfolioBalances: vi.fn(),
}));

vi.mock('@/services/ideaService', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useTradeIdeas: vi.fn(() => ({ data: [] })),
  };
});

vi.mock('@/services/agentActivityService', () => ({
  useAgentActivities: vi.fn(() => ({ data: { activities: [] } })),
}));

vi.mock('@/services/usePortfolioQuotes', () => ({
  usePortfolioQuotes: vi.fn(() => ({ data: {}, isLoading: false })),
}));

vi.mock('@/services/telegramReportClientService', () => ({
  useSendTelegramReport: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('../components/ThemeSwitcherButton', () => ({
  ThemeSwitcherButton: () => null,
}));

vi.mock('../components/PortfolioChart', () => ({
  PortfolioChart: () => <div data-testid="portfolio-chart" />,
}));

import { useIBKRStatus, useIBKRPortfolio } from '@/services/ibkr';
import { useTastytradeStatus, useTastytradePositions } from '@/services/tastytrade';
import { useTrading212Status, useTrading212Positions } from '@/services/trading212';
import { usePortfolioBalances } from '@/services/portfolioBalanceService';

describe('Dashboard - Broker Connectivity Badges', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.mocked(useIBKRPortfolio).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(useTastytradePositions).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(useTrading212Positions).mockReturnValue({ data: [], isLoading: false } as any);
  });

  it('shows IBKR and Tastytrade as Disconnected (red) when their status is false or offline', () => {
    vi.mocked(useIBKRStatus).mockReturnValue({
      data: { connected: false },
      isLoading: false,
    } as any);

    vi.mocked(useTastytradeStatus).mockReturnValue({
      data: { connected: false },
      isLoading: false,
    } as any);

    vi.mocked(useTrading212Status).mockReturnValue({
      data: { connected: false },
      isLoading: false,
    } as any);

    vi.mocked(usePortfolioBalances).mockReturnValue({
      data: {
        brokers: {
          ibkr: { status: 'disconnected' },
          tastytrade: { status: 'disconnected' },
          trading212: { status: 'disconnected' },
        },
      },
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );

    const ibkrBadge = screen.getByTitle('IBKR: Disconnected');
    const tastyBadge = screen.getByTitle('Tastytrade: Disconnected');
    const t212Badge = screen.getByTitle('Trading 212: Disconnected');

    expect(ibkrBadge).toBeDefined();
    expect(tastyBadge).toBeDefined();
    expect(t212Badge).toBeDefined();

    // Verify dot element inside IBKR badge has bg-rose-400 and NOT animate-pulse
    const ibkrDot = ibkrBadge.querySelector('span');
    expect(ibkrDot?.className).toContain('bg-rose-400');
    expect(ibkrDot?.className).not.toContain('animate-pulse');

    // Verify dot element inside Tastytrade badge has bg-rose-400 and NOT animate-pulse
    const tastyDot = tastyBadge.querySelector('span');
    expect(tastyDot?.className).toContain('bg-rose-400');
    expect(tastyDot?.className).not.toContain('animate-pulse');
  });

  it('shows IBKR and Tastytrade as Connected (green + pulsing) when connected', () => {
    vi.mocked(useIBKRStatus).mockReturnValue({
      data: { connected: true },
      isLoading: false,
    } as any);

    vi.mocked(useTastytradeStatus).mockReturnValue({
      data: { connected: true },
      isLoading: false,
    } as any);

    vi.mocked(useTrading212Status).mockReturnValue({
      data: { connected: true },
      isLoading: false,
    } as any);

    vi.mocked(usePortfolioBalances).mockReturnValue({
      data: {
        brokers: {
          ibkr: { status: 'connected' },
          tastytrade: { status: 'connected' },
          trading212: { status: 'connected' },
        },
      },
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );

    const ibkrBadge = screen.getByTitle('IBKR: Connected');
    const tastyBadge = screen.getByTitle('Tastytrade: Connected');
    const t212Badge = screen.getByTitle('Trading 212: Connected');

    expect(ibkrBadge).toBeDefined();
    expect(tastyBadge).toBeDefined();
    expect(t212Badge).toBeDefined();

    const ibkrDot = ibkrBadge.querySelector('span');
    expect(ibkrDot?.className).toContain('bg-emerald-400');
    expect(ibkrDot?.className).toContain('animate-pulse');

    const tastyDot = tastyBadge.querySelector('span');
    expect(tastyDot?.className).toContain('bg-emerald-400');
    expect(tastyDot?.className).toContain('animate-pulse');
  });
});
