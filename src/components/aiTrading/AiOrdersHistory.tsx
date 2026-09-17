import React, { useState } from 'react';
import { useAlpacaOrders, AlpacaOrder } from '@/services/aiTradingService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { History, RefreshCw, XCircle } from 'lucide-react';

export const AiOrdersHistory: React.FC = () => {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all');
  const { data: orders = [], isLoading, refetch, isRefetching } = useAlpacaOrders(filterStatus);

  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/ai-trading/orders/${orderId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to cancel order');
      toast({ title: 'Order Canceled', description: `Order ${orderId.substring(0, 8)}... canceled.` });
      refetch();
    } catch (err: any) {
      toast({ title: 'Cancel Failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Alpaca Order History</h3>
          <Badge variant="secondary" className="text-xs">{orders.length}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary/40 rounded-lg p-0.5 border border-border text-xs">
            {(['all', 'open', 'closed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                  filterStatus === s
                    ? 'bg-background text-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-muted-foreground">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          No orders found matching the selected filter.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-secondary/30 text-muted-foreground font-medium border-b border-border sticky top-0 bg-card">
              <tr>
                <th className="py-2.5 px-4">Date / Time</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Side</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Qty / Filled</th>
                <th className="py-2.5 px-3 text-right">Filled Avg Price</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {orders.map((ord) => {
                const isBuy = ord.side === 'buy';
                const isFilled = ord.status === 'filled';
                const isOpen = ord.status === 'new' || ord.status === 'accepted' || ord.status === 'partially_filled';

                return (
                  <tr key={ord.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-2.5 px-4 text-muted-foreground">
                      {ord.submitted_at ? new Date(ord.submitted_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-foreground">{ord.symbol}</td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-semibold ${
                          isBuy ? 'border-emerald-500/30 text-emerald-400' : 'border-rose-500/30 text-rose-400'
                        }`}
                      >
                        {ord.side}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 uppercase text-muted-foreground">{ord.type}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-foreground">{ord.filled_qty || 0}</span>
                      <span className="text-muted-foreground"> / {ord.qty || '—'}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {ord.filled_avg_price ? `$${parseFloat(ord.filled_avg_price).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase ${
                          isFilled
                            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                            : isOpen
                            ? 'border-amber-500/30 text-amber-400 bg-amber-500/5'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {ord.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {isOpen ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelOrder(ord.id)}
                          className="h-6 text-[11px] text-rose-400 hover:text-rose-300"
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
