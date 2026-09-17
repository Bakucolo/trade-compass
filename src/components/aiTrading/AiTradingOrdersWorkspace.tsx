// src/components/aiTrading/AiTradingOrdersWorkspace.tsx
// Multi-Broker Staged Drafts & Orders Workspace (Zero Balances, Zero Positions)

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ArrowRight,
  Filter,
  Layers,
  Inbox
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { StagedDraftOrder, approveDraftOrder, cancelDraftOrder } from '@/services/tastytrade';
import { SupportedBroker } from './AiTradingBrokerBar';

export interface UnifiedOrder {
  id: string;
  broker: string;
  symbol: string;
  side: string;
  type: string;
  price?: number;
  qty: number;
  status: string;
  submitted_at: string;
  time_in_force?: string;
}

interface AiTradingOrdersWorkspaceProps {
  activeBroker: SupportedBroker;
  onRefreshNeeded?: () => void;
}

export const AiTradingOrdersWorkspace: React.FC<AiTradingOrdersWorkspaceProps> = ({
  activeBroker,
  onRefreshNeeded,
}) => {
  const [drafts, setDrafts] = useState<StagedDraftOrder[]>([]);
  const [orders, setOrders] = useState<UnifiedOrder[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'drafts' | 'live' | 'filled' | 'cancelled'>('all');
  const [processingDraftId, setProcessingDraftId] = useState<string | null>(null);

  // Fetch drafts from backend
  const fetchDrafts = async () => {
    setIsLoadingDrafts(true);
    try {
      const res = await fetch(`/api/ai-trading/drafts?broker=${activeBroker}`);
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.drafts || []);
      }
    } catch (err) {
      console.warn('[OrdersWorkspace] Failed to fetch drafts:', err);
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  // Fetch orders from backend
  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const res = await fetch(`/api/ai-trading/orders?broker=${activeBroker}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('[OrdersWorkspace] Failed to fetch orders:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleRefreshAll = () => {
    fetchDrafts();
    fetchOrders();
    onRefreshNeeded?.();
    toast.success('Orders refreshed', { description: `Synced latest ${activeBroker.toUpperCase()} drafts and orders.` });
  };

  useEffect(() => {
    fetchDrafts();
    fetchOrders();
  }, [activeBroker]);

  // Approve a pending draft
  const handleApproveDraft = async (draftId: string) => {
    setProcessingDraftId(draftId);
    try {
      const res = await approveDraftOrder(draftId);
      toast.success('Trade Approved & Executed!', {
        description: `Order #${res.orderId || 'SUCCESS'} submitted to ${activeBroker.toUpperCase()}.`
      });
      fetchDrafts();
      fetchOrders();
    } catch (err: any) {
      toast.error('Approval failed', { description: err.message });
    } finally {
      setProcessingDraftId(null);
    }
  };

  // Cancel a pending draft
  const handleCancelDraft = async (draftId: string) => {
    setProcessingDraftId(draftId);
    try {
      await cancelDraftOrder(draftId);
      toast.info('Draft Cancelled', { description: `Order draft was removed without execution.` });
      fetchDrafts();
    } catch (err: any) {
      toast.error('Cancel failed', { description: err.message });
    } finally {
      setProcessingDraftId(null);
    }
  };

  // Filter pending drafts
  const pendingDrafts = drafts.filter((d) => d.status === 'PENDING_APPROVAL');

  // Filtered orders list based on status filter
  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'live') {
      const s = o.status.toLowerCase();
      return s.includes('new') || s.includes('accepted') || s.includes('received') || s.includes('pending') || s.includes('partially');
    }
    if (statusFilter === 'filled') return o.status.toLowerCase().includes('fill');
    if (statusFilter === 'cancelled') return o.status.toLowerCase().includes('cancel') || o.status.toLowerCase().includes('expired');
    return true;
  });

  return (
    <div className="flex flex-col h-[740px] bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xl space-y-0">
      {/* Workspace Header */}
      <div className="p-4 bg-secondary/40 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-primary">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              Drafts & Orders Monitor
              <Badge variant="outline" className="text-[10px] font-mono capitalize border-border bg-background">
                {activeBroker}
              </Badge>
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Review staged orders awaiting physical human approval and track exchange status.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isLoadingDrafts || isLoadingOrders}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground border-border"
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5 mr-1.5", (isLoadingDrafts || isLoadingOrders) && "animate-spin text-primary")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 bg-secondary/20 border-b border-border/60 flex items-center gap-1.5 overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={cn(
            "px-2.5 py-1 rounded-lg font-medium transition-all",
            statusFilter === 'all'
              ? "bg-secondary text-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          All ({pendingDrafts.length + orders.length})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('drafts')}
          className={cn(
            "px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1",
            statusFilter === 'drafts'
              ? "bg-amber-500/15 text-amber-300 font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>Pending Drafts</span>
          {pendingDrafts.length > 0 && (
            <Badge className="h-4 px-1 text-[9px] bg-amber-500 text-slate-950 font-bold">
              {pendingDrafts.length}
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('live')}
          className={cn(
            "px-2.5 py-1 rounded-lg font-medium transition-all",
            statusFilter === 'live'
              ? "bg-secondary text-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Live / Open
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('filled')}
          className={cn(
            "px-2.5 py-1 rounded-lg font-medium transition-all",
            statusFilter === 'filled'
              ? "bg-secondary text-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Filled
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('cancelled')}
          className={cn(
            "px-2.5 py-1 rounded-lg font-medium transition-all",
            statusFilter === 'cancelled'
              ? "bg-secondary text-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Cancelled
        </button>
      </div>

      {/* Main Workspace Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* SECTION 1: Pending Staged Drafts (shown if filter is 'all' or 'drafts') */}
        {(statusFilter === 'all' || statusFilter === 'drafts') && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                Pending Staged Drafts ({pendingDrafts.length})
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                Hard Stop Rule Enforced
              </span>
            </div>

            {pendingDrafts.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground bg-secondary/20">
                No draft orders currently staged. Ask the LLM to draft an order to populate.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingDrafts.map((draft) => {
                  const isBuy = draft.action.toUpperCase().includes('BUY');
                  const isBusy = processingDraftId === draft.draftId;
                  return (
                    <div
                      key={draft.draftId}
                      className="p-3.5 rounded-xl bg-secondary/50 border border-amber-500/30 hover:border-amber-500/60 transition-all space-y-2.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-mono font-bold text-xs px-2 py-0.5 rounded",
                              isBuy
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            )}
                          >
                            {draft.action}
                          </span>
                          <span className="font-mono font-bold text-sm text-foreground">
                            {draft.quantity} {draft.symbol}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground border-border">
                            {draft.orderType}
                          </Badge>
                          {draft.price && (
                            <span className="font-mono text-xs text-primary font-bold">
                              ${draft.price.toFixed(2)}
                            </span>
                          )}
                        </div>

                        <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono animate-pulse">
                          Awaiting Approval
                        </Badge>
                      </div>

                      {draft.notes && (
                        <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                          {draft.notes}
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          Broker: <strong className="text-foreground capitalize">{draft.broker || activeBroker}</strong>
                        </span>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => handleCancelDraft(draft.draftId)}
                            className="h-7 px-2 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={isBusy}
                            onClick={() => handleApproveDraft(draft.draftId)}
                            className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
                          >
                            Approve Trade
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: Orders Table (Live / Filled / Cancelled) */}
        {statusFilter !== 'drafts' && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Orders History ({filteredOrders.length})
              </span>
              <span className="text-[10px] text-muted-foreground font-mono capitalize">
                {activeBroker} Orders
              </span>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground bg-secondary/10 flex flex-col items-center justify-center space-y-2">
                <Inbox className="w-8 h-8 text-muted-foreground/60" />
                <p>No orders found for the selected status in {activeBroker.toUpperCase()}.</p>
              </div>
            ) : (
              <div className="border border-border/80 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-secondary/60 border-b border-border text-[11px] text-muted-foreground uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Symbol</th>
                        <th className="py-2.5 px-3">Side</th>
                        <th className="py-2.5 px-3">Qty</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Price</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 bg-card">
                      {filteredOrders.map((order) => {
                        const isBuy = order.side?.toUpperCase().includes('BUY');
                        const statusLower = order.status.toLowerCase();
                        const isFilled = statusLower.includes('fill');
                        const isCancelled = statusLower.includes('cancel') || statusLower.includes('expired');

                        return (
                          <tr key={order.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-foreground">
                              {order.symbol}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                  isBuy
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-rose-500/20 text-rose-300"
                                )}
                              >
                                {order.side}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-foreground">
                              {order.qty}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground capitalize">
                              {order.type}
                            </td>
                            <td className="py-2.5 px-3 text-foreground font-semibold">
                              {order.price ? `$${order.price.toFixed(2)}` : 'MKT'}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-mono capitalize",
                                  isFilled
                                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                                    : isCancelled
                                    ? "bg-slate-800 text-slate-400 border-slate-700"
                                    : "bg-amber-500/15 text-amber-300 border-amber-500/40"
                                )}
                              >
                                {order.status}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-right text-muted-foreground text-[11px]">
                              {order.submitted_at
                                ? new Date(order.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
