import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type DipDriverClassification =
  | 'VOLATILITY_DRIVEN'
  | 'FUNDAMENTAL_IMPAIRMENT'
  | 'MACRO_SECTOR_ROTATION'
  | 'OVERREACTION_OPPORTUNITY';

export type DipOpportunityVerdict =
  | 'STRONG_BUY_DIP'
  | 'ACCUMULATE_PULLBACK'
  | 'HOLD_WAIT_FOR_BASE'
  | 'AVOID_FALLING_KNIFE'
  | 'TRIM_DEFENSIVE';

export interface SavedReportMeta {
  id: string;
  verdict: DipOpportunityVerdict;
  opportunityScore: number;
  fundamentalHealthScore?: number;
  classification: DipDriverClassification;
  analyzedAt: string;
}

export interface BuyScoreBreakdown {
  totalScore: number;
  valuationScore: number;
  fundamentalScore: number;
  technicalScore: number;
  driverScore: number;
  portfolioFitScore: number;
  targetUpsidePercent: number | null;
  targetPrice: number | null;
  forwardPE: number | null;
  trailingPE: number | null;
  pegRatio: number | null;
  freeCashflow: number | null;
  debtToEquity: number | null;
  operatingMargins: number | null;
  valuationGrade: 'UNDERVALUED' | 'FAIR_VALUE' | 'PREMIUM';
  fundamentalGrade: 'PRISTINE' | 'SOLID' | 'SPECULATIVE';
  technicalSetup: '50D_UPTREND_DIP' | 'OVERSOLD_REBOUND' | 'DEEP_VALUE_SUPPORT' | 'MOMENTUM_BREAK';
  analystRating: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'N/A';
  highlightBadges: string[];
}

export interface DipCandidateItem {
  symbol: string;
  name: string;
  currentPrice: number;
  dayChange: number;
  dayChangePercent: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  distanceFrom52WHigh: number;
  volume: number;
  avgVolume: number;
  volumeMultiplier: number;
  sector?: string;
  industry?: string;
  source: 'HOLDING' | 'WATCHLIST' | 'IDEA';
  sourceDetails?: string;
  holdingPosition?: {
    quantity: number;
    averageCost: number;
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
    currency: string;
  };
  heuristicSignal: {
    relativeDropVsMarket: number;
    potentialDriver: 'LIKELY_VOLATILITY' | 'LIKELY_FUNDAMENTAL' | 'MARKET_WIDE_CORRECTION';
    preliminaryOpportunityScore: number;
  };
  scoreBreakdown?: BuyScoreBreakdown;
  savedReportInfo?: SavedReportMeta;
}

export interface BenchmarkContext {
  spy: { price: number; changePercent: number };
  qqq: { price: number; changePercent: number };
  vix: { price: number; changePercent: number };
  marketSentiment: 'RISK_ON' | 'NEUTRAL' | 'RISK_OFF' | 'PANIC_VOLATILITY';
}

export interface DipRadarScanResult {
  scanTimestamp: string;
  totalScanned: number;
  dipsCount: number;
  benchmarks: BenchmarkContext;
  dips: DipCandidateItem[];
}

export interface NewsArticleItem {
  title: string;
  publisher: string;
  link: string;
  publishTime?: string;
}

export interface ValuationMetricsSnapshot {
  trailingPE: number | null;
  forwardPE: number | null;
  priceToSales: number | null;
  pegRatio: number | null;
  enterpriseToEbitda: number | null;
  operatingMarginPercent: number | null;
  freeCashflow: number | null;
  debtToEquity: number | null;
  returnOnEquityPercent: number | null;
  beta: number | null;
  shortPercentOfFloat: number | null;
}

export interface DipDiagnosticResult {
  symbol: string;
  companyName: string;
  currentPrice: number;
  dayChangePercent: number;
  distanceFrom52WHigh: number;
  analyzedAt: string;
  classification: DipDriverClassification;
  verdict: DipOpportunityVerdict;
  opportunityScore: number;
  fundamentalHealthScore: number;
  volatilityFactorPercent: number;
  fundamentalFactorPercent: number;
  primaryDriverSummary: string;
  executiveDiagnosis: string;
  fundamentalAnalysis: {
    isBusinessThesisIntact: boolean;
    balanceSheetStrength: 'ROBUST' | 'MODERATE' | 'VULNERABLE';
    earningsQuality: 'STRONG' | 'MIXED' | 'WEAK_DOWNGRADED';
    details: string;
  };
  volatilityAnalysis: {
    marketBetaImpact: string;
    sectorRotationContext: string;
    gammaOrLiquidityPressure: string;
    details: string;
  };
  valuationAssessment: {
    currentDiscountVs52WHigh: string;
    historicalValuationContext: string;
    isUndervalued: boolean;
    summary: string;
  };
  tacticalActionPlan: {
    recommendedEntryZone: string;
    dcaStrategy: string;
    optionsStrategy: string;
    stopLossOrInvalidation: string;
    timeHorizon: 'IMMEDIATE_1_2W' | 'SWING_1_3M' | 'LONG_TERM_6M_PLUS';
  };
  keyRiskFactors: string[];
  upsideCatalysts: string[];
  recentNewsHeadlines: NewsArticleItem[];
  valuationMetrics: ValuationMetricsSnapshot;
  benchmarks: BenchmarkContext;
  portfolioContext?: {
    isCurrentlyHeld: boolean;
    quantity?: number;
    averageCost?: number;
    unrealizedPLPercent?: number;
    marketValue?: number;
    suggestedPortfolioAction?: string;
  };
  isSavedReport?: boolean;
  savedReportId?: string;
  savedAt?: string;
}

export interface SavedDipReportRecord {
  id: string;
  symbol: string;
  companyName: string;
  currentPrice: number;
  dayChangePercent: number;
  distanceFrom52WHigh: number;
  classification: DipDriverClassification;
  verdict: DipOpportunityVerdict;
  opportunityScore: number;
  fundamentalHealthScore: number;
  volatilityFactorPercent: number;
  fundamentalFactorPercent: number;
  primaryDriverSummary: string;
  executiveDiagnosis: string;
  targetEntryZone?: string | null;
  dcaStrategy?: string | null;
  optionsStrategy?: string | null;
  stopLossOrInvalidation?: string | null;
  timeHorizon?: string | null;
  contentJson: string;
  createdAt: string;
  updatedAt: string;
}

const API_BASE = '/api/market';

/**
 * Fetch Dip Radar scan of holdings and watchlists
 */
export async function fetchDipRadar(options?: {
  minDayDrop?: number;
  minDrawdown?: number;
}): Promise<DipRadarScanResult> {
  const params = new URLSearchParams();
  if (options?.minDayDrop !== undefined) params.append('minDayDrop', String(options.minDayDrop));
  if (options?.minDrawdown !== undefined) params.append('minDrawdown', String(options.minDrawdown));

  const url = `${API_BASE}/dips-radar${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to scan dips radar');
  }
  return res.json();
}

/**
 * React Query Hook for Dip Radar
 */
export function useDipRadar(options?: {
  minDayDrop?: number;
  minDrawdown?: number;
  enabled?: boolean;
}) {
  return useQuery<DipRadarScanResult>({
    queryKey: ['market-dips-radar', options?.minDayDrop, options?.minDrawdown],
    queryFn: () => fetchDipRadar(options),
    enabled: options?.enabled !== false,
    staleTime: 45 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Fetch or run AI Diagnosis for a symbol
 */
export async function fetchDiagnoseDip(
  symbol: string,
  forceRefresh = false
): Promise<DipDiagnosticResult> {
  const res = await fetch(`${API_BASE}/diagnose-dip/${encodeURIComponent(symbol)}${forceRefresh ? '?force=true' : ''}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to diagnose dip for ${symbol}`);
  }
  return res.json();
}

/**
 * React Query Hook for diagnosing a single symbol
 */
export function useDiagnoseDip(symbol?: string, enabled = true, forceRefresh = false) {
  return useQuery<DipDiagnosticResult>({
    queryKey: ['dip-diagnostic', symbol?.toUpperCase(), forceRefresh],
    queryFn: () => fetchDiagnoseDip(symbol!, forceRefresh),
    enabled: Boolean(symbol && enabled),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch list of all saved diagnostic reports from database
 */
export async function fetchSavedDipReports(limit = 50): Promise<SavedDipReportRecord[]> {
  const res = await fetch(`${API_BASE}/saved-dips?limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch saved reports');
  }
  return res.json();
}

export function useSavedDipReports(limit = 50) {
  return useQuery<SavedDipReportRecord[]>({
    queryKey: ['saved-dip-reports', limit],
    queryFn: () => fetchSavedDipReports(limit),
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch diagnostic history for a specific symbol
 */
export async function fetchDipReportHistory(symbol: string, limit = 10): Promise<SavedDipReportRecord[]> {
  const res = await fetch(`${API_BASE}/saved-dips/${encodeURIComponent(symbol)}/history?limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch history for ${symbol}`);
  }
  return res.json();
}

export function useDipReportHistory(symbol?: string, enabled = true) {
  return useQuery<SavedDipReportRecord[]>({
    queryKey: ['dip-report-history', symbol?.toUpperCase()],
    queryFn: () => fetchDipReportHistory(symbol!),
    enabled: Boolean(symbol && enabled),
    staleTime: 30 * 1000,
  });
}

/**
 * Delete a saved diagnostic report by ID
 */
export async function deleteSavedDipReport(id: string): Promise<{ success: boolean; id: string }> {
  const res = await fetch(`${API_BASE}/saved-dips/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete report');
  }
  return res.json();
}

export function useDeleteSavedDipReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSavedDipReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-dip-reports'] });
      queryClient.invalidateQueries({ queryKey: ['dip-report-history'] });
      queryClient.invalidateQueries({ queryKey: ['market-dips-radar'] });
    },
  });
}
