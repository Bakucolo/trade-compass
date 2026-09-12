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

export async function deleteMutedAlerts(): Promise<{ success: boolean; count: number; message: string }> {
  const res = await fetch(`${API_BASE}/muted`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete muted alerts');
  }
  return res.json();
}

export async function bulkMuteAlerts(ids?: string[]): Promise<{ success: boolean; count: number; message: string }> {
  const res = await fetch(`${API_BASE}/bulk-mute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to bulk mute alerts');
  }
  return res.json();
}

export async function bulkDeleteAlerts(ids: string[]): Promise<{ success: boolean; count: number; message: string }> {
  const res = await fetch(`${API_BASE}/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to bulk delete alerts');
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

export function useDeleteMutedAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMutedAlerts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useBulkMuteAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkMuteAlerts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useBulkDeleteAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkDeleteAlerts,
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

// ==========================================
// SHORT OPTIONS PROXIMITY ALERTS (5% & 10%)
// ==========================================

export interface ShortOptionDefenseLevelInfo {
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  description: string;
  bufferPct: number;
}

export interface ShortOptionDefenseLevels {
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  warning10Pct: ShortOptionDefenseLevelInfo;
  critical5Pct: ShortOptionDefenseLevelInfo;
}

export interface ShortOptionAlertStatusItem {
  holdingId: string;
  symbol: string;
  underlyingSymbol: string;
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  expiryDate?: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  brokerName?: string;
  defenseLevels: ShortOptionDefenseLevels;
  underlyingCurrentPrice?: number | null;
  underlyingDistanceTo10Pct?: number | null;
  underlyingDistanceTo5Pct?: number | null;
  alert10Pct?: {
    id: string;
    status: 'ACTIVE' | 'TRIGGERED' | 'CANCELLED';
    targetPrice: number;
    condition: 'ABOVE' | 'BELOW';
    triggeredAt?: string | null;
    isMuted?: boolean;
  } | null;
  alert5Pct?: {
    id: string;
    status: 'ACTIVE' | 'TRIGGERED' | 'CANCELLED';
    targetPrice: number;
    condition: 'ABOVE' | 'BELOW';
    triggeredAt?: string | null;
    isMuted?: boolean;
  } | null;
}

export interface SyncShortOptionAlertsResult {
  success: boolean;
  totalShortOptions: number;
  existingAlertsCount: number;
  createdAlertsCount: number;
  createdAlerts: Array<{
    id: string;
    symbol: string;
    targetPrice: number;
    condition: string;
    notes: string | null;
  }>;
}

export async function fetchShortOptionAlertsStatus(): Promise<ShortOptionAlertStatusItem[]> {
  const res = await fetch(`${API_BASE}/short-options`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch short option alerts status');
  }
  return res.json();
}

export async function syncShortOptionAlerts(): Promise<SyncShortOptionAlertsResult> {
  const res = await fetch(`${API_BASE}/short-options/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to sync short option alerts');
  }
  return res.json();
}

export async function createAlertsForSingleShortOption(holdingId: string): Promise<{ success: boolean; alerts: PriceAlert[] }> {
  const res = await fetch(`${API_BASE}/short-options/position/${holdingId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to set short option alerts for position');
  }
  return res.json();
}

export function useShortOptionAlertsStatus() {
  return useQuery({
    queryKey: ['short-options-alerts'],
    queryFn: fetchShortOptionAlertsStatus,
    refetchInterval: 15000,
  });
}

export function useSyncShortOptionAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncShortOptionAlerts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['short-options-alerts'] });
    },
  });
}

export function useCreateSingleShortOptionAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (holdingId: string) => createAlertsForSingleShortOption(holdingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['short-options-alerts'] });
    },
  });
}

