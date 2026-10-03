import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertsPage } from '../components/AlertsPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as alertService from '../services/alertService';

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

const originalConfirm = window.confirm;

describe('AlertsPage - Muted Box Delete All Button', () => {
  let queryClient: QueryClient;
  const mockDeleteMutedMutateAsync = vi.fn().mockResolvedValue({ success: true, count: 2, message: 'Deleted 2 muted alerts' });

  const sampleAlertsWithMuted: alertService.PriceAlert[] = [
    {
      id: 'alert-1',
      symbol: 'AAPL',
      targetPrice: 240.0,
      currentPrice: 230.0,
      condition: 'ABOVE',
      status: 'ACTIVE',
      notes: 'Active target',
      isMuted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggeredAt: null,
      triggeredPrice: null,
    },
    {
      id: 'alert-2',
      symbol: 'TSLA',
      targetPrice: 200.0,
      currentPrice: 210.0,
      condition: 'BELOW',
      status: 'TRIGGERED',
      notes: 'Muted breakout',
      isMuted: true, // Muted!
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggeredAt: new Date().toISOString(),
      triggeredPrice: 198.0,
    },
    {
      id: 'alert-3',
      symbol: 'AMD',
      targetPrice: 150.0,
      currentPrice: 160.0,
      condition: 'BELOW',
      status: 'CANCELLED', // Cancelled counts as muted/acknowledged
      notes: 'Cancelled defense',
      isMuted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggeredAt: null,
      triggeredPrice: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    (alertService.useAlerts as any).mockReturnValue({
      data: sampleAlertsWithMuted,
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
    });

    (alertService.useDeleteAlert as any).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ success: true }),
      isPending: false,
    });

    (alertService.useDeleteMutedAlerts as any).mockReturnValue({
      mutateAsync: mockDeleteMutedMutateAsync,
      isPending: false,
    });

    (alertService.useBulkMuteAlerts as any).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ success: true, count: 0 }),
      isPending: false,
    });

    (alertService.useBulkDeleteAlerts as any).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ success: true, count: 0 }),
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

    window.confirm = vi.fn().mockReturnValue(true);
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <AlertsPage />
      </QueryClientProvider>
    );

  it('renders Delete All button inside the Muted overview box when muted alerts exist', () => {
    renderComponent();

    const mutedBox = screen.getByTestId('overview-card-muted');
    expect(mutedBox).toBeInTheDocument();

    const deleteBtn = screen.getByTestId('delete-all-muted-card-btn');
    expect(deleteBtn).toBeInTheDocument();
    expect(deleteBtn).toHaveTextContent(/Delete All/i);
    expect(deleteBtn).toHaveAttribute('title', expect.stringContaining('2'));
  });

  it('clicking Delete All in the Muted box calls deleteMutedMutation with confirmation without toggling the filter', async () => {
    renderComponent();

    const mutedBox = screen.getByTestId('overview-card-muted');
    expect(mutedBox.getAttribute('aria-pressed')).toBe('false');

    const deleteBtn = screen.getByTestId('delete-all-muted-card-btn');
    fireEvent.click(deleteBtn);

    // Confirmation was requested
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('2 muted alert'));

    // Mutation was called
    expect(mockDeleteMutedMutateAsync).toHaveBeenCalledTimes(1);

    // Box was NOT clicked/toggled because propagation was stopped
    expect(mutedBox.getAttribute('aria-pressed')).toBe('false');
  });

  it('cancels deletion if user rejects confirmation dialog', async () => {
    (window.confirm as any).mockReturnValue(false);
    renderComponent();

    const deleteBtn = screen.getByTestId('delete-all-muted-card-btn');
    fireEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockDeleteMutedMutateAsync).not.toHaveBeenCalled();
  });

  it('hides Delete All button when there are 0 muted alerts', () => {
    const unmutedAlerts = sampleAlertsWithMuted.map((a) => ({
      ...a,
      isMuted: false,
      status: 'ACTIVE',
    }));

    (alertService.useAlerts as any).mockReturnValue({
      data: unmutedAlerts,
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
    });

    renderComponent();

    const deleteBtn = screen.queryByTestId('delete-all-muted-card-btn');
    expect(deleteBtn).toBeNull();
  });

  it('renders Delete All Muted button in the toolbar when filtered to MUTED', async () => {
    renderComponent();

    const mutedBox = screen.getByTestId('overview-card-muted');
    fireEvent.click(mutedBox);

    expect(mutedBox.getAttribute('aria-pressed')).toBe('true');

    const toolbarDeleteBtn = screen.getByTestId('delete-all-muted-toolbar-btn');
    expect(toolbarDeleteBtn).toBeInTheDocument();
    expect(toolbarDeleteBtn).toHaveTextContent(/Delete All Muted \(2\)/i);

    fireEvent.click(toolbarDeleteBtn);
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('2 muted alert'));
    expect(mockDeleteMutedMutateAsync).toHaveBeenCalledTimes(1);
  });
});
