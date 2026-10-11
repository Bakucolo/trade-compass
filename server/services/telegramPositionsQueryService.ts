import { PrismaClient } from '@prisma/client';
import { sendTelegramMessage } from './telegramReportService';
import { extractSymbolsFromText } from './thoughtLogAgentService';
import { getPositionsTopicHelp } from './telegramTopicHelpService';

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
  | 'HELP';

export interface ParsedPositionQuery {
  intent: PositionQueryIntent;
  ticker?: string;
  brokerName?: string;
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

// Words that should not be interpreted as tickers
const STOPWORDS = new Set([
  'WHAT', 'WHEN', 'WHERE', 'WHICH', 'WHO', 'WHY', 'HOW', 'SHOW', 'VIEW', 'LIST', 'GET', 'CHECK', 'FIND',
  'MY', 'ALL', 'THE', 'AND', 'FOR', 'ARE', 'CAN', 'YOU', 'HAVE', 'ANY', 'SOME', 'ONE', 'TWO',
  'OPTIONS', 'OPTION', 'EQUITY', 'EQUITIES', 'STOCKS', 'STOCK', 'SHARES', 'SHARE', 'CALLS', 'PUTS',
  'BROKER', 'BROKERS', 'PORTFOLIO', 'SUMMARY', 'BALANCE', 'BALANCES', 'POSITION', 'POSITIONS', 'HOLDING', 'HOLDINGS',
  'HELP', 'INFO', 'STATUS', 'TRADE', 'TRADES', 'ALERT', 'ALERTS', 'TOTAL', 'NET', 'GROSS',
  'TASTYTRADE', 'TASTY', 'TRADING', 'IBKR', 'INTERACTIVE', 'CASH', 'VALUE', 'PROFIT', 'LOSS'
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
    .replace(/#(?:topic:)?positions?\b/gi, '')
    .replace(/^💼\s*/, '')
    .replace(/[?!.]+$/, '')
    .trim();

  const lower = clean.toLowerCase();

  // 1. Help or info
  if (/^(help|\?|commands?|usage|info)$/i.test(lower)) {
    return { intent: 'HELP' };
  }

  // 2. Specific Ticker lookup takes high precedence if query specifies a ticker
  // e.g. "AAPL", "positions in NVDA", "NVDA options", "$PLTR"
  const candidateTicker = extractTickerCandidate(clean);
  if (candidateTicker) {
    return { intent: 'TICKER', ticker: candidateTicker };
  }

  // 3. Options asset class in general
  if (/\b(options?|contracts?|calls?|puts?|option\s+positions?)\b/i.test(lower) && !/\b(equit|stock|share)/i.test(lower)) {
    return { intent: 'OPTIONS' };
  }

  // 4. Equities / Stocks asset class in general
  if (/\b(equities|stocks?|shares?|equity\s+positions?)\b/i.test(lower) && !/\boption/i.test(lower)) {
    return { intent: 'EQUITIES' };
  }

  // 5. Specific Broker query
  if (/\b(tastytrade|tasty)\b/i.test(lower)) {
    return { intent: 'SPECIFIC_BROKER', brokerName: 'Tastytrade' };
  }

  if (/\b(trading\s*212|t212)\b/i.test(lower)) {
    return { intent: 'SPECIFIC_BROKER', brokerName: 'Trading 212' };
  }

  if (/\b(ibkr|interactive\s+brokers?)\b/i.test(lower)) {
    return { intent: 'SPECIFIC_BROKER', brokerName: 'Interactive Brokers' };
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
  const holdings = await prisma.holding.findMany({
    include: { broker: true },
    orderBy: { marketValue: 'desc' },
  });

  let replyText = '';

  switch (parsed.intent) {
    // ==========================================
    // 1. SPECIFIC TICKER QUERY
    // ==========================================
    case 'TICKER': {
      const sym = parsed.ticker!.toUpperCase();

      // Match symbol, underlyingSymbol, or broker-specific ticker
      const matchingHoldings = holdings.filter((h) => {
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

      if (matchingHoldings.length === 0) {
        replyText = `💼 *Positions for $${sym}*\n\n_No open positions found for $${sym} across any connected broker (Tastytrade, Trading 212, Interactive Brokers)._\n\n💡 _Send \`all\`, \`equities\`, \`options\`, or \`brokers\` to review your current portfolio._`;
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
              const strikeStr = h.strikePrice ? `$${h.strikePrice.toFixed(2)}` : '';
              const expStr = h.expiryDate ? `Exp: ${h.expiryDate}` : '';

              return `• *${h.quantity} contract(s)* — *${optSide} ${optType}* ${strikeStr}\n  ${expStr ? `🗓️ ${expStr} | ` : ''}Mark: ${formatMoney(h.currentPrice, curr)}\n  Value: *${formatMoney(h.marketValue, curr)}* | P&L: *${pnlSign}${formatMoney(pnlVal, curr)}*${pnlPct}`;
            } else {
              return `• *${h.quantity.toLocaleString()} share(s)* (Equity)\n  Avg: ${formatMoney(h.averageCost, curr)} | Spot: ${formatMoney(h.currentPrice, curr)}\n  Value: *${formatMoney(h.marketValue, curr)}* | P&L: *${pnlSign}${formatMoney(pnlVal, curr)}*${pnlPct}`;
            }
          }).join('\n\n');

          brokerBlocks.push(`🏛️ *${brokerName}*\n${rows}`);
        }

        const pnlSignTotal = totalPnLUSD >= 0 ? '+' : '';
        const pnlIconTotal = totalPnLUSD >= 0 ? '🟢' : '🔴';

        replyText = `💼 *Positions for $${sym}* (${byBroker.size} broker${byBroker.size === 1 ? '' : 's'})\n\n${brokerBlocks.join('\n\n───────────────\n\n')}\n\n───────────────────────\n📊 *Aggregated Exposure:*\n${totalEquities > 0 ? `• Net Shares: *${totalEquities.toLocaleString()} shares*\n` : ''}${totalOptions > 0 ? `• Options: *${totalOptions} contract(s)*\n` : ''}• Total Market Value: *${formatMoney(totalValueUSD, 'USD')}*\n• Total Unrealized P&L: *${pnlSignTotal}${formatMoney(totalPnLUSD, 'USD')}* ${pnlIconTotal}`;
      }
      break;
    }

    // ==========================================
    // 2. OPTIONS ASSET CLASS
    // ==========================================
    case 'OPTIONS': {
      const optionHoldings = holdings.filter((h) => h.assetType === 'OPTION');

      if (optionHoldings.length === 0) {
        replyText = `⚡ *Options Positions*\n\n_You currently hold no open option contracts across any broker._\n\n💡 _Send \`equities\` to check your stock positions, or send a ticker like \`AAPL\`._`;
      } else {
        let totalVal = 0;
        let totalPnL = 0;

        const rows = optionHoldings.map((h) => {
          totalVal += h.marketValue || 0;
          totalPnL += h.unrealizedPnL || 0;
          const curr = h.currency || 'USD';
          const pnlVal = h.unrealizedPnL || 0;
          const isPos = pnlVal >= 0;
          const pnlIcon = isPos ? '🟢' : '🔴';
          const pnlSign = isPos ? '+' : '';
          const optSide = h.quantity < 0 ? 'Short' : 'Long';
          const optType = h.optionType ? (h.optionType.toUpperCase().includes('C') ? 'Call' : 'Put') : 'Option';
          const strikeStr = h.strikePrice ? `$${h.strikePrice.toFixed(0)}` : '';
          const underlying = getUnderlyingFromSymbol(h.symbol, h.underlyingSymbol);
          const brokerName = h.broker?.name || 'Tastytrade';

          return `• *$${underlying}* — *${h.quantity} ${optSide} ${strikeStr} ${optType}*\n  🏛️ ${brokerName} | Mark: ${formatMoney(h.currentPrice, curr)}\n  Value: *${formatMoney(h.marketValue, curr)}* | P&L: *${pnlSign}${formatMoney(pnlVal, curr)}* ${pnlIcon}`;
        }).join('\n\n');

        const pnlSign = totalPnL >= 0 ? '+' : '';
        const pnlIcon = totalPnL >= 0 ? '🟢' : '🔴';

        replyText = `⚡ *All Option Positions* (${optionHoldings.length} contracts)\n\n${rows}\n\n───────────────────────\n📊 *Options Total:*\n• Total Value: *${formatMoney(totalVal, 'USD')}*\n• Total Unrealized P&L: *${pnlSign}${formatMoney(totalPnL, 'USD')}* ${pnlIcon}`;
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
      const brokerHoldings = holdings.filter((h) =>
        h.broker?.name?.toLowerCase().includes(targetBroker.toLowerCase())
      );

      if (brokerHoldings.length === 0) {
        replyText = `🏛️ *${targetBroker} Positions*\n\n_No open positions recorded for ${targetBroker}._\n\n💡 _Send \`brokers\` to see all brokers with active positions._`;
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
            const strikeStr = h.strikePrice ? `$${h.strikePrice}` : '';
            return `• *$${getUnderlyingFromSymbol(h.symbol, h.underlyingSymbol)}* — *${h.quantity} ${optSide} ${strikeStr} ${optType}*\n  Mark: ${formatMoney(h.currentPrice, curr)} | Val: *${formatMoney(h.marketValue, curr)}* | P&L: *${pnlSign}${formatMoney(pnlVal, curr)}* ${pnlIcon}`;
          } else {
            return `• *$${h.symbol}* — *${h.quantity} shares*\n  Avg: ${formatMoney(h.averageCost, curr)} | Spot: ${formatMoney(h.currentPrice, curr)}\n  Val: *${formatMoney(h.marketValue, curr)}* | P&L: *${pnlSign}${formatMoney(pnlVal, curr)}* ${pnlIcon}`;
          }
        }).join('\n\n');

        const pnlSign = bPnL >= 0 ? '+' : '';
        const pnlIcon = bPnL >= 0 ? '🟢' : '🔴';

        replyText = `🏛️ *${targetBroker} Holdings* (${brokerHoldings.length} positions)\n\n${rows}\n\n───────────────────────\n📊 *Total Value:* *${formatMoney(bVal, 'USD')}* | P&L: *${pnlSign}${formatMoney(bPnL, 'USD')}* ${pnlIcon}`;
      }
      break;
    }

    // ==========================================
    // 6. HELP & QUICK GUIDE
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
