import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTelegram() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const bufferUrl = process.env.TELEGRAM_BUFFER_URL;
  const bufferSecret = process.env.TELEGRAM_BUFFER_SECRET;

  console.log('=== TELEGRAM ENVIRONMENT CONFIG ===');
  console.log('TELEGRAM_CHAT_ID:', process.env.TELEGRAM_CHAT_ID);
  console.log('TELEGRAM_ALERTS_CHAT_ID:', process.env.TELEGRAM_ALERTS_CHAT_ID);
  console.log('TELEGRAM_ALERTS_THREAD_ID:', process.env.TELEGRAM_ALERTS_THREAD_ID);
  console.log('TELEGRAM_APP_THREAD_ID:', process.env.TELEGRAM_APP_THREAD_ID);
  console.log('TELEGRAM_BUFFER_URL:', bufferUrl);
  console.log('TELEGRAM_BUFFER_SECRET configured:', Boolean(bufferSecret));
  console.log('TELEGRAM_BOT_TOKEN configured:', Boolean(botToken));

  // 1. Check Webhook Info and getUpdates from Telegram
  if (botToken) {
    try {
      console.log('\n=== CHECKING TELEGRAM BOT WEBHOOK INFO ===');
      const whRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const whData = await whRes.json();
      console.log('getWebhookInfo result:', JSON.stringify(whData, null, 2));

      console.log('\n=== CHECKING getUpdates (PENDING MESSAGES IN TELEGRAM) ===');
      const updatesRes = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`);
      const updatesData = await updatesRes.json();
      console.log('getUpdates result:', JSON.stringify(updatesData, null, 2));
    } catch (e: any) {
      console.error('Telegram API error:', e.message);
    }
  }

  // 2. Check Cloudflare Worker Buffer directly
  if (bufferUrl) {
    try {
      console.log('\n=== CHECKING CLOUDFLARE WORKER DIRECTLY ===');
      const targetUrl = bufferUrl.endsWith('/consume') ? bufferUrl : `${bufferUrl.replace(/\/+$/, '')}/consume`;
      console.log('Pinging:', targetUrl);
      const cfRes = await fetch(targetUrl, {
        headers: {
          'X-Consume-Secret': bufferSecret || '',
          'Authorization': `Bearer ${bufferSecret || ''}`,
        },
      });
      console.log('Worker HTTP Status:', cfRes.status);
      const cfData = await cfRes.json();
      console.log('Worker Response:', JSON.stringify(cfData, null, 2));
    } catch (e: any) {
      console.error('Cloudflare Worker ping error:', e.message);
    }
  }

  // 3. Check App Local API /api/telegram/status
  try {
    console.log('\n=== CHECKING LOCAL API /api/telegram/status ===');
    const statusRes = await fetch('http://localhost:3001/api/telegram/status');
    const statusData = await statusRes.json();
    console.log('Status API:', JSON.stringify(statusData, null, 2));
  } catch (e: any) {
    console.error('Local API status error:', e.message);
  }

  // 4. Trigger /api/telegram/sync-buffer
  try {
    console.log('\n=== TRIGGERING /api/telegram/sync-buffer ===');
    const syncRes = await fetch('http://localhost:3001/api/telegram/sync-buffer', {
      method: 'POST',
    });
    const syncData = await syncRes.json();
    console.log('Sync Buffer API Result:', JSON.stringify(syncData, null, 2));
  } catch (e: any) {
    console.error('Local sync-buffer API error:', e.message);
  }

  // 5. Query latest ThoughtLogs in database
  try {
    console.log('\n=== LATEST THOUGHT LOGS IN DB ===');
    const logs = await prisma.thoughtLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, folder: true, tags: true, symbols: true, createdAt: true },
    });
    console.log(`Found ${logs.length} latest logs:`);
    console.log(JSON.stringify(logs, null, 2));
  } catch (e: any) {
    console.error('DB query error:', e.message);
  }

  await prisma.$disconnect();
}

checkTelegram();
