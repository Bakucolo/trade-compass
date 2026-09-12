import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';
import { resolveYahooFinanceSymbol } from './tickerResolutionService';
import { extractSymbolsFromText } from './thoughtLogAgentService';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export interface ParsedAlertCandidate {
  symbol: string;
  targetPrice?: number;
  percentageOffset?: number;
  condition: 'ABOVE' | 'BELOW' | 'AUTO';
  rawSnippet: string;
}

export interface CreatedAlertResult {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  currentPrice: number | null;
  status: string;
  notes?: string | null;
}

// Stop words / common non-ticker uppercase terms to avoid false positives
const NON_TICKER_WORDS = new Set([
  // Single-letter English words & pronouns
  'A', 'I',

  // Time & Dates & Timezones
  'AM', 'PM', 'EST', 'EDT', 'PST', 'PDT', 'CST', 'CDT', 'UTC', 'GMT',
  'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN',
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  'TODAY', 'WEEK', 'MONTH', 'YEAR', 'TIME', 'DATE', 'HOUR', 'MIN', 'SEC', 'DAILY',

  // Common prepositions, verbs & short words
  'IS', 'IT', 'AT', 'ON', 'IN', 'TO', 'IF', 'DO', 'GO', 'NO', 'SO', 'UP', 'MY', 'BY',
  'OR', 'AS', 'HE', 'WE', 'ME', 'US', 'OK', 'AN', 'BE', 'OF', 'THE', 'AND', 'FOR',
  'NOT', 'BUT', 'ALL', 'ANY', 'CAN', 'SEE', 'GET', 'SET', 'PUT', 'RUN', 'LET', 'DID',
  'NOW', 'OUT', 'OFF', 'WHY', 'HOW', 'WHO', 'YOU', 'HIS', 'HER', 'OUR', 'ITS', 'LOT',
  'FEW', 'WAY', 'END', 'OLD', 'NEW', 'BIG', 'TOP', 'LOW', 'BAD', 'BOY', 'MAN', 'JOB',
  'KEY', 'PAY', 'BUY', 'HIT', 'TRY', 'ASK', 'OWN', 'TOO', 'YES', 'DIP', 'MID', 'MAX', 'MIN',
  'WITH', 'FROM', 'THIS', 'THAT', 'HAVE', 'WILL', 'WHAT', 'WHEN', 'THEN', 'SOME',
  'JUST', 'MORE', 'VERY', 'MUCH', 'OVER', 'INTO', 'BEEN', 'LIKE', 'THEY', 'THEIR',
  'ABOUT', 'AFTER', 'BEFORE', 'COULD', 'WOULD', 'SHOULD', 'WHICH', 'WHERE', 'THESE',
  'THOSE', 'BECAUSE', 'HERE', 'THERE', 'EACH', 'BOTH', 'MANY', 'SUCH', 'EVEN', 'MOST',
  'ALSO', 'BACK', 'WELL', 'ONLY', 'DOWN', 'REAL', 'GOOD', 'BEST', 'LONG', 'SHORT',
  'OPEN', 'STOP', 'RISK', 'SELL', 'CASH', 'LOSS', 'GAIN', 'GAINS', 'DROP', 'PUMP', 'DUMP',
  'HOLD', 'FEEL', 'LOOK', 'SEEM', 'TAKE', 'MAKE', 'KNOW', 'CALL', 'PUTS', 'TRADE',
  'TRADES', 'IDEA', 'IDEAS', 'WATCH', 'PRICE', 'LEVEL', 'MONEY', 'RALLY', 'ALERT', 'ALERTS',

  // Common verbs and descriptive words frequently matching numbers
  'CLOSE', 'CLOSES', 'CLOSED', 'CLOSING',
  'FINAL', 'FINALS', 'FINALLY',
  'EXCEED', 'EXCEEDS', 'EXCEEDED', 'XCEEDS',
  'APPROACH', 'APPROACHES', 'APPROACHED', 'OACHES',
  'ROUGH', 'ROUGHLY', 'OUGHLY',
  'GROW', 'GROWS', 'GROWTH', 'GREW',
  'WIN', 'WINS', 'WINNER', 'WINNERS',
  'TARGET', 'TARGETS', 'FLOOR', 'CEIL', 'CEILING',
  'RANGE', 'STRIKE', 'STRIKES', 'EXP', 'EXPIRY', 'EXPIRATION',
  'DELTA', 'THETA', 'GAMMA', 'VEGA', 'RHO', 'SPOT',
  'CONTRACT', 'CONTRACTS', 'POSITION', 'POSITIONS',
  'PROB', 'PROBS', 'PROBABILITY', 'PROBABILITIES', 'METRIC', 'METRICS',
  'SHARE', 'SHARES', 'VALUE', 'VALUES', 'TOTAL', 'TOTALS', 'NET', 'FREE',
  'BASE', 'RATE', 'RATES', 'RATIO', 'RATIOS', 'POINT', 'POINTS', 'PERCENT',
  'PROFIT', 'PROFITS', 'STAGE', 'STEP', 'STEPS', 'SECTION', 'SECTIONS', 'TABLE', 'TABLES',
  'MODEL', 'CHAT', 'COPILOT', 'ANALYSIS', 'REPORT', 'SUMMARY', 'RULE', 'RULES',
  'ABOUT', 'ACROSS', 'AGAINST', 'ALONG', 'AMONG', 'AROUND', 'BEHIND',
  'BESIDE', 'BETWEEN', 'BEYOND', 'DURING', 'EXCEPT', 'INSIDE', 'OUTSIDE',
  'TOWARD', 'TOWARDS', 'UNDER', 'WITHIN', 'WITHOUT',

  // Financial / Accounting Acronyms
  'PE', 'EPS', 'FCF', 'ROE', 'ROIC', 'ROA', 'EBITDA', 'EBIT', 'NAV', 'CAGR',
  'CPI', 'PPI', 'GDP', 'PMI', 'VIX', 'DXY', 'YTD', 'MTD', 'QOQ', 'YOY',
  'DTE', 'ATM', 'OTM', 'ITM', 'IVR', 'IV', 'HV', 'OI', 'VOL', 'POP', 'POT', 'ROC',
  'AI', 'SAAS', 'EV', 'GPU', 'CPU', 'SMR', 'CEO', 'CFO', 'CTO', 'COO', 'CIO',
  'IPO', 'LLC', 'INC', 'CORP', 'LTD', 'PDF', 'URL', 'API', 'APP', 'BOT', 'MSG', 'SMS',
  'LOG', 'NOTE', 'POST', 'TEXT', 'SYNC', 'EDIT', 'VIEW', 'CHART', 'GRAPH'
]);

/**
 * Extracts price alert candidates from freeform message text.
 * Matches:
 *  - "RBRK 120"
 *  - "Alert RBRK at 120"
 *  - "RBRK @ $120.50"
 *  - "RBRK above 120" / "RBRK > 120"
 *  - "RBRK below 110" / "RBRK < 110"
 *  - "Set alert for RBRK 120"
 *  - "NVDA -5%" / "Alert NVDA +10%" / "TSLA 5% dip"
 */
export function extractPriceAlertCandidates(text: string): ParsedAlertCandidate[] {
  if (!text || typeof text !== 'string') return [];

  // If text is long (> 300 chars) and does NOT contain explicit alert keywords ("alert", "set alert", or "#alert") or cashtag "$",
  // do not scan long narrative documents (e.g. Copilot answers, research reports, articles)
  const hasExplicitAlertKeyword = /\b(?:SET\s+)?ALERTS?\b|#(?:topic:)?alerts?\b|\$[A-Za-z]/i.test(text);
  if (text.length > 300 && !hasExplicitAlertKeyword) {
    return [];
  }

  // Remove timestamps like "10:30 AM", "09:15"
  const sanitized = text.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/gi, ' ');

  const results: ParsedAlertCandidate[] = [];
  const seenSymbols = new Set<string>();

  // Split into lines/clauses to handle multi-alert messages
  const segments = sanitized.split(/[\r\n,;]+/);

  for (const seg of segments) {
    let trimmed = seg.trim();
    if (!trimmed) continue;

    // Skip markdown table separators/rows, headers, blockquotes, code blocks
    if (/^[|#>`~\-=]{1,3}/.test(trimmed) || trimmed.startsWith('---') || trimmed.startsWith('***')) {
      continue;
    }

    // Strip leading markdown bullets / list numbers (e.g. "- RBRK 120", "* NVDA 130", "1. PLTR 120")
    trimmed = trimmed.replace(/^[\s*\-•#>|~\d+.)\]\[]+/, '').trim();
    if (!trimmed) continue;

    // If segment is a long prose sentence (> 80 chars or > 10 words) without an explicit ALERT keyword or cashtag, skip
    const isExplicitLine = /\b(?:SET\s+)?ALERTS?\b|\$[A-Za-z]/i.test(trimmed);
    const wordCount = trimmed.split(/\s+/).length;
    if (!isExplicitLine && (trimmed.length > 80 || wordCount > 10)) {
      continue;
    }

    // --- 1. Check for percentage offset alert: e.g. "NVDA -5%", "Alert NVDA +10%", "TSLA 5% dip", "AAPL down 5%" ---
    let pctMatch = trimmed.match(/^(?:(?:SET\s+)?ALERT(?:\s+FOR|\s+ON|:)?\s+)(?:\$)?([A-Za-z]{1,6})\b\s*(?:@|AT|:|ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP|REACH|DOWN|UP)?\s*([+-]?\s*[0-9]+(?:\.[0-9]+)?)\s*%(?:\s*(?:DIP|DROP|UP|DOWN|RALLY|TARGET))?(?:\s|$)/i);
    if (!pctMatch) {
      pctMatch = trimmed.match(/^\$([A-Za-z]{1,6})\b\s*(?:@|AT|:|ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP|REACH|DOWN|UP)?\s*([+-]?\s*[0-9]+(?:\.[0-9]+)?)\s*%(?:\s*(?:DIP|DROP|UP|DOWN|RALLY|TARGET))?\s*$/i);
    }
    if (!pctMatch) {
      pctMatch = trimmed.match(/^([A-Za-z]{2,6})\b\s*(?:@|AT|:|ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP|REACH|DOWN|UP)?\s*([+-]?\s*[0-9]+(?:\.[0-9]+)?)\s*%(?:\s*(?:DIP|DROP|UP|DOWN|RALLY|TARGET))?\s*$/i);
    }

    if (pctMatch) {
      const rawSym = pctMatch[1].toUpperCase();
      const pctVal = parseFloat(pctMatch[2].replace(/\s+/g, ''));
      if (
        !NON_TICKER_WORDS.has(rawSym) &&
        !isNaN(pctVal) &&
        Math.abs(pctVal) > 0 &&
        rawSym.length >= 1 &&
        rawSym.length <= 6
      ) {
        // Single letter without explicit alert prefix or $ is rejected
        if (rawSym.length === 1 && !isExplicitLine) {
          continue;
        }

        const upperSeg = trimmed.toUpperCase();
        let condition: 'ABOVE' | 'BELOW' = pctVal >= 0 ? 'ABOVE' : 'BELOW';
        let finalOffset = pctVal;
        if (upperSeg.includes('BELOW') || upperSeg.includes('<') || upperSeg.includes('UNDER') || upperSeg.includes('DIP') || upperSeg.includes('DROP') || upperSeg.includes('DOWN')) {
          condition = 'BELOW';
          finalOffset = -Math.abs(pctVal);
        } else if (upperSeg.includes('ABOVE') || upperSeg.includes('>') || upperSeg.includes('OVER') || upperSeg.includes('BREAKOUT') || upperSeg.includes('UP')) {
          condition = 'ABOVE';
          finalOffset = Math.abs(pctVal);
        }

        const dedupKey = `${rawSym}-PCT-${finalOffset}-${condition}`;
        if (!seenSymbols.has(dedupKey)) {
          seenSymbols.add(dedupKey);
          results.push({
            symbol: rawSym,
            percentageOffset: finalOffset,
            condition,
            rawSnippet: trimmed,
          });
          continue;
        }
      }
    }

    // --- 2. Check for fixed target price: e.g. "NVDA 120", "Alert RBRK at 120", "RBRK @ $120.50", "NVDA > 130" ---
    let match = trimmed.match(/^(?:(?:SET\s+)?ALERT(?:\s+FOR|\s+ON|:)?\s+)(?:\$)?([A-Za-z]{1,6})\b\s*(?:@|AT|:|ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP|REACH)?\s*\$?([0-9]+(?:\.[0-9]+)?)(?!\s*%)(?:\s*(?:ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP|TARGET))?(?:\s|$)/i);
    if (!match) {
      match = trimmed.match(/^\$([A-Za-z]{1,6})\b\s*(?:@|AT|:|ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP|REACH)?\s*\$?([0-9]+(?:\.[0-9]+)?)(?!\s*%)(?:\s*(?:ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP|TARGET))?\s*$/i);
    }
    if (!match) {
      match = trimmed.match(/^([A-Za-z]{2,6})\b\s*(?:@|AT|:|ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP|REACH)?\s*\$?([0-9]+(?:\.[0-9]+)?)(?!\s*%)(?:\s*(?:ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP|TARGET))?\s*$/i);
    }

    if (match) {
      const rawSym = match[1].toUpperCase();
      const rawPrice = parseFloat(match[2]);

      // Filter out non-tickers or invalid prices (prices < 0.01 or years like 2024-2030 unless clearly a high-priced asset)
      if (
        !NON_TICKER_WORDS.has(rawSym) &&
        !isNaN(rawPrice) &&
        rawPrice > 0 &&
        rawSym.length >= 1 &&
        rawSym.length <= 6
      ) {
        // Single letter without explicit alert prefix or $ is rejected
        if (rawSym.length === 1 && !isExplicitLine) {
          continue;
        }

        // Condition detection
        let condition: 'ABOVE' | 'BELOW' | 'AUTO' = 'AUTO';
        const upperSeg = trimmed.toUpperCase();

        if (
          upperSeg.includes('BELOW') ||
          upperSeg.includes('<') ||
          upperSeg.includes('UNDER') ||
          upperSeg.includes('DIP') ||
          upperSeg.includes('DROP')
        ) {
          condition = 'BELOW';
        } else if (
          upperSeg.includes('ABOVE') ||
          upperSeg.includes('>') ||
          upperSeg.includes('OVER') ||
          upperSeg.includes('BREAKOUT') ||
          upperSeg.includes('REACH')
        ) {
          condition = 'ABOVE';
        }

        const dedupKey = `${rawSym}-${rawPrice}-${condition}`;
        if (!seenSymbols.has(dedupKey)) {
          seenSymbols.add(dedupKey);
          results.push({
            symbol: rawSym,
            targetPrice: rawPrice,
            condition,
            rawSnippet: trimmed,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Automatically creates price alerts in SQLite PriceAlert table for all parsed candidates
 */
export async function autoCreateAlertsFromText(
  prisma: PrismaClient,
  text: string,
  sourceNotes?: string,
  options?: { isAlertsTopic?: boolean }
): Promise<CreatedAlertResult[]> {
  let candidates = extractPriceAlertCandidates(text);

  // If in the Alerts topic and no explicit price/percentage was specified, extract detected tickers
  // and arm a default 5% proximity dip alert (or breakout if bullish keywords detected)
  if (candidates.length === 0 && options?.isAlertsTopic) {
    const rawSymbols = extractSymbolsFromText(text);
    const validSymbols = rawSymbols.filter((s) => !NON_TICKER_WORDS.has(s.toUpperCase()));
    for (const sym of validSymbols) {
      const upper = text.toUpperCase();
      const isBullish = upper.includes('CALL') || upper.includes('ABOVE') || upper.includes('BREAKOUT') || upper.includes('RALLY') || upper.includes('UP');
      candidates.push({
        symbol: sym,
        percentageOffset: isBullish ? 5 : -5,
        condition: isBullish ? 'ABOVE' : 'BELOW',
        rawSnippet: text.trim(),
      });
    }
  }

  if (candidates.length === 0) return [];

  const createdResults: CreatedAlertResult[] = [];

  for (const candidate of candidates) {
    try {
      const resolvedSym = resolveYahooFinanceSymbol(candidate.symbol) || candidate.symbol;

      // 1. Fetch spot market price
      let currentPrice: number | null = null;
      let symbolNotFound = false;
      try {
        const summary = await yahooFinance.quoteSummary(resolvedSym, { modules: ['price'] }).catch((err: any) => {
          const msg = String(err?.message || '');
          if (msg.includes('Not Found') || msg.includes('404') || msg.includes('not found') || msg.includes('Cannot read properties')) {
            symbolNotFound = true;
          }
          return null;
        });
        if (summary?.price?.regularMarketPrice != null) {
          currentPrice = Number(summary.price.regularMarketPrice);
        }
      } catch {}

      if (symbolNotFound) {
        console.warn(`[Auto Price Alert] Skipped unrecognized ticker: "${resolvedSym}"`);
        continue;
      }

      // 2. Resolve target price & condition
      let finalTargetPrice: number;
      let finalCondition: 'ABOVE' | 'BELOW' = 'ABOVE';

      if (candidate.targetPrice !== undefined && candidate.targetPrice > 0) {
        finalTargetPrice = candidate.targetPrice;
        if (candidate.condition === 'BELOW' || candidate.condition === 'ABOVE') {
          finalCondition = candidate.condition;
        } else if (currentPrice != null) {
          finalCondition = candidate.targetPrice >= currentPrice ? 'ABOVE' : 'BELOW';
        }
      } else if (candidate.percentageOffset !== undefined) {
        const base = (currentPrice != null && currentPrice > 0) ? currentPrice : 150;
        finalTargetPrice = Number((base * (1 + candidate.percentageOffset / 100)).toFixed(2));
        finalCondition = candidate.percentageOffset >= 0 ? 'ABOVE' : 'BELOW';
      } else {
        // Cannot determine price without spot or explicit target
        continue;
      }

      if (finalTargetPrice <= 0 || isNaN(finalTargetPrice)) continue;

      // 3. Check if identical active alert already exists to prevent duplicate spam
      const existing = await prisma.priceAlert.findFirst({
        where: {
          symbol: resolvedSym,
          targetPrice: finalTargetPrice,
          condition: finalCondition,
          status: 'ACTIVE',
        },
      });

      if (existing) {
        createdResults.push({
          id: existing.id,
          symbol: existing.symbol,
          targetPrice: existing.targetPrice,
          condition: existing.condition as 'ABOVE' | 'BELOW',
          currentPrice,
          status: existing.status,
          notes: existing.notes,
        });
        continue;
      }

      // 4. Create active price alert in SQLite database
      const newAlert = await prisma.priceAlert.create({
        data: {
          symbol: resolvedSym,
          targetPrice: finalTargetPrice,
          condition: finalCondition,
          status: 'ACTIVE',
          notes: sourceNotes || `🔔 Auto-created from Telegram Alerts topic: "${text.trim()}"`,
        },
      });

      console.log(`[Auto Price Alert] Created active alert: ${resolvedSym} ${finalCondition} $${finalTargetPrice} (Spot: $${currentPrice ?? 'N/A'})`);

      createdResults.push({
        id: newAlert.id,
        symbol: newAlert.symbol,
        targetPrice: newAlert.targetPrice,
        condition: newAlert.condition as 'ABOVE' | 'BELOW',
        currentPrice,
        status: newAlert.status,
        notes: newAlert.notes,
      });
    } catch (err: any) {
      console.error(`[Auto Price Alert Error] Failed for ${candidate.symbol}:`, err.message);
    }
  }

  return createdResults;
}
