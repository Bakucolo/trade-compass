import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImpliedExpectationsModal } from '../components/graphs/ImpliedExpectationsModal';
import * as impliedExpectationsService from '../services/impliedExpectationsService';

describe('ImpliedExpectationsModal ("What\'s Priced In?")', () => {
  let queryClient: QueryClient;

  const mockAnalysis: impliedExpectationsService.ImpliedExpectationsAnalysis = {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    currency: 'USD',
    currentPrice: 120.0,
    marketCapBillions: 2950.0,
    enterpriseValueBillions: 2930.0,
    sharesOutstandingBillions: 24.6,
    currentRevenueBillions: 96.3,
    currentFcfBillions: 53.0,
    currentOperatingMargin: 62.0,
    currentProfitMargin: 55.0,
    trailingPE: 58.0,
    forwardPE: 36.0,
    beta: 1.65,
    wacc: 11.2,
    impliedGrowth: {
      horizon3YGrowthPct: 32.0,
      horizon5YGrowthPct: 24.5,
      horizon7YGrowthPct: 18.0,
      impliedTargetMarginPct: 65.0,
      impliedTerminalMultiple: 32.0,
      impliedCapDurationYears: 5,
    },
    benchmarks: {
      consensusRevenueGrowthFY1: 18.0,
      consensusRevenueGrowthFY2: 15.0,
      historicalRevenue3YCagr: 22.0,
      sectorMedianGrowth: 7.5,
      expectationsGapPct: 6.5,
      marginExpectationsGapPct: 3.0,
    },
    verdict: {
      type: 'PRICED_FOR_PERFECTION',
      badgeLabel: '🚀 Priced for Perfection',
      headline: 'Extreme Expectation Bar: Market demands rapid hypergrowth far exceeding consensus forecasts.',
      riskScore: 88,
      sentiment: 'EUPHORIC',
    },
    hurdleChecklist: [
      {
        period: 'FY1',
        label: 'Near-Term Hurdle (Next 12 Months)',
        requiredRevenueBillions: 119.89,
        requiredYoYGrowthPct: 24.5,
        requiredMarginPct: 65.0,
        requiredEps: 3.17,
        requiredFcfBillions: 70.1,
        difficultyRating: 'EXTREME',
      },
      {
        period: 'FY2',
        label: 'Medium-Term Hurdle (24 Months)',
        requiredRevenueBillions: 149.27,
        requiredYoYGrowthPct: 24.5,
        requiredMarginPct: 65.0,
        requiredEps: 3.94,
        requiredFcfBillions: 87.3,
        difficultyRating: 'HIGH',
      },
      {
        period: 'FY5',
        label: 'Terminal 5-Year Scale Target',
        requiredRevenueBillions: 288.04,
        requiredYoYGrowthPct: 24.5,
        requiredMarginPct: 65.0,
        requiredEps: 7.61,
        requiredFcfBillions: 177.8,
        difficultyRating: 'EXTREME',
      },
    ],
    downsideScenarios: [
      {
        name: 'Wall Street Consensus Baseline',
        description: 'If revenue growth merely matches consensus (+18.0%/yr).',
        assumedGrowthPct: 18.0,
        impliedStockPrice: 92.50,
        priceChangePct: -22.9,
        impactVerdict: 'MODERATE_DOWNSIDE',
      },
      {
        name: 'Historical 3-Year Growth Mean',
        description: 'If top-line compounding reverts to company historical average (+22.0%/yr).',
        assumedGrowthPct: 22.0,
        impliedStockPrice: 108.00,
        priceChangePct: -10.0,
        impactVerdict: 'MODERATE_DOWNSIDE',
      },
      {
        name: 'Macro GDP / Defensive Compression',
        description: 'Severe deceleration to nominal economic expansion (+3.5%/yr).',
        assumedGrowthPct: 3.5,
        impliedStockPrice: 78.00,
        priceChangePct: -35.0,
        impactVerdict: 'SEVERE_DOWNSIDE',
      },
      {
        name: 'Bull Case Expansion Beat',
        description: 'Aggressive execution delivering +25% above consensus.',
        assumedGrowthPct: 30.6,
        impliedStockPrice: 158.40,
        priceChangePct: 32.0,
        impactVerdict: 'EXPANSION_UPSIDE',
      },
    ],
    agentSynthesis: {
      executiveSummary: 'At $120.00 ($2950.00B market cap), the market is pricing NVDA to compound revenue at +24.5% CAGR for the next 5 years.',
      keyVulnerability: 'The company must consistently beat consensus revenue estimates by at least ~6.5% annually.',
      catalystThreshold: 'To unlock further expansion beyond $120.00, management must guide FY1 revenue above $119.89B.',
      earningsHurdleText: 'Next Quarter Minimum Target: Management must report quarterly revenue growth above +24.5% YoY.',
      source: 'QUANTITATIVE_ENGINE',
    },
    timestamp: Date.now(),
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.restoreAllMocks();
  });

  it('renders modal with ticker, verdict, executive HUD cards and hurdle checklist', () => {
    vi.spyOn(impliedExpectationsService, 'useImpliedExpectations').mockReturnValue({
      data: mockAnalysis,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <ImpliedExpectationsModal
          isOpen={true}
          onClose={vi.fn()}
          symbol="NVDA"
          currentPrice={120.0}
        />
      </QueryClientProvider>
    );

    // 1. Header & Badges
    expect(screen.getByText('NVDA')).toBeDefined();
    expect(screen.getByText('Reverse Valuation Engine')).toBeDefined();
    expect(screen.getByText(/Priced for Perfection/i)).toBeDefined();

    // 2. Executive HUD Cards
    expect(screen.getByText('Implied 5Y Revenue CAGR')).toBeDefined();
    expect(screen.getByText('+24.5%')).toBeDefined();
    expect(screen.getByText('Implied Operating Margin')).toBeDefined();
    expect(screen.getAllByText('65%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Implied Terminal Multiple')).toBeDefined();
    expect(screen.getByText('32x')).toBeDefined();
    expect(screen.getByText('88/100')).toBeDefined();

    // 3. Hurdle Checklist
    expect(screen.getByText(/The Market's Hurdle Checklist/i)).toBeDefined();
    expect(screen.getByText('FY1 Target')).toBeDefined();
    expect(screen.getByText('$119.89B')).toBeDefined();
    expect(screen.getByText('$288.04B')).toBeDefined();

    // 4. Vulnerability and Callout
    expect(screen.getByText(/Key Valuation Vulnerability/i)).toBeDefined();
    expect(screen.getByText(/Upside Catalyst Threshold/i)).toBeDefined();
  });

  it('allows user to switch between tabs and view Downside Scenarios', async () => {
    vi.spyOn(impliedExpectationsService, 'useImpliedExpectations').mockReturnValue({
      data: mockAnalysis,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <ImpliedExpectationsModal
          isOpen={true}
          onClose={vi.fn()}
          symbol="NVDA"
          currentPrice={120.0}
        />
      </QueryClientProvider>
    );

    // Switch to Downside De-Rating Scenarios tab
    const scenariosTab = screen.getByRole('tab', { name: /Downside De-Rating Scenarios/i });
    fireEvent.pointerDown(scenariosTab, { button: 0 });
    fireEvent.click(scenariosTab);
    fireEvent.keyDown(scenariosTab, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Wall Street Consensus Baseline')).toBeDefined();
      expect(screen.getByText('-22.9%')).toBeDefined();
      expect(screen.getByText('Historical 3-Year Growth Mean')).toBeDefined();
      expect(screen.getByText('Macro GDP / Defensive Compression')).toBeDefined();
    });
  });

  it('renders loading state when analysis is fetching', () => {
    vi.spyOn(impliedExpectationsService, 'useImpliedExpectations').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: true,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <ImpliedExpectationsModal
          isOpen={true}
          onClose={vi.fn()}
          symbol="NVDA"
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Running Reverse Valuation Decomposition')).toBeDefined();
  });
});
