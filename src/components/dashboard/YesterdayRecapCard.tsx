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
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface YesterdayRecapCardProps {
  positions?: any[];
  yesterdayPnL?: number;
  totalPortfolioValue?: number;
  onNavigateToPortfolio?: () => void;
  onNavigateToResearch?: (symbol: string) => void;
}

export function YesterdayRecapCard({
  positions = [],
  yesterdayPnL = 0,
  totalPortfolioValue = 150000,
  onNavigateToPortfolio,
  onNavigateToResearch,
}: YesterdayRecapCardProps) {
  // Check if any position has active daily P&L
  const hasActiveDayData = positions.some(
    (p) => (p.dayPnL && p.dayPnL !== 0) || (p.dayChange && p.dayChange !== 0) || (p.dayChangePercent && p.dayChangePercent !== 0)
  );

  // Compute normalized performance items
  const normalizedPositions = positions.map((p) => {
    const sym = (p.underlyingSymbol || p.symbol || '').toUpperCase();
    const mktVal = Math.abs(p.marketValue || 0);

    let returnDollar = 0;
    let returnPct = 0;
    let isDayBasis = false;

    const dDollar = p.dayPnL ?? p.dayChange ?? p.dailyPnL ?? 0;
    const dPct = p.dayPnLPercent ?? p.dayChangePercent ?? p.dailyChangePercent ?? 0;

    if (hasActiveDayData && (dDollar !== 0 || dPct !== 0)) {
      returnDollar = dDollar !== 0 ? dDollar : (mktVal > 0 ? (mktVal * (dPct / 100)) : 0);
      returnPct = dPct !== 0 ? dPct : (mktVal > 0 ? (returnDollar / mktVal) * 100 : 0);
      isDayBasis = true;
    } else {
      // If day figures are 0 (e.g. weekend or market closed), use active unrealized PnL
      returnDollar = p.unrealizedPnL ?? p.unrealizedPL ?? 0;
      returnPct = p.unrealizedPnLPercent ?? p.unrealizedPLPercent ?? (mktVal > 0 ? (returnDollar / mktVal) * 100 : 0);
      isDayBasis = false;
    }

    // Sign consistency & percentage safety
    if (returnDollar < 0 && returnPct > 0) returnPct = -returnPct;
    if (returnDollar > 0 && returnPct < 0) returnPct = Math.abs(returnPct);
    if (returnPct === 0 && returnDollar !== 0 && mktVal > 0) {
      returnPct = (returnDollar / mktVal) * 100;
    }

    return {
      symbol: sym,
      name: p.description || p.name || `${sym} Position`,
      assetType: p.assetType,
      currentPrice: p.currentPrice || p.averageCost || 0,
      marketValue: mktVal,
      returnDollar,
      returnPct,
      isDayBasis,
      currency: p.currency || 'USD',
    };
  });

  // Top positive driver (highest positive return)
  const positiveGainers = [...normalizedPositions]
    .filter((p) => p.returnDollar > 0 || p.returnPct > 0)
    .sort((a, b) => b.returnDollar - a.returnDollar);
  const topGainer = positiveGainers[0] || normalizedPositions.sort((a, b) => b.returnDollar - a.returnDollar)[0] || null;

  // Biggest negative drag (lowest negative return)
  const negativeLosers = [...normalizedPositions]
    .filter((p) => p.returnDollar < 0 || p.returnPct < 0)
    .sort((a, b) => a.returnDollar - b.returnDollar);
  const topLoser = negativeLosers[0] || (normalizedPositions.length > 1 ? [...normalizedPositions].sort((a, b) => a.returnDollar - b.returnDollar)[0] : null);

  // Advancing vs Declining
  const advancers = normalizedPositions.filter((p) => p.returnDollar > 0 || p.returnPct > 0);
  const decliners = normalizedPositions.filter((p) => p.returnDollar < 0 || p.returnPct < 0);
  const totalCount = normalizedPositions.length || 1;
  const advancePercent = Math.min(100, Math.max(0, Math.round((advancers.length / totalCount) * 100)));

  const isNetPositive = yesterdayPnL >= 0 || (topGainer?.returnDollar ?? 0) >= 0;

  const fmtCurrency = (val: number, curr = 'USD') => {
    const sym = curr === 'GBP' ? '£' : '$';
    return `${val >= 0 ? '+' : '-'}${sym}${Math.abs(val).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  return (
    <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden relative group">
      {/* Top Gradient Line */}
      <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500" />

      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-accent/10 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-foreground">
              Yesterday & Overnight Market Pulse
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {hasActiveDayData ? 'Prior session performance & top moving drivers' : 'Core performance drivers & market momentum'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-mono font-bold px-2 py-0.5',
              isNetPositive
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            )}
          >
            {isNetPositive ? <ArrowUpRight className="w-3 h-3 inline mr-0.5" /> : <ArrowDownRight className="w-3 h-3 inline mr-0.5" />}
            {isNetPositive ? 'Net Green Posture' : 'Net Defensive Posture'}
          </Badge>

          {onNavigateToPortfolio && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToPortfolio}
              className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2 font-semibold"
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
          {/* Top MVP Driver */}
          {topGainer ? (
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
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] px-1 py-0 h-4 uppercase">
                      {topGainer.isDayBasis ? 'Top Driver' : 'Portfolio MVP'}
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
                <span className="text-[10px] text-emerald-400/80 font-bold">
                  {topGainer.returnPct >= 0 ? '+' : ''}{topGainer.returnPct.toFixed(2)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-accent/20 border border-border/40 text-center text-xs text-muted-foreground flex items-center justify-center h-16">
              Scanning portfolio holdings...
            </div>
          )}

          {/* Biggest Drag */}
          {topLoser ? (
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
                    <span className={cn(
                      "font-mono font-black text-xs group-hover/card:text-primary transition-colors",
                      topLoser.returnDollar < 0 ? "text-foreground" : "text-foreground"
                    )}>
                      {topLoser.symbol}
                    </span>
                    <Badge className={cn(
                      "text-[9px] px-1 py-0 h-4 uppercase",
                      topLoser.returnDollar < 0
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    )}>
                      {topLoser.returnDollar < 0 ? 'Lagging Drag' : 'Laggard'}
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
                  topLoser.returnDollar < 0 ? "text-rose-400/80" : "text-amber-400/80"
                )}>
                  {topLoser.returnPct >= 0 ? '+' : ''}{topLoser.returnPct.toFixed(2)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-accent/20 border border-border/40 text-center text-xs text-muted-foreground flex items-center justify-center h-16">
              Scanning portfolio holdings...
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
              <span className="text-emerald-400">{advancers.length} Positive</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-rose-400">{decliners.length} Negative</span>
              <span className="text-muted-foreground">({advancePercent}% Gain Ratio)</span>
            </div>
          </div>

          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex border border-border/40">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.max(2, advancePercent)}%` }}
              title={`${advancePercent}% Positive Positions`}
            />
            <div
              className="h-full bg-rose-500 transition-all duration-500"
              style={{ width: `${Math.max(2, 100 - advancePercent)}%` }}
              title={`${100 - advancePercent}% Negative Positions`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
