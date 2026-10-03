import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('AlertsPage Ticker Click to Graph Section in New Window', () => {
  let queryClient: QueryClient;
  const originalWindowOpen = window.open;
  let mockWindowOpen: any;

  const sampleAlerts: alertService.PriceAlert[] = [
    {
      id: 'alert-1',
      symbol: 'AAPL',
      targetPrice: 240.0,
      currentPrice: 230.0,
      condition: 'ABOVE',
      status: 'ACTIVE',
      notes: 'Breakout target',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggeredAt: null,
      triggeredPrice: null,
    },
    {
      id: 'alert-2',
      symbol: 'NVDA',
      targetPrice: 130.0,
      currentPrice: 125.0,
      condition: 'ABOVE',
      status: 'ACTIVE',
      notes: 'AI momentum',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggeredAt: null,
      triggeredPrice: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowOpen = vi.fn();
    window.open = mockWindowOpen;

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
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

  afterEach(() => {
    window.open = originalWindowOpen;
  });

  it('opens new window to graph section with ticker when clicking ticker button', () => {
    const onNavigateToGraphs = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <AlertsPage onNavigateToGraphs={onNavigateToGraphs} />
      </QueryClientProvider>
    );

    // Find ticker button for AAPL
    const tickerBtn = screen.getByTestId('alert-ticker-aapl');
    expect(tickerBtn).toBeInTheDocument();
    expect(tickerBtn).toHaveTextContent('AAPL');

    fireEvent.click(tickerBtn);

    // Verify window.open was called with target url and _blank
    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(mockWindowOpen).toHaveBeenCalledWith(
      '/?tab=graphs&symbol=AAPL',
      '_blank',
      'noopener,noreferrer'
    );
    expect(onNavigateToGraphs).toHaveBeenCalledWith('AAPL');
  });

  it('opens new window to graph section when clicking the ticker avatar card', () => {
    const onNavigateToGraphs = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <AlertsPage onNavigateToGraphs={onNavigateToGraphs} />
      </QueryClientProvider>
    );

    // Find avatar button for NVDA
    const avatarBtn = screen.getByRole('button', { name: /Open NVDA chart/i });
    expect(avatarBtn).toBeInTheDocument();

    fireEvent.click(avatarBtn);

    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(mockWindowOpen).toHaveBeenCalledWith(
      '/?tab=graphs&symbol=NVDA',
      '_blank',
      'noopener,noreferrer'
    );
    expect(onNavigateToGraphs).toHaveBeenCalledWith('NVDA');
  });

  it('still supports navigating to research from the dedicated research button', () => {
    const onNavigateToResearch = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <AlertsPage onNavigateToResearch={onNavigateToResearch} />
      </QueryClientProvider>
    );

    const aaplResearchButton = screen.getByRole('button', { name: /Analyze AAPL in Research/i });
    expect(aaplResearchButton).toBeInTheDocument();

    fireEvent.click(aaplResearchButton);
    expect(onNavigateToResearch).toHaveBeenCalledWith('AAPL');
  });
});
