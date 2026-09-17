// src/test/tastytradeCopilotToolCalling.test.tsx
// Comprehensive test suite for Tastytrade Tool Calling, Sandbox Enforcement, and Human-in-the-Loop Trade Approval

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DraftOrderCard } from '../components/DraftOrderCard';
import { StagedDraftOrder } from '../services/tastytrade';
import * as tastyService from '../services/tastytrade';
import {
  TASTYTRADE_TOOLS,
  stageDraftOrder,
  getDraftOrder,
  executeApprovedDraft,
  cancelDraft
} from '../../server/services/tastytradeToolService';
import { getTastyBaseUrl, isTastySandbox } from '../../server/services/tastytradeService';

describe('Tastytrade Tool-Calling Architecture & Security Guardrails', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Sandbox Default & Environment Enforcement', () => {
    it('defaults to Tastytrade Certification Sandbox URL', () => {
      const origUrl = process.env.TASTY_BASE_URL;
      const origToken = process.env.TASTY_REFRESH_TOKEN;
      try {
        delete process.env.TASTY_BASE_URL;
        delete process.env.TASTY_REFRESH_TOKEN;
        const baseUrl = getTastyBaseUrl();
        expect(baseUrl).toContain('cert.tastyworks.com');
        expect(isTastySandbox()).toBe(true);
      } finally {
        if (origUrl) process.env.TASTY_BASE_URL = origUrl;
        if (origToken) process.env.TASTY_REFRESH_TOKEN = origToken;
      }
    });

    it('prohibits live trade execution without Sandbox safety check', () => {
      const origUrl = process.env.TASTY_BASE_URL;
      const origToken = process.env.TASTY_REFRESH_TOKEN;
      try {
        delete process.env.TASTY_BASE_URL;
        delete process.env.TASTY_REFRESH_TOKEN;
        expect(getTastyBaseUrl()).toBe('https://api.cert.tastyworks.com');
      } finally {
        if (origUrl) process.env.TASTY_BASE_URL = origUrl;
        if (origToken) process.env.TASTY_REFRESH_TOKEN = origToken;
      }
    });
  });

  describe('2. Tool Separation (Read-Only vs Write Tools)', () => {
    it('defines distinct read-only tools that return data directly', () => {
      const toolNames = TASTYTRADE_TOOLS.map(t => t.function.name);
      expect(toolNames).toContain('get_tasty_balances');
      expect(toolNames).toContain('get_tasty_positions');
      expect(toolNames).toContain('get_market_quote');
      expect(toolNames).toContain('get_option_chain');
      expect(toolNames).toContain('get_market_metrics');
      expect(toolNames).toContain('get_tasty_orders');
    });

    it('enforces that draft_order is the ONLY write tool and live order submission is absent', () => {
      const toolNames = TASTYTRADE_TOOLS.map(t => t.function.name);
      expect(toolNames).toContain('draft_order');
      expect(toolNames).not.toContain('submit_order');
      expect(toolNames).not.toContain('execute_trade');
      expect(toolNames).not.toContain('place_live_order');
    });

    it('draft_order tool schema explicitly documents Human-in-the-Loop requirement', () => {
      const draftTool = TASTYTRADE_TOOLS.find(t => t.function.name === 'draft_order');
      expect(draftTool).toBeDefined();
      expect(draftTool?.function.description).toContain('HUMAN-IN-THE-LOOP RULE');
      expect(draftTool?.function.description).toContain('Approve Trade');
    });
  });

  describe('3. Draft Order Lifecycle & Hard-Stop Safety', () => {
    it('stages a draft order in PENDING_APPROVAL state without routing to exchange', async () => {
      const draft = await stageDraftOrder({
        symbol: 'AAPL',
        action: 'BUY',
        quantity: 10,
        orderType: 'Limit',
        price: 220.00,
        notes: 'Bullish breakout test order'
      });

      expect(draft.draftId).toBeDefined();
      expect(draft.status).toBe('PENDING_APPROVAL');
      expect(draft.symbol).toBe('AAPL');
      expect(draft.quantity).toBe(10);
      expect(draft.price).toBe(220.00);

      const retrieved = getDraftOrder(draft.draftId);
      expect(retrieved?.draftId).toBe(draft.draftId);
      expect(retrieved?.status).toBe('PENDING_APPROVAL');
    });

    it('executes an approved draft only upon explicit user trigger and transitions status to EXECUTED', async () => {
      const draft = await stageDraftOrder({
        symbol: 'MSFT',
        action: 'BUY',
        quantity: 5,
        orderType: 'Limit',
        price: 410.00
      });

      const res = await executeApprovedDraft(draft.draftId);
      expect(res.success).toBe(true);
      expect(res.orderId).toBeDefined();
      expect(res.draft.status).toBe('EXECUTED');

      // Attempting to re-execute fails
      await expect(executeApprovedDraft(draft.draftId)).rejects.toThrow(
        /cannot be executed because status is already 'EXECUTED'/
      );
    });

    it('cancelling a draft updates status to CANCELLED', async () => {
      const draft = await stageDraftOrder({
        symbol: 'NVDA',
        action: 'SELL',
        quantity: 2,
        orderType: 'Market'
      });

      const res = cancelDraft(draft.draftId);
      expect(res.success).toBe(true);
      expect(res.draft.status).toBe('CANCELLED');
    });
  });

  describe('4. Interactive UI DraftOrderCard (Physical Approval Hard Stop)', () => {
    const mockDraft: StagedDraftOrder = {
      draftId: 'draft_test_998877',
      accountNumber: '5WT67220',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString(),
      status: 'PENDING_APPROVAL',
      symbol: 'AAPL',
      action: 'BUY',
      instrumentType: 'Equity',
      quantity: 10,
      orderType: 'Limit',
      price: 225.50,
      timeInForce: 'Day',
      notes: 'Strong support bounce above 50-day EMA',
      dryRunResult: {
        buyingPowerEffect: 2255.00,
        estimatedCommission: 0.00,
        estimatedFees: 0.14
      }
    };

    it('renders draft details with Tastytrade Sandbox badge and Awaiting Approval status', () => {
      render(<DraftOrderCard initialDraft={mockDraft} />);

      expect(screen.getByText('Tastytrade Sandbox')).toBeDefined();
      expect(screen.getByText('api.cert.tastyworks.com')).toBeDefined();
      expect(screen.getByText('Awaiting Trade Approval')).toBeDefined();
      expect(screen.getByText('AAPL')).toBeDefined();
      expect(screen.getByText('10 Shares')).toBeDefined();
      expect(screen.getByText(/225.50/)).toBeDefined();
      expect(screen.getByText(/Strong support bounce above 50-day EMA/)).toBeDefined();
      expect(screen.getByRole('button', { name: /Approve Trade/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Cancel Draft/i })).toBeDefined();
    });

    it('clicking Approve Trade calls approveDraftOrder and updates UI to Executed', async () => {
      const approveSpy = vi.spyOn(tastyService, 'approveDraftOrder').mockResolvedValue({
        success: true,
        orderId: 'CERT_847291',
        draft: {
          ...mockDraft,
          status: 'EXECUTED',
          executionResult: {
            orderId: 'CERT_847291',
            executedAt: new Date().toISOString(),
            status: 'Submitted'
          }
        }
      });

      render(<DraftOrderCard initialDraft={mockDraft} />);

      const approveBtn = screen.getByRole('button', { name: /Approve Trade/i });
      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(approveSpy).toHaveBeenCalledWith('draft_test_998877');
      });

      await waitFor(() => {
        expect(screen.getByText('Executed in Sandbox')).toBeDefined();
        expect(screen.getByText(/#CERT_847291/)).toBeDefined();
      });
    });

    it('clicking Cancel Draft calls cancelDraftOrder and updates UI to Cancelled', async () => {
      const cancelSpy = vi.spyOn(tastyService, 'cancelDraftOrder').mockResolvedValue({
        success: true,
        draft: {
          ...mockDraft,
          status: 'CANCELLED'
        }
      });

      render(<DraftOrderCard initialDraft={mockDraft} />);

      const cancelBtn = screen.getByRole('button', { name: /Cancel Draft/i });
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(cancelSpy).toHaveBeenCalledWith('draft_test_998877');
      });

      await waitFor(() => {
        expect(screen.getByText('Draft Cancelled')).toBeDefined();
      });
    });

    it('allows editing limit price before clicking Approve Trade, sending price override to approveDraftOrder', async () => {
      const approveSpy = vi.spyOn(tastyService, 'approveDraftOrder').mockResolvedValue({
        success: true,
        orderId: 'CERT_847292',
        draft: {
          ...mockDraft,
          price: 230.00,
          status: 'EXECUTED',
          executionResult: {
            orderId: 'CERT_847292',
            executedAt: new Date().toISOString(),
            status: 'Submitted'
          }
        }
      });

      render(<DraftOrderCard initialDraft={mockDraft} />);

      const priceInput = screen.getByLabelText('Limit Price');
      fireEvent.change(priceInput, { target: { value: '230.00' } });

      const approveBtn = screen.getByRole('button', { name: /Approve Trade/i });
      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(approveSpy).toHaveBeenCalledWith('draft_test_998877', { price: 230, quantity: 10 });
      });
    });
  });
});
