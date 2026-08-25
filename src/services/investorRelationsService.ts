import { useQuery } from '@tanstack/react-query';

export interface SecFilingItem {
  date: string;
  formattedDate: string;
  formType: string;
  category: 'ANNUAL_REPORT' | 'QUARTERLY_REPORT' | 'CURRENT_EVENT' | 'PROXY_VOTING' | 'INSIDER_OWNERSHIP' | 'REGISTRATION' | 'OTHER';
  title: string;
  edgarUrl: string;
}

export interface InvestorMaterialItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'PRESENTATION' | 'EARNINGS_DECK' | 'ANNUAL_REPORT' | 'WEBCAST' | 'SEC_DIRECTORY';
  url: string;
  isExternal: boolean;
  fileType?: 'PDF' | 'WEBCAST' | 'PORTAL' | 'DIRECTORY';
}

export interface InvestorRelationsDossier {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  currentPrice: number | null;
  marketCap: number | null;

  // Web & IR Portals
  officialWebsite: string;
  irWebsite: string;
  irPortalName: string;
  headquarters: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    fullAddress: string;
    phone?: string;
    employees?: number;
  };

  // Presentations & Decks
  latestPresentation: {
    title: string;
    period: string;
    description: string;
    directSearchUrl: string;
    irPageUrl: string;
  };
  featuredMaterials: InvestorMaterialItem[];

  // SEC EDGAR Filings
  filings: SecFilingItem[];
  secEdgarSearchUrl: string;

  // Calendar & Events
  nextEarningsDate?: string;
  lastFiscalYearEnd?: string;

  generatedAt: string;
}

const API_BASE = '/api';

export const fetchInvestorRelations = async (ticker: string): Promise<InvestorRelationsDossier> => {
  const response = await fetch(`${API_BASE}/research/ir/${ticker}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch Investor Relations dossier');
  }
  return response.json();
};

export const useInvestorRelations = (ticker: string) => {
  return useQuery({
    queryKey: ['investorRelations', ticker],
    queryFn: () => fetchInvestorRelations(ticker),
    enabled: Boolean(ticker && ticker.trim().length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};
