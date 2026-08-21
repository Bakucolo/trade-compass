import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UnifiedPosition } from '@/components/portfolio/types';
import { PortfolioBalancesData } from './portfolioBalanceService';

export interface CriticalAlertItem {
  symbol: string;
  type: 'ITM_SHORT' | 'GAMMA_SQUEEZE' | 'HEAVY_DRAWDOWN' | 'EXPIRATION_IMMINENT' | 'CONCENTRATION_RISK' | 'MARGIN_RISK';
  severity: 'HIGH' | 'CRITICAL' | 'MODERATE';
  message: string;
  suggestedAction: string;
}

export interface ActionablePlaybookItem {
  priority: number;
  actionType: 'ROLL' | 'HEDGE' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'DEPLOY_CASH' | 'COLLAR' | 'HOLD';
  symbol: string;
  title: string;
  rationale: string;
  executionSteps: string[];
  expectedImpact: string;
}

export interface GreeksExposure {
  deltaBias: 'BULLISH_BIAS' | 'BEARISH_BIAS' | 'NEUTRAL_DELTA';
  deltaAssessment: string;
  thetaIncomePerDay: string;
  gammaRisk: string;
  assignmentRisk: string;
}

export interface PortfolioAuditReport {
  id?: string;
  title: string;
  healthScore: number;
  riskLevel: 'CRITICAL_RISK' | 'HIGH_RISK' | 'BALANCED' | 'OPTIMAL';
  totalNetLiq: number;
  totalBuyingPower: number;
  totalDayPnL: number;
  totalUnrealizedPnL: number;
  positionsCount: number;
  executiveSummary: string;
  macroAssessment: string;
  allocationAnalysis: string;
  greeksExposure: GreeksExposure;
  criticalAlerts: CriticalAlertItem[];
  actionablePlaybooks: ActionablePlaybookItem[];
  hedgingSuggestions?: Array<{
    instrument: string;
    strategy: string;
    rationale: string;
  }>;
  createdAt?: string;
}

export interface RunPortfolioAuditPayload {
  positions: UnifiedPosition[];
  balancesData?: PortfolioBalancesData;
  totals?: {
    netLiquidValue: number;
    dailyPL: number;
    unrealizedPL: number;
    buyingPower: number;
  };
}

export const portfolioAuditService = {
  async runAudit(payload: RunPortfolioAuditPayload): Promise<{ success: boolean; auditId: string; audit: PortfolioAuditReport; savedAt: string }> {
    const res = await fetch('/api/portfolio/audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to run portfolio audit (${res.status})`);
    }

    return res.json();
  },

  async listAudits(limit = 20): Promise<PortfolioAuditReport[]> {
    const res = await fetch(`/api/portfolio/audits?limit=${limit}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch audit history (${res.status})`);
    }
    const data = await res.json();
    return data.audits || [];
  },

  async getAuditById(id: string): Promise<PortfolioAuditReport> {
    const res = await fetch(`/api/portfolio/audits/${id}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch audit report (${res.status})`);
    }
    const data = await res.json();
    return data.audit;
  },

  async deleteAudit(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/portfolio/audits/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      throw new Error(`Failed to delete audit report (${res.status})`);
    }
    return res.json();
  }
};

export function useRunPortfolioAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RunPortfolioAuditPayload) => portfolioAuditService.runAudit(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-audits'] });
    }
  });
}

export function usePortfolioAudits(limit = 20) {
  return useQuery({
    queryKey: ['portfolio-audits', limit],
    queryFn: () => portfolioAuditService.listAudits(limit),
    staleTime: 30000
  });
}

export function useDeletePortfolioAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portfolioAuditService.deleteAudit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-audits'] });
    }
  });
}
