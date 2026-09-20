// server/services/buyingPowerService.ts
// Multi-Broker Buying Power & Margin Analyser for AI Trading
// Compares required margin, commissions, regulatory fees, and post-trade buying power between Tastytrade and IBKR.

import { fetchTastyBalances, isTastySandbox, getTastyBaseUrl } from './tastytradeService';
import { fetchIbkrAccountSummary, getIbkrConfig } from './ibkrService';

export interface BrokerMarginImpact {
  broker: 'tastytrade' | 'ibkr';
  accountNumber: string;
  environment?: string;
  currency?: string;
  availableBuyingPower: number;
  totalAvailableBuyingPower: number;
  buyingPowerRequirement: number;
  initialMarginRequirement: number;
  maintenanceMarginRequirement: number;
  notionalValue: number;
  estimatedCommission: number;
  estimatedRegulatoryFees: number;
  totalFees: number;
  totalCashOutlay: number;
  postTradeBuyingPower: number;
  postTradeAvailableBuyingPower: number;
  postTradeBufferPercent: number;
  remainingBufferPercentage: number;
  isFeasible: boolean;
  warnings: string[];
  features?: string[];
}

export interface BuyingPowerComparisonResult {
  symbol: string;
  action: string;
  quantity: number;
  price: number;
  orderType: string;
  instrumentType: 'Equity' | 'Equity Option';
  optionDetails?: {
    expirationDate: string;
    strikePrice: number;
    optionType: 'Call' | 'Put';
  };
  notionalValue: number;
  tastytrade: BrokerMarginImpact;
  ibkr: BrokerMarginImpact;
  capitalEfficiencyWinner: 'tastytrade' | 'ibkr' | 'tie' | 'equal';
  feeWinner: 'tastytrade' | 'ibkr' | 'tie' | 'equal';
  recommendedBroker: 'tastytrade' | 'ibkr' | 'either';
  recommendationRationale: string;
  verdict: {
    recommendedBroker: 'tastytrade' | 'ibkr' | 'either';
    capitalEfficiencyWinner: 'tastytrade' | 'ibkr' | 'equal';
    feeWinner: 'tastytrade' | 'ibkr' | 'equal';
    buyingPowerDifference: number;
    feeDifference: number;
    summary: string;
    rationale: string[];
  };
  analyzedAt: string;
  calculatedAt?: string;
}

export interface TradeParameters {
  symbol: string;
  action: string;
  quantity: number;
  price?: number;
  orderType?: 'Limit' | 'Market';
  instrumentType?: 'Equity' | 'Equity Option';
  optionDetails?: {
    expirationDate: string;
    strikePrice: number;
    optionType: 'Call' | 'Put';
  };
}

/**
 * Calculates comparative buying power and margin requirements for both Tastytrade and IBKR.
 */
export async function calculateBuyingPowerComparison(
  params: TradeParameters
): Promise<BuyingPowerComparisonResult> {
  const symbol = params.symbol.trim().toUpperCase().replace('$', '');
  const action = (params.action || 'BUY').toUpperCase();
  const quantity = Math.max(1, Math.round(params.quantity || 1));
  const price = params.price && params.price > 0 ? params.price : 150.00;
  const orderType = params.orderType || 'Limit';
  const instrumentType = params.instrumentType || (params.optionDetails ? 'Equity Option' : 'Equity');
  const isOption = instrumentType === 'Equity Option';
  const multiplier = isOption ? 100 : 1;
  const notionalValue = Math.round(price * quantity * multiplier * 100) / 100;

  // Fetch balances concurrently from both brokers
  const [tastyBalancesRaw, ibkrSummaryRaw] = await Promise.all([
    fetchTastyBalances().catch(() => null),
    fetchIbkrAccountSummary().catch(() => null)
  ]);

  // --------------------------------------------------------------------------
  // 1. TASTYTRADE CALCULATION
  // --------------------------------------------------------------------------
  const tastyAccNumber = process.env.TASTY_ACCOUNT_NUMBER || '5WT67220';
  const tastyEnv = isTastySandbox() ? 'Certification Sandbox' : 'Live Production';

  const tastyAvailableBp = isOption
    ? parseFloat(tastyBalancesRaw?.['derivative-buying-power'] || '14200.00')
    : parseFloat(tastyBalancesRaw?.['equity-buying-power'] || '28400.00');

  let tastyBpReq = 0;
  let tastyInitMargin = 0;
  let tastyMaintMargin = 0;
  let tastyCommission = 0;
  const tastyFees = 0.14; // Standard regulatory clearing fee per leg

  const isShortOption = isOption && (action.includes('SELL') || action.includes('SHORT'));
  const strikeVal = (params.optionDetails?.strikePrice || (price > 20 ? price : 50)) * 100 * quantity;

  if (isOption) {
    if (isShortOption) {
      // Short option (Cash-secured / naked margin requirement: premium + 20% underlying strike)
      tastyBpReq = Math.round((notionalValue + 0.20 * strikeVal) * 100) / 100;
      tastyInitMargin = tastyBpReq;
      tastyMaintMargin = Math.round(tastyBpReq * 0.8 * 100) / 100;
    } else {
      // Long option requires 100% debit premium
      tastyBpReq = notionalValue;
      tastyInitMargin = notionalValue;
      tastyMaintMargin = 0;
    }
    // Tastytrade charges $1.00 per contract to open, capped at $10.00 per leg, $0.00 to close
    tastyCommission = Math.min(10.00, 1.00 * quantity);
  } else {
    // Reg-T Margin for equities: 50% initial margin, 25% maintenance
    tastyBpReq = Math.round(notionalValue * 0.50 * 100) / 100;
    tastyInitMargin = tastyBpReq;
    tastyMaintMargin = Math.round(notionalValue * 0.25 * 100) / 100;
    // Tastytrade charges $0.00 commission on all stock trades
    tastyCommission = 0.00;
  }

  const tastyTotalFees = Math.round((tastyCommission + tastyFees) * 100) / 100;
  const tastyPostBp = Math.round((tastyAvailableBp - tastyBpReq - tastyTotalFees) * 100) / 100;
  const tastyBufferPct = tastyAvailableBp > 0
    ? Math.max(0, Math.round((tastyPostBp / tastyAvailableBp) * 1000) / 10)
    : 0;
  const tastyFeasible = tastyPostBp >= 0;

  const tastyWarnings: string[] = [];
  if (isOption && quantity > 10) {
    tastyWarnings.push('Tastytrade $10.00 max open commission cap applies per leg ($0 to close).');
  }
  if (!tastyFeasible) {
    tastyWarnings.push(`Insufficient Tastytrade BP: Requires $${(tastyBpReq + tastyTotalFees).toFixed(2)}, Available: $${tastyAvailableBp.toFixed(2)}.`);
  }

  const tastyImpact: BrokerMarginImpact = {
    broker: 'tastytrade',
    accountNumber: tastyAccNumber,
    environment: tastyEnv,
    currency: 'USD',
    availableBuyingPower: tastyAvailableBp,
    totalAvailableBuyingPower: tastyAvailableBp,
    buyingPowerRequirement: tastyBpReq,
    initialMarginRequirement: tastyInitMargin,
    maintenanceMarginRequirement: tastyMaintMargin,
    notionalValue,
    estimatedCommission: tastyCommission,
    estimatedRegulatoryFees: tastyFees,
    totalFees: tastyTotalFees,
    totalCashOutlay: Math.round((tastyInitMargin + tastyTotalFees) * 100) / 100,
    postTradeBuyingPower: tastyPostBp,
    postTradeAvailableBuyingPower: tastyPostBp,
    postTradeBufferPercent: tastyBufferPct,
    remainingBufferPercentage: tastyBufferPct,
    isFeasible: tastyFeasible,
    warnings: tastyWarnings,
    features: [
      isOption ? '$1.00/contract open ($10 cap per leg)' : '$0.00 stock commission',
      isOption ? '$0.00 to close options' : '50% Reg-T margin requirement',
      'Unified options & equity derivatives risk engine'
    ]
  };

  // --------------------------------------------------------------------------
  // 2. INTERACTIVE BROKERS (IBKR) CALCULATION
  // --------------------------------------------------------------------------
  const ibkrConfig = getIbkrConfig();
  const ibkrAccNumber = ibkrSummaryRaw?.accountId || ibkrConfig.paperAccountId || 'DU1234567';
  const ibkrEnv = ibkrConfig.environment === 'live' ? 'Live Gateway' : 'Paper Trading (Client Portal)';

  const ibkrAvailableBp = ibkrSummaryRaw?.buyingPower || 3400000.00;

  let ibkrBpReq = 0;
  let ibkrInitMargin = 0;
  let ibkrMaintMargin = 0;
  let ibkrCommission = 0;
  const ibkrFees = 0.03; // Exchange and regulatory fees

  if (isOption) {
    if (isShortOption) {
      // Short option (margin requirement: premium + 20% underlying strike)
      ibkrBpReq = Math.round((notionalValue + 0.20 * strikeVal) * 100) / 100;
      ibkrInitMargin = ibkrBpReq;
      ibkrMaintMargin = Math.round(ibkrBpReq * 0.8 * 100) / 100;
    } else {
      // Long option requires 100% premium
      ibkrBpReq = notionalValue;
      ibkrInitMargin = notionalValue;
      ibkrMaintMargin = 0;
    }
    // IBKR tiered options fee: ~$0.65 per contract
    ibkrCommission = Math.round(0.65 * quantity * 100) / 100;
  } else {
    // Reg-T Margin: 50% initial, 25-30% maintenance
    ibkrBpReq = Math.round(notionalValue * 0.50 * 100) / 100;
    ibkrInitMargin = ibkrBpReq;
    ibkrMaintMargin = Math.round(notionalValue * 0.25 * 100) / 100;
    // IBKR tiered stock fee: $0.005/share, minimum $1.00, maximum 1.0% trade value
    ibkrCommission = Math.max(1.00, Math.min(quantity * 0.005, notionalValue * 0.01));
    ibkrCommission = Math.round(ibkrCommission * 100) / 100;
  }

  const ibkrTotalFees = Math.round((ibkrCommission + ibkrFees) * 100) / 100;
  const ibkrPostBp = Math.round((ibkrAvailableBp - ibkrBpReq - ibkrTotalFees) * 100) / 100;
  const ibkrBufferPct = ibkrAvailableBp > 0
    ? Math.max(0, Math.round((ibkrPostBp / ibkrAvailableBp) * 1000) / 10)
    : 0;
  const ibkrFeasible = ibkrPostBp >= 0;

  const ibkrWarnings: string[] = [];
  if (!ibkrFeasible) {
    ibkrWarnings.push(`Insufficient IBKR BP: Requires $${(ibkrBpReq + ibkrTotalFees).toFixed(2)}, Available: $${ibkrAvailableBp.toFixed(2)}.`);
  }

  const ibkrImpact: BrokerMarginImpact = {
    broker: 'ibkr',
    accountNumber: ibkrAccNumber,
    environment: ibkrEnv,
    currency: 'USD',
    availableBuyingPower: ibkrAvailableBp,
    totalAvailableBuyingPower: ibkrAvailableBp,
    buyingPowerRequirement: ibkrBpReq,
    initialMarginRequirement: ibkrInitMargin,
    maintenanceMarginRequirement: ibkrMaintMargin,
    notionalValue,
    estimatedCommission: ibkrCommission,
    estimatedRegulatoryFees: ibkrFees,
    totalFees: ibkrTotalFees,
    totalCashOutlay: Math.round((ibkrInitMargin + ibkrTotalFees) * 100) / 100,
    postTradeBuyingPower: ibkrPostBp,
    postTradeAvailableBuyingPower: ibkrPostBp,
    postTradeBufferPercent: ibkrBufferPct,
    remainingBufferPercentage: ibkrBufferPct,
    isFeasible: ibkrFeasible,
    warnings: ibkrWarnings,
    features: [
      isOption ? '$0.65/contract flat tier' : '$0.005/share ($1.00 min)',
      'Institutional Smart Routing (SMART)',
      'Cross-margin portfolio financing capability'
    ]
  };

  // --------------------------------------------------------------------------
  // 3. COMPARISON & ROUTING RECOMMENDATION
  // --------------------------------------------------------------------------
  let feeWinner: 'tastytrade' | 'ibkr' | 'equal' = 'equal';
  if (tastyTotalFees < ibkrTotalFees) {
    feeWinner = 'tastytrade';
  } else if (ibkrTotalFees < tastyTotalFees) {
    feeWinner = 'ibkr';
  }

  let capitalEfficiencyWinner: 'tastytrade' | 'ibkr' | 'equal' = 'equal';
  if (tastyBpReq < ibkrBpReq) {
    capitalEfficiencyWinner = 'tastytrade';
  } else if (ibkrBpReq < tastyBpReq) {
    capitalEfficiencyWinner = 'ibkr';
  } else {
    // If requirement is identical, compare buffer headroom
    capitalEfficiencyWinner = ibkrBufferPct >= tastyBufferPct ? 'ibkr' : 'tastytrade';
  }

  let recommendedBroker: 'tastytrade' | 'ibkr' = 'tastytrade';
  let recommendationRationale = '';

  if (!tastyFeasible && ibkrFeasible) {
    recommendedBroker = 'ibkr';
    recommendationRationale = `Interactive Brokers is recommended: Tastytrade account has insufficient available buying power ($${tastyAvailableBp.toFixed(2)} vs $${tastyBpReq.toFixed(2)} required).`;
  } else if (!ibkrFeasible && tastyFeasible) {
    recommendedBroker = 'tastytrade';
    recommendationRationale = `Tastytrade is recommended: IBKR account has insufficient available buying power.`;
  } else if (!isOption) {
    // Equities: Tastytrade has $0 commissions
    recommendedBroker = 'tastytrade';
    const savings = Math.max(0, ibkrTotalFees - tastyTotalFees);
    recommendationRationale = `Tastytrade recommended for equities: Zero commission saves $${savings.toFixed(2)} compared to IBKR ($${ibkrTotalFees.toFixed(2)}).`;
  } else if (quantity > 10) {
    // Options with more than 10 contracts: Tastytrade caps open commissions at $10.00 and $0 to close
    recommendedBroker = 'tastytrade';
    const ibkrRoundtrip = Math.round((ibkrCommission * 2 + ibkrFees * 2) * 100) / 100;
    const savings = Math.max(0, ibkrRoundtrip - tastyTotalFees);
    recommendationRationale = `Tastytrade recommended for multi-contract option orders (${quantity} contracts): $10 max leg commission cap and $0 to close saves ~$${savings.toFixed(2)} roundtrip vs IBKR.`;
  } else {
    // Small option orders (1-10 contracts): IBKR $0.65 vs Tastytrade $1.00
    recommendedBroker = 'ibkr';
    const diff = Math.max(0, tastyTotalFees - ibkrTotalFees);
    recommendationRationale = `Interactive Brokers recommended for small options order (${quantity} contract${quantity > 1 ? 's' : ''}): $0.65/contract fee is cheaper than Tastytrade ($1.00/contract), saving $${diff.toFixed(2)}.`;
  }

  const nowIso = new Date().toISOString();

  const verdict = {
    recommendedBroker: recommendedBroker as 'tastytrade' | 'ibkr' | 'either',
    capitalEfficiencyWinner,
    feeWinner,
    buyingPowerDifference: Math.round((tastyBpReq - ibkrBpReq) * 100) / 100,
    feeDifference: Math.round((tastyTotalFees - ibkrTotalFees) * 100) / 100,
    summary: recommendationRationale,
    rationale: [
      `Initial margin: Tastytrade requires $${tastyInitMargin.toFixed(2)}, IBKR requires $${ibkrInitMargin.toFixed(2)}.`,
      `Commission & fees: Tastytrade $${tastyTotalFees.toFixed(2)} vs IBKR $${ibkrTotalFees.toFixed(2)}.`,
      `Post-trade buffer: Tastytrade ${tastyBufferPct}% vs IBKR ${ibkrBufferPct}%.`,
      ...(isOption && quantity > 10 ? ['Tastytrade $10.00 maximum open commission cap applies per leg.'] : [])
    ]
  };

  return {
    symbol,
    action,
    quantity,
    price,
    orderType,
    instrumentType,
    optionDetails: params.optionDetails,
    notionalValue,
    tastytrade: tastyImpact,
    ibkr: ibkrImpact,
    capitalEfficiencyWinner,
    feeWinner,
    recommendedBroker,
    recommendationRationale,
    verdict,
    analyzedAt: nowIso,
    calculatedAt: nowIso
  };
}
