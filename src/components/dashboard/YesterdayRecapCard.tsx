import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Flame,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Activity,
  Layers,
  Zap,
  Loader2,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface YesterdayRecapCardProps {
  positions?: any[];
  yesterdayPnL?: number;
  totalPortfolioValue?: number;
  isLoading?: boolean;
  isPrivacyMode?: boolean;
  onNavigateToPortfolio?: () => void;
  onNavigateToResearch?: (symbol: string) => void;
}

export function YesterdayRecapCard({
  positions = [],
  yesterdayPnL = 0,
  totalPortfolioValue = 150000,
  isLoading = false,
  isPrivacyMode = false,
  onNavigateToPortfolio,
  onNavigateToResearch,
}: YesterdayRecapCardProps) {
  // Compute normalized session performance items (strictly prior session / overnight)
  const normalizedPositions = positions.map((p) => {
    const sym = (p.underlyingSymbol || p.symbol || '').toUpperCase();
    const mktVal = Math.abs(p.marketValue || 0);

    // Strictly prior session performance (yesterday)
    let returnDollar = p.yesterdayPnL !== undefined && p.yesterdayPnL !== null
      ? p.yesterdayPnL
      : (p.yesterdayPnLPercent !== undefined && p.yesterdayPnLPercent !== null && p.yesterdayPnLPercent !== 0
        ? mktVal * (p.yesterdayPnLPercent / 100)
        : 0);

    let returnPct = p.yesterdayPnLPercent !== undefined && p.yesterdayPnLPercent !== null
      ? p.yesterdayPnLPercent
      : (mktVal > 0 && returnDollar !== 0 ? (returnDollar / mktVal) * 100 : 0);

    const overnightGapPct = p.overnightGapPercent ?? 0;

    // Cross-fill if only one metric is available
    if (returnDollar === 0 && returnPct !== 0 && mktVal > 0) {
      returnDollar = mktVal * (returnPct / 100);
    } else if (returnPct === 0 && returnDollar !== 0 && mktVal > 0) {
      returnPct = (returnDollar / mktVal) * 100;
    }

    // Sign consistency & percentage safety
    if (returnDollar < 0 && returnPct > 0) returnPct = -returnPct;
    if (returnDollar > 0 && returnPct < 0) returnPct = Math.abs(returnPct);

    return {
      symbol: sym,
      name: p.description || p.name || `${sym} Position`,
      assetType: p.assetType,
      currentPrice: p.currentPrice || p.averageCost || 0,
      marketValue: mktVal,
      returnDollar,
      returnPct,
      overnightGapPct,
      currency: p.currency || 'USD',
    };
  });

  // Filter advancing and declining positions in prior session
  const advancers = normalizedPositions.filter((p) => p.returnDollar > 0.001 || p.returnPct > 0.001);
  const decliners = normalizedPositions.filter((p) => p.returnDollar < -0.001 || p.returnPct < -0.001);
  const flatCount = normalizedPositions.length - advancers.length - decliners.length;

  // Top positive driver (highest session dollar gain or percentage)
  const topGainer = advancers.length > 0
    ? [...advancers].sort((a, b) => b.returnDollar - a.returnDollar)[0]
    : null;

  // Biggest negative drag (lowest session dollar loss)
  const topLoser = decliners.length > 0
    ? [...decliners].sort((a, b) => a.returnDollar - b.returnDollar)[0]
    : null;

  const totalActiveMovers = advancers.length + decliners.length;
  const advancePercent = totalActiveMovers > 0
    ? Math.min(100, Math.max(0, Math.round((advancers.length / totalActiveMovers) * 100)))
    : 50;

  // Prior session total return %
  const effectiveYesterdayPnL = yesterdayPnL !== 0
    ? yesterdayPnL
    : normalizedPositions.reduce((acc, p) => acc + p.returnDollar, 0);

  const yesterdayPnLPct = totalPortfolioValue > 0
    ? (effectiveYesterdayPnL / totalPortfolioValue) * 100
    : 0;

  // Average overnight gap across active movers
  const validGaps = normalizedPositions.filter((p) => p.overnightGapPct !== 0);
  const avgOvernightGap = validGaps.length > 0
    ? validGaps.reduce((acc, p) => acc + p.overnightGapPct, 0) / validGaps.length
    : 0;

  const isNetPositive = effectiveYesterdayPnL > 0 || (effectiveYesterdayPnL === 0 && advancers.length >= decliners.length);

  const fmtCurrency = (val: number, curr = 'USD') => {
    if (isPrivacyMode) return '••••••';
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
    <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden relative group">
      {/* Top Gradient Line */}
      <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500" />

      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-accent/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold text-foreground">
                Yesterday & Overnight Market Pulse
              </CardTitle>
              {isLoading && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Prior session performance & overnight market telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Aggregate Yesterday P&L Pill */}
          <Badge
            variant="outline"
            className={cn(
              'text-xs font-mono font-bold px-2.5 py-1 flex items-center gap-1.5 shadow-sm',
              isNetPositive
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            )}
          >
            {isNetPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            <span>
              {fmtCurrency(effectiveYesterdayPnL)}
              <span className="opacity-80 font-normal ml-1">
                ({yesterdayPnLPct >= 0 ? '+' : ''}{yesterdayPnLPct.toFixed(2)}%)
              </span>
            </span>
          </Badge>

          {/* Overnight Gap Pill */}
          {avgOvernightGap !== 0 && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono font-semibold px-2 py-0.5 hidden sm:flex items-center gap-1',
                avgOvernightGap >= 0
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              )}
            >
              <Moon className="w-2.5 h-2.5" />
              <span>Gap: {avgOvernightGap >= 0 ? '+' : ''}{avgOvernightGap.toFixed(2)}%</span>
            </Badge>
          )}

          {onNavigateToPortfolio && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToPortfolio}
              className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2 font-semibold ml-auto sm:ml-0"
              title="Open full Performance Leaderboard"
            >
              <span>Leaderboard</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Top Driver vs Biggest Drag Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Top Driver */}
          {isLoading ? (
            <div className="p-3.5 rounded-xl bg-accent/20 border border-border/40 animate-pulse flex items-center gap-3 h-16">
              <div className="w-10 h-10 rounded-xl bg-muted/40" />
              <div className="space-y-1.5 flex-1">
                <div className="w-16 h-3.5 bg-muted/40 rounded" />
                <div className="w-28 h-2.5 bg-muted/30 rounded" />
              </div>
            </div>
          ) : topGainer ? (
            <div
              onClick={() => onNavigateToResearch && onNavigateToResearch(topGainer.symbol)}
              className="p-3.5 rounded-xl bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-800/40 transition-all cursor-pointer group/card flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-mono font-bold text-xs text-emerald-400">
                  {topGainer.symbol.slice(0, 4)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-xs text-foreground group-hover/card:text-primary transition-colors">
                      {topGainer.symbol}
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] px-1 py-0 h-4 uppercase font-bold">
                      Top Driver
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                    {topGainer.name}
                  </p>
                </div>
              </div>

              <div className="text-right font-mono">
                <span className="text-xs font-bold text-emerald-400 block">
                  {fmtCurrency(topGainer.returnDollar, topGainer.currency)}
                </span>
                <span className="text-[10px] text-emerald-400/90 font-bold">
                  {topGainer.returnPct >= 0 ? '+' : ''}{topGainer.returnPct.toFixed(2)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-accent/20 border border-border/40 text-center text-xs text-muted-foreground flex items-center justify-center h-16">
              No advancing positions in session
            </div>
          )}

          {/* Biggest Drag */}
          {isLoading ? (
            <div className="p-3.5 rounded-xl bg-accent/20 border border-border/40 animate-pulse flex items-center gap-3 h-16">
              <div className="w-10 h-10 rounded-xl bg-muted/40" />
              <div className="space-y-1.5 flex-1">
                <div className="w-16 h-3.5 bg-muted/40 rounded" />
                <div className="w-28 h-2.5 bg-muted/30 rounded" />
              </div>
            </div>
          ) : topLoser ? (
            <div
              onClick={() => onNavigateToResearch && onNavigateToResearch(topLoser.symbol)}
              className={cn(
                "p-3.5 rounded-xl transition-all cursor-pointer group/card flex items-center justify-between border",
                topLoser.returnDollar < 0
                  ? "bg-rose-950/20 hover:bg-rose-950/30 border-rose-800/40"
                  : "bg-amber-950/20 hover:bg-amber-950/30 border-amber-800/40"
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-10 h-10 rounded-xl border flex items-center justify-center font-mono font-bold text-xs",
                  topLoser.returnDollar < 0
                    ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                    : "bg-amber-500/20 border-amber-500/40 text-amber-400"
                )}>
                  {topLoser.symbol.slice(0, 4)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-xs group-hover/card:text-primary transition-colors text-foreground">
                      {topLoser.symbol}
                    </span>
                    <Badge className={cn(
                      "text-[9px] px-1 py-0 h-4 uppercase font-bold",
                      topLoser.returnDollar < 0
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    )}>
                      Lagging Drag
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                    {topLoser.name}
                  </p>
                </div>
              </div>

              <div className="text-right font-mono">
                <span className={cn(
                  "text-xs font-bold block",
                  topLoser.returnDollar < 0 ? "text-rose-400" : "text-amber-400"
                )}>
                  {fmtCurrency(topLoser.returnDollar, topLoser.currency)}
                </span>
                <span className={cn(
                  "text-[10px] font-bold",
                  topLoser.returnDollar < 0 ? "text-rose-400/90" : "text-amber-400/90"
                )}>
                  {topLoser.returnPct >= 0 ? '+' : ''}{topLoser.returnPct.toFixed(2)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-accent/20 border border-border/40 text-center text-xs text-muted-foreground flex items-center justify-center h-16">
              No declining positions in session
            </div>
          )}
        </div>

        {/* Portfolio Market Breadth Barometer */}
        <div className="p-3.5 rounded-xl bg-background/50 border border-border/50 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] flex items-center gap-1">
              <Activity className="w-3 h-3 text-primary" /> Portfolio Breadth Barometer
            </span>
            <div className="flex items-center gap-2 font-mono font-bold text-[11px]">
              <span className="text-emerald-400">{advancers.length} Advancing</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-rose-400">{decliners.length} Declining</span>
              {flatCount > 0 && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{flatCount} Flat</span>
                </>
              )}
              <span className="text-muted-foreground">({advancePercent}% Advance Ratio)</span>
            </div>
          </div>

          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex border border-border/40">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.max(2, advancePercent)}%` }}
              title={`${advancePercent}% Advancing Positions`}
            />
            <div
              className="h-full bg-rose-500 transition-all duration-500"
              style={{ width: `${Math.max(2, 100 - advancePercent)}%` }}
              title={`${100 - advancePercent}% Declining Positions`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
