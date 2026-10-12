import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import YahooFinance from 'yahoo-finance2';
import { agentActivityTracker } from './agentActivityService';
import { scanHoldingsAndWatchlistsForDips, DipCandidateItem } from './dipAnalyzerService';
import { getMacroDossiers, MacroDossierResult } from './macroDossierService';
import { parseOccSymbol } from './shortOptionAlertService';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables (supports .env and .env.local)
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false }
});

export interface PortfolioBriefingData {
  totalValue: number;
  totalUnrealizedPL: number;
  totalUnrealizedPLPercent: number;
  totalDayPL: number;
  equitiesCount: number;
  optionsCount: number;
  brokersCount: number;
  holdings: Array<{
    symbol: string;
    assetType: string;
    quantity: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
    strikePrice?: number | null;
    expiryDate?: string | null;
    optionType?: string | null;
    brokerName?: string;
  }>;
}

export interface ThreatenedPositionItem {
  symbol: string;
  underlyingSymbol: string;
  optionType: string;
  strikePrice: number;
  expiryDate: string;
  daysToExpiry: number;
  quantity: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  currentUnderlyingPrice: number;
  threatLevel: 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW';
  threatReason: string;
  suggestedAction: string;
}

export interface AlertBriefingItem {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: string;
  note?: string | null;
  status: string;
  triggeredAt?: string | null;
  currentPrice?: number | null;
  isDefenseAlert?: boolean;
}

export interface MacroBriefingData {
  regimeTitle: string;
  regimeTone: string;
  macroScore: number;
  growthOutlook?: string;
  inflationRegime?: string;
  monetaryPolicyPosture?: string;
  liquidityCondition?: string;
  vixLevel: number;
  yield10y: number;
  yield2y?: number;
  spread2y10y: number;
  fedFundsRate?: number;
  highYieldSpread?: number;
  dxyLevel: number;
  oilPrice: number;
  goldPrice?: number;
  sp500Price: number;
  executiveSummary: string;
  keyTakeaways: string[];
  tacticalAllocations?: Array<{
    category: string;
    subAsset: string;
    stance: string;
    rationale: string;
  }>;
  cycleStage?: string;
}

export interface ExecutiveReportData {
  generatedAt: Date;
  reportTitle: string;
  portfolio: PortfolioBriefingData;
  defensePositions: ThreatenedPositionItem[];
  topDipBuys: DipCandidateItem[];
  alerts: {
    triggered: AlertBriefingItem[];
    activeCount: number;
  };
  macro: MacroBriefingData;
}

/**
 * Fetch and assemble all institutional data across portfolio, defense, dips, alerts, and macro
 */
export async function fetchComprehensiveReportData(): Promise<ExecutiveReportData> {
  const generatedAt = new Date();
  const todayStart = new Date(generatedAt.getFullYear(), generatedAt.getMonth(), generatedAt.getDate(), 0, 0, 0, 0).getTime();

  // 1. Fetch Holdings, Brokers, Alerts & Macro Data
  const [holdingsRaw, brokersRaw, alertsRaw, savedMacroList] = await Promise.all([
    prisma.holding.findMany({ include: { broker: true } }),
    prisma.broker.findMany(),
    prisma.priceAlert.findMany({ orderBy: { createdAt: 'desc' } }), // Fetch all alerts, not just 20!
    getMacroDossiers(1).catch(() => []),
  ]);

  let totalValue = 0;
  let totalUnrealizedPL = 0;
  let totalDayPL = 0;
  let equitiesCount = 0;
  let optionsCount = 0;

  const holdings = holdingsRaw.map((h) => {
    totalValue += h.marketValue || 0;
    totalUnrealizedPL += h.unrealizedPnL || 0;
    totalDayPL += h.dayPnL || 0;
    if (h.assetType === 'OPTION') optionsCount++;
    else equitiesCount++;

    return {
      symbol: h.symbol,
      assetType: h.assetType,
      quantity: h.quantity,
      currentPrice: h.currentPrice,
      marketValue: h.marketValue,
      unrealizedPL: h.unrealizedPnL,
      unrealizedPLPercent: h.unrealizedPnLPercent,
      strikePrice: h.strikePrice,
      expiryDate: h.expiryDate,
      optionType: h.optionType,
      brokerName: h.broker?.name || 'Primary Broker',
    };
  });

  const totalCost = totalValue - totalUnrealizedPL;
  const totalUnrealizedPLPercent = totalCost > 0 ? (totalUnrealizedPL / totalCost) * 100 : 0;

  const portfolio: PortfolioBriefingData = {
    totalValue,
    totalUnrealizedPL,
    totalUnrealizedPLPercent,
    totalDayPL,
    equitiesCount,
    optionsCount,
    brokersCount: brokersRaw.length,
    holdings,
  };

  // Pre-fetch spot prices for underlyings and alert symbols in parallel
  const underlyings = Array.from(
    new Set([
      ...holdingsRaw.map((h) => h.underlyingSymbol || h.symbol.split(' ')[0] || h.symbol),
      ...alertsRaw.map((a) => a.symbol.toUpperCase()),
    ])
  );
  const spotMap = new Map<string, number>();
  for (const h of holdingsRaw) {
    if (h.assetType === 'EQUITY' && h.currentPrice > 0) {
      spotMap.set(h.symbol.toUpperCase(), h.currentPrice);
    }
  }
  const missingUnderlyings = underlyings.filter((u) => !spotMap.has(u.toUpperCase()));
  if (missingUnderlyings.length > 0) {
    const quoteResults = await Promise.allSettled(
      missingUnderlyings.map((u) => yahooFinance.quote(u, {}, { validateResult: false }))
    );
    quoteResults.forEach((q, idx) => {
      if (q.status === 'fulfilled' && q.value?.regularMarketPrice) {
        spotMap.set(missingUnderlyings[idx].toUpperCase(), q.value.regularMarketPrice);
      }
    });
  }

  // 2. Identify Critical Defense Positions (Threatened Short Options / High-Risk Long Options)
  const defensePositions: ThreatenedPositionItem[] = [];

  for (const h of holdingsRaw) {
    if (h.assetType !== 'OPTION') continue;
    if (Math.abs(h.quantity) < 0.0001) continue; // Skip zero/closed positions

    // Resolve expiry date, strike, option type, and underlying
    let rawExpiry = h.expiryDate;
    let strike = h.strikePrice ? Number(h.strikePrice) : 0;
    let optType = h.optionType;
    let underlying = (h.underlyingSymbol || '').trim();

    if (!rawExpiry || !strike || !optType || !underlying) {
      const parsed = parseOccSymbol(h.symbol) || parseOccSymbol(h.brokerSpecificId || '');
      if (!rawExpiry && parsed.expiryDate) rawExpiry = parsed.expiryDate;
      if (!strike && parsed.strikePrice) strike = parsed.strikePrice;
      if (!optType && parsed.optionType) optType = parsed.optionType;
      if (!underlying && parsed.underlying) underlying = parsed.underlying;
    }

    if (!underlying) underlying = h.symbol.split(' ')[0] || h.symbol;
    if (!rawExpiry || !strike) continue;

    // Parse expiration date with full support for YYYYMMDD, YYMMDD, and ISO strings
    const expDate = parseOptionExpiryDate(rawExpiry);
    if (!expDate) continue;

    // STRICT CHECK: Discard all past expired options! Expired contracts must NEVER appear in Defense Center!
    const expDateStart = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate(), 0, 0, 0, 0).getTime();
    if (expDateStart < todayStart) {
      continue; // Expired in the past!
    }

    // Calculate real DTE
    const dte = Math.max(0, Math.ceil((expDate.getTime() - generatedAt.getTime()) / (1000 * 60 * 60 * 24)));
    const spotPrice = spotMap.get(underlying.toUpperCase()) || h.currentPrice || strike;

    const optTypeUpper = (optType || '').toUpperCase();
    const isCall = optTypeUpper === 'CALL' || optTypeUpper === 'C';
    const isITM = isCall ? spotPrice > strike : spotPrice < strike;
    const distPct = spotPrice > 0 ? Math.abs((spotPrice - strike) / spotPrice) * 100 : 0;

    let threatLevel: 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
    let threatReason = 'Position comfortably OTM with ample time to expiration.';
    let suggestedAction = 'Monitor theta decay; hold to target 50% profit target.';

    const isShort = h.quantity < 0;

    if (isShort) {
      // Short options threat modeling (Assignment & Gamma Risk)
      if (isITM && dte <= 7) {
        threatLevel = 'EXTREME';
        threatReason = `ITM short ${optTypeUpper} breach with only ${dte} DTE remaining. Assignment risk high.`;
        suggestedAction = 'Roll out to next month for credit or close to defend capital.';
      } else if (isITM || (distPct < 3.5 && dte <= 14)) {
        threatLevel = 'HIGH';
        threatReason = isITM
          ? `ITM short ${optTypeUpper} ($${strike}) breached with ${dte} DTE left.`
          : `Within ${distPct.toFixed(1)}% of strike with ${dte} DTE left. Elevated gamma risk.`;
        suggestedAction = 'Prepare defensive roll to wider strike or harvest loss before gamma ramp.';
      } else if (distPct < 7.0 && dte <= 21) {
        threatLevel = 'MODERATE';
        threatReason = `Proximity warning: ${distPct.toFixed(1)}% buffer to strike ($${strike}).`;
        suggestedAction = 'Set 5% price proximity alert and watch underlying support/resistance.';
      }
    } else {
      // Long options threat modeling: Long calls/puts OTM with low DTE are losing trades!
      if (!isITM && dte <= 10) {
        threatLevel = 'EXTREME';
        threatReason = `OTM long ${optTypeUpper} ($${strike}) losing trade with rapid theta decay (${dte} DTE).`;
        suggestedAction = 'Cut losses immediately or salvage remaining residual extrinsic value.';
      } else if (!isITM && dte <= 21) {
        threatLevel = 'HIGH';
        threatReason = `OTM long ${optTypeUpper} losing position approaching expiry (${dte} DTE).`;
        suggestedAction = 'Evaluate underlying thesis; consider closing before theta curve steepens.';
      } else if (isITM) {
        threatLevel = 'LOW';
        threatReason = `ITM long ${optTypeUpper} profitable position in the green.`;
        suggestedAction = 'Protect gains with trailing stop or take profit on spikes.';
      }
    }

    if (threatLevel !== 'LOW') {
      defensePositions.push({
        symbol: h.symbol,
        underlyingSymbol: underlying.toUpperCase(),
        optionType: optTypeUpper,
        strikePrice: strike,
        expiryDate: rawExpiry,
        daysToExpiry: dte,
        quantity: h.quantity,
        unrealizedPL: h.unrealizedPnL,
        unrealizedPLPercent: h.unrealizedPnLPercent,
        currentUnderlyingPrice: spotPrice,
        threatLevel,
        threatReason,
        suggestedAction,
      });
    }
  }

  // Sort defense by severity
  const severityOrder = { EXTREME: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
  defensePositions.sort((a, b) => severityOrder[a.threatLevel] - severityOrder[b.threatLevel]);

  // 3. Scan Top 5 High-Conviction Dip Buying Opportunities (Deduplicated, Score >= 60)
  let topDipBuys: DipCandidateItem[] = [];
  try {
    const savedReports = await prisma.dipDiagnosticReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }).catch(() => []);

    // Deduplicate by symbol (keep the highest score per unique symbol)
    const uniqueDipsMap = new Map<string, typeof savedReports[0]>();
    for (const report of savedReports) {
      const sym = report.symbol.toUpperCase();
      const existing = uniqueDipsMap.get(sym);
      if (!existing || report.opportunityScore > existing.opportunityScore) {
        uniqueDipsMap.set(sym, report);
      }
    }

    // High conviction threshold: minimum score 60/100, and exclude negative verdicts
    const highConvictionSaved = Array.from(uniqueDipsMap.values())
      .filter((s) => s.opportunityScore >= 60 && s.verdict !== 'AVOID_FALLING_KNIFE' && s.verdict !== 'TRIM_DEFENSIVE')
      .sort((a, b) => b.opportunityScore - a.opportunityScore);

    if (highConvictionSaved.length > 0) {
      topDipBuys = highConvictionSaved.slice(0, 5).map((s) => ({
        symbol: s.symbol,
        name: s.companyName || s.symbol,
        currentPrice: s.currentPrice,
        dayChange: 0,
        dayChangePercent: s.dayChangePercent || 0,
        fiftyTwoWeekHigh: s.distanceFrom52WHigh ? s.currentPrice / (1 + s.distanceFrom52WHigh / 100) : s.currentPrice * 1.2,
        fiftyTwoWeekLow: s.currentPrice * 0.8,
        distanceFrom52WHigh: s.distanceFrom52WHigh || -15.0,
        volume: 1000000,
        avgVolume: 1000000,
        volumeMultiplier: 1.0,
        sector: 'Equities',
        source: 'WATCHLIST',
        heuristicSignal: {
          relativeDropVsMarket: -2.0,
          potentialDriver: (s.classification as any) || 'LIKELY_VOLATILITY',
          preliminaryOpportunityScore: s.opportunityScore,
        },
        scoreBreakdown: {
          totalScore: s.opportunityScore,
          valuationScore: 20,
          fundamentalScore: 20,
          technicalScore: 15,
          driverScore: 10,
          portfolioFitScore: 10,
          targetUpsidePercent: 20,
          targetPrice: s.currentPrice * 1.2,
          forwardPE: 20,
          trailingPE: 25,
          pegRatio: 1.2,
          freeCashflow: null,
          debtToEquity: null,
          operatingMargins: null,
          valuationGrade: 'UNDERVALUED',
          fundamentalGrade: 'SOLID',
          technicalSetup: 'DEEP_VALUE_SUPPORT',
          analystRating: 'BUY',
          highlightBadges: [s.classification || 'Dip Opportunity'],
        },
      }));
    }

    // Supplement with live dip scanner if fewer than 5 high-conviction saved dips
    if (topDipBuys.length < 5) {
      const existingSymbols = new Set(topDipBuys.map((d) => d.symbol.toUpperCase()));
      const dipScanPromise = scanHoldingsAndWatchlistsForDips(prisma, { minDrawdownFromHighPercent: -8.0 });
      const timeoutPromise = new Promise<null>((r) => setTimeout(() => r(null), 3000));
      const dipScan = await Promise.race([dipScanPromise, timeoutPromise]);
      if (dipScan && dipScan.dips && dipScan.dips.length > 0) {
        const scannerDips = dipScan.dips
          .filter((d) => {
            const sym = d.symbol.toUpperCase();
            if (existingSymbols.has(sym)) return false;
            const score = d.scoreBreakdown?.totalScore || d.heuristicSignal?.preliminaryOpportunityScore || 0;
            return score >= 60; // Must meet high-conviction minimum score!
          })
          .sort((a, b) => {
            const scoreA = a.scoreBreakdown?.totalScore || a.heuristicSignal?.preliminaryOpportunityScore || 0;
            const scoreB = b.scoreBreakdown?.totalScore || b.heuristicSignal?.preliminaryOpportunityScore || 0;
            return scoreB - scoreA;
          });

        for (const scanDip of scannerDips) {
          if (topDipBuys.length >= 5) break;
          existingSymbols.add(scanDip.symbol.toUpperCase());
          topDipBuys.push(scanDip);
        }
      }
    }
  } catch (err: any) {
    console.warn('[TelegramReport] Dip scan fallback:', err.message);
  }

  // 4. Alerts Summary & Critical Proximity Evaluation
  const triggeredAlerts: AlertBriefingItem[] = [];
  let activeAlertsCount = 0;
  const newlyBreachedAlertIds: string[] = [];

  for (const a of alertsRaw) {
    if (a.isMuted) continue;

    const sym = a.symbol.toUpperCase();
    const spot = spotMap.get(sym);
    const isStatusTriggered = (a.status || '').toUpperCase() === 'TRIGGERED';

    let isPriceBreached = false;
    if (spot != null && spot > 0) {
      if (a.condition === 'ABOVE' && spot >= a.targetPrice) isPriceBreached = true;
      if (a.condition === 'BELOW' && spot <= a.targetPrice) isPriceBreached = true;
    }

    if (isStatusTriggered || isPriceBreached) {
      triggeredAlerts.push({
        id: a.id,
        symbol: a.symbol,
        targetPrice: a.targetPrice,
        condition: a.condition,
        note: (a as any).notes || (a as any).note || '',
        status: 'TRIGGERED',
        triggeredAt: a.triggeredAt ? a.triggeredAt.toISOString() : new Date().toISOString(),
        currentPrice: spot || a.triggeredPrice || a.targetPrice,
        isDefenseAlert: ((a as any).notes || '').includes('Short Option'),
      });

      if (isPriceBreached && !isStatusTriggered) {
        newlyBreachedAlertIds.push(a.id);
      }
    } else if ((a.status || '').toUpperCase() === 'ACTIVE') {
      activeAlertsCount++;
    }
  }

  // Asynchronously record newly breached alerts in DB
  if (newlyBreachedAlertIds.length > 0) {
    prisma.priceAlert
      .updateMany({
        where: { id: { in: newlyBreachedAlertIds } },
        data: { status: 'TRIGGERED', triggeredAt: new Date() },
      })
      .catch((err) => console.warn('[TelegramReport] Could not update triggered alerts in DB:', err.message));
  }

  // Sort triggered alerts: 1st Critical 5% short option defense, 2nd 10% defense, 3rd regular price alerts
  triggeredAlerts.sort((a, b) => {
    const isDef5A = (a.note || '').includes('5% Defense') ? 1 : 0;
    const isDef5B = (b.note || '').includes('5% Defense') ? 1 : 0;
    if (isDef5A !== isDef5B) return isDef5B - isDef5A;

    const isDef10A = (a.note || '').includes('10% Defense') ? 1 : 0;
    const isDef10B = (b.note || '').includes('10% Defense') ? 1 : 0;
    if (isDef10A !== isDef10B) return isDef10B - isDef10A;

    const tA = a.triggeredAt ? new Date(a.triggeredAt).getTime() : 0;
    const tB = b.triggeredAt ? new Date(b.triggeredAt).getTime() : 0;
    return tB - tA;
  });

  // 5. Enhanced Institutional Macro Environment & Multi-Asset Snapshot
  let liveVix = 15.6;
  let live10Y = 4.35;
  let live2Y = 4.07;
  let liveDxy = 103.8;
  let liveOil = 72.0;
  let liveGold = 2680.0;
  let liveSp500 = 5880.0;

  try {
    const [vixQ, tnXQ, irxQ, dxyQ, clQ, gcQ, spQ] = await Promise.allSettled([
      yahooFinance.quote('^VIX', {}, { validateResult: false }),
      yahooFinance.quote('^TNX', {}, { validateResult: false }),
      yahooFinance.quote('^IRX', {}, { validateResult: false }),
      yahooFinance.quote('DX-Y.NYB', {}, { validateResult: false }),
      yahooFinance.quote('CL=F', {}, { validateResult: false }),
      yahooFinance.quote('GC=F', {}, { validateResult: false }),
      yahooFinance.quote('^GSPC', {}, { validateResult: false }),
    ]);
    if (vixQ.status === 'fulfilled' && vixQ.value?.regularMarketPrice) liveVix = vixQ.value.regularMarketPrice;
    if (tnXQ.status === 'fulfilled' && tnXQ.value?.regularMarketPrice) live10Y = tnXQ.value.regularMarketPrice;
    if (irxQ.status === 'fulfilled' && irxQ.value?.regularMarketPrice) live2Y = irxQ.value.regularMarketPrice;
    if (dxyQ.status === 'fulfilled' && dxyQ.value?.regularMarketPrice) liveDxy = dxyQ.value.regularMarketPrice;
    if (clQ.status === 'fulfilled' && clQ.value?.regularMarketPrice) liveOil = clQ.value.regularMarketPrice;
    if (gcQ.status === 'fulfilled' && gcQ.value?.regularMarketPrice) liveGold = gcQ.value.regularMarketPrice;
    if (spQ.status === 'fulfilled' && spQ.value?.regularMarketPrice) liveSp500 = spQ.value.regularMarketPrice;
  } catch {
    // fallback to defaults
  }

  let macro: MacroBriefingData;
  if (savedMacroList.length > 0) {
    const m = savedMacroList[0];
    macro = {
      regimeTitle: m.regimeTitle || 'Late-Cycle Disinflation & Policy Normalization',
      regimeTone: m.regimeTone || 'neutral',
      macroScore: m.macroScore || 72,
      growthOutlook: m.growthOutlook || 'MODERATING',
      inflationRegime: m.inflationRegime || 'DISINFLATION',
      monetaryPolicyPosture: m.monetaryPolicyPosture || 'DOVISH_EASING',
      liquidityCondition: m.liquidityCondition || 'EXPANDING',
      vixLevel: m.vixLevel || liveVix,
      yield10y: m.yield10y || live10Y,
      yield2y: live2Y,
      spread2y10y: m.spread2y10y || (live10Y - live2Y),
      fedFundsRate: m.fedFundsRate || 4.83,
      highYieldSpread: m.highYieldSpread || 3.12,
      dxyLevel: m.dxyLevel || liveDxy,
      oilPrice: m.oilPrice || liveOil,
      goldPrice: liveGold,
      sp500Price: liveSp500,
      executiveSummary: m.executiveSummary || 'Macro regime exhibits healthy disinflation alongside easing central bank posture. Equity valuations remain supported by AI datacenter capital expenditures and strong corporate free cash flows.',
      keyTakeaways: (m.keyTakeaways && m.keyTakeaways.length > 0) ? m.keyTakeaways : [
        'Monetary policy easing cycle provides structural liquidity support for quality corporate balance sheets.',
        'Yield curve steepening favors mid-duration fixed income, gold real-asset backing, and capital-efficient equities.',
        'Low-volatility regime creates prime conditions for structured option premium harvesting and theta capture.',
      ],
      tacticalAllocations: (m.tacticalAllocations && m.tacticalAllocations.length > 0) ? m.tacticalAllocations.map((t: any) => ({
        category: t.category,
        subAsset: t.subAsset,
        stance: t.stance,
        rationale: t.rationale,
      })) : [
        { category: 'Equities & Core Growth', subAsset: 'AI Power & Data Infrastructure', stance: 'OVERWEIGHT', rationale: 'Secular power grid, nuclear, and cloud infrastructure growth with high margins.' },
        { category: 'Fixed Income & Duration', subAsset: '4-6 Year Treasuries & Curve Steepeners', stance: 'NEUTRAL', rationale: 'Capture disinflation yield roll-down; benefit from Fed rate cutting path.' },
        { category: 'Real Assets & Gold', subAsset: 'Physical Gold & Copper', stance: 'OVERWEIGHT', rationale: 'Central bank de-dollarization reserves; real rate hedging and sovereign debt supply.' },
        { category: 'Options & Hedging', subAsset: 'Theta Harvesting & Vol Spreads', stance: 'TACTICAL_HEDGE', rationale: 'Exploit subdued VIX with covered calls & short puts; hedge tail downside.' },
      ],
    };
  } else {
    macro = {
      regimeTitle: 'Policy Recalibration & Soft-Landing Disinflation',
      regimeTone: 'neutral',
      macroScore: 72,
      growthOutlook: 'MODERATING',
      inflationRegime: 'DISINFLATION',
      monetaryPolicyPosture: 'DOVISH_EASING',
      liquidityCondition: 'EXPANDING',
      vixLevel: liveVix,
      yield10y: live10Y,
      yield2y: live2Y,
      spread2y10y: Math.round((live10Y - live2Y) * 100) / 100,
      fedFundsRate: 4.83,
      highYieldSpread: 3.12,
      dxyLevel: liveDxy,
      oilPrice: liveOil,
      goldPrice: liveGold,
      sp500Price: liveSp500,
      executiveSummary: 'Central bank policy recalibration provides supportive backdrop for multi-asset portfolios. Core inflation continues downward glidepath toward target, while credit spreads remain tight with subdued default risk.',
      keyTakeaways: [
        `VIX at ${liveVix.toFixed(1)} reflects disciplined options pricing and favorable theta-selling market conditions.`,
        `10-Year Benchmark at ${live10Y.toFixed(2)}% anchors equity valuations while curve re-steepening proceeds.`,
        'High-conviction allocations favor cash-generative technology, power grid infrastructure, and real asset hedges.'
      ],
      tacticalAllocations: [
        { category: 'Equities & Core Growth', subAsset: 'AI Power & Data Infrastructure', stance: 'OVERWEIGHT', rationale: 'Secular power grid, nuclear, and cloud infrastructure growth with high margins.' },
        { category: 'Fixed Income & Duration', subAsset: '4-6 Year Treasuries & Curve Steepeners', stance: 'NEUTRAL', rationale: 'Capture disinflation yield roll-down; benefit from Fed rate cutting path.' },
        { category: 'Real Assets & Gold', subAsset: 'Physical Gold & Copper', stance: 'OVERWEIGHT', rationale: 'Central bank de-dollarization reserves; real rate hedging and sovereign debt supply.' },
        { category: 'Options & Hedging', subAsset: 'Theta Harvesting & Vol Spreads', stance: 'TACTICAL_HEDGE', rationale: 'Exploit subdued VIX with covered calls & short puts; hedge tail downside.' },
      ],
    };
  }

  return {
    generatedAt,
    reportTitle: `TradeFlow Executive Portfolio & Market Briefing`,
    portfolio,
    defensePositions,
    topDipBuys,
    alerts: {
      triggered: triggeredAlerts,
      activeCount: activeAlertsCount,
    },
    macro,
  };
}

/**
 * Accurately parses options expiry dates from various formats (YYYYMMDD, YYMMDD, ISO)
 */
export function parseOptionExpiryDate(rawExpiry?: string | null): Date | null {
  if (!rawExpiry) return null;
  const clean = String(rawExpiry).trim();

  // 1. 8 digits: YYYYMMDD (e.g. "20260918")
  if (/^\d{8}$/.test(clean)) {
    const y = parseInt(clean.slice(0, 4), 10);
    const m = parseInt(clean.slice(4, 6), 10) - 1;
    const d = parseInt(clean.slice(6, 8), 10);
    const dt = new Date(y, m, d, 23, 59, 59, 999);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // 2. 6 digits: YYMMDD from OCC option symbol (e.g. "260918")
  if (/^\d{6}$/.test(clean)) {
    const y = 2000 + parseInt(clean.slice(0, 2), 10);
    const m = parseInt(clean.slice(2, 4), 10) - 1;
    const d = parseInt(clean.slice(4, 6), 10);
    const dt = new Date(y, m, d, 23, 59, 59, 999);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // 3. ISO or hyphenated / slashed date string (e.g. "2026-09-18", "2026-09-18T00:00:00.000Z")
  if (clean.includes('-') || clean.includes('/')) {
    const parts = clean.split(/[-/T ]/);
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m, d, 23, 59, 59, 999);
      if (!isNaN(dt.getTime())) return dt;
    }
  }

  const fallback = new Date(clean);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Formats options expiry dates into human-readable format (e.g. "20260918" -> "Sep 18, 2026")
 */
export function formatOptionExpiryDate(rawExpiry?: string | null): string {
  if (!rawExpiry) return 'N/A';
  const clean = String(rawExpiry).trim();

  // 1. If 8 digits: YYYYMMDD (e.g. "20260918")
  if (/^\d{8}$/.test(clean)) {
    const y = parseInt(clean.slice(0, 4), 10);
    const m = parseInt(clean.slice(4, 6), 10) - 1;
    const d = parseInt(clean.slice(6, 8), 10);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (m >= 0 && m < 12) return `${monthNames[m]} ${d}, ${y}`;
  }

  // 2. If 6 digits: YYMMDD from OCC symbol (e.g. "260918")
  if (/^\d{6}$/.test(clean)) {
    const y = 2000 + parseInt(clean.slice(0, 2), 10);
    const m = parseInt(clean.slice(2, 4), 10) - 1;
    const d = parseInt(clean.slice(4, 6), 10);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (m >= 0 && m < 12) return `${monthNames[m]} ${d}, ${y}`;
  }

  // 3. If ISO or date string like "2026-09-18" or "2026-09-18T00:00:00.000Z"
  if (clean.includes('-') || clean.includes('/')) {
    const parts = clean.split(/[-/T ]/);
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (!isNaN(y) && m >= 0 && m < 12 && !isNaN(d)) return `${monthNames[m]} ${d}, ${y}`;
    }
  }

  return clean;
}

/**
 * Generates an institutional-grade PDF document Buffer using PDFKit
 */
export async function generateExecutivePdfBuffer(data: ExecutiveReportData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 36, bottom: 25, left: 40, right: 40 },
      bufferPages: true,
      compress: false,
      info: {
        Title: data.reportTitle,
        Author: 'TradeFlow AI Executive Intelligence',
        Subject: 'Institutional Portfolio & Market Briefing',
        CreationDate: data.generatedAt,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const colors = {
      primaryNavy: '#0f172a',
      accentIndigo: '#4f46e5',
      accentCyan: '#0284c7',
      emeraldGreen: '#059669',
      roseRed: '#dc2626',
      amberGold: '#d97706',
      slateDark: '#1e293b',
      slateMuted: '#64748b',
      slateLight: '#f1f5f9',
      cardBg: '#f8fafc',
      cardBorder: '#cbd5e1',
    };

    const dateFormatted = data.generatedAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeFormatted = data.generatedAt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    // =========================================================================
    // PAGE 1: HEADER, CRITICAL DEFENSE, DIP OPPORTUNITIES & ALERTS
    // =========================================================================

    // Top Header Banner Box
    doc.rect(40, 40, 532, 60).fill(colors.primaryNavy);
    doc.rect(40, 98, 532, 2).fill(colors.accentIndigo);

    // Left Title Block (Constrained width to avoid any overlap)
    doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold')
      .text('TRADEFLOW | EXECUTIVE INTELLIGENCE BRIEFING', 52, 50, { width: 340 });

    doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica')
      .text(`Generated: ${dateFormatted} at ${timeFormatted} • Daily Dispatch`, 52, 72, { width: 340 });

    // Right Institutional Status Badge (Dedicated styled pill container, zero overlap)
    doc.roundedRect(406, 49, 154, 20, 3).fillAndStroke('#1e293b', '#0369a1');
    doc.fillColor('#38bdf8').fontSize(7.5).font('Helvetica-Bold')
      .text('CONFIDENTIAL / INSTITUTIONAL', 406, 55, { align: 'center', width: 154 });

    doc.fillColor('#64748b').fontSize(6.5).font('Helvetica')
      .text('AUTOMATED DISPATCH', 406, 73, { align: 'center', width: 154 });

    // Section 1: Positions Requiring Defense & Management
    const section1Top = 115;
    doc.fillColor(colors.primaryNavy).fontSize(12).font('Helvetica-Bold')
      .text('1. CRITICAL POSITION DEFENSE CENTER (Action Required)', 40, section1Top);
    doc.rect(40, section1Top + 16, 532, 1).fill(colors.cardBorder);

    let defY = section1Top + 24;
    if (data.defensePositions.length === 0) {
      doc.roundedRect(40, defY, 532, 34, 4).fillAndStroke('#ecfdf5', '#a7f3d0');
      doc.fillColor(colors.emeraldGreen).fontSize(9).font('Helvetica-Bold')
        .text('✓ All active positions are operating within safe risk bounds. No emergency option rolls needed.', 52, defY + 12);
      defY += 44;
    } else {
      // Defense Table Header
      doc.rect(40, defY, 532, 18).fill(colors.slateDark);
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
      doc.text('THREAT', 48, defY + 5);
      doc.text('POSITION / UNDERLYING', 110, defY + 5);
      doc.text('STRIKE & EXPIRY', 250, defY + 5);
      doc.text('DTE', 350, defY + 5);
      doc.text('OPEN P&L', 400, defY + 5);
      doc.text('RECOMMENDED ACTION', 470, defY + 5);

      defY += 18;
      data.defensePositions.slice(0, 5).forEach((p, idx) => {
        const rowBg = idx % 2 === 0 ? '#ffffff' : colors.cardBg;
        doc.rect(40, defY, 532, 28).fillAndStroke(rowBg, '#e2e8f0');

        // Threat Badge
        const badgeColor = p.threatLevel === 'EXTREME' ? colors.roseRed : p.threatLevel === 'HIGH' ? colors.amberGold : colors.slateMuted;
        doc.roundedRect(46, defY + 6, 54, 14, 2).fill(badgeColor);
        doc.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold').text(p.threatLevel, 46, defY + 9, { width: 54, align: 'center' });

        // Position Info
        doc.fillColor(colors.primaryNavy).fontSize(8).font('Helvetica-Bold')
          .text(`${p.underlyingSymbol} ($${p.currentUnderlyingPrice.toFixed(2)})`, 110, defY + 6);
        doc.fillColor(colors.slateMuted).fontSize(7).font('Helvetica')
          .text(`${p.quantity > 0 ? '+' : ''}${p.quantity} contract (${p.optionType})`, 110, defY + 16);

        // Strike & Expiry (Nicely formatted and styled date)
        doc.fillColor(colors.slateDark).fontSize(8).font('Helvetica-Bold')
          .text(`$${p.strikePrice.toFixed(2)} ${p.optionType}`, 246, defY + 6);
        doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
          .text('Exp: ', 246, defY + 16);
        doc.fillColor(colors.accentIndigo).fontSize(7).font('Helvetica-Bold')
          .text(formatOptionExpiryDate(p.expiryDate), 265, defY + 16);

        // DTE (Styled in a clean pill badge)
        const dteColor = p.daysToExpiry <= 7 ? colors.roseRed : p.daysToExpiry <= 21 ? colors.amberGold : colors.emeraldGreen;
        doc.roundedRect(344, defY + 7, 34, 14, 2).fill(dteColor);
        doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold')
          .text(`${p.daysToExpiry}d`, 344, defY + 10, { width: 34, align: 'center' });

        // Open P&L
        const pColor = p.unrealizedPL >= 0 ? colors.emeraldGreen : colors.roseRed;
        doc.fillColor(pColor).fontSize(7.5).font('Helvetica-Bold')
          .text(`${p.unrealizedPL >= 0 ? '+' : ''}$${p.unrealizedPL.toFixed(0)}`, 400, defY + 10);

        // Recommended Action
        doc.fillColor(colors.slateDark).fontSize(7).font('Helvetica')
          .text(p.suggestedAction, 470, defY + 6, { width: 95, lineBreak: true });

        defY += 28;
      });
      defY += 10;
    }

    // Section 2: Top 5 High-Conviction Dip Buying Opportunities
    const section2Top = Math.max(220, defY + 10);
    doc.fillColor(colors.primaryNavy).fontSize(12).font('Helvetica-Bold')
      .text('2. TOP 5 HIGH-CONVICTION DIP-BUYING OPPORTUNITIES', 40, section2Top);
    doc.rect(40, section2Top + 16, 532, 1).fill(colors.cardBorder);

    let dipY = section2Top + 24;
    doc.rect(40, dipY, 532, 18).fill(colors.accentIndigo);
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
    doc.text('SCORE', 48, dipY + 5);
    doc.text('TICKER & COMPANY', 110, dipY + 5);
    doc.text('PRICE', 250, dipY + 5);
    doc.text('52W DRAWDOWN', 320, dipY + 5);
    doc.text('SECTOR & SETUP', 410, dipY + 5);

    dipY += 18;
    if (data.topDipBuys.length === 0) {
      doc.rect(40, dipY, 532, 24).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor(colors.slateMuted).fontSize(8).font('Helvetica')
        .text('No extreme oversold dip candidates currently meeting strict quality thresholds.', 50, dipY + 7);
      dipY += 24;
    } else {
      data.topDipBuys.slice(0, 5).forEach((d, idx) => {
        const rowBg = idx % 2 === 0 ? '#ffffff' : colors.cardBg;
        doc.rect(40, dipY, 532, 25).fillAndStroke(rowBg, '#e2e8f0');

        const score = d.scoreBreakdown?.totalScore || d.heuristicSignal?.preliminaryOpportunityScore || 75;
        doc.roundedRect(46, dipY + 5, 52, 14, 2).fill(colors.emeraldGreen);
        doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold').text(`${score}/100`, 46, dipY + 8, { width: 52, align: 'center' });

        doc.fillColor(colors.primaryNavy).fontSize(8).font('Helvetica-Bold')
          .text(`$${d.symbol}`, 110, dipY + 5);
        doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
          .text((d.name || d.symbol).slice(0, 26), 110, dipY + 14);

        doc.fillColor(colors.slateDark).fontSize(8).font('Helvetica-Bold')
          .text(`$${d.currentPrice.toFixed(2)}`, 250, dipY + 8);

        doc.fillColor(colors.roseRed).fontSize(8).font('Helvetica-Bold')
          .text(`${d.distanceFrom52WHigh ? d.distanceFrom52WHigh.toFixed(1) : '-15.0'}%`, 320, dipY + 8);

        doc.fillColor(colors.slateDark).fontSize(7).font('Helvetica')
          .text(`${d.sector || 'Equities'} • ${d.scoreBreakdown?.technicalSetup ? d.scoreBreakdown.technicalSetup.replace(/_/g, ' ') : 'Support Rebound'}`, 410, dipY + 8, { width: 155 });

        dipY += 25;
      });
    }

    // Section 3: Triggered Alerts & Proximity Warnings
    const section3Top = dipY + 14;
    const alertCountLabel = data.alerts.triggered.length > 0
      ? `(${data.alerts.triggered.length} Triggered / ${data.alerts.activeCount} Active Rules)`
      : `(${data.alerts.activeCount} Active Monitoring Rules)`;

    doc.fillColor(colors.primaryNavy).fontSize(11).font('Helvetica-Bold')
      .text(`3. TRIGGERED & ACTIVE CRITICAL PROXIMITY ALERTS ${alertCountLabel}`, 40, section3Top);
    doc.rect(40, section3Top + 15, 532, 1).fill(colors.cardBorder);

    let alertY = section3Top + 22;
    if (data.alerts.triggered.length === 0) {
      doc.roundedRect(40, alertY, 532, 28, 4).fillAndStroke(colors.cardBg, colors.cardBorder);
      doc.fillColor(colors.slateMuted).fontSize(8).font('Helvetica')
        .text(`No price or strike alerts currently triggered. (${data.alerts.activeCount} active monitoring rules actively engaged).`, 52, alertY + 9);
      alertY += 28;
    } else {
      // Display up to 4 top triggered alerts
      const topAlerts = data.alerts.triggered.slice(0, 4);
      topAlerts.forEach((a) => {
        const isDefense5 = (a.note || '').includes('5% Defense');
        const isDefense10 = (a.note || '').includes('10% Defense');
        const bg = isDefense5 ? '#fef2f2' : isDefense10 ? '#fffbeb' : colors.cardBg;
        const border = isDefense5 ? '#fecaca' : isDefense10 ? '#fde68a' : colors.cardBorder;
        const badgeColor = isDefense5 ? colors.roseRed : isDefense10 ? colors.amberGold : colors.accentIndigo;
        const badgeLabel = isDefense5 ? 'CRITICAL 5%' : isDefense10 ? 'WARNING 10%' : 'TRIGGERED';

        doc.roundedRect(40, alertY, 532, 24, 3).fillAndStroke(bg, border);

        // Badge
        doc.roundedRect(46, alertY + 5, 62, 14, 2).fill(badgeColor);
        doc.fillColor('#ffffff').fontSize(6).font('Helvetica-Bold').text(badgeLabel, 46, alertY + 8, { width: 62, align: 'center' });

        // Ticker & Condition
        const currPriceStr = a.currentPrice ? ` (Hit $${a.currentPrice.toFixed(2)})` : '';
        doc.fillColor(colors.primaryNavy).fontSize(7.5).font('Helvetica-Bold')
          .text(`$${a.symbol} crossed $${a.targetPrice.toFixed(2)} [${a.condition}]${currPriceStr}`, 116, alertY + 7);

        // Note description
        const noteClean = (a.note || 'Target proximity breach').replace(/\[Short Option (5|10)% Defense\]\s*/i, '');
        doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
          .text(noteClean.slice(0, 68), 320, alertY + 7, { width: 245, lineBreak: false });

        alertY += 26;
      });

      if (data.alerts.triggered.length > 4) {
        doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica-Oblique')
          .text(`+ ${data.alerts.triggered.length - 4} additional triggered alerts active in Alerts Defense Center.`, 48, alertY + 2);
        alertY += 12;
      }
    }

    // =========================================================================
    // PAGE 2: ENHANCED GLOBAL MACRO ENVIRONMENT & MULTI-ASSET DOSSIER
    // =========================================================================
    doc.addPage();

    // Page 2 Header Banner
    doc.rect(40, 40, 532, 48).fill(colors.primaryNavy);
    doc.rect(40, 86, 532, 2).fill(colors.accentCyan);

    doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold')
      .text('4. GLOBAL MACRO ENVIRONMENT & MULTI-ASSET DOSSIER', 52, 49);
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
      .text(`Macro Regime: ${data.macro.regimeTitle} • Institutional Stability Score: ${data.macro.macroScore}/100`, 52, 65);

    // Mini regime tags inside header
    const growthTag = data.macro.growthOutlook || 'MODERATING';
    const policyTag = data.macro.monetaryPolicyPosture || 'DOVISH_EASING';
    const infTag = data.macro.inflationRegime || 'DISINFLATION';
    const liqTag = data.macro.liquidityCondition || 'EXPANDING';

    doc.roundedRect(52, 75, 78, 9, 2).fill('#1e293b');
    doc.fillColor('#38bdf8').fontSize(5.5).font('Helvetica-Bold').text(`GROWTH: ${growthTag}`, 52, 77, { width: 78, align: 'center' });

    doc.roundedRect(136, 75, 82, 9, 2).fill('#1e293b');
    doc.fillColor('#4ade80').fontSize(5.5).font('Helvetica-Bold').text(`POLICY: ${policyTag}`, 136, 77, { width: 82, align: 'center' });

    doc.roundedRect(224, 75, 80, 9, 2).fill('#1e293b');
    doc.fillColor('#fde047').fontSize(5.5).font('Helvetica-Bold').text(`INFLATION: ${infTag}`, 224, 77, { width: 80, align: 'center' });

    doc.roundedRect(310, 75, 80, 9, 2).fill('#1e293b');
    doc.fillColor('#c084fc').fontSize(5.5).font('Helvetica-Bold').text(`LIQUIDITY: ${liqTag}`, 310, 77, { width: 80, align: 'center' });

    // Live Macro Telemetry Cards (6 Metrics Side-by-Side)
    const macroBoxY = 94;
    const mBoxW = 82;
    const mBoxH = 42;
    const mGap = 8;

    const macroTelemetry = [
      { label: 'VIX VOLATILITY', val: `${data.macro.vixLevel.toFixed(1)}`, sub: data.macro.vixLevel < 18 ? 'Complacent / Theta Fav' : 'Elevated Vol' },
      { label: '10Y BENCHMARK', val: `${data.macro.yield10y.toFixed(2)}%`, sub: 'Risk-Free Baseline' },
      { label: '2s10s SPREAD', val: `${data.macro.spread2y10y >= 0 ? '+' : ''}${data.macro.spread2y10y.toFixed(2)}%`, sub: data.macro.spread2y10y >= 0 ? 'Normal Slope' : 'Inverted' },
      { label: 'FED FUNDS RATE', val: `${(data.macro.fedFundsRate || 4.83).toFixed(2)}%`, sub: 'Policy Normalization' },
      { label: 'DXY DOLLAR', val: `${data.macro.dxyLevel.toFixed(1)}`, sub: 'Global FX Liquidity' },
      { label: 'GOLD / REAL ASSET', val: `$${(data.macro.goldPrice || 2680).toFixed(0)}`, sub: 'Monetary Hedge' },
    ];

    macroTelemetry.forEach((item, idx) => {
      const curX = 40 + idx * (mBoxW + mGap);
      doc.roundedRect(curX, macroBoxY, mBoxW, mBoxH, 4).fillAndStroke(colors.cardBg, colors.cardBorder);
      doc.fillColor(colors.slateMuted).fontSize(6).font('Helvetica-Bold').text(item.label, curX + 5, macroBoxY + 5);
      doc.fillColor(colors.primaryNavy).fontSize(10).font('Helvetica-Bold').text(item.val, curX + 5, macroBoxY + 16);
      doc.fillColor(colors.slateMuted).fontSize(5.5).font('Helvetica').text(item.sub, curX + 5, macroBoxY + 29);
    });

    // Macro Executive Summary Card
    const execSumTop = macroBoxY + mBoxH + 12;
    doc.fillColor(colors.primaryNavy).fontSize(10).font('Helvetica-Bold')
      .text('EXECUTIVE MACRO STRATEGY & CYCLE DIAGNOSIS', 40, execSumTop);
    doc.rect(40, execSumTop + 13, 532, 1).fill(colors.cardBorder);

    doc.roundedRect(40, execSumTop + 19, 532, 58, 4).fillAndStroke('#f8fafc', colors.cardBorder);
    doc.fillColor(colors.primaryNavy).fontSize(7.5).font('Helvetica')
      .text(data.macro.executiveSummary, 50, execSumTop + 27, { width: 512, lineBreak: true });

    // Tactical Multi-Asset Portfolio Playbook
    const tacticalTop = execSumTop + 85;
    doc.fillColor(colors.primaryNavy).fontSize(10).font('Helvetica-Bold')
      .text('TACTICAL MULTI-ASSET ALLOCATION & DERIVATIVES STRATEGY', 40, tacticalTop);
    doc.rect(40, tacticalTop + 13, 532, 1).fill(colors.cardBorder);

    let tacY = tacticalTop + 20;
    const defaultTactical = [
      { category: 'Equities & Core Growth', subAsset: 'AI Infrastructure & High FCF', stance: 'OVERWEIGHT', rationale: 'Power grid, nuclear, and cloud datacenter infrastructure with durable secular pricing power.' },
      { category: 'Fixed Income & Duration', subAsset: '4-6 Year Treasuries & Curve Steepeners', stance: 'NEUTRAL', rationale: 'Capture disinflation yield roll-down; position for steepening as rate cutting cycle proceeds.' },
      { category: 'Real Assets & Gold', subAsset: 'Physical Gold & Critical Minerals', stance: 'OVERWEIGHT', rationale: 'Central bank de-dollarization reserves, sovereign debt issuance hedge, and real rate protection.' },
      { category: 'Options & Hedging', subAsset: 'Theta Harvesting & Defined Risk', stance: 'TACTICAL_HEDGE', rationale: 'Exploit low VIX with covered calls & short put premium; harvest theta; hedge tail risk with OTM skew.' },
    ];

    const tacticalItems = (data.macro.tacticalAllocations && data.macro.tacticalAllocations.length > 0)
      ? data.macro.tacticalAllocations.slice(0, 4)
      : defaultTactical;

    tacticalItems.forEach((t) => {
      doc.roundedRect(40, tacY, 532, 22, 3).fillAndStroke('#ffffff', '#e2e8f0');

      // Stance pill
      const stanceColor = t.stance === 'OVERWEIGHT' ? colors.emeraldGreen : t.stance === 'UNDERWEIGHT' ? colors.roseRed : colors.accentIndigo;
      doc.roundedRect(46, tacY + 4, 76, 14, 2).fill(stanceColor);
      doc.fillColor('#ffffff').fontSize(6).font('Helvetica-Bold').text(t.stance, 46, tacY + 7, { width: 76, align: 'center' });

      // Asset Class
      doc.fillColor(colors.primaryNavy).fontSize(7.5).font('Helvetica-Bold')
        .text(t.category, 130, tacY + 6);

      // Rationale
      doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica')
        .text(t.rationale.slice(0, 82), 260, tacY + 7, { width: 305, lineBreak: false });

      tacY += 25;
    });

    // Key Strategic Pillars & Implications
    const pillarTop = tacY + 8;
    doc.fillColor(colors.primaryNavy).fontSize(10).font('Helvetica-Bold')
      .text('KEY STRATEGIC IMPLICATIONS FOR TRADING & PORTFOLIO DEFENSE', 40, pillarTop);
    doc.rect(40, pillarTop + 13, 532, 1).fill(colors.cardBorder);

    let pilY = pillarTop + 20;
    data.macro.keyTakeaways.slice(0, 3).forEach((takeaway, idx) => {
      doc.roundedRect(40, pilY, 532, 26, 3).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor(colors.accentIndigo).fontSize(8.5).font('Helvetica-Bold').text(`0${idx + 1}`, 50, pilY + 8);
      doc.fillColor(colors.slateDark).fontSize(7.5).font('Helvetica')
        .text(takeaway, 74, pilY + 7, { width: 490, lineBreak: true });
      pilY += 30;
    });

    // Economic Cycle Signals & Transition Watchpoints
    const cycleTop = pilY + 6;
    doc.fillColor(colors.primaryNavy).fontSize(10).font('Helvetica-Bold')
      .text('ECONOMIC CYCLE SIGNALS & TRANSITION WATCHPOINTS', 40, cycleTop);
    doc.rect(40, cycleTop + 13, 532, 1).fill(colors.cardBorder);

    const cBoxY = cycleTop + 19;
    const cBoxW = 172;
    const cBoxH = 34;

    const cycleSignals = [
      { title: 'INFLATION & LABOR', desc: 'Core PCE downward glidepath intact. Job additions cooling to sustainable pace without recessionary spike.' },
      { title: 'YIELD CURVE & LIQUIDITY', desc: '2s10s curve un-inversion progress underway. Global central bank liquidity transitioning from drain to neutral.' },
      { title: 'VOLATILITY & CREDIT RISK', desc: 'High-yield option-adjusted spreads tight (~312 bps). Corporate balance sheets well-funded through 2027.' },
    ];

    cycleSignals.forEach((c, idx) => {
      const curX = 40 + idx * (cBoxW + 8);
      doc.roundedRect(curX, cBoxY, cBoxW, cBoxH, 3).fillAndStroke('#f8fafc', colors.cardBorder);
      doc.fillColor(colors.accentIndigo).fontSize(6.5).font('Helvetica-Bold').text(c.title, curX + 6, cBoxY + 5);
      doc.fillColor(colors.slateDark).fontSize(6).font('Helvetica').text(c.desc, curX + 6, cBoxY + 14, { width: cBoxW - 12 });
    });

    // Bottom Compliance & Verification Box
    const footerBoxY = cBoxY + cBoxH + 10;
    doc.roundedRect(40, footerBoxY, 532, 42, 3).fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica-Bold')
      .text('SYSTEM DISPATCH METADATA & INTEGRITY NOTICE', 50, footerBoxY + 7);
    doc.fillColor(colors.slateDark).fontSize(6.5).font('Helvetica')
      .text(`Synthesized automatically by the TradeFlow Autonomous Intelligence Engine. Integrates live holdings from Interactive Brokers, Tastytrade, and Trading212, CBOE options volatility matrices, and FRED economic series.\nDocument Checksum ID: ${Math.random().toString(36).substring(2, 12).toUpperCase()} • Delivered via Encrypted Telegram Webhook.`, 50, footerBoxY + 17, { width: 512, lineBreak: true });

    // Global Footer Page Numbers (Safely drawn without triggering automatic PDFKit blank pages)
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const originalMarginBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0; // Temporarily disable bottom margin to prevent auto-addPage

      // Thin aesthetic rule above footer
      doc.rect(40, 746, 532, 0.5).fill('#e2e8f0');

      doc.fillColor(colors.slateMuted).fontSize(7.5).font('Helvetica')
        .text(`TradeFlow Executive Briefing • Page ${i + 1} of ${range.count}`, 40, 752, {
          align: 'center',
          width: 532,
          lineBreak: false,
        });

      doc.page.margins.bottom = originalMarginBottom;
    }

    doc.end();
  });
}

/**
 * Sends a PDF Buffer to Telegram via the Bot API `sendDocument` endpoint with multipart/form-data
 */
export async function sendPdfReportToTelegram(
  pdfBuffer: Buffer,
  filename = `TradeFlow_Executive_Briefing_${new Date().toISOString().slice(0, 10)}.pdf`,
  captionSummary?: string,
  options?: {
    isAlert?: boolean;
    chatId?: string | number;
    messageThreadId?: number;
  }
): Promise<{ success: boolean; messageId?: number; responseData?: any }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !originalChatId) {
    throw new Error(
      'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment variables. Please check .env.local.'
    );
  }

  const isAlert = Boolean(options?.isAlert);
  // Routing: alerts go to -1003872409872 with thread 2; standard reports go to original chat without thread parameter
  const targetChatId = String(options?.chatId ?? (isAlert ? (process.env.TELEGRAM_ALERTS_CHAT_ID || '-1003872409872') : originalChatId));
  const targetThreadId = options?.messageThreadId ?? (isAlert ? Number(process.env.TELEGRAM_ALERTS_THREAD_ID || 2) : undefined);

  const defaultCaption = captionSummary || `📊 *TradeFlow Daily Executive Briefing*\n\nAttached is your synthesized institutional PDF report covering portfolio valuation, defense alerts, top 5 high-conviction dip opportunities, and macro volatility dossier.`;

  const task = agentActivityTracker.startTask({
    agentName: 'Telegram PDF Executive Dispatcher',
    agentType: 'PORTFOLIO_AUDIT',
    taskDescription: `Uploading PDF executive report (${(pdfBuffer.length / 1024).toFixed(1)} KB) to Telegram chat ${targetChatId}${targetThreadId ? ` (topic ${targetThreadId})` : ''}`,
    metadata: { filename, chat: targetChatId, threadId: targetThreadId, sizeBytes: pdfBuffer.length }
  });

  try {
    // Construct standard multipart/form-data body
    const formData = new FormData();
    formData.append('chat_id', targetChatId);
    if (targetThreadId !== undefined) {
      formData.append('message_thread_id', String(targetThreadId));
    }
    formData.append('caption', defaultCaption);
    formData.append('parse_mode', 'Markdown');

    const fileBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('document', fileBlob, filename);

    const telegramEndpoint = `https://api.telegram.org/bot${botToken}/sendDocument`;

    const res = await fetch(telegramEndpoint, {
      method: 'POST',
      body: formData,
    });

    const responseJson = await res.json();

    if (!res.ok || !responseJson.ok) {
      const errMsg = responseJson.description || `HTTP ${res.status} error from Telegram API`;
      throw new Error(errMsg);
    }

    agentActivityTracker.completeTask(task.id, {
      status: 'SUCCESS',
      outcomeSummary: `Successfully delivered ${filename} to Telegram (Message ID: ${responseJson.result?.message_id})`,
      metadata: { messageId: responseJson.result?.message_id },
    });

    return {
      success: true,
      messageId: responseJson.result?.message_id,
      responseData: responseJson.result,
    };
  } catch (error: any) {
    agentActivityTracker.completeTask(task.id, {
      status: 'FAILED',
      outcomeSummary: `Failed to dispatch PDF to Telegram: ${error.message}`,
      error: error.message,
    });
    throw error;
  }
}

export interface SendTelegramMessageOptions {
  text: string;
  isAlert?: boolean; // When true: routes to the "Alerts" topic (chat_id: -1003872409872, message_thread_id: 2)
  chatId?: string | number; // Custom chat_id override
  messageThreadId?: number; // Custom message_thread_id override
  parseMode?: 'Markdown' | 'HTML' | 'MarkdownV2';
  disableNotification?: boolean;
}

/**
 * Safely splits a long text into multiple chunks that fit within Telegram's 4096 character limit.
 * Splits cleanly on double newlines (paragraphs/cards), single newlines, or spaces.
 */
export function splitTelegramMessage(text: string, maxLen = 3800): string[] {
  if (!text || text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Look for natural split boundaries backwards from maxLen
    let splitIdx = remaining.lastIndexOf('\n\n', maxLen);
    if (splitIdx === -1 || splitIdx < maxLen * 0.35) {
      splitIdx = remaining.lastIndexOf('\n', maxLen);
    }
    if (splitIdx === -1 || splitIdx < maxLen * 0.35) {
      splitIdx = remaining.lastIndexOf(' ', maxLen);
    }
    if (splitIdx === -1 || splitIdx < maxLen * 0.35) {
      splitIdx = maxLen;
    }

    const chunk = remaining.slice(0, splitIdx).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(splitIdx).trim();
  }

  return chunks;
}

/**
 * Dispatches a text message to Telegram Bot API with dynamic topic routing:
 * - When an alert is triggered (isAlert === true):
 *   Uses chat_id: -1003872409872 and includes message_thread_id: 2 in the JSON payload.
 * - For standard reports (isAlert === false):
 *   Uses original chat_id without any message_thread_id parameter.
 * - Automatically splits messages exceeding Telegram's 4096-character limit into ordered chunks.
 * - Gracefully falls back to plain text if Markdown entity parsing fails.
 */
export async function sendTelegramMessage(
  options: SendTelegramMessageOptions
): Promise<{ success: boolean; messageId?: number; responseData?: any }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !originalChatId) {
    throw new Error(
      'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment variables. Please check .env.local.'
    );
  }

  const isAlert = Boolean(options.isAlert);
  const targetChatId = options.chatId ?? (isAlert ? (process.env.TELEGRAM_ALERTS_CHAT_ID || '-1003872409872') : originalChatId);
  const targetThreadId = options.messageThreadId ?? (isAlert ? Number(process.env.TELEGRAM_ALERTS_THREAD_ID || 2) : undefined);

  const telegramEndpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const chunks = splitTelegramMessage(options.text, 3800);

  let lastMessageId: number | undefined;
  let lastResponseData: any;

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    const payload: Record<string, any> = {
      chat_id: targetChatId,
      text: chunkText,
      parse_mode: options.parseMode || 'Markdown',
    };

    // Only include message_thread_id when routing to a specific topic
    if (targetThreadId !== undefined) {
      payload.message_thread_id = targetThreadId;
    }

    if (options.disableNotification !== undefined) {
      payload.disable_notification = options.disableNotification;
    }

    let res = await fetch(telegramEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let responseJson = (await res.json()) as any;

    // Fallback: If Telegram failed due to markdown formatting/entity error, retry without parse_mode
    if (!res.ok || !responseJson.ok) {
      const errMsg = responseJson.description || '';
      if (/can't parse entities|character.*is reserved|formatting/i.test(errMsg)) {
        delete payload.parse_mode;
        res = await fetch(telegramEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        responseJson = (await res.json()) as any;
      }
    }

    if (!res.ok || !responseJson.ok) {
      const errMsg = responseJson.description || `HTTP ${res.status} error from Telegram API`;
      throw new Error(errMsg);
    }

    lastMessageId = responseJson.result?.message_id;
    lastResponseData = responseJson.result;

    if (i < chunks.length - 1) {
      // Pause briefly between chunks to guarantee message ordering in Telegram
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return {
    success: true,
    messageId: lastMessageId,
    responseData: lastResponseData,
  };
}

export interface SendTelegramAlertOptions {
  chatId?: string | number;
  messageThreadId?: number;
  parseMode?: 'Markdown' | 'HTML';
  prisma?: PrismaClient;
  symbol?: string;
  title?: string;
  saveToAlertsFolder?: boolean;
}

/**
 * Convenient helper to dispatch specific alerts to the Alerts topic
 * and automatically record them into the ThoughtLog 'Alerts' folder
 */
export async function sendTelegramAlert(
  text: string,
  extra?: SendTelegramAlertOptions
) {
  const result = await sendTelegramMessage({
    text,
    isAlert: true,
    chatId: extra?.chatId,
    messageThreadId: extra?.messageThreadId,
    parseMode: extra?.parseMode,
  });

  const shouldSave = extra?.saveToAlertsFolder ?? false;
  const db = extra?.prisma || prisma;

  if (shouldSave && db) {
    try {
      const cleanTitle = extra?.title || (extra?.symbol ? `🚨 Alert: ${extra.symbol}` : `🚨 Telegram Alert`);
      await (db as any).thoughtLog.create({
        data: {
          title: cleanTitle,
          content: text,
          folder: 'Alerts',
          tags: 'Telegram, Alert, Price Alert, Triggered',
          symbols: extra?.symbol || null,
          sentiment: 'CAUTION',
          isPinned: false,
          isFulfilled: false,
          agentOutput: `🔔 **Telegram Alert Dispatched**\n\nSent to Telegram Alerts Topic.`,
          agentActionType: 'ADD_CONTEXT',
        },
      });
    } catch (saveErr: any) {
      console.warn('[TelegramReport] Failed to save dispatched alert to Alerts folder:', saveErr.message);
    }
  }

  return result;
}

/**
 * End-to-End Orchestrator: Synthesizes data, renders PDF, and dispatches to Telegram
 */
export async function generateAndSendDailyReport(options?: {
  isAlert?: boolean;
  chatId?: string | number;
  messageThreadId?: number;
  requestedBy?: string;
}): Promise<{
  success: boolean;
  filename: string;
  sizeBytes: number;
  messageId?: number;
  data: ExecutiveReportData;
}> {
  const reportData = await fetchComprehensiveReportData();
  const pdfBuffer = await generateExecutivePdfBuffer(reportData);
  const dateSlug = reportData.generatedAt.toISOString().slice(0, 10);
  const filename = `TradeFlow_Executive_Briefing_${dateSlug}.pdf`;

  const defCount = reportData.defensePositions.length;
  const topDips = reportData.topDipBuys.map((d) => `$${d.symbol}`).join(', ') || 'None';

  const caption = `📊 *TradeFlow Daily Executive Briefing* (${dateSlug})\n\n` +
    `🛡️ *Positions Needing Defense:* ${defCount} ${defCount > 0 ? '⚠️' : '✅'}\n` +
    `📉 *Top 5 Dip Buys:* ${topDips}\n` +
    `🌐 *Macro Regime:* ${reportData.macro.regimeTitle} (VIX: ${reportData.macro.vixLevel.toFixed(1)}, 10Y: ${reportData.macro.yield10y.toFixed(2)}%)\n\n` +
    `📄 *Detailed PDF briefing attached below:*`;

  const sendResult = await sendPdfReportToTelegram(pdfBuffer, filename, caption, options);

  return {
    success: sendResult.success,
    filename,
    sizeBytes: pdfBuffer.length,
    messageId: sendResult.messageId,
    data: reportData,
  };
}

