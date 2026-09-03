import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendTelegramMessage,
  sendTelegramAlert,
  sendPdfReportToTelegram,
} from '../../server/services/telegramReportService';
import { sendTelegramMessage as sendWorkerTelegramMessage } from '../../cloudflare-telegram-buffer/src/index';

describe('Telegram Routing Logic: Alerts Topic vs Standard Reports', () => {
  const originalFetch = global.fetch;
  const savedToken = process.env.TELEGRAM_BOT_TOKEN;
  const savedChatId = process.env.TELEGRAM_CHAT_ID;
  const savedAlertsChatId = process.env.TELEGRAM_ALERTS_CHAT_ID;
  const savedAlertsThreadId = process.env.TELEGRAM_ALERTS_THREAD_ID;

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'mock-bot-token-123';
    process.env.TELEGRAM_CHAT_ID = '8959044574';
    process.env.TELEGRAM_ALERTS_CHAT_ID = '-1003872409872';
    process.env.TELEGRAM_ALERTS_THREAD_ID = '2';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (savedToken) process.env.TELEGRAM_BOT_TOKEN = savedToken;
    else delete process.env.TELEGRAM_BOT_TOKEN;
    if (savedChatId) process.env.TELEGRAM_CHAT_ID = savedChatId;
    else delete process.env.TELEGRAM_CHAT_ID;
    if (savedAlertsChatId) process.env.TELEGRAM_ALERTS_CHAT_ID = savedAlertsChatId;
    else delete process.env.TELEGRAM_ALERTS_CHAT_ID;
    if (savedAlertsThreadId) process.env.TELEGRAM_ALERTS_THREAD_ID = savedAlertsThreadId;
    else delete process.env.TELEGRAM_ALERTS_THREAD_ID;
  });

  it('routes triggered alerts to chat_id: -1003872409872 with message_thread_id: 2', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;

    global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: { message_id: 7001, message_thread_id: 2, chat: { id: -1003872409872 } },
        }),
      };
    });

    const res = await sendTelegramAlert('🚨 Test Alert: NVDA reached $135');

    expect(res.success).toBe(true);
    expect(res.messageId).toBe(7001);
    expect(capturedUrl).toBe('https://api.telegram.org/botmock-bot-token-123/sendMessage');
    expect(capturedBody.chat_id).toBe('-1003872409872');
    expect(capturedBody.message_thread_id).toBe(2);
    expect(capturedBody.text).toContain('NVDA reached $135');
  });

  it('routes standard reports to original chat_id without message_thread_id', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;

    global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: { message_id: 7002, chat: { id: 8959044574 } },
        }),
      };
    });

    const res = await sendTelegramMessage({
      text: '📊 Daily Market Pulse Briefing',
      isAlert: false,
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toBe(7002);
    expect(capturedUrl).toBe('https://api.telegram.org/botmock-bot-token-123/sendMessage');
    expect(capturedBody.chat_id).toBe('8959044574');
    // Ensure message_thread_id is completely omitted for standard reports
    expect(capturedBody.message_thread_id).toBeUndefined();
    expect(capturedBody).not.toHaveProperty('message_thread_id');
  });

  it('routes standard PDF reports without message_thread_id, and alerts PDF with topic 2', async () => {
    let capturedFormData: FormData | null = null;

    global.fetch = vi.fn().mockImplementation(async (_url: string, init: any) => {
      capturedFormData = init.body;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: { message_id: 8001 },
        }),
      };
    });

    const dummyPdf = Buffer.from('%PDF-1.4 test');

    // 1. Standard Report PDF
    await sendPdfReportToTelegram(dummyPdf, 'Standard_Report.pdf', 'Caption');
    expect(capturedFormData?.get('chat_id')).toBe('8959044574');
    expect(capturedFormData?.has('message_thread_id')).toBe(false);

    // 2. Alert PDF
    await sendPdfReportToTelegram(dummyPdf, 'Defense_Alert.pdf', 'Alert Caption', { isAlert: true });
    expect(capturedFormData?.get('chat_id')).toBe('-1003872409872');
    expect(capturedFormData?.get('message_thread_id')).toBe('2');
  });

  it('Cloudflare Worker helper applies identical topic routing logic', async () => {
    let capturedBody: any = null;

    global.fetch = vi.fn().mockImplementation(async (_url: string, init: any) => {
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: { message_id: 9001 },
        }),
      };
    });

    // 1. Alert in Worker
    await sendWorkerTelegramMessage('bot-tok', {
      text: 'Worker Alert',
      isAlert: true,
    }, '8959044574');

    expect(capturedBody.chat_id).toBe('-1003872409872');
    expect(capturedBody.message_thread_id).toBe(2);

    // 2. Standard report in Worker
    await sendWorkerTelegramMessage('bot-tok', {
      text: 'Worker Report',
      isAlert: false,
    }, '8959044574');

    expect(capturedBody.chat_id).toBe('8959044574');
    expect(capturedBody.message_thread_id).toBeUndefined();
    expect(capturedBody).not.toHaveProperty('message_thread_id');
  });
});
