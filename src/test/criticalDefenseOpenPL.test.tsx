import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { getPositionOpenPL, CriticalDefenseModal } from '../components/portfolio/CriticalDefenseModal';
import { UnifiedPosition } from '../components/portfolio/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('Critical Position Defense Center - Open P&L Resolution', () => {
  it('correctly uses existing unrealizedPL and unrealizedPLPercent when available', () => {
    const pos: any = {
      quantity: 100,
      averageCost: 50,
      currentPrice: 60,
      unrealizedPL: 1000,
      unrealizedPLPercent: 20,
    };
    const result = getPositionOpenPL(pos);
    expect(result.pl).toBe(1000);
    expect(result.plPercent).toBe(20);
  });

  it('correctly extracts from unrealizedPnL or ppl when unrealizedPL is missing', () => {
    const posIBKR: any = {
      quantity: 50,
      averageCost: 100,
      currentPrice: 90,
      unrealizedPnL: -500,
      unrealizedPnLPercent: -10,
    };
    const resIBKR = getPositionOpenPL(posIBKR);
    expect(resIBKR.pl).toBe(-500);
    expect(resIBKR.plPercent).toBe(-10);

    const posT212: any = {
      quantity: 20,
      averageCost: 10,
      currentPrice: 15,
      ppl: 100,
    };
    const resT212 = getPositionOpenPL(posT212);
    expect(resT212.pl).toBe(100);
    expect(resT212.plPercent).toBe(50);
  });

  it('dynamically computes P&L for long stock when broker P&L fields are undefined', () => {
    const pos: any = {
      quantity: 10,
      averageCost: 100,
      currentPrice: 125,
      assetType: 'Stock',
      // No P&L fields
    };
    const result = getPositionOpenPL(pos);
    expect(result.pl).toBe(250); // (125 - 100) * 10
    expect(result.plPercent).toBe(25); // 250 / 1000 * 100
  });

  it('dynamically computes P&L for short option with 100 multiplier and correct sign', () => {
    // Short 2 contracts sold at $4.00, now trading at $6.50 (Loss of $2.50 * 200 = -$500)
    const shortOptionLoss: any = {
      quantity: -2,
      averageCost: 4.0,
      currentPrice: 6.5,
      assetType: 'Option',
    };
    const lossResult = getPositionOpenPL(shortOptionLoss);
    expect(lossResult.pl).toBe(-500);
    expect(lossResult.plPercent).toBe(-62.5); // -500 / 800 * 100

    // Short 1 contract sold at $5.00, now trading at $1.00 (Profit of $4.00 * 100 = +$400)
    const shortOptionProfit: any = {
      quantity: -1,
      averageCost: 5.0,
      currentPrice: 1.0,
      assetType: 'Option',
    };
    const profitResult = getPositionOpenPL(shortOptionProfit);
    expect(profitResult.pl).toBe(400);
    expect(profitResult.plPercent).toBe(80); // 400 / 500 * 100
  });

  it('renders Open P&L without NaN in CriticalDefenseModal for positions with missing P&L fields', () => {
    const missingPlPositions: UnifiedPosition[] = [
      {
        id: 'opt-1',
        symbol: 'NVDA  260918P00110000',
        underlyingSymbol: 'NVDA',
        quantity: -2,
        averageCost: 3.5,
        currentPrice: 5.0, // Loss: (3.5 - 5.0) * 200 = -$300
        marketValue: 1000,
        dayChange: -20,
        dayChangePercent: -2,
        unrealizedPL: undefined as any,
        unrealizedPLPercent: undefined as any,
        source: 'Tastytrade',
        assetType: 'Option',
        strike: 110,
        optionType: 'Put',
        underlyingPrice: 108, // ITM
        expiry: '20260918',
      },
    ];

    render(
      <QueryClientProvider client={queryClient}>
        <CriticalDefenseModal
          isOpen={true}
          onClose={vi.fn()}
          positions={missingPlPositions}
          onOpenAdvisorForPosition={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Ensure no NaN is rendered
    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();

    // Verify Open P&L shows -$300.00 (-42.9%)
    expect(screen.getByText(/Open P&L/i)).toBeInTheDocument();
    expect(screen.getAllByText(/-\$300\.00/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\(-42\.9%\)/i)).toBeInTheDocument();
  });
});
