export interface UnifiedPosition {
    brokerSpecificId: string;
    symbol: string;
    assetType: 'EQUITY' | 'OPTION';
    description: string | null;
    quantity: number;
    averageCost: number;
    currentPrice: number;
    marketValue: number;
    dayPnL: number;

    // Options metadata
    strikePrice?: number;
    expiryDate?: string;
    optionType?: string; // 'Call' | 'Put'
    underlyingSymbol?: string;
    costEffect?: string;
}

export class TastytradeAdapter {
    static toUnified(pos: any): UnifiedPosition {
        const isOption = pos['instrument-type'] === 'Equity Option' || pos.instrumentType === 'Equity Option';
        const symbol = pos.symbol;

        let optionType: string | undefined;
        let strikePrice = Number(pos['strike-price'] || pos.strikePrice || 0);

        if (isOption && symbol && symbol.length >= 21) {
            const typeChar = symbol[12];
            if (typeChar === 'C') optionType = 'Call';
            else if (typeChar === 'P') optionType = 'Put';

            if (strikePrice === 0) {
                const strikePart = symbol.substring(13);
                const strikeVal = parseInt(strikePart, 10);
                if (!isNaN(strikeVal)) {
                    strikePrice = strikeVal / 1000;
                }
            }
        }

        const directionMultiplier = pos['quantity-direction'] === 'Short' ? -1 : 1;
        let qty = Number(pos.quantity) * directionMultiplier;
        // If the quantity is already negative, we don't need to multiply it by -1 again, 
        // but the tastytrade API usually returns positive quantity with a quantity-direction.
        if (pos.quantity < 0 && directionMultiplier === -1) {
            qty = pos.quantity; // it's already negative
        }

        return {
            brokerSpecificId: symbol,
            symbol: pos['underlying-symbol'] || pos.underlyingSymbol || symbol,
            assetType: isOption ? 'OPTION' : 'EQUITY',
            description: pos.description || null,
            quantity: qty,
            averageCost: Number(pos['average-open-price'] || pos.averageOpenPrice || 0),
            currentPrice: Number(pos['current-market-price'] || pos['last-price'] || pos.currentMarketPrice || pos.lastPrice || 0),
            marketValue: Number(pos.value || pos.marketValue || 0),
            dayPnL: Number(pos['day-pnl'] || pos.dayPnl || 0),
            strikePrice: isOption ? strikePrice : undefined,
            expiryDate: pos['expires-at'] || pos.expiresAt || undefined,
            optionType: optionType,
            underlyingSymbol: pos['underlying-symbol'] || pos.underlyingSymbol || undefined,
            costEffect: pos['cost-effect'] || pos.costEffect || undefined
        };
    }
}
