import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface PlannedTrade {
  id: string;
  symbol: string;
  underlyingSymbol?: string | null;
  action: 'BUY' | 'SELL' | 'SHORT' | 'COVER' | 'BTO' | 'STC' | 'STO' | 'BTC' | string;
  assetType: 'STOCK' | 'OPTION' | 'ETF' | 'CRYPTO' | string;
  timeframe: 'DAY' | 'WEEK' | string;
  orderType: 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | string;
  quantity: number;
  targetPrice?: number | null;
  currentPrice?: number | null;
  stopLoss?: number | null;
  targetExit?: number | null;
  conviction: 'HIGH' | 'MEDIUM' | 'SPECULATIVE' | string;
  rank: number;
  status: 'PENDING' | 'TRIGGERED' | 'EXECUTED' | 'CANCELLED' | string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlannedTradeInput {
  symbol: string;
  underlyingSymbol?: string;
  action: string;
  assetType?: string;
  timeframe?: string;
  orderType?: string;
  quantity: number;
  targetPrice?: number;
  stopLoss?: number;
  targetExit?: number;
  conviction?: string;
  notes?: string;
  rank?: number;
}

export interface UpdatePlannedTradeInput {
  symbol?: string;
  underlyingSymbol?: string;
  action?: string;
  assetType?: string;
  timeframe?: string;
  orderType?: string;
  quantity?: number;
  targetPrice?: number | null;
  stopLoss?: number | null;
  targetExit?: number | null;
  conviction?: string;
  status?: string;
  notes?: string | null;
  rank?: number;
}

export const fetchPlannedTrades = async (timeframe?: string, status?: string): Promise<PlannedTrade[]> => {
  const params = new URLSearchParams();
  if (timeframe && timeframe !== 'ALL') params.append('timeframe', timeframe);
  if (status && status !== 'ALL') params.append('status', status);

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`/api/management/planned-trades${query}`);
  if (!res.ok) {
    throw new Error('Failed to fetch planned trades');
  }
  return res.json();
};

export const createPlannedTrade = async (input: CreatePlannedTradeInput): Promise<PlannedTrade> => {
  const res = await fetch('/api/management/planned-trades', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to create planned trade' }));
    throw new Error(error.error || 'Failed to create planned trade');
  }
  return res.json();
};

export const updatePlannedTrade = async ({ id, data }: { id: string; data: UpdatePlannedTradeInput }): Promise<PlannedTrade> => {
  const res = await fetch(`/api/management/planned-trades/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to update planned trade' }));
    throw new Error(error.error || 'Failed to update planned trade');
  }
  return res.json();
};

export const deletePlannedTrade = async (id: string): Promise<{ success: boolean }> => {
  const res = await fetch(`/api/management/planned-trades/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Failed to delete planned trade');
  }
  return res.json();
};

export const reorderPlannedTrades = async (orderedIds: string[]): Promise<PlannedTrade[]> => {
  const res = await fetch('/api/management/planned-trades/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedIds }),
  });
  if (!res.ok) {
    throw new Error('Failed to reorder planned trades');
  }
  return res.json();
};

export const sendPlannedTradesTelegram = async (): Promise<{ success: boolean; messageId?: number }> => {
  const res = await fetch('/api/management/planned-trades/send-telegram', {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to dispatch Telegram PDF' }));
    throw new Error(err.error || 'Failed to dispatch Telegram PDF');
  }
  return res.json();
};

// React Query Hooks

export function usePlannedTrades(timeframe?: string, status?: string) {
  return useQuery({
    queryKey: ['plannedTrades', timeframe || 'ALL', status || 'ALL'],
    queryFn: () => fetchPlannedTrades(timeframe, status),
    staleTime: 10 * 1000,
  });
}

export function useCreatePlannedTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPlannedTrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plannedTrades'] });
    },
  });
}

export function useUpdatePlannedTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePlannedTrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plannedTrades'] });
    },
  });
}

export function useDeletePlannedTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePlannedTrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plannedTrades'] });
    },
  });
}

export function useReorderPlannedTrades() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reorderPlannedTrades,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plannedTrades'] });
    },
  });
}

export function useSendPlannedTradesPdfToTelegram() {
  return useMutation({
    mutationFn: sendPlannedTradesTelegram,
  });
}
