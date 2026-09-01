import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';
import { resolveYahooFinanceSymbol } from './tickerResolutionService';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export interface ParsedAlertCandidate {
  symbol: string;
  targetPrice: number;
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

    // Regex to match:
    // Optional (ALERT / SET ALERT [FOR/ON]) + Optional $ + Ticker (1-6 letters) + Optional separator (@, at, :, >, <, above, below, over, under, reach) + Optional $ + Price
    const match = trimmed.match(/(?:(?:SET\s+)?ALERT(?:\s+FOR|\s+ON|:)?\s+)?(?:\$)?([A-Za-z]{1,6})\s*(?:@|AT|:|ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP|REACH)?\s*\$?([0-9]+(?:\.[0-9]+)?)(?:\s*(?:ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP))?/i);

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
  sourceNotes?: string
): Promise<CreatedAlertResult[]> {
  const candidates = extractPriceAlertCandidates(text);
  if (candidates.length === 0) return [];

  const createdResults: CreatedAlertResult[] = [];

  for (const candidate of candidates) {
    try {
      const resolvedSym = resolveYahooFinanceSymbol(candidate.symbol) || candidate.symbol;

      // 1. Fetch spot market price to determine AUTO condition (ABOVE vs BELOW)
      let currentPrice: number | null = null;
      try {
        const summary = await yahooFinance.quoteSummary(resolvedSym, { modules: ['price'] }).catch(() => null);
        if (summary?.price?.regularMarketPrice != null) {
          currentPrice = Number(summary.price.regularMarketPrice);
        }
      } catch {}

      let finalCondition: 'ABOVE' | 'BELOW' = 'ABOVE';
      if (candidate.condition === 'BELOW' || candidate.condition === 'ABOVE') {
        finalCondition = candidate.condition;
      } else if (currentPrice != null) {
        // If target price is above current price, alert when it rises ABOVE target
        // If target price is below current price, alert when it drops BELOW target
        finalCondition = candidate.targetPrice >= currentPrice ? 'ABOVE' : 'BELOW';
      }

      // 2. Check if identical active alert already exists to prevent duplicate spam
      const existing = await prisma.priceAlert.findFirst({
        where: {
          symbol: resolvedSym,
          targetPrice: candidate.targetPrice,
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

      // 3. Create active price alert in SQLite database
      const newAlert = await prisma.priceAlert.create({
        data: {
          symbol: resolvedSym,
          targetPrice: candidate.targetPrice,
          condition: finalCondition,
          status: 'ACTIVE',
          notes: sourceNotes || `🔔 Auto-created from Log: "${text.trim()}"`,
        },
      });

      console.log(`[Auto Price Alert] Created active alert: ${resolvedSym} ${finalCondition} $${candidate.targetPrice} (Spot: $${currentPrice ?? 'N/A'})`);

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
