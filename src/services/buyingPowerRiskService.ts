import { PortfolioBalancesData, BrokerAccountBalance, IBKRCombinedBalance } from './portfolioBalanceService';

export type RiskLevel = 'OPTIMAL' | 'MODERATE' | 'WARNING' | 'DANGER_ZONE';

export interface BuyingPowerRiskAssessment {
  totalNetLiquidatingValue: number;
  totalAvailableBuyingPower: number;
  totalCash: number;
  totalMaintenanceMargin: number;
  marginUtilizationPercent: number;
  marginCushionPercent: number;
  riskLevel: RiskLevel;
  
  // Safe limits and reserve guidelines
  maxRecommendedDeployableBP: number;
  recommendedReserveCapital: number;
  currentCapitalDeployedPercent: number;
  
  // Liquidation / Margin Call Buffer
  marginCallBufferUSD: number;
  portfolioDrawdownTolerancePercent: number;
  
  // Broker specific insights
  brokerBreakdowns: {
    tastytrade: {
      netLiq: number;
      derivativeBP: number;
      equityBP: number;
      cash: number;
      optionsValue: number;
      bprPercent: number;
      cushionPercent: number;
      riskLevel: RiskLevel;
    };
    ibkrGia: {
      accountNumber: string;
      netLiq: number;
      availableFunds: number;
      excessLiquidity: number;
      maintMargin: number;
      cushionPercent: number;
      leverage: number;
      riskLevel: RiskLevel;
    };
    ibkrIsa: {
      accountNumber: string;
      netLiq: number;
      cash: number;
      equitiesValue: number;
      isMarginFree: boolean;
    };
    trading212: {
      netLiqUSD: number;
      freeCashUSD: number;
      investedUSD: number;
      isMarginFree: boolean;
    };
  };

  // Institutional Recommendations & Warnings
  warnings: string[];
  recommendations: string[];
}

export interface TradeSimulationInput {
  broker: 'tastytrade' | 'ibkrGia' | 'ibkrIsa' | 'trading212';
  assetType: 'EQUITY' | 'LONG_OPTION' | 'SHORT_OPTION' | 'SPREAD';
  symbol: string;
  contractsOrShares: number;
  underlyingPrice: number;
  premiumOrCostPerUnit?: number;
  estimatedBPR?: number;
}

export interface TradeSimulationResult {
  estimatedCostOrBPR: number;
  newAccountBP: number;
  newAccountCushionPercent: number;
  newTotalBP: number;
  newTotalMarginUtilization: number;
  isSafe: boolean;
  verdict: 'SAFE' | 'CAUTION' | 'CRITICAL_RISK';
  feedback: string;
}

export interface StressScenarioResult {
  scenarioName: string;
  marketDropPercent: number;
  ivExpansionPercent: number;
  projectedNetLiq: number;
  projectedMaintMargin: number;
  projectedExcessLiquidity: number;
  projectedCushionPercent: number;
  wouldTriggerMarginCall: boolean;
}

/**
 * Calculates comprehensive institutional Buying Power & Margin Risk Assessment
 */
export function calculateBuyingPowerRisk(balances?: PortfolioBalancesData | null): BuyingPowerRiskAssessment {
  const totalNet = balances?.total?.netLiquidatingValue || 0;
  const totalCash = balances?.total?.cash || 0;
  const totalBP = balances?.total?.buyingPower || 0;
  const totalMaint = balances?.total?.maintenanceMargin || 0;

  // Broker specific data
  const tasty = balances?.brokers?.tastytrade;
  const ibkr = balances?.brokers?.ibkr;
  const t212 = balances?.brokers?.trading212;

  // Tastytrade metrics
  const tastyNet = tasty?.netLiquidatingValue || 0;
  const tastyDerivBP = tasty?.derivativeBuyingPower || tasty?.buyingPower || (tastyNet * 0.5);
  const tastyEqBP = tasty?.equityBuyingPower || tastyDerivBP;
  const tastyCash = tasty?.cash || 0;
  const tastyOptVal = Math.abs(tasty?.optionsValue || 0);
  const tastyMaint = tasty?.maintMargin || 0;
  
  // Tastytrade BPR (Buying Power Reduction) % of Net Liq
  const tastyBPR = Math.max(0, tastyNet - tastyDerivBP);
  const tastyBprPct = tastyNet > 0 ? (tastyBPR / tastyNet) * 100 : 0;
  const tastyCushion = Math.max(0, Math.min(100, 100 - tastyBprPct));

  const getTastyRisk = (cushion: number): RiskLevel => {
    if (cushion >= 60) return 'OPTIMAL';
    if (cushion >= 40) return 'MODERATE';
    if (cushion >= 20) return 'WARNING';
    return 'DANGER_ZONE';
  };

  // IBKR Accounts (ISA vs GIA)
  const ibkrAccounts = ibkr?.accounts || [];
  const ibkrIsaAccount = ibkrAccounts.find(a => a.accountNumber?.includes('U14522424') || a.accountType === 'ISA');
  const ibkrGiaAccount = ibkrAccounts.find(a => a.accountNumber?.includes('U15491236') || a.accountType === 'GIA' || (!a.accountNumber?.includes('U14522424') && a !== ibkrIsaAccount));

  const giaNet = ibkrGiaAccount?.netLiquidatingValue || (ibkr?.netLiquidatingValue ? ibkr.netLiquidatingValue * 0.7 : 0);
  const giaAvail = ibkrGiaAccount?.availableFunds || ibkrGiaAccount?.buyingPower || (giaNet * 0.5);
  const giaExcess = ibkrGiaAccount?.excessLiquidity || giaAvail;
  const giaMaint = ibkrGiaAccount?.maintMargin || Math.max(0, giaNet - giaExcess);
  const giaCushion = ibkrGiaAccount?.cushion ? (ibkrGiaAccount.cushion > 1 ? ibkrGiaAccount.cushion : ibkrGiaAccount.cushion * 100) : (giaNet > 0 ? Math.max(0, (giaExcess / giaNet) * 100) : 55);
  const giaLeverage = ibkrGiaAccount?.leverage || 1.0;

  const getGiaRisk = (cushion: number): RiskLevel => {
    if (cushion >= 50) return 'OPTIMAL';
    if (cushion >= 30) return 'MODERATE';
    if (cushion >= 15) return 'WARNING';
    return 'DANGER_ZONE';
  };

  // ISA & T212 (Margin-Free Cash accounts)
  const isaNet = ibkrIsaAccount?.netLiquidatingValue || 0;
  const isaCash = ibkrIsaAccount?.cash || 0;
  const isaEqVal = ibkrIsaAccount?.equitiesValue || (isaNet - isaCash);

  const t212Net = t212?.netLiquidatingValue || 0;
  const t212Cash = t212?.cash || 0;
  const t212Invested = t212?.equitiesValue || (t212Net - t212Cash);

  // Overall Global Utilization & Cushion
  // Margin utilization considers aggregate Maintenance vs Net Liq in marginable accounts (IBKR GIA + Tastytrade)
  const marginableNetLiq = giaNet + tastyNet;
  const totalMarginReq = giaMaint + tastyMaint;
  
  const marginUtilizationPercent = marginableNetLiq > 0
    ? Math.min(100, (totalMarginReq / marginableNetLiq) * 100)
    : 0;

  const marginCushionPercent = Math.max(0, 100 - marginUtilizationPercent);

  // Determine Overall Risk Level
  let riskLevel: RiskLevel = 'OPTIMAL';
  if (marginCushionPercent < 15 || tastyCushion < 15 || giaCushion < 15) {
    riskLevel = 'DANGER_ZONE';
  } else if (marginCushionPercent < 25 || tastyCushion < 25 || giaCushion < 25) {
    riskLevel = 'WARNING';
  } else if (marginCushionPercent < 50 || tastyCushion < 40 || giaCushion < 35) {
    riskLevel = 'MODERATE';
  }

  // Institutional Rules of Thumb:
  // Recommended safe BP to deploy is 35-50% of available BP to withstand a 20% drawdown / 50% IV spike
  const safeDeployFraction = riskLevel === 'DANGER_ZONE' ? 0 : riskLevel === 'WARNING' ? 0.15 : riskLevel === 'MODERATE' ? 0.35 : 0.50;
  const maxRecommendedDeployableBP = Math.round(totalBP * safeDeployFraction);
  const recommendedReserveCapital = Math.round(totalBP * (1 - safeDeployFraction));
  const currentCapitalDeployedPercent = totalNet > 0 ? ((totalNet - totalCash) / totalNet) * 100 : 0;

  // Margin Call Buffer: how much dollar loss in asset value can occur before maint margin exceeds net liq
  // Buffer = Excess Liquidity across margin accounts
  const marginCallBufferUSD = Math.max(0, giaExcess + Math.max(0, tastyNet - tastyMaint));
  const portfolioDrawdownTolerancePercent = marginableNetLiq > 0 ? (marginCallBufferUSD / marginableNetLiq) * 100 : 100;

  // Contextual Warnings & Recommendations
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (riskLevel === 'DANGER_ZONE') {
    warnings.push('CRITICAL MARGIN CUSHION (< 15%): Extreme risk of broker liquidation or margin call under slight market volatility.');
    recommendations.push('Close high-beta short options or trim leveraged equities immediately to restore margin cushion above 30%.');
    recommendations.push('Do NOT open any new short options or long equity positions on margin.');
  } else if (riskLevel === 'WARNING') {
    warnings.push('ELEVATED MARGIN USAGE (Cushion 15–25%): Portfolio is susceptible to rapid margin expansion during market dips or IV surges.');
    recommendations.push('Maintain at least 25% dry powder reserve before committing capital to new speculative setups.');
    recommendations.push('Consider defining risk with spreads (e.g. vertical debit/credit spreads) rather than naked option writing.');
  } else if (riskLevel === 'MODERATE') {
    recommendations.push('Healthy capital posture. Safe to deploy up to ' + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(maxRecommendedDeployableBP) + ' into high-conviction trades.');
    recommendations.push('Tastytrade BPR is optimal. Keep total options buying power reduction under 45% of account equity.');
  } else {
    recommendations.push('Excellent balance sheet health. Over 50% margin cushion provides resilience against severe market selloffs.');
    recommendations.push('You have substantial excess liquidity to take advantage of tactical dip-buying and high-IV option selling opportunities.');
  }

  return {
    totalNetLiquidatingValue: totalNet,
    totalAvailableBuyingPower: totalBP,
    totalCash: totalCash,
    totalMaintenanceMargin: totalMaint,
    marginUtilizationPercent: Math.round(marginUtilizationPercent * 10) / 10,
    marginCushionPercent: Math.round(marginCushionPercent * 10) / 10,
    riskLevel,
    maxRecommendedDeployableBP,
    recommendedReserveCapital,
    currentCapitalDeployedPercent: Math.round(currentCapitalDeployedPercent * 10) / 10,
    marginCallBufferUSD: Math.round(marginCallBufferUSD),
    portfolioDrawdownTolerancePercent: Math.round(portfolioDrawdownTolerancePercent * 10) / 10,
    brokerBreakdowns: {
      tastytrade: {
        netLiq: tastyNet,
        derivativeBP: tastyDerivBP,
        equityBP: tastyEqBP,
        cash: tastyCash,
        optionsValue: tastyOptVal,
        bprPercent: Math.round(tastyBprPct * 10) / 10,
        cushionPercent: Math.round(tastyCushion * 10) / 10,
        riskLevel: getTastyRisk(tastyCushion)
      },
      ibkrGia: {
        accountNumber: ibkrGiaAccount?.accountNumber || 'U15491236',
        netLiq: giaNet,
        availableFunds: giaAvail,
        excessLiquidity: giaExcess,
        maintMargin: giaMaint,
        cushionPercent: Math.round(giaCushion * 10) / 10,
        leverage: Math.round(giaLeverage * 100) / 100,
        riskLevel: getGiaRisk(giaCushion)
      },
      ibkrIsa: {
        accountNumber: ibkrIsaAccount?.accountNumber || 'U14522424',
        netLiq: isaNet,
        cash: isaCash,
        equitiesValue: isaEqVal,
        isMarginFree: true
      },
      trading212: {
        netLiqUSD: t212Net,
        freeCashUSD: t212Cash,
        investedUSD: t212Invested,
        isMarginFree: true
      }
    },
    warnings,
    recommendations
  };
}

/**
 * Simulates a hypothetical trade to test buying power impact before order execution
 */
export function simulateTradeImpact(
  assessment: BuyingPowerRiskAssessment,
  input: TradeSimulationInput
): TradeSimulationResult {
  const { broker, assetType, contractsOrShares, underlyingPrice, premiumOrCostPerUnit, estimatedBPR } = input;

  let estimatedCost = 0;

  if (estimatedBPR && estimatedBPR > 0) {
    estimatedCost = estimatedBPR;
  } else if (assetType === 'EQUITY') {
    // 50% margin requirement on standard US margin, 100% on cash/ISA
    const notional = contractsOrShares * underlyingPrice;
    estimatedCost = (broker === 'ibkrIsa' || broker === 'trading212') ? notional : notional * 0.5;
  } else if (assetType === 'LONG_OPTION') {
    // 100% premium paid
    estimatedCost = contractsOrShares * (premiumOrCostPerUnit || underlyingPrice * 0.05) * 100;
  } else if (assetType === 'SHORT_OPTION') {
    // Tasty/IBKR naked put standard requirement: ~20% of underlying price minus OTM amount + premium
    estimatedCost = contractsOrShares * (underlyingPrice * 0.20) * 100;
  } else if (assetType === 'SPREAD') {
    // Width of spread * 100 * contracts
    estimatedCost = contractsOrShares * (premiumOrCostPerUnit || 5) * 100;
  }

  // Calculate new balances
  let accountBP = 0;
  let accountNet = 0;

  if (broker === 'tastytrade') {
    accountBP = assessment.brokerBreakdowns.tastytrade.derivativeBP;
    accountNet = assessment.brokerBreakdowns.tastytrade.netLiq;
  } else if (broker === 'ibkrGia') {
    accountBP = assessment.brokerBreakdowns.ibkrGia.availableFunds;
    accountNet = assessment.brokerBreakdowns.ibkrGia.netLiq;
  } else if (broker === 'ibkrIsa') {
    accountBP = assessment.brokerBreakdowns.ibkrIsa.cash;
    accountNet = assessment.brokerBreakdowns.ibkrIsa.netLiq;
  } else {
    accountBP = assessment.brokerBreakdowns.trading212.freeCashUSD;
    accountNet = assessment.brokerBreakdowns.trading212.netLiqUSD;
  }

  const newAccountBP = Math.max(0, accountBP - estimatedCost);
  const newAccountCushionPercent = accountNet > 0 ? Math.max(0, (newAccountBP / accountNet) * 100) : 0;
  const newTotalBP = Math.max(0, assessment.totalAvailableBuyingPower - estimatedCost);
  const newTotalMarginUtilization = assessment.totalNetLiquidatingValue > 0
    ? Math.min(100, ((assessment.totalMaintenanceMargin + estimatedCost * 0.5) / assessment.totalNetLiquidatingValue) * 100)
    : 0;

  const isSafe = newAccountBP > 0 && (estimatedCost <= accountBP) && newAccountCushionPercent >= 20;

  let verdict: 'SAFE' | 'CAUTION' | 'CRITICAL_RISK' = 'SAFE';
  let feedback = '';

  if (estimatedCost > accountBP) {
    verdict = 'CRITICAL_RISK';
    feedback = `INSUFFICIENT BUYING POWER: Required capital ($${Math.round(estimatedCost).toLocaleString()}) exceeds available account BP ($${Math.round(accountBP).toLocaleString()}). Order would be rejected by broker.`;
  } else if (newAccountCushionPercent < 15) {
    verdict = 'CRITICAL_RISK';
    feedback = `HIGH RISK WARNING: This trade consumes ${Math.round((estimatedCost / (accountBP || 1)) * 100)}% of remaining BP, pushing cushion to a dangerous ${Math.round(newAccountCushionPercent)}%. High risk of margin call on market dips.`;
  } else if (newAccountCushionPercent < 30 || estimatedCost > assessment.maxRecommendedDeployableBP) {
    verdict = 'CAUTION';
    feedback = `MODERATE USAGE: Trade uses $${Math.round(estimatedCost).toLocaleString()} (${Math.round((estimatedCost / (accountBP || 1)) * 100)}% of account BP). Projected cushion drops to ${Math.round(newAccountCushionPercent)}%. Ensure you maintain volatility reserves.`;
  } else {
    verdict = 'SAFE';
    feedback = `EXCELLENT / SAFE: Trade comfortably fits risk limits with $${Math.round(newAccountBP).toLocaleString()} remaining buying power (${Math.round(newAccountCushionPercent)}% cushion remaining).`;
  }

  return {
    estimatedCostOrBPR: Math.round(estimatedCost),
    newAccountBP: Math.round(newAccountBP),
    newAccountCushionPercent: Math.round(newAccountCushionPercent * 10) / 10,
    newTotalBP: Math.round(newTotalBP),
    newTotalMarginUtilization: Math.round(newTotalMarginUtilization * 10) / 10,
    isSafe,
    verdict,
    feedback
  };
}

/**
 * Runs stress scenarios (e.g. Market Crash -10%, -20%, Volatility Shock +50%)
 */
export function runStressScenarios(assessment: BuyingPowerRiskAssessment): StressScenarioResult[] {
  const marginNet = assessment.brokerBreakdowns.ibkrGia.netLiq + assessment.brokerBreakdowns.tastytrade.netLiq;
  const currentMaint = assessment.brokerBreakdowns.ibkrGia.maintMargin + (assessment.brokerBreakdowns.tastytrade.optionsValue * 0.3);

  const scenarios = [
    { name: 'Mild Pullback (-5% Market, +10% IV)', drop: 0.05, iv: 0.10 },
    { name: 'Correction (-10% Market, +25% IV)', drop: 0.10, iv: 0.25 },
    { name: 'Severe Crash (-20% Market, +50% IV Shock)', drop: 0.20, iv: 0.50 },
    { name: 'Black Swan Event (-30% Market, +100% IV Shock)', drop: 0.30, iv: 1.00 }
  ];

  return scenarios.map(s => {
    // Projected Net Liq drops by equity loss
    const projectedNet = Math.max(0, marginNet * (1 - s.drop));
    
    // Maintenance margin expands with IV shock on short options
    const projectedMaint = currentMaint * (1 + s.iv * 0.6) * (1 + s.drop * 0.4);
    const projectedExcess = Math.max(0, projectedNet - projectedMaint);
    const projectedCushion = projectedNet > 0 ? (projectedExcess / projectedNet) * 100 : 0;
    const wouldTriggerMarginCall = projectedMaint >= projectedNet || projectedExcess <= 0;

    return {
      scenarioName: s.name,
      marketDropPercent: s.drop * 100,
      ivExpansionPercent: s.iv * 100,
      projectedNetLiq: Math.round(projectedNet),
      projectedMaintMargin: Math.round(projectedMaint),
      projectedExcessLiquidity: Math.round(projectedExcess),
      projectedCushionPercent: Math.round(projectedCushion * 10) / 10,
      wouldTriggerMarginCall
    };
  });
}
