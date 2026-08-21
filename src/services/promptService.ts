import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ReportPromptTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  systemPrompt: string;
  userPrompt: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromptPayload {
  name: string;
  description?: string;
  category?: string;
  systemPrompt: string;
  userPrompt?: string;
}

export interface UpdatePromptPayload {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  systemPrompt?: string;
  userPrompt?: string;
}

const API_BASE = '/api/research/prompts';

export async function fetchReportPrompts(): Promise<ReportPromptTemplate[]> {
  const res = await fetch(API_BASE);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch report prompts');
  }
  return res.json();
}

export async function createPromptTemplate(payload: CreatePromptPayload): Promise<ReportPromptTemplate> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create prompt template');
  }
  return res.json();
}

export async function updatePromptTemplate({ id, ...data }: UpdatePromptPayload): Promise<ReportPromptTemplate> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update prompt template');
  }
  return res.json();
}

export async function deletePromptTemplate(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete prompt template');
  }
  return res.json();
}

export async function resetPromptTemplates(): Promise<ReportPromptTemplate[]> {
  const res = await fetch(`${API_BASE}/reset`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reset prompt templates');
  }
  return res.json();
}

// React Query Hooks
export function useReportPrompts() {
  return useQuery({
    queryKey: ['reportPrompts'],
    queryFn: fetchReportPrompts,
    staleTime: 60 * 1000,
  });
}

export function useCreatePromptTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPromptTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportPrompts'] });
    },
  });
}

export function useUpdatePromptTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePromptTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportPrompts'] });
    },
  });
}

export function useDeletePromptTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePromptTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportPrompts'] });
    },
  });
}

export function useResetPromptTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetPromptTemplates,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportPrompts'] });
    },
  });
}
