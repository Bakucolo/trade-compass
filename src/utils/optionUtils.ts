/**
 * Converts IBKR option details to an OCC (Options Clearing Corporation) symbol string.
 * Format: Root (6 chars, space padded) + YYMMDD + Type (C/P) + Strike (8 chars, 00000.000 scaled by 1000).
 * Example: AAPL 230120C00150000 (AAPL Jan 20, 2023 150.00 Call)
 */
export function convertIbkrToOcc(
    symbol: string,
    expiry: string, // YYYYMMDD
    strike: number,
    right: string // 'C' or 'P' or 'Call'/'Put'
): string {
    if (!symbol || !expiry || !strike || !right) {
        console.warn("Invalid IBKR option data for OCC conversion:", { symbol, expiry, strike, right });
        return symbol; // Fallback
    }

    // 1. Root Symbol (pad to 6 characters)
    // Note: Standard OCC allows up to 6 chars for root.
    const root = symbol.toUpperCase().padEnd(6, ' ');

    // 2. Expiry Date (YYMMDD)
    // IBKR expiry is usually YYYYMMDD (e.g. 20230120)
    // Handle YYYY-MM-DD or other formats by simple normalization
    const normalizedExpiry = expiry.replace(/-/g, '');

    // Ensure we have at least YYYYMMDD (8 chars)
    if (normalizedExpiry.length < 8) {
        console.warn("Invalid expiry format for OCC:", expiry);
        return symbol;
    }

    const yy = normalizedExpiry.substring(2, 4);
    const mm = normalizedExpiry.substring(4, 6);
    const dd = normalizedExpiry.substring(6, 8);
    const dateStr = `${yy}${mm}${dd}`;

    // 3. Option Type (C or P)
    const type = right.toUpperCase().startsWith('C') ? 'C' : 'P';

    // 4. Strike Price (8 chars, scaled by 1000, 0-padded)
    // e.g. 150.00 -> 150000 -> 00150000
    // e.g. 47.5 -> 47500 -> 00047500
    const scaledStrike = Math.round(strike * 1000);
    const strikeStr = scaledStrike.toString().padStart(8, '0');

    return `${root}${dateStr}${type}${strikeStr}`;
}

/**
 * Parses an OCC symbol back into readable parts
 */
export function parseOccSymbol(occ: string) {
    const regex = /^([A-Z\s]{6})(\d{6})([CP])(\d{8})$/;
    const match = occ.match(regex);
    if (!match) return null;

    return {
        symbol: match[1].trim(),
        expiry: `20${match[2]}`, // Assuming 20xx
        type: match[3] === 'C' ? 'Call' : 'Put',
        strike: parseInt(match[4]) / 1000
    };
}
