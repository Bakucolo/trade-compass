import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ScorecardData {
  rating?: string;
  convictionScore?: number;
  priceTarget?: string | number;
  targetRationale?: string;
  moatRating?: number;
  moatTier?: string;
  moatJustification?: string;
  managementRating?: number;
  managementTier?: string;
  managementJustification?: string;
  peRatio?: string | number;
  psRatio?: string | number;
  dividendYield?: string | number;
  marketCap?: string | number;
  supportLevel?: string;
  fairValueRange?: string;
  entryStrategy?: string;
  advancedOptionsStrategy?: string;
}

export interface ReportStructuredContent {
  ticker?: string;
  report_title?: string;
  conviction_score?: number;
  executive_summary?: string[] | string;
  business_model_and_moat?: string | Record<string, any>;
  financial_and_valuation_analysis?: string | Record<string, any>;
  sec_filings_and_risk_factors?: string | Record<string, any>;
  macro_and_industry_tailwinds?: string | Record<string, any>;
  catalysts_and_price_target?: string | Record<string, any>;
  executive_leadership_profiles?: string | Record<string, any>;
  capital_allocation_track_record?: string | Record<string, any>;
  insider_ownership_and_alignment?: string | Record<string, any>;
  governance_and_board_oversight?: string | Record<string, any>;
  leadership_verdict?: string | Record<string, any>;
  quarterly_financial_results?: string | Record<string, any>;
  segment_and_regional_breakdown?: string | Record<string, any>;
  management_guidance_and_outlook?: string | Record<string, any>;
  earnings_call_takeaways?: string | Record<string, any>;
  earnings_reaction_and_target?: string | Record<string, any>;
  date?: string;
  report?: Record<string, any>;
  sections?: Array<{ title: string; content: any }>;
  scorecard?: ScorecardData;
  [key: string]: any;
}

export interface AutonomousReport {
  id: string;
  symbol: string;
  reportType: string;
  title: string;
  convictionScore: number | null;
  summary: string | null;
  contentJson: string;
  pdfPath: string | null;
  promptTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const reportService = {
  // Fetch all reports for a specific ticker
  async getReportsForSymbol(symbol: string): Promise<AutonomousReport[]> {
    if (!symbol) return [];
    const res = await fetch(`/api/research/reports/symbol/${encodeURIComponent(symbol.trim().toUpperCase())}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch reports for ${symbol}`);
    }
    return res.json();
  },

  // Fetch all reports across all tickers
  async getAllReports(limit: number = 50): Promise<AutonomousReport[]> {
    const res = await fetch(`/api/research/reports?limit=${limit}`);
    if (!res.ok) {
      throw new Error('Failed to fetch research reports');
    }
    return res.json();
  },

  // Fetch single report by ID
  async getReportById(id: string): Promise<AutonomousReport> {
    const res = await fetch(`/api/research/reports/${id}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch report ${id}`);
    }
    return res.json();
  },

  // Generate autonomous report and save to database
  async generateReport(
    symbol: string,
    reportType: string = 'company_research',
    promptId?: string
  ): Promise<{ success: boolean; report: AutonomousReport; pdfPath?: string }> {
    const cleanSym = symbol.trim().toUpperCase();
    const promptQuery = promptId ? `&promptId=${encodeURIComponent(promptId)}` : '';
    const res = await fetch(`/api/research/autonomous/${cleanSym}?type=${encodeURIComponent(reportType)}${promptQuery}&format=json`);
    
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Report generation failed (${res.status})`);
    }
    return res.json();
  },

  // Delete report
  async deleteReport(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/research/reports/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      throw new Error(`Failed to delete report ${id}`);
    }
    return res.json();
  },

  // Download PDF helper
  getPdfDownloadUrl(id: string): string {
    return `/api/research/reports/${id}/pdf`;
  },

  // Helper to parse contentJson safely and extract normalized scorecards
  parseContentJson(report: AutonomousReport): ReportStructuredContent {
    try {
      if (!report.contentJson) return { report_title: report.title, ticker: report.symbol };
      const parsed = JSON.parse(report.contentJson);
      
      // Auto-extract scorecard details across various LLM structures
      const scorecard = reportService.extractScorecard(parsed, report);
      return {
        ...parsed,
        scorecard
      };
    } catch (e) {
      console.warn(`Failed to parse contentJson for report ${report.id}:`, e);
      return { report_title: report.title, ticker: report.symbol };
    }
  },

  // Deep extractor for scorecard data
  extractScorecard(data: any, report?: AutonomousReport): ScorecardData {
    const sc: ScorecardData = {
      convictionScore: report?.convictionScore ?? (typeof data.conviction_score === 'number' ? data.conviction_score : 75),
    };

    const searchObj = data.report || data;

    // Recursive helper to look for keys
    const findKey = (obj: any, keyRegex: RegExp): any => {
      if (!obj || typeof obj !== 'object') return undefined;
      for (const k of Object.keys(obj)) {
        if (keyRegex.test(k)) return obj[k];
        if (typeof obj[k] === 'object' && obj[k] !== null) {
          const nested = findKey(obj[k], keyRegex);
          if (nested !== undefined) return nested;
        }
      }
      return undefined;
    };

    // 1. Rating / Verdict
    const ratingVal = findKey(searchObj, /^(rating|investment_rating|verdict|recommendation)$/i);
    if (ratingVal && typeof ratingVal === 'string') {
      sc.rating = ratingVal;
    }

    // 2. Conviction Rating (e.g. 1-10 or 1-100)
    const convVal = findKey(searchObj, /^(conviction_rating|conviction_score|conviction)$/i);
    if (typeof convVal === 'number') {
      sc.convictionScore = convVal > 10 ? convVal : convVal * 10;
    }

    // 3. Price Target & Rationale
    const ptVal = findKey(searchObj, /^(1-year_price_target|price_target|target_price|1_year_price_target)$/i);
    if (ptVal !== undefined) {
      sc.priceTarget = ptVal;
    }
    const ptRat = findKey(searchObj, /^(target_rationale|rationale)$/i);
    if (typeof ptRat === 'string') {
      sc.targetRationale = ptRat;
    }

    // 4. Moat Rating & Justification
    const moatVal = findKey(searchObj, /^(moat_rating|moat_score)$/i);
    if (typeof moatVal === 'number') {
      sc.moatRating = moatVal;
      sc.moatTier = moatVal >= 8 ? 'Wide Moat' : moatVal >= 5 ? 'Narrow Moat' : 'No Moat';
    }
    const moatJust = findKey(searchObj, /^(moat_analysis|moat_justification|competitive_advantage)$/i);
    if (typeof moatJust === 'string') {
      sc.moatJustification = moatJust;
    }

    // 5. Management Rating
    const mgmtVal = findKey(searchObj, /^(management_rating|management_score|leadership_rating)$/i);
    if (typeof mgmtVal === 'number') {
      sc.managementRating = mgmtVal;
      sc.managementTier = mgmtVal >= 8 ? 'Exemplary Leadership' : mgmtVal >= 5 ? 'Standard' : 'Poor';
    }
    const mgmtJust = findKey(searchObj, /^(leadership_evaluation|management_justification)$/i);
    if (typeof mgmtJust === 'string') {
      sc.managementJustification = mgmtJust;
    }

    // 6. Valuation Multiples (P/E, P/S, Yield, Cap)
    const peVal = findKey(searchObj, /^(p\/e_ratio|pe_ratio|trailing_p\/e|trailing_pe|p\/e)$/i);
    if (peVal !== undefined) sc.peRatio = peVal;

    const psVal = findKey(searchObj, /^(p\/s_ratio|ps_ratio|price_to_sales|p\/s)$/i);
    if (psVal !== undefined) sc.psRatio = psVal;

    const divVal = findKey(searchObj, /^(dividend_yield|yield)$/i);
    if (divVal !== undefined) sc.dividendYield = divVal;

    const mcVal = findKey(searchObj, /^(market_cap|market_capitalization)$/i);
    if (mcVal !== undefined) sc.marketCap = mcVal;

    // 7. Strategy & Entry Levels
    const entryStrat = findKey(searchObj, /^(entry_strategy)$/i);
    if (typeof entryStrat === 'string') sc.entryStrategy = entryStrat;

    const specificEntries = findKey(searchObj, /^(specific_entry_price_targets|entry_price_targets)$/i);
    if (Array.isArray(specificEntries)) {
      specificEntries.forEach((entry: any) => {
        const str = String(entry);
        if (str.toLowerCase().includes('support')) sc.supportLevel = str;
        if (str.toLowerCase().includes('fair value')) sc.fairValueRange = str;
      });
    }

    const advMech = findKey(searchObj, /^(advanced_entry_mechanics|options_mechanics)$/i);
    if (typeof advMech === 'string') sc.advancedOptionsStrategy = advMech;

    return sc;
  }
};

// React Query Hooks
export function useAutonomousReports(symbol?: string) {
  return useQuery({
    queryKey: ['autonomousReports', symbol?.toUpperCase()],
    queryFn: () => reportService.getReportsForSymbol(symbol || ''),
    enabled: !!symbol,
  });
}

export function useAllAutonomousReports(limit: number = 50) {
  return useQuery({
    queryKey: ['allAutonomousReports', limit],
    queryFn: () => reportService.getAllReports(limit),
  });
}

export function useAutonomousReportDetail(id?: string) {
  return useQuery({
    queryKey: ['autonomousReportDetail', id],
    queryFn: () => reportService.getReportById(id || ''),
    enabled: !!id,
  });
}
