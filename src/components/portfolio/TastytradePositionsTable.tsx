import React, { useState, useMemo } from 'react';
import { UnifiedPosition } from './types';
import {
  TastyUnderlyingGroup,
  TastyLeg,
  groupPositionsForTastytrade,
} from '@/utils/tastytradePositionsUtils';
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  ChevronUp,
  FileText,
  Sparkles,
  ShieldAlert,
  Calendar,
  Zap,
  Info,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEarningsData } from '@/services/earningsService';
import { useCoveredCallsAnalysis } from '@/services/coveredCallService';

interface TastytradePositionsTableProps {
  positions: UnifiedPosition[];
  isLoading?: boolean;
  isPrivacyMode?: boolean;
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol?: string) => void;
  onOpenNoteModal?: (symbol: string, name?: string, price?: number) => void;
  onOpenAdvisorModal?: (position: UnifiedPosition) => void;
  onOpenDefenseModal?: () => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  activeFilter?: 'ALL' | 'OPTIONS' | 'EQUITIES';
  onFilterChange?: (filter: 'ALL' | 'OPTIONS' | 'EQUITIES') => void;
}

type TastySortKey =
  | 'symbol'
  | 'lastPrice'
  | 'delta'
  | 'theta'
  | 'vega'
  | 'plDay'
  | 'plOpen'
  | 'pop'
  | 'ext'
  | 'cost'
  | 'netLiq'
  | 'touchPercent'
  | 'capReq'
  | 'earnsAt'
  | 'ivr'
  | 'dte';

type SortDirection = 'asc' | 'desc';

export function TastytradePositionsTable({
  positions,
  isLoading = false,
  isPrivacyMode = false,
  onNavigateToResearch,
  onNavigateToGraphs,
  onOpenNoteModal,
  onOpenAdvisorModal,
  onOpenDefenseModal,
  isFullScreen = false,
  onToggleFullScreen,
  activeFilter = 'ALL',
  onFilterChange,
}: TastytradePositionsTableProps) {
  // Expansion state: map of symbol -> boolean (true = expanded)
  const [expandedSymbols, setExpandedSymbols] = useState<Record<string, boolean>>({});

  // Sorting state
  const [sortKey, setSortKey] = useState<TastySortKey>('netLiq');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  // Load live earnings calendar to populate "Earns At"
  const { data: earningsData } = useEarningsData();
  const earningsMap = useMemo(() => {
    const map = new Map<string, string>();
    if (earningsData?.items) {
      for (const item of earningsData.items) {
        if (item.symbol && item.earningsDate) {
          map.set(item.symbol.toUpperCase(), item.earningsDate);
        }
      }
    }
    return map;
  }, [earningsData]);

  // Load IV Rank from covered calls / volatility telemetry
  const { data: coveredCallsData } = useCoveredCallsAnalysis();
  const ivrMap = useMemo(() => {
    const map = new Map<string, number>();
    if (coveredCallsData?.candidates) {
      for (const c of coveredCallsData.candidates) {
        if (c.symbol && c.ivRank !== undefined) {
          map.set(c.symbol.toUpperCase(), c.ivRank);
        }
      }
    }
    return map;
  }, [coveredCallsData]);

  // Group positions by underlying symbol
  const underlyingGroups = useMemo(() => {
    return groupPositionsForTastytrade(positions, { earningsMap, ivrMap });
  }, [positions, earningsMap, ivrMap]);

  // Max absolute day P/L for scaling the center-zero balance bar
  const maxAbsPlDay = useMemo(() => {
    let max = 100;
    for (const g of underlyingGroups) {
      if (Math.abs(g.plDay) > max) max = Math.abs(g.plDay);
      for (const l of g.legs) {
        if (Math.abs(l.plDay) > max) max = Math.abs(l.plDay);
      }
    }
    return Math.max(100, max);
  }, [underlyingGroups]);

  // Handle master expand/collapse all
  const allExpanded = useMemo(() => {
    if (underlyingGroups.length === 0) return false;
    return underlyingGroups.every(g => expandedSymbols[g.symbol]);
  }, [underlyingGroups, expandedSymbols]);

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedSymbols({});
    } else {
      const next: Record<string, boolean> = {};
      for (const g of underlyingGroups) {
        next[g.symbol] = true;
      }
      setExpandedSymbols(next);
    }
  };

  const toggleRow = (symbol: string) => {
    setExpandedSymbols(prev => ({
      ...prev,
      [symbol]: !prev[symbol],
    }));
  };

  // Sort handler
  const handleSort = (key: TastySortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // Sorted underlying groups
  const sortedGroups = useMemo(() => {
    return [...underlyingGroups].sort((a, b) => {
      let aVal: any = a[sortKey];
      let bVal: any = b[sortKey];

      if (aVal === null || aVal === undefined) aVal = sortDir === 'asc' ? Infinity : -Infinity;
      if (bVal === null || bVal === undefined) bVal = sortDir === 'asc' ? Infinity : -Infinity;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortDir === 'asc' ? cmp : -cmp;
      }

      const diff = Number(aVal) - Number(bVal);
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [underlyingGroups, sortKey, sortDir]);

  // Aggregate totals for the summary footer
  const totals = useMemo(() => {
    return underlyingGroups.reduce(
      (acc, g) => ({
        delta: acc.delta + g.delta,
        theta: acc.theta + g.theta,
        vega: acc.vega + g.vega,
        plDay: acc.plDay + g.plDay,
        plOpen: acc.plOpen + g.plOpen,
        ext: acc.ext + g.ext,
        cost: acc.cost + g.cost,
        netLiq: acc.netLiq + g.netLiq,
        capReq: acc.capReq + g.capReq,
      }),
      { delta: 0, theta: 0, vega: 0, plDay: 0, plOpen: 0, ext: 0, cost: 0, netLiq: 0, capReq: 0 }
    );
  }, [underlyingGroups]);

  // Number formatters
  const formatMoney = (val: number, showSign = false, hideFractions = false): string => {
    if (isPrivacyMode) return '***';
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : showSign && val > 0 ? '+' : '';
    const formatted = abs.toLocaleString(undefined, {
      minimumFractionDigits: hideFractions ? 0 : 2,
      maximumFractionDigits: hideFractions ? 0 : 2,
    });
    return `${sign}${formatted}`;
  };

  const formatNumber = (val: number, decimals = 2, showSign = false): string => {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : showSign && val > 0 ? '+' : '';
    return `${sign}${abs.toFixed(decimals)}`;
  };

  const SortIcon = ({ columnKey }: { columnKey: TastySortKey }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="w-2.5 h-2.5 ml-1 opacity-25 group-hover:opacity-60 inline" />;
    }
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 ml-1 text-cyan-400 inline" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 text-cyan-400 inline" />
    );
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f1218] overflow-hidden shadow-2xl transition-all">
      {/* Table Sub-header with Quick View Indicator & Expand All */}
      <div className="px-4 py-2.5 bg-[#141923] border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold tracking-wide text-foreground">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-400 font-black">TASTYTRADE POSITIONS ENGINE</span>
            <span className="text-muted-foreground font-normal text-[11px] hidden sm:inline">
              • High-Density Cross-Broker Matrix ({underlyingGroups.length} Underlyings)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Asset Filter Pills (All / Options / Equities) */}
          {onFilterChange && (
            <div className="flex items-center p-0.5 bg-black/40 rounded-lg border border-white/5 gap-0.5">
              <button
                type="button"
                onClick={() => onFilterChange('ALL')}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                  activeFilter === 'ALL'
                    ? "bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onFilterChange('OPTIONS')}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                  activeFilter === 'OPTIONS'
                    ? "bg-purple-500/25 text-purple-300 border border-purple-500/40 shadow-sm"
                    : "text-muted-foreground hover:text-purple-300"
                )}
              >
                Options
              </button>
              <button
                type="button"
                onClick={() => onFilterChange('EQUITIES')}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                  activeFilter === 'EQUITIES'
                    ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-muted-foreground hover:text-emerald-300"
                )}
              >
                Equities
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleExpandAll}
            className="h-7 px-2.5 text-[11px] font-mono font-bold text-slate-300 hover:text-white hover:bg-white/10 rounded-lg gap-1 border border-white/5"
            title="Expand or collapse all underlying positions"
          >
            {allExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>{allExpanded ? 'Collapse All Legs' : 'Expand All Legs'}</span>
          </Button>

          {onToggleFullScreen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFullScreen}
              className={cn(
                "h-7 px-2.5 text-[11px] font-mono font-bold rounded-lg gap-1 border transition-all",
                isFullScreen
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30"
                  : "text-slate-300 hover:text-white hover:bg-white/10 border-white/5"
              )}
              title={isFullScreen ? "Exit Full Window (Esc)" : "Expand to Full Window"}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Exit Full Window</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Full Window</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Main Dense Table */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
        <table className="w-full text-xs font-mono border-collapse select-text">
          {/* Tastytrade Column Headers */}
          <thead>
            <tr className="bg-[#12161f] border-b border-white/10 text-muted-foreground text-[11px] uppercase tracking-wider font-semibold select-none">
              {/* Symbol & Caret */}
              <th
                onClick={() => handleSort('symbol')}
                className="py-2.5 px-3 text-left font-bold cursor-pointer hover:text-white transition-colors group w-[170px]"
              >
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpandAll();
                    }}
                    className="p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white"
                  >
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", !allExpanded && "-rotate-90")} />
                  </button>
                  <span>Symbol</span>
                  <SortIcon columnKey="symbol" />
                </div>
              </th>

              {/* Last & Day Change (Tasty Dual Pill) */}
              <th
                onClick={() => handleSort('lastPrice')}
                className="py-2.5 px-2 text-center font-bold cursor-pointer hover:text-white transition-colors group min-w-[125px]"
              >
                <div className="flex items-center justify-center">
                  <span>Last</span>
                  <SortIcon columnKey="lastPrice" />
                </div>
              </th>

              {/* ETF Δ (Delta) */}
              <th
                onClick={() => handleSort('delta')}
                className="py-2.5 px-2 text-right font-bold cursor-pointer hover:text-white transition-colors group min-w-[85px]"
                title="Beta-weighted / aggregate position Delta (Δ)"
              >
                <div className="flex items-center justify-end">
                  <span>ETF &Delta;</span>
                  <SortIcon columnKey="delta" />
                </div>
              </th>

              {/* θ (Theta) */}
              <th
                onClick={() => handleSort('theta')}
                className="py-2.5 px-2 text-right font-bold cursor-pointer hover:text-white transition-colors group min-w-[75px]"
                title="Aggregate daily dollar Theta decay (&Theta;)"
              >
                <div className="flex items-center justify-end">
                  <span>&theta;</span>
                  <SortIcon columnKey="theta" />
                </div>
              </th>

              {/* v (Vega) */}
              <th
                onClick={() => handleSort('vega')}
                className="py-2.5 px-2 text-right font-bold cursor-pointer hover:text-white transition-colors group min-w-[75px]"
                title="Aggregate Vega (v): Sensitivity to 1% IV shift"
              >
                <div className="flex items-center justify-end">
                  <span>v</span>
                  <SortIcon columnKey="vega" />
                </div>
              </th>

              {/* P/L Day with Center-Zero Bar */}
              <th
                onClick={() => handleSort('plDay')}
                className="py-2.5 px-2 text-right font-bold cursor-pointer hover:text-white transition-colors group min-w-[110px]"
                title="Today's Dollar Profit / Loss with directional balance bar"
              >
                <div className="flex items-center justify-end">
                  <span>P/L Day</span>
                  <SortIcon columnKey="plDay" />
                </div>
              </th>

              {/* P/L Open */}
              <th
                onClick={() => handleSort('plOpen')}
                className="py-2.5 px-2 text-right font-bold cursor-pointer hover:text-white transition-colors group min-w-[100px]"
                title="Unrealized Total Return / Open P&L"
              >
                <div className="flex items-center justify-end">
                  <span>P/L Open</span>
                  <SortIcon columnKey="plOpen" />
                </div>
              </th>

              {/* PoP (Probability of Profit) */}
              <th
                onClick={() => handleSort('pop')}
                className="py-2.5 px-2 text-right font-bold cursor-pointer hover:text-white transition-colors group min-w-[60px]"
                title="Probability of Profit at Expiration"
              >
                <div className="flex items-center justify-end">
                  <span>PoP</span>
                  <SortIcon columnKey="pop" />
                </div>
              </th>

              {/* Ext (Extrinsic Value) */}
              <th
                onClick={() => handleSort('ext')}
                className="py-2.5 px-2 text-right font-bold cursor-pointer hover:text-white transition-colors group min-w-[85px]"
                title="Total remaining extrinsic / time value premium"
              >
                <div className="flex items-center justify-end">
                  <span>Ext</span>
                  <SortIcon columnKey="ext" />
                </div>
              </th>

              {/* Cst (Cost Basis) */}
              <th
                onClick={() => handleSort('cost')}
                className="py-2.5 px-2 text-right font-bold cursor-pointer hover:text-white transition-colors group min-w-[85px]"
                title="Position cost basis / entry cost"
              >
                <div className="flex items-center justify-end">
                  <span>Cst</span>
                  <SortIcon columnKey="cost" />
                </div>
              </th>

              {/* NetLiq (Net Liquidating Value) */}
              <th
                onClick={() => handleSort('netLiq')}
                className="py-2.5 px-2 text-right font-bold cursor-pointer hover:text-white transition-colors group min-w-[95px]"
                title="Net Liquidating Value / Current Market Value"
              >
                <div className="flex items-center justify-end">
                  <span>NetLiq</span>
                  <SortIcon columnKey="netLiq" />
                </div>
              </th>

              {/* Touch % */}
              <th
                onClick={() => handleSort('touchPercent')}
                className="py-2.5 px-2 text-right font-bold cursor-pointer hover:text-white transition-colors group min-w-[65px]"
                title="Probability of Touch"
              >
                <div className="flex items-center justify-end">
                  <span>Touch %</span>
                  <SortIcon columnKey="touchPercent" />
                </div>
              </th>

              {/* CapReq (Capital Requirement / Margin) */}
              <th
                onClick={() => handleSort('capReq')}
                className="py-2.5 px-2 text-right font-bold cursor-pointer hover:text-white transition-colors group min-w-[90px]"
                title="Capital Requirement / Buying Power Reduction"
              >
                <div className="flex items-center justify-end">
                  <span>CapReq</span>
                  <SortIcon columnKey="capReq" />
                </div>
              </th>

              {/* Earns At */}
              <th
                onClick={() => handleSort('earnsAt')}
                className="py-2.5 px-2 text-center font-bold cursor-pointer hover:text-white transition-colors group min-w-[70px]"
                title="Upcoming Quarterly Earnings Announcement Date"
              >
                <div className="flex items-center justify-center">
                  <span>Earns At</span>
                  <SortIcon columnKey="earnsAt" />
                </div>
              </th>

              {/* IVR (IV Rank) */}
              <th
                onClick={() => handleSort('ivr')}
                className="py-2.5 px-2 text-right font-bold cursor-pointer hover:text-white transition-colors group min-w-[60px]"
                title="Implied Volatility Rank (0-100)"
              >
                <div className="flex items-center justify-end">
                  <span>IVR</span>
                  <SortIcon columnKey="ivr" />
                </div>
              </th>

              {/* DTE (Days to Expiration) */}
              <th
                onClick={() => handleSort('dte')}
                className="py-2.5 px-3 text-right font-bold cursor-pointer hover:text-white transition-colors group min-w-[60px]"
                title="Days to Expiration of nearest contract"
              >
                <div className="flex items-center justify-end">
                  <span>DTE</span>
                  <SortIcon columnKey="dte" />
                </div>
              </th>

              {/* Quick Actions */}
              <th className="py-2.5 px-2 text-center w-[50px]"></th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-white/[0.04]">
            {sortedGroups.length === 0 ? (
              <tr>
                <td colSpan={17} className="py-12 text-center text-muted-foreground font-sans">
                  {isLoading ? 'Loading positions...' : 'No positions found matching current filters.'}
                </td>
              </tr>
            ) : (
              sortedGroups.map((group) => {
                const isExpanded = Boolean(expandedSymbols[group.symbol]);
                const isDayPositive = group.dayChange >= 0;
                const isDayPlPositive = group.plDay >= 0;
                const isOpenPlPositive = group.plOpen >= 0;

                // Center-zero bar percentage for Day P/L (clamped to 50% max width each side)
                const barRatio = Math.min(1, Math.abs(group.plDay) / maxAbsPlDay);
                const barWidthPercent = Math.max(2, Math.round(barRatio * 45)); // Max 45% width from center

                return (
                  <React.Fragment key={group.symbol}>
                    {/* Underlying Parent Row */}
                    <tr
                      onClick={() => toggleRow(group.symbol)}
                      className={cn(
                        "group/row transition-colors cursor-pointer select-none",
                        isExpanded ? "bg-[#131924]/90" : "bg-[#0b0f16]/80 hover:bg-[#121824]"
                      )}
                    >
                      {/* Symbol & Expander Caret */}
                      <td className="py-2 px-3 text-left whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(group.symbol);
                            }}
                            aria-label={`Toggle ${group.symbol} legs`}
                            className="p-0.5 rounded text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <ChevronDown
                              className={cn(
                                "w-3.5 h-3.5 transition-transform duration-200",
                                !isExpanded && "-rotate-90"
                              )}
                            />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToResearch?.(group.symbol);
                            }}
                            className="font-bold text-[13px] text-white hover:text-cyan-400 hover:underline transition-colors tracking-tight text-left"
                            title={`Click to research ${group.symbol}`}
                          >
                            {group.symbol}
                          </button>

                          {/* Signature Tastytrade ITM Tag */}
                          {group.isITM && (
                            <span className="text-[9.5px] font-mono font-bold text-amber-300 border border-amber-400/80 bg-amber-400/10 px-1 py-0.2 rounded tracking-wider shadow-sm">
                              ITM
                            </span>
                          )}

                          {group.legs.length > 1 && (
                            <span className="text-[10px] text-muted-foreground font-mono opacity-60">
                              ({group.legs.length})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Last & Day Change (Tastytrade Dual-Pill Widget) */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <div className="inline-flex items-center rounded overflow-hidden shadow-sm font-mono text-[11px] font-bold border border-black/40">
                          {/* Left Sub-Pill: Day Change */}
                          <div
                            className={cn(
                              "px-1.5 py-0.5 flex items-center gap-0.5 text-[10.5px]",
                              isDayPositive
                                ? "bg-emerald-950/90 text-emerald-400 border-r border-emerald-900/60"
                                : "bg-rose-950/90 text-rose-400 border-r border-rose-900/60"
                            )}
                          >
                            <span className="text-[9px]">
                              {isDayPositive ? '▲' : '▼'}
                            </span>
                            <span>{formatNumber(group.dayChange, 2, false)}</span>
                          </div>

                          {/* Right Sub-Pill: Last Spot Price */}
                          <div
                            className={cn(
                              "px-2 py-0.5 text-white tracking-tight",
                              isDayPositive ? "bg-emerald-600" : "bg-rose-600"
                            )}
                          >
                            {formatNumber(group.lastPrice, 2, false)}
                          </div>
                        </div>
                      </td>

                      {/* ETF Δ (Delta) */}
                      <td className="py-2 px-2 text-right whitespace-nowrap font-mono text-slate-200">
                        <span>{formatNumber(group.delta, 2, false)}</span>
                        <span className="text-muted-foreground ml-0.5 text-[10px]">Δ</span>
                      </td>

                      {/* θ (Theta) */}
                      <td className="py-2 px-2 text-right whitespace-nowrap font-mono text-slate-200">
                        <span className={group.theta > 0 ? "text-emerald-400" : group.theta < 0 ? "text-slate-300" : "text-muted-foreground"}>
                          {formatNumber(group.theta, 3, false)}
                        </span>
                        <span className="text-purple-400 ml-0.5 text-[10px]">θ</span>
                      </td>

                      {/* v (Vega) */}
                      <td className="py-2 px-2 text-right whitespace-nowrap font-mono text-slate-200">
                        <span>{formatNumber(group.vega, 2, false)}</span>
                        <span className="text-blue-400 ml-0.5 text-[10px]">v</span>
                      </td>

                      {/* P/L Day with Center-Zero Bar */}
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span
                            className={cn(
                              "font-bold text-[12px]",
                              isDayPlPositive ? "text-emerald-400" : "text-rose-400"
                            )}
                          >
                            {formatMoney(group.plDay, true)}
                          </span>

                          {/* Tastytrade Center-Zero Balance Bar */}
                          <div className="w-16 h-1 bg-slate-800/80 rounded relative overflow-hidden mt-0.5">
                            {/* Center tick at 50% */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-600 z-10" />
                            {isDayPlPositive ? (
                              <div
                                className="absolute left-1/2 top-0 bottom-0 bg-emerald-500 rounded-r"
                                style={{ width: `${barWidthPercent}%` }}
                              />
                            ) : (
                              <div
                                className="absolute right-1/2 top-0 bottom-0 bg-rose-500 rounded-l"
                                style={{ width: `${barWidthPercent}%` }}
                              />
                            )}
                          </div>
                        </div>
                      </td>

                      {/* P/L Open */}
                      <td className="py-2 px-2 text-right whitespace-nowrap font-bold">
                        <span className={isOpenPlPositive ? "text-emerald-400" : "text-rose-400"}>
                          {formatMoney(group.plOpen, true)}
                        </span>
                      </td>

                      {/* PoP */}
                      <td className="py-2 px-2 text-right whitespace-nowrap font-bold">
                        <span
                          className={cn(
                            group.pop >= 70
                              ? "text-emerald-400"
                              : group.pop >= 50
                              ? "text-slate-200"
                              : "text-amber-400"
                          )}
                        >
                          {group.pop}%
                        </span>
                      </td>

                      {/* Ext (Extrinsic Value) */}
                      <td className="py-2 px-2 text-right whitespace-nowrap text-slate-300">
                        {group.ext !== 0 ? formatMoney(group.ext) : '—'}
                      </td>

                      {/* Cst (Cost Basis) */}
                      <td className="py-2 px-2 text-right whitespace-nowrap text-slate-300">
                        {formatMoney(group.cost)}
                      </td>

                      {/* NetLiq */}
                      <td className="py-2 px-2 text-right whitespace-nowrap font-bold">
                        <span className={group.netLiq >= 0 ? "text-emerald-300" : "text-rose-400"}>
                          {formatMoney(group.netLiq)}
                        </span>
                      </td>

                      {/* Touch % */}
                      <td className="py-2 px-2 text-right whitespace-nowrap text-muted-foreground">
                        {group.touchPercent !== null ? `${group.touchPercent}%` : '—'}
                      </td>

                      {/* CapReq */}
                      <td className="py-2 px-2 text-right whitespace-nowrap text-slate-200 font-medium">
                        {formatMoney(group.capReq)}
                      </td>

                      {/* Earns At */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        {group.earnsAt ? (
                          <span className="text-amber-300 font-bold bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10.5px]">
                            {group.earnsAt}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>

                      {/* IVR */}
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <span
                          className={cn(
                            "font-bold",
                            group.ivr >= 50
                              ? "text-emerald-400"
                              : group.ivr >= 30
                              ? "text-amber-400"
                              : "text-slate-400"
                          )}
                        >
                          {group.ivr.toFixed(1)}
                        </span>
                      </td>

                      {/* DTE */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {group.dte !== null ? (
                          <span
                            className={cn(
                              "font-bold",
                              group.dte <= 7
                                ? "text-rose-400"
                                : group.dte <= 21
                                ? "text-amber-400"
                                : "text-slate-300"
                            )}
                          >
                            {group.dte}d
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>

                      {/* Row Action Trigger */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenNoteModal?.(group.symbol, group.description, group.lastPrice);
                          }}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-white"
                          title="Notes on ticker"
                        >
                          <FileText className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>

                    {/* Child Rows: Sub-legs when expanded */}
                    {isExpanded &&
                      group.legs.map((leg) => {
                        const isLegDayPlPos = leg.plDay >= 0;
                        const isLegOpenPlPos = leg.plOpen >= 0;
                        const legBarRatio = Math.min(1, Math.abs(leg.plDay) / maxAbsPlDay);
                        const legBarWidthPercent = Math.max(2, Math.round(legBarRatio * 45));

                        return (
                          <tr
                            key={leg.id}
                            className="bg-[#090c12]/90 hover:bg-[#111622] transition-colors border-b border-white/[0.02] text-[11px]"
                          >
                            {/* Leg Name & Contract Specs */}
                            <td className="py-1.5 px-3 pl-8 text-left whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground/50">└─</span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[9.5px] px-1 py-0 h-4 font-mono font-bold",
                                    leg.legType === 'OPTION'
                                      ? leg.quantity < 0
                                        ? "bg-purple-500/15 text-purple-300 border-purple-500/40"
                                        : "bg-blue-500/15 text-blue-300 border-blue-500/40"
                                      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                                  )}
                                >
                                  {leg.legType === 'OPTION' ? (leg.quantity < 0 ? 'SHORT OPT' : 'LONG OPT') : 'SHARES'}
                                </Badge>
                                <span className="font-semibold text-slate-200">
                                  {leg.label}
                                </span>
                                {leg.isITM && (
                                  <span className="text-[8.5px] text-amber-400 font-bold border border-amber-500/40 px-1 py-0 rounded">
                                    ITM
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Leg Mark / Current Price */}
                            <td className="py-1.5 px-2 text-center whitespace-nowrap text-slate-300">
                              ${formatNumber(leg.lastPrice, 2, false)}
                            </td>

                            {/* Leg Delta */}
                            <td className="py-1.5 px-2 text-right whitespace-nowrap text-slate-300">
                              <span>{formatNumber(leg.delta, 2, false)}</span>
                              <span className="text-muted-foreground ml-0.5 text-[9px]">Δ</span>
                            </td>

                            {/* Leg Theta */}
                            <td className="py-1.5 px-2 text-right whitespace-nowrap">
                              <span className={leg.theta > 0 ? "text-emerald-400" : leg.theta < 0 ? "text-slate-300" : "text-muted-foreground"}>
                                {formatNumber(leg.theta, 3, false)}
                              </span>
                              <span className="text-purple-400 ml-0.5 text-[9px]">θ</span>
                            </td>

                            {/* Leg Vega */}
                            <td className="py-1.5 px-2 text-right whitespace-nowrap text-slate-300">
                              <span>{formatNumber(leg.vega, 2, false)}</span>
                              <span className="text-blue-400 ml-0.5 text-[9px]">v</span>
                            </td>

                            {/* Leg P/L Day with Center-Zero Bar */}
                            <td className="py-1 px-2 text-right whitespace-nowrap">
                              <div className="flex flex-col items-end">
                                <span className={isLegDayPlPos ? "text-emerald-400 font-medium" : "text-rose-400 font-medium"}>
                                  {formatMoney(leg.plDay, true)}
                                </span>
                                <div className="w-12 h-0.5 bg-slate-800 rounded relative overflow-hidden mt-0.5">
                                  <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-600 z-10" />
                                  {isLegDayPlPos ? (
                                    <div
                                      className="absolute left-1/2 top-0 bottom-0 bg-emerald-500"
                                      style={{ width: `${legBarWidthPercent}%` }}
                                    />
                                  ) : (
                                    <div
                                      className="absolute right-1/2 top-0 bottom-0 bg-rose-500"
                                      style={{ width: `${legBarWidthPercent}%` }}
                                    />
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Leg P/L Open */}
                            <td className="py-1.5 px-2 text-right whitespace-nowrap font-medium">
                              <span className={isLegOpenPlPos ? "text-emerald-400" : "text-rose-400"}>
                                {formatMoney(leg.plOpen, true)}
                              </span>
                            </td>

                            {/* Leg PoP */}
                            <td className="py-1.5 px-2 text-right whitespace-nowrap text-slate-300">
                              {leg.pop}%
                            </td>

                            {/* Leg Ext */}
                            <td className="py-1.5 px-2 text-right whitespace-nowrap text-slate-400">
                              {leg.ext !== 0 ? formatMoney(leg.ext) : '—'}
                            </td>

                            {/* Leg Cost */}
                            <td className="py-1.5 px-2 text-right whitespace-nowrap text-slate-400">
                              {formatMoney(leg.cost)}
                            </td>

                            {/* Leg NetLiq */}
                            <td className="py-1.5 px-2 text-right whitespace-nowrap font-medium">
                              <span className={leg.netLiq >= 0 ? "text-emerald-300" : "text-rose-400"}>
                                {formatMoney(leg.netLiq)}
                              </span>
                            </td>

                            {/* Leg Touch */}
                            <td className="py-1.5 px-2 text-right whitespace-nowrap text-muted-foreground/80">
                              {leg.touchPercent !== null ? `${leg.touchPercent}%` : '—'}
                            </td>

                            {/* Leg CapReq */}
                            <td className="py-1.5 px-2 text-right whitespace-nowrap text-slate-400">
                              {formatMoney(leg.capReq)}
                            </td>

                            {/* Leg Earns */}
                            <td className="py-1.5 px-2 text-center whitespace-nowrap text-muted-foreground/60">
                              {leg.earnsAt || '—'}
                            </td>

                            {/* Leg IVR */}
                            <td className="py-1.5 px-2 text-right whitespace-nowrap text-slate-400">
                              {leg.ivr.toFixed(1)}
                            </td>

                            {/* Leg DTE */}
                            <td className="py-1.5 px-3 text-right whitespace-nowrap font-medium">
                              {leg.dte !== null ? `${leg.dte}d` : '—'}
                            </td>

                            {/* Leg Advisor Action */}
                            <td className="py-1.5 px-2 text-center whitespace-nowrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onOpenAdvisorModal?.(leg.position)}
                                className="h-5 w-5 p-0 text-muted-foreground hover:text-cyan-400"
                                title="AI Advisor for leg"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>

          {/* Tastytrade Totals Footer */}
          {underlyingGroups.length > 0 && (
            <tfoot>
              <tr className="bg-[#121620] border-t-2 border-white/20 font-bold text-xs select-none">
                <td className="py-3 px-3 text-left font-black text-white uppercase tracking-wider">
                  TOTALS ({underlyingGroups.length})
                </td>
                <td className="py-3 px-2 text-center text-muted-foreground">—</td>
                <td className="py-3 px-2 text-right font-black text-white">
                  <span>{formatNumber(totals.delta, 2, false)}</span>
                  <span className="text-muted-foreground ml-0.5 text-[10px]">Δ</span>
                </td>
                <td className="py-3 px-2 text-right font-black">
                  <span className={totals.theta > 0 ? "text-emerald-400" : totals.theta < 0 ? "text-amber-400" : "text-white"}>
                    {formatNumber(totals.theta, 3, false)}
                  </span>
                  <span className="text-purple-400 ml-0.5 text-[10px]">θ</span>
                </td>
                <td className="py-3 px-2 text-right font-black text-blue-400">
                  <span>{formatNumber(totals.vega, 2, false)}</span>
                  <span className="text-blue-400 ml-0.5 text-[10px]">v</span>
                </td>
                <td className="py-3 px-2 text-right font-black">
                  <span className={totals.plDay >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {formatMoney(totals.plDay, true)}
                  </span>
                </td>
                <td className="py-3 px-2 text-right font-black">
                  <span className={totals.plOpen >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {formatMoney(totals.plOpen, true)}
                  </span>
                </td>
                <td className="py-3 px-2 text-right text-muted-foreground">—</td>
                <td className="py-3 px-2 text-right text-slate-200">
                  {formatMoney(totals.ext)}
                </td>
                <td className="py-3 px-2 text-right text-slate-200">
                  {formatMoney(totals.cost)}
                </td>
                <td className="py-3 px-2 text-right font-black">
                  <span className={totals.netLiq >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {formatMoney(totals.netLiq)}
                  </span>
                </td>
                <td className="py-3 px-2 text-right text-muted-foreground">—</td>
                <td className="py-3 px-2 text-right font-black text-cyan-300">
                  {formatMoney(totals.capReq)}
                </td>
                <td colSpan={4} className="py-3 px-2 text-center text-muted-foreground text-[10.5px]">
                  Cross-Broker Aggregation
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
