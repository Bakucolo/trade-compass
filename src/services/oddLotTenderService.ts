import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface OddLotTenderOpportunity {
  id: string;
  symbol: string;
  companyName: string;
  currentPrice: number;
  tenderPrice: number;
  tenderPriceMin?: number;
  tenderPriceMax?: number;
  spreadPercent: number;
  spreadDollar: number;
  maxOddLotShares: number;
  capitalRequired: number;
  estimatedGrossProfit: number;
  annualizedReturnPercent: number;
  expirationDate: string;
  daysToExpiration: number;
  oddLotPriorityVerified: boolean;
  rule13e4Compliant: boolean;
  tenderType: 'DUTCH_AUCTION' | 'FIXED_PRICE_CASH' | 'SPLIT_OFF_EXCHANGE' | 'GOING_PRIVATE';
  prorationRisk: 'NONE_FOR_ODD_LOTS' | 'LOW' | 'MEDIUM';
  secForm: 'SC TO-I' | 'SC TO-T' | 'SC 13E3' | 'Form S-4';
  secFilingDate: string;
  secFilingUrl?: string;
  dealSummary: string;
  keyConditions: string[];
  executionPlaybook: {
    maxSharesToBuy: number;
    buyWindowDeadline: string;
    tenderInstructionDeadline: string;
    brokerActionStep: string;
    settlementEstimatedDate: string;
    riskFactors: string[];
  };
  aiInsight?: {
    thesis: string;
    confidenceScore: number;
    downsideRiskRating: 'VERY_LOW' | 'LOW' | 'MODERATE';
    recommendation: 'STRONG_BUY_TENDER' | 'FAVORABLE' | 'MONITOR';
  };
}

export interface OddLotScanResult {
  scanTimestamp: string;
  totalOpportunities: number;
  averageSpreadPercent: number;
  totalPotentialProfit: number;
  opportunities: OddLotTenderOpportunity[];
  agentSummary: string;
}

export const oddLotTenderClient = {
  async fetchOpportunities(): Promise<OddLotScanResult> {
    const res = await fetch('/api/arbitrage/odd-lot-tenders');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to scan odd lot tender opportunities');
    }
    return res.json();
  },

  async saveToOddLotsWatchlist(symbols?: string[], createPriceAlerts: boolean = true): Promise<{
    success: boolean;
    watchlistId: string;
    watchlistName: string;
    itemsCount: number;
    alertsCreated: number;
  }> {
    const res = await fetch('/api/arbitrage/odd-lot-tenders/save-watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols, createPriceAlerts })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save to Odd Lots watchlist');
    }
    return res.json();
  }
};

export function useOddLotTenders() {
  return useQuery({
    queryKey: ['oddLotTenders'],
    queryFn: () => oddLotTenderClient.fetchOpportunities(),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useSaveToOddLotsWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ symbols, createPriceAlerts }: { symbols?: string[]; createPriceAlerts?: boolean }) =>
      oddLotTenderClient.saveToOddLotsWatchlist(symbols, createPriceAlerts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      queryClient.invalidateQueries({ queryKey: ['watchlistData'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  });
}
