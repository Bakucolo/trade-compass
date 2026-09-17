import React from 'react';
import { 
  usePendingSignals, 
  useApproveSignal, 
  useDismissSignal 
} from '@/services/aiTradingService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { 
  Bot, 
  CheckCircle, 
  X, 
  ShieldCheck, 
  Clock, 
  ArrowRight, 
  TrendingUp, 
  DollarSign 
} from 'lucide-react';

export const AiPendingSignals: React.FC = () => {
  const { toast } = useToast();
  const { data: signals = [], isLoading, refetch } = usePendingSignals();
  const approveMutation = useApproveSignal();
  const dismissMutation = useDismissSignal();

  const handleApprove = async (signalId: string, symbol: string) => {
    try {
      await approveMutation.mutateAsync(signalId);
      toast({
        title: `Order Executed: ${symbol}`,
        description: `Trade submitted to Alpaca Paper account with your verified position size.`,
      });
      refetch();
    } catch (err: any) {
      toast({
        title: 'Execution Failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleDismiss = async (signalId: string) => {
    try {
      await dismissMutation.mutateAsync(signalId);
      toast({ title: 'Signal Dismissed' });
      refetch();
    } catch (err: any) {
      toast({ title: 'Dismiss Failed', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoading || signals.length === 0) {
    return null; // Don't show empty box if no pending signals
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold text-foreground">
            AI Trade Signals Awaiting Your Approval ({signals.length})
          </h2>
        </div>
        <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-xs">
          Manual Approval Mode
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {signals.map((signal) => (
          <div
            key={signal.id}
            className="p-4 rounded-lg bg-card border border-border flex flex-col justify-between space-y-3 shadow-sm"
          >
            {/* Top Row: Symbol & Action */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-foreground">{signal.symbol}</span>
                  <Badge
                    className={
                      signal.action === 'BUY'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px]'
                    }
                  >
                    {signal.action} SIGNAL
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium">
                    ${signal.currentPrice.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{signal.strategyName}</p>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-muted-foreground block">Confidence</span>
                <span className="text-xs font-bold text-emerald-400">{signal.confidenceScore}%</span>
              </div>
            </div>

            {/* Middle: Strict User Position Sizing Box */}
            <div className="p-2.5 rounded-md bg-secondary/50 border border-border/80 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Authorized Sizing:
                </span>
                <span className="font-bold text-foreground">
                  {signal.targetShares} Shares (~${signal.targetDollarValue.toFixed(2)})
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                Rule: {signal.sizingRule}
              </div>
            </div>

            {/* Signal Thesis Reason */}
            <div className="text-xs text-muted-foreground bg-secondary/20 p-2 rounded border border-border/40">
              <span className="font-medium text-foreground">Trigger: </span>
              {signal.reason}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(signal.id)}
                disabled={dismissMutation.isPending || approveMutation.isPending}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Dismiss
              </Button>
              <Button
                size="sm"
                onClick={() => handleApprove(signal.id, signal.symbol)}
                disabled={approveMutation.isPending || dismissMutation.isPending}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Approve & Execute Paper Order
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
