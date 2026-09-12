import { PrismaClient } from '@prisma/client';
import { generateJsonCompletion } from './llmFallbackRouter';

export interface PortfolioAuditInput {
  positions: any[];
  balancesData?: any;
  totals?: {
    netLiquidValue: number;
    dailyPL: number;
    unrealizedPL: number;
    buyingPower: number;
  };
}

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

export interface PortfolioAuditResult {
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
  greeksExposure: {
    deltaBias: 'BULLISH_BIAS' | 'BEARISH_BIAS' | 'NEUTRAL_DELTA';
    deltaAssessment: string;
    thetaIncomePerDay: string;
    gammaRisk: string;
    assignmentRisk: string;
  };
  criticalAlerts: CriticalAlertItem[];
  actionablePlaybooks: ActionablePlaybookItem[];
  hedgingSuggestions?: Array<{
    instrument: string;
    strategy: string;
    rationale: string;
  }>;
}

/**
 * Execute the autonomous AI Portfolio Audit Agent
 */
export async function runPortfolioAuditAgent(
  input: PortfolioAuditInput,
  logToFile: (msg: string) => void = console.log
): Promise<PortfolioAuditResult> {
  const { positions = [], balancesData } = input;

  // 1. Calculate Portfolio Summary Metrics
  const totalNetLiq = balancesData?.total?.netLiquidatingValue || input.totals?.netLiquidValue || 0;
  const totalBP = balancesData?.total?.buyingPower || input.totals?.buyingPower || 0;
  const totalDayPnL = balancesData?.total?.dayPnL ?? input.totals?.dailyPL ?? 0;
  const totalUnrealizedPnL = balancesData?.total?.unrealizedPnL ?? input.totals?.unrealizedPL ?? 0;
  const positionsCount = positions.length;

  // 2. Classify Positions
  const options = positions.filter(p => p.assetType === 'Option');
  const equities = positions.filter(p => p.assetType !== 'Option');

  const shortOptions = options.filter(p => p.quantity < 0);
  const longOptions = options.filter(p => p.quantity > 0);

  const losingPositions = positions.filter(p => p.unrealizedPL < 0);
  const winningPositions = positions.filter(p => p.unrealizedPL > 0);

  // Identify high-risk / tested positions
  const criticalThreats = positions.filter(p => {
    const isOption = p.assetType === 'Option';
    const isShort = p.quantity < 0;
    const lossPct = Math.abs(p.unrealizedPLPercent || 0);
    return (isOption && isShort && lossPct > 50) || lossPct > 100 || (p.unrealizedPL < -1000);
  });

  // Concentration: Top 5 holdings by market value
  const sortedByAbsValue = [...positions].sort((a, b) => Math.abs(b.marketValue || 0) - Math.abs(a.marketValue || 0));
  const topHoldings = sortedByAbsValue.slice(0, 5).map(p => ({
    symbol: p.symbol,
    assetType: p.assetType,
    marketValue: p.marketValue,
    unrealizedPL: p.unrealizedPL,
    unrealizedPLPercent: p.unrealizedPLPercent,
    source: p.source,
    pctOfPortfolio: totalNetLiq > 0 ? (Math.abs(p.marketValue || 0) / totalNetLiq * 100).toFixed(1) : '0'
  }));

  // Build condensed positions inventory for prompt
  const condensedPositions = positions.map(p => {
    const isOpt = p.assetType === 'Option';
    return {
      symbol: p.symbol,
      assetType: p.assetType,
      optionType: p.optionType || undefined,
      strike: p.strike || undefined,
      expiry: p.expiry || undefined,
      dte: p.dte || undefined,
      quantity: p.quantity,
      cost: p.averageCost,
      currentPrice: p.currentPrice,
      underlyingPrice: p.underlyingPrice || undefined,
      marketValue: p.marketValue,
      unrealizedPL: p.unrealizedPL,
      unrealizedPLPercent: p.unrealizedPLPercent,
      source: p.source
    };
  });

  const systemPrompt = `You are a Chief Risk Officer (CRO) and Lead Derivatives Strategist at a premier multi-strategy hedge fund.
Your task is to conduct an exhaustive, institutional-grade Portfolio Audit & Risk Assessment on the user's active holdings across all connected brokerages (Interactive Brokers and Tastytrade).

YOUR GOAL:
1. Provide a definitive Portfolio Health & Resilience Score (0 to 100).
   - 80-100: OPTIMAL (High resilience, well-hedged, healthy margin cushion > 25%, controlled drawdown).
   - 60-79: BALANCED (Good structure, minor concentration or tested positions requiring standard rolls).
   - 40-59: HIGH_RISK (Heavy drawdowns, negative gamma squeeze on short options, or high margin utilization).
   - 0-39: CRITICAL_RISK (Immediate liquidation danger, massive ITM short options, margin call hazard).
2. Synthesize an Executive Overview, Macro Commentary, and Asset Concentration Diagnostic.
3. Diagnose total portfolio Greeks (Delta direction bias, Theta cash-flow decay $/day, Gamma acceleration, and Assignment vulnerability).
4. Identify all Urgent Risk Flags & Tested Strikes requiring immediate defense.
5. Provide a Prioritized, Actionable Playbook with step-by-step execution instructions (rolls, hedges, take-profits, stop-losses).

YOU MUST RETURN PURE JSON MATCHING THIS EXACT SCHEMA (no markdown outside JSON):
{
  "title": "Portfolio Tactical Audit & Risk Assessment",
  "healthScore": <NUMBER 0-100>,
  "riskLevel": "CRITICAL_RISK" | "HIGH_RISK" | "BALANCED" | "OPTIMAL",
  "totalNetLiq": ${totalNetLiq},
  "totalBuyingPower": ${totalBP},
  "totalDayPnL": ${totalDayPnL},
  "totalUnrealizedPnL": ${totalUnrealizedPnL},
  "positionsCount": ${positionsCount},
  "executiveSummary": "<Detailed 2-3 paragraph institutional analysis of the overall portfolio state, capital efficiency, win/loss ratio, and current resilience.>",
  "macroAssessment": "<Institutional macroeconomic analysis: market trend, interest rates, volatility regime (VIX), and sector exposure.>",
  "allocationAnalysis": "<Breakdown of capital allocation: Equities vs Options vs Cash, concentration in top holdings, and cash drag analysis.>",
  "greeksExposure": {
    "deltaBias": "BULLISH_BIAS" | "BEARISH_BIAS" | "NEUTRAL_DELTA",
    "deltaAssessment": "<Detailed analysis of net directional exposure>",
    "thetaIncomePerDay": "<Estimated daily time-decay cash flow or description (e.g. +$145/day)>",
    "gammaRisk": "<Assessment of gamma risk on short options near expiration>",
    "assignmentRisk": "<Assessment of assignment probability across short options>"
  },
  "criticalAlerts": [
    {
      "symbol": "<Ticker or Contract Symbol>",
      "type": "ITM_SHORT" | "GAMMA_SQUEEZE" | "HEAVY_DRAWDOWN" | "EXPIRATION_IMMINENT" | "CONCENTRATION_RISK" | "MARGIN_RISK",
      "severity": "CRITICAL" | "HIGH" | "MODERATE",
      "message": "<Clear explanation of the danger>",
      "suggestedAction": "<Immediate step to neutralize the threat>"
    }
  ],
  "actionablePlaybooks": [
    {
      "priority": 1,
      "actionType": "ROLL" | "HEDGE" | "TAKE_PROFIT" | "STOP_LOSS" | "DEPLOY_CASH" | "COLLAR" | "HOLD",
      "symbol": "<Symbol>",
      "title": "<Short bold action title, e.g. 'Roll AAPL Sep Put to Oct for Net Credit'>",
      "rationale": "<Mathematical and tactical rationale>",
      "executionSteps": [
        "<Leg 1 instruction>",
        "<Leg 2 instruction>"
      ],
      "expectedImpact": "<Expected P/L, credit, or risk reduction impact>"
    }
  ],
  "hedgingSuggestions": [
    {
      "instrument": "<e.g. SPY, QQQ, VIX, TLT>",
      "strategy": "<e.g. Bear Put Spread, Long Put, Covered Collar>",
      "rationale": "<How this hedge protects the aggregate portfolio downside>"
    }
  ]
}`;

  const userPrompt = `Perform a full portfolio tactical audit and risk evaluation on the following portfolio state:

PORTFOLIO SNAPSHOT:
- Total Net Liquidation Value: $${totalNetLiq.toLocaleString(undefined, { minimumFractionDigits: 2 })}
- Available Buying Power: $${totalBP.toLocaleString(undefined, { minimumFractionDigits: 2 })}
- Today's P&L: $${totalDayPnL >= 0 ? '+' : ''}${totalDayPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
- Open Unrealized P&L: $${totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
- Total Positions: ${positionsCount} (${equities.length} Equities, ${options.length} Options [${shortOptions.length} Short, ${longOptions.length} Long])
- Winning Positions: ${winningPositions.length} | Losing Positions: ${losingPositions.length}
- Critical Threats Identified: ${criticalThreats.length}

TOP HOLDINGS CONCENTRATION:
${JSON.stringify(topHoldings, null, 2)}

BROKER ALLOCATION & BALANCES:
${JSON.stringify(balancesData || {}, null, 2)}

ACTIVE POSITIONS INVENTORY (${positions.length} Positions):
${JSON.stringify(condensedPositions, null, 2)}

Provide a rigorous, mathematically sound, institutional portfolio audit report.`;

  logToFile(`Running AI Portfolio Analyser Agent on ${positionsCount} positions...`);

  const llmRes = await generateJsonCompletion<any>({
    systemPrompt,
    userPrompt,
    tag: 'PortfolioAnalyser',
  });

  const parsed = llmRes.data || {};

  return {
    title: parsed.title || "Portfolio Tactical Audit & Risk Assessment",
    healthScore: typeof parsed.healthScore === 'number' ? Math.max(0, Math.min(100, parsed.healthScore)) : 75,
    riskLevel: parsed.riskLevel || 'BALANCED',
    totalNetLiq,
    totalBuyingPower: totalBP,
    totalDayPnL,
    totalUnrealizedPnL,
    positionsCount,
    executiveSummary: parsed.executiveSummary || 'Comprehensive portfolio audit completed.',
    macroAssessment: parsed.macroAssessment || '',
    allocationAnalysis: parsed.allocationAnalysis || '',
    greeksExposure: parsed.greeksExposure || {
      deltaBias: 'NEUTRAL_DELTA',
      deltaAssessment: 'Balanced directional risk',
      thetaIncomePerDay: 'Positive theta decay',
      gammaRisk: 'Normal gamma profile',
      assignmentRisk: 'Low'
    },
    criticalAlerts: parsed.criticalAlerts || [],
    actionablePlaybooks: parsed.actionablePlaybooks || [],
    hedgingSuggestions: parsed.hedgingSuggestions || []
  };
}

/**
 * Save Portfolio Audit Report to the Prisma SQLite Database
 */
export async function savePortfolioAuditToDb(
  prisma: PrismaClient,
  auditResult: PortfolioAuditResult
) {
  const record = await prisma.portfolioAuditReport.create({
    data: {
      title: auditResult.title,
      healthScore: auditResult.healthScore,
      riskLevel: auditResult.riskLevel,
      totalNetLiq: auditResult.totalNetLiq,
      totalBuyingPower: auditResult.totalBuyingPower,
      totalDayPnL: auditResult.totalDayPnL,
      totalUnrealizedPnL: auditResult.totalUnrealizedPnL,
      positionsCount: auditResult.positionsCount,
      executiveSummary: auditResult.executiveSummary,
      macroAssessment: auditResult.macroAssessment,
      allocationAnalysis: auditResult.allocationAnalysis,
      greeksExposure: JSON.stringify(auditResult.greeksExposure),
      actionablePlaybooks: JSON.stringify(auditResult.actionablePlaybooks),
      criticalAlerts: JSON.stringify(auditResult.criticalAlerts),
      rawAuditJson: JSON.stringify(auditResult)
    }
  });

  return record;
}

/**
 * List recent portfolio audits from the database
 */
export async function listPortfolioAuditsFromDb(
  prisma: PrismaClient,
  limit = 20
) {
  const audits = await prisma.portfolioAuditReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return audits.map(a => {
    let parsedGreeks = null;
    let parsedAlerts = [];
    let parsedPlaybooks = [];
    try {
      parsedGreeks = a.greeksExposure ? JSON.parse(a.greeksExposure) : null;
      parsedAlerts = a.criticalAlerts ? JSON.parse(a.criticalAlerts) : [];
      parsedPlaybooks = a.actionablePlaybooks ? JSON.parse(a.actionablePlaybooks) : [];
    } catch (e) {}

    return {
      id: a.id,
      title: a.title,
      healthScore: a.healthScore,
      riskLevel: a.riskLevel,
      totalNetLiq: a.totalNetLiq,
      totalBuyingPower: a.totalBuyingPower,
      totalDayPnL: a.totalDayPnL,
      totalUnrealizedPnL: a.totalUnrealizedPnL,
      positionsCount: a.positionsCount,
      executiveSummary: a.executiveSummary,
      macroAssessment: a.macroAssessment,
      allocationAnalysis: a.allocationAnalysis,
      greeksExposure: parsedGreeks,
      criticalAlerts: parsedAlerts,
      actionablePlaybooks: parsedPlaybooks,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt
    };
  });
}

/**
 * Get a specific audit report by ID
 */
export async function getPortfolioAuditByIdFromDb(
  prisma: PrismaClient,
  id: string
) {
  const audit = await prisma.portfolioAuditReport.findUnique({
    where: { id }
  });

  if (!audit) return null;

  let raw = null;
  try {
    raw = audit.rawAuditJson ? JSON.parse(audit.rawAuditJson) : null;
  } catch (e) {}

  return {
    ...audit,
    greeksExposure: audit.greeksExposure ? JSON.parse(audit.greeksExposure) : null,
    actionablePlaybooks: audit.actionablePlaybooks ? JSON.parse(audit.actionablePlaybooks) : [],
    criticalAlerts: audit.criticalAlerts ? JSON.parse(audit.criticalAlerts) : [],
    fullDetails: raw
  };
}

/**
 * Delete a specific audit report by ID
 */
export async function deletePortfolioAuditFromDb(
  prisma: PrismaClient,
  id: string
) {
  return await prisma.portfolioAuditReport.delete({
    where: { id }
  });
}
