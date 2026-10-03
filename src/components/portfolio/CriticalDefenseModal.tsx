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
  FolderPlus,
  Target,
  TrendingUp,
  Zap,
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

  // Long Options (Calls & Puts): OTM is losing trade / danger position; ITM is winning / safe
  if (isOption && !isShort && hasValidUnderlyingPrice && hasValidStrike) {
    const isCall = isOptionCall(pos);
    const optLabel = isCall ? 'Call' : 'Put';
    if (!isITM) {
      // OTM Long Option is a decaying trade at danger of expiring worthless
      if (isLosing) {
        threatScore += 40;
        reasons.push(`Long ${optLabel} is ${distancePct !== Infinity ? `${distancePct.toFixed(1)}% ` : ''}OTM (Losing trade with 0 intrinsic value)`);
      } else {
        threatScore += 25;
        reasons.push(`Long ${optLabel} is ${distancePct !== Infinity ? `${distancePct.toFixed(1)}% ` : ''}OTM (Decaying trade at risk of expiring worthless)`);
      }

      if (distancePct !== Infinity && distancePct > 10.0) {
        threatScore += 10;
        reasons.push(`Deep OTM: ${distancePct.toFixed(1)}% deficit from strike`);
      }
    } else {
      // ITM Long Option has intrinsic value (winning/profitable trade)
      if (isLosing) {
        threatScore += 10;
        reasons.push(`Long ${optLabel} is ${distancePct.toFixed(1)}% ITM but carries entry drawdown`);
      }
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

  // Gamma / DTE Risk: Escalates for tested/breached shorts or decaying OTM/losing longs
  const shouldEscalateDte = isOption && dte !== null && (
    isShort
      ? (!isHighProfitWinner || isITM || distancePct < 8)
      : (!isITM || isLosing || dte <= 7)
  );

  if (shouldEscalateDte) {
    if (dte === 0) {
      threatScore += 20;
      reasons.push(`0 DTE Expiration Day`);
    } else if (dte <= 7) {
      threatScore += 15;
      reasons.push(`Extreme Gamma/Theta Decay Zone: ${dte}d to expiration`);
    } else if (dte <= 14) {
      threatScore += 8;
      reasons.push(`Critical Gamma/Theta Zone: ${dte}d to expiration`);
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

/**
 * Formats standard or compact OCC expiry dates (e.g. "20260918" or "2025-01-17")
 * into human-readable format like "Sep 18, 2026".
 */
export function formatExpiryDate(expiryStr?: string | null): string {
  if (!expiryStr) return '';
  const clean = String(expiryStr).trim();
  if (/^\d{8}$/.test(clean)) {
    const y = clean.substring(0, 4);
    const m = parseInt(clean.substring(4, 6), 10) - 1;
    const d = parseInt(clean.substring(6, 8), 10);
    const date = new Date(Number(y), m, d);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  const date = new Date(clean);
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return clean;
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
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Position Direction (Long vs Short) and Option Type (Puts vs Calls) filters
  const [sideFilter, setSideFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [optionTypeFilter, setOptionTypeFilter] = useState<'ALL' | 'PUTS' | 'CALLS'>('ALL');

  const handleSetOptionTypeFilter = (type: 'ALL' | 'PUTS' | 'CALLS') => {
    setOptionTypeFilter(prev => {
      const next = prev === type ? 'ALL' : type;
      if (next !== 'ALL' && assetFilter === 'EQUITIES') {
        setAssetFilter('OPTIONS');
      }
      return next;
    });
  };
  
  // Reset filters when the modal is opened
  useEffect(() => {
    if (isOpen) {
      setAssetFilter('OPTIONS');
      setSideFilter('ALL');
      setOptionTypeFilter('ALL');
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
  const longCount = useMemo(() => rankedPositions.filter(p => p.position.quantity > 0).length, [rankedPositions]);
  const shortCount = useMemo(() => rankedPositions.filter(p => p.position.quantity < 0).length, [rankedPositions]);
  const putsCount = useMemo(() => rankedPositions.filter(p => p.position.assetType === 'Option' && !isOptionCall(p.position)).length, [rankedPositions]);
  const callsCount = useMemo(() => rankedPositions.filter(p => p.position.assetType === 'Option' && isOptionCall(p.position)).length, [rankedPositions]);

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

      // 4. Quick Ticker Search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toUpperCase();
        const sym = (p.position.symbol || '').toUpperCase();
        const und = (p.position.underlyingSymbol || '').toUpperCase();
        const t212 = (p.position.ticker || '').toUpperCase();
        if (!sym.includes(q) && !und.includes(q) && !t212.includes(q)) return false;
      }

      // 5. Position Side filter (Long vs Short)
      if (sideFilter === 'LONG' && p.position.quantity <= 0) return false;
      if (sideFilter === 'SHORT' && p.position.quantity >= 0) return false;

      // 6. Option Type filter (Puts vs Calls)
      if (optionTypeFilter === 'PUTS') {
        if (p.position.assetType !== 'Option' || isOptionCall(p.position)) return false;
      }
      if (optionTypeFilter === 'CALLS') {
        if (p.position.assetType !== 'Option' || !isOptionCall(p.position)) return false;
      }

      return true;
    });

    // 5. Sorting logic
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
  }, [rankedPositions, assetFilter, severityFilter, brokerFilter, searchQuery, sortBy, sortDirection, sideFilter, optionTypeFilter]);

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
            <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300/80">Extreme Threats</span>
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-xl font-black font-mono text-rose-400 mt-1">{extremeThreatsCount} Positions</p>
              <span className="text-[10px] text-muted-foreground mt-0.5">Immediate intervention</span>
            </div>
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">ITM Short Options</span>
                <Target className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-xl font-black font-mono text-amber-400 mt-1">{itmShortOptionsCount} Contracts</p>
              <span className="text-[10px] text-muted-foreground mt-0.5">Breached strike prices</span>
            </div>
            <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-3 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300/80">Expiring &le; 14 Days</span>
                <Clock className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-xl font-black font-mono text-purple-300 mt-1">{nearExpiryCount} Contracts</p>
              <span className="text-[10px] text-muted-foreground mt-0.5">Accelerated gamma zone</span>
            </div>
            <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300/80">Total Drawdown</span>
                <TrendingDown className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-xl font-black font-mono text-rose-400 mt-1">-${Math.abs(totalCapitalAtLoss).toFixed(2)}</p>
              <span className="text-[10px] text-muted-foreground mt-0.5">Unrealized position loss</span>
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

            {/* Row 2: Position Direction (Long/Short) & Option Contract Type (Puts/Calls) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              
              {/* Position Direction (Long vs Short) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1 shrink-0 mr-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Side:
                </span>
                <div className="flex p-0.5 bg-slate-950/60 rounded-lg border border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSideFilter('ALL')}
                    data-testid="filter-side-all"
                    className={cn(
                      "h-7 px-2.5 text-xs font-semibold rounded-md transition-colors",
                      sideFilter === 'ALL'
                        ? "bg-rose-500/20 text-rose-300 font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    All Sides
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSideFilter(prev => prev === 'LONG' ? 'ALL' : 'LONG')}
                    data-testid="filter-long"
                    className={cn(
                      "h-7 px-2.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1",
                      sideFilter === 'LONG'
                        ? "bg-emerald-500/25 text-emerald-300 font-bold border border-emerald-500/40 shadow-xs"
                        : "text-muted-foreground hover:text-emerald-300"
                    )}
                    title="Filter to Long positions (quantity > 0)"
                  >
                    <ArrowUp className="w-3 h-3 text-emerald-400" />
                    <span>Long ({longCount})</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSideFilter(prev => prev === 'SHORT' ? 'ALL' : 'SHORT')}
                    data-testid="filter-short"
                    className={cn(
                      "h-7 px-2.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1",
                      sideFilter === 'SHORT'
                        ? "bg-rose-500/25 text-rose-300 font-bold border border-rose-500/40 shadow-xs"
                        : "text-muted-foreground hover:text-rose-300"
                    )}
                    title="Filter to Short positions (quantity < 0)"
                  >
                    <ArrowDown className="w-3 h-3 text-rose-400" />
                    <span>Short ({shortCount})</span>
                  </Button>
                </div>
              </div>

              {/* Option Contract Type (Puts vs Calls) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1 shrink-0 mr-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Contract:
                </span>
                <div className="flex p-0.5 bg-slate-950/60 rounded-lg border border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOptionTypeFilter('ALL')}
                    data-testid="filter-type-all"
                    className={cn(
                      "h-7 px-2.5 text-xs font-semibold rounded-md transition-colors",
                      optionTypeFilter === 'ALL'
                        ? "bg-rose-500/20 text-rose-300 font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    All Types
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetOptionTypeFilter('PUTS')}
                    data-testid="filter-puts"
                    className={cn(
                      "h-7 px-2.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1",
                      optionTypeFilter === 'PUTS'
                        ? "bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40 shadow-xs"
                        : "text-muted-foreground hover:text-amber-300"
                    )}
                    title="Filter to Put contracts"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    <span>Puts ({putsCount})</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetOptionTypeFilter('CALLS')}
                    data-testid="filter-calls"
                    className={cn(
                      "h-7 px-2.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1",
                      optionTypeFilter === 'CALLS'
                        ? "bg-indigo-500/25 text-indigo-300 font-bold border border-indigo-500/40 shadow-xs"
                        : "text-muted-foreground hover:text-indigo-300"
                    )}
                    title="Filter to Call contracts"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                    <span>Calls ({callsCount})</span>
                  </Button>
                </div>

                {/* Reset button if either side or contract filter is active */}
                {(sideFilter !== 'ALL' || optionTypeFilter !== 'ALL') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSideFilter('ALL'); setOptionTypeFilter('ALL'); }}
                    data-testid="filter-clear-side-type"
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    title="Clear side and contract filters"
                  >
                    <span className="text-slate-400">Clear</span>
                    <span className="text-rose-400 font-bold font-mono">
                      {sideFilter !== 'ALL' ? (sideFilter === 'LONG' ? 'Long' : 'Short') : ''}
                      {sideFilter !== 'ALL' && optionTypeFilter !== 'ALL' ? ' ' : ''}
                      {optionTypeFilter !== 'ALL' ? (optionTypeFilter === 'PUTS' ? 'Puts' : 'Calls') : ''}
                    </span>
                    <span>✕</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Row 3: Severity Filter, Quick Ticker Search & Sorting Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground font-semibold shrink-0 mr-1">Severity:</span>
                  <div className="flex p-0.5 bg-slate-950/60 rounded-lg border border-border/50">
                    <Button variant="ghost" size="sm" onClick={() => setSeverityFilter('ALL')} className={cn("h-7 px-2 text-xs font-semibold rounded-md", severityFilter === 'ALL' ? "bg-rose-500/20 text-rose-300" : "text-muted-foreground")}>All Tiers</Button>
                    <Button variant="ghost" size="sm" onClick={() => setSeverityFilter('EXTREME')} className={cn("h-7 px-2 text-xs font-semibold rounded-md", severityFilter === 'EXTREME' ? "bg-rose-500/25 text-rose-300" : "text-muted-foreground")}>Extreme</Button>
                    <Button variant="ghost" size="sm" onClick={() => setSeverityFilter('HIGH')} className={cn("h-7 px-2 text-xs font-semibold rounded-md", severityFilter === 'HIGH' ? "bg-amber-500/20 text-amber-300" : "text-muted-foreground")}>High+</Button>
                  </div>
                </div>

                {/* Quick Search Ticker Input */}
                <div className="relative w-36 sm:w-44">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Filter ticker..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-7 pl-7 pr-2 bg-slate-950/70 border border-border/60 rounded-lg text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
                  />
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
              const isOption = pos.assetType === 'Option' || pos.assetType === 'OPTION';
              const isCall = isOptionCall(pos);
              const optTypeLabel = isCall ? 'CALL' : 'PUT';
              const isLongOption = isOption && !isShort;
              const isShortOption = isOption && isShort;

              const hasValidUnderlying = typeof pos.underlyingPrice === 'number' && pos.underlyingPrice > 0;
              const hasValidStrike = typeof pos.strike === 'number' && pos.strike > 0;
              const dollarDiff = (hasValidUnderlying && hasValidStrike) ? Math.abs(pos.underlyingPrice! - pos.strike!) : null;
              const formattedExpiry = formatExpiryDate(pos.expiry);

              const strategyLabel = isOption
                ? (isShort ? (isCall ? 'Short Call' : 'Short Put') : (isCall ? 'Long Call' : 'Long Put'))
                : (isShort ? 'Short Stock' : 'Long Shares');

              const rankBadgeClass =
                threat.threatLevel === 'EXTREME'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                  : threat.threatLevel === 'HIGH'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-muted/40 text-muted-foreground border-border/50';

              return (
                <Card
                  key={pos.id || index}
                  className={cn(
                    "border transition-all duration-200 shadow-xl relative overflow-hidden group rounded-2xl",
                    threat.threatLevel === 'EXTREME'
                      ? "bg-gradient-to-b from-rose-950/25 via-slate-900/90 to-slate-950/95 border-rose-500/50 hover:border-rose-500/80 shadow-[0_4px_28px_rgba(244,63,94,0.14)] ring-1 ring-rose-500/20"
                      : threat.threatLevel === 'HIGH'
                      ? "bg-gradient-to-b from-amber-950/20 via-slate-900/90 to-slate-950/95 border-amber-500/40 hover:border-amber-500/70 shadow-[0_4px_24px_rgba(245,158,11,0.1)] ring-1 ring-amber-500/20"
                      : "bg-gradient-to-b from-slate-900/70 via-slate-900/90 to-slate-950/95 border-border/70 hover:border-border shadow-md"
                  )}
                >
                  {/* Left Accent Threat Bar */}
                  <div
                    className={cn(
                      "absolute top-0 left-0 bottom-0 w-2",
                      threat.threatLevel === 'EXTREME'
                        ? "bg-gradient-to-b from-rose-500 to-red-600 shadow-[0_0_12px_rgba(244,63,94,0.8)]"
                        : threat.threatLevel === 'HIGH'
                        ? "bg-gradient-to-b from-amber-500 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]"
                        : "bg-purple-500"
                    )}
                  />

                  <CardContent className="p-5 sm:p-6 pl-6 sm:pl-7 space-y-4">
                    
                    {/* Top Row: Rank, Strategy, Broker, Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
                      
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Threat Level Badge */}
                        <Badge className={cn("text-xs font-mono font-black px-2.5 py-0.5 border shadow-sm", rankBadgeClass)}>
                          #{index + 1} {threat.threatLevel} THREAT (Score: {threat.threatScore})
                        </Badge>

                        {/* Strategy Pill */}
                        <Badge variant="outline" className={cn(
                          "text-xs font-bold font-mono px-2 py-0.5 border",
                          isShort
                            ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                            : isOption
                            ? (threat.isITM
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                : "bg-rose-500/15 text-rose-300 border-rose-500/30")
                            : (pl < 0
                                ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30")
                        )}>
                          {strategyLabel}
                        </Badge>

                        {/* Broker Pill */}
                        <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 bg-slate-950/60 border-border/60 text-slate-300">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full mr-1.5 inline-block",
                            pos.source === 'Tastytrade' ? "bg-rose-400" : pos.source === 'IBKR' ? "bg-amber-400" : "bg-sky-400"
                          )} />
                          {pos.source}
                        </Badge>
                      </div>

                      {/* Right Action Buttons */}
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
                          className="h-8 text-xs px-3 font-bold gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md active:scale-95"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>AI Defense Plan</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* ======================================================== */}
                    {/* HIGHLIGHTED TACTICAL HUD: TICKER, MONEYNESS, DTE, P&L   */}
                    {/* ======================================================== */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      
                      {/* TILE 1: TICKER & CONTRACT SPECIFICATION (HIGHLIGHTED) */}
                      <div className="bg-slate-900/80 hover:bg-slate-900 border border-slate-700/70 hover:border-primary/60 rounded-2xl p-4 flex flex-col justify-between transition-all shadow-md group/tile">
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              Target Ticker
                            </span>
                            <Badge variant="outline" className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                              isShort
                                ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                : isOption
                                ? (threat.isITM
                                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                    : "bg-rose-500/15 text-rose-300 border-rose-500/30")
                                : (pl < 0
                                    ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30")
                            )}>
                              {isOption ? (isShort ? 'Short Opt' : 'Long Opt') : (isShort ? 'Short Stk' : 'Long Stk')}
                            </Badge>
                          </div>

                          {/* Standout Clickable Ticker Button */}
                          <button
                            type="button"
                            onClick={(e) => handleGoToResearch(e, cleanBase)}
                            className="inline-flex items-center justify-between w-full bg-slate-950/80 hover:bg-primary/20 active:scale-95 text-foreground hover:text-white border border-primary/50 hover:border-primary/80 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-md group/sym ring-1 ring-primary/20"
                            title={`Click to open ${cleanBase} in deep-dive Research Station`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-2xl tracking-tight text-white group-hover/sym:text-primary transition-colors">
                                ${cleanBase}
                              </span>
                              {isOption && pos.strike && (
                                <span className={cn(
                                  "text-xs font-mono font-black px-2 py-0.5 rounded-md border",
                                  isLongOption
                                    ? (threat.isITM
                                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                        : "bg-rose-500/20 text-rose-300 border-rose-500/40")
                                    : (isCall
                                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                        : "bg-amber-500/20 text-amber-300 border-amber-500/40")
                                )}>
                                  ${pos.strike} {optTypeLabel}
                                </span>
                              )}
                            </div>
                            <ExternalLink className="w-4 h-4 text-primary/70 group-hover/sym:text-primary transition-opacity shrink-0" />
                          </button>
                        </div>

                        {/* Sizing & Strike/Spot Details */}
                        <div className="mt-3 pt-2.5 border-t border-border/40 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium">Position Size:</span>
                            <span className={cn("font-mono font-bold", isShort ? "text-rose-400" : "text-emerald-400")}>
                              {pos.quantity > 0 ? `+${pos.quantity}` : pos.quantity} {isOption ? (Math.abs(pos.quantity) === 1 ? 'Contract' : 'Contracts') : 'Shares'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium">{isOption ? 'Spot vs Strike:' : 'Market Price:'}</span>
                            <span className="font-mono font-bold text-foreground">
                              {isOption ? (
                                pos.strike && pos.underlyingPrice && pos.underlyingPrice > 0 ? (
                                  <span>${pos.underlyingPrice.toFixed(2)} <span className="text-muted-foreground">➔</span> ${pos.strike}</span>
                                ) : pos.strike ? (
                                  <span>Strike: ${pos.strike}</span>
                                ) : (
                                  <span>${pos.currentPrice.toFixed(2)}</span>
                                )
                              ) : (
                                <span>${pos.currentPrice.toFixed(2)}</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* TILE 2: MONEYNESS & DISTANCE (HERO HIGHLIGHT) */}
                      <div className={cn(
                        "rounded-2xl p-4 flex flex-col justify-between border transition-all shadow-md relative overflow-hidden",
                        !isOption
                          ? "bg-slate-900/80 border-slate-700/70"
                          : isLongOption
                          ? (threat.isITM
                              ? "bg-gradient-to-br from-emerald-950/45 via-emerald-900/25 to-slate-950 border-emerald-500/60 shadow-[0_0_24px_rgba(16,185,129,0.22)] ring-1 ring-emerald-500/30"
                              : threat.distancePct <= 3.5
                              ? "bg-gradient-to-br from-amber-950/45 via-amber-900/25 to-slate-950 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/30"
                              : "bg-gradient-to-br from-rose-950/50 via-rose-900/30 to-slate-950 border-rose-500/60 shadow-[0_0_24px_rgba(244,63,94,0.22)] ring-1 ring-rose-500/30")
                          : (threat.isITM
                              ? "bg-gradient-to-br from-rose-950/50 via-rose-900/30 to-slate-950 border-rose-500/60 shadow-[0_0_24px_rgba(244,63,94,0.22)] ring-1 ring-rose-500/30"
                              : threat.distancePct <= 3.5
                              ? "bg-gradient-to-br from-amber-950/45 via-amber-900/25 to-slate-950 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/30"
                              : threat.distancePct <= 8.0
                              ? "bg-gradient-to-br from-amber-950/30 via-slate-900/40 to-slate-950 border-amber-500/40"
                              : "bg-gradient-to-br from-emerald-950/30 via-slate-900/40 to-slate-950 border-emerald-500/40")
                      )}>
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <Target className={cn(
                                "w-3.5 h-3.5",
                                isLongOption
                                  ? (threat.isITM ? "text-emerald-400" : "text-rose-400")
                                  : (threat.isITM ? "text-rose-400" : "text-emerald-400")
                              )} /> Moneyness & Distance
                            </span>
                            {isOption && (
                              <Badge className={cn(
                                "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-sm",
                                isLongOption
                                  ? (threat.isITM
                                      ? "bg-emerald-500/30 text-emerald-200 border-emerald-500/50"
                                      : threat.distancePct <= 3.5
                                      ? "bg-amber-500/30 text-amber-200 border-amber-500/50"
                                      : "bg-rose-500/30 text-rose-200 border-rose-500/50 animate-pulse")
                                  : (threat.isITM
                                      ? "bg-rose-500/30 text-rose-200 border-rose-500/50 animate-pulse"
                                      : threat.distancePct <= 3.5
                                      ? "bg-amber-500/30 text-amber-200 border-amber-500/50"
                                      : threat.distancePct <= 8.0
                                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40")
                              )}>
                                {isLongOption
                                  ? (threat.isITM
                                      ? '✅ ITM IN PROFIT'
                                      : threat.distancePct <= 3.5
                                      ? '⚠️ NEAR STRIKE OTM'
                                      : '🚨 OTM LOSING TRADE')
                                  : (threat.isITM
                                      ? '🚨 ITM BREACH'
                                      : threat.distancePct <= 3.5
                                      ? '⚠️ TESTED'
                                      : threat.distancePct <= 8.0
                                      ? '⚡ APPROACHING'
                                      : '🛡️ SAFE OTM')}
                              </Badge>
                            )}
                          </div>

                          {/* Primary Distance Metric */}
                          <div className="mt-1">
                            {isOption ? (
                              threat.distancePct !== Infinity ? (
                                <div>
                                  <div className="flex items-baseline gap-1.5">
                                    <span className={cn(
                                      "font-mono font-black text-2xl sm:text-3xl tracking-tight",
                                      isLongOption
                                        ? (threat.isITM
                                            ? "text-emerald-300"
                                            : threat.distancePct <= 3.5
                                            ? "text-amber-300"
                                            : "text-rose-200")
                                        : (threat.isITM
                                            ? "text-rose-200"
                                            : threat.distancePct <= 3.5
                                            ? "text-amber-300"
                                            : threat.distancePct <= 8.0
                                            ? "text-amber-200"
                                            : "text-emerald-300")
                                    )}>
                                      {isLongOption
                                        ? (threat.isITM
                                            ? `+${threat.distancePct.toFixed(1)}%`
                                            : `-${threat.distancePct.toFixed(1)}%`)
                                        : (threat.isITM
                                            ? `-${threat.distancePct.toFixed(1)}%`
                                            : `${threat.distancePct.toFixed(1)}%`)}
                                    </span>
                                    <span className={cn(
                                      "text-xs font-bold uppercase tracking-wider",
                                      isLongOption
                                        ? (threat.isITM ? "text-emerald-300" : "text-rose-300")
                                        : (threat.isITM ? "text-rose-300" : "text-slate-300")
                                    )}>
                                      {isLongOption
                                        ? (threat.isITM ? 'In The Money' : 'OTM Deficit')
                                        : (threat.isITM ? 'In The Money' : 'Buffer')}
                                    </span>
                                  </div>

                                  <p className="text-[11px] font-medium text-slate-300 mt-1">
                                    {dollarDiff !== null ? (
                                      isLongOption
                                        ? (threat.isITM
                                            ? `+$${dollarDiff.toFixed(2)} intrinsic value ${isCall ? 'above' : 'below'} strike`
                                            : `$${dollarDiff.toFixed(2)} deficit ${isCall ? 'below' : 'above'} strike (0 intrinsic value)`)
                                        : (threat.isITM
                                            ? `Breached by $${dollarDiff.toFixed(2)} beyond strike`
                                            : `$${dollarDiff.toFixed(2)} buffer remaining before strike`)
                                    ) : (
                                      isLongOption
                                        ? (threat.isITM ? 'In The Money (Intrinsic value intact)' : 'Out of the Money (Expiring worthless risk)')
                                        : (threat.isITM ? 'Strike price has been breached' : 'Distance from active strike')
                                    )}
                                  </p>
                                </div>
                              ) : isLongOption ? (
                                <div>
                                  <span className={cn("font-mono font-black text-2xl", threat.isITM ? "text-emerald-300" : "text-rose-300")}>
                                    {threat.isITM ? 'ITM' : 'OTM'}
                                  </span>
                                  <p className={cn("text-[11px] font-medium mt-1", threat.isITM ? "text-emerald-400/90" : "text-rose-400/90")}>
                                    {threat.isITM ? 'In The Money (Winning Trade)' : 'Losing Trade (0 Intrinsic Value)'}
                                  </p>
                                </div>
                              ) : plPercent >= 70 ? (
                                <div>
                                  <span className="font-mono font-black text-2xl text-emerald-300">OTM</span>
                                  <p className="text-[11px] font-medium text-emerald-400/90 mt-1">High Decay Profit (&ge;70%)</p>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-mono font-black text-2xl text-slate-300">OTM</span>
                                  <p className="text-[11px] font-medium text-muted-foreground mt-1">Strike buffer intact</p>
                                </div>
                              )
                            ) : (
                              <div>
                                <div className="flex items-baseline gap-1.5">
                                  <span className={cn(
                                    "font-mono font-black text-2xl sm:text-3xl tracking-tight",
                                    pl < 0 ? "text-rose-300" : "text-emerald-300"
                                  )}>
                                    ${pos.currentPrice.toFixed(2)}
                                  </span>
                                </div>
                                <p className="text-[11px] font-medium text-muted-foreground mt-1">
                                  Avg Cost: ${pos.averageCost?.toFixed(2) || '0.00'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Visual Progress / Buffer Meter for Options */}
                        {isOption && threat.distancePct !== Infinity && (
                          <div className="mt-3 pt-2 border-t border-border/40">
                            <div className="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-border/50 relative">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-300",
                                  isLongOption
                                    ? (threat.isITM
                                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                                        : threat.distancePct <= 3.5
                                        ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                                        : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]")
                                    : (threat.isITM
                                        ? "w-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                                        : threat.distancePct <= 3.5
                                        ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                                        : threat.distancePct <= 8.0
                                        ? "bg-amber-400"
                                        : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]")
                                )}
                                style={{
                                  width: isLongOption
                                    ? (threat.isITM ? '100%' : `${Math.min(100, Math.max(15, threat.distancePct * 5))}%`)
                                    : (threat.isITM ? '100%' : `${Math.min(100, Math.max(10, threat.distancePct * 5))}%`)
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                              <span>
                                {isLongOption
                                  ? (threat.isITM ? 'Intrinsic Cushion' : 'Strike Deficit')
                                  : (threat.isITM ? 'Breach Depth' : '0% (At Strike)')}
                              </span>
                              <span>
                                {isLongOption
                                  ? (threat.isITM ? 'In The Money' : 'Expiring Worthless Risk')
                                  : (threat.isITM ? 'Assignment Danger' : 'Buffer Safety')}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* TILE 3: EXPIRATION & DTE (HERO HIGHLIGHT) */}
                      <div className={cn(
                        "rounded-2xl p-4 flex flex-col justify-between border transition-all shadow-md relative overflow-hidden",
                        !isOption
                          ? "bg-slate-900/80 border-slate-700/70"
                          : threat.daysToExpiry === 0
                          ? "bg-gradient-to-br from-rose-950/60 via-rose-900/40 to-slate-950 border-rose-500/70 shadow-[0_0_24px_rgba(244,63,94,0.3)] animate-pulse ring-1 ring-rose-500/40"
                          : threat.daysToExpiry !== null && threat.daysToExpiry <= 3
                          ? "bg-gradient-to-br from-rose-950/40 via-slate-900/40 to-slate-950 border-rose-500/50 shadow-[0_0_18px_rgba(244,63,94,0.18)]"
                          : threat.daysToExpiry !== null && threat.daysToExpiry <= 7
                          ? "bg-gradient-to-br from-amber-950/40 via-slate-900/40 to-slate-950 border-amber-500/50 shadow-[0_0_18px_rgba(245,158,11,0.18)]"
                          : threat.daysToExpiry !== null && threat.daysToExpiry <= 14
                          ? "bg-gradient-to-br from-amber-950/25 via-slate-900/40 to-slate-950 border-amber-500/35"
                          : "bg-gradient-to-br from-purple-950/30 via-slate-900/40 to-slate-950 border-purple-500/35"
                      )}>
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-purple-400" /> Expiration & DTE
                            </span>
                            {isOption && threat.daysToExpiry !== null && (
                              <Badge className={cn(
                                "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-sm",
                                threat.daysToExpiry === 0
                                  ? "bg-rose-600 text-white border-rose-400"
                                  : threat.daysToExpiry <= 3
                                  ? "bg-rose-500/30 text-rose-200 border-rose-500/50"
                                  : threat.daysToExpiry <= 7
                                  ? "bg-amber-500/30 text-amber-200 border-amber-500/50"
                                  : threat.daysToExpiry <= 14
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/35"
                                  : "bg-purple-500/20 text-purple-300 border-purple-500/35"
                              )}>
                                {threat.daysToExpiry === 0
                                  ? '🔥 0 DTE'
                                  : threat.daysToExpiry <= 3
                                  ? '⚡ CRITICAL GAMMA'
                                  : threat.daysToExpiry <= 7
                                  ? '⏳ HIGH GAMMA'
                                  : threat.daysToExpiry <= 14
                                  ? '📅 2-WEEK WARNING'
                                  : '📆 ACTIVE HORIZON'}
                              </Badge>
                            )}
                          </div>

                          {/* Big DTE Number */}
                          <div className="mt-1">
                            {threat.daysToExpiry !== null ? (
                              <div>
                                <div className="flex items-baseline gap-1.5">
                                  <span className={cn(
                                    "font-mono font-black text-2xl sm:text-3xl tracking-tight",
                                    threat.daysToExpiry === 0
                                      ? "text-rose-100"
                                      : threat.daysToExpiry <= 3
                                      ? "text-rose-300"
                                      : threat.daysToExpiry <= 7
                                      ? "text-amber-300"
                                      : threat.daysToExpiry <= 14
                                      ? "text-amber-200"
                                      : "text-purple-300"
                                  )}>
                                    {threat.daysToExpiry}
                                  </span>
                                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                    {threat.daysToExpiry === 1 ? 'Day Left' : 'Days to Expiry'}
                                  </span>
                                </div>

                                <p className="text-[11px] font-medium text-slate-300 mt-1">
                                  {threat.daysToExpiry === 0
                                    ? 'Expires today at market close'
                                    : formattedExpiry
                                    ? `Expiring on ${formattedExpiry}`
                                    : `${threat.daysToExpiry} calendar days remaining`}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <span className="font-mono font-black text-xl text-slate-300">
                                  {isOption ? 'EXPIRED' : 'PERPETUAL'}
                                </span>
                                <p className="text-[11px] font-medium text-muted-foreground mt-1">
                                  {isOption ? 'Position settlement pending' : 'Equity shares (No expiration)'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* DTE Time Horizon Meter */}
                        {isOption && threat.daysToExpiry !== null && (
                          <div className="mt-3 pt-2 border-t border-border/40">
                            <div className="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-border/50 relative">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-300",
                                  threat.daysToExpiry === 0
                                    ? "w-full bg-rose-600 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                                    : threat.daysToExpiry <= 3
                                    ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                                    : threat.daysToExpiry <= 7
                                    ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                                    : threat.daysToExpiry <= 14
                                    ? "bg-amber-400"
                                    : "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                                )}
                                style={{
                                  width: threat.daysToExpiry === 0
                                    ? '100%'
                                    : `${Math.min(100, Math.max(10, (1 - Math.min(threat.daysToExpiry, 45) / 45) * 100))}%`
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                              <span>Far Out (45d+)</span>
                              <span>Expiration Close</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* TILE 4: OPEN P&L & CAPITAL IMPACT (PRESERVES EXACT TEST ASSERTIONS) */}
                      <div className="bg-slate-900/80 hover:bg-slate-900 border border-slate-700/70 rounded-2xl p-4 flex flex-col justify-between transition-all shadow-md">
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <TrendingDown className={cn("w-3.5 h-3.5", pl < 0 ? "text-rose-400" : "text-emerald-400")} /> Open P&L
                            </span>
                            <Badge className={cn(
                              "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-sm",
                              pl >= 0
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            )}>
                              {pl >= 0 ? 'PROFIT' : 'DRAWDOWN'}
                            </Badge>
                          </div>

                          {/* Dollar & Percent P&L */}
                          <div className="mt-1">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className={cn(
                                "font-mono font-black text-2xl sm:text-3xl tracking-tight",
                                pl >= 0 ? "text-emerald-400" : "text-rose-400"
                              )}>
                                {pl >= 0 ? '+' : '-'}${Math.abs(pl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className={cn(
                                "text-xs font-mono font-black px-1.5 py-0.5 rounded-md",
                                pl >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                              )}>
                                ({plPercent >= 0 ? '+' : ''}{plPercent.toFixed(1)}%)
                              </span>
                            </div>

                            <p className="text-[11px] font-medium text-slate-300 mt-1">
                              Cost: ${pos.averageCost?.toFixed(2) || '0.00'} • Price: ${pos.currentPrice?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                        </div>

                        {/* Market Value Footer */}
                        <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-medium">Market Value:</span>
                          <span className="font-mono font-bold text-foreground">
                            ${Math.abs(pos.marketValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* Threat Driver Reason Callout Banner */}
                    <div className={cn(
                      "p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 shadow-sm transition-all",
                      threat.threatLevel === 'EXTREME'
                        ? "bg-rose-950/30 border-rose-500/40 text-rose-200"
                        : threat.threatLevel === 'HIGH'
                        ? "bg-amber-950/25 border-amber-500/35 text-amber-200"
                        : "bg-slate-900/60 border-border/60 text-slate-300"
                    )}>
                      <ShieldAlert className={cn(
                        "w-4 h-4 shrink-0",
                        threat.threatLevel === 'EXTREME' ? "text-rose-400" : "text-amber-400"
                      )} />
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[10px] uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded border border-white/10 text-slate-300">
                          Threat Drivers:
                        </span>
                        <span>{threat.threatReason}</span>
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
