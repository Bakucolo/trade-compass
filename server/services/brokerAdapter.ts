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
    unrealizedPnL?: number;
    unrealizedPnLPercent?: number;

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
        if (pos.quantity < 0 && directionMultiplier === -1) {
            qty = pos.quantity; // it's already negative
        }

        const avgOpenPrice = Number(pos['average-open-price'] || pos.averageOpenPrice || 0);
        let mktPrice = Number(
            pos['mark-price'] ||
            pos.markPrice ||
            pos['mark'] ||
            pos.mark ||
            pos['close-price'] ||
            pos.closePrice ||
            pos['current-market-price'] ||
            pos.currentMarketPrice ||
            pos['last-price'] ||
            pos.lastPrice ||
            0
        );

        let mktVal = Number(pos.value || pos.marketValue || 0);
        const multiplier = isOption ? 100 : 1;

        // If mktPrice is 0 but marketValue is available, derive mktPrice from marketValue
        if (mktPrice === 0 && mktVal !== 0 && qty !== 0) {
            mktPrice = Math.abs(mktVal / (qty * multiplier));
        } else if (mktPrice === 0 && avgOpenPrice > 0) {
            mktPrice = avgOpenPrice;
        }

        if (mktVal === 0 && mktPrice > 0 && qty !== 0) {
            mktVal = mktPrice * qty * multiplier;
        }

        // Calculate Unrealized PnL for Long & Short positions
        const costBasis = Math.abs(qty * avgOpenPrice * multiplier);
        let unrealizedPnL = 0;
        let unrealizedPnLPercent = 0;

        if (qty < 0) {
            // Short position: profit when current market price is lower than entry price
            unrealizedPnL = (avgOpenPrice - mktPrice) * Math.abs(qty) * multiplier;
        } else if (qty > 0) {
            // Long position: profit when current market price is higher than entry price
            unrealizedPnL = (mktPrice - avgOpenPrice) * qty * multiplier;
        }

        if (costBasis > 0) {
            unrealizedPnLPercent = (unrealizedPnL / costBasis) * 100;
        }

        return {
            brokerSpecificId: symbol,
            symbol: pos['underlying-symbol'] || pos.underlyingSymbol || symbol,
            assetType: isOption ? 'OPTION' : 'EQUITY',
            description: pos.description || null,
            quantity: qty,
            averageCost: avgOpenPrice,
            currentPrice: mktPrice,
            marketValue: mktVal,
            dayPnL: Number(pos['day-pnl'] || pos.dayPnl || 0),
            unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
            unrealizedPnLPercent: Number(unrealizedPnLPercent.toFixed(2)),
            strikePrice: isOption ? strikePrice : undefined,
            expiryDate: pos['expires-at'] || pos.expiresAt || undefined,
            optionType: optionType,
            underlyingSymbol: pos['underlying-symbol'] || pos.underlyingSymbol || undefined,
            costEffect: pos['cost-effect'] || pos.costEffect || undefined
        };
    }
}
