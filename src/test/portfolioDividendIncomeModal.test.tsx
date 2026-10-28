import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PortfolioDividendIncomeModal } from '../components/portfolio/PortfolioDividendIncomeModal';
import type { PortfolioDividendIncomeReport } from '../services/portfolioDividendService';

const mockReport: PortfolioDividendIncomeReport = {
  totalPortfolioValueUSD: 50000,
  totalDividendHoldingsValueUSD: 30000,
  totalHoldingsCount: 2,
  dividendPayerCount: 2,
  nonDividendPayerCount: 0,
  portfolioDividendCoveragePct: 60,
  currentAnnualIncomeUSD: 1200,
  projectedAnnualIncomeUSD: 1300,
  incrementalRaiseIncomeUSD: 100,
  totalProjectedRaisePct: 8.33,
  portfolioWeightedYield: 2.4,
  dividendPayersWeightedYield: 4.0,
  portfolioWeightedExpectedRaise: 8.33,
  monthlyAverageIncomeUSD: 108.33,
  monthlyRunRateUSD: 100,
  monthlyDistribution: Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    monthName: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
    expectedIncomeUSD: 100,
    holdingsCount: 1,
    topTickers: ['SCHD'],
  })),
  holdings: [
    {
      symbol: 'SCHD',
      name: 'Schwab US Dividend Equity ETF',
      assetType: 'ETF',
      sector: 'Diversified',
      currency: 'USD',
      shares: 100,
      currentPrice: 80,
      marketValue: 8000,
      marketValueUSD: 8000,
      costBasis: 7500,
      isDividendPayer: true,
      dividendRate: 2.8,
      dividendRateUSD: 2.8,
      dividendYield: 3.5,
      payoutRatio: 50,
      fiveYearAvgYield: 3.4,
      exDividendDate: '2026-03-20',
      dividendDate: '2026-03-26',
      frequency: 'QUARTERLY',
      paymentMonths: [3, 6, 9, 12],
      historicalRaise1Y: 7.2,
      historicalRaise3YAvg: 8.1,
      expectedRaisePercent: 7.5,
      expectedRaiseSource: 'HISTORICAL_1Y',
      currentAnnualIncome: 280,
      currentAnnualIncomeUSD: 280,
      projectedAnnualIncome: 301,
      projectedAnnualIncomeUSD: 301,
      incrementalRaiseIncome: 21,
      incrementalRaiseIncomeUSD: 21,
    },
    {
      symbol: 'O',
      name: 'Realty Income Corp',
      assetType: 'REIT',
      sector: 'Real Estate',
      currency: 'USD',
      shares: 50,
      currentPrice: 55,
      marketValue: 2750,
      marketValueUSD: 2750,
      costBasis: 2600,
      isDividendPayer: true,
      dividendRate: 3.12,
      dividendRateUSD: 3.12,
      dividendYield: 5.67,
      payoutRatio: 75,
      fiveYearAvgYield: 4.8,
      exDividendDate: '2026-01-30',
      dividendDate: '2026-02-14',
      frequency: 'MONTHLY',
      paymentMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      historicalRaise1Y: 3.0,
      historicalRaise3YAvg: 3.2,
      expectedRaisePercent: 3.0,
      expectedRaiseSource: 'HISTORICAL_1Y',
      currentAnnualIncome: 156,
      currentAnnualIncomeUSD: 156,
      projectedAnnualIncome: 160.68,
      projectedAnnualIncomeUSD: 160.68,
      incrementalRaiseIncome: 4.68,
      incrementalRaiseIncomeUSD: 4.68,
    },
  ],
  topIncomeGenerators: [
    {
      symbol: 'SCHD',
      name: 'Schwab US Dividend Equity ETF',
      incomeUSD: 280,
      percentOfTotal: 64.2,
    },
  ],
  generatedAt: '2026-10-28T00:00:00Z',
};

vi.mock('@/services/portfolioDividendService', () => ({
  usePortfolioDividendIncome: vi.fn(() => ({
    data: mockReport,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  })),
  useCalculateDividendIncome: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

describe('PortfolioDividendIncomeModal', () => {
  it('renders successfully without MONTH_NAMES ReferenceError when open', () => {
    render(
      <PortfolioDividendIncomeModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Verify modal title renders
    expect(screen.getByText('Expected Dividend Income & Raises')).toBeInTheDocument();

    // Verify holdings rendered
    expect(screen.getAllByText('SCHD').length).toBeGreaterThan(0);
    expect(screen.getByText('O')).toBeInTheDocument();

    // Verify payment months rendered formatted with month names
    expect(screen.getByText('Mar/Jun/Sep/Dec')).toBeInTheDocument();
    expect(screen.getByText('Jan/Feb/Mar/Apr/May/Jun/Jul/Aug/Sep/Oct/Nov/Dec')).toBeInTheDocument();
  });
});
