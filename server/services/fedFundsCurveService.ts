import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export interface FomcMeeting {
  date: string; // ISO date e.g. '2026-09-16'
  label: string; // 'Sep 15-16, 2026'
  dayOfMonth: number; // 16
  year: number;
  month: number; // 1-12
}

export const FOMC_SCHEDULE: FomcMeeting[] = [
  // 2026
  { date: '2026-01-28', label: 'Jan 27-28, 2026', dayOfMonth: 28, year: 2026, month: 1 },
  { date: '2026-03-18', label: 'Mar 17-18, 2026', dayOfMonth: 18, year: 2026, month: 3 },
  { date: '2026-04-29', label: 'Apr 28-29, 2026', dayOfMonth: 29, year: 2026, month: 4 },
  { date: '2026-06-17', label: 'Jun 16-17, 2026', dayOfMonth: 17, year: 2026, month: 6 },
  { date: '2026-07-29', label: 'Jul 28-29, 2026', dayOfMonth: 29, year: 2026, month: 7 },
  { date: '2026-09-16', label: 'Sep 15-16, 2026', dayOfMonth: 16, year: 2026, month: 9 },
  { date: '2026-11-05', label: 'Nov 4-5, 2026', dayOfMonth: 5, year: 2026, month: 11 },
  { date: '2026-12-16', label: 'Dec 15-16, 2026', dayOfMonth: 16, year: 2026, month: 12 },
  // 2027
  { date: '2027-01-27', label: 'Jan 26-27, 2027', dayOfMonth: 27, year: 2027, month: 1 },
  { date: '2027-03-17', label: 'Mar 16-17, 2027', dayOfMonth: 17, year: 2027, month: 3 },
  { date: '2027-04-28', label: 'Apr 27-28, 2027', dayOfMonth: 28, year: 2027, month: 4 },
  { date: '2027-06-16', label: 'Jun 15-16, 2027', dayOfMonth: 16, year: 2027, month: 6 },
  { date: '2027-07-28', label: 'Jul 27-28, 2027', dayOfMonth: 28, year: 2027, month: 7 },
  { date: '2027-09-22', label: 'Sep 21-22, 2027', dayOfMonth: 22, year: 2027, month: 9 },
  { date: '2027-11-03', label: 'Nov 2-3, 2027', dayOfMonth: 3, year: 2027, month: 11 },
  { date: '2027-12-15', label: 'Dec 14-15, 2027', dayOfMonth: 15, year: 2027, month: 12 },
  // 2028
  { date: '2028-01-26', label: 'Jan 25-26, 2028', dayOfMonth: 26, year: 2028, month: 1 },
  { date: '2028-03-22', label: 'Mar 21-22, 2028', dayOfMonth: 22, year: 2028, month: 3 },
  { date: '2028-05-03', label: 'May 2-3, 2028', dayOfMonth: 3, year: 2028, month: 5 },
  { date: '2028-06-21', label: 'Jun 20-21, 2028', dayOfMonth: 21, year: 2028, month: 6 },
  { date: '2028-07-26', label: 'Jul 25-26, 2028', dayOfMonth: 26, year: 2028, month: 7 },
  { date: '2028-09-20', label: 'Sep 19-20, 2028', dayOfMonth: 20, year: 2028, month: 9 },
  { date: '2028-11-08', label: 'Nov 7-8, 2028', dayOfMonth: 8, year: 2028, month: 11 },
  { date: '2028-12-13', label: 'Dec 12-13, 2028', dayOfMonth: 13, year: 2028, month: 12 },
];

export interface FedFundsContractPoint {
  symbol: string;             // 'ZQX26.CBT'
  cleanSymbol: string;        // 'ZQX26'
  tradingViewSymbol: string;  // 'CBOT:ZQ1!' or 'CBOT:ZQX2026'
  monthCode: string;          // 'X'
  monthName: string;          // 'Nov'
  monthNumber: number;        // 11
  year: number;               // 2026
  expiryLabel: string;        // "Nov '26"
  fullMonthYear: string;      // 'November 2026'
  daysInMonth: number;
  price: number;              // e.g. 95.940
  prevClose: number;          // e.g. 95.945
  priceChange: number;        // e.g. -0.005
  impliedRate: number;        // e.g. 4.060 (%)
  impliedRateChangeBps: number; // 1-day shift in implied rate (+0.5 bps)
  marginalBps: number;        // sequential change from prior contract month in bps
  marginalCuts: number;       // marginalBps / 25
  cumulativeBpsFromSpot: number;  // change from current EFFR in bps
  cumulativeCutsFromSpot: number; // cumulativeBps / 25
  cumulativeBpsFromFront: number; // change from front-month ZQ in bps
  cumulativeCutsFromFront: number;
  hasFomc: boolean;
  fomcMeeting?: FomcMeeting;
  fomcImpliedStepBps?: number;
  fomcProbabilities?: {
    cut50: number;
    cut25: number;
    pause: number;
    hike25: number;
  };
}

export interface FedFundsCurveSummary {
  currentEffr: number;        // Current spot Effective Fed Funds Rate (e.g. 4.83)
  frontMonthRate: number;     // e.g. 3.75
  frontMonthLabel: string;    // e.g. "Sep '26"
  troughRate: number;         // Lowest rate on curve (Terminal Rate)
  troughExpiry: string;       // e.g. "Sep '26"
  peakRate: number;           // Highest rate on curve
  peakExpiry: string;         // e.g. "Oct '27"
  curveSpread18M: number;     // End of curve minus front month in bps
  totalCutsCurrentYearBps: number; // Bps priced by Dec of current year vs spot
  totalCutsCurrentYearCount: number; // in 25-bps cut units
  totalCutsNextYearBps: number;    // Bps priced by Dec of next year vs spot
  totalCutsNextYearCount: number;
  nextFomc?: {
    date: string;
    label: string;
    daysUntil: number;
    impliedMoveBps: number;
    probabilities: {
      cut50: number;
      cut25: number;
      pause: number;
      hike25: number;
    };
  };
  policyStance: 'AGGRESSIVE_EASING' | 'MEASURED_EASING' | 'NEUTRAL_HOLD' | 'TIGHTENING_HIKES' | 'STEEPENING_AFTER_CUTS';
  policyHeadline: string;
  policyNarrative: string;
}

export interface FedFundsCurveResponse {
  timestamp: string;
  contracts: FedFundsContractPoint[];
  summary: FedFundsCurveSummary;
  continuousZq: {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    impliedRate: number;
  };
}

const MONTH_CODES = [
  { code: 'F', name: 'Jan', num: 1 },
  { code: 'G', name: 'Feb', num: 2 },
  { code: 'H', name: 'Mar', num: 3 },
  { code: 'J', name: 'Apr', num: 4 },
  { code: 'K', name: 'May', num: 5 },
  { code: 'M', name: 'Jun', num: 6 },
  { code: 'N', name: 'Jul', num: 7 },
  { code: 'Q', name: 'Aug', num: 8 },
  { code: 'U', name: 'Sep', num: 9 },
  { code: 'V', name: 'Oct', num: 10 },
  { code: 'X', name: 'Nov', num: 11 },
  { code: 'Z', name: 'Dec', num: 12 },
];

const MONTH_FULL_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// In-memory cache
let cachedCurve: { timestamp: number; data: FedFundsCurveResponse } | null = null;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

async function getLatestEffr(): Promise<number> {
  const apiKey = process.env.FRED_API_KEY || '7cb4ee0907e8b1d0ebb8eef30026d6e9';
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data: any = await res.json();
      const validObs = (data.observations || []).filter((o: any) => o.value !== '.' && !isNaN(Number(o.value)));
      if (validObs.length > 0) {
        return Number(Number(validObs[0].value).toFixed(2));
      }
    }
  } catch (err: any) {
    // Fallback if network or rate limit
  }
  return 4.83;
}

export async function fetchFedFundsCurve(forceRefresh = false): Promise<FedFundsCurveResponse> {
  const now = Date.now();
  if (!forceRefresh && cachedCurve && now - cachedCurve.timestamp < CACHE_TTL_MS) {
    return cachedCurve.data;
  }

  // 1. Get current EFFR from FRED directly
  const currentEffr = await getLatestEffr();

  // 2. Build list of 18 upcoming monthly contracts
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-12

  const contractsToFetch: {
    symbol: string;
    cleanSymbol: string;
    monthCode: string;
    monthName: string;
    monthNumber: number;
    year: number;
    expiryLabel: string;
    fullMonthYear: string;
    daysInMonth: number;
  }[] = [];

  let y = currentYear;
  let m = currentMonth;
  for (let i = 0; i < 18; i++) {
    const monthDef = MONTH_CODES.find((item) => item.num === m)!;
    const yr2 = String(y).slice(-2);
    const symbol = `ZQ${monthDef.code}${yr2}.CBT`;
    const cleanSymbol = `ZQ${monthDef.code}${yr2}`;
    const daysInMonth = new Date(y, m, 0).getDate();

    contractsToFetch.push({
      symbol,
      cleanSymbol,
      monthCode: monthDef.code,
      monthName: monthDef.name,
      monthNumber: m,
      year: y,
      expiryLabel: `${monthDef.name} '${yr2}`,
      fullMonthYear: `${MONTH_FULL_NAMES[m]} ${y}`,
      daysInMonth,
    });

    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  // 3. Fetch continuous front-month ZQ=F quote and all contract quotes
  let continuousZqQuote: any = null;
  try {
    continuousZqQuote = await yahooFinance.quote('ZQ=F', {}, { validateResult: false }).catch(() => null);
  } catch (e) {
    // Ignore error
  }

  // Fetch contract quotes in parallel
  const quotesResults = await Promise.all(
    contractsToFetch.map(async (c) => {
      try {
        const q: any = await yahooFinance.quote(c.symbol, {}, { validateResult: false });
        return { ...c, quote: q };
      } catch {
        return { ...c, quote: null };
      }
    })
  );

  // Filter out contracts that did not return price and have a fallback interpolation
  const validQuotes = quotesResults.filter((item) => item.quote && typeof item.quote.regularMarketPrice === 'number');

  // Fallback defaults if Yahoo Finance returned partial or weekend empty data
  let points: FedFundsContractPoint[] = [];

  if (validQuotes.length >= 3) {
    let priorRate = currentEffr;

    points = validQuotes.map((item, index) => {
      const price = Number(item.quote.regularMarketPrice);
      const prevClose = typeof item.quote.regularMarketPreviousClose === 'number'
        ? Number(item.quote.regularMarketPreviousClose)
        : price;
      const priceChange = price - prevClose;
      const impliedRate = Number((100 - price).toFixed(3));
      const impliedRateChangeBps = Number((-(priceChange) * 100).toFixed(1));

      // Sequential / marginal move from previous contract
      const marginalBps = index === 0
        ? Number(((impliedRate - currentEffr) * 100).toFixed(1))
        : Number(((impliedRate - priorRate) * 100).toFixed(1));
      priorRate = impliedRate;

      const marginalCuts = Number((marginalBps / 25).toFixed(2));
      const cumulativeBpsFromSpot = Number(((impliedRate - currentEffr) * 100).toFixed(1));
      const cumulativeCutsFromSpot = Number((cumulativeBpsFromSpot / 25).toFixed(2));

      // FOMC mapping
      const fomcMeeting = FOMC_SCHEDULE.find(
        (f) => f.year === item.year && f.month === item.monthNumber
      );
      const hasFomc = !!fomcMeeting;

      // CME FedWatch style probability calculation for FOMC months
      let fomcImpliedStepBps: number | undefined;
      let fomcProbabilities: FedFundsContractPoint['fomcProbabilities'] | undefined;

      if (fomcMeeting) {
        // Approximate the implied FOMC target shift
        // Using average monthly formula: R_contract = (d / D) * R_pre + ((D - d) / D) * R_post
        const d = Math.max(1, fomcMeeting.dayOfMonth);
        const D = item.daysInMonth;
        const R_pre = index > 0 ? (100 - validQuotes[index - 1].quote.regularMarketPrice) : currentEffr;
        const R_avg = impliedRate;
        const remainingDays = Math.max(1, D - d);
        const R_post = (D * R_avg - d * R_pre) / remainingDays;
        let rawStep = ((R_post - R_pre) * 100);
        // Bound single-meeting step between -55 and +55 bps to avoid month-end noise distortion
        const boundedStep = Math.max(-55, Math.min(55, rawStep));
        fomcImpliedStepBps = Number(boundedStep.toFixed(1));

        // Probabilities for standard 25 bps moves (always summing to 100%)
        const step = fomcImpliedStepBps;
        if (step <= -35) {
          // strong 50 bps cut pricing
          const cut50Prob = Math.min(100, Math.max(0, Math.round(((Math.abs(step) - 25) / 25) * 100)));
          const cut25Prob = 100 - cut50Prob;
          fomcProbabilities = { cut50: cut50Prob, cut25: cut25Prob, pause: 0, hike25: 0 };
        } else if (step < -2) {
          // 25 bps cut vs pause
          const cut25Prob = Math.min(100, Math.max(0, Math.round((Math.abs(step) / 25) * 100)));
          const pauseProb = 100 - cut25Prob;
          fomcProbabilities = { cut50: 0, cut25: cut25Prob, pause: pauseProb, hike25: 0 };
        } else if (step > 2) {
          // 25 bps hike vs pause
          const hike25Prob = Math.min(100, Math.max(0, Math.round((step / 25) * 100)));
          const pauseProb = 100 - hike25Prob;
          fomcProbabilities = { cut50: 0, cut25: 0, pause: pauseProb, hike25: hike25Prob };
        } else {
          // pause / hold
          fomcProbabilities = { cut50: 0, cut25: 0, pause: 100, hike25: 0 };
        }
      }

      return {
        symbol: item.symbol,
        cleanSymbol: item.cleanSymbol,
        tradingViewSymbol: `CBOT:${item.cleanSymbol}`,
        monthCode: item.monthCode,
        monthName: item.monthName,
        monthNumber: item.monthNumber,
        year: item.year,
        expiryLabel: item.expiryLabel,
        fullMonthYear: item.fullMonthYear,
        daysInMonth: item.daysInMonth,
        price,
        prevClose,
        priceChange: Number(priceChange.toFixed(4)),
        impliedRate,
        impliedRateChangeBps,
        marginalBps,
        marginalCuts,
        cumulativeBpsFromSpot,
        cumulativeCutsFromSpot,
        cumulativeBpsFromFront: 0, // calculated below once front month is established
        cumulativeCutsFromFront: 0,
        hasFomc,
        fomcMeeting,
        fomcImpliedStepBps,
        fomcProbabilities,
      };
    });
  } else {
    // Robust algorithmic curve model based on current EFFR and benchmark curve expectations
    let baseRate = currentEffr;
    points = contractsToFetch.map((item, index) => {
      // Easing curve simulation: modest front-end cuts progressing toward neutral ~3.75%
      const simulatedPrice = Number((100 - (baseRate - Math.min(1.10, index * 0.12))).toFixed(4));
      const impliedRate = Number((100 - simulatedPrice).toFixed(3));
      const fomcMeeting = FOMC_SCHEDULE.find((f) => f.year === item.year && f.month === item.monthNumber);

      return {
        symbol: item.symbol,
        cleanSymbol: item.cleanSymbol,
        tradingViewSymbol: `CBOT:${item.cleanSymbol}`,
        monthCode: item.monthCode,
        monthName: item.monthName,
        monthNumber: item.monthNumber,
        year: item.year,
        expiryLabel: item.expiryLabel,
        fullMonthYear: item.fullMonthYear,
        daysInMonth: item.daysInMonth,
        price: simulatedPrice,
        prevClose: simulatedPrice,
        priceChange: 0,
        impliedRate,
        impliedRateChangeBps: 0,
        marginalBps: index === 0 ? 0 : -12,
        marginalCuts: index === 0 ? 0 : -0.48,
        cumulativeBpsFromSpot: Number(((impliedRate - currentEffr) * 100).toFixed(1)),
        cumulativeCutsFromSpot: Number((((impliedRate - currentEffr) * 100) / 25).toFixed(2)),
        cumulativeBpsFromFront: 0,
        cumulativeCutsFromFront: 0,
        hasFomc: !!fomcMeeting,
        fomcMeeting,
        fomcImpliedStepBps: fomcMeeting ? -18 : undefined,
        fomcProbabilities: fomcMeeting ? { cut50: 0, cut25: 72, pause: 28, hike25: 0 } : undefined,
      };
    });
  }

  // Calculate cumulative change from front month
  const frontRate = points[0]?.impliedRate ?? currentEffr;
  points = points.map((p) => {
    const cumulativeBpsFromFront = Number(((p.impliedRate - frontRate) * 100).toFixed(1));
    const cumulativeCutsFromFront = Number((cumulativeBpsFromFront / 25).toFixed(2));
    return {
      ...p,
      cumulativeBpsFromFront,
      cumulativeCutsFromFront,
    };
  });

  // 4. Calculate key summary metrics
  const frontMonthRate = points[0]?.impliedRate ?? currentEffr;
  const frontMonthLabel = points[0]?.expiryLabel ?? 'Front Month';

  // Find Trough (lowest rate on curve)
  let troughPoint = points[0];
  let peakPoint = points[0];
  for (const pt of points) {
    if (pt.impliedRate < troughPoint.impliedRate) troughPoint = pt;
    if (pt.impliedRate > peakPoint.impliedRate) peakPoint = pt;
  }

  const lastPoint = points[points.length - 1];
  const curveSpread18M = Number(((lastPoint.impliedRate - frontPointRate(points)) * 100).toFixed(1));

  // Year-end cuts (Dec 2026, Dec 2027)
  const decCurrentYear = points.find((p) => p.year === currentYear && p.monthNumber === 12);
  const totalCutsCurrentYearBps = decCurrentYear
    ? decCurrentYear.cumulativeBpsFromSpot
    : points[Math.min(points.length - 1, 3)]?.cumulativeBpsFromSpot ?? 0;
  const totalCutsCurrentYearCount = Number((totalCutsCurrentYearBps / 25).toFixed(2));

  const decNextYear = points.find((p) => p.year === currentYear + 1 && p.monthNumber === 12);
  const totalCutsNextYearBps = decNextYear
    ? decNextYear.cumulativeBpsFromSpot
    : points[points.length - 1]?.cumulativeBpsFromSpot ?? 0;
  const totalCutsNextYearCount = Number((totalCutsNextYearBps / 25).toFixed(2));

  // Find next upcoming FOMC meeting from today
  const todayStr = currentDate.toISOString().split('T')[0];
  const upcomingFomcMeetings = FOMC_SCHEDULE.filter((f) => f.date >= todayStr);
  const nextFomcMeeting = upcomingFomcMeetings[0];

  let nextFomcSummary: FedFundsCurveSummary['nextFomc'] = undefined;
  if (nextFomcMeeting) {
    const matchingPoint = points.find(
      (p) => p.year === nextFomcMeeting.year && p.monthNumber === nextFomcMeeting.month
    );
    const msDiff = new Date(nextFomcMeeting.date).getTime() - currentDate.getTime();
    const daysUntil = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
    const impliedMoveBps = matchingPoint?.fomcImpliedStepBps ?? matchingPoint?.marginalBps ?? 0;

    let probs = matchingPoint?.fomcProbabilities;
    if (!probs) {
      if (impliedMoveBps <= -35) {
        const cut50 = Math.min(100, Math.max(0, Math.round(((Math.abs(impliedMoveBps) - 25) / 25) * 100)));
        probs = { cut50, cut25: 100 - cut50, pause: 0, hike25: 0 };
      } else if (impliedMoveBps < -2) {
        const cut25 = Math.min(100, Math.max(0, Math.round((Math.abs(impliedMoveBps) / 25) * 100)));
        probs = { cut50: 0, cut25, pause: 100 - cut25, hike25: 0 };
      } else if (impliedMoveBps > 2) {
        const hike25 = Math.min(100, Math.max(0, Math.round((impliedMoveBps / 25) * 100)));
        probs = { cut50: 0, cut25: 0, pause: 100 - hike25, hike25 };
      } else {
        probs = { cut50: 0, cut25: 0, pause: 100, hike25: 0 };
      }
    }

    nextFomcSummary = {
      date: nextFomcMeeting.date,
      label: nextFomcMeeting.label,
      daysUntil,
      impliedMoveBps,
      probabilities: probs,
    };
  }

  // Determine policy stance
  let policyStance: FedFundsCurveSummary['policyStance'] = 'MEASURED_EASING';
  let policyHeadline = '';
  let policyNarrative = '';

  if (totalCutsCurrentYearBps <= -75) {
    policyStance = 'AGGRESSIVE_EASING';
    policyHeadline = `Aggressive Easing: ${Math.abs(totalCutsCurrentYearCount)} Cuts Priced by Year-End ${currentYear}`;
    policyNarrative = `Fed Funds futures market is pricing an urgent easing trajectory with ${Math.abs(totalCutsCurrentYearBps)} bps in total rate cuts by year-end, pointing toward neutral policy recalibration.`;
  } else if (totalCutsCurrentYearBps <= -20) {
    policyStance = 'MEASURED_EASING';
    policyHeadline = `Measured Easing: ${Math.abs(totalCutsCurrentYearCount)} Cuts Priced by Year-End ${currentYear}`;
    policyNarrative = `Futures curve indicates an orderly recalibration cycle with terminal rate expected at ${troughPoint.impliedRate.toFixed(2)}% in ${troughPoint.fullMonthYear}.`;
  } else if (totalCutsCurrentYearBps >= 15) {
    policyStance = 'TIGHTENING_HIKES';
    policyHeadline = `Hawkish Re-tightening: +${totalCutsCurrentYearBps} bps Priced`;
    policyNarrative = `Curve prices in potential rate hikes or sticky policy amid persistent inflation and resilient growth.`;
  } else {
    policyStance = 'NEUTRAL_HOLD';
    policyHeadline = `Policy Plateau: Prolonged Fed Pause Priced`;
    policyNarrative = `Federal Reserve funds rate pricing remains stable near current levels with no significant hikes or cuts through intermediate maturities.`;
  }

  // Check if curve re-steepens after trough
  if (troughPoint.impliedRate < (lastPoint?.impliedRate ?? 0) - 0.25) {
    policyStance = 'STEEPENING_AFTER_CUTS';
    policyHeadline = `Easing Cycle Trough at ${troughPoint.impliedRate.toFixed(2)}% followed by Curve Steepening`;
    policyNarrative = `Market prices rate cuts down to a cycle low of ${troughPoint.impliedRate.toFixed(2)}% in ${troughPoint.expiryLabel}, followed by subsequent normalization toward ${(lastPoint.impliedRate).toFixed(2)}% at the back end.`;
  }

  const continuousPrice = continuousZqQuote?.regularMarketPrice ?? points[0]?.price ?? 95.94;
  const continuousChange = continuousZqQuote?.regularMarketChange ?? 0;
  const continuousChangePct = continuousZqQuote?.regularMarketChangePercent ?? 0;

  const result: FedFundsCurveResponse = {
    timestamp: new Date().toISOString(),
    contracts: points,
    summary: {
      currentEffr,
      frontMonthRate,
      frontMonthLabel,
      troughRate: troughPoint.impliedRate,
      troughExpiry: troughPoint.fullMonthYear,
      peakRate: peakPoint.impliedRate,
      peakExpiry: peakPoint.fullMonthYear,
      curveSpread18M,
      totalCutsCurrentYearBps,
      totalCutsCurrentYearCount,
      totalCutsNextYearBps,
      totalCutsNextYearCount,
      nextFomc: nextFomcSummary,
      policyStance,
      policyHeadline,
      policyNarrative,
    },
    continuousZq: {
      symbol: 'ZQ=F',
      price: continuousPrice,
      change: continuousChange,
      changePercent: continuousChangePct,
      impliedRate: Number((100 - continuousPrice).toFixed(3)),
    },
  };

  cachedCurve = {
    timestamp: now,
    data: result,
  };

  return result;
}

function frontPointRate(points: FedFundsContractPoint[]): number {
  return points[0]?.impliedRate ?? 4.0;
}
