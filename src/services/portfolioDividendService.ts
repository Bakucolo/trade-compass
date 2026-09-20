import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface DividendHoldingItem {
  symbol: string;
  name: string;
  assetType: string;
  sector: string;
  currency: string;
  shares: number;
  currentPrice: number;
  marketValue: number;
  marketValueUSD: number;
  costBasis: number;
  isDividendPayer: boolean;
  dividendRate: number; // annual dividend per share in native currency
  dividendRateUSD: number;
  dividendYield: number; // percentage (e.g. 3.45%)
  payoutRatio: number | null; // percentage
  fiveYearAvgYield: number | null; // percentage
  exDividendDate: string | null;
  dividendDate: string | null;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'UNKNOWN';
  paymentMonths: number[]; // 1 to 12
  historicalRaise1Y: number | null; // % increase over last 12 months
  historicalRaise3YAvg: number | null; // 3-year annualized CAGR %
  expectedRaisePercent: number; // projected % raise for forward 1Y
  expectedRaiseSource: 'HISTORICAL_1Y' | 'HISTORICAL_3Y_CAGR' | 'FORWARD_ESTIMATE' | 'DEFAULT_CONSERVATIVE' | 'USER_OVERRIDE' | 'NONE';
  currentAnnualIncome: number; // shares * dividendRate in native currency
  currentAnnualIncomeUSD: number;
  projectedAnnualIncome: number; // currentAnnualIncome * (1 + raise/100)
  projectedAnnualIncomeUSD: number;
  incrementalRaiseIncome: number; // projected - current
  incrementalRaiseIncomeUSD: number;
}

export interface MonthlyIncomeItem {
  month: number; // 1 to 12
  monthName: string; // 'Jan', 'Feb', etc.
  expectedIncomeUSD: number;
  holdingsCount: number;
  topTickers: string[];
}

export interface PortfolioDividendIncomeReport {
  totalPortfolioValueUSD: number;
  totalDividendHoldingsValueUSD: number;
  totalHoldingsCount: number;
  dividendPayerCount: number;
  nonDividendPayerCount: number;
  portfolioDividendCoveragePct: number; // % of portfolio market value that pays dividends
  currentAnnualIncomeUSD: number;
  projectedAnnualIncomeUSD: number;
  incrementalRaiseIncomeUSD: number;
  totalProjectedRaisePct: number; // (incremental / current) * 100
  portfolioWeightedYield: number; // (currentAnnualIncome / totalPortfolioValue) * 100
  dividendPayersWeightedYield: number; // (currentAnnualIncome / totalDividendHoldingsValue) * 100
  portfolioWeightedExpectedRaise: number; // weighted average raise % across dividend payers
  monthlyAverageIncomeUSD: number;
  monthlyRunRateUSD: number;
  monthlyDistribution: MonthlyIncomeItem[];
  holdings: DividendHoldingItem[];
  topIncomeGenerators: Array<{ symbol: string; name: string; incomeUSD: number; percentOfTotal: number }>;
  highestDividendGrowers: Array<{ symbol: string; name: string; raisePercent: number; incomeUSD: number }>;
  sectorBreakdown: Array<{ sector: string; incomeUSD: number; yieldPct: number; percentOfTotal: number }>;
  lastCalculatedAt: string;
}

export const portfolioDividendService = {
  /**
   * Fetches the portfolio dividend income report
   */
  async getIncomeReport(forceRefresh = false): Promise<PortfolioDividendIncomeReport> {
    const url = `/api/portfolio/dividend-income${forceRefresh ? '?refresh=true' : ''}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch dividend income report (${res.status})`);
    }
    const data = await res.json();
    return data.data as PortfolioDividendIncomeReport;
  },

  /**
   * Re-calculates dividend income report with optional custom ticker raises
   */
  async calculateWithOverrides(payload: {
    forceRefresh?: boolean;
    overrides?: Record<string, number>;
  }): Promise<PortfolioDividendIncomeReport> {
    const res = await fetch('/api/portfolio/dividend-income/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to calculate dividend income (${res.status})`);
    }
    const data = await res.json();
    return data.data as PortfolioDividendIncomeReport;
  },
};

/**
 * Hook to retrieve portfolio dividend income report
 */
export function usePortfolioDividendIncome(enabled = true) {
  return useQuery<PortfolioDividendIncomeReport, Error>({
    queryKey: ['portfolioDividendIncome'],
    queryFn: () => portfolioDividendService.getIncomeReport(false),
    enabled,
    staleTime: 10 * 60 * 1000, // 10 mins cache
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Mutation hook to recompute with custom expected raise percentages
 */
export function useCalculateDividendIncome() {
  const queryClient = useQueryClient();

  return useMutation<
    PortfolioDividendIncomeReport,
    Error,
    { forceRefresh?: boolean; overrides?: Record<string, number> }
  >({
    mutationFn: (vars) => portfolioDividendService.calculateWithOverrides(vars),
    onSuccess: (data) => {
      queryClient.setQueryData(['portfolioDividendIncome'], data);
    },
  });
}
