import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommodityHeatmapModal } from '../components/macro/CommodityHeatmapModal';
import { CommodityPriceItem } from '../services/commoditiesService';

const mockCommodities: CommodityPriceItem[] = [
  {
    id: 'CL',
    symbol: 'CL=F',
    name: 'WTI Light Sweet Crude Oil',
    shortName: 'WTI Crude',
    category: 'energy',
    categoryLabel: 'Energy',
    unit: '$/bbl',
    price: 71.40,
    prevClose: 70.80,
    change: 0.60,
    changePercent: 0.85,
    returns: {
      '1D': 0.85,
      '1W': -1.20,
      '1M': -3.40,
      '3M': -5.20,
      '6M': -8.60,
      'YTD': -2.10,
      '1Y': -6.80,
    },
    dayHigh: 72.10,
    dayLow: 70.50,
    fiftyTwoWeekHigh: 85.00,
    fiftyTwoWeekLow: 65.00,
    range52wPercent: 32.0,
    promptSpread: -0.45,
    curveStructure: 'BACKWARDATION',
    annualizedRollYield: 4.8,
    exchange: 'NYMEX',
    tradingViewSymbol: 'NYMEX:CL1!',
    description: 'Global benchmark for light sweet crude oil.',
  },
  {
    id: 'GC',
    symbol: 'GC=F',
    name: 'Gold Futures (100 oz)',
    shortName: 'Gold Bullion',
    category: 'precious_metals',
    categoryLabel: 'Precious Metals',
    unit: '$/troy oz',
    price: 2740.50,
    prevClose: 2728.00,
    change: 12.50,
    changePercent: 0.46,
    returns: {
      '1D': 0.46,
      '1W': 1.80,
      '1M': 4.20,
      '3M': 9.60,
      '6M': 18.40,
      'YTD': 26.80,
      '1Y': 32.50,
    },
    dayHigh: 2750.00,
    dayLow: 2725.00,
    fiftyTwoWeekHigh: 2760.00,
    fiftyTwoWeekLow: 1980.00,
    range52wPercent: 97.5,
    promptSpread: 0.50,
    curveStructure: 'CONTANGO',
    annualizedRollYield: -2.4,
    exchange: 'COMEX',
    tradingViewSymbol: 'COMEX:GC1!',
    description: 'Global monetary reserve asset.',
  },
  {
    id: 'CC',
    symbol: 'CC=F',
    name: 'Cocoa Futures',
    shortName: 'Cocoa',
    category: 'agriculture',
    categoryLabel: 'Agriculture',
    unit: '$/metric ton',
    price: 7850.00,
    prevClose: 7720.00,
    change: 130.00,
    changePercent: 1.68,
    returns: {
      '1D': 1.68,
      '1W': 4.60,
      '1M': 12.40,
      '3M': 24.80,
      '6M': 58.20,
      'YTD': 112.50,
      '1Y': 148.00,
    },
    dayHigh: 7920.00,
    dayLow: 7680.00,
    fiftyTwoWeekHigh: 8100.00,
    fiftyTwoWeekLow: 3200.00,
    range52wPercent: 94.9,
    promptSpread: -2.10,
    curveStructure: 'BACKWARDATION',
    annualizedRollYield: 8.5,
    exchange: 'ICE',
    tradingViewSymbol: 'ICEUS:CC1!',
    description: 'West African cocoa bean contract.',
  },
];

describe('CommodityHeatmapModal', () => {
  it('renders modal when isOpen is true with header and initial 1M timeframe', () => {
    render(
      <CommodityHeatmapModal
        isOpen={true}
        onClose={vi.fn()}
        commodities={mockCommodities}
      />
    );

    expect(screen.getByText(/Commodities Cross-Asset Performance Heatmap/i)).toBeInTheDocument();
    expect(screen.getByText(/1M Horizon/i)).toBeInTheDocument();
    expect(screen.getByText('WTI Crude')).toBeInTheDocument();
    expect(screen.getByText('Gold Bullion')).toBeInTheDocument();
    expect(screen.getByText('Cocoa')).toBeInTheDocument();
  });

  it('allows switching timeframes and updates return values', () => {
    render(
      <CommodityHeatmapModal
        isOpen={true}
        onClose={vi.fn()}
        commodities={mockCommodities}
      />
    );

    // Initial 1M return for Cocoa should be +12.40%
    expect(screen.getByText('+12.40%')).toBeInTheDocument();

    // Click 1Y timeframe
    const btn1Y = screen.getByRole('button', { name: /^1Y$/i });
    fireEvent.click(btn1Y);

    // After switching to 1Y, Cocoa 1Y return is +148.00%
    expect(screen.getByText(/1Y Horizon/i)).toBeInTheDocument();
    expect(screen.getByText('+148.00%')).toBeInTheDocument();

    // Gold 1Y return is +32.50%
    expect(screen.getByText('+32.50%')).toBeInTheDocument();
  });

  it('filters by commodity complex', () => {
    render(
      <CommodityHeatmapModal
        isOpen={true}
        onClose={vi.fn()}
        commodities={mockCommodities}
      />
    );

    // Click 'Energy' complex tab
    const energyTab = screen.getByRole('button', { name: /Energy/i });
    fireEvent.click(energyTab);

    expect(screen.getByText('WTI Crude')).toBeInTheDocument();
    expect(screen.queryByText('Gold Bullion')).not.toBeInTheDocument();
    expect(screen.queryByText('Cocoa')).not.toBeInTheDocument();
  });

  it('switches to Multi-Timeframe Matrix table view mode', () => {
    render(
      <CommodityHeatmapModal
        isOpen={true}
        onClose={vi.fn()}
        commodities={mockCommodities}
      />
    );

    // Click 'Matrix' view mode button
    const matrixBtn = screen.getByTitle(/Multi-Timeframe Matrix Table/i);
    fireEvent.click(matrixBtn);

    // Table headers should now be visible
    expect(screen.getByRole('columnheader', { name: /Commodity/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Spot Price/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Roll Yield/i })).toBeInTheDocument();
  });

  it('opens commodity inspection drawer on tile click and allows navigation', () => {
    const mockNavigateGraphs = vi.fn();
    const mockNavigateResearch = vi.fn();

    render(
      <CommodityHeatmapModal
        isOpen={true}
        onClose={vi.fn()}
        commodities={mockCommodities}
        onNavigateToGraphs={mockNavigateGraphs}
        onNavigateToResearch={mockNavigateResearch}
      />
    );

    // Click Gold tile
    const goldCard = screen.getByText('Gold Bullion').closest('div');
    if (goldCard) fireEvent.click(goldCard);

    // Inspector should show Gold details and buttons
    expect(screen.getByText(/Global monetary reserve asset/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Interactive Chart/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Research/i })).toBeInTheDocument();

    // Click Interactive Chart
    fireEvent.click(screen.getByRole('button', { name: /Interactive Chart/i }));
    expect(mockNavigateGraphs).toHaveBeenCalledWith('COMEX:GC1!');
  });
});
