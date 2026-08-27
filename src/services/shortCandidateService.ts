import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type ShortArchetype =
  | 'ALL'
  | 'FUNDAMENTAL_OVERVALUATION'
  | 'TECHNICAL_BREAKDOWN'
  | 'EARNINGS_DECELERATION'
  | 'HIGH_BETA_CYCLICAL_TOP'
  | 'BALANCE_SHEET_DISTRESS';

export type ShortExecutionVehicle =
  | 'ALL'
  | 'DIRECT_SHORT'
  | 'LONG_PUT'
  | 'BEAR_PUT_SPREAD'
  | 'BEAR_CALL_SPREAD';

export type MarketCapCategory = 'ALL' | 'MEGA_CAP' | 'LARGE_CAP' | 'MID_CAP' | 'SMALL_CAP';

export interface ShortAgentFilterParams {
  archetype?: ShortArchetype;
  executionVehicle?: ShortExecutionVehicle;
  marketCapCategory?: MarketCapCategory;
  sector?: string;
  minConviction?: number; // 60 - 95
  maxPrice?: number;
  minPrice?: number;
  maxRSI?: number;
  searchQuery?: string;
  customPrompt?: string;
}

export interface ShortTradeCandidate {
  id: string;
  symbol: string;
  companyName: string;
  currentPrice: number;
  dayChangePercent: number;
  sector: string;
  industry: string;
  marketCap: number;
  marketCapCategory: MarketCapCategory;
  archetype: ShortArchetype;
  archetypeLabel: string;
  convictionScore: number; // 65 - 98
  convictionTier: 'HIGH_CONVICTION' | 'MODERATE_CONVICTION' | 'TACTICAL_SPECULATIVE';
  shortThesis: string;
  keyVulnerabilities: string[];
  catalysts: string[];
  metrics: {
    peRatio?: number;
    forwardPE?: number;
    priceToSales?: number;
    evToEbitda?: number;
    debtToEquity?: number;
    revenueGrowthYoY?: number;
    netMargin?: number;
    freeCashFlow?: string;
    shortInterestPercent?: number;
    daysToCover?: number;
    rsi14: number;
    distFrom52wHighPercent: number;
    distFrom200DmaPercent: number;
    movingAverageTrend: 'STRONG_BEARISH' | 'MODERATE_BEARISH' | 'BREAKDOWN_EMERGING';
  };
  tradeBlueprint: {
    recommendedVehicle: 'DIRECT_SHORT' | 'LONG_PUT' | 'BEAR_PUT_SPREAD' | 'BEAR_CALL_SPREAD';
    vehicleLabel: string;
    entryTriggerPrice: number;
    entryCondition: string;
    targetPrice1: number;
    targetPrice2: number;
    stopLossPrice: number;
    downsidePotentialPercent: number;
    riskPercent: number;
    riskRewardRatio: string;
    timeHorizon: 'SWING_1_4_WEEKS' | 'POSITION_1_3_MONTHS' | 'TACTICAL_DAYS';
    executionDetails: string;
    optionsStructure?: {
      strategyName: string;
      primaryStrike: number;
      secondaryStrike?: number;
      targetExpiration: string;
      targetDte: number;
      estimatedCostOrCredit: number;
      maxProfit: number;
      maxLoss: number;
    };
  };
}

export interface ShortCandidateScanResult {
  scanTimestamp: string;
  totalUniverseScanned: number;
  matchedCount: number;
  marketContext: {
    spyTrend: string;
    vixLevel: number;
    marketRegime: 'RISK_OFF_BEARISH' | 'DISTRIBUTION_CHOP' | 'ELEVATED_VOLATILITY' | 'OVERBOUGHT_BULLISH';
  };
  sectorBreakdown: Record<string, number>;
  archetypeBreakdown: Record<string, number>;
  candidates: ShortTradeCandidate[];
}

export async function fetchShortCandidates(filters: ShortAgentFilterParams = {}): Promise<ShortCandidateScanResult> {
  const response = await fetch('/api/trades/short-agent/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to scan short candidates' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Hook to query short candidates on modal open or filter change
 */
export function useShortCandidates(filters: ShortAgentFilterParams = {}, enabled = true) {
  return useQuery<ShortCandidateScanResult>({
    queryKey: ['shortCandidatesScan', filters],
    queryFn: () => fetchShortCandidates(filters),
    enabled,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false
  });
}

/**
 * Mutation hook for manual on-demand agent scans
 */
export function useScanShortCandidates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filters: ShortAgentFilterParams) => fetchShortCandidates(filters),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['shortCandidatesScan', variables], data);
    }
  });
}
