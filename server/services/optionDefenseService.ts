import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export interface OptionQuoteItem {
  contractSymbol: string;
  strike: number;
  optionType: 'CALL' | 'PUT';
  expiration: string;
  dte: number;
  bid: number;
  ask: number;
  mid: number;
  lastPrice: number;
  impliedVolatility: number;
  inTheMoney: boolean;
}

export interface LiveOptionChainData {
  underlyingSymbol: string;
  underlyingPrice: number;
  expirationDates: string[];
  options: OptionQuoteItem[];
}

/**
 * Standard Normal Cumulative Distribution Function approximation
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Black-Scholes theoretical option fair value
 */
export function calculateBlackScholesPrice(
  underlyingPrice: number,
  strike: number,
  dte: number,
  impliedVol = 0.35,
  optionType: 'CALL' | 'PUT' = 'PUT',
  riskFreeRate = 0.045
): number {
  if (dte <= 0) {
    if (optionType === 'CALL') return Math.max(0, underlyingPrice - strike);
    return Math.max(0, strike - underlyingPrice);
  }

  const t = Math.max(0.001, dte / 365.0);
  const v = Math.max(0.05, Math.min(2.5, impliedVol || 0.35));
  const s = Math.max(0.01, underlyingPrice);
  const k = Math.max(0.01, strike);

  const d1 = (Math.log(s / k) + (riskFreeRate + (v * v) / 2.0) * t) / (v * Math.sqrt(t));
  const d2 = d1 - v * Math.sqrt(t);

  let price = 0;
  if (optionType === 'CALL') {
    price = s * normalCDF(d1) - k * Math.exp(-riskFreeRate * t) * normalCDF(d2);
  } else {
    price = k * Math.exp(-riskFreeRate * t) * normalCDF(-d2) - s * normalCDF(-d1);
  }

  return Math.max(0.01, Math.round(price * 100) / 100);
}

/**
 * Fetch real option chains for underlying from Yahoo Finance across upcoming expirations (20-60 DTE)
 */
export async function fetchLiveOptionChains(
  symbol: string,
  currentPrice: number,
  targetStrike?: number
): Promise<LiveOptionChainData> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const result: LiveOptionChainData = {
    underlyingSymbol: cleanSymbol,
    underlyingPrice: currentPrice,
    expirationDates: [],
    options: []
  };

  try {
    const mainChain = await yahooFinance.options(cleanSymbol);
    const expDates: Date[] = mainChain.expirationDates || [];

    if (!expDates || expDates.length === 0) {
      return result;
    }

    const today = new Date();
    // Find expirations between 14 and 75 days out (ideal for defense rolls)
    const validExpirations = expDates
      .map(d => new Date(d))
      .filter(d => {
        const diffDays = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 14 && diffDays <= 75;
      });

    // Select the closest 2-3 target expirations
    const selectedExps = validExpirations.length > 0 ? validExpirations.slice(0, 3) : expDates.slice(0, 2).map(d => new Date(d));

    result.expirationDates = selectedExps.map(d => d.toISOString().split('T')[0]);

    for (const expDate of selectedExps) {
      const expStr = expDate.toISOString().split('T')[0];
      const dte = Math.max(1, Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

      try {
        const expData = await yahooFinance.options(cleanSymbol, { date: expDate });
        const chain = expData?.options?.[0];

        if (chain) {
          // Process Puts
          (chain.puts || []).forEach(p => {
            const bid = p.bid || 0;
            const ask = p.ask || 0;
            let mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : (p.lastPrice || 0);

            // Fallback to Black-Scholes if illiquid or missing
            if (mid <= 0) {
              mid = calculateBlackScholesPrice(currentPrice, p.strike, dte, p.impliedVolatility || 0.35, 'PUT');
            }

            result.options.push({
              contractSymbol: p.contractSymbol,
              strike: p.strike,
              optionType: 'PUT',
              expiration: expStr,
              dte,
              bid,
              ask,
              mid: Math.round(mid * 100) / 100,
              lastPrice: p.lastPrice || mid,
              impliedVolatility: p.impliedVolatility || 0.35,
              inTheMoney: p.inTheMoney ?? (currentPrice < p.strike)
            });
          });

          // Process Calls
          (chain.calls || []).forEach(c => {
            const bid = c.bid || 0;
            const ask = c.ask || 0;
            let mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : (c.lastPrice || 0);

            if (mid <= 0) {
              mid = calculateBlackScholesPrice(currentPrice, c.strike, dte, c.impliedVolatility || 0.35, 'CALL');
            }

            result.options.push({
              contractSymbol: c.contractSymbol,
              strike: c.strike,
              optionType: 'CALL',
              expiration: expStr,
              dte,
              bid,
              ask,
              mid: Math.round(mid * 100) / 100,
              lastPrice: c.lastPrice || mid,
              impliedVolatility: c.impliedVolatility || 0.35,
              inTheMoney: c.inTheMoney ?? (currentPrice > c.strike)
            });
          });
        }
      } catch (e) {
        console.warn(`Could not fetch option chain for ${cleanSymbol} at ${expStr}:`, e);
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch main option chain for ${cleanSymbol}:`, error);
  }

  return result;
}

/**
 * Build explicit Live Option Chain Pricing Table text for the AI prompt
 */
export function buildOptionPricingContext(
  position: any,
  chainData: LiveOptionChainData
): string {
  const currentPrice = position.currentPrice || position.averageCost || 1.0;
  const underlyingPrice = position.underlyingPrice || chainData.underlyingPrice || 100.0;
  const isOption = position.assetType === 'Option';
  const optType = (position.optionType || 'PUT').toUpperCase();
  const currentStrike = position.strike || underlyingPrice;
  const qty = position.quantity || 1;
  const absQty = Math.abs(qty);
  const isShort = qty < 0;

  // Filter option chain strikes near the current strike (+/- 15%)
  const relevantOptions = chainData.options.filter(opt => {
    return Math.abs(opt.strike - currentStrike) / currentStrike <= 0.20;
  });

  // Group by expiration
  const byExp = new Map<string, OptionQuoteItem[]>();
  for (const opt of relevantOptions) {
    if (!byExp.has(opt.expiration)) {
      byExp.set(opt.expiration, []);
    }
    byExp.get(opt.expiration)!.push(opt);
  }

  let tableStr = `=== REAL-TIME LIVE OPTION PRICING TABLE (MANDATORY TO USE THESE EXACT PRICES) ===\n`;
  tableStr += `Current Underlying (${chainData.underlyingSymbol}) Price: $${underlyingPrice.toFixed(2)}\n\n`;

  tableStr += `1. CURRENT OPEN POSITION (LEG 1 TO CLOSE):\n`;
  tableStr += `- Contract: ${position.symbol}\n`;
  tableStr += `- Action To Close: ${isShort ? 'BUY TO CLOSE' : 'SELL TO CLOSE'} ${absQty}x @ EXACT LIVE PRICE $${currentPrice.toFixed(2)} ($${(absQty * currentPrice * 100).toFixed(0)} total ${isShort ? 'debit' : 'credit'})\n`;
  tableStr += `- Original Entry Cost: $${(position.averageCost || 0).toFixed(2)}\n\n`;

  tableStr += `2. AVAILABLE ROLL / HEDGE TARGET OPTIONS (LEG 2 TO OPEN WITH LIVE MARKET PRICES):\n`;

  if (byExp.size === 0) {
    // Generate theoretical fallback strikes
    const targetDte = 35;
    const targetExp = new Date(Date.now() + targetDte * 86400000).toISOString().split('T')[0];
    const strikes = [
      Math.round(currentStrike * 0.90),
      Math.round(currentStrike * 0.95),
      Math.round(currentStrike),
      Math.round(currentStrike * 1.05)
    ];

    tableStr += `Target Expiration: ${targetExp} (~${targetDte} DTE)\n`;
    for (const st of strikes) {
      const putPrice = calculateBlackScholesPrice(underlyingPrice, st, targetDte, 0.35, 'PUT');
      const callPrice = calculateBlackScholesPrice(underlyingPrice, st, targetDte, 0.35, 'CALL');
      tableStr += `  • Strike $${st} PUT -> Market Mid: $${putPrice.toFixed(2)}\n`;
      tableStr += `  • Strike $${st} CALL -> Market Mid: $${callPrice.toFixed(2)}\n`;
    }
  } else {
    byExp.forEach((opts, exp) => {
      const dte = opts[0]?.dte || 30;
      tableStr += `Expiration ${exp} (${dte} DTE):\n`;
      // Sort by strike
      opts.sort((a, b) => a.strike - b.strike);
      for (const opt of opts) {
        tableStr += `  • $${opt.strike} ${opt.optionType} -> Bid: $${opt.bid.toFixed(2)} | Ask: $${opt.ask.toFixed(2)} | Mid: $${opt.mid.toFixed(2)} (IV: ${(opt.impliedVolatility * 100).toFixed(1)}%)\n`;
      }
      tableStr += `\n`;
    });
  }

  tableStr += `\nCRITICAL MATHEMATICAL RULES FOR YOUR OUTPUT:\n`;
  tableStr += `1. When closing the existing position in Leg 1, you MUST state "@ $${currentPrice.toFixed(2)}".\n`;
  tableStr += `2. When opening Leg 2 (e.g. SELL TO OPEN next month strike), you MUST pick an exact price from the table above.\n`;
  tableStr += `3. Calculate netCreditOrDebit precisely: (Leg 2 Price - Leg 1 Price). Example: If Leg 2 is $3.20 and Leg 1 is $2.40, net credit is +$0.80 ($${(absQty * 80).toFixed(0)} total credit for ${absQty} contracts).\n`;
  tableStr += `4. Calculate newBreakeven precisely: For Put, (New Strike - Total Net Credit Collected); For Call, (New Strike + Total Net Credit Collected).\n`;

  return tableStr;
}

/**
 * Post-process and mathematically validate AI-generated management plans
 */
export function validateAndEnforcePlanPricing(
  plans: any[],
  position: any,
  chainData: LiveOptionChainData
): any[] {
  if (!plans || !Array.isArray(plans)) return plans;

  const currentPrice = position.currentPrice || position.averageCost || 1.0;
  const absQty = Math.abs(position.quantity || 1);
  const isShort = (position.quantity || 1) < 0;
  const origCost = position.averageCost || currentPrice;

  return plans.map((plan, idx) => {
    if (!plan || !plan.orderLegs || !Array.isArray(plan.orderLegs)) return plan;

    let leg1Price = currentPrice;
    let leg2Price: number | null = null;
    let leg2Strike: number | null = null;
    let isRoll = plan.actionType?.startsWith('ROLL');

    // Clean up and standardize order legs
    const updatedLegs = plan.orderLegs.map((legStr: string, legIdx: number) => {
      if (typeof legStr !== 'string') return legStr;

      // Leg 1: Closing existing position
      if (legIdx === 0 && (legStr.toUpperCase().includes('CLOSE') || isRoll)) {
        const closeAction = isShort ? 'BUY TO CLOSE' : 'SELL TO CLOSE';
        const totalCloseCost = absQty * currentPrice * 100;
        return `${closeAction} ${absQty}x ${position.symbol} @ $${currentPrice.toFixed(2)} ($${totalCloseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total)`;
      }

      // Leg 2: Opening roll target or hedge leg
      if (legIdx === 1 && (legStr.toUpperCase().includes('OPEN') || legStr.toUpperCase().includes('SELL') || legStr.toUpperCase().includes('BUY'))) {
        // Extract price if present after '@' (e.g. "@ $1.20")
        const priceMatch = legStr.match(/@\s*\$?(\d+(?:\.\d+)?)/i);
        if (priceMatch) {
          leg2Price = parseFloat(priceMatch[1]);
        }

        // Extract strike: look for $XXX Put/Call or XXX Put/Call or Strike $XXX
        const strikeMatch = legStr.match(/(?:strike|\$)\s*(\d+(?:\.\d+)?)\s*(?:Put|Call|P|C)?/i) ||
                            legStr.match(/\b(\d{2,5}(?:\.\d+)?)\s*(?:Put|Call|P|C)\b/i) ||
                            legStr.match(/\$(\d+(?:\.\d+)?)/i);
        if (strikeMatch) {
          const parsedStrike = parseFloat(strikeMatch[1]);
          if (parsedStrike > 5 || chainData.underlyingPrice <= 10) {
            leg2Strike = parsedStrike;
          }
        }

        // If price wasn't found from @, lookup from chain
        if ((leg2Price === null || leg2Price <= 0) && leg2Strike !== null) {
          const matchedOpt = chainData.options.find(o => Math.abs(o.strike - leg2Strike!) < 0.5);
          if (matchedOpt && matchedOpt.mid > 0) {
            leg2Price = matchedOpt.mid;
          } else {
            const isCall = legStr.toUpperCase().includes('CALL') || (position.optionType === 'Call');
            leg2Price = calculateBlackScholesPrice(chainData.underlyingPrice, leg2Strike, 35, 0.35, isCall ? 'CALL' : 'PUT');
          }
        }
      }

      return legStr;
    });

    // Recompute mathematical net credit / debit and breakeven
    let netCreditOrDebit = plan.netCreditOrDebit;
    let newBreakeven = plan.newBreakeven;

    if (isRoll && leg2Price !== null) {
      const netPerShare = leg2Price - leg1Price;
      const totalDollarEffect = netPerShare * absQty * 100;

      if (netPerShare >= 0) {
        netCreditOrDebit = `+$${netPerShare.toFixed(2)} Net Credit ($${Math.abs(totalDollarEffect).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total)`;
      } else {
        netCreditOrDebit = `-$${Math.abs(netPerShare).toFixed(2)} Net Debit ($${Math.abs(totalDollarEffect).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total)`;
      }

      if (leg2Strike !== null) {
        const isCall = position.optionType === 'Call';
        const totalCreditCollected = origCost + Math.max(0, netPerShare);
        const calcBE = isCall ? (leg2Strike + totalCreditCollected) : (leg2Strike - totalCreditCollected);
        newBreakeven = `$${calcBE.toFixed(2)} (Effective Basis: $${(leg2Strike - Math.max(0, netPerShare)).toFixed(2)})`;
      }
    }

    return {
      ...plan,
      orderLegs: updatedLegs,
      netCreditOrDebit: netCreditOrDebit || plan.netCreditOrDebit,
      newBreakeven: newBreakeven || plan.newBreakeven
    };
  });
}
