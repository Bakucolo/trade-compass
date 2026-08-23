import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedPosition } from './types';
import { PortfolioBalancesData } from '@/services/portfolioBalanceService';
import {
  PortfolioValuationAuditResult,
  HoldingValuationRecord,
  useRunPortfolioValuation,
  usePortfolioValuationAudits,
  useDeletePortfolioValuation
} from '@/services/portfolioValuationService';
import {
  Sparkles,
  Scale,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  ArrowRight,
  Maximize2,
  Minimize2,
  Trash2,
  FileText,
  Clock,
  Layers,
  Zap,
  BarChart3,
  History,
  CheckCircle2,
  Coins,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PortfolioValuationModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions?: UnifiedPosition[];
  balancesData?: PortfolioBalancesData;
  isPrivacyMode?: boolean;
  onNavigateToResearch?: (symbol: string) => void;
}

export function PortfolioValuationModal({
  isOpen,
  onClose,
  positions = [],
  balancesData,
  isPrivacyMode = false,
  onNavigateToResearch,
}: PortfolioValuationModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeReport, setActiveReport] = useState<PortfolioValuationAuditResult | null>(null);
  const [activeTab, setActiveTab] = useState('holdings');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNDERVALUED' | 'FAIR' | 'OVERVALUED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'DISCOUNT' | 'SCORE' | 'MARKET_VALUE' | 'TICKER'>('DISCOUNT');

  const runMutation = useRunPortfolioValuation();
  const { data: auditHistory = [], refetch: refetchHistory, isLoading: isLoadingHistory } = usePortfolioValuationAudits(20);
  const deleteMutation = useDeletePortfolioValuation();

  // On open, load latest audit or auto-run if none exist
  useEffect(() => {
    if (isOpen) {
      if (!activeReport) {
        if (auditHistory.length > 0 && !runMutation.isPending) {
          setActiveReport(auditHistory[0]);
        } else if (!runMutation.isPending) {
          handleRunValuation();
        }
      }
    }
  }, [isOpen]);

  const handleRunValuation = async () => {
    try {
      toast.info('Autonomous Valuation Agent initiated across all holdings...', { duration: 3000 });
      const res = await runMutation.mutateAsync({
        positions,
        balancesData
      });
      setActiveReport(res.audit);
      toast.success('Portfolio Valuation Audit completed & saved to database!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to complete valuation audit');
    }
  };

  const handleDeleteAudit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Valuation report deleted');
      if (activeReport?.id === id) {
        const remaining = auditHistory.filter(a => a.id !== id);
        setActiveReport(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete audit report');
    }
  };

  const formatCurr = (val?: number, decimals = 2) => {
    if (val === undefined || isNaN(val)) return '$0.00';
    if (isPrivacyMode) return '****';
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  const getStatusBadge = (status: HoldingValuationRecord['valuationStatus'], marginOfSafety: number) => {
    switch (status) {
      case 'DEEPLY_UNDERVALUED':
        return (
          <Badge className="bg-emerald-500/25 text-emerald-300 border-emerald-500/40 text-xs font-bold gap-1 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Deep Value (+{marginOfSafety.toFixed(1)}% Discount)</span>
          </Badge>
        );
      case 'UNDERVALUED':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs font-semibold gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Undervalued (+{marginOfSafety.toFixed(1)}% MoS)</span>
          </Badge>
        );
      case 'OVERVALUED':
        return (
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-semibold gap-1">
            <TrendingDown className="w-3 h-3" />
            <span>Overvalued ({marginOfSafety.toFixed(1)}% Premium)</span>
          </Badge>
        );
      case 'EXTREMELY_OVERVALUED':
        return (
          <Badge className="bg-rose-500/25 text-rose-300 border-rose-500/40 text-xs font-bold gap-1 shadow-[0_0_12px_rgba(244,63,94,0.2)]">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Extreme Premium ({marginOfSafety.toFixed(1)}%)</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground border-border/60 text-xs gap-1">
            <CheckCircle2 className="w-3 h-3 text-cyan-400" />
            <span>Fairly Valued (Near Fair Value)</span>
          </Badge>
        );
    }
  };

  const getActionBadge = (verdict: HoldingValuationRecord['actionVerdict']) => {
    switch (verdict) {
      case 'STRONG_BUY_ACCUMULATE':
        return <Badge className="bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider">Strong Buy / DCA</Badge>;
      case 'ACCUMULATE_DCA':
        return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">Accumulate</Badge>;
      case 'TRIM_TAKE_PROFITS':
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-bold">Trim / Harvest</Badge>;
      case 'HEDGE_OVERVALUED_POSITION':
        return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] font-bold">Hedge Risk</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] text-muted-foreground">Hold / Sell Calls</Badge>;
    }
  };

  const handleSelectTicker = (symbol: string) => {
    const cleanSym = symbol.includes(' ') ? symbol.split(' ')[0] : symbol;
    if (onNavigateToResearch) {
      onNavigateToResearch(cleanSym);
      onClose();
    } else {
      window.dispatchEvent(new CustomEvent('select-research-ticker', { detail: cleanSym }));
      onClose();
    }
  };

  // Filter and sort holdings
  const filteredHoldings = useMemo(() => {
    if (!activeReport?.holdings) return [];
    return activeReport.holdings
      .filter((h) => {
        if (statusFilter === 'UNDERVALUED') {
          if (h.valuationStatus !== 'DEEPLY_UNDERVALUED' && h.valuationStatus !== 'UNDERVALUED') return false;
        } else if (statusFilter === 'FAIR') {
          if (h.valuationStatus !== 'FAIRLY_VALUED') return false;
        } else if (statusFilter === 'OVERVALUED') {
          if (h.valuationStatus !== 'OVERVALUED' && h.valuationStatus !== 'EXTREMELY_OVERVALUED') return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          return (
            h.symbol.toLowerCase().includes(q) ||
            h.companyName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'DISCOUNT') {
          return b.marginOfSafetyPercent - a.marginOfSafetyPercent;
        }
        if (sortBy === 'SCORE') {
          return b.valuationScore - a.valuationScore;
        }
        if (sortBy === 'MARKET_VALUE') {
          return b.totalMarketValueUSD - a.totalMarketValueUSD;
        }
        if (sortBy === 'TICKER') {
          return a.symbol.localeCompare(b.symbol);
        }
        return 0;
      });
  }, [activeReport, statusFilter, searchQuery, sortBy]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(
        "flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-2xl transition-all duration-150",
        isFullScreen
          ? "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !border-0 !m-0"
          : "w-[95vw] sm:max-w-6xl h-[92vh] max-h-[92vh] border border-primary/30 shadow-2xl rounded-2xl"
      )}>
        {/* ================= HEADER ================= */}
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-slate-950/40 relative shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs uppercase tracking-wider px-2.5 py-0.5 shadow-sm">
                  Autonomous Valuation Engine
                </Badge>
                <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                  {(positions || []).length} Holdings Evaluated
                </Badge>
                {activeReport?.createdAt && (
                  <Badge variant="secondary" className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {new Date(activeReport.createdAt).toLocaleDateString()} {new Date(activeReport.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Badge>
                )}
              </div>

              <DialogTitle className="text-2xl font-black tracking-tight text-foreground pt-1 flex items-center gap-2.5">
                <Scale className="w-6 h-6 text-emerald-400" />
                AI Portfolio Valuation & Intrinsic Health Audit
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Institutional DCF modeling, multiple re-rating analysis, Wall St. consensus triangulation, and margin-of-safety diagnosis.
              </DialogDescription>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunValuation}
                disabled={runMutation.isPending}
                className="h-8 gap-1.5 text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", runMutation.isPending && "animate-spin text-emerald-400")} />
                <span>{runMutation.isPending ? 'Auditing Valuations...' : 'Re-Run Valuation Audit'}</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ================= BODY ================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {runMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="p-4 bg-emerald-500/10 rounded-3xl border border-emerald-500/30 shadow-2xl animate-pulse">
                <Scale className="w-12 h-12 text-emerald-400 animate-spin" />
              </div>
              <div className="text-center space-y-1 max-w-md">
                <h4 className="text-lg font-bold text-foreground">Valuation Agent Auditing Intrinsic Prices...</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Extracting cash flows, computing discounted cash flows (DCF), analyzing forward P/E compression, and determining institutional margin of safety.
                </p>
              </div>
            </div>
          ) : activeReport ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-5">
              {/* ================= 1. EXECUTIVE KPI SUMMARY RIBBON ================= */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Overall Portfolio Margin of Safety */}
                <div className={cn(
                  "rounded-2xl p-5 border flex flex-col justify-between shadow-md",
                  activeReport.portfolioDiscountPercent >= 0
                    ? "bg-gradient-to-br from-emerald-950/30 via-card/80 to-card/40 border-emerald-500/40"
                    : "bg-gradient-to-br from-amber-950/30 via-card/80 to-card/40 border-amber-500/40"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-foreground flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-emerald-400" /> Overall Valuation
                    </span>
                    <Badge className={cn(
                      "text-[10px] font-mono font-bold uppercase",
                      activeReport.portfolioDiscountPercent >= 0
                        ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-500/25 text-amber-300 border-amber-500/40"
                    )}>
                      {activeReport.overallValuationStatus.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline gap-2">
                      <span className={cn(
                        "text-3xl font-black font-mono",
                        activeReport.portfolioDiscountPercent >= 0 ? "text-emerald-300" : "text-amber-300"
                      )}>
                        {activeReport.portfolioDiscountPercent >= 0 ? '+' : ''}{activeReport.portfolioDiscountPercent}%
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        {activeReport.portfolioDiscountPercent >= 0 ? 'Margin of Safety' : 'Valuation Premium'}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {activeReport.portfolioDiscountPercent >= 0
                        ? 'Trading at a composite discount to intrinsic fair value'
                        : 'Trading at a premium relative to modeled cash flows'}
                    </p>
                  </div>
                </div>

                {/* Fair Value vs Market Value */}
                <div className="glass-card rounded-2xl p-5 border border-primary/30 bg-primary/5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-primary" /> Intrinsic Fair Value
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono font-bold text-muted-foreground">
                      Portfolio Model
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black font-mono text-foreground">
                        {formatCurr(activeReport.totalFairValue, 0)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      vs {formatCurr(activeReport.totalMarketValue, 0)} Current Market Value
                    </p>
                  </div>
                </div>

                {/* Holdings Distribution */}
                <div className="glass-card rounded-2xl p-5 border border-border/60 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-cyan-400" /> Holdings Distribution
                    </span>
                    <span className="text-xs font-mono font-bold text-foreground">
                      {activeReport.totalHoldingsCount} Assets
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-emerald-400 font-bold">{activeReport.undervaluedCount} Undervalued</span>
                      <span className="text-cyan-300 font-medium">{activeReport.fairlyValuedCount} Fair</span>
                      <span className="text-amber-400 font-bold">{activeReport.overvaluedCount} Overvalued</span>
                    </div>
                    {/* Segmented Distribution Bar */}
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500 transition-all h-full"
                        style={{ width: `${(activeReport.undervaluedCount / (activeReport.totalHoldingsCount || 1)) * 100}%` }}
                        title={`${activeReport.undervaluedCount} Undervalued`}
                      />
                      <div
                        className="bg-cyan-500 transition-all h-full"
                        style={{ width: `${(activeReport.fairlyValuedCount / (activeReport.totalHoldingsCount || 1)) * 100}%` }}
                        title={`${activeReport.fairlyValuedCount} Fair Value`}
                      />
                      <div
                        className="bg-rose-500 transition-all h-full"
                        style={{ width: `${(activeReport.overvaluedCount / (activeReport.totalHoldingsCount || 1)) * 100}%` }}
                        title={`${activeReport.overvaluedCount} Overvalued`}
                      />
                    </div>
                  </div>
                </div>

                {/* Valuation Health Score */}
                <div className="glass-card rounded-2xl p-5 border border-border/60 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-400" /> Valuation Score
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      0 - 100
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black font-mono text-foreground">
                        {activeReport.portfolioScore}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">/ 100 Resilience</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Higher score reflects stronger margin of safety and multiple buffers
                    </p>
                  </div>
                </div>
              </div>

              {/* Main Navigation Tabs */}
              <TabsList className="bg-muted/40 border border-border/40 p-1 grid grid-cols-3 h-auto gap-1">
                <TabsTrigger value="holdings" className="text-xs py-2 gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Holdings Valuations ({activeReport.holdings.length})
                </TabsTrigger>
                <TabsTrigger value="synthesis" className="text-xs py-2 gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> AI Valuation Synthesis
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs py-2 gap-1.5">
                  <History className="w-3.5 h-3.5" /> Past Audits ({auditHistory.length})
                </TabsTrigger>
              </TabsList>

              {/* ================= TAB 1: HOLDINGS VALUATIONS ================= */}
              <TabsContent value="holdings" className="m-0 space-y-4">
                {/* Filter and Search Ribbon */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter('ALL')}
                      className="h-7 text-xs font-semibold"
                    >
                      All ({activeReport.holdings.length})
                    </Button>
                    <Button
                      variant={statusFilter === 'UNDERVALUED' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter('UNDERVALUED')}
                      className="h-7 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      Undervalued Bargains ({activeReport.undervaluedCount})
                    </Button>
                    <Button
                      variant={statusFilter === 'FAIR' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter('FAIR')}
                      className="h-7 text-xs font-semibold"
                    >
                      Fair Value ({activeReport.fairlyValuedCount})
                    </Button>
                    <Button
                      variant={statusFilter === 'OVERVALUED' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter('OVERVALUED')}
                      className="h-7 text-xs font-semibold text-rose-400 hover:text-rose-300"
                    >
                      Overvalued / Extended ({activeReport.overvaluedCount})
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative sm:w-56">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search holding..."
                        className="w-full h-7 text-xs pl-8 pr-3 bg-card/60 border border-border/70 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 uppercase font-mono"
                      />
                    </div>

                    <select
                      value={sortBy}
                      onChange={(e: any) => setSortBy(e.target.value)}
                      className="h-7 text-xs px-2.5 bg-card/60 border border-border/70 rounded-lg text-foreground font-mono focus:outline-none"
                    >
                      <option value="DISCOUNT">Sort: Highest Margin of Safety</option>
                      <option value="SCORE">Sort: Valuation Score</option>
                      <option value="MARKET_VALUE">Sort: Position Value</option>
                      <option value="TICKER">Sort: Ticker (A-Z)</option>
                    </select>
                  </div>
                </div>

                {/* Holdings Grid */}
                <div className="space-y-3">
                  {filteredHoldings.map((h) => (
                    <Card
                      key={h.symbol}
                      className={cn(
                        "transition-all duration-200 border shadow-md hover:border-primary/50",
                        h.valuationStatus === 'DEEPLY_UNDERVALUED'
                          ? "bg-emerald-950/10 border-emerald-500/30"
                          : h.valuationStatus === 'EXTREMELY_OVERVALUED'
                          ? "bg-rose-950/10 border-rose-500/30"
                          : "bg-card/40 border-border/60"
                      )}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          {/* Left: Ticker, Name, Status */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-primary/20 text-primary border-primary/30 font-mono font-bold text-sm px-2.5 py-0.5">
                                {h.symbol}
                              </Badge>
                              <span className="text-sm font-bold text-foreground">
                                {h.companyName}
                              </span>
                              {getStatusBadge(h.valuationStatus, h.marginOfSafetyPercent)}
                              {getActionBadge(h.actionVerdict)}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono flex-wrap">
                              <span>{h.totalShares} Shares</span>
                              <span>•</span>
                              <span>Value: {formatCurr(h.totalMarketValueUSD)} ({h.portfolioWeightPercent}% of port)</span>
                              <span>•</span>
                              <span>Brokers: {h.brokerSources.join(', ')}</span>
                            </div>
                          </div>

                          {/* Right: Pricing & Margin of Safety Targets */}
                          <div className="flex items-center gap-4 bg-background/60 border border-border/50 rounded-xl p-2.5 px-4 font-mono shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] text-muted-foreground uppercase block">Current Price</span>
                              <span className="text-sm font-bold text-foreground">${h.currentPrice.toFixed(2)}</span>
                            </div>

                            <ArrowRight className="w-4 h-4 text-muted-foreground" />

                            <div className="text-left">
                              <span className="text-[10px] text-muted-foreground uppercase block">Blended Fair Value</span>
                              <span className="text-sm font-bold text-emerald-400">${h.blendedFairValue.toFixed(2)}</span>
                            </div>

                            <div className="border-l border-border/50 pl-3 text-right">
                              <span className="text-[10px] text-muted-foreground uppercase block">Margin of Safety</span>
                              <span className={cn(
                                "text-sm font-bold",
                                h.marginOfSafetyPercent >= 0 ? "text-emerald-400" : "text-rose-400"
                              )}>
                                {h.marginOfSafetyPercent >= 0 ? '+' : ''}{h.marginOfSafetyPercent}%
                              </span>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectTicker(h.symbol)}
                              className="h-8 px-2.5 text-xs text-primary hover:bg-primary/20 gap-1 ml-2"
                              title="Open in Research Suite"
                            >
                              <span>Research</span>
                              <ArrowRight className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {/* AI Diagnosis and Valuation Multiples */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border/40 text-xs">
                          {/* AI Thesis */}
                          <div className="md:col-span-2 space-y-1">
                            <p className="text-foreground/90 leading-relaxed font-sans">
                              {h.aiDiagnosisSummary}
                            </p>
                            <p className="text-[11px] text-muted-foreground italic font-sans">
                              <strong>Recommended Action:</strong> {h.actionRationale}
                            </p>
                          </div>

                          {/* Multiples Mini Grid */}
                          <div className="grid grid-cols-2 gap-1.5 bg-card/60 p-2 rounded-lg border border-border/40 font-mono text-[11px]">
                            <div>
                              <span className="text-muted-foreground text-[10px]">Fwd P/E: </span>
                              <strong>{h.forwardPE ? `${h.forwardPE}x` : 'N/A'}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-[10px]">PEG: </span>
                              <strong>{h.pegRatio ? h.pegRatio : 'N/A'}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-[10px]">DCF Fair: </span>
                              <strong className="text-emerald-400">${h.dcfFairValue}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-[10px]">EV/EBITDA: </span>
                              <strong>{h.evToEbitda ? `${h.evToEbitda}x` : 'N/A'}</strong>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* ================= TAB 2: EXECUTIVE SYNTHESIS ================= */}
              <TabsContent value="synthesis" className="m-0 space-y-4">
                <Card className="bg-card/40 border-border/60 shadow-sm">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-foreground">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Executive Valuation Audit Synthesis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3 text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
                    {activeReport.executiveSummary}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Top Opportunities */}
                  <Card className="bg-gradient-to-br from-card/80 to-emerald-950/20 border-emerald-500/30 p-4 space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> High-Conviction Undervalued Opportunities
                    </h5>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {activeReport.keyOpportunitiesSummary}
                    </p>
                  </Card>

                  {/* Valuation Risks */}
                  <Card className="bg-gradient-to-br from-card/80 to-rose-950/20 border-rose-500/30 p-4 space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Extended Valuation Risks & Trims
                    </h5>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {activeReport.valuationRisksSummary}
                    </p>
                  </Card>
                </div>
              </TabsContent>

              {/* ================= TAB 3: AUDIT HISTORY ================= */}
              <TabsContent value="history" className="m-0 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-border/50">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Historical Portfolio Valuation Audits ({auditHistory.length})
                  </span>
                  <span className="text-xs text-muted-foreground">Stored in Local SQLite Database</span>
                </div>

                {auditHistory.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No historical valuation reports saved yet. Click "Re-Run Valuation Audit" above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditHistory.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setActiveReport(item)}
                        className={cn(
                          "p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all cursor-pointer",
                          activeReport?.id === item.id
                            ? "bg-primary/10 border-primary/50 shadow-sm ring-1 ring-primary/40"
                            : "bg-card/50 border-border/40 hover:bg-accent/40"
                        )}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">
                              {item.title}
                            </span>
                            <Badge className="text-[10px] font-mono font-bold">
                              {item.portfolioDiscountPercent >= 0 ? `+${item.portfolioDiscountPercent}% Discount` : `${item.portfolioDiscountPercent}% Premium`}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'} • {item.totalHoldingsCount} Holdings Audited • Score: {item.portfolioScore}/100
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => item.id && handleDeleteAudit(item.id, e)}
                            className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                            title="Delete this audit record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="py-20 text-center space-y-3">
              <Scale className="w-12 h-12 text-muted-foreground/40 mx-auto" />
              <h4 className="text-base font-bold text-foreground">No Valuation Audit Generated Yet</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Trigger the AI valuation agent to scan all current equity and option positions against fundamental DCF and earnings models.
              </p>
              <Button onClick={handleRunValuation} className="gap-2">
                <Sparkles className="w-4 h-4" /> Run Autonomous Valuation Agent
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
