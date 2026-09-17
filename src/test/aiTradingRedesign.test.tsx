// src/test/aiTradingRedesign.test.tsx
// Comprehensive test suite for redesigned AI Trading section:
// 1. Multi-broker selection (default Tastytrade, Alpaca, IBKR)
// 2. Complete absence of account balances and positions
// 3. Fluid LLM conversational interface with broker-aware prompts
// 4. Staged drafts and orders workspace with physical Human-in-the-Loop approval

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AITradingPage } from '../components/AITradingPage';
import { AiTradingBrokerBar } from '../components/aiTrading/AiTradingBrokerBar';
import { AiTradingLlmConsole } from '../components/aiTrading/AiTradingLlmConsole';
import { AiTradingOrdersWorkspace } from '../components/aiTrading/AiTradingOrdersWorkspace';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Redesigned AI Trading Section', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch for draft and order endpoints
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/ai-trading/drafts')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            drafts: [
              {
                draftId: 'draft_test_1',
                broker: 'tastytrade',
                accountNumber: '5WT67220',
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 900000).toISOString(),
                status: 'PENDING_APPROVAL',
                symbol: 'AAPL',
                action: 'BUY',
                instrumentType: 'Equity',
                quantity: 10,
                orderType: 'Limit',
                price: 220.0,
                timeInForce: 'Day',
                notes: 'User requested Limit BUY order for 10 shares of AAPL.',
                dryRunResult: {
                  buyingPowerEffect: 2200.0,
                  estimatedCommission: 0.0,
                  estimatedFees: 0.14,
                },
              },
            ],
          }),
        });
      }

      if (url.includes('/api/ai-trading/orders')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 'ord_123',
              broker: 'tastytrade',
              symbol: 'SPY',
              side: 'BUY',
              type: 'Limit',
              price: 550.0,
              qty: 5,
              status: 'Received',
              submitted_at: new Date().toISOString(),
              time_in_force: 'Day',
            },
          ],
        });
      }

      if (url.includes('/api/agent/hybrid-query')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            response: 'I have staged your limit buy order for 10 shares of AAPL at $220.00.',
            tools_used: ['draft_order'],
            draftOrder: {
              draftId: 'draft_aapl_new',
              broker: 'tastytrade',
              accountNumber: '5WT67220',
              status: 'PENDING_APPROVAL',
              symbol: 'AAPL',
              action: 'BUY',
              instrumentType: 'Equity',
              quantity: 10,
              orderType: 'Limit',
              price: 220.0,
              timeInForce: 'Day',
            },
            execution_time_seconds: 0.45,
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  it('1. Starts with Tastytrade by default and allows switching between Alpaca and Interactive Brokers', () => {
    render(<AITradingPage />, { wrapper: createWrapper() });

    // Header title and active broker
    expect(screen.getAllByText(/AI Trading Terminal/i).length).toBeGreaterThan(0);

    // Verify all three brokers are present in the selector
    const tastyBtn = screen.getByRole('button', { name: /^Tastytrade/i });
    const alpacaBtn = screen.getByRole('button', { name: /^Alpaca Markets/i });
    const ibkrBtn = screen.getByRole('button', { name: /^Interactive Brokers/i });

    expect(tastyBtn).toBeDefined();
    expect(alpacaBtn).toBeDefined();
    expect(ibkrBtn).toBeDefined();

    // Verify Tastytrade is the default active broker
    expect(screen.getByText(/Certification Sandbox/i)).toBeDefined();
    expect(screen.getByText(/TASTYTRADE AI Terminal/i)).toBeDefined();

    // Switch to Alpaca
    fireEvent.click(alpacaBtn);
    expect(screen.getByText(/ALPACA AI Terminal/i)).toBeDefined();
    expect(screen.getByText(/Paper Trading API/i)).toBeDefined();

    // Switch to Interactive Brokers
    fireEvent.click(ibkrBtn);
    expect(screen.getByText(/IBKR AI Terminal/i)).toBeDefined();
    expect(screen.getByText(/TWS \/ Gateway Socket/i)).toBeDefined();
  });

  it('2. Strictly hides any account balances, buying power, portfolio values, or positions', () => {
    render(<AITradingPage />, { wrapper: createWrapper() });

    // Assert that standard balance metrics are NOT present on the screen
    expect(screen.queryByText(/Buying Power/i)).toBeNull();
    expect(screen.queryByText(/Net Liquidating Value/i)).toBeNull();
    expect(screen.queryByText(/Cash Balance/i)).toBeNull();
    expect(screen.queryByText(/Day P&L/i)).toBeNull();
    expect(screen.queryByText(/Unrealized P&L/i)).toBeNull();
    expect(screen.queryByText(/Total Equity/i)).toBeNull();
    expect(screen.queryByText(/Open Positions/i)).toBeNull();
    expect(screen.queryByText(/Portfolio Positions/i)).toBeNull();
  });

  it('3. Renders broker-aware quick prompt suggestions in the LLM Console', () => {
    render(<AITradingPage />, { wrapper: createWrapper() });

    // Tastytrade suggestions by default
    expect(screen.getAllByText(/Draft AAPL Limit Buy/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SPY Options Chain/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/NVDA Quote & Metrics/i).length).toBeGreaterThan(0);

    // Switch to Alpaca
    const alpacaBtn = screen.getByRole('button', { name: /Alpaca Markets/i });
    fireEvent.click(alpacaBtn);

    // Alpaca suggestions appear
    expect(screen.getAllByText(/Draft TSLA Market Buy/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/MSFT Live Quote/i).length).toBeGreaterThan(0);
  });

  it('4. Communicates with LLM to draft orders and enforces physical Human-in-the-Loop approval', async () => {
    render(<AITradingPage />, { wrapper: createWrapper() });

    // Click quick prompt to draft an order
    const draftPromptBtn = screen.getAllByText(/Draft AAPL Limit Buy/i)[0];
    fireEvent.click(draftPromptBtn);

    // Wait for LLM response
    await waitFor(() => {
      expect(screen.getByText(/I have staged your limit buy order/i)).toBeDefined();
    });

    // Verify Human-in-the-loop hard stop is enforced: "Approve Trade" button must be rendered
    const approveButtons = screen.getAllByRole('button', { name: /Approve Trade/i });
    expect(approveButtons.length).toBeGreaterThan(0);

    // Verify draft details: AAPL, 10 shares, Limit $220
    expect(screen.getAllByText(/AAPL/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/220/i).length).toBeGreaterThan(0);
  });

  it('5. Renders Orders Workspace with status filter tabs and live order details without balances', async () => {
    render(
      <AiTradingOrdersWorkspace activeBroker="tastytrade" />,
      { wrapper: createWrapper() }
    );

    // Filter tabs exist
    expect(screen.getByRole('button', { name: /All/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Pending Drafts/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Live \/ Open/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Filled/i })).toBeDefined();

    // Wait for fetched orders to display
    await waitFor(() => {
      expect(screen.getByText('SPY')).toBeDefined();
    });

    // Zero balance verification in workspace
    expect(screen.queryByText(/Cash Balance/i)).toBeNull();
    expect(screen.queryByText(/Buying Power/i)).toBeNull();
  });
});
