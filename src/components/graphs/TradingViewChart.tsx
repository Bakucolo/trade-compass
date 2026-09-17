import React, { useEffect, useRef, memo } from 'react';

interface TradingViewChartProps {
  symbol: string;
  theme?: 'dark' | 'light';
  autosize?: boolean;
  interval?: string;
  timeframe?: string;
  height?: number | string;
  className?: string;
}

// Convert internal ticker conventions to TradingView format
export function formatTradingViewSymbol(symbol: string): string {
  if (!symbol) return 'NASDAQ:AAPL';
  let clean = symbol.trim().toUpperCase();

  // If already prefixed with exchange (e.g. NASDAQ:AAPL, NYSE:CCJ, AMEX:SPY, BINANCE:BTCUSDT)
  if (clean.includes(':')) {
    return clean;
  }

  // UK London Stock Exchange (.L)
  if (clean.endsWith('.L')) {
    const base = clean.replace(/\.L$/, '');
    return `LON:${base}`;
  }

  // Australian Stock Exchange (.AX)
  if (clean.endsWith('.AX')) {
    const base = clean.replace(/\.AX$/, '');
    return `ASX:${base}`;
  }

  // Canadian Stock Exchange (.TO / .V)
  if (clean.endsWith('.TO')) {
    const base = clean.replace(/\.TO$/, '');
    return `TSX:${base}`;
  }
  if (clean.endsWith('.V')) {
    const base = clean.replace(/\.V$/, '');
    return `TSXV:${base}`;
  }

  // European Exchanges (.DE, .PA, .AS)
  if (clean.endsWith('.DE')) {
    return `XETR:${clean.replace(/\.DE$/, '')}`;
  }
  if (clean.endsWith('.PA') || clean.endsWith('.AS')) {
    return `EURONEXT:${clean.replace(/\.(PA|AS)$/, '')}`;
  }

  // Option contracts (detect OCC format e.g. AAPL250117C00200000 or with spaces)
  if (/^[A-Z]{1,6}\s*\d{6}[CP]\d{8}$/.test(clean)) {
    const match = clean.match(/^([A-Z]{1,6})/);
    if (match) clean = match[1];
  }

  // Major US ETFs (primarily AMEX / ARCA)
  const amexEtfs = [
    'SPY', 'IVV', 'VOO', 'IWM', 'DIA', 'VTI', 'VEA', 'VWO', 'EEM', 'EFA',
    'TLT', 'IEF', 'SHY', 'BND', 'AGG', 'GLD', 'SLV', 'IAU', 'GDX', 'GDXJ',
    'SIL', 'USO', 'UNG', 'DBC', 'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLY',
    'XLP', 'XLU', 'XLB', 'XLRE', 'XLC', 'XBI', 'KRE', 'XOP', 'SMH', 'SOXL',
    'SOXS', 'TQQQ', 'SQQQ', 'ARKK', 'ARKG', 'ARKW', 'ARKF', 'ARKX', 'URA',
    'URNM', 'URNJ', 'NLR', 'TAN', 'ICLN', 'LIT', 'COPX', 'JETS', 'IBIT',
    'FBTC', 'BITO'
  ];
  if (amexEtfs.includes(clean)) {
    return `AMEX:${clean}`;
  }

  // Major NASDAQ Stocks
  const nasdaqLeaders = [
    'AAPL', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'GOOG', 'META', 'TSLA', 
    'PLTR', 'AMD', 'INTC', 'QCOM', 'NFLX', 'COST', 'AVGO', 'ADBE', 
    'CSCO', 'PEP', 'TXN', 'AMGN', 'CMCSA', 'HON', 'SBUX', 'BKNG', 
    'GILD', 'MDLZ', 'VRTX', 'ADP', 'ADI', 'LRCX', 'PANW', 'MU', 
    'SNPS', 'CDNS', 'KLAC', 'MELI', 'CRWD', 'ARM', 'WDAY', 'ABNB',
    'MRVL', 'ORLY', 'CTAS', 'NXPI', 'MAR', 'PYPL', 'FTNT', 'FLEX',
    'QQQ', 'COIN', 'MSTR', 'HOOD', 'ROKU', 'DKNG', 'ENPH', 'SEDG',
    'ZS', 'DDOG', 'TEAM', 'ZM', 'DOCU', 'RIVN', 'LCID', 'AFRM',
    'SOFI', 'RKLB', 'ASTS', 'LUNR', 'PLUG', 'MARA', 'RIOT', 'CLSK',
    'HUT', 'SMCI', 'APP', 'PDD', 'BIDU', 'JD', 'SOXX'
  ];
  if (nasdaqLeaders.includes(clean)) {
    return `NASDAQ:${clean}`;
  }

  // Major NYSE Stocks
  const nyseLeaders = [
    'CCJ', 'SMR', 'OKLO', 'VST', 'GE', 'BA', 'CAT', 'DE', 'MMM', 'LMT',
    'RTX', 'NOC', 'GD', 'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'OXY', 'MPC',
    'PSX', 'VLO', 'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'BLK', 'SCHW',
    'AXP', 'V', 'MA', 'UNH', 'LLY', 'JNJ', 'PFE', 'ABBV', 'MRK', 'BMY',
    'TMO', 'DHR', 'ABT', 'MDT', 'WMT', 'TGT', 'HD', 'LOW', 'NKE', 'MCD',
    'KO', 'PG', 'CL', 'DIS', 'VZ', 'T', 'BABA', 'NIO', 'TSM', 'BTI',
    'RIO', 'BHP', 'VALE', 'SNOW', 'U', 'NET', 'NOW', 'CRM', 'ORCL',
    'IBM', 'UBER', 'SPOT'
  ];
  if (nyseLeaders.includes(clean)) {
    return `NYSE:${clean}`;
  }

  // Default fallback (TradingView resolves standard tickers without prefix across US exchanges)
  return clean;
}

function TradingViewChartComponent({
  symbol,
  theme = 'dark',
  autosize = true,
  interval = 'D',
  timeframe,
  height,
  className = '',
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartDivIdRef = useRef(`tv_chart_${Math.random().toString(36).substring(2, 9)}`);

  const tvSymbol = formatTradingViewSymbol(symbol);
  const chartInterval = interval || timeframe || 'D';

  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    // Assign a fresh unique ID for this container and mount
    const currentId = `tv_chart_${Math.random().toString(36).substring(2, 9)}`;
    chartDivIdRef.current = currentId;

    // Clear previous widget completely
    currentContainer.innerHTML = '';

    // Create wrapper div with unique ID
    const widgetDiv = document.createElement('div');
    widgetDiv.id = currentId;
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    currentContainer.appendChild(widgetDiv);

    let isDisposed = false;

    const renderWidget = () => {
      if (isDisposed || !document.getElementById(currentId)) return;
      if (typeof (window as any).TradingView !== 'undefined') {
        try {
          new (window as any).TradingView.widget({
            autosize: autosize,
            symbol: tvSymbol,
            interval: chartInterval,
            timezone: 'exchange',
            theme: theme,
            style: '1', // Candlesticks
            locale: 'en',
            toolbar_bg: '#0f172a',
            enable_publishing: false,
            allow_symbol_change: true,
            container_id: currentId,
            hide_side_toolbar: false,
            withdateranges: true,
            save_image: true,
            studies: [
              'MASimple@tv-basicstudies',
              'RSI@tv-basicstudies',
              'Volume@tv-basicstudies'
            ],
            show_popup_button: true,
            popup_width: '1000',
            popup_height: '650',
            disabled_features: ['header_saveload'],
            enabled_features: ['move_logo_to_main_pane', 'study_templates'],
            overrides: {
              'mainSeriesProperties.candleStyle.upColor': '#10b981',
              'mainSeriesProperties.candleStyle.downColor': '#f43f5e',
              'mainSeriesProperties.candleStyle.drawWick': true,
              'mainSeriesProperties.candleStyle.drawBorder': true,
              'mainSeriesProperties.candleStyle.borderColor': '#374151',
              'mainSeriesProperties.candleStyle.borderUpColor': '#10b981',
              'mainSeriesProperties.candleStyle.borderDownColor': '#f43f5e',
              'mainSeriesProperties.candleStyle.wickUpColor': '#10b981',
              'mainSeriesProperties.candleStyle.wickDownColor': '#f43f5e',
              'paneProperties.background': '#090d16',
              'paneProperties.vertGridProperties.color': 'rgba(255, 255, 255, 0.04)',
              'paneProperties.horzGridProperties.color': 'rgba(255, 255, 255, 0.04)',
            }
          });
        } catch (err) {
          console.error('[TradingViewChart] Failed to initialize widget:', err);
        }
      }
    };

    // If TradingView script is already loaded on window, initialize immediately!
    if (typeof (window as any).TradingView !== 'undefined') {
      renderWidget();
    } else {
      let script = document.getElementById('tradingview-tv-js') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = 'tradingview-tv-js';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.type = 'text/javascript';
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderWidget);
    }

    return () => {
      isDisposed = true;
      if (currentContainer) {
        currentContainer.innerHTML = '';
      }
    };
  }, [tvSymbol, theme, chartInterval, autosize]);

  return (
    <div
      ref={containerRef}
      style={height ? { height: typeof height === 'number' ? `${height}px` : height } : undefined}
      className={`w-full h-full min-h-[500px] overflow-hidden rounded-2xl border border-border/50 bg-slate-950/70 shadow-2xl relative ${className}`}
    />
  );
}

export const TradingViewChart = memo(TradingViewChartComponent);
