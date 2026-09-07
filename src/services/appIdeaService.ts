import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface AppIdea {
  id: string;
  title: string;
  description: string | null;
  topic: string;
  category: string;
  isFulfilled: boolean;
  fulfilledAt: string | null;
  tags: string | null;
  source: string;
  telegramMsgId: number | null;
  thoughtLogId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppIdeasStats {
  total: number;
  pending: number;
  fulfilled: number;
  completionPercentage: number;
}

export interface AppIdeasResponse {
  ideas: AppIdea[];
  stats: AppIdeasStats;
  topics: Record<string, { total: number; pending: number }>;
}

export interface AppIdeasQueryParams {
  filter?: 'all' | 'pending' | 'fulfilled';
  topic?: string;
  search?: string;
}

export interface CreateAppIdeaPayload {
  title: string;
  description?: string;
  topic?: string;
  category?: string;
  tags?: string;
}

export interface UpdateAppIdeaPayload {
  title?: string;
  description?: string;
  topic?: string;
  category?: string;
  isFulfilled?: boolean;
}

export function useAppIdeas(params: AppIdeasQueryParams = {}) {
  const queryParams = new URLSearchParams();
  if (params.filter && params.filter !== 'all') queryParams.set('filter', params.filter);
  if (params.topic && params.topic !== 'ALL') queryParams.set('topic', params.topic);
  if (params.search && params.search.trim()) queryParams.set('search', params.search.trim());

  const queryString = queryParams.toString();
  const url = `/api/app-ideas${queryString ? `?${queryString}` : ''}`;

  return useQuery<AppIdeasResponse>({
    queryKey: ['app-ideas', params.filter || 'all', params.topic || 'ALL', params.search || ''],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load app ideas: ${res.statusText}`);
      }
      return res.json();
    },
    staleTime: 5000,
    refetchInterval: 15000, // Poll every 15s so incoming Telegram ideas pop up automatically
  });
}

export function useToggleAppIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/app-ideas/${id}/toggle`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Failed to toggle idea');
      }
      return res.json() as Promise<AppIdea>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-ideas'] });
      queryClient.invalidateQueries({ queryKey: ['thought-logs'] });
      queryClient.invalidateQueries({ queryKey: ['thought-log-folders'] });
    },
  });
}

export function useCreateAppIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAppIdeaPayload) => {
      const res = await fetch('/api/app-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Failed to create app idea');
      }
      return res.json() as Promise<AppIdea>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-ideas'] });
      queryClient.invalidateQueries({ queryKey: ['thought-logs'] });
      queryClient.invalidateQueries({ queryKey: ['thought-log-folders'] });
    },
  });
}

export function useUpdateAppIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAppIdeaPayload }) => {
      const res = await fetch(`/api/app-ideas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Failed to update app idea');
      }
      return res.json() as Promise<AppIdea>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-ideas'] });
      queryClient.invalidateQueries({ queryKey: ['thought-logs'] });
      queryClient.invalidateQueries({ queryKey: ['thought-log-folders'] });
    },
  });
}

export function useDeleteAppIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/app-ideas/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Failed to delete app idea');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-ideas'] });
      queryClient.invalidateQueries({ queryKey: ['thought-logs'] });
      queryClient.invalidateQueries({ queryKey: ['thought-log-folders'] });
    },
  });
}

export interface AntigravitySpecResponse {
  success: boolean;
  idea: AppIdea;
  filePath: string;
  activeFilePath: string;
  filename: string;
  prompt: string;
  spec: string;
}

export function generateAntigravityPrompt(idea: {
  title: string;
  description?: string | null;
  topic?: string;
  category?: string;
  createdAt?: string;
  telegramMsgId?: number | null;
}): string {
  const topic = idea.topic || 'App';
  const category = idea.category || 'Feature';
  const rawReq = idea.description?.trim() ? `${idea.title}\n\n${idea.description.trim()}` : idea.title;

  return `Hey Antigravity, please implement this feature requested from Telegram:

**Feature**: ${idea.title}
**Topic / Category**: ${topic} (${category})
**Original Request**:
${rawReq}

**Implementation Directives**:
- Implement the function in the Trade Compass finance app according to project standards (React 18, TypeScript, Tailwind CSS, Express, Prisma SQLite).
- Inspect the relevant files in \`src/\` and \`server/\`.
- Run tests and build checks to ensure zero errors.
- Please start coding the implementation now.`;
}

export function useSaveAntigravitySpec() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ideaId, logId }: { ideaId?: string; logId?: string }) => {
      const url = ideaId
        ? `/api/app-ideas/${ideaId}/antigravity-spec`
        : `/api/app-ideas/spec-from-log/${logId}`;
      const res = await fetch(url, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Failed to save Antigravity spec');
      }
      return res.json() as Promise<AntigravitySpecResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-ideas'] });
      queryClient.invalidateQueries({ queryKey: ['thought-logs'] });
    },
  });
}
