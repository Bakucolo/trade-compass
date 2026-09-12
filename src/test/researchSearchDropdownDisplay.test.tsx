import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ResearchPage } from '../components/ResearchPage';

// Mock child modals
vi.mock('../components/PromptManagerModal', () => ({
  PromptManagerModal: () => null,
}));
vi.mock('../components/StockNoteModal', () => ({
  StockNoteModal: () => null,
}));
vi.mock('../components/portfolio/PortfolioFitModal', () => ({
  PortfolioFitModal: () => null,
}));
vi.mock('../components/IdeaModal', () => ({
  IdeaModal: () => null,
}));
vi.mock('../components/AddToWatchlistModal', () => ({
  AddToWatchlistModal: () => null,
}));
vi.mock('../components/AutonomousReportViewerModal', () => ({
  AutonomousReportViewerModal: () => null,
}));
vi.mock('../components/research/MonteCarloSimulationModal', () => ({
  MonteCarloSimulationModal: () => null,
}));
vi.mock('../components/TradeStructureModal', () => ({
  TradeStructureModal: () => null,
}));

// Mock marketDataService
vi.mock('../services/marketData', () => ({
  marketDataService: {
    searchSymbols: vi.fn().mockImplementation(async (q: string) => {
      if (q.toUpperCase().includes('FLNC')) {
        return [
          { symbol: 'FLNC', name: 'Fluence Energy, Inc.', stockExchange: 'NASDAQ', exchangeShortName: 'NASDAQ' }
        ];
      }
      return [
        { symbol: 'AAPL', name: 'Apple Inc.', stockExchange: 'NASDAQ', exchangeShortName: 'NASDAQ' }
      ];
    }),
    getQuote: vi.fn().mockResolvedValue({ price: 150, change: 1, changesPercentage: 0.6 }),
  },
  USE_STREAMING: false,
}));

vi.mock('../services/researchData', () => ({
  useResearchDossier: vi.fn().mockReturnValue({ data: null, isLoading: false, isError: false }),
  useAIAnalysis: vi.fn().mockReturnValue({ data: null, isLoading: false }),
  useOptionsLiquidity: vi.fn().mockReturnValue({ data: null }),
}));

vi.mock('../services/optionsChainService', () => ({
  useOptionsChain: vi.fn().mockReturnValue({ data: null }),
}));

vi.mock('../services/reportService', () => ({
  useAutonomousReports: vi.fn().mockReturnValue({ data: [] }),
  reportService: { generateAutonomousReport: vi.fn() },
}));

vi.mock('../services/tastytradeStreamer', () => ({
  tastyStreamer: { connect: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), disconnect: vi.fn() },
}));

describe('ResearchPage Ticker Search Dropdown Stacking & Display', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    localStorage.setItem('tradeflow_research_full_page', 'true');
  });

  it('renders search dropdown popover with elevated z-index and proper layout', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ResearchPage initialSymbol="AAPL" />
      </QueryClientProvider>
    );

    const input = screen.getByPlaceholderText(/Search ticker or company/i);
    expect(input).toBeDefined();

    // The ribbon container must have relative z-30
    const ribbon = input.closest('div.relative.z-30');
    expect(ribbon).not.toBeNull();

    // The search input wrapper must have relative z-40
    const searchWrapper = input.closest('div.relative.z-40');
    expect(searchWrapper).not.toBeNull();

    // Type FLNC
    fireEvent.change(input, { target: { value: 'FLNC' } });

    // Wait for the dropdown popover
    await waitFor(() => {
      expect(screen.getByText(/Matching Companies/i)).toBeDefined();
      expect(screen.getByText(/Fluence Energy, Inc./i)).toBeDefined();
    });

    // Check that popover has z-50
    const popover = screen.getByText(/Matching Companies/i).closest('div.z-50');
    expect(popover).not.toBeNull();

    // Click the FLNC item
    const flncItem = screen.getByText(/Fluence Energy, Inc./i);
    fireEvent.mouseDown(flncItem);

    // Popover should close after selecting
    await waitFor(() => {
      expect(screen.queryByText(/Matching Companies/i)).toBeNull();
    });
  });
});
