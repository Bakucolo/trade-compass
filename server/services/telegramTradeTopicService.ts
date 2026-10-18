import { PrismaClient } from '@prisma/client';
import { sendTelegramMessage } from './telegramReportService';
import { optionsChainService, OptionsChainData, OptionContractRow, StrikeMatrixRow, ExpirationMeta } from './optionsChainService';
import { generateTextCompletion } from './llmFallbackRouter';
import { isTopicHelpRequest, getTradeTopicHelp } from './telegramTopicHelpService';

const logToFile = (msg: string) => {
  try {
    console.log(msg);
  } catch {}
};

export interface TradeTopicRequest {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma: PrismaClient;
  senderLabel?: string;
  timestamp?: number;
}

export type TradeTopicAction =
  | 'ANALYZE_TRADE'
  | 'VIEW_HISTORY'
  | 'HELP'
  | 'UNKNOWN';

export type TradeObjective = 'INCOME' | 'ASSIGNMENT' | 'BALANCED';

export interface ParsedOptionTradeQuery {
  raw: string;
  symbol: string;
  optionType: 'PUT' | 'CALL';
  side: 'SELL' | 'BUY';
  targetStrike?: number;
  targetDte?: number;
  targetExpirationDate?: string; // e.g. "2027-02-19" or "2027-02"
  targetMonth?: number; // 1-12
  targetYear?: number;
  rawDateText?: string;
  isAiRequested: boolean;
  objective: TradeObjective;
  isHelp: boolean;
  isViewHistory: boolean;
}

export interface StrikeComparisonItem {
  strike: number;
  delta: number;
  bid: number;
  ask: number;
  mid: number;
  theta: number;
  iv: number;
  openInterest: number;
  premiumPerContract: number;
  collateral: number;
  bufferPct: number;
  breakeven: number;
  annualizedReturn: number;
  pop: number;
  isTarget: boolean;
}

export interface TradeAnalysisResult {
  symbol: string;
  companyName: string;
  spotPrice: number;
  spotChange: number;
  spotChangePercent: number;
  selectedExpiration: string;
  selectedDte: number;
  targetStrike: number;
  optionType: 'PUT' | 'CALL';
  side: 'SELL' | 'BUY';
  targetMetrics: StrikeComparisonItem;
  strikesMatrix: StrikeComparisonItem[];
  aiAnalysis?: string;
  formattedMessage: string;
}

export interface ParsedDateOrDteResult {
  targetDte?: number;
  targetExpirationDate?: string;
  targetMonth?: number;
  targetYear?: number;
  rawMatchedText?: string;
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_NAMES_REGEX = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

/**
 * Extracts target expiration dates and DTE from free-form user queries:
 * Supports:
 * - "19 February 2027", "19th Feb 2027", "19 Feb"
 * - "February 19 2027", "Feb 19 2027", "Feb 19"
 * - "2027-02-19", "2027/02/19", "19/02/2027", "02/19/2027"
 * - "Feb 2027", "February 2027", "Nov 2026"
 * - "126 dte", "126dte", "126 days", "dte 126", "126d"
 */
export function parseTargetDateOrDte(text: string): ParsedDateOrDteResult {
  const result: ParsedDateOrDteResult = {};
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // 1. Explicit DTE pattern (e.g. "126 dte", "126dte", "126 days", "dte: 126", "dte 126", "126d")
  // Note: Avoid matching "expiry 19 Feb 2027" as DTE 19 by ensuring it is not followed by month
  const dteMatch = text.match(/(?:(?:target\s*)?dte|days?\s*(?:to\s*exp(?:iration)?)?)\s*[:=]?\s*(\d{1,4})\b/i)
    || text.match(/\b(\d{1,4})\s*(?:dte|days?|d\b)/i);
  if (dteMatch) {
    result.targetDte = parseInt(dteMatch[1], 10);
    result.rawMatchedText = dteMatch[0];
    return result;
  }

  // 2. ISO Date (e.g. "2027-02-19", "2027/02/19", "2027.02.19")
  const isoMatch = text.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    result.targetExpirationDate = dateStr;
    result.targetYear = y;
    result.targetMonth = m;
    result.targetDte = Math.max(0, Math.ceil((new Date(y, m - 1, d).getTime() - Date.now()) / 86400000));
    result.rawMatchedText = isoMatch[0];
    return result;
  }

  // 3. Day Month Year (e.g. "19 February 2027", "19th of Feb 2027", "19 Feb", "19th February")
  const dayMonthMatch = text.match(new RegExp(`\\b(0?[1-9]|[12]\\d|3[01])(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${MONTH_NAMES_REGEX})(?:\\s*,?\\s*(20\\d{2}))?\\b`, 'i'));
  if (dayMonthMatch) {
    const d = parseInt(dayMonthMatch[1], 10);
    const mKey = dayMonthMatch[2].toLowerCase();
    const m = MONTH_MAP[mKey] || 1;
    let y = dayMonthMatch[3] ? parseInt(dayMonthMatch[3], 10) : undefined;
    if (!y) {
      // If month/day has already passed this calendar year, roll to next year
      const testDate = new Date(currentYear, m - 1, d);
      y = (testDate.getTime() < Date.now() - 86400000) ? currentYear + 1 : currentYear;
    }
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    result.targetExpirationDate = dateStr;
    result.targetYear = y;
    result.targetMonth = m;
    result.targetDte = Math.max(0, Math.ceil((new Date(y, m - 1, d).getTime() - Date.now()) / 86400000));
    result.rawMatchedText = dayMonthMatch[0];
    return result;
  }

  // 4. Month Day Year (e.g. "February 19 2027", "Feb 19 2027", "Feb 19", "February 19th")
  const monthDayMatch = text.match(new RegExp(`\\b(${MONTH_NAMES_REGEX})\\s+(0?[1-9]|[12]\\d|3[01])(?:st|nd|rd|th)?(?:\\s*,?\\s*(20\\d{2}))?\\b`, 'i'));
  if (monthDayMatch) {
    const mKey = monthDayMatch[1].toLowerCase();
    const m = MONTH_MAP[mKey] || 1;
    const d = parseInt(monthDayMatch[2], 10);
    let y = monthDayMatch[3] ? parseInt(monthDayMatch[3], 10) : undefined;
    if (!y) {
      const testDate = new Date(currentYear, m - 1, d);
      y = (testDate.getTime() < Date.now() - 86400000) ? currentYear + 1 : currentYear;
    }
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    result.targetExpirationDate = dateStr;
    result.targetYear = y;
    result.targetMonth = m;
    result.targetDte = Math.max(0, Math.ceil((new Date(y, m - 1, d).getTime() - Date.now()) / 86400000));
    result.rawMatchedText = monthDayMatch[0];
    return result;
  }

  // 5. Day/Month/Year or Month/Day/Year (e.g. "19/02/2027", "19-02-2027")
  const slashDateMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (slashDateMatch) {
    const p1 = parseInt(slashDateMatch[1], 10);
    const p2 = parseInt(slashDateMatch[2], 10);
    const y = parseInt(slashDateMatch[3], 10);
    const d = p1 > 12 ? p1 : (p2 > 12 ? p2 : p1);
    const m = p1 > 12 ? p2 : (p2 > 12 ? p1 : p2);
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    result.targetExpirationDate = dateStr;
    result.targetYear = y;
    result.targetMonth = m;
    result.targetDte = Math.max(0, Math.ceil((new Date(y, m - 1, d).getTime() - Date.now()) / 86400000));
    result.rawMatchedText = slashDateMatch[0];
    return result;
  }

  // 6. Month + Year only (e.g. "Feb 2027", "February 2027", "Nov 2026", "December 2026")
  const monthYearMatch = text.match(new RegExp(`\\b(${MONTH_NAMES_REGEX})\\s*,?\\s*(20\\d{2})\\b`, 'i'));
  if (monthYearMatch) {
    const mKey = monthYearMatch[1].toLowerCase();
    const m = MONTH_MAP[mKey] || 1;
    const y = parseInt(monthYearMatch[2], 10);
    result.targetYear = y;
    result.targetMonth = m;
    result.targetExpirationDate = `${y}-${String(m).padStart(2, '0')}`;
    const approxDate = new Date(y, m - 1, 19);
    result.targetDte = Math.max(0, Math.ceil((approxDate.getTime() - Date.now()) / 86400000));
    result.rawMatchedText = monthYearMatch[0];
    return result;
  }

  // 7. Full month name only (e.g. "in November", "for February", "expiring March", or standalone "February")
  const fullMonthMatch = text.match(/\b(?:in|for|expiring|exp)?\s*(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
  if (fullMonthMatch) {
    const mKey = fullMonthMatch[1].toLowerCase();
    const m = MONTH_MAP[mKey] || 1;
    const y = m < currentMonth ? currentYear + 1 : currentYear;
    result.targetYear = y;
    result.targetMonth = m;
    result.targetExpirationDate = `${y}-${String(m).padStart(2, '0')}`;
    const approxDate = new Date(y, m - 1, 19);
    result.targetDte = Math.max(0, Math.ceil((approxDate.getTime() - Date.now()) / 86400000));
    result.rawMatchedText = fullMonthMatch[0];
    return result;
  }

  return result;
}

/**
 * Parses user input for options trade inquiries:
 * Handles natural strings like:
 * - "AAPL short put 300"
 * - "AAPL 300 put"
 * - "NVDA 125 put 45 dte"
 * - "Oust short put 16 19 February 2027"
 * - "TSLA covered call 250 Feb 2027"
 * - "MSFT 440 put ai"
 * - "AAPL put 300 suggest best strike for income"
 * - "NVDA 125 put assignment maximize premium"
 */
export function parseOptionTradeQuery(rawText: string): ParsedOptionTradeQuery {
  const clean = (rawText || '')
    .replace(/#(?:topic:)?(?:trades?|options?)\b/gi, '')
    .replace(/^[⚡📈📉🎯💰💵💳💼🔍🤖]\s*/, '')
    .trim();

  // 1. Check Help
  if (isTopicHelpRequest(clean)) {
    return {
      raw: clean,
      symbol: '',
      optionType: 'PUT',
      side: 'SELL',
      isAiRequested: false,
      objective: 'BALANCED',
      isHelp: true,
      isViewHistory: false,
    };
  }

  // 2. Check View History
  if (/^(?:trades|history|recent|list|my\s+trades|recent\s+trades)$/i.test(clean)) {
    return {
      raw: clean,
      symbol: '',
      optionType: 'PUT',
      side: 'SELL',
      isAiRequested: false,
      objective: 'BALANCED',
      isHelp: false,
      isViewHistory: true,
    };
  }

  // 3. Detect AI triggers and goal
  const isAiRequested = /(?:^|\b)(?:ai|analyze|analysis|suggest|suggestions?|advisor|recommend|recommendations?|income|assignment|wheel|maximize\s+premium|best\s+strike|optimize)(?:\b|$)/i.test(clean);

  let objective: TradeObjective = 'BALANCED';
  if (/(?:income|safe|conservative|cushion|low\s*risk|protect|passive)/i.test(clean)) {
    objective = 'INCOME';
  } else if (/(?:assignment|assign|wheel|own|accumulate|max(?:imize)?\s*premium|high\s*premium)/i.test(clean)) {
    objective = 'ASSIGNMENT';
  }

  // 4. Detect Option Type (Call vs Put)
  let optionType: 'PUT' | 'CALL' = 'PUT';
  if (/\b(?:call|calls|covered\s*call|cc|c)\b/i.test(clean) && !/\b(?:put|puts|csp|p)\b/i.test(clean)) {
    optionType = 'CALL';
  } else if (/\b(?:put|puts|csp|p)\b/i.test(clean)) {
    optionType = 'PUT';
  }

  // 5. Detect Side (Sell vs Buy)
  let side: 'SELL' | 'BUY' = 'SELL';
  if (/\b(?:buy|buying|long)\b/i.test(clean) && !/\b(?:short|sell|selling|covered|csp)\b/i.test(clean)) {
    side = 'BUY';
  } else {
    side = 'SELL'; // default for options sellers / income
  }

  // 6. Extract Target Date or DTE (e.g. "19 February 2027", "2027-02-19", "45 dte", "Feb 2027")
  const dateResult = parseTargetDateOrDte(clean);
  const targetDte = dateResult.targetDte;
  const targetExpirationDate = dateResult.targetExpirationDate;
  const targetMonth = dateResult.targetMonth;
  const targetYear = dateResult.targetYear;
  const rawDateText = dateResult.rawMatchedText;

  // 7. Extract Symbol (e.g. AAPL, $NVDA, TSLA, OUST)
  let symbol = '';
  const reservedWords = new Set([
    'PUT', 'PUTS', 'CALL', 'CALLS', 'SHORT', 'LONG', 'BUY', 'SELL', 'AI', 'DTE', 'DAYS',
    'STRIKE', 'INCOME', 'ASSIGNMENT', 'WHEEL', 'PREMIUM', 'SUGGEST', 'ANALYZE', 'BEST',
    'FOR', 'THE', 'AND', 'WITH', 'AT', 'TO', 'TRADE', 'TRADES', 'OPTION', 'OPTIONS',
    'JAN', 'JANUARY', 'FEB', 'FEBRUARY', 'MAR', 'MARCH', 'APR', 'APRIL', 'MAY', 'JUN',
    'JUNE', 'JUL', 'JULY', 'AUG', 'AUGUST', 'SEP', 'SEPT', 'SEPTEMBER', 'OCT', 'OCTOBER',
    'NOV', 'NOVEMBER', 'DEC', 'DECEMBER'
  ]);

  // First try ticker with $ prefix
  const dollarMatch = clean.match(/\$([A-Za-z]{1,6})\b/);
  if (dollarMatch) {
    symbol = dollarMatch[1].toUpperCase();
  } else {
    // Look for standalone 1-6 letter words that are not reserved words
    const words = clean.split(/[\s,;@]+/);
    for (const w of words) {
      const upper = w.replace(/[^A-Za-z]/g, '').toUpperCase();
      if (upper.length >= 1 && upper.length <= 6 && !reservedWords.has(upper) && isNaN(Number(upper))) {
        symbol = upper;
        break;
      }
    }
  }

  // 8. Extract Strike Price (e.g. "300", "125.5", "$300", "300p", "300c", "strike 300", "@ 300")
  let targetStrike: number | undefined;

  // Filter out leading order action quantities like "buy 1 MSFT" or "sell 2 TSLA"
  let sanitizedForStrike = clean.replace(/\b(?:buy|sell|sto|bto|stc|btc)\s+(\d+(?:\.\d+)?)\s+/i, ' ');

  // CRITICAL: Strip the matched date text so day/year (e.g. 19 or 2027 in "19 February 2027") don't get misidentified as strikes!
  if (rawDateText) {
    sanitizedForStrike = sanitizedForStrike.replace(rawDateText, ' ');
  }

  // Pattern A: Strike with explicit prefix or suffix (e.g. strike 300, $300, 300P, 300C, 300 put, 300 call)
  const explicitStrikeMatch =
    sanitizedForStrike.match(/(?:strike|@|\$)\s*(\d+(?:\.\d{1,2})?)/i) ||
    sanitizedForStrike.match(/(\d+(?:\.\d{1,2})?)\s*(?:[cp]\b|puts?\b|calls?\b)/i);

  if (explicitStrikeMatch) {
    const val = parseFloat(explicitStrikeMatch[1]);
    if (val !== targetDte && val >= 1 && val <= 10000) {
      targetStrike = val;
    }
  }

  // Pattern B: Strike adjacent to symbol (e.g. "MSFT 450" or "450 MSFT")
  if (!targetStrike && symbol) {
    const afterSym = sanitizedForStrike.match(new RegExp(`(?:\\$|\\b)${symbol}\\s+(\\d+(?:\\.\\d{1,2})?)\\b`, 'i'));
    const beforeSym = sanitizedForStrike.match(new RegExp(`\\b(\\d+(?:\\.\\d{1,2})?)\\s+(?:\\$|\\b)${symbol}\\b`, 'i'));
    const adjMatch = afterSym || beforeSym;
    if (adjMatch) {
      const val = parseFloat(adjMatch[1]);
      if (val !== targetDte && val >= 1 && val <= 10000) {
        targetStrike = val;
      }
    }
  }

  // Pattern C: Any remaining numeric match
  if (!targetStrike) {
    const numMatches = sanitizedForStrike.match(/\b(\d+(?:\.\d{1,2})?)\b/g);
    if (numMatches) {
      for (const m of numMatches) {
        const val = parseFloat(m);
        if (targetDte && val === targetDte) continue;
        if (targetYear && val === targetYear) continue;
        if (val >= 1 && val <= 10000) {
          targetStrike = val;
          break;
        }
      }
    }
  }

  return {
    raw: clean,
    symbol,
    optionType,
    side,
    targetStrike,
    targetDte,
    targetExpirationDate,
    targetMonth,
    targetYear,
    rawDateText,
    isAiRequested,
    objective,
    isHelp: false,
    isViewHistory: false,
  };
}

/**
 * Computes financial metrics for a single strike
 */
function buildStrikeComparisonItem(
  strike: number,
  contract: OptionContractRow | undefined,
  spotPrice: number,
  dte: number,
  optionType: 'PUT' | 'CALL',
  side: 'SELL' | 'BUY',
  isTarget: boolean
): StrikeComparisonItem {
  const dteValid = Math.max(1, dte);
  const midPrice = contract
    ? (contract.mid > 0 ? contract.mid : (contract.bid + contract.ask) / 2 > 0 ? (contract.bid + contract.ask) / 2 : contract.lastPrice)
    : 0;
  const bid = contract?.bid || 0;
  const ask = contract?.ask || 0;
  const delta = contract?.delta || (optionType === 'PUT' ? -0.30 : 0.30);
  const theta = contract?.theta || 0;
  const iv = contract?.impliedVolatility || 30.0;
  const oi = contract?.openInterest || 0;

  const premiumPerContract = Number((midPrice * 100).toFixed(2));
  const collateral = optionType === 'PUT'
    ? Number((strike * 100).toFixed(2))
    : Number((spotPrice * 100).toFixed(2));

  // Downside / Upside Buffer % to Spot
  const bufferPct = optionType === 'PUT'
    ? Number((((spotPrice - strike) / spotPrice) * 100).toFixed(1))
    : Number((((strike - spotPrice) / spotPrice) * 100).toFixed(1));

  // Breakeven price
  let breakeven = strike;
  if (side === 'SELL') {
    breakeven = optionType === 'PUT' ? strike - midPrice : strike + midPrice;
  } else {
    breakeven = optionType === 'PUT' ? strike - midPrice : strike + midPrice;
  }
  breakeven = Number(breakeven.toFixed(2));

  // Return on Capital & Annualized Return
  const returnOnCapital = strike > 0 ? Number(((midPrice / strike) * 100).toFixed(2)) : 0;
  const annualizedReturn = Number((returnOnCapital * (365 / dteValid)).toFixed(1));

  // Probability of Profit estimate from Delta
  const pop = Math.min(99, Math.max(1, Math.round((1 - Math.abs(delta)) * 100)));

  return {
    strike,
    delta: Number(delta.toFixed(2)),
    bid,
    ask,
    mid: Number(midPrice.toFixed(2)),
    theta: Number(theta.toFixed(3)),
    iv: Number(iv.toFixed(1)),
    openInterest: oi,
    premiumPerContract,
    collateral,
    bufferPct,
    breakeven,
    annualizedReturn,
    pop,
    isTarget,
  };
}

/**
 * Builds the text comparison matrix table formatted for Telegram monospace display
 */
function buildStrikesTable(matrix: StrikeComparisonItem[]): string {
  const lines: string[] = [];
  lines.push('`Strike | Delta |  Mid  |  Ann %  | Buffer |  PoP `');
  lines.push('`-------|-------|-------|---------|--------|------`');

  for (const item of matrix) {
    const isTarget = item.isTarget;
    const prefix = isTarget ? '👉' : '  ';
    const strikeStr = `$${item.strike.toFixed(0)}`.padEnd(5, ' ');
    const deltaStr = (item.delta >= 0 ? `+${item.delta.toFixed(2)}` : `${item.delta.toFixed(2)}`).padStart(5, ' ');
    const midStr = `$${item.mid.toFixed(2)}`.padStart(5, ' ');
    const annStr = `${item.annualizedReturn.toFixed(1)}%`.padStart(6, ' ');
    const buffSign = item.bufferPct >= 0 ? `+${item.bufferPct.toFixed(1)}%` : `${item.bufferPct.toFixed(1)}%`;
    const buffStr = buffSign.padStart(6, ' ');
    const popStr = `${item.pop}%`.padStart(4, ' ');

    lines.push(`\`${prefix}${strikeStr}| ${deltaStr} | ${midStr} | ${annStr}  | ${buffStr} | ${popStr}\``);
  }

  return lines.join('\n');
}

/**
 * Executes AI analysis and strike optimization using the multi-tier LLM router
 */
async function generateAiOptionsAdvice({
  symbol,
  companyName,
  spotPrice,
  spotChange,
  spotChangePercent,
  optionType,
  side,
  targetDte,
  selectedExpiration,
  targetStrike,
  targetMetrics,
  matrix,
  objective,
}: {
  symbol: string;
  companyName: string;
  spotPrice: number;
  spotChange: number;
  spotChangePercent: number;
  optionType: 'PUT' | 'CALL';
  side: 'SELL' | 'BUY';
  targetDte: number;
  selectedExpiration: string;
  targetStrike: number;
  targetMetrics: StrikeComparisonItem;
  matrix: StrikeComparisonItem[];
  objective: TradeObjective;
}): Promise<string> {
  // Find candidates for each objective archetype from the real matrix
  // 1. Income: lowest delta near 0.15 - 0.20
  const incomeCandidate = [...matrix].sort((a, b) => Math.abs(Math.abs(a.delta) - 0.18) - Math.abs(Math.abs(b.delta) - 0.18))[0] || targetMetrics;
  // 2. Balanced: delta near 0.28 - 0.30
  const balancedCandidate = [...matrix].sort((a, b) => Math.abs(Math.abs(a.delta) - 0.28) - Math.abs(Math.abs(b.delta) - 0.28))[0] || targetMetrics;
  // 3. Assignment / Premium Maximizer: delta near 0.38 - 0.45
  const assignmentCandidate = [...matrix].sort((a, b) => Math.abs(Math.abs(a.delta) - 0.40) - Math.abs(Math.abs(b.delta) - 0.40))[0] || targetMetrics;

  const matrixSummary = matrix.map(m =>
    `$${m.strike} (Delta: ${m.delta}, Mid: $${m.mid}, Ann Yield: ${m.annualizedReturn}%, Buffer: ${m.bufferPct}%, PoP: ${m.pop}%)`
  ).join('\n');

  const systemPrompt =
    `You are Antigravity Options Intelligence, an elite institutional options portfolio strategist. ` +
    `You analyze derivative trades (specifically Cash-Secured Puts, Covered Calls, and Wheel strategies). ` +
    `Provide concise, razor-sharp, actionable guidance formatted with Telegram Markdown (bold, bullet points). ` +
    `Be direct, highly quantitative, and state precise recommendations.`;

  const userPrompt =
    `Analyze this proposed options trade:\n\n` +
    `• Underlying: ${symbol} (${companyName})\n` +
    `• Spot Price: $${spotPrice.toFixed(2)} (${spotChange >= 0 ? '+' : ''}${spotChange.toFixed(2)}, ${spotChangePercent}%)\n` +
    `• Proposed Setup: ${side} $${targetStrike} ${optionType} (${selectedExpiration}, ${targetDte} DTE)\n` +
    `• Proposed Strike Metrics: Mid $${targetMetrics.mid}, Delta ${targetMetrics.delta}, Premium $${targetMetrics.premiumPerContract}, Ann Return ${targetMetrics.annualizedReturn}%, Safety Cushion ${targetMetrics.bufferPct}%, PoP ${targetMetrics.pop}%\n` +
    `• User Primary Objective: ${objective}\n\n` +
    `Available neighbouring strikes chain:\n${matrixSummary}\n\n` +
    `Provide:\n` +
    `1. Strategic Appraisal: Brief evaluation of trading $${targetStrike} on ${symbol} right now.\n` +
    `2. Strike Recommendations by Goal:\n` +
    `   • 🛡️ *Income / Conservative (0.15-0.20 Delta)*: Recommend the best strike (e.g. $${incomeCandidate.strike}), explain why.\n` +
    `   • ⚖️ *Balanced Sweet Spot (~0.30 Delta)*: Recommend the best strike (e.g. $${balancedCandidate.strike}), explain why.\n` +
    `   • 📥 *Assignment / Wheel Maximizer (0.35-0.45 Delta)*: Recommend the best strike (e.g. $${assignmentCandidate.strike}), explain why.\n` +
    `3. Tactical Trade Rules: Suggested Limit order entry price, profit-taking target (e.g. 50%), and roll/defense trigger.`;

  try {
    const aiText = await generateTextCompletion({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
      maxTokens: 550,
      timeoutMs: 14000,
      tag: `TradeAdvisor-${symbol}`,
    });

    if (aiText && aiText.trim().length > 40) {
      return aiText.trim();
    }
  } catch (err: any) {
    logToFile(`[TradeAdvisor AI Fallback] Error calling LLM router: ${err.message}. Using deterministic playbook.`);
  }

  // Deterministic Financial Model Fallback
  return (
    `🤖 *AI Options Playbook for ${symbol}*\n\n` +
    `• *Market Appraisal:* ${symbol} is trading at $${spotPrice.toFixed(2)}. Selling OTM ${optionType.toLowerCase()}s extracts positive theta decay ($${Math.abs(targetMetrics.theta * 100).toFixed(1)}/day) while providing a ${Math.abs(targetMetrics.bufferPct)}% price cushion.\n\n` +
    `🎯 *Tailored Strike Suggestions:*\n` +
    `• 🛡️ *Pure Income Pick ($${incomeCandidate.strike})*: Delta ${incomeCandidate.delta} with *${incomeCandidate.pop}% PoP*. Generates *$${incomeCandidate.mid.toFixed(2)}* ($${incomeCandidate.premiumPerContract}) for a safe *${incomeCandidate.annualizedReturn}% annualized return* with *${incomeCandidate.bufferPct}% safety cushion*.\n` +
    `• ⚖️ *Balanced Sweet Spot ($${balancedCandidate.strike})*: Delta ${balancedCandidate.delta} with *${balancedCandidate.pop}% PoP*. Optimal risk/reward balancing *${balancedCandidate.annualizedReturn}% annualized yield* and steady theta decay.\n` +
    `• 📥 *Assignment / Wheel Maximizer ($${assignmentCandidate.strike})*: Delta ${assignmentCandidate.delta}. Extracts a rich *$${assignmentCandidate.mid.toFixed(2)}* ($${assignmentCandidate.premiumPerContract}) premium (*${assignmentCandidate.annualizedReturn}% ann*). Effective purchase cost basis if assigned: *$${(assignmentCandidate.strike - assignmentCandidate.mid).toFixed(2)}* (${((spotPrice - (assignmentCandidate.strike - assignmentCandidate.mid)) / spotPrice * 100).toFixed(1)}% discount to current spot).\n\n` +
    `📋 *Execution Rules:*\n` +
    `• *Order Type:* Limit order at Mid *$${targetMetrics.mid.toFixed(2)}*\n` +
    `• *Profit Target:* Take profit at 50% max gain ($${(targetMetrics.mid * 50).toFixed(0)} per contract)\n` +
    `• *Defense Rule:* If underlying tests $${targetMetrics.strike}, roll out to next month at 21 DTE`
  );
}

/**
 * Handles incoming Trade topic messages
 */
export async function handleTradeTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
  senderLabel = 'Mobile',
  timestamp = Date.now(),
}: TradeTopicRequest): Promise<{
  handled: boolean;
  replyText: string;
  actionTaken: TradeTopicAction;
  query: ParsedOptionTradeQuery;
  hasAiAnalysis: boolean;
  analysis?: TradeAnalysisResult;
}> {
  const parsed = parseOptionTradeQuery(text);

  // 0. Guard against duplicate queries executed within 15 seconds (e.g. concurrent webhook + getUpdates)
  if (prisma && (prisma as any).thoughtLog && text) {
    try {
      const recentDup = await (prisma as any).thoughtLog.findFirst({
        where: {
          folder: 'Execution',
          tags: { contains: 'Trade' },
          content: { startsWith: `User query: "${text}"` },
          createdAt: { gte: new Date(Date.now() - 15000) },
        },
      });
      if (recentDup) {
        logToFile(`[TradeTopic] Skipping duplicate trade query within 15s window: "${text}"`);
        return {
          handled: true,
          replyText: recentDup.agentOutput || 'Duplicate query skipped.',
          actionTaken: 'ANALYZE_TRADE',
          query: parsed,
          hasAiAnalysis: false,
        };
      }
    } catch {}
  }

  // ==========================================
  // 1. HELP / INSTRUCTIONS
  // ==========================================
  if (parsed.isHelp) {
    const helpText = getTradeTopicHelp();
    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: helpText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      });
    }
    return {
      handled: true,
      replyText: helpText,
      actionTaken: 'HELP',
      query: parsed,
      hasAiAnalysis: false,
    };
  }

  // ==========================================
  // 2. VIEW RECENT TRADES HISTORY
  // ==========================================
  if (parsed.isViewHistory) {
    const logs = await prisma.thoughtLog.findMany({
      where: {
        OR: [
          { tags: { contains: 'Trade' } },
          { folder: 'Execution' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    let historyText = '';
    if (logs.length === 0) {
      historyText =
        `⚡ *Trade Analysis History*\n\n` +
        `_No trade inquiries currently logged in Trade history._\n\n` +
        `💡 *Try sending:*\n` +
        `• \`AAPL short put 300\`\n` +
        `• \`NVDA 125 put income\`\n` +
        `• \`TSLA covered call 250 ai\``;
    } else {
      const rows = logs.map(l => {
        const dateStr = new Date(l.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `• *${l.title.replace(/^⚡\s*/, '')}* — _${dateStr}_\n  "${l.content.slice(0, 80)}${l.content.length > 80 ? '...' : ''}"`;
      }).join('\n\n');

      historyText = `⚡ *Recent Trade Inquiries* (${logs.length} logs)\n\n${rows}\n\n───────────────────────\n💡 _Send any trade like \`AAPL short put 300\` to get live metrics & AI recommendations!_`;
    }

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: historyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      });
    }

    return {
      handled: true,
      replyText: historyText,
      actionTaken: 'VIEW_HISTORY',
      query: parsed,
      hasAiAnalysis: false,
    };
  }

  // ==========================================
  // 3. VALIDATE SYMBOL
  // ==========================================
  if (!parsed.symbol) {
    const errorText =
      `⚡ *Trade Analysis Assistant*\n\n` +
      `⚠️ Could not detect a ticker in your request: "${text}"\n\n` +
      `💡 *Examples of what to send:*\n` +
      `• \`AAPL short put 300\` — Live quotes, Greeks, and annualized returns\n` +
      `• \`NVDA 125 put ai\` — AI analysis and strike suggestions\n` +
      `• \`TSLA 230 put suggest best strike for income\`\n` +
      `• \`MSFT covered call 450 assignment maximize premium\``;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: errorText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      });
    }

    return {
      handled: true,
      replyText: errorText,
      actionTaken: 'UNKNOWN',
      query: parsed,
      hasAiAnalysis: false,
    };
  }

  // ==========================================
  // 4. FETCH OPTIONS CHAIN & MARKET DATA
  // ==========================================
  const symbol = parsed.symbol;
  logToFile(`[TradeTopic] Fetching live options chain for ${symbol}...`);

  let chain: OptionsChainData | null = null;
  try {
    chain = await optionsChainService.getOptionsChain(symbol);
  } catch (err: any) {
    logToFile(`[TradeTopic] Error fetching options chain for ${symbol}: ${err.message}`);
  }

  if (!chain || !chain.strikes || chain.strikes.length === 0) {
    const notFoundText =
      `⚡ *Trade Analysis: $${symbol}*\n\n` +
      `⚠️ Unable to retrieve active options chains for *$${symbol}*. Please verify the ticker or try again shortly.`;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: notFoundText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      });
    }

    return {
      handled: true,
      replyText: notFoundText,
      actionTaken: 'ANALYZE_TRADE',
      query: parsed,
      hasAiAnalysis: false,
    };
  }

  const spotPrice = chain.underlyingPrice;
  const spotChange = chain.underlyingChange || 0;
  const spotChangePercent = chain.underlyingChangePercent || 0;
  const companyName = chain.companyName || symbol;

  // Select target expiration
  // Priority:
  // 1. Exact targetExpirationDate (YYYY-MM-DD) in chain.expirations
  // 2. Exact Month and Year match (targetYear + targetMonth) in chain.expirations (e.g. Feb 2027)
  // 3. Closest date to targetExpirationDate in chain.expirations
  // 4. Closest DTE to parsed.targetDte in chain.expirations
  // 5. Default fallback: If front expiration is 0-6 DTE, look for next standard monthly (~21-55 DTE)
  let selectedExp = chain.selectedExpiration;
  let selectedDte = chain.selectedDte;

  let targetExpToSelect: ExpirationMeta | null = null;

  if (chain.expirations && chain.expirations.length > 0) {
    // 1. Exact date match (e.g. '2027-02-19')
    if (parsed.targetExpirationDate && parsed.targetExpirationDate.length === 10) {
      targetExpToSelect = chain.expirations.find(e => e.date === parsed.targetExpirationDate) || null;
    }

    // 2. Month and Year match (e.g. "Feb 2027", "February 2027")
    if (!targetExpToSelect && parsed.targetYear && parsed.targetMonth) {
      const yearStr = String(parsed.targetYear);
      const monthStr = String(parsed.targetMonth).padStart(2, '0');
      const targetPrefix = `${yearStr}-${monthStr}`;

      const monthMatches = chain.expirations.filter(e => e.date.startsWith(targetPrefix));
      if (monthMatches.length > 0) {
        if (parsed.targetDte) {
          let minDiff = Infinity;
          for (const exp of monthMatches) {
            const diff = Math.abs(exp.dte - parsed.targetDte);
            if (diff < minDiff) {
              minDiff = diff;
              targetExpToSelect = exp;
            }
          }
        } else {
          targetExpToSelect =
            monthMatches.find(e => e.type === 'MONTHLY' || e.isMonthlyOpex) ||
            monthMatches.find(e => e.type === 'LEAP') ||
            monthMatches[Math.floor(monthMatches.length / 2)] ||
            monthMatches[0];
        }
      }
    }

    // 3. Closest date if a full date was requested (YYYY-MM-DD) but exact trading day not matched
    if (!targetExpToSelect && parsed.targetExpirationDate && parsed.targetExpirationDate.length === 10) {
      const targetTs = new Date(parsed.targetExpirationDate).getTime();
      if (!isNaN(targetTs)) {
        let minDiff = Infinity;
        for (const exp of chain.expirations) {
          const expTs = new Date(exp.date).getTime();
          const diff = Math.abs(expTs - targetTs);
          if (diff < minDiff) {
            minDiff = diff;
            targetExpToSelect = exp;
          }
        }
      }
    }

    // 4. Target DTE match (e.g. "126 dte", "45 dte")
    if (!targetExpToSelect && parsed.targetDte !== undefined) {
      let minDiff = Infinity;
      for (const exp of chain.expirations) {
        const diff = Math.abs(exp.dte - parsed.targetDte);
        if (diff < minDiff) {
          minDiff = diff;
          targetExpToSelect = exp;
        }
      }
    }

    // 5. Default fallback if user did NOT specify any date or DTE:
    // If front expiration is 0-6 DTE, look for next standard monthly (~21-55 DTE) for standard swing options selling
    if (!targetExpToSelect && !parsed.targetExpirationDate && parsed.targetDte === undefined && selectedDte < 7 && chain.expirations.length > 1) {
      targetExpToSelect = chain.expirations.find(e => e.dte >= 21 && e.dte <= 55 && e.type === 'MONTHLY')
        || chain.expirations.find(e => e.dte >= 21 && e.dte <= 55)
        || chain.expirations[1];
    }
  }

  if (targetExpToSelect && targetExpToSelect.date !== selectedExp) {
    try {
      logToFile(`[TradeTopic] Switching options expiration for ${symbol} to ${targetExpToSelect.date} (${targetExpToSelect.dte} DTE)...`);
      const expChain = await optionsChainService.getOptionsChain(symbol, targetExpToSelect.date);
      if (expChain && expChain.strikes && expChain.strikes.length > 0) {
        chain = expChain;
        selectedExp = targetExpToSelect.date;
        selectedDte = targetExpToSelect.dte;
      }
    } catch (err: any) {
      logToFile(`[TradeTopic] Error switching expiration to ${targetExpToSelect.date}: ${err.message}`);
    }
  }

  // Determine Target Strike
  const strikesList = chain.strikes.map(s => s.strike).sort((a, b) => a - b);
  const originalRequestedStrike = parsed.targetStrike;
  let targetStrike = parsed.targetStrike;

  if (!targetStrike) {
    // Pick standard strike based on objective or ATM
    if (parsed.optionType === 'PUT') {
      // OTM put below spot (~0.30 delta or ~5% below spot)
      targetStrike = strikesList.filter(s => s <= spotPrice).pop() || strikesList[0];
    } else {
      // OTM call above spot (~0.30 delta or ~5% above spot)
      targetStrike = strikesList.find(s => s >= spotPrice) || strikesList[strikesList.length - 1];
    }
  }

  // Find closest available strike in chain
  let closestStrike = strikesList[0];
  let minStrikeDiff = Math.abs(closestStrike - targetStrike);
  for (const s of strikesList) {
    const diff = Math.abs(s - targetStrike);
    if (diff < minStrikeDiff) {
      minStrikeDiff = diff;
      closestStrike = s;
    }
  }
  targetStrike = closestStrike;

  // Build target strike item
  const targetRow = chain.strikes.find(s => s.strike === targetStrike);
  const targetContract = parsed.optionType === 'PUT' ? targetRow?.put : targetRow?.call;
  const targetMetrics = buildStrikeComparisonItem(
    targetStrike,
    targetContract,
    spotPrice,
    selectedDte,
    parsed.optionType,
    parsed.side,
    true
  );

  // Build neighbouring matrix (5-7 strikes centered around target)
  const targetIdx = strikesList.indexOf(targetStrike);
  const startIdx = Math.max(0, targetIdx - 2);
  const endIdx = Math.min(strikesList.length - 1, targetIdx + 2);
  const selectedStrikes = strikesList.slice(startIdx, endIdx + 1);

  const matrix: StrikeComparisonItem[] = selectedStrikes.map(st => {
    const row = chain!.strikes.find(s => s.strike === st);
    const contract = parsed.optionType === 'PUT' ? row?.put : row?.call;
    return buildStrikeComparisonItem(
      st,
      contract,
      spotPrice,
      selectedDte,
      parsed.optionType,
      parsed.side,
      st === targetStrike
    );
  });

  // ==========================================
  // 5. RUN AI AGENT ANALYSIS (IF TRIGGERED)
  // ==========================================
  let aiAnalysis: string | undefined;
  if (parsed.isAiRequested) {
    aiAnalysis = await generateAiOptionsAdvice({
      symbol,
      companyName,
      spotPrice,
      spotChange,
      spotChangePercent,
      optionType: parsed.optionType,
      side: parsed.side,
      targetDte: selectedDte,
      selectedExpiration: selectedExp,
      targetStrike,
      targetMetrics,
      matrix,
      objective: parsed.objective,
    });
  }

  // ==========================================
  // 6. ASSEMBLE TELEGRAM MESSAGE
  // ==========================================
  const changeSign = spotChange >= 0 ? '+' : '';
  const changeEmoji = spotChange >= 0 ? '🟢' : '🔴';
  const sideLabel = parsed.side === 'SELL' ? 'Short' : 'Long';
  const typeLabel = parsed.optionType === 'PUT' ? 'Put' : 'Call';

  const expFormatted = new Date(selectedExp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const matrixTable = buildStrikesTable(matrix);

  const strikeNote = originalRequestedStrike !== undefined && originalRequestedStrike !== targetStrike
    ? ` _(Closest available strike to requested $${originalRequestedStrike})_`
    : '';

  let message =
    `⚡ *TRADE ANALYSIS: $${symbol}*\n` +
    `🏛️ *Spot:* $${spotPrice.toFixed(2)} (${changeSign}$${spotChange.toFixed(2)}, ${changeSign}${spotChangePercent}% ${changeEmoji}) | *IV:* ${targetMetrics.iv}%\n` +
    `🗓️ *Expiry:* *${expFormatted}* (*${selectedDte} DTE*)\n\n` +
    `📋 *Contract:* *${sideLabel} $${targetStrike} ${typeLabel}*${strikeNote}\n` +
    `• *Bid / Ask:* $${targetMetrics.bid.toFixed(2)} / $${targetMetrics.ask.toFixed(2)} (Mid: *$${targetMetrics.mid.toFixed(2)}*)\n` +
    `• *Premium Extracted:* *$${targetMetrics.premiumPerContract.toFixed(2)}* per contract\n` +
    `• *Delta:* *${targetMetrics.delta >= 0 ? '+' : ''}${targetMetrics.delta.toFixed(2)}* (👉 *${targetMetrics.pop}% Win Rate / PoP*)\n` +
    `• *Theta Decay:* *+$${Math.abs(targetMetrics.theta * 100).toFixed(2)} / day* (positive decay)\n` +
    `• *Safety Cushion:* *${targetMetrics.bufferPct >= 0 ? '+' : ''}${targetMetrics.bufferPct.toFixed(1)}%* distance to spot\n` +
    `• *Breakeven:* *$${targetMetrics.breakeven.toFixed(2)}*\n` +
    `• *Return on Capital:* *${targetMetrics.annualizedReturn.toFixed(1)}% annualized* (${((targetMetrics.mid / targetStrike) * 100).toFixed(2)}% flat)\n\n` +
    `📊 *Neighbouring Strikes Matrix (${expFormatted})*\n` +
    `${matrixTable}\n`;

  if (aiAnalysis) {
    message += `\n${aiAnalysis}\n`;
  } else {
    message +=
      `\n💡 _Add \`ai\` or \`suggest\` (e.g. \`${symbol} ${targetStrike} ${typeLabel.toLowerCase()} income\`) for AI strike suggestions!_\n`;
  }

  // Dispatch to Telegram
  if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
    await sendTelegramMessage({
      text: message,
      chatId,
      messageThreadId,
      parseMode: 'Markdown',
    });
  }

  const analysisResult: TradeAnalysisResult = {
    symbol,
    companyName,
    spotPrice,
    spotChange,
    spotChangePercent,
    selectedExpiration: selectedExp,
    selectedDte: selectedDte,
    targetStrike,
    optionType: parsed.optionType,
    side: parsed.side,
    targetMetrics,
    strikesMatrix: matrix,
    aiAnalysis,
    formattedMessage: message,
  };

  return {
    handled: true,
    replyText: message,
    actionTaken: 'ANALYZE_TRADE',
    query: parsed,
    hasAiAnalysis: Boolean(aiAnalysis),
    analysis: analysisResult,
  };
}
