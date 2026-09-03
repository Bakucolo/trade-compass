import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPlannedTrades,
  createPlannedTrade,
  updatePlannedTrade,
  deletePlannedTrade,
  reorderPlannedTrades,
  generateExecutionPlanPdfBuffer,
} from '../../server/services/plannedTradeService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Planned Trades & Execution Queue Service', () => {
  beforeEach(async () => {
    // Clean up test planned trades
    await (prisma as any).plannedTrade.deleteMany({
      where: {
        symbol: { in: ['TEST_AAPL', 'TEST_NVDA', 'TEST_TSLA'] },
      },
    });
  });

  it('should create planned trades with auto-incrementing ranks', async () => {
    const trade1 = await createPlannedTrade({
      symbol: 'TEST_AAPL',
      action: 'BUY',
      assetType: 'STOCK',
      timeframe: 'DAY',
      quantity: 100,
      targetPrice: 220,
      stopLoss: 210,
      targetExit: 245,
      conviction: 'HIGH',
      notes: 'Test breakout',
    });

    expect(trade1.symbol).toBe('TEST_AAPL');
    expect(trade1.action).toBe('BUY');
    expect(trade1.timeframe).toBe('DAY');
    expect(trade1.status).toBe('PENDING');
    expect(trade1.rank).toBeGreaterThanOrEqual(1);

    const trade2 = await createPlannedTrade({
      symbol: 'TEST_NVDA',
      action: 'BTO',
      assetType: 'OPTION',
      timeframe: 'WEEK',
      quantity: 10,
      targetPrice: 5.5,
      conviction: 'MEDIUM',
    });

    expect(trade2.symbol).toBe('TEST_NVDA');
    expect(trade2.rank).toBe(trade1.rank + 1);

    // Clean up
    await (prisma as any).plannedTrade.deleteMany({
      where: { id: { in: [trade1.id, trade2.id] } },
    });
  });

  it('should reorder trades and assign sequential ranks', async () => {
    const t1 = await createPlannedTrade({
      symbol: 'TEST_AAPL',
      action: 'BUY',
      quantity: 50,
      timeframe: 'DAY',
    });
    const t2 = await createPlannedTrade({
      symbol: 'TEST_NVDA',
      action: 'BUY',
      quantity: 25,
      timeframe: 'WEEK',
    });

    // Reorder: t2 first, t1 second
    const reordered = await reorderPlannedTrades([t2.id, t1.id]);
    const updatedT2 = reordered.find((x) => x.id === t2.id);
    const updatedT1 = reordered.find((x) => x.id === t1.id);

    expect(updatedT2?.rank).toBe(1);
    expect(updatedT1?.rank).toBe(2);

    // Clean up
    await (prisma as any).plannedTrade.deleteMany({
      where: { id: { in: [t1.id, t2.id] } },
    });
  });

  it('should generate a valid PDF buffer containing planned trade telemetry', async () => {
    const t1 = await createPlannedTrade({
      symbol: 'TEST_TSLA',
      action: 'SHORT',
      quantity: 20,
      targetPrice: 240,
      stopLoss: 255,
      targetExit: 210,
      timeframe: 'DAY',
      conviction: 'HIGH',
      notes: 'Rejection of 200 EMA with bearish divergence',
    });

    const trades = await getPlannedTrades();
    const pdfBuffer = await generateExecutionPlanPdfBuffer(trades);

    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // PDF Magic bytes "%PDF-"
    expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-');

    // Clean up
    await (prisma as any).plannedTrade.deleteMany({
      where: { id: t1.id },
    });
  });
});
