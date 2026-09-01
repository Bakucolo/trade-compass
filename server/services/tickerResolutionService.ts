/**
 * Common symbol aliases for international stocks or non-standard broker symbols
 */
export const SYMBOL_ALIASES: Record<string, string> = {
  'EOS': 'EOS.AX',      // Electro Optic Systems (ASX: EOS.AX in AUD)
  'BP.': 'BP.L',        // BP p.l.c. (London LSE: BP.L)
  'BP': 'BP.L',
  'ONDO': 'ONDO.L',     // Ondine Biomedical (LSE: ONDO.L)
  'PNG': 'PNG.V',       // Kraken Robotics (TSXV: PNG.V)
  'ECOR': 'ECOR.L',     // Ecora Resources (LSE: ECOR.L)
  'APF': 'ECOR.L',      // Anglo Pacific Group / Ecora
  'BOGO': 'BOGO.V',     // Bogart Resources (TSXV)
  'LIB': 'LIB.V',       // Liberty Defense (TSXV)
  'DMET': 'DMET.V',     // Decision Metal (TSXV)
  'ZDC': 'ZDC.V',       // Zedcor Inc. (TSXV)
  'HSTR': 'HSTR.V',     // High Tide (TSXV)
  'EMPR': 'EMPR.V',     // Empire Metals (TSXV)
  'AUMB': 'AUMB.V',     // Aurex Minerals (TSXV)
  'SWA': 'SWLF.V',
  'AGX': 'SIL.V',
  'AYA': 'AYA.TO',
};

/**
 * Resolves raw broker / portfolio symbols to clean Yahoo Finance tickers
 */
export function resolveYahooFinanceSymbol(rawSymbol: string, currency?: string): string {
  if (!rawSymbol || !rawSymbol.trim()) return '';
  const cleanRaw = rawSymbol.trim().toUpperCase();

  if (SYMBOL_ALIASES[cleanRaw]) {
    return SYMBOL_ALIASES[cleanRaw];
  }

  // Suffix stripping / translation
  if (cleanRaw.endsWith('_US_EQ')) {
    return cleanRaw.replace('_US_EQ', '');
  }
  if (cleanRaw.endsWith('_CA_EQ')) {
    return cleanRaw.replace('_CA_EQ', '') + '.TO';
  }
  if (cleanRaw.endsWith('L_EQ') || cleanRaw.endsWith('P_EQ')) {
    return cleanRaw.replace(/[LP]_EQ$/, '') + '.L';
  }
  if (cleanRaw.endsWith('_EQ')) {
    return cleanRaw.replace('_EQ', '');
  }

  // Currency-based resolution if not yet containing an exchange dot
  if (!cleanRaw.includes('.')) {
    if (currency === 'AUD') return `${cleanRaw}.AX`;
    if (currency === 'GBP' || currency === 'GBX') return `${cleanRaw}.L`;
    if (currency === 'CAD') return `${cleanRaw}.TO`;
  }

  return cleanRaw;
}
