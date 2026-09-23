import React, { useState, useMemo } from 'react';
import {
  PlannedTrade,
  usePlannedTrades,
  useUpdatePlannedTrade,
  useDeletePlannedTrade,
  useReorderPlannedTrades,
  useSendPlannedTradesPdfToTelegram,
  useTelegramStatus,
  useSyncTelegramBuffer,
  useUpdateExecutionThreadId,
  useProposeTradeEntry,
  TradeEntryProposal,
} from '@/services/plannedTradeService';
import { PlannedTradeModal } from './PlannedTradeModal';
import { PriceAlertModal } from '../PriceAlertModal';
import { TradeEntryProposalModal } from './TradeEntryProposalModal';
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
  RefreshCw,
  Settings2,
  RotateCcw,
  Search,
  CheckCheck,
  Archive,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { StockHoverGraphCard } from '../dashboard/StockHoverGraphCard';

interface ExecutionQueueManagerProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToPortfolio?: () => void;
  onNavigateToGraphs?: (symbol?: string) => void;
  initialView?: 'QUEUE' | 'EXECUTED';
  onSelectExecutedTab?: () => void;
  onSelectQueueTab?: () => void;
}

export function ExecutionQueueManager({
  onNavigateToResearch,
  onNavigateToPortfolio,
  onNavigateToGraphs,
  initialView = 'QUEUE',
  onSelectExecutedTab,
  onSelectQueueTab,
}: ExecutionQueueManagerProps) {
  const [viewMode, setViewMode] = useState<'QUEUE' | 'EXECUTED'>(initialView);
  const [timeframeFilter, setTimeframeFilter] = useState<'ALL' | 'DAY' | 'WEEK'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'TRIGGERED'>('ALL');
  const [executedSearchQuery, setExecutedSearchQuery] = useState('');

  React.useEffect(() => {
    if (initialView && initialView !== viewMode) {
      setViewMode(initialView);
    }
  }, [initialView]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tradeToEdit, setTradeToEdit] = useState<PlannedTrade | null>(null);

  // Alert Modal State
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [selectedTradeForAlert, setSelectedTradeForAlert] = useState<PlannedTrade | null>(null);

  // AI Entry Proposal State
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [selectedTradeForProposal, setSelectedTradeForProposal] = useState<PlannedTrade | null>(null);
  const [proposalData, setProposalData] = useState<TradeEntryProposal | null>(null);
  const proposeEntryMutation = useProposeTradeEntry();

  const handleProposeEntry = async (trade: PlannedTrade) => {
    setSelectedTradeForProposal(trade);
    setProposalData(null);
    setIsProposalModalOpen(true);
    try {
      const res = await proposeEntryMutation.mutateAsync(trade.id);
      setProposalData(res.proposal);
    } catch (err: any) {
      toast.error(`Entry analysis failed: ${err.message}`);
    }
  };

  // Drag and Drop state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // Queries & Mutations - fetch all planned trades for selected timeframe to separate active vs executed
  const { data: trades = [], isLoading, refetch } = usePlannedTrades(timeframeFilter, 'ALL');
  const updateMutation = useUpdatePlannedTrade();
  const deleteMutation = useDeletePlannedTrade();
  const reorderMutation = useReorderPlannedTrades();
  const sendTelegramMutation = useSendPlannedTradesPdfToTelegram();
  const createTradeMutation = useCreateTrade();

  // Telegram Buffer & Execution Topic Sync
  const { data: telegramStatus } = useTelegramStatus();
  const syncTelegramMutation = useSyncTelegramBuffer();
  const updateThreadIdMutation = useUpdateExecutionThreadId();
  const [isEditingThreadId, setIsEditingThreadId] = useState(false);
  const [customThreadId, setCustomThreadId] = useState('');

  const handleSyncTelegram = async () => {
    try {
      const res = await syncTelegramMutation.mutateAsync();
      refetch();
      if (res.consumedCount > 0) {
        toast.success(`Synced ${res.consumedCount} new trade(s) from Telegram!`);
      } else {
        toast.info('Telegram execution buffer is up to date (0 new trades)');
      }
    } catch (err: any) {
      toast.error(`Telegram sync error: ${err.message}`);
    }
  };

  const handleSaveThreadId = async () => {
    if (!customThreadId.trim()) return;
    try {
      await updateThreadIdMutation.mutateAsync(customThreadId.trim());
      setIsEditingThreadId(false);
      toast.success(`Telegram Execution Topic linked to thread #${customThreadId.trim()}`);
    } catch (err: any) {
      toast.error(`Failed to save thread ID: ${err.message}`);
    }
  };

  // Sort trades strictly by rank ascending
  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => a.rank - b.rank);
  }, [trades]);

  // Active Pending Queue trades (strictly non-executed trades so executed orders do not appear here anymore)
  const pendingTrades = useMemo(() => {
    return sortedTrades.filter((t) => {
      if (t.status === 'EXECUTED') return false;
      if (statusFilter === 'PENDING') return t.status === 'PENDING';
      if (statusFilter === 'TRIGGERED') return t.status === 'TRIGGERED';
      return true;
    });
  }, [sortedTrades, statusFilter]);

  // Executed Trades Archive
  const executedTrades = useMemo(() => {
    return sortedTrades.filter((t) => t.status === 'EXECUTED');
  }, [sortedTrades]);

  // Filtered executed trades by search query
  const filteredExecutedTrades = useMemo(() => {
    if (!executedSearchQuery.trim()) return executedTrades;
    const q = executedSearchQuery.toLowerCase().trim();
    return executedTrades.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        t.action.toLowerCase().includes(q) ||
        (t.underlyingSymbol && t.underlyingSymbol.toLowerCase().includes(q))
    );
  }, [executedTrades, executedSearchQuery]);

  // Executive KPI summary calculations for Active Queue
  const kpis = useMemo(() => {
    const active = pendingTrades.filter((t) => t.status !== 'CANCELLED');
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

    const topTrade = pendingTrades.find((t) => t.status === 'PENDING') || pendingTrades[0];

    return {
      totalCount: pendingTrades.length,
      pendingCount,
      dayCount: dayOrders.length,
      dayCapital,
      weekCount: weekOrders.length,
      weekCapital,
      totalCapital: dayCapital + weekCapital,
      topTrade,
    };
  }, [pendingTrades]);

  // KPIs for Executed Trades Archive
  const executedKpis = useMemo(() => {
    const totalCount = executedTrades.length;
    const totalCapital = executedTrades.reduce(
      (sum, t) => sum + t.quantity * (t.targetPrice || t.currentPrice || 0),
      0
    );
    const equityOrders = executedTrades.filter((t) => t.assetType === 'STOCK' || t.assetType === 'EQUITY');
    const optionOrders = executedTrades.filter((t) => t.assetType === 'OPTION');
    const totalShares = equityOrders.reduce((sum, t) => sum + t.quantity, 0);
    const totalContracts = optionOrders.reduce((sum, t) => sum + t.quantity, 0);

    return {
      totalCount,
      totalCapital,
      equityOrdersCount: equityOrders.length,
      totalShares,
      optionOrdersCount: optionOrders.length,
      totalContracts,
    };
  }, [executedTrades]);

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

    const currentOrder = [...pendingTrades];
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
    if (targetIndex < 0 || targetIndex >= pendingTrades.length) return;

    const newOrder = [...pendingTrades];
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
      if (nextStatus === 'EXECUTED') {
        toast.success(`${trade.symbol} marked as EXECUTED and moved to Executed Trades archive`, {
          action: {
            label: 'View Executed',
            onClick: () => {
              setViewMode('EXECUTED');
              onSelectExecutedTab?.();
            },
          },
        });
      } else {
        toast.success(`${trade.symbol} marked as ${nextStatus}`);
      }
    } catch (err: any) {
      toast.error('Failed to update status');
    }
  };

  // Submit Trade as Executed - moves trade out of active queue and into Executed Trades section
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

      toast.success(`${trade.symbol} (${trade.action}) flagged as EXECUTED!`, {
        description: 'Trade removed from Active Queue and moved to Executed Trades.',
        action: {
          label: 'View in Executed',
          onClick: () => {
            setViewMode('EXECUTED');
            onSelectExecutedTab?.();
          },
        },
      });
    } catch (err: any) {
      toast.error('Failed to submit trade as executed');
    }
  };

  // Restore Executed Trade back to Active Queue
  const handleRestoreToQueue = async (trade: PlannedTrade) => {
    try {
      await updateMutation.mutateAsync({
        id: trade.id,
        data: { status: 'PENDING' },
      });
      toast.success(`${trade.symbol} restored to Active Execution Queue!`, {
        action: {
          label: 'View Queue',
          onClick: () => {
            setViewMode('QUEUE');
            onSelectQueueTab?.();
          },
        },
      });
    } catch (err: any) {
      toast.error('Failed to restore trade to queue');
    }
  };

  const formatExecutionDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (diffDays === 0) return `Today at ${timeStr}`;
      if (diffDays === 1) return `Yesterday at ${timeStr}`;
      if (diffDays < 7) return `${diffDays}d ago (${timeStr})`;
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${timeStr}`;
    } catch {
      return dateStr;
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
      {/* ================= VIEW MODE TOGGLE & HEADER ================= */}
      <div className="glass-card rounded-2xl p-6 border border-border/60 shadow-lg space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-border/40 pb-5">
          <div className="flex items-center gap-3.5">
            <div className={cn(
              "w-12 h-12 rounded-2xl border flex items-center justify-center shadow-sm",
              viewMode === 'QUEUE'
                ? "bg-gradient-to-br from-primary/20 via-emerald-500/20 to-cyan-500/20 border-primary/30 text-primary"
                : "bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-primary/20 border-emerald-500/40 text-emerald-400"
            )}>
              {viewMode === 'QUEUE' ? <Target className="w-6 h-6" /> : <Archive className="w-6 h-6 text-emerald-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  {viewMode === 'QUEUE' ? 'Daily & Weekly Trade Execution Queue' : 'Executed Trades Archive & History'}
                </h2>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-mono font-bold",
                    viewMode === 'QUEUE'
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                  )}
                >
                  {viewMode === 'QUEUE' ? 'Ranked Priority' : `Completed (${executedTrades.length})`}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {viewMode === 'QUEUE'
                  ? 'Queue tactical orders for day and weekly execution. Drag and drop rows to rank your execution priorities.'
                  : 'Historical record of completed and filled trades from your execution queue. Review execution capital, volume, or restore back to active queue.'}
              </p>
            </div>
          </div>

          {/* Action Buttons & View Mode Switcher */}
          <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">
            {/* View Mode Switcher Pills */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => {
                  setViewMode('QUEUE');
                  onSelectQueueTab?.();
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                  viewMode === 'QUEUE'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Active Queue ({pendingTrades.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('EXECUTED');
                  onSelectExecutedTab?.();
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                  viewMode === 'EXECUTED'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-emerald-400'
                )}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Executed Trades ({executedTrades.length})</span>
              </button>
            </div>

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

            {viewMode === 'QUEUE' && (
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
            )}
          </div>
        </div>

        {/* ================= VIEW: ACTIVE QUEUE ================= */}
        {viewMode === 'QUEUE' && (
          <div className="space-y-5">
            {/* Telegram Execution Topic Sync Banner */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Send className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      Telegram &ldquo;Execution&rdquo; Topic Auto-Ingestion
                    </span>
                    {telegramStatus?.executionThreadId ? (
                      <Badge variant="outline" className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        Linked (Topic #{telegramStatus.executionThreadId})
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border-amber-500/30">
                        Auto-Discovering (Awaiting 1st Msg)
                      </Badge>
                    )}
                    {telegramStatus?.lastSyncTimestamp && (
                      <span className="text-[10px] text-muted-foreground">
                        Synced {new Date(telegramStatus.lastSyncTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Orders sent to your Telegram <span className="text-primary font-semibold">execution</span> topic (e.g. &ldquo;BUY 100 AAPL @ 150&rdquo;) are automatically added to this execution queue.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                {isEditingThreadId ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Thread ID (e.g. 5)"
                      value={customThreadId}
                      onChange={(e) => setCustomThreadId(e.target.value)}
                      className="h-7 w-28 text-xs px-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveThreadId}
                      disabled={updateThreadIdMutation.isPending}
                      className="h-7 text-[11px] px-2.5 font-bold"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingThreadId(false)}
                      className="h-7 text-[11px] px-2"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCustomThreadId(telegramStatus?.executionThreadId || '');
                      setIsEditingThreadId(true);
                    }}
                    className="h-7 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2 font-medium"
                    title="Configure Execution Topic Thread ID"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>{telegramStatus?.executionThreadId ? 'Edit Topic ID' : 'Set Topic ID'}</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncTelegram}
                  disabled={syncTelegramMutation.isPending}
                  className="h-7 text-[11px] gap-1.5 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 font-semibold"
                >
                  <RefreshCw className={cn("w-3 h-3 text-primary", syncTelegramMutation.isPending && "animate-spin")} />
                  <span>{syncTelegramMutation.isPending ? 'Syncing...' : 'Sync Now'}</span>
                </Button>
              </div>
            </div>

            {/* Executive KPI Ribbon for Active Queue */}
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
                  type="button"
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
                  type="button"
                  onClick={() => setTimeframeFilter('DAY')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                    timeframeFilter === 'DAY'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Clock className="w-3 h-3" />
                  <span>Today ({pendingTrades.filter((t) => t.timeframe === 'DAY').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframeFilter('WEEK')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                    timeframeFilter === 'WEEK'
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Calendar className="w-3 h-3" />
                  <span>This Week ({pendingTrades.filter((t) => t.timeframe === 'WEEK').length})</span>
                </button>
              </div>

              {/* Status Pills & Link to Executed Archive */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/50">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                      statusFilter === 'ALL'
                        ? 'bg-card text-foreground font-bold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    All Active ({pendingTrades.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('PENDING')}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                      statusFilter === 'PENDING'
                        ? 'bg-card text-amber-400 font-bold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Pending ({pendingTrades.filter((t) => t.status === 'PENDING').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('TRIGGERED')}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                      statusFilter === 'TRIGGERED'
                        ? 'bg-card text-cyan-400 font-bold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Triggered ({pendingTrades.filter((t) => t.status === 'TRIGGERED').length})
                  </button>
                </div>

                {executedTrades.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('EXECUTED');
                      onSelectExecutedTab?.();
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all flex items-center gap-1.5 shadow-xs"
                    title="View Executed Trades Section"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>View Executed ({executedTrades.length})</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW: EXECUTED TRADES ARCHIVE KPI RIBBON ================= */}
        {viewMode === 'EXECUTED' && (
          <div className="space-y-5">
            {/* Executive KPI Ribbon for Executed Trades */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {/* Card 1: Completed Orders */}
              <div className="p-3.5 rounded-xl bg-card/60 border border-emerald-500/30 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Completed Orders
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-extrabold font-mono text-emerald-400">
                    {executedKpis.totalCount}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">executed</span>
                </div>
              </div>

              {/* Card 2: Executed Capital */}
              <div className="p-3.5 rounded-xl bg-card/60 border border-border/50 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-primary" />
                  Executed Capital
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-extrabold font-mono text-foreground">
                    ${Math.round(executedKpis.totalCapital).toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">total filled</span>
                </div>
              </div>

              {/* Card 3: Equity Sizing */}
              <div className="p-3.5 rounded-xl bg-card/60 border border-border/50 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Equity Volume
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-extrabold font-mono text-cyan-400">
                    {executedKpis.totalShares.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    shs ({executedKpis.equityOrdersCount} orders)
                  </span>
                </div>
              </div>

              {/* Card 4: Option Contracts */}
              <div className="p-3.5 rounded-xl bg-card/60 border border-border/50 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  Option Contracts
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-extrabold font-mono text-purple-400">
                    {executedKpis.totalContracts.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    cts ({executedKpis.optionOrdersCount} orders)
                  </span>
                </div>
              </div>
            </div>

            {/* Executed Search & Horizon Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/40">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter executed trades by ticker, action, or notes..."
                  value={executedSearchQuery}
                  onChange={(e) => setExecutedSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-xl bg-muted/30 border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-medium"
                />
                {executedSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setExecutedSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Timeframe Filter Pills */}
              <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/50">
                <button
                  type="button"
                  onClick={() => setTimeframeFilter('ALL')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                    timeframeFilter === 'ALL'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  All Timeframes
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframeFilter('DAY')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                    timeframeFilter === 'DAY'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Clock className="w-3 h-3" />
                  <span>Day Horizon</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframeFilter('WEEK')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                    timeframeFilter === 'WEEK'
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Calendar className="w-3 h-3" />
                  <span>Week Horizon</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= 2. ROWS RENDERING ================= */}
      {viewMode === 'QUEUE' ? (
        /* ACTIVE QUEUE ROWS (STRICTLY NON-EXECUTED) */
        <div className="space-y-3">
          {isLoading ? (
            <div className="glass-card rounded-2xl p-12 text-center border border-border/50 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs text-muted-foreground">Loading tactical execution queue...</p>
            </div>
          ) : pendingTrades.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center border border-border/50 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-center mx-auto text-muted-foreground">
                {executedTrades.length > 0 ? (
                  <CheckCheck className="w-7 h-7 text-emerald-400" />
                ) : (
                  <Target className="w-7 h-7 text-primary/60" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {executedTrades.length > 0
                    ? `All Queued Trades Executed! (${executedTrades.length} Completed)`
                    : 'No Execution Orders in Queue'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  {executedTrades.length > 0
                    ? 'All orders in your active queue have been executed and logged into the Executed Trades section.'
                    : 'Queue the high-conviction trades you plan to execute today or this week. You can reorder their priority with drag-and-drop.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                {executedTrades.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setViewMode('EXECUTED');
                      onSelectExecutedTab?.();
                    }}
                    className="text-xs font-bold border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>View Executed Trades ({executedTrades.length})</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    setTradeToEdit(null);
                    setIsModalOpen(true);
                  }}
                  className="text-xs font-bold bg-primary text-primary-foreground gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{executedTrades.length > 0 ? 'Plan New Trade' : 'Add First Planned Trade'}</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingTrades.map((trade, index) => {
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

                      {/* Symbol & Action (with hover graph card & 1-click graph navigation) */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StockHoverGraphCard
                            symbol={trade.underlyingSymbol || trade.symbol}
                            onOpenChart={() =>
                              onNavigateToGraphs
                                ? onNavigateToGraphs(trade.underlyingSymbol || trade.symbol)
                                : onNavigateToResearch?.(trade.underlyingSymbol || trade.symbol)
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                onNavigateToGraphs
                                  ? onNavigateToGraphs(trade.underlyingSymbol || trade.symbol)
                                  : onNavigateToResearch?.(trade.underlyingSymbol || trade.symbol)
                              }
                              className="text-base font-bold font-mono tracking-tight text-foreground hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              {trade.symbol}
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                            </button>
                          </StockHoverGraphCard>

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
                              trade.status === 'TRIGGERED'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                : trade.status === 'CANCELLED'
                                ? 'bg-muted/40 text-muted-foreground border-border/50'
                                : 'bg-primary/20 text-primary border-primary/40 hover:bg-primary/30'
                            )}
                          >
                            <span
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                trade.status === 'TRIGGERED'
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
                      {/* Submit Executed Button - Immediately moves trade to Executed Trades section */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkExecuted(trade);
                        }}
                        className="h-7 px-2.5 text-[11px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border-emerald-500/30 hover:border-emerald-500/60 transition-all flex items-center gap-1.5 shadow-xs"
                        title="Submit that this trade has been executed and move to Executed Trades section"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Submit Executed</span>
                      </Button>

                      {/* AI Entry Level Analyst Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProposeEntry(trade);
                        }}
                        className="h-7 px-2 text-[11px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 hover:border-primary/50 transition-all flex items-center gap-1 shadow-xs"
                        title="AI Agent: Propose optimal entry levels & stop loss"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>AI Entry</span>
                      </Button>

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
                        disabled={index === pendingTrades.length - 1}
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
      ) : (
        /* EXECUTED TRADES ARCHIVE ROWS */
        <div className="space-y-3">
          {isLoading ? (
            <div className="glass-card rounded-2xl p-12 text-center border border-border/50 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <p className="text-xs text-muted-foreground">Loading executed trades archive...</p>
            </div>
          ) : filteredExecutedTrades.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center border border-border/50 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {executedSearchQuery ? 'No Matching Executed Trades' : 'No Executed Trades Yet'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  {executedSearchQuery
                    ? `No executed orders matched your search "${executedSearchQuery}". Try clearing your search.`
                    : 'When you click "Submit Executed" on any order in the Active Execution Queue, it will automatically be moved to this section.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                {executedSearchQuery ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExecutedSearchQuery('')}
                    className="text-xs font-bold"
                  >
                    Clear Search
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      setViewMode('QUEUE');
                      onSelectQueueTab?.();
                    }}
                    className="text-xs font-bold bg-primary text-primary-foreground gap-1.5"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Go to Active Queue ({pendingTrades.length})</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredExecutedTrades.map((trade) => {
                const cost = trade.quantity * (trade.targetPrice || trade.currentPrice || 0);

                const actionBg =
                  trade.action === 'BUY' || trade.action === 'BTO'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : trade.action === 'SELL' || trade.action === 'STC'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : trade.action === 'SHORT'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-purple-500/15 text-purple-300 border-purple-500/30';

                return (
                  <div
                    key={trade.id}
                    className="group rounded-2xl p-4 border border-emerald-500/30 transition-all duration-200 bg-card/75 hover:bg-card/95 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    {/* LEFT: Executed Badge, Symbol & Details */}
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      {/* Executed Check Icon */}
                      <div className="w-8 h-8 rounded-xl font-mono font-extrabold text-xs flex items-center justify-center border shadow-xs shrink-0 bg-emerald-500/20 text-emerald-300 border-emerald-500/50">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>

                      {/* Symbol & Action */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StockHoverGraphCard
                            symbol={trade.underlyingSymbol || trade.symbol}
                            onOpenChart={() =>
                              onNavigateToGraphs
                                ? onNavigateToGraphs(trade.underlyingSymbol || trade.symbol)
                                : onNavigateToResearch?.(trade.underlyingSymbol || trade.symbol)
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                onNavigateToGraphs
                                  ? onNavigateToGraphs(trade.underlyingSymbol || trade.symbol)
                                  : onNavigateToResearch?.(trade.underlyingSymbol || trade.symbol)
                              }
                              className="text-base font-bold font-mono tracking-tight text-foreground hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              {trade.symbol}
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                            </button>
                          </StockHoverGraphCard>

                          <Badge className={cn('text-[10px] font-extrabold px-2 py-0 border', actionBg)}>
                            {trade.action}
                          </Badge>

                          <Badge variant="outline" className="text-[10px] font-mono border-border/50 text-muted-foreground">
                            {trade.assetType}
                          </Badge>

                          <Badge className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border-emerald-500/40">
                            EXECUTED
                          </Badge>
                        </div>

                        {/* Timestamp & Horizon */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[11px] font-medium text-emerald-400/90 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatExecutionDate(trade.updatedAt || trade.createdAt)}
                          </span>
                          <span className="text-muted-foreground/60">•</span>
                          <span className="text-muted-foreground text-[11px] font-medium">
                            {trade.timeframe === 'DAY' ? 'Day Execution' : 'Weekly Horizon'}
                          </span>
                          {trade.notes && (
                            <>
                              <span className="text-muted-foreground/60">•</span>
                              <span className="text-muted-foreground text-[11px] italic truncate max-w-xs">
                                &ldquo;{trade.notes}&rdquo;
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* CENTER: Executed Order Sizing & Capital */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto md:min-w-[340px] text-xs">
                      {/* Sizing & Fill Price */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                          Filled Sizing
                        </span>
                        <p className="font-mono font-bold text-foreground">
                          {trade.quantity.toLocaleString()} {trade.assetType === 'OPTION' ? 'cts' : 'shs'}
                        </p>
                        <p className="text-[11px] font-mono text-muted-foreground">
                          @{trade.targetPrice ? `$${trade.targetPrice.toFixed(2)}` : 'Market'} ({trade.orderType})
                        </p>
                      </div>

                      {/* Executed Capital Value */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                          Executed Capital
                        </span>
                        <p className="font-mono font-extrabold text-emerald-400">
                          ${Math.round(cost).toLocaleString()}
                        </p>
                        <p className="text-[11px] font-mono text-muted-foreground">
                          Target Exit: {trade.targetExit ? `$${trade.targetExit.toFixed(2)}` : 'Open'}
                        </p>
                      </div>

                      {/* Status */}
                      <div className="space-y-0.5 col-span-2 sm:col-span-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                          Archive Status
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                          <CheckCheck className="w-4 h-4 text-emerald-400" />
                          <span>Filled &amp; Logged</span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: Actions: Restore to Queue, AI Entry, Delete */}
                    <div className="flex items-center gap-1.5 self-end md:self-center">
                      {/* Restore to Active Queue Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestoreToQueue(trade)}
                        className="h-7 px-2.5 text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30 hover:border-amber-500/50 transition-all flex items-center gap-1.5 shadow-xs"
                        title="Restore this trade back to the Active Execution Queue"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                        <span>Restore to Queue</span>
                      </Button>

                      {/* AI Entry Analysis */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProposeEntry(trade)}
                        className="h-7 px-2 text-[11px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 hover:border-primary/50 transition-all flex items-center gap-1 shadow-xs"
                        title="AI Entry Analysis"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>AI Entry</span>
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(trade)}
                        className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                        title="Delete Trade from History"
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
      )}

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

      {/* AI Entry Level Proposal Modal */}
      <TradeEntryProposalModal
        isOpen={isProposalModalOpen}
        onOpenChange={(open) => {
          setIsProposalModalOpen(open);
          if (!open) {
            setSelectedTradeForProposal(null);
            setProposalData(null);
          }
        }}
        trade={selectedTradeForProposal}
        proposal={proposalData}
        isLoading={proposeEntryMutation.isPending}
        onReanalyze={() => selectedTradeForProposal && handleProposeEntry(selectedTradeForProposal)}
        onOpenPriceAlert={(t, targetP) => {
          setSelectedTradeForAlert(t);
          setIsAlertModalOpen(true);
        }}
      />
    </div>
  );
}
