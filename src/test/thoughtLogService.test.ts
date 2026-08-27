import { describe, it, expect } from 'vitest';
import { extractSymbolsFromText } from '../../server/services/thoughtLogAgentService';

describe('Thought Log Agent Intelligence Service', () => {
  it('should accurately extract ticker symbols with dollar prefixes', () => {
    const text = 'I am looking at $NVDA, $PLTR and considering hedging with $QQQ or $TLT puts.';
    const symbols = extractSymbolsFromText(text);

    expect(symbols).toContain('NVDA');
    expect(symbols).toContain('PLTR');
    expect(symbols).toContain('QQQ');
    expect(symbols).toContain('TLT');
  });

  it('should extract capitalized words matching ticker candidates and filter out common financial English words', () => {
    const text = 'Thinking about CCJ and CEG because AI datacenters need baseload power. BUT NOT THE STOP LOSS.';
    const symbols = extractSymbolsFromText(text);

    expect(symbols).toContain('CCJ');
    expect(symbols).toContain('CEG');
    expect(symbols).not.toContain('THE');
    expect(symbols).not.toContain('NOT');
    expect(symbols).not.toContain('BUT');
    expect(symbols).not.toContain('STOP');
    expect(symbols).not.toContain('LOSS');
  });

  it('should handle empty or null text gracefully', () => {
    expect(extractSymbolsFromText('')).toEqual([]);
    expect(extractSymbolsFromText(null as any)).toEqual([]);
  });

  it('should deduplicate multiple occurrences of the same ticker', () => {
    const text = '$NVDA is breaking out. I bought more NVDA and sold $NVDA calls.';
    const symbols = extractSymbolsFromText(text);

    expect(symbols.filter((s) => s === 'NVDA').length).toBe(1);
  });

  it('should not extract AM or PM from morning/evening timestamps in titles or messages', () => {
    const text = '📱 PLTR under 125 is a buy (09:11 AM)';
    const symbols = extractSymbolsFromText(text);

    expect(symbols).toContain('PLTR');
    expect(symbols).not.toContain('AM');
    expect(symbols).not.toContain('PM');
    expect(symbols).toEqual(['PLTR']);
  });

  it('should not extract common 2-letter words like IS, IT, IN, TO, ON, OK as tickers', () => {
    const text = 'IS IT OK TO BUY $AAPL ON THE DIP IN THE MORNING AT 10:30 AM?';
    const symbols = extractSymbolsFromText(text);

    expect(symbols).toContain('AAPL');
    expect(symbols).not.toContain('IS');
    expect(symbols).not.toContain('IT');
    expect(symbols).not.toContain('OK');
    expect(symbols).not.toContain('TO');
    expect(symbols).not.toContain('ON');
    expect(symbols).not.toContain('IN');
    expect(symbols).not.toContain('AM');
    expect(symbols).toEqual(['AAPL']);
  });
});
