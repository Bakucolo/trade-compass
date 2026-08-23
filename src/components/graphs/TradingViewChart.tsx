import React, { useEffect, useRef, memo } from 'react';

interface TradingViewChartProps {
  symbol: string;
  theme?: 'dark' | 'light';
  autosize?: boolean;
  interval?: string;
  className?: string;
}

// Convert internal ticker conventions to TradingView format
function formatTradingViewSymbol(symbol: string): string {
  if (!symbol) return 'NASDAQ:AAPL';
  const clean = symbol.trim().toUpperCase();

  // UK London Stock Exchange (.L)
  if (clean.endsWith('.L')) {
    const base = clean.replace('.L', '');
    return `LON:${base}`;
  }

  // Australian Stock Exchange (.AX)
  if (clean.endsWith('.AX')) {
    const base = clean.replace('.AX', '');
    return `ASX:${base}`;
  }

  // Canadian Stock Exchange (.TO / .V)
  if (clean.endsWith('.TO')) {
    const base = clean.replace('.TO', '');
    return `TSX:${base}`;
  }
  if (clean.endsWith('.V')) {
    const base = clean.replace('.V', '');
    return `TSXV:${base}`;
  }

  // European Exchanges (.DE, .PA, .AS)
  if (clean.endsWith('.DE')) {
    return `XETR:${clean.replace('.DE', '')}`;
  }
  if (clean.endsWith('.PA')) {
    return `EURONEXT:${clean.replace('.PA', '')}`;
  }

  // Option contracts (detect OCC format e.g. AAPL250117C00200000 or with spaces)
  if (/^[A-Z]{1,6}\s*\d{6}[CP]\d{8}$/.test(clean)) {
    const match = clean.match(/^([A-Z]{1,6})/);
    if (match) return match[1];
  }

  // Common known exchanges for US stocks
  const nasdaqLeaders = [
    'AAPL', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'GOOG', 'META', 'TSLA', 
    'PLTR', 'AMD', 'INTC', 'QCOM', 'NFLX', 'COST', 'AVGO', 'ADBE', 
    'CSCO', 'PEP', 'TXN', 'AMGN', 'CMCSA', 'HON', 'SBUX', 'BKNG', 
    'GILD', 'MDLZ', 'VRTX', 'ADP', 'ADI', 'LRCX', 'PANW', 'MU', 
    'SNPS', 'CDNS', 'KLAC', 'MELI', 'CRWD', 'ARM', 'WDAY', 'ABNB',
    'MRVL', 'ORLY', 'CTAS', 'NXPI', 'MAR', 'PYPL', 'FTNT', 'FLEX'
  ];

  if (nasdaqLeaders.includes(clean)) {
    return `NASDAQ:${clean}`;
  }

  // Default fallback
  return clean;
}

function TradingViewChartComponent({
  symbol,
  theme = 'dark',
  autosize = true,
  interval = 'D',
  className = '',
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = useRef(`tradingview_${Math.random().toString(36).substring(2, 9)}`);

  const tvSymbol = formatTradingViewSymbol(symbol);

  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    // Clear previous widget
    currentContainer.innerHTML = '';

    // Create wrapper div with unique ID
    const widgetDiv = document.createElement('div');
    widgetDiv.id = containerId.current;
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    currentContainer.appendChild(widgetDiv);

    // Create and attach TradingView script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => {
      if (typeof (window as any).TradingView !== 'undefined') {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: interval,
          timezone: 'exchange',
          theme: theme,
          style: '1', // Candlesticks
          locale: 'en',
          toolbar_bg: '#0f172a',
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: containerId.current,
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
      }
    };

    currentContainer.appendChild(script);

    return () => {
      if (currentContainer) {
        currentContainer.innerHTML = '';
      }
    };
  }, [tvSymbol, theme, interval]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full min-h-[500px] overflow-hidden rounded-2xl border border-border/50 bg-slate-950/70 shadow-2xl relative ${className}`}
    />
  );
}

export const TradingViewChart = memo(TradingViewChartComponent);
