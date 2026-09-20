import { PrismaClient } from '@prisma/client';
import { evaluateStockScorecard } from './scorecardService';
import { resolveYahooFinanceSymbol } from './tickerResolutionService';

export type WorkerStatusType = 'IDLE' | 'RUNNING' | 'PAUSED' | 'PAUSED_QUOTA_EXHAUSTED' | 'COMPLETED';

export interface ScorecardWorkerState {
  status: WorkerStatusType;
  total: number;
  current: number;
  currentSymbol: string | null;
  percent: number;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
  quotaMessage: string | null;
  pendingSymbols: string[];
  completedSymbols: string[];
  analyzedCount: number;
}

// In-memory singleton worker state
const workerState: ScorecardWorkerState = {
  status: 'IDLE',
  total: 0,
  current: 0,
  currentSymbol: null,
  percent: 0,
  startedAt: null,
  completedAt: null,
  lastError: null,
  quotaMessage: null,
  pendingSymbols: [],
  completedSymbols: [],
  analyzedCount: 0,
};

let cancelRequested = false;
let pauseRequested = false;

/**
 * Returns current worker status and progress
 */
export function getScorecardWorkerStatus(): ScorecardWorkerState {
  return { ...workerState };
}

/**
 * Checks if an error is due to rate limiting or daily quota exhaustion
 */
function isQuotaError(err: any): boolean {
  if (!err) return false;
  if (err.status === 429 || err.statusCode === 429) return true;
  const msg = (err.message || '').toLowerCase();
  if (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('credits') ||
    msg.includes('allowance') ||
    msg.includes('exhausted') ||
    msg.includes('resource_exhausted')
  ) {
    return true;
  }
  if (Array.isArray(err.attempts)) {
    return err.attempts.some(
      (a: any) => a.status === 'rate_limit_429' || a.status === 'skipped_cooldown'
    );
  }
  return false;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Start or resume sequential one-by-one scorecard evaluation
 */
export async function startScorecardWorker(
  prisma: PrismaClient,
  options: { forceRefresh?: boolean } = {}
): Promise<{ success: boolean; message: string; status: ScorecardWorkerState }> {
  if (workerState.status === 'RUNNING') {
    return {
      success: false,
      message: 'Scorecard analysis is already running in the background.',
      status: getScorecardWorkerStatus(),
    };
  }

  cancelRequested = false;
  pauseRequested = false;

  // 1. Gather active portfolio holdings and watchlists
  const holdings = await prisma.holding.findMany({
    where: {
      quantity: { not: 0 },
      assetType: { in: ['EQUITY', 'Stock', 'ETF'] },
    },
    select: { symbol: true, currency: true },
  });

  const watchlists = await prisma.watchlistItem.findMany({
    select: { symbol: true },
  });

  const rawSymbols = new Set<string>();
  holdings.forEach((h) => {
    const s = resolveYahooFinanceSymbol(h.symbol, h.currency || undefined);
    if (s && s.length > 0) rawSymbols.add(s);
  });
  watchlists.forEach((w) => {
    const s = resolveYahooFinanceSymbol(w.symbol);
    if (s && s.length > 0) rawSymbols.add(s);
  });

  const allSymbolsList = Array.from(rawSymbols);

  if (allSymbolsList.length === 0) {
    return {
      success: false,
      message: 'No open equity holdings or watchlist tickers found to evaluate.',
      status: getScorecardWorkerStatus(),
    };
  }

  // 2. Filter out already-analyzed symbols unless forceRefresh is true
  let symbolsToProcess = allSymbolsList;
  if (!options.forceRefresh) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingRecent = await prisma.stockScorecardRecord.findMany({
      where: {
        symbol: { in: allSymbolsList },
        analyzedAt: { gte: oneDayAgo },
      },
      select: { symbol: true },
    });
    const recentSet = new Set(existingRecent.map((r) => r.symbol.toUpperCase()));
    symbolsToProcess = allSymbolsList.filter((s) => !recentSet.has(s.toUpperCase()));
  }

  workerState.status = 'RUNNING';
  workerState.total = symbolsToProcess.length;
  workerState.current = 0;
  workerState.currentSymbol = null;
  workerState.percent = 0;
  workerState.startedAt = new Date().toISOString();
  workerState.completedAt = null;
  workerState.lastError = null;
  workerState.quotaMessage = null;
  workerState.pendingSymbols = [...symbolsToProcess];
  workerState.completedSymbols = [];
  workerState.analyzedCount = 0;

  if (symbolsToProcess.length === 0) {
    workerState.status = 'COMPLETED';
    workerState.completedAt = new Date().toISOString();
    workerState.percent = 100;
    return {
      success: true,
      message: 'All stocks have already been evaluated within the last 24 hours. Use force refresh to re-evaluate.',
      status: getScorecardWorkerStatus(),
    };
  }

  // Start background loop asynchronously without blocking the caller
  (async () => {
    console.log(`[ScorecardWorker] Starting sequential evaluation of ${symbolsToProcess.length} stocks.`);
    
    for (let i = 0; i < symbolsToProcess.length; i++) {
      if (cancelRequested) {
        console.log('[ScorecardWorker] Cancel requested by user.');
        workerState.status = 'IDLE';
        workerState.currentSymbol = null;
        break;
      }

      if (pauseRequested) {
        console.log('[ScorecardWorker] Pause requested by user.');
        workerState.status = 'PAUSED';
        workerState.currentSymbol = null;
        break;
      }

      const sym = symbolsToProcess[i];
      workerState.current = i + 1;
      workerState.currentSymbol = sym;
      workerState.percent = Math.round(((i + 1) / symbolsToProcess.length) * 100);

      try {
        console.log(`[ScorecardWorker] [${i + 1}/${symbolsToProcess.length}] Evaluating ${sym}...`);
        
        // Evaluate single stock by agent and save to DB
        const result = await evaluateStockScorecard(sym, undefined, undefined, prisma);
        
        if (result) {
          workerState.completedSymbols.push(sym);
          workerState.analyzedCount++;
        }

        // Remove from pending
        workerState.pendingSymbols = symbolsToProcess.slice(i + 1);

        // Respect rate limit dampening between stocks (~800ms)
        await delay(800);
      } catch (err: any) {
        console.error(`[ScorecardWorker] Error analyzing ${sym}:`, err?.message || err);
        
        if (isQuotaError(err)) {
          const quotaMsg = `OpenRouter / LLM daily allowance reached on stock ${sym}. Analysis has been safely paused. All ${workerState.analyzedCount} completed stocks are saved. You can resume tomorrow or when quota resets.`;
          console.warn(`[ScorecardWorker] QUOTA LIMIT HIT: ${quotaMsg}`);
          workerState.status = 'PAUSED_QUOTA_EXHAUSTED';
          workerState.quotaMessage = quotaMsg;
          workerState.lastError = err?.message || 'Quota limit reached';
          workerState.currentSymbol = null;
          return;
        }

        workerState.lastError = `Failed on ${sym}: ${err?.message || 'Unknown error'}`;
        // For non-quota errors on a single ticker, log and proceed to the next ticker
        await delay(500);
      }
    }

    if (workerState.status === 'RUNNING') {
      workerState.status = 'COMPLETED';
      workerState.completedAt = new Date().toISOString();
      workerState.currentSymbol = null;
      workerState.percent = 100;
      console.log(`[ScorecardWorker] Completed batch evaluation. Analyzed ${workerState.analyzedCount} stocks.`);
    }
  })().catch((err) => {
    console.error('[ScorecardWorker] Fatal queue loop error:', err);
    workerState.status = 'IDLE';
    workerState.lastError = err?.message || 'Fatal queue worker error';
  });

  return {
    success: true,
    message: `Started sequential scorecard analysis for ${symbolsToProcess.length} stocks.`,
    status: getScorecardWorkerStatus(),
  };
}

/**
 * Pause the active scorecard evaluation worker
 */
export function pauseScorecardWorker(): { success: boolean; status: ScorecardWorkerState } {
  if (workerState.status === 'RUNNING') {
    pauseRequested = true;
    workerState.status = 'PAUSED';
  }
  return { success: true, status: getScorecardWorkerStatus() };
}

/**
 * Stop / Cancel the worker completely
 */
export function stopScorecardWorker(): { success: boolean; status: ScorecardWorkerState } {
  cancelRequested = true;
  workerState.status = 'IDLE';
  workerState.currentSymbol = null;
  return { success: true, status: getScorecardWorkerStatus() };
}

/**
 * Resume paused scorecard worker
 */
export async function resumeScorecardWorker(
  prisma: PrismaClient
): Promise<{ success: boolean; message: string; status: ScorecardWorkerState }> {
  if (workerState.pendingSymbols.length === 0) {
    return startScorecardWorker(prisma, { forceRefresh: false });
  }

  cancelRequested = false;
  pauseRequested = false;
  workerState.status = 'RUNNING';
  workerState.quotaMessage = null;
  workerState.lastError = null;

  const remaining = [...workerState.pendingSymbols];
  const initialTotal = workerState.total;

  (async () => {
    console.log(`[ScorecardWorker] Resuming evaluation of remaining ${remaining.length} stocks.`);
    
    for (let i = 0; i < remaining.length; i++) {
      if (cancelRequested) {
        workerState.status = 'IDLE';
        workerState.currentSymbol = null;
        break;
      }
      if (pauseRequested) {
        workerState.status = 'PAUSED';
        workerState.currentSymbol = null;
        break;
      }

      const sym = remaining[i];
      workerState.current = initialTotal - remaining.length + i + 1;
      workerState.currentSymbol = sym;
      workerState.percent = Math.round((workerState.current / initialTotal) * 100);

      try {
        console.log(`[ScorecardWorker] Resuming [${workerState.current}/${initialTotal}] Evaluating ${sym}...`);
        const result = await evaluateStockScorecard(sym, undefined, undefined, prisma);
        if (result) {
          workerState.completedSymbols.push(sym);
          workerState.analyzedCount++;
        }

        workerState.pendingSymbols = remaining.slice(i + 1);
        await delay(800);
      } catch (err: any) {
        console.error(`[ScorecardWorker] Error during resume on ${sym}:`, err?.message || err);
        if (isQuotaError(err)) {
          const quotaMsg = `OpenRouter / LLM daily allowance reached on stock ${sym}. Analysis safely paused. Resuming tomorrow will continue remaining stocks.`;
          workerState.status = 'PAUSED_QUOTA_EXHAUSTED';
          workerState.quotaMessage = quotaMsg;
          workerState.lastError = err?.message;
          workerState.currentSymbol = null;
          return;
        }
        workerState.lastError = `Failed on ${sym}: ${err?.message}`;
        await delay(500);
      }
    }

    if (workerState.status === 'RUNNING') {
      workerState.status = 'COMPLETED';
      workerState.completedAt = new Date().toISOString();
      workerState.currentSymbol = null;
      workerState.percent = 100;
    }
  })().catch((err) => {
    console.error('[ScorecardWorker] Error in resume loop:', err);
    workerState.status = 'IDLE';
    workerState.lastError = err?.message;
  });

  return {
    success: true,
    message: `Resumed evaluation for ${remaining.length} remaining stocks.`,
    status: getScorecardWorkerStatus(),
  };
}
