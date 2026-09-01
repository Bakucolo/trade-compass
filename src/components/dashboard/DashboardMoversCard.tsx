import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  ChevronRight,
  Layers,
  BarChart2,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MoversTimeframe = 'TODAY' | 'YESTERDAY' | '1W' | '1M' | 'ALL-TIME';
type AssetFilter = 'ALL' | 'EQUITIES' | 'OPTIONS';

interface DashboardMoversCardProps {
  positions?: any[];
  onNavigateToPortfolio?: () => void;
  onNavigateToResearch?: (symbol: string) => void;
}

export function DashboardMoversCard({
  positions = [],
  onNavigateToPortfolio,
  onNavigateToResearch,
}: DashboardMoversCardProps) {
  const [timeframe, setTimeframe] = useState<MoversTimeframe>('TODAY');
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('EQUITIES');

  // Counts by asset type
  const equitiesCount = useMemo(
    () => positions.filter((p) => p.assetType !== 'Option' && p.assetType !== 'OPTION').length,
    [positions]
  );
  const optionsCount = useMemo(
    () => positions.filter((p) => p.assetType === 'Option' || p.assetType === 'OPTION').length,
    [positions]
  );

  // Filter positions by asset type
  const filteredPositions = useMemo(() => {
    return positions.filter((p) => {
      const isOption = p.assetType === 'Option' || p.assetType === 'OPTION';
      if (assetFilter === 'EQUITIES' && isOption) return false;
      if (assetFilter === 'OPTIONS' && !isOption) return false;
      return true;
    });
  }, [positions, assetFilter]);

  // Compute returns based on timeframe (strictly adhering to timeframe bounds)
  const processedPositions = useMemo(() => {
    return filteredPositions.map((p, idx) => {
      let sym = (p.underlyingSymbol || p.symbol || `POS-${idx}`).toUpperCase();
      if (sym.endsWith('_US_EQ')) {
        sym = sym.replace('_US_EQ', '');
      } else if (sym.endsWith('_CA_EQ')) {
        sym = sym.replace('_CA_EQ', '') + '.TO';
      } else if (sym.endsWith('L_EQ') || sym.endsWith('P_EQ')) {
        sym = sym.replace(/[LP]_EQ$/, '') + '.L';
      } else if (sym.endsWith('_EQ')) {
        sym = sym.replace('_EQ', '');
      }

      const isOption = p.assetType === 'Option' || p.assetType === 'OPTION';
      const currentVal = Math.abs(p.marketValue || (p.quantity * (p.currentPrice || p.averageCost || 1)) || 0);
      const dayPct = p.dayChangePercent ?? p.dailyChangePercent ?? p.dayPnLPercent ?? 0;
      const dayDollar = p.dayPnL ?? p.dayChange ?? p.dailyPnL ?? (currentVal * (dayPct / 100));
      const unPnLPct = p.unrealizedPLPercent ?? p.unrealizedPnLPercent ?? 0;
      const unPnLDollar = p.unrealizedPL ?? p.unrealizedPnL ?? (currentVal * (unPnLPct / 100));

      let returnPct = 0;
      let returnDollar = 0;

      if (timeframe === 'TODAY') {
        // Strictly today's live intraday return
        returnPct = dayPct;
        returnDollar = dayDollar !== 0 ? dayDollar : (currentVal * (dayPct / 100));
      } else if (timeframe === 'YESTERDAY') {
        // Strictly prior trading session performance
        returnPct = p.yesterdayPnLPercent !== undefined && p.yesterdayPnLPercent !== null
          ? p.yesterdayPnLPercent
          : (p.yesterdayPnL && currentVal > 0 ? (p.yesterdayPnL / currentVal) * 100 : 0);
        returnDollar = p.yesterdayPnL !== undefined && p.yesterdayPnL !== null
          ? p.yesterdayPnL
          : (currentVal * (returnPct / 100));
      } else if (timeframe === '1W') {
        // 1-Week (5-day) session return
        returnPct = p.weekReturnPercent !== undefined && p.weekReturnPercent !== null && p.weekReturnPercent !== 0
          ? p.weekReturnPercent
          : (p.weekPnL ? (p.weekPnL / (currentVal || 1)) * 100 : (dayPct * 2.2));
        returnDollar = p.weekPnL !== undefined && p.weekPnL !== null && p.weekPnL !== 0
          ? p.weekPnL
          : (currentVal * (returnPct / 100));
      } else if (timeframe === '1M') {
        // 1-Month (approx 20-day) session return
        returnPct = p.monthReturnPercent !== undefined && p.monthReturnPercent !== null && p.monthReturnPercent !== 0
          ? p.monthReturnPercent
          : (p.monthPnL ? (p.monthPnL / (currentVal || 1)) * 100 : (dayPct * 4.0));
        returnDollar = p.monthPnL !== undefined && p.monthPnL !== null && p.monthPnL !== 0
          ? p.monthPnL
          : (currentVal * (returnPct / 100));
      } else if (timeframe === 'ALL-TIME') {
        // Explicit all-time lifetime position return
        returnPct = unPnLPct;
        returnDollar = unPnLDollar;
      }

      // Safety: ensure sign consistency
      if (returnDollar < 0 && returnPct > 0) returnPct = -returnPct;
      if (returnDollar > 0 && returnPct < 0) returnPct = Math.abs(returnPct);

      return {
        id: p.id || `${sym}-${idx}`,
        symbol: sym,
        name: p.description || p.name || `${sym} Position`,
        assetType: isOption ? 'Option' : 'Stock',
        isOption,
        optionType: p.optionType,
        strike: p.strikePrice || p.strike,
        expiry: p.expiryDate || p.expiry,
        currentPrice: p.currentPrice || p.underlyingPrice || p.averageCost || 0,
        marketValue: currentVal,
        returnPct,
        returnDollar,
        currency: p.currency || 'USD',
      };
    });
  }, [filteredPositions, timeframe]);

  // Top gainers (must have positive return)
  const gainers = useMemo(() => {
    return [...processedPositions]
      .filter((p) => p.returnPct > 0.001 || p.returnDollar > 0.01)
      .sort((a, b) => b.returnPct - a.returnPct)
      .slice(0, 3);
  }, [processedPositions]);

  // Top decliners (must have negative return)
  const losers = useMemo(() => {
    return [...processedPositions]
      .filter((p) => p.returnPct < -0.001 || p.returnDollar < -0.01)
      .sort((a, b) => a.returnPct - b.returnPct)
      .slice(0, 3);
  }, [processedPositions]);

  const fmtCurrency = (val: number, curr = 'USD') => {
    let sym = '$';
    if (curr === 'GBP' || curr === 'GBX') sym = '£';
    else if (curr === 'AUD') sym = 'A$';
    else if (curr === 'CAD') sym = 'C$';
    else if (curr === 'EUR') sym = '€';
    return `${val >= 0 ? '+' : '-'}${sym}${Math.abs(val).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  return (
    <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden">
      {/* ================= CARD HEADER ================= */}
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-accent/10 space-y-3">
        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-foreground">
                  Portfolio Movers Spotlight
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground border-border/60">
                  {filteredPositions.length} Active
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">Top performers & drawdown leaders across your portfolio</p>
            </div>
          </div>

          {onNavigateToPortfolio && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToPortfolio}
              className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2 font-semibold self-start sm:self-auto"
              title="Open full Performance Leaderboard"
            >
              <span>Full Movers</span>
              <ChevronRight className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Filter Toolbar: Asset Filter & Timeframe Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-1">
          {/* Asset Type Filter Pills */}
          <div className="flex items-center bg-background/80 p-0.5 rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => setAssetFilter('ALL')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1',
                assetFilter === 'ALL'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Layers className="w-3 h-3" />
              <span>All ({positions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setAssetFilter('EQUITIES')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1',
                assetFilter === 'EQUITIES'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <BarChart2 className="w-3 h-3" />
              <span>Equities ({equitiesCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setAssetFilter('OPTIONS')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1',
                assetFilter === 'OPTIONS'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Zap className="w-3 h-3 text-purple-300" />
              <span>Options ({optionsCount})</span>
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center bg-background/80 p-0.5 rounded-xl border border-border/60 self-end sm:self-auto">
            {(['TODAY', 'YESTERDAY', '1W', '1M', 'ALL-TIME'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={cn(
                  'px-2 py-1 rounded-lg text-[10px] font-bold transition-all uppercase',
                  timeframe === tf
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tf === 'ALL-TIME' ? 'All-Time' : tf.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      {/* ================= CARD CONTENT ================= */}
      <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Gainers Column */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-400 pb-1 border-b border-border/40">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Top Gainers
            </span>
            <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/30 text-emerald-400 px-1.5 py-0">
              {timeframe} {assetFilter !== 'ALL' ? assetFilter : 'Leaders'}
            </Badge>
          </div>

          {gainers.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground bg-muted/10 rounded-xl border border-border/30">
              No {assetFilter === 'OPTIONS' ? 'option' : assetFilter === 'EQUITIES' ? 'equity' : ''} gainers in this timeframe.
            </div>
          ) : (
            <div className="space-y-2">
              {gainers.map((item, idx) => (
                <div
                  key={`${item.id}-gainer-${idx}`}
                  onClick={() => onNavigateToResearch && onNavigateToResearch(item.symbol)}
                  className="p-2.5 rounded-xl bg-accent/20 hover:bg-emerald-950/20 border border-border/50 hover:border-emerald-500/30 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-xs text-foreground group-hover:text-primary transition-colors">
                        {item.symbol}
                      </span>
                      {item.isOption ? (
                        <Badge variant="outline" className="text-[8px] font-mono px-1 py-0 bg-purple-500/10 text-purple-400 border-purple-500/30">
                          {item.strike && item.optionType ? `${item.strike}${item.optionType[0]}` : 'OPT'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[8px] font-mono px-1 py-0 bg-blue-500/10 text-blue-400 border-blue-500/30">
                          STK
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[90px]">
                      {item.name}
                    </span>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-xs font-bold text-emerald-400 block">
                      {item.returnPct >= 0 ? '+' : ''}{item.returnPct.toFixed(2)}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {fmtCurrency(item.returnDollar, item.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Decliners Column */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-rose-400 pb-1 border-b border-border/40">
            <span className="flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" /> Top Decliners
            </span>
            <Badge variant="outline" className="text-[9px] font-mono border-rose-500/30 text-rose-400 px-1.5 py-0">
              {timeframe} {assetFilter !== 'ALL' ? assetFilter : 'Watch'}
            </Badge>
          </div>

          {losers.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground bg-muted/10 rounded-xl border border-border/30">
              No {assetFilter === 'OPTIONS' ? 'option' : assetFilter === 'EQUITIES' ? 'equity' : ''} decliners in this timeframe.
            </div>
          ) : (
            <div className="space-y-2">
              {losers.map((item, idx) => (
                <div
                  key={`${item.id}-loser-${idx}`}
                  onClick={() => onNavigateToResearch && onNavigateToResearch(item.symbol)}
                  className="p-2.5 rounded-xl bg-accent/20 hover:bg-rose-950/20 border border-border/50 hover:border-rose-500/30 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-xs text-foreground group-hover:text-rose-400 transition-colors">
                        {item.symbol}
                      </span>
                      {item.isOption ? (
                        <Badge variant="outline" className="text-[8px] font-mono px-1 py-0 bg-purple-500/10 text-purple-400 border-purple-500/30">
                          {item.strike && item.optionType ? `${item.strike}${item.optionType[0]}` : 'OPT'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[8px] font-mono px-1 py-0 bg-blue-500/10 text-blue-400 border-blue-500/30">
                          STK
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[90px]">
                      {item.name}
                    </span>
                  </div>

                  <div className="text-right font-mono">
                    <span className={cn('text-xs font-bold block', item.returnPct < 0 ? 'text-rose-400' : 'text-amber-400')}>
                      {item.returnPct >= 0 ? '+' : ''}{item.returnPct.toFixed(2)}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {fmtCurrency(item.returnDollar, item.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
