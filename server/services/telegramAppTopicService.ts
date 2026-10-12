import { PrismaClient } from '@prisma/client';
import { sendTelegramMessage } from './telegramReportService';

const logToFile = (msg: string) => console.log(msg);

export interface AppTopicRequest {
  text: string;
  chatId: string | number;
  messageThreadId?: number;
  prisma: PrismaClient;
  senderLabel?: string;
  timestamp?: number;
  messageId?: number;
}

export type AppTopicAction =
  | 'VIEW_ROADMAP'
  | 'CREATE_IDEA'
  | 'HELP';

/**
 * Handles incoming App topic messages (view backlog/roadmap or submit new feature/bug)
 */
export async function handleAppTopicMessage({
  text,
  chatId,
  messageThreadId,
  prisma,
  senderLabel = 'Mobile',
  timestamp = Date.now(),
  messageId,
}: AppTopicRequest): Promise<{
  handled: boolean;
  replyText: string;
  actionTaken: AppTopicAction;
  ideaCreated?: any;
}> {
  const clean = text
    .replace(/#(?:topic:)?(?:app|app-idea)\b/gi, '')
    .trim();

  const lower = clean.toLowerCase();

  // ==========================================
  // 1. VIEW APP ROADMAP / BACKLOG
  // ==========================================
  if (/^(roadmap|ideas|backlog|list|status|open|pending|show\s+roadmap|app\s+ideas)$/i.test(lower)) {
    let openIdeas: any[] = [];
    if ((prisma as any).appIdea) {
      openIdeas = await (prisma as any).appIdea.findMany({
        where: { isFulfilled: false },
        orderBy: { createdAt: 'desc' },
        take: 15,
      });
    }

    let replyText = '';
    if (openIdeas.length === 0) {
      replyText = `💡 *Trade Compass App Roadmap*\n\n_No open feature ideas or bug reports in the backlog._\n\n💡 *How to Submit Ideas:*\n• \`[UI] Add a dark mode toggle button in header\`\n• \`[Portfolio] Show beta-weighted delta across all brokers\`\n• \`[Bug] Yahoo finance quote timeout on weekend\`\n• \`[Data] Add commodities forward curves to Macro section\``;
    } else {
      const rows = openIdeas.map((idea) => {
        const catBadge = idea.category ? `[${idea.category}] ` : '';
        const topicBadge = idea.topic && idea.topic !== 'App' ? `(${idea.topic}) ` : '';
        return `• *${catBadge}${idea.title}* ${topicBadge}\n  Status: ⏳ In Backlog`;
      }).join('\n\n');

      replyText = `💡 *Trade Compass App Roadmap & Backlog* (${openIdeas.length} open items)\n\n${rows}\n\n───────────────────────\n💡 _Submit new requests anytime using \`[Category] Description\`._`;
    }

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramApp] Send error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'VIEW_ROADMAP',
    };
  }

  // ==========================================
  // 2. SUBMIT / CREATE NEW APP IDEA
  // ==========================================
  if (clean.length > 0) {
    let ideaTopic = 'App';
    let ideaCategory = 'Feature';
    let cleanText = clean;

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
    const rawHeadline = lines[0] || 'App Idea';
    const ideaTitle = rawHeadline.length > 90 ? rawHeadline.slice(0, 87) + '...' : rawHeadline;
    const ideaDescription = lines.length > 1 ? lines.slice(1).join('\n') : (rawHeadline.length > 90 ? cleanText : null);

    const savedLog = await (prisma as any).thoughtLog.create({
      data: {
        title: `💡 App Idea: ${ideaTitle}`,
        content: cleanText,
        folder: 'App',
        tags: `Telegram, App, Mobile, ${senderLabel}`,
        symbols: null,
        sentiment: 'NEUTRAL',
        isPinned: false,
        isFulfilled: false,
        agentOutput: `💡 **App Idea Logged**\n\nCategory: **${ideaCategory}** | Topic: **${ideaTopic}**`,
        agentActionType: 'ADD_CONTEXT',
        marketDataJson: null,
        createdAt: new Date(timestamp),
      },
    });

    let savedAppIdea: any = null;
    if ((prisma as any).appIdea) {
      try {
        savedAppIdea = await (prisma as any).appIdea.create({
          data: {
            title: ideaTitle,
            description: ideaDescription || cleanText,
            topic: ideaTopic,
            category: ideaCategory,
            isFulfilled: false,
            source: 'TELEGRAM',
            telegramMsgId: messageId || null,
            thoughtLogId: savedLog.id,
            tags: `Telegram, App, ${senderLabel}`,
            createdAt: new Date(timestamp),
          },
        });
      } catch (err: any) {
        logToFile(`[TelegramApp] AppIdea save error: ${err.message}`);
      }
    }

    const replyText = `💡 *App Idea Logged to Roadmap*\n\n• Title: *${ideaTitle}*\n• Category: *${ideaCategory}* (Topic: *${ideaTopic}*)\n• Status: 📌 Stored in App Backlog\n\n_Send \`roadmap\` anytime to check open feature requests._`;

    if (process.env.TELEGRAM_BOT_TOKEN && chatId) {
      await sendTelegramMessage({
        text: replyText,
        chatId,
        messageThreadId,
        parseMode: 'Markdown',
      }).catch((e: any) => logToFile(`[TelegramApp] Send error: ${e.message}`));
    }

    return {
      handled: true,
      replyText,
      actionTaken: 'CREATE_IDEA',
      ideaCreated: savedAppIdea || savedLog,
    };
  }

  return {
    handled: false,
    replyText: '',
    actionTaken: 'HELP',
  };
}
