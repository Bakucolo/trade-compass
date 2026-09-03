import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PriceAlertModal } from '../components/PriceAlertModal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as alertService from '../services/alertService';

// Mock alertService
vi.mock('../services/alertService', async () => {
  const actual = await vi.importActual('../services/alertService');
  return {
    ...actual,
    useAlerts: vi.fn(),
    useCreateAlert: vi.fn(),
    useUpdateAlert: vi.fn(),
    useDeleteAlert: vi.fn(),
  };
});

// Mock marketDataService
vi.mock('../services/marketData', () => ({
  marketDataService: {
    getQuote: vi.fn().mockResolvedValue({
      price: 120.0,
      change: 2.5,
      changePercent: 2.12,
      name: 'NVIDIA Corporation',
    }),
    searchSymbols: vi.fn().mockResolvedValue([]),
  },
}));

describe('PriceAlertModal - Existing Alerts for Stock View', () => {
  let queryClient: QueryClient;
  const mockDeleteMutateAsync = vi.fn().mockResolvedValue({ success: true });

  const sampleAlerts: alertService.PriceAlert[] = [
    {
      id: 'alert-1',
      symbol: 'NVDA',
      targetPrice: 135.0,
      condition: 'ABOVE',
      status: 'ACTIVE',
      notes: 'Breakout above resistance',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggeredAt: null,
      triggeredPrice: null,
    },
    {
      id: 'alert-2',
      symbol: 'NVDA',
      targetPrice: 110.0,
      condition: 'BELOW',
      status: 'ACTIVE',
      notes: 'Support level stop watch',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      triggeredAt: null,
      triggeredPrice: null,
    },
    {
      id: 'alert-3',
      symbol: 'TSLA',
      targetPrice: 250.0,
      condition: 'ABOVE',
      status: 'ACTIVE',
      notes: 'Tesla swing',
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

    vi.mocked(alertService.useAlerts).mockReturnValue({
      data: sampleAlerts,
      isLoading: false,
    } as any);

    vi.mocked(alertService.useCreateAlert).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(alertService.useUpdateAlert).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(alertService.useDeleteAlert).mockReturnValue({
      mutateAsync: mockDeleteMutateAsync,
      isPending: false,
    } as any);
  });

  it('displays the existing alerts set for the selected stock with count, condition badges and notes', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PriceAlertModal
          open={true}
          onOpenChange={vi.fn()}
          initialSymbol="NVDA"
          initialPrice={120.0}
          initialStockName="NVIDIA Corporation"
        />
      </QueryClientProvider>
    );

    // Check section title and badge count (2 for NVDA)
    expect(screen.getByText(/Alerts Already Set for NVDA/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Check alert targets
    expect(screen.getByText(/≥ \$135\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/≤ \$110\.00/i)).toBeInTheDocument();

    // Check notes
    expect(screen.getByText(/"Breakout above resistance"/i)).toBeInTheDocument();
    expect(screen.getByText(/"Support level stop watch"/i)).toBeInTheDocument();

    // Ensure TSLA alert is not in this stock list
    expect(screen.queryByText(/Tesla swing/i)).not.toBeInTheDocument();
  });

  it('clicking "Use" loads the existing target price and condition into the form', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PriceAlertModal
          open={true}
          onOpenChange={vi.fn()}
          initialSymbol="NVDA"
          initialPrice={120.0}
        />
      </QueryClientProvider>
    );

    // Find all "Use" buttons in the existing alerts list
    const useButtons = screen.getAllByRole('button', { name: /use/i });
    expect(useButtons.length).toBe(2);

    // Click "Use" on the first alert (135.00, ABOVE)
    fireEvent.click(useButtons[0]);

    // Check target price input value
    const targetInput = screen.getByPlaceholderText('0.00') as HTMLInputElement;
    expect(targetInput.value).toBe('135');
  });

  it('shows an empty state notice when no alerts exist for the given stock', async () => {
    vi.mocked(alertService.useAlerts).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <PriceAlertModal
          open={true}
          onOpenChange={vi.fn()}
          initialSymbol="AAPL"
          initialPrice={220.0}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Alerts Already Set for AAPL/i)).toBeInTheDocument();
    expect(screen.getByText(/No alerts currently set for/i)).toBeInTheDocument();
  });

  it('calls deleteAlert mutation when the delete button is clicked on an existing alert', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PriceAlertModal
          open={true}
          onOpenChange={vi.fn()}
          initialSymbol="NVDA"
          initialPrice={120.0}
        />
      </QueryClientProvider>
    );

    const deleteButtons = screen.getAllByTitle(/delete this alert/i);
    expect(deleteButtons.length).toBe(2);

    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith('alert-1');
    });
  });
});
