import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

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

// Curated dictionary of top verified IR websites for seamless 1-click access
const VERIFIED_IR_PORTALS: Record<string, string> = {
  AAPL: 'https://investor.apple.com',
  NVDA: 'https://investor.nvidia.com',
  MSFT: 'https://www.microsoft.com/investor',
  AMZN: 'https://ir.aboutamazon.com',
  GOOGL: 'https://abc.xyz/investor',
  GOOG: 'https://abc.xyz/investor',
  META: 'https://investor.fb.com',
  TSLA: 'https://ir.tesla.com',
  PLTR: 'https://investors.palantir.com',
  AMD: 'https://ir.amd.com',
  TSM: 'https://investor.tsmc.com',
  AVGO: 'https://investors.broadcom.com',
  INTC: 'https://www.intc.com',
  NFLX: 'https://ir.netflix.net',
  QCOM: 'https://investor.qualcomm.com',
  CRM: 'https://investor.salesforce.com',
  ORCL: 'https://investor.oracle.com',
  CSCO: 'https://investor.cisco.com',
  ADBE: 'https://www.adobe.com/investor-relations.html',
  NOW: 'https://investors.servicenow.com',
  UBER: 'https://investor.uber.com',
  ABNB: 'https://investors.airbnb.com',
  COIN: 'https://investor.coinbase.com',
  SHOP: 'https://investors.shopify.com',
  SNOW: 'https://investors.snowflake.com',
  CRWD: 'https://ir.crowdstrike.com',
  PANW: 'https://investors.paloaltonetworks.com',
  NET: 'https://cloudflare.net',
  DDOG: 'https://investors.datadoghq.com',
  MDB: 'https://investors.mongodb.com',
  CCJ: 'https://www.cameco.com/invest',
  SMR: 'https://investors.nuscaleenergy.com',
  CEG: 'https://investors.constellationenergy.com',
  VST: 'https://investor.vistracorp.com',
  LLY: 'https://investor.lilly.com',
  NVO: 'https://www.novonordisk.com/investors.html',
  JNJ: 'https://www.investor.jnj.com',
  PFE: 'https://investors.pfizer.com',
  UNH: 'https://www.unitedhealthgroup.com/investors.html',
  XOM: 'https://investor.exxonmobil.com',
  CVX: 'https://www.chevron.com/investors',
  JPM: 'https://www.jpmorganchase.com/ir',
  BAC: 'https://investor.bankofamerica.com',
  GS: 'https://www.goldmansachs.com/investor-relations',
  MS: 'https://www.morganstanley.com/about-us-ir',
  V: 'https://investor.visa.com',
  MA: 'https://investor.mastercard.com',
  DIS: 'https://thewaltdisneycompany.com/investor-relations',
  WMT: 'https://stock.walmart.com',
  COST: 'https://investor.costco.com',
  NOC: 'https://investor.northropgrumman.com',
  LMT: 'https://investors.lockheedmartin.com',
  RTX: 'https://www.rtx.com/investors',
  CAT: 'https://www.caterpillar.com/en/investors.html',
  ETN: 'https://www.eaton.com/us/en-us/company/investor-relations.html',
  WM: 'https://investors.wm.com',
};

/**
 * Fetch and construct comprehensive Investor Relations Dossier for any ticker
 */
export async function fetchInvestorRelationsDossier(tickerParam: string): Promise<InvestorRelationsDossier> {
  const ticker = tickerParam.toUpperCase().trim();

  let quoteSummary: any = null;

  try {
    quoteSummary = await yahooFinance.quoteSummary(
      ticker,
      { modules: ['summaryProfile', 'secFilings', 'price', 'calendarEvents', 'defaultKeyStatistics'] },
      { validateResult: false }
    );
  } catch (e: any) {
    // If combined fails, try minimal summaryProfile
    try {
      quoteSummary = await yahooFinance.quoteSummary(
        ticker,
        { modules: ['summaryProfile', 'price'] },
        { validateResult: false }
      );
    } catch {
      // Fallback
    }
  }

  const profile = quoteSummary?.summaryProfile;
  const price = quoteSummary?.price;
  const calendar = quoteSummary?.calendarEvents;
  const rawFilings = quoteSummary?.secFilings?.filings || [];

  const companyName = price?.shortName || price?.longName || profile?.name || ticker;
  const sector = profile?.sector || 'Equities';
  const industry = profile?.industry || 'Stock';
  const currentPrice = price?.regularMarketPrice ?? null;
  const marketCap = price?.marketCap ?? null;

  // Resolve Official Website & IR Portal
  const officialWebsite = profile?.website || `https://www.${ticker.toLowerCase()}.com`;
  
  // Extract base domain
  let baseDomain = '';
  try {
    const parsed = new URL(officialWebsite);
    baseDomain = parsed.hostname.replace(/^www\./, '');
  } catch {
    baseDomain = `${ticker.toLowerCase()}.com`;
  }

  const verifiedIR = VERIFIED_IR_PORTALS[ticker];
  const irWebsite = verifiedIR || `https://investor.${baseDomain}`;
  const irPortalName = `${companyName} Investor Relations`;

  // Format Headquarters
  const hqParts = [profile?.address1, profile?.address2, profile?.city, profile?.state, profile?.zip, profile?.country].filter(Boolean);
  const fullAddress = hqParts.length > 0 ? hqParts.join(', ') : 'Headquarters information on file with SEC';

  // Format SEC Filings
  const filings: SecFilingItem[] = rawFilings.slice(0, 35).map((f: any) => {
    const rawType = (f.type || '8-K').toUpperCase();
    let category: SecFilingItem['category'] = 'OTHER';

    if (rawType.includes('10-K')) category = 'ANNUAL_REPORT';
    else if (rawType.includes('10-Q')) category = 'QUARTERLY_REPORT';
    else if (rawType.includes('8-K')) category = 'CURRENT_EVENT';
    else if (rawType.includes('14A') || rawType.includes('PROXY')) category = 'PROXY_VOTING';
    else if (rawType.includes('13G') || rawType.includes('13D') || rawType.includes('4')) category = 'INSIDER_OWNERSHIP';
    else if (rawType.includes('S-8') || rawType.includes('S-3') || rawType.includes('S-4')) category = 'REGISTRATION';

    let formattedDate = f.date || '';
    if (f.epochDate) {
      try {
        formattedDate = new Date(f.epochDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        formattedDate = f.date;
      }
    }

    return {
      date: f.date || '',
      formattedDate: formattedDate || f.date,
      formType: rawType,
      category,
      title: f.title || `${rawType} SEC Filing Submission`,
      edgarUrl: f.edgarUrl || `https://www.sec.gov/edgar/searchedgar/companysearch?companySearch=${ticker}`,
    };
  });

  // Direct SEC EDGAR search link
  const secEdgarSearchUrl = `https://www.sec.gov/edgar/searchedgar/companysearch?companySearch=${ticker}`;

  // Direct Google Presentation Search Link (Searches for latest PDF slide decks)
  const directPresentationSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `"${companyName}" "${ticker}" "Investor Presentation" OR "Earnings Presentation" filetype:pdf`
  )}`;

  // Featured Material Items
  const featuredMaterials: InvestorMaterialItem[] = [
    {
      id: 'latest_deck',
      title: `Latest Investor & Earnings Presentation (PDF)`,
      subtitle: `Official slide deck with financial targets, TAM forecasts & strategic execution priorities.`,
      category: 'PRESENTATION',
      url: directPresentationSearchUrl,
      isExternal: true,
      fileType: 'PDF',
    },
    {
      id: 'ir_portal',
      title: `${companyName} Official IR Portal`,
      subtitle: `Direct access to press releases, events, shareholder letters, and executive presentations.`,
      category: 'EARNINGS_DECK',
      url: irWebsite,
      isExternal: true,
      fileType: 'PORTAL',
    },
    {
      id: 'sec_edgar',
      title: `SEC EDGAR Complete Filings Directory`,
      subtitle: `Official Form 10-K Annual Reports, 10-Q Quarterly Audits, and 8-K Material Event Disclosures.`,
      category: 'SEC_DIRECTORY',
      url: secEdgarSearchUrl,
      isExternal: true,
      fileType: 'DIRECTORY',
    },
    {
      id: 'earnings_webcast',
      title: `Earnings Webcast & Conference Call Center`,
      subtitle: `Live audio broadcast, replay archive, and executive management Q&A sessions.`,
      category: 'WEBCAST',
      url: `${irWebsite}`,
      isExternal: true,
      fileType: 'WEBCAST',
    },
  ];

  // Next Earnings Date
  let nextEarningsDate = 'Upcoming Date Pending';
  if (calendar?.earnings?.earningsDate && calendar.earnings.earningsDate.length > 0) {
    try {
      const d = new Date(calendar.earnings.earningsDate[0]);
      nextEarningsDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      nextEarningsDate = 'Announced Soon';
    }
  }

  return {
    symbol: ticker,
    companyName,
    sector,
    industry,
    currentPrice,
    marketCap,
    officialWebsite,
    irWebsite,
    irPortalName,
    headquarters: {
      address: profile?.address1,
      city: profile?.city,
      state: profile?.state,
      zip: profile?.zip,
      country: profile?.country,
      fullAddress,
      phone: profile?.phone,
      employees: profile?.fullTimeEmployees,
    },
    latestPresentation: {
      title: `${companyName} Investor Presentation & Strategic Overview`,
      period: 'Latest Published Quarter / FY',
      description: `Official investor slide deck containing commercial growth metrics, segment breakdowns, capital allocation strategy, and financial guidance.`,
      directSearchUrl: directPresentationSearchUrl,
      irPageUrl: irWebsite,
    },
    featuredMaterials,
    filings,
    secEdgarSearchUrl,
    nextEarningsDate,
    generatedAt: new Date().toISOString(),
  };
}
