import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppFeatureSearch } from '../components/dashboard/AppFeatureSearch';

const mockWatchlists = [
  {
    id: 'wl-micro-caps',
    name: 'Micro caps',
    isDefault: false,
    items: [{ symbol: 'POET' }, { symbol: 'NVO' }]
  },
  {
    id: 'wl-tech-growth',
    name: 'Tech Growth',
    isDefault: true,
    items: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }, { symbol: 'NVDA' }]
  }
];

vi.mock('@/services/watchlistService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/watchlistService')>();
  return {
    ...actual,
    useWatchlists: vi.fn(() => ({
      data: mockWatchlists,
      isLoading: false
    }))
  };
});

describe('AppFeatureSearch Component Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders search input with placeholder and shortcut pill', () => {
    render(<AppFeatureSearch />);
    const input = screen.getByPlaceholderText(/Search all sections/i);
    expect(input).toBeDefined();
    expect(screen.getByText('Ctrl')).toBeDefined();
    expect(screen.getByText('K')).toBeDefined();
  });

  it('opens dropdown on focus showing most used and recommended features', async () => {
    render(<AppFeatureSearch />);
    const input = screen.getByPlaceholderText(/Search all sections/i);

    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByTestId('app-feature-search-dropdown')).toBeDefined();
      expect(screen.getByText(/Most Used & Recommended Features/i)).toBeDefined();
      expect(screen.getByText(/FAST Graphs Fundamental Valuation/i)).toBeDefined();
      expect(screen.getByText(/Watchlists & Canadian TSX Tickers/i)).toBeDefined();
    });
  });

  it('filters features accurately when user types a query', async () => {
    render(<AppFeatureSearch />);
    const input = screen.getByPlaceholderText(/Search all sections/i);

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'buying power' } });

    await waitFor(() => {
      expect(screen.getByText(/Buying Power & Margin Risk Analyser/i)).toBeDefined();
      expect(screen.queryByText(/Earnings Calendar/i)).toBeNull();
    });
  });

  it('navigates to FAST Graphs when FAST Graphs is selected and sets view mode', async () => {
    const mockNavigate = vi.fn();
    render(<AppFeatureSearch onNavigateTab={mockNavigate} />);
    const input = screen.getByPlaceholderText(/Search all sections/i);

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'fast graphs' } });

    await waitFor(() => {
      expect(screen.getByText(/FAST Graphs Fundamental Valuation/i)).toBeDefined();
    });

    fireEvent.click(screen.getByText(/FAST Graphs Fundamental Valuation/i));

    expect(mockNavigate).toHaveBeenCalledWith('graphs');
    expect(localStorage.getItem('graphs_view_mode')).toBe('FAST_GRAPHS');
    expect(localStorage.getItem('tradeflow_recent_features')).toContain('fast-graphs');
  });

  it('triggers modal callback when an interactive tool is selected', async () => {
    const mockBuyingPower = vi.fn();
    render(<AppFeatureSearch onOpenBuyingPower={mockBuyingPower} />);
    const input = screen.getByPlaceholderText(/Search all sections/i);

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'buying power' } });

    await waitFor(() => {
      expect(screen.getByText(/Buying Power & Margin Risk Analyser/i)).toBeDefined();
    });

    fireEvent.click(screen.getByText(/Buying Power & Margin Risk Analyser/i));
    expect(mockBuyingPower).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard navigation (ArrowDown and Enter) to select features', async () => {
    const mockNavigate = vi.fn();
    render(<AppFeatureSearch onNavigateTab={mockNavigate} />);
    const input = screen.getByPlaceholderText(/Search all sections/i);

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'scanner' } });

    await waitFor(() => {
      expect(screen.getByText(/Market Scanner & Breakout Radar/i)).toBeDefined();
    });

    // Press Enter to select the highlighted top result
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockNavigate).toHaveBeenCalledWith('scanner');
  });

  it('displays and clears recent features history', async () => {
    localStorage.setItem('tradeflow_recent_features', JSON.stringify(['watchlist', 'scanner']));

    render(<AppFeatureSearch />);
    const input = screen.getByPlaceholderText(/Search all sections/i);

    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByText(/Recent Features/i)).toBeDefined();
    });

    const clearBtn = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Recent Features/i)).toBeNull();
    });
  });

  it('searches for a watchlist by name and displays it with WATCHLISTS category', async () => {
    render(<AppFeatureSearch />);
    const input = screen.getByPlaceholderText(/Search all sections/i);

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Micro caps' } });

    await waitFor(() => {
      expect(screen.getByText('Watchlist: Micro caps')).toBeDefined();
      expect(screen.getByText('WATCHLISTS')).toBeDefined();
      expect(screen.getByText(/2 STOCKS/i)).toBeDefined();
    });
  });

  it('navigates directly to selected watchlist on click and dispatches select-watchlist event', async () => {
    const mockNavigateTab = vi.fn();
    const mockSelectWatchlist = vi.fn();
    const eventHandler = vi.fn();

    window.addEventListener('select-watchlist', eventHandler);

    render(
      <AppFeatureSearch
        onNavigateTab={mockNavigateTab}
        onSelectWatchlist={mockSelectWatchlist}
      />
    );
    const input = screen.getByPlaceholderText(/Search all sections/i);

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Micro caps' } });

    await waitFor(() => {
      expect(screen.getByText('Watchlist: Micro caps')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Watchlist: Micro caps'));

    expect(mockSelectWatchlist).toHaveBeenCalledWith('wl-micro-caps');
    expect(localStorage.getItem('tradeflow_active_watchlist_id')).toBe('wl-micro-caps');
    expect(eventHandler).toHaveBeenCalled();

    window.removeEventListener('select-watchlist', eventHandler);
  });

  it('navigates to watchlist when pressing Enter on searched watchlist result', async () => {
    const mockNavigateTab = vi.fn();
    const mockSelectWatchlist = vi.fn();

    render(
      <AppFeatureSearch
        onNavigateTab={mockNavigateTab}
        onSelectWatchlist={mockSelectWatchlist}
      />
    );
    const input = screen.getByPlaceholderText(/Search all sections/i);

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Tech Growth' } });

    await waitFor(() => {
      expect(screen.getByText('Watchlist: Tech Growth')).toBeDefined();
    });

    // Press Enter to immediately open the top result
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockSelectWatchlist).toHaveBeenCalledWith('wl-tech-growth');
    expect(localStorage.getItem('tradeflow_active_watchlist_id')).toBe('wl-tech-growth');
  });
});
