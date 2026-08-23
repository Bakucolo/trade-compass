import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UnifiedPosition } from '@/components/portfolio/types';
import { PortfolioBalancesData } from './portfolioBalanceService';

export interface HoldingValuationRecord {
  symbol: string;
  companyName: string;
  assetType: 'Stock' | 'Option' | 'ETF' | 'Other';
  brokerSources: string[];
  totalShares: number;
  totalMarketValueUSD: number;
  portfolioWeightPercent: number;
  currentPrice: number;
  currency: string;
  
  // Fair Value & Margin of Safety
  blendedFairValue: number;
  marginOfSafetyPercent: number; // Positive = Undervalued discount %, Negative = Overvalued premium %
  upsideDownsidePercent: number; // Potential % change to reach fair value
  valuationStatus: 'DEEPLY_UNDERVALUED' | 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVERVALUED' | 'EXTREMELY_OVERVALUED';
  valuationScore: number; // 0 to 100
  
  // Valuation Pillars
  dcfFairValue: number;
  multiplesFairValue: number;
  analystTargetMean?: number;
  
  // Financial Multiples
  trailingPE?: number;
  forwardPE?: number;
  historicalPEAvg5Yr?: number;
  pegRatio?: number;
  evToEbitda?: number;
  priceToSales?: number;
  priceToBook?: number;
  fcfYieldPercent?: number;
  
  // AI Diagnostics & Recommendations
  aiDiagnosisSummary: string;
  keyDrivers: string[];
  actionVerdict: 'STRONG_BUY_ACCUMULATE' | 'ACCUMULATE_DCA' | 'HOLD_HARVEST_INCOME' | 'TRIM_TAKE_PROFITS' | 'HEDGE_OVERVALUED_POSITION';
  actionRationale: string;
}

export interface PortfolioValuationAuditResult {
  id?: string;
  title: string;
  overallValuationStatus: 'DEEPLY_UNDERVALUED' | 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVERVALUED' | 'EXTREMELY_OVERVALUED';
  portfolioDiscountPercent: number; // e.g. +18.4% discount or -12.1% premium
  portfolioScore: number; // 0 - 100 overall valuation score
  totalMarketValue: number;
  totalFairValue: number;
  
  // Counts
  undervaluedCount: number;
  fairlyValuedCount: number;
  overvaluedCount: number;
  totalHoldingsCount: number;
  
  // Executive Diagnosis
  executiveSummary: string;
  keyOpportunitiesSummary: string;
  valuationRisksSummary: string;
  
  // Ranked Holdings
  holdings: HoldingValuationRecord[];
  topUndervaluedGems: HoldingValuationRecord[];
  topOvervaluedRisks: HoldingValuationRecord[];
  
  createdAt?: string;
}

export interface RunValuationPayload {
  positions?: UnifiedPosition[];
  balancesData?: PortfolioBalancesData;
}

/**
 * Trigger the autonomous AI Portfolio Valuation Agent
 */
export function useRunPortfolioValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RunValuationPayload = {}) => {
      const res = await fetch('/api/portfolio/valuation-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to run valuation audit' }));
        throw new Error(err.error || 'Failed to run valuation audit');
      }
      return res.json() as Promise<{ success: boolean; audit: PortfolioValuationAuditResult }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-valuation-audits'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-valuation-latest'] });
      queryClient.invalidateQueries({ queryKey: ['agent-activities'] });
    }
  });
}

/**
 * Fetch historical valuation audits
 */
export function usePortfolioValuationAudits(limit = 20) {
  return useQuery({
    queryKey: ['portfolio-valuation-audits', limit],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/valuation-audits?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch valuation audits');
      const data = await res.json();
      return (data.audits || []) as PortfolioValuationAuditResult[];
    },
    staleTime: 60000
  });
}

/**
 * Fetch latest valuation audit
 */
export function useLatestPortfolioValuation() {
  return useQuery({
    queryKey: ['portfolio-valuation-latest'],
    queryFn: async () => {
      const res = await fetch('/api/portfolio/valuation-audits/latest');
      if (!res.ok) throw new Error('Failed to fetch latest valuation audit');
      const data = await res.json();
      return (data.audit || null) as PortfolioValuationAuditResult | null;
    },
    staleTime: 60000
  });
}

/**
 * Delete a valuation audit report
 */
export function useDeletePortfolioValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/portfolio/valuation-audits/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete valuation report');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-valuation-audits'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-valuation-latest'] });
    }
  });
}
