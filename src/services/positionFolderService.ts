import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

export interface PositionFolderAssignment {
  id: string;
  folderId: string;
  positionKey: string;
  symbol: string;
  createdAt: string;
  updatedAt: string;
}

export interface PositionFolder {
  id: string;
  name: string;
  color: string;
  icon: string;
  description?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  assignments: PositionFolderAssignment[];
  positionCount: number;
}

export interface CreateFolderPayload {
  name: string;
  color?: string;
  icon?: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateFolderPayload {
  name?: string;
  color?: string;
  icon?: string;
  description?: string;
  sortOrder?: number;
}

export interface AssignPositionPayload {
  folderId: string;
  positionKey: string;
  symbol: string;
}

export interface BulkAssignPayload {
  folderId: string;
  items: Array<{
    positionKey: string;
    symbol: string;
  }>;
}

const API_BASE = '/api/position-folders';

export async function fetchPositionFolders(): Promise<PositionFolder[]> {
  const res = await fetch(API_BASE);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch position folders');
  }
  const data = await res.json();
  return data.folders || [];
}

export async function createPositionFolder(payload: CreateFolderPayload): Promise<PositionFolder> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create position folder');
  }
  const data = await res.json();
  return data.folder;
}

export async function updatePositionFolder(id: string, payload: UpdateFolderPayload): Promise<PositionFolder> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update position folder');
  }
  const data = await res.json();
  return data.folder;
}

export async function deletePositionFolder(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete position folder');
  }
}

export async function assignPositionToFolder(payload: AssignPositionPayload): Promise<PositionFolderAssignment> {
  const res = await fetch(`${API_BASE}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to assign position to folder');
  }
  const data = await res.json();
  return data.assignment;
}

export async function unassignPositionFromFolder(positionKey: string): Promise<void> {
  const res = await fetch(`${API_BASE}/assign/${encodeURIComponent(positionKey)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to unassign position');
  }
}

export async function bulkAssignPositionsToFolder(payload: BulkAssignPayload): Promise<void> {
  const res = await fetch(`${API_BASE}/bulk-assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to bulk assign positions');
  }
}

// React Query Hooks

export function usePositionFolders() {
  return useQuery<PositionFolder[]>({
    queryKey: ['positionFolders'],
    queryFn: fetchPositionFolders,
    staleTime: 30000,
  });
}

export interface PositionFolderMapResult {
  folders: PositionFolder[];
  folderById: Record<string, PositionFolder>;
  assignmentByPositionKey: Record<string, PositionFolder>;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function usePositionFolderMap(): PositionFolderMapResult {
  const { data: folders = [], isLoading, isError, refetch } = usePositionFolders();

  const { folderById, assignmentByPositionKey } = useMemo(() => {
    const byId: Record<string, PositionFolder> = {};
    const byKey: Record<string, PositionFolder> = {};

    for (const folder of folders) {
      byId[folder.id] = folder;
      if (folder.assignments) {
        for (const assign of folder.assignments) {
          if (assign.positionKey) {
            byKey[assign.positionKey] = folder;
          }
          if (assign.symbol) {
            // Also map by uppercase symbol as fallback
            const sym = assign.symbol.toUpperCase();
            if (!byKey[sym]) {
              byKey[sym] = folder;
            }
          }
        }
      }
    }

    return { folderById: byId, assignmentByPositionKey: byKey };
  }, [folders]);

  return {
    folders,
    folderById,
    assignmentByPositionKey,
    isLoading,
    isError,
    refetch,
  };
}

export function useCreatePositionFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPositionFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positionFolders'] });
    },
  });
}

export function useUpdatePositionFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateFolderPayload }) =>
      updatePositionFolder(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positionFolders'] });
    },
  });
}

export function useDeletePositionFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePositionFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positionFolders'] });
    },
  });
}

export function useAssignPositionFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assignPositionToFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positionFolders'] });
    },
  });
}

export function useUnassignPositionFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unassignPositionFromFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positionFolders'] });
    },
  });
}

export function useBulkAssignPositionFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkAssignPositionsToFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positionFolders'] });
    },
  });
}

// Color Styling Tokens
export interface FolderThemeStyle {
  color: string;
  name: string;
  badgeClass: string;
  dotColor: string;
  cardBorder: string;
  headerBg: string;
  glowClass: string;
  iconColor: string;
}

export const FOLDER_COLOR_PALETTES: Record<string, FolderThemeStyle> = {
  emerald: {
    color: 'emerald',
    name: 'Emerald Green',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25',
    dotColor: 'bg-emerald-400',
    cardBorder: 'border-emerald-500/30',
    headerBg: 'from-emerald-950/40 via-slate-900/40 to-slate-950/40',
    glowClass: 'shadow-emerald-500/10',
    iconColor: 'text-emerald-400',
  },
  cyan: {
    color: 'cyan',
    name: 'Cyan Blue',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25',
    dotColor: 'bg-cyan-400',
    cardBorder: 'border-cyan-500/30',
    headerBg: 'from-cyan-950/40 via-slate-900/40 to-slate-950/40',
    glowClass: 'shadow-cyan-500/10',
    iconColor: 'text-cyan-400',
  },
  purple: {
    color: 'purple',
    name: 'Purple Orchid',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/40 hover:bg-purple-500/25',
    dotColor: 'bg-purple-400',
    cardBorder: 'border-purple-500/30',
    headerBg: 'from-purple-950/40 via-slate-900/40 to-slate-950/40',
    glowClass: 'shadow-purple-500/10',
    iconColor: 'text-purple-400',
  },
  amber: {
    color: 'amber',
    name: 'Amber Gold',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25',
    dotColor: 'bg-amber-400',
    cardBorder: 'border-amber-500/30',
    headerBg: 'from-amber-950/40 via-slate-900/40 to-slate-950/40',
    glowClass: 'shadow-amber-500/10',
    iconColor: 'text-amber-400',
  },
  rose: {
    color: 'rose',
    name: 'Rose Red',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25',
    dotColor: 'bg-rose-400',
    cardBorder: 'border-rose-500/30',
    headerBg: 'from-rose-950/40 via-slate-900/40 to-slate-950/40',
    glowClass: 'shadow-rose-500/10',
    iconColor: 'text-rose-400',
  },
  blue: {
    color: 'blue',
    name: 'Royal Blue',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/40 hover:bg-blue-500/25',
    dotColor: 'bg-blue-400',
    cardBorder: 'border-blue-500/30',
    headerBg: 'from-blue-950/40 via-slate-900/40 to-slate-950/40',
    glowClass: 'shadow-blue-500/10',
    iconColor: 'text-blue-400',
  },
  indigo: {
    color: 'indigo',
    name: 'Deep Indigo',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/25',
    dotColor: 'bg-indigo-400',
    cardBorder: 'border-indigo-500/30',
    headerBg: 'from-indigo-950/40 via-slate-900/40 to-slate-950/40',
    glowClass: 'shadow-indigo-500/10',
    iconColor: 'text-indigo-400',
  },
};

export function getFolderThemeStyle(color?: string | null): FolderThemeStyle {
  if (!color) return FOLDER_COLOR_PALETTES.blue;
  return FOLDER_COLOR_PALETTES[color.toLowerCase()] || FOLDER_COLOR_PALETTES.blue;
}
