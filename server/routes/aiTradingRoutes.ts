import { Router, Request, Response } from 'express';
import { alpacaService } from '../services/alpacaService';
import { aiTradingGuardrails } from '../services/aiTradingGuardrails';
import { alpacaBacktestService } from '../services/alpacaBacktestService';
import { fetchTastyOrders } from '../services/tastytradeService';
import { getAllDraftOrders, executeApprovedDraft, cancelDraft } from '../services/tastytradeToolService';

export function createAiTradingRouter(): Router {
  const router = Router();

  // GET /api/ai-trading/status
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const status = await alpacaService.getStatus();
      const settings = aiTradingGuardrails.getSettings();
      res.json({
        ...status,
        masterKillSwitch: settings.masterKillSwitch,
        executionMode: settings.executionMode,
        sizingMode: settings.sizingMode,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/ai-trading/account
  router.get('/account', async (req: Request, res: Response) => {
    try {
      const account = await alpacaService.getAccount();
      res.json(account);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/ai-trading/positions
  router.get('/positions', async (req: Request, res: Response) => {
    try {
      const positions = await alpacaService.getPositions();
      res.json(positions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/ai-trading/positions/:symbol
  router.delete('/positions/:symbol', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const { qty } = req.query;
      const result = await alpacaService.closePosition(symbol, qty ? parseFloat(String(qty)) : undefined);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/ai-trading/positions/liquidate-all
  router.post('/positions/liquidate-all', async (req: Request, res: Response) => {
    try {
      const result = await alpacaService.liquidateAll();
      res.json({ success: true, message: 'All positions liquidated and open orders canceled.', result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/ai-trading/drafts - Staged Draft Orders awaiting human approval
  router.get('/drafts', (req: Request, res: Response) => {
    try {
      const broker = req.query.broker as string;
      const allDrafts = getAllDraftOrders();
      const filtered = broker
        ? allDrafts.filter((d) => (d.broker || 'tastytrade').toLowerCase() === broker.toLowerCase())
        : allDrafts;
      res.json({ drafts: filtered });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/ai-trading/drafts/:id/approve - Physical approval hard stop
  router.post('/drafts/:id/approve', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { price, quantity } = req.body || {};
      const overrides = (price !== undefined || quantity !== undefined) ? {
        price: typeof price === 'number' ? price : (price ? parseFloat(price) : undefined),
        quantity: typeof quantity === 'number' ? quantity : (quantity ? parseInt(quantity, 10) : undefined)
      } : undefined;
      const result = await executeApprovedDraft(id, overrides);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/ai-trading/drafts/:id/cancel - Discard staged draft
  router.post('/drafts/:id/cancel', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = cancelDraft(id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/ai-trading/orders - Multi-broker orders endpoint
  router.get('/orders', async (req: Request, res: Response) => {
    try {
      const broker = ((req.query.broker as string) || 'tastytrade').toLowerCase();
      const status = (req.query.status as any) || 'all';
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;

      if (broker === 'tastytrade') {
        try {
          const tastyOrders = await fetchTastyOrders(undefined, status === 'all' ? undefined : status);
          const normalized = (tastyOrders || []).map((o: any) => ({
            id: String(o.id || o['order-id']),
            broker: 'tastytrade',
            symbol: o.legs?.[0]?.symbol || o.symbol || 'N/A',
            side: (o.legs?.[0]?.action || o.action || 'BUY').toUpperCase(),
            type: o['order-type'] || o.type || 'Limit',
            price: o.price ? parseFloat(o.price) : undefined,
            qty: o.legs?.[0]?.quantity || o.quantity || 1,
            status: o.status || 'Received',
            submitted_at: o['received-at'] || o['updated-at'] || new Date().toISOString(),
            time_in_force: o['time-in-force'] || 'Day',
          }));
          return res.json(normalized);
        } catch (e: any) {
          console.warn('[AI Trading] Error fetching Tastytrade orders:', e.message);
          return res.json([]);
        }
      } else if (broker === 'ibkr') {
        // IBKR simulated / live orders
        return res.json([]);
      } else {
        // Default Alpaca
        const orders = await alpacaService.getOrders(status, limit);
        const normalized = (orders || []).map((o: any) => ({
          id: o.id,
          broker: 'alpaca',
          symbol: o.symbol,
          side: (o.side || 'BUY').toUpperCase(),
          type: o.type || o.order_type || 'Market',
          price: o.limit_price ? parseFloat(o.limit_price) : (o.filled_avg_price ? parseFloat(o.filled_avg_price) : undefined),
          qty: o.qty ? parseFloat(o.qty) : (o.filled_qty ? parseFloat(o.filled_qty) : 1),
          status: o.status,
          submitted_at: o.submitted_at || o.created_at,
          time_in_force: o.time_in_force,
        }));
        return res.json(normalized);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/ai-trading/orders (Strict User Position Sizing Enforced)
  router.post('/orders', async (req: Request, res: Response) => {
    try {
      const { symbol, side, type, time_in_force, limit_price, stop_price, requestedShares, source, strategyName } = req.body;
      if (!symbol || !side) {
        return res.status(400).json({ error: 'Symbol and side are required.' });
      }

      const orderResult = await alpacaService.submitOrder({
        symbol,
        side,
        type,
        time_in_force,
        limit_price: limit_price ? parseFloat(String(limit_price)) : undefined,
        stop_price: stop_price ? parseFloat(String(stop_price)) : undefined,
        requestedShares: requestedShares ? parseFloat(String(requestedShares)) : undefined,
        source: source || 'MANUAL',
        strategyName,
      });

      if (!orderResult.success) {
        return res.status(400).json({
          error: orderResult.error || 'Order rejected by position sizing guardrails.',
          guardrailCheck: orderResult.guardrailCheck,
        });
      }

      res.json(orderResult);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/ai-trading/orders/:orderId
  router.delete('/orders/:orderId', async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;
      const result = await alpacaService.cancelOrder(orderId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/ai-trading/settings
  router.get('/settings', (req: Request, res: Response) => {
    try {
      const settings = aiTradingGuardrails.getSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/ai-trading/settings
  router.put('/settings', (req: Request, res: Response) => {
    try {
      const updated = aiTradingGuardrails.saveSettings(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/ai-trading/backtest/run
  router.post('/backtest/run', async (req: Request, res: Response) => {
    try {
      const { symbol, timeframe, lookbackDays, strategyType, initialCapital, positionSizeDollar, parameters } = req.body;
      if (!symbol || !strategyType) {
        return res.status(400).json({ error: 'Symbol and strategyType are required.' });
      }

      const result = await alpacaBacktestService.runBacktest({
        symbol,
        timeframe: timeframe || '1Day',
        lookbackDays: lookbackDays ? parseInt(String(lookbackDays), 10) : 180,
        strategyType,
        initialCapital: initialCapital ? parseFloat(String(initialCapital)) : undefined,
        positionSizeDollar: positionSizeDollar ? parseFloat(String(positionSizeDollar)) : undefined,
        parameters,
      });

      res.json(result);
    } catch (err: any) {
      console.error('[AI Trading Backtest Error]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/ai-trading/backtest/ai-discover
  router.post('/backtest/ai-discover', async (req: Request, res: Response) => {
    try {
      const { symbol, objectivePrompt, lookbackDays, timeframe } = req.body;
      if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required for AI strategy discovery.' });
      }

      const result = await alpacaBacktestService.aiDiscoverStrategy({
        symbol,
        objectivePrompt,
        lookbackDays: lookbackDays ? parseInt(String(lookbackDays), 10) : 180,
        timeframe: timeframe || '1Day',
      });

      res.json(result);
    } catch (err: any) {
      console.error('[AI Trading Discovery Error]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/ai-trading/strategies
  router.get('/strategies', (req: Request, res: Response) => {
    try {
      const strategies = alpacaBacktestService.getDeployedStrategies();
      res.json(strategies);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/ai-trading/strategies
  router.post('/strategies', (req: Request, res: Response) => {
    try {
      const { name, symbol, strategyType, parameters, timeframe, winRateBacktest, totalReturnBacktest } = req.body;
      if (!name || !symbol || !strategyType) {
        return res.status(400).json({ error: 'Name, symbol, and strategyType are required to deploy.' });
      }

      const deployed = alpacaBacktestService.deployStrategy({
        name,
        symbol,
        strategyType,
        parameters,
        timeframe,
        winRateBacktest,
        totalReturnBacktest,
      });

      res.json(deployed);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/ai-trading/strategies/:id/toggle
  router.patch('/strategies/:id/toggle', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { active } = req.body;
      const updated = alpacaBacktestService.toggleStrategy(id, active);
      if (!updated) return res.status(404).json({ error: 'Strategy not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/ai-trading/strategies/:id
  router.delete('/strategies/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = alpacaBacktestService.deleteStrategy(id);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/ai-trading/signals
  router.get('/signals', (req: Request, res: Response) => {
    try {
      const signals = alpacaBacktestService.getPendingSignals();
      res.json(signals);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/ai-trading/signals/:id/approve (User Approval for Pending AI Signal)
  router.post('/signals/:id/approve', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const signals = alpacaBacktestService.getPendingSignals();
      const signal = signals.find((s) => s.id === id);

      if (!signal) {
        return res.status(404).json({ error: 'Pending trade signal not found or already processed.' });
      }

      // Execute order via Alpaca with user's position size
      const orderResult = await alpacaService.submitOrder({
        symbol: signal.symbol,
        side: signal.action === 'BUY' ? 'buy' : 'sell',
        type: 'market',
        requestedShares: signal.targetShares,
        source: 'AI_AGENT',
        strategyName: signal.strategyName,
      });

      if (orderResult.success) {
        signal.status = 'EXECUTED';
        alpacaBacktestService.dismissSignal(id);
      }

      res.json(orderResult);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/ai-trading/signals/:id/dismiss
  router.post('/signals/:id/dismiss', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = alpacaBacktestService.dismissSignal(id);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/ai-trading/scan
  router.post('/scan', async (req: Request, res: Response) => {
    try {
      const scanResult = await alpacaBacktestService.scanActiveStrategies();
      res.json(scanResult);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
