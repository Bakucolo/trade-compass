import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

export interface Trading212Cash {
  free: number;
  total: number;
  ppl: number;
  result: number;
  invested: number;
  pieCash: number;
  blocked?: number;
}

export interface Trading212AccountInfo {
  id: number;
  currencyCode: string;
}

export interface Trading212Position {
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  ppl: number;
  fxPpl?: number | null;
  initialFillDate?: string;
  maxBuy?: number;
  maxSell?: number | null;
  pieQuantity?: number;
  frontend?: string;
}

const TRADING212_BASE_URL = 'https://live.trading212.com/api/v0';

export function getTrading212AuthHeader(): string | null {
  const apiKey = process.env.TRADING212_API_KEY;
  const secretKey = process.env.TRADING212_SECRET_KEY;

  if (!apiKey || !secretKey) {
    return null;
  }

  const credentials = Buffer.from(`${apiKey.trim()}:${secretKey.trim()}`).toString('base64');
  return `Basic ${credentials}`;
}

export async function fetchTrading212Cash(): Promise<Trading212Cash | null> {
  const auth = getTrading212AuthHeader();
  if (!auth) return null;

  try {
    const res = await fetch(`${TRADING212_BASE_URL}/equity/account/cash`, {
      headers: { Authorization: auth },
    });

    if (!res.ok) {
      console.warn(`Trading212 Cash API responded with status ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (err: any) {
    console.error('Trading212 fetchCash error:', err.message);
    return null;
  }
}

export async function fetchTrading212AccountInfo(): Promise<Trading212AccountInfo | null> {
  const auth = getTrading212AuthHeader();
  if (!auth) return null;

  try {
    const res = await fetch(`${TRADING212_BASE_URL}/equity/account/info`, {
      headers: { Authorization: auth },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (err: any) {
    console.error('Trading212 fetchAccountInfo error:', err.message);
    return null;
  }
}

export async function fetchTrading212Portfolio(): Promise<Trading212Position[]> {
  const auth = getTrading212AuthHeader();
  if (!auth) return [];

  try {
    const res = await fetch(`${TRADING212_BASE_URL}/equity/portfolio`, {
      headers: { Authorization: auth },
    });

    if (!res.ok) {
      console.warn(`Trading212 Portfolio API responded with status ${res.status}`);
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.error('Trading212 fetchPortfolio error:', err.message);
    return [];
  }
}

// FX conversion rates to GBP
const FX_TO_GBP: Record<string, number> = {
  USD: 1 / 1.302,
  CAD: 1 / 1.78,
  EUR: 1 / 1.17,
  GBP: 1.0,
  AUD: 1 / 1.95,
};

// Clean Trading212 ticker to standardized symbol and accurate currency
// e.g. "AAPL_US_EQ" -> "AAPL" (USD), "BARCl_EQ" -> "BARC.L" (GBP, GBX pence), "KAPl_EQ" -> "KAP.L" (USD GDR), "CRON_CA_EQ" -> "CRON.TO" (CAD)
export function parseTrading212Ticker(ticker: string, fxPpl?: number | null): { cleanSymbol: string; currency: string; description: string; isPence: boolean } {
  let cleanSymbol = ticker;
  let currency = 'GBP';
  let isPence = false;

  if (ticker.endsWith('_US_EQ')) {
    cleanSymbol = ticker.replace('_US_EQ', '');
    currency = 'USD';
  } else if (ticker.endsWith('_CA_EQ')) {
    cleanSymbol = ticker.replace('_CA_EQ', '') + '.TO';
    currency = 'CAD';
  } else if (ticker.endsWith('a_EQ') || ticker.endsWith('d_EQ') || ticker.endsWith('e_EQ') || ticker.endsWith('f_EQ')) {
    cleanSymbol = ticker.replace(/[a-z]_EQ$/, '');
    currency = 'EUR';
  } else if (ticker.endsWith('l_EQ') || ticker.endsWith('p_EQ')) {
    cleanSymbol = ticker.replace(/[lp]_EQ$/, '') + '.L';
    // Check if this LSE instrument is a USD GDR/foreign currency or native UK pence
    if (fxPpl !== null && fxPpl !== undefined && fxPpl !== 0) {
      currency = 'USD';
      isPence = false;
    } else {
      currency = 'GBP';
      isPence = true;
    }
  } else if (ticker.endsWith('_EQ')) {
    cleanSymbol = ticker.replace('_EQ', '');
  }

  return {
    cleanSymbol,
    currency,
    description: `Trading 212 Position (${cleanSymbol})`,
    isPence,
  };
}

export async function syncTrading212HoldingsToDB(prisma: PrismaClient): Promise<number> {
  const positions = await fetchTrading212Portfolio();
  if (!positions || positions.length === 0) return 0;

  try {
    // Upsert or find broker
    let broker = await prisma.broker.findUnique({
      where: { name: 'Trading 212' },
    });

    if (!broker) {
      broker = await prisma.broker.create({
        data: {
          name: 'Trading 212',
          status: 'connected',
          lastSyncTime: new Date(),
        },
      });
    } else {
      await prisma.broker.update({
        where: { id: broker.id },
        data: { status: 'connected', lastSyncTime: new Date() },
      });
    }

    const activeBrokerSpecificIds = new Set<string>();

    for (const pos of positions) {
      const { cleanSymbol, currency, description, isPence } = parseTrading212Ticker(pos.ticker, pos.fxPpl);
      const brokerSpecificId = pos.ticker;
      activeBrokerSpecificIds.add(brokerSpecificId);

      // In Trading 212, UK stocks (ending with l_EQ) prices are in pence (GBX)
      // Convert GBX price to GBP by dividing by 100
      const nativeCurrentPrice = isPence ? (pos.currentPrice / 100) : (pos.currentPrice || pos.averagePrice || 0);
      const nativeAverageCost = isPence ? (pos.averagePrice / 100) : (pos.averagePrice || 0);
      const nativeMarketValue = pos.quantity * nativeCurrentPrice;
      const nativeCostBasis = pos.quantity * nativeAverageCost;

      // Exact native return %
      const unrealizedPnLPercent = nativeCostBasis > 0
        ? ((nativeMarketValue - nativeCostBasis) / nativeCostBasis) * 100
        : 0;

      // Convert market value to GBP for account ledger balance consistency
      const fxRate = FX_TO_GBP[currency] || 1.0;
      const marketValue = currency === 'GBP' ? nativeMarketValue : (nativeMarketValue * fxRate);

      // pos.ppl is the broker's audited profit/loss in GBP
      const unrealizedPnL = pos.ppl !== undefined ? pos.ppl : (marketValue - (currency === 'GBP' ? nativeCostBasis : nativeCostBasis * fxRate));

      await prisma.holding.upsert({
        where: {
          brokerId_brokerSpecificId: {
            brokerId: broker.id,
            brokerSpecificId,
          },
        },
        update: {
          symbol: cleanSymbol,
          assetType: 'EQUITY',
          description,
          quantity: pos.quantity,
          averageCost: nativeAverageCost,
          currentPrice: nativeCurrentPrice,
          marketValue,
          dayPnL: 0,
          dayPnLPercent: 0,
          unrealizedPnL,
          unrealizedPnLPercent,
          currency,
          updatedAt: new Date(),
        },
        create: {
          brokerId: broker.id,
          brokerSpecificId,
          symbol: cleanSymbol,
          assetType: 'EQUITY',
          description,
          quantity: pos.quantity,
          averageCost: nativeAverageCost,
          currentPrice: nativeCurrentPrice,
          marketValue,
          dayPnL: 0,
          dayPnLPercent: 0,
          unrealizedPnL,
          unrealizedPnLPercent,
          currency,
        },
      });
    }

    // Clean up closed positions for Trading 212
    const existingTrading212Holdings = await prisma.holding.findMany({
      where: { brokerId: broker.id },
    });

    for (const h of existingTrading212Holdings) {
      if (!activeBrokerSpecificIds.has(h.brokerSpecificId)) {
        await prisma.holding.delete({ where: { id: h.id } });
      }
    }

    return positions.length;
  } catch (err: any) {
    console.error('Error syncing Trading 212 holdings to database:', err.message);
    return 0;
  }
}
