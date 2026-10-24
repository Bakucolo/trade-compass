import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { sendTelegramMessage } from './telegramReportService';
import {
  getTelegramBufferStatus,
  setTelegramExecutionThreadId,
  setTelegramWatchlistThreadId,
  setTelegramNotesThreadId,
  setTelegramPositionsThreadId,
  setTelegramBalancesThreadId,
  setTelegramMacroThreadId,
  setTelegramTradeThreadId,
  setTelegramSetAlertThreadId,
  setTelegramTickerThreadId,
  setTelegramCalendarThreadId,
} from './telegramBufferConsumerService';

const logToFile = (msg: string) => console.log(msg);

export interface TopicsManagementRequest {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma: PrismaClient;
}

export type TopicManagementAction =
  | 'OVERVIEW'
  | 'SET_THREAD'
  | 'TEST_TOPIC'
  | 'HELP';

/**
 * Checks if incoming text is a request to check or manage the Telegram topics
 */
export function isTopicsManagementRequest(rawText: string): boolean {
  if (!rawText) return false;
  const clean = rawText
    .trim()
    .toLowerCase()
    .replace(/^(?:🧭|⚙️|📱|📊)\s*/, '')
    .replace(/[?!.]+$/, '')
    .trim();

  // Overview / Status commands
  if (
    /^(topics?|topic\s+status|topics?\s+status|manage\s+topics?|topic\s+list|topics?\s+list|topics?\s+overview|topics?\s+summary|topics?\s+dashboard|overview)$/i.test(
      clean
    )
  ) {
    return true;
  }

  // Management commands
  if (
    /^(?:set\s+topic|map\s+topic|link\s+topic|config\s+topic)\s+[a-z0-9_\-\s]+/i.test(
      clean
    )
  ) {
    return true;
  }

  // Test / Ping command
  if (/^(?:test\s+topic|ping\s+topic|check\s+topic)\s+[a-z0-9_\-\s]+/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Helper to update any topic thread ID in environment and .env.local
 */
export function setGenericTopicThreadId(topicName: string, threadId: string | number): boolean {
  const tName = topicName.trim().toUpperCase().replace(/[\s-]+/g, '_');
  const threadIdStr = String(threadId).trim();

  let envKey = '';
  switch (tName) {
    case 'BALANCES':
      return setTelegramBalancesThreadId(threadIdStr);
    case 'MACRO':
      return setTelegramMacroThreadId(threadIdStr);
    case 'TRADE':
    case 'TRADES':
    case 'OPTIONS':
    case 'OPTION':
      return setTelegramTradeThreadId(threadIdStr);
    case 'POSITIONS':
      return setTelegramPositionsThreadId(threadIdStr);
    case 'WATCHLIST':
    case 'WATCHLISTS':
      return setTelegramWatchlistThreadId(threadIdStr);
    case 'NOTES':
    case 'NOTE':
      return setTelegramNotesThreadId(threadIdStr);
    case 'EXECUTION':
    case 'QUEUE':
      return setTelegramExecutionThreadId(threadIdStr);
    case 'SET_ALERT':
    case 'SET_ALERTS':
    case 'SETALERT':
    case 'SETALERTS':
      return setTelegramSetAlertThreadId(threadIdStr);
    case 'TICKER':
    case 'TICKERS':
    case 'STOCK':
    case 'STOCKS':
    case 'QUOTE':
    case 'QUOTES':
      return setTelegramTickerThreadId(threadIdStr);
    case 'CALENDAR':
    case 'CALENDARS':
    case 'EARNINGS':
    case 'EARNING':
      return setTelegramCalendarThreadId(threadIdStr);
    case 'ALERTS':
    case 'ALERT':
      envKey = 'TELEGRAM_ALERTS_THREAD_ID';
      break;
    case 'APP':
    case 'IDEAS_APP':
      envKey = 'TELEGRAM_APP_THREAD_ID';
      break;
    case 'IDEAS':
    case 'IDEA':
      envKey = 'TELEGRAM_IDEAS_THREAD_ID';
      break;
    default:
      return false;
  }

  if (envKey) {
    try {
      process.env[envKey] = threadIdStr;
      logToFile(`[TelegramTopics] Updated ${envKey}=${threadIdStr}`);
      if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
        return true;
      }
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        const regex = new RegExp(`${envKey}=.*`, 'i');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${envKey}=${threadIdStr}`);
        } else {
          envContent += `\n${envKey}=${threadIdStr}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      }
      return true;
    } catch (e: any) {
      logToFile(`[TelegramTopics] Error saving ${envKey}: ${e.message}`);
      return false;
    }
  }

  return false;
}

/**
 * Fetches aggregate real-time topic metrics across the entire application
 */
export async function getTopicsSummaryMetrics(prisma: PrismaClient) {
  const [
    brokersCount,
    holdings,
    watchlistsCount,
    watchlistItemCount,
    notesCount,
    pendingTradesCount,
    activeAlertsCount,
    ideasCount,
    appIdeasCount,
  ] = await Promise.all([
    (prisma as any).broker?.count ? (prisma as any).broker.count().catch(() => 0) : 0,
    (prisma as any).holding?.findMany ? (prisma as any).holding.findMany({ select: { assetType: true, quantity: true, marketValue: true } }).catch(() => []) : [],
    (prisma as any).watchlist?.count ? (prisma as any).watchlist.count().catch(() => 0) : 0,
    (prisma as any).watchlistItem?.count ? (prisma as any).watchlistItem.count().catch(() => 0) : 0,
    (prisma as any).stockNote?.count ? (prisma as any).stockNote.count().catch(() => 0) : 0,
    (prisma as any).plannedTrade?.count ? (prisma as any).plannedTrade.count({ where: { status: 'PENDING' } }).catch(() => 0) : 0,
    ((prisma as any).priceAlert || (prisma as any).alert)?.count ? ((prisma as any).priceAlert || (prisma as any).alert).count({ where: { status: 'ACTIVE' } }).catch(() => 0) : 0,
    (prisma as any).thoughtLog?.count ? (prisma as any).thoughtLog.count({ where: { folder: 'Ideas' } }).catch(() => 0) : 0,
    (prisma as any).appIdea?.count ? (prisma as any).appIdea.count({ where: { isFulfilled: false } }).catch(() => 0) : 0,
  ]);

  let totalValue = 0;
  let equitiesCount = 0;
  let shortOptionsCount = 0;
  let longOptionsCount = 0;

  for (const h of holdings) {
    if (Math.abs(h.quantity) < 0.0001) continue;
    totalValue += h.marketValue || 0;
    if (h.assetType === 'OPTION') {
      if (h.quantity < 0) shortOptionsCount++;
      else longOptionsCount++;
    } else {
      equitiesCount++;
    }
  }

  return {
    balances: {
      brokersCount,
      totalPortfolioValue: totalValue,
    },
    positions: {
      totalHoldings: equitiesCount + shortOptionsCount + longOptionsCount,
      equitiesCount,
      shortOptionsCount,
      longOptionsCount,
    },
    watchlists: {
      watchlistsCount,
      watchlistItemCount,
    },
    notes: {
      notesCount,
    },
    execution: {
      pendingTradesCount,
    },
    alerts: {
      activeAlertsCount,
    },
    ideas: {
      ideasCount,
    },
    app: {
      appIdeasCount,
    },
  };
}

/**
 * Builds the comprehensive Telegram Topics Control Center report
 */
export async function buildTopicsOverviewReport(prisma: PrismaClient): Promise<string> {
  const status = getTelegramBufferStatus();
  const metrics = await getTopicsSummaryMetrics(prisma);

  const formatThread = (tid: string | null | undefined) =>
    tid ? `🟢 Thread \`${tid}\`` : `⚪ Auto-Discovered / Standby`;

  const money = (val: number) =>
    `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return `🧭 *Trade Compass — Telegram Topics Control Center*

Live status, telemetry & commands across all 11 integrated topics:

🏦 *1. Balances*
• Status: ${formatThread(status.balancesThreadId)}
• Overview: *${metrics.balances.brokersCount} connected brokers* | Portfolio: *${money(metrics.balances.totalPortfolioValue)}*
• Commands: \`balances\`, \`cash\`, \`margins\`, \`fees\`, \`dividends\`, \`gains\`, \`pdf\`, \`ibkr\`, \`isa\`, \`gia\`, \`tastytrade\`, \`t212\`

💼 *2. Positions*
• Status: ${formatThread(status.positionsThreadId)}
• Holdings: *${metrics.positions.totalHoldings} active positions* (${metrics.positions.equitiesCount} stocks, ${metrics.positions.shortOptionsCount} short opts, ${metrics.positions.longOptionsCount} long opts)
• Commands: \`AAPL\`, \`options\`, \`short options\`, \`long options\`, \`equities\`, \`brokers\`

📋 *3. Watchlist*
• Status: ${formatThread(status.watchlistThreadId)}
• Coverage: *${metrics.watchlists.watchlistsCount} watchlists* tracking *${metrics.watchlists.watchlistItemCount} stocks*
• Commands: \`all watchlists\`, \`Semis PE < 30\`, \`Tech AAPL NVDA\`, or send any theme (e.g. \`Quantum Computing\`)

📝 *4. Notes & Research*
• Status: ${formatThread(status.notesThreadId)}
• Research: *${metrics.notes.notesCount} stock notes pinned in app*
• Commands:
  • Check note: \`AAPL\` or \`read AAPL\`
  • List all: \`all notes\` or \`list\`
  • Save note: \`AAPL [Thesis...]\`
  • Delete: \`delete note AAPL\`

🎯 *5. Execution Queue*
• Status: ${formatThread(status.executionThreadId)}
• Queue: *${metrics.execution.pendingTradesCount} tactical orders pending*
• Commands:
  • Check queue: \`queue\`, \`orders\`, \`pending\`
  • Queue trade: \`BUY 100 AAPL @ 220 SL 210\`, \`STO 1 NVDA 120P\`
  • Cancel order: \`cancel AAPL\`

🎯 *6. Set Alert*
• Status: ${formatThread(status.setAlertThreadId)}
• Monitored: *${metrics.alerts.activeAlertsCount} active price alerts armed*
• Commands:
  • Arm alert: \`Alert NVDA above $145\`, \`AAPL < 210\`, \`PLTR > 60\`
  • Check alerts: \`alerts\`, \`list\`, \`active\`
  • Cancel alert: \`delete alert NVDA\`

🚨 *7. Alerts (Broadcast Channel)*
• Status: ${formatThread(status.alertsThreadId)}
• Role: *Dedicated broadcast channel where triggered 24/7 price alerts fire instantly*

💡 *8. Market Ideas*
• Status: ${formatThread(process.env.TELEGRAM_IDEAS_THREAD_ID)}
• Repository: *${metrics.ideas.ideasCount} market theses & catalysts logged*
• Commands: \`ideas\`, \`recent ideas\`, or send any market observation

💡 *9. App Roadmap*
• Status: ${formatThread(status.appThreadId)}
• Backlog: *${metrics.app.appIdeasCount} open feature ideas & bug reports*
• Commands: \`roadmap\`, \`ideas\`, or submit \`[UI] ...\`, \`[Bug] ...\`

🌐 *10. Macro Intelligence*
• Status: ${formatThread(status.macroThreadId)}
• Intelligence: *7 Pillars, Sovereign Yield Curves, Volatility Complex, Scenarios & Allocations*
• Commands: \`macro\`, \`regime\`, \`yields\`, \`volatility\`, \`pillars\`, \`scenarios\`, \`allocations\`, \`catalysts\`, \`gold\`, \`pdf\`

🎯 *11. Trade & Options Strategy*
• Status: ${formatThread(status.tradeThreadId)}
• Intelligence: *Live Option Quotes, Greeks (Delta, Theta, IV), Strike Matrix & AI Recommendations*
• Commands: \`AAPL short put 300\`, \`NVDA covered call 130 ai\`, \`MSFT put 400 income\`, \`TSLA short put 210 assignment\`

📊 *12. Ticker Research & Dossiers*
• Status: ${formatThread(status.tickerThreadId)}
• Intelligence: *Deep Fundamentals, Multiples, Piotroski & Altman Z, Stage Analysis & Vector Price Charts*
• Commands: \`AAPL\`, \`$NVDA\`, \`PLTR\`, \`AAPL pdf\`, \`pdf MSFT\`

📅 *13. Calendar & Earnings Reminders*
• Status: ${formatThread(status.calendarThreadId)}
• Intelligence: *Automated 1-Week & 1-Day Earnings Alerts, Chronological Schedule & Executive PDF Dossiers*
• Commands: \`calendar\`, \`earnings\`, \`upcoming\`, \`scan\`, \`AAPL\`, \`calendar pdf\`

───────────────────────
⚙️ *Management Shortcuts:*
• Update Topic Thread: \`set topic [name] [threadId]\` (e.g. \`set topic set_alert 499\`)
• Test Topic Delivery: \`test topic [name]\` (e.g. \`test topic ticker\`)
• Detailed Guide: Send \`help\` in any topic for deep-dive instructions!`;
}

/**
 * Handles incoming Topics Management messages
 */
export async function handleTopicsManagementMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
}: TopicsManagementRequest): Promise<{
  handled: boolean;
  replyText: string;
  actionTaken: TopicManagementAction;
}> {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. SET TOPIC THREAD COMMAND
  const setMatch = clean.match(/^(?:set|map|link|config)\s+topic\s+([A-Za-z0-9_-]+)\s+(\d+)/i);
  if (setMatch) {
    const topicTarget = setMatch[1].trim();
    const threadNum = Number(setMatch[2].trim());
    const success = setGenericTopicThreadId(topicTarget, threadNum);

    const replyText = success
      ? `✅ *Topic Thread Updated!*\n\n• Topic: *${topicTarget.toUpperCase()}*\n• Assigned Thread ID: \`${threadNum}\`\n• Status: Persisted to configuration.\n\n_Send \`topics\` to verify the full topic directory._`
      : `⚠️ *Could not update topic thread.*\n\nSupported topic names: \`trade\`, \`balances\`, \`macro\`, \`positions\`, \`watchlist\`, \`notes\`, \`execution\`, \`set_alert\`, \`alerts\`, \`ideas\`, \`app\`, \`ticker\`, \`calendar\`.\nExample: \`set topic calendar 607\``;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramTopics] Send error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'SET_THREAD',
    };
  }

  // 2. TEST / PING TOPIC COMMAND
  const testMatch = clean.match(/^(?:test|ping|check)\s+topic\s+([A-Za-z0-9_-]+)/i);
  if (testMatch) {
    const topicTarget = testMatch[1].trim().toUpperCase().replace(/[\s-]+/g, '_');
    const status = getTelegramBufferStatus();

    let targetThread: number | undefined;
    if (topicTarget === 'BALANCES') targetThread = status.balancesThreadId ? Number(status.balancesThreadId) : undefined;
    else if (topicTarget === 'POSITIONS') targetThread = status.positionsThreadId ? Number(status.positionsThreadId) : undefined;
    else if (topicTarget === 'WATCHLIST' || topicTarget === 'WATCHLISTS') targetThread = status.watchlistThreadId ? Number(status.watchlistThreadId) : undefined;
    else if (topicTarget === 'NOTES' || topicTarget === 'NOTE') targetThread = status.notesThreadId ? Number(status.notesThreadId) : undefined;
    else if (topicTarget === 'EXECUTION' || topicTarget === 'QUEUE') targetThread = status.executionThreadId ? Number(status.executionThreadId) : undefined;
    else if (topicTarget === 'SET_ALERT' || topicTarget === 'SET_ALERTS' || topicTarget === 'SETALERT') targetThread = status.setAlertThreadId ? Number(status.setAlertThreadId) : undefined;
    else if (topicTarget === 'ALERTS' || topicTarget === 'ALERT') targetThread = status.alertsThreadId ? Number(status.alertsThreadId) : undefined;
    else if (topicTarget === 'APP') targetThread = status.appThreadId ? Number(status.appThreadId) : undefined;
    else if (topicTarget === 'MACRO') targetThread = status.macroThreadId ? Number(status.macroThreadId) : undefined;
    else if (topicTarget === 'TRADE' || topicTarget === 'TRADES' || topicTarget === 'OPTIONS' || topicTarget === 'OPTION') targetThread = status.tradeThreadId ? Number(status.tradeThreadId) : undefined;
    else if (topicTarget === 'IDEAS') targetThread = process.env.TELEGRAM_IDEAS_THREAD_ID ? Number(process.env.TELEGRAM_IDEAS_THREAD_ID) : undefined;
    else if (topicTarget === 'TICKER' || topicTarget === 'TICKERS' || topicTarget === 'STOCK' || topicTarget === 'STOCKS') targetThread = status.tickerThreadId ? Number(status.tickerThreadId) : undefined;
    else if (topicTarget === 'CALENDAR' || topicTarget === 'CALENDARS' || topicTarget === 'EARNINGS') targetThread = status.calendarThreadId ? Number(status.calendarThreadId) : undefined;

    const pingText = `🔔 *Telegram Topic Connectivity Test*\n\n✅ Verification ping successfully delivered to *${topicTarget}* topic (Thread: \`${targetThread || 'Default'}\`).\n\n_Trade Compass Assistant is live and listening!_`;

    let pingSuccess = false;
    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      pingSuccess = await sendTelegramMessage({
        text: pingText,
        chatId,
        messageThreadId: targetThread || messageThreadId,
        parseMode: 'Markdown',
      })
        .then(() => true)
        .catch((e: any) => {
          logToFile(`[TelegramTopics] Test topic ping error: ${e.message}`);
          return false;
        });
    }

    const replyText = pingSuccess
      ? `✅ *Test Ping Dispatched!*\n\nSent a test message to *${topicTarget}* topic (Thread ID: \`${targetThread || messageThreadId || 'General'}\`). Check the topic thread to verify receipt.`
      : `⚠️ *Failed to dispatch test ping to ${topicTarget}.*\n\nPlease verify that your \`TELEGRAM_BOT_TOKEN\` is active and thread ID is valid.`;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId && targetThread !== messageThreadId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramTopics] Confirmation error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'TEST_TOPIC',
    };
  }

  // 3. DEFAULT: TOPICS OVERVIEW REPORT
  const replyText = await buildTopicsOverviewReport(prisma);

  if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
    await sendTelegramMessage({
      text: replyText,
      chatId,
      messageThreadId,
      parseMode: 'Markdown',
    }).catch((e: any) => logToFile(`[TelegramTopics] Send overview error: ${e.message}`));
  }

  return {
    handled: true,
    replyText,
    actionTaken: 'OVERVIEW',
  };
}
