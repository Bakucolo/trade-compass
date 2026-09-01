import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  parseIBKRDate,
  upsertIBKRExecution,
  syncIBKRFromHoldings,
  getFilteredTrades
} from '../../server/services/tradeService';

const prisma = new PrismaClient();

describe('IBKR Trade Synchronization & Execution Ingestion Service', () => {
  it('correctly parses various IBKR TWS execution date formats', () => {
    const d1 = parseIBKRDate('20260831  14:30:15');
    expect(d1.getUTCFullYear()).toBe(2026);
    expect(d1.getUTCMonth()).toBe(7); // 0-indexed August
    expect(d1.getUTCDate()).toBe(31);
    expect(d1.getUTCHours()).toBe(14);
    expect(d1.getUTCMinutes()).toBe(30);

    const d2 = parseIBKRDate('20260901-09:45:00');
    expect(d2.getUTCFullYear()).toBe(2026);
    expect(d2.getUTCMonth()).toBe(8); // September
    expect(d2.getUTCDate()).toBe(1);

    const d3 = parseIBKRDate('20260901');
    expect(d3.getUTCFullYear()).toBe(2026);
    expect(d3.getUTCDate()).toBe(1);
  });

  it('ingests live IBKR execution fills into SQLite TradeRecord table', async () => {
    const mockContract = {
      symbol: 'AAPL',
      localSymbol: 'AAPL',
      secType: 'STK',
      currency: 'USD'
    };

    const mockExecution = {
      execId: 'test.exec.001',
      time: '20260901  10:15:30',
      side: 'BOT',
      shares: 50,
      price: 230.50,
      orderId: 998811
    };

    const trade = await upsertIBKRExecution(prisma, mockContract, mockExecution, { commission: 1.50 });
    expect(trade).not.toBeNull();
    expect(trade?.broker).toBe('Interactive Brokers');
    expect(trade?.symbol).toBe('AAPL');
    expect(trade?.side).toBe('BUY');
    expect(trade?.quantity).toBe(50);
    expect(trade?.price).toBe(230.50);
    expect(trade?.totalValue).toBe(11525);
    expect(trade?.commission).toBe(1.50);

    // Clean up test trade
    if (trade?.id) {
      await prisma.tradeRecord.delete({ where: { id: trade.id } });
    }
  });

  it('ingests live IBKR option execution fills with Greeks and OCC details', async () => {
    const mockOptionContract = {
      symbol: 'NVDA',
      localSymbol: 'NVDA  260918C00125000',
      secType: 'OPT',
      strike: 125,
      right: 'C',
      lastTradeDateOrContractMonth: '20260918',
      currency: 'USD'
    };

    const mockOptionExecution = {
      execId: 'test.exec.opt.002',
      time: '20260901  11:00:00',
      side: 'SLD',
      shares: 2,
      price: 5.40,
      orderId: 998822
    };

    const trade = await upsertIBKRExecution(prisma, mockOptionContract, mockOptionExecution, { commission: 2.10 });
    expect(trade).not.toBeNull();
    expect(trade?.broker).toBe('Interactive Brokers');
    expect(trade?.assetType).toBe('OPTION');
    expect(trade?.optionType).toBe('CALL');
    expect(trade?.strikePrice).toBe(125);
    expect(trade?.action).toBe('SELL_TO_CLOSE');
    expect(trade?.side).toBe('SELL');
    expect(trade?.quantity).toBe(2);
    expect(trade?.price).toBe(5.40);
    expect(trade?.totalValue).toBe(1080); // 2 * 5.40 * 100
    expect(trade?.commission).toBe(2.10);

    // Clean up test trade
    if (trade?.id) {
      await prisma.tradeRecord.delete({ where: { id: trade.id } });
    }
  });

  it('filters trades by broker and accurately computes aggregates', async () => {
    const result = await getFilteredTrades(prisma, { broker: 'Interactive Brokers', limit: 10 });
    expect(result).toBeDefined();
    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.trades.every(t => t.broker === 'Interactive Brokers')).toBe(true);
    expect(result.metrics.totalTrades).toBeGreaterThan(0);
  });
});
