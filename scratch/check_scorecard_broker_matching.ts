import { PrismaClient } from '@prisma/client';
import { resolveYahooFinanceSymbol } from '../server/services/tickerResolutionService';

const p = new PrismaClient();

async function run() {
  const records = await p.stockScorecardRecord.findMany({ select: { symbol: true } });

  const holdings = await p.holding.findMany({
    where: { quantity: { not: 0 }, assetType: { in: ['EQUITY', 'Stock', 'ETF'] } },
    include: { broker: true }
  });

  const holdingSymbolsMap = new Map<string, any>();
  const holdingBrokersMap = new Map<string, Set<string>>();

  holdings.forEach((h) => {
    const clean = resolveYahooFinanceSymbol(h.symbol, h.currency || undefined).toUpperCase();
    const raw = h.symbol.trim().toUpperCase();
    const brokerName = h.broker?.name || 'Interactive Brokers';

    [clean, raw].forEach((s) => {
      if (!holdingBrokersMap.has(s)) {
        holdingBrokersMap.set(s, new Set<string>());
      }
      holdingBrokersMap.get(s)!.add(brokerName);
    });

    const detail = {
      quantity: h.quantity,
      averageCost: h.averageCost,
      marketValue: h.marketValue,
      unrealizedPnL: h.unrealizedPnL,
      unrealizedPnLPercent: h.unrealizedPnLPercent,
      broker: brokerName,
    };

    if (!holdingSymbolsMap.has(clean)) holdingSymbolsMap.set(clean, detail);
    if (!holdingSymbolsMap.has(raw)) holdingSymbolsMap.set(raw, detail);
  });

  const watchlists = await p.watchlist.findMany({
    include: { items: true },
  });

  const watchlistSymbolsMap = new Map<string, string[]>();
  watchlists.forEach((w) => {
    w.items.forEach((item) => {
      const sym = resolveYahooFinanceSymbol(item.symbol).toUpperCase();
      const raw = item.symbol.trim().toUpperCase();
      [sym, raw].forEach((s) => {
        const existing = watchlistSymbolsMap.get(s) || [];
        if (!existing.includes(w.name)) {
          existing.push(w.name);
        }
        watchlistSymbolsMap.set(s, existing);
      });
    });
  });

  const scorecards = records.map((rec) => {
    const symUpper = rec.symbol.trim().toUpperCase();
    const cleanSymUpper = resolveYahooFinanceSymbol(rec.symbol).toUpperCase();

    const holdingData = holdingSymbolsMap.get(symUpper) || holdingSymbolsMap.get(cleanSymUpper);
    const brokersSet = new Set<string>();
    (holdingBrokersMap.get(symUpper) || []).forEach((b) => brokersSet.add(b));
    (holdingBrokersMap.get(cleanSymUpper) || []).forEach((b) => brokersSet.add(b));
    if (holdingData?.broker) brokersSet.add(holdingData.broker);
    const brokersList = Array.from(brokersSet);

    const watchlistNamesSet = new Set<string>();
    (watchlistSymbolsMap.get(symUpper) || []).forEach((w) => watchlistNamesSet.add(w));
    (watchlistSymbolsMap.get(cleanSymUpper) || []).forEach((w) => watchlistNamesSet.add(w));
    const watchlistList = Array.from(watchlistNamesSet);

    return {
      symbol: rec.symbol,
      brokers: brokersList,
      isHolding: brokersList.length > 0,
      watchlistNames: watchlistList,
      isWatchlist: watchlistList.length > 0,
    };
  });

  const brokerCounts: Record<string, number> = {};
  const watchlistCounts: Record<string, number> = {};

  scorecards.forEach((s) => {
    s.brokers.forEach((b) => {
      brokerCounts[b] = (brokerCounts[b] || 0) + 1;
    });
    s.watchlistNames.forEach((w) => {
      watchlistCounts[w] = (watchlistCounts[w] || 0) + 1;
    });
  });

  console.log('Result Broker Counts on Scorecards:', brokerCounts);
  console.log('Result Watchlist Counts on Scorecards:', watchlistCounts);
  console.log('Total Holdings Scorecards:', scorecards.filter((s) => s.isHolding).length);
  console.log('Total Watchlist Scorecards:', scorecards.filter((s) => s.isWatchlist).length);
  console.log('Overlap (both held and in watchlist):', scorecards.filter((s) => s.isHolding && s.isWatchlist).length);
}

run()
  .catch(console.error)
  .finally(() => p.$disconnect());
