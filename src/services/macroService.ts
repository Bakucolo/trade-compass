import { useQuery } from '@tanstack/react-query';

export interface MacroAssetItem {
  symbol: string;
  name: string;
  category: 'volatility' | 'rates_bonds' | 'indices' | 'currencies' | 'metals' | 'energy' | 'economic';
  assetType: string;
  format: 'currency' | 'percent' | 'number';
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  currency: string;
  exchangeName: string;
  source?: 'FRED' | 'MARKET';
  lastUpdated: string;
}

export interface YieldCurvePoint {
  term: string;
  label: string;
  yield: number;
}

export interface MacroRegime {
  title: string;
  description: string;
  tone: 'bullish' | 'bearish' | 'neutral' | 'warning';
  vix: number;
  dxy: number;
  us10y: number;
  oil: number;
}

export interface MacroOverviewResponse {
  timestamp: string;
  categorized: {
    economic: MacroAssetItem[];
    volatility: MacroAssetItem[];
    rates_bonds: MacroAssetItem[];
    indices: MacroAssetItem[];
    currencies: MacroAssetItem[];
    metals: MacroAssetItem[];
    energy: MacroAssetItem[];
    all: MacroAssetItem[];
  };
  yieldCurve: YieldCurvePoint[];
  spread2y10y: number;
  isCurveInverted: boolean;
  regime: MacroRegime;
}

export interface YieldsAndBondsChartResponse {
  timeframe: string;
  yieldHistory: {
    date: string;
    formattedDate: string;
    us10y: number;
    us02y: number;
    us05y: number;
    us30y: number;
    spread10y2y: number;
    fedFunds?: number;
  }[];
  bondEtfHistory: {
    date: string;
    formattedDate: string;
    tlt: number;
    ief: number;
    shy: number;
    hyg: number;
    lqd: number;
    bnd: number;
    tltNormalized: number;
    iefNormalized: number;
    hygNormalized: number;
    lqdNormalized: number;
    bndNormalized: number;
  }[];
  termStructure: {
    term: string;
    label: string;
    current: number;
    oneMonthAgo: number;
    oneYearAgo: number;
  }[];
  summary: {
    us10y: { current: number; change: number; changePercent: number };
    us02y: { current: number; change: number; changePercent: number };
    us30y: { current: number; change: number; changePercent: number };
    spread10y2y: { current: number; change: number; isInverted: boolean };
    fedFunds: number;
    highYieldSpread: number;
    tlt: { current: number; change: number; changePercent: number };
    hyg: { current: number; change: number; changePercent: number };
  };
  timestamp: number;
}

const API_BASE = '/api/macro';

export async function fetchMacroOverview(): Promise<MacroOverviewResponse> {
  const res = await fetch(`${API_BASE}/overview`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch macro overview');
  }
  return res.json();
}

export function useMacroOverview() {
  return useQuery({
    queryKey: ['macroOverview'],
    queryFn: fetchMacroOverview,
    staleTime: 15 * 1000,
    refetchInterval: 25 * 1000,
  });
}

export function useYieldsAndBondsChart(timeframe: '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX' = '1Y') {
  return useQuery<YieldsAndBondsChartResponse>({
    queryKey: ['yieldsBondsChart', timeframe],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/yields-bonds-chart?timeframe=${timeframe}`);
      if (!res.ok) {
        throw new Error('Failed to fetch yields and bonds chart');
      }
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}
