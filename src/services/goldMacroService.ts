import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface MetricMetadata {
  source: 'FRED' | 'NY_FED' | 'TREASURY_FISCAL_DATA' | 'CFTC' | 'MARKET';
  seriesId: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  units: string;
  lastObservationDate: string;
  dataAgeDays: number;
  isStale: boolean;
  stalenessWarning?: string;
}

export interface IndicatorTelemetry {
  id: string;
  name: string;
  currentValue: number;
  prevValue: number;
  change1M: number;
  change3M: number;
  change12M: number;
  percentile5Y: number;
  percentile10Y: number;
  zScore5Y: number;
  trend: 'strongly_rising' | 'rising' | 'neutral' | 'falling' | 'strongly_falling';
  normalizedPillarScore: number;
  metadata: MetricMetadata;
}

export interface PillarBreakdown {
  id: 'real_rates' | 'usd' | 'inflation_stagflation' | 'fiscal_treasury' | 'liquidity_conditions' | 'gold_positioning';
  name: string;
  weight: number;
  effectiveWeight: number;
  rawScore: number;
  contribution: number;
  stance: 'STRONG_HEADWIND' | 'MODERATE_HEADWIND' | 'NEUTRAL_MIXED' | 'MODERATE_TAILWIND' | 'STRONG_TAILWIND';
  keyVariables: string[];
  summary: string;
  metrics: IndicatorTelemetry[];
}

export type StructuralRegime = 'STRONGLY_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'STRONGLY_BULLISH';
export type TacticalPressure = 'STRONG_HEADWIND' | 'MODERATE_HEADWIND' | 'MIXED_NEUTRAL' | 'MODERATE_TAILWIND' | 'STRONG_TAILWIND';
export type FiscalPressureCategory = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'EXTREME';
export type StagflationPressureCategory = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'EXTREME';

export interface SignalConflict {
  hasConflict: boolean;
  bullishFactors: string[];
  bearishFactors: string[];
  interpretation: string;
}

export interface MindChangerItem {
  direction: 'BULLISH' | 'BEARISH';
  condition: string;
  targetMetric: string;
  currentValue: string;
  triggerThreshold: string;
  economicRationale: string;
}

export interface LocalMacroAlert {
  id: string;
  severity: 'INFO' | 'WARNING' | 'ALERT';
  title: string;
  message: string;
  date: string;
}

export interface GoldMacroRegimeSnapshot {
  timestamp: string;
  goldPrice: {
    current: number;
    change1D: number;
    changePercent1D: number;
    change1M: number;
    change3M: number;
    change12M: number;
    symbol: string;
    source: string;
    lastUpdated: string;
  };
  goldMacroScore: number; // 0 to 100
  confidenceScore: number; // 0 to 100%

  structuralRegime: StructuralRegime;
  structuralRegimeLabel: string;
  tacticalPressure: TacticalPressure;
  tacticalPressureScore: number;
  tacticalPressureLabel: string;
  fiscalPressureScore: number;
  fiscalPressureCategory: FiscalPressureCategory;
  stagflationPressureScore: number;
  stagflationPressureCategory: StagflationPressureCategory;

  pillars: PillarBreakdown[];

  whyUnderPressureOrSupported: string;
  whatIsHurtingGold: { title: string; detail: string; impactBpsOrPct?: string }[];
  whatIsSupportingGold: { title: string; detail: string; impactBpsOrPct?: string }[];
  signalConflict: SignalConflict;
  whatWouldChangeMyMind: MindChangerItem[];

  fiscalTelemetry: {
    debtToPennyTrillions: number;
    debtObservationDate: string;
    recentAuctions: {
      date: string;
      term: string;
      bidToCover: number;
      highYield: number;
      totalAcceptedBillions: number;
      demandQuality: 'STRONG' | 'AVERAGE' | 'SOFT' | 'TAILING';
    }[];
    termPremium10Y: number;
    termPremium3MChange: number;
    termPremiumPercentile: number;
  };

  alerts: LocalMacroAlert[];

  aiNarrative?: {
    enabled: boolean;
    generatedAt?: string;
    cached: boolean;
    whatChanged?: string;
    whatMattersMost?: string;
    conflictingSignalsExplanation?: string;
    regimePivotAnalysis?: string;
  };
}

export interface HistoricalRegimePoint {
  date: string;
  formattedDate: string;
  goldPrice: number;
  goldMacroScore: number;
  realRatesScore: number;
  usdScore: number;
  inflationScore: number;
  fiscalScore: number;
  liquidityScore: number;
  structuralRegime: StructuralRegime;
}

export interface BacktestConditionResult {
  conditionName: string;
  description: string;
  sampleSize: number;
  avgReturn1M: number;
  avgReturn3M: number;
  avgReturn6M: number;
  avgReturn12M: number;
  winRate1M: number;
  winRate3M: number;
  winRate6M: number;
  winRate12M: number;
}

export interface GoldMacroBacktestReport {
  generatedAt: string;
  startDate: string;
  endDate: string;
  totalTradingDays: number;
  conditions: BacktestConditionResult[];
}

// ==========================================
// API CLIENT FUNCTIONS
// ==========================================

const API_BASE = '/api/macro/gold-regime';

export async function fetchGoldMacroRegime(): Promise<GoldMacroRegimeSnapshot> {
  const res = await fetch(`${API_BASE}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch Gold Macro Regime data');
  }
  return res.json();
}

export async function fetchGoldMacroHistory(timeframe: '1Y' | '3Y' | '5Y' | '10Y' | 'MAX' = '5Y'): Promise<HistoricalRegimePoint[]> {
  const res = await fetch(`${API_BASE}/history?timeframe=${timeframe}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch historical gold regime data');
  }
  return res.json();
}

export async function fetchGoldMacroBacktest(): Promise<GoldMacroBacktestReport> {
  const res = await fetch(`${API_BASE}/backtest`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch gold regime backtest');
  }
  return res.json();
}

export async function requestGoldMacroAiNarrative(forceRefresh = false): Promise<{
  whatChanged: string;
  whatMattersMost: string;
  conflictingSignalsExplanation: string;
  regimePivotAnalysis: string;
}> {
  const res = await fetch(`${API_BASE}/ai-narrative`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forceRefresh })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate AI narrative explanation');
  }
  return res.json();
}

// ==========================================
// REACT QUERY HOOKS
// ==========================================

export function useGoldMacroRegime() {
  return useQuery<GoldMacroRegimeSnapshot>({
    queryKey: ['goldMacroRegime'],
    queryFn: fetchGoldMacroRegime,
    staleTime: 60 * 1000,
    refetchInterval: 120 * 1000
  });
}

export function useGoldMacroHistory(timeframe: '1Y' | '3Y' | '5Y' | '10Y' | 'MAX' = '5Y') {
  return useQuery<HistoricalRegimePoint[]>({
    queryKey: ['goldMacroHistory', timeframe],
    queryFn: () => fetchGoldMacroHistory(timeframe),
    staleTime: 5 * 60 * 1000
  });
}

export function useGoldMacroBacktest() {
  return useQuery<GoldMacroBacktestReport>({
    queryKey: ['goldMacroBacktest'],
    queryFn: fetchGoldMacroBacktest,
    staleTime: 10 * 60 * 1000
  });
}

export function useGenerateGoldMacroAiNarrative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (forceRefresh?: boolean) => requestGoldMacroAiNarrative(Boolean(forceRefresh)),
    onSuccess: (data) => {
      queryClient.setQueryData(['goldMacroRegime'], (old: GoldMacroRegimeSnapshot | undefined) => {
        if (!old) return old;
        return {
          ...old,
          aiNarrative: {
            ...old.aiNarrative,
            enabled: true,
            cached: true,
            generatedAt: new Date().toISOString(),
            ...data
          }
        };
      });
    }
  });
}
