/**
 * Clean Trading212 ticker to standardized symbol and accurate currency
 * e.g. "AAPL_US_EQ" -> "AAPL" (USD), "BARCl_EQ" -> "BARC.L" (GBP, GBX pence), "KAPl_EQ" -> "KAP.L" (USD GDR), "CRON_CA_EQ" -> "CRON.TO" (CAD)
 */
export function parseTrading212Ticker(
  ticker: string,
  fxPpl?: number | null
): { cleanSymbol: string; currency: string; description: string; isPence: boolean } {
  let cleanSymbol = ticker;
  let currency = 'GBP';
  let isPence = false;

  if (ticker.endsWith('_US_EQ')) {
    cleanSymbol = ticker.replace('_US_EQ', '');
    currency = 'USD';
  } else if (ticker.endsWith('_CA_EQ')) {
    cleanSymbol = ticker.replace('_CA_EQ', '') + '.TO';
    currency = 'CAD';
  } else if (
    ticker.endsWith('a_EQ') ||
    ticker.endsWith('d_EQ') ||
    ticker.endsWith('e_EQ') ||
    ticker.endsWith('f_EQ')
  ) {
    cleanSymbol = ticker.replace(/[a-z]_EQ$/, '');
    currency = 'EUR';
  } else if (ticker.endsWith('l_EQ') || ticker.endsWith('p_EQ')) {
    cleanSymbol = ticker.replace(/[lp]_EQ$/, '') + '.L';
    // Check if this LSE instrument is a USD GDR/foreign currency or native UK pence
    if (fxPpl !== null && fxPpl !== undefined && fxPpl !== 0) {
      currency = 'USD';
      isPence = false;
    } else {
      currency = 'GBP';
      isPence = true;
    }
  } else if (ticker.endsWith('_EQ')) {
    cleanSymbol = ticker.replace('_EQ', '');
  }

  return {
    cleanSymbol,
    currency,
    description: `Trading 212 Position (${cleanSymbol})`,
    isPence,
  };
}
