import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type AiRatingGrade = 'BUY' | 'HOLD' | 'SELL';
export type ConsensusGrade = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

export interface ModelRatingResult {
  modelId: string;
  modelName: string;
  provider: string;
  rating: AiRatingGrade;
  conviction: number; // 1 to 10
  targetPrice?: number | null;
  upsidePercent?: number | null;
  bullThesis: string;
  bearRisk: string;
  summary: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface AiRatingConsensus {
  symbol: string;
  companyName: string;
  currentPrice: number;
  sector?: string;
  industry?: string;
  consensusRating: ConsensusGrade;
  blendedConviction: number; // 1.0 to 10.0
  convictionStrength: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'SPECULATIVE';
  ratingsCount: {
    BUY: number;
    HOLD: number;
    SELL: number;
  };
  buyPercentage: number;
  holdPercentage: number;
  sellPercentage: number;
  blendedTargetPrice?: number | null;
  impliedUpsidePercent?: number | null;
  consensusSummary: string;
  topBullDriver: string;
  topBearRisk: string;
  modelResults: ModelRatingResult[];
  analyzedAt: string;
}

export const aiRatingService = {
  /**
   * Fetches the multi-LLM consensus rating for a given stock symbol
   */
  async getRating(symbol: string, forceRefresh = false): Promise<AiRatingConsensus> {
    const cleanSymbol = (symbol || '').trim().toUpperCase();
    if (!cleanSymbol) {
      throw new Error('Valid stock symbol required');
    }

    const url = `/api/research/ai-rating/${encodeURIComponent(cleanSymbol)}`;
    const res = await fetch(url, {
      method: forceRefresh ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: forceRefresh ? JSON.stringify({ refresh: true }) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch AI rating for ${cleanSymbol} (${res.status})`);
    }

    const data = await res.json();
    return data.data as AiRatingConsensus;
  },
};

/**
 * Hook to fetch or query AI rating for a symbol
 */
export function useAiRating(symbol: string, enabled = false) {
  const cleanSymbol = (symbol || '').trim().toUpperCase();
  return useQuery<AiRatingConsensus, Error>({
    queryKey: ['aiRating', cleanSymbol],
    queryFn: () => aiRatingService.getRating(cleanSymbol),
    enabled: Boolean(cleanSymbol && enabled),
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Hook to trigger a fresh multi-LLM rating analysis
 */
export function useTriggerAiRating() {
  const queryClient = useQueryClient();

  return useMutation<AiRatingConsensus, Error, { symbol: string; forceRefresh?: boolean }>({
    mutationFn: ({ symbol, forceRefresh = true }) => aiRatingService.getRating(symbol, forceRefresh),
    onSuccess: (data, variables) => {
      const cleanSymbol = variables.symbol.trim().toUpperCase();
      queryClient.setQueryData(['aiRating', cleanSymbol], data);
    },
  });
}
