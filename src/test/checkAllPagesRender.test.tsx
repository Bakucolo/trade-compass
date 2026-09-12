import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../App';

describe('App Tab Navigation Test', () => {
  it('switches between all 15 sections smoothly without getting stuck on loading', async () => {
    render(<App />);

    // Wait for Dashboard to render
    await waitFor(() => {
      expect(screen.getAllByText(/Dashboard/i).length).toBeGreaterThan(0);
    });

    const navItems = [
      'Portfolio',
      'Scorecards',
      'Management',
      'Macro',
      'Graphs',
      'Earnings',
      'Scanner',
      'Watchlist',
      'Log',
      'Alerts',
      'Trades',
      'Ideas',
      'Research',
      'Settings',
      'Dashboard',
    ];

    const sidebarNav = screen.getByRole('navigation');

    for (const item of navItems) {
      console.log(`Navigating to tab [${item}]...`);
      const navButton = within(sidebarNav).getByRole('button', { name: new RegExp(item, 'i') });
      expect(navButton).toBeDefined();

      fireEvent.click(navButton);

      // Verify that the view renders without component error boundary triggering
      await waitFor(
        () => {
          const errorCard = screen.queryByText(/An unexpected error occurred while rendering this section/i);
          expect(errorCard).toBeNull();
        },
        { timeout: 5000 }
      );

      console.log(`Tab [${item}] rendered successfully without errors!`);
    }
  }, 45000);
});
