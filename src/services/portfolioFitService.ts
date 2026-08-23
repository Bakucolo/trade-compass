import { useQuery } from '@tanstack/react-query';

export interface PeerMetricComparison {
  symbol: string;
  name: string;
  isCandidate: boolean;
  marketValue?: number;
  portfolioWeightPercent?: number;
  currentPrice: number;
  pe?: number | null;
  forwardPE?: number | null;
  priceToSales?: number | null;
  operatingMarginPercent?: number | null;
  freeCashFlow?: number | null;
  roePercent?: number | null;
  debtToEquity?: number | null;
  beta?: number | null;
  fiftyTwoWeekPerformancePercent?: number | null;
  distanceFrom52WHighPercent?: number | null;
}

export interface SectorExposureImpact {
  sector: string;
  industry?: string;
  currentSectorMarketValue: number;
  currentSectorWeightPercent: number;
  projectedSectorWeightPercent: number;
  existingHoldingsInSectorCount: number;
  isOverweight: boolean;
}

export type FitVerdictType =
  | 'EXCELLENT_FIT'
  | 'REPLACEMENT_SWAP'
  | 'REDUNDANT_OVERWEIGHT'
  | 'HIGH_BETA_RISK'
  | 'WATCHLIST_PULLBACK';

export interface PortfolioFitResult {
  symbol: string;
  companyName: string;
  currentPrice: number;
  sector: string;
  industry: string;
  marketCap?: number;
  
  // Overall Fit Rating
  fitScore: number; // 0 - 100
  verdictType: FitVerdictType;
  verdictTitle: string;
  verdictSummary: string;
  suggestedAction: string;

  // Correlation & Diversification
  correlationEstimate: number; // -1.0 to 1.0
  correlationRating: 'LOW' | 'MODERATE' | 'HIGH';
  diversificationBenefitScore: number; // 0 - 100
  portfolioBetaBefore: number;
  portfolioBetaAfterEstimate: number;

  // Sector Exposure Impact
  sectorImpact: SectorExposureImpact;

  // Category & Peer Comparison
  categoryName: string;
  peers: PeerMetricComparison[];
  candidateWinsCount: number;
  candidateSuperiorMetrics: string[];
  candidateInferiorMetrics: string[];

  // Qualitative Analysis
  keyPros: string[];
  keyRisks: string[];

  // Sizing Suggestions
  recommendedMaxAllocationUSD: number;
  recommendedMaxWeightPercent: number;

  // Metadata
  portfolioTotalValue: number;
  analyzedAt: string;
}

export const fetchPortfolioFit = async (ticker: string): Promise<PortfolioFitResult> => {
  const cleanTicker = ticker.trim().toUpperCase();
  const res = await fetch(`/api/research/portfolio-fit/${cleanTicker}`);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Failed to analyze portfolio fit for ${cleanTicker}`);
  }
  return res.json();
};

export const usePortfolioFit = (ticker: string, enabled = true) => {
  return useQuery<PortfolioFitResult>({
    queryKey: ['portfolioFit', ticker?.trim().toUpperCase()],
    queryFn: () => fetchPortfolioFit(ticker),
    enabled: Boolean(ticker && ticker.trim().length > 0 && enabled),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
};
