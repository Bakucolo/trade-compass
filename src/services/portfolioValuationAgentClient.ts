import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface HardStockData {
  symbol: string;
  companyName: string;
  currentPrice: number;
  currency: string;
  marketCap?: number;
  enterpriseValue?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  trailingPE?: number;
  forwardPE?: number;
  pegRatio?: number;
  evToEbitda?: number;
  priceToSales?: number;
  priceToBook?: number;
  revenueGrowthYoY?: number;
  earningsQuarterlyGrowth?: number;
  operatingMargins?: number;
  fcfYieldPercent?: number;
  analystTargetMean?: number;
  analystOpinionsCount?: number;
  recommendationKey?: string;
  sector?: string;
  industry?: string;
}

export interface StockValuationReport {
  symbol: string;
  company_name: string;
  current_price: number;
  target_price_1y: number;
  valuation_status: 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVEREXTENDED';
  is_overextended: boolean;
  overextended_threshold_price: number;
  upside_downside_pct: number;
  conviction_score: number;
  valuation_thesis: string;
  key_drivers: string[];
  key_risks: string[];
  action_recommendation: 'BUY' | 'ACCUMULATE' | 'HOLD' | 'TRIM' | 'SELL';
  fundamental_context?: HardStockData;
  alert_created?: boolean;
  alert_id?: string;
  alert_target_price?: number;
  report_id?: string;
  pdf_path?: string;
  created_at?: string;
}

export interface ScatterGatherValuationResult {
  audit_id?: string;
  timestamp: string;
  total_tickers_audited: number;
  concurrency_batch_size: number;
  total_batches: number;
  overextended_count: number;
  undervalued_count: number;
  fairly_valued_count: number;
  alerts_created_count: number;
  portfolio_summary: string;
  stock_reports: StockValuationReport[];
  created_alerts: Array<{
    symbol: string;
    target_price: number;
    condition: string;
    alert_id: string;
    notes?: string;
  }>;
  portfolio_pdf_path?: string;
}

export interface SavedWorkerReport {
  id: string;
  symbol: string;
  reportType: string;
  title: string;
  convictionScore: number | null;
  summary: string | null;
  contentJson: string;
  pdfPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export const portfolioValuationAgentClient = {
  // Trigger Scatter-Gather Map-Reduce valuation across holdings
  async runScatterGather(payload?: {
    tickers?: string[];
    concurrencyLimit?: number;
  }): Promise<{ success: boolean; result: ScatterGatherValuationResult }> {
    const res = await fetch('/api/portfolio/valuation-agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || { concurrencyLimit: 5 })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to run Scatter-Gather valuation (${res.status})`);
    }

    return res.json();
  },

  // Get unique tickers from portfolio holdings
  async getTickers(): Promise<string[]> {
    const res = await fetch('/api/portfolio/valuation-agent/tickers');
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return data.tickers || [];
  },

  // Fetch saved worker reports from database
  async getSavedReports(symbol?: string, limit = 50): Promise<SavedWorkerReport[]> {
    const query = new URLSearchParams();
    if (symbol) query.set('symbol', symbol.trim().toUpperCase());
    query.set('limit', String(limit));

    const res = await fetch(`/api/portfolio/valuation-agent/reports?${query.toString()}`);
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return data.reports || [];
  },

  // Return download URL for a single stock PDF
  getStockPdfUrl(symbol: string): string {
    return `/api/portfolio/valuation-agent/stock-pdf/${encodeURIComponent(symbol.trim().toUpperCase())}`;
  },

  // Return download URL for master portfolio PDF
  getPortfolioPdfUrl(auditId: string): string {
    return `/api/portfolio/valuation-agent/portfolio-pdf/${encodeURIComponent(auditId)}`;
  }
};

/**
 * React Query Mutation Hook to trigger Scatter-Gather valuation
 */
export function useRunScatterGatherValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload?: { tickers?: string[]; concurrencyLimit?: number }) =>
      portfolioValuationAgentClient.runScatterGather(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-valuation-agent-reports'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-valuation-audits'] });
      queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  });
}

/**
 * React Query Hook to list saved valuation reports
 */
export function usePortfolioValuationReports(symbol?: string, limit = 50) {
  return useQuery({
    queryKey: ['portfolio-valuation-agent-reports', symbol, limit],
    queryFn: () => portfolioValuationAgentClient.getSavedReports(symbol, limit),
    staleTime: 30000
  });
}

/**
 * React Query Hook to get portfolio tickers
 */
export function usePortfolioTickers() {
  return useQuery({
    queryKey: ['portfolio-agent-tickers'],
    queryFn: () => portfolioValuationAgentClient.getTickers(),
    staleTime: 60000
  });
}
