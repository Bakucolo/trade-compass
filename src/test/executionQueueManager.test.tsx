import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExecutionQueueManager } from '../components/management/ExecutionQueueManager';

const mockUpdatePlannedTrade = vi.fn().mockResolvedValue({});
const mockDeletePlannedTrade = vi.fn().mockResolvedValue({});
const mockCreateTrade = vi.fn().mockResolvedValue({});

// Mock the service hooks
vi.mock('@/services/plannedTradeService', () => ({
  usePlannedTrades: vi.fn(() => ({
    data: [
      {
        id: 'trade-1',
        symbol: 'NVDA',
        action: 'BUY',
        assetType: 'STOCK',
        timeframe: 'DAY',
        orderType: 'LIMIT',
        quantity: 50,
        targetPrice: 125.0,
        stopLoss: 118.0,
        targetExit: 145.0,
        conviction: 'HIGH',
        rank: 1,
        status: 'PENDING',
        notes: 'Tech bounce off key 50 EMA support',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'trade-2',
        symbol: 'AAPL',
        action: 'BTO',
        assetType: 'OPTION',
        timeframe: 'WEEK',
        orderType: 'LIMIT',
        quantity: 10,
        targetPrice: 4.5,
        stopLoss: 2.5,
        targetExit: 9.0,
        conviction: 'MEDIUM',
        rank: 2,
        status: 'PENDING',
        notes: 'Oct 240 Calls ahead of launch event',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'trade-3',
        symbol: 'TSLA',
        action: 'BUY',
        assetType: 'STOCK',
        timeframe: 'DAY',
        orderType: 'LIMIT',
        quantity: 25,
        targetPrice: 210.0,
        stopLoss: 195.0,
        targetExit: 250.0,
        conviction: 'HIGH',
        rank: 3,
        status: 'EXECUTED',
        notes: 'Filled on dip rebound',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
    refetch: vi.fn(),
  })),
  useCreatePlannedTrade: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdatePlannedTrade: vi.fn(() => ({
    mutateAsync: mockUpdatePlannedTrade,
    isPending: false,
  })),
  useDeletePlannedTrade: vi.fn(() => ({
    mutateAsync: mockDeletePlannedTrade,
    isPending: false,
  })),
  useReorderPlannedTrades: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useSendPlannedTradesPdfToTelegram: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true, messageId: 99 }),
    isPending: false,
  })),
  useProposeTradeEntry: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useTelegramStatus: vi.fn(() => ({
    data: { connected: false, enabled: false, executionThreadId: null },
    isLoading: false,
  })),
  useSyncTelegramBuffer: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateExecutionThreadId: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('@/services/tradeService', () => ({
  useCreateTrade: vi.fn(() => ({
    mutateAsync: mockCreateTrade,
    isPending: false,
  })),
}));

describe('ExecutionQueueManager Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it('renders section title, action buttons, KPI summary, and ranked trades in active queue', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ExecutionQueueManager initialView="QUEUE" />
      </QueryClientProvider>
    );

    // Section Title
    expect(screen.getByText('Daily & Weekly Trade Execution Queue')).toBeDefined();

    // Telegram PDF button & Preview button
    expect(screen.getByText('Send PDF to Telegram')).toBeDefined();
    expect(screen.getByText('Preview PDF')).toBeDefined();
    expect(screen.getByText('Plan New Trade')).toBeDefined();

    // Ranked badges for pending trades
    expect(screen.getByText('#1')).toBeDefined();
    expect(screen.getByText('#2')).toBeDefined();

    // Symbols & Actions for pending trades
    expect(screen.getAllByText('NVDA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BUY').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BTO').length).toBeGreaterThan(0);

    // Timeframes
    expect(screen.getByText('TODAY')).toBeDefined();
    expect(screen.getByText('THIS WEEK')).toBeDefined();

    // Risk:Reward & Orders
    expect(screen.getByText('50 shs @ LIMIT')).toBeDefined();
    expect(screen.getByText('10 cts @ LIMIT')).toBeDefined();

    // Submit Executed action buttons (only 2 for the 2 pending trades!)
    const executedButtons = screen.getAllByRole('button', { name: /submit executed/i });
    expect(executedButtons.length).toBe(2);

    // Set Price Alert buttons
    const alertButtons = screen.getAllByRole('button', { name: /set price alert/i });
    expect(alertButtons.length).toBe(2);
  });

  it('does NOT display executed trades in the active execution queue', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ExecutionQueueManager initialView="QUEUE" />
      </QueryClientProvider>
    );

    // TSLA is EXECUTED, so it should NOT be in the active execution queue list
    expect(screen.queryByText('TSLA')).toBeNull();
    expect(screen.queryByText('25 shs @ LIMIT')).toBeNull();

    // Only active queue trades are displayed
    expect(screen.getAllByText('NVDA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
  });

  it('displays executed trades in the dedicated Executed Trades section and allows restoring to queue', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ExecutionQueueManager initialView="EXECUTED" />
      </QueryClientProvider>
    );

    // Executed Section title & badge
    expect(screen.getByText('Executed Trades Archive & History')).toBeDefined();
    expect(screen.getByText('Completed (1)')).toBeDefined();

    // TSLA should be rendered here
    expect(screen.getByText('TSLA')).toBeDefined();
    expect(screen.getByText('Filled & Logged')).toBeDefined();

    // "Restore to Queue" button must be present
    const restoreBtn = screen.getByRole('button', { name: /restore to queue/i });
    expect(restoreBtn).toBeDefined();

    // Clicking "Restore to Queue" invokes update with status: 'PENDING'
    restoreBtn.click();
    expect(mockUpdatePlannedTrade).toHaveBeenCalledWith({
      id: 'trade-3',
      data: { status: 'PENDING' },
    });
  });

  it('marking a pending trade as executed invokes update planned trade with status EXECUTED', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ExecutionQueueManager initialView="QUEUE" />
      </QueryClientProvider>
    );

    const executedButtons = screen.getAllByRole('button', { name: /submit executed/i });
    expect(executedButtons.length).toBe(2);

    // Click submit executed on NVDA (trade-1)
    executedButtons[0].click();

    expect(mockUpdatePlannedTrade).toHaveBeenCalledWith({
      id: 'trade-1',
      data: { status: 'EXECUTED' },
    });
  });

  it('immediately deletes planned trade without window.confirm prompt', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');

    render(
      <QueryClientProvider client={queryClient}>
        <ExecutionQueueManager initialView="QUEUE" />
      </QueryClientProvider>
    );

    const deleteButtons = screen.getAllByRole('button', { name: /delete trade immediately/i });
    expect(deleteButtons.length).toBe(2);

    // Click delete on the first trade
    deleteButtons[0].click();

    // Verification: window.confirm must NEVER be invoked!
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockDeletePlannedTrade).toHaveBeenCalledWith('trade-1');
    confirmSpy.mockRestore();
  });
});
