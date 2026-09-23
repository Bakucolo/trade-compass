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
  'BOGO': 'BOGO.V',     // Borealis Mining Company (TSXV: BOGO.V)
  'LIB': 'LIB.V',       // Liberty Defense / Libertystream (TSXV: LIB.V)
  'DMET': 'DMET.NE',    // Denarius Metals (NEO: DMET.NE)
  'ZDC': 'ZDC.V',       // Zedcor Inc. (TSXV: ZDC.V)
  'HSTR': 'HSTR.V',     // Heliostar Metals (TSXV: HSTR.V)
  'EMPR': 'EMPR.V',     // Empress Royalty (TSXV: EMPR.V)
  'AUMB': 'AUMB.V',     // 1911 Gold Corporation (TSXV: AUMB.V)
  'SWA': 'SWA.V',       // Sarama Resources (TSXV: SWA.V)
  'AGX': 'AGX.V',       // Silver X Mining Corp (TSXV: AGX.V)
  'GTII': 'GTII.CN',    // Green Thumb Industries Inc. (CSE: GTII.CN)
  'AYA': 'AYA.TO',      // Aya Gold & Silver (TSX: AYA.TO)
  'BYN': 'BYN.V',       // Banyan Gold (TSXV: BYN.V)
  'SICO': 'SICO.V',     // Silverco Mining (TSXV: SICO.V)
  'NOM': 'NOM.CN',      // Norsemont Mining (CSE: NOM.CN)
  'GRID': 'GRID.TO',    // Tantalus Systems Holdings (TSX: GRID.TO)
};

export const CANONICAL_COMPANY_NAMES: Record<string, string> = {
  'AGX': 'Silver X Mining Corp.',
  'AGX.V': 'Silver X Mining Corp.',
  'GTII': 'Green Thumb Industries Inc.',
  'GTII.CN': 'Green Thumb Industries Inc.',
  'GTBIF': 'Green Thumb Industries Inc.',
  'GRID': 'Tantalus Systems Holdings Inc.',
  'GRID.TO': 'Tantalus Systems Holdings Inc.',
  'SWA': 'Sarama Resources Ltd.',
  'SWA.V': 'Sarama Resources Ltd.',
  'PNG': 'Kraken Robotics Inc.',
  'PNG.V': 'Kraken Robotics Inc.',
  'DMET': 'Denarius Metals Corp.',
  'DMET.NE': 'Denarius Metals Corp.',
  'SICO': 'Silverco Mining Ltd.',
  'SICO.V': 'Silverco Mining Ltd.',
  'BYN': 'Banyan Gold Corp.',
  'BYN.V': 'Banyan Gold Corp.',
  'NOM': 'Norsemont Mining Inc.',
  'NOM.CN': 'Norsemont Mining Inc.',
  'BOGO': 'Borealis Mining Company Ltd.',
  'BOGO.V': 'Borealis Mining Company Ltd.',
  'ZDC': 'Zedcor Inc.',
  'ZDC.V': 'Zedcor Inc.',
  'HSTR': 'Heliostar Metals Ltd.',
  'HSTR.V': 'Heliostar Metals Ltd.',
  'EMPR': 'Empress Royalty Corp.',
  'EMPR.V': 'Empress Royalty Corp.',
  'AUMB': '1911 Gold Corporation',
  'AUMB.V': '1911 Gold Corporation',
  'AYA': 'Aya Gold & Silver Inc.',
  'AYA.TO': 'Aya Gold & Silver Inc.',
  'CCO': 'Cameco Corporation',
  'CCO.TO': 'Cameco Corporation',
  'VMET': 'Versamet Royalties Corp.',
  'VMET.TO': 'Versamet Royalties Corp.',
  'TSK': 'Talisker Resources Ltd.',
  'TSK.TO': 'Talisker Resources Ltd.',
  'ELE': 'Elemental Altus Royalties Corp.',
  'ELE.TO': 'Elemental Altus Royalties Corp.',
  'FNV': 'Franco-Nevada Corporation',
  'FNV.TO': 'Franco-Nevada Corporation',
  'MDA': 'MDA Space Ltd.',
  'MDA.TO': 'MDA Space Ltd.',
  'BCE': 'BCE Inc.',
  'BCE.TO': 'BCE Inc.',
  'EDR': 'Endeavour Silver Corp.',
  'EDR.TO': 'Endeavour Silver Corp.',
  'VZLA': 'Vizsla Silver Corp.',
  'VZLA.TO': 'Vizsla Silver Corp.',
  'WPM': 'Wheaton Precious Metals Corp.',
  'WPM.TO': 'Wheaton Precious Metals Corp.',
  'AEM': 'Agnico Eagle Mines Limited',
  'AEM.TO': 'Agnico Eagle Mines Limited',
  'BN': 'Brookfield Corporation',
  'BN.TO': 'Brookfield Corporation',
  'LIB': 'Libertystream Infrastructure Partners Inc.',
  'LIB.V': 'Libertystream Infrastructure Partners Inc.',
  'PAAS': 'Pan American Silver Corp.',
  'PAAS.TO': 'Pan American Silver Corp.',
};

export function getCanonicalCompanyName(symbol: string, defaultName?: string): string {
  if (!symbol) return defaultName || '';
  const clean = symbol.trim().toUpperCase();
  return CANONICAL_COMPANY_NAMES[clean] || defaultName || clean;
}

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
    if (currency === 'CAD') {
      if (cleanRaw === 'AGX') return 'AGX.V';
      if (cleanRaw === 'GTII') return 'GTII.CN';
      if (cleanRaw === 'GRID') return 'GRID.TO';
      if (cleanRaw === 'SWA') return 'SWA.V';
      if (cleanRaw === 'PNG') return 'PNG.V';
      if (cleanRaw === 'BOGO') return 'BOGO.V';
      if (cleanRaw === 'LIB') return 'LIB.V';
      if (cleanRaw === 'DMET') return 'DMET.NE';
      if (cleanRaw === 'ZDC') return 'ZDC.V';
      if (cleanRaw === 'HSTR') return 'HSTR.V';
      if (cleanRaw === 'EMPR') return 'EMPR.V';
      if (cleanRaw === 'AUMB') return 'AUMB.V';
      if (cleanRaw === 'BYN') return 'BYN.V';
      if (cleanRaw === 'SICO') return 'SICO.V';
      if (cleanRaw === 'NOM') return 'NOM.CN';
      return `${cleanRaw}.TO`;
    }
  }

  return cleanRaw;
}
