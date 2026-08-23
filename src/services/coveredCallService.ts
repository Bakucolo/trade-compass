import { useQuery } from '@tanstack/react-query';

export interface ProposedCallStrike {
  tier: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';
  tierName: string;
  targetDelta: number;
  strike: number;
  expiration: string;
  dte: number;
  estimatedBid: number;
  estimatedAsk: number;
  estimatedMid: number;
  premiumPerContract: number; // Mid * 100
  totalPotentialIncome: number; // Premium * capacity
  annualizedYieldPercent: number; // APY
  otmBufferPercent: number; // % above current price
  probabilityOfProfitPercent: number; // POP
  breakEvenPrice: number;
  impliedVolatility: number;
  isRealQuote: boolean;
  contractSymbol?: string;
}

export type CoverageStatus =
  | 'UNCOVERED_OPPORTUNITY'
  | 'PARTIALLY_COVERED'
  | 'FULLY_COVERED'
  | 'DELTA_DEFICIT';

export interface CoveredCallPositionCandidate {
  symbol: string;
  companyName: string;
  assetType: 'EQUITY' | 'OPTION' | 'MIXED';
  currentPrice: number;
  totalMarketValue: number;
  shareCount: number;
  longCallsCount: number;
  shortCallsCount: number;
  netPositionDelta: number;
  unhedgedDelta: number;
  coveredCallCapacity: number;
  coverageStatus: CoverageStatus;
  activeCoveredCalls: Array<{
    contractSymbol: string;
    strike: number;
    expiration: string;
    dte: number;
    quantity: number;
    currentPrice: number;
    marketValue: number;
  }>;
  proposedCalls: {
    conservative: ProposedCallStrike;
    balanced: ProposedCallStrike;
    aggressive: ProposedCallStrike;
  };
  ivRankPercentile?: number;
  dividendYieldPercent?: number;
  fiftyTwoWeekHigh?: number;
  distanceFrom52WHigh?: number;
  brokers: string[];
}

export interface CoveredCallsAnalysisResult {
  scanTimestamp: string;
  totalPortfolioNetDelta: number;
  totalEligiblePositionsCount: number;
  uncoveredPositionsCount: number;
  partiallyCoveredCount: number;
  fullyCoveredCount: number;
  totalUncoveredCallCapacity: number;
  potentialMonthlyIncomeEstimate: number;
  potentialAnnualizedYieldEstimate: number;
  candidates: CoveredCallPositionCandidate[];
}

export interface OptionChainExpiration {
  date: string;
  dte: number;
  calls: Array<{
    contractSymbol: string;
    strike: number;
    optionType: 'CALL';
    expiration: string;
    dte: number;
    bid: number;
    ask: number;
    mid: number;
    lastPrice: number;
    impliedVolatility: number;
    inTheMoney: boolean;
    delta: number;
    otmPercent: number;
    pop: number;
  }>;
}

export interface DetailedOptionChainResponse {
  symbol: string;
  companyName: string;
  currentPrice: number;
  expirations: OptionChainExpiration[];
}

export const coveredCallService = {
  async getCoveredCallsAnalysis(): Promise<CoveredCallsAnalysisResult> {
    const res = await fetch('/api/management/covered-calls');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch covered calls analysis');
    }
    return res.json();
  },

  async getDetailedOptionChain(symbol: string, strike?: number): Promise<DetailedOptionChainResponse> {
    const cleanSym = symbol.trim().toUpperCase();
    const query = strike ? `?strike=${strike}` : '';
    const res = await fetch(`/api/management/covered-calls/${cleanSym}/chain${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch option chain for ${cleanSym}`);
    }
    return res.json();
  }
};

export function useCoveredCallsAnalysis() {
  return useQuery({
    queryKey: ['coveredCallsAnalysis'],
    queryFn: () => coveredCallService.getCoveredCallsAnalysis(),
    staleTime: 60 * 1000,
    refetchInterval: 120 * 1000,
  });
}

export function useDetailedOptionChain(symbol?: string, strike?: number) {
  return useQuery({
    queryKey: ['detailedOptionChain', symbol?.trim().toUpperCase(), strike],
    queryFn: () => coveredCallService.getDetailedOptionChain(symbol!, strike),
    enabled: Boolean(symbol && symbol.trim().length > 0),
    staleTime: 30 * 1000,
  });
}
