import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MonteCarloSimulationModal } from '../components/research/MonteCarloSimulationModal';
import * as monteCarloService from '../services/monteCarloService';

describe('Interactive Valuation & Stock Forecast Studio', () => {
  let queryClient: QueryClient;

  const mockBaselines: monteCarloService.CompanyBaselinesData = {
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    currency: 'USD',
    currentPrice: 400.0,
    revenue: 245000000000,
    revenueBillions: 245.0,
    operatingMargin: 42.0,
    profitMargin: 35.0,
    sharesOutstanding: 7430000000,
    sharesOutstandingBillions: 7.43,
    freeCashFlow: 70000000000,
    fcfBillions: 70.0,
    trailingPE: 32.0,
    forwardPE: 28.0,
    revenueGrowth: 15.0,
    beta: 1.1,
    marketCap: 2972000000000,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.restoreAllMocks();

    vi.spyOn(monteCarloService, 'useCompanyBaselines').mockReturnValue({
      data: mockBaselines,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as any);

    // Ensure useMonteCarloSimulation is NOT enabled by default
    vi.spyOn(monteCarloService, 'useMonteCarloSimulation').mockImplementation((ticker, options: any) => {
      expect(options?.enabled).toBe(false); // Verifies it NEVER auto-runs!
      return {
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false,
      } as any;
    });
  });

  it('renders interactive studio without executing automatic stochastic simulation', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MonteCarloSimulationModal
          isOpen={true}
          onClose={vi.fn()}
          symbol="MSFT"
          currentPrice={400.0}
        />
      </QueryClientProvider>
    );

    // Verifies header and badges
    expect(screen.getByText('MSFT')).toBeDefined();
    expect(screen.getByText('Interactive Forecast Studio')).toBeDefined();

    // Verifies executive cards
    expect(screen.getByText('Current Market Price')).toBeDefined();
    expect(screen.getByText('$400.00')).toBeDefined();
    expect(screen.getByText(/Median Fair Value/i)).toBeDefined();
    expect(screen.getByText('Expected Margin of Safety')).toBeDefined();

    // Verifies the interactive forecast tabs
    expect(screen.getByText(/Forecast Path & Assumptions/i)).toBeDefined();
    expect(screen.getByText(/Year-by-Year Financials/i)).toBeDefined();
    expect(screen.getByText(/2D Sensitivity Grid/i)).toBeDefined();
    expect(screen.getByText(/Stochastic Monte Carlo/i)).toBeDefined();

    // Verifies interactive assumptions controls are present
    expect(screen.getByText(/Interactive Assumptions Controls/i)).toBeDefined();
    expect(screen.getByText(/Revenue Growth Rate/i)).toBeDefined();
    expect(screen.getByText(/Target Operating \/ FCF Margin/i)).toBeDefined();
    expect(screen.getByText(/Exit Valuation Multiple/i)).toBeDefined();
    expect(screen.getByText(/Discount Rate/i)).toBeDefined();
  });

  it('allows user to switch scenario presets to Bear and Bull', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MonteCarloSimulationModal
          isOpen={true}
          onClose={vi.fn()}
          symbol="MSFT"
          currentPrice={400.0}
        />
      </QueryClientProvider>
    );

    // Click Bull preset button
    const bullButton = screen.getByRole('button', { name: 'Bull' });
    fireEvent.click(bullButton);

    expect(screen.getByText(/Bull Mode/i)).toBeDefined();

    // Click Bear preset button
    const bearButton = screen.getByRole('button', { name: 'Bear' });
    fireEvent.click(bearButton);

    expect(screen.getByText(/Bear Mode/i)).toBeDefined();
  });

  it('renders stochastic Monte Carlo tab as on-demand without auto-running', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MonteCarloSimulationModal
          isOpen={true}
          onClose={vi.fn()}
          symbol="MSFT"
          currentPrice={400.0}
        />
      </QueryClientProvider>
    );

    // Switch to Stochastic Monte Carlo tab
    const stochasticTab = screen.getByRole('tab', { name: /Stochastic Monte Carlo/i });
    fireEvent.pointerDown(stochasticTab, { button: 0 });
    fireEvent.click(stochasticTab);
    fireEvent.keyDown(stochasticTab, { key: 'Enter' });

    // Check that explicit on-demand warning and button are shown
    await waitFor(() => {
      expect(screen.getByText(/runs on-demand only/i)).toBeDefined();
    });
    expect(screen.getByText(/Run 10,000 Stochastic Paths/i)).toBeDefined();
  });
});
