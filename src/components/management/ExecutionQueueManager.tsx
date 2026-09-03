import React, { useState, useMemo } from 'react';
import {
  PlannedTrade,
  usePlannedTrades,
  useUpdatePlannedTrade,
  useDeletePlannedTrade,
  useReorderPlannedTrades,
  useSendPlannedTradesPdfToTelegram,
} from '@/services/plannedTradeService';
import { PlannedTradeModal } from './PlannedTradeModal';
import { PriceAlertModal } from '../PriceAlertModal';
import { useCreateTrade } from '@/services/tradeService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Target,
  Plus,
  Send,
  FileText,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  ExternalLink,
  Shield,
  TrendingUp,
  DollarSign,
  Layers,
  ArrowUpDown,
  Sparkles,
  Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ExecutionQueueManagerProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToPortfolio?: () => void;
}

export function ExecutionQueueManager({
  onNavigateToResearch,
  onNavigateToPortfolio,
}: ExecutionQueueManagerProps) {
  const [timeframeFilter, setTimeframeFilter] = useState<'ALL' | 'DAY' | 'WEEK'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'EXECUTED' | 'CANCELLED'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tradeToEdit, setTradeToEdit] = useState<PlannedTrade | null>(null);

  // Alert Modal State
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [selectedTradeForAlert, setSelectedTradeForAlert] = useState<PlannedTrade | null>(null);

  // Drag and Drop state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // Queries & Mutations
  const { data: trades = [], isLoading, refetch } = usePlannedTrades(timeframeFilter, statusFilter);
  const updateMutation = useUpdatePlannedTrade();
  const deleteMutation = useDeletePlannedTrade();
  const reorderMutation = useReorderPlannedTrades();
  const sendTelegramMutation = useSendPlannedTradesPdfToTelegram();
  const createTradeMutation = useCreateTrade();

  // Sort trades strictly by rank ascending
  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => a.rank - b.rank);
  }, [trades]);

  // Executive KPI summary calculations
  const kpis = useMemo(() => {
    const active = trades.filter((t) => t.status !== 'CANCELLED');
    const dayOrders = active.filter((t) => t.timeframe === 'DAY');
    const weekOrders = active.filter((t) => t.timeframe === 'WEEK');
    const pendingCount = active.filter((t) => t.status === 'PENDING').length;

    const dayCapital = dayOrders.reduce(
      (sum, t) => sum + t.quantity * (t.targetPrice || t.currentPrice || 0),
      0
    );
    const weekCapital = weekOrders.reduce(
      (sum, t) => sum + t.quantity * (t.targetPrice || t.currentPrice || 0),
      0
    );

    const topTrade = sortedTrades.find((t) => t.status === 'PENDING') || sortedTrades[0];

    return {
      totalCount: trades.length,
      pendingCount,
      dayCount: dayOrders.length,
      dayCapital,
      weekCount: weekOrders.length,
      weekCapital,
      totalCapital: dayCapital + weekCapital,
      topTrade,
    };
  }, [trades, sortedTrades]);

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverItemId !== id) {
      setDragOverItemId(id);
    }
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverItemId(null);

    if (!draggedItemId || draggedItemId === targetId) {
      setDraggedItemId(null);
      return;
    }

    const currentOrder = [...sortedTrades];
    const fromIndex = currentOrder.findIndex((t) => t.id === draggedItemId);
    const toIndex = currentOrder.findIndex((t) => t.id === targetId);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedItemId(null);
      return;
    }

    // Move element in array
    const [movedItem] = currentOrder.splice(fromIndex, 1);
    currentOrder.splice(toIndex, 0, movedItem);

    const orderedIds = currentOrder.map((t) => t.id);
    setDraggedItemId(null);

    try {
      await reorderMutation.mutateAsync(orderedIds);
      toast.success('Execution queue reordered');
    } catch (err: any) {
      toast.error('Failed to save new order');
    }
  };

  // Up/Down button handlers for quick micro-reordering
  const handleMove = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedTrades.length) return;

    const newOrder = [...sortedTrades];
    const [item] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, item);

    const orderedIds = newOrder.map((t) => t.id);
    try {
      await reorderMutation.mutateAsync(orderedIds);
    } catch (err: any) {
      toast.error('Failed to move item');
    }
  };

  // Quick Status Toggle
  const handleToggleStatus = async (trade: PlannedTrade) => {
    const nextStatus =
      trade.status === 'PENDING'
        ? 'EXECUTED'
        : trade.status === 'EXECUTED'
        ? 'CANCELLED'
        : 'PENDING';

    try {
      await updateMutation.mutateAsync({
        id: trade.id,
        data: { status: nextStatus },
      });
      toast.success(`${trade.symbol} marked as ${nextStatus}`);
    } catch (err: any) {
      toast.error('Failed to update status');
    }
  };

  // Submit Trade as Executed
  const handleMarkExecuted = async (trade: PlannedTrade) => {
    try {
      await updateMutation.mutateAsync({
        id: trade.id,
        data: { status: 'EXECUTED' },
      });

      // Supplementary logging to Trade Journal
      try {
        await createTradeMutation.mutateAsync({
          broker: 'Manual',
          symbol: trade.symbol,
          underlyingSymbol: trade.underlyingSymbol || trade.symbol,
          assetType: trade.assetType === 'OPTION' ? 'OPTION' : 'EQUITY',
          action: trade.action,
          side: trade.action.startsWith('SELL') || trade.action === 'SHORT' ? 'SELL' : 'BUY',
          positionEffect: trade.action.startsWith('SELL') || trade.action === 'SHORT' ? 'SHORT' : 'LONG',
          quantity: trade.quantity,
          price: trade.targetPrice || trade.currentPrice || 0,
          totalValue: (trade.targetPrice || trade.currentPrice || 0) * trade.quantity,
          executedAt: new Date().toISOString(),
          description: trade.notes ? `Execution queue: ${trade.notes}` : `Execution queue order: ${trade.action} ${trade.symbol}`,
        });
      } catch (e) {
        // Non-blocking
      }

      toast.success(`${trade.symbol} (${trade.action}) successfully submitted as EXECUTED!`);
    } catch (err: any) {
      toast.error('Failed to submit trade as executed');
    }
  };

  // Delete Trade immediately without prompt
  const handleDelete = async (trade: PlannedTrade) => {
    try {
      await deleteMutation.mutateAsync(trade.id);
      toast.success(`Removed ${trade.symbol} from execution queue`);
    } catch (err: any) {
      toast.error('Failed to delete trade');
    }
  };

  // Send PDF via Telegram
  const handleSendTelegram = async () => {
    try {
      toast.info('Generating institutional PDF and dispatching to Telegram...');
      const res = await sendTelegramMutation.mutateAsync();
      toast.success(`PDF successfully sent to your Telegram! (Message ID: ${res.messageId || 'Delivered'})`);
    } catch (err: any) {
      toast.error(`Telegram dispatch failed: ${err.message}`);
    }
  };

  // Preview PDF in browser
  const handlePreviewPdf = () => {
    window.open('/api/management/planned-trades/preview-pdf', '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ================= 1. SECTION HEADER & ACTION BUTTONS ================= */}
      <div className="glass-card rounded-2xl p-6 border border-border/60 shadow-lg space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-border/40 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 via-emerald-500/20 to-cyan-500/20 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Daily &amp; Weekly Trade Execution Queue
                </h2>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono font-bold">
                  Ranked Priority
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Queue tactical orders for day and weekly execution. Drag and drop rows to rank your execution priorities.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviewPdf}
              className="text-xs gap-1.5 border-border/70 hover:bg-muted/50 font-semibold"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Preview PDF</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSendTelegram}
              disabled={sendTelegramMutation.isPending}
              className="text-xs gap-1.5 border-blue-500/30 bg-blue-950/20 text-blue-300 hover:bg-blue-900/30 font-semibold shadow-sm"
            >
              <Send className="w-3.5 h-3.5 text-blue-400" />
              <span>
                {sendTelegramMutation.isPending ? 'Sending PDF...' : 'Send PDF to Telegram'}
              </span>
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setTradeToEdit(null);
                setIsModalOpen(true);
              }}
              className="text-xs font-bold bg-primary text-primary-foreground gap-1.5 shadow-md hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Plan New Trade</span>
            </Button>
          </div>
        </div>

        {/* Executive KPI Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* Card 1: Total Queue */}
          <div className="p-3.5 rounded-xl bg-card/60 border border-border/50 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-primary" />
              Queue Orders
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-extrabold font-mono text-foreground">
                {kpis.totalCount}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                ({kpis.pendingCount} pending)
              </span>
            </div>
          </div>

          {/* Card 2: Today's Capital */}
          <div className="p-3.5 rounded-xl bg-card/60 border border-border/50 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Today's Orders
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-extrabold font-mono text-emerald-400">
                ${Math.round(kpis.dayCapital).toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                ({kpis.dayCount} orders)
              </span>
            </div>
          </div>

          {/* Card 3: Week's Capital */}
          <div className="p-3.5 rounded-xl bg-card/60 border border-border/50 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              This Week Horizon
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-extrabold font-mono text-cyan-400">
                ${Math.round(kpis.weekCapital).toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                ({kpis.weekCount} orders)
              </span>
            </div>
          </div>

          {/* Card 4: Top Priority Pick */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-500/10 via-primary/5 to-transparent border border-amber-500/30 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              #1 Priority Pick
            </span>
            <div className="mt-1">
              {kpis.topTrade ? (
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold font-mono text-foreground">
                    {kpis.topTrade.symbol}
                  </span>
                  <Badge className="text-[10px] font-bold py-0 px-1.5 bg-amber-500/20 text-amber-300 border-amber-500/40">
                    {kpis.topTrade.action}
                  </Badge>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">None queued</span>
              )}
            </div>
          </div>
        </div>

        {/* Horizon & Status Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/40">
          {/* Timeframe Pills */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/50">
            <button
              onClick={() => setTimeframeFilter('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                timeframeFilter === 'ALL'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All Horizons
            </button>
            <button
              onClick={() => setTimeframeFilter('DAY')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                timeframeFilter === 'DAY'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Clock className="w-3 h-3" />
              <span>Today ({trades.filter((t) => t.timeframe === 'DAY').length})</span>
            </button>
            <button
              onClick={() => setTimeframeFilter('WEEK')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                timeframeFilter === 'WEEK'
                  ? 'bg-cyan-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Calendar className="w-3 h-3" />
              <span>This Week ({trades.filter((t) => t.timeframe === 'WEEK').length})</span>
            </button>
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/50">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                statusFilter === 'ALL'
                  ? 'bg-card text-foreground font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All Status
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                statusFilter === 'PENDING'
                  ? 'bg-card text-amber-400 font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Pending ({trades.filter((t) => t.status === 'PENDING').length})
            </button>
            <button
              onClick={() => setStatusFilter('EXECUTED')}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                statusFilter === 'EXECUTED'
                  ? 'bg-card text-emerald-400 font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Executed ({trades.filter((t) => t.status === 'EXECUTED').length})
            </button>
          </div>
        </div>
      </div>

      {/* ================= 2. RANKED ROWS (DRAG & DROP QUEUE) ================= */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="glass-card rounded-2xl p-12 text-center border border-border/50 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-xs text-muted-foreground">Loading tactical execution queue...</p>
          </div>
        ) : sortedTrades.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center border border-border/50 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-center mx-auto text-muted-foreground">
              <Target className="w-7 h-7 text-primary/60" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                No Execution Orders in Queue
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Queue the high-conviction trades you plan to execute today or this week. You can reorder their priority with drag-and-drop.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setTradeToEdit(null);
                setIsModalOpen(true);
              }}
              className="text-xs font-bold bg-primary text-primary-foreground gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Planned Trade</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedTrades.map((trade, index) => {
              const isFirst = index === 0;
              const isSecond = index === 1;
              const isThird = index === 2;

              // Cost & R:R
              const cost = trade.quantity * (trade.targetPrice || trade.currentPrice || 0);
              let rrRatio: string | null = null;
              if (trade.targetPrice && trade.stopLoss && trade.targetExit) {
                const risk = Math.abs(trade.targetPrice - trade.stopLoss);
                const reward = Math.abs(trade.targetExit - trade.targetPrice);
                if (risk > 0) {
                  rrRatio = (reward / risk).toFixed(1);
                }
              }

              // Action color
              const actionBg =
                trade.action === 'BUY' || trade.action === 'BTO'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : trade.action === 'SELL' || trade.action === 'STC'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  : trade.action === 'SHORT'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-purple-500/15 text-purple-300 border-purple-500/30';

              const isDragged = draggedItemId === trade.id;
              const isDragOver = dragOverItemId === trade.id;

              return (
                <div
                  key={trade.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, trade.id)}
                  onDragOver={(e) => handleDragOver(e, trade.id)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, trade.id)}
                  className={cn(
                    'group rounded-2xl p-4 border transition-all duration-200 bg-card/70 hover:bg-card/90 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-grab active:cursor-grabbing',
                    isFirst
                      ? 'border-amber-500/40 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent shadow-amber-500/5'
                      : isSecond
                      ? 'border-cyan-500/30'
                      : isThird
                      ? 'border-purple-500/30'
                      : 'border-border/60',
                    isDragged && 'opacity-40 scale-[0.98] border-dashed border-primary',
                    isDragOver && 'border-t-2 border-t-primary scale-[1.01] shadow-lg'
                  )}
                >
                  {/* LEFT: Drag Grip, Rank, Symbol & Badges */}
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Grip Icon */}
                    <div className="text-muted-foreground/50 hover:text-foreground cursor-grab group-hover:opacity-100 opacity-60 transition-opacity">
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Rank Badge */}
                    <div
                      className={cn(
                        'w-8 h-8 rounded-xl font-mono font-extrabold text-xs flex items-center justify-center border shadow-xs shrink-0',
                        isFirst
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : isSecond
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                          : isThird
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                          : 'bg-muted/40 text-muted-foreground border-border/50'
                      )}
                    >
                      #{trade.rank}
                    </div>

                    {/* Symbol & Action */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onNavigateToResearch?.(trade.underlyingSymbol || trade.symbol)}
                          className="text-base font-bold font-mono tracking-tight text-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          {trade.symbol}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </button>

                        <Badge className={cn('text-[10px] font-extrabold px-2 py-0 border', actionBg)}>
                          {trade.action}
                        </Badge>

                        <Badge variant="outline" className="text-[10px] font-mono border-border/50 text-muted-foreground">
                          {trade.assetType}
                        </Badge>
                      </div>

                      {/* Horizon & Conviction */}
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={cn(
                            'font-bold text-[11px] flex items-center gap-1',
                            trade.timeframe === 'DAY' ? 'text-emerald-400' : 'text-cyan-400'
                          )}
                        >
                          {trade.timeframe === 'DAY' ? (
                            <>
                              <Clock className="w-3 h-3" /> TODAY
                            </>
                          ) : (
                            <>
                              <Calendar className="w-3 h-3" /> THIS WEEK
                            </>
                          )}
                        </span>
                        <span className="text-muted-foreground/60">•</span>
                        <span className="text-muted-foreground text-[11px] font-medium">
                          {trade.conviction === 'HIGH' ? '★★★ High Conviction' : trade.conviction === 'MEDIUM' ? '★★☆ Medium' : '★☆☆ Tactical'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CENTER: Order Details, Limit, SL, TP, Capital */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto md:min-w-[340px] text-xs">
                    {/* Order & Capital */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Order &amp; Sizing
                      </span>
                      <p className="font-mono font-bold text-foreground">
                        {trade.quantity.toLocaleString()} {trade.assetType === 'OPTION' ? 'cts' : 'shs'} @ {trade.orderType}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        Target: {trade.targetPrice ? `$${trade.targetPrice.toFixed(2)}` : 'Market'}
                        {cost > 0 && ` ($${Math.round(cost).toLocaleString()})`}
                      </p>
                    </div>

                    {/* Risk Targets (SL & TP) */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Invalidation / Target
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="text-rose-400 font-semibold">
                          {trade.stopLoss ? `SL: $${trade.stopLoss.toFixed(2)}` : 'SL: None'}
                        </span>
                        <span className="text-muted-foreground/50">/</span>
                        <span className="text-emerald-400 font-semibold">
                          {trade.targetExit ? `TP: $${trade.targetExit.toFixed(2)}` : 'TP: Open'}
                        </span>
                      </div>
                      {rrRatio && (
                        <span className="text-[10px] font-mono font-bold text-primary">
                          1 : {rrRatio} R:R
                        </span>
                      )}
                    </div>

                    {/* Status Pill */}
                    <div className="space-y-0.5 col-span-2 sm:col-span-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Status
                      </span>
                      <div>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(trade)}
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all flex items-center gap-1.5',
                            trade.status === 'EXECUTED'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                              : trade.status === 'TRIGGERED'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                              : trade.status === 'CANCELLED'
                              ? 'bg-muted/40 text-muted-foreground border-border/50'
                              : 'bg-primary/20 text-primary border-primary/40 hover:bg-primary/30'
                          )}
                        >
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              trade.status === 'EXECUTED'
                                ? 'bg-emerald-400'
                                : trade.status === 'TRIGGERED'
                                ? 'bg-amber-400'
                                : trade.status === 'CANCELLED'
                                ? 'bg-muted-foreground'
                                : 'bg-primary animate-pulse'
                            )}
                          />
                          <span>{trade.status}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Submit Executed, Set Alert, Quick Reorder Arrows, Edit, Delete */}
                  <div className="flex items-center gap-1.5 self-end md:self-center">
                    {/* Submit Executed Button */}
                    {trade.status !== 'EXECUTED' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkExecuted(trade);
                        }}
                        className="h-7 px-2.5 text-[11px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border-emerald-500/30 hover:border-emerald-500/60 transition-all flex items-center gap-1.5 shadow-xs"
                        title="Submit that this trade has been executed"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Submit Executed</span>
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Executed</span>
                      </div>
                    )}

                    {/* Set Price Alert Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTradeForAlert(trade);
                        setIsAlertModalOpen(true);
                      }}
                      className="h-7 w-7 text-muted-foreground hover:text-amber-400"
                      title="Set Price Alert for this trade"
                    >
                      <Bell className="w-3.5 h-3.5" />
                    </Button>

                    {/* Move Up */}
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'UP')}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      title="Move Up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>

                    {/* Move Down */}
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === sortedTrades.length - 1}
                      onClick={() => handleMove(index, 'DOWN')}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      title="Move Down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>

                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setTradeToEdit(trade);
                        setIsModalOpen(true);
                      }}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Edit Order"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>

                    {/* Delete (Immediate without prompt) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(trade)}
                      className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                      title="Delete Trade Immediately"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Trade Modal */}
      <PlannedTradeModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTradeToEdit(null);
        }}
        tradeToEdit={tradeToEdit}
      />

      {/* Set Price Alert Modal */}
      <PriceAlertModal
        open={isAlertModalOpen}
        onOpenChange={(open) => {
          setIsAlertModalOpen(open);
          if (!open) setSelectedTradeForAlert(null);
        }}
        initialSymbol={selectedTradeForAlert?.symbol || ''}
        initialPrice={selectedTradeForAlert?.currentPrice || 0}
        initialTargetPrice={selectedTradeForAlert?.targetPrice || ''}
        initialCondition={
          selectedTradeForAlert?.action === 'BUY' || selectedTradeForAlert?.action === 'BTO'
            ? 'BELOW'
            : 'ABOVE'
        }
        initialNotes={
          selectedTradeForAlert
            ? `Execution queue trigger: ${selectedTradeForAlert.action} ${selectedTradeForAlert.symbol}`
            : ''
        }
      />
    </div>
  );
}
