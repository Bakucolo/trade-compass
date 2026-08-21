import { useMutation } from '@tanstack/react-query';
import { UnifiedPosition } from '@/components/portfolio/types';

export interface ManagementPlan {
  planId: string;
  title: string;
  actionType: 'ROLL_OUT' | 'ROLL_OUT_DOWN' | 'ROLL_OUT_UP' | 'INVERT_HEDGE' | 'STOP_LOSS' | 'ASSIGN_WHEEL' | 'TAKE_PROFIT' | 'HOLD';
  isRecommended: boolean;
  summary: string;
  orderLegs: string[];
  netCreditOrDebit?: string;
  newBreakeven?: string;
  probabilityImprovement?: string;
  tradeoffs?: string;
}

export interface GreeksRiskDiagnosis {
  deltaRisk?: string;
  gammaRisk?: string;
  thetaStatus?: string;
  assignmentProbability?: string;
  dteDangerZone?: string;
}

export interface TechnicalCatalystContext {
  supportLevel?: string;
  resistanceLevel?: string;
  earningsWarning?: string;
  ivOutlook?: string;
}

export interface PositionAnalysisData {
  urgencyLevel: 'CRITICAL_DEFENSE' | 'MONITOR_AND_ADJUST' | 'PROFIT_TARGET_REACHED' | 'HEALTHY_ON_TRACK';
  urgencyHeadline: string;
  currentPnlAssessment: string;
  greeksAndRiskDiagnosis: GreeksRiskDiagnosis;
  rankedPlans: ManagementPlan[];
  technicalAndCatalystContext: TechnicalCatalystContext;
  tradingRuleOfThumb: string;
}

export interface PositionAdvisorResponse {
  success: boolean;
  position: UnifiedPosition;
  analysis: PositionAnalysisData;
  liveOptionChain?: {
    underlyingSymbol: string;
    underlyingPrice: number;
    expirationDates: string[];
    options: Array<{
      contractSymbol: string;
      strike: number;
      optionType: 'CALL' | 'PUT';
      expiration: string;
      dte: number;
      bid: number;
      ask: number;
      mid: number;
      lastPrice: number;
      impliedVolatility: number;
      inTheMoney: boolean;
    }>;
  };
}

export const positionAdvisorService = {
  async analyzePosition(position: UnifiedPosition): Promise<PositionAdvisorResponse> {
    const res = await fetch('/api/portfolio/analyze-position', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(position)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to analyze position (${res.status})`);
    }

    return res.json();
  }
};

export function useAnalyzePosition() {
  return useMutation({
    mutationFn: (position: UnifiedPosition) => positionAdvisorService.analyzePosition(position)
  });
}
