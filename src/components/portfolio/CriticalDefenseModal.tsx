import React, { useState, useMemo, useEffect } from 'react';
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
import { UnifiedPosition } from './types';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  TrendingDown,
  Sparkles,
  ChevronRight,
  ArrowRight,
  Clock,
  Filter,
  Maximize2,
  Minimize2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Bell,
  BellRing,
  LineChart,
  ExternalLink,
  Search,
  FolderPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCreateSingleShortOptionAlerts } from '@/services/alertService';
import { AddToWatchlistModal } from '../AddToWatchlistModal';
import { parseTrading212Ticker } from '@/utils/tickerUtils';

interface CriticalDefenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions: UnifiedPosition[];
  onOpenAdvisorForPosition: (pos: UnifiedPosition) => void;
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol?: string) => void;
}

export interface RankedThreatPosition {
  position: UnifiedPosition;
  threatScore: number;
  threatLevel: 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW';
  threatReason: string;
  isITM: boolean;
  distancePct: number;
  daysToExpiry: number | null;
}

export function isOptionCall(pos: {
  optionType?: string | null;
  symbol?: string | null;
  description?: string | null;
}): boolean {
  if (pos.optionType) {
    const norm = pos.optionType.trim().toUpperCase();
    if (norm === 'C' || norm === 'CALL' || norm === 'CALLS') return true;
    if (norm === 'P' || norm === 'PUT' || norm === 'PUTS') return false;
  }
  const text = `${pos.symbol || ''} ${pos.description || ''}`;
  // Standard OCC format: e.g. "OSCR  250117P00015000" or "OSCR250117C00015000"
  const occMatch = text.match(/\d{6}\s*([CP])\s*\d{8}/i);
  if (occMatch) {
    return occMatch[1].toUpperCase() === 'C';
  }
  // Loose OCC format: e.g. "250117P15" or "250117C15"
  const looseOccMatch = text.match(/\d{6}\s*([CP])\s*\d+/i);
  if (looseOccMatch) {
    return looseOccMatch[1].toUpperCase() === 'C';
  }
  if (/\bcall\b/i.test(text)) return true;
  if (/\bput\b/i.test(text)) return false;

  return false;
}

/**
 * Safely compute Open P&L and Open P&L % across brokers (IBKR, Tastytrade, Trading 212)
 * Handles raw or unified positions, missing/NaN fields, and dynamically calculates
 * P&L from averageCost and currentPrice (with multiplier 100 for options, accounting for short vs long).
 */
export function getPositionOpenPL(pos: UnifiedPosition | any): { pl: number; plPercent: number } {
  if (!pos) return { pl: 0, plPercent: 0 };

  const isOption = pos.assetType === 'Option' || pos.assetType === 'OPTION';
  const multiplier = isOption ? 100 : 1;
  const qty = Number(pos.quantity) || 0;
  const avgCost = Number(pos.averageCost) || 0;
  const curPrice = Number(pos.currentPrice) || 0;
  const mktVal = Number(pos.marketValue) || 0;

  // 1. Check explicit fields on pos
  let pl = pos.unrealizedPL ?? pos.unrealizedPnL ?? pos.ppl ?? pos.openPnL ?? pos.pnl;
  let plPercent = pos.unrealizedPLPercent ?? pos.unrealizedPnLPercent ?? pos.pplPercent;

  // 2. If pl is undefined, null, NaN, or if it is 0 while prices are different:
  if (
    pl === undefined ||
    pl === null ||
    isNaN(pl) ||
    (pl === 0 && avgCost > 0 && curPrice > 0 && Math.abs(avgCost - curPrice) > 0.0001)
  ) {
    if (qty !== 0 && avgCost > 0 && curPrice > 0) {
      if (qty < 0) {
        // Short: profit when price falls below average cost
        pl = (avgCost - curPrice) * Math.abs(qty) * multiplier;
      } else {
        // Long: profit when price rises above average cost
        pl = (curPrice - avgCost) * qty * multiplier;
      }
    } else if (mktVal !== 0 && avgCost > 0 && qty !== 0) {
      const costBasis = Math.abs(qty * avgCost * multiplier);
      if (qty < 0) {
        pl = costBasis - Math.abs(mktVal);
      } else {
        pl = mktVal - costBasis;
      }
    } else {
      pl = 0;
    }
  }

  // 3. If plPercent is undefined, null, or NaN:
  if (plPercent === undefined || plPercent === null || isNaN(plPercent)) {
    const costBasis = Math.abs(qty * avgCost * multiplier) || (mktVal > 0 ? Math.abs(mktVal - pl) : 0) || 1;
    plPercent = costBasis > 0 ? (pl / costBasis) * 100 : 0;
  }

  return {
    pl: Number(pl) || 0,
    plPercent: Number(plPercent) || 0,
  };
}

/**
 * Calculate multi-factor Threat Score (0 to 100) for a position
 */
export function computePositionThreat(pos: UnifiedPosition): RankedThreatPosition {
  let threatScore = 0;
  const reasons: string[] = [];

  const isOption = pos.assetType === 'Option' || pos.assetType === 'OPTION';
  const isShort = pos.quantity < 0;
  const { pl, plPercent } = getPositionOpenPL(pos);
  const isLosing = pl < 0;
  const lossPct = Math.abs(plPercent || 0);
  const lossDollar = Math.abs(pl || 0);
  const isHighProfitWinner = !isLosing && (plPercent || 0) >= 70;

  // 1. Calculate DTE and check for past expiration
  let dte: number | null = null;
  let isExpired = false;

  if (isOption && pos.expiry) {
    let expDate: Date;
    if (/^\d{8}$/.test(pos.expiry)) {
      const y = pos.expiry.substring(0, 4);
      const m = pos.expiry.substring(4, 6);
      const d = pos.expiry.substring(6, 8);
      expDate = new Date(Number(y), Number(m) - 1, Number(d));
    } else {
      expDate = new Date(pos.expiry);
    }

    if (!isNaN(expDate.getTime())) {
      const today = new Date();
      const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const expNoTime = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
      const diffTime = expNoTime.getTime() - todayNoTime.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        // Expired in the past!
        isExpired = true;
        dte = null;
      } else {
        dte = diffDays;
      }
    }
  }

  // If option is already expired, it has 0 active threat
  if (isExpired) {
    return {
      position: pos,
      threatScore: 0,
      threatLevel: 'LOW',
      threatReason: 'Position Expired (settlement complete/pending)',
      isITM: false,
      distancePct: Infinity,
      daysToExpiry: null,
    };
  }

  // 2. Calculate Distance & Moneyness ONLY if underlyingPrice is valid and > 0
  let isITM = false;
  let distancePct = Infinity;
  const hasValidUnderlyingPrice = typeof pos.underlyingPrice === 'number' && pos.underlyingPrice > 0;
  const hasValidStrike = typeof pos.strike === 'number' && pos.strike > 0;

  if (isOption && hasValidUnderlyingPrice && hasValidStrike) {
    distancePct = Math.abs((pos.underlyingPrice! - pos.strike!) / pos.strike!) * 100;
    const isCall = isOptionCall(pos);
    isITM = isCall ? (pos.underlyingPrice! > pos.strike!) : (pos.underlyingPrice! < pos.strike!);
  }

  // Scoring Logic:
  if (isOption && isShort) {
    if (isITM) {
      // ITM Short Option
      const optLabel = isOptionCall(pos) ? 'Call' : 'Put';
      if (isLosing) {
        threatScore += 45;
        reasons.push(`Short ${optLabel} is ${distancePct.toFixed(1)}% ITM (Assignment risk elevated)`);
      } else {
        threatScore += 25;
        reasons.push(`Short ${optLabel} is ${distancePct.toFixed(1)}% ITM (Covered/profitable)`);
      }
    } else if (distancePct < 3.5) {
      threatScore += 25;
      reasons.push(`Tested Strike: only ${distancePct.toFixed(1)}% buffer remaining`);
    } else if (distancePct < 8.0) {
      threatScore += 12;
      reasons.push(`Approaching Strike: ${distancePct.toFixed(1)}% buffer`);
    }
  }

  // Drawdown Scoring
  if (isLosing) {
    if (lossPct >= 100) {
      threatScore += 25;
      reasons.push(`Heavy Loss: -${lossPct.toFixed(0)}% drawdown`);
    } else if (lossPct >= 50) {
      threatScore += 15;
      reasons.push(`Significant Drawdown: -${lossPct.toFixed(0)}%`);
    } else if (lossPct >= 25) {
      threatScore += 8;
      reasons.push(`Drawdown: -${lossPct.toFixed(0)}%`);
    }

    if (lossDollar >= 1000) {
      threatScore += 10;
      reasons.push(`High Dollar Risk: -$${lossDollar.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    }
  }

  // Gamma / DTE Risk: Only escalates if the position is NOT a deep profit winner or is tested/losing
  if (isOption && dte !== null && (!isHighProfitWinner || isITM || distancePct < 8)) {
    if (dte === 0) {
      threatScore += 20;
      reasons.push(`0 DTE Expiration Day`);
    } else if (dte <= 7) {
      threatScore += 15;
      reasons.push(`Extreme Gamma Zone: ${dte}d to expiration`);
    } else if (dte <= 14) {
      threatScore += 8;
      reasons.push(`Critical Gamma Zone: ${dte}d to expiration`);
    } else if (dte <= 21) {
      threatScore += 4;
    }
  }

  // Equity Drawdown Risk
  if (!isOption && isLosing && lossPct > 20) {
    threatScore += 20;
    reasons.push(`Equity Drawdown: -${lossPct.toFixed(1)}% requires defense / collar`);
  }

  let threatLevel: 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
  if (threatScore >= 60) threatLevel = 'EXTREME';
  else if (threatScore >= 40) threatLevel = 'HIGH';
  else if (threatScore >= 20) threatLevel = 'MODERATE';

  return {
    position: pos,
    threatScore,
    threatLevel,
    threatReason: reasons.length > 0 ? reasons.join(' • ') : 'Standard position within normal parameters',
    isITM,
    distancePct,
    daysToExpiry: dte
  };
}

export function CriticalDefenseModal({
  isOpen,
  onClose,
  positions = [],
  onOpenAdvisorForPosition,
  onNavigateToResearch,
  onNavigateToGraphs
}: CriticalDefenseModalProps) {
  // Default to showing Options in Critical Position Defense Center
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'OPTIONS' | 'EQUITIES'>('OPTIONS');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'EXTREME' | 'HIGH' | 'ITM_SHORTS'>('ALL');
  const [brokerFilter, setBrokerFilter] = useState<string>('ALL');
  
  // Reset asset filter to 'OPTIONS' by default every time the modal is opened
  useEffect(() => {
    if (isOpen) {
      setAssetFilter('OPTIONS');
    }
  }, [isOpen]);
  
  // Sort State
  const [sortBy, setSortBy] = useState<'THREAT' | 'DTE' | 'BROKER' | 'LOSS_DOLLARS' | 'LOSS_PCT'>('THREAT');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [watchlistSymbol, setWatchlistSymbol] = useState<string | null>(null);

  const createSingleAlertMutation = useCreateSingleShortOptionAlerts();

  const handleGoToResearch = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    onClose();
    if (onNavigateToResearch) {
      onNavigateToResearch(symbol);
    }
    window.dispatchEvent(new CustomEvent('select-research-ticker', { detail: symbol }));
  };

  const handleGoToGraphs = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    onClose();
    if (onNavigateToGraphs) {
      onNavigateToGraphs(symbol);
    }
    window.dispatchEvent(new CustomEvent('select-graphs-ticker', { detail: symbol }));
  };

  const handleArmAlerts = async (e: React.MouseEvent, pos: UnifiedPosition) => {
    e.stopPropagation();
    try {
      await createSingleAlertMutation.mutateAsync(pos.id);
      toast.success(`Armed 5% & 10% Strike Proximity Defense Alerts for ${pos.underlyingSymbol || pos.symbol}!`);
    } catch (err: any) {
      toast.error(`Failed to set alerts: ${err.message}`);
    }
  };

  // Compute and rank all positions from most critical to least critical
  const rankedPositions = useMemo(() => {
    const safePositions = Array.isArray(positions) ? positions.filter(Boolean) : [];
    const scored = safePositions.map(p => computePositionThreat(p));
    const activeThreats = scored.filter(s => {
      const { pl } = getPositionOpenPL(s.position);
      return s.threatScore >= 15 || pl < 0;
    });
    return activeThreats.sort((a, b) => b.threatScore - a.threatScore);
  }, [positions]);

  // Counts for filters
  const optionsCount = useMemo(() => rankedPositions.filter(p => p.position.assetType === 'Option').length, [rankedPositions]);
  const equitiesCount = useMemo(() => rankedPositions.filter(p => p.position.assetType !== 'Option').length, [rankedPositions]);
  const ibkrCount = useMemo(() => rankedPositions.filter(p => p.position.source === 'IBKR').length, [rankedPositions]);
  const tastyCount = useMemo(() => rankedPositions.filter(p => p.position.source === 'Tastytrade').length, [rankedPositions]);
  const extremeThreatsCount = useMemo(() => rankedPositions.filter(p => p.threatLevel === 'EXTREME').length, [rankedPositions]);
  const highOrExtremeCount = useMemo(() => rankedPositions.filter(p => p.threatLevel === 'EXTREME' || p.threatLevel === 'HIGH').length, [rankedPositions]);
  const itmShortOptionsCount = useMemo(() => rankedPositions.filter(p => p.position.assetType === 'Option' && p.position.quantity < 0 && p.isITM).length, [rankedPositions]);
  const nearExpiryCount = useMemo(() => rankedPositions.filter(p => p.daysToExpiry !== null && p.daysToExpiry <= 14).length, [rankedPositions]);

  // Toggle sort key or direction
  const handleSortChange = (key: 'THREAT' | 'DTE' | 'BROKER' | 'LOSS_DOLLARS' | 'LOSS_PCT') => {
    if (sortBy === key) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(key);
      // Sensible defaults
      if (key === 'DTE') {
        setSortDirection('asc'); // Closest DTE first
      } else {
        setSortDirection('desc'); // Highest risk/loss first
      }
    }
  };

  // Filtered and Sorted Positions
  const filteredPositions = useMemo(() => {
    let result = rankedPositions.filter(p => {
      // 1. Asset Type filter
      if (assetFilter === 'OPTIONS' && p.position.assetType !== 'Option') return false;
      if (assetFilter === 'EQUITIES' && p.position.assetType === 'Option') return false;

      // 2. Severity filter
      if (severityFilter === 'EXTREME' && p.threatLevel !== 'EXTREME') return false;
      if (severityFilter === 'HIGH' && p.threatLevel !== 'EXTREME' && p.threatLevel !== 'HIGH') return false;
      if (severityFilter === 'ITM_SHORTS' && (!p.isITM || p.position.quantity >= 0 || p.position.assetType !== 'Option')) return false;

      // 3. Broker filter
      if (brokerFilter !== 'ALL' && p.position.source !== brokerFilter) return false;

      return true;
    });

    // 4. Sorting logic
    result.sort((a, b) => {
      if (sortBy === 'BROKER') {
        const brokerComp = (a.position.source || '').localeCompare(b.position.source || '');
        if (brokerComp !== 0) return sortDirection === 'asc' ? brokerComp : -brokerComp;
        return b.threatScore - a.threatScore;
      }
      if (sortBy === 'DTE') {
        const dteA = a.daysToExpiry ?? 9999;
        const dteB = b.daysToExpiry ?? 9999;
        return sortDirection === 'asc' ? (dteA - dteB) : (dteB - dteA);
      }
      if (sortBy === 'LOSS_DOLLARS') {
        const plA = getPositionOpenPL(a.position).pl;
        const plB = getPositionOpenPL(b.position).pl;
        return sortDirection === 'desc'
          ? (plA - plB) // most negative first
          : (plB - plA);
      }
      if (sortBy === 'LOSS_PCT') {
        const pctA = getPositionOpenPL(a.position).plPercent;
        const pctB = getPositionOpenPL(b.position).plPercent;
        return sortDirection === 'desc'
          ? (pctA - pctB) // most negative % first
          : (pctB - pctA);
      }
      // Default: Threat Rank / Risk Level
      return sortDirection === 'desc'
        ? (b.threatScore - a.threatScore) // Highest risk first
        : (a.threatScore - b.threatScore); // Lowest risk first
    });

    return result;
  }, [rankedPositions, assetFilter, severityFilter, brokerFilter, sortBy, sortDirection]);

  // Summary Metrics for the Defense Center
  const totalCapitalAtLoss = useMemo(() => {
    return rankedPositions
      .map(p => getPositionOpenPL(p.position).pl)
      .filter(pl => pl < 0)
      .reduce((sum, pl) => sum + pl, 0);
  }, [rankedPositions]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(
        "flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-2xl transition-all duration-150",
        isFullScreen
          ? "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !border-0 !m-0"
          : "w-[95vw] sm:max-w-6xl h-[90vh] max-h-[90vh] border border-rose-500/30 shadow-2xl rounded-2xl"
      )}>
        
        {/* ================= MODAL TOP HEADER ================= */}
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-slate-950/40 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pr-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 shadow-sm">
                  Risk & Defense Command
                </Badge>
                <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                  {rankedPositions.length} Positions Under Review
                </Badge>
              </div>
              <DialogTitle className="text-2xl font-black tracking-tight text-foreground pt-1 flex items-center gap-2.5">
                <ShieldAlert className="w-6 h-6 text-rose-400" />
                Critical Position Defense Center
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                All portfolio holdings ranked in order of highest threat, gamma risk, ITM short breaches, and capital drawdown.
              </DialogDescription>
            </div>

            {/* Quick Loss Metric Banner & Maximize Button */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end justify-center px-4 py-2 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-rose-400 font-mono shadow-sm">
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                  Threatened Capital
                </span>
                <span className="text-xl font-black">
                  -${Math.abs(totalCapitalAtLoss).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] font-bold text-rose-300">
                  {extremeThreatsCount} Extreme • {itmShortOptionsCount} ITM Short
                </span>
              </div>

              {/* Full Screen Toggle Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-xl border-border/50 hover:bg-white/10 shrink-0"
                title={isFullScreen ? "Restore window size" : "Expand to complete full-screen window"}
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* KPI Summary Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-border/40">
            <div className="bg-card/60 border border-border/50 rounded-xl p-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Extreme Threats</span>
              <p className="text-base font-bold font-mono text-rose-400 mt-0.5">{extremeThreatsCount} Positions</p>
            </div>
            <div className="bg-card/60 border border-border/50 rounded-xl p-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ITM Short Options</span>
              <p className="text-base font-bold font-mono text-amber-400 mt-0.5">{itmShortOptionsCount} Contracts</p>
            </div>
            <div className="bg-card/60 border border-border/50 rounded-xl p-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expiring &le; 14 Days</span>
              <p className="text-base font-bold font-mono text-purple-300 mt-0.5">{nearExpiryCount} Contracts</p>
            </div>
            <div className="bg-card/60 border border-border/50 rounded-xl p-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Drawdown</span>
              <p className="text-base font-bold font-mono text-rose-400 mt-0.5">-${Math.abs(totalCapitalAtLoss).toFixed(2)}</p>
            </div>
          </div>

          {/* Filter & Sort Controls */}
          <div className="space-y-2.5 mt-3 pt-3 border-t border-border/30">
            
            {/* Row 1: Asset Type & Broker Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1 shrink-0 mr-1">
                  <Filter className="w-3.5 h-3.5" /> Asset:
                </span>
                <div className="flex p-0.5 bg-slate-950/60 rounded-lg border border-border/50">
                  <Button variant="ghost" size="sm" onClick={() => setAssetFilter('ALL')} className={cn("h-7 px-2.5 text-xs font-semibold rounded-md", assetFilter === 'ALL' ? "bg-rose-500/20 text-rose-300" : "text-muted-foreground")}>
                    All ({rankedPositions.length})
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setAssetFilter('OPTIONS')} className={cn("h-7 px-2.5 text-xs font-semibold rounded-md", assetFilter === 'OPTIONS' ? "bg-purple-500/20 text-purple-300" : "text-muted-foreground")}>
                    Options ({optionsCount})
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setAssetFilter('EQUITIES')} className={cn("h-7 px-2.5 text-xs font-semibold rounded-md", assetFilter === 'EQUITIES' ? "bg-blue-500/20 text-blue-300" : "text-muted-foreground")}>
                    Equities ({equitiesCount})
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground font-semibold shrink-0 mr-1">Broker:</span>
                <div className="flex p-0.5 bg-slate-950/60 rounded-lg border border-border/50">
                  <Button variant="ghost" size="sm" onClick={() => setBrokerFilter('ALL')} className={cn("h-7 px-2.5 text-xs font-semibold rounded-md", brokerFilter === 'ALL' ? "bg-rose-500/20 text-rose-300" : "text-muted-foreground")}>All</Button>
                  <Button variant="ghost" size="sm" onClick={() => setBrokerFilter('IBKR')} className={cn("h-7 px-2.5 text-xs font-semibold rounded-md", brokerFilter === 'IBKR' ? "bg-orange-500/20 text-orange-300" : "text-muted-foreground")}>IBKR</Button>
                  <Button variant="ghost" size="sm" onClick={() => setBrokerFilter('Tastytrade')} className={cn("h-7 px-2.5 text-xs font-semibold rounded-md", brokerFilter === 'Tastytrade' ? "bg-red-500/20 text-red-300" : "text-muted-foreground")}>Tasty</Button>
                </div>
              </div>
            </div>

            {/* Row 2: Severity Filter & Sorting Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground font-semibold shrink-0 mr-1">Severity:</span>
                <div className="flex p-0.5 bg-slate-950/60 rounded-lg border border-border/50">
                  <Button variant="ghost" size="sm" onClick={() => setSeverityFilter('ALL')} className={cn("h-7 px-2 text-xs font-semibold rounded-md", severityFilter === 'ALL' ? "bg-rose-500/20 text-rose-300" : "text-muted-foreground")}>All Tiers</Button>
                  <Button variant="ghost" size="sm" onClick={() => setSeverityFilter('EXTREME')} className={cn("h-7 px-2 text-xs font-semibold rounded-md", severityFilter === 'EXTREME' ? "bg-rose-500/25 text-rose-300" : "text-muted-foreground")}>Extreme</Button>
                  <Button variant="ghost" size="sm" onClick={() => setSeverityFilter('HIGH')} className={cn("h-7 px-2 text-xs font-semibold rounded-md", severityFilter === 'HIGH' ? "bg-amber-500/20 text-amber-300" : "text-muted-foreground")}>High+</Button>
                </div>
              </div>

              {/* Sort By Selector: Risk Level & Days to Expiry */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground font-semibold shrink-0 mr-1 flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3" /> Sort:
                </span>
                <div className="flex p-0.5 bg-slate-950/60 rounded-lg border border-border/50 items-center">
                  <Button variant="ghost" size="sm" onClick={() => handleSortChange('THREAT')} className={cn("h-7 px-2.5 text-xs font-semibold rounded-md flex items-center gap-1", sortBy === 'THREAT' ? "bg-rose-500/20 text-rose-300" : "text-muted-foreground")} title="Sort by calculated Risk Level">
                    <span>Risk Level</span>
                    {sortBy === 'THREAT' && (sortDirection === 'desc' ? <ArrowDown className="w-3 h-3 text-rose-400" /> : <ArrowUp className="w-3 h-3 text-rose-400" />)}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleSortChange('DTE')} className={cn("h-7 px-2.5 text-xs font-semibold rounded-md flex items-center gap-1", sortBy === 'DTE' ? "bg-purple-500/20 text-purple-300" : "text-muted-foreground")} title="Sort by Days to Expiration">
                    <Clock className="w-3 h-3" />
                    <span>DTE</span>
                    {sortBy === 'DTE' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-purple-300" /> : <ArrowDown className="w-3 h-3 text-purple-300" />)}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleSortChange('BROKER')} className={cn("h-7 px-2.5 text-xs font-semibold rounded-md", sortBy === 'BROKER' ? "bg-cyan-500/20 text-cyan-300" : "text-muted-foreground")}>Broker</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleSortChange('LOSS_DOLLARS')} className={cn("h-7 px-2.5 text-xs font-semibold rounded-md", sortBy === 'LOSS_DOLLARS' ? "bg-amber-500/20 text-amber-300" : "text-muted-foreground")}>Loss ($)</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleSortChange('LOSS_PCT')} className={cn("h-7 px-2.5 text-xs font-semibold rounded-md", sortBy === 'LOSS_PCT' ? "bg-rose-500/20 text-rose-300" : "text-muted-foreground")}>Loss %</Button>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* ================= SCROLLABLE RANKED POSITIONS LIST ================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
          
          {filteredPositions.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-base font-bold text-foreground">No Critical Defense Positions</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  All active positions are currently within safe risk tolerance parameters. No immediate delta or gamma defense required.
                </p>
              </div>
            </div>
          ) : (
            filteredPositions.map((threat, index) => {
              const pos = threat.position;
              const { pl, plPercent } = getPositionOpenPL(pos);
              let cleanBase = (pos.underlyingSymbol || '').trim().toUpperCase();
              if (!cleanBase) {
                const isOpt = pos.assetType === 'Option' || pos.assetType === 'OPTION';
                if (isOpt) {
                  cleanBase = (pos.symbol.match(/^[A-Z]+/)?.[0] || pos.symbol).trim().toUpperCase();
                } else if (pos.ticker) {
                  cleanBase = parseTrading212Ticker(pos.ticker).cleanSymbol.toUpperCase();
                } else {
                  const raw = (pos.symbol || '').trim().toUpperCase();
                  if (raw.endsWith('_US_EQ')) cleanBase = raw.replace('_US_EQ', '');
                  else if (raw.endsWith('_CA_EQ')) cleanBase = raw.replace('_CA_EQ', '') + '.TO';
                  else if (raw.endsWith('L_EQ') || raw.endsWith('P_EQ')) cleanBase = raw.replace(/[LP]_EQ$/, '') + '.L';
                  else if (raw.endsWith('_EQ')) cleanBase = raw.replace('_EQ', '');
                  else cleanBase = raw;
                }
              }
              const isShort = pos.quantity < 0;
              const isOption = pos.assetType === 'Option';

              const rankBadgeClass =
                threat.threatLevel === 'EXTREME'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                  : threat.threatLevel === 'HIGH'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-muted/40 text-muted-foreground border-border/50';

              return (
                <Card
                  key={pos.id || index}
                  className={cn(
                    "border transition-all duration-200 shadow-md relative overflow-hidden group",
                    threat.threatLevel === 'EXTREME'
                      ? "bg-rose-950/15 border-rose-500/40 hover:border-rose-500/60"
                      : threat.threatLevel === 'HIGH'
                      ? "bg-amber-950/10 border-amber-500/30 hover:border-amber-500/50"
                      : "bg-card/50 border-border/60 hover:border-border"
                  )}
                >
                  {/* Left Color Indicator Bar */}
                  <div
                    className={cn(
                      "absolute top-0 left-0 bottom-0 w-1.5",
                      threat.threatLevel === 'EXTREME'
                        ? "bg-rose-500"
                        : threat.threatLevel === 'HIGH'
                        ? "bg-amber-500"
                        : "bg-purple-500"
                    )}
                  />

                  <CardContent className="p-5 pl-5 space-y-3">
                    
                    {/* Top Row: Rank, Symbol, Threat Badge, Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Rank Badge */}
                        <Badge className={cn("text-xs font-mono font-black px-2 py-0.5 border", rankBadgeClass)}>
                          #{index + 1} {threat.threatLevel} THREAT (Score: {threat.threatScore})
                        </Badge>

                        {/* Symbol Badge - Clickable to Research Station */}
                        <button
                          type="button"
                          onClick={(e) => handleGoToResearch(e, cleanBase)}
                          className="inline-flex items-center gap-1.5 bg-primary/20 hover:bg-primary/35 active:scale-95 text-primary hover:text-white border border-primary/40 hover:border-primary/70 font-mono font-black text-sm px-2.5 py-0.5 rounded-full transition-all cursor-pointer shadow-sm group/sym"
                          title={`Click to open ${cleanBase} in deep-dive Research Station`}
                        >
                          <span>${cleanBase}</span>
                          <ExternalLink className="w-3 h-3 opacity-60 group-hover/sym:opacity-100 transition-opacity" />
                        </button>

                        <Badge variant="outline" className="text-xs uppercase font-semibold">
                          {pos.assetType} • {pos.source}
                        </Badge>

                        {isOption && pos.strike && (
                          <Badge variant="secondary" className="text-xs font-mono font-bold">
                            ${pos.strike} {pos.optionType || 'Option'}
                          </Badge>
                        )}
                      </div>

                      {/* Right Action: Graph, Watchlist, Arm Alerts & Open AI Defense Advisor Modal */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
                        {/* Graph / Chart Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleGoToGraphs(e, cleanBase)}
                          className="h-8 text-xs px-2.5 font-bold gap-1.5 bg-sky-500/10 hover:bg-sky-500/25 border-sky-500/35 text-sky-300 shadow-sm"
                          title={`Open interactive chart and technical graphs for ${cleanBase}`}
                        >
                          <LineChart className="w-3.5 h-3.5 text-sky-400" />
                          <span>Graph</span>
                        </Button>

                        {/* Add to Watchlist Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWatchlistSymbol(cleanBase);
                          }}
                          className="h-8 text-xs px-2.5 font-bold gap-1.5 bg-amber-500/10 hover:bg-amber-500/25 border-amber-500/35 text-amber-300 shadow-sm"
                          title={`Save ${cleanBase} to a Watchlist`}
                        >
                          <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                          <span>Watchlist</span>
                        </Button>

                        {isOption && isShort && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleArmAlerts(e, pos)}
                            disabled={createSingleAlertMutation.isPending}
                            className="h-8 text-xs px-2.5 font-bold gap-1.5 bg-purple-500/15 hover:bg-purple-500/25 border-purple-500/40 text-purple-300 shadow-sm"
                            title="Set automated 5% and 10% underlying strike proximity alerts for this short option"
                          >
                            <Bell className={cn("w-3.5 h-3.5 text-purple-400", createSingleAlertMutation.isPending && "animate-spin")} />
                            <span>Set 5% & 10% Alerts</span>
                          </Button>
                        )}

                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            onClose();
                            onOpenAdvisorForPosition(pos);
                          }}
                          className="h-8 text-xs px-3 font-bold gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>AI Defense Plan</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Threat Reason Callout Banner */}
                    <div className={cn(
                      "p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2",
                      threat.threatLevel === 'EXTREME'
                        ? "bg-rose-950/25 border-rose-500/35 text-rose-200"
                        : "bg-amber-950/20 border-amber-500/30 text-amber-200"
                    )}>
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{threat.threatReason}</span>
                    </div>

                    {/* Detailed Position Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                      
                      {/* Position & Qty */}
                      <div className="bg-card/70 border border-border/50 rounded-xl p-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Position Qty</span>
                        <p className={cn("font-mono font-bold mt-0.5", isShort ? "text-rose-400" : "text-slate-200")}>
                          {pos.quantity > 0 ? `+${pos.quantity}` : pos.quantity} {isOption ? 'x100' : 'Shares'}
                        </p>
                      </div>

                      {/* Underlying vs Strike */}
                      <div className="bg-card/70 border border-border/50 rounded-xl p-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {isOption ? 'Strike vs Und.' : 'Market Price'}
                        </span>
                        <p className="font-mono font-bold mt-0.5 text-foreground">
                          {isOption && pos.strike && pos.underlyingPrice && pos.underlyingPrice > 0 ? (
                            <span>${pos.strike} vs <span className="text-slate-300">${pos.underlyingPrice.toFixed(2)}</span></span>
                          ) : isOption && pos.strike ? (
                            <span>Strike: ${pos.strike}</span>
                          ) : (
                            <span>${pos.currentPrice.toFixed(2)}</span>
                          )}
                        </p>
                      </div>

                      {/* Distance / ITM Status */}
                      <div className="bg-card/70 border border-border/50 rounded-xl p-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Moneyness & Distance</span>
                        <div className="mt-0.5">
                          {isOption ? (
                            threat.distancePct !== Infinity ? (
                              <span className={cn(
                                "font-mono font-black text-xs px-2 py-0.5 rounded-md inline-block",
                                threat.isITM
                                  ? "bg-rose-500/25 text-rose-200 border border-rose-500/40"
                                  : threat.distancePct <= 3.0
                                  ? "bg-amber-500/25 text-amber-200 border border-amber-500/40"
                                  : threat.distancePct <= 8.0
                                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                  : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              )}>
                                {threat.isITM ? `ITM (${threat.distancePct.toFixed(1)}% breach)` : `OTM (${threat.distancePct.toFixed(1)}% away)`}
                              </span>
                            ) : plPercent >= 70 ? (
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md inline-block bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                OTM (High Decay Profit)
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-muted-foreground">OTM Buffer</span>
                            )
                          ) : (
                            <span className="font-mono font-bold text-foreground">${pos.currentPrice.toFixed(2)}</span>
                          )}
                        </div>
                      </div>

                      {/* DTE & Expiration */}
                      <div className="bg-card/70 border border-border/50 rounded-xl p-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Expiration & DTE</span>
                        <div className="mt-0.5">
                          {threat.daysToExpiry !== null ? (
                            <span className={cn(
                              "font-mono font-bold text-xs px-2 py-0.5 rounded-md inline-block",
                              threat.daysToExpiry === 0 ? "bg-rose-600 text-white font-black animate-pulse" :
                              threat.daysToExpiry <= 3 ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" :
                              threat.daysToExpiry <= 14 ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" :
                              "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                            )}>
                              {threat.daysToExpiry === 0 ? 'Expires Today' : `${threat.daysToExpiry}d left`}
                            </span>
                          ) : (
                            <span className="font-mono text-muted-foreground text-xs">{isOption ? 'Expired' : 'Equity'}</span>
                          )}
                        </div>
                      </div>

                      {/* Total Open P&L */}
                      <div className="bg-card/70 border border-border/50 rounded-xl p-2.5 col-span-2 sm:col-span-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Open P&L</span>
                        <p className={cn(
                          "font-mono font-bold mt-0.5",
                          pl >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                          {pl >= 0 ? '+' : '-'}${Math.abs(pl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-[10px] ml-1 font-semibold">({plPercent >= 0 ? '+' : ''}{plPercent.toFixed(1)}%)</span>
                        </p>
                      </div>

                    </div>

                  </CardContent>
                </Card>
              );
            })
          )}

        </div>
      </DialogContent>

      {/* Add To Watchlist Modal */}
      <AddToWatchlistModal
        isOpen={Boolean(watchlistSymbol)}
        onClose={() => setWatchlistSymbol(null)}
        symbol={watchlistSymbol || ''}
      />
    </Dialog>
  );
}
