/**
 * Cloudflare Worker: Telegram Webhook Buffer & Queue for Trade Compass
 * 
 * Functions:
 * 1. Receives incoming webhooks from Telegram Bot API (POST /webhook or POST /)
 * 2. Buffers messages indefinitely into Cloudflare KV (APP_BUFFER)
 * 3. Provides a secure GET /consume route for the local desktop app to fetch & purge queued ideas
 * 4. Provides a GET /peek route to view queued items without deleting
 */

export interface Env {
  APP_BUFFER: KVNamespace;
  CONSUME_SECRET?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string; // Standard chat ID (default report channel)
  TELEGRAM_ALERTS_CHAT_ID?: string; // Specific Alerts chat ID: -1003872409872
  TELEGRAM_ALERTS_THREAD_ID?: string | number; // Specific Alerts topic thread ID: 2
  TELEGRAM_APP_THREAD_ID?: string | number; // Specific App topic thread ID: 10
}

export interface SendTelegramMessageOptions {
  text: string;
  isAlert?: boolean; // When true: routes to the "Alerts" topic (chat_id: -1003872409872, message_thread_id: 2)
  chat_id?: string | number; // Custom chat_id override
  message_thread_id?: number; // Custom message_thread_id override
  parse_mode?: 'Markdown' | 'HTML' | 'MarkdownV2';
  disable_notification?: boolean;
}

/**
 * Handles the Telegram sendMessage API request with dynamic topic routing:
 * - When an alert is triggered (isAlert === true):
 *   Uses chat_id: -1003872409872 and includes message_thread_id: 2 in the JSON payload.
 * - For standard reports (isAlert === false):
 *   Uses original chat_id (e.g. 8959044574) without any message_thread_id parameter.
 */
export async function sendTelegramMessage(
  botToken: string,
  options: SendTelegramMessageOptions,
  defaultChatId = '8959044574'
): Promise<any> {
  const isAlert = Boolean(options.isAlert);

  // Dynamic Routing Logic:
  // - Alerts: chat_id = -1003872409872, message_thread_id = 2
  // - Standard Reports: chat_id = defaultChatId, message_thread_id omitted
  const targetChatId = options.chat_id ?? (isAlert ? '-1003872409872' : defaultChatId);
  const targetThreadId = options.message_thread_id ?? (isAlert ? 2 : undefined);

  // Construct JSON request payload
  const payload: Record<string, any> = {
    chat_id: targetChatId,
    text: options.text,
    parse_mode: options.parse_mode || 'Markdown',
  };

  // Only include message_thread_id parameter when routing to an alert topic
  if (targetThreadId !== undefined) {
    payload.message_thread_id = targetThreadId;
  }

  if (options.disable_notification !== undefined) {
    payload.disable_notification = options.disable_notification;
  }

  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as { ok: boolean; description?: string; result?: any };

  if (!response.ok || !data.ok) {
    throw new Error(`Telegram sendMessage API error: ${data.description || `HTTP ${response.status}`}`);
  }

  return data.result;
}

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id?: string;
  duration?: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number; // Unix timestamp
  message_thread_id?: number;
  is_topic_message?: boolean;
  forum_topic_created?: {
    name: string;
    icon_color?: number;
    icon_custom_emoji_id?: string;
  };
  reply_to_message?: TelegramMessage;
  text?: string;
  caption?: string;
  voice?: TelegramVoice;
  audio?: TelegramVoice;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
}

export interface BufferedTelegramMessage {
  id: string; // e.g. "msg_1787815200000_1042"
  messageId: number;
  messageThreadId?: number;
  isTopicMessage?: boolean;
  topicName?: string;
  type: 'text' | 'voice';
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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS Headers for flexible access
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Consume-Secret, X-Telegram-Bot-Api-Secret-Token, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ----------------------------------------------------
      // ROUTE 1: GET /health or GET / - Basic Health Check
      // ----------------------------------------------------
      if (request.method === 'GET' && (path === '/' || path === '/health')) {
        let bufferCount = 0;
        try {
          const list = await env.APP_BUFFER.list({ prefix: 'msg_', limit: 100 });
          bufferCount = list.keys.length;
        } catch {
          // KV might not be bound during initial development
        }

        return new Response(
          JSON.stringify({
            status: 'online',
            service: 'Trade Compass Telegram Buffer Worker',
            pendingBufferCount: bufferCount,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // ----------------------------------------------------
      // ROUTE 2: POST /webhook or POST / - Telegram Webhook Receiver
      // ----------------------------------------------------
      if (request.method === 'POST' && (path === '/webhook' || path === '/')) {
        // Optional verification of Telegram Secret Token
        if (env.TELEGRAM_WEBHOOK_SECRET) {
          const secretTokenHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
          if (secretTokenHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
            return new Response(JSON.stringify({ error: 'Unauthorized Telegram Webhook Token' }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        const update: TelegramUpdate = await request.json();
        const msg = update.message || update.edited_message || update.channel_post;

        if (!msg) {
          // Acknowledge updates that do not have message bodies (e.g. status updates)
          return new Response(JSON.stringify({ ok: true, ignored: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const voiceObj = msg.voice || msg.audio;
        const isVoice = Boolean(voiceObj && voiceObj.file_id);
        const messageText = (msg.text || msg.caption || '').trim();

        if (!messageText && !isVoice) {
          return new Response(JSON.stringify({ ok: true, note: 'Empty text and no audio ignored' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const nowMs = Date.now();
        const msgId = msg.message_id || Math.floor(Math.random() * 1000000);
        const storageKey = `msg_${nowMs}_${msgId}`;

        const alertsThreadIdStr = String(env.TELEGRAM_ALERTS_THREAD_ID || '2');
        const isAlertsThread = msg.message_thread_id !== undefined && String(msg.message_thread_id) === alertsThreadIdStr;
        const appThreadIdStr = String(env.TELEGRAM_APP_THREAD_ID || '10');
        const isAppThread = msg.message_thread_id !== undefined && String(msg.message_thread_id) === appThreadIdStr;
        const topicName =
          msg.forum_topic_created?.name ||
          msg.reply_to_message?.forum_topic_created?.name ||
          (isAppThread ? 'App' : (isAlertsThread ? 'Alerts' : undefined));

        const bufferRecord: BufferedTelegramMessage = {
          id: storageKey,
          messageId: msgId,
          messageThreadId: msg.message_thread_id,
          isTopicMessage: Boolean(msg.is_topic_message),
          topicName,
          type: isVoice ? 'voice' : 'text',
          text: messageText || (isVoice ? '🎙️ [Voice Note]' : ''),
          date: msg.date || Math.floor(nowMs / 1000),
          timestamp: new Date(msg.date ? msg.date * 1000 : nowMs).toISOString(),
          fileId: isVoice ? voiceObj?.file_id : undefined,
          duration: isVoice ? voiceObj?.duration : undefined,
          mimeType: isVoice ? voiceObj?.mime_type || 'audio/ogg' : undefined,
          fileSize: isVoice ? voiceObj?.file_size : undefined,
          sender: msg.from
            ? {
                id: msg.from.id,
                username: msg.from.username,
                firstName: msg.from.first_name,
                lastName: msg.from.last_name,
              }
            : undefined,
          chat: {
            id: msg.chat.id,
            type: msg.chat.type,
            title: msg.chat.title || msg.chat.first_name,
          },
        };

        // Persist to Cloudflare KV indefinitely
        await env.APP_BUFFER.put(storageKey, JSON.stringify(bufferRecord));

        return new Response(
          JSON.stringify({
            ok: true,
            storedId: storageKey,
            type: bufferRecord.type,
            fileId: bufferRecord.fileId,
            receivedTextExcerpt: bufferRecord.text.slice(0, 40),
            timestamp: bufferRecord.timestamp,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // ----------------------------------------------------
      // ROUTE 3: GET /consume - Fetch All Messages & Atomically Purge
      // ----------------------------------------------------
      if (request.method === 'GET' && path === '/consume') {
        // Authenticate with custom secret header
        const secretHeader =
          request.headers.get('X-Consume-Secret') ||
          request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');

        const expectedSecret = env.CONSUME_SECRET || 'tradecompass_secret_consume_token_2026';

        if (!secretHeader || secretHeader !== expectedSecret) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Invalid or missing X-Consume-Secret header' }),
            {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // List all stored message keys with prefix 'msg_'
        const listResult = await env.APP_BUFFER.list({ prefix: 'msg_', limit: 1000 });
        const keys = listResult.keys;

        if (keys.length === 0) {
          return new Response(
            JSON.stringify({
              success: true,
              count: 0,
              messages: [],
              consumedAt: new Date().toISOString(),
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Fetch all values in parallel
        const getPromises = keys.map(async (key) => {
          const raw = await env.APP_BUFFER.get(key.name);
          if (!raw) return null;
          try {
            return JSON.parse(raw) as BufferedTelegramMessage;
          } catch {
            return null;
          }
        });

        const fetchedItems = await Promise.all(getPromises);
        const validMessages = fetchedItems.filter((item): item is BufferedTelegramMessage => item !== null);

        // Sort chronologically by date
        validMessages.sort((a, b) => a.date - b.date);

        // Delete all retrieved keys from KV so they are never processed twice
        const deletePromises = keys.map((key) => env.APP_BUFFER.delete(key.name));
        await Promise.all(deletePromises);

        return new Response(
          JSON.stringify({
            success: true,
            count: validMessages.length,
            messages: validMessages,
            consumedAt: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // ----------------------------------------------------
      // ROUTE 4: GET /peek - View Messages Without Deleting (Debug)
      // ----------------------------------------------------
      if (request.method === 'GET' && path === '/peek') {
        const secretHeader =
          request.headers.get('X-Consume-Secret') ||
          request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');

        const expectedSecret = env.CONSUME_SECRET || 'tradecompass_secret_consume_token_2026';

        if (!secretHeader || secretHeader !== expectedSecret) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Invalid or missing X-Consume-Secret header' }),
            {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const listResult = await env.APP_BUFFER.list({ prefix: 'msg_', limit: 100 });
        const keys = listResult.keys;

        const getPromises = keys.map(async (key) => {
          const raw = await env.APP_BUFFER.get(key.name);
          if (!raw) return null;
          try {
            return JSON.parse(raw) as BufferedTelegramMessage;
          } catch {
            return null;
          }
        });

        const fetchedItems = await Promise.all(getPromises);
        const validMessages = fetchedItems.filter((item): item is BufferedTelegramMessage => item !== null);
        validMessages.sort((a, b) => a.date - b.date);

        return new Response(
          JSON.stringify({
            success: true,
            count: validMessages.length,
            messages: validMessages,
            peekedAt: new Date().toISOString(),
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // ----------------------------------------------------
      // ROUTE 5: POST /send (or /send-message) - Outgoing Telegram Message Dispatch
      // ----------------------------------------------------
      if (request.method === 'POST' && (path === '/send' || path === '/send-message' || path === '/alert')) {
        const secretHeader =
          request.headers.get('X-Consume-Secret') ||
          request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');

        const expectedSecret = env.CONSUME_SECRET || 'tradecompass_secret_consume_token_2026';

        if (!secretHeader || secretHeader !== expectedSecret) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Invalid or missing X-Consume-Secret header' }),
            {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const body: {
          text: string;
          isAlert?: boolean;
          chat_id?: string | number;
          message_thread_id?: number;
          parse_mode?: 'Markdown' | 'HTML' | 'MarkdownV2';
          disable_notification?: boolean;
        } = await request.json();

        if (!body.text) {
          return new Response(
            JSON.stringify({ error: 'Missing required parameter: "text"' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const botToken = env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          return new Response(
            JSON.stringify({ error: 'Server configuration error: TELEGRAM_BOT_TOKEN secret is not set in Cloudflare Worker environment.' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        const defaultChatId = env.TELEGRAM_CHAT_ID || '8959044574';

        // Auto-detect if path is /alert
        const isAlert = body.isAlert ?? (path === '/alert');

        const result = await sendTelegramMessage(
          botToken,
          {
            text: body.text,
            isAlert,
            chat_id: body.chat_id,
            message_thread_id: body.message_thread_id,
            parse_mode: body.parse_mode,
            disable_notification: body.disable_notification,
          },
          defaultChatId
        );

        return new Response(
          JSON.stringify({
            ok: true,
            routedTo: isAlert ? 'Alerts Topic' : 'Standard Chat',
            chatId: isAlert ? (body.chat_id || env.TELEGRAM_ALERTS_CHAT_ID || '-1003872409872') : (body.chat_id || defaultChatId),
            messageThreadId: isAlert ? (body.message_thread_id || Number(env.TELEGRAM_ALERTS_THREAD_ID || 2)) : undefined,
            result,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // 404 for unknown endpoints
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          error: 'Internal Worker Error',
          message: err?.message || String(err),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
