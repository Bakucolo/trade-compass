import { UnifiedPosition } from '@/components/portfolio/types';
import { calculateGreeks, parseDteFromExpiry } from '@/utils/greeksUtils';
import { parseOccSymbol } from '@/utils/optionUtils';

export interface TastyLeg {
  id: string;
  position: UnifiedPosition;
  legType: 'EQUITY' | 'OPTION';
  label: string; // e.g. "-1 18 OCT 26 120 CALL" or "+100 Shares"
  quantity: number;
  strike: number | null;
  optionType: 'Call' | 'Put' | null;
  expiry: string | null;
  dte: number | null;
  isITM: boolean;
  lastPrice: number;
  dayChange: number;
  dayChangePercent: number;
  delta: number;
  theta: number;
  vega: number;
  plDay: number;
  plOpen: number;
  pop: number; // 0 - 100%
  ext: number; // Extrinsic value ($)
  cost: number; // Cost basis ($)
  netLiq: number; // Market value / Net Liq ($)
  touchPercent: number | null;
  capReq: number;
  ivr: number;
  earnsAt: string | null;
}

export interface TastyUnderlyingGroup {
  symbol: string;
  description: string;
  isITM: boolean;
  lastPrice: number;
  dayChange: number;
  dayChangePercent: number;
  delta: number;
  theta: number;
  vega: number;
  plDay: number;
  plOpen: number;
  pop: number;
  ext: number;
  cost: number;
  netLiq: number;
  touchPercent: number | null;
  capReq: number;
  earnsAt: string | null;
  ivr: number;
  dte: number | null;
  hasOptions: boolean;
  hasShares: boolean;
  totalShares: number;
  totalOptionsCount: number;
  legs: TastyLeg[];
}

/**
 * Cleanly extracts base underlying ticker from position
 */
export function extractUnderlyingSymbol(pos: UnifiedPosition): string {
  if (pos.underlyingSymbol && pos.underlyingSymbol.trim().length > 0) {
    return pos.underlyingSymbol.trim().toUpperCase();
  }

  if (pos.assetType === 'Option') {
    const parsed = parseOccSymbol(pos.symbol);
    if (parsed?.symbol) return parsed.symbol.toUpperCase();
    const match = pos.symbol.match(/^([A-Za-z0-9.\-]+)/);
    if (match) return match[1].toUpperCase();
  }

  return (pos.symbol || '').toUpperCase().trim();
}

/**
 * Formats expiration date into clean human representation e.g. "18 OCT 26"
 */
export function formatTastyExpiry(expiryStr?: string): string {
  if (!expiryStr) return '—';
  try {
    let date: Date;
    const clean = String(expiryStr).trim();
    if (/^\d{8}$/.test(clean)) {
      const y = Number(clean.substring(0, 4));
      const m = Number(clean.substring(4, 6)) - 1;
      const d = Number(clean.substring(6, 8));
      date = new Date(y, m, d);
    } else {
      date = new Date(clean);
    }

    if (isNaN(date.getTime())) return expiryStr;

    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = String(date.getFullYear()).slice(-2);
    return `${day} ${month} ${year}`;
  } catch {
    return expiryStr || '—';
  }
}

/**
 * Formats earnings date to Tastytrade MM/DD representation
 */
export function formatEarningsMmDd(earningsDate?: string | null): string | null {
  if (!earningsDate) return null;
  try {
    const d = new Date(earningsDate);
    if (isNaN(d.getTime())) return null;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}/${dd}`;
  } catch {
    return null;
  }
}

/**
 * Determines whether an option contract is In-The-Money (ITM)
 */
export function isOptionITM(
  optionType: 'Call' | 'Put' | 'C' | 'P' | string | undefined,
  strike: number | undefined,
  underlyingPrice: number | undefined
): boolean {
  if (!strike || !underlyingPrice || strike <= 0 || underlyingPrice <= 0) return false;
  const isCall = optionType === 'Call' || optionType === 'C' || String(optionType).toUpperCase().startsWith('C');
  return isCall ? underlyingPrice > strike : underlyingPrice < strike;
}

/**
 * Groups and computes Tastytrade metrics for a list of unified positions
 */
export function groupPositionsForTastytrade(
  positions: UnifiedPosition[],
  options?: {
    earningsMap?: Map<string, string>;
    ivrMap?: Map<string, number>;
  }
): TastyUnderlyingGroup[] {
  const groupsMap = new Map<string, UnifiedPosition[]>();

  // 1. Group by underlying symbol
  for (const pos of positions) {
    if (!pos || pos.quantity === 0) continue;
    const sym = extractUnderlyingSymbol(pos);
    if (!groupsMap.has(sym)) {
      groupsMap.set(sym, []);
    }
    groupsMap.get(sym)!.push(pos);
  }

  const result: TastyUnderlyingGroup[] = [];

  for (const [sym, posList] of groupsMap.entries()) {
    let underlyingSpot = 0;
    let underlyingDayChange = 0;
    let underlyingDayChangePct = 0;
    let description = '';

    // First pass: locate best quote / spot price for the underlying
    for (const p of posList) {
      if (p.description && !description) description = p.description;

      if (p.assetType !== 'Option') {
        if (p.currentPrice > 0) underlyingSpot = p.currentPrice;
        if (p.dayChangePercent !== undefined && p.dayChangePercent !== 0) {
          underlyingDayChangePct = p.dayChangePercent;
        }
        if (p.dayChange !== undefined && p.quantity !== 0) {
          underlyingDayChange = p.dayChange / p.quantity;
        }
      } else if (p.underlyingPrice && p.underlyingPrice > 0 && underlyingSpot === 0) {
        underlyingSpot = p.underlyingPrice;
      }
    }

    // Fallback if underlying price is still 0
    if (underlyingSpot === 0 && posList.length > 0) {
      const first = posList[0];
      underlyingSpot = first.underlyingPrice || first.currentPrice || first.averageCost || 0;
    }

    const earningsDate = options?.earningsMap?.get(sym) || null;
    const ivrValue = options?.ivrMap?.get(sym) ?? 25.0;

    let groupDelta = 0;
    let groupTheta = 0;
    let groupVega = 0;
    let groupPlDay = 0;
    let groupPlOpen = 0;
    let groupExt = 0;
    let groupCost = 0;
    let groupNetLiq = 0;
    let groupCapReq = 0;
    let groupIsITM = false;
    let minDte: number | null = null;
    let totalShares = 0;
    let totalOptionsCount = 0;
    const popWeights: { pop: number; weight: number }[] = [];

    const legs: TastyLeg[] = [];

    for (const p of posList) {
      const isOption = p.assetType === 'Option';
      const qty = p.quantity || 0;
      const multiplier = isOption ? 100 : 1;
      const currentPrice = p.currentPrice || p.averageCost || 0;
      const spot = p.underlyingPrice || underlyingSpot || currentPrice;

      let legStrike: number | null = null;
      let legOptionType: 'Call' | 'Put' | null = null;
      let legDte: number | null = null;
      let legIsITM = false;
      let legDelta = 0;
      let legTheta = 0;
      let legVega = 0;
      let legExt = 0;
      let legPop = 50;
      let legTouch: number | null = null;
      let legCapReq = 0;
      let label = '';

      if (isOption) {
        totalOptionsCount += Math.abs(qty);
        legStrike = p.strike || null;
        const optTypeStr = p.optionType || 'Call';
        legOptionType = optTypeStr === 'Call' || optTypeStr === 'C' ? 'Call' : 'Put';
        legDte = p.dte !== undefined ? p.dte : parseDteFromExpiry(p.expiry);

        if (minDte === null || (legDte !== null && legDte < minDte)) {
          minDte = legDte;
        }

        legIsITM = isOptionITM(legOptionType, legStrike || undefined, spot);
        if (legIsITM) groupIsITM = true;

        // Greeks calculation
        const greeks = calculateGreeks(
          spot,
          legStrike || spot,
          Math.max(0.5, legDte ?? 30),
          0.35,
          legOptionType.toUpperCase() as 'CALL' | 'PUT'
        );

        // Unit delta per contract share
        const unitDelta = p.delta !== undefined && !isNaN(p.delta) ? p.delta : greeks.delta;
        legDelta = Number((unitDelta * qty * 100).toFixed(2));

        // Theta (dollars/day for this position)
        if (p.dailyDollarTheta !== undefined && !isNaN(p.dailyDollarTheta)) {
          legTheta = p.dailyDollarTheta;
        } else {
          // Negative Black Scholes decay: short option captures positive time decay
          legTheta = Number((-greeks.theta * qty * 100).toFixed(2));
        }

        // Vega (dollar change per 1% IV shift)
        legVega = Number((greeks.vega * qty * 100).toFixed(2));

        // Extrinsic value calculation
        const intrinsic = legStrike
          ? (legOptionType === 'Call' ? Math.max(0, spot - legStrike) : Math.max(0, legStrike - spot))
          : 0;
        const extPerShare = Math.max(0, currentPrice - intrinsic);
        legExt = Number((extPerShare * Math.abs(qty) * 100 * (qty < 0 ? 1 : -1)).toFixed(2));

        // PoP estimation (Tastytrade style)
        if (qty < 0) {
          // Short option: profit when OTM at expiry
          legPop = Math.min(99, Math.max(1, Math.round(100 - Math.abs(unitDelta) * 100)));
        } else {
          // Long option: profit depends on delta probability
          legPop = Math.min(99, Math.max(1, Math.round(Math.abs(unitDelta) * 100)));
        }

        // Probability of touch ~ 2 * delta for OTM options
        legTouch = Math.min(99, Math.max(1, Math.round(2 * Math.abs(unitDelta) * 100)));

        // Capital requirement: for short option, approx 20% underlying or max margin
        if (qty < 0) {
          legCapReq = legStrike ? Math.round(Math.max(spot * 0.20 * 100 * Math.abs(qty), (legStrike * 100 * Math.abs(qty)) * 0.15)) : 500;
        } else {
          // Long option cap req is just purchase cost
          legCapReq = Math.abs(currentPrice * qty * 100);
        }

        const formattedExpiry = formatTastyExpiry(p.expiry);
        const qtyPrefix = qty > 0 ? `+${qty}` : `${qty}`;
        label = `${qtyPrefix} ${formattedExpiry} ${legStrike ? legStrike.toFixed(1) : ''} ${legOptionType.toUpperCase()}`;
      } else {
        totalShares += qty;
        label = `${qty > 0 ? `+${qty}` : qty} Shares`;
        legDelta = qty; // 1 share = 1.00 Delta
        legTheta = 0;
        legVega = 0;
        legExt = 0;
        legPop = 50; // Neutral 50% baseline for shares
        legTouch = null;
        legCapReq = Math.abs(qty * currentPrice);
      }

      const legPlDay = p.dayChange || 0;
      const legPlOpen = p.unrealizedPL || 0;
      const legCost = p.averageCost * qty * multiplier;
      // In Tastytrade, short option positions have negative NetLiq (a liability to buy back)
      const legNetLiq = isOption && qty < 0
        ? -Math.abs(currentPrice * qty * multiplier)
        : currentPrice * qty * multiplier;

      groupDelta += legDelta;
      groupTheta += legTheta;
      groupVega += legVega;
      groupPlDay += legPlDay;
      groupPlOpen += legPlOpen;
      groupExt += legExt;
      groupCost += legCost;
      groupNetLiq += legNetLiq;
      groupCapReq += legCapReq;

      popWeights.push({ pop: legPop, weight: Math.abs(qty * multiplier) });

      legs.push({
        id: p.id,
        position: p,
        legType: isOption ? 'OPTION' : 'EQUITY',
        label,
        quantity: qty,
        strike: legStrike,
        optionType: legOptionType,
        expiry: p.expiry || null,
        dte: legDte,
        isITM: legIsITM,
        lastPrice: currentPrice,
        dayChange: p.dayChange || 0,
        dayChangePercent: p.dayChangePercent || 0,
        delta: legDelta,
        theta: legTheta,
        vega: legVega,
        plDay: legPlDay,
        plOpen: legPlOpen,
        pop: legPop,
        ext: legExt,
        cost: legCost,
        netLiq: legNetLiq,
        touchPercent: legTouch,
        capReq: legCapReq,
        ivr: ivrValue,
        earnsAt: formatEarningsMmDd(earningsDate),
      });
    }

    // Weighted composite PoP
    let compositePop = 50;
    const totalWeight = popWeights.reduce((s, w) => s + w.weight, 0);
    if (totalWeight > 0) {
      compositePop = Math.round(
        popWeights.reduce((s, w) => s + w.pop * w.weight, 0) / totalWeight
      );
    }

    result.push({
      symbol: sym,
      description: description || `${sym} Position`,
      isITM: groupIsITM,
      lastPrice: underlyingSpot,
      dayChange: underlyingDayChange,
      dayChangePercent: underlyingDayChangePct,
      delta: Number(groupDelta.toFixed(2)),
      theta: Number(groupTheta.toFixed(3)),
      vega: Number(groupVega.toFixed(2)),
      plDay: Number(groupPlDay.toFixed(2)),
      plOpen: Number(groupPlOpen.toFixed(2)),
      pop: compositePop,
      ext: Number(groupExt.toFixed(2)),
      cost: Number(groupCost.toFixed(2)),
      netLiq: Number(groupNetLiq.toFixed(2)),
      touchPercent: legs.some(l => l.touchPercent !== null)
        ? Math.round(legs.reduce((s, l) => s + (l.touchPercent || 0), 0) / (legs.filter(l => l.touchPercent !== null).length || 1))
        : null,
      capReq: Number(groupCapReq.toFixed(2)),
      earnsAt: formatEarningsMmDd(earningsDate),
      ivr: ivrValue,
      dte: minDte,
      hasOptions: totalOptionsCount > 0,
      hasShares: totalShares !== 0,
      totalShares,
      totalOptionsCount,
      legs,
    });
  }

  return result;
}
