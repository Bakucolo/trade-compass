// src/test/fullWindowOptionsTradeStation.test.tsx
// Comprehensive unit tests for FullWindowOptionsTradeStationModal and draft order creation

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FullWindowOptionsTradeStationModal } from '../components/aiTrading/FullWindowOptionsTradeStationModal';
import { createDraftOrder } from '../services/tastytrade';

// Mock recharts ResponsiveContainer to avoid size issues in jsdom
vi.mock('recharts', async () => {
  const actual: any = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div style={{ width: 400, height: 200 }}>{children}</div>,
  };
});

// Mock services
vi.mock('../services/portfolioBalanceService', () => ({
  usePortfolioBalances: () => ({
    data: {
      brokers: {
        tastytrade: {
          buyingPower: 15738.87,
          derivativeBuyingPower: 15738.87,
          cash: 15738.87,
        },
        ibkr: {
          buyingPower: 73186.14,
          availableFunds: 73186.14,
          cash: 73186.14,
        },
        trading212: {
          cash: 3200.00,
        }
      },
      total: {
        buyingPower: 90758.97,
        cash: 88925.01,
      }
    },
    refetch: vi.fn(),
    isFetching: false,
  }),
}));

vi.mock('../services/optionsChainService', () => ({
  useOptionsChain: (symbol: string, expiration?: string) => ({
    data: {
      symbol: symbol || 'AAPL',
      underlyingPrice: 338.50,
      underlyingChange: 3.20,
      underlyingChangePercent: 0.95,
      expirations: [
        { date: '2026-10-16', dte: 24, formattedDate: 'Oct 16, 2026' },
        { date: '2026-11-20', dte: 59, formattedDate: 'Nov 20, 2026' },
      ],
      strikes: [
        {
          strike: 330,
          isAtm: false,
          call: { strike: 330, bid: 11.2, ask: 11.5, delta: 0.72, impliedVolatility: 26, volume: 150 },
          put: { strike: 330, bid: 2.1, ask: 2.3, delta: -0.28, impliedVolatility: 27, volume: 80 },
        },
        {
          strike: 340,
          isAtm: true,
          call: { strike: 340, bid: 4.5, ask: 4.8, delta: 0.49, impliedVolatility: 25, volume: 420 },
          put: { strike: 340, bid: 5.2, ask: 5.5, delta: -0.51, impliedVolatility: 26, volume: 310 },
        },
        {
          strike: 350,
          isAtm: false,
          call: { strike: 350, bid: 1.4, ask: 1.6, delta: 0.25, impliedVolatility: 24, volume: 200 },
          put: { strike: 350, bid: 11.8, ask: 12.1, delta: -0.75, impliedVolatility: 28, volume: 90 },
        },
      ],
      analytics: {
        impliedVolatilityAtm: 25.4,
        expectedMoveDollars: 9.80,
        expectedMovePercent: 2.9,
      }
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../services/tastytrade', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    analyzeBuyingPower: vi.fn().mockResolvedValue({
      success: true,
      comparison: {
        symbol: 'AAPL',
        action: 'BUY_TO_OPEN',
        quantity: 1,
        price: 4.80,
        orderType: 'Limit',
        instrumentType: 'Equity Option',
        tastytrade: {
          buyingPowerRequirement: 480,
          postTradeAvailableBuyingPower: 15258.87,
          estimatedCommission: 1.00,
          remainingBufferPercentage: 96.9,
        },
        ibkr: {
          buyingPowerRequirement: 480,
          postTradeAvailableBuyingPower: 72706.14,
          estimatedCommission: 0.65,
          remainingBufferPercentage: 99.3,
        },
        verdict: {
          recommendedBroker: 'ibkr',
          capitalEfficiencyWinner: 'equal',
          feeWinner: 'ibkr',
          summary: 'IBKR is recommended due to lower commission on single-leg options.',
        }
      }
    }),
  };
});

describe('FullWindowOptionsTradeStationModal Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (props: Partial<React.ComponentProps<typeof FullWindowOptionsTradeStationModal>> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <FullWindowOptionsTradeStationModal
          open={true}
          onOpenChange={vi.fn()}
          defaultSymbol="AAPL"
          defaultBroker="tastytrade"
          {...props}
        />
      </QueryClientProvider>
    );
  };

  it('renders the Options Trade Station header and title', () => {
    renderComponent();
    expect(screen.getAllByText(/OPTIONS TRADE STATION/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/PRO TERMINAL/i)).toBeInTheDocument();
  });

  it('renders the live broker buying power ribbon', () => {
    renderComponent();
    // Tastytrade buying power: $15,738.87
    expect(screen.getByText(/\$15,738\.87/i)).toBeInTheDocument();
    // IBKR buying power: $73,186.14
    expect(screen.getByText(/\$73,186\.14/i)).toBeInTheDocument();
    // Total portfolio BP: $90,758.97
    expect(screen.getByText(/\$90,758\.97/i)).toBeInTheDocument();
  });

  it('displays strikes and allows adding a call leg to the draft', async () => {
    renderComponent();
    // Strike 340 should be visible
    expect(screen.getByText('$340.0')).toBeInTheDocument();

    // Click Ask price for 340 Call ($4.80) to add leg
    const askButton = screen.getByTitle(/Buy 340 Call @ \$4\.80/i);
    fireEvent.click(askButton);

    // Verify leg added to draft
    expect(screen.getAllByText(/BUY/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/DEBIT: \$4\.80/i)).toBeInTheDocument();
  });

  it('renders strategy presets and can load Bull Call Spread', () => {
    renderComponent();
    const presetSelect = screen.getByDisplayValue(/Load Preset Strategy\.\.\./i);
    fireEvent.change(presetSelect, { target: { value: 'BULL_CALL_SPREAD' } });

    // Should now have 2 legs in the draft
    const buyBadges = screen.getAllByText('BUY');
    const sellBadges = screen.getAllByText('SELL');
    expect(buyBadges.length).toBeGreaterThan(0);
    expect(sellBadges.length).toBeGreaterThan(0);
  });

  it('renders Risk & Payoff metrics when metrics tab is selected', () => {
    renderComponent({ defaultTab: 'metrics' });

    expect(screen.getByText(/P&L Payoff At Expiration/i)).toBeInTheDocument();
    expect(screen.getByText(/Net Greeks Exposure/i)).toBeInTheDocument();
  });
});

describe('createDraftOrder Service Function', () => {
  it('sends POST /api/ai-trading/drafts with correct payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        draft: {
          draftId: 'draft_test_123',
          symbol: 'AAPL',
          action: 'BUY_TO_OPEN',
          broker: 'tastytrade',
          status: 'PENDING_APPROVAL',
        },
      }),
    });
    global.fetch = mockFetch;

    const result = await createDraftOrder({
      symbol: 'AAPL',
      action: 'BUY_TO_OPEN',
      quantity: 1,
      price: 4.50,
      orderType: 'Limit',
      broker: 'tastytrade',
      instrumentType: 'Equity Option',
      optionDetails: {
        expirationDate: '2026-10-16',
        strikePrice: 340,
        optionType: 'Call',
      },
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/ai-trading/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"symbol":"AAPL"'),
    });
    expect(result.success).toBe(true);
    expect(result.draft.draftId).toBe('draft_test_123');
  });
});
