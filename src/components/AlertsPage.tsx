import { useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import {
  Bell,
  BellRing,
  BellOff,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
  Loader2,
  Sparkles,
  Calendar,
  Edit2,
  VolumeX,
  Volume2,
  Shield,
  ShieldAlert,
  X,
  FolderPlus,
  Check,
  LineChart,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Checkbox } from './ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  useAlerts,
  useDeleteAlert,
  useDeleteMutedAlerts,
  useBulkMuteAlerts,
  useBulkDeleteAlerts,
  useResetAlert,
  useMuteAlert,
  useUnmuteAlert,
  useSyncShortOptionAlerts,
  PriceAlert,
} from '@/services/alertService';
import { useWatchlists, useAddSymbolToWatchlist } from '@/services/watchlistService';
import { PriceAlertModal } from './PriceAlertModal';
import { useToast } from './ui/use-toast';

type SortOption =
  | 'triggered_desc'
  | 'triggered_asc'
  | 'symbol_asc'
  | 'symbol_desc'
  | 'created_desc'
  | 'target_desc';

type StatusFilter = 'ALL' | 'ACTIVE' | 'TRIGGERED' | 'MUTED' | 'SHORT_DEFENSE';

interface AlertsPageProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol: string) => void;
}

export function AlertsPage({ onNavigateToResearch, onNavigateToGraphs }: AlertsPageProps) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [sortOption, setSortOption] = useState<SortOption>('triggered_desc');

  // Quick filter toggle when clicking overview cards
  const handleCardFilterClick = (target: StatusFilter) => {
    if (target === 'ALL') {
      setStatusFilter('ALL');
    } else {
      setStatusFilter((prev) => (prev === target ? 'ALL' : target));
    }
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
  const [modalSymbol, setModalSymbol] = useState('');
  const [modalPrice, setModalPrice] = useState(0);

  const { data: alerts = [], isLoading, isRefetching, refetch } = useAlerts();
  const deleteAlertMutation = useDeleteAlert();
  const deleteMutedMutation = useDeleteMutedAlerts();
  const bulkMuteMutation = useBulkMuteAlerts();
  const bulkDeleteMutation = useBulkDeleteAlerts();
  const resetAlertMutation = useResetAlert();
  const muteAlertMutation = useMuteAlert();
  const unmuteAlertMutation = useUnmuteAlert();
  const syncShortAlertsMutation = useSyncShortOptionAlerts();

  // Watchlist integration
  const { data: watchlists = [] } = useWatchlists();
  const addSymbolMutation = useAddSymbolToWatchlist();

  const handleAddToWatchlist = async (watchlistId: string, symbol: string, watchlistName: string) => {
    try {
      await addSymbolMutation.mutateAsync({ watchlistId, symbol });
      toast({
        title: "Added to Watchlist",
        description: `Successfully added ${symbol} to "${watchlistName}".`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to add to Watchlist",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // Multi-select State
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set());

  // Metrics
  const activeCount = alerts.filter((a) => a.status === 'ACTIVE').length;
  const unmutedTriggeredCount = alerts.filter((a) => a.status === 'TRIGGERED' && !a.isMuted).length;
  const mutedCount = alerts.filter((a) => a.isMuted || a.status === 'CANCELLED').length;
  const totalTriggeredCount = alerts.filter((a) => a.status === 'TRIGGERED').length;
  const shortDefenseCount = alerts.filter((a) => a.notes && a.notes.includes('Short Option')).length;

  const latestTriggered = alerts
    .filter((a) => a.status === 'TRIGGERED' && a.triggeredAt)
    .sort((a, b) => new Date(b.triggeredAt!).getTime() - new Date(a.triggeredAt!).getTime())[0];

  // Filter & Sort
  const processedAlerts = useMemo(() => {
    let list = [...alerts];

    // Status Filter
    if (statusFilter === 'ACTIVE') {
      list = list.filter((a) => a.status === 'ACTIVE');
    } else if (statusFilter === 'TRIGGERED') {
      list = list.filter((a) => a.status === 'TRIGGERED' && !a.isMuted);
    } else if (statusFilter === 'MUTED') {
      list = list.filter((a) => a.isMuted);
    } else if (statusFilter === 'SHORT_DEFENSE') {
      list = list.filter((a) => a.notes && a.notes.includes('Short Option'));
    }

    // Search Filter
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.symbol.toLowerCase().includes(q) ||
          (a.stockName && a.stockName.toLowerCase().includes(q)) ||
          (a.notes && a.notes.toLowerCase().includes(q))
      );
    }

    // Sorting
    list.sort((a, b) => {
      switch (sortOption) {
        case 'triggered_desc': {
          const tA = a.triggeredAt ? new Date(a.triggeredAt).getTime() : 0;
          const tB = b.triggeredAt ? new Date(b.triggeredAt).getTime() : 0;
          if (tA === 0 && tB === 0) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          return tB - tA;
        }
        case 'triggered_asc': {
          const tA = a.triggeredAt ? new Date(a.triggeredAt).getTime() : Infinity;
          const tB = b.triggeredAt ? new Date(b.triggeredAt).getTime() : Infinity;
          return tA - tB;
        }
        case 'symbol_asc':
          return a.symbol.localeCompare(b.symbol);
        case 'symbol_desc':
          return b.symbol.localeCompare(a.symbol);
        case 'created_desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'target_desc':
          return b.targetPrice - a.targetPrice;
        default:
          return 0;
      }
    });

    return list;
  }, [alerts, statusFilter, searchQuery, sortOption]);

  // Selection helpers
  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedAlertIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected =
    processedAlerts.length > 0 &&
    processedAlerts.every((a) => selectedAlertIds.has(a.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedAlertIds((prev) => {
        const next = new Set(prev);
        processedAlerts.forEach((a) => next.delete(a.id));
        return next;
      });
    } else {
      setSelectedAlertIds((prev) => {
        const next = new Set(prev);
        processedAlerts.forEach((a) => next.add(a.id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedAlertIds(new Set());
  };

  const handleBulkDeleteSelected = async () => {
    const count = selectedAlertIds.size;
    if (count === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${count} selected alert${count > 1 ? 's' : ''}?`)) {
      return;
    }

    try {
      const res = await bulkDeleteMutation.mutateAsync(Array.from(selectedAlertIds));
      toast({
        title: "Alerts Deleted",
        description: `Successfully deleted ${res.count} price alert${res.count > 1 ? 's' : ''}.`,
      });
      setSelectedAlertIds(new Set());
    } catch (err: any) {
      toast({
        title: "Failed to delete alerts",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleBulkMuteSelected = async () => {
    const count = selectedAlertIds.size;
    if (count === 0) return;
    try {
      const res = await bulkMuteMutation.mutateAsync(Array.from(selectedAlertIds));
      toast({
        title: "Alerts Muted",
        description: `Muted ${res.count} alert${res.count > 1 ? 's' : ''}.`,
      });
      setSelectedAlertIds(new Set());
    } catch (err: any) {
      toast({
        title: "Failed to mute alerts",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string, symbol: string) => {
    try {
      await deleteAlertMutation.mutateAsync(id);
      setSelectedAlertIds((prev) => {
        if (prev.has(id)) {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }
        return prev;
      });
      toast({
        title: "Alert Deleted",
        description: `Price alert for ${symbol} was removed.`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to delete alert",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleMute = async (alertItem: PriceAlert) => {
    try {
      await muteAlertMutation.mutateAsync(alertItem.id);
      toast({
        title: "Alert Muted",
        description: `Triggered alert for ${alertItem.symbol} is muted and preserved in history.`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to mute alert",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleUnmute = async (alertItem: PriceAlert) => {
    try {
      await unmuteAlertMutation.mutateAsync(alertItem.id);
      toast({
        title: "Alert Unmuted",
        description: `Alert for ${alertItem.symbol} is now unmuted.`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to unmute alert",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleReset = async (alertItem: PriceAlert) => {
    try {
      await resetAlertMutation.mutateAsync({
        id: alertItem.id,
        targetPrice: alertItem.targetPrice,
        condition: alertItem.condition,
      });
      toast({
        title: "Alert Re-armed",
        description: `Price alert for ${alertItem.symbol} is now actively monitoring.`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to re-arm alert",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleSetNewAlertFromExisting = (alertItem: PriceAlert) => {
    setEditingAlert(null); // Create mode for brand-new follow-up alert
    setModalSymbol(alertItem.symbol);
    setModalPrice(alertItem.currentPrice || alertItem.triggeredPrice || alertItem.targetPrice || 0);
    setIsModalOpen(true);
  };

  const handleOpenResearch = (symbol: string) => {
    if (onNavigateToResearch) {
      onNavigateToResearch(symbol);
    } else {
      window.dispatchEvent(new CustomEvent('select-research-ticker', { detail: symbol }));
    }
  };

  const handleOpenGraphs = (symbol: string) => {
    if (!symbol) return;
    const clean = symbol.trim().toUpperCase();
    const targetUrl = `/?tab=graphs&symbol=${encodeURIComponent(clean)}`;
    try {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Failed to open graph in new window:', err);
    }
    // Also dispatch event and notify in case listener is in current window
    if (onNavigateToGraphs) {
      onNavigateToGraphs(clean);
    } else {
      window.dispatchEvent(new CustomEvent('select-graphs-ticker', { detail: clean }));
    }
  };

  const handleSyncShortOptions = async () => {
    try {
      const res = await syncShortAlertsMutation.mutateAsync();
      if (res.createdAlertsCount > 0) {
        toast({
          title: "Short Option Alerts Synced",
          description: `Created ${res.createdAlertsCount} automated 5% & 10% defense alert(s) across ${res.totalShortOptions} short options.`,
        });
      } else {
        toast({
          title: "Short Option Alerts Up to Date",
          description: `All ${res.totalShortOptions} short option positions already have active defense alerts armed.`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Failed to sync alerts",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleBulkMuteAllFired = async () => {
    try {
      const res = await bulkMuteMutation.mutateAsync();
      toast({
        title: "All Triggered Alerts Muted",
        description: `Muted ${res.count} fired alert(s).`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to mute alerts",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAllMuted = async (e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (mutedCount === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete all ${mutedCount} muted alerts?`)) return;
    try {
      const res = await deleteMutedMutation.mutateAsync();
      setSelectedAlertIds((prev) => {
        const next = new Set(prev);
        alerts.filter((a) => a.isMuted || a.status === 'CANCELLED').forEach((a) => next.delete(a.id));
        return next;
      });
      toast({
        title: "Muted Alerts Deleted",
        description: `Removed ${res.count} muted alert(s).`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to delete muted alerts",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground glow-text-white">
              Price Alerts Command
            </h1>
            {unmutedTriggeredCount > 0 ? (
              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-xs font-semibold animate-pulse">
                <BellRing className="w-3.5 h-3.5 mr-1" />
                {unmutedTriggeredCount} Fired Alert{unmutedTriggeredCount > 1 ? 's' : ''}
              </Badge>
            ) : mutedCount > 0 ? (
              <Badge variant="outline" className="bg-slate-800 text-muted-foreground border-border/60 text-xs font-semibold">
                <BellOff className="w-3.5 h-3.5 mr-1" />
                {mutedCount} Muted
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time price monitoring, instant alerts, and triggered alert history with custom muting & archiving.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Delete Selected (when checkboxes are checked) */}
          {selectedAlertIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDeleteSelected}
              disabled={bulkDeleteMutation.isPending}
              className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-950/40 animate-in fade-in"
              title={`Permanently delete ${selectedAlertIds.size} selected alert(s)`}
            >
              <Trash2 className={cn("w-3.5 h-3.5", bulkDeleteMutation.isPending && "animate-spin")} />
              <span>Delete Selected ({selectedAlertIds.size})</span>
            </Button>
          )}

          {/* Mute All Fired */}
          {unmutedTriggeredCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkMuteAllFired}
              disabled={bulkMuteMutation.isPending}
              className="gap-1.5 border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 shadow-sm"
              title="Mute and acknowledge all fired alerts"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Mute All Fired ({unmutedTriggeredCount})</span>
            </Button>
          )}

          {/* Delete All Muted */}
          {mutedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteAllMuted}
              disabled={deleteMutedMutation.isPending}
              className="gap-1.5 border-slate-700 bg-slate-800/80 hover:bg-rose-950/40 hover:border-rose-500/50 text-muted-foreground hover:text-rose-300 shadow-sm"
              title="Permanently delete all muted and archived alerts"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete All Muted ({mutedCount})</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncShortOptions}
            disabled={syncShortAlertsMutation.isPending}
            className="gap-1.5 border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 shadow-sm"
            title="Automatically scan portfolio for short options and provision 5% & 10% strike proximity alerts"
          >
            <Shield className={cn("w-3.5 h-3.5 text-purple-400", syncShortAlertsMutation.isPending && "animate-spin")} />
            <span>Auto-Sync Short Options</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefetching && "animate-spin text-primary")} />
            Refresh
          </Button>

          <Button
            variant="glow"
            size="sm"
            onClick={() => {
              setEditingAlert(null);
              setModalSymbol('');
              setModalPrice(0);
              setIsModalOpen(true);
            }}
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New Alert
          </Button>
        </div>
      </div>

      {/* Overview Cards (Clickable Filter Boxes) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Alerts Card */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={statusFilter === 'ALL'}
          data-testid="overview-card-all"
          onClick={() => handleCardFilterClick('ALL')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCardFilterClick('ALL');
            }
          }}
          className={cn(
            "group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none",
            "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
            statusFilter === 'ALL'
              ? "bg-cyan-950/30 border-cyan-500/60 ring-2 ring-cyan-500/70 shadow-lg shadow-cyan-950/30"
              : "bg-card/60 border-border/60 hover:border-cyan-500/40 hover:bg-card/80"
          )}
          title="Click to view all alerts"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-cyan-300 transition-colors">
              Total Alerts
            </p>
            <Bell className={cn("w-4 h-4 transition-colors", statusFilter === 'ALL' ? "text-cyan-400" : "text-muted-foreground group-hover:text-cyan-400")} />
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold font-mono text-foreground">{alerts.length}</p>
            {statusFilter === 'ALL' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-500/15 px-1.5 py-0.5 rounded border border-cyan-500/30">
                <Check className="w-2.5 h-2.5" /> All
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
                Show all
              </span>
            )}
          </div>
        </div>

        {/* Active Targets Card */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={statusFilter === 'ACTIVE'}
          data-testid="overview-card-active"
          onClick={() => handleCardFilterClick('ACTIVE')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCardFilterClick('ACTIVE');
            }
          }}
          className={cn(
            "group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none",
            "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
            statusFilter === 'ACTIVE'
              ? "bg-emerald-950/30 border-emerald-500/60 ring-2 ring-emerald-500/70 shadow-lg shadow-emerald-950/30"
              : "bg-card/60 border-border/60 hover:border-emerald-500/40 hover:bg-card/80"
          )}
          title={statusFilter === 'ACTIVE' ? "Click to clear filter" : "Click to filter Active targets"}
        >
          <div className="flex items-center justify-between">
            <p className={cn("text-xs font-semibold uppercase tracking-wider transition-colors", statusFilter === 'ACTIVE' ? "text-emerald-400" : "text-emerald-500/90 group-hover:text-emerald-400")}>
              Active Targets
            </p>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold font-mono text-emerald-400">{activeCount}</p>
            {statusFilter === 'ACTIVE' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
                <Check className="w-2.5 h-2.5" /> Filtered
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 group-hover:text-emerald-400 transition-all">
                Filter
              </span>
            )}
          </div>
        </div>

        {/* Unmuted Fired Card */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={statusFilter === 'TRIGGERED'}
          data-testid="overview-card-triggered"
          onClick={() => handleCardFilterClick('TRIGGERED')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCardFilterClick('TRIGGERED');
            }
          }}
          className={cn(
            "group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none",
            "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
            statusFilter === 'TRIGGERED'
              ? "bg-rose-950/40 border-rose-500/70 ring-2 ring-rose-500/80 shadow-lg shadow-rose-950/40"
              : unmutedTriggeredCount > 0
              ? "bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50 hover:bg-rose-950/30"
              : "bg-card/60 border-border/60 hover:border-rose-500/40 hover:bg-card/80"
          )}
          title={statusFilter === 'TRIGGERED' ? "Click to clear filter" : "Click to filter Fired/Triggered alerts"}
        >
          <div className="flex items-center justify-between">
            <p className={cn("text-xs font-semibold uppercase tracking-wider transition-colors", unmutedTriggeredCount > 0 || statusFilter === 'TRIGGERED' ? "text-rose-400" : "text-muted-foreground group-hover:text-rose-400")}>
              Unmuted Fired
            </p>
            {unmutedTriggeredCount > 0 && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <p className={cn("text-2xl font-bold font-mono", unmutedTriggeredCount > 0 || statusFilter === 'TRIGGERED' ? "text-rose-300" : "text-foreground")}>
              {unmutedTriggeredCount}
            </p>
            {statusFilter === 'TRIGGERED' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/30">
                <Check className="w-2.5 h-2.5" /> Filtered
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 group-hover:text-rose-400 transition-all">
                Filter
              </span>
            )}
          </div>
        </div>

        {/* Muted / Acknowledged Card */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={statusFilter === 'MUTED'}
          data-testid="overview-card-muted"
          onClick={() => handleCardFilterClick('MUTED')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCardFilterClick('MUTED');
            }
          }}
          className={cn(
            "group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none",
            "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
            statusFilter === 'MUTED'
              ? "bg-slate-900 border-slate-400/70 ring-2 ring-slate-400/80 shadow-lg shadow-slate-950/40"
              : "bg-card/60 border-border/60 hover:border-slate-500/50 hover:bg-card/80"
          )}
          title={statusFilter === 'MUTED' ? "Click to clear filter" : "Click to filter Muted & Acknowledged alerts"}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-slate-300 transition-colors">
              Muted / Acknowledged
            </p>
            <BellOff className={cn("w-3.5 h-3.5 transition-colors", statusFilter === 'MUTED' ? "text-slate-300" : "text-muted-foreground group-hover:text-slate-300")} />
          </div>
          <div className="flex items-center justify-between mt-2 gap-2">
            <p className="text-2xl font-bold font-mono text-muted-foreground group-hover:text-slate-200 transition-colors">{mutedCount}</p>
            <div className="flex items-center gap-1.5">
              {mutedCount > 0 && (
                <button
                  type="button"
                  data-testid="delete-all-muted-card-btn"
                  onClick={handleDeleteAllMuted}
                  onKeyDown={(e) => e.stopPropagation()}
                  disabled={deleteMutedMutation.isPending}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all z-10",
                    "border border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/30 hover:border-rose-400 hover:text-white active:scale-95 shadow-sm shadow-rose-950/20",
                    deleteMutedMutation.isPending && "opacity-50 cursor-not-allowed"
                  )}
                  title={`Delete all ${mutedCount} muted alerts`}
                  aria-label="Delete all muted alerts"
                >
                  <Trash2 className={cn("w-3 h-3 text-rose-400", deleteMutedMutation.isPending && "animate-spin")} />
                  <span>Delete All</span>
                </button>
              )}
              {statusFilter === 'MUTED' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  <Check className="w-2.5 h-2.5" /> Filtered
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 group-hover:text-slate-300 transition-all">
                  Filter
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Short Defense Card */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={statusFilter === 'SHORT_DEFENSE'}
          data-testid="overview-card-short_defense"
          onClick={() => handleCardFilterClick('SHORT_DEFENSE')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCardFilterClick('SHORT_DEFENSE');
            }
          }}
          className={cn(
            "group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer select-none col-span-2 sm:col-span-1",
            "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
            statusFilter === 'SHORT_DEFENSE'
              ? "bg-purple-950/30 border-purple-500/60 ring-2 ring-purple-500/70 shadow-lg shadow-purple-950/30"
              : "bg-card/60 border-border/60 hover:border-purple-500/40 hover:bg-card/80"
          )}
          title={statusFilter === 'SHORT_DEFENSE' ? "Click to clear filter" : "Click to filter Short Option Defense alerts"}
        >
          <div className="flex items-center justify-between">
            <p className={cn("text-xs font-semibold uppercase tracking-wider transition-colors", statusFilter === 'SHORT_DEFENSE' ? "text-purple-300" : "text-purple-400/90 group-hover:text-purple-300")}>
              Short Defense
            </p>
            <Shield className={cn("w-3.5 h-3.5 transition-colors", statusFilter === 'SHORT_DEFENSE' ? "text-purple-300" : "text-purple-400")} />
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl font-bold font-mono text-purple-300">{shortDefenseCount}</p>
            {statusFilter === 'SHORT_DEFENSE' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-300 bg-purple-500/15 px-1.5 py-0.5 rounded border border-purple-500/30">
                <Check className="w-2.5 h-2.5" /> Filtered
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 group-hover:text-purple-300 transition-all">
                Filter
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search / Sort Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-card/60 border border-border/60 rounded-xl flex-wrap">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              statusFilter === 'ALL'
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All ({alerts.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
              statusFilter === 'ACTIVE'
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Active ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('TRIGGERED')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
              statusFilter === 'TRIGGERED'
                ? "bg-rose-500 text-white shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Triggered ({unmutedTriggeredCount})
          </button>
          <button
            onClick={() => setStatusFilter('MUTED')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
              statusFilter === 'MUTED'
                ? "bg-slate-700 text-white shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BellOff className="w-3.5 h-3.5 text-slate-400" />
            Muted ({mutedCount})
          </button>
          <button
            onClick={() => setStatusFilter('SHORT_DEFENSE')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
              statusFilter === 'SHORT_DEFENSE'
                ? "bg-purple-600 text-white shadow"
                : "text-muted-foreground hover:text-purple-300"
            )}
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            Short Defense ({shortDefenseCount})
          </button>
        </div>

        {/* Search & Sort Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search ticker or note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-xs bg-card/60 border-border"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-card/60 border border-border/60 rounded-xl px-2.5 h-10">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer pr-2"
            >
              <option value="triggered_desc" className="bg-popover text-popover-foreground">
                Date Triggered (Newest)
              </option>
              <option value="triggered_asc" className="bg-popover text-popover-foreground">
                Date Triggered (Oldest)
              </option>
              <option value="symbol_asc" className="bg-popover text-popover-foreground">
                Ticker (A → Z)
              </option>
              <option value="symbol_desc" className="bg-popover text-popover-foreground">
                Ticker (Z → A)
              </option>
              <option value="created_desc" className="bg-popover text-popover-foreground">
                Date Created (Newest)
              </option>
              <option value="target_desc" className="bg-popover text-popover-foreground">
                Target Price (High → Low)
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Selection Action Bar */}
      {processedAlerts.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border transition-all duration-200",
            selectedAlertIds.size > 0
              ? "bg-primary/10 border-primary/40 shadow-sm"
              : "bg-card/40 border-border/60"
          )}
        >
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="select-all-alerts"
              checked={isAllSelected}
              onCheckedChange={handleToggleSelectAll}
              aria-label="Select all visible alerts"
              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <label
              htmlFor="select-all-alerts"
              className="text-xs font-semibold cursor-pointer select-none flex items-center gap-1.5 text-foreground"
            >
              <span>Select All</span>
              <span className="text-muted-foreground font-normal">
                ({processedAlerts.length})
              </span>
            </label>

            {selectedAlertIds.size > 0 && (
              <Badge variant="secondary" className="font-mono font-semibold text-xs px-2 py-0.5 ml-1 bg-primary/20 text-primary border-primary/30">
                {selectedAlertIds.size} selected
              </Badge>
            )}
          </div>

          {selectedAlertIds.size > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDeleteSelected}
                disabled={bulkDeleteMutation.isPending}
                className="h-8 text-xs font-semibold gap-1.5 bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-950/30"
              >
                <Trash2 className={cn("w-3.5 h-3.5", bulkDeleteMutation.isPending && "animate-spin")} />
                <span>Delete Selected ({selectedAlertIds.size})</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkMuteSelected}
                disabled={bulkMuteMutation.isPending}
                className="h-8 text-xs font-medium gap-1.5 border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
                title="Mute selected alerts"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Mute Selected ({selectedAlertIds.size})</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full sm:w-auto gap-3">
              <div className="text-[11px] text-muted-foreground hidden sm:block">
                Check boxes to select alerts for bulk deletion
              </div>
              {statusFilter === 'MUTED' && mutedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="delete-all-muted-toolbar-btn"
                  onClick={handleDeleteAllMuted}
                  disabled={deleteMutedMutation.isPending}
                  className="h-7 text-xs font-semibold gap-1.5 border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 hover:text-rose-100 hover:border-rose-400 shadow-sm shadow-rose-950/20"
                  title="Permanently delete all muted alerts"
                >
                  <Trash2 className={cn("w-3.5 h-3.5 text-rose-400", deleteMutedMutation.isPending && "animate-spin")} />
                  <span>Delete All Muted ({mutedCount})</span>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alerts List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Loading price alerts...</p>
          </div>
        ) : processedAlerts.length === 0 ? (
          <Card className="bg-card/40 border-border/60 p-12 text-center">
            <div className="max-w-sm mx-auto flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {searchQuery || statusFilter !== 'ALL' ? 'No matching alerts found' : 'No price alerts set'}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Try clearing your filter or search query.'
                  : 'You can set price alerts from the Watchlist table or click "New Alert" above.'}
              </p>
              <Button
                variant="glow"
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className="mt-2 text-xs bg-primary text-primary-foreground"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Create Price Alert
              </Button>
            </div>
          </Card>
        ) : (
          processedAlerts.map((item) => {
            const isTriggered = item.status === 'TRIGGERED';
            const isMuted = Boolean(item.isMuted);
            const isAbove = item.condition === 'ABOVE';
            const isSelected = selectedAlertIds.has(item.id);

            return (
              <Card
                key={item.id}
                className={cn(
                  "border transition-all hover:border-primary/40 bg-card/60 backdrop-blur-sm p-4 overflow-hidden",
                  isSelected
                    ? "border-primary/70 bg-primary/[0.05] ring-1 ring-primary/40 shadow-sm"
                    : isTriggered && !isMuted
                    ? "border-rose-500/40 bg-rose-950/15 shadow-[0_0_15px_rgba(244,63,94,0.08)]"
                    : isMuted
                    ? "border-border/40 bg-slate-950/30 opacity-80"
                    : "border-border/60"
                )}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  {/* Left: Checkbox + Stock Symbol & Condition */}
                  <div className="flex items-center gap-3.5">
                    {/* Checkbox for batch selection */}
                    <div
                      className="flex items-center justify-center shrink-0 pr-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        id={`select-alert-${item.id}`}
                        checked={isSelected}
                        onCheckedChange={() => handleToggleSelect(item.id)}
                        aria-label={`Select alert for ${item.symbol}`}
                        className="w-4 h-4 rounded border-muted-foreground/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all cursor-pointer"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenGraphs(item.symbol)}
                      className={cn(
                        "w-11 h-11 rounded-xl border flex items-center justify-center font-mono font-black text-sm shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-sm",
                        isTriggered && !isMuted
                          ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:border-rose-400"
                          : isMuted
                          ? "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                          : "bg-primary/10 border-primary/20 text-primary hover:border-cyan-500/50 hover:text-cyan-400"
                      )}
                      title={`Open ${item.symbol} chart in Graph section (new window)`}
                      aria-label={`Open ${item.symbol} chart`}
                    >
                      {isMuted ? <BellOff className="w-5 h-5" /> : item.symbol.slice(0, 3)}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleOpenGraphs(item.symbol)}
                          className="font-mono font-bold text-base text-foreground hover:text-cyan-400 transition-colors flex items-center gap-1.5 group/btn cursor-pointer"
                          title={`Open ${item.symbol} chart in Graph section (new window)`}
                          data-testid={`alert-ticker-${item.symbol.toLowerCase()}`}
                        >
                          <span className="group-hover/btn:underline decoration-cyan-400/50 underline-offset-4">{item.symbol}</span>
                          <LineChart className="w-3.5 h-3.5 text-cyan-400 opacity-60 group-hover/btn:opacity-100 transition-opacity" />
                          <ExternalLink className="w-3 h-3 text-muted-foreground group-hover/btn:text-cyan-400 opacity-50 group-hover/btn:opacity-100 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-all" />
                        </button>

                        <Badge
                          variant="outline"
                          className={cn(
                            "px-2 py-0.5 text-[11px] font-bold border font-mono",
                            isAbove
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          )}
                        >
                          {isAbove ? (
                            <TrendingUp className="w-3 h-3 mr-1 inline" />
                          ) : (
                            <TrendingDown className="w-3 h-3 mr-1 inline" />
                          )}
                          {isAbove ? 'Target ≥' : 'Target ≤'} ${item.targetPrice.toFixed(2)}
                        </Badge>

                        {isTriggered && !isMuted && (
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] font-bold animate-pulse">
                            FIRED
                          </Badge>
                        )}
                        {isMuted && (
                          <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] font-semibold flex items-center gap-1">
                            <BellOff className="w-3 h-3 text-slate-400" />
                            MUTED
                          </Badge>
                        )}
                        {!isTriggered && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                            ACTIVE
                          </Badge>
                        )}

                        {item.notes && item.notes.includes('[Short Option 5% Defense]') && (
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] font-bold flex items-center gap-1 font-mono">
                            <ShieldAlert className="w-3 h-3 text-rose-400" />
                            5% Strike Threat
                          </Badge>
                        )}

                        {item.notes && item.notes.includes('[Short Option 10% Defense]') && (
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] font-bold flex items-center gap-1 font-mono">
                            <Shield className="w-3 h-3 text-amber-400" />
                            10% Strike Buffer
                          </Badge>
                        )}

                        {item.notes && item.notes.includes('[Auto-Bracket +5%]') && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 font-mono">
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                            Auto +5% Bracket
                          </Badge>
                        )}

                        {item.notes && item.notes.includes('[Auto-Bracket -5%]') && (
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] font-bold flex items-center gap-1 font-mono">
                            <TrendingDown className="w-3 h-3 text-rose-400" />
                            Auto -5% Bracket
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {item.stockName && <span className="font-medium text-foreground/80">{item.stockName}</span>}
                        {item.notes && <span className="italic">"{item.notes}"</span>}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Prices & Trigger Info */}
                  <div className="flex flex-wrap items-center gap-6 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                        Current Price
                      </span>
                      <span className="font-mono font-bold text-foreground text-sm">
                        {item.currentPrice ? `$${item.currentPrice.toFixed(2)}` : 'N/A'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                        Distance to Target
                      </span>
                      <span
                        className={cn(
                          "font-mono font-bold text-sm",
                          item.distancePercent != null && item.distancePercent >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        )}
                      >
                        {item.distancePercent != null
                          ? `${item.distancePercent >= 0 ? '+' : ''}${item.distancePercent.toFixed(2)}%`
                          : 'N/A'}
                      </span>
                    </div>

                    {isTriggered ? (
                      <div className={cn(
                        "rounded-lg p-2 border",
                        isMuted
                          ? "bg-slate-900/60 border-slate-800"
                          : "bg-rose-500/10 border-rose-500/20"
                      )}>
                        <span className={cn(
                          "text-[10px] uppercase font-bold block",
                          isMuted ? "text-slate-400" : "text-rose-400"
                        )}>
                          Trigger Record
                        </span>
                        <p className={cn(
                          "font-mono text-xs font-semibold",
                          isMuted ? "text-slate-300" : "text-rose-300"
                        )}>
                          Hit ${item.triggeredPrice ? item.triggeredPrice.toFixed(2) : item.targetPrice.toFixed(2)} on {formatDate(item.triggeredAt)}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                          Created
                        </span>
                        <span className="text-muted-foreground font-mono text-xs">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex items-center gap-1.5 self-end md:self-center flex-wrap">
                    {/* Set Alert Button directly from alert item */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetNewAlertFromExisting(item)}
                      className={cn(
                        "h-8 text-xs gap-1 font-bold shadow-sm transition-all",
                        isTriggered && !isMuted
                          ? "border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary"
                          : "border-border/70 hover:border-primary/40 text-foreground hover:bg-accent/40"
                      )}
                      title={`Set a new follow-up price alert for ${item.symbol}`}
                    >
                      <Plus className="w-3.5 h-3.5 text-primary" />
                      <span>Set Alert</span>
                    </Button>

                    {/* Add to Watchlist Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1 border-border/70 hover:border-primary/40 text-foreground hover:bg-accent/40"
                          title={`Add ${item.symbol} to a watchlist`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FolderPlus className="w-3.5 h-3.5 text-primary" />
                          <span>Watchlist</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-52 bg-popover/95 backdrop-blur-md border border-border p-1 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider px-2 py-1">
                          Add {item.symbol} to Watchlist
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="my-1" />
                        {watchlists.map((w) => {
                          const alreadyInList = (w.items || []).some(
                            (i) => i.symbol.toUpperCase() === item.symbol.toUpperCase()
                          );
                          return (
                            <DropdownMenuItem
                              key={w.id}
                              disabled={alreadyInList}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToWatchlist(w.id, item.symbol, w.name);
                              }}
                              className="text-xs cursor-pointer flex items-center justify-between py-1.5 px-2 rounded-md focus:bg-primary/10"
                            >
                              <span className="truncate font-medium">{w.name}</span>
                              {alreadyInList && (
                                <span className="text-[10px] text-muted-foreground">In list</span>
                              )}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Research Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenResearch(item.symbol)}
                      className="h-8 text-xs gap-1 text-muted-foreground hover:text-primary hover:bg-primary/10"
                      title={`Analyze ${item.symbol} in Research`}
                      aria-label={`Analyze ${item.symbol} in Research`}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-primary" />
                      <span className="hidden xl:inline">Research</span>
                    </Button>

                    {/* Mute / Unmute Button */}
                    {!isMuted ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMute(item)}
                        className={cn(
                          "h-8 text-xs gap-1",
                          isTriggered
                            ? "border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
                            : "border-border/70 hover:bg-accent/40 text-muted-foreground hover:text-foreground"
                        )}
                        title="Mute alert so it stops notifying while keeping alert in list"
                      >
                        <BellOff className="w-3.5 h-3.5 text-slate-400" />
                        <span>Mute</span>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnmute(item)}
                        className="h-8 text-xs gap-1 border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-amber-300"
                        title="Unmute and re-enable alert"
                      >
                        <Bell className="w-3.5 h-3.5 text-amber-400" />
                        <span>Unmute</span>
                      </Button>
                    )}

                    {/* Re-arm Button */}
                    {isTriggered && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReset(item)}
                        className="h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                        title="Re-arm and set active"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Re-arm
                      </Button>
                    )}

                    {/* Edit Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent/40"
                      onClick={() => {
                        setEditingAlert(item);
                        setModalSymbol(item.symbol);
                        setModalPrice(item.currentPrice || 0);
                        setIsModalOpen(true);
                      }}
                      title="Modify Alert"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary hover:bg-primary/20"
                      onClick={() => handleOpenResearch(item.symbol)}
                      title="Research Stock"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                      onClick={() => handleDelete(item.id, item.symbol)}
                      title={`Permanently delete alert for ${item.symbol}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Price Alert Modal (Create / Edit) */}
      <PriceAlertModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setEditingAlert(null);
        }}
        initialSymbol={modalSymbol}
        initialPrice={modalPrice}
        editAlert={editingAlert}
      />
    </div>
  );
}
