import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ShortOptionAlertHistoryRecord {
  key: string;
  underlyingSymbol: string;
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  expiryDate?: string;
  pct: 5 | 10;
  provisionedAt: string;
  dismissedAt?: string | null;
}

export interface ShortOptionAlertHistoryData {
  records: Record<string, ShortOptionAlertHistoryRecord>;
}

const DEFAULT_HISTORY_FILE_PATH = path.resolve(__dirname, '..', 'short_option_alerts_history.json');
let customHistoryFilePath: string | null = null;

export function setShortOptionAlertHistoryFilePath(customPath: string | null): void {
  customHistoryFilePath = customPath;
}

export function getShortOptionAlertHistoryFilePath(): string {
  return customHistoryFilePath || DEFAULT_HISTORY_FILE_PATH;
}

export function getContractDefenseKey(
  underlyingSymbol: string,
  strikePrice: number,
  optionType: string,
  expiryDate: string | undefined | null,
  pct: 5 | 10
): string {
  const sym = (underlyingSymbol || '').trim().toUpperCase();
  const opt = (optionType || '').trim().toUpperCase();
  const exp = (expiryDate || '').trim();
  return `${sym}_${strikePrice}_${opt}_${exp || 'PERP'}_${pct}`;
}

export function loadShortOptionAlertHistory(): Record<string, ShortOptionAlertHistoryRecord> {
  try {
    const filePath = getShortOptionAlertHistoryFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed.records || {};
    }
  } catch (err) {
    console.error('Failed to load short option alert history:', err);
  }
  return {};
}

export function saveShortOptionAlertHistory(records: Record<string, ShortOptionAlertHistoryRecord>): void {
  try {
    const filePath = getShortOptionAlertHistoryFilePath();
    const data: ShortOptionAlertHistoryData = { records };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save short option alert history:', err);
  }
}

export function recordShortOptionAlertProvisioned(
  underlyingSymbol: string,
  strikePrice: number,
  optionType: 'CALL' | 'PUT',
  expiryDate: string | undefined | null,
  pct: 5 | 10
): void {
  const key = getContractDefenseKey(underlyingSymbol, strikePrice, optionType, expiryDate, pct);
  const records = loadShortOptionAlertHistory();
  records[key] = {
    key,
    underlyingSymbol: underlyingSymbol.toUpperCase(),
    strikePrice,
    optionType,
    expiryDate: expiryDate || undefined,
    pct,
    provisionedAt: records[key]?.provisionedAt || new Date().toISOString(),
    dismissedAt: null,
  };
  saveShortOptionAlertHistory(records);
}

export function recordShortOptionAlertDismissedByKey(key: string): void {
  const records = loadShortOptionAlertHistory();
  if (records[key]) {
    records[key].dismissedAt = new Date().toISOString();
  } else {
    records[key] = {
      key,
      underlyingSymbol: '',
      strikePrice: 0,
      optionType: 'PUT',
      pct: key.endsWith('_5') ? 5 : 10,
      provisionedAt: new Date().toISOString(),
      dismissedAt: new Date().toISOString(),
    };
  }
  saveShortOptionAlertHistory(records);
}

export function extractShortOptionKeyFromNote(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(/\[Short Option (5|10)% Defense\]\s+([A-Z0-9.\-]+)\s+\$([0-9.]+)\s+(CALL|PUT)(?:\s+\(([^)]+)\))?/i);
  if (!match) return null;
  const pct = parseInt(match[1], 10) as 5 | 10;
  const underlying = match[2];
  const strike = parseFloat(match[3]);
  const optType = match[4].toUpperCase();
  const expiry = match[5] || '';
  return getContractDefenseKey(underlying, strike, optType, expiry, pct);
}

export async function seedShortOptionAlertHistoryFromDb(prisma: PrismaClient): Promise<void> {
  try {
    const existingAlerts = await prisma.priceAlert.findMany({
      where: {
        notes: {
          contains: 'Short Option'
        }
      }
    });

    const records = loadShortOptionAlertHistory();
    let modified = false;

    for (const alert of existingAlerts) {
      const key = extractShortOptionKeyFromNote(alert.notes);
      if (key && !records[key]) {
        records[key] = {
          key,
          underlyingSymbol: alert.symbol,
          strikePrice: 0,
          optionType: 'PUT',
          pct: key.endsWith('_5') ? 5 : 10,
          provisionedAt: alert.createdAt ? alert.createdAt.toISOString() : new Date().toISOString(),
          dismissedAt: alert.isMuted ? (alert.mutedAt ? alert.mutedAt.toISOString() : new Date().toISOString()) : null,
        };
        modified = true;
      }
    }

    if (modified) {
      saveShortOptionAlertHistory(records);
    }
  } catch (err) {
    console.error('Failed to seed short option alert history from DB:', err);
  }
}

export interface ShortOptionDefenseLevels {
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  warning10Pct: {
    targetPrice: number;
    condition: 'ABOVE' | 'BELOW';
    description: string;
    bufferPct: number;
  };
  critical5Pct: {
    targetPrice: number;
    condition: 'ABOVE' | 'BELOW';
    description: string;
    bufferPct: number;
  };
}

export interface ShortOptionHoldingInfo {
  holdingId: string;
  symbol: string;
  underlyingSymbol: string;
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  expiryDate?: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  brokerName?: string;
  defenseLevels: ShortOptionDefenseLevels;
}

export interface ShortOptionAlertStatusItem extends ShortOptionHoldingInfo {
  underlyingCurrentPrice?: number | null;
  underlyingDistanceTo10Pct?: number | null;
  underlyingDistanceTo5Pct?: number | null;
  alert10Pct?: {
    id: string;
    status: 'ACTIVE' | 'TRIGGERED' | 'CANCELLED';
    targetPrice: number;
    condition: 'ABOVE' | 'BELOW';
    triggeredAt?: string | null;
    isMuted?: boolean;
  } | null;
  alert5Pct?: {
    id: string;
    status: 'ACTIVE' | 'TRIGGERED' | 'CANCELLED';
    targetPrice: number;
    condition: 'ABOVE' | 'BELOW';
    triggeredAt?: string | null;
    isMuted?: boolean;
  } | null;
}

export interface SyncShortOptionAlertsResult {
  success: boolean;
  totalShortOptions: number;
  existingAlertsCount: number;
  createdAlertsCount: number;
  createdAlerts: Array<{
    id: string;
    symbol: string;
    targetPrice: number;
    condition: string;
    notes: string | null;
  }>;
}

/**
 * Calculate the exact 5% and 10% proximity strike defense trigger levels
 *
 * For Short Put:
 * - Seller loses if underlying drops towards strike K.
 * - 10% warning trigger: underlying drops to K * 1.10 (Condition: BELOW)
 * - 5% critical trigger: underlying drops to K * 1.05 (Condition: BELOW)
 *
 * For Short Call:
 * - Seller loses if underlying rises towards strike K.
 * - 10% warning trigger: underlying rises to K * 0.90 (Condition: ABOVE)
 * - 5% critical trigger: underlying rises to K * 0.95 (Condition: ABOVE)
 */
export function calculateShortOptionDefenseLevels(
  strikePrice: number,
  rawOptionType: string
): ShortOptionDefenseLevels {
  const normType = String(rawOptionType || '').toUpperCase();
  const isCall = normType === 'CALL' || normType === 'C';
  const optionType: 'CALL' | 'PUT' = isCall ? 'CALL' : 'PUT';

  let warningTarget: number;
  let criticalTarget: number;
  let condition: 'ABOVE' | 'BELOW';

  if (isCall) {
    // Call: triggers when price moves UP towards strike
    warningTarget = Math.round(strikePrice * 0.90 * 100) / 100;
    criticalTarget = Math.round(strikePrice * 0.95 * 100) / 100;
    condition = 'ABOVE';
  } else {
    // Put: triggers when price moves DOWN towards strike
    warningTarget = Math.round(strikePrice * 1.10 * 100) / 100;
    criticalTarget = Math.round(strikePrice * 1.05 * 100) / 100;
    condition = 'BELOW';
  }

  return {
    strikePrice,
    optionType,
    warning10Pct: {
      targetPrice: warningTarget,
      condition,
      description: isCall
        ? `Underlying rises to within 10% of $${strikePrice.toFixed(2)} Short Call strike`
        : `Underlying drops to within 10% of $${strikePrice.toFixed(2)} Short Put strike`,
      bufferPct: 10
    },
    critical5Pct: {
      targetPrice: criticalTarget,
      condition,
      description: isCall
        ? `CRITICAL: Underlying rises to within 5% of $${strikePrice.toFixed(2)} Short Call strike`
        : `CRITICAL: Underlying drops to within 5% of $${strikePrice.toFixed(2)} Short Put strike`,
      bufferPct: 5
    }
  };
}

/**
 * Parse standard OCC Option Symbol (e.g. "NVDA  260821P00120000" or "AAPL260918C00240000")
 */
export function parseOccSymbol(rawSymbol: string): {
  underlying: string;
  expiryDate?: string;
  optionType?: 'CALL' | 'PUT';
  strikePrice?: number;
} {
  const match = rawSymbol.match(/^([A-Z\s]{1,6})\s*(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/i);
  if (!match) {
    const spaceSplit = rawSymbol.trim().split(/\s+/);
    return { underlying: spaceSplit[0] || rawSymbol };
  }

  const underlying = match[1].trim();
  const year = '20' + match[2];
  const month = match[3];
  const day = match[4];
  const typeCode = match[5].toUpperCase();
  const rawStrike = parseInt(match[6], 10);

  return {
    underlying,
    expiryDate: `${year}-${month}-${day}`,
    optionType: typeCode === 'C' ? 'CALL' : 'PUT',
    strikePrice: rawStrike / 1000
  };
}

/**
 * Extract normalized option parameters from a Holding record
 */
export function extractShortOptionDetails(
  holding: any,
  options: { ignoreExpired?: boolean } = {}
): {
  underlyingSymbol: string;
  strikePrice: number;
  optionType: 'CALL' | 'PUT';
  expiryDate?: string;
} | null {
  if (holding.assetType !== 'OPTION' || holding.quantity >= 0) {
    return null;
  }

  let underlying = (holding.underlyingSymbol || '').trim().toUpperCase();
  let strike = holding.strikePrice ? Number(holding.strikePrice) : 0;
  let optType: 'CALL' | 'PUT' | undefined = undefined;

  if (holding.optionType) {
    const raw = String(holding.optionType).toUpperCase();
    if (raw === 'CALL' || raw === 'C') optType = 'CALL';
    if (raw === 'PUT' || raw === 'P') optType = 'PUT';
  }

  let expiry = holding.expiryDate;

  // Try parsing from symbol / description / brokerSpecificId if missing
  if (!underlying || !strike || !optType) {
    const candidates = [holding.symbol, holding.brokerSpecificId, holding.description].filter(Boolean);
    for (const cand of candidates) {
      const parsed = parseOccSymbol(cand);
      if (!underlying && parsed.underlying) underlying = parsed.underlying.toUpperCase();
      if (!strike && parsed.strikePrice) strike = parsed.strikePrice;
      if (!optType && parsed.optionType) optType = parsed.optionType;
      if (!expiry && parsed.expiryDate) expiry = parsed.expiryDate;
    }
  }

  // Fallback ticker cleanup (e.g. from "AAPL 260821P240")
  if (!underlying) {
    const spaceMatch = holding.symbol.trim().match(/^[A-Z0-9.\-]+/i);
    underlying = spaceMatch ? spaceMatch[0].toUpperCase() : holding.symbol.toUpperCase();
  }

  if (!strike || !optType || !underlying) {
    return null;
  }

  // Check if already expired in the past when ignoreExpired is true
  if (options.ignoreExpired && expiry) {
    let expDate: Date;
    if (/^\d{8}$/.test(expiry)) {
      const y = expiry.substring(0, 4);
      const m = expiry.substring(4, 6);
      const d = expiry.substring(6, 8);
      expDate = new Date(Number(y), Number(m) - 1, Number(d));
    } else {
      expDate = new Date(expiry);
    }
    if (!isNaN(expDate.getTime())) {
      const today = new Date();
      const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const expNoTime = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
      if (expNoTime.getTime() < todayNoTime.getTime()) {
        return null; // Already expired in the past
      }
    }
  }

  return {
    underlyingSymbol: underlying,
    strikePrice: strike,
    optionType: optType,
    expiryDate: expiry
  };
}

/**
 * Sync 5% and 10% proximity alerts for all short options in the portfolio
 */
export async function syncShortOptionAlerts(
  prisma: PrismaClient,
  logToFile: (msg: string) => void = console.log
): Promise<SyncShortOptionAlertsResult> {
  try {
    // 1. Fetch all short option holdings
    const holdings = await prisma.holding.findMany({
      where: {
        assetType: 'OPTION',
        quantity: { lt: 0 }
      },
      include: { broker: true }
    });

    if (holdings.length === 0) {
      return {
        success: true,
        totalShortOptions: 0,
        existingAlertsCount: 0,
        createdAlertsCount: 0,
        createdAlerts: []
      };
    }

    // 2. Ensure history is seeded from DB & fetch existing price alerts
    await seedShortOptionAlertHistoryFromDb(prisma);
    const historyRecords = loadShortOptionAlertHistory();
    const existingAlerts = await prisma.priceAlert.findMany();

    const createdAlerts: any[] = [];
    let existingCount = 0;

    for (const holding of holdings) {
      const details = extractShortOptionDetails(holding, { ignoreExpired: true });
      if (!details) continue;

      const defense = calculateShortOptionDefenseLevels(details.strikePrice, details.optionType);
      const contractLabel = `${details.underlyingSymbol} $${details.strikePrice} ${details.optionType}${details.expiryDate ? ` (${details.expiryDate})` : ''}`;

      const key10 = getContractDefenseKey(details.underlyingSymbol, details.strikePrice, details.optionType, details.expiryDate, 10);
      const key5 = getContractDefenseKey(details.underlyingSymbol, details.strikePrice, details.optionType, details.expiryDate, 5);

      // Check 10% Alert: Must not have been provisioned in the past AND not currently active
      const target10 = defense.warning10Pct.targetPrice;
      const cond10 = defense.warning10Pct.condition;
      const alreadyProvisioned10 = Boolean(historyRecords[key10]);
      const existing10 = existingAlerts.find(a => 
        a.symbol.toUpperCase() === details.underlyingSymbol.toUpperCase() &&
        a.condition === cond10 &&
        Math.abs(a.targetPrice - target10) < 0.05 &&
        (a.status === 'ACTIVE' || (a.notes && a.notes.includes(details.underlyingSymbol) && a.notes.includes(`${details.strikePrice}`)))
      );

      if (!alreadyProvisioned10 && !existing10) {
        const note10 = `[Short Option 10% Defense] ${contractLabel} - Warning: Underlying approaching within 10% of strike $${details.strikePrice}`;
        const newAlert = await prisma.priceAlert.create({
          data: {
            symbol: details.underlyingSymbol,
            targetPrice: target10,
            condition: cond10,
            status: 'ACTIVE',
            notes: note10
          }
        });
        recordShortOptionAlertProvisioned(details.underlyingSymbol, details.strikePrice, details.optionType, details.expiryDate, 10);
        historyRecords[key10] = {
          key: key10,
          underlyingSymbol: details.underlyingSymbol,
          strikePrice: details.strikePrice,
          optionType: details.optionType,
          expiryDate: details.expiryDate,
          pct: 10,
          provisionedAt: new Date().toISOString(),
          dismissedAt: null
        };
        createdAlerts.push(newAlert);
        existingAlerts.push(newAlert);
        logToFile(`[Auto Alert Created] 10% short option defense alert for ${details.underlyingSymbol} at $${target10} (${cond10})`);
      } else {
        existingCount++;
        // Ensure recorded in history so it won't be recreated if user deletes it later
        if (!alreadyProvisioned10) {
          recordShortOptionAlertProvisioned(details.underlyingSymbol, details.strikePrice, details.optionType, details.expiryDate, 10);
          historyRecords[key10] = {
            key: key10,
            underlyingSymbol: details.underlyingSymbol,
            strikePrice: details.strikePrice,
            optionType: details.optionType,
            expiryDate: details.expiryDate,
            pct: 10,
            provisionedAt: new Date().toISOString(),
            dismissedAt: null
          };
        }
      }

      // Check 5% Alert: Must not have been provisioned in the past AND not currently active
      const target5 = defense.critical5Pct.targetPrice;
      const cond5 = defense.critical5Pct.condition;
      const alreadyProvisioned5 = Boolean(historyRecords[key5]);
      const existing5 = existingAlerts.find(a => 
        a.symbol.toUpperCase() === details.underlyingSymbol.toUpperCase() &&
        a.condition === cond5 &&
        Math.abs(a.targetPrice - target5) < 0.05 &&
        (a.status === 'ACTIVE' || (a.notes && a.notes.includes(details.underlyingSymbol) && a.notes.includes(`${details.strikePrice}`)))
      );

      if (!alreadyProvisioned5 && !existing5) {
        const note5 = `[Short Option 5% Defense] ${contractLabel} - CRITICAL: Underlying approaching within 5% of strike $${details.strikePrice}`;
        const newAlert = await prisma.priceAlert.create({
          data: {
            symbol: details.underlyingSymbol,
            targetPrice: target5,
            condition: cond5,
            status: 'ACTIVE',
            notes: note5
          }
        });
        recordShortOptionAlertProvisioned(details.underlyingSymbol, details.strikePrice, details.optionType, details.expiryDate, 5);
        historyRecords[key5] = {
          key: key5,
          underlyingSymbol: details.underlyingSymbol,
          strikePrice: details.strikePrice,
          optionType: details.optionType,
          expiryDate: details.expiryDate,
          pct: 5,
          provisionedAt: new Date().toISOString(),
          dismissedAt: null
        };
        createdAlerts.push(newAlert);
        existingAlerts.push(newAlert);
        logToFile(`[Auto Alert Created] 5% short option defense alert for ${details.underlyingSymbol} at $${target5} (${cond5})`);
      } else {
        existingCount++;
        if (!alreadyProvisioned5) {
          recordShortOptionAlertProvisioned(details.underlyingSymbol, details.strikePrice, details.optionType, details.expiryDate, 5);
          historyRecords[key5] = {
            key: key5,
            underlyingSymbol: details.underlyingSymbol,
            strikePrice: details.strikePrice,
            optionType: details.optionType,
            expiryDate: details.expiryDate,
            pct: 5,
            provisionedAt: new Date().toISOString(),
            dismissedAt: null
          };
        }
      }
    }

    return {
      success: true,
      totalShortOptions: holdings.length,
      existingAlertsCount: existingCount,
      createdAlertsCount: createdAlerts.length,
      createdAlerts
    };
  } catch (err: any) {
    logToFile(`Error in syncShortOptionAlerts: ${err?.message || err}`);
    throw err;
  }
}

/**
 * Get status of all short option positions and their 5% & 10% alerts
 */
export async function getShortOptionsAlertStatus(
  prisma: PrismaClient,
  priceMap: Record<string, number> = {}
): Promise<ShortOptionAlertStatusItem[]> {
  const holdings = await prisma.holding.findMany({
    where: {
      assetType: 'OPTION',
      quantity: { lt: 0 }
    },
    include: { broker: true }
  });

  if (holdings.length === 0) return [];

  const alerts = await prisma.priceAlert.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return holdings.map(h => {
    const details = extractShortOptionDetails(h);
    if (!details) {
      return {
        holdingId: h.id,
        symbol: h.symbol,
        underlyingSymbol: h.symbol,
        strikePrice: h.strikePrice || 0,
        optionType: (h.optionType === 'CALL' || h.optionType === 'C') ? 'CALL' : 'PUT',
        expiryDate: h.expiryDate || undefined,
        quantity: h.quantity,
        averageCost: h.averageCost,
        currentPrice: h.currentPrice,
        marketValue: h.marketValue,
        brokerName: h.broker?.name,
        defenseLevels: calculateShortOptionDefenseLevels(h.strikePrice || 0, h.optionType || 'PUT')
      };
    }

    const defense = calculateShortOptionDefenseLevels(details.strikePrice, details.optionType);
    const target10 = defense.warning10Pct.targetPrice;
    const cond10 = defense.warning10Pct.condition;
    const target5 = defense.critical5Pct.targetPrice;
    const cond5 = defense.critical5Pct.condition;

    const alert10 = alerts.find(a => 
      a.symbol.toUpperCase() === details.underlyingSymbol.toUpperCase() &&
      a.condition === cond10 &&
      Math.abs(a.targetPrice - target10) < 0.05
    );

    const alert5 = alerts.find(a => 
      a.symbol.toUpperCase() === details.underlyingSymbol.toUpperCase() &&
      a.condition === cond5 &&
      Math.abs(a.targetPrice - target5) < 0.05
    );

    const underlyingPrice = priceMap[details.underlyingSymbol.toUpperCase()] || null;
    let dist10 = null;
    let dist5 = null;

    if (underlyingPrice != null && underlyingPrice > 0) {
      dist10 = ((target10 - underlyingPrice) / underlyingPrice) * 100;
      dist5 = ((target5 - underlyingPrice) / underlyingPrice) * 100;
    }

    return {
      holdingId: h.id,
      symbol: h.symbol,
      underlyingSymbol: details.underlyingSymbol,
      strikePrice: details.strikePrice,
      optionType: details.optionType,
      expiryDate: details.expiryDate,
      quantity: h.quantity,
      averageCost: h.averageCost,
      currentPrice: h.currentPrice,
      marketValue: h.marketValue,
      brokerName: h.broker?.name,
      defenseLevels: defense,
      underlyingCurrentPrice: underlyingPrice,
      underlyingDistanceTo10Pct: dist10,
      underlyingDistanceTo5Pct: dist5,
      alert10Pct: alert10 ? {
        id: alert10.id,
        status: alert10.status as any,
        targetPrice: alert10.targetPrice,
        condition: alert10.condition as any,
        triggeredAt: alert10.triggeredAt ? alert10.triggeredAt.toISOString() : null,
        isMuted: alert10.isMuted
      } : null,
      alert5Pct: alert5 ? {
        id: alert5.id,
        status: alert5.status as any,
        targetPrice: alert5.targetPrice,
        condition: alert5.condition as any,
        triggeredAt: alert5.triggeredAt ? alert5.triggeredAt.toISOString() : null,
        isMuted: alert5.isMuted
      } : null
    };
  });
}

/**
 * Create or re-arm 5% and 10% alerts for a single short option position
 */
export async function createAlertsForSingleShortOption(
  holdingId: string,
  prisma: PrismaClient,
  logToFile: (msg: string) => void = console.log
): Promise<{ success: boolean; alerts: any[] }> {
  const holding = await prisma.holding.findUnique({
    where: { id: holdingId },
    include: { broker: true }
  });

  if (!holding) {
    throw new Error(`Holding not found with id: ${holdingId}`);
  }

  const details = extractShortOptionDetails(holding);
  if (!details) {
    throw new Error(`Holding ${holding.symbol} is not a valid short option contract.`);
  }

  const defense = calculateShortOptionDefenseLevels(details.strikePrice, details.optionType);
  const contractLabel = `${details.underlyingSymbol} $${details.strikePrice} ${details.optionType}${details.expiryDate ? ` (${details.expiryDate})` : ''}`;

  const createdAlerts: any[] = [];

  // 10% Alert
  const target10 = defense.warning10Pct.targetPrice;
  const cond10 = defense.warning10Pct.condition;
  const existing10 = await prisma.priceAlert.findFirst({
    where: {
      symbol: details.underlyingSymbol,
      condition: cond10,
      targetPrice: target10
    }
  });

  if (!existing10) {
    const a10 = await prisma.priceAlert.create({
      data: {
        symbol: details.underlyingSymbol,
        targetPrice: target10,
        condition: cond10,
        status: 'ACTIVE',
        notes: `[Short Option 10% Defense] ${contractLabel} - Warning: Underlying approaching within 10% of strike $${details.strikePrice}`
      }
    });
    createdAlerts.push(a10);
  } else if (existing10.status !== 'ACTIVE') {
    const updated10 = await prisma.priceAlert.update({
      where: { id: existing10.id },
      data: { status: 'ACTIVE', triggeredAt: null, triggeredPrice: null, isMuted: false }
    });
    createdAlerts.push(updated10);
  } else {
    createdAlerts.push(existing10);
  }

  // 5% Alert
  const target5 = defense.critical5Pct.targetPrice;
  const cond5 = defense.critical5Pct.condition;
  const existing5 = await prisma.priceAlert.findFirst({
    where: {
      symbol: details.underlyingSymbol,
      condition: cond5,
      targetPrice: target5
    }
  });

  if (!existing5) {
    const a5 = await prisma.priceAlert.create({
      data: {
        symbol: details.underlyingSymbol,
        targetPrice: target5,
        condition: cond5,
        status: 'ACTIVE',
        notes: `[Short Option 5% Defense] ${contractLabel} - CRITICAL: Underlying approaching within 5% of strike $${details.strikePrice}`
      }
    });
    createdAlerts.push(a5);
  } else if (existing5.status !== 'ACTIVE') {
    const updated5 = await prisma.priceAlert.update({
      where: { id: existing5.id },
      data: { status: 'ACTIVE', triggeredAt: null, triggeredPrice: null, isMuted: false }
    });
    createdAlerts.push(updated5);
  } else {
    createdAlerts.push(existing5);
  }

  recordShortOptionAlertProvisioned(details.underlyingSymbol, details.strikePrice, details.optionType, details.expiryDate, 10);
  recordShortOptionAlertProvisioned(details.underlyingSymbol, details.strikePrice, details.optionType, details.expiryDate, 5);

  logToFile(`[Single Position Alerts] Armed 5% and 10% defense alerts for ${contractLabel}`);
  return { success: true, alerts: createdAlerts };
}
