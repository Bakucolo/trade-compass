import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  validation: { logErrors: false }
});

export interface SbcRecord {
  fiscalYear: number;
  fiscalPeriod: string; // 'Q1', 'Q2', 'Q3', 'Q4', 'FY'
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
  dilutionRiskScore: number; // 0 (Worst) to 100 (Best/Most Accretive)
  riskBadgeColor: 'emerald' | 'cyan' | 'amber' | 'orange' | 'rose';
  dilutionVerdict: string;
  
  // Annualized Overview Metrics
  annualSbcUSD: number;
  sbcPercentOfRevenue: number;
  sbcPerShareUSD: number;
  annualAtmProceedsUSD: number;
  annualBuybacksUSD: number;
  netDilutionRateYoY: number; // e.g. +3.2% or -1.5%
  threeYearCagrDilution: number;
  fiveYearCagrDilution: number;
  shareholderYieldPercent: number; // Buyback Yield - Dilution Rate
  
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

// In-Memory Caches
let secCikMapCache: Record<string, { cik: string; title: string }> | null = null;
let secCikMapLastFetched = 0;
const DILUTION_CACHE = new Map<string, { data: DilutionAnalysisData; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const SEC_HEADERS = {
  'User-Agent': 'TradeCompass Research info@tradecompass.app',
  'Accept-Encoding': 'gzip, deflate',
};

// Fetch and cache SEC CIK mapping from SEC official repository
export async function getSecCikForSymbol(symbol: string): Promise<{ cik: string; title: string } | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const now = Date.now();

  if (secCikMapCache && (now - secCikMapLastFetched < 24 * 60 * 60 * 1000)) {
    return secCikMapCache[cleanSymbol] || null;
  }

  try {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: SEC_HEADERS });
    if (res.ok) {
      const data = await res.json();
      const map: Record<string, { cik: string; title: string }> = {};
      for (const key of Object.keys(data)) {
        const item = data[key];
        if (item && item.ticker) {
          map[item.ticker.toUpperCase()] = {
            cik: String(item.cik_str).padStart(10, '0'),
            title: item.title,
          };
        }
      }
      secCikMapCache = map;
      secCikMapLastFetched = now;
      return secCikMapCache[cleanSymbol] || null;
    }
  } catch (err) {
    console.error('Failed to fetch SEC company_tickers.json:', err);
  }

  return null;
}

export async function fetchDilutionAnalysis(symbol: string): Promise<DilutionAnalysisData> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const now = Date.now();

  // Check cache
  const cached = DILUTION_CACHE.get(cleanSymbol);
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  // 1. Fetch live Yahoo Finance fundamental context (spot price, revenue, market cap)
  let yfQuote: any = null;
  try {
    yfQuote = await yahooFinance.quoteSummary(cleanSymbol, {
      modules: ['price', 'defaultKeyStatistics', 'financialData', 'summaryDetail']
    }, { validateResult: false });
  } catch (e) {
    // continue
  }

  const spotPrice = yfQuote?.price?.regularMarketPrice || 0;
  const marketCap = yfQuote?.price?.marketCap || yfQuote?.summaryDetail?.marketCap || 0;
  const totalRevenue = yfQuote?.financialData?.totalRevenue || 0;
  const yfSharesOut = yfQuote?.defaultKeyStatistics?.sharesOutstanding || 0;
  const yfDilutedShares = yfQuote?.defaultKeyStatistics?.impliedSharesOutstanding || yfSharesOut;
  const companyName = yfQuote?.price?.shortName || yfQuote?.price?.longName || cleanSymbol;

  // 2. Lookup SEC CIK
  const cikInfo = await getSecCikForSymbol(cleanSymbol);
  const cik = cikInfo?.cik || '0000000000';

  let sbcHistoryQuarterly: SbcRecord[] = [];
  let sbcHistoryAnnual: SbcRecord[] = [];
  let sharesHistory: ShareCountRecord[] = [];
  let equityIssuances: EquityIssuanceRecord[] = [];
  let shareBuybacks: ShareBuybackRecord[] = [];
  let recentFilings: DilutionSecFiling[] = [];

  if (cik && cik !== '0000000000') {
    try {
      // 3. Fetch SEC XBRL Company Facts
      const factsRes = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
        headers: SEC_HEADERS
      });

      if (factsRes.ok) {
        const factsData = await factsRes.json();
        const usGaap = factsData.facts?.['us-gaap'] || {};

        // --- A. Stock-Based Compensation (SBC) ---
        const sbcConcept = usGaap['AllocatedShareBasedCompensationExpense'] ||
          usGaap['ShareBasedCompensation'] ||
          usGaap['ShareBasedCompensationArrangementByShareBasedPaymentAwardExpense'] ||
          usGaap['ShareBasedCompensationArrangementsByShareBasedPaymentAwardOptionsGrantsInPeriodWeightedAverageExercisePrice'];

        if (sbcConcept?.units?.USD) {
          const sbcUnits: any[] = sbcConcept.units.USD;
          
          // Quarterly units (duration ~3 months or frame like CY2024Q1)
          const qMap = new Map<string, SbcRecord>();
          const aMap = new Map<number, SbcRecord>();

          for (const u of sbcUnits) {
            if (!u.val || u.val <= 0) continue;
            
            // Check if annual (FY or duration >= 300 days)
            let isAnnual = u.fp === 'FY' || u.form === '10-K';
            if (u.start && u.end) {
              const diffDays = (new Date(u.end).getTime() - new Date(u.start).getTime()) / (1000 * 3600 * 24);
              if (diffDays > 270) isAnnual = true;
              else if (diffDays < 130) isAnnual = false;
            }

            if (isAnnual) {
              const yr = u.fy || new Date(u.end).getFullYear();
              if (!aMap.has(yr) || u.form === '10-K') {
                aMap.set(yr, {
                  fiscalYear: yr,
                  fiscalPeriod: 'FY',
                  startDate: u.start,
                  endDate: u.end,
                  amountUSD: u.val,
                  form: u.form,
                  filedDate: u.filed,
                });
              }
            } else {
              const key = `${u.fy || new Date(u.end).getFullYear()}-${u.fp || 'Q'}`;
              qMap.set(key, {
                fiscalYear: u.fy || new Date(u.end).getFullYear(),
                fiscalPeriod: u.fp || 'Q',
                startDate: u.start,
                endDate: u.end,
                amountUSD: u.val,
                form: u.form,
                filedDate: u.filed,
              });
            }
          }

          sbcHistoryQuarterly = Array.from(qMap.values())
            .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
            .slice(-12);

          sbcHistoryAnnual = Array.from(aMap.values())
            .sort((a, b) => a.fiscalYear - b.fiscalYear)
            .slice(-5);
        }

        // --- B. Shares Outstanding History ---
        const sharesConcept = usGaap['CommonStockSharesOutstanding'] ||
          usGaap['WeightedAverageNumberOfDilutedSharesOutstanding'] ||
          usGaap['WeightedAverageNumberOfSharesOutstandingBasic'];

        if (sharesConcept?.units?.shares) {
          const shareUnits: any[] = sharesConcept.units.shares;
          const shareMap = new Map<string, ShareCountRecord>();

          for (const u of shareUnits) {
            if (!u.val || u.val <= 0) continue;
            const key = u.end;
            shareMap.set(key, {
              fiscalYear: u.fy || new Date(u.end).getFullYear(),
              fiscalPeriod: u.fp || 'Q',
              endDate: u.end,
              sharesOutstanding: u.val,
              dilutedShares: u.val,
              form: u.form,
              filedDate: u.filed,
            });
          }

          sharesHistory = Array.from(shareMap.values())
            .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
            .slice(-16);
        }

        // --- C. Stock Issuance & ATM Offerings ---
        const issuanceConcept = usGaap['ProceedsFromIssuanceOfCommonStock'] ||
          usGaap['StockIssuedDuringPeriodValueNewIssues'] ||
          usGaap['ProceedsFromIssuanceOrSaleOfEquity'];

        if (issuanceConcept?.units?.USD) {
          const issUnits: any[] = issuanceConcept.units.USD;
          const issMap = new Map<string, EquityIssuanceRecord>();

          for (const u of issUnits) {
            if (u.val === undefined || u.val === null) continue;
            const key = `${u.end}-${u.form}`;
            issMap.set(key, {
              fiscalYear: u.fy || new Date(u.end).getFullYear(),
              fiscalPeriod: u.fp || (u.form === '10-K' ? 'FY' : 'Q'),
              startDate: u.start,
              endDate: u.end,
              proceedsUSD: u.val,
              form: u.form,
              filedDate: u.filed,
              type: 'ATM_OFFERING_OR_PUBLIC_OFFERING',
            });
          }

          equityIssuances = Array.from(issMap.values())
            .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
            .slice(0, 8);
        }

        // --- D. Share Buybacks / Repurchases ---
        const buybackConcept = usGaap['PaymentsForRepurchaseOfCommonStock'] ||
          usGaap['StockRepurchasedDuringPeriodValue'] ||
          usGaap['StockRepurchasedAndRetiredDuringPeriodValue'];

        if (buybackConcept?.units?.USD) {
          const bbUnits: any[] = buybackConcept.units.USD;
          const bbMap = new Map<string, ShareBuybackRecord>();

          for (const u of bbUnits) {
            if (!u.val || u.val <= 0) continue;
            const key = `${u.end}-${u.form}`;
            bbMap.set(key, {
              fiscalYear: u.fy || new Date(u.end).getFullYear(),
              fiscalPeriod: u.fp || (u.form === '10-K' ? 'FY' : 'Q'),
              startDate: u.start,
              endDate: u.end,
              amountUSD: u.val,
              form: u.form,
              filedDate: u.filed,
            });
          }

          shareBuybacks = Array.from(bbMap.values())
            .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
            .slice(0, 8);
        }
      }
    } catch (e) {
      console.error(`SEC XBRL Company facts fetch failed for ${cleanSymbol}:`, e);
    }

    try {
      // 4. Fetch SEC Submissions to inspect recent ATM prospectus supplements (424B5), Shelf registrations (S-3), and S-8 filings
      const subRes = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
        headers: SEC_HEADERS
      });

      if (subRes.ok) {
        const subData = await subRes.json();
        const recent = subData.filings?.recent;
        if (recent && recent.form) {
          const len = recent.form.length;
          for (let i = 0; i < Math.min(len, 100); i++) {
            const form = recent.form[i];
            const accn = recent.accessionNumber[i];
            const doc = recent.primaryDocument[i];
            const cleanAccn = accn?.replace(/-/g, '');
            const edgarUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${cleanAccn}/${doc}`;

            if (form.startsWith('S-3') || form.startsWith('424B5') || form === 'POS AM' || form === 'F-3ASR') {
              recentFilings.push({
                form,
                filingDate: recent.filingDate[i],
                reportDate: recent.reportDate[i],
                accessionNumber: accn,
                description: recent.primaryDocDescription[i] || 'At-The-Market (ATM) / Shelf Equity Offering Registration',
                edgarUrl,
                category: 'ATM_SHELF_OFFERING',
              });
            } else if (form.startsWith('S-8')) {
              recentFilings.push({
                form,
                filingDate: recent.filingDate[i],
                reportDate: recent.reportDate[i],
                accessionNumber: accn,
                description: recent.primaryDocDescription[i] || 'Securities Offered to Employees / Stock Incentive Plan (SBC Pool)',
                edgarUrl,
                category: 'EQUITY_INCENTIVE_SBC',
              });
            } else if (form === '144') {
              recentFilings.push({
                form,
                filingDate: recent.filingDate[i],
                reportDate: recent.reportDate[i],
                accessionNumber: accn,
                description: recent.primaryDocDescription[i] || 'Proposed Sale of Restricted / Equity Compensation Securities',
                edgarUrl,
                category: 'INSIDER_PROPOSED_SALE',
              });
            }
          }
        }
      }
    } catch (e) {
      console.error(`SEC submissions fetch failed for ${cleanSymbol}:`, e);
    }
  }

  // --- Derived Calculations ---

  // 1. Annual SBC Amount
  const latestAnnualSbc = sbcHistoryAnnual.length > 0 ? sbcHistoryAnnual[sbcHistoryAnnual.length - 1].amountUSD : 0;
  const trailing4QSbc = sbcHistoryQuarterly.slice(-4).reduce((sum, r) => sum + r.amountUSD, 0);
  const annualSbcUSD = latestAnnualSbc > 0 ? latestAnnualSbc : trailing4QSbc;

  // 2. SBC % of Revenue
  const sbcPercentOfRevenue = totalRevenue > 0 ? (annualSbcUSD / totalRevenue) * 100 : 0;

  // 3. Current Shares Outstanding
  const latestSharesRecord = sharesHistory.length > 0 ? sharesHistory[sharesHistory.length - 1].sharesOutstanding : yfSharesOut;
  const currentShares = latestSharesRecord > 0 ? latestSharesRecord : (yfSharesOut || 1);
  const sbcPerShareUSD = currentShares > 0 ? annualSbcUSD / currentShares : 0;

  // 4. Annual ATM Proceeds & Buybacks
  const annualAtmProceedsUSD = equityIssuances
    .filter(r => r.fiscalPeriod === 'FY' || (new Date().getFullYear() - r.fiscalYear <= 1))
    .reduce((sum, r) => sum + r.proceedsUSD, 0);

  const annualBuybacksUSD = shareBuybacks
    .filter(r => r.fiscalPeriod === 'FY' || (new Date().getFullYear() - r.fiscalYear <= 1))
    .reduce((sum, r) => sum + r.amountUSD, 0);

  // 5. Historical Share Dilution Velocity (YoY, 3-Yr CAGR, 5-Yr CAGR)
  let netDilutionRateYoY = 0;
  if (sharesHistory.length >= 5) {
    const latest = sharesHistory[sharesHistory.length - 1].sharesOutstanding;
    const priorYear = sharesHistory[Math.max(0, sharesHistory.length - 5)].sharesOutstanding;
    if (priorYear > 0) {
      netDilutionRateYoY = ((latest - priorYear) / priorYear) * 100;
    }
  } else if (sharesHistory.length >= 2) {
    const latest = sharesHistory[sharesHistory.length - 1].sharesOutstanding;
    const oldest = sharesHistory[0].sharesOutstanding;
    if (oldest > 0) {
      netDilutionRateYoY = ((latest - oldest) / oldest) * 100;
    }
  }

  let threeYearCagrDilution = 0;
  if (sharesHistory.length >= 12) {
    const latest = sharesHistory[sharesHistory.length - 1].sharesOutstanding;
    const threeYearsAgo = sharesHistory[Math.max(0, sharesHistory.length - 12)].sharesOutstanding;
    if (threeYearsAgo > 0 && latest > 0) {
      threeYearCagrDilution = (Math.pow(latest / threeYearsAgo, 1 / 3) - 1) * 100;
    }
  } else {
    threeYearCagrDilution = netDilutionRateYoY;
  }

  let fiveYearCagrDilution = 0;
  if (sharesHistory.length >= 16) {
    const latest = sharesHistory[sharesHistory.length - 1].sharesOutstanding;
    const fiveYearsAgo = sharesHistory[0].sharesOutstanding;
    if (fiveYearsAgo > 0 && latest > 0) {
      const years = Math.max(1, (new Date(sharesHistory[sharesHistory.length - 1].endDate).getFullYear() - new Date(sharesHistory[0].endDate).getFullYear()));
      fiveYearCagrDilution = (Math.pow(latest / fiveYearsAgo, 1 / years) - 1) * 100;
    }
  } else {
    fiveYearCagrDilution = threeYearCagrDilution;
  }

  // 6. Shareholder Yield (Buyback Yield - Net Share Dilution)
  const buybackYield = marketCap > 0 ? (annualBuybacksUSD / marketCap) * 100 : 0;
  const shareholderYieldPercent = buybackYield - netDilutionRateYoY;

  // 7. Active ATM Offerings Detection
  const hasActiveAtmShelf = recentFilings.some(f => f.category === 'ATM_SHELF_OFFERING');
  const activeAtmDetails = hasActiveAtmShelf
    ? `Active Shelf / Prospectus Supplement filed (${recentFilings.find(f => f.category === 'ATM_SHELF_OFFERING')?.form || 'S-3'} on ${recentFilings.find(f => f.category === 'ATM_SHELF_OFFERING')?.filingDate || 'recent'})`
    : 'No active ATM shelf prospectus detected in recent SEC filings.';

  // 8. Dilution Risk Rating & Health Score
  let dilutionRiskScore = 75; // 0 to 100
  let dilutionRiskTier: 'ACCRETIVE' | 'LOW' | 'MODERATE' | 'ELEVATED' | 'SEVERE' = 'MODERATE';
  let riskBadgeColor: 'emerald' | 'cyan' | 'amber' | 'orange' | 'rose' = 'cyan';
  let dilutionVerdict = '';

  if (netDilutionRateYoY < -0.5) {
    dilutionRiskTier = 'ACCRETIVE';
    riskBadgeColor = 'emerald';
    dilutionRiskScore = Math.min(100, 85 + Math.abs(netDilutionRateYoY) * 3);
    dilutionVerdict = `Highly accretive capital allocation: share count is shrinking at ${Math.abs(netDilutionRateYoY).toFixed(1)}% annually due to aggressive stock repurchases that far outpace any SBC.`;
  } else if (netDilutionRateYoY <= 1.5 && sbcPercentOfRevenue < 5.0) {
    dilutionRiskTier = 'LOW';
    riskBadgeColor = 'emerald';
    dilutionRiskScore = 80;
    dilutionVerdict = `Minimal shareholder dilution: annual share inflation is subdued at ${netDilutionRateYoY.toFixed(1)}%/yr with modest stock compensation (${sbcPercentOfRevenue.toFixed(1)}% of revenue).`;
  } else if (netDilutionRateYoY <= 4.5 && sbcPercentOfRevenue < 15.0) {
    dilutionRiskTier = 'MODERATE';
    riskBadgeColor = 'cyan';
    dilutionRiskScore = 65;
    dilutionVerdict = `Moderate growth-stage dilution: annual share growth of ${netDilutionRateYoY.toFixed(1)}% driven primarily by standard tech equity compensation packages (${sbcPercentOfRevenue.toFixed(1)}% of revenue).`;
  } else if (netDilutionRateYoY <= 9.0 || sbcPercentOfRevenue >= 25.0) {
    dilutionRiskTier = 'ELEVATED';
    riskBadgeColor = 'orange';
    dilutionRiskScore = 40;
    dilutionVerdict = `Elevated dilution pressure: company is expanding shares at ${netDilutionRateYoY.toFixed(1)}%/yr with heavy stock compensation (${sbcPercentOfRevenue.toFixed(1)}% of revenue) creating persistent overhead selling.`;
  } else {
    dilutionRiskTier = 'SEVERE';
    riskBadgeColor = 'rose';
    dilutionRiskScore = 15;
    dilutionVerdict = `Severe shareholder dilution: aggressive share printing (${netDilutionRateYoY.toFixed(1)}% YoY) or active At-The-Market (ATM) equity offerings continuously diluting existing equity holders.`;
  }

  const result: DilutionAnalysisData = {
    symbol: cleanSymbol,
    companyName,
    cik,
    marketCap,
    spotPrice,
    sharesOutstanding: currentShares,
    dilutedSharesOutstanding: yfDilutedShares || currentShares,
    dilutionRiskTier,
    dilutionRiskScore: Math.round(dilutionRiskScore),
    riskBadgeColor,
    dilutionVerdict,
    annualSbcUSD,
    sbcPercentOfRevenue: Number(sbcPercentOfRevenue.toFixed(2)),
    sbcPerShareUSD: Number(sbcPerShareUSD.toFixed(2)),
    annualAtmProceedsUSD,
    annualBuybacksUSD,
    netDilutionRateYoY: Number(netDilutionRateYoY.toFixed(2)),
    threeYearCagrDilution: Number(threeYearCagrDilution.toFixed(2)),
    fiveYearCagrDilution: Number(fiveYearCagrDilution.toFixed(2)),
    shareholderYieldPercent: Number(shareholderYieldPercent.toFixed(2)),
    sbcHistoryQuarterly,
    sbcHistoryAnnual,
    sharesHistory,
    equityIssuances,
    shareBuybacks,
    recentDilutionFilings: recentFilings.slice(0, 15),
    hasActiveAtmShelf,
    activeAtmDetails,
    analyzedAt: new Date().toISOString(),
  };

  DILUTION_CACHE.set(cleanSymbol, { data: result, timestamp: now });
  return result;
}
