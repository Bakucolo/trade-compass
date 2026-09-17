import * as fs from 'fs';
import * as path from 'path';

export type PositionSizingMode = 'FIXED_DOLLAR' | 'PERCENT_OF_PORTFOLIO' | 'FIXED_SHARES';
export type ExecutionMode = 'MANUAL_APPROVAL' | 'AUTOMATED';
export type AccountTradingMode = 'PAPER' | 'LIVE';

export interface AiTradingSettings {
  // Account Mode
  accountMode: AccountTradingMode; // Default 'PAPER'
  masterKillSwitch: boolean; // When true, all autonomous execution is halted

  // Strict User-Controlled Position Sizing
  sizingMode: PositionSizingMode;
  fixedDollarAmount: number; // e.g. $1,000 per position
  portfolioPercent: number; // e.g. 5% of total portfolio/buying power
  fixedShares: number; // e.g. 10 shares per trade

  // Hard Safety Ceilings
  maxSinglePositionDollar: number; // Absolute max $ allowed in any single trade (e.g. $5,000)
  maxOpenPositions: number; // Maximum concurrent open positions (e.g. 5)
  maxDailyLossDollar?: number; // Optional safety circuit breaker for daily losses

  // Execution Behavior
  executionMode: ExecutionMode; // 'MANUAL_APPROVAL' (default safe) or 'AUTOMATED'

  // Default Exit Rules
  defaultStopLossPercent: number; // e.g. 3.0 (%)
  defaultTakeProfitPercent: number; // e.g. 6.0 (%)
  trailingStopPercent?: number; // e.g. 2.5 (%)

  updatedAt: string;
}

const SETTINGS_FILE_PATH = path.join(process.cwd(), 'server', 'quant', 'ai_trading_settings.json');

const DEFAULT_SETTINGS: AiTradingSettings = {
  accountMode: 'PAPER',
  masterKillSwitch: false,
  sizingMode: 'FIXED_DOLLAR',
  fixedDollarAmount: 1000,
  portfolioPercent: 5.0,
  fixedShares: 10,
  maxSinglePositionDollar: 5000,
  maxOpenPositions: 5,
  maxDailyLossDollar: 2500,
  executionMode: 'MANUAL_APPROVAL', // Safe default: user approves trades
  defaultStopLossPercent: 3.5,
  defaultTakeProfitPercent: 7.0,
  trailingStopPercent: 2.5,
  updatedAt: new Date().toISOString(),
};

class AiTradingGuardrailsService {
  private settings: AiTradingSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): AiTradingSettings {
    try {
      const dir = path.dirname(SETTINGS_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(SETTINGS_FILE_PATH)) {
        const raw = fs.readFileSync(SETTINGS_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (err) {
      console.error('[AiTradingGuardrails] Error loading settings, using defaults:', err);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public saveSettings(updates: Partial<AiTradingSettings>): AiTradingSettings {
    // Validate inputs
    const newSettings: AiTradingSettings = {
      ...this.settings,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Sanity checks & hard constraints
    if (newSettings.fixedDollarAmount < 10) newSettings.fixedDollarAmount = 10;
    if (newSettings.portfolioPercent < 0.5) newSettings.portfolioPercent = 0.5;
    if (newSettings.portfolioPercent > 100) newSettings.portfolioPercent = 100;
    if (newSettings.fixedShares < 1) newSettings.fixedShares = 1;
    if (newSettings.maxSinglePositionDollar < 100) newSettings.maxSinglePositionDollar = 100;
    if (newSettings.maxOpenPositions < 1) newSettings.maxOpenPositions = 1;

    this.settings = newSettings;

    try {
      const dir = path.dirname(SETTINGS_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AiTradingGuardrails] Error saving settings to file:', err);
    }

    return this.settings;
  }

  public getSettings(): AiTradingSettings {
    return { ...this.settings };
  }

  /**
   * STRICT SAFETY SIZING CALCULATOR:
   * Calculates the exact share quantity and dollar value an agent or manual trade is authorized to execute,
   * strictly adhering to the user's sizing settings and safety ceilings.
   */
  public calculateOrderSizing(params: {
    symbol: string;
    currentPrice: number;
    portfolioValue: number;
    buyingPower: number;
    currentOpenPositionsCount: number;
    isExistingPosition?: boolean;
  }): {
    allowed: boolean;
    reason?: string;
    shares: number;
    estimatedDollarValue: number;
    sizingRuleApplied: string;
    stopLossPrice?: number;
    takeProfitPrice?: number;
  } {
    const { symbol, currentPrice, portfolioValue, buyingPower, currentOpenPositionsCount, isExistingPosition } = params;

    // 1. Master Kill Switch Check
    if (this.settings.masterKillSwitch) {
      return {
        allowed: false,
        reason: 'Master Kill Switch is ACTIVE. All autonomous and new trading is blocked.',
        shares: 0,
        estimatedDollarValue: 0,
        sizingRuleApplied: 'BLOCKED_BY_KILL_SWITCH',
      };
    }

    // 2. Price Validation
    if (!currentPrice || currentPrice <= 0) {
      return {
        allowed: false,
        reason: `Invalid current market price for ${symbol}: $${currentPrice}`,
        shares: 0,
        estimatedDollarValue: 0,
        sizingRuleApplied: 'INVALID_PRICE',
      };
    }

    // 3. Max Open Positions Check (only for new positions)
    if (!isExistingPosition && currentOpenPositionsCount >= this.settings.maxOpenPositions) {
      return {
        allowed: false,
        reason: `Max open positions limit reached (${currentOpenPositionsCount}/${this.settings.maxOpenPositions}). Cannot open new position.`,
        shares: 0,
        estimatedDollarValue: 0,
        sizingRuleApplied: 'MAX_POSITIONS_EXCEEDED',
      };
    }

    // 4. Calculate target dollar value based on user-chosen sizing mode
    let targetDollarValue = 0;
    let ruleDescription = '';

    switch (this.settings.sizingMode) {
      case 'FIXED_DOLLAR':
        targetDollarValue = this.settings.fixedDollarAmount;
        ruleDescription = `Fixed User Size: $${this.settings.fixedDollarAmount.toFixed(2)}`;
        break;

      case 'PERCENT_OF_PORTFOLIO':
        const baseValue = portfolioValue > 0 ? portfolioValue : buyingPower;
        targetDollarValue = (baseValue * this.settings.portfolioPercent) / 100;
        ruleDescription = `User % of Portfolio (${this.settings.portfolioPercent}% of $${baseValue.toFixed(2)})`;
        break;

      case 'FIXED_SHARES':
        targetDollarValue = this.settings.fixedShares * currentPrice;
        ruleDescription = `User Fixed Shares: ${this.settings.fixedShares} shares @ $${currentPrice.toFixed(2)}`;
        break;

      default:
        targetDollarValue = this.settings.fixedDollarAmount;
        ruleDescription = `Default Fixed Size: $${this.settings.fixedDollarAmount.toFixed(2)}`;
    }

    // 5. Apply Hard Ceiling: maxSinglePositionDollar
    if (targetDollarValue > this.settings.maxSinglePositionDollar) {
      targetDollarValue = this.settings.maxSinglePositionDollar;
      ruleDescription += ` (Clamped to Max Ceiling $${this.settings.maxSinglePositionDollar.toFixed(2)})`;
    }

    // 6. Buying Power Check
    if (targetDollarValue > buyingPower) {
      targetDollarValue = Math.max(0, buyingPower * 0.95); // Leave 5% buffer
      ruleDescription += ` (Clamped to Available Buying Power $${buyingPower.toFixed(2)})`;
    }

    // 7. Calculate integer shares (or fractional if Alpaca allows, but integer is safest for stock/etf)
    let shares = Math.floor(targetDollarValue / currentPrice);
    if (shares < 1) {
      return {
        allowed: false,
        reason: `Target capital ($${targetDollarValue.toFixed(2)}) is less than 1 share of ${symbol} ($${currentPrice.toFixed(2)}).`,
        shares: 0,
        estimatedDollarValue: 0,
        sizingRuleApplied: ruleDescription,
      };
    }

    const estimatedDollarValue = Number((shares * currentPrice).toFixed(2));

    // Calculate default bracket prices if applicable
    const stopLossPrice = this.settings.defaultStopLossPercent > 0
      ? Number((currentPrice * (1 - this.settings.defaultStopLossPercent / 100)).toFixed(2))
      : undefined;

    const takeProfitPrice = this.settings.defaultTakeProfitPercent > 0
      ? Number((currentPrice * (1 + this.settings.defaultTakeProfitPercent / 100)).toFixed(2))
      : undefined;

    return {
      allowed: true,
      shares,
      estimatedDollarValue,
      sizingRuleApplied: ruleDescription,
      stopLossPrice,
      takeProfitPrice,
    };
  }
}

export const aiTradingGuardrails = new AiTradingGuardrailsService();
