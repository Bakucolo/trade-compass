import { useQuery } from '@tanstack/react-query';

export interface Trading212Status {
  connected: boolean;
  accountId?: number;
  currency?: string;
  lastSync?: string;
  error?: string;
}

export interface Trading212Account {
  free: number;
  total: number;
  ppl: number;
  result: number;
  invested: number;
  pieCash: number;
  blocked?: number;
  currency: string;
  accountId: number;
}

export interface Trading212PositionItem {
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  ppl: number;
  fxPpl?: number | null;
  initialFillDate?: string;
  maxBuy?: number;
  maxSell?: number | null;
  pieQuantity?: number;
}

export function useTrading212Status() {
  return useQuery<Trading212Status>({
    queryKey: ['trading212Status'],
    queryFn: async () => {
      const res = await fetch('/api/trading212/status');
      if (!res.ok) {
        return { connected: false };
      }
      return res.json();
    },
    refetchInterval: 15000,
  });
}

export function useTrading212Account() {
  return useQuery<Trading212Account>({
    queryKey: ['trading212Account'],
    queryFn: async () => {
      const res = await fetch('/api/trading212/account');
      if (!res.ok) {
        throw new Error('Failed to fetch Trading 212 account');
      }
      return res.json();
    },
    refetchInterval: 15000,
  });
}

export function useTrading212Positions() {
  return useQuery<Trading212PositionItem[]>({
    queryKey: ['trading212Positions'],
    queryFn: async () => {
      const res = await fetch('/api/trading212/positions');
      if (!res.ok) {
        return [];
      }
      const data = await res.json();
      return data.items || data || [];
    },
    refetchInterval: 15000,
  });
}
