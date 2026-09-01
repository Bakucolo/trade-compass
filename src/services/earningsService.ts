import { useQuery } from '@tanstack/react-query';

export interface EarningsItem {
  symbol: string;
  resolvedSymbol: string;
  companyName: string;
  price: number;
  dayChangePercent: number;
  marketCap?: number;
  currency: string;
  
  // Earnings Timing & Data
  earningsDate: string | null;            // ISO Date string
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
  
  // Attribution
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

const API_BASE = '/api/earnings';

/**
 * Fetch earnings data for portfolio, watchlists, and any custom symbols
 */
export async function fetchEarnings(customSymbols: string[] = []): Promise<EarningsResponse> {
  const url = customSymbols.length > 0
    ? `${API_BASE}?symbols=${encodeURIComponent(customSymbols.join(','))}`
    : API_BASE;
    
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch earnings: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Instant lookup for single symbol
 */
export async function lookupSymbolEarnings(symbol: string): Promise<EarningsItem> {
  const res = await fetch(`${API_BASE}/lookup/${encodeURIComponent(symbol.toUpperCase())}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to lookup earnings for ${symbol}`);
  }
  return res.json();
}

/**
 * React Query hook for full earnings calendar & data
 */
export function useEarningsData(customSymbols: string[] = []) {
  return useQuery<EarningsResponse>({
    queryKey: ['earningsData', customSymbols],
    queryFn: () => fetchEarnings(customSymbols),
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 mins
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Generates an .ics file string for downloading an earnings reminder
 */
export function generateIcsCalendarEvent(item: EarningsItem): string {
  if (!item.earningsDate) return '';
  const dateObj = new Date(item.earningsDate);
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  
  const startTime = item.timing === 'BMO' ? '133000Z' : '203000Z';
  const endTime = item.timing === 'BMO' ? '143000Z' : '213000Z';
  const dtStart = `${year}${month}${day}T${startTime}`;
  const dtEnd = `${year}${month}${day}T${endTime}`;

  const summary = `📊 ${item.symbol} Earnings Release (${item.timing === 'BMO' ? 'Before Market Open' : 'After Market Close'})`;
  const description = `${item.companyName} ($${item.symbol}) earnings announcement.\nEPS Consensus: ${item.epsEstimate ? '$' + item.epsEstimate.toFixed(2) : 'N/A'}\nRevenue Estimate: ${item.revenueEstimate ? '$' + (item.revenueEstimate / 1e9).toFixed(2) + 'B' : 'N/A'}\nTracked via TradeFlow Compass.`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TradeFlow//Earnings Calendar//EN',
    'BEGIN:VEVENT',
    `UID:earnings-${item.symbol}-${year}${month}${day}@tradeflow.app`,
    `DTSTAMP:${year}${month}${day}T000000Z`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Trigger download of .ics calendar file
 */
export function downloadEarningsCalendarIcs(item: EarningsItem) {
  const icsContent = generateIcsCalendarEvent(item);
  if (!icsContent) return;

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', `${item.symbol}_Earnings_${item.earningsDateFormatted.replace(/[\s,]+/g, '_')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
