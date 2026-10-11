// src/test/telegramWatchlistNotes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  parseWatchlistMessage,
  parseStockNoteMessage,
  saveSymbolsToWatchlist,
} from '../../server/services/telegramBufferConsumerService';

const prisma = new PrismaClient();

describe('Telegram Watchlist & Notes Message Parsers', () => {
  describe('parseWatchlistMessage', () => {
    it('parses watchlist name with explicit tickers after space', () => {
      const res = parseWatchlistMessage('Semiconductors NVDA AMD TSM AVGO');
      expect(res.isAgentThemeRequest).toBe(false);
      expect(res.watchlistName).toBe('Semiconductors');
      expect(res.symbols).toEqual(['NVDA', 'AMD', 'TSM', 'AVGO']);
    });

    it('parses watchlist name with colon separator', () => {
      const res = parseWatchlistMessage('Clean Tech: ENPH FSLR SEDG');
      expect(res.isAgentThemeRequest).toBe(false);
      expect(res.watchlistName).toBe('Clean Tech');
      expect(res.symbols).toEqual(['ENPH', 'FSLR', 'SEDG']);
    });

    it('parses watchlist with dollar sign tickers', () => {
      const res = parseWatchlistMessage('Nuclear Energy $CCJ $SMR $OKLO');
      expect(res.isAgentThemeRequest).toBe(false);
      expect(res.watchlistName).toBe('Nuclear Energy');
      expect(res.symbols).toEqual(['CCJ', 'SMR', 'OKLO']);
    });

    it('identifies theme-only requests when no valid tickers follow', () => {
      const res = parseWatchlistMessage('Robotics and Automation');
      expect(res.isAgentThemeRequest).toBe(true);
      expect(res.watchlistName).toBe('Robotics and Automation');
      expect(res.symbols).toHaveLength(0);
    });

    it('identifies single-word theme request', () => {
      const res = parseWatchlistMessage('Cybersecurity');
      expect(res.isAgentThemeRequest).toBe(true);
      expect(res.watchlistName).toBe('Cybersecurity');
      expect(res.symbols).toHaveLength(0);
    });

    it('handles hashtag prefixes in topic messages', () => {
      const res = parseWatchlistMessage('#watchlist Biotech Giants GILD VRTX BIIB');
      expect(res.isAgentThemeRequest).toBe(false);
      expect(res.watchlistName).toBe('Biotech Giants');
      expect(res.symbols).toEqual(['GILD', 'VRTX', 'BIIB']);
    });
  });

  describe('parseStockNoteMessage', () => {
    it('parses ticker first followed by note text', () => {
      const res = parseStockNoteMessage('AAPL Impressive earnings guidance, buy dip if it drops below 220');
      expect(res).not.toBeNull();
      expect(res?.symbol).toBe('AAPL');
      expect(res?.note).toBe('Impressive earnings guidance, buy dip if it drops below 220');
    });

    it('parses dollar-prefixed ticker', () => {
      const res = parseStockNoteMessage('$TSLA High implied volatility around robotaxi launch; consider covered calls.');
      expect(res).not.toBeNull();
      expect(res?.symbol).toBe('TSLA');
      expect(res?.note).toBe('High implied volatility around robotaxi launch; consider covered calls.');
    });

    it('parses ticker with colon delimiter', () => {
      const res = parseStockNoteMessage('NVDA: Blackwell shipment momentum accelerating. Long term core holding.');
      expect(res).not.toBeNull();
      expect(res?.symbol).toBe('NVDA');
      expect(res?.note).toBe('Blackwell shipment momentum accelerating. Long term core holding.');
    });

    it('strips #note topic hashtag if present', () => {
      const res = parseStockNoteMessage('#note MSFT Azure AI revenue beating expectations');
      expect(res).not.toBeNull();
      expect(res?.symbol).toBe('MSFT');
      expect(res?.note).toBe('Azure AI revenue beating expectations');
    });
  });

  describe('Database Persistence for Watchlist & Notes', () => {
    const testWatchlistName = 'Test Automated Watchlist ' + Date.now();
    const testSymbol = 'TEST' + Math.floor(Math.random() * 1000);

    afterAll(async () => {
      // Clean up test watchlist and notes
      try {
        const wl = await (prisma as any).watchlist.findFirst({ where: { name: testWatchlistName } });
        if (wl) {
          await (prisma as any).watchlistItem.deleteMany({ where: { watchlistId: wl.id } });
          await (prisma as any).watchlist.delete({ where: { id: wl.id } });
        }
        await (prisma as any).stockNote.deleteMany({ where: { symbol: testSymbol } });
      } catch {}
      await prisma.$disconnect();
    });

    it('automatically creates a new watchlist if it does not exist and saves symbols', async () => {
      const symbolsToSave = ['AAPL', 'NVDA', 'MSFT'];
      const result = await saveSymbolsToWatchlist(prisma, symbolsToSave, testWatchlistName);

      expect(result).not.toBeNull();
      expect(result?.watchlistName).toBe(testWatchlistName);
      expect(result?.added).toEqual(symbolsToSave);

      const created = await (prisma as any).watchlist.findFirst({
        where: { name: testWatchlistName },
        include: { items: true },
      });
      expect(created).not.toBeNull();
      expect(created.name).toBe(testWatchlistName);
      expect(created.items.length).toBe(3);
    });

    it('upserts stock notes and appends running journal with timestamp divider', async () => {
      // 1. Initial note
      const firstNote = 'Initial research note from Telegram';
      await (prisma as any).stockNote.upsert({
        where: { symbol: testSymbol },
        update: { content: firstNote, sentiment: 'BULLISH', tags: 'Telegram, Mobile' },
        create: { symbol: testSymbol, content: firstNote, sentiment: 'BULLISH', tags: 'Telegram, Mobile' },
      });

      const initialSaved = await (prisma as any).stockNote.findUnique({
        where: { symbol: testSymbol },
      });
      expect(initialSaved.content).toBe(firstNote);
      expect(initialSaved.sentiment).toBe('BULLISH');

      // 2. Second note appended with separator
      const secondNote = 'Second catalyst update: earnings beat by 12%';
      const nowFormatted = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const combined = `${initialSaved.content.trim()}\n\n---\n📅 **${nowFormatted} (Telegram Note):**\n${secondNote}`;

      await (prisma as any).stockNote.upsert({
        where: { symbol: testSymbol },
        update: { content: combined, sentiment: 'BULLISH', tags: 'Telegram, Mobile' },
        create: { symbol: testSymbol, content: combined, sentiment: 'BULLISH', tags: 'Telegram, Mobile' },
      });

      const updatedSaved = await (prisma as any).stockNote.findUnique({
        where: { symbol: testSymbol },
      });
      expect(updatedSaved.content).toContain(firstNote);
      expect(updatedSaved.content).toContain(secondNote);
      expect(updatedSaved.content).toContain('Telegram Note');
    });
  });
});
