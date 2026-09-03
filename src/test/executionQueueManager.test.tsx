import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExecutionQueueManager } from '../components/management/ExecutionQueueManager';

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
    ],
    isLoading: false,
    refetch: vi.fn(),
  })),
  useCreatePlannedTrade: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdatePlannedTrade: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDeletePlannedTrade: vi.fn(() => ({
    mutateAsync: vi.fn(),
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
}));

describe('ExecutionQueueManager Component', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  it('renders section title, action buttons, KPI summary, and ranked trades', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ExecutionQueueManager />
      </QueryClientProvider>
    );

    // Section Title
    expect(screen.getByText('Daily & Weekly Trade Execution Queue')).toBeDefined();

    // Telegram PDF button & Preview button
    expect(screen.getByText('Send PDF to Telegram')).toBeDefined();
    expect(screen.getByText('Preview PDF')).toBeDefined();
    expect(screen.getByText('Plan New Trade')).toBeDefined();

    // Ranked badges
    expect(screen.getByText('#1')).toBeDefined();
    expect(screen.getByText('#2')).toBeDefined();

    // Symbols & Actions
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

    // Submit Executed action buttons
    const executedButtons = screen.getAllByRole('button', { name: /submit executed/i });
    expect(executedButtons.length).toBe(2);

    // Set Price Alert buttons
    const alertButtons = screen.getAllByRole('button', { name: /set price alert/i });
    expect(alertButtons.length).toBe(2);
  });

  it('immediately deletes planned trade without window.confirm prompt', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');

    render(
      <QueryClientProvider client={queryClient}>
        <ExecutionQueueManager />
      </QueryClientProvider>
    );

    const deleteButtons = screen.getAllByRole('button', { name: /delete trade immediately/i });
    expect(deleteButtons.length).toBe(2);

    // Click delete on the first trade
    deleteButtons[0].click();

    // Verification: window.confirm must NEVER be invoked!
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
