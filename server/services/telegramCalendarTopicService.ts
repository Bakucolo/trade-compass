import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { sendTelegramMessage, sendPdfReportToTelegram } from './telegramReportService';
import { lookupSymbolEarnings, fetchEarningsData, EarningsItem } from './earningsService';
import { extractSymbolsFromText } from './thoughtLogAgentService';
import { getCalendarTopicHelp } from './telegramTopicHelpService';

const logToFile = (msg: string) => console.log(msg);

export interface CalendarTopicRequest {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma: PrismaClient;
  senderLabel?: string;
  timestamp?: number;
}

export type CalendarTopicAction =
  | 'HELP'
  | 'UPCOMING_SCHEDULE'
  | 'PDF_REPORT'
  | 'TICKER_EARNINGS'
  | 'SCAN_DISPATCH'
  | 'INVALID_INPUT';

export interface CalendarTopicResult {
  handled: boolean;
  replyText: string;
  actionTaken: CalendarTopicAction;
  pdfGenerated?: boolean;
  symbol?: string | null;
  itemsCount?: number;
}

export type EarningsReminderType = '1_WEEK' | '1_DAY' | 'DAY_OF';

interface ReminderRecord {
  symbol: string;
  earningsDate: string;
  reminderType: EarningsReminderType;
  sentAt: string;
  chatId?: string;
  messageThreadId?: number;
}

const REMINDERS_PERSIST_FILE = path.join(process.cwd(), 'server', 'calendar_earnings_reminders.json');

// In-memory set of dispatched reminder keys: `${symbol}:${earningsDate}:${reminderType}`
const sentRemindersCache = new Set<string>();

/**
 * Load persisted reminder keys from disk
 */
function loadPersistedReminders(): void {
  try {
    if (fs.existsSync(REMINDERS_PERSIST_FILE)) {
      const raw = fs.readFileSync(REMINDERS_PERSIST_FILE, 'utf8');
      const records: ReminderRecord[] = JSON.parse(raw);
      if (Array.isArray(records)) {
        for (const r of records) {
          if (r.symbol && r.earningsDate && r.reminderType) {
            const key = `${r.symbol.toUpperCase()}:${r.earningsDate.slice(0, 10)}:${r.reminderType}`;
            sentRemindersCache.add(key);
          }
        }
      }
    }
  } catch (err: any) {
    logToFile(`[TelegramCalendar] Error reading persisted reminders: ${err.message}`);
  }
}

// Initial load
loadPersistedReminders();

/**
 * Clear reminder cache (used for unit testing)
 */
export function clearRemindersCacheForTesting(): void {
  sentRemindersCache.clear();
}

/**
 * Save reminder record to disk
 */
function persistReminderRecord(record: ReminderRecord): void {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return;
  }
  try {
    let records: ReminderRecord[] = [];
    if (fs.existsSync(REMINDERS_PERSIST_FILE)) {
      const raw = fs.readFileSync(REMINDERS_PERSIST_FILE, 'utf8');
      records = JSON.parse(raw) || [];
    }
    records.push(record);
    // Keep last 1,000 records
    if (records.length > 1000) {
      records = records.slice(-1000);
    }
    fs.writeFileSync(REMINDERS_PERSIST_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (err: any) {
    logToFile(`[TelegramCalendar] Error writing reminder record: ${err.message}`);
  }
}

/**
 * Checks whether an earnings reminder of a given type was already dispatched
 */
export async function hasReminderBeenSent(
  symbol: string,
  earningsDate: string,
  reminderType: EarningsReminderType,
  prisma: PrismaClient
): Promise<boolean> {
  const normSym = symbol.toUpperCase().trim();
  const dateKey = earningsDate.slice(0, 10);
  const cacheKey = `${normSym}:${dateKey}:${reminderType}`;

  if (sentRemindersCache.has(cacheKey)) {
    return true;
  }

  try {
    // Check database if table exists
    const existing = await (prisma as any).earningsReminderLog.findUnique({
      where: {
        symbol_earningsDate_reminderType: {
          symbol: normSym,
          earningsDate: dateKey,
          reminderType,
        },
      },
    });

    if (existing) {
      sentRemindersCache.add(cacheKey);
      return true;
    }
  } catch {
    // Fall back to memory & file if table not yet migrated
  }

  return false;
}

/**
 * Marks a reminder as dispatched across memory, file, and database
 */
export async function markReminderAsSent(
  symbol: string,
  earningsDate: string,
  reminderType: EarningsReminderType,
  details: {
    chatId?: string;
    messageThreadId?: number;
    messageText?: string;
  },
  prisma: PrismaClient
): Promise<void> {
  const normSym = symbol.toUpperCase().trim();
  const dateKey = earningsDate.slice(0, 10);
  const cacheKey = `${normSym}:${dateKey}:${reminderType}`;
  const nowIso = new Date().toISOString();

  sentRemindersCache.add(cacheKey);

  persistReminderRecord({
    symbol: normSym,
    earningsDate: dateKey,
    reminderType,
    sentAt: nowIso,
    chatId: details.chatId,
    messageThreadId: details.messageThreadId,
  });

  try {
    await (prisma as any).earningsReminderLog.upsert({
      where: {
        symbol_earningsDate_reminderType: {
          symbol: normSym,
          earningsDate: dateKey,
          reminderType,
        },
      },
      update: {
        sentAt: new Date(),
        messageText: details.messageText || null,
      },
      create: {
        symbol: normSym,
        earningsDate: dateKey,
        reminderType,
        sentAt: new Date(),
        chatId: details.chatId || null,
        messageThreadId: details.messageThreadId || null,
        messageText: details.messageText || null,
      },
    });
  } catch (err: any) {
    logToFile(`[TelegramCalendar] DB record notice: ${err.message}`);
  }
}

/**
 * Helper to format currency
 */
function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Helper to format large numbers (Market Cap, Revenue)
 */
function formatLargeNumber(num?: number | null): string {
  if (num === undefined || num === null || isNaN(num) || num === 0) return 'N/A';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/**
 * Format session timing label
 */
function formatSessionTiming(timing: 'BMO' | 'AMC' | 'UNSPECIFIED'): string {
  switch (timing) {
    case 'BMO':
      return 'Before Market Open (BMO) 🌅';
    case 'AMC':
      return 'After Market Close (AMC) 🌆';
    default:
      return 'Time Pending / Unspecified ⏱️';
  }
}

/**
 * Automated Scanner & Dispatcher for 1-Week and 1-Day Earnings Reminders
 * Dispatches automated messages to the Telegram Calendar forum topic
 */
export async function checkAndDispatchEarningsReminders(
  prisma: PrismaClient,
  botToken?: string,
  targetChatId?: string | number,
  targetThreadId?: number
): Promise<{
  checkedHoldingsCount: number;
  remindersDispatched: number;
  dispatchedList: string[];
}> {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId =
    targetChatId ||
    process.env.TELEGRAM_ALERTS_CHAT_ID ||
    process.env.TELEGRAM_CHAT_ID ||
    '-1003872409872';
  const threadId =
    targetThreadId ??
    (process.env.TELEGRAM_CALENDAR_THREAD_ID ? Number(process.env.TELEGRAM_CALENDAR_THREAD_ID) : 607);

  logToFile(
    `[TelegramCalendar] Scanning open positions for upcoming earnings reminders (Chat: ${chatId}, Thread: ${threadId})...`
  );

  // 1. Fetch active holdings from DB
  const rawHoldings = await prisma.holding.findMany({
    where: { quantity: { not: 0 } },
    include: { broker: true },
  });

  if (!rawHoldings || rawHoldings.length === 0) {
    logToFile('[TelegramCalendar] No active holdings found in database.');
    return { checkedHoldingsCount: 0, remindersDispatched: 0, dispatchedList: [] };
  }

  // 2. Aggregate by underlying symbol
  const holdingsBySymbol = new Map<
    string,
    {
      items: typeof rawHoldings;
      totalMarketValue: number;
      totalShares: number;
      totalOptions: number;
      totalUnrealizedPnL: number;
      brokers: Set<string>;
    }
  >();

  for (const h of rawHoldings) {
    const sym = (h.underlyingSymbol || h.symbol).trim().toUpperCase();
    const entry = holdingsBySymbol.get(sym) || {
      items: [],
      totalMarketValue: 0,
      totalShares: 0,
      totalOptions: 0,
      totalUnrealizedPnL: 0,
      brokers: new Set<string>(),
    };

    entry.items.push(h);
    entry.totalMarketValue += Math.abs(h.marketValue || 0);
    entry.totalUnrealizedPnL += h.unrealizedPnL || 0;
    if (h.broker?.name) entry.brokers.add(h.broker.name);

    if (h.assetType === 'OPTION') {
      entry.totalOptions += Math.abs(h.quantity || 0);
    } else {
      entry.totalShares += h.quantity || 0;
    }

    holdingsBySymbol.set(sym, entry);
  }

  const symbols = Array.from(holdingsBySymbol.keys());
  let remindersDispatched = 0;
  const dispatchedList: string[] = [];

  // 3. Check earnings date for each symbol
  for (const sym of symbols) {
    try {
      const earningsItem = await lookupSymbolEarnings(sym);
      if (!earningsItem || !earningsItem.earningsDate || earningsItem.daysUntil === null) {
        continue;
      }

      const daysUntil = earningsItem.daysUntil;
      const posData = holdingsBySymbol.get(sym)!;
      const brokersList = Array.from(posData.brokers).join(', ') || 'Connected Brokers';

      // Build position summary description
      const positionSummaryParts: string[] = [];
      if (posData.totalShares !== 0) {
        positionSummaryParts.push(`${posData.totalShares} ${posData.totalShares === 1 ? 'Share' : 'Shares'}`);
      }
      if (posData.totalOptions > 0) {
        positionSummaryParts.push(`${posData.totalOptions} Option ${posData.totalOptions === 1 ? 'Contract' : 'Contracts'}`);
      }
      const positionSummary = positionSummaryParts.join(' + ') || 'Open Position';
      const pnlSign = posData.totalUnrealizedPnL >= 0 ? '+' : '';
      const pnlPct =
        posData.totalMarketValue > 0
          ? ((posData.totalUnrealizedPnL / posData.totalMarketValue) * 100).toFixed(2)
          : '0.00';

      // ==========================================
      // A. ONE WEEK IN ADVANCE REMINDER (6 - 7 days out)
      // ==========================================
      if (daysUntil >= 6 && daysUntil <= 7) {
        const alreadySent = await hasReminderBeenSent(sym, earningsItem.earningsDate, '1_WEEK', prisma);
        if (!alreadySent) {
          const alertMsg =
            `📅 *UPCOMING EARNINGS ALERT — 1 WEEK NOTICE*\n\n` +
            `*$${sym}* (*${earningsItem.companyName}*) reports earnings in *${daysUntil} days*!\n\n` +
            `🗓️ *Reporting Date:* \`${earningsItem.earningsDateFormatted}\`\n` +
            `⏰ *Session Timing:* \`${formatSessionTiming(earningsItem.timing)}\`\n` +
            (earningsItem.isEstimate ? `_⚠️ Note: Date is an estimate by market consensus._\n` : '') +
            `\n💼 *Your Open Portfolio Position:*\n` +
            `• *Exposure:* ${positionSummary}\n` +
            `• *Market Value:* ${formatMoney(posData.totalMarketValue)}\n` +
            `• *Unrealized P&L:* ${pnlSign}${formatMoney(posData.totalUnrealizedPnL)} (${pnlSign}${pnlPct}%)\n` +
            `• *Brokers:* \`${brokersList}\`\n\n` +
            `📊 *Consensus Expectations:*\n` +
            `• *EPS Estimate:* ${earningsItem.epsEstimate !== null ? `$${earningsItem.epsEstimate.toFixed(2)}` : 'N/A'}` +
            (earningsItem.epsLow !== null && earningsItem.epsHigh !== null
              ? ` (Range: $${earningsItem.epsLow.toFixed(2)} to $${earningsItem.epsHigh.toFixed(2)})`
              : '') +
            `\n• *Revenue Estimate:* ${formatLargeNumber(earningsItem.revenueEstimate)}` +
            (earningsItem.peRatio ? `\n• *P/E Ratio:* ${earningsItem.peRatio.toFixed(1)}x` : '') +
            `\n\n🛡️ *Tactical Considerations (1-Week Window):*\n` +
            `• Review delta/vega posture ahead of earnings-induced IV expansion.\n` +
            `• For option sellers: evaluate rolling short contracts past the announcement cycle to avoid binary gap risk.\n` +
            `• For equity positions: decide whether to hold through earnings, trim, or lock in trailing stops.\n\n` +
            `💡 _Send \`${sym}\` in this topic for deep analysis, or \`calendar pdf\` to export your full schedule._`;

          if (token && chatId) {
            await sendTelegramMessage({
              text: alertMsg,
              chatId,
              messageThreadId: threadId,
              parseMode: 'Markdown',
            }).catch((e: any) => logToFile(`[TelegramCalendar] 1-week send error: ${e.message}`));
          }

          await markReminderAsSent(
            sym,
            earningsItem.earningsDate,
            '1_WEEK',
            { chatId: String(chatId), messageThreadId: threadId, messageText: alertMsg },
            prisma
          );

          remindersDispatched++;
          dispatchedList.push(`${sym} (1-Week: ${daysUntil}d out)`);
          logToFile(`[TelegramCalendar] 🔔 Dispatched 1-Week Earnings Reminder for $${sym} (${daysUntil}d out)`);
        }
      }

      // ==========================================
      // B. PREVIOUS DAY REMINDER (1 day out)
      // ==========================================
      if (daysUntil === 1) {
        const alreadySent = await hasReminderBeenSent(sym, earningsItem.earningsDate, '1_DAY', prisma);
        if (!alreadySent) {
          const alertMsg =
            `🚨 *IMMINENT EARNINGS ALERT — REPORTING TOMORROW!*\n\n` +
            `*$${sym}* (*${earningsItem.companyName}*) reports earnings *TOMORROW*!\n\n` +
            `🗓️ *Earnings Date:* \`${earningsItem.earningsDateFormatted}\`\n` +
            `⏰ *Session Timing:* \`${formatSessionTiming(earningsItem.timing)}\`\n` +
            `\n💼 *Your Open Exposure at Risk:*\n` +
            `• *Holding:* ${positionSummary}\n` +
            `• *Market Value:* ${formatMoney(posData.totalMarketValue)}\n` +
            `• *Unrealized P&L:* ${pnlSign}${formatMoney(posData.totalUnrealizedPnL)} (${pnlSign}${pnlPct}%)\n` +
            `• *Brokers:* \`${brokersList}\`\n\n` +
            `📊 *Wall Street Forecast:*\n` +
            `• *Consensus EPS:* ${earningsItem.epsEstimate !== null ? `$${earningsItem.epsEstimate.toFixed(2)}` : 'N/A'}\n` +
            `• *Consensus Revenue:* ${formatLargeNumber(earningsItem.revenueEstimate)}\n\n` +
            `⚡ *Immediate Action Window:*\n` +
            `• *Today is the final regular trading session* before the earnings announcement if scheduled for BMO tomorrow or AMC today.\n` +
            `• Post-earnings implied volatility crush will take effect immediately upon market open following results.\n` +
            `• Verify position sizing and ensure stop-loss / hedging orders are in place if taking action.\n\n` +
            `💡 _Send \`${sym}\` for instant telemetry, or \`calendar pdf\` to download the institutional schedule._`;

          if (token && chatId) {
            await sendTelegramMessage({
              text: alertMsg,
              chatId,
              messageThreadId: threadId,
              parseMode: 'Markdown',
            }).catch((e: any) => logToFile(`[TelegramCalendar] 1-day send error: ${e.message}`));
          }

          await markReminderAsSent(
            sym,
            earningsItem.earningsDate,
            '1_DAY',
            { chatId: String(chatId), messageThreadId: threadId, messageText: alertMsg },
            prisma
          );

          remindersDispatched++;
          dispatchedList.push(`${sym} (1-Day: Tomorrow)`);
          logToFile(`[TelegramCalendar] 🚨 Dispatched 1-Day Earnings Reminder for $${sym} (Tomorrow)`);
        }
      }

      // ==========================================
      // C. DAY OF EARNINGS REMINDER (0 days out)
      // ==========================================
      if (daysUntil === 0) {
        const alreadySent = await hasReminderBeenSent(sym, earningsItem.earningsDate, 'DAY_OF', prisma);
        if (!alreadySent) {
          const alertMsg =
            `🔔 *EARNINGS REPORT TODAY — $${sym}*\n\n` +
            `*$${sym}* (*${earningsItem.companyName}*) reports earnings *TODAY*!\n\n` +
            `🗓️ *Date:* \`${earningsItem.earningsDateFormatted}\`\n` +
            `⏰ *Session:* \`${formatSessionTiming(earningsItem.timing)}\`\n` +
            `💼 *Position Value:* ${formatMoney(posData.totalMarketValue)} (${positionSummary})\n` +
            `📊 *EPS Estimate:* ${earningsItem.epsEstimate !== null ? `$${earningsItem.epsEstimate.toFixed(2)}` : 'N/A'}\n\n` +
            `_Monitor price action and implied volatility crush closely today!_`;

          if (token && chatId) {
            await sendTelegramMessage({
              text: alertMsg,
              chatId,
              messageThreadId: threadId,
              parseMode: 'Markdown',
            }).catch((e: any) => logToFile(`[TelegramCalendar] Day-of send error: ${e.message}`));
          }

          await markReminderAsSent(
            sym,
            earningsItem.earningsDate,
            'DAY_OF',
            { chatId: String(chatId), messageThreadId: threadId, messageText: alertMsg },
            prisma
          );

          remindersDispatched++;
          dispatchedList.push(`${sym} (Day-Of: Today)`);
          logToFile(`[TelegramCalendar] 🔔 Dispatched Day-Of Earnings Reminder for $${sym}`);
        }
      }
    } catch (symErr: any) {
      logToFile(`[TelegramCalendar] Error checking earnings for ${sym}: ${symErr.message}`);
    }
  }

  return {
    checkedHoldingsCount: symbols.length,
    remindersDispatched,
    dispatchedList,
  };
}

/**
 * Generates an executive PDF dossier of portfolio upcoming earnings schedule
 */
export async function generateCalendarDossierPdf(
  items: EarningsItem[],
  summary: any
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 36, bottom: 36, left: 36, right: 36 },
      bufferPages: true,
    });

    const buffers: Buffer[] = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const colors = {
      primaryNavy: '#0F172A',
      secondaryNavy: '#1E293B',
      cardBg: '#F8FAFC',
      cardBorder: '#E2E8F0',
      accentIndigo: '#4F46E5',
      accentCyan: '#0EA5E9',
      accentEmerald: '#10B981',
      accentRose: '#EF4444',
      accentAmber: '#F59E0B',
      slateDark: '#334155',
      slateMuted: '#64748B',
      white: '#FFFFFF',
    };

    // Header Banner
    doc.rect(36, 36, 523, 54).fill(colors.primaryNavy);
    doc.fillColor(colors.white).fontSize(14).font('Helvetica-Bold')
      .text('Trade Compass • Portfolio Earnings Calendar & Catalysts Dossier', 48, 48);
    doc.fillColor(colors.accentCyan).fontSize(8).font('Helvetica')
      .text(
        `Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • Monitored Positions & Watchlist Catalysts`,
        48,
        68
      );

    // Summary Metrics Banner
    let curY = 98;
    doc.rect(36, curY, 523, 44).fill(colors.cardBg);
    doc.rect(36, curY, 523, 44).strokeColor(colors.cardBorder).lineWidth(1).stroke();

    const metricCols = [
      { label: 'MONITORED HOLDINGS', val: `${summary?.portfolioCount || 0}` },
      { label: 'THIS WEEK (7D)', val: `${summary?.reportingThisWeek || 0}` },
      { label: 'NEXT WEEK (14D)', val: `${summary?.reportingNextWeek || 0}` },
      { label: 'THIS MONTH (30D)', val: `${summary?.reportingThisMonth || 0}` },
      {
        label: 'CAPITAL AT RISK (30D)',
        val: formatLargeNumber(summary?.totalPortfolioValueAtRisk || 0),
      },
    ];

    const colW = 523 / metricCols.length;
    metricCols.forEach((m, i) => {
      const x = 36 + i * colW;
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica-Bold')
        .text(m.label, x + 8, curY + 8, { width: colW - 16, align: 'center' });
      doc.fillColor(colors.primaryNavy).fontSize(12).font('Helvetica-Bold')
        .text(m.val, x + 8, curY + 22, { width: colW - 16, align: 'center' });
    });

    curY += 54;

    // Filter portfolio holdings with upcoming earnings
    const portfolioUpcoming = items.filter(
      (it) => it.isPortfolioHolding && it.daysUntil !== null && it.daysUntil >= 0
    );
    const watchlistUpcoming = items.filter(
      (it) => it.isWatchlist && !it.isPortfolioHolding && it.daysUntil !== null && it.daysUntil >= 0
    );

    const displayList = portfolioUpcoming.length > 0 ? portfolioUpcoming : items.slice(0, 15);

    doc.fillColor(colors.primaryNavy).fontSize(10).font('Helvetica-Bold')
      .text('Upcoming Earnings Announcement Schedule', 36, curY);
    curY += 16;

    if (displayList.length === 0) {
      doc.fillColor(colors.slateMuted).fontSize(9).font('Helvetica')
        .text('No upcoming earnings dates currently found for portfolio holdings.', 36, curY);
    } else {
      for (const item of displayList) {
        if (curY > 710) {
          doc.addPage();
          curY = 40;
        }

        const isUrgent = item.daysUntil !== null && item.daysUntil <= 7;
        const cardH = 50;
        doc.rect(36, curY, 523, cardH).fill(colors.cardBg);
        doc.rect(36, curY, 523, cardH).strokeColor(isUrgent ? colors.accentAmber : colors.cardBorder).lineWidth(isUrgent ? 1.5 : 0.75).stroke();

        // Ticker & Badge
        doc.fillColor(colors.primaryNavy).fontSize(10).font('Helvetica-Bold')
          .text(`$${item.symbol}`, 46, curY + 8);
        doc.fillColor(colors.slateDark).fontSize(8).font('Helvetica')
          .text(item.companyName, 95, curY + 10, { width: 170, ellipsis: true });

        // Timing & Days Badge
        const timingStr = item.timing === 'BMO' ? 'BMO 🌅' : item.timing === 'AMC' ? 'AMC 🌆' : 'Pending';
        const daysText =
          item.daysUntil === 0
            ? 'TODAY 🔔'
            : item.daysUntil === 1
            ? 'TOMORROW 🚨'
            : `${item.daysUntil} Days Remaining`;

        doc.fillColor(isUrgent ? colors.accentRose : colors.accentIndigo).fontSize(8).font('Helvetica-Bold')
          .text(daysText, 275, curY + 8, { width: 130 });
        doc.fillColor(colors.slateMuted).fontSize(7).font('Helvetica')
          .text(`Date: ${item.earningsDateFormatted} (${timingStr})`, 275, curY + 22);

        // Position / Financials
        let rightText = '';
        if (item.isPortfolioHolding && item.portfolioMarketValue) {
          rightText = `Position: ${formatMoney(item.portfolioMarketValue)}`;
        } else {
          rightText = `Price: $${item.price.toFixed(2)}`;
        }
        const epsStr = item.epsEstimate !== null ? `EPS Est: $${item.epsEstimate.toFixed(2)}` : 'EPS Est: N/A';

        doc.fillColor(colors.primaryNavy).fontSize(8).font('Helvetica-Bold')
          .text(rightText, 410, curY + 8, { width: 140, align: 'right' });
        doc.fillColor(colors.slateMuted).fontSize(7).font('Helvetica')
          .text(epsStr, 410, curY + 22, { width: 140, align: 'right' });

        // Defense guidance line
        const guideText = isUrgent
          ? '⚡ Action: Check delta/vega risk & evaluate rolling short options before announcement.'
          : 'Status: Position monitored for 1-week and previous-day automatic Telegram alerts.';
        doc.fillColor(isUrgent ? colors.accentAmber : colors.slateMuted).fontSize(6.5).font('Helvetica')
          .text(guideText, 46, curY + 36, { width: 500 });

        curY += cardH + 6;
      }
    }

    // Numbered Footers
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const oldBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const footerY = 752;
      doc.rect(36, footerY, 523, 0.75).fill(colors.cardBorder);
      doc.fillColor(colors.slateMuted).fontSize(6.5).font('Helvetica')
        .text(
          'Trade Compass Institutional Intelligence • Automated Earnings Catalyst Dispatcher',
          36,
          footerY + 6,
          { lineBreak: false }
        );
      doc.fillColor(colors.accentIndigo).fontSize(6.5).font('Helvetica-Bold')
        .text(`Page ${i + 1} of ${totalPages}`, 463, footerY + 6, { width: 96, align: 'right', lineBreak: false });
      doc.page.margins.bottom = oldBottom;
    }

    doc.end();
  });
}

/**
 * Formats Telegram Markdown message listing upcoming portfolio earnings schedule
 */
export function formatCalendarScheduleMessage(
  items: EarningsItem[],
  summary: any
): string {
  const portfolioItems = items.filter((it) => it.isPortfolioHolding && it.daysUntil !== null && it.daysUntil >= 0);
  const displayItems = portfolioItems.length > 0 ? portfolioItems : items.filter((it) => it.daysUntil !== null && it.daysUntil >= 0).slice(0, 10);

  if (displayItems.length === 0) {
    return (
      `📅 *Trade Compass — Earnings Calendar*\n\n` +
      `No upcoming earnings dates are currently detected for your active portfolio holdings.\n\n` +
      `💡 _Send any ticker symbol (e.g. \`AAPL\`, \`NVDA\`, \`PLTR\`) to look up earnings dates on demand, or send \`scan\` to trigger a fresh portfolio audit._`
    );
  }

  // Group items by proximity
  const thisWeek = displayItems.filter((it) => it.daysUntil !== null && it.daysUntil <= 7);
  const nextWeek = displayItems.filter((it) => it.daysUntil !== null && it.daysUntil > 7 && it.daysUntil <= 14);
  const thisMonth = displayItems.filter((it) => it.daysUntil !== null && it.daysUntil > 14 && it.daysUntil <= 30);
  const later = displayItems.filter((it) => it.daysUntil !== null && it.daysUntil > 30);

  let msg = `📅 *Trade Compass — Portfolio Earnings Calendar*\n\n`;
  msg += `Monitored Holdings: *${summary?.portfolioCount || displayItems.length}* | Capital at Risk (30D): *${formatLargeNumber(summary?.totalPortfolioValueAtRisk || 0)}*\n\n`;

  const formatItemRow = (it: EarningsItem): string => {
    const timingBadge = it.timing === 'BMO' ? 'BMO 🌅' : it.timing === 'AMC' ? 'AMC 🌆' : 'Time TBD';
    const dayLabel =
      it.daysUntil === 0
        ? '🔔 *TODAY*'
        : it.daysUntil === 1
        ? '🚨 *TOMORROW*'
        : `in *${it.daysUntil}d*`;

    let posText = '';
    if (it.portfolioMarketValue) {
      posText = ` • Pos: *${formatMoney(it.portfolioMarketValue)}*`;
    }
    const epsText = it.epsEstimate !== null ? ` • EPS: $${it.epsEstimate.toFixed(2)}` : '';

    return `• *$${it.symbol}* (${it.companyName}): \`${it.earningsDateFormatted}\` (${timingBadge}) — ${dayLabel}${posText}${epsText}`;
  };

  if (thisWeek.length > 0) {
    msg += `🚨 *Imminent (Within 7 Days — Action Required):*\n`;
    thisWeek.forEach((it) => {
      msg += `${formatItemRow(it)}\n`;
    });
    msg += `\n`;
  }

  if (nextWeek.length > 0) {
    msg += `📅 *Next Week (8 – 14 Days Out):*\n`;
    nextWeek.forEach((it) => {
      msg += `${formatItemRow(it)}\n`;
    });
    msg += `\n`;
  }

  if (thisMonth.length > 0) {
    msg += `🗓️ *This Month (15 – 30 Days Out):*\n`;
    thisMonth.forEach((it) => {
      msg += `${formatItemRow(it)}\n`;
    });
    msg += `\n`;
  }

  if (later.length > 0) {
    msg += `⏳ *Later Dates:*\n`;
    later.slice(0, 5).forEach((it) => {
      msg += `${formatItemRow(it)}\n`;
    });
    msg += `\n`;
  }

  msg += `🔔 _You will automatically receive alerts 1 week before and the day prior to each holding's report._\n`;
  msg += `📄 _Send \`calendar pdf\` to export an institutional PDF dossier of this schedule._`;

  return msg;
}

/**
 * Formats a detailed single-ticker earnings breakdown
 */
export function formatSingleTickerEarningsMessage(item: EarningsItem): string {
  const timingBadge = formatSessionTiming(item.timing);
  const daysText =
    item.daysUntil === null
      ? 'Date Pending'
      : item.daysUntil === 0
      ? '🔔 REPORTING TODAY'
      : item.daysUntil === 1
      ? '🚨 REPORTING TOMORROW'
      : `in ${item.daysUntil} Days (${item.earningsDateFormatted})`;

  let msg = `📅 *Earnings Catalyst Diagnostic: $${item.symbol}*\n`;
  msg += `*${item.companyName}* | Current Price: *$${item.price.toFixed(2)}* (${item.dayChangePercent >= 0 ? '+' : ''}${item.dayChangePercent.toFixed(2)}%)\n\n`;

  msg += `🗓️ *Earnings Timing:*\n`;
  msg += `• *Scheduled Date:* \`${item.earningsDateFormatted}\`\n`;
  msg += `• *Session Timing:* \`${timingBadge}\`\n`;
  msg += `• *Countdown:* *${daysText}*\n`;
  if (item.isEstimate) {
    msg += `• _Note: Earnings date is an estimate by consensus consensus._\n`;
  }
  msg += `\n`;

  msg += `📊 *Wall Street Consensus Estimates:*\n`;
  msg += `• *EPS Estimate:* ${item.epsEstimate !== null ? `$${item.epsEstimate.toFixed(2)}` : 'N/A'}\n`;
  if (item.epsLow !== null && item.epsHigh !== null) {
    msg += `• *EPS Range:* $${item.epsLow.toFixed(2)} to $${item.epsHigh.toFixed(2)}\n`;
  }
  msg += `• *Revenue Estimate:* ${formatLargeNumber(item.revenueEstimate)}\n`;
  if (item.peRatio) {
    msg += `• *P/E Ratio:* ${item.peRatio.toFixed(1)}x\n`;
  }
  msg += `\n`;

  if (item.isPortfolioHolding && item.portfolioMarketValue) {
    msg += `💼 *Your Active Position Exposure:*\n`;
    msg += `• *Market Value:* ${formatMoney(item.portfolioMarketValue)}\n`;
    if (item.portfolioQuantity) msg += `• *Quantity:* ${item.portfolioQuantity}\n`;
    if (item.portfolioDayPnL !== null && item.portfolioDayPnL !== undefined) {
      const pnlSign = item.portfolioDayPnL >= 0 ? '+' : '';
      msg += `• *Today P&L:* ${pnlSign}${formatMoney(item.portfolioDayPnL)}\n`;
    }
    msg += `• *Automated Reminders:* Active (1 Week and 1 Day Alerts armed for this topic)\n\n`;
  } else {
    msg += `💼 *Portfolio Status:* Not currently held in your active portfolio.\n\n`;
  }

  msg += `🛡️ *Defensive Guidance:*\n`;
  msg += `• Anticipate elevated implied volatility ahead of the announcement.\n`;
  msg += `• If holding short options, assess assignment and gap risk.\n`;
  msg += `• Send \`calendar pdf\` to export your full schedule dossier.`;

  return msg;
}

/**
 * Main dispatcher for Telegram messages inside the Calendar topic
 */
export async function handleCalendarTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
  senderLabel,
}: CalendarTopicRequest): Promise<CalendarTopicResult> {
  const clean = (text || '').trim();
  const lower = clean.toLowerCase();

  // 1. Help Request
  if (
    /^(?:help|\?|guide|commands?|usage|info)$/i.test(lower) ||
    lower.includes('how to use') ||
    lower.includes('what can i do')
  ) {
    const helpMsg = getCalendarTopicHelp();
    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: helpMsg,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramCalendar] Help send error: ${e.message}`));
    }
    return {
      handled: true,
      actionTaken: 'HELP',
      replyText: helpMsg,
    };
  }

  // 2. Scan & Dispatch on-demand command (e.g. "scan", "check", "run scan", "refresh")
  if (/^(?:scan|check|run\s+scan|check\s+earnings|check\s+reminders|dispatch|refresh)$/i.test(lower)) {
    logToFile(`[TelegramCalendar] On-demand scan triggered by ${senderLabel}`);
    const scanResult = await checkAndDispatchEarningsReminders(
      prisma,
      process.env.TELEGRAM_BOT_TOKEN,
      chatId,
      messageThreadId
    );

    const scanMsg =
      `🔍 *Earnings Reminder Audit Complete*\n\n` +
      `• *Positions Monitored:* *${scanResult.checkedHoldingsCount}*\n` +
      `• *Reminders Dispatched Just Now:* *${scanResult.remindersDispatched}*\n` +
      (scanResult.dispatchedList.length > 0
        ? `• *Dispatched Alerts:* ${scanResult.dispatchedList.join(', ')}\n\n`
        : `• All 1-week and 1-day reminders for eligible positions are already up to date!\n\n`) +
      `💡 _Automated scans run continuously in the background to ensure you receive 7-day and 1-day advance notices._`;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: scanMsg,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramCalendar] Scan reply error: ${e.message}`));
    }

    return {
      handled: true,
      actionTaken: 'SCAN_DISPATCH',
      replyText: scanMsg,
      itemsCount: scanResult.checkedHoldingsCount,
    };
  }

  // 3. PDF Report Request (e.g. "pdf", "calendar pdf", "earnings pdf", "list pdf")
  const isPdfRequested = /\b(?:pdf|dossier|document|report)\b/i.test(lower);

  if (isPdfRequested) {
    try {
      logToFile(`[TelegramCalendar] Generating executive Earnings Calendar PDF requested by ${senderLabel}...`);
      const earningsData = await fetchEarningsData(prisma);
      const pdfBuffer = await generateCalendarDossierPdf(earningsData.items, earningsData.summary);

      const filename = `TradeCompass_Earnings_Calendar_${new Date().toISOString().slice(0, 10)}.pdf`;
      const caption =
        `📅 *Trade Compass — Portfolio Earnings Calendar Dossier*\n\n` +
        `Attached is your institutional PDF schedule of upcoming earnings catalysts for active portfolio holdings.\n` +
        `• *Monitored Holdings:* ${earningsData.summary.portfolioCount}\n` +
        `• *Reporting within 7 Days:* ${earningsData.summary.reportingThisWeek}\n` +
        `• *Capital at Risk (30 Days):* ${formatLargeNumber(earningsData.summary.totalPortfolioValueAtRisk)}\n\n` +
        `💡 _Automated 1-week and 1-day alerts will continue to arrive directly in this topic._`;

      if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
        await sendPdfReportToTelegram(pdfBuffer, filename, caption, {
          chatId,
          messageThreadId,
        }).catch((e: any) => logToFile(`[TelegramCalendar] PDF send error: ${e.message}`));
      }

      return {
        handled: true,
        actionTaken: 'PDF_REPORT',
        replyText: caption,
        pdfGenerated: true,
        itemsCount: earningsData.items.length,
      };
    } catch (pdfErr: any) {
      logToFile(`[TelegramCalendar] PDF generation error: ${pdfErr.message}. Falling back to text summary.`);
    }
  }

  // 4. Check for Specific Ticker query (e.g. "AAPL", "$NVDA", "PLTR earnings")
  const extracted = extractSymbolsFromText(clean);
  const specificSymbol = extracted.length > 0 ? extracted[0] : null;

  if (specificSymbol && !/^(?:CALENDAR|EARNINGS|UPCOMING|LIST|SCHEDULE|ALL|PORTFOLIO|HELP|SCAN|PDF)$/i.test(specificSymbol)) {
    logToFile(`[TelegramCalendar] Looking up single ticker earnings for $${specificSymbol}...`);
    const singleItem = await lookupSymbolEarnings(specificSymbol);

    if (singleItem && singleItem.earningsDate) {
      // Check if held in portfolio
      const holding = await prisma.holding.findFirst({
        where: {
          OR: [
            { symbol: { equals: specificSymbol } },
            { underlyingSymbol: { equals: specificSymbol } },
          ],
          quantity: { not: 0 },
        },
      });

      if (holding) {
        singleItem.isPortfolioHolding = true;
        singleItem.portfolioMarketValue = Math.abs(holding.marketValue || 0);
        singleItem.portfolioQuantity = holding.quantity;
        singleItem.portfolioDayPnL = holding.dayPnL;
      }

      const tickerMsg = formatSingleTickerEarningsMessage(singleItem);

      if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
        await sendTelegramMessage({
          text: tickerMsg,
          chatId,
          messageThreadId,
          parseMode: 'Markdown',
        }).catch((e: any) => logToFile(`[TelegramCalendar] Single ticker send error: ${e.message}`));
      }

      return {
        handled: true,
        actionTaken: 'TICKER_EARNINGS',
        symbol: specificSymbol,
        replyText: tickerMsg,
      };
    }
  }

  // 5. Default: Full Upcoming Earnings Calendar Schedule
  logToFile(`[TelegramCalendar] Fetching upcoming portfolio earnings schedule...`);
  const earningsData = await fetchEarningsData(prisma);
  const replyText = formatCalendarScheduleMessage(earningsData.items, earningsData.summary);

  if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
    await sendTelegramMessage({
      text: replyText,
      chatId,
      messageThreadId,
      parseMode: 'Markdown',
    }).catch((e: any) => logToFile(`[TelegramCalendar] Schedule send error: ${e.message}`));
  }

  return {
    handled: true,
    actionTaken: 'UPCOMING_SCHEDULE',
    replyText,
    itemsCount: earningsData.items.length,
  };
}
