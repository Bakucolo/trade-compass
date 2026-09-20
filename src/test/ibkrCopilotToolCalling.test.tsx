// src/test/ibkrCopilotToolCalling.test.tsx
// Comprehensive test suite for IBKR UI Draft Card Approval and Broker Switcher

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DraftOrderCard } from '../components/DraftOrderCard';
import { AiTradingBrokerBar } from '../components/aiTrading/AiTradingBrokerBar';
import { StagedDraftOrder } from '../services/tastytrade';
import * as tastyService from '../services/tastytrade';

describe('IBKR Copilot Tool-Calling UI & Human-in-the-Loop Trade Approval', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });
  });

  const mockIbkrDraft: StagedDraftOrder = {
    draftId: 'draft_ibkr_test_101',
    broker: 'ibkr',
    accountNumber: 'DU1234567',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    status: 'PENDING_APPROVAL',
    symbol: 'AAPL',
    action: 'BUY',
    instrumentType: 'Equity',
    quantity: 10,
    orderType: 'Limit',
    price: 220.00,
    timeInForce: 'Day',
    notes: 'User requested limit buy for 10 shares of AAPL on IBKR Paper.',
    dryRunResult: {
      buyingPowerEffect: 2200.00,
      estimatedCommission: 0.00,
      estimatedFees: 0.14,
      warnings: ['Pre-flight calculated using IBKR safety model.']
    }
  };

  it('renders IBKR DraftOrderCard with PENDING_APPROVAL status and physical "Approve Trade" button', () => {
    render(<DraftOrderCard initialDraft={mockIbkrDraft} />);

    expect(screen.getAllByText(/AAPL/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/10\s*Shares/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Awaiting Trade Approval/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve Trade/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel Draft/i })).toBeInTheDocument();
  });

  it('executes live trade ONLY when user physically clicks "Approve Trade"', async () => {
    const executeSpy = vi.spyOn(tastyService, 'approveDraftOrder').mockResolvedValueOnce({
      success: true,
      draft: {
        ...mockIbkrDraft,
        status: 'EXECUTED',
        executionResult: {
          orderId: 'IBKR_ORD_994411',
          executedAt: new Date().toISOString(),
          status: 'Submitted'
        }
      },
      orderId: 'IBKR_ORD_994411'
    });

    const onExecuted = vi.fn();
    render(<DraftOrderCard initialDraft={mockIbkrDraft} onExecuted={onExecuted} />);

    // Click Approve Trade
    const approveBtn = screen.getByRole('button', { name: /Approve Trade/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(executeSpy).toHaveBeenCalled();
      expect(onExecuted).toHaveBeenCalled();
    });
  });

  it('renders AiTradingBrokerBar with IBKR Client Portal (Paper) badge and Heartbeat pill', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AiTradingBrokerBar
          activeBroker="ibkr"
          onSelectBroker={vi.fn()}
          selectedModel="auto"
          onSelectModel={vi.fn()}
        />
      </QueryClientProvider>
    );

    // Verify broker tab badge
    expect(screen.getByText(/Client Portal \(Paper\)/i)).toBeInTheDocument();

    // Verify endpoint info
    expect(screen.getByText(/IBKR Gateway \(Paper DU1234567\)/i)).toBeInTheDocument();
    expect(screen.getByText(/localhost:5000\/v1\/api/i)).toBeInTheDocument();

    // Verify Tickle Heartbeat status pill
    expect(screen.getByText(/Tickle Heartbeat \(2m\)/i)).toBeInTheDocument();
  });
});
