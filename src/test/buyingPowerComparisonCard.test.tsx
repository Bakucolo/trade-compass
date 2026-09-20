// src/test/buyingPowerComparisonCard.test.tsx
// Test suite for BuyingPowerComparisonCard UI and DraftOrderCard embedded analyzer

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BuyingPowerComparisonCard } from '../components/aiTrading/BuyingPowerComparisonCard';
import { DraftOrderCard } from '../components/DraftOrderCard';
import { BuyingPowerComparisonResult, StagedDraftOrder } from '../services/tastytrade';
import * as tastyService from '../services/tastytrade';

describe('BuyingPowerComparisonCard UI Component', () => {
  const mockComparison: BuyingPowerComparisonResult = {
    symbol: 'AAPL',
    action: 'BUY',
    quantity: 50,
    price: 200.0,
    orderType: 'Limit',
    instrumentType: 'Equity',
    tastytrade: {
      broker: 'tastytrade',
      accountNumber: '5WT67220',
      currency: 'USD',
      totalAvailableBuyingPower: 25000.0,
      buyingPowerRequirement: 5000.0,
      initialMarginRequirement: 5000.0,
      maintenanceMarginRequirement: 2500.0,
      estimatedCommission: 0.0,
      estimatedRegulatoryFees: 0.14,
      totalCashOutlay: 5000.14,
      postTradeAvailableBuyingPower: 19999.86,
      remainingBufferPercentage: 80.0,
      isFeasible: true,
      warnings: ['Reg-T margin applied: 50% initial requirement for equity long.']
    },
    ibkr: {
      broker: 'ibkr',
      accountNumber: 'DU1234567',
      currency: 'USD',
      totalAvailableBuyingPower: 1000000.0,
      buyingPowerRequirement: 5000.0,
      initialMarginRequirement: 5000.0,
      maintenanceMarginRequirement: 2500.0,
      estimatedCommission: 1.0,
      estimatedRegulatoryFees: 0.14,
      totalCashOutlay: 5001.14,
      postTradeAvailableBuyingPower: 994998.86,
      remainingBufferPercentage: 99.5,
      isFeasible: true,
      warnings: ['IBKR fixed equity commission: minimum $1.00 per trade ($0.005/share).']
    },
    verdict: {
      recommendedBroker: 'tastytrade',
      capitalEfficiencyWinner: 'equal',
      feeWinner: 'tastytrade',
      buyingPowerDifference: 0,
      feeDifference: -1.0,
      summary: 'Tastytrade is recommended because it offers $0 commission on equities, saving $1.00 compared to IBKR ($1.00 minimum).',
      rationale: [
        'Both brokers require equal initial margin of $5,000.00 (50% Reg-T requirement).',
        'Tastytrade charges $0.00 commission on stocks, whereas IBKR charges $1.00 ($0.005/share min $1.00).',
        'Interactive Brokers provides larger headroom buffer (99.5% vs 80.0%).'
      ]
    },
    calculatedAt: new Date().toISOString()
  };

  const mockDraft: StagedDraftOrder = {
    draftId: 'draft_test_bp_card_1',
    broker: 'tastytrade',
    accountNumber: '5WT67220',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    status: 'PENDING_APPROVAL',
    symbol: 'AAPL',
    action: 'BUY',
    instrumentType: 'Equity',
    quantity: 50,
    orderType: 'Limit',
    price: 200.0,
    timeInForce: 'Day',
    notes: 'Thesis: AAPL bullish breakout',
    buyingPowerComparison: mockComparison,
    dryRunResult: {
      estimatedMarginRequirement: 5000.0,
      buyingPowerEffect: 5000.0,
      estimatedCommission: 0.0,
      estimatedFees: 0.14
    }
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders side-by-side comparison tiles for Tastytrade and IBKR', () => {
    render(<BuyingPowerComparisonCard comparison={mockComparison} />);

    expect(screen.getByText(/Buying Power & Margin Analyser/i)).toBeInTheDocument();
    expect(screen.getByText(/Tastytrade Recommended/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Tastytrade/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Interactive Brokers/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$5,000\.00/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/80\.0%/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/99\.5%/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Fee Winner:/i)).toBeInTheDocument();
  });

  it('shows active indicator for current broker and enables one-click routing to IBKR', async () => {
    const onBrokerSwitched = vi.fn();
    const switchSpy = vi.spyOn(tastyService, 'switchDraftBroker').mockResolvedValueOnce({
      success: true,
      draft: {
        ...mockDraft,
        broker: 'ibkr',
        accountNumber: 'DU1234567'
      }
    });

    render(
      <BuyingPowerComparisonCard
        draft={mockDraft}
        comparison={mockComparison}
        onBrokerSwitched={onBrokerSwitched}
      />
    );

    // Tastytrade column should display "Active Route"
    expect(screen.getByRole('button', { name: /Active Route/i })).toBeInTheDocument();

    // IBKR column should display "Route via IBKR"
    const routeIbkrBtn = screen.getByRole('button', { name: /Route via IBKR/i });
    expect(routeIbkrBtn).toBeInTheDocument();

    fireEvent.click(routeIbkrBtn);

    await waitFor(() => {
      expect(switchSpy).toHaveBeenCalledWith('draft_test_bp_card_1', 'ibkr');
      expect(onBrokerSwitched).toHaveBeenCalled();
    });
  });

  it('embeds Buying Power Analyser in DraftOrderCard with expandable toggle', () => {
    render(<DraftOrderCard initialDraft={mockDraft} />);

    // DraftOrderCard should render the Buying Power Analyser toggle
    const toggleButton = screen.getByText(/Buying Power Analyser \(Tastytrade vs\. IBKR\)/i);
    expect(toggleButton).toBeInTheDocument();

    // Comparison is visible by default
    expect(screen.getByText(/Tastytrade Recommended/i)).toBeInTheDocument();

    // Toggle collapses and expands the drawer
    fireEvent.click(toggleButton);
    expect(screen.queryByText(/Tastytrade Recommended/i)).not.toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByText(/Tastytrade Recommended/i)).toBeInTheDocument();
  });
});
