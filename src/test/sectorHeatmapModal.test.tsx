import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectorHeatmapModal } from '../components/macro/SectorHeatmapModal';
import { SectorItem } from '../services/sectorsService';

const mockSectors: SectorItem[] = [
  {
    symbol: 'XLK',
    name: 'Technology Select Sector SPDR Fund',
    shortName: 'Technology',
    category: 'sector',
    sectorGroup: 'Technology',
    description: 'Hardware, software, semiconductors, and cloud computing infrastructure.',
    price: 228.45,
    prevClose: 225.10,
    change: 3.35,
    changePercent: 1.49,
    returns: {
      '1D': 1.49,
      '1W': 2.80,
      '1M': 5.40,
      '3M': 8.60,
      '6M': 18.20,
      'YTD': 24.50,
      '1Y': 36.80,
    },
    alphaVsSpy: {
      '1D': 0.85,
      '1W': 1.20,
      '1M': 3.10,
      '3M': 4.50,
      '6M': 8.20,
      'YTD': 11.40,
      '1Y': 14.80,
    },
    rotationStage: 'Leading',
    relativeStrengthRank: 1,
    momentumScore: 88,
    rsi14: 64,
    above50Dma: true,
    above200Dma: true,
    dma50DistancePct: 4.8,
    dma200DistancePct: 12.5,
    distance52wHighPct: -1.2,
    distance52wLowPct: 38.5,
    fiftyTwoWeekHigh: 232.0,
    fiftyTwoWeekLow: 165.0,
    topHoldings: [
      { symbol: 'AAPL', name: 'Apple Inc.', weight: 0.16 },
      { symbol: 'NVDA', name: 'NVIDIA Corp.', weight: 0.15 },
      { symbol: 'MSFT', name: 'Microsoft Corp.', weight: 0.14 },
    ],
    aiCommentary: 'Strong leadership driven by AI infrastructure capex and hyperscaler cloud growth.',
    catalysts: ['AI server shipments', 'Blackwell GPU ramp'],
  },
  {
    symbol: 'XLE',
    name: 'Energy Select Sector SPDR Fund',
    shortName: 'Energy',
    category: 'sector',
    sectorGroup: 'Energy & Resources',
    description: 'Oil, gas, and consumable fuels exploration, production, and refining.',
    price: 88.20,
    prevClose: 89.10,
    change: -0.90,
    changePercent: -1.01,
    returns: {
      '1D': -1.01,
      '1W': -2.10,
      '1M': -3.80,
      '3M': -5.40,
      '6M': -8.20,
      'YTD': -2.40,
      '1Y': -4.50,
    },
    alphaVsSpy: {
      '1D': -1.65,
      '1W': -3.70,
      '1M': -6.10,
      '3M': -9.50,
      '6M': -18.20,
      'YTD': -15.50,
      '1Y': -26.50,
    },
    rotationStage: 'Lagging',
    relativeStrengthRank: 11,
    momentumScore: 32,
    rsi14: 38,
    above50Dma: false,
    above200Dma: false,
    dma50DistancePct: -4.2,
    dma200DistancePct: -6.5,
    distance52wHighPct: -12.4,
    distance52wLowPct: 8.2,
    fiftyTwoWeekHigh: 99.5,
    fiftyTwoWeekLow: 81.5,
    topHoldings: [
      { symbol: 'XOM', name: 'Exxon Mobil Corp.', weight: 0.22 },
      { symbol: 'CVX', name: 'Chevron Corp.', weight: 0.18 },
    ],
    aiCommentary: 'Pressure from global crude supply additions and refined crack compression.',
    catalysts: ['OPEC+ quotas', 'Refining margins'],
  },
  {
    symbol: 'SMH',
    name: 'VanEck Semiconductor ETF',
    shortName: 'Semiconductors',
    category: 'industry',
    sectorGroup: 'Technology',
    description: 'Semiconductor manufacturers, foundries, and chip equipment makers.',
    price: 245.50,
    prevClose: 240.20,
    change: 5.30,
    changePercent: 2.21,
    returns: {
      '1D': 2.21,
      '1W': 4.10,
      '1M': 8.50,
      '3M': 12.80,
      '6M': 26.40,
      'YTD': 42.10,
      '1Y': 58.20,
    },
    alphaVsSpy: {
      '1D': 1.57,
      '1W': 2.50,
      '1M': 6.20,
      '3M': 8.70,
      '6M': 16.40,
      'YTD': 29.00,
      '1Y': 36.20,
    },
    rotationStage: 'Leading',
    relativeStrengthRank: 1,
    momentumScore: 94,
    rsi14: 68,
    above50Dma: true,
    above200Dma: true,
    dma50DistancePct: 7.2,
    dma200DistancePct: 18.5,
    distance52wHighPct: -0.8,
    distance52wLowPct: 62.0,
    fiftyTwoWeekHigh: 248.0,
    fiftyTwoWeekLow: 152.0,
    topHoldings: [
      { symbol: 'NVDA', name: 'NVIDIA Corp.', weight: 0.21 },
      { symbol: 'TSM', name: 'Taiwan Semiconductor', weight: 0.13 },
    ],
    aiCommentary: 'Hyperscale AI accelerator demand continuing at record levels.',
    catalysts: ['Advanced packaging', 'Foundry pricing'],
  },
];

describe('SectorHeatmapModal', () => {
  it('renders modal when isOpen is true with header and initial 1M timeframe', () => {
    render(
      <SectorHeatmapModal
        isOpen={true}
        onClose={vi.fn()}
        sectors={mockSectors}
        benchmark={{ spy: { price: 580.0, returns: { '1D': 0.64, '1W': 1.6, '1M': 2.3, '3M': 4.1, '6M': 10.0, 'YTD': 13.1, '1Y': 22.0 } } }}
      />
    );

    expect(screen.getByText(/S&P 500 Sectors & Capital Rotation Heatmap/i)).toBeInTheDocument();
    expect(screen.getByText(/1M Horizon/i)).toBeInTheDocument();
    expect(screen.getByText('XLK')).toBeInTheDocument();
    expect(screen.getByText('XLE')).toBeInTheDocument();
    expect(screen.getByText('SMH')).toBeInTheDocument();
  });

  it('allows switching between Return (%) and Alpha vs SPY metrics', () => {
    render(
      <SectorHeatmapModal
        isOpen={true}
        onClose={vi.fn()}
        sectors={mockSectors}
      />
    );

    // Initial Return mode: Tech 1M return is +5.40%
    expect(screen.getByText('+5.40%')).toBeInTheDocument();

    // Toggle to Alpha vs SPY mode
    const alphaBtn = screen.getByRole('button', { name: /Alpha vs SPY/i });
    fireEvent.click(alphaBtn);

    // In Alpha mode: Tech 1M alpha is +3.10%
    expect(screen.getByText('+3.10%')).toBeInTheDocument();
    // Energy 1M alpha is -6.10%
    expect(screen.getByText('-6.10%')).toBeInTheDocument();
  });

  it('switches timeframes dynamically and updates displayed returns', () => {
    render(
      <SectorHeatmapModal
        isOpen={true}
        onClose={vi.fn()}
        sectors={mockSectors}
      />
    );

    // Switch to 1Y timeframe
    const btn1Y = screen.getByRole('button', { name: /^1Y$/i });
    fireEvent.click(btn1Y);

    expect(screen.getByText(/1Y Horizon/i)).toBeInTheDocument();
    // SMH 1Y return is +58.20%
    expect(screen.getByText('+58.20%')).toBeInTheDocument();
  });

  it('filters by GICS Sectors vs Sub-Industries scope', () => {
    render(
      <SectorHeatmapModal
        isOpen={true}
        onClose={vi.fn()}
        sectors={mockSectors}
      />
    );

    // Filter to GICS Sectors only
    const sectorTab = screen.getByRole('button', { name: /11 GICS Sectors/i });
    fireEvent.click(sectorTab);

    expect(screen.getByText('XLK')).toBeInTheDocument();
    expect(screen.getByText('XLE')).toBeInTheDocument();
    expect(screen.queryByText('SMH')).not.toBeInTheDocument();
  });

  it('switches to Multi-Timeframe Matrix table view mode', () => {
    render(
      <SectorHeatmapModal
        isOpen={true}
        onClose={vi.fn()}
        sectors={mockSectors}
      />
    );

    const matrixBtn = screen.getByTitle(/Multi-Timeframe Matrix Table/i);
    fireEvent.click(matrixBtn);

    expect(screen.getByRole('columnheader', { name: /Sector \/ Theme/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Stage/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /RSI \(14\)/i })).toBeInTheDocument();
  });

  it('opens sector inspection drawer on tile click and triggers deep dive / navigation', () => {
    const mockDeepDive = vi.fn();
    const mockNavigateGraphs = vi.fn();

    render(
      <SectorHeatmapModal
        isOpen={true}
        onClose={vi.fn()}
        sectors={mockSectors}
        onSelectDeepDive={mockDeepDive}
        onNavigateToGraphs={mockNavigateGraphs}
      />
    );

    // Click XLK tile
    const techTile = screen.getByText('XLK').closest('div');
    if (techTile) fireEvent.click(techTile);

    // Inspector should show top holdings and actions
    expect(screen.getByText(/Hardware, software, semiconductors/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Deep Dive Analysis/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Chart$/i })).toBeInTheDocument();

    // Trigger Deep Dive
    fireEvent.click(screen.getByRole('button', { name: /Deep Dive Analysis/i }));
    expect(mockDeepDive).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'XLK' }));
  });

  it('toggles true fullscreen layout when clicking the maximize button', () => {
    render(
      <SectorHeatmapModal
        isOpen={true}
        onClose={vi.fn()}
        sectors={mockSectors}
      />
    );

    const expandBtn = screen.getByTitle('Expand to Full Window');
    expect(expandBtn).toBeInTheDocument();

    // Click maximize
    fireEvent.click(expandBtn);

    // Should now have exit fullscreen title and clear translation classes
    expect(screen.getByTitle('Exit Fullscreen')).toBeInTheDocument();
    const dialogContent = document.querySelector('[role="dialog"]');
    expect(dialogContent?.className).toContain('!translate-x-0');
    expect(dialogContent?.className).toContain('!translate-y-0');
    expect(dialogContent?.className).toContain('!top-0');
    expect(dialogContent?.className).toContain('!left-0');
  });
});
