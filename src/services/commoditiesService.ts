// src/services/commoditiesService.ts
// React Query Client Service for Commodities Intelligence, Pricing & Forward Curves

import { useQuery } from '@tanstack/react-query';

export type CommodityCategory = 'energy' | 'precious_metals' | 'industrial_metals' | 'agriculture' | 'livestock';

export type CurveStructure = 'BACKWARDATION' | 'CONTANGO' | 'FLAT';

export type CommodityTimeframe = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y';

export interface CommodityPriceItem {
  id: string;
  symbol: string;
  name: string;
  shortName: string;
  category: CommodityCategory;
  categoryLabel: string;
  unit: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  returns: Record<CommodityTimeframe, number>;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  range52wPercent: number;
  promptSpread: number;
  curveStructure: CurveStructure;
  annualizedRollYield: number;
  exchange: string;
  tradingViewSymbol: string;
  description: string;
}

export interface ForwardCurvePoint {
  tenor: string;
  contractCode: string;
  contractMonth: string;
  price: number;
  spreadToPrompt: number;
  spreadPercent: number;
  historicalOneMonthAgo: number;
  historicalSixMonthsAgo: number;
}

export interface CalendarSpreadItem {
  name: string;
  spread: number;
  spreadPercent: number;
  annualizedRate: number;
  signal: 'BULLISH_BACKWARDATION' | 'BEARISH_CONTANGO' | 'NEUTRAL';
  implication: string;
}

export interface CommodityForwardCurveData {
  id: string;
  name: string;
  symbol: string;
  category: CommodityCategory;
  unit: string;
  spotPrice: number;
  promptPrice: number;
  structure: CurveStructure;
  slopePercent: number;
  promptSpread: number;
  annualizedRollYield: number;
  curveShapeDescription: string;
  marketThesis: string;
  points: ForwardCurvePoint[];
  calendarSpreads: CalendarSpreadItem[];
  keyStats: {
    inventoryContext: string;
    supplyCatalyst: string;
    demandCatalyst: string;
    seasonalPattern: string;
  };
}

export interface CommodityMacroRatio {
  id: string;
  name: string;
  symbol: string;
  numeratorName: string;
  denominatorName: string;
  currentValue: number;
  prevValue: number;
  change: number;
  changePercent: number;
  historicalMean: number;
  historicalHigh52w: number;
  historicalLow52w: number;
  valuationStatus: 'EXTREME_HIGH' | 'HIGH' | 'FAIR' | 'LOW' | 'EXTREME_LOW';
  macroSignal: string;
  interpretation: string;
}

export interface CommoditiesIntelligenceResponse {
  timestamp: string;
  marketRegime: {
    overallPosture: 'BROAD_BACKWARDATION' | 'BROAD_CONTANGO' | 'MIXED_SECTOR_ROTATION';
    summary: string;
    energyRegime: string;
    metalsRegime: string;
    agricultureRegime: string;
    inflationaryImpulseScore: number;
  };
  commodities: CommodityPriceItem[];
  forwardCurves: Record<string, CommodityForwardCurveData>;
  macroRatios: CommodityMacroRatio[];
}

const API_BASE = '/api/macro';

export async function fetchCommoditiesIntelligence(): Promise<CommoditiesIntelligenceResponse> {
  const res = await fetch(`${API_BASE}/commodities-intelligence`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch commodities intelligence');
  }
  return res.json();
}

export function useCommoditiesIntelligence() {
  return useQuery<CommoditiesIntelligenceResponse>({
    queryKey: ['commoditiesIntelligence'],
    queryFn: fetchCommoditiesIntelligence,
    staleTime: 20 * 1000,
    refetchInterval: 30 * 1000,
  });
}
