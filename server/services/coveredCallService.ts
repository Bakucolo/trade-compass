import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';
import { calculateBlackScholesPrice, OptionQuoteItem } from './optionDefenseService';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export interface ProposedCallStrike {
  tier: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';
  tierName: string;
  targetDelta: number;
  strike: number;
  expiration: string;
  dte: number;
  estimatedBid: number;
  estimatedAsk: number;
  estimatedMid: number;
  premiumPerContract: number; // Mid * 100
  totalPotentialIncome: number; // Premium * capacity
  annualizedYieldPercent: number; // (Premium / (Strike * 100)) * (365 / DTE) * 100
  otmBufferPercent: number; // ((Strike - Price) / Price) * 100
  probabilityOfProfitPercent: number; // (1 - Delta) * 100
  breakEvenPrice: number; // Price - Mid
  impliedVolatility: number;
  isRealQuote: boolean;
  contractSymbol?: string;
}

export type CoverageStatus =
  | 'UNCOVERED_OPPORTUNITY'
  | 'PARTIALLY_COVERED'
  | 'FULLY_COVERED'
  | 'DELTA_DEFICIT';

export interface ActiveCoveredCallPosition {
  contractSymbol: string;
  strike: number;
  expiration: string;
  dte: number;
  quantity: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL?: number;
  unrealizedPLPercent?: number;
  broker?: string;
  account?: string;
}

export interface CoveredCallPositionCandidate {
  symbol: string;
  companyName: string;
  assetType: 'EQUITY' | 'OPTION' | 'MIXED';
  currentPrice: number;
  totalMarketValue: number;
  shareCount: number;
  totalCapacity: number; // Gross capacity (shares/100 + long calls)
  coveredCallCapacity: number; // Real remaining UNCOVERED call capacity (totalCapacity - activeCalls)
  coveredSharesCount: number; // Shares currently pledged to active calls (activeCalls * 100)
  uncoveredSharesCount: number; // Shares truly free and unhedged (shareCount - coveredSharesCount)
  hasActiveCalls: boolean; // Convenience flag: true if shortCallsCount > 0
  longCallsCount: number;
  shortCallsCount: number;
  netPositionDelta: number; // Net aggregate delta (1 share = +1, 1 long call ~ +60-90, 1 short call ~ -30-50)
  unhedgedDelta: number; // Delta available to cover with short calls
  coverageStatus: CoverageStatus;
  activeCoveredCalls: ActiveCoveredCallPosition[];
  proposedCalls: {
    conservative: ProposedCallStrike;
    balanced: ProposedCallStrike;
    aggressive: ProposedCallStrike;
  };
  ivRankPercentile?: number;
  dividendYieldPercent?: number;
  fiftyTwoWeekHigh?: number;
  distanceFrom52WHigh?: number;
  brokers: string[];
}

export interface CoveredCallsAnalysisResult {
  scanTimestamp: string;
  totalPortfolioNetDelta: number;
  totalEligiblePositionsCount: number;
  uncoveredPositionsCount: number;
  partiallyCoveredCount: number;
  fullyCoveredCount: number;
  activePositionsCount: number; // Number of underlying stocks with active short call positions
  totalActiveCallsCount: number; // Total active short call contracts currently open across the portfolio
  totalUncoveredCallCapacity: number; // Total number of 100-share call contracts that can be sold
  potentialMonthlyIncomeEstimate: number; // Conservative/Balanced blended estimate
  potentialAnnualizedYieldEstimate: number;
  candidates: CoveredCallPositionCandidate[];
}

/**
 * Standard normal CDF for Delta calculation
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate Call Delta using Black-Scholes formula
 */
function calculateCallDelta(
  underlyingPrice: number,
  strike: number,
  dte: number,
  impliedVol = 0.35,
  riskFreeRate = 0.045
): number {
  if (dte <= 0) return underlyingPrice >= strike ? 1.0 : 0.0;
  const t = Math.max(0.001, dte / 365.0);
  const v = Math.max(0.05, Math.min(2.5, impliedVol || 0.35));
  const s = Math.max(0.01, underlyingPrice);
  const k = Math.max(0.01, strike);

  const d1 = (Math.log(s / k) + (riskFreeRate + (v * v) / 2.0) * t) / (v * Math.sqrt(t));
  return Math.max(0.01, Math.min(0.99, normalCDF(d1)));
}

/**
 * Helper to generate target expiration date (~30-45 days out on a Friday)
 */
function getTargetExpirationDate(daysTarget = 35): { expirationStr: string; dte: number } {
  const target = new Date();
  target.setDate(target.getDate() + daysTarget);

  // Align to closest Friday (day 5)
  const day = target.getDay();
  const diffToFriday = (5 - day + 7) % 7;
  target.setDate(target.getDate() + diffToFriday);

  const now = new Date();
  const dte = Math.max(1, Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const expirationStr = target.toISOString().split('T')[0];

  return { expirationStr, dte };
}

/**
 * Propose call strikes across Conservative, Balanced, and Aggressive tiers
 */
export function buildProposedCallStrikes(
  price: number,
  capacity: number,
  realOptions: OptionQuoteItem[] = [],
  impliedVol = 0.35
): {
  conservative: ProposedCallStrike;
  balanced: ProposedCallStrike;
  aggressive: ProposedCallStrike;
} {
  const safePrice = Math.max(1, price);
  const safeCapacity = Math.max(1, capacity);
  const { expirationStr: defaultExp, dte: defaultDte } = getTargetExpirationDate(35);

  // Helper to find closest real call option from chain or compute theoretical
  const buildTier = (
    tier: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE',
    tierName: string,
    targetDelta: number,
    approxOtmPct: number
  ): ProposedCallStrike => {
    // 1. Try to find matching real option near target delta & target DTE (20-55 DTE)
    const callsInTargetDte = realOptions.filter(
      (o) => o.optionType === 'CALL' && o.dte >= 18 && o.dte <= 60 && o.strike >= safePrice
    );

    let bestOption: OptionQuoteItem | null = null;
    let minDeltaDiff = Infinity;

    for (const opt of callsInTargetDte) {
      const optDelta = calculateCallDelta(safePrice, opt.strike, opt.dte, opt.impliedVolatility || impliedVol);
      const diff = Math.abs(optDelta - targetDelta);
      if (diff < minDeltaDiff) {
        minDeltaDiff = diff;
        bestOption = opt;
      }
    }

    if (bestOption && minDeltaDiff <= 0.15 && bestOption.mid > 0.05) {
      const optDelta = calculateCallDelta(safePrice, bestOption.strike, bestOption.dte, bestOption.impliedVolatility || impliedVol);
      const premiumPerContract = Math.round(bestOption.mid * 100 * 100) / 100;
      const totalIncome = Math.round(premiumPerContract * safeCapacity * 100) / 100;
      const annYield = (bestOption.mid / safePrice) * (365 / Math.max(1, bestOption.dte)) * 100;
      const otmPct = ((bestOption.strike - safePrice) / safePrice) * 100;
      const pop = Math.round((1 - optDelta) * 100);

      return {
        tier,
        tierName,
        targetDelta: parseFloat(optDelta.toFixed(2)),
        strike: bestOption.strike,
        expiration: bestOption.expiration,
        dte: bestOption.dte,
        estimatedBid: bestOption.bid,
        estimatedAsk: bestOption.ask,
        estimatedMid: bestOption.mid,
        premiumPerContract,
        totalPotentialIncome: totalIncome,
        annualizedYieldPercent: parseFloat(annYield.toFixed(1)),
        otmBufferPercent: parseFloat(otmPct.toFixed(1)),
        probabilityOfProfitPercent: Math.max(50, Math.min(95, pop)),
        breakEvenPrice: parseFloat((safePrice - bestOption.mid).toFixed(2)),
        impliedVolatility: parseFloat(((bestOption.impliedVolatility || impliedVol) * 100).toFixed(1)),
        isRealQuote: true,
        contractSymbol: bestOption.contractSymbol,
      };
    }

    // 2. Theoretical Black-Scholes Fallback
    const targetStrikeMultiplier = 1 + approxOtmPct / 100;
    // Round strike to standard increments ($0.50, $1.00, $2.50, $5.00)
    let strikeIncrement = 1.0;
    if (safePrice < 25) strikeIncrement = 0.5;
    else if (safePrice < 100) strikeIncrement = 1.0;
    else if (safePrice < 200) strikeIncrement = 2.5;
    else strikeIncrement = 5.0;

    const rawStrike = safePrice * targetStrikeMultiplier;
    const strike = Math.round(rawStrike / strikeIncrement) * strikeIncrement;
    const midPrice = calculateBlackScholesPrice(safePrice, strike, defaultDte, impliedVol, 'CALL');
    const calculatedDelta = calculateCallDelta(safePrice, strike, defaultDte, impliedVol);
    const premiumPerContract = Math.round(midPrice * 100 * 100) / 100;
    const totalIncome = Math.round(premiumPerContract * safeCapacity * 100) / 100;
    const annYield = (midPrice / safePrice) * (365 / defaultDte) * 100;
    const otmPct = ((strike - safePrice) / safePrice) * 100;
    const pop = Math.round((1 - calculatedDelta) * 100);

    return {
      tier,
      tierName,
      targetDelta: parseFloat(calculatedDelta.toFixed(2)),
      strike,
      expiration: defaultExp,
      dte: defaultDte,
      estimatedBid: Math.max(0.01, parseFloat((midPrice * 0.95).toFixed(2))),
      estimatedAsk: parseFloat((midPrice * 1.05).toFixed(2)),
      estimatedMid: parseFloat(midPrice.toFixed(2)),
      premiumPerContract,
      totalPotentialIncome: totalIncome,
      annualizedYieldPercent: parseFloat(annYield.toFixed(1)),
      otmBufferPercent: parseFloat(otmPct.toFixed(1)),
      probabilityOfProfitPercent: Math.max(50, Math.min(95, pop)),
      breakEvenPrice: parseFloat((safePrice - midPrice).toFixed(2)),
      impliedVolatility: parseFloat((impliedVol * 100).toFixed(1)),
      isRealQuote: false,
    };
  };

  return {
    conservative: buildTier('CONSERVATIVE', 'Conservative (Capital Preservation)', 0.18, 9.0),
    balanced: buildTier('BALANCED', 'Sweet Spot (Balanced Yield)', 0.28, 4.5),
    aggressive: buildTier('AGGRESSIVE', 'Aggressive (Max Income)', 0.40, 2.0),
  };
}

/**
 * Scan entire portfolio to analyze covered call eligibility, calculate deltas, and propose income strikes
 */
export async function analyzePortfolioCoveredCalls(
  prisma: PrismaClient,
  logToFile: (msg: string) => void = console.log
): Promise<CoveredCallsAnalysisResult> {
  const scanTimestamp = new Date().toISOString();

  // 1. Fetch all user holdings from DB with broker relation
  const rawHoldings = await prisma.holding.findMany({
    include: { broker: true },
    orderBy: { marketValue: 'desc' },
  });

  const IBKR_ISA_ACCOUNT = 'U14522424';
  const IBKR_GIA_ACCOUNT = 'U15491236';

  logToFile(`[Covered Calls] Scanning ${rawHoldings.length} portfolio records (filtering strictly for Tastytrade & IBKR GIA)...`);

  // 2. Group holdings and options by underlying symbol
  interface AggregatedUnderlying {
    symbol: string;
    companyName: string;
    shares: number;
    marketValue: number;
    currentPrice: number;
    longCalls: Array<{
      strike: number;
      expiry?: string;
      quantity: number;
      price: number;
      marketValue: number;
      unrealizedPL?: number;
      unrealizedPLPercent?: number;
      symbol: string;
      broker?: string;
      account?: string;
    }>;
    shortCalls: Array<{
      strike: number;
      expiry?: string;
      quantity: number;
      price: number;
      marketValue: number;
      unrealizedPL?: number;
      unrealizedPLPercent?: number;
      symbol: string;
      broker?: string;
      account?: string;
    }>;
    brokers: Set<string>;
  }

  const underlyingMap = new Map<string, AggregatedUnderlying>();

  const formatExpiryDate = (val: any): string | undefined => {
    if (!val) return undefined;
    if (val instanceof Date) return val.toISOString().split('T')[0];
    const str = String(val).trim();
    if (/^\d{8}$/.test(str)) {
      return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
    }
    if (str.includes('T')) return str.split('T')[0];
    return str;
  };

  for (const h of rawHoldings) {
    const rawSym = (h.symbol || '').trim().toUpperCase();
    if (!rawSym) continue;

    // Detect broker & account eligibility:
    // USER MANDATE: Covered Call Harvester must ONLY propose covered calls for Tastytrade and IBKR GIA.
    // Trading 212 and IBKR ISA (U14522424) cannot trade or sell call options.
    const brokerName = (h.broker?.name || '').trim();
    const isTastytrade = brokerName.toLowerCase().includes('tasty');
    const isTrading212 = brokerName.toLowerCase().includes('trading 212') || brokerName.toLowerCase().includes('t212') || (h.brokerSpecificId && h.brokerSpecificId.toLowerCase().includes('t212'));

    // Exclude Trading 212
    if (isTrading212) continue;

    const isIbkr = brokerName.toLowerCase().includes('interactive') || brokerName.toLowerCase().includes('ibkr') || !h.broker;

    let isEligibleAccount = false;
    let brokerTag = '';

    if (isTastytrade) {
      isEligibleAccount = true;
      brokerTag = 'Tastytrade';
    } else if (isIbkr) {
      const isExplicitIsa = h.brokerSpecificId?.includes(IBKR_ISA_ACCOUNT);
      const isExplicitGia = h.brokerSpecificId?.includes(IBKR_GIA_ACCOUNT);
      const isIsa = isExplicitIsa || (!isExplicitGia && h.assetType !== 'OPTION' && (h.quantity || 0) > 0);

      // Only IBKR GIA is eligible for covered calls (ISA cash accounts cannot sell covered calls)
      if (!isIsa) {
        isEligibleAccount = true;
        brokerTag = 'IBKR GIA';
      }
    }

    if (!isEligibleAccount) {
      continue;
    }

    // Detect OCC standard option formatting (e.g., PLTR  241018C00030000)
    const occMatch = rawSym.match(/^([A-Z0-9]+)\s*(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/i);
    let parsedUnderlying = '';
    let parsedExpiry: string | undefined = undefined;
    let parsedStrike = 0;
    let parsedType = '';

    if (occMatch) {
      parsedUnderlying = occMatch[1].trim().toUpperCase();
      parsedExpiry = `20${occMatch[2]}-${occMatch[3]}-${occMatch[4]}`;
      parsedType = occMatch[5].toUpperCase() === 'C' ? 'CALL' : 'PUT';
      parsedStrike = parseInt(occMatch[6], 10) / 1000;
    }

    // Detect if this is an option contract
    const isOption = h.assetType === 'OPTION' || Boolean(occMatch) || rawSym.includes('  ') || Boolean(h.optionType);
    const underlying = isOption ? (h.underlyingSymbol || parsedUnderlying || rawSym.split(' ')[0] || rawSym) : rawSym;

    if (!underlyingMap.has(underlying)) {
      underlyingMap.set(underlying, {
        symbol: underlying,
        companyName: h.name || underlying,
        shares: 0,
        marketValue: 0,
        currentPrice: h.currentPrice || 0,
        longCalls: [],
        shortCalls: [],
        brokers: new Set<string>(),
      });
    }

    const group = underlyingMap.get(underlying)!;
    if (brokerTag) group.brokers.add(brokerTag);
    if (h.currentPrice && h.currentPrice > 0 && group.currentPrice === 0) {
      group.currentPrice = h.currentPrice;
    }

    if (!isOption) {
      // Direct stock equity holding in Tastytrade or IBKR GIA
      group.shares += h.quantity || 0;
      group.marketValue += h.marketValue || (h.quantity * (h.currentPrice || 0));
    } else {
      // Option contract
      const isCall = h.optionType === 'CALL' || parsedType === 'CALL' || rawSym.includes('C0') || rawSym.includes('C00');
      const isShort = (h.quantity || 0) < 0 || (h as any).action === 'SELL_TO_OPEN' || (h as any).positionEffect === 'SHORT';
      const absQty = Math.abs(h.quantity || 1);
      const effectiveExpiry = formatExpiryDate(h.expiryDate) || parsedExpiry;
      const effectiveStrike = h.strikePrice || parsedStrike || 0;

      if (isCall) {
        if (isShort) {
          group.shortCalls.push({
            symbol: rawSym,
            strike: effectiveStrike,
            expiry: effectiveExpiry,
            quantity: absQty,
            price: h.currentPrice || 0,
            marketValue: h.marketValue || 0,
            unrealizedPL: h.unrealizedPnL ?? undefined,
            unrealizedPLPercent: h.unrealizedPnLPercent ?? undefined,
            broker: brokerTag,
            account: h.brokerSpecificId,
          });
        } else {
          group.longCalls.push({
            symbol: rawSym,
            strike: effectiveStrike,
            expiry: effectiveExpiry,
            quantity: absQty,
            price: h.currentPrice || 0,
            marketValue: h.marketValue || 0,
            unrealizedPL: h.unrealizedPnL ?? undefined,
            unrealizedPLPercent: h.unrealizedPnLPercent ?? undefined,
            broker: brokerTag,
            account: h.brokerSpecificId,
          });
        }
      }
    }
  }

  // 3. Process candidate evaluation and option chains in parallel
  const underlyingEntries = Array.from(underlyingMap.entries()).filter(
    ([_, group]) => group.shares >= 1 || group.longCalls.length > 0 || group.shortCalls.length > 0
  );

  const fetchWithTimeout = <T>(promise: Promise<T>, ms = 3000): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
    ]);

  const candidatePromises = underlyingEntries.map(async ([underlying, group]) => {
    // Number of active short calls covering 100-share blocks
    const totalShortCallContracts = group.shortCalls.reduce((sum, sc) => sum + sc.quantity, 0);
    const totalLongCallContracts = group.longCalls.reduce((sum, lc) => sum + lc.quantity, 0);

    // Total gross long capacity (100 shares = 1 contract, 1 long call = 1 contract)
    const stockContracts = Math.floor(group.shares / 100);
    const totalCapacity = stockContracts + totalLongCallContracts;

    // REAL remaining UNCOVERED capacity (available contracts to sell without going naked)
    const realUncoveredCapacity = Math.max(0, totalCapacity - totalShortCallContracts);

    // Shares committed to active calls vs shares completely uncovered
    const coveredSharesCount = Math.min(group.shares, totalShortCallContracts * 100);
    const uncoveredSharesCount = Math.max(0, group.shares - (totalShortCallContracts * 100));

    // Determine net position delta
    let calculatedDelta = group.shares;
    for (const lc of group.longCalls) {
      calculatedDelta += lc.quantity * 70; // ~0.70 Delta per long call
    }
    for (const sc of group.shortCalls) {
      calculatedDelta -= sc.quantity * 30; // ~0.30 Delta per short call
    }

    const unhedgedDelta = Math.max(0, calculatedDelta);

    // Determine coverage status
    let coverageStatus: CoverageStatus = 'DELTA_DEFICIT';
    if (totalCapacity >= 1) {
      if (totalShortCallContracts === 0) {
        coverageStatus = 'UNCOVERED_OPPORTUNITY';
      } else if (realUncoveredCapacity >= 1) {
        coverageStatus = 'PARTIALLY_COVERED';
      } else {
        coverageStatus = 'FULLY_COVERED';
      }
    } else if (calculatedDelta >= 100 && realUncoveredCapacity >= 1) {
      coverageStatus = 'UNCOVERED_OPPORTUNITY';
    }

    let price = group.currentPrice || 10;
    let fiftyTwoHigh = price * 1.15;
    let distFrom52WHigh = -10.0;
    let dividendYield = 0;
    let liveOptions: OptionQuoteItem[] = [];

    // Fetch live price quote and quick option chain
    try {
      const quote = await fetchWithTimeout(yahooFinance.quote(underlying), 2500);
      if (quote) {
        if (quote.regularMarketPrice) price = quote.regularMarketPrice;
        if (quote.fiftyTwoWeekHigh) {
          fiftyTwoHigh = quote.fiftyTwoWeekHigh;
          distFrom52WHigh = ((price - fiftyTwoHigh) / fiftyTwoHigh) * 100;
        }
        if (quote.dividendYield) dividendYield = quote.dividendYield;
      }
    } catch {
      // Fallback to existing price
    }

    // If eligible for covered calls (capacity >= 1), attempt live options chain fetch
    const effectiveProposeContracts = realUncoveredCapacity > 0 ? realUncoveredCapacity : 1;
    if (totalCapacity >= 1) {
      try {
        const chain = await fetchWithTimeout(yahooFinance.options(underlying), 2500);
        if (chain?.options?.[0]?.calls) {
          const calls = chain.options[0].calls;
          const expDateStr = chain.options[0].expirationDate
            ? new Date(chain.options[0].expirationDate).toISOString().split('T')[0]
            : getTargetExpirationDate(35).expirationStr;

          const now = new Date();
          const expDate = new Date(expDateStr);
          const dte = Math.max(1, Math.round((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

          liveOptions = calls.map((c: any) => ({
            contractSymbol: c.contractSymbol || `${underlying} Call`,
            strike: c.strike,
            optionType: 'CALL' as const,
            expiration: expDateStr,
            dte,
            bid: c.bid || c.lastPrice * 0.95 || 0.1,
            ask: c.ask || c.lastPrice * 1.05 || 0.2,
            mid: c.bid && c.ask ? (c.bid + c.ask) / 2 : c.lastPrice || 0.15,
            lastPrice: c.lastPrice || 0.15,
            impliedVolatility: c.impliedVolatility || 0.35,
            inTheMoney: Boolean(c.inTheMoney),
          }));
        }
      } catch {
        // Use theoretical pricing fallback
      }
    }

    // Generate the 3 proposed call strike tiers
    const proposedCalls = buildProposedCallStrikes(price, effectiveProposeContracts, liveOptions, 0.35);

    const activeCoveredCalls: ActiveCoveredCallPosition[] = group.shortCalls.map((sc) => {
      let dte = 20;
      if (sc.expiry) {
        const expDate = new Date(sc.expiry);
        if (!isNaN(expDate.getTime())) {
          dte = Math.max(0, Math.round((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        }
      }
      return {
        contractSymbol: sc.symbol,
        strike: sc.strike,
        expiration: sc.expiry || 'Near Term',
        dte,
        quantity: sc.quantity,
        currentPrice: sc.price,
        marketValue: sc.marketValue,
        unrealizedPL: sc.unrealizedPL,
        unrealizedPLPercent: sc.unrealizedPLPercent,
        broker: sc.broker,
        account: sc.account,
      };
    });

    const candidate: CoveredCallPositionCandidate = {
      symbol: underlying,
      companyName: group.companyName,
      assetType: group.longCalls.length > 0 ? 'MIXED' : 'EQUITY',
      currentPrice: parseFloat(price.toFixed(2)),
      totalMarketValue: parseFloat((group.marketValue || group.shares * price).toFixed(2)),
      shareCount: group.shares,
      totalCapacity,
      coveredCallCapacity: realUncoveredCapacity,
      coveredSharesCount,
      uncoveredSharesCount,
      hasActiveCalls: totalShortCallContracts > 0,
      longCallsCount: totalLongCallContracts,
      shortCallsCount: totalShortCallContracts,
      netPositionDelta: Math.round(calculatedDelta),
      unhedgedDelta: Math.round(unhedgedDelta),
      coverageStatus,
      activeCoveredCalls,
      proposedCalls,
      dividendYieldPercent: dividendYield ? parseFloat(dividendYield.toFixed(2)) : undefined,
      fiftyTwoWeekHigh: fiftyTwoHigh ? parseFloat(fiftyTwoHigh.toFixed(2)) : undefined,
      distanceFrom52WHigh: distFrom52WHigh ? parseFloat(distFrom52WHigh.toFixed(1)) : undefined,
      brokers: Array.from(group.brokers),
    };

    return candidate;
  });

  const settledResults = await Promise.allSettled(candidatePromises);
  const candidates: CoveredCallPositionCandidate[] = [];

  for (const res of settledResults) {
    if (res.status === 'fulfilled' && res.value) {
      candidates.push(res.value);
    }
  }

  // Sort candidates: Uncovered Opportunities with highest capacity first, then partially covered, then covered
  candidates.sort((a, b) => {
    const statusPriority: Record<CoverageStatus, number> = {
      UNCOVERED_OPPORTUNITY: 1,
      PARTIALLY_COVERED: 2,
      FULLY_COVERED: 3,
      DELTA_DEFICIT: 4,
    };
    if (statusPriority[a.coverageStatus] !== statusPriority[b.coverageStatus]) {
      return statusPriority[a.coverageStatus] - statusPriority[b.coverageStatus];
    }
    return b.coveredCallCapacity - a.coveredCallCapacity || b.totalMarketValue - a.totalMarketValue;
  });

  // Calculate summary metrics
  const totalEligible = candidates.filter((c) => c.netPositionDelta >= 100 || c.totalCapacity >= 1);
  const uncoveredCandidates = candidates.filter((c) => c.coverageStatus === 'UNCOVERED_OPPORTUNITY');
  const partiallyCovered = candidates.filter((c) => c.coverageStatus === 'PARTIALLY_COVERED');
  const fullyCovered = candidates.filter((c) => c.coverageStatus === 'FULLY_COVERED');
  const activePositions = candidates.filter((c) => c.hasActiveCalls || c.shortCallsCount > 0);
  const totalActiveCalls = candidates.reduce((sum, c) => sum + c.shortCallsCount, 0);

  const totalUncoveredCapacity = candidates.reduce(
    (sum, c) => sum + (c.coverageStatus === 'UNCOVERED_OPPORTUNITY' || c.coverageStatus === 'PARTIALLY_COVERED' ? c.coveredCallCapacity : 0),
    0
  );

  // Estimate potential monthly income across all real uncovered capacity
  const potentialMonthlyIncome = candidates.reduce((sum, c) => {
    if (c.coveredCallCapacity >= 1 && (c.coverageStatus === 'UNCOVERED_OPPORTUNITY' || c.coverageStatus === 'PARTIALLY_COVERED')) {
      const balancedIncome = c.proposedCalls.balanced.totalPotentialIncome;
      return sum + (balancedIncome > 0 ? balancedIncome : c.currentPrice * c.coveredCallCapacity * 100 * 0.025);
    }
    return sum;
  }, 0);

  const totalMarketValueOfEligible = totalEligible.reduce((sum, c) => sum + c.totalMarketValue, 0);
  const annualizedYieldEst = totalMarketValueOfEligible > 0 ? (potentialMonthlyIncome * 12 / totalMarketValueOfEligible) * 100 : 0;

  return {
    scanTimestamp,
    totalPortfolioNetDelta: candidates.reduce((sum, c) => sum + c.netPositionDelta, 0),
    totalEligiblePositionsCount: totalEligible.length,
    uncoveredPositionsCount: uncoveredCandidates.length,
    partiallyCoveredCount: partiallyCovered.length,
    fullyCoveredCount: fullyCovered.length,
    activePositionsCount: activePositions.length,
    totalActiveCallsCount: totalActiveCalls,
    totalUncoveredCallCapacity: totalUncoveredCapacity,
    potentialMonthlyIncomeEstimate: Math.round(potentialMonthlyIncome),
    potentialAnnualizedYieldEstimate: parseFloat(annualizedYieldEst.toFixed(1)),
    candidates,
  };
}

/**
 * Fetch detailed option chain for specific candidate to allow deep strike selection
 */
export async function getDetailedCallOptionChain(
  symbol: string,
  targetStrike?: number
) {
  const cleanSymbol = symbol.trim().toUpperCase();
  const quote = await yahooFinance.quote(cleanSymbol);
  const price = quote?.regularMarketPrice || 100;

  const result = {
    symbol: cleanSymbol,
    companyName: quote?.shortName || cleanSymbol,
    currentPrice: price,
    expirations: [] as Array<{
      date: string;
      dte: number;
      calls: Array<OptionQuoteItem & { delta: number; otmPercent: number; pop: number }>;
    }>,
  };

  try {
    const rawChain = await yahooFinance.options(cleanSymbol);
    const expDates = (rawChain.expirationDates || []).slice(0, 4);

    for (const expDate of expDates) {
      const dateStr = new Date(expDate).toISOString().split('T')[0];
      const dte = Math.max(1, Math.round((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

      try {
        const expData = await yahooFinance.options(cleanSymbol, { date: expDate });
        const calls = expData?.options?.[0]?.calls || [];

        const enrichedCalls = calls.map((c: any) => {
          const delta = calculateCallDelta(price, c.strike, dte, c.impliedVolatility || 0.35);
          const otmPct = ((c.strike - price) / price) * 100;
          return {
            contractSymbol: c.contractSymbol,
            strike: c.strike,
            optionType: 'CALL' as const,
            expiration: dateStr,
            dte,
            bid: c.bid || 0,
            ask: c.ask || 0,
            mid: c.bid && c.ask ? (c.bid + c.ask) / 2 : c.lastPrice || 0,
            lastPrice: c.lastPrice || 0,
            impliedVolatility: c.impliedVolatility || 0.35,
            inTheMoney: Boolean(c.inTheMoney),
            delta: parseFloat(delta.toFixed(2)),
            otmPercent: parseFloat(otmPct.toFixed(1)),
            pop: Math.round((1 - delta) * 100),
          };
        });

        result.expirations.push({
          date: dateStr,
          dte,
          calls: enrichedCalls,
        });
      } catch (e) {
        // Skip single expiration error
      }
    }
  } catch (err: any) {
    // Return fallback theoretical chain
    const { expirationStr, dte } = getTargetExpirationDate(35);
    const standardMultipliers = [1.02, 1.05, 1.08, 1.10, 1.15, 1.20];
    const fallbackCalls = standardMultipliers.map((mult) => {
      const strike = Math.round(price * mult);
      const delta = calculateCallDelta(price, strike, dte, 0.35);
      const mid = calculateBlackScholesPrice(price, strike, dte, 0.35, 'CALL');
      return {
        contractSymbol: `${cleanSymbol} ${strike}C`,
        strike,
        optionType: 'CALL' as const,
        expiration: expirationStr,
        dte,
        bid: parseFloat((mid * 0.95).toFixed(2)),
        ask: parseFloat((mid * 1.05).toFixed(2)),
        mid: parseFloat(mid.toFixed(2)),
        lastPrice: parseFloat(mid.toFixed(2)),
        impliedVolatility: 0.35,
        inTheMoney: false,
        delta: parseFloat(delta.toFixed(2)),
        otmPercent: parseFloat(((strike - price) / price * 100).toFixed(1)),
        pop: Math.round((1 - delta) * 100),
      };
    });

    result.expirations.push({
      date: expirationStr,
      dte,
      calls: fallbackCalls,
    });
  }

  return result;
}
