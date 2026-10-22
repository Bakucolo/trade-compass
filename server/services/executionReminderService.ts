import { PrismaClient } from '@prisma/client';
import { sendTelegramMessage } from './telegramReportService';
import { KNOWN_COMPANY_NAMES } from './commonTickers';

const logToFile = (msg: string) => console.log(msg);

export interface ExecutionReminderItem {
  id: string;
  symbol: string;
  task: string;
  remindAt: Date;
  status: string; // 'PENDING' | 'TRIGGERED' | 'CANCELLED'
  chatId?: string | null;
  messageThreadId?: number | null;
  senderLabel?: string | null;
  sourceMessage?: string | null;
  notes?: string | null;
  triggeredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParsedExecutionReminder {
  symbol: string;
  task: string;
  remindAt: Date;
  rawDateTimeStr: string;
}

// Stop words to avoid mistaking common English words for tickers
const NON_TICKER_WORDS = new Set([
  'BUY', 'SELL', 'SHORT', 'COVER', 'BTO', 'STO', 'BTC', 'STC',
  'CALL', 'PUT', 'SPREAD', 'OPTION', 'OPTIONS', 'STOCK', 'STOCKS',
  'REMIND', 'REMINDER', 'TASK', 'SCHEDULE', 'EXECUTE', 'EXECUTION',
  'AT', 'ON', 'IN', 'FOR', 'TO', 'ME', 'THE', 'A', 'AN', 'IF', 'AND', 'OR',
  'TODAY', 'TOMORROW', 'TMRW', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN',
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
  'NOW', 'LATER', 'MORNING', 'AFTERNOON', 'EOD', 'CLOSE', 'OPEN', 'MARKET',
  'NEXT', 'THIS', 'HOUR', 'HOURS', 'MIN', 'MINS', 'MINUTE', 'MINUTES', 'DAY', 'DAYS',
  'STOP', 'TARGET', 'LIMIT', 'MKT', 'PRICE', 'RATE', 'WHEN', 'THEN', 'AFTER', 'BEFORE',
  'HOLD', 'WAIT'
]);

/**
 * Parses natural language input for ticker, execution task, and target date/time
 */
export function parseExecutionReminder(text: string, baseDate: Date = new Date()): ParsedExecutionReminder | null {
  const clean = text
    .replace(/#(?:topic:)?(?:execution|execute|trade-execution|queue)\b/gi, '')
    .replace(/^🎯\s*/, '')
    .trim();

  if (!clean) return null;

  const lower = clean.toLowerCase();

  // If this is purely a query command, don't parse as reminder creation
  if (/^(?:queue|orders|pending|status|list|active\s+orders|show\s+queue|reminders|tasks|scheduled|show\s+reminders|my\s+reminders|help)$/i.test(lower)) {
    return null;
  }

  // If this is a cancel command, don't parse as reminder creation
  if (/^(?:cancel|remove|delete|clear)\s+/i.test(lower)) {
    return null;
  }

  const hasReminderPrefix = /^(?:reminder\b|remind\b(?:\s+me)?|task\b|schedule\b)/i.test(lower);

  // Guard against options trade orders like "BTO 2 AAPL 250C 10/18 @ 4.50"
  // If it matches options strike + expiration and price, and lacks explicit reminder keywords/day words, it's a standard trade order
  const hasOptionsExpiry = /\b\d+[CP]\s+\d{1,2}[/-]\d{1,2}\b/i.test(clean);
  const hasTradeAction = /\b(?:BTO|STO|BUY|SELL)\s+\d+/i.test(clean);
  const hasFutureDayWord = /\b(?:today|tomorrow|tmrw|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i.test(lower);
  const hasInOffset = /\bin\s+\d+/i.test(lower);

  if (hasOptionsExpiry && hasTradeAction && !hasReminderPrefix && !hasFutureDayWord && !hasInOffset) {
    return null;
  }

  // ----------------------------------------------------
  // 1. DATE / TIME EXTRACTION
  // ----------------------------------------------------
  let extractedDate: Date | null = null;
  let rawDateTimeStr = '';
  let matchIndex = -1;
  let matchLength = 0;

  // A. Relative offset: "in 10m", "in 2 hours", "in 30 mins", "in 1 day", "in an hour"
  // Only match "in ..." OR explicit units "hours/hrs/minutes/mins" to avoid matching numbers in orders like "250 resistance"
  const relMatch = clean.match(/\bin\s+(\d+|an?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\b/i)
    || clean.match(/\b(\d+)\s*(hours?|hrs?|minutes?|mins?)\b/i)
    || clean.match(/\b(\d+)(h|m)\b/i);

  if (relMatch) {
    const rawVal = relMatch[1].toLowerCase();
    const num = rawVal === 'a' || rawVal === 'an' ? 1 : parseInt(rawVal, 10);
    const unit = (relMatch[2] || '').toLowerCase();

    let offsetMs = 0;
    if (unit.startsWith('s')) offsetMs = num * 1000;
    else if (unit.startsWith('m') || unit === 'min' || unit === 'mins' || unit === 'minute' || unit === 'minutes') offsetMs = num * 60 * 1000;
    else if (unit.startsWith('h') || unit === 'hr' || unit === 'hrs' || unit === 'hour' || unit === 'hours') offsetMs = num * 3600 * 1000;
    else if (unit.startsWith('d') || unit === 'day' || unit === 'days') offsetMs = num * 86400 * 1000;

    if (offsetMs > 0) {
      extractedDate = new Date(baseDate.getTime() + offsetMs);
      rawDateTimeStr = relMatch[0];
      matchIndex = relMatch.index ?? -1;
      matchLength = relMatch[0].length;
    }
  }

  // B. Day / Calendar Date with optional Time
  if (!extractedDate) {
    // Exclude option contract expiration dates like "250C 10/18"
    const safeCleanForDate = hasOptionsExpiry
      ? clean.replace(/\b\d+[CP]\s+\d{1,2}[/-]\d{1,2}\b/gi, '___OPTION___')
      : clean;

    const datePattern = /(?:(?:on|for)\s+)?(today|tomorrow|tmrw|(?:(?:this|next)\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)|\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*(?:,?\s*\d{4})?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/i;
    const timePattern = /(?:(?:at|@)\s+)?(\d{1,2}(?::\d{2})?(?::\d{2})?\s*(?:am|pm)?|market\s+open|market\s+close|noon|midnight|morning|afternoon|eod)/i;

    // Combined: [date] [time] or [time] [date]
    const combined1 = new RegExp(`\\b${datePattern.source}\\s*(?:at\\s+|@\\s+|,?\\s*)?${timePattern.source}\\b`, 'i');
    const combined2 = new RegExp(`\\b(?:at\\s+|@\\s+)?${timePattern.source}\\s+(?:on\\s+)?${datePattern.source}\\b`, 'i');

    const m1 = safeCleanForDate.match(combined1);
    const m2 = safeCleanForDate.match(combined2);

    let datePartStr = '';
    let timePartStr = '';

    if (m1) {
      datePartStr = m1[1];
      timePartStr = m1[2];
      rawDateTimeStr = m1[0];
      matchIndex = m1.index ?? -1;
      matchLength = m1[0].length;
    } else if (m2) {
      timePartStr = m2[1];
      datePartStr = m2[2];
      rawDateTimeStr = m2[0];
      matchIndex = m2.index ?? -1;
      matchLength = m2[0].length;
    } else {
      // Date only
      const dateOnly = safeCleanForDate.match(new RegExp(`\\b${datePattern.source}\\b`, 'i'));
      if (dateOnly) {
        datePartStr = dateOnly[1];
        rawDateTimeStr = dateOnly[0];
        matchIndex = dateOnly.index ?? -1;
        matchLength = dateOnly[0].length;
      } else {
        // Time only
        const timeOnly = safeCleanForDate.match(/\b(?:(?:at|@)\s+)(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|market\s+open|market\s+close|noon|midnight|morning|afternoon|eod)\b/i)
          || safeCleanForDate.match(/\b(\d{1,2}:\d{2}\s*(?:am|pm)?)\b/i)
          || safeCleanForDate.match(/\b(\d{1,2}\s*(?:am|pm))\b/i);

        if (timeOnly) {
          timePartStr = timeOnly[1] || timeOnly[0];
          rawDateTimeStr = timeOnly[0];
          matchIndex = timeOnly.index ?? -1;
          matchLength = timeOnly[0].length;
        }
      }
    }

    if (datePartStr || timePartStr) {
      extractedDate = computeDateTimeFromParts(datePartStr, timePartStr, baseDate);
    }
  }

  // If no date/time found and not a reminder keyword, not a reminder
  if (!extractedDate && !hasReminderPrefix) {
    return null;
  }

  // If reminder keyword present without explicit time, default to tomorrow market open (09:30)
  if (!extractedDate && hasReminderPrefix) {
    const defaultDate = new Date(baseDate);
    defaultDate.setDate(defaultDate.getDate() + 1);
    defaultDate.setHours(9, 30, 0, 0);
    extractedDate = defaultDate;
    rawDateTimeStr = 'tomorrow at 9:30 AM';
  }

  if (!extractedDate) return null;

  // ----------------------------------------------------
  // 2. EXTRACT TICKER / SYMBOL
  // ----------------------------------------------------
  // Remove the matched date/time chunk to isolate the ticker and task
  let textWithoutDateTime = clean;
  if (matchIndex >= 0 && matchLength > 0) {
    textWithoutDateTime = (
      clean.slice(0, matchIndex) + ' ' + clean.slice(matchIndex + matchLength)
    ).trim();
  }

  let symbol: string | null = null;

  // A. Check for $TICKER anywhere
  const dollarMatch = textWithoutDateTime.match(/\$([A-Za-z]{1,6})\b/);
  if (dollarMatch) {
    symbol = dollarMatch[1].toUpperCase();
  }

  // B. Check for explicit ticker after reminder prefix: "remind AAPL ...", "task NVDA ..."
  if (!symbol) {
    const prefixSymMatch = textWithoutDateTime.match(/^(?:reminder\b:?\s*|remind\b(?:\s+me)?|task\b:?\s*|schedule\b:?\s*)\s*(?:for\s+)?\$?([A-Za-z]{1,6})\b/i);
    if (prefixSymMatch && !NON_TICKER_WORDS.has(prefixSymMatch[1].toUpperCase())) {
      symbol = prefixSymMatch[1].toUpperCase();
    }
  }

  // C. Check leading word if it looks like a ticker: "AAPL roll call spread...", "TSLA check resistance..."
  if (!symbol) {
    const firstWordMatch = textWithoutDateTime.match(/^([A-Za-z]{1,6})\b/);
    if (firstWordMatch) {
      const candidate = firstWordMatch[1].toUpperCase();
      if (!NON_TICKER_WORDS.has(candidate)) {
        symbol = candidate;
      }
    }
  }

  // D. Check for standard trade action: "BUY 100 AAPL @ 150", "BTO 2 AAPL 250C"
  if (!symbol) {
    const tradeSymMatch = textWithoutDateTime.match(/\b(?:BUY|SELL|SHORT|COVER|BTO|STO|BTC|STC)\s+(?:\d+\s+)?(?:shares\s+(?:of\s+)?)?\$?([A-Za-z]{1,6})\b/i);
    if (tradeSymMatch && !NON_TICKER_WORDS.has(tradeSymMatch[1].toUpperCase())) {
      symbol = tradeSymMatch[1].toUpperCase();
    }
  }

  // E. Scan words for known company names or all-caps 2-5 letter symbols
  if (!symbol) {
    const words = textWithoutDateTime.split(/[\s,;:]+/);
    for (const w of words) {
      const cleanW = w.replace(/[^A-Za-z]/g, '').toUpperCase();
      if (cleanW.length >= 1 && cleanW.length <= 6 && !NON_TICKER_WORDS.has(cleanW)) {
        if (KNOWN_COMPANY_NAMES[cleanW] || /^[A-Z]{2,5}$/.test(w)) {
          symbol = cleanW;
          break;
        }
      }
    }
  }

  // If still no symbol found, but reminder prefix exists, fallback to 'GENERAL'
  if (!symbol && hasReminderPrefix) {
    symbol = 'GENERAL';
  }

  if (!symbol) return null;

  // ----------------------------------------------------
  // 3. EXTRACT TASK DESCRIPTION
  // ----------------------------------------------------
  let task = textWithoutDateTime;

  // Remove leading reminder prefix using strict word boundary
  task = task.replace(/^(?:reminder\b:?\s*|remind\b(?:\s+me)?(?:\s+to)?|task\b:?\s*|schedule\b:?\s*)/i, '').trim();

  // Remove leading ticker if present at start: "AAPL roll call..." -> "roll call..."
  const tickerPrefixRegex = new RegExp(`^\\$?${symbol}\\s*[:,-]?\\s*`, 'i');
  task = task.replace(tickerPrefixRegex, '').trim();

  // Remove dangling prepositions at start (only connectors, never action verbs)
  task = task.replace(/^(?:to|for|at|on|about)\s+/i, '').trim();

  // If the task was inside a structured order e.g. "BUY 100 AAPL @ 150", keep the full trade command
  if (!task || task.length < 2) {
    task = `Review & execute $${symbol} trade action`;
  } else {
    // Capitalize first letter of task for clean presentation
    task = task.charAt(0).toUpperCase() + task.slice(1);
  }

  return {
    symbol,
    task,
    remindAt: extractedDate,
    rawDateTimeStr: rawDateTimeStr.trim(),
  };
}

/**
 * Helper to compute Date object from extracted date and time strings
 */
function computeDateTimeFromParts(dateStr: string, timeStr: string, baseDate: Date): Date {
  const result = new Date(baseDate);
  const now = baseDate;

  // Parse Date part
  if (dateStr) {
    const dLower = dateStr.toLowerCase().trim();

    if (dLower === 'tomorrow' || dLower === 'tmrw') {
      result.setDate(result.getDate() + 1);
    } else if (dLower === 'today') {
      // Keep today
    } else if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i.test(dLower)) {
      const daysMap: Record<string, number> = {
        sun: 0, sunday: 0,
        mon: 1, monday: 1,
        tue: 2, tuesday: 2,
        wed: 3, wednesday: 3,
        thu: 4, thursday: 4,
        fri: 5, friday: 5,
        sat: 6, saturday: 6,
      };

      const match = dLower.match(/(?:(this|next)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/i);
      if (match) {
        const isNext = match[1] === 'next';
        const targetDay = daysMap[match[2].toLowerCase().slice(0, 3)];
        const currentDay = result.getDay();

        let diff = (targetDay - currentDay + 7) % 7;
        if (diff === 0 && isNext) diff = 7;
        else if (diff === 0) diff = 7; // e.g. saying "Friday" on Friday means next Friday

        result.setDate(result.getDate() + diff);
      }
    } else if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(dLower)) {
      const [y, m, d] = dLower.split(/[-/]/).map(n => parseInt(n, 10));
      result.setFullYear(y, m - 1, d);
    } else {
      // Month name parsing: e.g. "Oct 25" or "October 25th"
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const mMatch = dLower.match(/([a-z]{3})[a-z]*\s+(\d{1,2})/i) || dLower.match(/(\d{1,2})\s+(?:of\s+)?([a-z]{3})/i);
      if (mMatch) {
        const mStr = (monthNames.includes(mMatch[1].toLowerCase().slice(0, 3)) ? mMatch[1] : mMatch[2]).toLowerCase().slice(0, 3);
        const dNum = parseInt(monthNames.includes(mMatch[1].toLowerCase().slice(0, 3)) ? mMatch[2] : mMatch[1], 10);
        const mIdx = monthNames.indexOf(mStr);
        if (mIdx >= 0) {
          result.setMonth(mIdx, dNum);
          if (result < now && !dLower.includes(String(now.getFullYear()))) {
            result.setFullYear(result.getFullYear() + 1);
          }
        }
      }
    }
  }

  // Parse Time part
  let hours = 9;
  let minutes = 30; // default to market open 9:30 AM

  if (timeStr) {
    const tLower = timeStr.toLowerCase().trim();

    if (tLower.includes('market open') || tLower === 'morning') {
      hours = 9;
      minutes = 30;
    } else if (tLower.includes('market close')) {
      hours = 16;
      minutes = 0;
    } else if (tLower === 'noon') {
      hours = 12;
      minutes = 0;
    } else if (tLower === 'midnight') {
      hours = 0;
      minutes = 0;
    } else if (tLower === 'afternoon') {
      hours = 14;
      minutes = 0;
    } else if (tLower === 'eod') {
      hours = 15;
      minutes = 45;
    } else {
      // Matches "10am", "10:30am", "15:30", "3:30pm", "3pm"
      const hmMatch = tLower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (hmMatch) {
        let h = parseInt(hmMatch[1], 10);
        const m = hmMatch[2] ? parseInt(hmMatch[2], 10) : 0;
        const meridian = hmMatch[3]?.toLowerCase();

        if (meridian === 'pm' && h < 12) h += 12;
        else if (meridian === 'am' && h === 12) h = 0;

        hours = h;
        minutes = m;
      }
    }
  }

  result.setHours(hours, minutes, 0, 0);

  // If only a time was provided (no dateStr) and that time has already passed today, push to tomorrow
  if (!dateStr && result.getTime() <= now.getTime()) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}

/**
 * Creates and persists a new Execution Reminder
 */
export async function createExecutionReminder(
  data: {
    symbol: string;
    task: string;
    remindAt: Date;
    chatId?: string | number | null;
    messageThreadId?: number | null;
    senderLabel?: string | null;
    sourceMessage?: string | null;
    notes?: string | null;
  },
  prismaClient?: PrismaClient
): Promise<ExecutionReminderItem> {
  const prisma = (prismaClient || new PrismaClient()) as any;
  const cleanSym = data.symbol.trim().toUpperCase();

  const reminder = await prisma.executionReminder.create({
    data: {
      symbol: cleanSym,
      task: data.task.trim(),
      remindAt: data.remindAt,
      status: 'PENDING',
      chatId: data.chatId ? String(data.chatId) : null,
      messageThreadId: data.messageThreadId !== undefined && data.messageThreadId !== null ? Number(data.messageThreadId) : null,
      senderLabel: data.senderLabel || 'Telegram',
      sourceMessage: data.sourceMessage || null,
      notes: data.notes || null,
    },
  });

  return reminder;
}

/**
 * Retrieves execution reminders with optional filters
 */
export async function getExecutionReminders(
  filter?: { status?: string; symbol?: string },
  prismaClient?: PrismaClient
): Promise<ExecutionReminderItem[]> {
  const prisma = (prismaClient || new PrismaClient()) as any;
  const where: any = {};

  if (filter?.status && filter.status !== 'ALL') {
    where.status = filter.status.toUpperCase();
  }
  if (filter?.symbol) {
    where.symbol = filter.symbol.toUpperCase();
  }

  const reminders = await prisma.executionReminder.findMany({
    where,
    orderBy: { remindAt: 'asc' },
  });

  return reminders;
}

/**
 * Cancels execution reminders by symbol or ID
 */
export async function cancelExecutionReminder(
  idOrSymbol: string,
  prismaClient?: PrismaClient
): Promise<{ count: number; cancelled: ExecutionReminderItem[] }> {
  const prisma = (prismaClient || new PrismaClient()) as any;
  const clean = idOrSymbol.trim().toUpperCase();

  const matching = await prisma.executionReminder.findMany({
    where: {
      status: 'PENDING',
      OR: [
        { id: clean },
        { symbol: clean },
      ],
    },
  });

  if (matching.length === 0) {
    return { count: 0, cancelled: [] };
  }

  await prisma.executionReminder.updateMany({
    where: {
      id: { in: matching.map((m: any) => m.id) },
    },
    data: {
      status: 'CANCELLED',
    },
  });

  return { count: matching.length, cancelled: matching };
}

/**
 * Checks for due reminders and dispatches them to Telegram Execution topic
 */
export async function checkAndDispatchDueReminders(
  prismaClient: PrismaClient,
  customLog: (msg: string) => void = logToFile
): Promise<{ dispatchedCount: number; dispatched: ExecutionReminderItem[] }> {
  const prisma = prismaClient as any;
  const now = new Date();

  // Find all pending reminders whose remindAt <= now
  const dueReminders = await prisma.executionReminder.findMany({
    where: {
      status: 'PENDING',
      remindAt: { lte: now },
    },
    orderBy: { remindAt: 'asc' },
    take: 20,
  });

  if (dueReminders.length === 0) {
    return { dispatchedCount: 0, dispatched: [] };
  }

  const dispatched: ExecutionReminderItem[] = [];

  for (const reminder of dueReminders) {
    try {
      // Mark as TRIGGERED first to prevent race condition/double dispatch
      await prisma.executionReminder.update({
        where: { id: reminder.id },
        data: {
          status: 'TRIGGERED',
          triggeredAt: new Date(),
        },
      });

      const alertText = formatDueReminderTelegramAlert(reminder);

      const targetChatId = reminder.chatId
        || process.env.TELEGRAM_CHAT_ID;
      const targetThreadId = reminder.messageThreadId !== null && reminder.messageThreadId !== undefined
        ? reminder.messageThreadId
        : (process.env.TELEGRAM_EXECUTION_THREAD_ID ? Number(process.env.TELEGRAM_EXECUTION_THREAD_ID) : undefined);

      if (process.env.TELEGRAM_BOT_TOKEN && targetChatId) {
        await sendTelegramMessage({
          text: alertText,
          chatId: targetChatId,
          messageThreadId: targetThreadId,
          parseMode: 'Markdown',
        }).catch((sendErr: any) => {
          customLog(`[ExecutionReminder] Dispatch error for ${reminder.symbol}: ${sendErr.message}`);
        });
        customLog(`[ExecutionReminder] Dispatched due reminder for $${reminder.symbol} to chat ${targetChatId} (thread ${targetThreadId})`);
      }

      // Also create ThoughtLog in Execution folder
      try {
        await prisma.thoughtLog.create({
          data: {
            title: `⏰ Triggered Reminder: $${reminder.symbol} - ${reminder.task}`,
            content: `Scheduled Execution Task triggered at ${now.toLocaleTimeString()}:\n${reminder.task}`,
            folder: 'Execution',
            tags: `Telegram, Execution, Reminder, Triggered, ${reminder.symbol}`,
            symbols: reminder.symbol,
            sentiment: 'NEUTRAL',
            isPinned: false,
            isFulfilled: true,
            agentOutput: alertText,
            agentActionType: 'ADD_CONTEXT',
            createdAt: now,
          },
        });
      } catch (logErr: any) {
        customLog(`[ExecutionReminder] ThoughtLog save warning: ${logErr.message}`);
      }

      dispatched.push(reminder);
    } catch (err: any) {
      customLog(`[ExecutionReminder] Error processing reminder ${reminder.id}: ${err.message}`);
    }
  }

  return { dispatchedCount: dispatched.length, dispatched };
}

// ----------------------------------------------------
// TELEGRAM MESSAGE FORMATTERS
// ----------------------------------------------------

/**
 * Formats Telegram reply when a reminder is scheduled
 */
export function formatReminderCreatedTelegramReply(reminder: ExecutionReminderItem, rawInputStr?: string): string {
  const dateStr = reminder.remindAt.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const now = Date.now();
  const diffMs = reminder.remindAt.getTime() - now;
  let timeRemainingStr = '';
  if (diffMs > 0) {
    const hours = Math.floor(diffMs / (3600 * 1000));
    const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      timeRemainingStr = `(in ${days}d ${hours % 24}h)`;
    } else if (hours > 0) {
      timeRemainingStr = `(in ${hours}h ${mins}m)`;
    } else {
      timeRemainingStr = `(in ${mins}m)`;
    }
  }

  return `⏰ *Execution Reminder Scheduled*

• *Ticker:* *$${reminder.symbol}*
• *Execution Task:* ${reminder.task}
• *Scheduled Time:* ${dateStr} ${timeRemainingStr}
• *Topic:* 🎯 Execution Queue
• *Status:* ⏳ Armed / Active

───────────────────────
💡 _You will receive an automatic alert right here in the Execution topic at that exact time._
_Send \`reminders\` to review active reminders, or \`cancel reminder ${reminder.symbol}\` to remove._`;
}

/**
 * Formats Telegram reply when viewing active reminders
 */
export function formatRemindersListTelegramReply(reminders: ExecutionReminderItem[]): string {
  if (reminders.length === 0) {
    return `⏰ *Scheduled Execution Reminders*

_No active execution reminders scheduled._

💡 *How to Schedule Reminders in Execution Topic:*
• \`AAPL roll call spread tomorrow at 10am\`
• \`NVDA buy 100 shares if breakout holds Friday at 3:30pm\`
• \`remind TSLA trim position in 2 hours\`
• \`BUY 100 MSFT @ 420 tomorrow at 10am\`
• \`task PLTR sell covered call Oct 24 at 10am\``;
  }

  const rows = reminders.map((r, idx) => {
    const dateStr = r.remindAt.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const diffMs = r.remindAt.getTime() - Date.now();
    let remaining = '';
    if (diffMs > 0) {
      const h = Math.floor(diffMs / (3600 * 1000));
      const m = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
      remaining = h > 0 ? ` [in ${h}h ${m}m]` : ` [in ${m}m]`;
    } else {
      remaining = ' [Due Now]';
    }

    return `${idx + 1}. ⏰ *$${r.symbol}* — ${r.task}\n   📅 ${dateStr}${remaining}`;
  }).join('\n\n');

  return `⏰ *Scheduled Execution Reminders* (${reminders.length} active)

${rows}

───────────────────────
💡 _Send \`cancel reminder [TICKER]\` to remove a reminder._`;
}

/**
 * Formats the Telegram alert when an execution reminder is due
 */
export function formatDueReminderTelegramAlert(reminder: ExecutionReminderItem): string {
  const dueTimeStr = reminder.remindAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `⏰ *EXECUTION REMINDER DUE*

• *Ticker:* **$${reminder.symbol}**
• *Execution Task:* **${reminder.task}**
• *Scheduled Time:* ${dueTimeStr}
${reminder.sourceMessage ? `• *Original Input:* _"${reminder.sourceMessage}"_\n` : ''}
🎯 *Action Ready!*
💡 _To execute this trade now, reply with your order:_
• \`BUY 100 ${reminder.symbol} @ MKT\`
• \`STO 1 ${reminder.symbol} ...\`
• Or send \`queue\` to check your active Tactical Execution Queue.`;
}
