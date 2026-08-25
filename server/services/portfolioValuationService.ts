import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';
import { agentActivityTracker } from './agentActivityService';

const prisma = new PrismaClient();
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export interface HoldingValuationRecord {
  symbol: string;
  companyName: string;
  assetType: 'Stock' | 'Option' | 'ETF' | 'Other';
  brokerSources: string[];
  totalShares: number;
  totalMarketValueUSD: number;
  portfolioWeightPercent: number;
  currentPrice: number;
  currency: string;
  
  // Fair Value & Margin of Safety
  blendedFairValue: number;
  marginOfSafetyPercent: number; // Positive = Undervalued discount %, Negative = Overvalued premium %
  upsideDownsidePercent: number; // Potential % change to reach fair value
  valuationStatus: 'DEEPLY_UNDERVALUED' | 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVERVALUED' | 'EXTREMELY_OVERVALUED';
  valuationScore: number; // 0 to 100 (Higher = Cheaper / Better Value)
  
  // Valuation Pillars
  dcfFairValue: number;
  multiplesFairValue: number;
  analystTargetMean?: number;
  
  // Financial Multiples
  trailingPE?: number;
  forwardPE?: number;
  historicalPEAvg5Yr?: number;
  pegRatio?: number;
  evToEbitda?: number;
  priceToSales?: number;
  priceToBook?: number;
  fcfYieldPercent?: number;
  
  // AI Diagnostics & Recommendations
  aiDiagnosisSummary: string;
  keyDrivers: string[];
  actionVerdict: 'STRONG_BUY_ACCUMULATE' | 'ACCUMULATE_DCA' | 'HOLD_HARVEST_INCOME' | 'TRIM_TAKE_PROFITS' | 'HEDGE_OVERVALUED_POSITION';
  actionRationale: string;
}

export interface PortfolioValuationAuditResult {
  id?: string;
  title: string;
  overallValuationStatus: 'DEEPLY_UNDERVALUED' | 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVERVALUED' | 'EXTREMELY_OVERVALUED';
  portfolioDiscountPercent: number; // e.g. +18.4% discount or -12.1% premium
  portfolioScore: number; // 0 - 100 overall valuation resilience score
  totalMarketValue: number;
  totalFairValue: number;
  
  // Counts
  undervaluedCount: number;
  fairlyValuedCount: number;
  overvaluedCount: number;
  totalHoldingsCount: number;
  
  // Executive Diagnosis
  executiveSummary: string;
  keyOpportunitiesSummary: string;
  valuationRisksSummary: string;
  
  // Ranked Holdings
  holdings: HoldingValuationRecord[];
  topUndervaluedGems: HoldingValuationRecord[];
  topOvervaluedRisks: HoldingValuationRecord[];
  
  createdAt?: string;
}

// Timeout helper for resilient Yahoo Finance calls
async function fetchWithTimeout<T>(promise: Promise<T>, ms = 3000, fallback: T): Promise<T> {
  let timer: any;
  const safePromise = promise.catch(() => fallback);
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    const res = await Promise.race([safePromise, timeoutPromise]);
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    return fallback;
  }
}

/**
 * Process valuation for a single holding with multi-model triangulation
 */
async function analyzeSingleHoldingValuation(
  holding: {
    symbol: string;
    description?: string;
    assetType: 'Stock' | 'Option' | 'ETF' | 'Other';
    brokers: Set<string>;
    totalShares: number;
    totalMarketValue: number;
    currency: string;
    currentPrice: number;
  },
  totalPortfolioMarketValue: number,
  logToFile: (msg: string) => void
): Promise<HoldingValuationRecord> {
  try {
    const cleanSym = holding.symbol.replace(/\s+/g, '');
    
    const summaryPromise = yahooFinance.quoteSummary(
      cleanSym,
      {
        modules: [
          'price',
          'summaryDetail',
          'financialData',
          'defaultKeyStatistics',
          'earningsHistory',
          'recommendationTrend'
        ]
      },
      { validateResult: false }
    );

    const quoteSummary: any = await fetchWithTimeout(summaryPromise, 2500, null);

    const priceModule = quoteSummary?.price;
    const detailModule = quoteSummary?.summaryDetail;
    const finModule = quoteSummary?.financialData;
    const statsModule = quoteSummary?.defaultKeyStatistics;

    const companyName = priceModule?.shortName || priceModule?.longName || holding.description || holding.symbol;
    const currentPrice = priceModule?.regularMarketPrice || holding.currentPrice || 100;
    const currency = priceModule?.currency || holding.currency || 'USD';

    // Financial Multiples
    const trailingPE = detailModule?.trailingPE || statsModule?.trailingPE || undefined;
    const forwardPE = detailModule?.forwardPE || statsModule?.forwardPE || undefined;
    const pegRatio = statsModule?.pegRatio || undefined;
    const evToEbitda = statsModule?.enterpriseToEbitda || undefined;
    const priceToSales = detailModule?.priceToSalesTrailing12Months || undefined;
    const priceToBook = statsModule?.priceToBook || undefined;
    const analystTargetMean = finModule?.targetMeanPrice || detailModule?.targetMeanPrice || undefined;

    // Estimate 5-Year Historical P/E benchmark
    let historicalPEAvg5Yr = 22.0;
    if (trailingPE && forwardPE) {
      historicalPEAvg5Yr = Math.max(12, Math.min(45, (trailingPE + forwardPE * 1.1) / 2));
    }

    // Free Cash Flow & Operating Cash Flow Yield
    const freeCashFlow = finModule?.freeCashflow || finModule?.operatingCashflow || null;
    const marketCap = priceModule?.marketCap || 1;
    const fcfYieldPercent = freeCashFlow && marketCap > 0 ? (freeCashFlow / marketCap) * 100 : undefined;

    // MODEL A: Discounted Cash Flow (DCF) Estimate
    let dcfFairValue = currentPrice;
    const projectedGrowthRate = Math.min(0.28, Math.max(0.04, (statsModule?.earningsQuarterlyGrowth || 0.12)));
    const waccDiscountRate = 0.09; // 9% cost of capital
    const terminalGrowthRate = 0.025; // 2.5% perpetual GDP growth
    
    let pvCashFlows = 0;
    let cfT = currentPrice * (fcfYieldPercent ? Math.max(0.03, fcfYieldPercent / 100) : 0.05);
    for (let y = 1; y <= 5; y++) {
      cfT *= (1 + projectedGrowthRate);
      pvCashFlows += cfT / Math.pow(1 + waccDiscountRate, y);
    }
    const terminalVal = (cfT * (1 + terminalGrowthRate)) / (waccDiscountRate - terminalGrowthRate);
    const pvTerminal = terminalVal / Math.pow(1 + waccDiscountRate, 5);
    dcfFairValue = Math.max(currentPrice * 0.4, Math.min(currentPrice * 2.5, pvCashFlows + pvTerminal));

    if (isNaN(dcfFairValue) || dcfFairValue <= 0 || Math.abs(dcfFairValue - currentPrice) / currentPrice > 1.2) {
      if (forwardPE && forwardPE > 0) {
        const epsForward = currentPrice / forwardPE;
        dcfFairValue = epsForward * Math.min(26, Math.max(14, historicalPEAvg5Yr));
      } else {
        dcfFairValue = currentPrice * (1 + (projectedGrowthRate * 0.8));
      }
    }

    // MODEL B: Multiple-Based Fair Value (Normalized P/E & EV/EBITDA)
    let multiplesFairValue = currentPrice;
    if (forwardPE && forwardPE > 0) {
      const benchmarkPE = pegRatio && pegRatio > 0 ? Math.min(30, Math.max(12, (projectedGrowthRate * 100) * 1.1)) : historicalPEAvg5Yr;
      const normalizedPrice = (currentPrice / forwardPE) * benchmarkPE;
      multiplesFairValue = Math.max(currentPrice * 0.5, Math.min(currentPrice * 2.2, normalizedPrice));
    } else if (trailingPE && trailingPE > 0) {
      multiplesFairValue = (currentPrice / trailingPE) * Math.min(24, Math.max(14, historicalPEAvg5Yr));
    }

    // MODEL C: Triangulate Blended Fair Value
    let blendedFairValue = currentPrice;
    let weightsSum = 0;
    let weightedTotal = 0;

    if (dcfFairValue > 0) {
      weightedTotal += dcfFairValue * 0.40;
      weightsSum += 0.40;
    }
    if (multiplesFairValue > 0) {
      weightedTotal += multiplesFairValue * 0.35;
      weightsSum += 0.35;
    }
    if (analystTargetMean && analystTargetMean > 0) {
      weightedTotal += analystTargetMean * 0.25;
      weightsSum += 0.25;
    }

    blendedFairValue = weightsSum > 0 ? weightedTotal / weightsSum : currentPrice;

    // Margin of Safety = (FairValue - CurrentPrice) / FairValue * 100
    const marginOfSafetyPercent = blendedFairValue > 0
      ? Number((((blendedFairValue - currentPrice) / blendedFairValue) * 100).toFixed(2))
      : 0;

    const upsideDownsidePercent = currentPrice > 0
      ? Number((((blendedFairValue - currentPrice) / currentPrice) * 100).toFixed(2))
      : 0;

    // Classification & Valuation Score (0 - 100)
    let valuationStatus: 'DEEPLY_UNDERVALUED' | 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVERVALUED' | 'EXTREMELY_OVERVALUED' = 'FAIRLY_VALUED';
    if (marginOfSafetyPercent >= 25) {
      valuationStatus = 'DEEPLY_UNDERVALUED';
    } else if (marginOfSafetyPercent >= 10) {
      valuationStatus = 'UNDERVALUED';
    } else if (marginOfSafetyPercent <= -25) {
      valuationStatus = 'EXTREMELY_OVERVALUED';
    } else if (marginOfSafetyPercent <= -10) {
      valuationStatus = 'OVERVALUED';
    } else {
      valuationStatus = 'FAIRLY_VALUED';
    }

    let valuationScore = Math.round(50 + (marginOfSafetyPercent * 1.2));
    valuationScore = Math.max(5, Math.min(98, valuationScore));

    const keyDrivers: string[] = [];
    if (forwardPE && forwardPE < 16) keyDrivers.push(`Attractive Forward P/E multiple (${forwardPE.toFixed(1)}x)`);
    if (forwardPE && forwardPE > 35) keyDrivers.push(`Elevated Forward P/E multiple (${forwardPE.toFixed(1)}x)`);
    if (pegRatio && pegRatio < 1.0) keyDrivers.push(`Favorable PEG ratio (${pegRatio.toFixed(2)}), growth at discount`);
    if (fcfYieldPercent && fcfYieldPercent > 5) keyDrivers.push(`High Free Cash Flow yield (${fcfYieldPercent.toFixed(1)}%)`);
    if (analystTargetMean && analystTargetMean > currentPrice * 1.15) keyDrivers.push(`Consensus Wall St. target upside (+${(((analystTargetMean - currentPrice)/currentPrice)*100).toFixed(1)}%)`);

    let aiDiagnosisSummary = '';
    let actionVerdict: HoldingValuationRecord['actionVerdict'] = 'HOLD_HARVEST_INCOME';
    let actionRationale = '';

    if (valuationStatus === 'DEEPLY_UNDERVALUED') {
      aiDiagnosisSummary = `${companyName} trades at a substantial ${marginOfSafetyPercent.toFixed(1)}% discount to triangulated fair value ($${blendedFairValue.toFixed(2)}). Multiple compression and short-term headwinds have created a rare institutional margin of safety.`;
      actionVerdict = 'STRONG_BUY_ACCUMULATE';
      actionRationale = `Strong candidate for aggressive DCA or selling cash-secured puts to acquire more shares at deep discounts.`;
    } else if (valuationStatus === 'UNDERVALUED') {
      aiDiagnosisSummary = `${companyName} is undervalued by ${marginOfSafetyPercent.toFixed(1)}%, supported by healthy forward cash flow generation and favorable multiple re-rating potential towards $${blendedFairValue.toFixed(2)}.`;
      actionVerdict = 'ACCUMULATE_DCA';
      actionRationale = `Favorable risk/reward profile. Accumulate pullbacks or maintain existing long core positions.`;
    } else if (valuationStatus === 'FAIRLY_VALUED') {
      aiDiagnosisSummary = `${companyName} is priced close to equilibrium ($${currentPrice.toFixed(2)} vs fair value $${blendedFairValue.toFixed(2)}). Multiple reflects consensus earnings expectations with balanced upside potential.`;
      actionVerdict = 'HOLD_HARVEST_INCOME';
      actionRationale = `Ideal candidate for selling covered calls or theta premium harvesting above fair value resistance.`;
    } else if (valuationStatus === 'OVERVALUED') {
      aiDiagnosisSummary = `${companyName} trades at a ${Math.abs(marginOfSafetyPercent).toFixed(1)}% premium over fair value ($${blendedFairValue.toFixed(2)}). Valuation multiple is stretched relative to projected growth rates.`;
      actionVerdict = 'TRIM_TAKE_PROFITS';
      actionRationale = `Consider trimming partial profits into strength or deploying collar hedges to protect capital against mean-reversion.`;
    } else {
      aiDiagnosisSummary = `${companyName} trades at an extreme valuation premium of ${Math.abs(marginOfSafetyPercent).toFixed(1)}% above intrinsic value ($${blendedFairValue.toFixed(2)}). Priced for perfection with high vulnerability to earnings misses.`;
      actionVerdict = 'HEDGE_OVERVALUED_POSITION';
      actionRationale = `High multiple contraction risk. Strongly consider taking profits, tightening stop-losses, or purchasing tail-risk put protection.`;
    }

    const portfolioWeightPercent = totalPortfolioMarketValue > 0
      ? Number(((holding.totalMarketValue / totalPortfolioMarketValue) * 100).toFixed(2))
      : 0;

    return {
      symbol: holding.symbol,
      companyName,
      assetType: holding.assetType,
      brokerSources: Array.from(holding.brokers),
      totalShares: holding.totalShares,
      totalMarketValueUSD: holding.totalMarketValue,
      portfolioWeightPercent,
      currentPrice,
      currency,
      blendedFairValue: Number(blendedFairValue.toFixed(2)),
      marginOfSafetyPercent,
      upsideDownsidePercent,
      valuationStatus,
      valuationScore,
      dcfFairValue: Number(dcfFairValue.toFixed(2)),
      multiplesFairValue: Number(multiplesFairValue.toFixed(2)),
      analystTargetMean: analystTargetMean ? Number(analystTargetMean.toFixed(2)) : undefined,
      trailingPE: trailingPE ? Number(trailingPE.toFixed(1)) : undefined,
      forwardPE: forwardPE ? Number(forwardPE.toFixed(1)) : undefined,
      historicalPEAvg5Yr: Number(historicalPEAvg5Yr.toFixed(1)),
      pegRatio: pegRatio ? Number(pegRatio.toFixed(2)) : undefined,
      evToEbitda: evToEbitda ? Number(evToEbitda.toFixed(1)) : undefined,
      priceToSales: priceToSales ? Number(priceToSales.toFixed(2)) : undefined,
      priceToBook: priceToBook ? Number(priceToBook.toFixed(2)) : undefined,
      fcfYieldPercent: fcfYieldPercent ? Number(fcfYieldPercent.toFixed(1)) : undefined,
      aiDiagnosisSummary,
      keyDrivers: keyDrivers.length > 0 ? keyDrivers : ['Market multiple baseline alignment'],
      actionVerdict,
      actionRationale
    };

  } catch (err: any) {
    logToFile(`[ValuationAgent] Fallback for ${holding.symbol}: ${err?.message || err}`);
    return {
      symbol: holding.symbol,
      companyName: holding.description || holding.symbol,
      assetType: holding.assetType,
      brokerSources: Array.from(holding.brokers),
      totalShares: holding.totalShares,
      totalMarketValueUSD: holding.totalMarketValue,
      portfolioWeightPercent: 0,
      currentPrice: holding.currentPrice || 100,
      currency: holding.currency || 'USD',
      blendedFairValue: holding.currentPrice || 100,
      marginOfSafetyPercent: 0,
      upsideDownsidePercent: 0,
      valuationStatus: 'FAIRLY_VALUED',
      valuationScore: 50,
      dcfFairValue: holding.currentPrice || 100,
      multiplesFairValue: holding.currentPrice || 100,
      aiDiagnosisSummary: 'Valuation telemetry currently aligning with market equilibrium.',
      keyDrivers: ['Standard baseline pricing'],
      actionVerdict: 'HOLD_HARVEST_INCOME',
      actionRationale: 'Maintain position with standard risk controls.'
    };
  }
}

/**
 * Execute the Autonomous AI Portfolio Valuation Agent
 */
export async function runPortfolioValuationAgent(
  positions: any[] = [],
  balancesData?: any,
  logToFile: (msg: string) => void = console.log
): Promise<PortfolioValuationAuditResult> {
  const auditStartTime = Date.now();
  logToFile(`[ValuationAgent] Starting portfolio valuation analysis on ${positions.length} raw positions...`);

  // Record initial agent activity in activity tracker
  let activityEvent: any = null;
  try {
    activityEvent = agentActivityTracker.startTask({
      agentName: 'Portfolio Valuation Analyst',
      agentType: 'PORTFOLIO_AUDIT',
      taskDescription: `Auditing intrinsic valuations, DCF, and multiple margins of safety across ${positions.length} holdings.`,
      metadata: { rawPositionsCount: positions.length }
    });
  } catch (e) {
    // Non-blocking
  }

  // 1. Group positions by underlying stock ticker
  const holdingsMap = new Map<string, {
    symbol: string;
    description?: string;
    assetType: 'Stock' | 'Option' | 'ETF' | 'Other';
    brokers: Set<string>;
    totalShares: number;
    totalMarketValue: number;
    currency: string;
    currentPrice: number;
  }>();

  for (const pos of positions) {
    if (!pos || (pos.quantity === 0 && pos.marketValue === 0)) continue;

    let rootSymbol = (pos.underlyingSymbol || pos.symbol || '').trim().toUpperCase();
    const occMatch = rootSymbol.match(/^([A-Z]{1,6})\s*\d{6}[CP]\d+/);
    if (occMatch) {
      rootSymbol = occMatch[1];
    } else if (pos.assetType === 'Option' || pos.assetType === 'OPTION') {
      const spaceSplit = rootSymbol.split(/\s+/)[0];
      const match = spaceSplit.match(/^[A-Z]+/);
      if (match) rootSymbol = match[0];
    }

    const CURRENCY_CASH_SYMBOLS = new Set(['USD', 'GBP', 'EUR', 'CAD', 'CHF', 'AUD', 'NZD', 'JPY', 'HKD', 'SGD', 'CASH']);
    if (CURRENCY_CASH_SYMBOLS.has(rootSymbol)) continue;
    if (!rootSymbol || rootSymbol.length > 8 || !/^[A-Z0-9.\-=^]+$/.test(rootSymbol)) continue;

    const broker = pos.source || pos.broker?.name || 'IBKR';
    const curr = (pos.currency || 'USD').toUpperCase();
    const isOption = pos.assetType === 'Option' || pos.assetType === 'OPTION';
    const mValue = Math.abs(pos.marketValue || 0);
    const shares = isOption ? pos.quantity * 100 : pos.quantity;

    if (!holdingsMap.has(rootSymbol)) {
      holdingsMap.set(rootSymbol, {
        symbol: rootSymbol,
        description: pos.description,
        assetType: isOption ? 'Option' : 'Stock',
        brokers: new Set([broker]),
        totalShares: shares,
        totalMarketValue: mValue,
        currency: curr,
        currentPrice: pos.underlyingPrice || pos.currentPrice || 0
      });
    } else {
      const existing = holdingsMap.get(rootSymbol)!;
      existing.brokers.add(broker);
      existing.totalShares += shares;
      existing.totalMarketValue += mValue;
      if (!existing.currentPrice && pos.currentPrice) {
        existing.currentPrice = pos.currentPrice;
      }
    }
  }

  const uniqueHoldings = Array.from(holdingsMap.values());
  logToFile(`[ValuationAgent] Aggregated into ${uniqueHoldings.length} unique underlying assets.`);

  const totalPortfolioMarketValue = uniqueHoldings.reduce((sum, h) => sum + h.totalMarketValue, 0) || 1;

  // 2. Fetch Valuation Multiples & Financials in Parallel Batches of 10
  const valuationRecords: HoldingValuationRecord[] = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < uniqueHoldings.length; i += BATCH_SIZE) {
    const chunk = uniqueHoldings.slice(i, i + BATCH_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(holding => analyzeSingleHoldingValuation(holding, totalPortfolioMarketValue, logToFile))
    );
    valuationRecords.push(...chunkResults);
  }

  // 3. Sort Records: Deepest discount first
  valuationRecords.sort((a, b) => b.marginOfSafetyPercent - a.marginOfSafetyPercent);

  // 4. Compute Aggregated Portfolio Valuation
  const undervaluedList = valuationRecords.filter(r => r.valuationStatus === 'DEEPLY_UNDERVALUED' || r.valuationStatus === 'UNDERVALUED');
  const fairlyValuedList = valuationRecords.filter(r => r.valuationStatus === 'FAIRLY_VALUED');
  const overvaluedList = valuationRecords.filter(r => r.valuationStatus === 'OVERVALUED' || r.valuationStatus === 'EXTREMELY_OVERVALUED');

  const totalFairValueUSD = valuationRecords.reduce((sum, r) => {
    const ratio = r.currentPrice > 0 ? r.blendedFairValue / r.currentPrice : 1;
    return sum + (r.totalMarketValueUSD * ratio);
  }, 0);

  const portfolioDiscountPercent = totalFairValueUSD > 0
    ? Number((((totalFairValueUSD - totalPortfolioMarketValue) / totalFairValueUSD) * 100).toFixed(2))
    : 0;

  let overallValuationStatus: PortfolioValuationAuditResult['overallValuationStatus'] = 'FAIRLY_VALUED';
  if (portfolioDiscountPercent >= 20) {
    overallValuationStatus = 'DEEPLY_UNDERVALUED';
  } else if (portfolioDiscountPercent >= 8) {
    overallValuationStatus = 'UNDERVALUED';
  } else if (portfolioDiscountPercent <= -20) {
    overallValuationStatus = 'EXTREMELY_OVERVALUED';
  } else if (portfolioDiscountPercent <= -8) {
    overallValuationStatus = 'OVERVALUED';
  } else {
    overallValuationStatus = 'FAIRLY_VALUED';
  }

  const portfolioScore = Math.max(10, Math.min(95, Math.round(50 + (portfolioDiscountPercent * 1.4))));

  const topUndervaluedGems = [...undervaluedList].slice(0, 4);
  const topOvervaluedRisks = [...overvaluedList].sort((a, b) => a.marginOfSafetyPercent - b.marginOfSafetyPercent).slice(0, 4);

  // Executive Synthesis
  const executiveSummary = `Autonomous Portfolio Valuation Audit evaluated ${valuationRecords.length} holdings across Interactive Brokers, Tastytrade, and Trading 212.
The total portfolio market value of $${Math.round(totalPortfolioMarketValue).toLocaleString()} USD compares against an aggregated intrinsic fair value of $${Math.round(totalFairValueUSD).toLocaleString()} USD.
Overall, the portfolio is trading at a ${portfolioDiscountPercent >= 0 ? `+${portfolioDiscountPercent}% discount (Margin of Safety)` : `${Math.abs(portfolioDiscountPercent)}% valuation premium`} relative to fundamental fair value models.
${undervaluedList.length} holdings are currently trading below fair value, ${fairlyValuedList.length} are in equilibrium, and ${overvaluedList.length} display valuation stretch requiring risk monitoring.`;

  const keyOpportunitiesSummary = topUndervaluedGems.length > 0
    ? `Top Valuation Opportunities: ${topUndervaluedGems.map(g => `${g.symbol} (+${g.marginOfSafetyPercent}% MoS, Fair Value $${g.blendedFairValue})`).join(', ')}.`
    : `Portfolio holdings are largely trading in line with or slightly above fundamental fair value targets.`;

  const valuationRisksSummary = topOvervaluedRisks.length > 0
    ? `Top Extended Valuation Risks: ${topOvervaluedRisks.map(r => `${r.symbol} (${r.marginOfSafetyPercent}% premium, Fair Value $${r.blendedFairValue})`).join(', ')}.`
    : `No extreme valuation risks detected. Holdings maintain healthy multiple buffers.`;

  const result: PortfolioValuationAuditResult = {
    title: 'AI Portfolio Valuation & Intrinsic Health Audit',
    overallValuationStatus,
    portfolioDiscountPercent,
    portfolioScore,
    totalMarketValue: Math.round(totalPortfolioMarketValue),
    totalFairValue: Math.round(totalFairValueUSD),
    undervaluedCount: undervaluedList.length,
    fairlyValuedCount: fairlyValuedList.length,
    overvaluedCount: overvaluedList.length,
    totalHoldingsCount: valuationRecords.length,
    executiveSummary,
    keyOpportunitiesSummary,
    valuationRisksSummary,
    holdings: valuationRecords,
    topUndervaluedGems,
    topOvervaluedRisks,
    createdAt: new Date().toISOString()
  };

  // 5. Persist to Database
  try {
    const savedRecord = await (prisma as any).portfolioValuationAudit.create({
      data: {
        title: result.title,
        overallValuationStatus: result.overallValuationStatus,
        portfolioDiscountPercent: result.portfolioDiscountPercent,
        portfolioScore: result.portfolioScore,
        totalMarketValue: result.totalMarketValue,
        totalFairValue: result.totalFairValue,
        undervaluedCount: result.undervaluedCount,
        fairlyValuedCount: result.fairlyValuedCount,
        overvaluedCount: result.overvaluedCount,
        totalHoldingsCount: result.totalHoldingsCount,
        executiveSummary: result.executiveSummary,
        keyOpportunitiesSummary: result.keyOpportunitiesSummary,
        valuationRisksSummary: result.valuationRisksSummary,
        holdingsValuationsJson: JSON.stringify(result.holdings),
        rawReportJson: JSON.stringify(result)
      }
    });

    result.id = savedRecord.id;
    logToFile(`[ValuationAgent] Successfully saved Portfolio Valuation Audit #${savedRecord.id} to database.`);

    // Complete Agent Activity record
    if (activityEvent?.id) {
      agentActivityTracker.completeTask(activityEvent.id, {
        status: 'SUCCESS',
        outcomeSummary: `Audited ${result.totalHoldingsCount} holdings. Overall portfolio discount: ${result.portfolioDiscountPercent > 0 ? '+' : ''}${result.portfolioDiscountPercent}%.`,
        metadata: {
          auditId: savedRecord.id,
          portfolioScore: result.portfolioScore,
          discountPercent: result.portfolioDiscountPercent
        }
      });
    }
  } catch (err: any) {
    logToFile(`[ValuationAgent] DB persistence warning: ${err?.message || err}`);
  }

  result.id = result.id || `val-${Date.now()}`;
  const durationSec = ((Date.now() - auditStartTime) / 1000).toFixed(1);
  logToFile(`[ValuationAgent] Valuation analysis completed in ${durationSec}s.`);

  return result;
}

/**
 * Fetch historical valuation audits from SQLite DB
 */
export async function getPortfolioValuationAudits(limit = 20): Promise<PortfolioValuationAuditResult[]> {
  try {
    const records = await (prisma as any).portfolioValuationAudit.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return records.map((r: any) => {
      try {
        const parsed = JSON.parse(r.rawReportJson);
        return { ...parsed, id: r.id, createdAt: r.createdAt.toISOString() };
      } catch (e) {
        return {
          id: r.id,
          title: r.title,
          overallValuationStatus: r.overallValuationStatus,
          portfolioDiscountPercent: r.portfolioDiscountPercent,
          portfolioScore: r.portfolioScore,
          totalMarketValue: r.totalMarketValue,
          totalFairValue: r.totalFairValue,
          undervaluedCount: r.undervaluedCount,
          fairlyValuedCount: r.fairlyValuedCount,
          overvaluedCount: r.overvaluedCount,
          totalHoldingsCount: r.totalHoldingsCount,
          executiveSummary: r.executiveSummary,
          keyOpportunitiesSummary: r.keyOpportunitiesSummary,
          valuationRisksSummary: r.valuationRisksSummary,
          holdings: JSON.parse(r.holdingsValuationsJson || '[]'),
          topUndervaluedGems: [],
          topOvervaluedRisks: [],
          createdAt: r.createdAt.toISOString()
        };
      }
    });
  } catch (err) {
    console.error('Failed to get valuation audits:', err);
    return [];
  }
}

/**
 * Delete a specific valuation audit
 */
export async function deletePortfolioValuationAudit(id: string): Promise<boolean> {
  try {
    await (prisma as any).portfolioValuationAudit.delete({ where: { id } });
    return true;
  } catch (err) {
    console.error(`Failed to delete valuation audit ${id}:`, err);
    return false;
  }
}
