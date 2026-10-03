import { PrismaClient } from '@prisma/client';

export interface AutoBracketResult {
  upperAlert?: any;
  lowerAlert?: any;
  upperTarget: number;
  lowerTarget: number;
  createdCount: number;
}

export interface TriggeredAlertRef {
  id?: string;
  symbol: string;
  targetPrice?: number;
  condition?: string;
  notes?: string | null;
}

/**
 * Calculates +5% (above) and -5% (below) bracket target prices.
 * - Rounds to 2 decimal places.
 * - Ensures upperTarget is strictly > currentPrice.
 * - Ensures lowerTarget is strictly < currentPrice (minimum $0.01).
 */
export function calculateBracketTargetPrices(currentPrice: number): { upperTarget: number; lowerTarget: number } {
  if (currentPrice <= 0 || isNaN(currentPrice)) {
    return { upperTarget: 0, lowerTarget: 0 };
  }

  // Precision-safe rounding using exponential notation to avoid IEEE-754 floating-point inaccuracies
  const round2 = (val: number): number => Number(Math.round(Number(`${val}e+2`)) + 'e-2');

  let upperTarget = round2(currentPrice * 1.05);
  let lowerTarget = round2(currentPrice * 0.95);

  // Safeguard: For micro-cap or penny stocks where 5% rounds to 0 cents
  if (upperTarget <= currentPrice) {
    upperTarget = round2(currentPrice + 0.01);
  }
  if (lowerTarget >= currentPrice) {
    lowerTarget = Math.max(0.01, round2(currentPrice - 0.01));
  }

  return { upperTarget, lowerTarget };
}

/**
 * Automatically creates follow-up bracket alerts: +5% (ABOVE) and -5% (BELOW)
 * whenever a price alert is triggered for a ticker.
 * Deduplicates to prevent creating duplicate active alerts if an active alert
 * with the same condition already exists within ±0.2% of the target.
 */
export async function createAutoBracketAlerts(
  prisma: PrismaClient | any,
  triggeredAlert: TriggeredAlertRef,
  currentPrice: number,
  logFn: (msg: string) => void = console.log
): Promise<AutoBracketResult> {
  const cleanSym = triggeredAlert.symbol ? triggeredAlert.symbol.trim().toUpperCase() : '';
  if (!cleanSym || currentPrice <= 0 || isNaN(currentPrice)) {
    return { upperTarget: 0, lowerTarget: 0, createdCount: 0 };
  }

  const { upperTarget, lowerTarget } = calculateBracketTargetPrices(currentPrice);
  let createdCount = 0;
  let upperAlert: any = null;
  let lowerAlert: any = null;

  try {
    // 1. Check existing active ABOVE alert around upperTarget (±0.2% tolerance window)
    const existingUp = await prisma.priceAlert.findFirst({
      where: {
        symbol: cleanSym,
        condition: 'ABOVE',
        status: 'ACTIVE',
        targetPrice: {
          gte: Number((upperTarget * 0.998).toFixed(2)),
          lte: Number((upperTarget * 1.002).toFixed(2)),
        },
      },
    });

    if (!existingUp) {
      upperAlert = await prisma.priceAlert.create({
        data: {
          symbol: cleanSym,
          targetPrice: upperTarget,
          condition: 'ABOVE',
          status: 'ACTIVE',
          notes: `[Auto-Bracket +5%] Follow-up after alert triggered at $${currentPrice.toFixed(2)}`,
        },
      });
      createdCount++;
      logFn(`[Auto-Bracket Created] Set +5% alert for ${cleanSym} at $${upperTarget.toFixed(2)} (condition: ABOVE)`);
    } else {
      logFn(`[Auto-Bracket Skipped] Active +5% alert already exists for ${cleanSym} around $${upperTarget.toFixed(2)}`);
    }

    // 2. Check existing active BELOW alert around lowerTarget (±0.2% tolerance window)
    const existingDown = await prisma.priceAlert.findFirst({
      where: {
        symbol: cleanSym,
        condition: 'BELOW',
        status: 'ACTIVE',
        targetPrice: {
          gte: Number((lowerTarget * 0.998).toFixed(2)),
          lte: Number((lowerTarget * 1.002).toFixed(2)),
        },
      },
    });

    if (!existingDown) {
      lowerAlert = await prisma.priceAlert.create({
        data: {
          symbol: cleanSym,
          targetPrice: lowerTarget,
          condition: 'BELOW',
          status: 'ACTIVE',
          notes: `[Auto-Bracket -5%] Follow-up after alert triggered at $${currentPrice.toFixed(2)}`,
        },
      });
      createdCount++;
      logFn(`[Auto-Bracket Created] Set -5% alert for ${cleanSym} at $${lowerTarget.toFixed(2)} (condition: BELOW)`);
    } else {
      logFn(`[Auto-Bracket Skipped] Active -5% alert already exists for ${cleanSym} around $${lowerTarget.toFixed(2)}`);
    }
  } catch (err: any) {
    logFn(`[Auto-Bracket Error] Failed to create follow-up alerts for ${cleanSym}: ${err?.message || err}`);
  }

  return {
    upperAlert,
    lowerAlert,
    upperTarget,
    lowerTarget,
    createdCount,
  };
}
