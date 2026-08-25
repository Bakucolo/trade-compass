import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface WatchlistItemRecord {
  id: string;
  watchlistId: string;
  symbol: string;
  addedAt: string;
}

export interface WatchlistSummary {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  items: WatchlistItemRecord[];
}

export interface EnrichedStockItem {
  id: string;
  watchlistId: string;
  addedAt: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sector: string;
  industry: string;
  marketCap: number | null;
  pe: number | null;
  ps: number | null;
  eps: number | null;
  operatingMargin: number | null;
  roe: number | null;
  debtToEquity: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  volume: number | null;
  error?: string | null;
}

export interface WatchlistDetailsResponse {
  watchlist: {
    id: string;
    name: string;
    isDefault: boolean;
    createdAt: string;
  };
  items: EnrichedStockItem[];
}

const API_BASE = '/api/watchlists';

// Fetch all watchlists
export async function fetchWatchlists(): Promise<WatchlistSummary[]> {
  const res = await fetch(API_BASE);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch watchlists');
  }
  return res.json();
}

// Fetch enriched details for a single watchlist
export async function fetchWatchlistData(id: string): Promise<WatchlistDetailsResponse> {
  const res = await fetch(`${API_BASE}/${id}/data`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch watchlist data');
  }
  return res.json();
}

// Create new watchlist
export async function createWatchlist(name: string): Promise<WatchlistSummary> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create watchlist');
  }
  return res.json();
}

// Rename watchlist
export async function renameWatchlist(id: string, name: string): Promise<WatchlistSummary> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to rename watchlist');
  }
  return res.json();
}

// Delete watchlist
export async function deleteWatchlist(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete watchlist');
  }
  return res.json();
}

// Add symbol to watchlist
export async function addSymbolToWatchlist(watchlistId: string, symbol: string): Promise<{ success: boolean; item: WatchlistItemRecord }> {
  const res = await fetch(`${API_BASE}/${watchlistId}/symbols`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to add symbol');
  }
  return res.json();
}

// Remove symbol from watchlist
export async function removeSymbolFromWatchlist(watchlistId: string, symbol: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/${watchlistId}/symbols/${symbol}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to remove symbol');
  }
  return res.json();
}

// React Query Hooks
export function useWatchlists() {
  return useQuery({
    queryKey: ['watchlists'],
    queryFn: fetchWatchlists,
    staleTime: 30 * 1000,
  });
}

export function useWatchlistData(id: string | null | undefined) {
  return useQuery({
    queryKey: ['watchlistData', id],
    queryFn: () => fetchWatchlistData(id!),
    enabled: Boolean(id),
    staleTime: 20 * 1000,
    refetchInterval: 30 * 1000, // Background refresh prices
  });
}

export function useCreateWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createWatchlist(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
    },
  });
}

export function useRenameWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameWatchlist(id, name),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      queryClient.invalidateQueries({ queryKey: ['watchlistData', data.id] });
    },
  });
}

export function useDeleteWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWatchlist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
    },
  });
}

export function useAddSymbolToWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ watchlistId, symbol }: { watchlistId: string; symbol: string }) =>
      addSymbolToWatchlist(watchlistId, symbol),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      queryClient.invalidateQueries({ queryKey: ['watchlistData', variables.watchlistId] });
    },
  });
}

export function useRemoveSymbolFromWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ watchlistId, symbol }: { watchlistId: string; symbol: string }) =>
      removeSymbolFromWatchlist(watchlistId, symbol),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      queryClient.invalidateQueries({ queryKey: ['watchlistData', variables.watchlistId] });
    },
  });
}

// Bulk Add / Resolve Types
export interface ResolvedBulkEntry {
  rawInput: string;
  symbol: string;
  name: string;
  currentPrice: number | null;
  dayChangePercent: number | null;
  targetPrice: number | null;
  condition: 'ABOVE' | 'BELOW';
  notes: string;
  sector?: string;
  isValid: boolean;
  error?: string;
}

export interface ResolveBulkResponse {
  results: ResolvedBulkEntry[];
  parsedCount: number;
  validCount: number;
}

// Resolve freeform text into tickers, names, prices & alert conditions
export async function resolveBulkEntries(text: string): Promise<ResolveBulkResponse> {
  const res = await fetch(`${API_BASE}/resolve-bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to resolve bulk entries');
  }
  return res.json();
}

// Bulk add symbols to an existing watchlist
export async function bulkAddSymbolsToWatchlist(
  watchlistId: string,
  symbols: string[]
): Promise<{ success: boolean; addedCount: number; existingCount: number; totalSymbols: number; symbols: string[] }> {
  const res = await fetch(`${API_BASE}/${watchlistId}/symbols/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to bulk add symbols');
  }
  return res.json();
}

// Bulk create a new watchlist with initial symbols
export async function bulkCreateWatchlist(name: string, symbols: string[]): Promise<WatchlistSummary> {
  const res = await fetch(`${API_BASE}/bulk-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, symbols }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create watchlist');
  }
  return res.json();
}

export function useResolveBulkEntries() {
  return useMutation({
    mutationFn: (text: string) => resolveBulkEntries(text),
  });
}

export function useBulkAddSymbolsToWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ watchlistId, symbols }: { watchlistId: string; symbols: string[] }) =>
      bulkAddSymbolsToWatchlist(watchlistId, symbols),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      queryClient.invalidateQueries({ queryKey: ['watchlistData', variables.watchlistId] });
      queryClient.invalidateQueries({ queryKey: ['market-dips-radar'] });
    },
  });
}

export function useBulkCreateWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, symbols }: { name: string; symbols: string[] }) =>
      bulkCreateWatchlist(name, symbols),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      queryClient.invalidateQueries({ queryKey: ['market-dips-radar'] });
    },
  });
}
