import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertsPage } from '../components/AlertsPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as alertService from '../services/alertService';

// Mock alertService
vi.mock('../services/alertService', async () => {
  const actual = await vi.importActual('../services/alertService');
  return {
    ...actual,
    useAlerts: vi.fn(),
    useDeleteAlert: vi.fn(),
    useDeleteMutedAlerts: vi.fn(),
    useBulkMuteAlerts: vi.fn(),
    useBulkDeleteAlerts: vi.fn(),
    useResetAlert: vi.fn(),
    useMuteAlert: vi.fn(),
    useUnmuteAlert: vi.fn(),
    useSyncShortOptionAlerts: vi.fn(),
  };
});

describe('AlertsPage - Clickable Overview Cards Filtering', () => {
  let queryClient: QueryClient;

  const sampleAlerts: alertService.PriceAlert[] = [
    {
      id: 'alert-1',
      symbol: 'AAPL',
      targetPrice: 240.0,
      currentPrice: 230.0,
      condition: 'ABOVE',
      status: 'ACTIVE',
      notes: 'Bullish breakout',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggeredAt: null,
      triggeredPrice: null,
    },
    {
      id: 'alert-2',
      symbol: 'MSFT',
      targetPrice: 400.0,
      currentPrice: 395.0,
      condition: 'BELOW',
      status: 'TRIGGERED',
      notes: 'Dip buy target',
      isMuted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggeredAt: new Date().toISOString(),
      triggeredPrice: 398.0,
    },
    {
      id: 'alert-3',
      symbol: 'TSLA',
      targetPrice: 200.0,
      currentPrice: 195.0,
      condition: 'ABOVE',
      status: 'TRIGGERED',
      notes: 'Muted old event',
      isMuted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggeredAt: new Date().toISOString(),
      triggeredPrice: 202.0,
    },
    {
      id: 'alert-4',
      symbol: 'NVDA',
      targetPrice: 120.0,
      currentPrice: 125.0,
      condition: 'BELOW',
      status: 'ACTIVE',
      notes: 'Short Option 5% Strike Proximity',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggeredAt: null,
      triggeredPrice: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    (alertService.useAlerts as any).mockReturnValue({
      data: sampleAlerts,
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
    });

    (alertService.useDeleteAlert as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    (alertService.useDeleteMutedAlerts as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    (alertService.useBulkMuteAlerts as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    (alertService.useBulkDeleteAlerts as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    (alertService.useResetAlert as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    (alertService.useMuteAlert as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    (alertService.useUnmuteAlert as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    (alertService.useSyncShortOptionAlerts as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('renders all 5 big overview filter boxes with correct counts', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AlertsPage />
      </QueryClientProvider>
    );

    const cardAll = screen.getByTestId('overview-card-all');
    const cardActive = screen.getByTestId('overview-card-active');
    const cardTriggered = screen.getByTestId('overview-card-triggered');
    const cardMuted = screen.getByTestId('overview-card-muted');
    const cardShortDefense = screen.getByTestId('overview-card-short_defense');

    expect(cardAll).toHaveTextContent('4'); // 4 total alerts
    expect(cardActive).toHaveTextContent('2'); // AAPL, NVDA
    expect(cardTriggered).toHaveTextContent('1'); // MSFT (unmuted)
    expect(cardMuted).toHaveTextContent('1'); // TSLA (muted)
    expect(cardShortDefense).toHaveTextContent('1'); // NVDA (Short Option)

    // Total Alerts starts selected by default
    expect(cardAll.getAttribute('aria-pressed')).toBe('true');
    expect(cardActive.getAttribute('aria-pressed')).toBe('false');
  });

  it('filters to Active targets when clicking the Active Targets box', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AlertsPage />
      </QueryClientProvider>
    );

    const cardActive = screen.getByTestId('overview-card-active');
    fireEvent.click(cardActive);

    // Active card is selected
    expect(cardActive.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('overview-card-all').getAttribute('aria-pressed')).toBe('false');

    // Only active items AAPL and NVDA should be visible in rows
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument();
    expect(screen.queryByText('TSLA')).not.toBeInTheDocument();

    // Clicking it again toggles back to ALL
    fireEvent.click(cardActive);
    expect(screen.getByTestId('overview-card-all').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('filters to Unmuted Fired alerts when clicking the Unmuted Fired box', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AlertsPage />
      </QueryClientProvider>
    );

    const cardTriggered = screen.getByTestId('overview-card-triggered');
    fireEvent.click(cardTriggered);

    expect(cardTriggered.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    expect(screen.queryByText('TSLA')).not.toBeInTheDocument();
  });

  it('filters to Muted alerts when clicking the Muted box', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AlertsPage />
      </QueryClientProvider>
    );

    const cardMuted = screen.getByTestId('overview-card-muted');
    fireEvent.click(cardMuted);

    expect(cardMuted.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('TSLA')).toBeInTheDocument();
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument();
  });

  it('filters to Short Defense alerts when clicking the Short Defense box', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AlertsPage />
      </QueryClientProvider>
    );

    const cardShortDefense = screen.getByTestId('overview-card-short_defense');
    fireEvent.click(cardShortDefense);

    expect(cardShortDefense.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument();
  });

  it('resets filter back to ALL when clicking Total Alerts box', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AlertsPage />
      </QueryClientProvider>
    );

    // Filter to Short Defense
    fireEvent.click(screen.getByTestId('overview-card-short_defense'));
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();

    // Click Total Alerts box
    const cardAll = screen.getByTestId('overview-card-all');
    fireEvent.click(cardAll);

    expect(cardAll.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.getByText('TSLA')).toBeInTheDocument();
  });

  it('supports keyboard Enter and Space navigation on cards', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AlertsPage />
      </QueryClientProvider>
    );

    const cardActive = screen.getByTestId('overview-card-active');
    fireEvent.keyDown(cardActive, { key: 'Enter' });

    expect(cardActive.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument();

    // Press Space on cardActive to toggle back
    fireEvent.keyDown(cardActive, { key: ' ' });
    expect(screen.getByTestId('overview-card-all').getAttribute('aria-pressed')).toBe('true');
  });
});
