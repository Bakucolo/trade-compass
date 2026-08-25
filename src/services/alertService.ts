import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  status: 'ACTIVE' | 'TRIGGERED' | 'CANCELLED';
  isMuted?: boolean;
  mutedAt?: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  triggeredAt: string | null;
  triggeredPrice: number | null;
  currentPrice?: number | null;
  stockName?: string;
  distancePercent?: number | null;
}

export interface CreateAlertPayload {
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  notes?: string;
}

export interface UpdateAlertPayload {
  id: string;
  targetPrice?: number;
  condition?: 'ABOVE' | 'BELOW';
  notes?: string;
  status?: 'ACTIVE' | 'TRIGGERED' | 'CANCELLED';
  isMuted?: boolean;
}

export interface ResetAlertPayload {
  id: string;
  targetPrice?: number;
  condition?: 'ABOVE' | 'BELOW';
}

const API_BASE = '/api/alerts';

export async function fetchAlerts(params?: {
  status?: string;
  symbol?: string;
  sortBy?: string;
  sortDir?: string;
}): Promise<PriceAlert[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'ALL') query.append('status', params.status);
  if (params?.symbol) query.append('symbol', params.symbol);
  if (params?.sortBy) query.append('sortBy', params.sortBy);
  if (params?.sortDir) query.append('sortDir', params.sortDir);

  const url = query.toString() ? `${API_BASE}?${query.toString()}` : API_BASE;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch alerts');
  }
  return res.json();
}

export async function createAlert(payload: CreateAlertPayload): Promise<{ success: boolean; alert: PriceAlert }> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create alert');
  }
  return res.json();
}

export async function updateAlert({ id, ...data }: UpdateAlertPayload): Promise<{ success: boolean; alert: PriceAlert }> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update alert');
  }
  return res.json();
}

export async function muteAlert(id: string): Promise<{ success: boolean; alert: PriceAlert }> {
  const res = await fetch(`${API_BASE}/${id}/mute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to mute alert');
  }
  return res.json();
}

export async function unmuteAlert(id: string): Promise<{ success: boolean; alert: PriceAlert }> {
  const res = await fetch(`${API_BASE}/${id}/unmute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to unmute alert');
  }
  return res.json();
}

export async function resetAlert({ id, ...data }: ResetAlertPayload): Promise<{ success: boolean; alert: PriceAlert }> {
  const res = await fetch(`${API_BASE}/${id}/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reset alert');
  }
  return res.json();
}

export async function deleteAlert(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete alert');
  }
  return res.json();
}

// React Query Hooks
export function useAlerts(params?: {
  status?: string;
  symbol?: string;
  sortBy?: string;
  sortDir?: string;
}) {
  return useQuery({
    queryKey: ['alerts', params?.status, params?.symbol, params?.sortBy, params?.sortDir],
    queryFn: () => fetchAlerts(params),
    refetchInterval: 10000, // Refresh alerts every 10 seconds
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useMuteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: muteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useUnmuteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unmuteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useResetAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export async function bulkCreateAlerts(
  alerts: Array<{
    symbol: string;
    targetPrice: number;
    condition?: 'ABOVE' | 'BELOW';
    notes?: string;
  }>
): Promise<{ success: boolean; createdCount: number; alerts: PriceAlert[] }> {
  const res = await fetch(`${API_BASE}/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alerts }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create bulk alerts');
  }
  return res.json();
}

export function useBulkCreateAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alerts: Array<{ symbol: string; targetPrice: number; condition?: 'ABOVE' | 'BELOW'; notes?: string }>) =>
      bulkCreateAlerts(alerts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}
