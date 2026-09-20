import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PositionFolderDropdown } from '../components/portfolio/PositionFolderDropdown';
import { PositionFolderManagerModal } from '../components/portfolio/PositionFolderManagerModal';
import { HoldingsTable } from '../components/portfolio/HoldingsTable';
import { PositionFolder } from '../services/positionFolderService';
import { UnifiedPosition } from '../components/portfolio/types';
import * as positionFolderService from '../services/positionFolderService';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithClient(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

const mockFolders: PositionFolder[] = [
  {
    id: 'f-core-1',
    name: 'Core Longs',
    color: 'emerald',
    icon: 'Briefcase',
    description: 'Foundational compounders',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assignments: [
      {
        id: 'a-1',
        folderId: 'f-core-1',
        positionKey: 'pos-aapl',
        symbol: 'AAPL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    positionCount: 1,
  },
  {
    id: 'f-hedges-2',
    name: 'Hedges & Defense',
    color: 'rose',
    icon: 'Shield',
    description: 'Tail risk hedges',
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assignments: [],
    positionCount: 0,
  },
];

describe('Position Folder Components', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('PositionFolderDropdown', () => {
    it('renders "+ Folder" when position is not assigned to any folder', () => {
      renderWithClient(
        <PositionFolderDropdown
          positionKey="pos-msft"
          symbol="MSFT"
          currentFolder={null}
          folders={mockFolders}
        />
      );

      expect(screen.getByText('Folder')).toBeDefined();
    });

    it('renders folder badge with folder name when assigned to a folder', () => {
      renderWithClient(
        <PositionFolderDropdown
          positionKey="pos-aapl"
          symbol="AAPL"
          currentFolder={mockFolders[0]}
          folders={mockFolders}
        />
      );

      expect(screen.getByText('Core Longs')).toBeDefined();
    });
  });

  describe('PositionFolderManagerModal', () => {
    it('renders folder list and allows switching to new folder form', () => {
      vi.spyOn(positionFolderService, 'usePositionFolders').mockReturnValue({
        data: mockFolders,
        isLoading: false,
      } as any);

      renderWithClient(
        <PositionFolderManagerModal
          isOpen={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText('Portfolio Position Folders')).toBeDefined();
      expect(screen.getByText('Core Longs')).toBeDefined();
      expect(screen.getByText('Hedges & Defense')).toBeDefined();

      // Click "New Folder" button
      const newFolderBtn = screen.getByRole('button', { name: /New Folder/i });
      fireEvent.click(newFolderBtn);

      // Verify form elements appear
      expect(screen.getByText(/Folder Name/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/e\.g\. Core Compounders/i)).toBeDefined();
      expect(screen.getByText(/Theme Color/i)).toBeDefined();
      expect(screen.getByText(/Folder Icon/i)).toBeDefined();
    });
  });

  describe('HoldingsTable in FOLDERS Layout Mode', () => {
    const mockPositions: UnifiedPosition[] = [
      {
        id: 'pos-aapl',
        symbol: 'AAPL',
        quantity: 50,
        averageCost: 200,
        currentPrice: 220,
        marketValue: 11000,
        dayChange: 150,
        dayChangePercent: 1.38,
        unrealizedPL: 1000,
        unrealizedPLPercent: 10.0,
        source: 'IBKR',
        assetType: 'Stock',
        currency: 'USD',
        investmentStyle: 'Growth',
      },
      {
        id: 'pos-spy-put',
        symbol: 'SPY   261218P00500000',
        quantity: -2,
        averageCost: 10,
        currentPrice: 8,
        marketValue: -1600,
        dayChange: -50,
        dayChangePercent: -3.0,
        unrealizedPL: 400,
        unrealizedPLPercent: 20.0,
        source: 'Tastytrade',
        assetType: 'Option',
        strike: 500,
        optionType: 'Put',
        expiry: '20261218',
        underlyingSymbol: 'SPY',
        underlyingPrice: 560,
        currency: 'USD',
        investmentStyle: 'Defensive',
      },
    ];

    it('renders the Folders layout tab and displays folder groups & unfiled positions', () => {
      // Mock usePositionFolderMap to map AAPL to Core Longs, leaving SPY Put unfiled
      vi.spyOn(positionFolderService, 'usePositionFolderMap').mockReturnValue({
        folders: mockFolders,
        folderById: { 'f-core-1': mockFolders[0], 'f-hedges-2': mockFolders[1] },
        assignmentByPositionKey: {
          'pos-aapl': mockFolders[0],
          'AAPL': mockFolders[0],
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      renderWithClient(
        <HoldingsTable
          positions={mockPositions}
          isLoading={false}
        />
      );

      // Verify layout tabs exist
      const foldersTab = screen.getByRole('button', { name: /Folders \(/i });
      expect(foldersTab).toBeDefined();

      // Switch to Folders view
      fireEvent.click(foldersTab);

      // Verify Folders Banner
      expect(screen.getByText('Position Folders & Strategy Sleeves')).toBeDefined();

      // Verify Folder Header and Holdings count
      expect(screen.getByRole('heading', { name: 'Core Longs' })).toBeDefined();
      expect(screen.getByText('1 Holding')).toBeDefined();

      // Verify Unfiled Positions section exists for the unfiled SPY Put
      expect(screen.getByRole('heading', { name: 'Unfiled Positions' })).toBeDefined();
      expect(screen.getByText('1 Unfiled')).toBeDefined();
    });

    it('filters positions when clicking folder filter buttons', () => {
      vi.spyOn(positionFolderService, 'usePositionFolderMap').mockReturnValue({
        folders: mockFolders,
        folderById: { 'f-core-1': mockFolders[0], 'f-hedges-2': mockFolders[1] },
        assignmentByPositionKey: {
          'pos-aapl': mockFolders[0],
          'AAPL': mockFolders[0],
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

      renderWithClient(
        <HoldingsTable
          positions={mockPositions}
          isLoading={false}
        />
      );

      // Click "Unfiled" folder filter button
      const unfiledFilterBtn = screen.getByRole('button', { name: /Unfiled \(1\)/i });
      fireEvent.click(unfiledFilterBtn);

      // Only the unfiled SPY position should remain, AAPL should be filtered out
      expect(screen.queryByText('AAPL')).toBeNull();
    });
  });
});
