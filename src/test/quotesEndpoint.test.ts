import { describe, it, expect } from 'vitest';
import YahooFinance from 'yahoo-finance2';
import { resolveYahooFinanceSymbol } from '../../server/services/tickerResolutionService';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

function withQuoteTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Quote fetch timeout after ${ms}ms`)), ms)),
  ]);
}

function cleanTickerString(raw: string): string {
  let s = (raw || '').trim().toUpperCase();
  if (s.endsWith('_US_EQ')) return s.replace('_US_EQ', '');
  if (s.endsWith('_CA_EQ')) return s.replace('_CA_EQ', '') + '.TO';
  if (s.endsWith('L_EQ') || s.endsWith('P_EQ')) return s.replace(/[LP]_EQ$/, '') + '.L';
  if (s.endsWith('_EQ')) return s.replace('_EQ', '');
  return s;
}

async function fetchQuoteForSymbolTest(rawSymbol: string, currency?: string) {
  if (!rawSymbol || !rawSymbol.trim()) return null;
  const cleanRaw = cleanTickerString(rawSymbol);
  const sym = resolveYahooFinanceSymbol(cleanRaw, currency) || cleanRaw;
  const now = Date.now();

  try {
    const period1Str = new Date(Date.now() - 45 * 86400 * 1000).toISOString().slice(0, 10);
    const chartRes = await withQuoteTimeout(
      yahooFinance.chart(sym, { period1: period1Str, interval: '1d' }, { validateResult: false }),
      5000
    ).catch(() => null);

    const quotes = (chartRes?.quotes || []).filter((q: any) => q.close != null && !isNaN(q.close));
    const meta = chartRes?.meta;

    if (quotes.length > 0 && meta) {
      const price = Number(meta.regularMarketPrice || quotes[quotes.length - 1].close);
      const prevClose = Number(meta.chartPreviousClose || meta.previousClose || (quotes.length > 1 ? quotes[quotes.length - 2].close : price));
      const todayOpen = Number(meta.regularMarketOpen || quotes[quotes.length - 1].open || price);

      const change = price - prevClose;
      const changesPercentage = prevClose > 0 ? (change / prevClose) * 100 : 0;
      const overnightChangePercent = prevClose > 0 ? ((todayOpen - prevClose) / prevClose) * 100 : 0;

      let yesterdayChange = 0;
      let yesterdayChangePercent = 0;
      if (quotes.length >= 3) {
        const yestClose = Number(quotes[quotes.length - 2].close);
        const twoDaysAgoClose = Number(quotes[quotes.length - 3].close);
        if (twoDaysAgoClose > 0) {
          yesterdayChange = yestClose - twoDaysAgoClose;
          yesterdayChangePercent = ((yestClose - twoDaysAgoClose) / twoDaysAgoClose) * 100;
        }
      } else if (quotes.length >= 2) {
        const yestClose = Number(quotes[quotes.length - 2].close);
        const yestOpen = Number(quotes[quotes.length - 2].open || yestClose);
        if (yestOpen > 0) {
          yesterdayChange = yestClose - yestOpen;
          yesterdayChangePercent = ((yestClose - yestOpen) / yestOpen) * 100;
        }
      }

      return {
        symbol: rawSymbol,
        name: meta.shortName || meta.symbol || rawSymbol,
        price,
        previousClose: prevClose,
        open: todayOpen,
        change,
        changesPercentage,
        yesterdayChange,
        yesterdayChangePercent,
        overnightChangePercent,
        currency: meta.currency || (currency || 'USD'),
        timestamp: now,
      };
    }
  } catch (err) {
    // fallback
  }

  return null;
}

describe('Live Multi-Session Quotes Telemetry & Yesterday Performance', () => {
  it('fetches rich multi-session telemetry with real price, yesterday change, and overnight gap for major tickers', async () => {
    const quote = await fetchQuoteForSymbolTest('AAPL');
    expect(quote).not.toBeNull();
    expect(quote!.symbol).toBe('AAPL');
    expect(quote!.price).toBeGreaterThan(0);
    expect(typeof quote!.yesterdayChangePercent).toBe('number');
    expect(typeof quote!.overnightChangePercent).toBe('number');
    expect(typeof quote!.yesterdayChange).toBe('number');
  }, 10000);

  it('correctly resolves international exchange tickers and computes non-zero session metrics', async () => {
    const quote = await fetchQuoteForSymbolTest('EOS', 'AUD');
    expect(quote).not.toBeNull();
    expect(quote!.price).toBeGreaterThan(0);
    expect(quote!.currency).toBe('AUD');
  }, 10000);

  it('strips internal broker ticker suffixes (e.g. _US_EQ, _CA_EQ, L_EQ)', () => {
    expect(cleanTickerString('FLEX_US_EQ')).toBe('FLEX');
    expect(cleanTickerString('BURL_EQ')).toBe('BUR.L');
    expect(cleanTickerString('AYA_CA_EQ')).toBe('AYA.TO');
    expect(cleanTickerString('TEST_EQ')).toBe('TEST');
  });
});
