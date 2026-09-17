import React, { useState } from 'react';
import { 
  AlpacaPosition, 
  useAlpacaPositions, 
  useClosePosition 
} from '@/services/aiTradingService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { 
  TrendingUp, 
  TrendingDown, 
  XCircle, 
  ExternalLink, 
  Layers, 
  RefreshCw 
} from 'lucide-react';

interface AiPositionsTableProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol?: string) => void;
}

export const AiPositionsTable: React.FC<AiPositionsTableProps> = ({
  onNavigateToResearch,
  onNavigateToGraphs,
}) => {
  const { toast } = useToast();
  const { data: positions = [], isLoading, refetch, isRefetching } = useAlpacaPositions();
  const closePositionMutation = useClosePosition();

  const [selectedPositionToClose, setSelectedPositionToClose] = useState<AlpacaPosition | null>(null);

  const handleClose = async () => {
    if (!selectedPositionToClose) return;
    try {
      await closePositionMutation.mutateAsync({ symbol: selectedPositionToClose.symbol });
      toast({
        title: `Closed Position: ${selectedPositionToClose.symbol}`,
        description: `Market sell order submitted to close ${selectedPositionToClose.qty} shares.`,
      });
      setSelectedPositionToClose(null);
    } catch (err: any) {
      toast({
        title: 'Failed to Close Position',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Table Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Active Paper Positions</h2>
          <Badge variant="secondary" className="text-xs px-2 py-0.5">
            {positions.length} Open
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Positions Content */}
      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading Alpaca positions...
        </div>
      ) : positions.length === 0 ? (
        <div className="p-12 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-secondary/50 text-muted-foreground flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-foreground">No Open Paper Positions</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Your Alpaca paper account currently holds no open stock positions. Run the Strategy Backtester or generate an AI Strategy below to find opportunities!
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-secondary/30 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="py-2.5 px-4">Symbol</th>
                <th className="py-2.5 px-3">Side / Qty</th>
                <th className="py-2.5 px-3 text-right">Avg Entry</th>
                <th className="py-2.5 px-3 text-right">Current Price</th>
                <th className="py-2.5 px-3 text-right">Market Value</th>
                <th className="py-2.5 px-3 text-right">Day Change</th>
                <th className="py-2.5 px-3 text-right">Unrealized P&L</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {positions.map((pos) => {
                const qty = parseFloat(pos.qty);
                const avgPrice = parseFloat(pos.avg_entry_price);
                const currPrice = parseFloat(pos.current_price);
                const mktValue = parseFloat(pos.market_value);
                const unrealizedPl = parseFloat(pos.unrealized_pl);
                const unrealizedPlpc = parseFloat(pos.unrealized_plpc) * 100;
                const changeToday = parseFloat(pos.change_today) * 100;

                const isProfit = unrealizedPl >= 0;

                return (
                  <tr key={pos.asset_id} className="hover:bg-secondary/20 transition-colors">
                    {/* Symbol */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-foreground">{pos.symbol}</span>
                        <button
                          onClick={() => onNavigateToResearch?.(pos.symbol)}
                          title="Open Company Research"
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{pos.exchange}</span>
                    </td>

                    {/* Side / Qty */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase px-1.5 py-0 ${
                            pos.side === 'long'
                              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                              : 'border-rose-500/30 text-rose-400 bg-rose-500/5'
                          }`}
                        >
                          {pos.side}
                        </Badge>
                        <span className="font-semibold text-foreground">{qty}</span>
                      </div>
                    </td>

                    {/* Avg Entry */}
                    <td className="py-3 px-3 text-right font-medium text-muted-foreground">
                      ${avgPrice.toFixed(2)}
                    </td>

                    {/* Current Price */}
                    <td className="py-3 px-3 text-right font-medium text-foreground">
                      ${currPrice.toFixed(2)}
                    </td>

                    {/* Market Value */}
                    <td className="py-3 px-3 text-right font-bold text-foreground">
                      ${mktValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Day Change */}
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 font-medium ${
                          changeToday >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {changeToday >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {changeToday >= 0 ? '+' : ''}
                        {changeToday.toFixed(2)}%
                      </span>
                    </td>

                    {/* Unrealized P&L */}
                    <td className="py-3 px-3 text-right">
                      <div className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}${unrealizedPl.toFixed(2)}
                      </div>
                      <div className={`text-[11px] ${isProfit ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                        {isProfit ? '+' : ''}{unrealizedPlpc.toFixed(2)}%
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPositionToClose(pos)}
                          className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Close
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Close Position Confirmation Dialog */}
      <AlertDialog open={Boolean(selectedPositionToClose)} onOpenChange={(open) => !open && setSelectedPositionToClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Position: {selectedPositionToClose?.symbol}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will place a market order on your Alpaca Paper account to liquidate {selectedPositionToClose?.qty} shares of {selectedPositionToClose?.symbol} at the prevailing market price.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Position</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClose}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Close Position Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
