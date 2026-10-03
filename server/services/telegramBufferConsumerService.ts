import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { extractSymbolsFromText } from './thoughtLogAgentService';
import { agentActivityTracker } from './agentActivityService';
import { transcribeTelegramVoice } from './voiceTranscriptionService';
import { autoCreateAlertsFromText } from './thoughtLogAlertService';
import { createPlannedTrade, PlannedTradeItem } from './plannedTradeService';
import { sendTelegramMessage, generateAndSendDailyReport } from './telegramReportService';

const logToFile = (msg: string) => console.log(msg);

export interface BufferedTelegramMessage {
  id: string;
  messageId: number;
  messageThreadId?: number;
  isTopicMessage?: boolean;
  topicName?: string;
  type?: 'text' | 'voice';
  text: string;
  date: number;
  timestamp: string;
  fileId?: string;
  duration?: number;
  mimeType?: string;
  fileSize?: number;
  sender?: {
    id: number;
    username?: string;
    firstName?: string;
    lastName?: string;
  };
  chat?: {
    id: number;
    type: string;
    title?: string;
  };
}

export interface TelegramConsumeResponse {
  success: boolean;
  count: number;
  messages: BufferedTelegramMessage[];
  consumedAt?: string;
  error?: string;
}

export interface BufferSyncResult {
  success: boolean;
  consumedCount: number;
  createdLogs: Array<{ id: string; title: string; symbols: string | null }>;
  message?: string;
  timestamp: string;
}

let lastSyncTimestamp: string | null = null;
let lastSyncCount: number = 0;
let isConsuming = false;
/**
 * Detects whether an incoming Telegram message is requesting an on-demand executive briefing
 */
export function isTelegramBriefingRequest(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const cleaned = text.trim().toLowerCase();

  // Single word or punctuated command (e.g. "briefing", "/briefing", "briefing!", "#briefing")
  if (/^[\/#]?(?:briefing|dailybriefing|daily_briefing|executive_briefing)[\s!?.]*$/i.test(cleaned)) {
    return true;
  }

  // Exact command phrase (e.g. "send briefing", "send me the briefing", "get briefing", "generate briefing", "need briefing")
  if (/\b(?:send|get|give|produce|generate|dispatch|request|fetch|show|need|want)\s+(?:me\s+)?(?:the\s+)?(?:latest\s+|today'?s\s+|daily\s+|executive\s+|portfolio\s+|pdf\s+)?briefing\b/i.test(cleaned)) {
    return true;
  }

  // Explicit type of briefing requested (e.g. "executive briefing", "daily briefing", "morning briefing", "portfolio briefing", "pdf briefing")
  if (/\b(?:executive|daily|morning|portfolio|pdf)\s+briefing\b/i.test(cleaned)) {
    return true;
  }

  // "briefing please", "briefing today", "today's briefing"
  if (/\bbriefing\s+(?:please|now|today|update|report)\b/i.test(cleaned) || /\btoday'?s\s+briefing\b/i.test(cleaned)) {
    return true;
  }

  return false;
}

/**
 * Determine sentiment from raw text
 */
function detectSentimentFromText(text: string): string {
  const upper = text.toUpperCase();
  if (upper.includes('BULL') || upper.includes('CALL') || upper.includes('LONG') || upper.includes('BUY') || upper.includes('MOON') || upper.includes('BREAKOUT')) {
    return 'BULLISH';
  }
  if (upper.includes('BEAR') || upper.includes('PUT') || upper.includes('SHORT') || upper.includes('SELL') || upper.includes('DROP') || upper.includes('BREAKDOWN') || upper.includes('DUMP')) {
    return 'BEARISH';
  }
  if (upper.includes('FED') || upper.includes('CPI') || upper.includes('PMI') || upper.includes('INFLATION') || upper.includes('RATES') || upper.includes('YIELD') || upper.includes('MACRO')) {
    return 'MACRO';
  }
  if (upper.includes('RISK') || upper.includes('CAUTION') || upper.includes('WARNING') || upper.includes('HEDGE') || upper.includes('DOWNSIDE')) {
    return 'CAUTION';
  }
  return 'NEUTRAL';
}

/**
 * Extract clean headline title from note text
 */
function createTitleFromText(text: string, dateStr: string): string {
  const clean = text.trim().replace(/\n+/g, ' ');
  const firstSentence = clean.split(/[.!?]/)[0].trim();
  const excerpt = firstSentence.length > 50 ? firstSentence.slice(0, 47) + '...' : firstSentence;
  const timeFormatted = new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `📱 ${excerpt || 'Mobile Note'} (${timeFormatted})`;
}

/**
 * Extract clean headline title for voice notes
 */
function createVoiceTitleFromText(text: string, dateStr: string): string {
  const clean = text.trim().replace(/\n+/g, ' ');
  const firstSentence = clean.split(/[.!?]/)[0].trim();
  const excerpt = firstSentence.length > 50 ? firstSentence.slice(0, 47) + '...' : firstSentence;
  const timeFormatted = new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `🎙️ ${excerpt || 'Voice Note'} (${timeFormatted})`;
}

/**
 * Helper to save symbols directly into a watchlist (default or named) in Prisma
 */
export async function saveSymbolsToWatchlist(
  prisma: PrismaClient,
  symbols: string[],
  specificWatchlistName?: string
): Promise<{ added: string[]; watchlistName: string } | null> {
  if (!symbols || symbols.length === 0) return null;

  try {
    let targetWatchlist: any = null;

    if (specificWatchlistName && specificWatchlistName.trim()) {
      const cleanName = specificWatchlistName.trim();
      targetWatchlist = await (prisma as any).watchlist.findFirst({
        where: { name: { equals: cleanName } },
      });
    }

    if (!targetWatchlist) {
      targetWatchlist = await (prisma as any).watchlist.findFirst({
        where: { isDefault: true },
      });
    }

    if (!targetWatchlist) {
      targetWatchlist = await (prisma as any).watchlist.findFirst({
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!targetWatchlist) {
      targetWatchlist = await (prisma as any).watchlist.create({
        data: {
          name: 'Watchlist',
          isDefault: true,
        },
      });
    }

    const added: string[] = [];
    for (const sym of symbols) {
      const cleanSymbol = sym.trim().toUpperCase();
      if (!cleanSymbol) continue;

      const existing = await (prisma as any).watchlistItem.findUnique({
        where: {
          watchlistId_symbol: {
            watchlistId: targetWatchlist.id,
            symbol: cleanSymbol,
          },
        },
      });

      if (!existing) {
        await (prisma as any).watchlistItem.create({
          data: {
            watchlistId: targetWatchlist.id,
            symbol: cleanSymbol,
            addedAt: new Date(),
          },
        });
        added.push(cleanSymbol);
      } else {
        added.push(cleanSymbol);
      }
    }

    return {
      added,
      watchlistName: targetWatchlist.name,
    };
  } catch (err: any) {
    logToFile(`[TelegramBuffer] Error saving symbols to watchlist: ${err.message}`);
    return null;
  }
}

export interface ParsedExecutionTrade {
  symbol: string;
  underlyingSymbol?: string;
  action: string;
  assetType: string;
  timeframe: string;
  orderType: string;
  quantity: number;
  targetPrice?: number;
  stopLoss?: number;
  targetExit?: number;
  conviction: string;
  notes?: string;
  strategy?: string;
  strikePrice?: number;
  optionType?: 'CALL' | 'PUT';
  expiration?: string;
}

const ORDER_KEYWORDS = new Set([
  'SL', 'TP', 'PT', 'BTO', 'BTC', 'STC', 'STO', 'MKT', 'QTY', 'DAY', 'DAILY',
  'WEEK', 'WEEKLY', 'SWING', 'INTRADAY', 'BUY', 'SELL', 'LONG', 'SHORT',
  'ENTRY', 'EXIT', 'TARGET', 'LIMIT', 'STOP', 'SHARES', 'CONTRACTS', 'CALL', 'PUT',
  'CALLS', 'PUTS', 'ORDER', 'ORDERS', 'AT', 'PRICE', 'SIZE', 'FOR', 'AND', 'THE',
  'COVERED', 'SECURED', 'CSP', 'SPREAD', 'SPREADS', 'CREDIT', 'DEBIT', 'COLLAR',
  'CONDOR', 'IRON', 'WRITE', 'WRITES', 'BUYWRITE', 'NAKED', 'EXP', 'EXPIRY', 'EXPIRING',
  'STRIKE', 'STRIKES', 'CTS', 'SHS', 'ON', 'IN', 'WITH'
]);

/**
 * Extracts strategy name from a trade record's notes, action, or symbol
 */
export function extractStrategyFromTrade(t: { notes?: string | null; action?: string; symbol?: string }): string | undefined {
  if (t.notes) {
    const match = t.notes.match(/\[Strategy:\s*([^\]]+)\]/i);
    if (match) return match[1].trim();
  }
  if (t.action === 'COVERED_CALL') return 'Covered Call';
  if (t.symbol && /covered call/i.test(t.symbol)) return 'Covered Call';
  if (t.symbol && /short put/i.test(t.symbol)) return 'Short Put';
  if (t.symbol && /cash-secured put/i.test(t.symbol)) return 'Cash-Secured Put';
  return undefined;
}

/**
 * Format confirmation message for a queued trade reflecting its strategy (Covered Call, Short Put, etc.)
 */
export function formatTelegramExecutionSummary(t: PlannedTradeItem, strategy?: string): string {
  const strat = strategy || extractStrategyFromTrade(t);
  const targetLabel = t.targetPrice ? ` @ $${t.targetPrice}` : '';

  if (strat === 'Covered Call' || t.action === 'COVERED_CALL') {
    const sharesQty = Math.round(t.quantity * 100);
    const contractsQty = t.quantity;
    return `• *Covered Call: ${sharesQty} Shares + ${contractsQty}x Short Call $${t.symbol}* (${t.orderType}) — *${t.timeframe} Queue* [Rank #${t.rank}]${targetLabel}`;
  }

  if (strat === 'Short Put' || strat === 'Cash-Secured Put') {
    const contractsLabel = t.quantity === 1 ? '1 Contract' : `${t.quantity} Contracts`;
    const priceLabel = t.targetPrice ? ` @ $${t.targetPrice} Premium` : '';
    return `• *${strat}: ${contractsLabel} $${t.symbol}* (${t.orderType}) — *${t.timeframe} Queue* [Rank #${t.rank}]${priceLabel}`;
  }

  if (strat === 'Long Call' || strat === 'Long Put' || strat === 'Short Call') {
    const contractsLabel = t.quantity === 1 ? '1 Contract' : `${t.quantity} Contracts`;
    return `• *${strat}: ${contractsLabel} $${t.symbol}* (${t.orderType}) — *${t.timeframe} Queue* [Rank #${t.rank}]${targetLabel}`;
  }

  if (strat && strat !== 'Stock') {
    const contractsLabel = t.quantity === 1 ? '1 Contract' : `${t.quantity} Contracts`;
    return `• *${strat}: ${contractsLabel} $${t.symbol}* (${t.orderType}) — *${t.timeframe} Queue* [Rank #${t.rank}]${targetLabel}`;
  }

  if (t.assetType === 'OPTION') {
    const contractsLabel = t.quantity === 1 ? '1 Contract' : `${t.quantity} Contracts`;
    return `• *${t.action} ${contractsLabel} $${t.symbol}* (${t.orderType}) — *${t.timeframe} Queue* [Rank #${t.rank}]${targetLabel}`;
  }

  // Outright stock/equity
  const sharesLabel = t.quantity === 1 ? '1 Share' : `${t.quantity} Shares`;
  return `• *${t.action} ${sharesLabel} $${t.symbol}* (${t.orderType}) — *${t.timeframe} Queue* [Rank #${t.rank}]${targetLabel}`;
}

function parseSingleTradeExecutionLine(line: string, defaultTimeframe = 'DAY'): ParsedExecutionTrade[] {
  // Strip execution hashtags & topic directives & emojis
  const cleanLine = line
    .replace(/#(?:topic:)?(?:execution|execute|trade-execution|queue)\b/gi, '')
    .replace(/^🎯\s*/, '')
    .trim();

  if (!cleanLine) return [];

  // 1. Detect Option Strategy
  let strategy: string | undefined = undefined;
  let assetType = 'STOCK';
  let action = 'BUY';
  let defaultQuantity = 100;
  let detectedOptionType: 'CALL' | 'PUT' | undefined = undefined;

  if (/\b(?:covered\s+calls?|buy[\s-]writes?|buywrite)\b/i.test(cleanLine)) {
    strategy = 'Covered Call';
    action = 'COVERED_CALL';
    assetType = 'OPTION';
    defaultQuantity = 1;
    detectedOptionType = 'CALL';
  } else if (/\b(?:cash[\s-]secured\s+puts?|csp)\b/i.test(cleanLine)) {
    strategy = 'Cash-Secured Put';
    action = 'STO';
    assetType = 'OPTION';
    defaultQuantity = 1;
    detectedOptionType = 'PUT';
  } else if (/\b(?:short\s+puts?|sell\s+puts?|sto\s+puts?)\b/i.test(cleanLine)) {
    strategy = 'Short Put';
    action = 'STO';
    assetType = 'OPTION';
    defaultQuantity = 1;
    detectedOptionType = 'PUT';
  } else if (/\b(?:short\s+calls?|naked\s+calls?|sell\s+calls?|sto\s+calls?)\b/i.test(cleanLine)) {
    strategy = 'Short Call';
    action = 'STO';
    assetType = 'OPTION';
    defaultQuantity = 1;
    detectedOptionType = 'CALL';
  } else if (/\b(?:long\s+calls?|buy\s+calls?|bto\s+calls?)\b/i.test(cleanLine)) {
    strategy = 'Long Call';
    action = 'BTO';
    assetType = 'OPTION';
    defaultQuantity = 1;
    detectedOptionType = 'CALL';
  } else if (/\b(?:long\s+puts?|buy\s+puts?|bto\s+puts?)\b/i.test(cleanLine)) {
    strategy = 'Long Put';
    action = 'BTO';
    assetType = 'OPTION';
    defaultQuantity = 1;
    detectedOptionType = 'PUT';
  } else if (/\b(?:bull\s+put\s+spread|put\s+credit\s+spread)\b/i.test(cleanLine)) {
    strategy = 'Bull Put Spread';
    action = 'STO';
    assetType = 'OPTION';
    defaultQuantity = 1;
    detectedOptionType = 'PUT';
  } else if (/\b(?:bear\s+call\s+spread|call\s+credit\s+spread)\b/i.test(cleanLine)) {
    strategy = 'Bear Call Spread';
    action = 'STO';
    assetType = 'OPTION';
    defaultQuantity = 1;
    detectedOptionType = 'CALL';
  } else if (/\b(?:bull\s+call\s+spread|call\s+debit\s+spread)\b/i.test(cleanLine)) {
    strategy = 'Bull Call Spread';
    action = 'BTO';
    assetType = 'OPTION';
    defaultQuantity = 1;
    detectedOptionType = 'CALL';
  } else if (/\b(?:bear\s+put\s+spread|put\s+debit\s+spread)\b/i.test(cleanLine)) {
    strategy = 'Bear Put Spread';
    action = 'BTO';
    assetType = 'OPTION';
    defaultQuantity = 1;
    detectedOptionType = 'PUT';
  } else if (/\bcredit\s+spread\b/i.test(cleanLine)) {
    strategy = 'Credit Spread';
    action = 'STO';
    assetType = 'OPTION';
    defaultQuantity = 1;
  } else if (/\bdebit\s+spread\b/i.test(cleanLine)) {
    strategy = 'Debit Spread';
    action = 'BTO';
    assetType = 'OPTION';
    defaultQuantity = 1;
  } else if (/\bvertical\s+spread\b/i.test(cleanLine)) {
    strategy = 'Vertical Spread';
    action = 'STO';
    assetType = 'OPTION';
    defaultQuantity = 1;
  } else if (/\biron\s+condor\b/i.test(cleanLine)) {
    strategy = 'Iron Condor';
    action = 'STO';
    assetType = 'OPTION';
    defaultQuantity = 1;
  } else if (/\b(?:protective\s+collar|collar)\b/i.test(cleanLine)) {
    strategy = 'Protective Collar';
    action = 'COLLAR';
    assetType = 'OPTION';
    defaultQuantity = 1;
  }

  // 2. Check for standard Options syntax: e.g. "BTO 2 AAPL 250C 10/18 @ 4.50" or "SELL 1 TSLA 240P @ 3.20"
  const optionRegex = /\b([A-Za-z]{1,5})\s+(\d+(?:\.\d+)?)\s*([CPcp])(?:all|ut)?(?:\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?))?\b/i;
  const optionMatch = cleanLine.match(optionRegex);

  let underlyingSymbol: string | undefined = undefined;

  // Determine action if not already set by strategy
  if (!strategy) {
    if (/\b(?:SELL|SHORT|STC|STO)\b/i.test(cleanLine)) {
      action = 'SELL';
      if (/\b(?:STO)\b/i.test(cleanLine)) action = 'STO';
      else if (/\b(?:STC)\b/i.test(cleanLine)) action = 'STC';
    } else if (/\b(?:BUY|LONG|BTO|BTC)\b/i.test(cleanLine)) {
      action = 'BUY';
      if (/\b(?:BTO)\b/i.test(cleanLine)) action = 'BTO';
      else if (/\b(?:BTC)\b/i.test(cleanLine)) action = 'BTC';
    }
  }

  if (optionMatch && !ORDER_KEYWORDS.has(optionMatch[1].toUpperCase())) {
    assetType = 'OPTION';
    defaultQuantity = 1;
    underlyingSymbol = optionMatch[1].toUpperCase();
    const optTypeLetter = optionMatch[3].toUpperCase() === 'C' ? 'C' : 'P';
    detectedOptionType = optTypeLetter === 'C' ? 'CALL' : 'PUT';
    if (!strategy) {
      if (action === 'BUY' || action === 'BTO') {
        action = 'BTO';
        strategy = optTypeLetter === 'C' ? 'Long Call' : 'Long Put';
      } else {
        action = action === 'STO' ? 'STO' : 'STC';
        strategy = optTypeLetter === 'C' ? 'Short Call' : 'Short Put';
      }
    }
  }

  // Ticker symbol extraction if not yet discovered:
  if (!underlyingSymbol) {
    // (a) Match explicit $TICKER
    const dollarMatch = cleanLine.match(/\$([A-Za-z]{1,5})\b/);
    if (dollarMatch && !ORDER_KEYWORDS.has(dollarMatch[1].toUpperCase())) {
      underlyingSymbol = dollarMatch[1].toUpperCase();
    }
  }

  if (!underlyingSymbol) {
    // (b) Match preposition: "on AAPL" or "for TSLA"
    const onMatch = cleanLine.match(/\b(?:on|for)\s+\$?([A-Za-z]{1,5})\b/i);
    if (onMatch && !ORDER_KEYWORDS.has(onMatch[1].toUpperCase())) {
      underlyingSymbol = onMatch[1].toUpperCase();
    }
  }

  if (!underlyingSymbol && strategy) {
    // (c) Match adjacent after strategy: e.g. "short put AAPL 150", "covered call TSLA"
    const stratAdjacentMatch = cleanLine.match(
      /(?:covered\s+calls?|buy[\s-]writes?|buywrite|cash[\s-]secured\s+puts?|short\s+puts?|sell\s+puts?|sto\s+puts?|short\s+calls?|naked\s+calls?|sell\s+calls?|sto\s+calls?|long\s+calls?|buy\s+calls?|bto\s+calls?|long\s+puts?|buy\s+puts?|bto\s+puts?|csp|bull\s+put\s+spread|bear\s+call\s+spread|bull\s+call\s+spread|bear\s+put\s+spread|credit\s+spread|debit\s+spread|vertical\s+spread|iron\s+condor|protective\s+collar|collar)\s+(?:on\s+)?(?:\d+\s+(?:contracts?|shs?|x)\s+)?\$?([A-Za-z]{1,5})\b/i
    );
    if (stratAdjacentMatch && !ORDER_KEYWORDS.has(stratAdjacentMatch[1].toUpperCase())) {
      underlyingSymbol = stratAdjacentMatch[1].toUpperCase();
    }
  }

  if (!underlyingSymbol && strategy) {
    // (d) Match symbol before strategy: e.g. "AAPL short put 150" or "AAPL covered call"
    const symbolBeforeStratMatch = cleanLine.match(
      /\$?([A-Za-z]{1,5})\s+(?:covered\s+call|buy[\s-]write|cash[\s-]secured|short\s+put|sell\s+put|sto\s+put|short\s+call|long\s+call|buy\s+call|long\s+put|buy\s+put|csp|spread|collar|iron\s+condor)\b/i
    );
    if (symbolBeforeStratMatch && !ORDER_KEYWORDS.has(symbolBeforeStratMatch[1].toUpperCase())) {
      underlyingSymbol = symbolBeforeStratMatch[1].toUpperCase();
    }
  }

  if (!underlyingSymbol) {
    // (e) Match keyword-adjacent symbol: e.g. "BUY 100 AAPL" or "BUY AAPL" or "SELL TSLA"
    const verbAfterMatch = cleanLine.match(/\b(?:BUY|SELL|LONG|SHORT|BTO|BTC|STC|STO)\s+(?:(\d+(?:\.\d+)?)\s+)?\$?([A-Za-z]{1,5})\b/i);
    if (verbAfterMatch && !ORDER_KEYWORDS.has(verbAfterMatch[2].toUpperCase())) {
      underlyingSymbol = verbAfterMatch[2].toUpperCase();
    }
  }

  if (!underlyingSymbol) {
    // (f) Match symbol before verb: e.g. "AAPL BUY 100"
    const verbBeforeMatch = cleanLine.match(/\b([A-Za-z]{1,5})\s+(?:BUY|SELL|LONG|SHORT)\b/i);
    if (verbBeforeMatch && !ORDER_KEYWORDS.has(verbBeforeMatch[1].toUpperCase())) {
      underlyingSymbol = verbBeforeMatch[1].toUpperCase();
    }
  }

  if (!underlyingSymbol) {
    // (g) Fallback to extractSymbolsFromText
    const detected = extractSymbolsFromText(cleanLine);
    const valid = detected.filter((s) => !ORDER_KEYWORDS.has(s.toUpperCase()));
    if (valid.length > 0) {
      underlyingSymbol = valid[0];
    }
  }

  if (!underlyingSymbol) {
    // (h) Fallback for lowercase standalone or prefixed ticker: e.g. "sofi 16" or "pltr @ 35"
    const words = cleanLine.split(/[\s,@]+/).map((w) => w.replace(/[^A-Za-z]/g, '').toUpperCase()).filter(Boolean);
    for (const w of words) {
      if (w.length >= 2 && w.length <= 5 && !ORDER_KEYWORDS.has(w)) {
        underlyingSymbol = w;
        break;
      }
    }
  }

  if (!underlyingSymbol) return [];

  // Determine timeframe: WEEK vs DAY
  let timeframe = defaultTimeframe;
  if (/\b(?:WEEK|WEEKLY|SWING)\b/i.test(cleanLine)) {
    timeframe = 'WEEK';
  } else if (/\b(?:DAY|DAILY|INTRADAY)\b/i.test(cleanLine)) {
    timeframe = 'DAY';
  }

  // Determine order type
  let orderType = 'LIMIT';
  if (/\b(?:MARKET|MKT)\b/i.test(cleanLine)) {
    orderType = 'MARKET';
  } else if (/\b(?:STOP[- ]?LIMIT)\b/i.test(cleanLine)) {
    orderType = 'STOP_LIMIT';
  }

  // Determine quantity
  let quantity = defaultQuantity;
  if (strategy || assetType === 'OPTION') {
    const optQtyMatch =
      cleanLine.match(/(\d+(?:\.\d+)?)\s*(?:contracts?|cts?|x)\b/i) ||
      cleanLine.match(/(?:qty|quantity|size)[:\s]+(\d+(?:\.\d+)?)/i) ||
      cleanLine.match(/(\d+)\s*(?:short\s+puts?|covered\s+calls?|long\s+calls?|long\s+puts?|puts?|calls?|spreads?)\b/i) ||
      cleanLine.match(/\b(?:BUY|SELL|BTO|BTC|STC|STO)\s+(\d+(?:\.\d+)?)\s+/i);
    if (optQtyMatch && Number(optQtyMatch[1]) > 0) {
      quantity = Number(optQtyMatch[1]);
    }
  } else {
    const stockQtyMatch =
      cleanLine.match(/(\d+(?:\.\d+)?)\s*(?:shares?|shs?|units?|x)\b/i) ||
      cleanLine.match(/(?:qty|quantity|size)[:\s]+(\d+(?:\.\d+)?)/i) ||
      cleanLine.match(/(?:BUY|SELL|LONG|SHORT|BTO|BTC|STC|STO)\s+(\d+(?:\.\d+)?)\s+[A-Za-z]{1,5}\b/i) ||
      cleanLine.match(new RegExp(`(?:${underlyingSymbol})\\s+(\\d+(?:\\.\\d+)?)\\s*(?:@|at|limit)\\b`, 'i'));
    if (stockQtyMatch && Number(stockQtyMatch[1]) > 0) {
      quantity = Number(stockQtyMatch[1]);
    }
  }

  // Determine expiration & strikes
  let expiration: string | undefined = undefined;
  const expMatch =
    cleanLine.match(/\b(?:exp|expiry|expiring|dte)[:\s]+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{1,3}d)\b/i) ||
    cleanLine.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
  if (expMatch) {
    expiration = expMatch[1];
  }

  let strikePrice: number | undefined = undefined;
  let spreadStrikes: string | undefined = undefined;

  // Spread strikes pattern: e.g. 150/145 or 500/495
  const spreadMatch = cleanLine.match(/\b(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\b/);
  if (spreadMatch) {
    spreadStrikes = `${spreadMatch[1]}/${spreadMatch[2]}`;
  }

  // Explicit strike: "strike 150" or "strike: $150"
  const explicitStrikeMatch = cleanLine.match(/\b(?:strike)[:\s]*\$?\s*(\d+(?:\.\d+)?)/i);
  if (explicitStrikeMatch) {
    strikePrice = Number(explicitStrikeMatch[1]);
  }

  // Strike with C/P suffix: e.g. "150P" or "250C"
  if (!strikePrice) {
    const cpStrikeMatch = cleanLine.match(/\b(\d+(?:\.\d+)?)\s*([CPcp])\b/);
    if (cpStrikeMatch) {
      strikePrice = Number(cpStrikeMatch[1]);
      if (!detectedOptionType) {
        detectedOptionType = cpStrikeMatch[2].toUpperCase() === 'C' ? 'CALL' : 'PUT';
      }
    }
  }

  // Option strike from optionMatch
  if (!strikePrice && optionMatch) {
    strikePrice = Number(optionMatch[2]);
  }

  // If strategy is present, strike is often adjacent to ticker: e.g. "short put AAPL 150" or "covered call AAPL 250"
  if (!strikePrice && strategy && underlyingSymbol) {
    const adjacentNumberMatch = cleanLine.match(new RegExp(`(?:${underlyingSymbol})\\s+\\$?\\s*(\\d+(?:\\.\\d+)?)\\b`, 'i'));
    if (
      adjacentNumberMatch &&
      !cleanLine.match(new RegExp(`(?:${underlyingSymbol})\\s+${adjacentNumberMatch[1]}\\s*(?:shares?|shs?|units?|contracts?|cts?)`, 'i'))
    ) {
      strikePrice = Number(adjacentNumberMatch[1]);
    }
  }

  // Also check "short put 150 AAPL" or "covered call 250 AAPL"
  if (!strikePrice && strategy) {
    const numBeforeTickerMatch = cleanLine.match(
      /(?:short\s+put|covered\s+call|cash[\s-]secured\s+put|csp|long\s+call|long\s+put)\s+\$?(\d+(?:\.\d+)?)\s+[A-Za-z]{1,5}\b/i
    );
    if (numBeforeTickerMatch) {
      strikePrice = Number(numBeforeTickerMatch[1]);
    }
  }

  // Determine entry / limit price
  let targetPrice: number | undefined = undefined;
  const atPriceMatch = cleanLine.match(/(?:@|at|limit|entry|price|premium)[:\s]*\$?\s*(\d+(?:\.\d+)?)/i);
  if (atPriceMatch && Number(atPriceMatch[1]) > 0) {
    targetPrice = Number(atPriceMatch[1]);
  } else if (!strikePrice) {
    const dollarPriceMatch = cleanLine.match(/\$\s*(\d+(?:\.\d+)?)/);
    if (dollarPriceMatch && Number(dollarPriceMatch[1]) > 0) {
      targetPrice = Number(dollarPriceMatch[1]);
    }
  }

  // If strategy is present and strikePrice was not found from other patterns, the specified price is the strike (e.g. "short put on SOFI @ 10")
  if (!strikePrice && strategy && targetPrice) {
    strikePrice = targetPrice;
  }

  // Determine stop loss
  let stopLoss: number | undefined = undefined;
  const slMatch = cleanLine.match(/(?:sl|stop|stoploss|stop-loss)[:\s]*\$?\s*(\d+(?:\.\d+)?)/i);
  if (slMatch && Number(slMatch[1]) > 0) {
    stopLoss = Number(slMatch[1]);
  }

  // Determine target exit / take profit
  let targetExit: number | undefined = undefined;
  const tpMatch = cleanLine.match(/(?:tp|pt|target|exit|takeprofit|take-profit)[:\s]*\$?\s*(\d+(?:\.\d+)?)/i);
  if (tpMatch && Number(tpMatch[1]) > 0) {
    targetExit = Number(tpMatch[1]);
  }

  // Conviction
  let conviction = 'HIGH';
  if (/\b(?:SPEC|SPECULATIVE|LOTTO)\b/i.test(cleanLine)) {
    conviction = 'SPECULATIVE';
  } else if (/\b(?:MED|MEDIUM|MODERATE)\b/i.test(cleanLine)) {
    conviction = 'MEDIUM';
  }

  // Formulate display symbol and notes
  let symbol = '';
  if (strategy === 'Covered Call') {
    if (strikePrice) {
      symbol = `${underlyingSymbol} ${strikePrice}C (Covered Call)`;
    } else {
      symbol = `${underlyingSymbol} Covered Call`;
    }
  } else if (strategy === 'Short Put' || strategy === 'Cash-Secured Put') {
    if (strikePrice) {
      symbol = `${underlyingSymbol} ${strikePrice}P${expiration ? ` ${expiration}` : ''}`;
    } else {
      symbol = `${underlyingSymbol} Put`;
    }
  } else if (strategy === 'Long Call' || strategy === 'Short Call') {
    if (strikePrice) {
      symbol = `${underlyingSymbol} ${strikePrice}C${expiration ? ` ${expiration}` : ''}`;
    } else {
      symbol = `${underlyingSymbol} Call`;
    }
  } else if (strategy === 'Long Put') {
    if (strikePrice) {
      symbol = `${underlyingSymbol} ${strikePrice}P${expiration ? ` ${expiration}` : ''}`;
    } else {
      symbol = `${underlyingSymbol} Put`;
    }
  } else if (spreadStrikes) {
    symbol = `${underlyingSymbol} ${spreadStrikes} Spread`;
  } else if (strategy) {
    symbol = `${underlyingSymbol} ${strategy}`;
  } else if (optionMatch) {
    const optStrike = optionMatch[2];
    const optTypeLetter = optionMatch[3].toUpperCase() === 'C' ? 'C' : 'P';
    const optExp = optionMatch[4] ? ` ${optionMatch[4]}` : '';
    symbol = `${underlyingSymbol} ${optStrike}${optTypeLetter}${optExp}`;
  } else {
    symbol = underlyingSymbol;
  }

  const notes = strategy
    ? `[Strategy: ${strategy}]${strikePrice ? ` Strike: $${strikePrice}.` : ''} 📱 Telegram Execution Queue: "${cleanLine}"`
    : cleanLine;

  return [
    {
      symbol,
      underlyingSymbol,
      action,
      assetType,
      timeframe,
      orderType,
      quantity,
      targetPrice,
      stopLoss,
      targetExit,
      conviction,
      notes,
      strategy,
      strikePrice,
      optionType: detectedOptionType,
      expiration,
    },
  ];
}

/**
 * Parses trade execution parameters (action, quantity, price, stop loss, exit) from Execution topic text
 */
export function parseTradeExecutionCandidates(text: string, defaultTimeframe = 'DAY'): ParsedExecutionTrade[] {
  const clean = text.trim();
  if (!clean) return [];

  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const results: ParsedExecutionTrade[] = [];

  for (const line of lines) {
    const parsed = parseSingleTradeExecutionLine(line, defaultTimeframe);
    if (parsed && parsed.length > 0) {
      results.push(...parsed);
    }
  }

  // Fallback: If line-by-line parsing yielded nothing, try parsing the entire block as one line
  if (results.length === 0) {
    const single = parseSingleTradeExecutionLine(clean, defaultTimeframe);
    if (single && single.length > 0) {
      results.push(...single);
    }
  }

  return results;
}

/**
 * Consume all pending messages from Cloudflare Worker KV buffer and save to SQLite ThoughtLog
 */
export async function consumeTelegramBuffer(prisma: PrismaClient): Promise<BufferSyncResult> {
  const bufferUrl = process.env.TELEGRAM_BUFFER_URL?.trim();
  const bufferSecret = process.env.TELEGRAM_BUFFER_SECRET?.trim() || 'tradecompass_secret_consume_token_2026';

  if (!bufferUrl) {
    return {
      success: false,
      consumedCount: 0,
      createdLogs: [],
      message: 'TELEGRAM_BUFFER_URL not configured in environment (.env.local)',
      timestamp: new Date().toISOString(),
    };
  }

  // Ensure /consume path is targeted
  const targetUrl = bufferUrl.endsWith('/consume') ? bufferUrl : `${bufferUrl.replace(/\/+$/, '')}/consume`;

  if (isConsuming) {
    logToFile(`[TelegramBuffer] A buffer consumption cycle is already active. Skipping concurrent execution.`);
    return {
      success: true,
      consumedCount: 0,
      createdLogs: [],
      message: 'Concurrent sync skipped: buffer consumption cycle already active.',
      timestamp: new Date().toISOString(),
    };
  }

  isConsuming = true;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Consume-Secret': bufferSecret,
        'Authorization': `Bearer ${bufferSecret}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Buffer Worker returned HTTP ${response.status}: ${errText}`);
    }

    const data: TelegramConsumeResponse = await response.json();
    const messages = data.messages || [];

    lastSyncTimestamp = new Date().toISOString();
    lastSyncCount = messages.length;

    if (messages.length === 0) {
      logToFile('[TelegramBuffer] Buffer is empty. No new mobile notes to consume.');
      return {
        success: true,
        consumedCount: 0,
        createdLogs: [],
        message: 'Buffer is empty (0 new messages)',
        timestamp: lastSyncTimestamp,
      };
    }

    logToFile(`[TelegramBuffer] Consumed ${messages.length} messages from Cloudflare KV. Ingesting into database...`);

    const task = agentActivityTracker.startTask({
      agentName: 'Telegram Mobile Buffer Ingestion Agent',
      agentType: 'RESEARCH',
      taskDescription: `Ingesting ${messages.length} mobile thoughts from Cloudflare Worker buffer`,
    });

    const createdLogs: Array<{ id: string; title: string; symbols: string | null }> = [];

    for (const msg of messages) {
      let contentText = (msg.text || '').trim();
      const isVoice = msg.type === 'voice' || Boolean(msg.fileId);

      if (isVoice && msg.fileId) {
        logToFile(`[TelegramBuffer] Transcribing voice note (${msg.fileId})...`);
        try {
          const transResult = await transcribeTelegramVoice(msg.fileId);
          if (transResult.transcribedText) {
            contentText = transResult.transcribedText;
          }
        } catch (transErr: any) {
          logToFile(`[TelegramBuffer] Voice transcription error for ${msg.fileId}: ${transErr.message}`);
          if (!contentText || contentText === '🎙️ [Voice Note]') {
            contentText = `[Voice Note Transcription Error: ${transErr.message}]`;
          }
        }
      }

      if (!contentText || !contentText.trim()) continue;

      // Never save automated triggered alert broadcast messages into ThoughtLog / Log
      if (
        contentText.toUpperCase().includes('PRICE ALERT TRIGGERED') ||
        contentText.toUpperCase().includes('ALERT TRIGGERED') ||
        /🚨\s*(?:PRICE\s+)?ALERT.*(?:Hit\s*\$|Fallen Below|Risen Above)/i.test(contentText)
      ) {
        logToFile(`[TelegramBuffer] Skipping triggered alert notification message: "${contentText.slice(0, 60)}..."`);
        continue;
      }

      const configuredAlertsThreadId = process.env.TELEGRAM_ALERTS_THREAD_ID ? Number(process.env.TELEGRAM_ALERTS_THREAD_ID) : 2;
      const configuredAppThreadId = process.env.TELEGRAM_APP_THREAD_ID ? Number(process.env.TELEGRAM_APP_THREAD_ID) : 10;
      const configuredIdeasThreadId = process.env.TELEGRAM_IDEAS_THREAD_ID ? Number(process.env.TELEGRAM_IDEAS_THREAD_ID) : undefined;
      const configuredExecutionThreadId = process.env.TELEGRAM_EXECUTION_THREAD_ID ? Number(process.env.TELEGRAM_EXECUTION_THREAD_ID) : undefined;

      const msgThreadNum = msg.messageThreadId !== undefined ? Number(msg.messageThreadId) : undefined;
      const isExplicitAppThread = msgThreadNum !== undefined && msgThreadNum === configuredAppThreadId;
      const isExplicitAlertsThread = msgThreadNum !== undefined && msgThreadNum === configuredAlertsThreadId;
      const isExplicitIdeasThread = configuredIdeasThreadId !== undefined && msgThreadNum !== undefined && msgThreadNum === configuredIdeasThreadId;
      const isExplicitExecutionThread = configuredExecutionThreadId !== undefined && msgThreadNum !== undefined && msgThreadNum === configuredExecutionThreadId;

      // On-Demand Executive Briefing Command Detection (e.g. "briefing", "/briefing", "send briefing")
      if (isTelegramBriefingRequest(contentText)) {
        const senderLabel = msg.sender?.username ? `@${msg.sender.username}` : (msg.sender?.firstName || 'Mobile');
        const targetChatId = msg.chat?.id || msg.sender?.id || process.env.TELEGRAM_CHAT_ID;
        const targetThreadId = msgThreadNum;

        logToFile(`[TelegramBuffer] 📊 Detected on-demand briefing request from ${senderLabel} (chat: ${targetChatId}, thread: ${targetThreadId})`);

        // 1. Immediately acknowledge request via Telegram message
        if (process.env.TELEGRAM_BOT_TOKEN && targetChatId) {
          try {
            await sendTelegramMessage({
              text: '📊 *Generating Executive Briefing PDF...*\n\n_Synthesizing live portfolio defense, dip radar, and macro volatility dossier. Sending to your phone momentarily!_ ⏳',
              chatId: targetChatId,
              messageThreadId: targetThreadId,
              parseMode: 'Markdown',
            });
          } catch (ackErr: any) {
            logToFile(`[TelegramBuffer] Failed to send briefing ack: ${ackErr.message}`);
          }
        }

        // 2. Synthesize institutional report and dispatch PDF
        let reportResult: any = null;
        try {
          reportResult = await generateAndSendDailyReport({
            chatId: targetChatId,
            messageThreadId: targetThreadId,
            requestedBy: senderLabel,
          });
          logToFile(`[TelegramBuffer] Successfully dispatched on-demand briefing PDF to Telegram (${reportResult?.filename || 'report.pdf'}, ${reportResult?.sizeBytes || 0} bytes)`);
        } catch (repErr: any) {
          logToFile(`[TelegramBuffer] Error generating/dispatching on-demand briefing PDF: ${repErr.message}`);
          if (process.env.TELEGRAM_BOT_TOKEN && targetChatId) {
            try {
              await sendTelegramMessage({
                text: `⚠️ *Executive Briefing Generation Failed*\n\nUnable to generate briefing PDF: ${repErr.message}`,
                chatId: targetChatId,
                messageThreadId: targetThreadId,
                parseMode: 'Markdown',
              });
            } catch {}
          }
        }

        // 3. Log to ThoughtLog under 'Reports' folder
        try {
          const briefingTitle = `📊 Executive Briefing Delivered (${new Date(msg.timestamp).toLocaleTimeString()})`;
          const savedLog = await (prisma as any).thoughtLog.create({
            data: {
              title: briefingTitle,
              content: contentText.trim(),
              folder: 'Reports',
              tags: `Telegram, Briefing, OnDemand, PDF, ${senderLabel}`,
              symbols: null,
              sentiment: 'NEUTRAL',
              isPinned: false,
              isFulfilled: Boolean(reportResult?.success),
              agentOutput: reportResult?.success
                ? `📄 **Executive Briefing PDF Dispatched to Telegram**\n\n• Filename: \`${reportResult.filename}\`\n• Size: ${(reportResult.sizeBytes / 1024).toFixed(1)} KB\n• Dispatched to Chat: \`${targetChatId}\`${targetThreadId ? ` (Thread ${targetThreadId})` : ''}\n• Status: ✅ Delivered`
                : `⚠️ Briefing generation attempted but encountered an error.`,
              agentActionType: 'ADD_CONTEXT',
              marketDataJson: null,
              createdAt: new Date(msg.timestamp),
            },
          });

          createdLogs.push({
            id: savedLog.id,
            title: savedLog.title,
            symbols: null,
          });
        } catch (logErr: any) {
          logToFile(`[TelegramBuffer] Failed to create ThoughtLog for briefing: ${logErr.message}`);
        }

        continue;
      }


      const isAlertsTopic = isExplicitAlertsThread || (!isExplicitAppThread && !isExplicitIdeasThread && !isExplicitExecutionThread && Boolean(
        (msg.topicName && /alert/i.test(msg.topicName)) ||
        contentText.toLowerCase().startsWith('#alert') ||
        contentText.match(/#(?:topic:)?alert(?:s)?\b/i) ||
        contentText.toUpperCase().includes('PRICE ALERT') ||
        contentText.includes('🚨') ||
        contentText.includes('🔔') ||
        (msg.chat?.id === -1003872409872 && msgThreadNum === configuredAlertsThreadId)
      ));

      const isIdeasTopic = isExplicitIdeasThread || (!isExplicitAppThread && !isAlertsTopic && !isExplicitExecutionThread && Boolean(
        (msg.topicName && /ideas?/i.test(msg.topicName)) ||
        contentText.toLowerCase().startsWith('#idea') ||
        contentText.toLowerCase().startsWith('#ideas') ||
        contentText.toLowerCase().startsWith('#tradeidea') ||
        contentText.toLowerCase().startsWith('#stockidea') ||
        contentText.match(/#(?:topic:)?ideas?\b/i) ||
        contentText.includes('💡')
      ));

      const isExecutionTopic = isExplicitExecutionThread || (!isExplicitAppThread && !isAlertsTopic && !isIdeasTopic && Boolean(
        (msg.topicName && /execution/i.test(msg.topicName)) ||
        contentText.toLowerCase().startsWith('#execution') ||
        contentText.toLowerCase().startsWith('#execute') ||
        contentText.match(/#(?:topic:)?(?:execution|execute|trade-execution|queue)\b/i) ||
        contentText.toUpperCase().includes('EXECUTION QUEUE') ||
        contentText.includes('🎯')
      ));

      // Auto-discover and persist TELEGRAM_EXECUTION_THREAD_ID if not yet configured
      if (isExecutionTopic && msgThreadNum !== undefined && !process.env.TELEGRAM_EXECUTION_THREAD_ID) {
        process.env.TELEGRAM_EXECUTION_THREAD_ID = String(msgThreadNum);
        logToFile(`[TelegramBuffer] Auto-discovered TELEGRAM_EXECUTION_THREAD_ID=${msgThreadNum}. Persisting to environment.`);
        try {
          const envPath = path.resolve(process.cwd(), '.env.local');
          if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            if (/TELEGRAM_EXECUTION_THREAD_ID=/i.test(envContent)) {
              envContent = envContent.replace(/TELEGRAM_EXECUTION_THREAD_ID=.*/g, `TELEGRAM_EXECUTION_THREAD_ID=${msgThreadNum}`);
            } else {
              envContent += `\nTELEGRAM_EXECUTION_THREAD_ID=${msgThreadNum}\n`;
            }
            fs.writeFileSync(envPath, envContent, 'utf8');
          }
        } catch (e: any) {
          logToFile(`[TelegramBuffer] Failed to persist discovered thread ID to .env.local: ${e.message}`);
        }
      }

      const isAppTopic = isExplicitAppThread || (!isAlertsTopic && !isIdeasTopic && !isExecutionTopic && Boolean(
        (msg.topicName && msg.topicName.toLowerCase().includes('app')) ||
        contentText.toLowerCase().startsWith('#app') ||
        contentText.toLowerCase().includes('#app-idea') ||
        contentText.match(/#(?:topic:)?app\b/i) ||
        (msg.chat?.id === -1003872409872 && msgThreadNum === configuredAppThreadId)
      ));

      // Automatically detect and create price alerts only if NOT an app feature idea, idea topic, or execution topic
      const autoCreatedAlerts = (isAppTopic || isIdeasTopic || isExecutionTopic)
        ? []
        : await autoCreateAlertsFromText(
            prisma,
            contentText,
            `📱 Telegram Note (${new Date(msg.timestamp).toLocaleString()}): "${contentText.trim()}"`,
            { isAlertsTopic }
          );

      const detectedSymbols = extractSymbolsFromText(contentText);
      const sentiment = isAppTopic ? 'NEUTRAL' : (isAlertsTopic ? 'CAUTION' : (isExecutionTopic ? 'BULLISH' : detectSentimentFromText(contentText)));

      // If message is from Execution topic, automatically queue trades in the Daily & Weekly Trade Execution Queue
      const autoCreatedPlannedTrades: PlannedTradeItem[] = [];
      let parsedTrades: ParsedExecutionTrade[] = [];
      if (isExecutionTopic) {
        parsedTrades = parseTradeExecutionCandidates(contentText);
        for (const pt of parsedTrades) {
          try {
            const created = await createPlannedTrade({
              symbol: pt.symbol,
              underlyingSymbol: pt.underlyingSymbol || pt.symbol,
              action: pt.action,
              assetType: pt.assetType,
              timeframe: pt.timeframe,
              orderType: pt.orderType,
              quantity: pt.quantity,
              targetPrice: pt.targetPrice,
              stopLoss: pt.stopLoss,
              targetExit: pt.targetExit,
              conviction: pt.conviction,
              notes: pt.notes || `📱 Telegram Execution Queue: "${contentText.trim()}"`,
            }, prisma);
            autoCreatedPlannedTrades.push(created);
            logToFile(`[TelegramBuffer] Created PlannedTrade #${created.rank}: ${pt.strategy ? `${pt.strategy} (${created.symbol})` : `${created.action} ${created.quantity} ${created.symbol}`} in ${created.timeframe} execution queue`);
          } catch (tradeErr: any) {
            logToFile(`[TelegramBuffer] Error creating PlannedTrade for ${pt.symbol}: ${tradeErr.message}`);
          }
        }

        // Dispatch confirmation message back into Telegram execution topic
        if (autoCreatedPlannedTrades.length > 0 && process.env.TELEGRAM_BOT_TOKEN) {
          try {
            const summaryLines = autoCreatedPlannedTrades.map(
              (t, idx) => formatTelegramExecutionSummary(t, parsedTrades[idx]?.strategy)
            ).join('\n');
            const replyText = `🎯 *Added to Tactical Execution Queue*\n\n${summaryLines}\n\n_Manage in Portfolio & Position Management Hub > Execution Queue._`;
            
            await sendTelegramMessage({
              text: replyText,
              chatId: msg.chat?.id || process.env.TELEGRAM_ALERTS_CHAT_ID || '-1003872409872',
              messageThreadId: msgThreadNum || (process.env.TELEGRAM_EXECUTION_THREAD_ID ? Number(process.env.TELEGRAM_EXECUTION_THREAD_ID) : undefined),
              parseMode: 'Markdown',
            });
          } catch (confirmErr: any) {
            logToFile(`[TelegramBuffer] Failed to send Telegram execution confirmation: ${confirmErr.message}`);
          }
        }
      }

      // Check if message requests saving directly to a watchlist
      const hasWatchlistDirective = Boolean(
        contentText.match(/#(?:topic:)?(?:watchlist|watch)\b/i) ||
        contentText.match(/\+watchlist\b/i) ||
        contentText.toLowerCase().includes('#add-to-watchlist') ||
        contentText.match(/watchlist:\s*([A-Za-z0-9_\-\s]+)/i)
      );

      const watchlistNameMatch = contentText.match(/watchlist:\s*([A-Za-z0-9_\-\s]+)/i);
      const specifiedWatchlistName = watchlistNameMatch ? watchlistNameMatch[1].trim() : undefined;

      let savedWatchlistResult: { added: string[]; watchlistName: string } | null = null;
      if (hasWatchlistDirective && detectedSymbols.length > 0) {
        savedWatchlistResult = await saveSymbolsToWatchlist(prisma, detectedSymbols, specifiedWatchlistName);
        if (savedWatchlistResult) {
          logToFile(`[TelegramBuffer] Added ${savedWatchlistResult.added.join(', ')} directly to watchlist "${savedWatchlistResult.watchlistName}"`);
        }
      }

      const senderLabel = msg.sender?.username ? `@${msg.sender.username}` : (msg.sender?.firstName || 'Mobile');
      let tags = isAlertsTopic
        ? (isVoice ? `Telegram, Alerts, Mobile, Voice, ${senderLabel}` : `Telegram, Alerts, Mobile, ${senderLabel}`)
        : (isIdeasTopic
            ? (isVoice ? `Telegram, Ideas, Mobile, Voice, ${senderLabel}` : `Telegram, Ideas, Mobile, ${senderLabel}`)
            : (isExecutionTopic
                ? (isVoice ? `Telegram, Execution, Mobile, Queue, Voice, ${senderLabel}` : `Telegram, Execution, Mobile, Queue, ${senderLabel}`)
                : (isAppTopic
                    ? (isVoice ? `Telegram, App, Mobile, Voice, ${senderLabel}` : `Telegram, App, Mobile, ${senderLabel}`)
                    : (isVoice ? `Telegram, Mobile, Voice, ${senderLabel}` : `Telegram, Mobile, ${senderLabel}`))));

      if (autoCreatedAlerts.length > 0 || isAlertsTopic) {
        if (!tags.includes('Alert')) {
          tags += ', Alert';
        }
      }

      if (savedWatchlistResult || hasWatchlistDirective) {
        if (!tags.includes('Watchlist')) {
          tags += ', Watchlist';
        }
      }

      // Detect folder: if Alerts topic -> Alerts; if Ideas topic -> Ideas; if Execution topic -> Execution!
      let targetFolder = isAlertsTopic
        ? 'Alerts'
        : (isIdeasTopic
            ? 'Ideas'
            : (isExecutionTopic
                ? 'Execution'
                : (isAppTopic ? 'App' : (isVoice ? 'Voice Notes' : 'Telegram'))));

      const hashMatch = contentText.match(/#(?:folder:)?([A-Za-z0-9_-]+)\b/i);
      if (hashMatch && !isAppTopic && !isAlertsTopic && !isIdeasTopic && !isExecutionTopic) {
        const rawFolder = hashMatch[1];
        targetFolder = rawFolder.charAt(0).toUpperCase() + rawFolder.slice(1);
      } else if (autoCreatedAlerts.length > 0 && !isAppTopic && !isIdeasTopic && !isExecutionTopic) {
        targetFolder = 'Alerts';
      }

      // Clean App Idea details (Title, Topic, Category, Description)
      let ideaTitle = '';
      let ideaDescription: string | null = null;
      let ideaTopic = 'App';
      let ideaCategory = 'Feature';

      if (isAppTopic) {
        let cleanText = contentText.replace(/#(?:topic:)?(?:app|app-idea)\b/gi, '').trim();
        
        // Check for bracket topic e.g. [UI] or [Portfolio] or [Alerts]
        const bracketMatch = cleanText.match(/^\[([A-Za-z0-9_\-\s/]+)\]\s*(.*)/s);
        const colonMatch = cleanText.match(/^([A-Za-z0-9_\-\s]{2,20}):\s+(.*)/s);

        if (bracketMatch) {
          ideaTopic = bracketMatch[1].trim();
          cleanText = bracketMatch[2].trim();
        } else if (colonMatch && !colonMatch[1].toUpperCase().includes('HTTP')) {
          ideaTopic = colonMatch[1].trim();
          cleanText = colonMatch[2].trim();
        }

        const lowerTopic = ideaTopic.toLowerCase();
        if (lowerTopic.includes('ui') || lowerTopic.includes('design') || lowerTopic.includes('ux') || lowerTopic.includes('theme')) {
          ideaCategory = 'UI/UX';
        } else if (lowerTopic.includes('bug') || lowerTopic.includes('fix') || lowerTopic.includes('error') || lowerTopic.includes('crash')) {
          ideaCategory = 'Bug';
        } else if (lowerTopic.includes('data') || lowerTopic.includes('api') || lowerTopic.includes('sync')) {
          ideaCategory = 'Data';
        } else if (lowerTopic.includes('broker') || lowerTopic.includes('tasty') || lowerTopic.includes('ibkr') || lowerTopic.includes('trading212')) {
          ideaCategory = 'Integration';
        }

        const lines = cleanText.split('\n').map((l) => l.trim()).filter(Boolean);
        const rawHeadline = lines[0] || (isVoice ? 'Voice App Idea' : 'App Idea');
        ideaTitle = rawHeadline.length > 90 ? rawHeadline.slice(0, 87) + '...' : rawHeadline;
        ideaDescription = lines.length > 1 ? lines.slice(1).join('\n') : (rawHeadline.length > 90 ? cleanText : null);
      }

      let title = '';
      if (isAppTopic) {
        title = `💡 ${ideaTitle || 'App Idea'}`;
      } else if (isIdeasTopic) {
        const rawHeadline = createTitleFromText(contentText, msg.timestamp).replace(/^📱\s*/, '');
        title = `💡 Idea: ${rawHeadline}`;
      } else if (isExecutionTopic) {
        if (autoCreatedPlannedTrades.length > 0) {
          const tradeSummaries = autoCreatedPlannedTrades
            .map((t, idx) => {
              const strat = parsedTrades[idx]?.strategy;
              if (strat === 'Covered Call') return `Covered Call: ${Math.round(t.quantity * 100)}shs+${t.quantity}call ${t.symbol}`;
              if (strat) return `${strat}: ${t.quantity}cts ${t.symbol}`;
              if (t.assetType === 'OPTION') return `${t.action} ${t.quantity}cts ${t.symbol}`;
              return `${t.action} ${t.quantity} ${t.symbol}${t.targetPrice ? ` @ $${t.targetPrice}` : ''}`;
            })
            .join(', ');
          title = `🎯 ${tradeSummaries}`;
        } else {
          const rawHeadline = createTitleFromText(contentText, msg.timestamp).replace(/^📱\s*/, '');
          title = `🎯 Execute: ${rawHeadline}`;
        }
      } else if (isAlertsTopic) {
        if (autoCreatedAlerts.length > 0) {
          const alertSummary = autoCreatedAlerts.map((a) => `${a.symbol} ${a.condition === 'ABOVE' ? '▲' : '▼'} $${a.targetPrice}`).join(', ');
          title = `🔔 Alert: ${alertSummary}`;
        } else {
          const rawHeadline = createTitleFromText(contentText, msg.timestamp).replace(/^📱\s*/, '');
          title = `🔔 Alert: ${rawHeadline}`;
        }
      } else if (isVoice) {
        title = createVoiceTitleFromText(contentText, msg.timestamp);
      } else {
        title = createTitleFromText(contentText, msg.timestamp);
      }

      const alertNotes = autoCreatedAlerts.length > 0
        ? `🔔 **Auto Price Alert Armed**\n\n` +
          autoCreatedAlerts
            .map((a) => `• **${a.symbol}**: Target **$${a.targetPrice}** (${a.condition})${a.currentPrice ? ` — Spot: $${a.currentPrice.toFixed(2)}` : ''}`)
            .join('\n')
        : (isAlertsTopic
            ? `🔔 **Alerts Topic Telegram Note**\n\nSaved in **Alerts** folder.`
            : (isIdeasTopic
                ? `💡 **Telegram Trade/Market Idea**\n\nSaved in **Ideas** folder.` +
                  (savedWatchlistResult
                    ? `\n\n📌 **Saved to Watchlist**: Added **${savedWatchlistResult.added.map(s => `$${s}`).join(', ')}** directly to watchlist **"${savedWatchlistResult.watchlistName}"**.`
                    : (detectedSymbols.length > 0
                        ? `\n\n📌 **Watchlist**: ${detectedSymbols.map(s => `$${s}`).join(', ')} ready to add in 1-click via the "Add to Watchlist" button.`
                        : ''))
                : (isExecutionTopic
                    ? (autoCreatedPlannedTrades.length > 0
                        ? `🎯 **Saved to Daily & Weekly Trade Execution Queue**\n\n` +
                          autoCreatedPlannedTrades
                            .map((t, idx) => {
                              const strat = parsedTrades[idx]?.strategy;
                              const summary = formatTelegramExecutionSummary(t, strat).replace(/^• \*/, '• **').replace(/\* \(/, '** (');
                              return `${summary} [Status: ${t.status || 'PENDING'}]\n` +
                                (t.targetPrice ? `  - Target Entry: **$${t.targetPrice}**\n` : '') +
                                (t.stopLoss ? `  - Stop Loss: **$${t.stopLoss}**\n` : '') +
                                (t.targetExit ? `  - Target Exit: **$${t.targetExit}**\n` : '');
                            })
                            .join('\n') +
                          `\n*View and manage in Management > Execution Queue.*`
                        : `🎯 **Telegram Execution Topic**\n\nSaved in **Execution** folder. (No valid ticker symbol recognized to queue order).`)
                    : null)));

      const allSymbols = detectedSymbols.length > 0
        ? detectedSymbols
        : (autoCreatedAlerts.length > 0
            ? autoCreatedAlerts.map((a) => a.symbol)
            : autoCreatedPlannedTrades.map((t) => t.symbol));

      const savedLog = await (prisma as any).thoughtLog.create({
        data: {
          title,
          content: contentText.trim(),
          folder: targetFolder,
          tags,
          symbols: allSymbols.length > 0 ? Array.from(new Set(allSymbols)).join(', ') : null,
          sentiment,
          isPinned: false,
          isFulfilled: false,
          agentOutput: alertNotes,
          agentActionType: (autoCreatedAlerts.length > 0 || isAlertsTopic || isIdeasTopic || isExecutionTopic) ? 'ADD_CONTEXT' : null,
          marketDataJson: null,
          createdAt: new Date(msg.timestamp),
        },
      });

      // Also create dedicated AppIdea record if from App topic
      if (isAppTopic) {
        try {
          const existingIdea = msg.messageId
            ? await (prisma as any).appIdea.findFirst({
                where: { telegramMsgId: msg.messageId },
              })
            : null;

          if (!existingIdea) {
            await (prisma as any).appIdea.create({
              data: {
                title: ideaTitle || title.replace(/^💡\s*/, ''),
                description: ideaDescription || (contentText.trim() !== ideaTitle ? contentText.trim() : null),
                topic: ideaTopic,
                category: ideaCategory,
                isFulfilled: false,
                source: 'TELEGRAM',
                telegramMsgId: msg.messageId || null,
                thoughtLogId: savedLog.id,
                tags,
                createdAt: new Date(msg.timestamp),
              },
            });
            logToFile(`[TelegramBuffer] Created AppIdea record: "${ideaTitle}" in topic [${ideaTopic}]`);
          }
        } catch (ideaErr: any) {
          logToFile(`[TelegramBuffer] Error saving AppIdea record: ${ideaErr.message}`);
        }
      }

      createdLogs.push({
        id: savedLog.id,
        title: savedLog.title,
        symbols: savedLog.symbols,
      });
    }

    agentActivityTracker.completeTask(task.id, {
      status: 'SUCCESS',
      outcomeSummary: `Successfully ingested ${createdLogs.length} mobile thoughts from Telegram into SQLite ThoughtLog.`,
    });

    logToFile(`[TelegramBuffer] Successfully created ${createdLogs.length} ThoughtLog records in SQLite.`);

    return {
      success: true,
      consumedCount: createdLogs.length,
      createdLogs,
      message: `Successfully ingested ${createdLogs.length} mobile ideas from Telegram!`,
      timestamp: lastSyncTimestamp,
    };
  } catch (error: any) {
    logToFile(`[TelegramBuffer] Error consuming buffer: ${error.message}`);
    return {
      success: false,
      consumedCount: 0,
      createdLogs: [],
      message: error.message,
      timestamp: new Date().toISOString(),
    };
  } finally {
    isConsuming = false;
  }
}

/**
 * Get current configuration and sync status
 */
export function getTelegramBufferStatus() {
  const isConfigured = Boolean(process.env.TELEGRAM_BUFFER_URL);
  return {
    isConfigured,
    bufferUrl: process.env.TELEGRAM_BUFFER_URL || null,
    executionThreadId: process.env.TELEGRAM_EXECUTION_THREAD_ID || null,
    alertsThreadId: process.env.TELEGRAM_ALERTS_THREAD_ID || null,
    appThreadId: process.env.TELEGRAM_APP_THREAD_ID || null,
    lastSyncTimestamp,
    lastSyncCount,
  };
}

/**
 * Explicitly update and persist TELEGRAM_EXECUTION_THREAD_ID to environment & .env.local
 */
export function setTelegramExecutionThreadId(threadId: string | number): boolean {
  try {
    const threadIdStr = String(threadId).trim();
    process.env.TELEGRAM_EXECUTION_THREAD_ID = threadIdStr;
    logToFile(`[TelegramBuffer] Updated TELEGRAM_EXECUTION_THREAD_ID=${threadIdStr}`);
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (/TELEGRAM_EXECUTION_THREAD_ID=/i.test(envContent)) {
        envContent = envContent.replace(/TELEGRAM_EXECUTION_THREAD_ID=.*/g, `TELEGRAM_EXECUTION_THREAD_ID=${threadIdStr}`);
      } else {
        envContent += `\nTELEGRAM_EXECUTION_THREAD_ID=${threadIdStr}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
    }
    return true;
  } catch (e: any) {
    logToFile(`[TelegramBuffer] Error setting execution thread ID: ${e.message}`);
    return false;
  }
}

