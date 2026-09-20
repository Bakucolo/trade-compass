// src/test/ibkrClientPortalService.test.ts
// Comprehensive test suite for IBKR Client Portal Gateway, Tickle Daemon, and Human-in-the-Loop Architecture

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getIbkrConfig,
  startIbkrTickleDaemon,
  stopIbkrTickleDaemon,
  getIbkrSessionStatus,
  tickleIbkrGateway,
  fetchIbkrAccounts,
  fetchIbkrAccountSummary,
  fetchIbkrPositions,
  fetchIbkrMarketSnapshot,
  fetchIbkrOrders,
  submitIbkrLiveOrder
} from '../../server/services/ibkrService';
import {
  IBKR_TOOLS,
  stageDraftOrder,
  getDraftOrder,
  executeApprovedDraft,
  cancelDraft,
  executeReadOnlyTool
} from '../../server/services/tastytradeToolService';

describe('Interactive Brokers (IBKR) Client Portal Gateway Architecture', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    stopIbkrTickleDaemon();
  });

  describe('1. Paper Trading Default & Configuration', () => {
    it('defaults to IBKR Paper Trading account and Client Portal Gateway URL', () => {
      const config = getIbkrConfig();
      expect(config.gatewayUrl).toBe('https://localhost:5000/v1/api');
      expect(config.paperAccountId).toBe('DU1234567');
      expect(config.env).toBe('paper');
      expect(config.heartbeatIntervalMs).toBe(120000);
    });

    it('session status accurately reports paper environment and heartbeat cadence', () => {
      const status = getIbkrSessionStatus();
      expect(status.environment).toBe('paper');
      expect(status.paperAccountId).toBe('DU1234567');
      expect(status.tickleIntervalMs).toBe(120000);
    });
  });

  describe('2. The Tickle Daemon (Session Heartbeat)', () => {
    it('starts and stops the tickle daemon without leaking intervals', () => {
      expect(getIbkrSessionStatus().heartbeatActive).toBe(false);

      startIbkrTickleDaemon();
      expect(getIbkrSessionStatus().heartbeatActive).toBe(true);

      // Calling start again is idempotent
      startIbkrTickleDaemon();
      expect(getIbkrSessionStatus().heartbeatActive).toBe(true);

      stopIbkrTickleDaemon();
      expect(getIbkrSessionStatus().heartbeatActive).toBe(false);
    });

    it('tickleIbkrGateway sends POST /tickle and safely falls back without throwing when gateway is offline', async () => {
      const result = await tickleIbkrGateway();
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.session).toBeDefined();

      const status = getIbkrSessionStatus();
      expect(status.lastTickleTimestamp).toBeDefined();
    });
  });

  describe('3. Separation of Read vs. Write Tools', () => {
    it('contains all designated read-only tools in IBKR_TOOLS schema catalog', () => {
      const toolNames = IBKR_TOOLS.map((t: any) => t.function.name);
      expect(toolNames).toContain('get_ibkr_accounts');
      expect(toolNames).toContain('get_ibkr_summary');
      expect(toolNames).toContain('get_ibkr_positions');
      expect(toolNames).toContain('get_ibkr_market_snapshot');
      expect(toolNames).toContain('get_ibkr_orders');
    });

    it('prohibits direct trade execution tools in IBKR_TOOLS catalog', () => {
      const toolNames = IBKR_TOOLS.map((t: any) => t.function.name);
      expect(toolNames).not.toContain('submit_order');
      expect(toolNames).not.toContain('execute_trade');
      expect(toolNames).not.toContain('place_live_order');
      expect(toolNames).not.toContain('send_order');
    });

    it('draft_order is the only write tool and enforces the Human-in-the-Loop rule in its description', () => {
      const draftTool = IBKR_TOOLS.find((t: any) => t.function.name === 'draft_order');
      expect(draftTool).toBeDefined();
      expect(draftTool?.function.description).toContain('HUMAN-IN-THE-LOOP RULE');
      expect(draftTool?.function.description).toContain('Approve Trade');
      expect(draftTool?.function.description).toContain('/iserver/account/{accountId}/orders');
    });

    it('executes read-only tools automatically returning data to LLM context', async () => {
      const accountsRes = await executeReadOnlyTool('get_ibkr_accounts', {});
      expect(accountsRes.broker).toContain('Interactive Brokers');
      expect(accountsRes.accounts).toBeInstanceOf(Array);

      const summaryRes = await executeReadOnlyTool('get_ibkr_summary', { accountId: 'DU1234567' });
      expect(summaryRes.accountId).toBe('DU1234567');
      expect(summaryRes.netLiquidationValue).toBeGreaterThan(0);
      expect(summaryRes.buyingPower).toBeGreaterThan(0);

      const positionsRes = await executeReadOnlyTool('get_ibkr_positions', { accountId: 'DU1234567' });
      expect(positionsRes.positions).toBeInstanceOf(Array);

      const ordersRes = await executeReadOnlyTool('get_ibkr_orders', {});
      expect(ordersRes.orders).toBeInstanceOf(Array);
    });
  });

  describe('4. Human-in-the-Loop Rule & Draft Order Staging', () => {
    it('stages an IBKR draft order in PENDING_APPROVAL state with paper account default', async () => {
      const draft = await stageDraftOrder({
        symbol: 'AAPL',
        action: 'BUY',
        broker: 'ibkr',
        quantity: 10,
        orderType: 'Limit',
        price: 220.00,
        notes: 'IBKR Paper limit order test'
      });

      expect(draft.draftId).toBeDefined();
      expect(draft.broker).toBe('ibkr');
      expect(draft.accountNumber).toBe('DU1234567');
      expect(draft.status).toBe('PENDING_APPROVAL');
      expect(draft.symbol).toBe('AAPL');
      expect(draft.quantity).toBe(10);
      expect(draft.price).toBe(220.00);

      const stored = getDraftOrder(draft.draftId);
      expect(stored?.draftId).toBe(draft.draftId);
      expect(stored?.status).toBe('PENDING_APPROVAL');
    });

    it('requires physical execution of approved draft before submitting to gateway', async () => {
      const draft = await stageDraftOrder({
        symbol: 'NVDA',
        action: 'BUY',
        broker: 'ibkr',
        quantity: 5,
        orderType: 'Limit',
        price: 118.50
      });

      expect(draft.status).toBe('PENDING_APPROVAL');

      // Execute via human physical approval trigger
      const result = await executeApprovedDraft(draft.draftId);
      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();
      expect(result.draft.status).toBe('EXECUTED');

      // Attempting to re-execute fails
      await expect(executeApprovedDraft(draft.draftId)).rejects.toThrow(
        /cannot be executed because status is already 'EXECUTED'/
      );
    });

    it('allows user price and quantity overrides upon physical approval', async () => {
      const draft = await stageDraftOrder({
        symbol: 'MSFT',
        action: 'BUY',
        broker: 'ibkr',
        quantity: 10,
        orderType: 'Limit',
        price: 400.00
      });

      // User modifies price to $405.00 and quantity to 15 in the UI before clicking Approve
      const result = await executeApprovedDraft(draft.draftId, { price: 405.00, quantity: 15 });
      expect(result.success).toBe(true);
      expect(result.draft.price).toBe(405.00);
      expect(result.draft.quantity).toBe(15);
    });

    it('allows user to cancel/discard a staged draft', async () => {
      const draft = await stageDraftOrder({
        symbol: 'AMD',
        action: 'BUY',
        broker: 'ibkr',
        quantity: 20,
        orderType: 'Limit',
        price: 140.00
      });

      const cancelRes = cancelDraft(draft.draftId);
      expect(cancelRes.success).toBe(true);
      expect(cancelRes.draft.status).toBe('CANCELLED');

      // Cannot execute a cancelled draft
      await expect(executeApprovedDraft(draft.draftId)).rejects.toThrow(
        /cannot be executed because status is already 'CANCELLED'/
      );
    });
  });

  describe('5. Live Order Submission & Warning Confirmation Handling', () => {
    it('handles live order submission and returns simulated or gateway confirmation', async () => {
      const res = await submitIbkrLiveOrder('DU1234567', {
        symbol: 'AAPL',
        side: 'BUY',
        orderType: 'LMT',
        price: 220.00,
        quantity: 10,
        tif: 'DAY',
        secType: 'STK',
        cOID: 'test_coid_123'
      });

      expect(res.success).toBe(true);
      expect(res.orderId).toBeDefined();
      expect(res.orderStatus).toBeDefined();
      expect(res.submittedAt).toBeDefined();
    });
  });
});
