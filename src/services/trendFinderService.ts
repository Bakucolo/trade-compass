import { useQuery } from '@tanstack/react-query';

export type TrendStage = 'STARTING' | 'ONGOING' | 'EXHAUSTED';
export type TrendDirection = 'BULLISH' | 'BEARISH';
export type TrendScope = 'ASSET_CLASS' | 'SECTOR' | 'INDUSTRY_THEME';

export interface TrendItem {
  symbol: string;
  name: string;
  shortName: string;
  scope: TrendScope;
  subCategory: string;
  description: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;

  returns: {
    '1D': number;
    '1W': number;
    '1M': number;
    '3M': number;
    'YTD': number;
  };

  stage: TrendStage;
  direction: TrendDirection;
  trendStrengthScore: number;
  exhaustionRiskScore: number;

  dma20: number;
  dma50: number;
  dma200: number;
  dist20DmaPct: number;
  dist50DmaPct: number;
  dist200DmaPct: number;
  rsi14: number;
  isGoldenCross: boolean;
  isDeathCross: boolean;

  signals: string[];
  macroDriver: string;
  actionablePlaybook: string;

  // Trend Timing & Durations
  trendStartDate?: string;       // e.g. "2026-08-28" (date trend began)
  daysInTrend?: number;          // e.g. 6, 42 (how many days currently in trend)
  exhaustionStartDate?: string;  // e.g. "2026-08-25" (when exhaustion began)
  daysExhausted?: number;        // e.g. 9 (how many days since exhaustion began)
}

export interface TrendFinderSummary {
  startingCount: number;
  ongoingCount: number;
  exhaustedCount: number;
  bullishCount: number;
  bearishCount: number;
  topOpportunities: {
    startingBreakouts: TrendItem[];
    strongestTrends: TrendItem[];
    exhaustionReversals: TrendItem[];
  };
  items: TrendItem[];
  fetchedAt: string;
}

/**
 * Fetch Macro Trend Finder Overview
 */
export function useTrendFinder() {
  return useQuery<TrendFinderSummary>({
    queryKey: ['macro-trend-finder'],
    queryFn: async () => {
      const res = await fetch('/api/macro/trend-finder');
      if (!res.ok) {
        throw new Error(`Failed to fetch trend finder data: ${res.statusText}`);
      }
      return res.json();
    },
    staleTime: 45 * 1000, // 45 seconds
    refetchInterval: 60 * 1000,
  });
}

/**
 * Fetch Single Trend Details
 */
export function useTrendDetail(symbol?: string) {
  return useQuery<TrendItem>({
    queryKey: ['macro-trend-finder-detail', symbol],
    queryFn: async () => {
      if (!symbol) throw new Error('Symbol required');
      const res = await fetch(`/api/macro/trend-finder/${encodeURIComponent(symbol)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch trend detail for ${symbol}`);
      }
      return res.json();
    },
    enabled: Boolean(symbol),
    staleTime: 60 * 1000,
  });
}
