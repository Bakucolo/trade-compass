import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

export type NoteSentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface StockNote {
  id: string;
  symbol: string;
  content: string;
  tags?: string | null;
  sentiment?: NoteSentiment | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveStockNotePayload {
  symbol: string;
  content: string;
  tags?: string | null;
  sentiment?: NoteSentiment | null;
}

const API_BASE = '/api/notes';

export async function fetchStockNotes(): Promise<StockNote[]> {
  const res = await fetch(API_BASE);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch stock notes');
  }
  return res.json();
}

export async function fetchStockNote(symbol: string): Promise<StockNote | null> {
  if (!symbol) return null;
  const res = await fetch(`${API_BASE}/${encodeURIComponent(symbol.trim().toUpperCase())}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch stock note');
  }
  return res.json();
}

export async function saveStockNote(payload: SaveStockNotePayload): Promise<{ success: boolean; note: StockNote }> {
  const cleanSymbol = payload.symbol.trim().toUpperCase();
  const res = await fetch(`${API_BASE}/${encodeURIComponent(cleanSymbol)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: payload.content,
      tags: payload.tags,
      sentiment: payload.sentiment,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save note');
  }
  return res.json();
}

export async function deleteStockNote(symbol: string): Promise<{ success: boolean; message: string }> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const res = await fetch(`${API_BASE}/${encodeURIComponent(cleanSymbol)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete note');
  }
  return res.json();
}

// React Query Hooks

export function useStockNotes() {
  return useQuery<StockNote[]>({
    queryKey: ['stockNotes'],
    queryFn: fetchStockNotes,
    staleTime: 30000,
  });
}

export function useStockNotesMap(): { notesMap: Record<string, StockNote>; isLoading: boolean } {
  const { data: notes = [], isLoading } = useStockNotes();
  const notesMap = useMemo(() => {
    const map: Record<string, StockNote> = {};
    for (const note of notes) {
      if (note.symbol) {
        map[note.symbol.toUpperCase()] = note;
      }
    }
    return map;
  }, [notes]);

  return { notesMap, isLoading };
}

export function useStockNote(symbol?: string | null) {
  return useQuery<StockNote | null>({
    queryKey: ['stockNote', symbol?.trim().toUpperCase()],
    queryFn: () => (symbol ? fetchStockNote(symbol) : Promise.resolve(null)),
    enabled: Boolean(symbol),
    staleTime: 30000,
  });
}

export function useSaveStockNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveStockNote,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stockNotes'] });
      if (data?.note?.symbol) {
        queryClient.invalidateQueries({ queryKey: ['stockNote', data.note.symbol.toUpperCase()] });
      }
    },
  });
}

export function useDeleteStockNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteStockNote,
    onSuccess: (_, symbol) => {
      queryClient.invalidateQueries({ queryKey: ['stockNotes'] });
      queryClient.invalidateQueries({ queryKey: ['stockNote', symbol.toUpperCase()] });
    },
  });
}
