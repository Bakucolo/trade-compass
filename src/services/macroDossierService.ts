import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface MacroPillarMetric {
  label: string;
  value: string;
  interpretation: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface MacroPillar {
  id: string;
  name: string;
  icon?: string;
  status: 'BENIGN' | 'CAUTION' | 'SEVERE' | 'STIMULATIVE';
  summary: string;
  keyMetrics: MacroPillarMetric[];
  strategicImplications: string;
}

export interface MacroScenario {
  id: 'base_case' | 'bull_reflation' | 'bear_shock';
  title: string;
  probabilityPercent: number;
  description: string;
  keyTriggers: string[];
  winners: string[];
  losers: string[];
  strategicAction: string;
}

export interface TacticalAllocationItem {
  category: 'Equities' | 'Fixed Income / Duration' | 'Commodities & Real Assets' | 'Currencies & Cash' | 'Derivatives & Hedging';
  subAsset: string;
  stance: 'OVERWEIGHT' | 'NEUTRAL' | 'UNDERWEIGHT' | 'TACTICAL_HEDGE';
  rationale: string;
  recommendedVehicles: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface CatalystRadarItem {
  id: string;
  title: string;
  category: 'MONETARY_POLICY' | 'INFLATION_DATA' | 'LABOR_MARKET' | 'GEOPOLITICS' | 'EARNINGS_LIQUIDITY';
  timeframe: string;
  potentialImpact: 'HIGH' | 'CRITICAL' | 'MODERATE';
  whatToWatch: string;
  criticalPivotLevel?: string;
}

export interface MacroDossierReport {
  id?: string;
  title: string;
  regimeTitle: string;
  regimeTone: 'bullish' | 'bearish' | 'neutral' | 'warning';
  macroScore: number; // 0 - 100 overall stability & health score
  growthOutlook: 'EXPANSIONARY' | 'MODERATING' | 'STAGNANT' | 'CONTRACTION';
  inflationRegime: 'DEFLATIONARY' | 'DISINFLATION' | 'STICKY_TARGET' | 'ACCELERATING';
  monetaryPolicyPosture: 'HAWKISH' | 'NEUTRAL_PAUSE' | 'DOVISH_EASING';
  liquidityCondition: 'EXPANDING' | 'NEUTRAL' | 'TIGHTENING';
  
  // Telemetry Snapshots
  vixLevel: number;
  yield10y: number;
  spread2y10y: number;
  dxyLevel: number;
  oilPrice: number;
  fedFundsRate: number;
  highYieldSpread: number;
  
  // Core Narrative
  executiveSummary: string;
  narrativeOverview: string;
  keyTakeaways: string[];
  
  // 7 Deep-Dive Macro Pillars
  pillars: MacroPillar[];
  
  // Probabilistic Scenarios
  scenarios: MacroScenario[];
  
  // Cross-Asset Tactical Allocations & Hedging
  tacticalAllocations: TacticalAllocationItem[];
  
  // Upcoming Watchpoints & Catalysts
  catalystsRadar: CatalystRadarItem[];
  
  createdAt?: string;
}

/**
 * Check if a dossier was generated on the current calendar day
 */
export function isDossierFromToday(createdAt?: string | Date | null): boolean {
  if (!createdAt) return false;
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export interface GenerateMacroDossierPayload {
  portfolioContext?: {
    totalPositions?: number;
    netLiquidValue?: number;
    optionsCount?: number;
  };
  force?: boolean;
  clientDate?: string;
}

export interface GenerateMacroDossierResponse {
  success: boolean;
  dossier: MacroDossierReport;
  cachedDaily?: boolean;
  message?: string;
}

export const macroDossierService = {
  async generateDossier(payload: GenerateMacroDossierPayload = {}): Promise<GenerateMacroDossierResponse> {
    const res = await fetch('/api/macro/dossier/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        clientDate: payload.clientDate || new Date().toISOString()
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to generate macro dossier (${res.status})`);
    }

    return res.json();
  },

  async getTodayDossier(clientDate?: string): Promise<{ exists: boolean; dossier: MacroDossierReport | null }> {
    const query = clientDate ? `?clientDate=${encodeURIComponent(clientDate)}` : `?clientDate=${encodeURIComponent(new Date().toISOString())}`;
    const res = await fetch(`/api/macro/dossier/today${query}`);
    if (!res.ok) {
      throw new Error(`Failed to check today's macro dossier (${res.status})`);
    }
    return res.json();
  },

  async listDossiers(limit = 20): Promise<MacroDossierReport[]> {
    const res = await fetch(`/api/macro/dossiers?limit=${limit}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch macro dossiers (${res.status})`);
    }
    return res.json();
  },

  async getDossierById(id: string): Promise<MacroDossierReport> {
    const res = await fetch(`/api/macro/dossier/${id}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch macro dossier (${res.status})`);
    }
    return res.json();
  },

  async deleteDossier(id: string): Promise<{ success: boolean; id: string }> {
    const res = await fetch(`/api/macro/dossier/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      throw new Error(`Failed to delete macro dossier (${res.status})`);
    }
    return res.json();
  }
};

/**
 * React Query: Fetch historical macro dossiers
 */
export function useMacroDossiers(limit = 20) {
  return useQuery({
    queryKey: ['macroDossiers', limit],
    queryFn: () => macroDossierService.listDossiers(limit),
    staleTime: 30 * 1000
  });
}

/**
 * React Query: Fetch single macro dossier by ID
 */
export function useMacroDossier(id?: string) {
  return useQuery({
    queryKey: ['macroDossier', id],
    queryFn: () => macroDossierService.getDossierById(id!),
    enabled: Boolean(id)
  });
}

/**
 * React Query: Check/fetch today's saved macro dossier
 */
export function useTodayMacroDossier() {
  return useQuery({
    queryKey: ['macroDossierToday', new Date().toDateString()],
    queryFn: () => macroDossierService.getTodayDossier(new Date().toISOString()),
    staleTime: 60 * 1000
  });
}

/**
 * React Query: Trigger Autonomous Macro Dossier Agent
 */
export function useGenerateMacroDossier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: GenerateMacroDossierPayload = {}) => macroDossierService.generateDossier(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['macroDossiers'] });
      queryClient.invalidateQueries({ queryKey: ['agentActivities'] });
      queryClient.invalidateQueries({ queryKey: ['macroOverview'] });
    }
  });
}

/**
 * React Query: Delete a saved macro dossier
 */
export function useDeleteMacroDossier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => macroDossierService.deleteDossier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['macroDossiers'] });
    }
  });
}
