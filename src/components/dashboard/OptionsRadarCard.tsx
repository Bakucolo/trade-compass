import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert,
  Clock,
  Activity,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptionsRadarCardProps {
  positions?: any[];
  onNavigateToPortfolio?: () => void;
  onNavigateToResearch?: (symbol: string) => void;
}

export function OptionsRadarCard({
  positions = [],
  onNavigateToPortfolio,
  onNavigateToResearch,
}: OptionsRadarCardProps) {
  // Filter options from positions
  const safePositions = Array.isArray(positions) ? positions.filter(Boolean) : [];
  const options = safePositions.filter(
    (p) => p && (p.assetType === 'OPTION' || p.assetType === 'Option' || p.isOption)
  );

  // Parse DTE and sort by nearest expiry
  const now = new Date();
  const optionsWithDTE = (options || []).map((opt) => {
    let dte = 30;
    if (opt.expiryDate) {
      let exp: Date;
      if (/^\d{8}$/.test(opt.expiryDate)) {
        const y = opt.expiryDate.substring(0, 4);
        const m = opt.expiryDate.substring(4, 6);
        const d = opt.expiryDate.substring(6, 8);
        exp = new Date(Number(y), Number(m) - 1, Number(d));
      } else {
        exp = new Date(opt.expiryDate);
      }
      if (!isNaN(exp.getTime())) {
        const diffTime = exp.getTime() - now.getTime();
        dte = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }
    }

    const isITM = opt.inTheMoney || false;
    const isCritical = dte <= 7;

    return {
      ...opt,
      dte,
      isCritical,
      isITM,
    };
  }).sort((a, b) => a.dte - b.dte);

  const nearestOptions = optionsWithDTE.slice(0, 4);
  const criticalCount = optionsWithDTE.filter((o) => o.dte <= 7).length;

  return (
    <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-accent/10 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-foreground">
              Options Expiry & Defense Radar
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Active derivative contracts approaching expiration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {criticalCount > 0 ? (
            <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] font-mono font-bold px-2 py-0.5">
              {criticalCount} Critical (≤7 DTE)
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono font-bold px-2 py-0.5">
              {options.length} Contracts Active
            </Badge>
          )}

          {onNavigateToPortfolio && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToPortfolio}
              className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2 font-semibold"
              title="Open full Portfolio & Holdings"
            >
              <span>Defense View</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-2.5">
        {nearestOptions.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No active options expiring within the next 30 days.
          </div>
        ) : (
          nearestOptions.map((opt, idx) => {
            const sym = (opt.underlyingSymbol || opt.symbol || '').toUpperCase();
            const strike = opt.strikePrice || '—';
            const type = opt.optionType || 'Call';

            return (
              <div
                key={idx}
                onClick={() => onNavigateToResearch && onNavigateToResearch(sym)}
                className="p-3 rounded-xl bg-accent/20 hover:bg-accent/40 border border-border/50 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs border',
                      opt.dte <= 7
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                        : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    )}
                  >
                    {opt.dte}d
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-xs text-foreground group-hover:text-primary transition-colors">
                        {sym}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        ${strike} {type}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {opt.expiryDate ? `Exp: ${opt.expiryDate}` : `${opt.dte} days remaining`}
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span
                    className={cn(
                      'text-xs font-bold block',
                      (opt.unrealizedPnL || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    )}
                  >
                    {(opt.unrealizedPnL || 0) >= 0 ? '+' : '-'}$
                    {Math.abs(opt.unrealizedPnL || 0).toFixed(0)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Qty: {opt.quantity}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
