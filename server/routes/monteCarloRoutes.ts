import { Router, Request, Response } from 'express';
import { runMonteCarloSimulation, getCompanyBaselines } from '../services/monteCarloService';
import { generateValuationScenarios } from '../services/monteCarloAgentService';

export function createMonteCarloRouter(): Router {
  const router = Router();

  // GET /api/quant/monte-carlo/baselines/:ticker
  router.get('/baselines/:ticker', async (req: Request, res: Response) => {
    try {
      const { ticker } = req.params;
      if (!ticker) {
        return res.status(400).json({ error: 'Ticker symbol is required' });
      }

      const baselines = await getCompanyBaselines(ticker);
      res.json(baselines);
    } catch (err: any) {
      console.error(`[Monte Carlo Baselines API Error] ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/quant/monte-carlo/:ticker
  router.get('/:ticker', async (req: Request, res: Response) => {
    try {
      const { ticker } = req.params;
      const { trials, horizon, seed, noCache } = req.query;

      if (!ticker) {
        return res.status(400).json({ error: 'Ticker symbol is required' });
      }

      const result = await runMonteCarloSimulation(ticker, {
        trials: trials ? parseInt(String(trials), 10) : 10000,
        horizon: horizon ? parseInt(String(horizon), 10) : 5,
        seed: seed !== undefined ? parseInt(String(seed), 10) : undefined,
        noCache: noCache === 'true' || noCache === '1',
      });

      res.json(result);
    } catch (err: any) {
      console.error(`[Monte Carlo API Error] ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/quant/monte-carlo/simulate
  router.post('/simulate', async (req: Request, res: Response) => {
    try {
      const { ticker, trials, horizon, seed, noCache } = req.body;

      if (!ticker) {
        return res.status(400).json({ error: 'Ticker symbol is required in request body' });
      }

      const result = await runMonteCarloSimulation(ticker, {
        trials: trials ? parseInt(String(trials), 10) : 10000,
        horizon: horizon ? parseInt(String(horizon), 10) : 5,
        seed: seed !== undefined ? parseInt(String(seed), 10) : undefined,
        noCache: Boolean(noCache),
      });

      res.json(result);
    } catch (err: any) {
      console.error(`[Monte Carlo API Error] ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/quant/monte-carlo/agent-scenarios
  router.post('/agent-scenarios', async (req: Request, res: Response) => {
    try {
      const { ticker, currentPrice, horizonYears } = req.body;
      if (!ticker) {
        return res.status(400).json({ error: 'Ticker symbol is required in request body' });
      }

      const result = await generateValuationScenarios({
        ticker,
        currentPrice: currentPrice ? parseFloat(String(currentPrice)) : undefined,
        horizonYears: horizonYears ? parseInt(String(horizonYears), 10) : 5,
      });

      res.json(result);
    } catch (err: any) {
      console.error(`[Valuation Agent API Error] ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/quant/monte-carlo/agent-scenarios/:ticker
  router.get('/agent-scenarios/:ticker', async (req: Request, res: Response) => {
    try {
      const { ticker } = req.params;
      const { currentPrice, horizonYears } = req.query;
      if (!ticker) {
        return res.status(400).json({ error: 'Ticker symbol is required' });
      }

      const result = await generateValuationScenarios({
        ticker,
        currentPrice: currentPrice ? parseFloat(String(currentPrice)) : undefined,
        horizonYears: horizonYears ? parseInt(String(horizonYears), 10) : 5,
      });

      res.json(result);
    } catch (err: any) {
      console.error(`[Valuation Agent API Error] ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
