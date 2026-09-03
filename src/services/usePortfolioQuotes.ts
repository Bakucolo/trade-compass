import { useQuery } from '@tanstack/react-query';

export interface BatchStockQuote {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  open?: number;
  change: number;
  changesPercentage: number;
  yesterdayChange?: number;
  yesterdayChangePercent?: number;
  overnightChangePercent?: number;
  weekChangePercent?: number;
  monthChangePercent?: number;
  currency: string;
  timestamp: number;
}

export interface PortfolioQuotesResponse {
  quotes: Record<string, BatchStockQuote>;
  count: number;
  timestamp: number;
}

export function usePortfolioQuotes(symbols?: string[]) {
  const symbolsKey = symbols ? symbols.slice().sort().join(',') : 'all';

  return useQuery<Record<string, BatchStockQuote>>({
    queryKey: ['portfolioQuotes', symbolsKey],
    queryFn: async () => {
      const url = symbols && symbols.length > 0
        ? `/api/portfolio/quotes?symbols=${encodeURIComponent(symbols.join(','))}`
        : `/api/portfolio/quotes`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to fetch portfolio quotes');
      }
      const data: PortfolioQuotesResponse = await res.json();
      return data.quotes || {};
    },
    staleTime: 60 * 1000, // 60 seconds
    refetchInterval: 60 * 1000,
    retry: 2,
  });
}
