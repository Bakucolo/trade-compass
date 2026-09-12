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

export function clearDilutionCache(): void {
  DILUTION_CACHE.clear();
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, ms: number = 4000): Promise<Response> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new Error(`Fetch timed out after ${ms}ms: ${url}`)), ms);
    if (typeof (timer as any)?.unref === 'function') {
      (timer as any).unref();
    }
  });
  return Promise.race([
    fetch(url, options),
    timeoutPromise,
  ]);
}

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
    const res = await fetchWithTimeout('https://www.sec.gov/files/company_tickers.json', {
      headers: SEC_HEADERS,
    }, 4000);
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
    console.warn(`Failed to fetch SEC company_tickers.json: ${err instanceof Error ? err.message : err}`);
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

  // 1. Parallel ingestion: Quote Summary, Annual Fundamentals, Quarterly Fundamentals, and SEC CIK lookup
  const [quoteSummary, annualTsRaw, quarterlyTsRaw, cikInfo] = await Promise.all([
    yahooFinance.quoteSummary(cleanSymbol, {
      modules: ['price', 'defaultKeyStatistics', 'financialData', 'summaryDetail']
    }, { validateResult: false }).catch((e) => {
      console.warn(`[Dilution] quoteSummary failed for ${cleanSymbol}: ${e.message}`);
      return null;
    }),
    yahooFinance.fundamentalsTimeSeries(cleanSymbol, {
      period1: '2019-01-01',
      module: 'all',
      type: 'annual'
    }).catch((e) => {
      console.warn(`[Dilution] annual fundamentalsTimeSeries failed for ${cleanSymbol}: ${e.message}`);
      return [];
    }),
    yahooFinance.fundamentalsTimeSeries(cleanSymbol, {
      period1: '2022-01-01',
      module: 'all',
      type: 'quarterly'
    }).catch((e) => {
      console.warn(`[Dilution] quarterly fundamentalsTimeSeries failed for ${cleanSymbol}: ${e.message}`);
      return [];
    }),
    getSecCikForSymbol(cleanSymbol).catch(() => null),
  ]);

  const spotPrice = quoteSummary?.price?.regularMarketPrice || quoteSummary?.summaryDetail?.regularMarketPrice || 0;
  const marketCap = quoteSummary?.price?.marketCap || quoteSummary?.summaryDetail?.marketCap || 0;
  let totalRevenue = quoteSummary?.financialData?.totalRevenue || 0;
  const yfSharesOut = quoteSummary?.defaultKeyStatistics?.sharesOutstanding || 0;
  const yfDilutedShares = quoteSummary?.defaultKeyStatistics?.impliedSharesOutstanding || yfSharesOut;
  const companyName = quoteSummary?.price?.shortName || quoteSummary?.price?.longName || cleanSymbol;
  const cik = cikInfo?.cik || '0000000000';

  const sbcHistoryAnnual: SbcRecord[] = [];
  const sbcHistoryQuarterly: SbcRecord[] = [];
  const sharesHistory: ShareCountRecord[] = [];
  const equityIssuances: EquityIssuanceRecord[] = [];
  const shareBuybacks: ShareBuybackRecord[] = [];
  const recentFilings: DilutionSecFiling[] = [];

  const annualTs = Array.isArray(annualTsRaw) ? annualTsRaw : [];
  const quarterlyTs = Array.isArray(quarterlyTsRaw) ? quarterlyTsRaw : [];

  // --- 2. Process Annual Series from fundamentalsTimeSeries ---
  for (const item of annualTs) {
    if (!item.date) continue;
    const d = new Date(item.date);
    const yr = d.getFullYear();
    const dateStr = d.toISOString().split('T')[0];

    const sbc = item.stockBasedCompensation || 0;
    const rev = item.totalRevenue || 0;
    const shares = item.ordinarySharesNumber || item.dilutedAverageShares || item.shareIssued || 0;
    const buyback = Math.abs(item.repurchaseOfCapitalStock || 0);
    const issuance = Math.abs(item.issuanceOfCapitalStock || 0);

    if (rev > 0 && totalRevenue === 0) {
      totalRevenue = rev;
    }

    if (sbc > 0) {
      sbcHistoryAnnual.push({
        fiscalYear: yr,
        fiscalPeriod: 'FY',
        startDate: `${yr}-01-01`,
        endDate: dateStr,
        amountUSD: sbc,
        revenueUSD: rev > 0 ? rev : undefined,
        sbcPercentOfRevenue: rev > 0 ? Number(((sbc / rev) * 100).toFixed(2)) : undefined,
        form: '10-K',
        filedDate: dateStr,
      });
    }

    if (shares > 0) {
      sharesHistory.push({
        fiscalYear: yr,
        fiscalPeriod: 'FY',
        endDate: dateStr,
        sharesOutstanding: shares,
        dilutedShares: item.dilutedAverageShares || shares,
        form: '10-K',
        filedDate: dateStr,
      });
    }

    if (buyback > 0) {
      shareBuybacks.push({
        fiscalYear: yr,
        fiscalPeriod: 'FY',
        startDate: `${yr}-01-01`,
        endDate: dateStr,
        amountUSD: buyback,
        form: '10-K',
        filedDate: dateStr,
      });
    }

    if (issuance > 0) {
      equityIssuances.push({
        fiscalYear: yr,
        fiscalPeriod: 'FY',
        startDate: `${yr}-01-01`,
        endDate: dateStr,
        proceedsUSD: issuance,
        form: '10-K',
        filedDate: dateStr,
        type: 'ATM_OFFERING_OR_PUBLIC_OFFERING',
      });
    }
  }

  // --- 3. Process Quarterly Series from fundamentalsTimeSeries ---
  const quarterlyShares: ShareCountRecord[] = [];
  for (const item of quarterlyTs) {
    if (!item.date) continue;
    const d = new Date(item.date);
    const yr = d.getFullYear();
    const month = d.getMonth() + 1;
    const qPeriod = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
    const dateStr = d.toISOString().split('T')[0];

    const sbc = item.stockBasedCompensation || 0;
    const rev = item.totalRevenue || 0;
    const shares = item.ordinarySharesNumber || item.dilutedAverageShares || item.shareIssued || 0;
    const buyback = Math.abs(item.repurchaseOfCapitalStock || 0);
    const issuance = Math.abs(item.issuanceOfCapitalStock || 0);

    if (sbc > 0) {
      sbcHistoryQuarterly.push({
        fiscalYear: yr,
        fiscalPeriod: qPeriod,
        endDate: dateStr,
        amountUSD: sbc,
        revenueUSD: rev > 0 ? rev : undefined,
        sbcPercentOfRevenue: rev > 0 ? Number(((sbc / rev) * 100).toFixed(2)) : undefined,
        form: '10-Q',
        filedDate: dateStr,
      });
    }

    if (shares > 0) {
      quarterlyShares.push({
        fiscalYear: yr,
        fiscalPeriod: qPeriod,
        endDate: dateStr,
        sharesOutstanding: shares,
        dilutedShares: item.dilutedAverageShares || shares,
        form: '10-Q',
        filedDate: dateStr,
      });
    }

    if (buyback > 0) {
      shareBuybacks.push({
        fiscalYear: yr,
        fiscalPeriod: qPeriod,
        endDate: dateStr,
        amountUSD: buyback,
        form: '10-Q',
        filedDate: dateStr,
      });
    }

    if (issuance > 0) {
      equityIssuances.push({
        fiscalYear: yr,
        fiscalPeriod: qPeriod,
        endDate: dateStr,
        proceedsUSD: issuance,
        form: '10-Q',
        filedDate: dateStr,
        type: 'ATM_OFFERING_OR_PUBLIC_OFFERING',
      });
    }
  }

  // Merge recent quarterly shares into sharesHistory so users get the most current quarterly count
  if (quarterlyShares.length > 0) {
    const latestAnnualDate = sharesHistory.length > 0 ? sharesHistory[sharesHistory.length - 1].endDate : '';
    for (const q of quarterlyShares) {
      if (q.endDate > latestAnnualDate) {
        sharesHistory.push(q);
      }
    }
  }

  // If sharesHistory is still empty, populate with current quote data
  if (sharesHistory.length === 0 && yfSharesOut > 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    sharesHistory.push({
      fiscalYear: new Date().getFullYear(),
      fiscalPeriod: 'TTM',
      endDate: todayStr,
      sharesOutstanding: yfSharesOut,
      dilutedShares: yfDilutedShares,
      form: 'QUOTE',
      filedDate: todayStr,
    });
  }

  // --- 4. SEC EDGAR Submissions (Form 144, S-8, S-3 ATM Offerings Radar) ---
  if (cik && cik !== '0000000000') {
    try {
      const subRes = await fetchWithTimeout(`https://data.sec.gov/submissions/CIK${cik}.json`, {
        headers: SEC_HEADERS,
      }, 3500);

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
      // SEC submissions fetch failed or timed out; non-blocking
      console.warn(`[Dilution] SEC Submissions fetch aborted for ${cleanSymbol}: ${e instanceof Error ? e.message : e}`);
    }

    // --- 5. Optional SEC XBRL Company Facts Enrichment (Fast 2.5s timeout, non-blocking) ---
    // Only attempt if quarterly SBC history was empty from YF
    if (sbcHistoryQuarterly.length === 0) {
      try {
        const factsRes = await fetchWithTimeout(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
          headers: SEC_HEADERS,
        }, 2500);

        if (factsRes.ok) {
          const factsData = await factsRes.json();
          const usGaap = factsData.facts?.['us-gaap'] || {};
          const sbcConcept = usGaap['AllocatedShareBasedCompensationExpense'] ||
            usGaap['ShareBasedCompensation'] ||
            usGaap['ShareBasedCompensationArrangementByShareBasedPaymentAwardExpense'];

          if (sbcConcept?.units?.USD) {
            const sbcUnits: any[] = sbcConcept.units.USD;
            const qMap = new Map<string, SbcRecord>();

            for (const u of sbcUnits) {
              if (!u.val || u.val <= 0) continue;
              let isQuarter = u.fp && u.fp.startsWith('Q');
              if (u.start && u.end) {
                const diffDays = (new Date(u.end).getTime() - new Date(u.start).getTime()) / (1000 * 3600 * 24);
                if (diffDays < 130) isQuarter = true;
              }
              if (isQuarter) {
                const key = `${u.fy || new Date(u.end).getFullYear()}-${u.fp || 'Q'}`;
                qMap.set(key, {
                  fiscalYear: u.fy || new Date(u.end).getFullYear(),
                  fiscalPeriod: u.fp || 'Q',
                  startDate: u.start,
                  endDate: u.end,
                  amountUSD: u.val,
                  form: u.form || '10-Q',
                  filedDate: u.filed || u.end,
                });
              }
            }

            if (qMap.size > 0) {
              sbcHistoryQuarterly.push(...Array.from(qMap.values())
                .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
                .slice(-12));
            }
          }
        }
      } catch (e) {
        // Non-blocking fallback
      }
    }
  }

  // --- 6. Derived Calculations ---

  // A. Current Shares Outstanding
  const latestQuarterlyShares = quarterlyShares.length > 0 ? quarterlyShares[quarterlyShares.length - 1].sharesOutstanding : 0;
  const latestAnnualShares = sharesHistory.length > 0 ? sharesHistory[sharesHistory.length - 1].sharesOutstanding : 0;
  const currentShares = latestQuarterlyShares > 0 ? latestQuarterlyShares : (latestAnnualShares > 0 ? latestAnnualShares : (yfSharesOut || 1));

  // B. Annual SBC Amount
  const trailing4QSbc = sbcHistoryQuarterly.slice(-4).reduce((acc, q) => acc + q.amountUSD, 0);
  const latestAnnualSbc = sbcHistoryAnnual.length > 0 ? sbcHistoryAnnual[sbcHistoryAnnual.length - 1].amountUSD : 0;
  const annualSbcUSD = trailing4QSbc > 0 ? trailing4QSbc : latestAnnualSbc;

  // C. SBC % of Revenue
  const sbcPercentOfRevenue = totalRevenue > 0 ? (annualSbcUSD / totalRevenue) * 100 : 0;

  // D. SBC Per Share Drag
  const sbcPerShareUSD = currentShares > 0 ? annualSbcUSD / currentShares : 0;

  // E. Annual Buybacks & ATM Proceeds (Latest full year or trailing 4 quarters)
  const annualBuybackRecords = shareBuybacks.filter(b => b.fiscalPeriod === 'FY');
  const annualBuybacksUSD = annualBuybackRecords.length > 0
    ? annualBuybackRecords[annualBuybackRecords.length - 1].amountUSD
    : shareBuybacks.filter(b => b.fiscalPeriod !== 'FY').slice(-4).reduce((acc, b) => acc + b.amountUSD, 0);

  const annualIssuanceRecords = equityIssuances.filter(i => i.fiscalPeriod === 'FY');
  const annualAtmProceedsUSD = annualIssuanceRecords.length > 0
    ? annualIssuanceRecords[annualIssuanceRecords.length - 1].proceedsUSD
    : equityIssuances.filter(i => i.fiscalPeriod !== 'FY').slice(-4).reduce((acc, i) => acc + i.proceedsUSD, 0);

  // F. Historical Share Dilution Velocity (YoY, 3-Yr CAGR, 5-Yr CAGR)
  let netDilutionRateYoY = 0;
  if (quarterlyShares.length >= 5) {
    const latestQ = quarterlyShares[quarterlyShares.length - 1].sharesOutstanding;
    const prior4Q = quarterlyShares[quarterlyShares.length - 5].sharesOutstanding;
    if (prior4Q > 0) {
      netDilutionRateYoY = ((latestQ - prior4Q) / prior4Q) * 100;
    }
  } else if (sharesHistory.length >= 2) {
    const latest = sharesHistory[sharesHistory.length - 1].sharesOutstanding;
    const prior = sharesHistory[Math.max(0, sharesHistory.length - 2)].sharesOutstanding;
    if (prior > 0) {
      netDilutionRateYoY = ((latest - prior) / prior) * 100;
    }
  }

  // 3-Yr CAGR
  let threeYearCagrDilution = 0;
  const annualSharesList = sharesHistory.filter(s => s.fiscalPeriod === 'FY');
  if (annualSharesList.length >= 4) {
    const latestA = annualSharesList[annualSharesList.length - 1].sharesOutstanding;
    const threeYrsAgo = annualSharesList[annualSharesList.length - 4].sharesOutstanding;
    if (threeYrsAgo > 0 && latestA > 0) {
      threeYearCagrDilution = (Math.pow(latestA / threeYrsAgo, 1 / 3) - 1) * 100;
    }
  } else if (quarterlyShares.length >= 12) {
    const latestQ = quarterlyShares[quarterlyShares.length - 1].sharesOutstanding;
    const twelveQAgo = quarterlyShares[quarterlyShares.length - 12].sharesOutstanding;
    if (twelveQAgo > 0 && latestQ > 0) {
      threeYearCagrDilution = (Math.pow(latestQ / twelveQAgo, 1 / 3) - 1) * 100;
    }
  } else {
    threeYearCagrDilution = netDilutionRateYoY;
  }

  // 5-Yr CAGR
  let fiveYearCagrDilution = 0;
  if (annualSharesList.length >= 6) {
    const latestA = annualSharesList[annualSharesList.length - 1].sharesOutstanding;
    const fiveYrsAgo = annualSharesList[0].sharesOutstanding;
    const spanYears = Math.max(1, annualSharesList.length - 1);
    if (fiveYrsAgo > 0 && latestA > 0) {
      fiveYearCagrDilution = (Math.pow(latestA / fiveYrsAgo, 1 / spanYears) - 1) * 100;
    }
  } else {
    fiveYearCagrDilution = threeYearCagrDilution;
  }

  // G. Shareholder Yield (Buyback Yield - Net Share Dilution)
  const buybackYield = marketCap > 0 ? (annualBuybacksUSD / marketCap) * 100 : 0;
  const shareholderYieldPercent = buybackYield - netDilutionRateYoY;

  // H. Active ATM Shelf Offerings Detection
  const hasActiveAtmShelf = recentFilings.some(f => f.category === 'ATM_SHELF_OFFERING');
  const activeAtmFiling = recentFilings.find(f => f.category === 'ATM_SHELF_OFFERING');
  const activeAtmDetails = hasActiveAtmShelf
    ? `Active Shelf / Prospectus Supplement filed (${activeAtmFiling?.form || 'S-3'} on ${activeAtmFiling?.filingDate || 'recent'})`
    : 'No active ATM shelf prospectus detected in recent SEC registrations.';

  // I. Dilution Risk Rating & Health Score
  let dilutionRiskScore = 75; // 0 to 100
  let dilutionRiskTier: 'ACCRETIVE' | 'LOW' | 'MODERATE' | 'ELEVATED' | 'SEVERE' = 'MODERATE';
  let riskBadgeColor: 'emerald' | 'cyan' | 'amber' | 'orange' | 'rose' = 'cyan';
  let dilutionVerdict = '';

  if (netDilutionRateYoY < -0.5) {
    dilutionRiskTier = 'ACCRETIVE';
    riskBadgeColor = 'emerald';
    dilutionRiskScore = Math.min(100, 85 + Math.abs(netDilutionRateYoY) * 3);
    dilutionVerdict = `Highly accretive capital allocation (negative net dilution): share count is shrinking at ${Math.abs(netDilutionRateYoY).toFixed(1)}% annually due to aggressive stock repurchases that outpace any SBC grants.`;
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
    sbcHistoryQuarterly: sbcHistoryQuarterly.slice(-12),
    sbcHistoryAnnual: sbcHistoryAnnual.slice(-5),
    sharesHistory: sharesHistory.slice(-16),
    equityIssuances: equityIssuances.slice(0, 8),
    shareBuybacks: shareBuybacks.slice(0, 8),
    recentDilutionFilings: recentFilings.slice(0, 15),
    hasActiveAtmShelf,
    activeAtmDetails,
    analyzedAt: new Date().toISOString(),
  };

  // Only cache if we got meaningful data
  if (result.sharesOutstanding > 0 || result.sbcHistoryAnnual.length > 0 || result.sbcHistoryQuarterly.length > 0) {
    DILUTION_CACHE.set(cleanSymbol, { data: result, timestamp: now });
  }

  return result;
}
