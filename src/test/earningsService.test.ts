import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  lookupSymbolEarnings,
  fetchEarningsData,
} from '../../server/services/earningsService';
import { generateIcsCalendarEvent, EarningsItem } from '../services/earningsService';

const prisma = new PrismaClient();

describe('Earnings Service & Calendar Calculations', () => {
  it('should lookup real-time earnings telemetry for a major ticker (NVDA)', async () => {
    const item = await lookupSymbolEarnings('NVDA');
    expect(item).not.toBeNull();
    if (item) {
      expect(item.symbol).toBe('NVDA');
      expect(item.price).toBeGreaterThan(0);
      expect(item.companyName).toContain('NVIDIA');
      expect(item.earningsDate).not.toBeNull();
      expect(item.earningsDateFormatted).toMatch(/[A-Za-z]+ \d{1,2}, \d{4}/);
      expect(typeof item.daysUntil).toBe('number');
      expect(['BMO', 'AMC', 'UNSPECIFIED']).toContain(item.timing);
    }
  }, 20000);

  it('should compile portfolio and watchlist earnings data via fetchEarningsData', async () => {
    const res = await fetchEarningsData(prisma, ['NVDA', 'AAPL']);
    expect(res).toBeDefined();
    expect(Array.isArray(res.items)).toBe(true);
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.summary).toBeDefined();
    expect(typeof res.summary.totalMonitored).toBe('number');
    expect(typeof res.summary.reportingThisWeek).toBe('number');
    expect(typeof res.summary.reportingThisMonth).toBe('number');
  }, 25000);

  it('should correctly format and generate a standard .ics calendar invite', () => {
    const mockItem: EarningsItem = {
      symbol: 'NVDA',
      resolvedSymbol: 'NVDA',
      companyName: 'NVIDIA Corporation',
      price: 217.55,
      dayChangePercent: 1.5,
      currency: 'USD',
      earningsDate: '2026-11-17T20:00:00.000Z',
      earningsDateFormatted: 'Nov 17, 2026',
      daysUntil: 78,
      timing: 'AMC',
      isEstimate: false,
      epsEstimate: 2.47,
      epsLow: 2.34,
      epsHigh: 2.70,
      revenueEstimate: 108972821930,
      revenueLow: 104937000000,
      revenueHigh: 116251000000,
      isPortfolioHolding: true,
      portfolioMarketValue: 50000,
      portfolioQuantity: 230,
      isWatchlist: false,
    };

    const ics = generateIcsCalendarEvent(mockItem);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:📊 NVDA Earnings Release (After Market Close)');
    expect(ics).toContain('DTSTART:20261117T203000Z');
    expect(ics).toContain('END:VCALENDAR');
  });
});
