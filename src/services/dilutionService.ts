import { useQuery } from '@tanstack/react-query';

export interface SbcRecord {
  fiscalYear: number;
  fiscalPeriod: string;
  startDate?: string;
  endDate: string;
  amountUSD: number;
  form: string;
  filedDate: string;
  revenueUSD?: number;
  sbcPercentOfRevenue?: number;
}

export interface ShareCountRecord {
  fiscalYear: number;
  fiscalPeriod: string;
  endDate: string;
  sharesOutstanding: number;
  dilutedShares?: number;
  form: string;
  filedDate: string;
}

export interface EquityIssuanceRecord {
  fiscalYear: number;
  fiscalPeriod: string;
  startDate?: string;
  endDate: string;
  proceedsUSD: number;
  form: string;
  filedDate: string;
  type: 'ATM_OFFERING_OR_PUBLIC_OFFERING' | 'STOCK_ISSUANCE' | 'CONVERTIBLE_DEBT';
}

export interface ShareBuybackRecord {
  fiscalYear: number;
  fiscalPeriod: string;
  startDate?: string;
  endDate: string;
  amountUSD: number;
  form: string;
  filedDate: string;
}

export interface DilutionSecFiling {
  form: string;
  filingDate: string;
  reportDate?: string;
  accessionNumber: string;
  description: string;
  edgarUrl: string;
  category: 'ATM_SHELF_OFFERING' | 'EQUITY_INCENTIVE_SBC' | 'INSIDER_PROPOSED_SALE' | 'FINANCIAL_REPORT';
}

export interface DilutionAnalysisData {
  symbol: string;
  companyName: string;
  cik: string;
  marketCap: number;
  spotPrice: number;
  sharesOutstanding: number;
  dilutedSharesOutstanding: number;
  
  // Executive Highlights
  dilutionRiskTier: 'ACCRETIVE' | 'LOW' | 'MODERATE' | 'ELEVATED' | 'SEVERE';
  dilutionRiskScore: number; // 0 to 100
  riskBadgeColor: 'emerald' | 'cyan' | 'amber' | 'orange' | 'rose';
  dilutionVerdict: string;
  
  // Annualized Overview Metrics
  annualSbcUSD: number;
  sbcPercentOfRevenue: number;
  sbcPerShareUSD: number;
  annualAtmProceedsUSD: number;
  annualBuybacksUSD: number;
  netDilutionRateYoY: number;
  threeYearCagrDilution: number;
  fiveYearCagrDilution: number;
  shareholderYieldPercent: number;
  
  // Detailed Historical Series
  sbcHistoryQuarterly: SbcRecord[];
  sbcHistoryAnnual: SbcRecord[];
  sharesHistory: ShareCountRecord[];
  equityIssuances: EquityIssuanceRecord[];
  shareBuybacks: ShareBuybackRecord[];
  
  // SEC Dilution Radar
  recentDilutionFilings: DilutionSecFiling[];
  hasActiveAtmShelf: boolean;
  activeAtmDetails?: string;
  
  analyzedAt: string;
}

export const fetchDilutionAnalysis = async (ticker: string): Promise<DilutionAnalysisData> => {
  const response = await fetch(`/api/research/dilution/${ticker}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch dilution analysis');
  }
  return response.json();
};

export const useDilutionAnalysis = (ticker: string) => {
  return useQuery({
    queryKey: ['dilutionAnalysis', ticker],
    queryFn: () => fetchDilutionAnalysis(ticker),
    enabled: Boolean(ticker && ticker.trim().length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};
