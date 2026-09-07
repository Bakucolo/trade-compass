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
  'AM', 'PM', 'EST', 'EDT', 'PST', 'PDT', 'CST', 'CDT', 'UTC', 'GMT',
  'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN',
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  'TODAY', 'WEEK', 'MONTH', 'YEAR', 'TIME', 'DATE', 'HOUR', 'MIN', 'SEC', 'DAILY',
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
  'OPEN', 'STOP', 'RISK', 'SELL', 'CASH', 'LOSS', 'GAIN', 'DROP', 'PUMP', 'DUMP',
  'HOLD', 'FEEL', 'LOOK', 'SEEM', 'TAKE', 'MAKE', 'KNOW', 'CALL', 'PUTS', 'TRADE',
  'TRADES', 'IDEA', 'IDEAS', 'WATCH', 'PRICE', 'LEVEL', 'MONEY', 'RALLY', 'ALERT', 'ALERTS'
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

  // Remove timestamps like "10:30 AM", "09:15"
  const sanitized = text.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/gi, ' ');

  const results: ParsedAlertCandidate[] = [];
  const seenSymbols = new Set<string>();

  // Split into lines/clauses to handle multi-alert messages
  const segments = sanitized.split(/[\r\n,;]+/);

  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;

    // 1. Check for percentage offset alert: e.g. "NVDA -5%", "Alert NVDA +10%", "TSLA 5% dip", "AAPL down 5%"
    const pctMatch = trimmed.match(/(?:(?:SET\s+)?ALERT(?:\s+FOR|\s+ON|:)?\s+)?(?:\$)?([A-Za-z]{1,6})\s*(?:@|AT|:|ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP|REACH|DOWN|UP)?\s*([+-]?\s*[0-9]+(?:\.[0-9]+)?)\s*%/i);
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

    // 2. Check for fixed target price: e.g. "NVDA 120", "Alert RBRK at 120", "RBRK @ $120.50", "NVDA > 130"
    // Negative lookahead (?!\s*%) prevents matching "5" in "5%" as a dollar price
    const match = trimmed.match(/(?:(?:SET\s+)?ALERT(?:\s+FOR|\s+ON|:)?\s+)?(?:\$)?([A-Za-z]{1,6})\s*(?:@|AT|:|ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP|REACH)?\s*\$?([0-9]+(?:\.[0-9]+)?)(?!\s*%)(\s*(?:ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP))?/i);

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
      try {
        const summary = await yahooFinance.quoteSummary(resolvedSym, { modules: ['price'] }).catch(() => null);
        if (summary?.price?.regularMarketPrice != null) {
          currentPrice = Number(summary.price.regularMarketPrice);
        }
      } catch {}

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
      } else if (candidate.percentageOffset !== undefined && currentPrice != null && currentPrice > 0) {
        finalTargetPrice = Number((currentPrice * (1 + candidate.percentageOffset / 100)).toFixed(2));
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
