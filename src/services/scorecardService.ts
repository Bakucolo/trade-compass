import { useQuery, useMutation } from '@tanstack/react-query';

export type ConvictionGrade = 'STRONG_BUY' | 'BUY_ACCUMULATE' | 'HOLD_MONITOR' | 'TRIM_DEFENSIVE' | 'AVOID_HIGH_RISK';
export type HealthStatus = 'PRISTINE' | 'STABLE' | 'MODERATE_DEBT' | 'HIGH_LEVERAGE' | 'DISTRESSED';
export type ValuationPosture = 'DEEP_VALUE' | 'FAIR_VALUE' | 'RICHLY_VALUED' | 'SPECULATIVE_BUBBLE';

export interface ScorecardSubMetrics {
  priceTo52WeekHighPct: number;
  distanceFrom52WeekLowPct: number;
  technicalSetupScore: number;
  momentumScore: number;
  upsideToFairValuePct: number;
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  roePct: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  fcfYieldPct: number | null;
  revenueGrowthPct: number | null;
  piotroskiFScoreEstimate: number;
  altmanZScoreEstimate: number;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToSales: number | null;
  pegRatio: number | null;
  evToEbitda: number | null;
  fairValueEstimate: number;
}

export interface StockScorecard {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  sector: string;
  industry: string;
  marketCap: number;
  beta: number;

  overallScore: number;
  grade: ConvictionGrade;
  gradeLabel: string;
  
  buyingConvictionScore: number;
  fundamentalsScore: number;
  valuationScore: number;
  healthStatus: HealthStatus;
  valuationPosture: ValuationPosture;

  metrics: ScorecardSubMetrics;

  tacticalAction: string;
  suggestedBuyZone: { min: number; max: number };
  targetPrice: number;
  stopLossAnchor: number;
  recommendedMaxAllocationPct: number;

  keyStrengths: string[];
  keyRisks: string[];
  bullCase: string;
  bearCase: string;

  isHolding: boolean;
  holdingDetails?: {
    quantity: number;
    averageCost: number;
    marketValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    broker: string;
  };
  isWatchlist: boolean;
  watchlistNames?: string[];

  analyzedAt: string;
}

export interface ScorecardsHubResponse {
  scorecards: StockScorecard[];
  summary: {
    totalEvaluated: number;
    holdingsCount: number;
    watchlistCount: number;
    avgOverallScore: number;
    avgHoldingsScore: number;
    avgWatchlistScore: number;
    topConvictionPick: StockScorecard | null;
    topValuePick: StockScorecard | null;
    topQualityPick: StockScorecard | null;
  };
  sectors: string[];
  timestamp: number;
}

export interface ScorecardComparisonResponse {
  candidates: StockScorecard[];
  winners: {
    overall: string;
    buyingConviction: string;
    fundamentals: string;
    valuation: string;
    marginOfSafety: string;
  };
  keyTakeaways: string[];
}

export function useScorecards() {
  return useQuery<ScorecardsHubResponse>({
    queryKey: ['scorecardsHub'],
    queryFn: async () => {
      const res = await fetch('/api/scorecards');
      if (!res.ok) {
        throw new Error('Failed to fetch scorecards hub data');
      }
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useStockScorecard(symbol: string | null) {
  return useQuery<StockScorecard>({
    queryKey: ['stockScorecard', symbol?.toUpperCase()],
    queryFn: async () => {
      if (!symbol) throw new Error('Symbol required');
      const res = await fetch(`/api/scorecards/${encodeURIComponent(symbol.toUpperCase())}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch scorecard for ${symbol}`);
      }
      return res.json();
    },
    enabled: Boolean(symbol && symbol.trim().length > 0),
    staleTime: 60 * 1000,
  });
}

export function useScorecardComparison() {
  return useMutation<ScorecardComparisonResponse, Error, string[]>({
    mutationFn: async (symbols: string[]) => {
      const res = await fetch('/api/scorecards/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols }),
      });
      if (!res.ok) {
        throw new Error('Failed to compare stock scorecards');
      }
      return res.json();
    },
  });
}
