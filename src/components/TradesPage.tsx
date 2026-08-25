import React, { useState, useEffect } from 'react';
import {
  useTrades,
  useSyncTrades,
  useCreateTrade,
  useDeleteTrade,
  UnifiedTrade,
  TradeFilterParams
} from '@/services/tradeService';
import {
  Search,
  RefreshCw,
  Download,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  Zap,
  Clock,
  ShieldAlert,
  Info,
  Trash2,
  Eye,
  Check,
  X,
  FileSpreadsheet,
  SlidersHorizontal
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { OptionsTradeAgentModal } from './trades/OptionsTradeAgentModal';
import { BuyingPowerAnalyserModal } from './portfolio/BuyingPowerAnalyserModal';
import { OptionsTradeOpportunity } from '@/services/optionsTradeAgentService';

interface TradesPageProps {
  onNavigateToResearch?: (symbol: string) => void;
}

export function TradesPage({ onNavigateToResearch }: TradesPageProps = {}) {
  // Filter States
  const [search, setSearch] = useState('');
  const [broker, setBroker] = useState<string>('all');
  const [dateRangePreset, setDateRangePreset] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [assetType, setAssetType] = useState<string>('all');
  const [optionType, setOptionType] = useState<string>('all');
  const [positionEffect, setPositionEffect] = useState<string>('all');
  const [action, setAction] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);

  // Modal States
  const [selectedTrade, setSelectedTrade] = useState<UnifiedTrade | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [isOptionsAgentModalOpen, setIsOptionsAgentModalOpen] = useState<boolean>(false);
  const [isBuyingPowerModalOpen, setIsBuyingPowerModalOpen] = useState<boolean>(false);
  const [newTrade, setNewTrade] = useState<Partial<UnifiedTrade>>({
    broker: 'Manual',
    symbol: '',
    assetType: 'EQUITY',
    action: 'BUY',
    side: 'BUY',
    positionEffect: 'LONG',
    quantity: 10,
    price: 100,
    totalValue: 1000,
    valueEffect: 'DEBIT',
    commission: 0
  });

  const queryFilters: TradeFilterParams = {
    search: search.trim() || undefined,
    broker: broker !== 'all' ? broker : undefined,
    dateRangePreset: dateRangePreset !== 'all' ? dateRangePreset : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    assetType: assetType !== 'all' ? assetType : undefined,
    optionType: optionType !== 'all' ? optionType : undefined,
    positionEffect: positionEffect !== 'all' ? positionEffect : undefined,
    action: action !== 'all' ? action : undefined,
    page,
    limit
  };

  const { data: response, isLoading, refetch, isFetching } = useTrades(queryFilters);
  const syncMutation = useSyncTrades();
  const createMutation = useCreateTrade();
  const deleteMutation = useDeleteTrade();

  const trades = response?.trades || [];
  const metrics = response?.metrics || {
    totalTrades: 0,
    totalBoughtValue: 0,
    totalSoldValue: 0,
    totalCredits: 0,
    totalDebits: 0,
    netCashFlow: 0,
    totalCommissions: 0,
    optionsCount: 0,
    equitiesCount: 0,
    longCount: 0,
    shortCount: 0
  };

  // Sync on first load if no trades in DB yet
  useEffect(() => {
    if (response && response.trades.length === 0 && !syncMutation.isPending) {
      handleSync();
    }
  }, [response?.trades.length]);

  const handleSync = async () => {
    try {
      const res = await syncMutation.mutateAsync(queryFilters);
      toast.success(`Synced ${res.syncedCount || 0} live trade fills from brokers!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync trades from broker.');
    }
  };

  const handleCreateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrade.symbol) {
      toast.error('Symbol is required.');
      return;
    }
    try {
      await createMutation.mutateAsync(newTrade);
      setIsLogModalOpen(false);
      toast.success('Trade logged successfully.');
      setNewTrade({
        broker: 'Manual',
        symbol: '',
        assetType: 'EQUITY',
        action: 'BUY',
        side: 'BUY',
        positionEffect: 'LONG',
        quantity: 10,
        price: 100,
        totalValue: 1000,
        valueEffect: 'DEBIT',
        commission: 0
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create trade.');
    }
  };

  const handleDeleteTrade = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Trade record deleted.');
      if (selectedTrade?.id === id) setSelectedTrade(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete trade.');
    }
  };

  const handleSelectTradeToLog = (opp: OptionsTradeOpportunity) => {
    const primaryLeg = opp.legs[0];
    const expCompact = opp.targetExpiration.replace(/-/g, '').slice(2);
    const strikeFormatted = (primaryLeg.strike * 1000).toString().padStart(8, '0');
    const occSymbol = `${opp.symbol.padEnd(6, ' ')}${expCompact}${primaryLeg.optionType === 'CALL' ? 'C' : 'P'}${strikeFormatted}`;

    setNewTrade({
      broker: 'Manual',
      symbol: occSymbol,
      underlyingSymbol: opp.symbol,
      assetType: 'OPTION',
      optionType: primaryLeg.optionType,
      strikePrice: primaryLeg.strike,
      expiryDate: opp.targetExpiration,
      action: primaryLeg.action === 'SELL' ? 'SELL_TO_OPEN' : 'BUY_TO_OPEN',
      side: primaryLeg.action,
      positionEffect: primaryLeg.action === 'SELL' ? 'SHORT' : 'LONG',
      quantity: 1,
      price: primaryLeg.mid,
      totalValue: opp.netPremiumTotal,
      valueEffect: opp.netEffect,
      commission: 0,
      description: `${opp.strategyName} on ${opp.symbol}`
    });
    setIsLogModalOpen(true);
  };

  const handleExportCSV = () => {
    if (trades.length === 0) {
      toast.error('No trades to export.');
      return;
    }

    const headers = [
      'Executed At',
      'Broker',
      'Symbol',
      'Underlying',
      'Asset Type',
      'Option Type',
      'Strike',
      'Expiry',
      'Action',
      'Side',
      'Position Effect',
      'Quantity',
      'Price',
      'Total Value',
      'Value Effect',
      'Commission',
      'Fees',
      'Order ID',
      'Description'
    ];

    const rows = trades.map(t => [
      t.executedAt,
      t.broker,
      `"${t.symbol}"`,
      t.underlyingSymbol || '',
      t.assetType,
      t.optionType || '',
      t.strikePrice || '',
      t.expiryDate || '',
      t.action,
      t.side,
      t.positionEffect,
      t.quantity,
      t.price,
      t.totalValue,
      t.valueEffect || '',
      t.commission || 0,
      t.clearingFees || 0,
      t.orderId || '',
      `"${(t.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trades_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${trades.length} trades to CSV!`);
  };

  const clearAllFilters = () => {
    setSearch('');
    setBroker('all');
    setDateRangePreset('all');
    setStartDate('');
    setEndDate('');
    setAssetType('all');
    setOptionType('all');
    setPositionEffect('all');
    setAction('all');
    setPage(1);
  };

  const hasActiveFilters =
    search !== '' ||
    broker !== 'all' ||
    dateRangePreset !== 'all' ||
    startDate !== '' ||
    endDate !== '' ||
    assetType !== 'all' ||
    optionType !== 'all' ||
    positionEffect !== 'all' ||
    action !== 'all';

  const formatCurr = (val?: number, decimals = 2) => {
    if (val === undefined || isNaN(val)) return '$0.00';
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  const getActionBadge = (act: string, effect?: string) => {
    const u = act.toUpperCase();
    if (u === 'BUY_TO_OPEN') {
      return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold">BUY TO OPEN</Badge>;
    }
    if (u === 'SELL_TO_CLOSE') {
      return <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/40 text-[10px] font-bold">SELL TO CLOSE</Badge>;
    }
    if (u === 'SELL_TO_OPEN') {
      return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] font-bold">SELL TO OPEN</Badge>;
    }
    if (u === 'BUY_TO_CLOSE') {
      return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold">BUY TO CLOSE</Badge>;
    }
    if (u.includes('BUY')) {
      return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold">BUY</Badge>;
    }
    if (u.includes('SELL')) {
      return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] font-bold">SELL</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] font-bold">{u}</Badge>;
  };

  const getBrokerBadge = (b: string) => {
    if (b.toLowerCase().includes('tasty')) {
      return <Badge variant="outline" className="bg-rose-950/30 text-rose-300 border-rose-500/30 text-[10px] font-mono">Tastytrade</Badge>;
    }
    if (b.toLowerCase().includes('interactive') || b.toLowerCase().includes('ibkr')) {
      return <Badge variant="outline" className="bg-blue-950/30 text-blue-300 border-blue-500/30 text-[10px] font-mono">IBKR</Badge>;
    }
    return <Badge variant="outline" className="bg-muted/40 text-muted-foreground text-[10px] font-mono">{b}</Badge>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-black tracking-tight text-foreground glow-text-white">
              Trade & Execution Command
            </h1>
            <Badge className="bg-primary/20 text-primary border-primary/40 font-mono text-xs">
              {metrics.totalTrades} Fills
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs pt-1">
            Real-time cross-brokerage execution ledger, order fills, cash flow, and fee telemetry.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* AI Options Trade Finding Agent */}
          <Button
            size="sm"
            onClick={() => setIsOptionsAgentModalOpen(true)}
            className="h-9 text-xs gap-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-purple-600/25 transition-all"
            title="Scan options strategies, IV Rank / IV Percentile, and quantitative win rates"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Options Trade Agent</span>
            <Badge className="bg-purple-500/30 text-purple-200 text-[9px] px-1.5 py-0 font-mono font-bold border border-purple-400/40">
              AI Strategies
            </Badge>
          </Button>

          {/* Buying Power Analyser Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBuyingPowerModalOpen(true)}
            className="h-9 text-xs gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 font-bold transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)]"
            title="Check available buying power & margin cushion before trading"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Buying Power</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleSync}
            disabled={syncMutation.isPending || isFetching}
            className="h-9 text-xs gap-1.5 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-semibold border border-border/70 shadow-sm"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", (syncMutation.isPending || isFetching) && "animate-spin")} />
            <span>{syncMutation.isPending ? 'Syncing Fills...' : 'Sync Live Fills'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={trades.length === 0}
            className="h-9 text-xs gap-1.5 text-foreground hover:bg-accent"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLogModalOpen(true)}
            className="h-9 text-xs gap-1.5 text-foreground hover:bg-accent"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span>Log Trade</span>
          </Button>
        </div>
      </div>

      {/* ================= SUMMARY KPIS ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
        {/* Total Trades & Volume */}
        <div className="bg-card/50 p-3.5 rounded-xl border border-border/60 shadow-sm">
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground block">
            Filtered Trades
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-xl font-black text-foreground">{metrics.totalTrades}</strong>
            <span className="text-[11px] text-muted-foreground font-sans">fills</span>
          </div>
          <span className="text-[11px] text-muted-foreground block mt-1">
            {metrics.equitiesCount} Eq • {metrics.optionsCount} Opt
          </span>
        </div>

        {/* Bought Volume */}
        <div className="bg-card/50 p-3.5 rounded-xl border border-emerald-500/30 shadow-sm">
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-emerald-400 block">
            Total Bought Volume
          </span>
          <strong className="text-xl font-black text-emerald-300 mt-1 block">
            {formatCurr(metrics.totalBoughtValue)}
          </strong>
          <span className="text-[11px] text-emerald-400/80 block mt-1">
            {metrics.longCount} Long trades
          </span>
        </div>

        {/* Sold Volume */}
        <div className="bg-card/50 p-3.5 rounded-xl border border-purple-500/30 shadow-sm">
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-purple-400 block">
            Total Sold Volume
          </span>
          <strong className="text-xl font-black text-purple-300 mt-1 block">
            {formatCurr(metrics.totalSoldValue)}
          </strong>
          <span className="text-[11px] text-purple-400/80 block mt-1">
            {metrics.shortCount} Short / Sold trades
          </span>
        </div>

        {/* Net Premium Flow */}
        <div className="bg-card/50 p-3.5 rounded-xl border border-border/60 shadow-sm">
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground block">
            Net Premium Flow
          </span>
          <strong className={cn(
            "text-xl font-black mt-1 block",
            metrics.netCashFlow >= 0 ? "text-emerald-400" : "text-rose-400"
          )}>
            {metrics.netCashFlow >= 0 ? '+' : ''}{formatCurr(metrics.netCashFlow)}
          </strong>
          <span className="text-[11px] text-muted-foreground block mt-1">
            {formatCurr(metrics.totalCredits)} credits / {formatCurr(metrics.totalDebits)} debits
          </span>
        </div>

        {/* Commissions & Fees */}
        <div className="bg-card/50 p-3.5 rounded-xl border border-amber-500/30 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-amber-400 block">
            Commissions & Fees
          </span>
          <strong className="text-xl font-black text-amber-300 mt-1 block">
            {formatCurr(metrics.totalCommissions)}
          </strong>
          <span className="text-[11px] text-muted-foreground block mt-1">
            Exchange & Reg fees
          </span>
        </div>
      </div>

      {/* ================= MULTIFACETED FILTERS BAR ================= */}
      <Card className="bg-card/40 border-border/60 shadow-sm p-4 space-y-3">
        {/* Row 1: Search, Broker, Date Range Presets */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search symbol, underlying, description (e.g. AAPL, Put, $13)..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 bg-background/80 border-border/70 text-xs h-9"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Broker Filter Segment */}
          <div className="flex items-center gap-1 bg-background/60 p-1 rounded-xl border border-border/60 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">Broker:</span>
            {(['all', 'Tastytrade', 'Interactive Brokers'] as const).map((b) => (
              <Button
                key={b}
                variant={broker === b ? 'default' : 'ghost'}
                size="sm"
                onClick={() => { setBroker(b); setPage(1); }}
                className={cn("h-7 px-2.5 text-xs font-semibold rounded-lg", broker === b && "bg-primary text-white shadow-sm")}
              >
                {b === 'all' ? 'All' : b === 'Interactive Brokers' ? 'IBKR' : 'Tastytrade'}
              </Button>
            ))}
          </div>

          {/* Date Range Presets */}
          <div className="flex items-center gap-1 bg-background/60 p-1 rounded-xl border border-border/60 shrink-0 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">Date:</span>
            {[
              { label: 'All', val: 'all' },
              { label: 'Today', val: 'today' },
              { label: '7D', val: '7d' },
              { label: '30D', val: '30d' },
              { label: '90D', val: '90d' },
              { label: 'YTD', val: 'ytd' }
            ].map((preset) => (
              <Button
                key={preset.val}
                variant={dateRangePreset === preset.val ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setDateRangePreset(preset.val);
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
                className={cn("h-7 px-2 text-xs font-semibold rounded-lg", dateRangePreset === preset.val && "bg-primary text-white shadow-sm")}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Row 2: Asset Type, Direction (Short/Long), Action, Custom Dates, Clear */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/30 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Asset Type (Options vs Equities) */}
            <div className="flex items-center gap-1 bg-background/60 p-0.5 rounded-lg border border-border/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">Asset:</span>
              {[
                { label: 'All', val: 'all' },
                { label: 'Equities 📈', val: 'EQUITY' },
                { label: 'Options ⚡', val: 'OPTION' }
              ].map(opt => (
                <Button
                  key={opt.val}
                  variant={assetType === opt.val ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => { setAssetType(opt.val); setPage(1); }}
                  className={cn("h-6 px-2 text-[11px] font-semibold", assetType === opt.val && "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40")}
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            {/* Position Direction (Short vs Long) */}
            <div className="flex items-center gap-1 bg-background/60 p-0.5 rounded-lg border border-border/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">Direction:</span>
              {[
                { label: 'All', val: 'all' },
                { label: 'Long 🟢', val: 'LONG' },
                { label: 'Short 🟣', val: 'SHORT' }
              ].map(dir => (
                <Button
                  key={dir.val}
                  variant={positionEffect === dir.val ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => { setPositionEffect(dir.val); setPage(1); }}
                  className={cn("h-6 px-2 text-[11px] font-semibold", positionEffect === dir.val && "bg-purple-500/20 text-purple-300 border border-purple-500/40")}
                >
                  {dir.label}
                </Button>
              ))}
            </div>

            {/* Action Filter */}
            <div className="flex items-center gap-1 bg-background/60 p-0.5 rounded-lg border border-border/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">Action:</span>
              {[
                { label: 'All', val: 'all' },
                { label: 'Buy', val: 'BUY' },
                { label: 'Sell', val: 'SELL' },
                { label: 'BTO', val: 'BUY_TO_OPEN' },
                { label: 'STO', val: 'SELL_TO_OPEN' },
                { label: 'BTC', val: 'BUY_TO_CLOSE' },
                { label: 'STC', val: 'SELL_TO_CLOSE' }
              ].map(act => (
                <Button
                  key={act.val}
                  variant={action === act.val ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => { setAction(act.val); setPage(1); }}
                  className={cn("h-6 px-1.5 text-[10px] font-mono font-bold", action === act.val && "bg-primary/20 text-primary border border-primary/40")}
                >
                  {act.label}
                </Button>
              ))}
            </div>

            {/* Custom Date Inputs */}
            <div className="flex items-center gap-1.5 bg-background/60 px-2 py-1 rounded-lg border border-border/60 text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setDateRangePreset('custom'); setPage(1); }}
                className="bg-transparent border-0 text-[11px] text-foreground p-0 focus:outline-none"
              />
              <span className="text-muted-foreground">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setDateRangePreset('custom'); setPage(1); }}
                className="bg-transparent border-0 text-[11px] text-foreground p-0 focus:outline-none"
              />
            </div>
          </div>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-7 px-2.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 gap-1 ml-auto"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </Button>
          )}
        </div>
      </Card>

      {/* ================= TRADES FILLS TABLE ================= */}
      <div className="glass-card rounded-2xl overflow-hidden border border-border/60 shadow-xl bg-card/30">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-slate-950/40 text-muted-foreground font-semibold">
                <th className="text-left p-3.5 pl-4 uppercase tracking-wider">Executed At</th>
                <th className="text-left p-3.5 uppercase tracking-wider">Broker</th>
                <th className="text-left p-3.5 uppercase tracking-wider">Asset & Symbol</th>
                <th className="text-center p-3.5 uppercase tracking-wider">Type</th>
                <th className="text-center p-3.5 uppercase tracking-wider">Direction</th>
                <th className="text-center p-3.5 uppercase tracking-wider">Action</th>
                <th className="text-right p-3.5 uppercase tracking-wider">Qty</th>
                <th className="text-right p-3.5 uppercase tracking-wider">Price</th>
                <th className="text-right p-3.5 uppercase tracking-wider">Total Value</th>
                <th className="text-right p-3.5 uppercase tracking-wider">Fees</th>
                <th className="text-center p-3.5 pr-4 uppercase tracking-wider">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-20 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading trade execution history...
                  </td>
                </tr>
              ) : trades.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-20 text-center space-y-2">
                    <Info className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-sm font-semibold text-foreground">No trades found matching criteria</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      {hasActiveFilters ? 'Try adjusting or clearing your filters.' : 'Click "Sync Live Fills" to pull recent transactions from connected brokers.'}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={clearAllFilters} className="text-xs mt-2">
                        Clear All Filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                trades.map((trade) => {
                  const execDate = new Date(trade.executedAt);
                  const isOption = trade.assetType === 'OPTION';
                  const isCredit = trade.valueEffect === 'CREDIT' || (!trade.valueEffect && trade.side === 'SELL');
                  const isLong = trade.positionEffect === 'LONG';
                  const totalFee = (trade.commission || 0) + (trade.clearingFees || 0);

                  return (
                    <tr
                      key={trade.id}
                      onClick={() => setSelectedTrade(trade)}
                      className="hover:bg-accent/40 transition-colors cursor-pointer group"
                    >
                      {/* Date & Time */}
                      <td className="p-3.5 pl-4 font-mono text-[11px] whitespace-nowrap">
                        <div className="font-semibold text-foreground">
                          {execDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {execDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Broker */}
                      <td className="p-3.5 whitespace-nowrap">
                        {getBrokerBadge(trade.broker)}
                      </td>

                      {/* Symbol & Description */}
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-foreground font-mono text-sm tracking-tight">
                              {trade.underlyingSymbol || trade.symbol}
                            </span>
                            {isOption && (
                              <Badge variant="outline" className={cn(
                                "text-[10px] font-mono font-bold px-1.5 py-0",
                                trade.optionType === 'CALL' ? "text-emerald-400 border-emerald-500/40 bg-emerald-950/20" : "text-rose-400 border-rose-500/40 bg-rose-950/20"
                              )}>
                                {trade.strikePrice ? `$${trade.strikePrice}` : ''} {trade.optionType || 'OPT'}
                              </Badge>
                            )}
                            {isOption && trade.expiryDate && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                exp {trade.expiryDate}
                              </span>
                            )}
                          </div>
                          {trade.description && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-xs block font-sans">
                              {trade.description}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <Badge variant="secondary" className={cn(
                          "text-[10px] font-bold uppercase",
                          isOption ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30" : "bg-blue-500/10 text-blue-300 border border-blue-500/30"
                        )}>
                          {trade.assetType}
                        </Badge>
                      </td>

                      {/* Direction (Long vs Short) */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <Badge variant="outline" className={cn(
                          "text-[10px] font-bold uppercase font-mono",
                          isLong ? "text-emerald-400 border-emerald-500/40 bg-emerald-950/20" : "text-purple-400 border-purple-500/40 bg-purple-950/20"
                        )}>
                          {trade.positionEffect}
                        </Badge>
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {getActionBadge(trade.action, trade.positionEffect)}
                      </td>

                      {/* Quantity */}
                      <td className="p-3.5 text-right font-mono font-bold text-foreground">
                        {trade.quantity}
                      </td>

                      {/* Fill Price */}
                      <td className="p-3.5 text-right font-mono text-foreground">
                        ${trade.price.toFixed(2)}
                      </td>

                      {/* Total Value */}
                      <td className="p-3.5 text-right font-mono whitespace-nowrap">
                        <span className={cn("font-black text-sm", isCredit ? "text-emerald-400" : "text-rose-400")}>
                          {isCredit ? '+' : '-'}{formatCurr(trade.totalValue)}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider block text-muted-foreground">
                          {trade.valueEffect || (isCredit ? 'CREDIT' : 'DEBIT')}
                        </span>
                      </td>

                      {/* Fees */}
                      <td className="p-3.5 text-right font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {totalFee > 0 ? `$${totalFee.toFixed(2)}` : '$0.00'}
                      </td>

                      {/* Detail View */}
                      <td className="p-3.5 pr-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground group-hover:text-primary transition-colors"
                            onClick={(e) => { e.stopPropagation(); setSelectedTrade(trade); }}
                            title="Inspect Order Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {trade.broker === 'Manual' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                              onClick={(e) => handleDeleteTrade(trade.id, e)}
                              title="Delete Manual Trade"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= TRADE DETAIL INSPECTION MODAL ================= */}
      {selectedTrade && (
        <Dialog open={Boolean(selectedTrade)} onOpenChange={(open) => !open && setSelectedTrade(null)}>
          <DialogContent className="w-[95vw] sm:max-w-2xl bg-background/95 backdrop-blur-2xl border border-primary/30 shadow-2xl rounded-2xl p-6 space-y-4">
            <DialogHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {getBrokerBadge(selectedTrade.broker)}
                  <Badge variant="outline" className="text-xs font-mono font-bold">
                    {selectedTrade.assetType}
                  </Badge>
                  {selectedTrade.positionEffect && (
                    <Badge className={cn("text-xs font-mono font-bold", selectedTrade.positionEffect === 'LONG' ? "bg-emerald-500/20 text-emerald-300" : "bg-purple-500/20 text-purple-300")}>
                      {selectedTrade.positionEffect}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {new Date(selectedTrade.executedAt).toLocaleString()}
                </span>
              </div>

              <DialogTitle className="text-xl font-black tracking-tight text-foreground pt-1 flex items-center gap-2">
                <span>{selectedTrade.underlyingSymbol || selectedTrade.symbol}</span>
                {getActionBadge(selectedTrade.action)}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {selectedTrade.description || 'Order execution fill telemetry'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-2.5 rounded-xl bg-card/60 border border-border/40">
                <span className="text-[10px] text-muted-foreground font-sans block">Quantity</span>
                <strong className="text-base font-bold text-foreground">{selectedTrade.quantity}</strong>
              </div>

              <div className="p-2.5 rounded-xl bg-card/60 border border-border/40">
                <span className="text-[10px] text-muted-foreground font-sans block">Fill Price</span>
                <strong className="text-base font-bold text-foreground">${selectedTrade.price.toFixed(2)}</strong>
              </div>

              <div className="p-2.5 rounded-xl bg-card/60 border border-border/40">
                <span className="text-[10px] text-muted-foreground font-sans block">Total Value</span>
                <strong className={cn("text-base font-bold", selectedTrade.valueEffect === 'CREDIT' ? "text-emerald-400" : "text-rose-400")}>
                  {selectedTrade.valueEffect === 'CREDIT' ? '+' : '-'}{formatCurr(selectedTrade.totalValue)}
                </strong>
              </div>

              <div className="p-2.5 rounded-xl bg-card/60 border border-border/40">
                <span className="text-[10px] text-muted-foreground font-sans block">Commission & Fees</span>
                <strong className="text-base font-bold text-amber-300">
                  ${((selectedTrade.commission || 0) + (selectedTrade.clearingFees || 0)).toFixed(2)}
                </strong>
              </div>
            </div>

            {/* Option Details if Option */}
            {selectedTrade.assetType === 'OPTION' && (
              <div className="p-3 rounded-xl bg-card/40 border border-border/60 text-xs space-y-1.5 font-mono">
                <span className="text-[10px] uppercase font-bold text-muted-foreground font-sans block">Option Contract Details</span>
                <div className="grid grid-cols-3 gap-2">
                  <div><b>Strike:</b> {selectedTrade.strikePrice ? `$${selectedTrade.strikePrice}` : 'N/A'}</div>
                  <div><b>Type:</b> {selectedTrade.optionType || 'N/A'}</div>
                  <div><b>Expiration:</b> {selectedTrade.expiryDate || 'N/A'}</div>
                </div>
                <div className="text-[11px] text-muted-foreground pt-1 truncate">
                  <b>Full Contract Symbol:</b> {selectedTrade.symbol}
                </div>
              </div>
            )}

            {/* Technical Identifiers */}
            <div className="p-3 rounded-xl bg-slate-950 border border-border/40 font-mono text-[11px] text-muted-foreground space-y-1">
              <div><b>Broker Transaction ID:</b> {selectedTrade.brokerTradeId || 'N/A'}</div>
              {selectedTrade.orderId && <div><b>Order ID:</b> {selectedTrade.orderId}</div>}
              <div><b>Database Record ID:</b> {selectedTrade.id}</div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= LOG MANUAL TRADE MODAL ================= */}
      {isLogModalOpen && (
        <Dialog open={isLogModalOpen} onOpenChange={setIsLogModalOpen}>
          <DialogContent className="w-[95vw] sm:max-w-lg bg-background/95 backdrop-blur-2xl border border-primary/30 shadow-2xl rounded-2xl p-6 space-y-4">
            <DialogHeader className="pb-2 border-b border-border/60">
              <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Log Manual Trade
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Record a trade executed externally, on paper, or from an unlinked account.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateTrade} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Broker</label>
                  <Input
                    value={newTrade.broker}
                    onChange={(e) => setNewTrade({ ...newTrade, broker: e.target.value })}
                    placeholder="e.g. Manual, Webull, Robinhood"
                    className="h-8 text-xs bg-card"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Symbol *</label>
                  <Input
                    required
                    value={newTrade.symbol}
                    onChange={(e) => setNewTrade({ ...newTrade, symbol: e.target.value.toUpperCase() })}
                    placeholder="e.g. NVDA, AAPL"
                    className="h-8 text-xs bg-card uppercase font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Asset Type</label>
                  <select
                    value={newTrade.assetType}
                    onChange={(e) => setNewTrade({ ...newTrade, assetType: e.target.value as any })}
                    className="w-full h-8 text-xs bg-card rounded-md border border-input px-2 text-foreground"
                  >
                    <option value="EQUITY">Equity / Stock</option>
                    <option value="OPTION">Option Contract</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Action</label>
                  <select
                    value={newTrade.action}
                    onChange={(e) => setNewTrade({
                      ...newTrade,
                      action: e.target.value,
                      side: e.target.value.includes('BUY') ? 'BUY' : 'SELL',
                      positionEffect: e.target.value.includes('BUY') ? 'LONG' : 'SHORT',
                      valueEffect: e.target.value.includes('BUY') ? 'DEBIT' : 'CREDIT'
                    })}
                    className="w-full h-8 text-xs bg-card rounded-md border border-input px-2 text-foreground font-mono"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                    <option value="BUY_TO_OPEN">BUY TO OPEN</option>
                    <option value="SELL_TO_CLOSE">SELL TO CLOSE</option>
                    <option value="SELL_TO_OPEN">SELL TO OPEN</option>
                    <option value="BUY_TO_CLOSE">BUY TO CLOSE</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Direction</label>
                  <select
                    value={newTrade.positionEffect}
                    onChange={(e) => setNewTrade({ ...newTrade, positionEffect: e.target.value as any })}
                    className="w-full h-8 text-xs bg-card rounded-md border border-input px-2 text-foreground font-mono"
                  >
                    <option value="LONG">LONG</option>
                    <option value="SHORT">SHORT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Quantity</label>
                  <Input
                    type="number"
                    step="any"
                    value={newTrade.quantity}
                    onChange={(e) => {
                      const q = parseFloat(e.target.value) || 0;
                      const p = newTrade.price || 0;
                      const mult = newTrade.assetType === 'OPTION' ? 100 : 1;
                      setNewTrade({ ...newTrade, quantity: q, totalValue: q * p * mult });
                    }}
                    className="h-8 text-xs bg-card font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Fill Price ($)</label>
                  <Input
                    type="number"
                    step="any"
                    value={newTrade.price}
                    onChange={(e) => {
                      const p = parseFloat(e.target.value) || 0;
                      const q = newTrade.quantity || 0;
                      const mult = newTrade.assetType === 'OPTION' ? 100 : 1;
                      setNewTrade({ ...newTrade, price: p, totalValue: q * p * mult });
                    }}
                    className="h-8 text-xs bg-card font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Total Value ($)</label>
                  <Input
                    type="number"
                    step="any"
                    value={newTrade.totalValue}
                    onChange={(e) => setNewTrade({ ...newTrade, totalValue: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-xs bg-card font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Description / Trade Notes</label>
                <Input
                  value={newTrade.description || ''}
                  onChange={(e) => setNewTrade({ ...newTrade, description: e.target.value })}
                  placeholder="e.g. Scalp entry on 50 EMA bounce"
                  className="h-8 text-xs bg-card"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsLogModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending} className="bg-primary text-white">
                  {createMutation.isPending ? 'Logging...' : 'Save Trade Record'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Options Strategy & Trade Finding Agent Modal */}
      <OptionsTradeAgentModal
        isOpen={isOptionsAgentModalOpen}
        onClose={() => setIsOptionsAgentModalOpen(false)}
        onSelectTradeToLog={handleSelectTradeToLog}
        onNavigateToResearch={onNavigateToResearch}
      />

      {/* Buying Power & Margin Risk Analyser Modal */}
      <BuyingPowerAnalyserModal
        isOpen={isBuyingPowerModalOpen}
        onClose={() => setIsBuyingPowerModalOpen(false)}
      />
    </div>
  );
}
