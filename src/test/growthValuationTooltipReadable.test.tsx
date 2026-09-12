import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GrowthAndValuationCard } from '../components/research/GrowthAndValuationCard';

const mockGrowthData = {
  symbol: 'NVDA',
  name: 'NVIDIA Corporation',
  currentPrice: 120.0,
  currency: 'USD',
  marketCap: 3000000000000,
  enterpriseValue: 2950000000000,
  valuation: {
    trailingPE: 60.5,
    forwardPE: 35.2,
    forwardPE_FY2: 28.0,
    peCompressionPct: -41.8,
    pegRatio: 1.5,
    forwardPegRatio: 1.1,
    priceToSales: 25.0,
    forwardPriceToSales: 18.0,
    evToEbitda: 45.0,
    forwardEvToEbitda: 26.0,
    fcfYield: 2.2,
    earningsYield: 1.6,
    dividendYield: 0.03,
  },
  historicalGrowth: {
    revenueYoY: 122.4,
    revenue3YCagr: 23.6,
    revenue5YCagr: 32.1,
    netIncomeYoY: 280.0,
    netIncome3YCagr: 45.0,
    netIncome5YCagr: 40.0,
    epsYoY: 275.0,
    eps3YCagr: 44.0,
    eps5YCagr: 39.0,
    fcfYoY: 150.0,
    fcf3YCagr: 35.0,
    fcfMargin: 45.0,
    grossMargin: 75.0,
    operatingMargin: 54.0,
    annualHistory: [],
  },
  forwardGrowth: {
    q1Estimate: null,
    q2Estimate: null,
    fy1Estimate: null,
    fy2Estimate: null,
    longTermGrowthRate: 25.0,
    consensusRevenueGrowthFY1: 31.9,
    consensusRevenueGrowthFY2: 24.5,
    consensusEpsGrowthFY1: 40.0,
    consensusEpsGrowthFY2: 28.0,
    revisions: {
      up30Days: 28,
      down30Days: 2,
      momentum: 'Strong Upward Revisions' as const,
    },
    allPeriods: [],
  },
  impliedValuation: {
    currentFcf: 45000000000,
    defaultWacc: 9.5,
    defaultTerminalRate: 3.8,
    implied5YFcfGrowth: 17.33,
    implied10YFcfGrowth: 12.5,
    consensusForecastGrowth: 31.9,
    growthGap: -14.57,
    marketExpectationTone: 'Discounted / Pessimistic Growth Implied' as const,
    explanation: 'The current price implies +17.33% FCF growth over 5 years.',
  },
  scenarios: {
    bull: {
      label: 'Bull Case',
      probability: 25,
      targetPE: 45,
      projectedEps: 5.5,
      targetPrice: 247.5,
      upsidePct: 106.2,
      fcfGrowth: 40.0,
      description: 'Accelerated AI infrastructure buildouts',
    },
    base: {
      label: 'Base Case',
      probability: 50,
      targetPE: 35,
      projectedEps: 4.2,
      targetPrice: 147.0,
      upsidePct: 22.5,
      fcfGrowth: 25.0,
      description: 'Sustained enterprise demand',
    },
    bear: {
      label: 'Bear Case',
      probability: 25,
      targetPE: 22,
      projectedEps: 3.0,
      targetPrice: 66.0,
      upsidePct: -45.0,
      fcfGrowth: 8.0,
      description: 'Cyclical hardware digestion',
    },
  },
  growthDiagnostics: {
    ruleOf40Score: 78.5,
    ruleOf40Grade: 'Elite (Rule of 50+)' as const,
    roic: 42.0,
    wacc: 9.5,
    evaSpread: 32.5,
    fcfConversionRate: 85.0,
    reinvestmentRate: 20.0,
    growthQualityScore: 88,
  },
  trajectoryChart: [
    { period: '2023', isEstimate: false, revenue: 60e9, netIncome: 29e9, freeCashFlow: 27e9, eps: 1.19 },
    { period: '2024', isEstimate: false, revenue: 96e9, netIncome: 53e9, freeCashFlow: 50e9, eps: 2.15 },
    { period: '2025E', isEstimate: true, revenue: 130e9, netIncome: 70e9, freeCashFlow: 65e9, eps: 2.85 },
  ],
  qualityScore: {
    score: 85,
    label: 'Elite Compounder',
    breakdown: {
      growthDurability: 90,
      marginExpansion: 88,
      fcfConversion: 82,
      capitalEfficiency: 80,
    },
  },
};

vi.mock('@/services/growthValuationService', () => ({
  useGrowthAndValuation: vi.fn(() => ({
    data: mockGrowthData,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  })),
}));

describe('GrowthAndValuationCard Tooltip Readability', () => {
  it('renders Reverse DCF tab and displays growth benchmarking section', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GrowthAndValuationCard symbol="NVDA" />
      </QueryClientProvider>
    );

    // Click "What is the Price Implying? (Reverse DCF)" tab
    const reverseDcfTab = screen.getByRole('button', {
      name: /What is the Price Implying\? \(Reverse DCF\)/i,
    });
    expect(reverseDcfTab).toBeDefined();
    fireEvent.click(reverseDcfTab);

    // Verify Reverse DCF section is visible
    expect(
      screen.getByText(/Reverse DCF & Market Implied Growth Barometer/i)
    ).toBeDefined();

    // Verify Growth Benchmarking section is visible
    expect(
      screen.getByText(
        /Growth Benchmarking: Market Implied vs Wall Street Consensus vs Historical Track Record/i
      )
    ).toBeDefined();
  });
});
