import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type ConvictionGrade = 'STRONG_BUY' | 'BUY_ACCUMULATE' | 'HOLD_MONITOR' | 'TRIM_DEFENSIVE' | 'AVOID_HIGH_RISK';
export type HealthStatus = 'PRISTINE' | 'STABLE' | 'MODERATE_DEBT' | 'HIGH_LEVERAGE' | 'DISTRESSED';
export type ValuationPosture = 'DEEP_VALUE' | 'FAIR_VALUE' | 'RICHLY_VALUED' | 'SPECULATIVE_BUBBLE';

export interface ScorecardSubMetrics {
  priceTo52WeekHighPct: number;
  distanceFrom52WeekLowPct: number;
  technicalSetupScore: number;
  momentumScore: number;
  upsideToFairValuePct: number;
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  roePct: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  fcfYieldPct: number | null;
  revenueGrowthPct: number | null;
  piotroskiFScoreEstimate: number;
  altmanZScoreEstimate: number;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToSales: number | null;
  pegRatio: number | null;
  evToEbitda: number | null;
  fairValueEstimate: number;
}

export interface StockScorecard {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  sector: string;
  industry: string;
  marketCap: number;
  beta: number;

  // Composite 1 to 10 Scores
  overallScore: number; // 1.0 - 10.0
  rank?: number; // Relative rank among universe #1 to #N
  grade: ConvictionGrade;
  gradeLabel: string;
  
  buyingConvictionScore: number; // 1.0 - 10.0
  fundamentalsScore: number; // 1.0 - 10.0
  valuationScore: number; // 1.0 - 10.0
  momentumScore: number; // 1.0 - 10.0
  healthStatus: HealthStatus;
  valuationPosture: ValuationPosture;

  metrics: ScorecardSubMetrics;

  tacticalAction: string;
  suggestedBuyZone: { min: number; max: number };
  targetPrice: number;
  stopLossAnchor: number;
  recommendedMaxAllocationPct: number;

  // Qualitative Analysis & Narratives
  scoreJustification: string;
  fundamentalSituation: string;
  keyStrengths: string[];
  keyRisks: string[];
  bullCase: string;
  bearCase: string;

  isHolding: boolean;
  holdingDetails?: {
    quantity: number;
    averageCost: number;
    marketValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    broker: string;
    brokers?: string[];
  };
  brokers?: string[]; // e.g. ["Interactive Brokers", "Trading 212"]
  isWatchlist: boolean;
  watchlistNames?: string[]; // e.g. ["Space", "Nuclear Energy, SMRs & Clean Grid"]

  analyzedAt: string;
}

export interface ScorecardsHubResponse {
  scorecards: StockScorecard[];
  summary: {
    totalEvaluated: number;
    holdingsCount: number;
    watchlistCount: number;
    avgOverallScore: number;
    avgHoldingsScore: number;
    avgWatchlistScore: number;
    topConvictionPick: StockScorecard | null;
    topValuePick: StockScorecard | null;
    topQualityPick: StockScorecard | null;
  };
  sectors: string[];
  brokers?: { name: string; count: number }[];
  watchlists?: { name: string; count: number }[];
  timestamp: number;
}

export interface ScorecardComparisonResponse {
  candidates: StockScorecard[];
  winners: {
    overall: string;
    buyingConviction: string;
    fundamentals: string;
    valuation: string;
    marginOfSafety: string;
  };
  keyTakeaways: string[];
}

export type WorkerStatusType = 'IDLE' | 'RUNNING' | 'PAUSED' | 'PAUSED_QUOTA_EXHAUSTED' | 'COMPLETED';

export interface ScorecardWorkerState {
  status: WorkerStatusType;
  total: number;
  current: number;
  currentSymbol: string | null;
  percent: number;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
  quotaMessage: string | null;
  pendingSymbols: string[];
  completedSymbols: string[];
  analyzedCount: number;
}

export interface EarningsQuarterComparison {
  quarter: string;
  epsActual: number | null;
  epsEstimate: number | null;
  epsSurprisePct: number | null;
  revenue: number | null;
  earnings: number | null;
}

export interface LatestEarningsAnalysisResult {
  symbol: string;
  companyName: string;
  currentPrice: number;
  reportDate: string | null;
  timing: 'BMO' | 'AMC' | 'UNSPECIFIED';
  isBeat: boolean;
  verdict: 'STRONG_BEAT' | 'MODEST_BEAT' | 'IN_LINE' | 'MODEST_MISS' | 'BIG_MISS';
  verdictLabel: string;
  quarters: EarningsQuarterComparison[];
  executiveDiagnosis: string;
  guidanceCommentary: string;
  scorecardImpact: {
    recommendedScoreAdjustment: number;
    fairValueAdjustmentPct: number;
    analystSummary: string;
  };
  keyFocusPoints: string[];
  analyzedAt: string;
}

/**
 * Fetch persisted scorecards from database.
 * Does NOT poll automatically on a timer to avoid API throttling.
 */
export function useScorecards() {
  return useQuery<ScorecardsHubResponse>({
    queryKey: ['scorecardsHub'],
    queryFn: async () => {
      const res = await fetch('/api/scorecards');
      if (!res.ok) {
        throw new Error('Failed to fetch scorecards hub data');
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: false, // Do NOT auto-poll
    refetchOnWindowFocus: false,
  });
}

/**
 * Single stock scorecard query
 */
export function useStockScorecard(symbol: string | null) {
  return useQuery<StockScorecard>({
    queryKey: ['stockScorecard', symbol?.toUpperCase()],
    queryFn: async () => {
      if (!symbol) throw new Error('Symbol required');
      const res = await fetch(`/api/scorecards/${encodeURIComponent(symbol.toUpperCase())}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch scorecard for ${symbol}`);
      }
      return res.json();
    },
    enabled: Boolean(symbol && symbol.trim().length > 0),
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
  });
}

/**
 * Head-to-head comparison
 */
export function useScorecardComparison() {
  return useMutation<ScorecardComparisonResponse, Error, string[]>({
    mutationFn: async (symbols: string[]) => {
      const res = await fetch('/api/scorecards/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols }),
      });
      if (!res.ok) {
        throw new Error('Failed to compare stock scorecards');
      }
      return res.json();
    },
  });
}

/**
 * Poll background scorecard worker status
 */
export function useScorecardsWorkerStatus() {
  return useQuery<ScorecardWorkerState>({
    queryKey: ['scorecardsWorkerStatus'],
    queryFn: async () => {
      const res = await fetch('/api/scorecards/worker/status');
      if (!res.ok) {
        throw new Error('Failed to fetch scorecard worker status');
      }
      return res.json();
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'RUNNING' ? 1500 : 8000;
    },
  });
}

/**
 * Start or force restart sequential queue worker
 */
export function useStartScorecardsWorker() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; message: string; status: ScorecardWorkerState }, Error, { forceRefresh?: boolean } | void>({
    mutationFn: async (opts) => {
      const res = await fetch('/api/scorecards/worker/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts || {}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to start scorecard worker');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorecardsWorkerStatus'] });
    },
  });
}

/**
 * Pause sequential queue worker
 */
export function usePauseScorecardsWorker() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; status: ScorecardWorkerState }, Error, void>({
    mutationFn: async () => {
      const res = await fetch('/api/scorecards/worker/pause', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to pause worker');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorecardsWorkerStatus'] });
      queryClient.invalidateQueries({ queryKey: ['scorecardsHub'] });
    },
  });
}

/**
 * Resume paused sequential queue worker
 */
export function useResumeScorecardsWorker() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; message: string; status: ScorecardWorkerState }, Error, void>({
    mutationFn: async () => {
      const res = await fetch('/api/scorecards/worker/resume', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to resume worker');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorecardsWorkerStatus'] });
    },
  });
}

/**
 * Refresh a single stock on demand
 */
export function useRefreshSingleStockScorecard() {
  const queryClient = useQueryClient();
  return useMutation<StockScorecard, Error, string>({
    mutationFn: async (symbol: string) => {
      const res = await fetch(`/api/scorecards/refresh/${encodeURIComponent(symbol.toUpperCase())}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to refresh scorecard for ${symbol}`);
      }
      return res.json();
    },
    onSuccess: (updatedCard) => {
      queryClient.invalidateQueries({ queryKey: ['scorecardsHub'] });
      queryClient.invalidateQueries({ queryKey: ['stockScorecard', updatedCard.symbol] });
    },
  });
}

/**
 * Analyze latest quarterly earnings using AI Agent
 */
export function useAnalyzeLatestEarnings() {
  return useMutation<LatestEarningsAnalysisResult, Error, string>({
    mutationFn: async (symbol: string) => {
      const res = await fetch(`/api/scorecards/analyze-earnings/${encodeURIComponent(symbol.toUpperCase())}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to analyze earnings for ${symbol}`);
      }
      return res.json();
    },
  });
}
