import { useQuery } from '@tanstack/react-query';

export type ImpliedVerdictType =
  | 'PRICED_FOR_PERFECTION'
  | 'PRICED_FOR_AGGRESSIVE_GROWTH'
  | 'PRICED_FOR_CONSENSUS'
  | 'PRICED_WITH_SAFETY_BUFFER'
  | 'PRICED_FOR_DECLINE_DISTRESS';

export interface HurdleMilestone {
  period: string; // 'FY1', 'FY2', 'FY5'
  label: string;
  requiredRevenueBillions: number;
  requiredYoYGrowthPct: number;
  requiredMarginPct: number;
  requiredEps: number;
  requiredFcfBillions: number;
  difficultyRating: 'EXTREME' | 'HIGH' | 'MODERATE' | 'ACHIEVABLE' | 'LOW';
}

export interface DownsideScenario {
  name: string;
  description: string;
  assumedGrowthPct: number;
  impliedStockPrice: number;
  priceChangePct: number;
  impactVerdict: 'SEVERE_DOWNSIDE' | 'MODERATE_DOWNSIDE' | 'NEUTRAL_ALIGNMENT' | 'EXPANSION_UPSIDE';
}

export interface ImpliedExpectationsAnalysis {
  symbol: string;
  name: string;
  currency: string;
  currentPrice: number;
  marketCapBillions: number;
  enterpriseValueBillions: number;
  sharesOutstandingBillions: number;

  // Baseline Current Fundamentals
  currentRevenueBillions: number;
  currentFcfBillions: number;
  currentOperatingMargin: number;
  currentProfitMargin: number;
  trailingPE: number;
  forwardPE: number;
  beta: number;
  wacc: number;

  // Implied Market Expectations (Reverse DCF / Multiple Decomposition)
  impliedGrowth: {
    horizon3YGrowthPct: number;
    horizon5YGrowthPct: number;
    horizon7YGrowthPct: number;
    impliedTargetMarginPct: number;
    impliedTerminalMultiple: number;
    impliedCapDurationYears: number;
  };

  // Expectations Benchmark & Gap
  benchmarks: {
    consensusRevenueGrowthFY1: number;
    consensusRevenueGrowthFY2: number;
    historicalRevenue3YCagr: number;
    sectorMedianGrowth: number;
    expectationsGapPct: number;
    marginExpectationsGapPct: number;
  };

  // Verdict & Classification
  verdict: {
    type: ImpliedVerdictType;
    badgeLabel: string;
    headline: string;
    riskScore: number;
    sentiment: 'EUPHORIC' | 'ELEVATED' | 'BALANCED' | 'DEFENSIVE' | 'DISTRESSED';
  };

  // The Market's Hurdle Checklist
  hurdleChecklist: HurdleMilestone[];

  // Downside De-Rating Scenarios
  downsideScenarios: DownsideScenario[];

  // Agent Natural Language Synthesis
  agentSynthesis: {
    executiveSummary: string;
    keyVulnerability: string;
    catalystThreshold: string;
    earningsHurdleText: string;
    source: 'LLM_SYNTHESIS' | 'QUANTITATIVE_ENGINE';
  };

  timestamp: number;
}

/**
 * Fetch implied expectations analysis from backend
 */
export async function fetchImpliedExpectations(
  symbol: string,
  priceOverride?: number
): Promise<ImpliedExpectationsAnalysis> {
  const cleanSym = symbol.trim().toUpperCase();
  const url = priceOverride
    ? `/api/implied-expectations/${cleanSym}?price=${encodeURIComponent(priceOverride)}`
    : `/api/implied-expectations/${cleanSym}`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Failed to fetch implied expectations analysis (${res.status})`);
  }
  return res.json();
}

/**
 * React Query hook to get implied expectations analysis
 */
export function useImpliedExpectations(
  symbol?: string,
  options: { enabled?: boolean; priceOverride?: number } = {}
) {
  const { enabled = true, priceOverride } = options;
  const cleanSym = (symbol || '').trim().toUpperCase();

  return useQuery<ImpliedExpectationsAnalysis, Error>({
    queryKey: ['impliedExpectations', cleanSym, priceOverride],
    queryFn: () => fetchImpliedExpectations(cleanSym, priceOverride),
    enabled: Boolean(cleanSym) && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });
}

/**
 * Visual styling helper for Verdict types
 */
export function getVerdictStyle(verdictType: ImpliedVerdictType) {
  switch (verdictType) {
    case 'PRICED_FOR_PERFECTION':
      return {
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        text: 'text-rose-400',
        card: 'bg-rose-500/10 border-rose-500/30',
        glow: 'shadow-rose-500/20',
        iconColor: 'text-rose-400',
      };
    case 'PRICED_FOR_AGGRESSIVE_GROWTH':
      return {
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        text: 'text-amber-400',
        card: 'bg-amber-500/10 border-amber-500/30',
        glow: 'shadow-amber-500/20',
        iconColor: 'text-amber-400',
      };
    case 'PRICED_FOR_CONSENSUS':
      return {
        badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        text: 'text-cyan-400',
        card: 'bg-cyan-500/10 border-cyan-500/30',
        glow: 'shadow-cyan-500/20',
        iconColor: 'text-cyan-400',
      };
    case 'PRICED_WITH_SAFETY_BUFFER':
      return {
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        text: 'text-emerald-400',
        card: 'bg-emerald-500/10 border-emerald-500/30',
        glow: 'shadow-emerald-500/20',
        iconColor: 'text-emerald-400',
      };
    case 'PRICED_FOR_DECLINE_DISTRESS':
      return {
        badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        text: 'text-purple-400',
        card: 'bg-purple-500/10 border-purple-500/30',
        glow: 'shadow-purple-500/20',
        iconColor: 'text-purple-400',
      };
    default:
      return {
        badge: 'bg-primary/20 text-primary border-primary/40',
        text: 'text-primary',
        card: 'bg-primary/10 border-primary/30',
        glow: 'shadow-primary/20',
        iconColor: 'text-primary',
      };
  }
}

/**
 * Visual styling helper for difficulty ratings
 */
export function getDifficultyBadge(rating: HurdleMilestone['difficultyRating']) {
  switch (rating) {
    case 'EXTREME':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    case 'HIGH':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'MODERATE':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    case 'ACHIEVABLE':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}
