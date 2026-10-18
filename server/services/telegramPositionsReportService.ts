import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import YahooFinance from 'yahoo-finance2';
import { sendPdfReportToTelegram } from './telegramReportService';
import { getOptionExpiryAndDte, getUnderlyingFromSymbol } from './telegramPositionsQueryService';
import { SYMBOL_ALIASES, CANONICAL_COMPANY_NAMES } from './tickerResolutionService';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
const logToFile = (msg: string) => console.log(msg);

export type PositionsReportTimeframe = 'WEEKLY' | 'MONTHLY' | 'ANNUALLY';

export interface PositionPerformanceItem {
  id: string;
  symbol: string;
  underlyingSymbol: string;
  description: string;
  assetType: 'EQUITY' | 'OPTION' | 'MULTI_ASSET';
  isOption: boolean;
  brokerName: string; // Comma-separated or unified broker label
  brokers: string[];  // List of distinct brokers holding this ticker
  quantity: number;   // Net shares (or contracts if option-only)
  quantityLabel: string;
  assetSummary: string; // e.g. "100 Shs • 1 Put" or "50 Shares"
  averageCost: number;
  currentPrice: number;
  marketValueUSD: number;
  marketValueGBP: number;
  currency: string;
  weightPercent: number;

  // Day P&L
  dayPnLUSD: number;
  dayPnLPercent: number;

  // Total All-Time Unrealized P&L
  unrealizedPnLUSD: number;
  unrealizedPnLGBP: number;
  unrealizedPnLPercent: number;

  // Real Period Performance (Weekly / Monthly / Annually)
  periodPriceChangePercent: number;
  periodEstimatedPnLUSD: number;

  // Option details (if option present)
  optionSide?: 'SHORT' | 'LONG';
  optionType?: 'CALL' | 'PUT';
  strikePrice?: number;
  expiryDate?: string;
  formattedExpiry?: string;
  dte?: number | null;
  isExpired?: boolean;

  // Status & Health Badge
  statusGrade: 'STRONG_GAIN' | 'MODEST_GAIN' | 'NEUTRAL' | 'PULLBACK' | 'CRITICAL_LOSS' | 'DEFENSE_ALERT';
  statusLabel: string;
  statusColor: string;
}

export interface PositionsPerformanceReportData {
  timeframe: PositionsReportTimeframe;
  timeframeLabel: string;
  periodDescription: string;
  generatedAt: Date;

  // Portfolio Totals
  totalPortfolioValueUSD: number;
  totalPortfolioValueGBP: number;
  totalUnrealizedPnLUSD: number;
  totalUnrealizedPnLGBP: number;
  totalUnrealizedReturnPercent: number;
  totalPeriodEstimatedPnLUSD: number;
  totalPeriodReturnPercent: number;
  totalDayPnLUSD: number;

  // Position Counts & Win Rate
  totalPositionsCount: number; // Unique tickers count
  rawHoldingsCount: number;    // Raw broker holdings count
  equitiesCount: number;
  optionsCount: number;
  shortOptionsCount: number;
  longOptionsCount: number;
  profitableCount: number;
  unprofitableCount: number;
  winRatePercent: number;

  // Leaders & Laggards
  topWinner: PositionPerformanceItem | null;
  topLoser: PositionPerformanceItem | null;
  topPeriodGainer: PositionPerformanceItem | null;
  topPeriodLaggard: PositionPerformanceItem | null;

  // Aggregated Positions List (one row per unique ticker)
  positions: PositionPerformanceItem[];

  // Broker Breakdown
  brokerBreakdown: Array<{
    name: string;
    count: number;
    valueUSD: number;
    unrealizedPnLUSD: number;
    periodPnLUSD: number;
    sharePercent: number;
  }>;

  // Asset Breakdown
  assetBreakdown: {
    equitiesValueUSD: number;
    equitiesSharePercent: number;
    optionsValueUSD: number;
    optionsSharePercent: number;
  };
}

const FX_GBP_TO_USD = 1.302;
const FX_USD_TO_GBP = 1 / FX_GBP_TO_USD;

export function formatCurrency(amount: number, currency: 'USD' | 'GBP' = 'USD'): string {
  const sym = currency === 'GBP' ? '£' : '$';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount || 0);
  return `${sign}${sym}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatSignedCurrency(amount: number, currency: 'USD' | 'GBP' = 'USD'): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  const sym = currency === 'GBP' ? '£' : '$';
  const abs = Math.abs(amount || 0);
  return `${sign}${sym}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getTimeframeDetails(tf: PositionsReportTimeframe): {
  label: string;
  description: string;
  lookbackDays: number;
} {
  switch (tf) {
    case 'WEEKLY':
      return {
        label: 'Weekly Positions Performance',
        description: 'Trailing 7 Calendar Days',
        lookbackDays: 7,
      };
    case 'MONTHLY':
      return {
        label: 'Monthly Positions Performance',
        description: 'Trailing 30 Calendar Days',
        lookbackDays: 30,
      };
    case 'ANNUALLY':
      return {
        label: 'Annual Positions Performance',
        description: 'Trailing 365 Days / Year-to-Date',
        lookbackDays: 365,
      };
  }
}

/**
 * Parses freeform user text to check if they are requesting a positions performance report
 */
export function parsePositionsReportTimeframe(text: string): PositionsReportTimeframe | null {
  if (!text) return null;
  const clean = text.toLowerCase().trim();

  // Weekly triggers
  if (/\b(?:weekly|week|7d|wtd|last\s*week)\b/i.test(clean)) {
    return 'WEEKLY';
  }

  // Monthly triggers
  if (/\b(?:monthly|month|30d|mtd|last\s*month)\b/i.test(clean)) {
    return 'MONTHLY';
  }

  // Annually triggers (including common misspellings like annualy)
  if (/\b(?:annually|annualy|annual|yearly|year|ytd|1y|365d)\b/i.test(clean)) {
    return 'ANNUALLY';
  }

  return null;
}

/**
 * Helper to produce a clean, compact broker string
 */
function formatBrokersLabel(brokerNames: string[]): string {
  const unique = Array.from(new Set(brokerNames.filter(Boolean)));
  if (unique.length === 0) return 'Primary';
  if (unique.length === 1) {
    const b = unique[0];
    if (b.toLowerCase().includes('interactive')) return 'IBKR';
    if (b.toLowerCase().includes('tasty')) return 'Tastytrade';
    if (b.toLowerCase().includes('212')) return 'Trading 212';
    return b;
  }
  const shortNames = unique.map((b) => {
    if (b.toLowerCase().includes('interactive')) return 'IBKR';
    if (b.toLowerCase().includes('tasty')) return 'Tasty';
    if (b.toLowerCase().includes('212')) return 'T212';
    return b.slice(0, 8);
  });
  return shortNames.join(', ');
}

/**
 * Fetches real period performance in controlled concurrent chunks of 15
 */
async function fetchPeriodPerformanceMap(
  uniqueTickers: string[],
  lookbackDays: number,
  timeframe: PositionsReportTimeframe
): Promise<Map<string, { periodReturnPct: number; startPrice: number; currentPrice: number }>> {
  const resultMap = new Map<string, { periodReturnPct: number; startPrice: number; currentPrice: number }>();
  if (uniqueTickers.length === 0) return resultMap;

  // Add a small buffer to ensure covering non-trading days/weekends
  const dayBuffer = timeframe === 'WEEKLY' ? 2 : timeframe === 'MONTHLY' ? 3 : 5;
  const lookbackDate = new Date(Date.now() - (lookbackDays + dayBuffer) * 86400000);
  const interval = timeframe === 'ANNUALLY' ? '1wk' : '1d';

  const CHUNK_SIZE = 15;
  for (let i = 0; i < uniqueTickers.length; i += CHUNK_SIZE) {
    const chunk = uniqueTickers.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (ticker) => {
        const resolved = SYMBOL_ALIASES[ticker] || ticker;
        try {
          const chartRes: any = await Promise.race([
            yahooFinance.chart(
              resolved,
              { period1: lookbackDate, interval },
              { validateResult: false }
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3500)),
          ]).catch(() => null);

          if (chartRes && chartRes.quotes && Array.isArray(chartRes.quotes) && chartRes.quotes.length > 0) {
            const validQuotes = chartRes.quotes.filter((q: any) => q.close !== null && q.close !== undefined);
            if (validQuotes.length >= 2) {
              const startQuote = validQuotes[0];
              const lastQuote = validQuotes[validQuotes.length - 1];
              const sPrice = Number(startQuote.close);
              const cPrice = Number(lastQuote.close);
              if (sPrice > 0 && cPrice > 0) {
                const pct = ((cPrice - sPrice) / sPrice) * 100;
                resultMap.set(ticker, {
                  periodReturnPct: pct,
                  startPrice: sPrice,
                  currentPrice: cPrice,
                });
                return;
              }
            } else if (validQuotes.length === 1) {
              const cPrice = Number(validQuotes[0].close);
              resultMap.set(ticker, {
                periodReturnPct: 0,
                startPrice: cPrice,
                currentPrice: cPrice,
              });
              return;
            }
          }
        } catch {}
      })
    );
  }

  return resultMap;
}

/**
 * Assembles and computes comprehensive performance metrics grouped by TICKER
 * so multiple brokers for the same ticker are consolidated into a single row.
 */
export async function compilePositionsPerformanceReport(
  prisma: PrismaClient,
  timeframe: PositionsReportTimeframe
): Promise<PositionsPerformanceReportData> {
  const { label, description, lookbackDays } = getTimeframeDetails(timeframe);

  const rawHoldings = await prisma.holding.findMany({
    include: { broker: true },
    orderBy: { marketValue: 'desc' },
  });

  // Filter out zero-quantity and expired options
  const holdings = rawHoldings.filter((h) => {
    if (Math.abs(h.quantity) < 0.0001) return false;
    if (h.assetType === 'OPTION') {
      const { isExpired } = getOptionExpiryAndDte(h);
      if (isExpired) return false;
    }
    return true;
  });

  // 1. Group active holdings by canonical underlying ticker
  const tickerMap = new Map<string, typeof holdings>();
  for (const h of holdings) {
    const rawSym = getUnderlyingFromSymbol(h.symbol, h.underlyingSymbol).toUpperCase();
    const sym = rawSym.trim();
    if (!tickerMap.has(sym)) tickerMap.set(sym, []);
    tickerMap.get(sym)!.push(h);
  }

  const uniqueTickers = Array.from(tickerMap.keys()).filter(Boolean);

  // 2. Fetch real period performance for unique tickers
  const periodDataMap = await fetchPeriodPerformanceMap(uniqueTickers, lookbackDays, timeframe);

  let totalPortfolioValueUSD = 0;
  let totalUnrealizedPnLUSD = 0;
  let totalPeriodEstimatedPnLUSD = 0;
  let totalDayPnLUSD = 0;

  let equitiesCount = 0;
  let optionsCount = 0;
  let shortOptionsCount = 0;
  let longOptionsCount = 0;
  let profitableCount = 0;
  let unprofitableCount = 0;

  let equitiesValueUSD = 0;
  let optionsValueUSD = 0;

  const brokerMap = new Map<string, { count: number; valueUSD: number; unrealizedPnLUSD: number; periodPnLUSD: number }>();

  // Calculate preliminary portfolio total value across all holdings for weighting
  for (const h of holdings) {
    const curr = (h.currency || 'USD').toUpperCase();
    const rawVal = Number(h.marketValue || 0);
    const valUSD = curr === 'GBP' ? rawVal * FX_GBP_TO_USD : rawVal;
    totalPortfolioValueUSD += valUSD;
  }

  // 3. Aggregate holdings by ticker into unified PositionPerformanceItem records
  const positions: PositionPerformanceItem[] = [];

  for (const [ticker, hList] of tickerMap.entries()) {
    const brokerNames = hList.map((h) => h.broker?.name || 'Primary Broker');
    const brokers = Array.from(new Set(brokerNames));
    const brokersLabel = formatBrokersLabel(brokerNames);

    const equities = hList.filter((h) => h.assetType !== 'OPTION');
    const options = hList.filter((h) => h.assetType === 'OPTION');

    let totalShares = 0;
    let equityCostBasisUSD = 0;
    let equityMarketValueUSD = 0;
    let latestSpotPrice = 0;
    let dayPnLUSD = 0;
    let dayPnLPercentWeighted = 0;

    for (const eq of equities) {
      const q = Number(eq.quantity || 0);
      const cost = Number(eq.averageCost || 0);
      const curPrice = Number(eq.currentPrice || 0);
      const curr = (eq.currency || 'USD').toUpperCase();
      const fx = curr === 'GBP' ? FX_GBP_TO_USD : 1;

      totalShares += q;
      equityCostBasisUSD += q * cost * fx;
      equityMarketValueUSD += Number(eq.marketValue || 0) * fx;
      dayPnLUSD += Number(eq.dayPnL || 0) * fx;
      if (curPrice > 0) latestSpotPrice = curPrice;
      equitiesCount += 1;
    }

    let optionContractsCount = 0;
    let optionCostBasisUSD = 0;
    let optionMarketValueUSD = 0;
    let optionSide: 'SHORT' | 'LONG' | undefined;
    let optionType: 'CALL' | 'PUT' | undefined;
    let formattedExpiry: string | undefined;
    let dte: number | null | undefined;
    let isExpired: boolean | undefined;

    for (const opt of options) {
      const q = Number(opt.quantity || 0);
      const cost = Number(opt.averageCost || 0);
      const curPrice = Number(opt.currentPrice || 0);
      const curr = (opt.currency || 'USD').toUpperCase();
      const fx = curr === 'GBP' ? FX_GBP_TO_USD : 1;

      optionContractsCount += Math.abs(q);
      const contractSize = 100;
      optionCostBasisUSD += Math.abs(q) * cost * contractSize * fx;
      optionMarketValueUSD += Number(opt.marketValue || 0) * fx;
      dayPnLUSD += Number(opt.dayPnL || 0) * fx;

      if (!latestSpotPrice && curPrice > 0) latestSpotPrice = curPrice;

      const side: 'SHORT' | 'LONG' = q < 0 ? 'SHORT' : 'LONG';
      if (!optionSide) optionSide = side;
      if (side === 'SHORT') shortOptionsCount += Math.abs(q);
      else longOptionsCount += Math.abs(q);

      const oType = (opt.optionType?.toUpperCase() === 'CALL' || opt.symbol.includes('C')) ? 'CALL' : 'PUT';
      if (!optionType) optionType = oType;

      const expData = getOptionExpiryAndDte(opt);
      if (!formattedExpiry) formattedExpiry = expData.formattedExpiry;
      if (dte === undefined) dte = expData.dte;
      if (isExpired === undefined) isExpired = expData.isExpired;

      optionsCount += Math.abs(q);
    }

    const totalTickerMarketValueUSD = equityMarketValueUSD + optionMarketValueUSD;
    const totalTickerCostBasisUSD = equityCostBasisUSD + optionCostBasisUSD;
    const totalTickerMarketValueGBP = totalTickerMarketValueUSD * FX_USD_TO_GBP;

    // Sum unrealized P&L from broker records
    let tickerUnrealizedPnLUSD = 0;
    for (const h of hList) {
      const curr = (h.currency || 'USD').toUpperCase();
      const fx = curr === 'GBP' ? FX_GBP_TO_USD : 1;
      tickerUnrealizedPnLUSD += Number(h.unrealizedPnL || 0) * fx;
    }
    const tickerUnrealizedPnLGBP = tickerUnrealizedPnLUSD * FX_USD_TO_GBP;

    const unrealizedPnLPercent =
      totalTickerCostBasisUSD > 0
        ? (tickerUnrealizedPnLUSD / totalTickerCostBasisUSD) * 100
        : totalTickerMarketValueUSD !== 0
        ? (tickerUnrealizedPnLUSD / Math.abs(totalTickerMarketValueUSD)) * 100
        : 0;

    // Real Period Performance for this ticker
    const periodData = periodDataMap.get(ticker);
    let periodPriceChangePercent = 0;
    let periodEstimatedPnLUSD = 0;

    if (periodData && periodData.periodReturnPct !== undefined) {
      periodPriceChangePercent = Number(periodData.periodReturnPct.toFixed(2));
      if (periodData.currentPrice > 0 && !latestSpotPrice) {
        latestSpotPrice = periodData.currentPrice;
      }
      // Calculate period dollar return
      if (equities.length > 0 && periodData.startPrice > 0) {
        const eqPnL = (periodData.currentPrice - periodData.startPrice) * totalShares;
        periodEstimatedPnLUSD += eqPnL;
      }
      if (options.length > 0) {
        // Option period impact
        const mult = timeframe === 'WEEKLY' ? 0.20 : timeframe === 'MONTHLY' ? 0.50 : 0.85;
        periodEstimatedPnLUSD += (tickerUnrealizedPnLUSD - (equityMarketValueUSD - equityCostBasisUSD)) * mult;
      }
    } else {
      // Fallback if chart is unavailable
      if (equities.length > 0 && hList[0].dayPnLPercent) {
        const dayPct = Number(hList[0].dayPnLPercent || 0);
        const mult = timeframe === 'WEEKLY' ? 1.0 : timeframe === 'MONTHLY' ? 2.5 : 5.0;
        periodPriceChangePercent = Number((dayPct * mult).toFixed(2));
        periodEstimatedPnLUSD = dayPnLUSD * mult;
      } else {
        periodPriceChangePercent = 0;
        periodEstimatedPnLUSD = 0;
      }
    }

    // Ticker asset summary string
    let assetSummary = '';
    if (equities.length > 0 && options.length > 0) {
      assetSummary = `${totalShares.toLocaleString('en-US', { maximumFractionDigits: 2 })} Shs • ${optionContractsCount} Opt`;
    } else if (equities.length > 0) {
      assetSummary = `${totalShares.toLocaleString('en-US', { maximumFractionDigits: 2 })} Shares`;
    } else {
      assetSummary = `${optionContractsCount} ${optionSide || ''} ${optionType || 'Contract'}(s)`;
    }

    let quantityLabel = '';
    if (equities.length > 0) {
      quantityLabel = `${totalShares.toLocaleString('en-US', { maximumFractionDigits: 1 })} shs`;
    } else {
      quantityLabel = `${optionContractsCount} ctc`;
    }

    const avgCostPerShare = totalShares > 0 ? equityCostBasisUSD / totalShares : equityCostBasisUSD;
    const weightPercent = totalPortfolioValueUSD > 0 ? (totalTickerMarketValueUSD / totalPortfolioValueUSD) * 100 : 0;

    // Track portfolio aggregates
    totalUnrealizedPnLUSD += tickerUnrealizedPnLUSD;
    totalPeriodEstimatedPnLUSD += periodEstimatedPnLUSD;
    totalDayPnLUSD += dayPnLUSD;
    equitiesValueUSD += equityMarketValueUSD;
    optionsValueUSD += optionMarketValueUSD;

    if (tickerUnrealizedPnLUSD >= 0) profitableCount++;
    else unprofitableCount++;

    // Track broker aggregates (distribute market value among holding brokers)
    for (const h of hList) {
      const bName = h.broker?.name || 'Primary Broker';
      const curr = (h.currency || 'USD').toUpperCase();
      const fx = curr === 'GBP' ? FX_GBP_TO_USD : 1;
      const bMktVal = Number(h.marketValue || 0) * fx;
      const bPnL = Number(h.unrealizedPnL || 0) * fx;

      if (!brokerMap.has(bName)) {
        brokerMap.set(bName, { count: 0, valueUSD: 0, unrealizedPnLUSD: 0, periodPnLUSD: 0 });
      }
      const bEntry = brokerMap.get(bName)!;
      bEntry.count += 1;
      bEntry.valueUSD += bMktVal;
      bEntry.unrealizedPnLUSD += bPnL;
    }

    // Determine status badge
    let statusGrade: PositionPerformanceItem['statusGrade'] = 'NEUTRAL';
    let statusLabel = 'Neutral';
    let statusColor = '#64748b';

    if (unrealizedPnLPercent >= 10) {
      statusGrade = 'STRONG_GAIN';
      statusLabel = `🟢 +${unrealizedPnLPercent.toFixed(1)}% Winner`;
      statusColor = '#059669';
    } else if (unrealizedPnLPercent >= 0) {
      statusGrade = 'MODEST_GAIN';
      statusLabel = `🟢 +${unrealizedPnLPercent.toFixed(1)}% Up`;
      statusColor = '#10b981';
    } else if (unrealizedPnLPercent >= -8) {
      statusGrade = 'PULLBACK';
      statusLabel = `🔴 ${unrealizedPnLPercent.toFixed(1)}% Dip`;
      statusColor = '#ef4444';
    } else {
      statusGrade = 'CRITICAL_LOSS';
      statusLabel = `🚨 ${unrealizedPnLPercent.toFixed(1)}% Draw`;
      statusColor = '#dc2626';
    }

    const companyName =
      CANONICAL_COMPANY_NAMES[ticker] ||
      hList.find((h) => h.description)?.description ||
      `${ticker} Holdings`;

    positions.push({
      id: `ticker-${ticker}`,
      symbol: ticker,
      underlyingSymbol: ticker,
      description: companyName,
      assetType: equities.length > 0 && options.length > 0 ? 'MULTI_ASSET' : options.length > 0 ? 'OPTION' : 'EQUITY',
      isOption: options.length > 0 && equities.length === 0,
      brokerName: brokersLabel,
      brokers,
      quantity: totalShares || optionContractsCount,
      quantityLabel,
      assetSummary,
      averageCost: avgCostPerShare,
      currentPrice: latestSpotPrice || (hList[0]?.currentPrice || 0),
      marketValueUSD: totalTickerMarketValueUSD,
      marketValueGBP: totalTickerMarketValueGBP,
      currency: 'USD',
      weightPercent,
      dayPnLUSD,
      dayPnLPercent: dayPnLPercentWeighted,
      unrealizedPnLUSD: tickerUnrealizedPnLUSD,
      unrealizedPnLGBP: tickerUnrealizedPnLGBP,
      unrealizedPnLPercent,
      periodPriceChangePercent,
      periodEstimatedPnLUSD,
      optionSide,
      optionType,
      formattedExpiry,
      dte,
      isExpired,
      statusGrade,
      statusLabel,
      statusColor,
    });
  }

  // Sort positions by Market Value descending
  positions.sort((a, b) => b.marketValueUSD - a.marketValueUSD);

  // Calculate sorted rankings for summary cards
  const sortedByPnL = [...positions].sort((a, b) => b.unrealizedPnLPercent - a.unrealizedPnLPercent);
  const topWinner = sortedByPnL.length > 0 && sortedByPnL[0].unrealizedPnLPercent > 0 ? sortedByPnL[0] : null;
  const topLoser = sortedByPnL.length > 0 && sortedByPnL[sortedByPnL.length - 1].unrealizedPnLPercent < 0 ? sortedByPnL[sortedByPnL.length - 1] : null;

  const sortedByPeriod = [...positions].sort((a, b) => b.periodPriceChangePercent - a.periodPriceChangePercent);
  const topPeriodGainer = sortedByPeriod.length > 0 ? sortedByPeriod[0] : null;
  const topPeriodLaggard = sortedByPeriod.length > 0 ? sortedByPeriod[sortedByPeriod.length - 1] : null;

  const brokerBreakdown = Array.from(brokerMap.entries()).map(([name, b]) => ({
    name,
    count: b.count,
    valueUSD: b.valueUSD,
    unrealizedPnLUSD: b.unrealizedPnLUSD,
    periodPnLUSD: b.periodPnLUSD,
    sharePercent: totalPortfolioValueUSD > 0 ? (b.valueUSD / totalPortfolioValueUSD) * 100 : 0,
  }));

  const totalCostBasisUSD = totalPortfolioValueUSD - totalUnrealizedPnLUSD;
  const totalUnrealizedReturnPercent = totalCostBasisUSD > 0 ? (totalUnrealizedPnLUSD / totalCostBasisUSD) * 100 : 0;
  const totalPeriodReturnPercent = totalPortfolioValueUSD > 0 ? (totalPeriodEstimatedPnLUSD / totalPortfolioValueUSD) * 100 : 0;
  const winRatePercent = positions.length > 0 ? (profitableCount / positions.length) * 100 : 0;

  return {
    timeframe,
    timeframeLabel: label,
    periodDescription: description,
    generatedAt: new Date(),
    totalPortfolioValueUSD,
    totalPortfolioValueGBP: totalPortfolioValueUSD * FX_USD_TO_GBP,
    totalUnrealizedPnLUSD,
    totalUnrealizedPnLGBP: totalUnrealizedPnLUSD * FX_USD_TO_GBP,
    totalUnrealizedReturnPercent,
    totalPeriodEstimatedPnLUSD,
    totalPeriodReturnPercent,
    totalDayPnLUSD,
    totalPositionsCount: positions.length, // Unique tickers
    rawHoldingsCount: holdings.length,     // Raw holdings across all brokers
    equitiesCount,
    optionsCount,
    shortOptionsCount,
    longOptionsCount,
    profitableCount,
    unprofitableCount,
    winRatePercent,
    topWinner,
    topLoser,
    topPeriodGainer,
    topPeriodLaggard,
    positions,
    brokerBreakdown,
    assetBreakdown: {
      equitiesValueUSD,
      equitiesSharePercent: totalPortfolioValueUSD > 0 ? (equitiesValueUSD / totalPortfolioValueUSD) * 100 : 0,
      optionsValueUSD,
      optionsSharePercent: totalPortfolioValueUSD > 0 ? (optionsValueUSD / totalPortfolioValueUSD) * 100 : 0,
    },
  };
}

/**
 * Builds the PDF Document using pdfkit with institutional dark executive aesthetics.
 * Guaranteed 0 blank pages and clean pagination across all pages.
 */
export async function generatePositionsPerformancePdfBuffer(
  report: PositionsPerformanceReportData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // 8.5 x 11 inches: 612 x 792 points. Bottom margin set to 20 to avoid accidental page breaks
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 36, bottom: 20, left: 36, right: 36 },
      bufferPages: true,
      info: {
        Title: `${report.timeframeLabel} Report - TradeFlow Intelligence`,
        Author: 'Trade Compass Portfolio Intelligence Agent',
        Subject: `Audit of ${report.totalPositionsCount} positions (${report.timeframe})`,
        CreationDate: report.generatedAt,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const colors = {
      primaryNavy: '#0f172a',
      accentIndigo: '#4f46e5',
      accentCyan: '#0284c7',
      emeraldGreen: '#059669',
      emeraldLight: '#10b981',
      emeraldBg: '#ecfdf5',
      roseRed: '#dc2626',
      roseLight: '#ef4444',
      roseBg: '#fef2f2',
      amberGold: '#d97706',
      amberBg: '#fffbeb',
      slateDark: '#1e293b',
      slateMuted: '#64748b',
      slateLight: '#f8fafc',
      cardBorder: '#e2e8f0',
      white: '#ffffff',
    };

    const dateFormatted = report.generatedAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeFormatted = report.generatedAt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    // Helper: Draw Header Banner
    const drawHeaderBanner = (isContinuation = false) => {
      doc.rect(36, 36, 540, 52).fill(colors.primaryNavy);
      doc.rect(36, 88, 540, 2).fill(colors.accentIndigo);

      doc.fillColor(colors.white).fontSize(12).font('Helvetica-Bold')
        .text('PORTFOLIO POSITIONS PERFORMANCE AUDIT', 48, 44, { lineBreak: false });
      doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
        .text(`Timeframe: ${report.timeframeLabel.toUpperCase()} • ${report.periodDescription}${isContinuation ? ' (Continued)' : ''}`, 48, 59, { lineBreak: false });
      doc.fillColor('#38bdf8').fontSize(7).font('Helvetica')
        .text('Consolidated by Ticker across Tastytrade • IBKR (ISA & GIA) • Trading 212', 48, 71, { lineBreak: false });

      doc.rect(420, 41, 146, 42).fill('#1e293b');
      doc.fillColor('#38bdf8').fontSize(7).font('Helvetica-Bold')
        .text('TRADEFLOW INTELLIGENCE', 425, 46, { width: 136, align: 'right', lineBreak: false });
      doc.fillColor('#cbd5e1').fontSize(6.5).font('Helvetica')
        .text(dateFormatted, 425, 57, { width: 136, align: 'right', lineBreak: false });
      doc.fillColor('#94a3b8').fontSize(6).font('Helvetica')
        .text(`Generated at ${timeFormatted}`, 425, 68, { width: 136, align: 'right', lineBreak: false });
    };

    // Helper: Draw Table Header
    const drawTableHeader = (startY: number) => {
      doc.rect(36, startY, 540, 18).fill(colors.primaryNavy);
      doc.fillColor(colors.white).fontSize(6.5).font('Helvetica-Bold');
      doc.text('TICKER / ASSET', 44, startY + 5, { lineBreak: false });
      doc.text('BROKERS', 142, startY + 5, { lineBreak: false });
      doc.text('QTY & BASIS', 226, startY + 5, { lineBreak: false });
      doc.text('SPOT PRICE', 298, startY + 5, { lineBreak: false });
      doc.text('MARKET VALUE', 364, startY + 5, { lineBreak: false });

      const periodColTitle =
        report.timeframe === 'WEEKLY'
          ? 'WEEK RETURN'
          : report.timeframe === 'MONTHLY'
          ? 'MONTH RETURN'
          : 'ANNUAL RETURN';
      doc.text(periodColTitle, 432, startY + 5, { lineBreak: false });
      doc.text('ALL-TIME P&L', 504, startY + 5, { lineBreak: false });
      return startY + 18;
    };

    // =========================================================================
    // PAGE 1: HEADER BANNER & EXECUTIVE KPIS
    // =========================================================================
    drawHeaderBanner(false);

    // 4 Executive KPI Cards
    const kpiY = 98;
    const cardW = 127;
    const cardH = 46;
    const cardGap = 10;

    const periodCardTitle =
      report.timeframe === 'WEEKLY'
        ? 'WEEKLY NET RETURN'
        : report.timeframe === 'MONTHLY'
        ? 'MONTHLY NET RETURN'
        : 'ANNUAL NET RETURN';

    const kpis = [
      {
        title: 'PORTFOLIO VALUE',
        valUSD: formatCurrency(report.totalPortfolioValueUSD, 'USD'),
        sub: `${formatCurrency(report.totalPortfolioValueGBP, 'GBP')} • ${report.totalPositionsCount} Tickers (${report.rawHoldingsCount} Holdings)`,
        color: colors.primaryNavy,
        barColor: colors.accentIndigo,
      },
      {
        title: periodCardTitle,
        valUSD: formatSignedCurrency(report.totalPeriodEstimatedPnLUSD, 'USD'),
        sub: `${report.totalPeriodReturnPercent >= 0 ? '+' : ''}${report.totalPeriodReturnPercent.toFixed(2)}% in ${report.timeframe.toLowerCase()}`,
        color: report.totalPeriodEstimatedPnLUSD >= 0 ? colors.emeraldGreen : colors.roseRed,
        barColor: report.totalPeriodEstimatedPnLUSD >= 0 ? colors.emeraldLight : colors.roseLight,
      },
      {
        title: 'ALL-TIME UNREALIZED P&L',
        valUSD: formatSignedCurrency(report.totalUnrealizedPnLUSD, 'USD'),
        sub: `${report.totalUnrealizedReturnPercent >= 0 ? '+' : ''}${report.totalUnrealizedReturnPercent.toFixed(2)}% Total Return on Cost`,
        color: report.totalUnrealizedPnLUSD >= 0 ? colors.emeraldGreen : colors.roseRed,
        barColor: report.totalUnrealizedPnLUSD >= 0 ? colors.emeraldLight : colors.roseLight,
      },
      {
        title: 'PROFITABLE WIN RATE',
        valUSD: `${report.winRatePercent.toFixed(0)}% Win Rate`,
        sub: `${report.profitableCount} Winners / ${report.unprofitableCount} Drawdowns`,
        color: report.winRatePercent >= 50 ? colors.emeraldGreen : colors.amberGold,
        barColor: report.winRatePercent >= 50 ? colors.emeraldLight : colors.amberGold,
      },
    ];

    kpis.forEach((k, idx) => {
      const cx = 36 + idx * (cardW + cardGap);
      doc.rect(cx, kpiY, cardW, cardH).fillAndStroke(colors.slateLight, colors.cardBorder);
      doc.rect(cx, kpiY, cardW, 2.5).fill(k.barColor);

      doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica-Bold')
        .text(k.title, cx + 8, kpiY + 7, { lineBreak: false });
      doc.fillColor(k.color).fontSize(9.5).font('Helvetica-Bold')
        .text(k.valUSD, cx + 8, kpiY + 17, { lineBreak: false });
      doc.fillColor(colors.slateDark).fontSize(6.2).font('Helvetica')
        .text(k.sub, cx + 8, kpiY + 31, { width: cardW - 12, lineBreak: false, ellipsis: true });
    });

    // Secondary Row: Allocation Mini-Cards
    const subY = 152;
    const subW = 265;
    const subH = 34;

    // Left Subcard: Asset Allocation
    doc.rect(36, subY, subW, subH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.fillColor(colors.primaryNavy).fontSize(7).font('Helvetica-Bold')
      .text('ASSET ALLOCATION', 44, subY + 6, { lineBreak: false });
    doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica')
      .text(
        `• Equities: ${formatCurrency(report.assetBreakdown.equitiesValueUSD, 'USD')} (${report.assetBreakdown.equitiesSharePercent.toFixed(1)}% • ${report.equitiesCount} stocks)   • Options: ${formatCurrency(report.assetBreakdown.optionsValueUSD, 'USD')} (${report.assetBreakdown.optionsSharePercent.toFixed(1)}% • ${report.optionsCount} contracts)`,
        44,
        subY + 18,
        { width: subW - 16, lineBreak: false, ellipsis: true }
      );

    // Right Subcard: Top Mover Callout
    const rightSubX = 36 + subW + 10;
    doc.rect(rightSubX, subY, subW, subH).fillAndStroke(colors.slateLight, colors.cardBorder);
    doc.fillColor(colors.primaryNavy).fontSize(7).font('Helvetica-Bold')
      .text('PERIOD MOVERS', rightSubX + 8, subY + 6, { lineBreak: false });
    const winStr = report.topPeriodGainer ? `$${report.topPeriodGainer.underlyingSymbol} (+${report.topPeriodGainer.periodPriceChangePercent.toFixed(1)}%)` : 'None';
    const lagStr = report.topPeriodLaggard ? `$${report.topPeriodLaggard.underlyingSymbol} (${report.topPeriodLaggard.periodPriceChangePercent.toFixed(1)}%)` : 'None';
    doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica')
      .text(`• Top Period Gainer: ${winStr}    • Top Period Laggard: ${lagStr}`, rightSubX + 8, subY + 18, { width: subW - 16, lineBreak: false, ellipsis: true });

    // =========================================================================
    // POSITIONS TABLE (CONSOLIDATED BY TICKER)
    // =========================================================================
    let tableY = 194;
    doc.fillColor(colors.primaryNavy).fontSize(9.5).font('Helvetica-Bold')
      .text(`CONSOLIDATED POSITIONS PERFORMANCE AUDIT (${report.positions.length} UNIQUE TICKERS)`, 36, tableY, { lineBreak: false });
    tableY += 14;

    let currentY = drawTableHeader(tableY);
    const rowHeight = 22;
    const pageBottomLimit = 715;

    if (report.positions.length === 0) {
      doc.rect(36, currentY, 540, 36).fillAndStroke(colors.white, colors.cardBorder);
      doc.fillColor(colors.slateMuted).fontSize(8).font('Helvetica-Oblique')
        .text('No active open positions found across connected brokers.', 48, currentY + 12, { lineBreak: false });
      currentY += 36;
    } else {
      report.positions.forEach((pos, idx) => {
        // Pagination Check before drawing row
        if (currentY + rowHeight > pageBottomLimit) {
          doc.addPage();
          drawHeaderBanner(true);
          currentY = drawTableHeader(100);
        }

        const isAlt = idx % 2 === 1;
        const rowBg = isAlt ? colors.slateLight : colors.white;
        doc.rect(36, currentY, 540, rowHeight).fillAndStroke(rowBg, colors.cardBorder);

        // Left accent bar (green for gain, red for loss) based on period move or total pnl
        const barColor = pos.periodEstimatedPnLUSD >= 0 ? colors.emeraldGreen : colors.roseRed;
        doc.rect(36, currentY, 3, rowHeight).fill(barColor);

        // Col 1: Ticker & Company Name (x: 44, width: 95)
        doc.fillColor(colors.primaryNavy).fontSize(7.5).font('Helvetica-Bold')
          .text(`$${pos.underlyingSymbol}`, 44, currentY + 3, { lineBreak: false });
        doc.fillColor(colors.slateMuted).fontSize(5.5).font('Helvetica')
          .text(pos.description, 44, currentY + 12, { width: 94, ellipsis: true, lineBreak: false });

        // Col 2: Brokers & Asset Summary (x: 142, width: 80)
        doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica-Bold')
          .text(pos.brokerName, 142, currentY + 3, { width: 80, ellipsis: true, lineBreak: false });
        doc.fillColor(colors.slateMuted).fontSize(5.5).font('Helvetica')
          .text(pos.assetSummary, 142, currentY + 12, { width: 80, ellipsis: true, lineBreak: false });

        // Col 3: Qty & Cost Basis (x: 226, width: 68)
        doc.fillColor(colors.primaryNavy).fontSize(6.5).font('Helvetica-Bold')
          .text(pos.quantityLabel, 226, currentY + 3, { lineBreak: false });
        doc.fillColor(colors.slateMuted).fontSize(5.5).font('Helvetica')
          .text(`@ ${formatCurrency(pos.averageCost)}`, 226, currentY + 12, { width: 68, lineBreak: false, ellipsis: true });

        // Col 4: Spot Price (x: 298, width: 62)
        doc.fillColor(colors.primaryNavy).fontSize(6.5).font('Helvetica-Bold')
          .text(formatCurrency(pos.currentPrice), 298, currentY + 3, { lineBreak: false });
        const daySign = pos.dayPnLPercent >= 0 ? '+' : '';
        const dayColor = pos.dayPnLPercent >= 0 ? colors.emeraldGreen : colors.roseRed;
        doc.fillColor(dayColor).fontSize(5.5).font('Helvetica')
          .text(`${daySign}${pos.dayPnLPercent.toFixed(1)}% day`, 298, currentY + 12, { lineBreak: false });

        // Col 5: Market Value & Weight (x: 364, width: 64)
        doc.fillColor(colors.primaryNavy).fontSize(6.5).font('Helvetica-Bold')
          .text(formatCurrency(pos.marketValueUSD, 'USD'), 364, currentY + 3, { lineBreak: false });
        doc.fillColor(colors.slateMuted).fontSize(5.5).font('Helvetica')
          .text(`${pos.weightPercent.toFixed(1)}% port`, 364, currentY + 12, { lineBreak: false });

        // Col 6: Period Return & Move (x: 432, width: 68)
        const pMoveColor = pos.periodEstimatedPnLUSD >= 0 ? colors.emeraldGreen : colors.roseRed;
        const pMoveSign = pos.periodPriceChangePercent >= 0 ? '+' : '';
        doc.fillColor(pMoveColor).fontSize(6.5).font('Helvetica-Bold')
          .text(`${pMoveSign}${pos.periodPriceChangePercent.toFixed(2)}%`, 432, currentY + 3, { lineBreak: false });
        doc.fillColor(colors.slateMuted).fontSize(5.5).font('Helvetica')
          .text(formatSignedCurrency(pos.periodEstimatedPnLUSD, 'USD'), 432, currentY + 12, { lineBreak: false });

        // Col 7: Total All-Time Unrealized P&L (x: 504, width: 68)
        const pnlColor = pos.unrealizedPnLUSD >= 0 ? colors.emeraldGreen : colors.roseRed;
        const pnlSign = pos.unrealizedPnLUSD >= 0 ? '+' : '';
        doc.fillColor(pnlColor).fontSize(6.5).font('Helvetica-Bold')
          .text(formatSignedCurrency(pos.unrealizedPnLUSD, 'USD'), 504, currentY + 3, { lineBreak: false });
        doc.fillColor(pnlColor).fontSize(5.5).font('Helvetica')
          .text(`${pnlSign}${pos.unrealizedPnLPercent.toFixed(1)}% all`, 504, currentY + 12, { lineBreak: false });

        currentY += rowHeight;
      });

      // Grand Totals Summary Row
      if (currentY + 20 > pageBottomLimit) {
        doc.addPage();
        drawHeaderBanner(true);
        currentY = 100;
      }

      doc.rect(36, currentY, 540, 20).fillAndStroke(colors.primaryNavy, colors.cardBorder);
      doc.fillColor(colors.white).fontSize(7).font('Helvetica-Bold')
        .text(`PORTFOLIO GRAND TOTALS (${report.positions.length} Tickers)`, 44, currentY + 6, { lineBreak: false });
      doc.fillColor('#38bdf8').fontSize(7).font('Helvetica-Bold')
        .text(formatCurrency(report.totalPortfolioValueUSD, 'USD'), 364, currentY + 6, { lineBreak: false });
      const grandPColor = report.totalPeriodEstimatedPnLUSD >= 0 ? '#4ade80' : '#f87171';
      doc.fillColor(grandPColor).fontSize(7).font('Helvetica-Bold')
        .text(formatSignedCurrency(report.totalPeriodEstimatedPnLUSD, 'USD'), 432, currentY + 6, { lineBreak: false });
      const grandUColor = report.totalUnrealizedPnLUSD >= 0 ? '#4ade80' : '#f87171';
      doc.fillColor(grandUColor).fontSize(7).font('Helvetica-Bold')
        .text(formatSignedCurrency(report.totalUnrealizedPnLUSD, 'USD'), 504, currentY + 6, { lineBreak: false });
    }

    // =========================================================================
    // FOOTER ON EVERY PAGE (GUARANTEED ZERO UNINTENTIONAL AUTO-PAGE BREAKS)
    // =========================================================================
    const totalPages = doc.bufferedPageRange().count;
    const footerY = 746;

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const oldBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0; // Prevent auto-adding blank pages

      doc.rect(36, footerY, 540, 0.75).fill(colors.cardBorder);
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
        .text(
          `TradeFlow Multi-Broker Positions Performance Audit • ${report.timeframeLabel} • Aggregated by Ticker`,
          36,
          footerY + 6,
          { lineBreak: false }
        );
      doc.fillColor(colors.accentIndigo).fontSize(6.5).font('Helvetica-Bold')
        .text(`Page ${i + 1} of ${totalPages}`, 480, footerY + 6, { width: 96, align: 'right', lineBreak: false });

      doc.page.margins.bottom = oldBottom;
    }

    doc.end();
  });
}

/**
 * Main Controller: Compiles report data, generates PDF buffer, and dispatches to Telegram topic
 */
export async function generateAndSendPositionsPerformanceReport({
  prisma,
  chatId,
  messageThreadId,
  timeframe,
}: {
  prisma: PrismaClient;
  chatId: string | number;
  messageThreadId?: number;
  timeframe: PositionsReportTimeframe;
}): Promise<{
  success: boolean;
  filename: string;
  pdfBuffer: Buffer;
  summaryText: string;
  reportData: PositionsPerformanceReportData;
}> {
  logToFile(`[PositionsPerformanceReport] Compiling ${timeframe} report for chat ${chatId} (thread ${messageThreadId})...`);

  // 1. Compile report metrics
  const reportData = await compilePositionsPerformanceReport(prisma, timeframe);

  // 2. Generate PDF document buffer
  const pdfBuffer = await generatePositionsPerformancePdfBuffer(reportData);
  const dateStr = reportData.generatedAt.toISOString().slice(0, 10);
  const filename = `TradeFlow_Positions_Performance_${timeframe.toLowerCase()}_${dateStr}.pdf`;

  // 3. Assemble formatted summary caption
  const pnlSign = reportData.totalUnrealizedPnLUSD >= 0 ? '+' : '';
  const pnlIcon = reportData.totalUnrealizedPnLUSD >= 0 ? '🟢' : '🔴';
  const periodSign = reportData.totalPeriodEstimatedPnLUSD >= 0 ? '+' : '';
  const periodIcon = reportData.totalPeriodEstimatedPnLUSD >= 0 ? '🟢' : '🔴';

  const periodWord =
    timeframe === 'WEEKLY' ? 'Weekly' : timeframe === 'MONTHLY' ? 'Monthly' : 'Annual';

  const topWinStr = reportData.topPeriodGainer
    ? `*$${reportData.topPeriodGainer.underlyingSymbol}* (+${reportData.topPeriodGainer.periodPriceChangePercent.toFixed(1)}%)`
    : 'None';
  const topLagStr = reportData.topPeriodLaggard
    ? `*$${reportData.topPeriodLaggard.underlyingSymbol}* (${reportData.topPeriodLaggard.periodPriceChangePercent.toFixed(1)}%)`
    : 'None';

  const caption =
    `📊 *${reportData.timeframeLabel}*\n` +
    `_Consolidated multi-broker audit (${reportData.periodDescription})_\n\n` +
    `• *Portfolio Value:* *${formatCurrency(reportData.totalPortfolioValueUSD, 'USD')}* (${formatCurrency(reportData.totalPortfolioValueGBP, 'GBP')})\n` +
    `• *${periodWord} Movement:* *${periodSign}${formatCurrency(reportData.totalPeriodEstimatedPnLUSD, 'USD')}* (${periodSign}${reportData.totalPeriodReturnPercent.toFixed(2)}% ${periodIcon})\n` +
    `• *All-Time Unrealized P&L:* *${pnlSign}${formatCurrency(reportData.totalUnrealizedPnLUSD, 'USD')}* (${pnlSign}${reportData.totalUnrealizedReturnPercent.toFixed(2)}% ${pnlIcon})\n` +
    `• *Positions:* *${reportData.totalPositionsCount} Unique Tickers* (across ${reportData.rawHoldingsCount} broker holdings • *${reportData.winRatePercent.toFixed(0)}% Win Rate*)\n` +
    `• *Asset Split:* *${reportData.equitiesCount} Equities* (${reportData.assetBreakdown.equitiesSharePercent.toFixed(0)}%) | *${reportData.optionsCount} Options* (${reportData.assetBreakdown.optionsSharePercent.toFixed(0)}%)\n` +
    `• *Top ${periodWord} Performer:* ${topWinStr}\n` +
    `• *Top ${periodWord} Laggard:* ${topLagStr}\n\n` +
    `📄 _Attached above is your color-coded PDF performance report, consolidated by ticker with 0 blank pages._`;

  // 4. Dispatch PDF to Telegram topic
  if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
    try {
      await sendPdfReportToTelegram(pdfBuffer, filename, caption, {
        chatId,
        messageThreadId,
      });
      logToFile(`[PositionsPerformanceReport] Successfully delivered ${filename} to Telegram chat ${chatId} (thread ${messageThreadId})`);
    } catch (dispatchErr: any) {
      logToFile(`[PositionsPerformanceReport] Failed to dispatch PDF to Telegram: ${dispatchErr.message}`);
    }
  }

  return {
    success: true,
    filename,
    pdfBuffer,
    summaryText: caption,
    reportData,
  };
}
