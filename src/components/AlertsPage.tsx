import { useState, useMemo } from 'react';
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
  ShieldAlert
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import {
  useAlerts,
  useDeleteAlert,
  useDeleteMutedAlerts,
  useBulkMuteAlerts,
  useResetAlert,
  useMuteAlert,
  useUnmuteAlert,
  useSyncShortOptionAlerts,
  PriceAlert,
} from '@/services/alertService';
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
}

export function AlertsPage({ onNavigateToResearch }: AlertsPageProps) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('triggered_desc');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
  const [modalSymbol, setModalSymbol] = useState('');
  const [modalPrice, setModalPrice] = useState(0);

  const { data: alerts = [], isLoading, isRefetching, refetch } = useAlerts();
  const deleteAlertMutation = useDeleteAlert();
  const deleteMutedMutation = useDeleteMutedAlerts();
  const bulkMuteMutation = useBulkMuteAlerts();
  const resetAlertMutation = useResetAlert();
  const muteAlertMutation = useMuteAlert();
  const unmuteAlertMutation = useUnmuteAlert();
  const syncShortAlertsMutation = useSyncShortOptionAlerts();

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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
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

  const handleDelete = async (id: string, symbol: string) => {
    try {
      await deleteAlertMutation.mutateAsync(id);
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

  const handleDeleteAllMuted = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete all ${mutedCount} muted alerts?`)) return;
    try {
      const res = await deleteMutedMutation.mutateAsync();
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

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-border/60 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Alerts</p>
          <p className="text-2xl font-bold font-mono text-foreground mt-1">{alerts.length}</p>
        </Card>

        <Card className="bg-card/60 border-primary/20 p-4">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Active Targets</p>
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
          </div>
          <p className="text-2xl font-bold font-mono text-primary mt-1">{activeCount}</p>
        </Card>

        <Card className={cn(
          "p-4 border",
          unmutedTriggeredCount > 0
            ? "bg-rose-950/20 border-rose-500/30"
            : "bg-card/60 border-border/60"
        )}>
          <div className="flex justify-between items-start">
            <p className={cn("text-xs font-semibold uppercase tracking-wider", unmutedTriggeredCount > 0 ? "text-rose-400" : "text-muted-foreground")}>
              Unmuted Fired
            </p>
            {unmutedTriggeredCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
          </div>
          <p className={cn("text-2xl font-bold font-mono mt-1", unmutedTriggeredCount > 0 ? "text-rose-300" : "text-foreground")}>
            {unmutedTriggeredCount}
          </p>
        </Card>

        <Card className="bg-card/60 border-border/60 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Muted / Acknowledged</p>
          <p className="text-2xl font-bold font-mono text-muted-foreground mt-1">{mutedCount}</p>
        </Card>
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

            return (
              <Card
                key={item.id}
                className={cn(
                  "border transition-all hover:border-primary/40 bg-card/60 backdrop-blur-sm p-4 overflow-hidden",
                  isTriggered && !isMuted
                    ? "border-rose-500/40 bg-rose-950/15 shadow-[0_0_15px_rgba(244,63,94,0.08)]"
                    : isMuted
                    ? "border-border/40 bg-slate-950/30 opacity-80"
                    : "border-border/60"
                )}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  {/* Left: Stock Symbol & Condition */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-xl border flex items-center justify-center font-mono font-black text-sm shrink-0",
                        isTriggered && !isMuted
                          ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                          : isMuted
                          ? "bg-slate-800 border-slate-700 text-slate-400"
                          : "bg-primary/10 border-primary/20 text-primary"
                      )}
                    >
                      {isMuted ? <BellOff className="w-5 h-5" /> : item.symbol.slice(0, 3)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleOpenResearch(item.symbol)}
                          className="font-mono font-bold text-base text-foreground hover:text-primary transition-colors flex items-center gap-1 group/btn"
                        >
                          {item.symbol}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 text-primary transition-opacity" />
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
