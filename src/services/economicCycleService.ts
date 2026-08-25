import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type CycleStage = 'EARLY_CYCLE' | 'MID_CYCLE' | 'LATE_CYCLE' | 'RECESSION' | 'STAGFLATION';

export interface MacroIndicatorSignal {
  id: string;
  name: string;
  currentValue: number;
  unit: string;
  formattedValue: string;
  historicalBenchmark: string;
  cycleImplication: string;
  status: 'SUPPORTIVE' | 'CAUTION' | 'STRICT' | 'NEUTRAL';
}

export interface AssetPlaybookItem {
  assetClass: string;
  name: string;
  tickerExample?: string;
  stance: 'OVERWEIGHT' | 'UNDERWEIGHT' | 'NEUTRAL';
  impact: 'BENEFIT' | 'LOSE' | 'NEUTRAL';
  expectedBehavior: string;
  rationale: string;
  historicalWinRatePercent: number;
}

export interface SectorPlaybookItem {
  sector: string;
  symbol: string;
  stance: 'OVERWEIGHT' | 'UNDERWEIGHT' | 'NEUTRAL';
  impact: 'BENEFIT' | 'LOSE' | 'NEUTRAL';
  performanceTrend: string;
  catalyst: string;
  rationale: string;
  topIndustries: string[];
}

export interface IndustryPlaybookItem {
  industry: string;
  sector: string;
  impact: 'BENEFIT' | 'LOSE';
  tailwindsOrHeadwinds: string;
  representativeTickers: string[];
  keyDriver: string;
}

export interface EconomicCycleDiagnosis {
  stage: CycleStage;
  stageName: string;
  stageSubtitle: string;
  confidenceScore: number; // 0 - 100
  regimeTone: 'bullish' | 'bearish' | 'warning' | 'neutral';
  cycleProgressPercent: number;

  executiveSummary: string;
  macroThesis: string;

  signals: MacroIndicatorSignal[];

  assets: {
    benefiting: AssetPlaybookItem[];
    losing: AssetPlaybookItem[];
  };
  sectors: {
    benefiting: SectorPlaybookItem[];
    losing: SectorPlaybookItem[];
  };
  industries: {
    benefiting: IndustryPlaybookItem[];
    losing: IndustryPlaybookItem[];
  };

  transitionTriggers: string[];
  watchpointMetrics: { metric: string; pivotThreshold: string; significance: string }[];
  generatedAt: string;
}

export interface MacroStockPick {
  id: string;
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  currentPrice: number;
  stance: 'STRONG_BUY' | 'TACTICAL_LONG' | 'INCOME_ACCUMULATOR' | 'DEFENSIVE_HOLD' | 'TACTICAL_HEDGE';
  sentiment: 'BULLISH' | 'BEARISH';
  confidenceScore: number;

  entryPrice: number;
  entryZoneMin: number;
  entryZoneMax: number;
  targetPrice: number;
  stopLoss: number;
  riskRewardRatio: string;
  potentialROI: number;

  macroCatalystThesis: string;
  cycleAlignmentRationale: string;
  keyRisks: string[];
  timeframe: 'SWING' | 'POSITION' | 'LONG_TERM';
}

export interface MacroStockAgentResponse {
  cycleStage: CycleStage;
  stageName: string;
  themeOverview: string;
  picks: MacroStockPick[];
  generatedAt: string;
}

const API_BASE = '/api/macro';

// Fetch current Economic Cycle Diagnosis & Playbooks
export async function fetchEconomicCycleDiagnosis(): Promise<EconomicCycleDiagnosis> {
  const res = await fetch(`${API_BASE}/economic-cycle`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch economic cycle diagnosis');
  }
  return res.json();
}

// Trigger AI Macro Stock Selection Agent
export async function generateMacroStockPicks(customPrompt?: string): Promise<MacroStockAgentResponse> {
  const res = await fetch(`${API_BASE}/stock-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customPrompt }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Macro stock selection agent failed');
  }
  return res.json();
}

// React Query Hooks
export function useEconomicCycle() {
  return useQuery<EconomicCycleDiagnosis>({
    queryKey: ['economicCycleDiagnosis'],
    queryFn: fetchEconomicCycleDiagnosis,
    staleTime: 60 * 1000,
    refetchInterval: 120 * 1000,
  });
}

export function useGenerateMacroStockPicks() {
  const queryClient = useQueryClient();

  return useMutation<MacroStockAgentResponse, Error, string | undefined>({
    mutationFn: (customPrompt) => generateMacroStockPicks(customPrompt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['macroStockPicks'] });
    },
  });
}
