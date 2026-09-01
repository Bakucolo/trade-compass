import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';
import { resolveYahooFinanceSymbol } from './tickerResolutionService';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export interface EarningsItem {
  symbol: string;
  resolvedSymbol: string;
  companyName: string;
  price: number;
  dayChangePercent: number;
  marketCap?: number;
  currency: string;
  
  // Earnings Timing & Data
  earningsDate: string | null;            // ISO Date string e.g. "2026-11-17T00:00:00.000Z"
  earningsDateFormatted: string;          // e.g. "Nov 17, 2026"
  daysUntil: number | null;               // e.g. 5 (days in future) or -2 (past)
  timing: 'BMO' | 'AMC' | 'UNSPECIFIED'; // Before Market Open vs After Market Close
  isEstimate: boolean;
  
  // Financial Estimates
  epsEstimate: number | null;
  epsLow: number | null;
  epsHigh: number | null;
  revenueEstimate: number | null;
  revenueLow: number | null;
  revenueHigh: number | null;
  forwardEps?: number | null;
  peRatio?: number | null;
  
  // Dividend Catalysts
  exDividendDate: string | null;
  dividendDate: string | null;
  
  // Portfolio & Watchlist Attribution
  isPortfolioHolding: boolean;
  portfolioMarketValue?: number | null;
  portfolioQuantity?: number | null;
  portfolioDayPnL?: number | null;
  isWatchlist: boolean;
  watchlistNames?: string[];
  isCustomSearch?: boolean;
}

export interface EarningsStatsSummary {
  totalMonitored: number;
  portfolioCount: number;
  watchlistCount: number;
  reportingThisWeek: number;
  reportingNextWeek: number;
  reportingThisMonth: number;
  nextReportingHolding: EarningsItem | null;
  totalPortfolioValueAtRisk: number;
}

export interface EarningsResponse {
  items: EarningsItem[];
  summary: EarningsStatsSummary;
  timestamp: string;
}

// In-memory cache for earnings data with 15-minute TTL
interface CachedEarningsData {
  data: EarningsItem;
  timestamp: number;
}
const earningsCache = new Map<string, CachedEarningsData>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 mins

/**
 * Normalizes and formats timing (BMO / AMC / UNSPECIFIED) from Yahoo Finance date
 */
function determineEarningsTiming(dateObj?: Date | string | null): 'BMO' | 'AMC' | 'UNSPECIFIED' {
  if (!dateObj) return 'UNSPECIFIED';
  const d = new Date(dateObj);
  if (isNaN(d.getTime())) return 'UNSPECIFIED';
  
  const hour = d.getUTCHours();
  // Typically BMO earnings are dated 09:00 - 13:30 UTC (before 9:30 AM EST)
  // AMC earnings are dated 20:00 - 23:00 UTC (after 4:00 PM EST)
  if (hour >= 18 || hour <= 2) return 'AMC';
  if (hour >= 8 && hour <= 14) return 'BMO';
  return 'UNSPECIFIED';
}

/**
 * Calculates days remaining until target date
 */
function calculateDaysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;

  const now = new Date();
  // Set both to midnight UTC for clean calendar day count
  const utcNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const utcTarget = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());

  const diffMs = utcTarget - utcNow;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]);
}

/**
 * Fetches earnings details for a single symbol
 */
export async function lookupSymbolEarnings(rawSymbol: string): Promise<EarningsItem | null> {
  if (!rawSymbol || !rawSymbol.trim()) return null;
  const sym = rawSymbol.trim().toUpperCase();
  const resolved = resolveYahooFinanceSymbol(sym) || sym;
  const now = Date.now();

  const cached = earningsCache.get(resolved);
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data;
  }

  return withTimeout(
    (async () => {
      try {
        const quoteSummary: any = await yahooFinance.quoteSummary(resolved, {
          modules: ['calendarEvents', 'price', 'defaultKeyStatistics']
        }, { validateResult: false }).catch(() => null);

        const priceModule = quoteSummary?.price;
        const calendar = quoteSummary?.calendarEvents;
        const stats = quoteSummary?.defaultKeyStatistics;

        if (!priceModule && !calendar) {
          return null;
        }

        const rawEarningsDates: string[] = calendar?.earnings?.earningsDate || [];
        let earningsDateStr: string | null = null;
        let earningsDateFormatted = 'Date Pending';
        let daysUntil: number | null = null;
        let timing: 'BMO' | 'AMC' | 'UNSPECIFIED' = 'UNSPECIFIED';

        if (rawEarningsDates.length > 0) {
          const d = new Date(rawEarningsDates[0]);
          if (!isNaN(d.getTime())) {
            earningsDateStr = d.toISOString();
            earningsDateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            daysUntil = calculateDaysUntil(earningsDateStr);
            timing = determineEarningsTiming(d);
          }
        }

        const item: EarningsItem = {
          symbol: sym,
          resolvedSymbol: resolved,
          companyName: priceModule?.shortName || priceModule?.longName || sym,
          price: priceModule?.regularMarketPrice || 0,
          dayChangePercent: (priceModule?.regularMarketChangePercent || 0) * 100,
          marketCap: priceModule?.marketCap || undefined,
          currency: priceModule?.currency || 'USD',
          earningsDate: earningsDateStr,
          earningsDateFormatted,
          daysUntil,
          timing,
          isEstimate: Boolean(calendar?.earnings?.isEarningsDateEstimate),
          epsEstimate: calendar?.earnings?.earningsAverage ?? null,
          epsLow: calendar?.earnings?.earningsLow ?? null,
          epsHigh: calendar?.earnings?.earningsHigh ?? null,
          revenueEstimate: calendar?.earnings?.revenueAverage ?? null,
          revenueLow: calendar?.earnings?.revenueLow ?? null,
          revenueHigh: calendar?.earnings?.revenueHigh ?? null,
          forwardEps: stats?.forwardEps ?? null,
          peRatio: stats?.forwardPE ?? (priceModule?.regularMarketPrice && stats?.trailingEps ? priceModule.regularMarketPrice / stats.trailingEps : null),
          exDividendDate: calendar?.exDividendDate ? new Date(calendar.exDividendDate).toISOString() : null,
          dividendDate: calendar?.dividendDate ? new Date(calendar.dividendDate).toISOString() : null,
          isPortfolioHolding: false,
          isWatchlist: false,
          isCustomSearch: true,
        };

        earningsCache.set(resolved, { data: item, timestamp: now });
        return item;
      } catch (err: any) {
        console.error(`[Earnings Lookup Error] for ${sym}:`, err.message);
        return null;
      }
    })(),
    8000,
    null
  );
}

/**
 * Collects all portfolio holdings, watchlists, and custom symbols and compiles the complete earnings report
 */
export async function fetchEarningsData(
  prisma: PrismaClient,
  customSymbols: string[] = []
): Promise<EarningsResponse> {
  // 1. Fetch active portfolio holdings from DB
  const holdings = await prisma.holding.findMany({
    where: { quantity: { not: 0 } },
    select: {
      symbol: true,
      underlyingSymbol: true,
      marketValue: true,
      quantity: true,
      dayPnL: true,
    },
  });

  const portfolioMap = new Map<string, { marketValue: number; quantity: number; dayPnL: number }>();
  for (const h of holdings) {
    const s = (h.underlyingSymbol || h.symbol).trim().toUpperCase();
    const existing = portfolioMap.get(s) || { marketValue: 0, quantity: 0, dayPnL: 0 };
    portfolioMap.set(s, {
      marketValue: existing.marketValue + Math.abs(h.marketValue || 0),
      quantity: existing.quantity + Math.abs(h.quantity || 0),
      dayPnL: existing.dayPnL + (h.dayPnL || 0),
    });
  }

  // 2. Fetch watchlist symbols from DB
  const watchlists = await prisma.watchlist.findMany({
    include: { items: true },
  });

  const watchlistMap = new Map<string, string[]>();
  for (const wl of watchlists) {
    for (const item of wl.items) {
      const s = item.symbol.trim().toUpperCase();
      const list = watchlistMap.get(s) || [];
      list.push(wl.name);
      watchlistMap.set(s, list);
    }
  }

  // 3. Compile unique symbol set
  const allSymbols = new Set<string>();
  for (const sym of portfolioMap.keys()) allSymbols.add(sym);
  for (const sym of watchlistMap.keys()) allSymbols.add(sym);
  for (const sym of customSymbols) {
    if (sym && sym.trim()) allSymbols.add(sym.trim().toUpperCase());
  }

  // If no symbols are available yet, add popular benchmark defaults
  if (allSymbols.size === 0) {
    ['NVDA', 'AAPL', 'MSFT', 'PLTR', 'CCJ', 'TSLA', 'AMZN', 'GOOGL'].forEach((s) => allSymbols.add(s));
  }

  const symbolList = Array.from(allSymbols);

  // 4. Fetch telemetry concurrently
  const chunkResults = await Promise.all(
    symbolList.map(async (sym) => {
      const item = await lookupSymbolEarnings(sym);
      if (!item) return null;

      const portInfo = portfolioMap.get(sym);
      const wlNames = watchlistMap.get(sym);

      return {
        ...item,
        isPortfolioHolding: Boolean(portInfo),
        portfolioMarketValue: portInfo?.marketValue ?? null,
        portfolioQuantity: portInfo?.quantity ?? null,
        portfolioDayPnL: portInfo?.dayPnL ?? null,
        isWatchlist: Boolean(wlNames && wlNames.length > 0),
        watchlistNames: wlNames || [],
        isCustomSearch: !portInfo && (!wlNames || wlNames.length === 0),
      };
    })
  );

  const items: EarningsItem[] = chunkResults.filter(Boolean) as EarningsItem[];

  // 5. Sort items: Upcoming earnings first (ordered by daysUntil ascending), then pending dates
  items.sort((a, b) => {
    // Both have daysUntil in future
    if (a.daysUntil !== null && b.daysUntil !== null) {
      if (a.daysUntil >= 0 && b.daysUntil >= 0) return a.daysUntil - b.daysUntil;
      if (a.daysUntil >= 0) return -1;
      if (b.daysUntil >= 0) return 1;
      return b.daysUntil - a.daysUntil; // Most recent past earnings first
    }
    if (a.daysUntil !== null && a.daysUntil >= 0) return -1;
    if (b.daysUntil !== null && b.daysUntil >= 0) return 1;
    if (a.isPortfolioHolding && !b.isPortfolioHolding) return -1;
    if (!a.isPortfolioHolding && b.isPortfolioHolding) return 1;
    return a.symbol.localeCompare(b.symbol);
  });

  // 6. Calculate summary telemetry
  const upcomingThisWeek = items.filter((it) => it.daysUntil !== null && it.daysUntil >= 0 && it.daysUntil <= 7);
  const upcomingNextWeek = items.filter((it) => it.daysUntil !== null && it.daysUntil > 7 && it.daysUntil <= 14);
  const upcomingThisMonth = items.filter((it) => it.daysUntil !== null && it.daysUntil >= 0 && it.daysUntil <= 30);

  const portfolioReportingUpcoming = items.filter(
    (it) => it.isPortfolioHolding && it.daysUntil !== null && it.daysUntil >= 0
  );
  const nextReportingHolding = portfolioReportingUpcoming[0] || items.find((it) => it.daysUntil !== null && it.daysUntil >= 0) || null;

  const totalPortfolioValueAtRisk = upcomingThisMonth
    .filter((it) => it.isPortfolioHolding)
    .reduce((sum, it) => sum + (it.portfolioMarketValue || 0), 0);

  const summary: EarningsStatsSummary = {
    totalMonitored: items.length,
    portfolioCount: items.filter((it) => it.isPortfolioHolding).length,
    watchlistCount: items.filter((it) => it.isWatchlist).length,
    reportingThisWeek: upcomingThisWeek.length,
    reportingNextWeek: upcomingNextWeek.length,
    reportingThisMonth: upcomingThisMonth.length,
    nextReportingHolding,
    totalPortfolioValueAtRisk,
  };

  return {
    items,
    summary,
    timestamp: new Date().toISOString(),
  };
}
