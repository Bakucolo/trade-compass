import * as dotenv from 'dotenv';
import { aiTradingGuardrails } from './aiTradingGuardrails';

dotenv.config({ path: '.env.local' });
dotenv.config();

export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  buying_power: string;
  regt_buying_power?: string;
  daytrading_buying_power?: string;
  cash: string;
  portfolio_value: string;
  equity: string;
  last_equity: string;
  initial_margin?: string;
  maintenance_margin?: string;
  sma?: string;
  daytrade_count?: number;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
  shorting_enabled: boolean;
  multiplier?: string;
}

export interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  avg_entry_price: string;
  qty: string;
  side: 'long' | 'short';
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  unrealized_intraday_pl?: string;
  unrealized_intraday_plpc?: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}

export interface AlpacaOrder {
  id: string;
  client_order_id?: string;
  created_at: string;
  updated_at?: string;
  submitted_at: string;
  filled_at?: string;
  expired_at?: string;
  canceled_at?: string;
  failed_at?: string;
  replaced_at?: string;
  replaced_by?: string;
  replaces?: string;
  asset_id: string;
  symbol: string;
  asset_class: string;
  notional?: string;
  qty?: string;
  filled_qty?: string;
  filled_avg_price?: string;
  order_class?: string;
  order_type: string;
  type: string;
  side: 'buy' | 'sell';
  time_in_force: string;
  limit_price?: string;
  stop_price?: string;
  status: string;
  extended_hours?: boolean;
}

export interface AlpacaBar {
  t: string; // Timestamp ISO
  o: number; // Open
  h: number; // High
  l: number; // Low
  c: number; // Close
  v: number; // Volume
  n?: number; // Number of trades
  vw?: number; // Volume-weighted average price
}

export class AlpacaService {
  private paperBaseUrl = 'https://paper-api.alpaca.markets';
  private liveBaseUrl = 'https://api.alpaca.markets';
  private dataBaseUrl = 'https://data.alpaca.markets';

  private getCredentials() {
    const settings = aiTradingGuardrails.getSettings();
    const isLive = settings.accountMode === 'LIVE';

    const apiKey = isLive
      ? process.env.ALPACA_LIVE_API_KEY || process.env.ALPACA_API_KEY || ''
      : process.env.ALPACA_API_KEY || '';

    const secretKey = isLive
      ? process.env.ALPACA_LIVE_SECRET_KEY || process.env.ALPACA_SECRET_KEY || ''
      : process.env.ALPACA_SECRET_KEY || '';

    const baseUrl = isLive ? this.liveBaseUrl : this.paperBaseUrl;

    return { apiKey, secretKey, baseUrl, isLive };
  }

  private getHeaders() {
    const { apiKey, secretKey } = this.getCredentials();
    return {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': secretKey,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Check connection status and get credentials state
   */
  public async getStatus(): Promise<{
    configured: boolean;
    mode: 'PAPER' | 'LIVE';
    connected: boolean;
    keyPrefix: string;
    error?: string;
  }> {
    const { apiKey, baseUrl, isLive } = this.getCredentials();
    if (!apiKey) {
      return {
        configured: false,
        mode: isLive ? 'LIVE' : 'PAPER',
        connected: false,
        keyPrefix: '',
        error: 'Alpaca API credentials missing in .env.local',
      };
    }

    try {
      const res = await fetch(`${baseUrl}/v2/account`, {
        headers: this.getHeaders(),
      });

      if (res.ok) {
        return {
          configured: true,
          mode: isLive ? 'LIVE' : 'PAPER',
          connected: true,
          keyPrefix: apiKey.substring(0, 4) + '****',
        };
      } else {
        const errorText = await res.text();
        return {
          configured: true,
          mode: isLive ? 'LIVE' : 'PAPER',
          connected: false,
          keyPrefix: apiKey.substring(0, 4) + '****',
          error: `HTTP ${res.status}: ${errorText}`,
        };
      }
    } catch (err: any) {
      return {
        configured: true,
        mode: isLive ? 'LIVE' : 'PAPER',
        connected: false,
        keyPrefix: apiKey.substring(0, 4) + '****',
        error: err.message,
      };
    }
  }

  /**
   * Fetch current Alpaca Account details
   */
  public async getAccount(): Promise<AlpacaAccount> {
    const { baseUrl } = this.getCredentials();
    const res = await fetch(`${baseUrl}/v2/account`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Alpaca getAccount error (${res.status}): ${err}`);
    }

    return res.json();
  }

  /**
   * Fetch all open positions
   */
  public async getPositions(): Promise<AlpacaPosition[]> {
    const { baseUrl } = this.getCredentials();
    const res = await fetch(`${baseUrl}/v2/positions`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Alpaca getPositions error (${res.status}): ${err}`);
    }

    return res.json();
  }

  /**
   * Close a specific position
   */
  public async closePosition(symbol: string, qty?: number): Promise<any> {
    const { baseUrl } = this.getCredentials();
    let url = `${baseUrl}/v2/positions/${encodeURIComponent(symbol)}`;
    if (qty && qty > 0) {
      url += `?qty=${qty}`;
    }

    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Alpaca closePosition error (${res.status}): ${err}`);
    }

    return res.json();
  }

  /**
   * EMERGENCY LIQUIDATION: Close all positions and cancel all open orders
   */
  public async liquidateAll(): Promise<any> {
    const { baseUrl } = this.getCredentials();
    // 1. Cancel all open orders
    try {
      await fetch(`${baseUrl}/v2/orders`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
    } catch (e) {
      console.error('[Alpaca] Error canceling orders during liquidation:', e);
    }

    // 2. Liquidate all positions
    const res = await fetch(`${baseUrl}/v2/positions?cancel_orders=true`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Alpaca liquidateAll error (${res.status}): ${err}`);
    }

    return res.json();
  }

  /**
   * Fetch orders (open, closed, or all)
   */
  public async getOrders(status: 'open' | 'closed' | 'all' = 'all', limit: number = 50): Promise<AlpacaOrder[]> {
    const { baseUrl } = this.getCredentials();
    const res = await fetch(`${baseUrl}/v2/orders?status=${status}&limit=${limit}&direction=desc`, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Alpaca getOrders error (${res.status}): ${err}`);
    }

    return res.json();
  }

  /**
   * Cancel a specific order
   */
  public async cancelOrder(orderId: string): Promise<any> {
    const { baseUrl } = this.getCredentials();
    const res = await fetch(`${baseUrl}/v2/orders/${orderId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Alpaca cancelOrder error (${res.status}): ${err}`);
    }

    return { success: true, orderId };
  }

  /**
   * SUBMIT ORDER WITH MANDATORY USER-CONTROLLED POSITION SIZING:
   * Enforces that the order size NEVER exceeds the user's configured settings!
   */
  public async submitOrder(params: {
    symbol: string;
    side: 'buy' | 'sell';
    type?: 'market' | 'limit' | 'stop' | 'stop_limit';
    time_in_force?: 'day' | 'gtc' | 'ioc' | 'fok';
    limit_price?: number;
    stop_price?: number;
    // Explicit share override if manual order; otherwise calculated from guardrails
    requestedShares?: number;
    // Source of the trade
    source?: 'MANUAL' | 'AI_AGENT' | 'STRATEGY';
    strategyName?: string;
  }): Promise<{
    order?: AlpacaOrder;
    guardrailCheck: ReturnType<typeof aiTradingGuardrails.calculateOrderSizing>;
    success: boolean;
    error?: string;
  }> {
    const { baseUrl } = this.getCredentials();
    const symbol = params.symbol.toUpperCase().trim();
    const side = params.side;
    const type = params.type || 'market';
    const time_in_force = params.time_in_force || 'day';

    // 1. Fetch live account and positions to enforce safety guardrails
    const account = await this.getAccount();
    const positions = await this.getPositions();

    const portfolioValue = parseFloat(account.portfolio_value) || 0;
    const buyingPower = parseFloat(account.buying_power) || 0;
    const currentOpenPositionsCount = positions.length;
    const existingPosition = positions.find((p) => p.symbol === symbol);

    // 2. Get current price estimate
    let currentPrice = params.limit_price || 0;
    if (!currentPrice) {
      try {
        const bars = await this.getMarketBars(symbol, '1Day', 2);
        if (bars.length > 0) {
          currentPrice = bars[bars.length - 1].c;
        } else if (existingPosition) {
          currentPrice = parseFloat(existingPosition.current_price);
        }
      } catch (e) {
        console.warn(`[Alpaca] Could not fetch latest bar for price check on ${symbol}:`, e);
      }
    }

    // 3. ENFORCE USER POSITION SIZING GUARDRAILS (FOR BUYS / OPENS)
    let sizingCheck = aiTradingGuardrails.calculateOrderSizing({
      symbol,
      currentPrice,
      portfolioValue,
      buyingPower,
      currentOpenPositionsCount,
      isExistingPosition: Boolean(existingPosition),
    });

    if (side === 'buy') {
      if (!sizingCheck.allowed) {
        return {
          success: false,
          guardrailCheck: sizingCheck,
          error: sizingCheck.reason || 'Order blocked by user safety guardrails.',
        };
      }

      // If user provided an explicit share quantity manually, ensure it doesn't exceed the guardrail calculation
      let finalQty = sizingCheck.shares;
      if (params.requestedShares && params.requestedShares > 0) {
        if (params.requestedShares > sizingCheck.shares) {
          // Clamp downward to user's strict guardrail limit!
          console.warn(
            `[Alpaca Guardrail] Requested shares (${params.requestedShares}) exceeded maximum authorized user position size (${sizingCheck.shares}). Clamping downward.`
          );
          finalQty = sizingCheck.shares;
        } else {
          finalQty = params.requestedShares;
        }
      }

      const orderPayload: any = {
        symbol,
        qty: String(finalQty),
        side: 'buy',
        type,
        time_in_force,
      };

      if (type === 'limit' && params.limit_price) {
        orderPayload.limit_price = String(params.limit_price);
      }
      if (type === 'stop' && params.stop_price) {
        orderPayload.stop_price = String(params.stop_price);
      }

      // Bracket order: attach stop loss / take profit if configured
      const settings = aiTradingGuardrails.getSettings();
      if (settings.defaultStopLossPercent > 0 && currentPrice > 0 && type === 'market') {
        orderPayload.order_class = 'bracket';
        orderPayload.stop_loss = {
          stop_price: String((currentPrice * (1 - settings.defaultStopLossPercent / 100)).toFixed(2)),
        };
        if (settings.defaultTakeProfitPercent > 0) {
          orderPayload.take_profit = {
            limit_price: String((currentPrice * (1 + settings.defaultTakeProfitPercent / 100)).toFixed(2)),
          };
        }
      }

      const res = await fetch(`${baseUrl}/v2/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(orderPayload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          guardrailCheck: sizingCheck,
          error: `Alpaca order rejected (${res.status}): ${errorText}`,
        };
      }

      const orderData: AlpacaOrder = await res.json();
      return {
        success: true,
        order: orderData,
        guardrailCheck: sizingCheck,
      };
    } else {
      // SELL / CLOSE order
      let sellQty = params.requestedShares;
      if (!sellQty && existingPosition) {
        sellQty = Math.abs(parseFloat(existingPosition.qty));
      }
      if (!sellQty || sellQty <= 0) {
        return {
          success: false,
          guardrailCheck: sizingCheck,
          error: `No open position or quantity specified to sell for ${symbol}.`,
        };
      }

      const orderPayload: any = {
        symbol,
        qty: String(sellQty),
        side: 'sell',
        type,
        time_in_force,
      };

      if (type === 'limit' && params.limit_price) {
        orderPayload.limit_price = String(params.limit_price);
      }

      const res = await fetch(`${baseUrl}/v2/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(orderPayload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          guardrailCheck: sizingCheck,
          error: `Alpaca sell order rejected (${res.status}): ${errorText}`,
        };
      }

      const orderData: AlpacaOrder = await res.json();
      return {
        success: true,
        order: orderData,
        guardrailCheck: sizingCheck,
      };
    }
  }

  /**
   * Fetch historical bar data from Alpaca Market Data API (feed=iex)
   */
  public async getMarketBars(
    symbol: string,
    timeframe: '1Day' | '1Hour' | '15Min' | '5Min' | '1Min' = '1Day',
    limit: number = 200,
    startIso?: string,
    endIso?: string
  ): Promise<AlpacaBar[]> {
    const cleanSymbol = symbol.toUpperCase().trim();
    let url = `${this.dataBaseUrl}/v2/stocks/bars?symbols=${cleanSymbol}&timeframe=${timeframe}&limit=${limit}&feed=iex`;

    if (startIso) url += `&start=${encodeURIComponent(startIso)}`;
    if (endIso) url += `&end=${encodeURIComponent(endIso)}`;

    const res = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Alpaca Market Data API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const bars: AlpacaBar[] = data.bars?.[cleanSymbol] || [];
    return bars;
  }
}

export const alpacaService = new AlpacaService();
