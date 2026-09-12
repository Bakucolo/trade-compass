import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

// Mock window.confirm
const originalConfirm = window.confirm;

describe('AlertsPage - Multi-Select Checkboxes & Bulk Delete', () => {
  let queryClient: QueryClient;
  const mockBulkDeleteMutateAsync = vi.fn().mockResolvedValue({ success: true, count: 2, message: 'Deleted 2 alerts' });
  const mockBulkMuteMutateAsync = vi.fn().mockResolvedValue({ success: true, count: 2, message: 'Muted 2 alerts' });
  const mockDeleteMutateAsync = vi.fn().mockResolvedValue({ success: true });

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
      currentPrice: 420.0,
      condition: 'BELOW',
      status: 'TRIGGERED',
      notes: 'Dip buy target',
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
      status: 'ACTIVE',
      notes: 'Rebound target',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggeredAt: null,
      triggeredPrice: null,
    }
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
      mutateAsync: mockDeleteMutateAsync,
      isPending: false,
    });

    (alertService.useDeleteMutedAlerts as any).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ success: true, count: 0 }),
      isPending: false,
    });

    (alertService.useBulkMuteAlerts as any).mockReturnValue({
      mutateAsync: mockBulkMuteMutateAsync,
      isPending: false,
    });

    (alertService.useBulkDeleteAlerts as any).mockReturnValue({
      mutateAsync: mockBulkDeleteMutateAsync,
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

  it('renders individual checkboxes for each alert and a Select All checkbox', () => {
    renderComponent();

    // Check individual alert checkboxes exist
    expect(screen.getByLabelText('Select alert for AAPL')).toBeDefined();
    expect(screen.getByLabelText('Select alert for MSFT')).toBeDefined();
    expect(screen.getByLabelText('Select alert for TSLA')).toBeDefined();

    // Select All checkbox exists
    expect(screen.getByLabelText('Select all visible alerts')).toBeDefined();
    expect(screen.getByText(/Select All/i)).toBeDefined();
  });

  it('allows selecting an alert and reveals the bulk delete action bar', async () => {
    renderComponent();

    const aaplCheckbox = screen.getByLabelText('Select alert for AAPL');
    expect(screen.queryByText(/1 selected/i)).toBeNull();

    // Toggle AAPL checkbox
    fireEvent.click(aaplCheckbox);

    // Selected count badge appears
    await waitFor(() => {
      expect(screen.getByText('1 selected')).toBeDefined();
    });

    // Delete Selected button appears (both in header and toolbar)
    expect(screen.getAllByRole('button', { name: /Delete Selected \(1\)/i }).length).toBeGreaterThan(0);
  });

  it('allows selecting multiple alerts and bulk deleting them with confirmation', async () => {
    renderComponent();

    const aaplCheckbox = screen.getByLabelText('Select alert for AAPL');
    const msftCheckbox = screen.getByLabelText('Select alert for MSFT');

    fireEvent.click(aaplCheckbox);
    fireEvent.click(msftCheckbox);

    await waitFor(() => {
      expect(screen.getByText('2 selected')).toBeDefined();
    });

    const deleteBtns = screen.getAllByRole('button', { name: /Delete Selected \(2\)/i });
    expect(deleteBtns.length).toBeGreaterThan(0);
    fireEvent.click(deleteBtns[0]);

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('2 selected alert'));
    expect(mockBulkDeleteMutateAsync).toHaveBeenCalledWith(
      expect.arrayContaining(['alert-1', 'alert-2'])
    );

    // Selection resets after delete
    await waitFor(() => {
      expect(screen.queryByText('2 selected')).toBeNull();
    });
  });

  it('toggles Select All to select all alerts at once', async () => {
    renderComponent();

    const selectAllCheckbox = screen.getByLabelText('Select all visible alerts');

    // Click Select All
    fireEvent.click(selectAllCheckbox);

    await waitFor(() => {
      expect(screen.getByText('3 selected')).toBeDefined();
    });

    // All checkboxes should now be checked, delete button shown
    expect(screen.getAllByRole('button', { name: /Delete Selected \(3\)/i }).length).toBeGreaterThan(0);

    // Click Select All again to unselect all
    fireEvent.click(selectAllCheckbox);

    await waitFor(() => {
      expect(screen.queryByText('3 selected')).toBeNull();
    });
  });

  it('allows clearing selection via the Clear button', async () => {
    renderComponent();

    const aaplCheckbox = screen.getByLabelText('Select alert for AAPL');
    fireEvent.click(aaplCheckbox);

    await waitFor(() => {
      expect(screen.getByText('1 selected')).toBeDefined();
    });

    const clearBtn = screen.getByRole('button', { name: /Clear/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.queryByText('1 selected')).toBeNull();
    });
  });
});
