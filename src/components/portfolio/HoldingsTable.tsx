
import { UnifiedPosition } from "./types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Box, Search, ArrowUpDown, ChevronUp, ChevronDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

interface HoldingsTableProps {
    positions: UnifiedPosition[];
    isLoading: boolean;
    onRefresh?: () => void;
    isPrivacyMode?: boolean;
}

type SortKey = 'symbol' | 'quantity' | 'marketValue' | 'dayChange' | 'unrealizedPL' | 'source' | 'assetType' | 'currentPrice' | 'expiry' | 'risky';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
    key: SortKey;
    direction: SortDirection;
}

export function HoldingsTable({ positions, isLoading, onRefresh, isPrivacyMode = false }: HoldingsTableProps) {
    // --- State ---
    const [searchQuery, setSearchQuery] = useState('');
    const [brokerFilter, setBrokerFilter] = useState<'All' | 'IBKR' | 'Tastytrade'>('All');
    const [typeFilter, setTypeFilter] = useState<'All' | 'Equity' | 'Options'>('All');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'marketValue', direction: 'desc' });

    // --- Filtering & Sorting Logic ---
    const filteredAndSortedPositions = useMemo(() => {
        let result = [...positions];

        // 1. Search Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p => p.symbol.toLowerCase().includes(query));
        }

        // 2. Broker Filter
        if (brokerFilter !== 'All') {
            result = result.filter(p => p.source === brokerFilter);
        }

        // 3. Type Filter
        if (typeFilter !== 'All') {
            if (typeFilter === 'Equity') {
                result = result.filter(p => p.assetType !== 'Option');
            } else {
                result = result.filter(p => p.assetType === 'Option');
            }
        }

        // 4. Sorting
        result.sort((a, b) => {
            if (sortConfig.key === 'risky') {
                const getExpiryTime = (p: UnifiedPosition) => {
                    if (!p.expiry) return Infinity;
                    let date = new Date(p.expiry);
                    if (/^\d{8}$/.test(p.expiry)) {
                        const y = p.expiry.substring(0, 4);
                        const m = p.expiry.substring(4, 6);
                        const day = p.expiry.substring(6, 8);
                        date = new Date(Number(y), Number(m) - 1, Number(day));
                    }
                    return isNaN(date.getTime()) ? Infinity : date.getTime();
                };

                const getDist = (p: UnifiedPosition) => {
                    if (!p.underlyingPrice || !p.strike) return Infinity;
                    return Math.abs((p.underlyingPrice - p.strike) / p.strike) * 100;
                };

                const getRiskScore = (p: UnifiedPosition) => {
                    let isITM = 1; // 1 means safe (OTM), 0 means risky (ITM)
                    if (p.assetType === 'Option' && p.underlyingPrice && p.strike) {
                        const isCall = p.optionType === 'Call' || p.optionType === 'C';
                        if (isCall) {
                            isITM = p.underlyingPrice > p.strike ? 0 : 1;
                        } else {
                            isITM = p.underlyingPrice < p.strike ? 0 : 1;
                        }
                    }

                    return {
                        isOption: p.assetType === 'Option' ? 0 : 1, // Options first
                        isShort: p.quantity < 0 ? 0 : 1, // Shorts first
                        isITM: isITM, // ITM first
                        expiry: getExpiryTime(p),
                        dist: getDist(p)
                    };
                };

                const scoreA = getRiskScore(a);
                const scoreB = getRiskScore(b);

                let comparison = 0;
                if (scoreA.isOption !== scoreB.isOption) {
                    comparison = scoreA.isOption - scoreB.isOption;
                } else if (scoreA.isShort !== scoreB.isShort) {
                    comparison = scoreA.isShort - scoreB.isShort;
                } else if (scoreA.isITM !== scoreB.isITM) {
                    comparison = scoreA.isITM - scoreB.isITM;
                } else if (scoreA.expiry !== scoreB.expiry) {
                    comparison = scoreA.expiry - scoreB.expiry;
                } else {
                    comparison = scoreA.dist - scoreB.dist;
                }

                return sortConfig.direction === 'desc' ? comparison : -comparison;
            }

            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            if (sortConfig.key === 'expiry') {
                const getExp = (p: UnifiedPosition) => {
                    if (!p.expiry) return Infinity;
                    let date = new Date(p.expiry);
                    if (/^\d{8}$/.test(p.expiry)) {
                        const y = p.expiry.substring(0, 4);
                        const m = p.expiry.substring(4, 6);
                        const day = p.expiry.substring(6, 8);
                        date = new Date(Number(y), Number(m) - 1, Number(day));
                    }
                    return isNaN(date.getTime()) ? Infinity : date.getTime();
                };
                aValue = getExp(a) as any;
                bValue = getExp(b) as any;
            }

            if (aValue === undefined || bValue === undefined) return 0;
            if (aValue === bValue) return 0;

            const comparison = aValue > bValue ? 1 : -1;
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [positions, searchQuery, brokerFilter, typeFilter, sortConfig]);

    // --- Handlers ---
    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 group-hover:opacity-50" />;
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="w-3 h-3 ml-1 text-cyan-400" />
            : <ChevronDown className="w-3 h-3 ml-1 text-cyan-400" />;
    };

    if (!isLoading && positions.length === 0) {
        return (
            <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center text-center opacity-80">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                    <Box className="w-12 h-12 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Portfolio Empty</h3>
                <p className="text-muted-foreground max-w-sm mb-6">
                    No active positions found in your connected brokerage accounts.
                </p>
                {onRefresh && (
                    <Button variant="outline" onClick={onRefresh}>
                        Refresh Data
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="glass-card rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-slate-800">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <h3 className="font-semibold text-foreground flex items-center gap-2 text-lg tracking-tight">
                        Active Holdings
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-xs border border-cyan-500/20">{filteredAndSortedPositions.length}</span>
                    </h3>

                    {/* Search Bar */}
                    <div className="relative group">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-cyan-400 transition-colors" />
                        <Input
                            placeholder="Search Ticker..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 w-[180px] bg-slate-800/50 border-slate-700/50 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 text-sm transition-all rounded-lg"
                        />
                    </div>
                </div>

                {/* Mission Control Filters */}
                <div className="flex items-center gap-3">
                    {/* Filter Icon for mobile mainly, but here for aesthetic */}
                    <Filter className="w-4 h-4 text-slate-500 hidden md:block" />

                    {/* Broker Filter */}
                    <div className="flex p-1 bg-slate-950/50 rounded-lg border border-white/5">
                        {(['All', 'IBKR', 'Tastytrade'] as const).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setBrokerFilter(filter)}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-md transition-all duration-300",
                                    brokerFilter === filter
                                        ? "bg-cyan-500/10 text-cyan-400 shadow-[0_0_10px_-2px_rgba(6,182,212,0.3)] border border-cyan-500/20"
                                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                )}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>

                    {/* Type Filter */}
                    <div className="flex p-1 bg-slate-950/50 rounded-lg border border-white/5">
                        {(['All', 'Equity', 'Options'] as const).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setTypeFilter(filter)}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-md transition-all duration-300",
                                    typeFilter === filter
                                        ? "bg-purple-500/10 text-purple-400 shadow-[0_0_10px_-2px_rgba(168,85,247,0.3)] border border-purple-500/20"
                                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                )}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSort('risky')}
                        className={cn(
                            "h-8 text-xs px-3 font-bold uppercase tracking-wider ml-1 shadow-[0_0_10px_-2px_rgba(244,63,94,0.3)] border transition-all",
                            sortConfig.key === 'risky'
                                ? "bg-rose-500 hover:bg-rose-600 border-rose-500 text-white"
                                : "text-rose-400 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20"
                        )}
                    >
                        Risky
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-950/30">
                        <TableRow className="hover:bg-transparent border-white/5">
                            <TableHead className="w-[120px] cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('symbol')}>
                                <div className="flex items-center">Symbol <SortIcon columnKey="symbol" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('expiry')}>
                                <div className="flex items-center">Expiry <SortIcon columnKey="expiry" /></div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('quantity')}>
                                <div className="flex items-center justify-end">Pos <SortIcon columnKey="quantity" /></div>
                            </TableHead>
                            <TableHead className="text-right">Und. Price</TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('risky')}>
                                <div className="flex items-center justify-end">Risk <SortIcon columnKey="risky" /></div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('currentPrice')}>
                                <div className="flex items-center justify-end">Mkt Price <SortIcon columnKey="currentPrice" /></div>
                            </TableHead>
                            <TableHead className="text-right md:table-cell hidden">
                                <div className="flex items-center justify-end">Avg Cost</div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('marketValue')}>
                                <div className="flex items-center justify-end">Value <SortIcon columnKey="marketValue" /></div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('dayChange')}>
                                <div className="flex items-center justify-end">Day P/L <SortIcon columnKey="dayChange" /></div>
                            </TableHead>
                            <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('unrealizedPL')}>
                                <div className="flex items-center justify-end">Open P/L <SortIcon columnKey="unrealizedPL" /></div>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            // Skeleton Loader
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i} className="border-white/5">
                                    <TableCell><div className="h-5 w-24 bg-slate-800/50 rounded animate-pulse" /></TableCell>
                                    <TableCell><div className="h-5 w-12 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                                    <TableCell><div className="h-5 w-12 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                                    <TableCell><div className="h-5 w-16 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                                    <TableCell><div className="h-5 w-16 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                                    <TableCell><div className="h-5 w-16 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                                    <TableCell><div className="h-5 w-20 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                                    <TableCell><div className="h-5 w-16 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                                    <TableCell><div className="h-5 w-16 bg-slate-800/50 rounded animate-pulse ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : (
                            filteredAndSortedPositions.map((pos) => (
                                <TableRow key={pos.id} className="group border-white/5 hover:bg-white/5 transition-colors data-[state=selected]:bg-white/10">
                                    {/* Symbol Column */}
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            {/* Icon Placeholder or actual Logo if available */}
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 flex items-center justify-center border border-indigo-500/20 font-bold text-xs text-indigo-300 group-hover:border-cyan-500/50 group-hover:shadow-[0_0_10px_-2px_rgba(6,182,212,0.3)] transition-all duration-300">
                                                {pos.symbol.substring(0, 1)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-200 text-sm tracking-wide group-hover:text-white transition-colors">
                                                        {(!pos.assetType || pos.assetType === 'Stock') ? pos.symbol : (
                                                            // Option Symbol (Hidden in Human Readable Mode, showing Underlying)
                                                            pos.symbol.match(/^[A-Z]+/)?.[0] || pos.symbol
                                                        )}
                                                    </span>
                                                    {/* Source Badge */}
                                                    <Badge variant="outline" className={cn(
                                                        "text-[9px] px-1 py-0 h-4 border-opacity-30",
                                                        pos.source === 'IBKR' ? "bg-orange-500/10 text-orange-400 border-orange-500" : "bg-red-500/10 text-red-400 border-red-500"
                                                    )}>
                                                        {pos.source}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5 max-w-[140px] truncate">
                                                    {pos.description || (pos.assetType === 'Option' ? 'Option Contract' : 'Equity Position')}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>

                                    {/* Expiry Column (New) */}
                                    <TableCell>
                                        {pos.assetType === 'Option' && pos.expiry ? (
                                            <div className="flex flex-col items-start gap-1">
                                                <div className="flex items-center gap-1.5">
                                                    {/* Date Badge */}
                                                    <span className="text-[10px] font-medium bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap">
                                                        {(() => {
                                                            let date: Date;
                                                            // Check for YYYYMMDD format (8 chars, all numbers)
                                                            if (/^\d{8}$/.test(pos.expiry)) {
                                                                const y = pos.expiry.substring(0, 4);
                                                                const m = pos.expiry.substring(4, 6);
                                                                const d = pos.expiry.substring(6, 8);
                                                                date = new Date(Number(y), Number(m) - 1, Number(d));
                                                            } else {
                                                                // Try standard parsing (ISO, etc.)
                                                                date = new Date(pos.expiry);
                                                            }

                                                            if (isNaN(date.getTime())) return 'Invalid Date';

                                                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
                                                        })()}
                                                    </span>

                                                    {/* DTE Badge */}
                                                    {(() => {
                                                        let expiryDate: Date;
                                                        if (/^\d{8}$/.test(pos.expiry)) {
                                                            const y = pos.expiry.substring(0, 4);
                                                            const m = pos.expiry.substring(4, 6);
                                                            const d = pos.expiry.substring(6, 8);
                                                            expiryDate = new Date(Number(y), Number(m) - 1, Number(d));
                                                        } else {
                                                            expiryDate = new Date(pos.expiry);
                                                        }

                                                        if (isNaN(expiryDate.getTime())) return null;

                                                        const today = new Date();
                                                        // Reset time to compare dates only
                                                        const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                                        const expiryNoTime = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());

                                                        const diffTime = expiryNoTime.getTime() - todayNoTime.getTime();
                                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                        const isUrgent = diffDays < 7;
                                                        return (
                                                            <span className={cn(
                                                                "text-[10px] font-medium px-1.5 py-0.5 rounded border border-opacity-20 whitespace-nowrap",
                                                                isUrgent
                                                                    ? "bg-amber-500/10 text-amber-400 border-amber-500"
                                                                    : "bg-blue-500/10 text-blue-400 border-blue-500"
                                                            )}>
                                                                {isUrgent && '⚠️ '}{diffDays}d
                                                            </span>
                                                        );
                                                    })()}
                                                </div>

                                                {/* Strike + Type Badge */}
                                                <span className={cn(
                                                    "text-[10px] font-bold px-1.5 py-0.5 rounded border border-opacity-20 flex items-center gap-1 w-fit",
                                                    (pos.optionType === 'Call' || pos.optionType === 'C')
                                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500"
                                                        : "bg-rose-500/10 text-rose-400 border-rose-500"
                                                )}>
                                                    {pos.strike ? `$${pos.strike}` : 'ATM'}
                                                    <span className="uppercase opacity-80">{(pos.optionType === 'Call' || pos.optionType === 'C') ? 'Call' : 'Put'}</span>
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">-</span>
                                        )}
                                    </TableCell>

                                    {/* Position */}
                                    <TableCell className="text-right font-mono text-sm">
                                        <div className={cn(pos.quantity > 0 ? "text-slate-200" : "text-rose-400")}>
                                            {pos.quantity > 0 ? '+' : ''}{pos.quantity}
                                        </div>
                                        {pos.assetType === 'Option' && (
                                            <div className="text-[10px] text-muted-foreground">x100</div>
                                        )}
                                    </TableCell>

                                    {/* Und Price */}
                                    <TableCell className="text-right font-mono tabular-nums">
                                        {pos.underlyingPrice ? (
                                            <span className="text-slate-300">${pos.underlyingPrice.toFixed(2)}</span>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>

                                    {/* Risk / Distance (Danger Zone) */}
                                    <TableCell className="text-right">
                                        {(() => {
                                            if (pos.assetType !== 'Option' || !pos.underlyingPrice || !pos.strike) return <span className="text-muted-foreground">-</span>;

                                            // Percentage difference from strike to stock price
                                            const distance = Math.abs((pos.underlyingPrice - pos.strike) / pos.strike) * 100;

                                            // ITM Logic:
                                            // Call is ITM if Underlying > Strike
                                            // Put is ITM if Underlying < Strike
                                            const isCall = pos.optionType === 'Call' || pos.optionType === 'C';
                                            const isITM = isCall ? (pos.underlyingPrice > pos.strike) : (pos.underlyingPrice < pos.strike);

                                            const isShort = pos.quantity < 0;

                                            // Danger Zone Logic: Short Position AND Distance < 10%
                                            const isDanger = isShort && distance < 10;

                                            // Coloring logic
                                            // Short: ITM = Risk (Red), OTM = Safe (Green)
                                            // Long: ITM = Profit (Green), OTM = Less Value (Zinc/Red)
                                            let colorClass = "";
                                            if (isShort) {
                                                colorClass = isITM ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
                                            } else {
                                                colorClass = isITM ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
                                            }

                                            return (
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <div className="flex items-center gap-1" title={isDanger ? "Warning: Short position within 10% of strike price. Assignment risk elevated." : undefined}>
                                                        {isDanger && <span className="text-amber-500 animate-pulse">⚠️</span>}
                                                        <span className={cn(
                                                            "text-xs font-medium px-1.5 py-0.5 rounded border",
                                                            colorClass
                                                        )}>
                                                            {distance.toFixed(1)}% {isITM ? 'ITM' : 'OTM'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </TableCell>

                                    {/* Market Price */}
                                    <TableCell className="text-right">
                                        <div className="font-mono text-sm text-slate-200">
                                            {pos.currentPrice > 0 ? `$${pos.currentPrice.toFixed(2)}` : <span className="text-muted-foreground">-</span>}
                                        </div>
                                    </TableCell>

                                    {/* Avg Cost */}
                                    <TableCell className="text-right md:table-cell hidden">
                                        <div className="font-mono text-sm text-muted-foreground">
                                            ${pos.averageCost.toFixed(2)}
                                        </div>
                                    </TableCell>

                                    {/* Market Value */}
                                    <TableCell className="text-right font-mono text-sm font-medium text-slate-100">
                                        <span className={cn(isPrivacyMode && "blur-sm select-none opacity-50")}>
                                            ${pos.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </span>
                                    </TableCell>

                                    {/* Daily P/L */}
                                    <TableCell className="text-right">
                                        {pos.currentPrice > 0 ? (
                                            <>
                                                <div className={cn("font-mono text-sm flex items-center justify-end gap-1", pos.dayChange >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                                    <span className={cn(isPrivacyMode && "blur-sm select-none opacity-50")}>
                                                        {pos.dayChange >= 0 ? '+' : ''}${Math.abs(pos.dayChange).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                                <div className={cn("text-[10px] text-right font-mono opacity-80", pos.dayChangePercent >= 0 ? "text-emerald-500/80" : "text-rose-500/80")}>
                                                    {pos.dayChangePercent >= 0 ? '+' : ''}{pos.dayChangePercent.toFixed(2)}%
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">-</span>
                                        )}
                                    </TableCell>

                                    {/* Total Open P/L */}
                                    <TableCell className="text-right">
                                        {pos.currentPrice > 0 ? (
                                            <>
                                                <div className={cn("font-mono text-sm font-bold flex items-center justify-end gap-1", pos.unrealizedPL >= 0 ? "text-purple-400" : "text-orange-400")}>
                                                    <span className={cn(isPrivacyMode && "blur-sm select-none opacity-50")}>
                                                        {pos.unrealizedPL >= 0 ? '+' : ''}${Math.abs(pos.unrealizedPL).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                                <div className={cn("text-[10px] text-right font-mono opacity-80", pos.unrealizedPLPercent >= 0 ? "text-purple-500/80" : "text-orange-500/80")}>
                                                    {pos.unrealizedPLPercent >= 0 ? '+' : ''}{pos.unrealizedPLPercent.toFixed(2)}%
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">-</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
