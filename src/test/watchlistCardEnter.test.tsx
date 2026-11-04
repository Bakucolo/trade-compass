import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WatchlistCard } from '../components/WatchlistCard';
import { marketDataService } from '../services/marketData';

const { mockAddSymbolMutateAsync } = vi.hoisted(() => ({
  mockAddSymbolMutateAsync: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../services/watchlistService', () => ({
  useWatchlists: vi.fn().mockReturnValue({
    data: [
      { id: 'wl-1', name: 'Tech Watchlist', isDefault: true, items: [] },
    ],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useWatchlistData: vi.fn().mockReturnValue({
    data: {
      watchlist: { id: 'wl-1', name: 'Tech Watchlist', isDefault: true },
      items: [],
    },
    isLoading: false,
    isRefetching: false,
    refetch: vi.fn(),
  }),
  useAddSymbolToWatchlist: vi.fn().mockReturnValue({
    mutateAsync: mockAddSymbolMutateAsync,
    isPending: false,
  }),
  useRemoveSymbolFromWatchlist: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
  useCreateWatchlist: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
}));

vi.mock('../components/AddToWatchlistModal', () => ({
  AddToWatchlistModal: () => null,
}));

describe('WatchlistCard Enter Key Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds the first company shown in the autocomplete list when pressing Enter in WatchlistCard', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const searchSpy = vi.spyOn(marketDataService, 'searchSymbols').mockResolvedValue([
      { symbol: 'NVDA', name: 'NVIDIA Corporation', stockExchange: 'NASDAQ' },
      { symbol: 'NVD.DE', name: 'Nvidia Corp (Frankfurt)', stockExchange: 'GER' },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <WatchlistCard />
      </QueryClientProvider>
    );

    // Click "Add Ticker" button to open inline search box
    const addStockBtn = screen.getByRole('button', { name: /add ticker/i });
    fireEvent.click(addStockBtn);

    const input = screen.getByPlaceholderText(/Add ticker to/i) as HTMLInputElement;
    expect(input).toBeDefined();

    // Type "nvidia"
    fireEvent.change(input, { target: { value: 'nvidia' } });

    // Wait for dropdown
    await waitFor(() => {
      expect(screen.getByText('NVIDIA Corporation')).toBeDefined();
      expect(screen.getByText('NVDA')).toBeDefined();
    });

    // Press Enter
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Verify first company NVDA was added
    await waitFor(() => {
      expect(mockAddSymbolMutateAsync).toHaveBeenCalledWith({
        watchlistId: 'wl-1',
        symbol: 'NVDA',
      });
    });

    searchSpy.mockRestore();
  });
});
