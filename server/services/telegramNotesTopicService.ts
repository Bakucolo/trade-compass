import { PrismaClient } from '@prisma/client';
import { sendTelegramMessage } from './telegramReportService';
import { extractSymbolsFromText } from './thoughtLogAgentService';
import { detectSentimentFromText } from './telegramBufferConsumerService';

const logToFile = (msg: string) => console.log(msg);

export interface NotesTopicRequest {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma: PrismaClient;
  senderLabel?: string;
  timestamp?: number;
}

export type NotesTopicAction =
  | 'LOOKUP'
  | 'LIST'
  | 'DELETE'
  | 'SAVE'
  | 'HELP';

const STOPWORDS = new Set([
  'WHAT', 'WHEN', 'WHERE', 'WHICH', 'WHO', 'WHY', 'HOW', 'SHOW', 'VIEW', 'LIST', 'GET', 'CHECK', 'FIND',
  'MY', 'ALL', 'THE', 'AND', 'FOR', 'ARE', 'CAN', 'YOU', 'HAVE', 'ANY', 'SOME', 'ONE', 'TWO',
  'HELP', 'INFO', 'STATUS', 'NOTE', 'NOTES', 'STOCKNOTE', 'STOCKNOTES', 'DELETE', 'REMOVE', 'CLEAR'
]);

/**
 * Extracts a ticker symbol candidate from a note query
 */
export function extractNoteSymbol(text: string): string | null {
  const clean = text.trim();

  // Explicit dollar sign: $AAPL
  const dollarMatch = clean.match(/\$([A-Za-z]{1,6})\b/);
  if (dollarMatch && !STOPWORDS.has(dollarMatch[1].toUpperCase())) {
    return dollarMatch[1].toUpperCase();
  }

  // Common phrases: "note for AAPL", "notes AAPL", "read AAPL", "delete note AAPL"
  const phraseMatch = clean.match(/(?:notes?\s+(?:for|on|of|in)?\s*|read\s+|show\s+|delete\s+(?:notes?\s+)?|clear\s+(?:notes?\s+)?|remove\s+(?:notes?\s+)?)\$?([A-Za-z]{1,6})\b/i);
  if (phraseMatch && !STOPWORDS.has(phraseMatch[1].toUpperCase())) {
    return phraseMatch[1].toUpperCase();
  }

  // Standalone single word ticker (1-5 chars), e.g. "AAPL", "NVDA", "TSLA"
  const singleMatch = clean.match(/^([A-Za-z]{1,5})$/);
  if (singleMatch && !STOPWORDS.has(singleMatch[1].toUpperCase())) {
    return singleMatch[1].toUpperCase();
  }

  // extractSymbolsFromText fallback
  const symbols = extractSymbolsFromText(clean);
  for (const s of symbols) {
    const sym = s.toUpperCase();
    if (!STOPWORDS.has(sym)) return sym;
  }

  return null;
}

/**
 * Handles incoming Notes topic messages (look up note, list notes, delete note, or save note)
 */
export async function handleNotesTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
  senderLabel = 'Mobile',
  timestamp = Date.now(),
}: NotesTopicRequest): Promise<{
  handled: boolean;
  replyText: string;
  actionTaken: NotesTopicAction;
  symbol?: string;
}> {
  const clean = text
    .replace(/#(?:topic:)?(?:notes?|stocknote)\b/gi, '')
    .replace(/^📝\s*/, '')
    .trim();

  const lower = clean.toLowerCase();

  // ==========================================
  // 1. DELETE / CLEAR NOTE COMMAND
  // ==========================================
  if (/(?:delete|remove|clear)\s+(?:notes?\s+)?\$?([A-Za-z]{1,6})\b/i.test(lower)) {
    const sym = extractNoteSymbol(clean);
    if (sym) {
      const existing = await (prisma as any).stockNote.findUnique({
        where: { symbol: sym },
      });

      if (existing) {
        await (prisma as any).stockNote.delete({
          where: { symbol: sym },
        });
        logToFile(`[TelegramNotes] Deleted StockNote for $${sym}`);

        const replyText = `🗑️ *Note Cleared for $${sym}*\n\n_The saved research note for $${sym} has been removed from Trade Compass._\n\n💡 _Send \`$${sym} [new text]\` to save a fresh note anytime._`;

        if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
          await sendTelegramMessage({
            text: replyText,
            chatId,
            messageThreadId,
            parseMode: 'Markdown',
          }).catch((e: any) => logToFile(`[TelegramNotes] Send error: ${e.message}`));
        }

        return {
          handled: true,
          replyText,
          actionTaken: 'DELETE',
          symbol: sym,
        };
      } else {
        const replyText = `📝 *Notes for $${sym}*\n\n_No saved note was found for $${sym}._`;

        if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
          await sendTelegramMessage({
            text: replyText,
            chatId,
            messageThreadId,
            parseMode: 'Markdown',
          }).catch((e: any) => logToFile(`[TelegramNotes] Send error: ${e.message}`));
        }

        return {
          handled: true,
          replyText,
          actionTaken: 'DELETE',
          symbol: sym,
        };
      }
    }
  }

  // ==========================================
  // 2. LIST ALL SAVED NOTES COMMAND
  // ==========================================
  if (/^(all|all\s+notes|list|list\s+notes|recent|notes|show\s+all)$/i.test(lower)) {
    const allNotes = await (prisma as any).stockNote.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 25,
    });

    let replyText = '';
    if (allNotes.length === 0) {
      replyText = `📝 *Research Notes Directory*\n\n_You haven't saved any stock notes yet._\n\n💡 _To save a note, simply send the ticker followed by your thesis:_\n• \`AAPL Great services margin expansion, holding core.\`\n• \`NVDA Blackwell delivery timeline accelerated.\``;
    } else {
      const rows = allNotes.map((n: any) => {
        const sentimentEmoji = n.sentiment === 'BULLISH' ? '🟢' : n.sentiment === 'BEARISH' ? '🔴' : n.sentiment === 'CAUTION' ? '🟡' : '⚪';
        const cleanContent = (n.content || '').replace(/\n+/g, ' ').trim();
        const snippet = cleanContent.length > 70 ? cleanContent.slice(0, 67) + '...' : cleanContent;
        return `• *$${n.symbol}* ${sentimentEmoji}\n  "${snippet}"`;
      }).join('\n\n');

      replyText = `📝 *Pinned Research Notes* (${allNotes.length} stocks)\n\n${rows}\n\n───────────────────────\n💡 _Send any ticker (e.g. \`AAPL\`) to view full notes, or \`delete note [TICKER]\` to remove._`;
    }

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramNotes] Send error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'LIST',
    };
  }

  // ==========================================
  // 3. READ / LOOKUP NOTE FOR A TICKER
  // (E.g. "AAPL", "read AAPL", "notes for NVDA", "show PLTR")
  // ==========================================
  const isExplicitRead = /^(?:read|show|note|notes|check|view)\s+\$?([A-Za-z]{1,6})$/i.test(lower);
  const isSingleWordTicker = /^\$?([A-Za-z]{1,6})$/.test(clean) && !STOPWORDS.has(clean.replace('$', '').toUpperCase());

  if (isExplicitRead || isSingleWordTicker) {
    const sym = extractNoteSymbol(clean);
    if (sym) {
      const existing = await (prisma as any).stockNote.findUnique({
        where: { symbol: sym },
      });

      let replyText = '';
      const noteBody = (existing?.content || existing?.notes || '').trim();
      if (existing && noteBody) {
        const sentimentEmoji = existing.sentiment === 'BULLISH' ? '🟢 Bullish' : existing.sentiment === 'BEARISH' ? '🔴 Bearish' : existing.sentiment === 'CAUTION' ? '🟡 Caution' : '⚪ Neutral';
        const updatedDate = existing.updatedAt ? new Date(existing.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';

        replyText = `📝 *Saved Research Note for $${sym}*\n\n${noteBody}\n\n───────────────────────\n• Sentiment: *${sentimentEmoji}*\n• Status: 📌 Pinned in Trade Compass\n• Last Updated: _${updatedDate}_\n\n💡 _Send \`$${sym} [new text]\` to append updates, or \`delete note ${sym}\` to clear._`;
      } else {
        replyText = `📝 *Notes for $${sym}*\n\n_No research notes currently saved for $${sym}._\n\n💡 _To save a note, send the ticker followed by your thoughts:_\n\`${sym} Long-term thesis and earnings catalyst notes...\``;
      }

      if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
        await sendTelegramMessage({
          text: replyText,
          chatId,
          messageThreadId,
          parseMode: 'Markdown',
        }).catch((e: any) => logToFile(`[TelegramNotes] Send error: ${e.message}`));
      }

      return {
        handled: true,
        replyText,
        actionTaken: 'LOOKUP',
        symbol: sym,
      };
    }
  }

  // ==========================================
  // 4. SAVE / APPEND NOTE (Symbol + Note Content)
  // ==========================================
  const candidateSymbol = extractNoteSymbol(clean);
  if (candidateSymbol) {
    const noteText = clean.replace(new RegExp(`^\\$?${candidateSymbol}:?\\s*`, 'i'), '').trim();
    if (noteText.length > 0) {
      const sentiment = detectSentimentFromText(noteText);

      const existing = await (prisma as any).stockNote.findUnique({
        where: { symbol: candidateSymbol },
      });

      const nowFormatted = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      let finalContent = noteText;
      if (existing && existing.content && existing.content.trim()) {
        finalContent = `${existing.content.trim()}\n\n---\n📅 **${nowFormatted} (Telegram Note):**\n${noteText}`;
      }

      await (prisma as any).stockNote.upsert({
        where: { symbol: candidateSymbol },
        update: {
          content: finalContent,
          tags: 'Telegram, Mobile',
          sentiment,
        },
        create: {
          symbol: candidateSymbol,
          content: finalContent,
          tags: 'Telegram, Mobile',
          sentiment,
        },
      });

      const sentimentEmoji = sentiment === 'BULLISH' ? '🟢 Bullish' : sentiment === 'BEARISH' ? '🔴 Bearish' : sentiment === 'CAUTION' ? '🟡 Caution' : '⚪ Neutral';
      const excerpt = noteText.length > 120 ? noteText.slice(0, 117) + '...' : noteText;

      const replyText = `📝 *Note Saved for $${candidateSymbol}*\n\n"${excerpt}"\n\n• Sentiment: *${sentimentEmoji}*\n• Status: ✅ Pinned in Trade Compass\n\n_This note appears automatically whenever you research $${candidateSymbol} in the app._`;

      if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
        await sendTelegramMessage({
          text: replyText,
          chatId,
          messageThreadId,
          parseMode: 'Markdown',
        }).catch((e: any) => logToFile(`[TelegramNotes] Send error: ${e.message}`));
      }

      // Create ThoughtLog record under 'Notes' folder
      await (prisma as any).thoughtLog.create({
        data: {
          title: `📝 Note: $${candidateSymbol} - ${excerpt || 'Mobile Note'}`,
          content: noteText,
          folder: 'Notes',
          tags: `Telegram, Note, Mobile, ${senderLabel}`,
          symbols: candidateSymbol,
          sentiment,
          isPinned: true,
          isFulfilled: true,
          agentOutput: `📝 **Stock Note Pinned for $${candidateSymbol}**\n\n${noteText}\n\n*Sentiment: ${sentiment}*`,
          agentActionType: 'ADD_CONTEXT',
          marketDataJson: null,
          createdAt: new Date(timestamp),
        },
      });

      return {
        handled: true,
        replyText,
        actionTaken: 'SAVE',
        symbol: candidateSymbol,
      };
    }
  }

  return {
    handled: false,
    replyText: '',
    actionTaken: 'HELP',
  };
}
