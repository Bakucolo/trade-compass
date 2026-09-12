import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ProviderAllowance {
  providerId: 'openrouter' | 'google-ai-studio' | 'groq' | 'cloudflare' | 'ollama';
  name: string;
  hasKey: boolean;
  tier: 'Free Tier' | 'Credit Balance' | 'Local Offline';
  isAvailable: boolean;
  isCoolingDown: boolean;
  cooldownRemainingSeconds: number;
  quotaType: 'usd' | 'requests_daily' | 'unlimited';
  totalQuota: number | null;
  consumed: number;
  remaining: number | null;
  percentRemaining: number;
  unitLabel: string;
  rateLimits: {
    rpm?: number;
    rpd?: number;
    tpm?: number;
    resetText?: string;
  };
  activeModel: string;
  totalCalls: number;
  successfulCalls: number;
  requestsToday: number;
  lastUsedAt?: string;
  notes?: string;
}

export interface LLMAllowancesReport {
  timestamp: string;
  totalCallsToday: number;
  activeCascade: string[];
  providers: ProviderAllowance[];
}

export const llmAllowancesService = {
  async getAllowances(): Promise<LLMAllowancesReport> {
    const res = await fetch('/api/llm/allowances');
    if (!res.ok) {
      throw new Error(`Failed to fetch LLM allowances (${res.status})`);
    }
    return res.json();
  },

  async resetCooldown(provider?: string): Promise<void> {
    const res = await fetch('/api/llm/cooldown/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    if (!res.ok) {
      throw new Error(`Failed to reset cooldown (${res.status})`);
    }
  },
};

export function useLLMAllowances() {
  return useQuery<LLMAllowancesReport>({
    queryKey: ['llm-allowances'],
    queryFn: () => llmAllowancesService.getAllowances(),
    refetchInterval: 15000, // Auto-refresh allowances every 15s
    staleTime: 5000,
  });
}

export function useResetLLMCooldown() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider?: string) => llmAllowancesService.resetCooldown(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-allowances'] });
    },
  });
}
