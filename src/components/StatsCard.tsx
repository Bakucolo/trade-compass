import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon?: 'dollar' | 'wallet' | 'trending';
  delay?: number;
}

export function StatsCard({ title, value, change, changeLabel, icon = 'dollar', delay = 0 }: StatsCardProps) {
  const isPositive = change !== undefined && change >= 0;
  
  const IconComponent = {
    dollar: DollarSign,
    wallet: Wallet,
    trending: isPositive ? TrendingUp : TrendingDown,
  }[icon];

  return (
    <div 
      className="stat-card animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="data-label mb-1">{title}</p>
          <p className="text-2xl font-bold text-foreground font-mono">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-1">
              {isPositive ? (
                <TrendingUp className="w-3 h-3 text-success" />
              ) : (
                <TrendingDown className="w-3 h-3 text-destructive" />
              )}
              <span className={cn("text-sm font-medium", isPositive ? "price-up" : "price-down")}>
                {isPositive ? '+' : ''}{change.toFixed(2)}%
              </span>
              {changeLabel && (
                <span className="text-xs text-muted-foreground ml-1">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        <div className={cn(
          "p-2 rounded-lg",
          isPositive || change === undefined ? "bg-primary/10" : "bg-destructive/10"
        )}>
          <IconComponent className={cn(
            "w-5 h-5",
            isPositive || change === undefined ? "text-primary" : "text-destructive"
          )} />
        </div>
      </div>
    </div>
  );
}
