import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Bell,
  BellRing,
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
  Edit2
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import {
  useAlerts,
  useDeleteAlert,
  useResetAlert,
  PriceAlert,
} from '@/services/alertService';
import { PriceAlertModal } from './PriceAlertModal';

type SortOption =
  | 'triggered_desc'
  | 'triggered_asc'
  | 'symbol_asc'
  | 'symbol_desc'
  | 'created_desc'
  | 'target_desc';

type StatusFilter = 'ALL' | 'ACTIVE' | 'TRIGGERED';

interface AlertsPageProps {
  onNavigateToResearch?: (symbol: string) => void;
}

export function AlertsPage({ onNavigateToResearch }: AlertsPageProps) {
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
  const resetAlertMutation = useResetAlert();

  // Metrics
  const activeCount = alerts.filter((a) => a.status === 'ACTIVE').length;
  const triggeredCount = alerts.filter((a) => a.status === 'TRIGGERED').length;
  const latestTriggered = alerts
    .filter((a) => a.status === 'TRIGGERED' && a.triggeredAt)
    .sort((a, b) => new Date(b.triggeredAt!).getTime() - new Date(a.triggeredAt!).getTime())[0];

  // Filter & Sort
  const processedAlerts = useMemo(() => {
    let list = [...alerts];

    // Status Filter
    if (statusFilter !== 'ALL') {
      list = list.filter((a) => a.status === statusFilter);
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
    if (confirm(`Are you sure you want to delete the price alert for ${symbol}?`)) {
      try {
        await deleteAlertMutation.mutateAsync(id);
      } catch (err: any) {
        alert(`Failed to delete alert: ${err.message}`);
      }
    }
  };

  const handleReset = async (alertItem: PriceAlert) => {
    try {
      await resetAlertMutation.mutateAsync({
        id: alertItem.id,
        targetPrice: alertItem.targetPrice,
        condition: alertItem.condition,
      });
    } catch (err: any) {
      alert(`Failed to re-arm alert: ${err.message}`);
    }
  };

  const handleOpenResearch = (symbol: string) => {
    if (onNavigateToResearch) {
      onNavigateToResearch(symbol);
    } else {
      window.dispatchEvent(new CustomEvent('select-research-ticker', { detail: symbol }));
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
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              Price Alerts
            </h1>
            {triggeredCount > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs font-semibold animate-pulse">
                <BellRing className="w-3.5 h-3.5 mr-1" />
                {triggeredCount} Triggered
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time price monitoring and triggered alert history. Sorted by trigger time, ticker, and target level.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Active Monitoring</p>
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
          </div>
          <p className="text-2xl font-bold font-mono text-primary mt-1">{activeCount}</p>
        </Card>

        <Card className="bg-card/60 border-amber-500/20 p-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Triggered Alerts</p>
          <p className="text-2xl font-bold font-mono text-amber-400 mt-1">{triggeredCount}</p>
        </Card>

        <Card className="bg-card/60 border-border/60 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Latest Trigger</p>
          <p className="text-sm font-bold font-mono text-foreground mt-1 truncate">
            {latestTriggered ? `${latestTriggered.symbol} @ $${latestTriggered.triggeredPrice?.toFixed(2)}` : 'None'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {latestTriggered ? formatDate(latestTriggered.triggeredAt) : 'No alerts triggered yet'}
          </p>
        </Card>
      </div>

      {/* Filter Tabs & Search / Sort Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-card/60 border border-border/60 rounded-xl">
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
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Triggered ({triggeredCount})
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
                <Plus className="w-3.5 h-3.5 mr-1" /> Create Your First Alert
              </Button>
            </div>
          </Card>
        ) : (
          processedAlerts.map((item) => {
            const isTriggered = item.status === 'TRIGGERED';
            const isAbove = item.condition === 'ABOVE';

            return (
              <Card
                key={item.id}
                className={cn(
                  "border transition-all hover:border-primary/40 bg-card/60 backdrop-blur-sm p-4 overflow-hidden",
                  isTriggered ? "border-amber-500/30 bg-amber-950/10" : "border-border/60"
                )}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  {/* Left: Stock Symbol & Condition */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-xl border flex items-center justify-center font-mono font-black text-sm shrink-0",
                        isTriggered
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                          : "bg-primary/10 border-primary/20 text-primary"
                      )}
                    >
                      {item.symbol.slice(0, 3)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
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
                              ? "bg-success/10 text-success border-success/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          )}
                        >
                          {isAbove ? (
                            <TrendingUp className="w-3 h-3 mr-1 inline" />
                          ) : (
                            <TrendingDown className="w-3 h-3 mr-1 inline" />
                          )}
                          {isAbove ? 'Price ≥' : 'Price ≤'} ${item.targetPrice.toFixed(2)}
                        </Badge>

                        {isTriggered ? (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold">
                            TRIGGERED
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                            ACTIVE
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
                            ? "text-success"
                            : "text-destructive"
                        )}
                      >
                        {item.distancePercent != null
                          ? `${item.distancePercent >= 0 ? '+' : ''}${item.distancePercent.toFixed(2)}%`
                          : 'N/A'}
                      </span>
                    </div>

                    {isTriggered ? (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                        <span className="text-[10px] uppercase font-bold text-amber-400 block">
                          Triggered Info
                        </span>
                        <p className="font-mono text-xs font-semibold text-amber-300">
                          Hit ${item.triggeredPrice ? item.triggeredPrice.toFixed(2) : item.targetPrice.toFixed(2)} at {formatDate(item.triggeredAt)}
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
                  <div className="flex items-center gap-1.5 self-end md:self-center">
                    {isTriggered && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReset(item)}
                        className="h-8 text-xs gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        title="Re-arm alert"
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
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(item.id, item.symbol)}
                      title="Delete Alert"
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
