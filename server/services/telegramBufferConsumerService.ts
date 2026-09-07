import { PrismaClient } from '@prisma/client';
import { extractSymbolsFromText } from './thoughtLogAgentService';
import { agentActivityTracker } from './agentActivityService';
import { transcribeTelegramVoice } from './voiceTranscriptionService';
import { autoCreateAlertsFromText } from './thoughtLogAlertService';

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

      const configuredAlertsThreadId = process.env.TELEGRAM_ALERTS_THREAD_ID ? Number(process.env.TELEGRAM_ALERTS_THREAD_ID) : 2;
      const configuredAppThreadId = process.env.TELEGRAM_APP_THREAD_ID ? Number(process.env.TELEGRAM_APP_THREAD_ID) : 10;

      const isExplicitAppThread = msg.messageThreadId !== undefined && msg.messageThreadId === configuredAppThreadId;
      const isExplicitAlertsThread = msg.messageThreadId !== undefined && msg.messageThreadId === configuredAlertsThreadId;

      const isAlertsTopic = isExplicitAlertsThread || (!isExplicitAppThread && Boolean(
        (msg.topicName && msg.topicName.toLowerCase().includes('alert')) ||
        contentText.toLowerCase().startsWith('#alert') ||
        contentText.match(/#(?:topic:)?alert(?:s)?\b/i) ||
        (msg.chat?.id === -1003872409872 && msg.messageThreadId === configuredAlertsThreadId)
      ));

      const isAppTopic = isExplicitAppThread || (!isAlertsTopic && Boolean(
        (msg.topicName && msg.topicName.toLowerCase().includes('app')) ||
        contentText.toLowerCase().startsWith('#app') ||
        contentText.toLowerCase().includes('#app-idea') ||
        contentText.match(/#(?:topic:)?app\b/i) ||
        (msg.chat?.id === -1003872409872 && msg.messageThreadId === configuredAppThreadId)
      ));

      // Automatically detect and create price alerts only if NOT an app feature idea
      const autoCreatedAlerts = isAppTopic
        ? []
        : await autoCreateAlertsFromText(
            prisma,
            contentText,
            `📱 Telegram Note (${new Date(msg.timestamp).toLocaleString()}): "${contentText.trim()}"`,
            { isAlertsTopic }
          );

      const detectedSymbols = extractSymbolsFromText(contentText);
      const sentiment = isAppTopic ? 'NEUTRAL' : (isAlertsTopic ? 'CAUTION' : detectSentimentFromText(contentText));

      const senderLabel = msg.sender?.username ? `@${msg.sender.username}` : (msg.sender?.firstName || 'Mobile');
      let tags = isAppTopic
        ? (isVoice ? `Telegram, App, Mobile, Voice, ${senderLabel}` : `Telegram, App, Mobile, ${senderLabel}`)
        : (isAlertsTopic
            ? (isVoice ? `Telegram, Alerts, Mobile, Voice, ${senderLabel}` : `Telegram, Alerts, Mobile, ${senderLabel}`)
            : (isVoice ? `Telegram, Mobile, Voice, ${senderLabel}` : `Telegram, Mobile, ${senderLabel}`));

      if (autoCreatedAlerts.length > 0 || isAlertsTopic) {
        if (!tags.includes('Alert')) {
          tags += ', Alert';
        }
      }

      // Detect folder: if App topic, route directly to App folder. If Alerts topic, route directly to Alerts folder!
      let targetFolder = isAppTopic ? 'App' : (isAlertsTopic ? 'Alerts' : (isVoice ? 'Voice Notes' : 'Telegram'));
      const hashMatch = contentText.match(/#(?:folder:)?([A-Za-z0-9_-]+)\b/i);
      if (hashMatch && !isAppTopic && !isAlertsTopic) {
        const rawFolder = hashMatch[1];
        targetFolder = rawFolder.charAt(0).toUpperCase() + rawFolder.slice(1);
      } else if (autoCreatedAlerts.length > 0 && !isVoice && !isAppTopic) {
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
        : (isAlertsTopic ? `🔔 **Alerts Topic Telegram Note**\n\nSaved in **Alerts** folder.` : null);

      const allSymbols = detectedSymbols.length > 0
        ? detectedSymbols
        : autoCreatedAlerts.map((a) => a.symbol);

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
          agentActionType: (autoCreatedAlerts.length > 0 || isAlertsTopic) ? 'ADD_CONTEXT' : null,
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
