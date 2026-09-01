import { useQuery } from '@tanstack/react-query';

const API_BASE = '/api';

export type OptionsLiquidityTier =
  | 'INSTITUTIONAL_ELITE'
  | 'VERY_HIGH'
  | 'MODERATE_RETAIL'
  | 'POOR_THIN'
  | 'ILLIQUID_AVOID'
  | 'NO_OPTIONS_CHAIN';

export interface StrategySuitability {
  strategyName: string;
  suitability: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NOT_RECOMMENDED';
  notes: string;
}

export interface OptionsLiquidityData {
  symbol: string;
  hasOptions: boolean;
  score: number; // 0 - 100
  stars: number; // 1.0 - 5.0
  tier: OptionsLiquidityTier;
  tierLabel: string;
  badgeColor: 'emerald' | 'cyan' | 'amber' | 'orange' | 'rose' | 'slate';
  summary: string;
  tradingGuidance: string;
  
  metrics: {
    avgAtmSpreadDollars: number;
    avgAtmSpreadPercent: number;
    totalOpenInterest: number;
    totalDailyVolume: number;
    callVolume: number;
    putVolume: number;
    callOpenInterest: number;
    putOpenInterest: number;
    putCallVolumeRatio: number;
    putCallOiRatio: number;
    availableExpirationsCount: number;
    hasWeeklyExpirations: boolean;
    pennySpreadProgram: boolean;
    underlyingPrice: number;
    nearestAtmCall?: {
      strike: number;
      bid: number;
      ask: number;
      mid: number;
      spread: number;
      volume: number;
      openInterest: number;
      impliedVolatility: number;
      expiration: string;
      dte: number;
    };
    nearestAtmPut?: {
      strike: number;
      bid: number;
      ask: number;
      mid: number;
      spread: number;
      volume: number;
      openInterest: number;
      impliedVolatility: number;
      expiration: string;
      dte: number;
    };
  };

  componentScores: {
    spreadScore: number; // Max 35
    oiDepthScore: number; // Max 25
    volumeScore: number; // Max 20
    breadthScore: number; // Max 10
    balanceScore: number; // Max 10
  };

  strategySuitability: StrategySuitability[];
  analyzedAt: string;
}

export const fetchResearchDossier = async (ticker: string) => {
  const response = await fetch(`${API_BASE}/research/dossier/${ticker}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch research dossier');
  }
  return response.json();
};

export const useResearchDossier = (ticker: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['researchDossier', ticker],
    queryFn: () => fetchResearchDossier(ticker),
    enabled: Boolean(ticker && ticker.trim().length > 0 && (options?.enabled ?? true)),
    retry: 1,
    staleTime: 60 * 1000 // 1 minute
  });
};

export const fetchAIAnalysis = async (ticker: string) => {
  const response = await fetch(`${API_BASE}/research/analyze/${ticker}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch AI analysis');
  }
  return response.json();
};

export const useAIAnalysis = (ticker: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['aiAnalysis', ticker],
    queryFn: () => fetchAIAnalysis(ticker),
    enabled: Boolean(ticker && ticker.trim().length > 0 && (options?.enabled ?? true)),
    retry: 0,
    staleTime: 5 * 60 * 1000 // 5 minutes, since it costs API tokens
  });
};

export const fetchOptionsLiquidity = async (ticker: string): Promise<OptionsLiquidityData> => {
  const response = await fetch(`${API_BASE}/research/options-liquidity/${ticker}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch options liquidity rating');
  }
  return response.json();
};

export const useOptionsLiquidity = (ticker: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['optionsLiquidity', ticker],
    queryFn: () => fetchOptionsLiquidity(ticker),
    enabled: Boolean(ticker && ticker.trim().length > 0 && (options?.enabled ?? true)),
    retry: 1,
    staleTime: 90 * 1000 // 90 seconds
  });
};
