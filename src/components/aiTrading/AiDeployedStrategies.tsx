import React from 'react';
import { 
  useDeployedStrategies, 
  useToggleStrategy, 
  useDeleteStrategy,
  useScanStrategies 
} from '@/services/aiTradingService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { 
  Bot, 
  Trash2, 
  Zap, 
  ShieldCheck, 
  Clock, 
  TrendingUp, 
  Layers, 
  Activity,
  Play
} from 'lucide-react';

interface AiDeployedStrategiesProps {
  onNavigateToBacktest?: () => void;
}

export const AiDeployedStrategies: React.FC<AiDeployedStrategiesProps> = ({
  onNavigateToBacktest,
}) => {
  const { toast } = useToast();
  const { data: strategies = [], isLoading, refetch } = useDeployedStrategies();
  const toggleMutation = useToggleStrategy();
  const deleteMutation = useDeleteStrategy();
  const scanMutation = useScanStrategies();

  const handleToggle = async (id: string, currentStatus: boolean, name: string) => {
    try {
      await toggleMutation.mutateAsync({ id, active: !currentStatus });
      toast({
        title: !currentStatus ? 'Strategy Resumed' : 'Strategy Paused',
        description: `${name} is now ${!currentStatus ? 'actively monitoring' : 'paused'}.`,
      });
    } catch (err: any) {
      toast({ title: 'Toggle Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Strategy Removed', description: `${name} has been undeployed.` });
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleScan = async () => {
    try {
      const res = await scanMutation.mutateAsync();
      toast({
        title: 'Scan Complete',
        description: `Evaluated ${res.evaluatedCount} strategies. Found ${res.signalsGenerated?.length || 0} signal(s).`,
      });
      refetch();
    } catch (err: any) {
      toast({ title: 'Scan Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden space-y-4 p-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Deployed Paper Trading Strategies ({strategies.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active autonomous models monitoring Alpaca market data and generating trades within your strict position size limits.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleScan}
          disabled={scanMutation.isPending || strategies.length === 0}
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8"
        >
          <Zap className={`w-3.5 h-3.5 mr-1.5 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
          {scanMutation.isPending ? 'Evaluating...' : 'Scan Active Now'}
        </Button>
      </div>

      {/* Strategies List */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Loading deployed strategies...
        </div>
      ) : strategies.length === 0 ? (
        <div className="p-10 text-center space-y-3 bg-secondary/20 rounded-xl border border-dashed border-border">
          <Bot className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold text-foreground">No Strategies Deployed Yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Use the Strategy Backtester or the AI Strategy Explorer to backtest high-performing quantitative models and deploy them to your Alpaca paper account.
          </p>
          {onNavigateToBacktest && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToBacktest}
              className="text-xs h-8 mt-2"
            >
              <Play className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              Open Strategy Backtester
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {strategies.map((strat) => (
            <div
              key={strat.id}
              className={`p-4 rounded-xl border transition-all ${
                strat.isActive
                  ? 'bg-card border-border shadow-sm'
                  : 'bg-secondary/20 border-border/60 opacity-70'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-foreground">{strat.symbol}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 ${
                        strat.isActive
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                          : 'border-muted text-muted-foreground'
                      }`}
                    >
                      {strat.isActive ? 'ACTIVE' : 'PAUSED'}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{strat.timeframe}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-foreground mt-1">{strat.name}</h4>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      {strat.isActive ? 'Active' : 'Paused'}
                    </span>
                    <Switch
                      checked={strat.isActive}
                      onCheckedChange={() => handleToggle(strat.id, strat.isActive, strat.name)}
                      disabled={toggleMutation.isPending}
                    />
                  </div>
                  <button
                    onClick={() => handleDelete(strat.id, strat.name)}
                    className="text-muted-foreground hover:text-rose-400 p-1 transition-colors"
                    title="Delete strategy"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/50 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">User Position Size</span>
                  <span className="font-bold text-foreground">
                    ${strat.userPositionSizeDollar.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Backtest Win Rate</span>
                  <span className="font-bold text-emerald-400">{strat.winRateBacktest}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Backtest Return</span>
                  <span className={`font-bold ${strat.totalReturnBacktest >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {strat.totalReturnBacktest >= 0 ? '+' : ''}{strat.totalReturnBacktest}%
                  </span>
                </div>
              </div>

              {/* Last Evaluation & Signal */}
              <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {strat.lastEvaluatedAt
                    ? `Checked: ${new Date(strat.lastEvaluatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Awaiting scan'}
                </span>
                {strat.lastSignal ? (
                  <Badge
                    variant="outline"
                    className={`text-[10px] py-0 ${
                      strat.lastSignal.action === 'BUY'
                        ? 'border-emerald-500/30 text-emerald-400'
                        : 'border-rose-500/30 text-rose-400'
                    }`}
                  >
                    Last: {strat.lastSignal.action}
                  </Badge>
                ) : (
                  <span className="text-[10px]">No signals yet</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
