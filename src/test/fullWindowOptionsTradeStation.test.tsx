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
        { date: '2026-10-16', dte: 24, formattedDate: 'Oct 16, 2026', type: 'MONTHLY' as const },
        { date: '2026-10-23', dte: 31, formattedDate: 'Oct 23, 2026', type: 'WEEKLY' as const },
        { date: '2026-11-20', dte: 59, formattedDate: 'Nov 20, 2026', type: 'MONTHLY' as const },
      ],
      strikes: [
        {
          strike: 320,
          isAtm: false,
          call: { strike: 320, bid: 19.5, ask: 19.8, delta: 0.88, impliedVolatility: 27, volume: 110, inTheMoney: true },
          put: { strike: 320, bid: 0.8, ask: 0.9, delta: -0.12, impliedVolatility: 28, volume: 50, inTheMoney: false },
        },
        {
          strike: 330,
          isAtm: false,
          call: { strike: 330, bid: 11.2, ask: 11.5, delta: 0.72, impliedVolatility: 26, volume: 150, inTheMoney: true },
          put: { strike: 330, bid: 2.1, ask: 2.3, delta: -0.28, impliedVolatility: 27, volume: 80, inTheMoney: false },
        },
        {
          strike: 340,
          isAtm: true,
          call: { strike: 340, bid: 4.5, ask: 4.8, delta: 0.49, impliedVolatility: 25, volume: 420, inTheMoney: false },
          put: { strike: 340, bid: 5.2, ask: 5.5, delta: -0.51, impliedVolatility: 26, volume: 310, inTheMoney: true },
        },
        {
          strike: 350,
          isAtm: false,
          call: { strike: 350, bid: 1.4, ask: 1.6, delta: 0.25, impliedVolatility: 24, volume: 200, inTheMoney: false },
          put: { strike: 350, bid: 11.8, ask: 12.1, delta: -0.75, impliedVolatility: 28, volume: 90, inTheMoney: true },
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
    localStorage.clear();
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
    // Total options BP: strictly the sum of the 2 brokers ($15,738.87 + $73,186.14 = $88,925.01)
    expect(screen.getByText(/\$88,925\.01/i)).toBeInTheDocument();
  });

  it('displays weekly (W) and monthly (M) expiration badges in cycle bubbles', () => {
    renderComponent();
    // Expiration date bubbles
    expect(screen.getByText('Oct 16, 2026')).toBeInTheDocument();
    expect(screen.getByText('Oct 23, 2026')).toBeInTheDocument();

    // Oct 23 is a weekly expiration -> should render W badge
    expect(screen.getByText('W')).toBeInTheDocument();
    // Oct 16 is a monthly expiration -> should render M badge
    expect(screen.getAllByText('M').length).toBeGreaterThan(0);
  });

  it('renders the 1 Standard Deviation expected move stats and indicator lines', () => {
    renderComponent();
    // Header Expected Move pill
    expect(screen.getByText(/IVx: 25\.4%/i)).toBeInTheDocument();
    expect(screen.getAllByText(/±\$9\.80/i).length).toBeGreaterThan(0);

    // Spot Price line: Spot is 338.50
    const spotLine = screen.getByTestId('spot-price-line');
    expect(spotLine).toBeInTheDocument();
    expect(spotLine).toHaveTextContent(/SPOT PRICE: \$338\.50/i);

    // -1σ Expected Move Line: 338.50 - 9.80 = 328.70
    const lowerLine = screen.getByTestId('expected-move-lower-line');
    expect(lowerLine).toBeInTheDocument();
    expect(lowerLine).toHaveTextContent(/\-1σ Expected Move/i);
    expect(lowerLine).toHaveTextContent(/\$328\.70/i);

    // +1σ Expected Move Line: 338.50 + 9.80 = 348.30
    const upperLine = screen.getByTestId('expected-move-upper-line');
    expect(upperLine).toBeInTheDocument();
    expect(upperLine).toHaveTextContent(/\+1σ Expected Move/i);
    expect(upperLine).toHaveTextContent(/\$348\.30/i);
  });

  it('renders the 2 Standard Deviation expected move lines and probability badges', () => {
    renderComponent();
    // Header Expected Move pill with 2σ stats
    expect(screen.getByText(/2σ: ±\$19\.60/i)).toBeInTheDocument();

    // -2σ Expected Move Line: 338.50 - (2 * 9.80) = 318.90
    const lower2SdLine = screen.getByTestId('expected-move-lower-2sd-line');
    expect(lower2SdLine).toBeInTheDocument();
    expect(lower2SdLine).toHaveTextContent(/\-2σ Expected Move/i);
    expect(lower2SdLine).toHaveTextContent(/\$318\.90/i);
    expect(lower2SdLine).toHaveTextContent(/\-\$19\.60/i);
    expect(lower2SdLine).toHaveTextContent(/95\.4%/i);

    // +2σ Expected Move Line: 338.50 + (2 * 9.80) = 358.10
    const upper2SdLine = screen.getByTestId('expected-move-upper-2sd-line');
    expect(upper2SdLine).toBeInTheDocument();
    expect(upper2SdLine).toHaveTextContent(/\+2σ Expected Move/i);
    expect(upper2SdLine).toHaveTextContent(/\$358\.10/i);
    expect(upper2SdLine).toHaveTextContent(/\+\$19\.60/i);
    expect(upper2SdLine).toHaveTextContent(/95\.4%/i);
  });

  it('shades ITM Calls and ITM Puts distinctly from OTM options', () => {
    renderComponent();
    // Calls with strike <= 338.50 (320, 330) are ITM -> itm-call-cell
    const itmCallCells = screen.getAllByTestId('itm-call-cell');
    expect(itmCallCells.length).toBeGreaterThanOrEqual(2);
    // ITM calls have slate shaded background
    expect(itmCallCells[0].className).toContain('bg-slate-800/65');

    // Calls with strike > 338.50 (340, 350) are OTM -> otm-call-cell
    const otmCallCells = screen.getAllByTestId('otm-call-cell');
    expect(otmCallCells.length).toBeGreaterThanOrEqual(2);
    expect(otmCallCells[0].className).toContain('bg-slate-950/40');

    // Puts with strike >= 338.50 (340, 350) are ITM -> itm-put-cell
    const itmPutCells = screen.getAllByTestId('itm-put-cell');
    expect(itmPutCells.length).toBeGreaterThanOrEqual(2);
    expect(itmPutCells[0].className).toContain('bg-slate-800/65');

    // Puts with strike < 338.50 (320, 330) are OTM -> otm-put-cell
    const otmPutCells = screen.getAllByTestId('otm-put-cell');
    expect(otmPutCells.length).toBeGreaterThanOrEqual(2);
    expect(otmPutCells[0].className).toContain('bg-slate-950/40');
  });

  it('displays strikes and allows adding a call leg to the draft defaulted to Mid price', async () => {
    renderComponent();
    // Strike 340 should be visible
    expect(screen.getByText('$340.0')).toBeInTheDocument();

    // Click Ask price for 340 Call ($4.80) to add leg
    const askButton = screen.getByTitle(/Buy 340 Call @ \$4\.80/i);
    fireEvent.click(askButton);

    // Verify leg added to draft with limit price set to Mid (Bid 4.50 + Ask 4.80) / 2 = $4.65
    expect(screen.getAllByText(/BUY/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/DEBIT: \$4\.65/i)).toBeInTheDocument();
  });

  it('automatically sets limit price to the mid price when clicking on bid or ask prices in the chain', () => {
    renderComponent();
    // Strike 320 Call: Bid 19.50, Ask 19.80 -> Mid = 19.65
    // Click Bid to Sell
    const sellBtn = screen.getByTitle(/Sell 320 Call @ \$19\.50/i);
    fireEvent.click(sellBtn);

    // Limit price should be automatically set to Mid ($19.65 Credit)
    expect(screen.getByText(/CREDIT: \$19\.65/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Reset limit price to Bid\/Ask Midpoint/i)).toBeInTheDocument();
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

  it('toggles edge-to-edge fullscreen mode when fullscreen button is clicked', () => {
    renderComponent();

    const fullscreenBtn = screen.getByTitle('Enter Edge-to-Edge Fullscreen');
    expect(fullscreenBtn).toBeInTheDocument();

    // Click to enter edge-to-edge fullscreen
    fireEvent.click(fullscreenBtn);
    expect(screen.getByTitle('Exit Fullscreen')).toBeInTheDocument();

    // Click again to restore window size
    fireEvent.click(screen.getByTitle('Exit Fullscreen'));
    expect(screen.getByTitle('Enter Edge-to-Edge Fullscreen')).toBeInTheDocument();
  });

  it('allows full sizing the options chain to view it better and restoring standard view', () => {
    renderComponent();

    // Initially in standard split workspace
    expect(screen.getByTestId('station-workspace-split')).toBeInTheDocument();
    expect(screen.queryByTestId('station-workspace-full-chain')).not.toBeInTheDocument();

    // Find and click Full Size Chain button in window header controls
    const fullSizeBtn = screen.getByTestId('full-size-chain-btn');
    expect(fullSizeBtn).toBeInTheDocument();
    fireEvent.click(fullSizeBtn);

    // Workspace is now full-chain mode
    expect(screen.getByTestId('station-workspace-full-chain')).toBeInTheDocument();
    expect(screen.queryByTestId('station-workspace-split')).not.toBeInTheDocument();
    // Side panels (Strategy Builder and tabs) are hidden to maximize the option chain view
    expect(screen.queryByText(/Load Preset Strategy\.\.\./i)).not.toBeInTheDocument();

    // An active indicator banner with restore button is present
    const exitBadgeBtn = screen.getByTestId('exit-full-chain-btn');
    expect(exitBadgeBtn).toBeInTheDocument();

    // Clicking restore returns to split view
    fireEvent.click(exitBadgeBtn);
    expect(screen.getByTestId('station-workspace-split')).toBeInTheDocument();
    expect(screen.queryByTestId('station-workspace-full-chain')).not.toBeInTheDocument();
    expect(screen.getByText(/Load Preset Strategy\.\.\./i)).toBeInTheDocument();

    // Also works via the Option Chain ribbon full-size button
    const ribbonFullSizeBtn = screen.getByTestId('chain-ribbon-fullsize-btn');
    expect(ribbonFullSizeBtn).toBeInTheDocument();
    fireEvent.click(ribbonFullSizeBtn);
    expect(screen.getByTestId('station-workspace-full-chain')).toBeInTheDocument();

    // Clicking ribbon full-size button again restores view
    fireEvent.click(screen.getByTestId('chain-ribbon-fullsize-btn'));
    expect(screen.getByTestId('station-workspace-split')).toBeInTheDocument();
  });

  it('allows toggling layout to have options chain on top and strategy builder below like the tastytrade app', () => {
    localStorage.clear();
    renderComponent();

    // Starts in split 3-col layout
    expect(screen.getByTestId('station-workspace-split')).toBeInTheDocument();

    // Click layout toggle button
    const layoutToggleBtn = screen.getByTestId('station-layout-toggle-btn');
    expect(layoutToggleBtn).toHaveTextContent(/Tastytrade View/i);
    fireEvent.click(layoutToggleBtn);

    // Now in Tastytrade layout
    const tastyWorkspace = screen.getByTestId('station-workspace-tastytrade');
    expect(tastyWorkspace).toBeInTheDocument();
    expect(screen.queryByTestId('station-workspace-split')).not.toBeInTheDocument();

    // Both option chain matrix and strategy builder are present in the tastytrade stacked layout
    expect(screen.getByText('Oct 16, 2026')).toBeInTheDocument();
    expect(screen.getByText(/Load Preset Strategy\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/Broker BP Compare/i)).toBeInTheDocument();

    // Button label now indicates 3-Col View
    expect(layoutToggleBtn).toHaveTextContent(/3-Col View/i);

    // Persisted to localStorage
    expect(localStorage.getItem('options_station_layout')).toBe('tastytrade');

    // Clicking Option Chain ribbon layout button switches back to split
    const ribbonLayoutBtn = screen.getByTestId('chain-ribbon-layout-toggle-btn');
    fireEvent.click(ribbonLayoutBtn);

    expect(screen.getByTestId('station-workspace-split')).toBeInTheDocument();
    expect(screen.queryByTestId('station-workspace-tastytrade')).not.toBeInTheDocument();
    expect(localStorage.getItem('options_station_layout')).toBe('split');
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
