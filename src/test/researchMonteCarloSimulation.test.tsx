import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MonteCarloSimulationModal } from '../components/research/MonteCarloSimulationModal';
import * as monteCarloService from '../services/monteCarloService';

describe('MonteCarloSimulationModal in Research Section', () => {
  let queryClient: QueryClient;

  const mockSimulationResult: monteCarloService.MonteCarloSimulationResult = {
    ticker: 'AAPL',
    current_market_price: 220.0,
    median_intrinsic_value: 264.0,
    mean_intrinsic_value: 265.5,
    std_intrinsic_value: 32.4,
    confidence_interval_90: {
      p05: 205.0,
      p95: 325.0,
    },
    confidence_interval_80: {
      p10: 218.0,
      p90: 310.0,
    },
    scenarios: {
      bear: {
        name: 'Bear Case',
        probability: 0.1,
        intrinsic_value: 218.0,
        upside_downside_pct: -0.9,
        description: 'Margin compression and elevated cost of capital.',
      },
      base: {
        name: 'Base Case',
        probability: 0.5,
        intrinsic_value: 264.0,
        upside_downside_pct: 20.0,
        description: 'Mean-reverting 10Y rates and historical cash conversion.',
      },
      bull: {
        name: 'Bull Case',
        probability: 0.1,
        intrinsic_value: 310.0,
        upside_downside_pct: 40.9,
        description: 'Operating margin expansion and peak revenue acceleration.',
      },
    },
    prob_undervalued: 0.82,
    expected_margin_of_safety_pct: 20.0,
    raw_distribution: [
      { bin_index: 0, bin_start: 190, bin_end: 200, bin_midpoint: 195, count: 120, density: 0.012, cumulative_probability: 0.012 },
      { bin_index: 1, bin_start: 200, bin_end: 220, bin_midpoint: 210, count: 680, density: 0.068, cumulative_probability: 0.080 },
      { bin_index: 2, bin_start: 220, bin_end: 240, bin_midpoint: 230, count: 2400, density: 0.240, cumulative_probability: 0.320 },
      { bin_index: 3, bin_start: 240, bin_end: 260, bin_midpoint: 250, count: 3500, density: 0.350, cumulative_probability: 0.670 },
      { bin_index: 4, bin_start: 260, bin_end: 280, bin_midpoint: 270, count: 2100, density: 0.210, cumulative_probability: 0.880 },
      { bin_index: 5, bin_start: 280, bin_end: 320, bin_midpoint: 300, count: 1200, density: 0.120, cumulative_probability: 1.0 },
    ],
    factor_sensitivities: {
      sensitivity_to_revenue_growth: 1.45,
      sensitivity_to_operating_margin: 1.82,
      sensitivity_to_interest_rates: -0.88,
      sensitivity_to_inflation: -0.52,
    },
    simulated_paths_count: 10000,
    execution_duration_ms: 184,
    macro_baselines: {
      risk_free_rate: 0.0425,
      implied_inflation: 0.0235,
      long_term_rfr_mean: 0.038,
      rfr_mean_reversion_speed: 0.15,
      rfr_volatility: 0.012,
      long_term_inflation_mean: 0.022,
      equity_risk_premium: 0.05,
      source: 'FRED Telemetry Cache',
    },
    company_baselines: {
      ticker: 'AAPL',
      current_price: 220.0,
      shares_outstanding: 15300000000,
      free_cash_flow: 108000000000,
      revenue: 385000000000,
      operating_margin: 0.305,
      total_debt: 110000000000,
      cash_and_equivalents: 65000000000,
      historical_rev_growth_cagr: 0.082,
      rev_growth_std: 0.045,
      beta: 1.15,
      source: 'IBKR / SEC Telemetry Cache',
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.restoreAllMocks();
  });

  it('renders correctly with 10,000 paths valuation results for researched ticker', () => {
    vi.spyOn(monteCarloService, 'useMonteCarloSimulation').mockReturnValue({
      data: mockSimulationResult,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MonteCarloSimulationModal
          isOpen={true}
          onClose={vi.fn()}
          symbol="AAPL"
          currentPrice={220.0}
        />
      </QueryClientProvider>
    );

    // 1. Header and ticker badges
    expect(screen.getByText('AAPL')).toBeDefined();
    expect(screen.getByText('Multi-Factor Monte Carlo')).toBeDefined();

    // 2. Executive Metrics Bar
    expect(screen.getByText('Current Market Price')).toBeDefined();
    expect(screen.getByText('$220.00')).toBeDefined();
    expect(screen.getByText('Median Fair Value (P50)')).toBeDefined();
    expect(screen.getAllByText('$264.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Expected Margin of Safety')).toBeDefined();
    expect(screen.getAllByText('+20.0%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Prob. Undervalued')).toBeDefined();
    expect(screen.getByText('82%')).toBeDefined();

    // 3. Scenario Cards
    expect(screen.getByText(/Bear Scenario/i)).toBeDefined();
    expect(screen.getByText('$218.00')).toBeDefined();
    expect(screen.getByText(/Base Case/i)).toBeDefined();
    expect(screen.getByText(/Bull Scenario/i)).toBeDefined();
    expect(screen.getByText('$310.00')).toBeDefined();
  });

  it('renders loading state when simulation is executing', () => {
    vi.spyOn(monteCarloService, 'useMonteCarloSimulation').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: true,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MonteCarloSimulationModal
          isOpen={true}
          onClose={vi.fn()}
          symbol="NVDA"
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Running 10,000 Trial Simulation')).toBeDefined();
    expect(screen.getByText(/Ingesting Treasury yield curves/i)).toBeDefined();
  });

  it('toggles full size / fullscreen mode when full screen button is clicked', () => {
    vi.spyOn(monteCarloService, 'useMonteCarloSimulation').mockReturnValue({
      data: mockSimulationResult,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MonteCarloSimulationModal
          isOpen={true}
          onClose={vi.fn()}
          symbol="AAPL"
          currentPrice={220}
        />
      </QueryClientProvider>
    );

    const toggleBtn = screen.getByTitle('Full size simulate window (Fullscreen)');
    expect(toggleBtn).toBeDefined();

    // Click to enter full size
    fireEvent.click(toggleBtn);
    expect(screen.getByTitle('Restore window size (Exit Fullscreen)')).toBeDefined();

    // Click to restore window size
    fireEvent.click(screen.getByTitle('Restore window size (Exit Fullscreen)'));
    expect(screen.getByTitle('Full size simulate window (Fullscreen)')).toBeDefined();
  });
});
