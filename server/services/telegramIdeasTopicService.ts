import { PrismaClient } from '@prisma/client';
import { sendTelegramMessage } from './telegramReportService';
import { extractSymbolsFromText } from './thoughtLogAgentService';
import {
  detectSentimentFromText,
  createTitleFromText,
  saveSymbolsToWatchlist,
} from './telegramBufferConsumerService';

const logToFile = (msg: string) => console.log(msg);

export interface IdeasTopicRequest {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma: PrismaClient;
  senderLabel?: string;
  timestamp?: number;
}

export type IdeasTopicAction =
  | 'VIEW_IDEAS'
  | 'CREATE_IDEA'
  | 'HELP';

/**
 * Handles incoming Ideas topic messages (view recent ideas or log new market thesis)
 */
export async function handleIdeasTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
  senderLabel = 'Mobile',
  timestamp = Date.now(),
}: IdeasTopicRequest): Promise<{
  handled: boolean;
  replyText: string;
  actionTaken: IdeasTopicAction;
  ideaCreated?: any;
}> {
  const clean = text
    .replace(/#(?:topic:)?ideas?\b/gi, '')
    .replace(/^💡\s*/, '')
    .trim();

  const lower = clean.toLowerCase();

  // ==========================================
  // 1. VIEW RECENT IDEAS
  // ==========================================
  const isViewQuery = /^(ideas|recent\s+ideas|list|my\s+ideas|show\s+ideas|recent)$/i.test(lower);
  const tickerIdeasMatch = clean.match(/^(?:ideas?|theses?)\s+(?:for|on|in)?\s*\$?([A-Za-z]{1,6})$/i);

  if (isViewQuery || tickerIdeasMatch) {
    const filterSym = tickerIdeasMatch ? tickerIdeasMatch[1].toUpperCase() : null;

    const queryWhere: any = { folder: 'Ideas' };
    if (filterSym) {
      queryWhere.OR = [
        { symbols: { contains: filterSym } },
        { title: { contains: filterSym } },
        { content: { contains: filterSym } },
      ];
    }

    const ideas = await prisma.thoughtLog.findMany({
      where: queryWhere,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    let replyText = '';
    if (ideas.length === 0) {
      replyText = filterSym
        ? `💡 *Market Ideas for $${filterSym}*\n\n_No logged theses or catalysts found for $${filterSym}._\n\n💡 _To log an idea: \`$${filterSym} Thesis and catalyst...\`._`
        : `💡 *Market Ideas & Catalysts*\n\n_No market theses currently logged in the Ideas folder._\n\n💡 *How to Log Ideas:*\n• Share any market observation, catalyst, or macro thesis.\n• Mentions of \`$TICKER\` are automatically linked to Trade Compass!`;
    } else {
      const rows = ideas.map((item) => {
        const titleClean = item.title.replace(/^💡\s*(?:Idea:\s*)?/, '');
        const symStr = item.symbols ? ` ($${item.symbols})` : '';
        const dateStr = new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `• *${titleClean}*${symStr} — _${dateStr}_\n  "${item.content.slice(0, 90).replace(/\n+/g, ' ')}${item.content.length > 90 ? '...' : ''}"`;
      }).join('\n\n');

      replyText = `💡 *Recent Market Ideas & Catalysts* (${ideas.length} logs)\n\n${rows}\n\n───────────────────────\n💡 _Send \`ideas [TICKER]\` to filter by stock, or share any market thesis anytime!_`;
    }

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramIdeas] Send error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'VIEW_IDEAS',
    };
  }

  // ==========================================
  // 2. LOG NEW MARKET IDEA / THESIS
  // ==========================================
  if (clean.length > 0) {
    const detectedSymbols = extractSymbolsFromText(clean);
    const sentiment = detectSentimentFromText(clean);

    // Check if message requests saving directly to a watchlist via directive
    const hasWatchlistDirective = Boolean(
      clean.match(/#(?:topic:)?(?:watchlist|watch)\b/i) ||
      clean.match(/\+watchlist\b/i) ||
      clean.match(/watchlist:\s*([A-Za-z0-9_\-\s]+)/i)
    );
    const wlMatch = clean.match(/watchlist:\s*([A-Za-z0-9_\-\s]+)/i);
    const specifiedWlName = wlMatch ? wlMatch[1].trim() : undefined;

    let savedWatchlistResult: { added: string[]; watchlistName: string } | null = null;
    if (hasWatchlistDirective && detectedSymbols.length > 0) {
      savedWatchlistResult = await saveSymbolsToWatchlist(prisma, detectedSymbols, specifiedWlName);
    }

    const rawHeadline = createTitleFromText(clean, timestamp).replace(/^📱\s*/, '');
    const title = `💡 Idea: ${rawHeadline}`;

    const savedLog = await prisma.thoughtLog.create({
      data: {
        title,
        content: clean,
        folder: 'Ideas',
        tags: `Telegram, Ideas, Mobile, ${senderLabel}`,
        symbols: detectedSymbols.length > 0 ? detectedSymbols.join(', ') : null,
        sentiment,
        isPinned: false,
        isFulfilled: false,
        agentOutput: `💡 **Market Idea Logged**` + (savedWatchlistResult ? `\n\n📌 Added to Watchlist "${savedWatchlistResult.watchlistName}": ${savedWatchlistResult.added.map(s => `$${s}`).join(', ')}` : ''),
        agentActionType: 'ADD_CONTEXT',
        marketDataJson: null,
        createdAt: new Date(timestamp),
      },
    });

    const symBadge = detectedSymbols.length > 0 ? `\n• Tracked Symbols: *${detectedSymbols.map(s => `$${s}`).join(', ')}*` : '';
    const wlNote = savedWatchlistResult ? `\n• Watchlist Sync: ✅ Added to *"${savedWatchlistResult.watchlistName}"*` : '';
    const replyText = `💡 *Market Idea Logged*\n\n"${clean.slice(0, 120)}${clean.length > 120 ? '...' : ''}"\n${symBadge}${wlNote}\n• Folder: 📁 *Ideas*\n\n_Send \`ideas\` anytime to view your recent market theses._`;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramIdeas] Send error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'CREATE_IDEA',
      ideaCreated: savedLog,
    };
  }

  return {
    handled: false,
    replyText: '',
    actionTaken: 'HELP',
  };
}
