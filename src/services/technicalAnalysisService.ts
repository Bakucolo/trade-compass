import { useQuery } from '@tanstack/react-query';

export type Timeframe = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type LevelType = 'SUPPORT' | 'RESISTANCE' | 'PIVOT';
export type LevelStrength = 'MAJOR' | 'MODERATE' | 'MINOR';

export interface SupportResistanceLevel {
  id: string;
  price: number;
  type: LevelType;
  timeframe: Timeframe;
  strength: LevelStrength;
  touchCount: number;
  distancePercent: number; // e.g. +3.4% or -2.1%
  distanceDollar: number;
  label: string;
  description: string;
  isImmediate: boolean;
}

export type MarketStage =
  | 'STAGE_1_ACCUMULATION'
  | 'STAGE_2_MARKUP'
  | 'STAGE_3_DISTRIBUTION'
  | 'STAGE_4_MARKDOWN';

export type MarketSubPhase =
  | 'EARLY_STAGE_BREAKOUT'
  | 'MID_STAGE_ADVANCE'
  | 'LATE_STAGE_CLIMAX'
  | 'DISTRIBUTION_TOPPING'
  | 'INITIAL_BREAKDOWN'
  | 'SUSTAINED_DECLINE'
  | 'CAPITULATION_BOTTOM'
  | 'CONSOLIDATION_BASE';

export interface MarketPhaseInfo {
  stage: MarketStage;
  stageName: string;
  subPhase: MarketSubPhase;
  subPhaseName: string;
  confidenceScore: number;
  phaseAgeEstimate: string;
  summary: string;
  keyCharacteristics: string[];
  diagnosticDetails: string;
}

export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface TrendHierarchy {
  shortTerm: {
    direction: TrendDirection;
    label: string;
    description: string;
  };
  mediumTerm: {
    direction: TrendDirection;
    label: string;
    description: string;
  };
  longTerm: {
    direction: TrendDirection;
    label: string;
    description: string;
  };
  primaryTrend: TrendDirection;
  trendStrengthScore: number;
  adx: number;
  movingAverageAlignment: 'BULLISH_STACK' | 'BEARISH_STACK' | 'MIXED_COMPRESSION';
  alignmentDescription: string;
  isGoldenCross: boolean;
  isDeathCross: boolean;
  goldenCrossDate?: string;
  deathCrossDate?: string;
}

export interface MovingAveragesData {
  dma20: number;
  dma50: number;
  dma200: number;
  dma20DistPct: number;
  dma50DistPct: number;
  dma200DistPct: number;
  slope50: 'RISING' | 'FLAT' | 'FALLING';
  slope200: 'RISING' | 'FLAT' | 'FALLING';
}

export interface OscillatorsData {
  rsi14: number;
  rsiCondition: 'OVERBOUGHT' | 'BULLISH_MOMENTUM' | 'NEUTRAL' | 'BEARISH_MOMENTUM' | 'OVERSOLD';
  rsiInterpretation: string;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    crossover: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL';
    interpretation: string;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidthPct: number;
    percentB: number;
    isSqueeze: boolean;
  };
  atr14: number;
  atrPercent: number;
  relativeVolume: number;
  volumeCondition: 'VERY_HIGH' | 'ABOVE_AVERAGE' | 'NORMAL' | 'BELOW_AVERAGE';
  fiftyTwoWeek: {
    high: number;
    low: number;
    distHighPct: number;
    distLowPct: number;
  };
}

export interface PivotPointsData {
  classic: {
    pp: number;
    r1: number;
    r2: number;
    r3: number;
    s1: number;
    s2: number;
    s3: number;
  };
  fibonacci: {
    level0: number;
    level236: number;
    level382: number;
    level500: number;
    level618: number;
    level786: number;
    level1000: number;
  };
}

export type ActionableVerdict =
  | 'STRONG_BUY'
  | 'BUY_ON_PULLBACK'
  | 'HOLD_TRAIL_STOPS'
  | 'TAKE_PROFIT'
  | 'NEUTRAL_WAIT'
  | 'TRIM_DEFENSIVE'
  | 'AVOID_BEARISH';

export interface ActionableBlueprint {
  verdict: ActionableVerdict;
  verdictTitle: string;
  bias: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  idealEntryZone: {
    low: number;
    high: number;
    rationale: string;
  };
  invalidationStop: {
    price: number;
    distancePct: number;
    rationale: string;
  };
  targets: Array<{
    label: string;
    price: number;
    distancePct: number;
    rationale: string;
  }>;
  riskRewardRatio: number;
  playbookGuidance: string;
}

export interface StockTechnicalAnalysis {
  symbol: string;
  name: string;
  currency: string;
  currentPrice: number;
  previousClose: number;
  dayChange: number;
  dayChangePercent: number;
  asOf: string;

  levels: SupportResistanceLevel[];
  immediateResistance: SupportResistanceLevel | null;
  immediateSupport: SupportResistanceLevel | null;
  pivotPoints: PivotPointsData;

  marketPhase: MarketPhaseInfo;
  trend: TrendHierarchy;
  movingAverages: MovingAveragesData;
  oscillators: OscillatorsData;
  blueprint: ActionableBlueprint;
}

/**
 * Hook to fetch complete Technical Analysis for a symbol
 */
export function useTechnicalAnalysis(symbol?: string) {
  const clean = symbol ? symbol.trim().toUpperCase() : '';

  return useQuery<StockTechnicalAnalysis>({
    queryKey: ['technical-analysis', clean],
    queryFn: async () => {
      if (!clean) throw new Error('Symbol is required');
      const res = await fetch(`/api/technical-analysis/${encodeURIComponent(clean)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to fetch technical analysis for ${clean}`);
      }
      return res.json();
    },
    enabled: Boolean(clean),
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
  });
}

// Utility styling helpers
export function getStageColor(stage: MarketStage): {
  badge: string;
  text: string;
  border: string;
  bg: string;
} {
  switch (stage) {
    case 'STAGE_2_MARKUP':
      return {
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        text: 'text-emerald-400',
        border: 'border-emerald-500/40',
        bg: 'from-emerald-950/30 to-slate-900/40',
      };
    case 'STAGE_4_MARKDOWN':
      return {
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        text: 'text-rose-400',
        border: 'border-rose-500/40',
        bg: 'from-rose-950/30 to-slate-900/40',
      };
    case 'STAGE_3_DISTRIBUTION':
      return {
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        text: 'text-amber-400',
        border: 'border-amber-500/40',
        bg: 'from-amber-950/30 to-slate-900/40',
      };
    case 'STAGE_1_ACCUMULATION':
    default:
      return {
        badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        text: 'text-cyan-400',
        border: 'border-cyan-500/40',
        bg: 'from-cyan-950/30 to-slate-900/40',
      };
  }
}

export function getTrendBadge(direction: TrendDirection): {
  color: string;
  label: string;
} {
  switch (direction) {
    case 'BULLISH':
      return { color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', label: 'Bullish' };
    case 'BEARISH':
      return { color: 'bg-rose-500/15 text-rose-300 border-rose-500/30', label: 'Bearish' };
    case 'NEUTRAL':
    default:
      return { color: 'bg-slate-500/15 text-slate-300 border-slate-500/30', label: 'Neutral' };
  }
}

export function getVerdictBadge(verdict: ActionableVerdict): {
  color: string;
  border: string;
} {
  switch (verdict) {
    case 'STRONG_BUY':
    case 'BUY_ON_PULLBACK':
      return {
        color: 'bg-emerald-500 text-slate-950 font-bold',
        border: 'border-emerald-500',
      };
    case 'TAKE_PROFIT':
    case 'TRIM_DEFENSIVE':
      return {
        color: 'bg-amber-500 text-slate-950 font-bold',
        border: 'border-amber-500',
      };
    case 'AVOID_BEARISH':
      return {
        color: 'bg-rose-500 text-white font-bold',
        border: 'border-rose-500',
      };
    case 'HOLD_TRAIL_STOPS':
    case 'NEUTRAL_WAIT':
    default:
      return {
        color: 'bg-blue-600 text-white font-bold',
        border: 'border-blue-500',
      };
  }
}
