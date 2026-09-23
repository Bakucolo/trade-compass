// src/services/miniChartService.ts
import { useQuery } from '@tanstack/react-query';

export interface StockMiniChartPoint {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface StockMiniChartData {
  symbol: string;
  name: string;
  currency: string;
  currentPrice: number;
  previousClose: number;
  dayChange: number;
  dayChangePercent: number;
  periodChange: number;
  periodChangePercent: number;
  periodHigh: number;
  periodLow: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  volume?: number;
  points: StockMiniChartPoint[];
}

export type MiniChartRange = '1w' | '1mo' | '3mo' | '1y';

export async function fetchStockMiniChart(
  symbol: string,
  range: MiniChartRange = '1mo'
): Promise<StockMiniChartData> {
  const clean = symbol.trim().toUpperCase();
  const response = await fetch(`/api/market/mini-chart/${encodeURIComponent(clean)}?range=${range}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Failed to fetch chart data for ${clean}`);
  }

  return response.json();
}

export function useStockMiniChart(
  symbol?: string,
  range: MiniChartRange = '1mo',
  options: { enabled?: boolean } = {}
) {
  const clean = symbol ? symbol.trim().toUpperCase() : '';
  const isEnabled = Boolean(clean && (options.enabled ?? true));

  return useQuery<StockMiniChartData, Error>({
    queryKey: ['stock-mini-chart', clean, range],
    queryFn: () => fetchStockMiniChart(clean, range),
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 15 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
