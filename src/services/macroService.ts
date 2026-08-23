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
