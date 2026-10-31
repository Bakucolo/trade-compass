import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  Sidebar, 
  DEFAULT_NAV_ITEMS, 
  reorderNavItems, 
  getInitialNavItems, 
  saveNavOrder, 
  SIDEBAR_ORDER_STORAGE_KEY 
} from '@/components/Sidebar';

// Mock child components that rely on backend/queries
vi.mock('@/services/alertService', () => ({
  useAlerts: () => ({ data: [] }),
}));
vi.mock('@/services/agentActivityService', () => ({
  useAgentActivities: () => ({ data: [] }),
}));
vi.mock('@/services/thoughtLogService', () => ({
  useThoughtLogs: () => ({ data: [] }),
  useTelegramBufferStatus: () => ({ data: null }),
}));
vi.mock('@/services/earningsService', () => ({
  useEarningsData: () => ({ data: null }),
}));
vi.mock('@/components/ThemeSwitcherButton', () => ({
  ThemeSwitcherButton: () => <div data-testid="theme-switcher" />,
}));
vi.mock('@/components/auth/UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}));

describe('Sidebar Drag and Drop Navigation Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('reorderNavItems Pure Logic', () => {
    it('moves an item downwards below a target', () => {
      // Default: Dashboard(0), Portfolio(1), AI Trading(2), Scorecards(3)...
      const reordered = reorderNavItems(DEFAULT_NAV_ITEMS, 0, 2, 'below');
      expect(reordered[0].id).toBe('portfolio');
      expect(reordered[1].id).toBe('ai-trading');
      expect(reordered[2].id).toBe('dashboard');
      expect(reordered[3].id).toBe('scorecards');
      expect(reordered.length).toBe(DEFAULT_NAV_ITEMS.length);
    });

    it('moves an item downwards above a target', () => {
      // Drag Dashboard(0) above AI Trading(2) -> should land between Portfolio and AI Trading
      const reordered = reorderNavItems(DEFAULT_NAV_ITEMS, 0, 2, 'above');
      expect(reordered[0].id).toBe('portfolio');
      expect(reordered[1].id).toBe('dashboard');
      expect(reordered[2].id).toBe('ai-trading');
    });

    it('moves an item upwards above a target', () => {
      // Drag Scorecards(3) above Portfolio(1) -> should land between Dashboard and Scorecards
      const reordered = reorderNavItems(DEFAULT_NAV_ITEMS, 3, 1, 'above');
      expect(reordered[0].id).toBe('dashboard');
      expect(reordered[1].id).toBe('scorecards');
      expect(reordered[2].id).toBe('portfolio');
    });

    it('moves an item upwards below a target', () => {
      // Drag Scorecards(3) below Portfolio(1) -> should land between Portfolio and AI Trading
      const reordered = reorderNavItems(DEFAULT_NAV_ITEMS, 3, 1, 'below');
      expect(reordered[0].id).toBe('dashboard');
      expect(reordered[1].id).toBe('portfolio');
      expect(reordered[2].id).toBe('scorecards');
    });

    it('returns original array on invalid or identical indices', () => {
      const same = reorderNavItems(DEFAULT_NAV_ITEMS, 1, 1, 'above');
      expect(same).toEqual(DEFAULT_NAV_ITEMS);

      const outOfBounds = reorderNavItems(DEFAULT_NAV_ITEMS, -1, 5, 'above');
      expect(outOfBounds).toEqual(DEFAULT_NAV_ITEMS);
    });
  });

  describe('LocalStorage Persistence', () => {
    it('loads DEFAULT_NAV_ITEMS when storage is empty', () => {
      const items = getInitialNavItems();
      expect(items.map((i) => i.id)).toEqual(DEFAULT_NAV_ITEMS.map((i) => i.id));
    });

    it('persists and restores custom order from localStorage', () => {
      const customOrder = ['watchlist', 'graphs', 'dashboard'];
      localStorage.setItem(SIDEBAR_ORDER_STORAGE_KEY, JSON.stringify(customOrder));

      const loaded = getInitialNavItems();
      expect(loaded[0].id).toBe('watchlist');
      expect(loaded[1].id).toBe('graphs');
      expect(loaded[2].id).toBe('dashboard');
      // Any missing items from default are appended so no feature is lost
      expect(loaded.length).toBe(DEFAULT_NAV_ITEMS.length);
    });

    it('falls back safely if localStorage contains corrupted JSON', () => {
      localStorage.setItem(SIDEBAR_ORDER_STORAGE_KEY, 'invalid-json{{{');
      const loaded = getInitialNavItems();
      expect(loaded).toEqual(DEFAULT_NAV_ITEMS);
    });
  });

  describe('Sidebar Component Drag & Drop Interactions', () => {
    it('renders all nav items as draggable buttons with grab cursor', () => {
      render(<Sidebar activeTab="dashboard" onTabChange={vi.fn()} />);
      
      const dashboardBtn = screen.getByRole('button', { name: /dashboard/i });
      expect(dashboardBtn.getAttribute('draggable')).toBe('true');
      expect(dashboardBtn.className).toContain('cursor-grab');
    });

    it('allows reordering with Alt+ArrowDown keyboard shortcut and persists to localStorage', () => {
      render(<Sidebar activeTab="dashboard" onTabChange={vi.fn()} />);

      const dashboardBtn = screen.getByRole('button', { name: /dashboard/i });
      
      // Move Dashboard down one position (below Portfolio)
      fireEvent.keyDown(dashboardBtn, { key: 'ArrowDown', altKey: true });

      const saved = JSON.parse(localStorage.getItem(SIDEBAR_ORDER_STORAGE_KEY) || '[]');
      expect(saved[0]).toBe('portfolio');
      expect(saved[1]).toBe('dashboard');
    });

    it('shows reset button when order is customized and resets to default on click', () => {
      const onTabChange = vi.fn();
      render(<Sidebar activeTab="dashboard" onTabChange={onTabChange} />);

      // Initially no reset button
      expect(screen.queryByLabelText(/reset sidebar menu order/i)).toBeNull();

      // Customize order by moving Dashboard down
      const dashboardBtn = screen.getByRole('button', { name: /dashboard/i });
      fireEvent.keyDown(dashboardBtn, { key: 'ArrowDown', altKey: true });

      // Reset button now appears
      const resetBtn = screen.getByLabelText(/reset sidebar menu order/i);
      expect(resetBtn).toBeDefined();

      // Click reset
      fireEvent.click(resetBtn);

      // Local storage is cleared and reset button disappears
      expect(localStorage.getItem(SIDEBAR_ORDER_STORAGE_KEY)).toBeNull();
      expect(screen.queryByLabelText(/reset sidebar menu order/i)).toBeNull();
    });

    it('handles mouse click to navigate when not dragging', () => {
      const onTabChange = vi.fn();
      render(<Sidebar activeTab="dashboard" onTabChange={onTabChange} />);

      const graphsBtn = screen.getByRole('button', { name: /graphs/i });
      fireEvent.click(graphsBtn);

      expect(onTabChange).toHaveBeenCalledWith('graphs');
    });
  });
});
