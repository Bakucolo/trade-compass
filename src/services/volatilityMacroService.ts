import { useQuery } from '@tanstack/react-query';

const API_BASE = '/api';

export type VolatilityRegimeType =
  | 'EXTREME_COMPLACENCY'
  | 'NORMAL_CONTANGO'
  | 'ELEVATED_VOLATILITY'
  | 'ACUTE_BACKWARDATION_PANIC'
  | 'HIGH_DISPERSION_STOCK_PICKER';

export type SignalSeverity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'INFO';

export interface VolatilityTradeSetup {
  id: string;
  strategyName: string;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL_INCOME' | 'LONG_VOLATILITY' | 'SHORT_VOLATILITY';
  targetAsset: string;
  rationale: string;
  tradeConstruction: string;
  entryTrigger: string;
  targetProfit: string;
  invalidationStop: string;
  historicalWinRate: string;
  optionLegs?: {
    action: 'BUY' | 'SELL';
    type: 'CALL' | 'PUT';
    strikeOffset: string;
    targetDte: number;
  }[];
}

export interface VolatilitySignal {
  id: string;
  code: string;
  title: string;
  severity: SignalSeverity;
  metric: string;
  currentValue: string;
  threshold: string;
  description: string;
  implication: string;
  recommendedTrade: VolatilityTradeSetup;
  triggeredAt: string;
}

export interface TermStructurePoint {
  tenor: string;
  label: string;
  dte: number;
  value: number;
  change: number;
}

export interface VolatilityMacroData {
  regime: {
    type: VolatilityRegimeType;
    label: string;
    badgeColor: 'emerald' | 'cyan' | 'amber' | 'orange' | 'rose';
    summary: string;
    tacticalPosture: string;
  };

  spotMetrics: {
    vix: { current: number; change: number; changePercent: number; percentile52w: number; dayLow: number; dayHigh: number };
    vvix: { current: number; change: number; changePercent: number; levelLabel: string };
    skew: { current: number; change: number; changePercent: number; percentile52w: number; riskLabel: string };
    impliedCorrelation: { current: number; change: number; regimeLabel: string };
    volatilityRiskPremium: { iv30: number; rv20: number; vrpSpread: number; edgeLabel: string };
  };

  termStructure: {
    slopePercent: number;
    structureType: 'CONTANGO' | 'BACKWARDATION' | 'FLAT';
    vx1FrontMonth: number;
    vx2SecondMonth: number;
    points: TermStructurePoint[];
    rollYieldAnnualized: number;
  };

  dispersion: {
    stockDispersionScore: number;
    topSectorDispersion: { sector: string; iv: number; spreadVsSpy: number }[];
    correlationRegime: 'VERY_LOW_DISPERSION_BENEFIT' | 'NORMAL' | 'HIGH_SYSTEMIC_CORRELATION';
  };

  activeSignals: VolatilitySignal[];
  hasExtremeSignals: boolean;
  extremeSignalsCount: number;

  analyzedAt: string;
}

export const fetchVolatilityIntelligence = async (): Promise<VolatilityMacroData> => {
  const response = await fetch(`${API_BASE}/macro/volatility-intelligence`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch volatility intelligence');
  }
  return response.json();
};

export const useVolatilityIntelligence = () => {
  return useQuery<VolatilityMacroData>({
    queryKey: ['macroVolatilityIntelligence'],
    queryFn: fetchVolatilityIntelligence,
    refetchInterval: 30 * 1000, // 30s live polling
    staleTime: 25 * 1000
  });
};
