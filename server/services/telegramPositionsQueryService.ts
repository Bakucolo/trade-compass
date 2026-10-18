import { PrismaClient } from '@prisma/client';
import {
  sendTelegramMessage,
  parseOptionExpiryDate,
  formatOptionExpiryDate,
} from './telegramReportService';
import { extractSymbolsFromText } from './thoughtLogAgentService';
import { getPositionsTopicHelp } from './telegramTopicHelpService';
import { parseOccSymbol } from './shortOptionAlertService';

import {
  PositionsReportTimeframe,
  parsePositionsReportTimeframe,
  generateAndSendPositionsPerformanceReport,
} from './telegramPositionsReportService';

const logToFile = (msg: string) => console.log(msg);

export interface PositionQueryRequest {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma: PrismaClient;
}

export type PositionQueryIntent =
  | 'TICKER'
  | 'OPTIONS'
  | 'EQUITIES'
  | 'BROKERS'
  | 'SPECIFIC_BROKER'
  | 'PERFORMANCE_REPORT'
  | 'HELP';

export type OptionSideFilter = 'SHORT' | 'LONG';

export interface ParsedPositionQuery {
  intent: PositionQueryIntent;
  ticker?: string;
  brokerName?: string;
  optionSide?: OptionSideFilter;
  timeframe?: PositionsReportTimeframe;
}

/**
 * Format currency symbol helper
 */
function getCurrencySymbol(curr?: string | null): string {
  if (!curr) return '$';
  const c = curr.toUpperCase();
  if (c === 'GBP' || c === 'GBX') return '£';
  if (c === 'EUR') return '€';
  if (c === 'CAD') return 'C$';
  if (c === 'AUD') return 'A$';
  return '$';
}

function formatMoney(amount: number, curr?: string | null): string {
  const sym = getCurrencySymbol(curr);
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  return `${sign}${sym}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Resolves option expiry date, human-readable format, DTE, and expired status
 */
export function getOptionExpiryAndDte(h: {
  expiryDate?: string | null;
  symbol: string;
  brokerSpecificId?: string;
  description?: string | null;
}): {
  expiryDate: Date | null;
  formattedExpiry: string;
  dte: number | null;
  isExpired: boolean;
} {
  let rawExpiry = h.expiryDate;

  if (!rawExpiry) {
    const parsed =
      parseOccSymbol(h.symbol) ||
      parseOccSymbol(h.brokerSpecificId || '') ||
      (h.description ? parseOccSymbol(h.description) : null);
    if (parsed?.expiryDate) {
      rawExpiry = parsed.expiryDate;
    }
  }

  const expDate = parseOptionExpiryDate(rawExpiry);
  if (!expDate) {
    return {
      expiryDate: null,
      formattedExpiry: 'N/A',
      dte: null,
      isExpired: false,
    };
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const expEnd = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate(), 23, 59, 59, 999).getTime();
  const isExpired = expEnd < todayStart;

  const expStart = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate(), 0, 0, 0, 0).getTime();
  const msPerDay = 1000 * 60 * 60 * 24;
  const dte = Math.max(0, Math.round((expStart - todayStart) / msPerDay));

  const formattedExpiry = formatOptionExpiryDate(rawExpiry);

  return {
    expiryDate: expDate,
    formattedExpiry,
    dte,
    isExpired,
  };
}

// Words that should not be interpreted as tickers
const STOPWORDS = new Set([
  'WHAT', 'WHEN', 'WHERE', 'WHICH', 'WHO', 'WHY', 'HOW', 'SHOW', 'VIEW', 'LIST', 'GET', 'CHECK', 'FIND',
  'MY', 'ALL', 'THE', 'AND', 'FOR', 'ARE', 'CAN', 'YOU', 'HAVE', 'ANY', 'SOME', 'ONE', 'TWO',
  'OPTIONS', 'OPTION', 'EQUITY', 'EQUITIES', 'STOCKS', 'STOCK', 'SHARES', 'SHARE', 'CALLS', 'PUTS', 'CALL', 'PUT', 'CONTRACT', 'CONTRACTS',
  'SHORT', 'SHORTS', 'LONG', 'LONGS',
  'BROKER', 'BROKERS', 'PORTFOLIO', 'SUMMARY', 'BALANCE', 'BALANCES', 'POSITION', 'POSITIONS', 'HOLDING', 'HOLDINGS',
  'HELP', 'INFO', 'STATUS', 'TRADE', 'TRADES', 'ALERT', 'ALERTS', 'TOTAL', 'NET', 'GROSS',
  'TASTYTRADE', 'TASTY', 'TRADING', 'IBKR', 'INTERACTIVE', 'CASH', 'VALUE', 'PROFIT', 'LOSS',
  'WEEKLY', 'MONTHLY', 'ANNUALLY', 'ANNUALY', 'YEARLY', 'REPORT', 'REPORTS', 'PERFORMANCE', 'PDF'
]);

/**
 * Extracts ticker candidate from user query, supporting case-insensitive phrases and $ prefixes
 */
export function extractTickerCandidate(cleanText: string): string | null {
  const clean = cleanText.trim();

  // 1. Explicit dollar prefix, e.g. $AAPL, $NVDA, $PLTR
  const dollarMatch = clean.match(/\$([A-Za-z]{1,6})\b/);
  if (dollarMatch && dollarMatch[1]) {
    const sym = dollarMatch[1].toUpperCase();
    if (!STOPWORDS.has(sym)) return sym;
  }

  // 2. Common phrasing patterns (case-insensitive)
  const patterns = [
    /(?:positions?|holdings?|shares?)\s+(?:in|for|of|on)?\s*\$?([A-Za-z]{1,6})\b/i,
    /\$?([A-Za-z]{1,6})\s+(?:positions?|holdings?|shares?)\b/i,
    /(?:show|view|get|check|find)\s+(?:me\s+)?(?:positions?\s+(?:in|for|of|on)\s+)?\$?([A-Za-z]{1,6})\b/i,
    /(?:do\s+i\s+have|how\s+many|what\s+is\s+my)\s+(?:shares\s+of\s+)?\$?([A-Za-z]{1,6})\b/i,
    /\$?([A-Za-z]{1,6})\s+(?:(?:short|long)\s+)?(?:options?|calls?|puts?|contracts?|shorts?|longs?)\b/i,
    /(?:short|long)\s+(?:options?|calls?|puts?|contracts?)\s+(?:in|for|of|on)?\s*\$?([A-Za-z]{1,6})\b/i,
    /(?:short|long)\s+\$?([A-Za-z]{1,6})\s+(?:options?|calls?|puts?|contracts?|positions?)?\b/i,
    /\$?([A-Za-z]{1,6})\s+(?:options?|calls?|puts?|contracts?)\b/i,
  ];

  for (const pat of patterns) {
    const match = clean.match(pat);
    if (match && match[1]) {
      const sym = match[1].toUpperCase();
      if (!STOPWORDS.has(sym)) return sym;
    }
  }

  // 3. extractSymbolsFromText fallback
  const symbols = extractSymbolsFromText(clean);
  for (const s of symbols) {
    const sym = s.toUpperCase();
    if (!STOPWORDS.has(sym)) return sym;
  }

  // 4. Standalone single ticker word (1-5 letters), e.g. "AAPL", "aapl", "nvda", "tsla"
  const singleWordMatch = clean.match(/^([A-Za-z]{1,5})$/);
  if (singleWordMatch) {
    const sym = singleWordMatch[1].toUpperCase();
    if (!STOPWORDS.has(sym)) return sym;
  }

  return null;
}

/**
 * Resolves the clean underlying symbol from an option ticker or holding symbol
 */
export function getUnderlyingFromSymbol(symbol: string, underlyingSymbol?: string | null): string {
  if (underlyingSymbol) return underlyingSymbol.toUpperCase();
  const occMatch = symbol.match(/^([A-Za-z]+)\d{6}[CPcp]/);
  if (occMatch) return occMatch[1].toUpperCase();
  return symbol.split(/[\s_.]/)[0].toUpperCase();
}

/**
 * Parses user input in the Positions topic to determine query intent
 */
export function parsePositionQuery(rawText: string): ParsedPositionQuery {
  if (!rawText) return { intent: 'HELP' };

  const clean = rawText
    .trim()
    .replace(/#(?:topic:)?(?:positions?|portfolio)\b/gi, '')
    .replace(/^[💼📊📈📉📄]\s*/, '')
    .replace(/[?!.]+$/, '')
    .trim();

  const lower = clean.toLowerCase();

  // 1. Help or info
  if (/^(help|\?|commands?|usage|info)$/i.test(lower)) {
    return { intent: 'HELP' };
  }

  // 2. Positions Performance Report (weekly, monthly, annually)
  const reportTimeframe = parsePositionsReportTimeframe(clean);
  if (reportTimeframe) {
    return {
      intent: 'PERFORMANCE_REPORT',
      timeframe: reportTimeframe,
    };
  }

  // Detect option side preference (Short vs Long)
  let optionSide: OptionSideFilter | undefined;
  const isHowLong = /\bhow\s+long\b/i.test(lower);
  const isShort = /\b(shorts?)\b/i.test(lower);
  const isLong = !isHowLong && /\b(longs?)\b/i.test(lower);

  if (isShort && !isLong) {
    optionSide = 'SHORT';
  } else if (isLong && !isShort) {
    optionSide = 'LONG';
  }

  // 2. Specific Ticker lookup takes high precedence if query specifies a ticker
  // e.g. "AAPL", "positions in NVDA", "NVDA options", "$PLTR", "AAPL short options", "TSLA longs"
  const candidateTicker = extractTickerCandidate(clean);
  if (candidateTicker) {
    return {
      intent: 'TICKER',
      ticker: candidateTicker,
      ...(optionSide ? { optionSide } : {}),
    };
  }

  // 3. Options asset class in general (including short/long options, shorts, longs)
  if (
    (
      /\b(options?|contracts?|calls?|puts?|option\s+positions?)\b/i.test(lower) ||
      /\b(shorts?|longs?)\b/i.test(lower)
    ) &&
    !/\b(equit|stock|share)/i.test(lower)
  ) {
    return {
      intent: 'OPTIONS',
      ...(optionSide ? { optionSide } : {}),
    };
  }

  // 4. Equities / Stocks asset class in general
  if (/\b(equities|stocks?|shares?|equity\s+positions?)\b/i.test(lower) && !/\boption/i.test(lower)) {
    return { intent: 'EQUITIES' };
  }

  // 5. Specific Broker query
  if (/\b(tastytrade|tasty)\b/i.test(lower)) {
    return { intent: 'SPECIFIC_BROKER', brokerName: 'Tastytrade', ...(optionSide ? { optionSide } : {}) };
  }

  if (/\b(trading\s*212|t212)\b/i.test(lower)) {
    return { intent: 'SPECIFIC_BROKER', brokerName: 'Trading 212', ...(optionSide ? { optionSide } : {}) };
  }

  if (/\b(ibkr|interactive\s+brokers?)\b/i.test(lower)) {
    return { intent: 'SPECIFIC_BROKER', brokerName: 'Interactive Brokers', ...(optionSide ? { optionSide } : {}) };
  }

  // 6. Brokers summary or portfolio overview
  if (
    /\b(brokers?|portfolio|summary)\b/i.test(lower) ||
    /^(all|all\s+positions?|my\s+portfolio|show\s+all|list\s+all)$/i.test(lower) ||
    /\b(position|holding|balance)\b/i.test(lower)
  ) {
    return { intent: 'BROKERS' };
  }

  return { intent: 'HELP' };
}

/**
 * Executes a Position query and formats the response for Telegram
 */
export async function handlePositionsTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
}: PositionQueryRequest): Promise<{
  handled: boolean;
  replyText: string;
  intent: PositionQueryIntent;
}> {
  const parsed = parsePositionQuery(text);
  logToFile(`[TelegramPositionsQuery] Executing intent: ${parsed.intent} ${parsed.ticker ? `($${parsed.ticker})` : ''}`);

  // Load all holdings across all brokers
  const rawHoldings = await prisma.holding.findMany({
    include: { broker: true },
    orderBy: { marketValue: 'desc' },
  });

  // Filter out zero-quantity holdings and expired options positions across all workflows
  const holdings = rawHoldings.filter((h) => {
    if (Math.abs(h.quantity) < 0.0001) return false;
    if (h.assetType === 'OPTION') {
      const { isExpired } = getOptionExpiryAndDte(h);
      if (isExpired) return false;
    }
    return true;
  });

  let replyText = '';

  switch (parsed.intent) {
    // ==========================================
    // 1. SPECIFIC TICKER QUERY
    // ==========================================
    case 'TICKER': {
      const sym = parsed.ticker!.toUpperCase();

      // Match symbol, underlyingSymbol, or broker-specific ticker
      let matchingHoldings = holdings.filter((h) => {
        const hSym = h.symbol.toUpperCase();
        const uSym = h.underlyingSymbol?.toUpperCase();
        const extractedUnderlying = getUnderlyingFromSymbol(h.symbol, h.underlyingSymbol);
        return (
          hSym === sym ||
          uSym === sym ||
          extractedUnderlying === sym ||
          hSym.startsWith(sym + ' ') ||
          hSym.startsWith(sym + '_') ||
          hSym.startsWith(sym + '.')
        );
      });

      if (parsed.optionSide) {
        matchingHoldings = matchingHoldings.filter(
          (h) => h.assetType === 'OPTION' && (parsed.optionSide === 'SHORT' ? h.quantity < 0 : h.quantity > 0)
        );
      }

      if (matchingHoldings.length === 0) {
        if (parsed.optionSide) {
          const sideName = parsed.optionSide === 'SHORT' ? 'short' : 'long';
          replyText = `💼 *${parsed.optionSide === 'SHORT' ? 'Short' : 'Long'} Option Positions for $${sym}*\n\n_No open ${sideName} option positions found for $${sym} across any connected broker._\n\n💡 _Send \`$${sym}\` to view all positions for this ticker, or \`options\` to review all option contracts._`;
        } else {
          replyText = `💼 *Positions for $${sym}*\n\n_No open positions found for $${sym} across any connected broker (Tastytrade, Trading 212, Interactive Brokers)._\n\n💡 _Send \`all\`, \`equities\`, \`options\`, or \`brokers\` to review your current portfolio._`;
        }
      } else {
        // Group by broker name
        const byBroker = new Map<string, typeof matchingHoldings>();
        let totalValueUSD = 0;
        let totalPnLUSD = 0;
        let totalEquities = 0;
        let totalOptions = 0;

        for (const h of matchingHoldings) {
          const bName = h.broker?.name || 'Primary Broker';
          if (!byBroker.has(bName)) byBroker.set(bName, []);
          byBroker.get(bName)!.push(h);

          totalValueUSD += h.marketValue || 0;
          totalPnLUSD += h.unrealizedPnL || 0;
          if (h.assetType === 'OPTION') totalOptions += Math.abs(h.quantity);
          else totalEquities += h.quantity;
        }

        const brokerBlocks: string[] = [];
        for (const [brokerName, bHoldings] of byBroker.entries()) {
          const rows = bHoldings.map((h) => {
            const isOption = h.assetType === 'OPTION';
            const curr = h.currency || 'USD';
            const pnlVal = h.unrealizedPnL || 0;
            const isPos = pnlVal >= 0;
            const pnlIcon = isPos ? '🟢' : '🔴';
            const pnlSign = isPos ? '+' : '';
            const pnlPct = h.unrealizedPnLPercent !== undefined && h.unrealizedPnLPercent !== null
              ? ` (${pnlSign}${h.unrealizedPnLPercent.toFixed(2)}% ${pnlIcon})`
              : ` ${pnlIcon}`;

            if (isOption) {
              const optSide = h.quantity < 0 ? 'Short' : 'Long';
              const optType = h.optionType ? (h.optionType.toUpperCase().includes('C') ? 'Call' : 'Put') : 'Option';
              const strikeStr = h.strikePrice ? `$${h.strikePrice % 1 === 0 ? h.strikePrice.toFixed(0) : h.strikePrice.toFixed(2)}` : '';
              const { formattedExpiry, dte } = getOptionExpiryAndDte(h);
              const dteStr = dte !== null ? `${dte} DTE` : '';
              const expStr = formattedExpiry !== 'N/A' ? `🗓️ Exp: ${formattedExpiry}${dteStr ? ` (${dteStr})` : ''}` : '';

              return `• *${h.quantity} contract(s)* — *${optSide} ${optType}* ${strikeStr}\n  ${expStr ? `${expStr} | ` : ''}Mark: ${formatMoney(h.currentPrice, curr)}\n  Value: *${formatMoney(h.marketValue, curr)}* | P&L: *${pnlSign}${formatMoney(pnlVal, curr)}*${pnlPct}`;
            } else {
              return `• *${h.quantity.toLocaleString()} share(s)* (Equity)\n  Avg: ${formatMoney(h.averageCost, curr)} | Spot: ${formatMoney(h.currentPrice, curr)}\n  Value: *${formatMoney(h.marketValue, curr)}* | P&L: *${pnlSign}${formatMoney(pnlVal, curr)}*${pnlPct}`;
            }
          }).join('\n\n');

          brokerBlocks.push(`🏛️ *${brokerName}*\n${rows}`);
        }

        const pnlSignTotal = totalPnLUSD >= 0 ? '+' : '';
        const pnlIconTotal = totalPnLUSD >= 0 ? '🟢' : '🔴';
        const sidePrefix = parsed.optionSide ? `${parsed.optionSide === 'SHORT' ? 'Short ' : 'Long '}Option ` : '';

        replyText = `💼 *${sidePrefix}Positions for $${sym}* (${byBroker.size} broker${byBroker.size === 1 ? '' : 's'})\n\n${brokerBlocks.join('\n\n───────────────\n\n')}\n\n───────────────────────\n📊 *Aggregated Exposure:*\n${totalEquities > 0 ? `• Net Shares: *${totalEquities.toLocaleString()} shares*\n` : ''}${totalOptions > 0 ? `• Options: *${totalOptions} contract(s)*\n` : ''}• Total Market Value: *${formatMoney(totalValueUSD, 'USD')}*\n• Total Unrealized P&L: *${pnlSignTotal}${formatMoney(totalPnLUSD, 'USD')}* ${pnlIconTotal}`;
      }
      break;
    }

    // ==========================================
    // 2. OPTIONS ASSET CLASS
    // ==========================================
    case 'OPTIONS': {
      let optionHoldings = holdings.filter((h) => h.assetType === 'OPTION');

      if (parsed.optionSide === 'SHORT') {
        optionHoldings = optionHoldings.filter((h) => h.quantity < 0);
      } else if (parsed.optionSide === 'LONG') {
        optionHoldings = optionHoldings.filter((h) => h.quantity > 0);
      }

      const sideLabel = parsed.optionSide === 'SHORT' ? 'Short ' : parsed.optionSide === 'LONG' ? 'Long ' : '';

      if (optionHoldings.length === 0) {
        if (parsed.optionSide === 'SHORT') {
          replyText = `⚡ *Active Short Option Positions*\n\n_You currently hold no open short option contracts across any broker._\n\n💡 _Send \`options\` to review all options, or \`long options\` for long contracts._`;
        } else if (parsed.optionSide === 'LONG') {
          replyText = `⚡ *Active Long Option Positions*\n\n_You currently hold no open long option contracts across any broker._\n\n💡 _Send \`options\` to review all options, or \`short options\` for short contracts._`;
        } else {
          replyText = `⚡ *Active Options Positions*\n\n_You currently hold no open active option contracts across any broker._\n\n💡 _Send \`equities\` to check your stock positions, or send a ticker like \`AAPL\`._`;
        }
      } else {
        let totalVal = 0;
        let totalPnL = 0;

        // Sort by DTE ascending (nearest expiration contracts first for optimal risk monitoring)
        const sortedOptions = [...optionHoldings].sort((a, b) => {
          const dteA = getOptionExpiryAndDte(a).dte ?? 9999;
          const dteB = getOptionExpiryAndDte(b).dte ?? 9999;
          return dteA - dteB;
        });

        const rows = sortedOptions.map((h) => {
          totalVal += h.marketValue || 0;
          totalPnL += h.unrealizedPnL || 0;
          const curr = h.currency || 'USD';
          const pnlVal = h.unrealizedPnL || 0;
          const isPos = pnlVal >= 0;
          const pnlIcon = isPos ? '🟢' : '🔴';
          const pnlSign = isPos ? '+' : '';
          const optSide = h.quantity < 0 ? 'Short' : 'Long';
          const optType = h.optionType ? (h.optionType.toUpperCase().includes('C') ? 'Call' : 'Put') : 'Option';
          const strikeStr = h.strikePrice ? `$${h.strikePrice % 1 === 0 ? h.strikePrice.toFixed(0) : h.strikePrice.toFixed(2)}` : '';
          const underlying = getUnderlyingFromSymbol(h.symbol, h.underlyingSymbol);
          const brokerName = h.broker?.name || 'Tastytrade';
          const { formattedExpiry, dte } = getOptionExpiryAndDte(h);
          const dteStr = dte !== null ? `${dte} DTE` : '';
          const expStr = formattedExpiry !== 'N/A' ? `🗓️ ${formattedExpiry}${dteStr ? ` (${dteStr})` : ''}` : '';

          return `• *$${underlying}* — *${h.quantity} ${optSide} ${strikeStr} ${optType}*\n  🏛️ ${brokerName}${expStr ? ` | ${expStr}` : ''}\n  Mark: ${formatMoney(h.currentPrice, curr)} | Value: *${formatMoney(h.marketValue, curr)}* | P&L: *${pnlSign}${formatMoney(pnlVal, curr)}* ${pnlIcon}`;
        }).join('\n\n');

        const pnlSign = totalPnL >= 0 ? '+' : '';
        const pnlIcon = totalPnL >= 0 ? '🟢' : '🔴';

        replyText = `⚡ *Active ${sideLabel}Option Positions* (${sortedOptions.length} contract${sortedOptions.length === 1 ? '' : 's'})\n\n${rows}\n\n───────────────────────\n📊 *${sideLabel}Options Total:*\n• Total Value: *${formatMoney(totalVal, 'USD')}*\n• Total Unrealized P&L: *${pnlSign}${formatMoney(totalPnL, 'USD')}* ${pnlIcon}`;
      }
      break;
    }

    // ==========================================
    // 3. EQUITIES ASSET CLASS
    // ==========================================
    case 'EQUITIES': {
      const equityHoldings = holdings.filter((h) => h.assetType === 'EQUITY');

      if (equityHoldings.length === 0) {
        replyText = `📈 *Equity Positions*\n\n_You currently hold no open stock/equity shares across any broker._\n\n💡 _Send \`options\` to review option contracts, or \`brokers\` for balance summaries._`;
      } else {
        let totalVal = 0;
        let totalPnL = 0;

        const rows = equityHoldings.map((h) => {
          totalVal += h.marketValue || 0;
          totalPnL += h.unrealizedPnL || 0;
          const curr = h.currency || 'USD';
          const pnlVal = h.unrealizedPnL || 0;
          const isPos = pnlVal >= 0;
          const pnlIcon = isPos ? '🟢' : '🔴';
          const pnlSign = isPos ? '+' : '';
          const brokerName = h.broker?.name || 'Primary Broker';
          const sym = h.symbol.toUpperCase();

          return `• *$${sym}* — *${h.quantity.toLocaleString()} shares* (${brokerName})\n  Avg: ${formatMoney(h.averageCost, curr)} | Spot: ${formatMoney(h.currentPrice, curr)}\n  Value: *${formatMoney(h.marketValue, curr)}* | P&L: *${pnlSign}${formatMoney(pnlVal, curr)}* ${pnlIcon}`;
        }).join('\n\n');

        const pnlSign = totalPnL >= 0 ? '+' : '';
        const pnlIcon = totalPnL >= 0 ? '🟢' : '🔴';

        replyText = `📈 *All Stock / Equity Positions* (${equityHoldings.length} positions)\n\n${rows}\n\n───────────────────────\n📊 *Equities Total:*\n• Total Value: *${formatMoney(totalVal, 'USD')}*\n• Total Unrealized P&L: *${pnlSign}${formatMoney(totalPnL, 'USD')}* ${pnlIcon}`;
      }
      break;
    }

    // ==========================================
    // 4. BROKERS SUMMARY / ALL PORTFOLIO
    // ==========================================
    case 'BROKERS': {
      const brokers = await prisma.broker.findMany();
      if (holdings.length === 0) {
        replyText = `🏛️ *Broker Portfolio Summary*\n\n_No open positions recorded in the database._\n\nConnected Brokers: ${brokers.map(b => `*${b.name}*`).join(', ') || 'None'}`;
      } else {
        const byBroker = new Map<string, { count: number; value: number; pnl: number; equities: number; options: number; items: typeof holdings }>();

        let grandValue = 0;
        let grandPnL = 0;

        for (const h of holdings) {
          const bName = h.broker?.name || 'Other Broker';
          if (!byBroker.has(bName)) {
            byBroker.set(bName, { count: 0, value: 0, pnl: 0, equities: 0, options: 0, items: [] });
          }
          const b = byBroker.get(bName)!;
          b.count++;
          b.value += h.marketValue || 0;
          b.pnl += h.unrealizedPnL || 0;
          if (h.assetType === 'OPTION') b.options++;
          else b.equities++;
          b.items.push(h);

          grandValue += h.marketValue || 0;
          grandPnL += h.unrealizedPnL || 0;
        }

        const brokerCards = Array.from(byBroker.entries()).map(([name, data]) => {
          const pnlSign = data.pnl >= 0 ? '+' : '';
          const pnlIcon = data.pnl >= 0 ? '🟢' : '🔴';
          const topTickers = data.items.slice(0, 5).map(i => `$${getUnderlyingFromSymbol(i.symbol, i.underlyingSymbol)}`).join(' • ');

          return `🏛️ *${name}* (${data.count} positions)\n• Equities: *${data.equities}* | Options: *${data.options}*\n• Value: *${formatMoney(data.value, 'USD')}* | P&L: *${pnlSign}${formatMoney(data.pnl, 'USD')}* ${pnlIcon}\n• Holdings: ${topTickers}${data.items.length > 5 ? '...' : ''}`;
        }).join('\n\n');

        const pnlSignGrand = grandPnL >= 0 ? '+' : '';
        const pnlIconGrand = grandPnL >= 0 ? '🟢' : '🔴';

        replyText = `💼 *Unified Broker Portfolio Summary*\n\n${brokerCards}\n\n───────────────────────\n📊 *Grand Portfolio Totals:*\n• Total Positions: *${holdings.length} across ${byBroker.size} brokers*\n• Total Portfolio Value: *${formatMoney(grandValue, 'USD')}*\n• Total Unrealized P&L: *${pnlSignGrand}${formatMoney(grandPnL, 'USD')}* ${pnlIconGrand}\n\n💡 _Ask for a specific ticker (e.g. \`AAPL\`, \`NVDA\`) or asset class (\`options\`, \`equities\`)!_`;
      }
      break;
    }

    // ==========================================
    // 5. SPECIFIC BROKER QUERY
    // ==========================================
    case 'SPECIFIC_BROKER': {
      const targetBroker = parsed.brokerName!;
      let brokerHoldings = holdings.filter((h) =>
        h.broker?.name?.toLowerCase().includes(targetBroker.toLowerCase())
      );

      if (parsed.optionSide) {
        brokerHoldings = brokerHoldings.filter(
          (h) => h.assetType === 'OPTION' && (parsed.optionSide === 'SHORT' ? h.quantity < 0 : h.quantity > 0)
        );
      }

      const sidePrefix = parsed.optionSide ? `${parsed.optionSide === 'SHORT' ? 'Short ' : 'Long '}Option ` : '';

      if (brokerHoldings.length === 0) {
        replyText = `🏛️ *${targetBroker} ${sidePrefix}Holdings*\n\n_No open ${parsed.optionSide ? `${parsed.optionSide.toLowerCase()} option ` : ''}positions recorded for ${targetBroker}._\n\n💡 _Send \`brokers\` to see all brokers with active positions._`;
      } else {
        let bVal = 0;
        let bPnL = 0;

        const rows = brokerHoldings.map((h) => {
          bVal += h.marketValue || 0;
          bPnL += h.unrealizedPnL || 0;
          const curr = h.currency || 'USD';
          const pnlVal = h.unrealizedPnL || 0;
          const isPos = pnlVal >= 0;
          const pnlIcon = isPos ? '🟢' : '🔴';
          const pnlSign = isPos ? '+' : '';
          const isOption = h.assetType === 'OPTION';

          if (isOption) {
            const optSide = h.quantity < 0 ? 'Short' : 'Long';
            const optType = h.optionType || 'Option';
            const strikeStr = h.strikePrice ? `$${h.strikePrice % 1 === 0 ? h.strikePrice.toFixed(0) : h.strikePrice.toFixed(2)}` : '';
            const { formattedExpiry, dte } = getOptionExpiryAndDte(h);
            const dteStr = dte !== null ? `${dte} DTE` : '';
            const expStr = formattedExpiry !== 'N/A' ? `🗓️ ${formattedExpiry}${dteStr ? ` (${dteStr})` : ''}` : '';

            return `• *$${getUnderlyingFromSymbol(h.symbol, h.underlyingSymbol)}* — *${h.quantity} ${optSide} ${strikeStr} ${optType}*\n  ${expStr ? `${expStr} | ` : ''}Mark: ${formatMoney(h.currentPrice, curr)} | Val: *${formatMoney(h.marketValue, curr)}* | P&L: *${pnlSign}${formatMoney(pnlVal, curr)}* ${pnlIcon}`;
          } else {
            return `• *$${h.symbol}* — *${h.quantity} shares*\n  Avg: ${formatMoney(h.averageCost, curr)} | Spot: ${formatMoney(h.currentPrice, curr)}\n  Val: *${formatMoney(h.marketValue, curr)}* | P&L: *${pnlSign}${formatMoney(pnlVal, curr)}* ${pnlIcon}`;
          }
        }).join('\n\n');

        const pnlSign = bPnL >= 0 ? '+' : '';
        const pnlIcon = bPnL >= 0 ? '🟢' : '🔴';

        replyText = `🏛️ *${targetBroker} ${sidePrefix}Holdings* (${brokerHoldings.length} positions)\n\n${rows}\n\n───────────────────────\n📊 *Total Value:* *${formatMoney(bVal, 'USD')}* | P&L: *${pnlSign}${formatMoney(bPnL, 'USD')}* ${pnlIcon}`;
      }
      break;
    }

    // ==========================================
    // 6. POSITIONS PERFORMANCE PDF REPORT
    // ==========================================
    case 'PERFORMANCE_REPORT': {
      const tf = parsed.timeframe || 'WEEKLY';
      const tfLabel = tf === 'WEEKLY' ? 'Weekly' : tf === 'MONTHLY' ? 'Monthly' : 'Annual';

      // 1. Send immediate progress acknowledgment
      if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
        await sendTelegramMessage({
          text: `📊 *Generating ${tfLabel} Positions Performance Report (PDF)...*\n\n_Auditing ${holdings.length} open positions across Tastytrade, IBKR, and Trading 212. Analyzing performance, P&L, and asset allocation. Dispatching PDF to this topic momentarily!_ ⏳`,
          chatId,
          messageThreadId,
          parseMode: 'Markdown',
        }).catch(() => null);
      }

      // 2. Generate and dispatch PDF with summary caption
      const reportRes = await generateAndSendPositionsPerformanceReport({
        prisma,
        chatId,
        messageThreadId,
        timeframe: tf,
      });

      return {
        handled: true,
        replyText: reportRes.summaryText,
        intent: 'PERFORMANCE_REPORT',
      };
    }

    // ==========================================
    // 7. HELP & QUICK GUIDE
    // ==========================================
    default: {
      replyText = getPositionsTopicHelp();
      break;
    }
  }

  if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
    await sendTelegramMessage({
      text: replyText,
      chatId,
      messageThreadId,
      parseMode: 'Markdown',
    }).catch((e: any) => logToFile(`[TelegramPositionsQuery] Send message error: ${e.message}`));
  }

  return {
    handled: true,
    replyText,
    intent: parsed.intent,
  };
}
