import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type AgentType =
  | 'PORTFOLIO_AUDIT'
  | 'PORTFOLIO_VALUATION'
  | 'DIP_ANALYZER'
  | 'POSITION_DEFENSE'
  | 'MACRO_DOSSIER'
  | 'RESEARCH_AGENT'
  | 'STOCK_ANALYSIS'
  | 'TRADE_IDEA_GENERATOR'
  | 'MARKET_DATA_SYNC';

export interface AgentActivityEvent {
  id: string;
  agentName: string;
  agentType: AgentType;
  taskDescription: string;
  targetSymbol?: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  outcomeSummary?: string;
  metadata?: Record<string, any>;
  error?: string;
}

export const agentActivityService = {
  async getActivities(limit = 50): Promise<AgentActivityEvent[]> {
    const res = await fetch(`/api/agent/activity?limit=${limit}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch agent activities (${res.status})`);
    }
    const data = await res.json();
    return data.activities || [];
  },

  async clearActivities(): Promise<void> {
    const res = await fetch('/api/agent/activity', { method: 'DELETE' });
    if (!res.ok) {
      throw new Error(`Failed to clear agent activities (${res.status})`);
    }
  }
};

export function useAgentActivities(limit = 50) {
  return useQuery({
    queryKey: ['agent-activities', limit],
    queryFn: () => agentActivityService.getActivities(limit),
    refetchInterval: 3000, // Poll every 3 seconds for live agent execution updates
    staleTime: 2000
  });
}

export function useClearAgentActivities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => agentActivityService.clearActivities(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-activities'] });
    }
  });
}
