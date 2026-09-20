import YahooFinance from 'yahoo-finance2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false },
});

const FX_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  GBP: 1.302,
  EUR: 1.085,
  CAD: 0.741,
  AUD: 0.655,
  JPY: 0.0067,
  CHF: 1.13,
};

function getLocalFxRateToUSD(currency?: string): number {
  if (!currency) return 1.0;
  const c = currency.toUpperCase();
  return FX_RATES_TO_USD[c] ?? 1.0;
}

export interface DividendHoldingItem {
  symbol: string;
  name: string;
  assetType: string;
  sector: string;
  currency: string;
  shares: number;
  currentPrice: number;
  marketValue: number;
  marketValueUSD: number;
  costBasis: number;
  isDividendPayer: boolean;
  dividendRate: number; // annual dividend per share in native currency
  dividendRateUSD: number;
  dividendYield: number; // percentage (e.g. 3.45%)
  payoutRatio: number | null; // percentage
  fiveYearAvgYield: number | null; // percentage
  exDividendDate: string | null;
  dividendDate: string | null;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'UNKNOWN';
  paymentMonths: number[]; // 1 to 12
  historicalRaise1Y: number | null; // % increase over last 12 months
  historicalRaise3YAvg: number | null; // 3-year annualized CAGR %
  expectedRaisePercent: number; // projected % raise for forward 1Y
  expectedRaiseSource: 'HISTORICAL_1Y' | 'HISTORICAL_3Y_CAGR' | 'FORWARD_ESTIMATE' | 'DEFAULT_CONSERVATIVE' | 'USER_OVERRIDE' | 'NONE';
  currentAnnualIncome: number; // shares * dividendRate in native currency
  currentAnnualIncomeUSD: number;
  projectedAnnualIncome: number; // currentAnnualIncome * (1 + raise/100)
  projectedAnnualIncomeUSD: number;
  incrementalRaiseIncome: number; // projected - current
  incrementalRaiseIncomeUSD: number;
}

export interface MonthlyIncomeItem {
  month: number; // 1 to 12
  monthName: string; // 'Jan', 'Feb', etc.
  expectedIncomeUSD: number;
  holdingsCount: number;
  topTickers: string[];
}

export interface PortfolioDividendIncomeReport {
  totalPortfolioValueUSD: number;
  totalDividendHoldingsValueUSD: number;
  totalHoldingsCount: number;
  dividendPayerCount: number;
  nonDividendPayerCount: number;
  portfolioDividendCoveragePct: number; // % of portfolio market value that pays dividends
  currentAnnualIncomeUSD: number;
  projectedAnnualIncomeUSD: number;
  incrementalRaiseIncomeUSD: number;
  totalProjectedRaisePct: number; // (incremental / current) * 100
  portfolioWeightedYield: number; // (currentAnnualIncome / totalPortfolioValue) * 100
  dividendPayersWeightedYield: number; // (currentAnnualIncome / totalDividendHoldingsValue) * 100
  portfolioWeightedExpectedRaise: number; // weighted average raise % across dividend payers
  monthlyAverageIncomeUSD: number;
  monthlyRunRateUSD: number;
  monthlyDistribution: MonthlyIncomeItem[];
  holdings: DividendHoldingItem[];
  topIncomeGenerators: Array<{ symbol: string; name: string; incomeUSD: number; percentOfTotal: number }>;
  highestDividendGrowers: Array<{ symbol: string; name: string; raisePercent: number; incomeUSD: number }>;
  sectorBreakdown: Array<{ sector: string; incomeUSD: number; yieldPct: number; percentOfTotal: number }>;
  lastCalculatedAt: string;
}

interface CacheEntry {
  timestamp: number;
  report: PortfolioDividendIncomeReport;
}

// In-memory cache for 10 minutes
let cachedReport: CacheEntry | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Normalizes stock ticker for Yahoo Finance query
 */
function normalizeTicker(rawSymbol: string): string {
  let s = (rawSymbol || '').trim().toUpperCase();
  if (!s) return '';
  // Convert dot notation for class shares (e.g. BRK.B -> BRK-B) unless it's a London .L ticker or Toronto .TO
  if (s.endsWith('.L') || s.endsWith('.TO') || s.endsWith('.DE') || s.endsWith('.PA')) {
    return s;
  }
  if (s.includes('.')) {
    return s.replace('.', '-');
  }
  return s;
}

/**
 * Fetch dividend stats and historical raises for a single ticker
 */
async function fetchTickerDividendData(
  symbol: string,
  userOverrideRaise?: number
): Promise<{
  name: string;
  sector: string;
  currency: string;
  currentPrice: number;
  dividendRate: number;
  dividendYield: number;
  payoutRatio: number | null;
  fiveYearAvgYield: number | null;
  exDividendDate: string | null;
  dividendDate: string | null;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'UNKNOWN';
  paymentMonths: number[];
  historicalRaise1Y: number | null;
  historicalRaise3YAvg: number | null;
  expectedRaisePercent: number;
  expectedRaiseSource: DividendHoldingItem['expectedRaiseSource'];
}> {
  const normalized = normalizeTicker(symbol);
  const now = new Date();
  const d1 = new Date();
  d1.setFullYear(d1.getFullYear() - 4); // 4 years of history

  try {
    const summary = await yahooFinance.quoteSummary(normalized, {
      modules: ['summaryDetail', 'price', 'defaultKeyStatistics', 'calendarEvents'],
    }).catch(() => null);

    const priceModule = summary?.price;
    const summaryDetail = summary?.summaryDetail;
    const keyStats = summary?.defaultKeyStatistics;
    const calendar = summary?.calendarEvents;

    let dividendRate = summaryDetail?.dividendRate ?? summaryDetail?.trailingAnnualDividendRate ?? 0;
    let dividendYield = summaryDetail?.dividendYield ? summaryDetail.dividendYield * 100 : 0;

    let hist: any[] = [];
    // Only query historical events if the stock actually pays a dividend
    if (dividendRate > 0 || dividendYield > 0 || (summaryDetail?.trailingAnnualDividendYield && summaryDetail.trailingAnnualDividendYield > 0)) {
      hist = await yahooFinance.historical(normalized, {
        period1: d1,
        period2: now,
        events: 'dividends',
      }).catch(() => []);
    }

    const name = priceModule?.shortName || priceModule?.longName || symbol;
    const sector = summary?.summaryDetail ? (summary as any)?.assetProfile?.sector || 'Diversified' : 'Equities';
    let currency = (priceModule?.currency || 'USD').toUpperCase();
    if (currency === 'GBX' || currency === 'GBP') {
      currency = 'GBP';
    }

    let currentPrice = priceModule?.regularMarketPrice || 0;
    // For UK GBp pence quotes, price is quoted in pence (e.g. 4196p = £41.96)
    if (priceModule?.currency === 'GBp' && currentPrice > 100) {
      currentPrice = currentPrice / 100;
      currency = 'GBP';
    }

    dividendRate = summaryDetail?.dividendRate ?? summaryDetail?.trailingAnnualDividendRate ?? 0;
    dividendYield = summaryDetail?.dividendYield ? summaryDetail.dividendYield * 100 : 0;

    // Fix for UK London stocks where dividendRate is in GBP (e.g. 2.45) while price might be GBp
    if (dividendRate <= 0 && summaryDetail?.trailingAnnualDividendYield && currentPrice > 0) {
      dividendRate = currentPrice * summaryDetail.trailingAnnualDividendYield;
      dividendYield = summaryDetail.trailingAnnualDividendYield * 100;
    }

    const payoutRatio = summaryDetail?.payoutRatio ? Math.round(summaryDetail.payoutRatio * 10000) / 100 : null;
    const fiveYearAvgYield = summaryDetail?.fiveYearAvgDividendYield ? Math.round(summaryDetail.fiveYearAvgDividendYield * 100) / 100 : null;

    const exDividendDate = summaryDetail?.exDividendDate ? new Date(summaryDetail.exDividendDate).toISOString() : null;
    const dividendDate = calendar?.dividendDate ? new Date(calendar.dividendDate).toISOString() : null;

    // Analyze historical dividend payment events to calculate frequency and raise %
    const divEvents = (hist || []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'UNKNOWN' = 'UNKNOWN';
    const paymentMonthsSet = new Set<number>();

    if (divEvents.length >= 2) {
      // Find average spacing between last 4 events
      const recent = divEvents.slice(-6);
      for (const ev of recent) {
        const d = new Date(ev.date);
        paymentMonthsSet.add(d.getMonth() + 1); // 1 to 12
      }

      if (recent.length >= 2) {
        const lastDate = new Date(recent[recent.length - 1].date).getTime();
        const prevDate = new Date(recent[recent.length - 2].date).getTime();
        const daysDiff = Math.abs(lastDate - prevDate) / (1000 * 60 * 60 * 24);

        if (daysDiff >= 20 && daysDiff <= 45) frequency = 'MONTHLY';
        else if (daysDiff >= 65 && daysDiff <= 115) frequency = 'QUARTERLY';
        else if (daysDiff >= 150 && daysDiff <= 220) frequency = 'SEMI_ANNUAL';
        else if (daysDiff >= 300) frequency = 'ANNUAL';
        else frequency = 'QUARTERLY';
      }
    } else if (dividendYield > 0) {
      frequency = 'QUARTERLY';
      // Default standard quarterly schedule [3, 6, 9, 12]
      paymentMonthsSet.add(3);
      paymentMonthsSet.add(6);
      paymentMonthsSet.add(9);
      paymentMonthsSet.add(12);
    }

    const paymentMonths = Array.from(paymentMonthsSet).sort((a, b) => a - b);

    // Calculate historical dividend raise %
    let historicalRaise1Y: number | null = null;
    let historicalRaise3YAvg: number | null = null;

    if (divEvents.length >= 4) {
      const latestPayment = divEvents[divEvents.length - 1].dividends;
      
      // Look back ~1 year ago (between 300 and 420 days ago)
      const lastEventDate = new Date(divEvents[divEvents.length - 1].date).getTime();
      const oneYearTarget = lastEventDate - 365 * 24 * 60 * 60 * 1000;
      
      let closest1Y: any = null;
      let minDiff1Y = Infinity;
      for (let i = 0; i < divEvents.length - 1; i++) {
        const evTime = new Date(divEvents[i].date).getTime();
        const diff = Math.abs(evTime - oneYearTarget);
        if (diff < minDiff1Y && diff < 90 * 24 * 60 * 60 * 1000) {
          minDiff1Y = diff;
          closest1Y = divEvents[i];
        }
      }

      if (closest1Y && closest1Y.dividends > 0 && latestPayment >= closest1Y.dividends) {
        historicalRaise1Y = Math.round(((latestPayment - closest1Y.dividends) / closest1Y.dividends) * 1000) / 10;
      }

      // Look back ~3 years ago
      const threeYearTarget = lastEventDate - 3 * 365 * 24 * 60 * 60 * 1000;
      let closest3Y: any = null;
      let minDiff3Y = Infinity;
      for (let i = 0; i < divEvents.length - 1; i++) {
        const evTime = new Date(divEvents[i].date).getTime();
        const diff = Math.abs(evTime - threeYearTarget);
        if (diff < minDiff3Y && diff < 120 * 24 * 60 * 60 * 1000) {
          minDiff3Y = diff;
          closest3Y = divEvents[i];
        }
      }

      if (closest3Y && closest3Y.dividends > 0 && latestPayment >= closest3Y.dividends) {
        const cagr = (Math.pow(latestPayment / closest3Y.dividends, 1 / 3) - 1) * 100;
        historicalRaise3YAvg = Math.round(cagr * 10) / 10;
      }
    }

    // Determine expected forward dividend raise %
    let expectedRaisePercent = 0;
    let expectedRaiseSource: DividendHoldingItem['expectedRaiseSource'] = 'NONE';

    if (userOverrideRaise !== undefined && !isNaN(userOverrideRaise)) {
      expectedRaisePercent = Math.max(0, Math.min(100, userOverrideRaise));
      expectedRaiseSource = 'USER_OVERRIDE';
    } else if (dividendYield <= 0.01) {
      expectedRaisePercent = 0;
      expectedRaiseSource = 'NONE';
    } else if (historicalRaise1Y !== null && historicalRaise1Y > 0 && historicalRaise1Y <= 30) {
      // Direct recent 1-year raise rate
      expectedRaisePercent = historicalRaise1Y;
      expectedRaiseSource = 'HISTORICAL_1Y';
    } else if (historicalRaise3YAvg !== null && historicalRaise3YAvg > 0 && historicalRaise3YAvg <= 30) {
      // 3-year compound annual dividend growth rate
      expectedRaisePercent = historicalRaise3YAvg;
      expectedRaiseSource = 'HISTORICAL_3Y_CAGR';
    } else if (summaryDetail?.dividendRate && summaryDetail?.trailingAnnualDividendRate && summaryDetail.dividendRate > summaryDetail.trailingAnnualDividendRate) {
      const fwdSpread = ((summaryDetail.dividendRate - summaryDetail.trailingAnnualDividendRate) / summaryDetail.trailingAnnualDividendRate) * 100;
      expectedRaisePercent = Math.round(fwdSpread * 10) / 10;
      expectedRaiseSource = 'FORWARD_ESTIMATE';
    } else if (dividendYield > 0) {
      // Conservative baseline for established dividend payer
      expectedRaisePercent = 3.0;
      expectedRaiseSource = 'DEFAULT_CONSERVATIVE';
    }

    return {
      name,
      sector,
      currency,
      currentPrice,
      dividendRate,
      dividendYield: Math.round(dividendYield * 100) / 100,
      payoutRatio,
      fiveYearAvgYield,
      exDividendDate,
      dividendDate,
      frequency,
      paymentMonths,
      historicalRaise1Y,
      historicalRaise3YAvg,
      expectedRaisePercent: Math.round(expectedRaisePercent * 10) / 10,
      expectedRaiseSource,
    };
  } catch (err: any) {
    console.warn(`[DividendService] Failed to fetch dividend metrics for ${symbol}:`, err.message);
    return {
      name: symbol,
      sector: 'Equities',
      currency: 'USD',
      currentPrice: 0,
      dividendRate: 0,
      dividendYield: 0,
      payoutRatio: null,
      fiveYearAvgYield: null,
      exDividendDate: null,
      dividendDate: null,
      frequency: 'UNKNOWN',
      paymentMonths: [],
      historicalRaise1Y: null,
      historicalRaise3YAvg: null,
      expectedRaisePercent: 0,
      expectedRaiseSource: 'NONE',
    };
  }
}

/**
 * Batched concurrent execution helper
 */
async function processBatch<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Calculates Expected Annual Dividend Income with Raises for the user's open portfolio holdings
 */
export async function calculatePortfolioDividendIncome(options?: {
  forceRefresh?: boolean;
  overrides?: Record<string, number>; // ticker -> custom expected raise %
}): Promise<PortfolioDividendIncomeReport> {
  const hasOverrides = options?.overrides && Object.keys(options.overrides).length > 0;

  // Return cached report if fresh and no custom overrides requested
  if (!options?.forceRefresh && !hasOverrides && cachedReport && Date.now() - cachedReport.timestamp < CACHE_TTL_MS) {
    return cachedReport.report;
  }

  // 1. Fetch all open equity holdings from database (excluding options/cash)
  const dbHoldings = await prisma.holding.findMany();

  // Aggregate holdings by symbol across brokers (IBKR, Tastytrade, Trading212)
  const aggregatedMap = new Map<string, {
    symbol: string;
    shares: number;
    costBasis: number;
    marketValue: number;
    currency: string;
    assetType: string;
  }>();

  for (const h of dbHoldings) {
    const isOption = h.assetType === 'OPTION' || h.assetType === 'Option' || h.strikePrice !== null;
    const isCash = ['USD', 'GBP', 'EUR', 'CAD', 'CHF', 'JPY', 'AUD', 'CASH'].includes(h.symbol.trim().toUpperCase());
    
    if (isOption || isCash || h.quantity <= 0) continue;

    const sym = h.symbol.trim().toUpperCase();
    const existing = aggregatedMap.get(sym);

    if (existing) {
      existing.shares += h.quantity;
      existing.costBasis += h.averageCost * h.quantity;
      existing.marketValue += h.marketValue || (h.currentPrice * h.quantity);
    } else {
      aggregatedMap.set(sym, {
        symbol: sym,
        shares: h.quantity,
        costBasis: h.averageCost * h.quantity,
        marketValue: h.marketValue || (h.currentPrice * h.quantity),
        currency: (h.broker?.name === 'Trading212' && sym.endsWith('.L')) ? 'GBP' : 'USD',
        assetType: h.assetType || 'EQUITY',
      });
    }
  }

  const holdingsList = Array.from(aggregatedMap.values());
  if (holdingsList.length === 0) {
    // Return empty state report
    return {
      totalPortfolioValueUSD: 0,
      totalDividendHoldingsValueUSD: 0,
      totalHoldingsCount: 0,
      dividendPayerCount: 0,
      nonDividendPayerCount: 0,
      portfolioDividendCoveragePct: 0,
      currentAnnualIncomeUSD: 0,
      projectedAnnualIncomeUSD: 0,
      incrementalRaiseIncomeUSD: 0,
      totalProjectedRaisePct: 0,
      portfolioWeightedYield: 0,
      dividendPayersWeightedYield: 0,
      portfolioWeightedExpectedRaise: 0,
      monthlyAverageIncomeUSD: 0,
      monthlyRunRateUSD: 0,
      monthlyDistribution: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        monthName: MONTH_NAMES[i],
        expectedIncomeUSD: 0,
        holdingsCount: 0,
        topTickers: [],
      })),
      holdings: [],
      topIncomeGenerators: [],
      highestDividendGrowers: [],
      sectorBreakdown: [],
      lastCalculatedAt: new Date().toISOString(),
    };
  }

  // 2. Fetch dividend metrics for each unique holding in parallel batches (concurrency: 12)
  const analyzedHoldings: DividendHoldingItem[] = await processBatch(
    holdingsList,
    12,
    async (item) => {
      const userRaise = options?.overrides?.[item.symbol];
      const divData = await fetchTickerDividendData(item.symbol, userRaise);

      // Determine FX conversion to USD
      const currency = divData.currency || item.currency || 'USD';
      const fxToUSD = getLocalFxRateToUSD(currency);

      const currentPrice = divData.currentPrice > 0 ? divData.currentPrice : (item.marketValue / (item.shares || 1));
      const marketValue = item.shares * currentPrice;
      const marketValueUSD = marketValue * fxToUSD;

      const isDividendPayer = divData.dividendRate > 0 && divData.dividendYield > 0;
      const dividendRateUSD = divData.dividendRate * fxToUSD;

      // Current annual dividend income in native & USD
      const currentAnnualIncome = isDividendPayer ? item.shares * divData.dividendRate : 0;
      const currentAnnualIncomeUSD = currentAnnualIncome * fxToUSD;

      // Forward expected income with dividend raise
      const raiseFactor = 1 + (divData.expectedRaisePercent / 100);
      const projectedAnnualIncome = currentAnnualIncome * raiseFactor;
      const projectedAnnualIncomeUSD = currentAnnualIncomeUSD * raiseFactor;

      const incrementalRaiseIncome = projectedAnnualIncome - currentAnnualIncome;
      const incrementalRaiseIncomeUSD = projectedAnnualIncomeUSD - currentAnnualIncomeUSD;

      return {
        symbol: item.symbol,
        name: divData.name,
        assetType: item.assetType,
        sector: divData.sector,
        currency,
        shares: Math.round(item.shares * 1000) / 1000,
        currentPrice: Math.round(currentPrice * 100) / 100,
        marketValue: Math.round(marketValue * 100) / 100,
        marketValueUSD: Math.round(marketValueUSD * 100) / 100,
        costBasis: Math.round(item.costBasis * 100) / 100,
        isDividendPayer,
        dividendRate: Math.round(divData.dividendRate * 1000) / 1000,
        dividendRateUSD: Math.round(dividendRateUSD * 1000) / 1000,
        dividendYield: divData.dividendYield,
        payoutRatio: divData.payoutRatio,
        fiveYearAvgYield: divData.fiveYearAvgYield,
        exDividendDate: divData.exDividendDate,
        dividendDate: divData.dividendDate,
        frequency: divData.frequency,
        paymentMonths: divData.paymentMonths,
        historicalRaise1Y: divData.historicalRaise1Y,
        historicalRaise3YAvg: divData.historicalRaise3YAvg,
        expectedRaisePercent: divData.expectedRaisePercent,
        expectedRaiseSource: divData.expectedRaiseSource,
        currentAnnualIncome: Math.round(currentAnnualIncome * 100) / 100,
        currentAnnualIncomeUSD: Math.round(currentAnnualIncomeUSD * 100) / 100,
        projectedAnnualIncome: Math.round(projectedAnnualIncome * 100) / 100,
        projectedAnnualIncomeUSD: Math.round(projectedAnnualIncomeUSD * 100) / 100,
        incrementalRaiseIncome: Math.round(incrementalRaiseIncome * 100) / 100,
        incrementalRaiseIncomeUSD: Math.round(incrementalRaiseIncomeUSD * 100) / 100,
      };
    }
  );

  // Sort holdings by projected income descending
  analyzedHoldings.sort((a, b) => b.projectedAnnualIncomeUSD - a.projectedAnnualIncomeUSD);

  // 3. Compute Portfolio Aggregates
  const totalPortfolioValueUSD = analyzedHoldings.reduce((sum, h) => sum + h.marketValueUSD, 0);
  const dividendPayers = analyzedHoldings.filter((h) => h.isDividendPayer);
  const totalDividendHoldingsValueUSD = dividendPayers.reduce((sum, h) => sum + h.marketValueUSD, 0);

  const currentAnnualIncomeUSD = analyzedHoldings.reduce((sum, h) => sum + h.currentAnnualIncomeUSD, 0);
  const projectedAnnualIncomeUSD = analyzedHoldings.reduce((sum, h) => sum + h.projectedAnnualIncomeUSD, 0);
  const incrementalRaiseIncomeUSD = projectedAnnualIncomeUSD - currentAnnualIncomeUSD;

  const totalProjectedRaisePct = currentAnnualIncomeUSD > 0
    ? Math.round(((projectedAnnualIncomeUSD - currentAnnualIncomeUSD) / currentAnnualIncomeUSD) * 1000) / 10
    : 0;

  const portfolioWeightedYield = totalPortfolioValueUSD > 0
    ? Math.round((currentAnnualIncomeUSD / totalPortfolioValueUSD) * 10000) / 100
    : 0;

  const dividendPayersWeightedYield = totalDividendHoldingsValueUSD > 0
    ? Math.round((currentAnnualIncomeUSD / totalDividendHoldingsValueUSD) * 10000) / 100
    : 0;

  // Weighted average dividend raise % across dividend payers
  const weightedRaiseSum = dividendPayers.reduce(
    (sum, h) => sum + h.expectedRaisePercent * h.currentAnnualIncomeUSD,
    0
  );
  const portfolioWeightedExpectedRaise = currentAnnualIncomeUSD > 0
    ? Math.round((weightedRaiseSum / currentAnnualIncomeUSD) * 10) / 10
    : 0;

  const portfolioDividendCoveragePct = totalPortfolioValueUSD > 0
    ? Math.round((totalDividendHoldingsValueUSD / totalPortfolioValueUSD) * 1000) / 10
    : 0;

  // 4. Monthly Distribution Calendar
  // Distribute each holding's projected annual income across its payment months
  const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    monthName: MONTH_NAMES[i],
    expectedIncomeUSD: 0,
    holdingsCount: 0,
    tickers: new Set<string>(),
  }));

  for (const h of dividendPayers) {
    if (h.projectedAnnualIncomeUSD <= 0) continue;

    let targetMonths = h.paymentMonths;
    if (!targetMonths || targetMonths.length === 0) {
      // Default to quarterly [3, 6, 9, 12]
      targetMonths = [3, 6, 9, 12];
    }

    const perPaymentUSD = h.projectedAnnualIncomeUSD / targetMonths.length;
    for (const m of targetMonths) {
      if (m >= 1 && m <= 12) {
        monthlyTotals[m - 1].expectedIncomeUSD += perPaymentUSD;
        monthlyTotals[m - 1].tickers.add(h.symbol);
      }
    }
  }

  const monthlyDistribution: MonthlyIncomeItem[] = monthlyTotals.map((m) => ({
    month: m.month,
    monthName: m.monthName,
    expectedIncomeUSD: Math.round(m.expectedIncomeUSD * 100) / 100,
    holdingsCount: m.tickers.size,
    topTickers: Array.from(m.tickers).slice(0, 4),
  }));

  // 5. Top Income Generators
  const topIncomeGenerators = analyzedHoldings
    .filter((h) => h.projectedAnnualIncomeUSD > 0)
    .slice(0, 6)
    .map((h) => ({
      symbol: h.symbol,
      name: h.name,
      incomeUSD: h.projectedAnnualIncomeUSD,
      percentOfTotal: projectedAnnualIncomeUSD > 0
        ? Math.round((h.projectedAnnualIncomeUSD / projectedAnnualIncomeUSD) * 1000) / 10
        : 0,
    }));

  // 6. Highest Dividend Growers (minimum $20 projected income)
  const highestDividendGrowers = analyzedHoldings
    .filter((h) => h.isDividendPayer && h.expectedRaisePercent > 0 && h.projectedAnnualIncomeUSD >= 20)
    .sort((a, b) => b.expectedRaisePercent - a.expectedRaisePercent)
    .slice(0, 6)
    .map((h) => ({
      symbol: h.symbol,
      name: h.name,
      raisePercent: h.expectedRaisePercent,
      incomeUSD: h.projectedAnnualIncomeUSD,
    }));

  // 7. Sector Breakdown
  const sectorMap = new Map<string, { incomeUSD: number; marketValUSD: number }>();
  for (const h of analyzedHoldings) {
    const sec = h.sector || 'Other';
    const curr = sectorMap.get(sec) || { incomeUSD: 0, marketValUSD: 0 };
    curr.incomeUSD += h.projectedAnnualIncomeUSD;
    curr.marketValUSD += h.marketValueUSD;
    sectorMap.set(sec, curr);
  }

  const sectorBreakdown = Array.from(sectorMap.entries())
    .map(([sector, val]) => ({
      sector,
      incomeUSD: Math.round(val.incomeUSD * 100) / 100,
      yieldPct: val.marketValUSD > 0 ? Math.round((val.incomeUSD / val.marketValUSD) * 1000) / 10 : 0,
      percentOfTotal: projectedAnnualIncomeUSD > 0
        ? Math.round((val.incomeUSD / projectedAnnualIncomeUSD) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.incomeUSD - a.incomeUSD);

  const report: PortfolioDividendIncomeReport = {
    totalPortfolioValueUSD: Math.round(totalPortfolioValueUSD * 100) / 100,
    totalDividendHoldingsValueUSD: Math.round(totalDividendHoldingsValueUSD * 100) / 100,
    totalHoldingsCount: analyzedHoldings.length,
    dividendPayerCount: dividendPayers.length,
    nonDividendPayerCount: analyzedHoldings.length - dividendPayers.length,
    portfolioDividendCoveragePct,
    currentAnnualIncomeUSD: Math.round(currentAnnualIncomeUSD * 100) / 100,
    projectedAnnualIncomeUSD: Math.round(projectedAnnualIncomeUSD * 100) / 100,
    incrementalRaiseIncomeUSD: Math.round(incrementalRaiseIncomeUSD * 100) / 100,
    totalProjectedRaisePct,
    portfolioWeightedYield,
    dividendPayersWeightedYield,
    portfolioWeightedExpectedRaise,
    monthlyAverageIncomeUSD: Math.round((projectedAnnualIncomeUSD / 12) * 100) / 100,
    monthlyRunRateUSD: Math.round((currentAnnualIncomeUSD / 12) * 100) / 100,
    monthlyDistribution,
    holdings: analyzedHoldings,
    topIncomeGenerators,
    highestDividendGrowers,
    sectorBreakdown,
    lastCalculatedAt: new Date().toISOString(),
  };

  // Cache report if standard request
  if (!hasOverrides) {
    cachedReport = {
      timestamp: Date.now(),
      report,
    };
  }

  return report;
}
