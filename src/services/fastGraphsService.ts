import { useQuery } from '@tanstack/react-query';

export type FastGraphsMetricType =
  | 'ADJUSTED_EARNINGS'
  | 'BASIC_EARNINGS'
  | 'OPERATING_CASH_FLOW'
  | 'FREE_CASH_FLOW'
  | 'SALES'
  | 'EBITDA';

export type FastGraphsTimeframe = 'MAX' | '10Y' | '6Y' | '5Y' | '4Y' | '3Y' | '2Y' | '1Y';

export interface FastGraphsDataPoint {
  date: string;
  displayDate: string;
  fiscalYear: string;
  fiscalYearLabel: string;
  price: number | null;
  metricValue: number;
  fairValuePrice: number;
  normalPrice: number;
  dividend: number | null;
  isEstimate: boolean;
  isCurrentYearBoundary?: boolean;
  yoyGrowth: number | null;
}

export interface BottomDataStripItem {
  fyDate: string;
  metricValue: string;
  chgYr: string;
  chgYrNum: number | null;
  div: string;
  isEstimate: boolean;
  date: string;
}

export interface FastFacts {
  previousClose: number;
  blendedPe: number;
  epsYield: number;
  divYield: number;
  type: string;
  lttmDividend?: number;
}

export interface GraphKey {
  metricName: string;
  growthRate: number;
  fairValueRatio: number;
  fairValueFormula: 'P/E = G (Peter Lynch)' | 'GDF (Graham-Dodd)' | 'P/E = 15.0 (Standard)';
  normalPeRatio: number;
  customRatio?: number;
}

export interface DividendTrends {
  hasDividends: boolean;
  dividendCagr: number | null;
  avgDivGrowth: number | null;
  normalYield: number | null;
  consecutiveIncreases: number;
  consecutivePaid: number;
}

export interface CompanyInfo {
  companyName: string;
  ticker: string;
  gicsSubIndustry: string;
  country: string;
  marketCap: number;
  marketCapFormatted: string;
  spCreditRating: string;
  ltDebtToCapital: number;
  tev: number;
  tevFormatted: string;
  fgScore: number;
}

export interface AnalystScorecardHorizon {
  beatPct: number;
  hitPct: number;
  missPct: number;
}

export interface AnalystScorecard {
  oneYearForward: AnalystScorecardHorizon;
  twoYearForward: AnalystScorecardHorizon;
}

export interface FastGraphsResponse {
  symbol: string;
  companyName: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  lastCloseDate: string;
  metric: FastGraphsMetricType;
  metricLabel: string;
  timeframe: FastGraphsTimeframe;
  series: FastGraphsDataPoint[];
  bottomStrip: BottomDataStripItem[];
  fastFacts: FastFacts;
  graphKey: GraphKey;
  dividendTrends: DividendTrends;
  companyInfo: CompanyInfo;
  analystScorecard: AnalystScorecard;
}

export interface RateOfReturnResult {
  startDate: string;
  startDisplayDate: string;
  endDate: string;
  endDisplayDate: string;
  invested: number;
  startPrice: number;
  endPrice: number;
  shares: number;
  startPe: number | null;
  endPe: number | null;
  marketValue: number;
  marketValueChange: number;
  totalReturnPct: number;
  annualizedCagrPct: number;
  startMetricValue: number;
  endMetricValue: number;
  metricCagrPct: number | null;
  fairValueMultiple: number;
  fairValueEndPrice: number;
  vsFairValuePct: number;
  normalPeMultiple: number;
  normalPeEndPrice: number;
  vsNormalPePct: number;
  durationDays: number;
}

/**
 * Point-to-Point Rate of Return and Fundamental CAGR calculation
 */
export function calculatePointToPointReturn(
  startPoint: FastGraphsDataPoint,
  endPoint: FastGraphsDataPoint,
  graphKey: GraphKey,
  investedAmount: number = 10000.0
): RateOfReturnResult {
  const p1 = startPoint.price || startPoint.fairValuePrice || 1;
  const p2 = endPoint.price || endPoint.fairValuePrice || p1;
  const shares = investedAmount / p1;
  const marketValue = shares * p2;
  const marketValueChange = marketValue - investedAmount;
  const totalReturnPct = ((marketValue - investedAmount) / investedAmount) * 100;

  const t1 = new Date(startPoint.date).getTime();
  const t2 = new Date(endPoint.date).getTime();
  const diffDays = Math.max(1, Math.round(Math.abs(t2 - t1) / (1000 * 60 * 60 * 24)));
  const years = diffDays / 365.25;

  let annualizedCagrPct = 0;
  if (years > 0.05 && marketValue > 0) {
    annualizedCagrPct = (Math.pow(marketValue / investedAmount, 1 / years) - 1) * 100;
  }

  // Metric CAGR
  const m1 = startPoint.metricValue;
  const m2 = endPoint.metricValue;
  let metricCagrPct: number | null = null;
  if (m1 > 0 && m2 > 0 && years > 0.1) {
    metricCagrPct = (Math.pow(m2 / m1, 1 / years) - 1) * 100;
  } else if (m1 !== 0 && m2 !== 0 && years > 0.1) {
    metricCagrPct = ((m2 - m1) / Math.abs(m1) / years) * 100;
  }

  const startPe = m1 > 0 ? Number((p1 / m1).toFixed(2)) : null;
  const endPe = m2 > 0 ? Number((p2 / m2).toFixed(2)) : null;

  const fvMultiple = graphKey.fairValueRatio;
  const normMultiple = graphKey.normalPeRatio;
  const fvEndPrice = Number((m2 * fvMultiple).toFixed(2));
  const normEndPrice = Number((m2 * normMultiple).toFixed(2));

  const vsFairValuePct = p2 > 0 ? Number((((fvEndPrice - p2) / p2) * 100).toFixed(1)) : 0;
  const vsNormalPePct = p2 > 0 ? Number((((normEndPrice - p2) / p2) * 100).toFixed(1)) : 0;

  return {
    startDate: startPoint.date,
    startDisplayDate: startPoint.displayDate,
    endDate: endPoint.date,
    endDisplayDate: endPoint.displayDate,
    invested: investedAmount,
    startPrice: Number(p1.toFixed(2)),
    endPrice: Number(p2.toFixed(2)),
    shares: Number(shares.toFixed(2)),
    startPe,
    endPe,
    marketValue: Number(marketValue.toFixed(2)),
    marketValueChange: Number(marketValueChange.toFixed(2)),
    totalReturnPct: Number(totalReturnPct.toFixed(2)),
    annualizedCagrPct: Number(annualizedCagrPct.toFixed(2)),
    startMetricValue: Number(m1.toFixed(2)),
    endMetricValue: Number(m2.toFixed(2)),
    metricCagrPct: metricCagrPct !== null ? Number(metricCagrPct.toFixed(2)) : null,
    fairValueMultiple: fvMultiple,
    fairValueEndPrice: fvEndPrice,
    vsFairValuePct,
    normalPeMultiple: normMultiple,
    normalPeEndPrice: normEndPrice,
    vsNormalPePct,
    durationDays: diffDays
  };
}

export const fetchFastGraphs = async (
  symbol: string,
  timeframe: FastGraphsTimeframe = '4Y',
  metric: FastGraphsMetricType = 'ADJUSTED_EARNINGS'
): Promise<FastGraphsResponse> => {
  const params = new URLSearchParams({ timeframe, metric });
  const response = await fetch(`/api/graphs/fast-graphs/${encodeURIComponent(symbol)}?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch FAST Graphs data for ${symbol}`);
  }
  return response.json();
};

export const useFastGraphs = (
  symbol: string,
  timeframe: FastGraphsTimeframe = '4Y',
  metric: FastGraphsMetricType = 'ADJUSTED_EARNINGS',
  options?: { enabled?: boolean }
) => {
  const cleanSym = (symbol || '').trim().toUpperCase();
  return useQuery({
    queryKey: ['fastGraphs', cleanSym, timeframe, metric],
    queryFn: () => fetchFastGraphs(cleanSym, timeframe, metric),
    enabled: Boolean(cleanSym && (options?.enabled ?? true)),
    placeholderData: (previousData) => previousData,
    staleTime: 2 * 60 * 1000,
    retry: 1
  });
};
