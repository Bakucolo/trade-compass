import { useQuery } from '@tanstack/react-query';

const API_BASE = '/api';

export interface OptionContractRow {
  contractSymbol: string;
  strike: number;
  optionType: 'CALL' | 'PUT';
  expiration: string;
  dte: number;
  bid: number;
  ask: number;
  mid: number;
  lastPrice: number;
  change: number;
  percentChange: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number; // in percentage, e.g. 32.5
  inTheMoney: boolean;
  spread: number;
  spreadPercent: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface StrikeMatrixRow {
  strike: number;
  isAtm: boolean;
  isCallWall?: boolean;
  isPutWall?: boolean;
  isMaxPain?: boolean;
  isBigOi?: boolean;
  call?: OptionContractRow;
  put?: OptionContractRow;
}

export interface ExpirationMeta {
  date: string;
  dte: number;
  formattedDate: string;
  type: 'WEEKLY' | 'MONTHLY' | 'LEAP';
  totalCallOI?: number;
  totalPutOI?: number;
  totalOI?: number;
  isMonthlyOpex?: boolean;
}

export interface KeyOptionsLevels {
  maxPain: {
    strike: number;
    distanceDollars: number;
    distancePercent: number;
    pullDirection: 'BULLISH_PULL' | 'BEARISH_PULL' | 'PINNED';
    description: string;
  };
  callWall: {
    strike: number;
    openInterest: number;
    notionalDollars: number;
    distancePercent: number;
    role: 'PRIMARY_RESISTANCE';
    description: string;
  };
  putWall: {
    strike: number;
    openInterest: number;
    notionalDollars: number;
    distancePercent: number;
    role: 'PRIMARY_SUPPORT';
    description: string;
  };
  secondaryLevels: {
    callResistances: { strike: number; openInterest: number; notionalDollars: number; distancePercent: number }[];
    putSupports: { strike: number; openInterest: number; notionalDollars: number; distancePercent: number }[];
  };
  gammaFlip: {
    estimatedStrike: number;
    currentRegime: 'POSITIVE_GAMMA' | 'NEGATIVE_GAMMA';
    description: string;
  };
}

export interface BigOiStrike {
  strike: number;
  callOI: number;
  putOI: number;
  totalOI: number;
  notionalDollars: number;
  netBias: 'CALL_DOMINANT' | 'PUT_DOMINANT' | 'BALANCED';
  distancePercent: number;
  isCallWall: boolean;
  isPutWall: boolean;
  isMaxPain: boolean;
  isAtm: boolean;
}

export interface BigOiExpiration {
  date: string;
  formattedDate: string;
  dte: number;
  type: 'WEEKLY' | 'MONTHLY' | 'LEAP';
  totalCallOI: number;
  totalPutOI: number;
  totalOI: number;
  putCallOiRatio: number;
  maxPainStrike: number;
  isMonthlyOpex: boolean;
}

export interface UnderlyingDynamicsNarrative {
  headline: string;
  supportResistanceRange: string;
  pinningPressure: string;
  institutionalBias: string;
  tradingImplication: string;
}

export interface OptionsChainData {
  symbol: string;
  companyName: string;
  underlyingPrice: number;
  underlyingChange: number;
  underlyingChangePercent: number;
  selectedExpiration: string;
  selectedDte: number;
  expirations: ExpirationMeta[];
  strikes: StrikeMatrixRow[];
  
  analytics: {
    totalCallVolume: number;
    totalPutVolume: number;
    totalCallOpenInterest: number;
    totalPutOpenInterest: number;
    putCallVolumeRatio: number;
    putCallOiRatio: number;
    impliedVolatilityAtm: number;
    expectedMoveDollars: number;
    expectedMovePercent: number;
    maxPainStrike: number;
  };

  keyLevels: KeyOptionsLevels;
  bigOiStrikes: BigOiStrike[];
  bigOiExpirations: BigOiExpiration[];
  underlyingDynamics: UnderlyingDynamicsNarrative;
  
  fetchedAt: string;
}

export const fetchOptionsChain = async (
  symbol: string,
  expiration?: string
): Promise<OptionsChainData> => {
  const cleanSymbol = symbol.trim().toUpperCase();
  const url = expiration 
    ? `${API_BASE}/research/options-chain/${cleanSymbol}?date=${encodeURIComponent(expiration)}`
    : `${API_BASE}/research/options-chain/${cleanSymbol}`;

  const response = await fetch(url);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch options chain for ${cleanSymbol}`);
  }
  return response.json();
};

export const useOptionsChain = (symbol: string, expiration?: string, options?: { enabled?: boolean }) => {
  const cleanSymbol = (symbol || '').trim().toUpperCase();

  return useQuery<OptionsChainData>({
    queryKey: ['optionsChain', cleanSymbol, expiration || 'FRONT'],
    queryFn: () => fetchOptionsChain(cleanSymbol, expiration),
    enabled: Boolean(cleanSymbol && cleanSymbol.length > 0 && (options?.enabled ?? true)),
    retry: 1,
    staleTime: 45 * 1000 // 45 seconds cache
  });
};

export interface EquidistantStrikePair {
  targetDistancePercent: number;
  callStrike: number;
  callActualDistancePercent: number;
  callImpliedVol: number;
  callMidPrice: number;
  callDelta: number;
  callVolume: number;
  callOpenInterest: number;
  putStrike: number;
  putActualDistancePercent: number;
  putImpliedVol: number;
  putMidPrice: number;
  putDelta: number;
  putVolume: number;
  putOpenInterest: number;
  ivSkewDiff: number;
  ivRatio: number;
  priceRatio: number;
  isCallHigherIv: boolean;
  skewDescription: string;
}

export interface OptionsSkewMetrics {
  spotPrice: number;
  selectedExpiration: string;
  selectedDte: number;
  atmIv: number;
  delta25CallStrike: number;
  delta25CallIv: number;
  delta25PutStrike: number;
  delta25PutIv: number;
  delta25RiskReversal: number;
  delta10CallStrike: number;
  delta10CallIv: number;
  delta10PutStrike: number;
  delta10PutIv: number;
  delta10TailSkew: number;
  butterfly25Delta: number;
  averageIvSkewDiff: number;
  maxPainStrike: number;
  maxPainDistancePercent: number;
  callWallStrike: number;
  putWallStrike: number;
  putCallOiRatio: number;
  putCallVolumeRatio: number;
  arePutsAndCallsEquidistant: boolean;
  equidistanceVerdict: 'SYMMETRIC_EQUIDISTANT' | 'PUT_SKEWED_DOWNSIDE_HEAVY' | 'CALL_SKEWED_UPSIDE_HEAVY';
  isImplyingUpside: boolean;
  impliedDirectionalBias: 'STRONGLY_BULLISH_UPSIDE' | 'MODERATE_UPSIDE_TILT' | 'NEUTRAL_BALANCED' | 'BEARISH_DOWNSIDE_HEDGE';
  directionalConfidenceScore: number;
  skewRegime: 
    | 'STEEP_PUT_SKEW'
    | 'NORMAL_PUT_SKEW'
    | 'FLAT_SYMMETRIC'
    | 'CALL_SKEW_BULLISH_UPSIDE'
    | 'EXTREME_REVERSE_SKEW';
}

export interface OptimalSkewStrategy {
  strategyName: string;
  category: 'BULLISH' | 'NEUTRAL_INCOME' | 'HEDGE' | 'VOLATILITY';
  actionVerdict: string;
  rationale: string;
  suggestedSetup: string;
  skewEdge: string;
}

export interface OptionsSkewAgentResponse {
  symbol: string;
  companyName: string;
  timestamp: string;
  metrics: OptionsSkewMetrics;
  equidistantPairs: EquidistantStrikePair[];
  directAnswers: {
    arePutsAndCallsEquidistant: {
      answer: boolean;
      badgeText: string;
      headline: string;
      explanation: string;
    };
    areOptionsImplyingUpside: {
      answer: boolean;
      badgeText: string;
      headline: string;
      explanation: string;
    };
  };
  agentSynthesis: {
    executiveSummary: string;
    volatilitySmileAnalysis: string;
    institutionalTailRisk: string;
    optimalDerivativesStrategies: OptimalSkewStrategy[];
    catalystsAndRisks: string[];
    source: 'LLM_AGENT' | 'QUANTITATIVE_ENGINE';
  };
}

export const fetchOptionsSkewAnalysis = async (
  symbol: string,
  expiration?: string
): Promise<OptionsSkewAgentResponse> => {
  const cleanSymbol = symbol.trim().toUpperCase();
  const url = expiration 
    ? `${API_BASE}/research/options-chain/${cleanSymbol}/skew-agent?date=${encodeURIComponent(expiration)}`
    : `${API_BASE}/research/options-chain/${cleanSymbol}/skew-agent`;

  const response = await fetch(url);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to analyze options skew for ${cleanSymbol}`);
  }
  return response.json();
};

export const useOptionsSkewAnalysis = (
  symbol: string,
  expiration?: string,
  options?: { enabled?: boolean }
) => {
  const cleanSymbol = (symbol || '').trim().toUpperCase();

  return useQuery<OptionsSkewAgentResponse>({
    queryKey: ['optionsSkewAgent', cleanSymbol, expiration || 'FRONT'],
    queryFn: () => fetchOptionsSkewAnalysis(cleanSymbol, expiration),
    enabled: Boolean(cleanSymbol && cleanSymbol.length > 0 && (options?.enabled ?? true)),
    retry: 1,
    staleTime: 60 * 1000,
  });
};
