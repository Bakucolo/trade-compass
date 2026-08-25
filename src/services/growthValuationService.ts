import { useQuery } from '@tanstack/react-query';

export interface HistoricalYearData {
  year: string;
  date: string;
  revenue: number;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  freeCashFlow: number;
  operatingCashFlow: number;
  dilutedEps: number;
  ebitda: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  fcfMargin: number;
}

export interface ForwardEstimatePeriod {
  period: string;
  label: string;
  endDate?: string;
  revenueAvg: number;
  revenueLow: number;
  revenueHigh: number;
  revenueGrowth: number;
  epsAvg: number;
  epsLow: number;
  epsHigh: number;
  epsGrowth: number;
  numberOfAnalysts: number;
}

export interface GrowthValuationData {
  symbol: string;
  name: string;
  currentPrice: number;
  currency: string;
  marketCap: number;
  enterpriseValue: number;

  valuation: {
    trailingPE: number | null;
    forwardPE: number | null;
    forwardPE_FY2: number | null;
    peCompressionPct: number | null;
    pegRatio: number | null;
    forwardPegRatio: number | null;
    priceToSales: number | null;
    forwardPriceToSales: number | null;
    evToEbitda: number | null;
    forwardEvToEbitda: number | null;
    fcfYield: number | null;
    earningsYield: number | null;
    dividendYield: number | null;
  };

  historicalGrowth: {
    revenueYoY: number | null;
    revenue3YCagr: number | null;
    revenue5YCagr: number | null;
    netIncomeYoY: number | null;
    netIncome3YCagr: number | null;
    netIncome5YCagr: number | null;
    epsYoY: number | null;
    eps3YCagr: number | null;
    eps5YCagr: number | null;
    fcfYoY: number | null;
    fcf3YCagr: number | null;
    fcfMargin: number | null;
    grossMargin: number | null;
    operatingMargin: number | null;
    annualHistory: HistoricalYearData[];
  };

  forwardGrowth: {
    q1Estimate: ForwardEstimatePeriod | null;
    q2Estimate: ForwardEstimatePeriod | null;
    fy1Estimate: ForwardEstimatePeriod | null;
    fy2Estimate: ForwardEstimatePeriod | null;
    longTermGrowthRate: number | null;
    consensusRevenueGrowthFY1: number | null;
    consensusRevenueGrowthFY2: number | null;
    consensusEpsGrowthFY1: number | null;
    consensusEpsGrowthFY2: number | null;
    revisions: {
      up30Days: number;
      down30Days: number;
      momentum: 'Strong Upward Revisions' | 'Moderate Upward' | 'Downward Pressure' | 'Stable';
    };
    allPeriods: ForwardEstimatePeriod[];
  };

  impliedValuation: {
    currentFcf: number;
    defaultWacc: number;
    defaultTerminalRate: number;
    implied5YFcfGrowth: number;
    implied10YFcfGrowth: number;
    consensusForecastGrowth: number;
    growthGap: number;
    marketExpectationTone: 'Priced for High Hypergrowth' | 'Priced for Consensus Growth' | 'Discounted / Pessimistic Growth Implied';
    explanation: string;
  };

  scenarios: {
    bull: {
      label: string;
      probability: number;
      growthRate: number;
      targetMultiple: number;
      targetPrice: number;
      upsidePct: number;
      thesis: string;
    };
    base: {
      label: string;
      probability: number;
      growthRate: number;
      targetMultiple: number;
      targetPrice: number;
      upsidePct: number;
      thesis: string;
    };
    bear: {
      label: string;
      probability: number;
      growthRate: number;
      targetMultiple: number;
      targetPrice: number;
      upsidePct: number;
      thesis: string;
    };
    expectedValuePrice: number;
    expectedValueReturnPct: number;
    riskRewardRatio: number;
    verdict: string;
  };

  growthDiagnostics: {
    ruleOf40Score: number;
    ruleOf40Grade: 'Elite (Rule of 50+)' | 'Strong (Rule of 40+)' | 'Moderate (20-40)' | 'Lagging (<20)';
    roic: number | null;
    wacc: number;
    evaSpread: number | null;
    fcfConversionRate: number | null;
    reinvestmentRate: number | null;
    growthQualityScore: number;
  };

  trajectoryChart: {
    period: string;
    isEstimate: boolean;
    revenue: number;
    netIncome: number;
    freeCashFlow: number;
    eps: number;
  }[];
}

const API_BASE = '/api/research';

export async function fetchGrowthAndValuation(ticker: string): Promise<GrowthValuationData> {
  const res = await fetch(`${API_BASE}/growth-valuation/${ticker}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch growth and valuation data');
  }
  return res.json();
}

export function useGrowthAndValuation(ticker: string) {
  return useQuery<GrowthValuationData>({
    queryKey: ['growthAndValuation', ticker?.toUpperCase()],
    queryFn: () => fetchGrowthAndValuation(ticker),
    enabled: Boolean(ticker && ticker.trim().length > 0),
    staleTime: 60 * 1000,
    retry: 1,
  });
}
