import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface TradeIdea {
  id: string;
  title: string;
  symbol: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  timeframe?: 'SHORT_TERM' | 'SWING' | 'LONG_TERM' | string;
  entryPrice?: number | null;
  targetPrice?: number | null;
  stopLoss?: number | null;
  content: string;
  tags?: string | null;
  status: 'ACTIVE' | 'WATCHING' | 'PLAYED_OUT' | 'ARCHIVED';
  confidenceScore?: number | null;
  source: 'MANUAL' | 'AI_AGENT';
  createdAt: string;
  updatedAt: string;
  // Enriched live data
  currentPrice?: number | null;
  stockName?: string;
  dayChangePercent?: number | null;
  pnlPercent?: number | null;
  targetDistancePercent?: number | null;
  stopDistancePercent?: number | null;
}

export interface TradeIdeaFilter {
  type?: 'ALL' | 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  status?: 'ALL' | 'ACTIVE' | 'WATCHING' | 'PLAYED_OUT' | 'ARCHIVED';
  source?: 'ALL' | 'MANUAL' | 'AI_AGENT';
  symbol?: string;
  search?: string;
}

export interface CreateTradeIdeaInput {
  title: string;
  symbol: string;
  type?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  timeframe?: string;
  entryPrice?: number | null;
  targetPrice?: number | null;
  stopLoss?: number | null;
  content?: string;
  tags?: string;
  status?: string;
  confidenceScore?: number | null;
}

export interface UpdateTradeIdeaInput {
  id: string;
  title?: string;
  symbol?: string;
  type?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  timeframe?: string;
  entryPrice?: number | null;
  targetPrice?: number | null;
  stopLoss?: number | null;
  content?: string;
  tags?: string;
  status?: string;
  confidenceScore?: number | null;
}

export interface GenerateAIIdeasInput {
  theme?: string;
  customPrompt?: string;
  sentiment?: 'ANY' | 'BULLISH' | 'BEARISH';
  timeframe?: 'SHORT_TERM' | 'SWING' | 'LONG_TERM';
  count?: number;
  tickers?: string[];
}

const API_BASE = '/api/ideas';

// Query all trade ideas with filters
export const useTradeIdeas = (filters?: TradeIdeaFilter) => {
  const queryParams = new URLSearchParams();
  if (filters?.type && filters.type !== 'ALL') queryParams.append('type', filters.type);
  if (filters?.status && filters.status !== 'ALL') queryParams.append('status', filters.status);
  if (filters?.source && filters.source !== 'ALL') queryParams.append('source', filters.source);
  if (filters?.symbol) queryParams.append('symbol', filters.symbol);
  if (filters?.search) queryParams.append('search', filters.search);

  const queryString = queryParams.toString();
  const url = queryString ? `${API_BASE}?${queryString}` : API_BASE;

  return useQuery<TradeIdea[]>({
    queryKey: ['tradeIdeas', filters],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch trade ideas');
      return res.json();
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
};

// Query a single trade idea
export const useTradeIdea = (id?: string) => {
  return useQuery<TradeIdea>({
    queryKey: ['tradeIdea', id],
    queryFn: async () => {
      if (!id) throw new Error('Idea ID required');
      const res = await fetch(`${API_BASE}/${id}`);
      if (!res.ok) throw new Error('Failed to fetch trade idea');
      return res.json();
    },
    enabled: Boolean(id),
  });
};

// Mutation to create an idea manually
export const useCreateTradeIdea = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTradeIdeaInput) => {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create trade idea');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tradeIdeas'] });
    },
  });
};

// Mutation to update an idea
export const useUpdateTradeIdea = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTradeIdeaInput) => {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update trade idea');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tradeIdeas'] });
      queryClient.invalidateQueries({ queryKey: ['tradeIdea', variables.id] });
    },
  });
};

// Mutation to delete an idea
export const useDeleteTradeIdea = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete trade idea');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tradeIdeas'] });
    },
  });
};

// Mutation to summon AI Idea Hunter Agent
export const useGenerateAIIdeas = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GenerateAIIdeasInput) => {
      const res = await fetch(`${API_BASE}/generate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'AI Idea Hunter failed to generate ideas');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tradeIdeas'] });
    },
  });
};
