import { PrismaClient } from '@prisma/client';
import { extractSymbolsFromText } from './thoughtLogAgentService';
import { agentActivityTracker } from './agentActivityService';
import { transcribeTelegramVoice } from './voiceTranscriptionService';

const logToFile = (msg: string) => console.log(msg);

export interface BufferedTelegramMessage {
  id: string;
  messageId: number;
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

  logToFile(`[TelegramBuffer] Checking Cloudflare Worker buffer at ${targetUrl}...`);

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

      const detectedSymbols = extractSymbolsFromText(contentText);
      const sentiment = detectSentimentFromText(contentText);
      const title = isVoice
        ? createVoiceTitleFromText(contentText, msg.timestamp)
        : createTitleFromText(contentText, msg.timestamp);

      const senderLabel = msg.sender?.username ? `@${msg.sender.username}` : (msg.sender?.firstName || 'Mobile');
      const tags = isVoice
        ? `Telegram, Mobile, Voice, ${senderLabel}`
        : `Telegram, Mobile, ${senderLabel}`;

      // Detect folder from hashtag (e.g. #ideas, #macro, #watchlist, #earnings, #trading, #research) or default
      let targetFolder = isVoice ? 'Voice Notes' : 'Telegram';
      const hashMatch = contentText.match(/#(?:folder:)?([A-Za-z0-9_-]+)\b/i);
      if (hashMatch) {
        const rawFolder = hashMatch[1];
        targetFolder = rawFolder.charAt(0).toUpperCase() + rawFolder.slice(1);
      }

      const savedLog = await (prisma as any).thoughtLog.create({
        data: {
          title,
          content: contentText.trim(),
          folder: targetFolder,
          tags,
          symbols: detectedSymbols.length > 0 ? detectedSymbols.join(', ') : null,
          sentiment,
          isPinned: false,
          agentOutput: null,
          agentActionType: null,
          marketDataJson: null,
          createdAt: new Date(msg.timestamp),
        },
      });

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
    lastSyncTimestamp,
    lastSyncCount,
  };
}
