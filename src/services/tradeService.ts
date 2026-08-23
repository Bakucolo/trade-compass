import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface UnifiedTrade {
  id: string;
  broker: 'Tastytrade' | 'Interactive Brokers' | 'Manual' | string;
  brokerTradeId?: string | null;
  symbol: string;
  underlyingSymbol?: string | null;
  assetType: 'OPTION' | 'EQUITY';
  optionType?: 'CALL' | 'PUT' | null;
  strikePrice?: number | null;
  expiryDate?: string | null;
  action: 'BUY_TO_OPEN' | 'SELL_TO_CLOSE' | 'SELL_TO_OPEN' | 'BUY_TO_CLOSE' | 'BUY' | 'SELL' | string;
  side: 'BUY' | 'SELL';
  positionEffect: 'LONG' | 'SHORT';
  quantity: number;
  price: number;
  totalValue: number;
  valueEffect?: 'CREDIT' | 'DEBIT' | null;
  commission?: number | null;
  clearingFees?: number | null;
  orderId?: string | null;
  description?: string | null;
  executedAt: string;
  createdAt: string;
}

export interface TradeSummaryMetrics {
  totalTrades: number;
  totalBoughtValue: number;
  totalSoldValue: number;
  totalCredits: number;
  totalDebits: number;
  netCashFlow: number;
  totalCommissions: number;
  optionsCount: number;
  equitiesCount: number;
  longCount: number;
  shortCount: number;
}

export interface TradeFilterParams {
  broker?: string;
  dateRangePreset?: 'today' | '7d' | '30d' | '90d' | 'ytd' | 'all' | 'custom' | string;
  startDate?: string;
  endDate?: string;
  assetType?: 'all' | 'OPTION' | 'EQUITY' | string;
  optionType?: 'all' | 'CALL' | 'PUT' | string;
  positionEffect?: 'all' | 'LONG' | 'SHORT' | string;
  action?: 'all' | 'BUY' | 'SELL' | 'BUY_TO_OPEN' | 'SELL_TO_OPEN' | 'BUY_TO_CLOSE' | 'SELL_TO_CLOSE' | string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TradeResponse {
  success: boolean;
  trades: UnifiedTrade[];
  metrics: TradeSummaryMetrics;
  totalCount: number;
  page: number;
  limit: number;
  syncedCount?: number;
}

export const tradeService = {
  async getTrades(params: TradeFilterParams = {}): Promise<TradeResponse> {
    const query = new URLSearchParams();
    if (params.broker && params.broker !== 'all') query.set('broker', params.broker);
    if (params.dateRangePreset && params.dateRangePreset !== 'all') query.set('dateRangePreset', params.dateRangePreset);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.assetType && params.assetType !== 'all') query.set('assetType', params.assetType);
    if (params.optionType && params.optionType !== 'all') query.set('optionType', params.optionType);
    if (params.positionEffect && params.positionEffect !== 'all') query.set('positionEffect', params.positionEffect);
    if (params.action && params.action !== 'all') query.set('action', params.action);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const url = `/api/trades?${query.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch trades (${res.status})`);
    }
    return res.json();
  },

  async syncTrades(params: TradeFilterParams = {}): Promise<TradeResponse> {
    const query = new URLSearchParams();
    if (params.broker && params.broker !== 'all') query.set('broker', params.broker);
    if (params.dateRangePreset && params.dateRangePreset !== 'all') query.set('dateRangePreset', params.dateRangePreset);
    if (params.search) query.set('search', params.search);

    const url = `/api/trades/sync?${query.toString()}`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to sync trades (${res.status})`);
    }
    return res.json();
  },

  async createTrade(data: Partial<UnifiedTrade>): Promise<{ success: boolean; trade: UnifiedTrade }> {
    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to log manual trade');
    }
    return res.json();
  },

  async deleteTrade(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/trades/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete trade record');
    }
    return res.json();
  }
};

export function useTrades(params: TradeFilterParams = {}) {
  return useQuery({
    queryKey: ['trades', params],
    queryFn: () => tradeService.getTrades(params),
    staleTime: 10000
  });
}

export function useSyncTrades() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: TradeFilterParams = {}) => tradeService.syncTrades(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
    }
  });
}

export function useCreateTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UnifiedTrade>) => tradeService.createTrade(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
    }
  });
}

export function useDeleteTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tradeService.deleteTrade(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
    }
  });
}
