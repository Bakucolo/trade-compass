import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ScannerCriteria {
  search?: string;
  sectors?: string[];
  themes?: string[];
  marketCapTier?: 'ALL' | 'MEGA' | 'LARGE' | 'MID' | 'SMALL';
  minPe?: number;
  maxPe?: number;
  minPs?: number;
  maxPs?: number;
  minOperatingMargin?: number; // e.g. 15 (%)
  minRoe?: number; // e.g. 15 (%)
  maxDebtToEquity?: number; // e.g. 100 (%)
  minDividendYield?: number; // e.g. 2 (%)
  minDayChange?: number; // e.g. -5 (%)
  maxDayChange?: number; // e.g. +5 (%)
  minDistance52wHigh?: number; // e.g. -10 (%)
  maxDistance52wHigh?: number; // e.g. 0 (%)
  movingAverageCondition?: 'ALL' | 'ABOVE_50DMA' | 'ABOVE_200DMA' | 'GOLDEN_CROSS' | 'BELOW_200DMA';
  rsiCondition?: 'ALL' | 'OVERSOLD' | 'NEUTRAL' | 'OVERBOUGHT';
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
}

export interface ScannedStockResult {
  symbol: string;
  name: string;
  sector: string;
  industry?: string;
  themes: string[];
  price: number;
  change: number;
  changePercent: number;
  marketCap: number | null;
  marketCapFormatted: string;
  pe: number | null;
  forwardPe: number | null;
  ps: number | null;
  pb: number | null;
  operatingMargin: number | null; // (%)
  roe: number | null; // (%)
  debtToEquity: number | null;
  dividendYield: number | null; // (%)
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  distance52wHighPercent: number; // (%)
  distance52wLowPercent: number; // (%)
  fiftyDma: number | null;
  twoHundredDma: number | null;
  above50Dma: boolean;
  above200Dma: boolean;
  goldenCross: boolean;
  volume: number | null;
  avgVolume: number | null;
  volumeSurgeRatio: number;
  estimatedRsi: number;
}

export interface ScannerExecutionResponse {
  results: ScannedStockResult[];
  totalUniverseSize: number;
  matchedCount: number;
  appliedCriteria: ScannerCriteria;
  timestamp: string;
}

export interface ScannerMetaResponse {
  totalEquities: number;
  sectors: string[];
  themes: string[];
}

export async function runStockScanner(criteria: ScannerCriteria): Promise<ScannerExecutionResponse> {
  const res = await fetch('/api/scanner/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(criteria),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to execute stock scanner');
  }
  return res.json();
}

export async function fetchScannerMeta(): Promise<ScannerMetaResponse> {
  const res = await fetch('/api/scanner/meta');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch scanner metadata');
  }
  return res.json();
}

// React Query Hooks

export function useScanner(criteria: ScannerCriteria, enabled: boolean = true) {
  return useQuery({
    queryKey: ['stockScanner', criteria],
    queryFn: () => runStockScanner(criteria),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useScannerMeta() {
  return useQuery({
    queryKey: ['stockScannerMeta'],
    queryFn: fetchScannerMeta,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRunScannerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (criteria: ScannerCriteria) => runStockScanner(criteria),
    onSuccess: (data) => {
      queryClient.setQueryData(['stockScanner', data.appliedCriteria], data);
    },
  });
}
