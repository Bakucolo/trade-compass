
export interface PortfolioMetric {
    label: string;
    value: number | string;
    change?: number; // Dollar change
    changePercent?: number;
    isCurrency?: boolean;
}

export interface UnifiedPosition {
    id: string; // Unique ID (e.g. source-symbol)
    symbol: string;
    description?: string;
    quantity: number;
    averageCost: number;
    currentPrice: number;
    marketValue: number;
    dayChange: number; // $ Day P/L
    dayChangePercent: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
    source: 'IBKR' | 'Tastytrade' | 'Trading 212';
    assetType: 'Stock' | 'Option' | 'Crypto' | 'Other';
    // Option Specifics
    strike?: number;
    expiry?: string;
    dte?: number;
    optionType?: 'Call' | 'Put' | 'C' | 'P';
    underlyingSymbol?: string;
    underlyingPrice?: number;
    currency?: string;
    // Thematic & Style
    investmentStyle?: 'Growth' | 'Value' | 'Dividend' | 'Defensive' | 'Speculative' | 'Blend';
    themes?: string[];
    primaryTheme?: string;
}
