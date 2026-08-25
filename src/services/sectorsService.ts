import { useQuery } from '@tanstack/react-query';

export type RotationStage = 'Leading' | 'Weakening' | 'Lagging' | 'Improving';
export type SectorScope = 'sector' | 'industry' | 'benchmark';
export type SectorTimeframe = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y';

export interface SectorConstituent {
  symbol: string;
  name: string;
  weight: number;
  price?: number;
  change?: number;
  changePercent?: number;
}

export interface SectorItem {
  symbol: string;
  name: string;
  shortName: string;
  category: SectorScope;
  sectorGroup?: string;
  description: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;

  returns: {
    '1D': number;
    '1W': number;
    '1M': number;
    '3M': number;
    '6M': number;
    'YTD': number;
    '1Y': number;
  };

  alphaVsSpy: {
    '1D': number;
    '1W': number;
    '1M': number;
    '3M': number;
    '6M': number;
    'YTD': number;
    '1Y': number;
  };

  rotationStage: RotationStage;
  relativeStrengthRank: number;
  momentumScore: number;
  rsi14: number;
  above50Dma: boolean;
  above200Dma: boolean;
  dma50DistancePct: number;
  dma200DistancePct: number;
  distance52wHighPct: number;
  distance52wLowPct: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;

  topHoldings: SectorConstituent[];
  aiCommentary: string;
  catalysts: string[];
}

export interface MacroRotationRatios {
  cyclicalVsDefensive: {
    ratio: number;
    change1M: number;
    regime: 'Strong Risk-On' | 'Moderate Cyclical' | 'Defensive Flight' | 'Balanced';
    description: string;
  };
  discretionaryVsStaples: {
    ratio: number;
    change1M: number;
    signal: 'Consumer Confidence Expanding' | 'Consumer Caution / Defensive' | 'Neutral';
  };
  growthVsValue: {
    ratio: number;
    change1M: number;
    signal: 'Tech & Duration Inflows' | 'Value & Cash-Flow Rotation' | 'Equal Weight';
  };
  highYieldVsTreasury: {
    ratio: number;
    change1M: number;
    signal: 'Credit Spreads Benign' | 'Credit Stress Tightening';
  };
  industrialsVsUtilities: {
    ratio: number;
    change1M: number;
    signal: 'Economic Expansion Capex' | 'Yield Seeking / Power Scarcity';
  };
}

export interface SectorsOverviewResponse {
  timestamp: string;
  benchmark: {
    spy: { price: number; returns: Record<SectorTimeframe, number> };
    qqq: { price: number; returns: Record<SectorTimeframe, number> };
    iwm: { price: number; returns: Record<SectorTimeframe, number> };
  };
  sectors: SectorItem[];
  industries: SectorItem[];
  all: SectorItem[];
  rotationRatios: MacroRotationRatios;
  breadth: {
    pctAbove50Dma: number;
    pctAbove200Dma: number;
    pctPositive1W: number;
    pctPositive1M: number;
    pctPositive3M: number;
    topLeader1M: string;
    topLaggard1M: string;
  };
  emergingTrends: {
    title: string;
    type: 'bullish' | 'bearish' | 'rotation' | 'alert';
    description: string;
    sectors: string[];
  }[];
}

export interface SectorsHistoryResponse {
  timeframe: string;
  symbols: string[];
  history: {
    date: string;
    formattedDate: string;
    [symbol: string]: any;
  }[];
}

const API_BASE = '/api/macro';

export async function fetchSectorsOverview(): Promise<SectorsOverviewResponse> {
  const res = await fetch(`${API_BASE}/sectors-overview`);
  if (!res.ok) {
    throw new Error('Failed to fetch sectors overview');
  }
  return res.json();
}

export function useSectorsOverview() {
  return useQuery<SectorsOverviewResponse>({
    queryKey: ['sectorsOverview'],
    queryFn: fetchSectorsOverview,
    staleTime: 30 * 1000,
    refetchInterval: 45 * 1000,
  });
}

export async function fetchSectorsHistory(
  symbols: string[],
  timeframe: '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' = '1M'
): Promise<SectorsHistoryResponse> {
  const query = new URLSearchParams({
    symbols: symbols.join(','),
    timeframe,
  });
  const res = await fetch(`${API_BASE}/sectors-history?${query.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch sectors history');
  }
  return res.json();
}

export function useSectorsHistory(
  symbols: string[],
  timeframe: '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' = '1M'
) {
  return useQuery<SectorsHistoryResponse>({
    queryKey: ['sectorsHistory', symbols.sort().join(','), timeframe],
    queryFn: () => fetchSectorsHistory(symbols, timeframe),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    enabled: symbols.length > 0,
  });
}
