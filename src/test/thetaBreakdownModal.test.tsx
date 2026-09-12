import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThetaBreakdownModal } from '../components/dashboard/ThetaBreakdownModal';

describe('ThetaBreakdownModal', () => {
  const samplePositions = [
    {
      id: 'opt-nvda-short',
      symbol: 'NVDA  260918C00140000',
      quantity: -2,
      averageCost: 4.5,
      currentPrice: 3.2,
      marketValue: -640,
      assetType: 'Option',
      strike: 140,
      optionType: 'Call',
      expiry: '20260918',
      underlyingSymbol: 'NVDA',
      underlyingPrice: 138,
      broker: 'Tastytrade',
      theta: -0.15, // -$0.15/sh -> short (-2) = +$30/day
    },
    {
      id: 'opt-spy-long',
      symbol: 'SPY   260920P00540000',
      quantity: 1,
      averageCost: 6.0,
      currentPrice: 5.0,
      marketValue: 500,
      assetType: 'Option',
      strike: 540,
      optionType: 'Put',
      expiry: '20260920',
      underlyingSymbol: 'SPY',
      underlyingPrice: 550,
      broker: 'IBKR',
      theta: -0.20, // -$0.20/sh -> long (+1) = -$20/day
    },
    {
      id: 'eq-aapl',
      symbol: 'AAPL',
      quantity: 100,
      assetType: 'Equity',
      currentPrice: 220,
    },
  ];

  it('renders correctly when open with calculated portfolio theta summary', () => {
    render(
      <ThetaBreakdownModal
        isOpen={true}
        onClose={vi.fn()}
        positions={samplePositions}
        netLiq={100000}
      />
    );

    expect(screen.getByText('Portfolio Theta (Θ) Breakdown')).toBeDefined();
    // Net theta: +$30 (NVDA) - $20 (SPY) = +$10.00/day
    expect(screen.getByText(/\+\$10\.00\/day/)).toBeDefined();
    expect(screen.getByText('NVDA')).toBeDefined();
    expect(screen.getByText('SPY')).toBeDefined();
    // Equity AAPL should not be listed as an option
    expect(screen.queryByText('AAPL')).toBeNull();
  });

  it('filters positions by Short (Income) category', () => {
    render(
      <ThetaBreakdownModal
        isOpen={true}
        onClose={vi.fn()}
        positions={samplePositions}
        netLiq={100000}
      />
    );

    const shortBtn = screen.getByRole('button', { name: /Short \(Income\)/i });
    fireEvent.click(shortBtn);

    expect(screen.getByText('NVDA')).toBeDefined();
    expect(screen.queryByText('SPY')).toBeNull();
  });

  it('filters positions by Long (Decay) category', () => {
    render(
      <ThetaBreakdownModal
        isOpen={true}
        onClose={vi.fn()}
        positions={samplePositions}
        netLiq={100000}
      />
    );

    const longBtn = screen.getByRole('button', { name: /Long \(Decay\)/i });
    fireEvent.click(longBtn);

    expect(screen.getByText('SPY')).toBeDefined();
    expect(screen.queryByText('NVDA')).toBeNull();
  });

  it('filters positions by search input', () => {
    render(
      <ThetaBreakdownModal
        isOpen={true}
        onClose={vi.fn()}
        positions={samplePositions}
        netLiq={100000}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search ticker, contract/i);
    fireEvent.change(searchInput, { target: { value: 'NVDA' } });

    expect(screen.getByText('NVDA')).toBeDefined();
    expect(screen.queryByText('SPY')).toBeNull();
  });

  it('triggers onNavigateToResearch when clicking Research button', () => {
    const onNavigateToResearch = vi.fn();
    render(
      <ThetaBreakdownModal
        isOpen={true}
        onClose={vi.fn()}
        positions={samplePositions}
        netLiq={100000}
        onNavigateToResearch={onNavigateToResearch}
      />
    );

    const researchBtns = screen.getAllByRole('button', { name: /Research/i });
    fireEvent.click(researchBtns[0]);

    expect(onNavigateToResearch).toHaveBeenCalled();
  });

  it('triggers onOpenAdvisorForPosition when clicking Defense button', () => {
    const onOpenAdvisorForPosition = vi.fn();
    render(
      <ThetaBreakdownModal
        isOpen={true}
        onClose={vi.fn()}
        positions={samplePositions}
        netLiq={100000}
        onOpenAdvisorForPosition={onOpenAdvisorForPosition}
      />
    );

    const defenseBtns = screen.getAllByRole('button', { name: /Defense/i });
    fireEvent.click(defenseBtns[0]);

    expect(onOpenAdvisorForPosition).toHaveBeenCalled();
  });

  it('renders helpful empty state when no option positions exist', () => {
    render(
      <ThetaBreakdownModal
        isOpen={true}
        onClose={vi.fn()}
        positions={[{ symbol: 'MSFT', quantity: 10, assetType: 'Equity' }]}
        netLiq={100000}
      />
    );

    expect(screen.getByText('No Option Positions in Portfolio')).toBeDefined();
  });
});
