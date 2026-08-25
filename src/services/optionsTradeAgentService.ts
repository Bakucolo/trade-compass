import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type OptionsStrategyCategory =
  | 'ALL'
  | 'CASH_SECURED_PUT'
  | 'BULL_PUT_SPREAD'
  | 'IRON_CONDOR'
  | 'COVERED_CALL'
  | 'POOR_MANS_COVERED_CALL'
  | 'BULL_CALL_SPREAD'
  | 'BEAR_PUT_SPREAD'
  | 'BEAR_CALL_SPREAD';

export type LiquidityTier = 'INSTITUTIONAL' | 'VERY_HIGH' | 'MODERATE' | 'LOW';

export interface OptionsAgentFilterParams {
  strategyCategory?: OptionsStrategyCategory;
  minIVP?: number; // 0 - 100
  maxIVP?: number;
  minIVR?: number; // 0 - 100
  maxIVR?: number;
  minLiquidity?: 'ALL' | 'HIGH' | 'INSTITUTIONAL';
  minPOP?: number; // 50 - 95
  minUnderlyingPrice?: number;
  maxUnderlyingPrice?: number;
  targetDteRange?: 'ANY' | 'WEEKLY' | 'TASTY_30_45' | 'SWING_60_90' | 'LEAPS';
  customPrompt?: string;
  searchQuery?: string;
}

export interface OptionLeg {
  action: 'BUY' | 'SELL';
  optionType: 'CALL' | 'PUT';
  strike: number;
  expiration: string;
  dte: number;
  delta: number;
  bid: number;
  ask: number;
  mid: number;
  impliedVol: number;
  openInterest?: number;
  volume?: number;
}

export interface OptionsTradeOpportunity {
  id: string;
  symbol: string;
  companyName: string;
  currentPrice: number;
  dayChangePercent: number;
  sector?: string;
  industry?: string;
  
  // Strategy Specifications
  strategyCategory: OptionsStrategyCategory;
  strategyName: string;
  sentiment: 'BULLISH' | 'NEUTRAL_BULLISH' | 'NEUTRAL' | 'NEUTRAL_BEARISH' | 'BEARISH';
  targetDte: number;
  targetExpiration: string;
  
  // Volatility & Liquidity Screeners
  impliedVolatility: number; // e.g. 42.5%
  ivRank: number; // 0 - 100%
  ivPercentile: number; // 0 - 100%
  volatilityRegime: 'EXTREME_HIGH' | 'HIGH_PREMIUM' | 'NORMAL' | 'LOW_CHEAP';
  liquidityTier: LiquidityTier;
  liquidityScore: number; // 1 - 5 stars
  avgDailyOptionVolume: number;
  bidAskSpreadQuality: 'PENNY_WIDE' | 'TIGHT' | 'MODERATE' | 'WIDE';
  
  // Multi-Leg Structure
  legs: OptionLeg[];
  netEffect: 'CREDIT' | 'DEBIT';
  netPremiumPerShare: number;
  netPremiumTotal: number;
  
  // Financial Risk & Return
  capitalRequired: number;
  maxProfit: number;
  maxProfitPercent: number;
  annualizedRocPercent: number;
  maxLoss: number | 'UNLIMITED';
  riskRewardRatio: string;
  probabilityOfProfitPercent: number;
  breakEvenPrice: number;
  breakEvenBufferPercent: number;
  
  // Greeks
  netDelta: number;
  netTheta: number;
  netVega: number;
  netGamma: number;
  
  // AI Synthesis & Tactical Playbook
  aiScore: number;
  catalystOrEarnings?: string;
  volatilityThesis: string;
  technicalSetup: string;
  tradeManagementRules: {
    profitTarget: string;
    stopLossRule: string;
    timeStopRule: string;
    defenseAdjustment?: string;
  };
}

export interface OptionsTradeAgentScanResult {
  timestamp: string;
  totalUniverseScanned: number;
  matchedCount: number;
  marketEnvironment: {
    vixLevel: number;
    vixChange: number;
    regimeSummary: string;
    recommendedApproach: string;
  };
  summaryMetrics: {
    avgAnnualizedRoc: number;
    avgPopPercent: number;
    highIvOpportunitiesCount: number;
    institutionalLiquidityCount: number;
  };
  opportunities: OptionsTradeOpportunity[];
}

export async function scanOptionsTradeOpportunities(
  filters: OptionsAgentFilterParams = {}
): Promise<OptionsTradeAgentScanResult> {
  const res = await fetch('/api/trades/options-agent/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to scan options trade opportunities.');
  }

  return res.json();
}

export function useOptionsTradeScanner(filters: OptionsAgentFilterParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['optionsTradeAgentScan', filters],
    queryFn: () => scanOptionsTradeOpportunities(filters),
    enabled,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false
  });
}

export function useScanOptionsAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filters: OptionsAgentFilterParams) => scanOptionsTradeOpportunities(filters),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['optionsTradeAgentScan', variables], data);
    }
  });
}
