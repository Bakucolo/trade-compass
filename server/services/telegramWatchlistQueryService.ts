import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';
import { sendTelegramMessage } from './telegramReportService';
import { generateJsonCompletion } from './llmFallbackRouter';
import { resolveYahooFinanceSymbol } from './tickerResolutionService';
import { isTopicHelpRequest, getWatchlistTopicHelp } from './telegramTopicHelpService';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
const logToFile = (msg: string) => console.log(msg);

export interface WatchlistCriteriaFilter {
  minPe?: number;
  maxPe?: number;
  minPrice?: number;
  maxPrice?: number;
  direction?: 'UP' | 'DOWN' | 'ALL';
  minChangePercent?: number;
  maxChangePercent?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  sortBy?: 'pe' | 'price' | 'change' | 'mcap';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  rawCriteriaText?: string;
}

export interface WatchlistStockWithQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number | null;
  pe: number | null;
  sector?: string;
  industry?: string;
  error?: string;
}

/**
 * Checks if incoming message is a command to list all watchlists
 */
export function isListAllWatchlistsQuery(rawText: string): boolean {
  if (!rawText) return false;
  const clean = rawText
    .trim()
    .toLowerCase()
    .replace(/^[/#]/, '')
    .replace(/^📋\s*/, '')
    .replace(/[?!.]+$/, '')
    .trim();

  // Single keywords or short commands
  if (/^(watchlists?|lists?|all|show\s+all|list\s+all|my\s+watchlists?|all\s+watchlists?)$/i.test(clean)) {
    return true;
  }

  // Commands starting with verb or query prefix
  if (/^(show|get|list|display|view|see|give\s+me)\s+(all\s+)?(my\s+)?watchlists?/i.test(clean)) {
    return true;
  }

  // Question phrasing: "what watchlists do I have?", "what are my watchlists?"
  if (/^what\s+(are\s+)?(all\s+)?(my\s+)?watchlists?/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Extracts multiplier for market cap string (e.g. 500B -> 500e9, 2T -> 2e12, 50M -> 50e6)
 */
function parseCapValue(numStr: string, unitStr?: string): number {
  const base = parseFloat(numStr);
  if (isNaN(base)) return 0;
  const u = (unitStr || '').toLowerCase();
  if (u === 't') return base * 1e12;
  if (u === 'b') return base * 1e9;
  if (u === 'm') return base * 1e6;
  if (u === 'k') return base * 1e3;
  // If unit wasn't attached, check if base is already huge or assumed B if >= 1 && <= 5000
  if (base < 10000) return base * 1e9; // default assumes billions
  return base;
}

/**
 * Extracts structured criteria filter from freeform query text
 */
export function parseCriteriaFilter(queryText: string): WatchlistCriteriaFilter {
  const filter: WatchlistCriteriaFilter = {
    rawCriteriaText: queryText.trim(),
  };

  const text = queryText.toLowerCase();

  // 1. P/E ratio
  // E.g. "pe < 30", "p/e < 30", "pe under 25", "pe below 20", "pe <= 15"
  const peMaxMatch = text.match(/(?:p\/e|pe)\s*(?:<=?|<|under|below|less\s+than)\s*(\d+(?:\.\d+)?)/i);
  if (peMaxMatch) {
    filter.maxPe = parseFloat(peMaxMatch[1]);
  }

  // E.g. "pe > 20", "p/e >= 20", "pe above 15", "pe over 15"
  const peMinMatch = text.match(/(?:p\/e|pe)\s*(?:>=?|>|above|over|more\s+than|greater\s+than)\s*(\d+(?:\.\d+)?)/i);
  if (peMinMatch) {
    filter.minPe = parseFloat(peMinMatch[1]);
  }

  // E.g. "pe between 15 and 30"
  const peBetweenMatch = text.match(/(?:p\/e|pe)\s*between\s*(\d+(?:\.\d+)?)\s*and\s*(\d+(?:\.\d+)?)/i);
  if (peBetweenMatch) {
    filter.minPe = parseFloat(peBetweenMatch[1]);
    filter.maxPe = parseFloat(peBetweenMatch[2]);
  }

  // 2. Price
  // E.g. "price < 100", "price under $150", "price <= 50", "under $100", "< $100"
  const priceMaxMatch = text.match(/(?:price\s*)?(?:<=?|<|under|below)\s*\$?(\d+(?:\.\d+)?)/i);
  if (priceMaxMatch && !peMaxMatch) {
    // Ensure this wasn't matching PE or change
    const val = parseFloat(priceMaxMatch[1]);
    if (!text.includes(`pe ${priceMaxMatch[0]}`) && !text.includes(`p/e ${priceMaxMatch[0]}`)) {
      filter.maxPrice = val;
    }
  }

  // E.g. "price > 50", "price above $50", "above 50"
  const priceMinMatch = text.match(/(?:price\s*)?(?:>=?|>|above|over)\s*\$?(\d+(?:\.\d+)?)/i);
  if (priceMinMatch && !peMinMatch) {
    const val = parseFloat(priceMinMatch[1]);
    if (!text.includes(`pe ${priceMinMatch[0]}`) && !text.includes(`p/e ${priceMinMatch[0]}`)) {
      filter.minPrice = val;
    }
  }

  // 3. Day Change / Direction
  if (/\b(green|up\s+today|positive|gainers?)\b/i.test(text)) {
    filter.direction = 'UP';
    filter.minChangePercent = 0;
  } else if (/\b(red|down\s+today|negative|losers?|dips?)\b/i.test(text)) {
    filter.direction = 'DOWN';
    filter.maxChangePercent = 0;
  }

  // Specific change threshold: "up > 2%", "change > 3%", "gain > 1%"
  const changeUpMatch = text.match(/(?:up|change|gain)\s*(?:>=?|>)\s*(\d+(?:\.\d+)?)%?/i);
  if (changeUpMatch) {
    filter.direction = 'UP';
    filter.minChangePercent = parseFloat(changeUpMatch[1]);
  }

  // "down > 2%", "change < -2%", "drop > 3%"
  const changeDownMatch = text.match(/(?:down|drop|dip)\s*(?:>=?|>)\s*(\d+(?:\.\d+)?)%?/i);
  if (changeDownMatch) {
    filter.direction = 'DOWN';
    filter.maxChangePercent = -Math.abs(parseFloat(changeDownMatch[1]));
  }

  // 4. Market Cap
  // E.g. "mcap > 100B", "market cap > 500B", "mcap under 2T"
  const mcapMinMatch = text.match(/(?:mcap|market\s*cap)\s*(?:>=?|>|above|over)\s*\$?(\d+(?:\.\d+)?)\s*([tmbk])?/i);
  if (mcapMinMatch) {
    filter.minMarketCap = parseCapValue(mcapMinMatch[1], mcapMinMatch[2]);
  }

  const mcapMaxMatch = text.match(/(?:mcap|market\s*cap)\s*(?:<=?|<|under|below)\s*\$?(\d+(?:\.\d+)?)\s*([tmbk])?/i);
  if (mcapMaxMatch) {
    filter.maxMarketCap = parseCapValue(mcapMaxMatch[1], mcapMaxMatch[2]);
  }

  if (/\bmega\s*cap\b/i.test(text)) {
    filter.minMarketCap = 200e9;
  } else if (/\blarge\s*cap\b/i.test(text)) {
    filter.minMarketCap = 10e9;
    filter.maxMarketCap = 200e9;
  } else if (/\bmid\s*cap\b/i.test(text)) {
    filter.minMarketCap = 2e9;
    filter.maxMarketCap = 10e9;
  } else if (/\bsmall\s*cap\b/i.test(text)) {
    filter.maxMarketCap = 2e9;
  }

  // 5. Sorting
  if (/\b(lowest\s+pe|cheapest\s+pe|lowest\s+valuation)\b/i.test(text)) {
    filter.sortBy = 'pe';
    filter.sortOrder = 'asc';
  } else if (/\b(highest\s+pe|most\s+expensive)\b/i.test(text)) {
    filter.sortBy = 'pe';
    filter.sortOrder = 'desc';
  } else if (/\b(best\s+performers?|top\s+gainers?|highest\s+return)\b/i.test(text)) {
    filter.sortBy = 'change';
    filter.sortOrder = 'desc';
  } else if (/\b(biggest\s+dip|worst\s+performers?|top\s+losers?)\b/i.test(text)) {
    filter.sortBy = 'change';
    filter.sortOrder = 'asc';
  } else if (/\b(highest\s+mcap|biggest\s+companies)\b/i.test(text)) {
    filter.sortBy = 'mcap';
    filter.sortOrder = 'desc';
  }

  // 6. Limit
  const topMatch = text.match(/\btop\s+(\d+)\b/i);
  if (topMatch) {
    filter.limit = parseInt(topMatch[1], 10);
  }

  return filter;
}

/**
 * Evaluates whether a stock meets the parsed criteria
 */
export function matchesStockCriteria(stock: WatchlistStockWithQuote, filter: WatchlistCriteriaFilter): boolean {
  // P/E checks
  if (filter.minPe !== undefined) {
    if (stock.pe === null || stock.pe === undefined || stock.pe < filter.minPe) return false;
  }
  if (filter.maxPe !== undefined) {
    // Only accept positive P/E <= maxPe
    if (stock.pe === null || stock.pe === undefined || stock.pe <= 0 || stock.pe > filter.maxPe) return false;
  }

  // Price checks
  if (filter.minPrice !== undefined) {
    if (stock.price < filter.minPrice) return false;
  }
  if (filter.maxPrice !== undefined) {
    if (stock.price > filter.maxPrice) return false;
  }

  // Direction & Day Change checks
  if (filter.direction === 'UP') {
    const threshold = filter.minChangePercent !== undefined ? filter.minChangePercent : 0;
    if (stock.changePercent < threshold) return false;
  }
  if (filter.direction === 'DOWN') {
    const threshold = filter.maxChangePercent !== undefined ? filter.maxChangePercent : 0;
    if (stock.changePercent > threshold) return false;
  }

  // Market Cap checks
  if (filter.minMarketCap !== undefined) {
    if (!stock.marketCap || stock.marketCap < filter.minMarketCap) return false;
  }
  if (filter.maxMarketCap !== undefined) {
    if (!stock.marketCap || stock.marketCap > filter.maxMarketCap) return false;
  }

  return true;
}

/**
 * Format Market Cap helper
 */
function formatMarketCap(cap?: number | null): string {
  if (!cap) return 'N/A';
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  return `$${cap.toLocaleString()}`;
}

/**
 * Formats a clean criteria summary label for Telegram
 */
function describeFilter(filter: WatchlistCriteriaFilter): string {
  const parts: string[] = [];
  if (filter.maxPe !== undefined && filter.minPe !== undefined) {
    parts.push(`P/E: ${filter.minPe} - ${filter.maxPe}`);
  } else if (filter.maxPe !== undefined) {
    parts.push(`P/E < ${filter.maxPe}`);
  } else if (filter.minPe !== undefined) {
    parts.push(`P/E > ${filter.minPe}`);
  }

  if (filter.maxPrice !== undefined && filter.minPrice !== undefined) {
    parts.push(`Price: $${filter.minPrice} - $${filter.maxPrice}`);
  } else if (filter.maxPrice !== undefined) {
    parts.push(`Price < $${filter.maxPrice}`);
  } else if (filter.minPrice !== undefined) {
    parts.push(`Price > $${filter.minPrice}`);
  }

  if (filter.direction === 'UP') {
    parts.push(filter.minChangePercent ? `Gain > ${filter.minChangePercent}%` : `Green / Up Today`);
  } else if (filter.direction === 'DOWN') {
    parts.push(filter.maxChangePercent ? `Drop > ${Math.abs(filter.maxChangePercent)}%` : `Red / Dip`);
  }

  if (filter.minMarketCap) {
    parts.push(`MCap > ${formatMarketCap(filter.minMarketCap)}`);
  }
  if (filter.maxMarketCap) {
    parts.push(`MCap < ${formatMarketCap(filter.maxMarketCap)}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'All Stocks';
}

/**
 * Fetches real-time quote metrics for a list of symbols in parallel
 */
export async function enrichSymbolsWithQuotes(symbols: string[]): Promise<WatchlistStockWithQuote[]> {
  const cleanSymbols = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).filter(Boolean);

  const results = await Promise.all(
    cleanSymbols.map(async (rawSym): Promise<WatchlistStockWithQuote> => {
      const querySym = resolveYahooFinanceSymbol(rawSym) || rawSym;
      try {
        const quote: any = await yahooFinance.quote(querySym, {}, { validateResult: false }).catch(() => null);
        if (quote && quote.regularMarketPrice !== undefined) {
          return {
            symbol: rawSym,
            name: quote.shortName || quote.longName || rawSym,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange ?? 0,
            changePercent: quote.regularMarketChangePercent ?? 0,
            marketCap: quote.marketCap ?? null,
            pe: quote.trailingPE || quote.forwardPE || null,
            sector: quote.sector,
            industry: quote.industry,
          };
        }
      } catch (e) {
        // Fallback below
      }

      return {
        symbol: rawSym,
        name: rawSym,
        price: 0,
        change: 0,
        changePercent: 0,
        marketCap: null,
        pe: null,
        error: 'Price unavailable',
      };
    })
  );

  return results;
}

/**
 * Primary Router for Watchlist Topic Messages:
 * 1. "Get all watchlists"
 * 2. "Query specific watchlist stocks with criteria"
 */
export async function handleWatchlistTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
}: {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma: PrismaClient;
}): Promise<{
  handled: boolean;
  replyText?: string;
  actionTaken: 'LIST_ALL' | 'CRITERIA_QUERY' | 'NOT_QUERY' | 'HELP';
}> {
  if (!text || !text.trim()) {
    return { handled: false, actionTaken: 'NOT_QUERY' };
  }

  const cleanText = text
    .replace(/#(?:topic:)?(?:watchlist|watch)\b/gi, '')
    .replace(/^📋\s*/, '')
    .trim();

  // ===================================================
  // 0. INTENT: HELP & INSTRUCTIONS
  // ===================================================
  if (isTopicHelpRequest(cleanText)) {
    logToFile(`[TelegramWatchlistQuery] Executing HELP intent`);
    const helpMsg = getWatchlistTopicHelp();

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: helpMsg,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramWatchlistQuery] Send help error: ${e.message}`));
    }

    return { handled: true, replyText: helpMsg, actionTaken: 'HELP' };
  }

  // ===================================================
  // 1. INTENT: GET ALL WATCHLISTS
  // ===================================================
  if (isListAllWatchlistsQuery(cleanText)) {
    logToFile(`[TelegramWatchlistQuery] Executing LIST_ALL_WATCHLISTS intent`);

    const watchlists = await prisma.watchlist.findMany({
      include: {
        items: {
          orderBy: { addedAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    let replyMsg = '';
    if (watchlists.length === 0) {
      replyMsg = `📋 *Trade Compass Watchlists*\n\n_You do not have any watchlists yet._\n\n💡 *Tip:* Send a theme name like \`Semiconductors\` or \`Nuclear Energy\` and the AI Agent will curate it for you!`;
    } else {
      const listRows = watchlists.map((w, idx) => {
        const count = w.items?.length || 0;
        const tickersSample = w.items && w.items.length > 0
          ? w.items.slice(0, 5).map((i) => `\`${i.symbol}\``).join(' • ') + (w.items.length > 5 ? '...' : '')
          : '_Empty_';
        return `${idx + 1}️⃣ *${w.name}* (${count} stock${count === 1 ? '' : 's'})\n   ${tickersSample}`;
      }).join('\n\n');

      replyMsg = `📋 *Your Trade Compass Watchlists* (${watchlists.length} lists)\n\n${listRows}\n\n───────────────────────\n💡 *Query specific watchlists:*
• \`show Semiconductors\`
• \`Semiconductors PE < 30\`
• \`Nuclear price > 50\`
• \`Tech up today\` or \`Tech dip\`
• \`[Watchlist Name] [TICKERS...]\` to add stocks`;
    }

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyMsg,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramWatchlistQuery] Send list error: ${e.message}`));
    }

    return { handled: true, replyText: replyMsg, actionTaken: 'LIST_ALL' };
  }

  // ===================================================
  // 2. INTENT: QUERY SPECIFIC WATCHLIST & CRITERIA
  // ===================================================
  // Load all existing watchlists to see if the message targets one
  const allWatchlists = await prisma.watchlist.findMany({
    include: {
      items: {
        orderBy: { addedAt: 'asc' },
      },
    },
  });

  if (allWatchlists.length === 0) {
    return { handled: false, actionTaken: 'NOT_QUERY' };
  }

  // Strip leading query keywords like "show", "get", "view", "list", "filter"
  const strippedText = cleanText.replace(/^(show|get|view|list|see|filter)\s+/i, '').trim();

  // Try to match against an existing watchlist name (longest name match first)
  const sortedWatchlists = [...allWatchlists].sort((a, b) => b.name.length - a.name.length);

  let matchedWatchlist: (typeof allWatchlists)[0] | null = null;
  let remainingQuery = '';

  for (const wl of sortedWatchlists) {
    const wlLower = wl.name.toLowerCase();
    const textLower = strippedText.toLowerCase();

    // Check if strippedText starts with or matches watchlist name
    if (textLower === wlLower) {
      matchedWatchlist = wl;
      remainingQuery = '';
      break;
    } else if (textLower.startsWith(wlLower + ' ') || textLower.startsWith(wlLower + ':')) {
      matchedWatchlist = wl;
      remainingQuery = strippedText.slice(wl.name.length).replace(/^[:\s]+/, '').trim();
      break;
    } else if (textLower.includes(`in ${wlLower}`) || textLower.includes(`for ${wlLower}`) || textLower.includes(`from ${wlLower}`)) {
      matchedWatchlist = wl;
      remainingQuery = strippedText.replace(new RegExp(`(?:in|for|from)\\s+${wlLower}`, 'i'), '').trim();
      break;
    }
  }

  // If no direct prefix match, check if cleanText mentions the watchlist name anywhere
  if (!matchedWatchlist) {
    for (const wl of sortedWatchlists) {
      const wlLower = wl.name.toLowerCase();
      if (cleanText.toLowerCase().includes(wlLower)) {
        matchedWatchlist = wl;
        remainingQuery = cleanText.replace(new RegExp(`\\b${wl.name}\\b`, 'i'), '').trim();
        break;
      }
    }
  }

  // Check if this is an "ADD STOCKS" command rather than a query
  // E.g. "Semiconductors NVDA TSM AMD" without comparison operators (<, >, under, pe, mcap, etc.)
  if (matchedWatchlist && remainingQuery) {
    const hasComparison = /[<>=]|under|below|above|over|between|pe\b|mcap|market\s*cap|green|red|up\b|down\b|dip|gain/i.test(remainingQuery);
    const tokens = remainingQuery.split(/[\s,]+/).filter(Boolean);
    const isPureTickers = tokens.length > 0 && tokens.every((t) => /^\$?[A-Za-z]{1,5}$/.test(t));

    // If user provided pure tickers without filter operators, defer to the existing ADD STOCKS handler!
    if (isPureTickers && !hasComparison) {
      return { handled: false, actionTaken: 'NOT_QUERY' };
    }
  }

  // If we matched an existing watchlist, execute criteria filter & formatting!
  if (matchedWatchlist) {
    logToFile(`[TelegramWatchlistQuery] Target watchlist: "${matchedWatchlist.name}" | Query: "${remainingQuery}"`);

    const items = matchedWatchlist.items || [];
    if (items.length === 0) {
      const emptyMsg = `📋 *Watchlist: ${matchedWatchlist.name}*\n\n_This watchlist is currently empty._\n\n💡 *Add stocks:* \`${matchedWatchlist.name} NVDA TSM AMD\`\nOr send \`${matchedWatchlist.name}\` to have the AI Agent curate stocks for it!`;
      if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
        await sendTelegramMessage({
          text: emptyMsg,
          chatId,
          messageThreadId,
          parseMode: 'Markdown',
        }).catch((e: any) => logToFile(`[TelegramWatchlistQuery] Send error: ${e.message}`));
      }
      return { handled: true, replyText: emptyMsg, actionTaken: 'CRITERIA_QUERY' };
    }

    // Acknowledge if query requires market quote fetching
    const filter = parseCriteriaFilter(remainingQuery);

    // Fetch live market data for symbols
    const symbols = items.map((i) => i.symbol);
    const enriched = await enrichSymbolsWithQuotes(symbols);

    // Filter stocks
    let filtered = enriched.filter((s) => matchesStockCriteria(s, filter));

    // Sorting
    if (filter.sortBy) {
      filtered.sort((a, b) => {
        let valA = 0;
        let valB = 0;
        if (filter.sortBy === 'pe') {
          valA = a.pe ?? (filter.sortOrder === 'asc' ? 9999 : -9999);
          valB = b.pe ?? (filter.sortOrder === 'asc' ? 9999 : -9999);
        } else if (filter.sortBy === 'price') {
          valA = a.price;
          valB = b.price;
        } else if (filter.sortBy === 'change') {
          valA = a.changePercent;
          valB = b.changePercent;
        } else if (filter.sortBy === 'mcap') {
          valA = a.marketCap ?? 0;
          valB = b.marketCap ?? 0;
        }
        return filter.sortOrder === 'desc' ? valB - valA : valA - valB;
      });
    }

    if (filter.limit && filter.limit > 0) {
      filtered = filtered.slice(0, filter.limit);
    }

    const filterDescription = describeFilter(filter);
    const hasActiveFilter = filterDescription !== 'All Stocks';

    let replyMsg = '';
    if (filtered.length === 0) {
      // No stocks match criteria
      const summaryList = enriched
        .map((s) => `• *$${s.symbol}*: $${s.price.toFixed(2)} | P/E: ${s.pe ? s.pe.toFixed(1) : 'N/A'}`)
        .join('\n');

      replyMsg = `⚠️ *${matchedWatchlist.name}* (Criteria: \`${filterDescription}\`)\n\n_No stocks currently match this criteria in this watchlist._ (0 of ${items.length} stocks)\n\n*Current stocks in list:*\n${summaryList}\n\n💡 _Try adjusting your criteria, e.g. \`${matchedWatchlist.name} PE < 40\` or \`${matchedWatchlist.name} price > 50\`._`;
    } else {
      // Build stock card rows
      const stockRows = filtered.map((s) => {
        const isPos = s.changePercent >= 0;
        const icon = isPos ? '🟢' : '🔴';
        const sign = isPos ? '+' : '';
        const pctStr = `${sign}${s.changePercent.toFixed(2)}% ${icon}`;
        const peStr = s.pe && s.pe > 0 ? s.pe.toFixed(1) : 'N/A';
        const mcapStr = formatMarketCap(s.marketCap);

        return `• *$${s.symbol}* — *$${s.price.toFixed(2)}* (${pctStr})\n  🏢 ${s.name}${s.sector ? ` | _${s.sector}_` : ''}\n  📊 P/E: *${peStr}* | MCap: *${mcapStr}*`;
      }).join('\n\n');

      const titleHeader = hasActiveFilter
        ? `🎯 *${matchedWatchlist.name}* (Criteria: \`${filterDescription}\`)\n_${filtered.length} of ${items.length} stocks match:_`
        : `📋 *Watchlist: ${matchedWatchlist.name}* (${items.length} stocks)\n_Live real-time market telemetry:_`;

      replyMsg = `${titleHeader}\n\n${stockRows}\n\n───────────────────────\n💡 _Filter examples: \`${matchedWatchlist.name} PE < 30\`, \`${matchedWatchlist.name} price > 100\`, \`${matchedWatchlist.name} green\`_`;
    }

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyMsg,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramWatchlistQuery] Send criteria result error: ${e.message}`));
    }

    return { handled: true, replyText: replyMsg, actionTaken: 'CRITERIA_QUERY' };
  }

  return { handled: false, actionTaken: 'NOT_QUERY' };
}
