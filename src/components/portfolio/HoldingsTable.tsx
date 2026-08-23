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
import { 
    TrendingUp, 
    TrendingDown, 
    Box, 
    Search, 
    ArrowUpDown, 
    ChevronUp, 
    ChevronDown, 
    Filter, 
    FileText, 
    Sparkles, 
    ShieldAlert, 
    Layers, 
    CircleDollarSign, 
    Clock, 
    Calendar,
    Briefcase,
    Zap,
    Tag,
    X,
    Compass,
    ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { useStockNotesMap } from "@/services/noteService";
import { StockNoteModal } from "../StockNoteModal";
import { PositionAdvisorModal } from "./PositionAdvisorModal";
import { CriticalDefenseModal } from "./CriticalDefenseModal";
import { 
    InvestmentStyle, 
    STYLE_CONFIG, 
    getThemeBadgeStyle, 
    getCompanyStyleAndThemes 
} from "@/services/stockThematics";

interface HoldingsTableProps {
    positions: UnifiedPosition[];
    isLoading: boolean;
    onRefresh?: () => void;
    isPrivacyMode?: boolean;
    onNavigateToResearch?: (symbol: string) => void;
}

type SortKey = 
    | 'symbol' 
    | 'quantity' 
    | 'marketValue' 
    | 'dayChange' 
    | 'unrealizedPL' 
    | 'source' 
    | 'assetType' 
    | 'currentPrice' 
    | 'expiry' 
    | 'risky'
    | 'style'
    | 'theme';

type SortDirection = 'asc' | 'desc';
type ViewLayout = 'CATEGORIZED' | 'OPTIONS_ONLY' | 'EQUITIES_ONLY' | 'UNIFIED';

interface SortConfig {
    key: SortKey;
    direction: SortDirection;
}

export function HoldingsTable({ positions, isLoading, onRefresh, isPrivacyMode = false, onNavigateToResearch }: HoldingsTableProps) {
    // --- State ---
    const [searchQuery, setSearchQuery] = useState('');
    const [brokerFilter, setBrokerFilter] = useState<'All' | 'IBKR' | 'Tastytrade' | 'Trading 212'>('All');
    const [currencyFilter, setCurrencyFilter] = useState<'All' | 'USD' | 'CAD' | 'EUR' | 'GBP' | 'AUD'>('All');
    const [styleFilter, setStyleFilter] = useState<'All' | InvestmentStyle>('All');
    const [themeFilter, setThemeFilter] = useState<string>('All');
    const [sideFilter, setSideFilter] = useState<'All' | 'Long' | 'Short'>('All');
    const [viewLayout, setViewLayout] = useState<ViewLayout>('CATEGORIZED');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'marketValue', direction: 'desc' });

    const handleOpenResearch = (symbol: string) => {
        if (onNavigateToResearch) {
            onNavigateToResearch(symbol);
        } else {
            window.dispatchEvent(new CustomEvent('select-research-ticker', { detail: symbol }));
        }
    };

    // Stock Notes State
    const { notesMap } = useStockNotesMap();
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [noteModalStock, setNoteModalStock] = useState<{ symbol: string; name?: string; price?: number } | null>(null);

    // AI Position Defense Advisor State
    const [advisorPosition, setAdvisorPosition] = useState<UnifiedPosition | null>(null);
    const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);

    // Critical Defense Center Window State
    const [isDefenseCenterOpen, setIsDefenseCenterOpen] = useState(false);

    // Ensure all positions have style and themes
    const enrichedPositions = useMemo(() => {
        if (!positions || !Array.isArray(positions)) return [];
        return positions.map(pos => {
            if (pos.investmentStyle && pos.themes && pos.themes.length > 0) {
                return pos;
            }
            const info = getCompanyStyleAndThemes(pos.underlyingSymbol || pos.symbol, pos.description);
            return {
                ...pos,
                investmentStyle: pos.investmentStyle || info.style,
                themes: pos.themes && pos.themes.length > 0 ? pos.themes : info.themes,
                primaryTheme: pos.primaryTheme || info.primaryTheme,
            };
        });
    }, [positions]);

    // Critical Defense Count
    const criticalPositions = useMemo(() => {
        return enrichedPositions.filter(pos => {
            if (!pos) return false;
            const isOption = pos.assetType === 'Option';
            const isShort = (pos.quantity || 0) < 0;
            const isLosing = (pos.unrealizedPL || 0) < 0;
            
            let isITM = false;
            let distance = Infinity;
            if (isOption && pos.underlyingPrice && pos.strike) {
                distance = Math.abs((pos.underlyingPrice - pos.strike) / pos.strike) * 100;
                const isCall = pos.optionType === 'Call' || pos.optionType === 'C';
                isITM = isCall ? (pos.underlyingPrice > pos.strike) : (pos.underlyingPrice < pos.strike);
            }

            const unPLPct = pos.unrealizedPLPercent || 0;
            return (isShort && (isITM || distance < 8 || (isLosing && Math.abs(unPLPct) > 40))) || (isLosing && Math.abs(unPLPct) > 50);
        });
    }, [enrichedPositions]);

    // Available Themes & Counts across entire portfolio
    const themeStats = useMemo(() => {
        const counts: Record<string, number> = {};
        enrichedPositions.forEach(p => {
            p.themes?.forEach(t => {
                counts[t] = (counts[t] || 0) + 1;
            });
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));
    }, [enrichedPositions]);

    // Available Styles & Counts
    const styleStats = useMemo(() => {
        const counts: Record<string, { count: number; totalVal: number }> = {
            Growth: { count: 0, totalVal: 0 },
            Value: { count: 0, totalVal: 0 },
            Dividend: { count: 0, totalVal: 0 },
            Defensive: { count: 0, totalVal: 0 },
            Speculative: { count: 0, totalVal: 0 },
        };
        enrichedPositions.forEach(p => {
            const st = p.investmentStyle || 'Growth';
            if (counts[st]) {
                counts[st].count += 1;
                counts[st].totalVal += p.marketValue || 0;
            }
        });
        return counts;
    }, [enrichedPositions]);

    // Available Long & Short Counts
    const sideStats = useMemo(() => {
        let long = 0;
        let short = 0;
        enrichedPositions.forEach(p => {
            if ((p.quantity || 0) > 0) long += 1;
            else if ((p.quantity || 0) < 0) short += 1;
        });
        return { long, short };
    }, [enrichedPositions]);

    // --- Helper to parse expiration date ---
    const parseExpiryDate = (expiryStr?: string): Date | null => {
        if (!expiryStr) return null;
        if (/^\d{8}$/.test(expiryStr)) {
            const y = expiryStr.substring(0, 4);
            const m = expiryStr.substring(4, 6);
            const d = expiryStr.substring(6, 8);
            const date = new Date(Number(y), Number(m) - 1, Number(d));
            return isNaN(date.getTime()) ? null : date;
        }
        const d = new Date(expiryStr);
        return isNaN(d.getTime()) ? null : d;
    };

    // --- Helper to calculate Days to Expiry (DTE) ---
    const getDTE = (expiryStr?: string): number | null => {
        const date = parseExpiryDate(expiryStr);
        if (!date) return null;
        const diffTime = date.getTime() - new Date().getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // --- Sorting Logic ---
    const sortPositions = (list: UnifiedPosition[]) => {
        if (!list || !Array.isArray(list)) return [];
        return [...list].sort((a, b) => {
            if (!a || !b) return 0;
            if (sortConfig.key === 'risky') {
                const getRiskScore = (p: UnifiedPosition) => {
                    let isITM = 1;
                    if (p.assetType === 'Option' && p.underlyingPrice && p.strike) {
                        const isCall = p.optionType === 'Call' || p.optionType === 'C';
                        isITM = isCall ? (p.underlyingPrice > p.strike ? 2 : 0) : (p.underlyingPrice < p.strike ? 2 : 0);
                    }
                    const dte = getDTE(p.expiry) ?? 999;
                    const dteRisk = dte <= 7 ? 3 : dte <= 14 ? 2 : dte <= 30 ? 1 : 0;
                    const unPLPct = p.unrealizedPLPercent || 0;
                    const plRisk = unPLPct < -50 ? 3 : unPLPct < -20 ? 2 : 0;
                    return isITM + dteRisk + plRisk;
                };

                return sortConfig.direction === 'asc' 
                    ? getRiskScore(a) - getRiskScore(b) 
                    : getRiskScore(b) - getRiskScore(a);
            }

            if (sortConfig.key === 'style') {
                const stA = a.investmentStyle || '';
                const stB = b.investmentStyle || '';
                return sortConfig.direction === 'asc' ? stA.localeCompare(stB) : stB.localeCompare(stA);
            }

            if (sortConfig.key === 'theme') {
                const thA = a.primaryTheme || '';
                const thB = b.primaryTheme || '';
                return sortConfig.direction === 'asc' ? thA.localeCompare(thB) : thB.localeCompare(thA);
            }

            let aValue: any = a[sortConfig.key as keyof UnifiedPosition];
            let bValue: any = b[sortConfig.key as keyof UnifiedPosition];

            if (sortConfig.key === 'dayChange') {
                aValue = a.dayChangePercent ?? a.dayChange ?? 0;
                bValue = b.dayChangePercent ?? b.dayChange ?? 0;
            }

            if (sortConfig.key === 'unrealizedPL') {
                aValue = a.unrealizedPLPercent ?? a.unrealizedPL ?? 0;
                bValue = b.unrealizedPLPercent ?? b.unrealizedPL ?? 0;
            }

            if (sortConfig.key === 'expiry') {
                const expA = parseExpiryDate(a.expiry)?.getTime() ?? Infinity;
                const expB = parseExpiryDate(b.expiry)?.getTime() ?? Infinity;
                aValue = expA;
                bValue = expB;
            }

            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = (bValue || '').toLowerCase();
            }

            if (aValue === undefined || bValue === undefined) return 0;
            if (aValue === bValue) return 0;

            const comparison = aValue > bValue ? 1 : -1;
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    };

    // --- Filtering Logic ---
    const filteredPositions = useMemo(() => {
        let result = [...enrichedPositions];

        // 1. Search Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p => 
                p && (
                    (p.symbol && p.symbol.toLowerCase().includes(query)) || 
                    (p.description && p.description.toLowerCase().includes(query)) ||
                    (p.underlyingSymbol && p.underlyingSymbol.toLowerCase().includes(query)) ||
                    (p.investmentStyle && p.investmentStyle.toLowerCase().includes(query)) ||
                    (p.themes && p.themes.some(t => t.toLowerCase().includes(query)))
                )
            );
        }

        // 2. Broker Filter
        if (brokerFilter !== 'All') {
            result = result.filter(p => p && p.source === brokerFilter);
        }

        // 3. Currency Filter
        if (currencyFilter !== 'All') {
            result = result.filter(p => p && (p.currency || 'USD').toUpperCase() === currencyFilter);
        }

        // 4. Style Filter (Value, Growth, Dividend, etc.)
        if (styleFilter !== 'All') {
            result = result.filter(p => p && p.investmentStyle === styleFilter);
        }

        // 5. Theme Filter
        if (themeFilter !== 'All') {
            result = result.filter(p => p && (p.themes?.includes(themeFilter) || p.primaryTheme === themeFilter));
        }

        // 6. Side Filter (Long vs Short)
        if (sideFilter === 'Long') {
            result = result.filter(p => p && (p.quantity || 0) > 0);
        } else if (sideFilter === 'Short') {
            result = result.filter(p => p && (p.quantity || 0) < 0);
        }

        return result;
    }, [enrichedPositions, searchQuery, brokerFilter, currencyFilter, styleFilter, themeFilter, sideFilter]);

    // Split positions into Options and Equities
    const optionsPositions = useMemo(() => {
        return sortPositions(filteredPositions.filter(p => p.assetType === 'Option'));
    }, [filteredPositions, sortConfig]);

    const equitiesPositions = useMemo(() => {
        return sortPositions(filteredPositions.filter(p => p.assetType !== 'Option'));
    }, [filteredPositions, sortConfig]);

    const allSortedPositions = useMemo(() => {
        return sortPositions(filteredPositions);
    }, [filteredPositions, sortConfig]);

    // --- Metrics for Options Section ---
    const optionsMetrics = useMemo(() => {
        const totalValue = optionsPositions.reduce((sum, p) => sum + p.marketValue, 0);
        const totalUnrealizedPL = optionsPositions.reduce((sum, p) => sum + p.unrealizedPL, 0);
        const totalDayPL = optionsPositions.reduce((sum, p) => sum + p.dayChange, 0);
        const shortCount = optionsPositions.filter(p => p.quantity < 0).length;
        const longCount = optionsPositions.filter(p => p.quantity > 0).length;
        const nearExpiryCount = optionsPositions.filter(p => {
            const dte = getDTE(p.expiry);
            return dte !== null && dte <= 14;
        }).length;
        const itmCount = optionsPositions.filter(p => {
            if (!p.underlyingPrice || !p.strike) return false;
            const isCall = p.optionType === 'Call' || p.optionType === 'C';
            return isCall ? (p.underlyingPrice > p.strike) : (p.underlyingPrice < p.strike);
        }).length;

        return { totalValue, totalUnrealizedPL, totalDayPL, shortCount, longCount, nearExpiryCount, itmCount };
    }, [optionsPositions]);

    // --- Metrics for Equities Section ---
    const equitiesMetrics = useMemo(() => {
        const totalValue = equitiesPositions.reduce((sum, p) => sum + p.marketValue, 0);
        const totalUnrealizedPL = equitiesPositions.reduce((sum, p) => sum + p.unrealizedPL, 0);
        const totalDayPL = equitiesPositions.reduce((sum, p) => sum + p.dayChange, 0);
        return { totalValue, totalUnrealizedPL, totalDayPL };
    }, [equitiesPositions]);

    // --- Handlers ---
    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 group-hover:opacity-50 inline" />;
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="w-3 h-3 ml-1 text-cyan-400 inline" />
            : <ChevronDown className="w-3 h-3 ml-1 text-cyan-400 inline" />;
    };

    if (!isLoading && enrichedPositions.length === 0) {
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

    // --- Helper to format prices by currency ---
    const formatCurrencyPrice = (price: number, currency?: string) => {
        if (price === undefined || price === null || isNaN(price) || price === 0) return '-';
        const curr = (currency || 'USD').toUpperCase();
        if (curr === 'EUR') return `€${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (curr === 'GBP') return `£${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (curr === 'GBX') return `${price.toFixed(1)}p`;
        if (curr === 'CAD') return `C$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (curr === 'JPY') return `¥${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        if (curr === 'CHF') return `CHF ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatCurrencyValue = (val: number, currency?: string) => {
        if (val === undefined || val === null || isNaN(val)) return '$0.00';
        const curr = (currency || 'USD').toUpperCase();
        const absVal = Math.abs(val);
        const sign = val < 0 ? '-' : '';
        if (curr === 'EUR') return `${sign}€${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (curr === 'GBP') return `${sign}£${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (curr === 'CAD') return `${sign}C$${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (curr === 'JPY') return `${sign}¥${absVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
        if (curr === 'CHF') return `${sign}CHF ${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        return `${sign}$${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // --- Render Position Row ---
    const renderPositionRow = (pos: UnifiedPosition, isOptionView: boolean = false) => {
        const baseSymbol = pos.underlyingSymbol || (pos.assetType === 'Option' ? pos.symbol.match(/^[A-Z0-9.\-]+/)?.[0] : pos.symbol) || pos.symbol;
        const cleanBaseSymbol = baseSymbol.trim().toUpperCase();
        const stockNote = notesMap[cleanBaseSymbol];
        const isOption = pos.assetType === 'Option';
        const dte = getDTE(pos.expiry);

        // Distance & Moneyness
        let distance = Infinity;
        let isITM = false;
        if (isOption && pos.underlyingPrice && pos.strike) {
            distance = Math.abs((pos.underlyingPrice - pos.strike) / pos.strike) * 100;
            const isCall = pos.optionType === 'Call' || pos.optionType === 'C';
            isITM = isCall ? (pos.underlyingPrice > pos.strike) : (pos.underlyingPrice < pos.strike);
        }

        const isShort = pos.quantity < 0;
        const isLosing = pos.unrealizedPL < 0;
        const isCritical = (isShort && (isITM || distance < 8 || (isLosing && Math.abs(pos.unrealizedPLPercent) > 40))) || (isLosing && Math.abs(pos.unrealizedPLPercent) > 50);

        const styleConfig = STYLE_CONFIG[pos.investmentStyle || 'Growth'] || STYLE_CONFIG.Growth;

        return (
            <TableRow 
                key={pos.id} 
                onClick={() => handleOpenResearch(cleanBaseSymbol)}
                className="group border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
            >
                {/* Symbol, Style & Thematic Badges */}
                <TableCell>
                    <div className="flex items-start gap-3">
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center border font-bold text-xs shrink-0 transition-all mt-0.5",
                            isOption 
                                ? "bg-purple-500/10 border-purple-500/20 text-purple-300 group-hover:border-purple-500/50" 
                                : "bg-cyan-500/10 border-cyan-500/20 text-cyan-300 group-hover:border-cyan-500/50"
                        )}>
                            {cleanBaseSymbol.substring(0, 2)}
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenResearch(cleanBaseSymbol);
                                    }}
                                    className="font-bold text-slate-200 text-sm tracking-wide hover:text-cyan-300 transition-colors flex items-center gap-1 group-hover:text-cyan-300 cursor-pointer"
                                    title={`Click to open ${cleanBaseSymbol} in Research Dossier`}
                                >
                                    <span>{cleanBaseSymbol}</span>
                                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-cyan-400 transition-opacity" />
                                </button>
                                
                                {/* Investment Style Badge (Value, Growth, Dividend, etc.) */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setStyleFilter(pos.investmentStyle === styleFilter ? 'All' : (pos.investmentStyle || 'Growth'));
                                    }}
                                    className={cn(
                                        "text-[9px] px-1.5 py-0 h-4 rounded font-bold border flex items-center gap-1 transition-all cursor-pointer",
                                        styleConfig.badgeClass
                                    )}
                                    title={`Click to filter by ${pos.investmentStyle || 'Growth'} style`}
                                >
                                    <span className={cn("w-1 h-1 rounded-full", styleConfig.dotColor)} />
                                    {pos.investmentStyle || 'Growth'}
                                </button>

                                {/* Broker Badge */}
                                <Badge variant="outline" className={cn(
                                    "text-[9px] px-1.5 py-0 h-4 border-opacity-30",
                                    pos.source === 'IBKR' ? "bg-orange-500/10 text-orange-400 border-orange-500" :
                                    pos.source === 'Trading 212' ? "bg-blue-500/10 text-blue-400 border-blue-500" :
                                    "bg-red-500/10 text-red-400 border-red-500"
                                )}>
                                    {pos.source}
                                </Badge>

                                {/* Foreign Currency Indicator */}
                                {pos.currency && pos.currency !== 'USD' && (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono font-bold" title={`Quoted in ${pos.currency}`}>
                                        {pos.currency}
                                    </Badge>
                                )}

                                {/* Sentiment Note Pill */}
                                {stockNote && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setNoteModalStock({
                                                symbol: cleanBaseSymbol,
                                                name: pos.description || `${cleanBaseSymbol} Position`,
                                                price: pos.underlyingPrice || pos.currentPrice,
                                            });
                                            setIsNoteModalOpen(true);
                                        }}
                                        className={cn(
                                            "text-[9px] px-1.5 py-0 h-4 rounded border flex items-center gap-1 transition-all cursor-pointer",
                                            stockNote.sentiment === 'BULLISH'
                                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                                                : stockNote.sentiment === 'BEARISH'
                                                ? "bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25"
                                                : "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25"
                                        )}
                                        title={`Notes on ${cleanBaseSymbol}: ${stockNote.content.slice(0, 100)}...`}
                                    >
                                        <FileText className="w-2.5 h-2.5" />
                                        {stockNote.sentiment || 'Notes'}
                                    </button>
                                )}
                            </div>

                            {/* Thematic Exposure Badges (Clickable) */}
                            {pos.themes && pos.themes.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                    {pos.themes.slice(0, 2).map((t) => {
                                        const themeStyle = getThemeBadgeStyle(t);
                                        return (
                                            <button
                                                key={t}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setThemeFilter(themeFilter === t ? 'All' : t);
                                                }}
                                                className={cn(
                                                    "text-[8.5px] px-1.5 py-0 h-3.5 rounded-full border flex items-center gap-0.5 transition-all cursor-pointer font-medium hover:scale-105",
                                                    themeStyle.badgeClass,
                                                    themeFilter === t && "ring-1 ring-white/60 font-bold"
                                                )}
                                                title={`Click to filter portfolio by theme: ${t}`}
                                            >
                                                <span>{themeStyle.icon}</span>
                                                <span className="truncate max-w-[90px]">{t}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="text-[11px] text-muted-foreground/80 max-w-[170px] truncate">
                                {pos.description || (isOption ? 'Option Contract' : 'Equity Position')}
                            </div>
                        </div>
                    </div>
                </TableCell>

                {/* Expiry & DTE Column */}
                <TableCell>
                    {isOption && pos.expiry ? (
                        <div className="flex flex-col items-start gap-1">
                            <span className="text-[10px] font-medium bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap">
                                {pos.expiry}
                            </span>
                            {dte !== null && (
                                <Badge variant="outline" className={cn(
                                    "text-[9px] px-1 py-0 h-3.5 border-opacity-40 font-mono",
                                    dte <= 3 ? "bg-rose-500/20 text-rose-300 border-rose-500" :
                                    dte <= 14 ? "bg-amber-500/20 text-amber-300 border-amber-500" :
                                    "bg-purple-500/10 text-purple-300 border-purple-500"
                                )}>
                                    <Clock className="w-2 h-2 mr-0.5 inline" /> {dte}d DTE
                                </Badge>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 border-white/10 text-muted-foreground", styleConfig.badgeClass)}>
                                {pos.investmentStyle || 'Equity'}
                            </Badge>
                        </div>
                    )}
                </TableCell>

                {/* Position / Quantity */}
                <TableCell className="text-right">
                    <div className={cn("font-mono text-sm font-semibold", isShort ? "text-rose-400" : "text-emerald-400")}>
                        {pos.quantity > 0 ? `+${pos.quantity}` : pos.quantity}
                        {isOption && <span className="text-[10px] text-muted-foreground ml-0.5">x100</span>}
                    </div>
                </TableCell>

                {/* Strike & Option Type / Distance */}
                <TableCell className="text-right">
                    {isOption && pos.strike ? (
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-foreground">
                                    ${pos.strike}
                                </span>
                                <Badge className={cn(
                                    "text-[9px] px-1.5 py-0 font-bold",
                                    (pos.optionType === 'Call' || pos.optionType === 'C')
                                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                        : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                )}>
                                    {(pos.optionType === 'Call' || pos.optionType === 'C') ? 'C' : 'P'}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                                {isITM ? (
                                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[8px] px-1 py-0 h-3 font-bold">ITM</Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700 text-[8px] px-1 py-0 h-3 font-medium">OTM</Badge>
                                )}
                                <span className="text-[10px] font-mono text-muted-foreground">{distance.toFixed(1)}%</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-right">
                            <span className="text-xs font-mono text-muted-foreground">Equity</span>
                        </div>
                    )}
                </TableCell>

                {/* Underlying / Live Stock Price */}
                <TableCell className="text-right">
                    {pos.underlyingPrice || pos.currentPrice ? (
                        <div className="font-mono text-xs font-bold text-foreground">
                            {formatCurrencyPrice(pos.underlyingPrice || pos.currentPrice, pos.currency)}
                        </div>
                    ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                    )}
                </TableCell>

                {/* Current Market Price */}
                <TableCell className="text-right">
                    <div className="font-mono text-xs font-bold text-foreground">
                        {formatCurrencyPrice(pos.currentPrice, pos.currency)}
                    </div>
                </TableCell>

                {/* Average Cost */}
                <TableCell className="text-right md:table-cell hidden">
                    <div className="font-mono text-xs text-muted-foreground">
                        {formatCurrencyPrice(pos.averageCost, pos.currency)}
                    </div>
                </TableCell>

                {/* Market Value */}
                <TableCell className="text-right">
                    <div className="font-mono text-sm font-bold text-foreground">
                        <span className={cn(isPrivacyMode && "blur-sm select-none opacity-50")}>
                            {formatCurrencyValue(pos.marketValue, pos.currency)}
                        </span>
                    </div>
                </TableCell>

                {/* Day P/L */}
                <TableCell className="text-right">
                    {pos.dayChange !== undefined && pos.dayChange !== 0 ? (
                        <>
                            <div className={cn("font-mono text-xs font-bold flex items-center justify-end gap-0.5", pos.dayChange >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                <span className={cn(isPrivacyMode && "blur-sm select-none opacity-50")}>
                                    {pos.dayChange >= 0 ? '+' : ''}{formatCurrencyValue(pos.dayChange, pos.currency)}
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

                {/* Open P/L */}
                <TableCell className="text-right">
                    {pos.currentPrice > 0 ? (
                        <>
                            <div className={cn("font-mono text-sm font-bold flex items-center justify-end gap-1", pos.unrealizedPL >= 0 ? "text-purple-400" : "text-rose-400")}>
                                <span className={cn(isPrivacyMode && "blur-sm select-none opacity-50")}>
                                    {pos.unrealizedPL >= 0 ? '+' : ''}{formatCurrencyValue(pos.unrealizedPL, pos.currency)}
                                </span>
                            </div>
                            <div className={cn("text-[10px] text-right font-mono opacity-80", pos.unrealizedPLPercent >= 0 ? "text-purple-500/80" : "text-rose-500/80")}>
                                {pos.unrealizedPLPercent >= 0 ? '+' : ''}{pos.unrealizedPLPercent.toFixed(2)}%
                            </div>
                        </>
                    ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                    )}
                </TableCell>

                {/* AI Advisor Column */}
                <TableCell className="text-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            setAdvisorPosition(pos);
                            setIsAdvisorOpen(true);
                        }}
                        className={cn(
                            "h-7 px-2 text-[10px] font-bold gap-1 rounded-lg transition-colors",
                            isCritical
                                ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 shadow-sm"
                                : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        )}
                        title={isCritical ? "Critical position risk! Click for AI defense & management plan" : "AI Agent Position Review"}
                    >
                        {isCritical ? (
                            <>
                                <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                                <span>Defend</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                                <span>Review</span>
                            </>
                        )}
                    </Button>
                </TableCell>

                {/* Notes Column */}
                <TableCell className="text-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-7 w-7 rounded-lg transition-all",
                            stockNote
                                ? stockNote.sentiment === 'BULLISH'
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                    : stockNote.sentiment === 'BEARISH'
                                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.2)]"
                                    : "bg-primary/20 text-primary border border-primary/30 shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                                : "text-muted-foreground/50 hover:text-foreground hover:bg-white/10 opacity-60 hover:opacity-100"
                        )}
                        onClick={() => {
                            setNoteModalStock({
                                symbol: cleanBaseSymbol,
                                name: pos.description || `${cleanBaseSymbol} Holding`,
                                price: pos.underlyingPrice || pos.currentPrice,
                            });
                            setIsNoteModalOpen(true);
                        }}
                    >
                        <FileText className="w-3.5 h-3.5" />
                    </Button>
                </TableCell>
            </TableRow>
        );
    };

    return (
        <div className="space-y-4">
            
            {/* ================= STYLE & THEMATIC COMMAND RIBBON ================= */}
            <div className="glass-card rounded-2xl p-3.5 border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-xl space-y-3">
                {/* Investment Styles Row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2.5 border-b border-white/5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mr-1">
                            <Compass className="w-3.5 h-3.5 text-cyan-400" />
                            Investment Style:
                        </span>
                        <button
                            onClick={() => setStyleFilter('All')}
                            className={cn(
                                "px-3 py-1 text-xs font-semibold rounded-lg transition-all border",
                                styleFilter === 'All'
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                    : "bg-slate-950/60 text-muted-foreground border-white/5 hover:text-foreground"
                            )}
                        >
                            All ({enrichedPositions.length})
                        </button>
                        {(['Growth', 'Value', 'Dividend', 'Defensive', 'Speculative'] as const).map((styleKey) => {
                            const config = STYLE_CONFIG[styleKey];
                            const stats = styleStats[styleKey] || { count: 0, totalVal: 0 };
                            return (
                                <button
                                    key={styleKey}
                                    onClick={() => setStyleFilter(styleFilter === styleKey ? 'All' : styleKey)}
                                    className={cn(
                                        "px-2.5 py-1 text-xs font-semibold rounded-lg transition-all border flex items-center gap-1.5",
                                        styleFilter === styleKey
                                            ? cn(config.badgeClass, "ring-1 ring-white/60 font-bold shadow")
                                            : "bg-slate-950/50 text-muted-foreground border-white/5 hover:text-foreground"
                                    )}
                                >
                                    <span className={cn("w-1.5 h-1.5 rounded-full", config.dotColor)} />
                                    <span>{config.label}</span>
                                    <span className="font-mono text-[10px] opacity-70">({stats.count})</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Quick Thematic Filter Reset / Indicator */}
                    {themeFilter !== 'All' && (
                        <div className="flex items-center gap-2">
                            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-xs font-semibold gap-1 pl-2 pr-1 py-0.5">
                                <span>Theme: <strong>{themeFilter}</strong> ({filteredPositions.length})</span>
                                <button onClick={() => setThemeFilter('All')} className="p-0.5 hover:bg-cyan-500/30 rounded-full">
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        </div>
                    )}
                </div>

                {/* Thematic Badges Strip */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap flex items-center gap-1 mr-1">
                        <Tag className="w-3 h-3 text-purple-400" />
                        Themes:
                    </span>
                    {themeStats.slice(0, 12).map(({ name, count }) => {
                        const style = getThemeBadgeStyle(name);
                        const isSelected = themeFilter === name;
                        return (
                            <button
                                key={name}
                                onClick={() => setThemeFilter(isSelected ? 'All' : name)}
                                className={cn(
                                    "px-2 py-0.5 text-[11px] font-medium rounded-full border transition-all shrink-0 flex items-center gap-1",
                                    isSelected
                                        ? cn(style.badgeClass, "ring-1 ring-white/80 font-bold shadow-sm")
                                        : "bg-slate-950/40 text-muted-foreground border-white/5 hover:bg-white/5 hover:text-foreground"
                                )}
                            >
                                <span>{style.icon}</span>
                                <span>{name}</span>
                                <span className="font-mono text-[9px] opacity-60">({count})</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Mission Control Navigation & Filters Bar */}
            <div className="glass-card rounded-2xl p-4 border border-white/5 bg-slate-900/40 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Search Bar & View Mode */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative group">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-cyan-400 transition-colors" />
                        <Input
                            placeholder="Search Ticker, Style or Theme..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 w-[220px] bg-slate-800/50 border-slate-700/50 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 text-sm transition-all rounded-xl"
                        />
                    </div>

                    {/* View Layout Tabs */}
                    <div className="flex p-1 bg-slate-950/60 rounded-xl border border-white/5">
                        <button
                            onClick={() => setViewLayout('CATEGORIZED')}
                            className={cn(
                                "px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
                                viewLayout === 'CATEGORIZED'
                                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Layers className="w-3.5 h-3.5" /> Categorized
                        </button>
                        <button
                            onClick={() => setViewLayout('OPTIONS_ONLY')}
                            className={cn(
                                "px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
                                viewLayout === 'OPTIONS_ONLY'
                                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Options ({optionsPositions.length})
                        </button>
                        <button
                            onClick={() => setViewLayout('EQUITIES_ONLY')}
                            className={cn(
                                "px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
                                viewLayout === 'EQUITIES_ONLY'
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Equities ({equitiesPositions.length})
                        </button>
                        <button
                            onClick={() => setViewLayout('UNIFIED')}
                            className={cn(
                                "px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
                                viewLayout === 'UNIFIED'
                                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Unified ({filteredPositions.length})
                        </button>
                    </div>
                </div>

                {/* Broker, Currency & Side Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                    
                    {/* Position Side (Long / Short) Selector */}
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Side:</span>
                        <div className="flex p-0.5 bg-slate-950/60 rounded-lg border border-white/5">
                            <button
                                onClick={() => setSideFilter('All')}
                                className={cn(
                                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                    sideFilter === 'All'
                                        ? "bg-white/15 text-foreground font-bold shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                All ({enrichedPositions.length})
                            </button>
                            <button
                                onClick={() => setSideFilter('Long')}
                                className={cn(
                                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1",
                                    sideFilter === 'Long'
                                        ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm"
                                        : "text-muted-foreground hover:text-emerald-400"
                                )}
                                title="Show Long positions (Quantity > 0)"
                            >
                                <TrendingUp className="w-3 h-3 text-emerald-400" />
                                <span>Long</span>
                                <span className="font-mono text-[10px] opacity-75">({sideStats.long})</span>
                            </button>
                            <button
                                onClick={() => setSideFilter('Short')}
                                className={cn(
                                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1",
                                    sideFilter === 'Short'
                                        ? "bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 shadow-sm"
                                        : "text-muted-foreground hover:text-rose-400"
                                )}
                                title="Show Short positions (Quantity < 0)"
                            >
                                <TrendingDown className="w-3 h-3 text-rose-400" />
                                <span>Short</span>
                                <span className="font-mono text-[10px] opacity-75">({sideStats.short})</span>
                            </button>
                        </div>
                    </div>

                    {/* Broker Selector */}
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Broker:</span>
                        <div className="flex p-0.5 bg-slate-950/60 rounded-lg border border-white/5">
                            {(['All', 'IBKR', 'Tastytrade', 'Trading 212'] as const).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setBrokerFilter(filter)}
                                    className={cn(
                                        "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                                        brokerFilter === filter
                                            ? "bg-white/15 text-foreground font-bold shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Currency Selector */}
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Currency:</span>
                        <div className="flex p-0.5 bg-slate-950/60 rounded-lg border border-white/5">
                            {(['All', 'USD', 'CAD', 'EUR', 'GBP', 'AUD'] as const).map((curr) => (
                                <button
                                    key={curr}
                                    onClick={() => setCurrencyFilter(curr)}
                                    className={cn(
                                        "px-2 py-1 text-xs font-medium rounded-md transition-all",
                                        currencyFilter === curr
                                            ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {curr}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Critical Positions Defense Button */}
                    {criticalPositions.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsDefenseCenterOpen(true)}
                            className="h-8 text-xs px-3 font-bold gap-1.5 bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25 shadow-sm transition-colors"
                        >
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                            <span>{criticalPositions.length} Critical Defense</span>
                        </Button>
                    )}

                    {/* Risky Fast Filter */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSort('risky')}
                        className={cn(
                            "h-8 text-xs px-3 font-bold uppercase tracking-wider shadow-sm border transition-all",
                            sortConfig.key === 'risky'
                                ? "bg-rose-500 hover:bg-rose-600 border-rose-500 text-white"
                                : "text-rose-400 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20"
                        )}
                    >
                        Risky
                    </Button>
                </div>
            </div>

            {/* ================= OPTIONS SECTION ================= */}
            {(viewLayout === 'CATEGORIZED' || viewLayout === 'OPTIONS_ONLY') && (
                <div className="glass-card rounded-2xl overflow-hidden border border-purple-500/30 shadow-2xl bg-slate-950/40">
                    
                    {/* Options Section Header */}
                    <div className="p-5 border-b border-purple-500/20 bg-gradient-to-r from-purple-950/30 via-slate-900/40 to-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300">
                                    <Layers className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-bold text-foreground tracking-tight">
                                            Options & Derivatives
                                        </h3>
                                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 font-mono text-xs">
                                            {optionsPositions.length} Contracts
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Short & long option contracts, strike moneyness, and expiration management
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Options KPIs */}
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="px-3 py-1.5 rounded-xl bg-card/60 border border-border/40 font-mono">
                                <span className="text-[10px] text-muted-foreground block uppercase font-bold">Options Value</span>
                                <span className="text-sm font-black text-foreground">
                                    ${optionsMetrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="px-3 py-1.5 rounded-xl bg-card/60 border border-border/40 font-mono">
                                <span className="text-[10px] text-muted-foreground block uppercase font-bold">Options Open P&L</span>
                                <span className={cn("text-sm font-black", optionsMetrics.totalUnrealizedPL >= 0 ? "text-purple-400" : "text-rose-400")}>
                                    {optionsMetrics.totalUnrealizedPL >= 0 ? '+' : ''}${optionsMetrics.totalUnrealizedPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="px-3 py-1.5 rounded-xl bg-card/60 border border-border/40 font-mono">
                                <span className="text-[10px] text-muted-foreground block uppercase font-bold">Expiring &le; 14d</span>
                                <span className="text-sm font-black text-amber-400">
                                    {optionsMetrics.nearExpiryCount} Contracts
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Options Table */}
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-950/50">
                                <TableRow className="hover:bg-transparent border-white/5">
                                    <TableHead className="w-[240px] cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('symbol')}>
                                        <div className="flex items-center">Underlying & Style <SortIcon columnKey="symbol" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('expiry')}>
                                        <div className="flex items-center">Expiry & DTE <SortIcon columnKey="expiry" /></div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('quantity')}>
                                        <div className="flex items-center justify-end">Contracts <SortIcon columnKey="quantity" /></div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('risky')}>
                                        <div className="flex items-center justify-end">Strike & Moneyness <SortIcon columnKey="risky" /></div>
                                    </TableHead>
                                    <TableHead className="text-right">Und. Price</TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('currentPrice')}>
                                        <div className="flex items-center justify-end">Option Price <SortIcon columnKey="currentPrice" /></div>
                                    </TableHead>
                                    <TableHead className="text-right md:table-cell hidden">Avg Cost</TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('marketValue')}>
                                        <div className="flex items-center justify-end">Market Value <SortIcon columnKey="marketValue" /></div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('dayChange')}>
                                        <div className="flex items-center justify-end">Day P/L <SortIcon columnKey="dayChange" /></div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('unrealizedPL')}>
                                        <div className="flex items-center justify-end">Open P/L <SortIcon columnKey="unrealizedPL" /></div>
                                    </TableHead>
                                    <TableHead className="text-center w-[90px]">AI Advisor</TableHead>
                                    <TableHead className="text-center w-[50px]">Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {optionsPositions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={12} className="text-center py-8 text-muted-foreground text-sm">
                                            No active option contracts match the selected filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    optionsPositions.map(pos => renderPositionRow(pos, true))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {/* ================= EQUITIES SECTION ================= */}
            {(viewLayout === 'CATEGORIZED' || viewLayout === 'EQUITIES_ONLY') && (
                <div className="glass-card rounded-2xl overflow-hidden border border-emerald-500/30 shadow-2xl bg-slate-950/40">
                    
                    {/* Equities Section Header */}
                    <div className="p-5 border-b border-emerald-500/20 bg-gradient-to-r from-emerald-950/30 via-slate-900/40 to-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-bold text-foreground tracking-tight">
                                            Equities & Stocks
                                        </h3>
                                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono text-xs">
                                            {equitiesPositions.length} Holdings
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Core equity shares, long holdings, and categorized asset allocations
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Equities KPIs */}
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="px-3 py-1.5 rounded-xl bg-card/60 border border-border/40 font-mono">
                                <span className="text-[10px] text-muted-foreground block uppercase font-bold">Equities Value</span>
                                <span className="text-sm font-black text-foreground">
                                    ${equitiesMetrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="px-3 py-1.5 rounded-xl bg-card/60 border border-border/40 font-mono">
                                <span className="text-[10px] text-muted-foreground block uppercase font-bold">Total Stock Return</span>
                                <span className={cn("text-sm font-black", equitiesMetrics.totalUnrealizedPL >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                    {equitiesMetrics.totalUnrealizedPL >= 0 ? '+' : ''}${equitiesMetrics.totalUnrealizedPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="px-3 py-1.5 rounded-xl bg-card/60 border border-border/40 font-mono">
                                <span className="text-[10px] text-muted-foreground block uppercase font-bold">Today's Move</span>
                                <span className={cn("text-sm font-black", equitiesMetrics.totalDayPL >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                    {equitiesMetrics.totalDayPL >= 0 ? '+' : ''}${equitiesMetrics.totalDayPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Equities Table */}
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-950/50">
                                <TableRow className="hover:bg-transparent border-white/5">
                                    <TableHead className="w-[240px] cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('symbol')}>
                                        <div className="flex items-center">Stock Ticker & Themes <SortIcon columnKey="symbol" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('style')}>
                                        <div className="flex items-center">Style <SortIcon columnKey="style" /></div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('quantity')}>
                                        <div className="flex items-center justify-end">Shares <SortIcon columnKey="quantity" /></div>
                                    </TableHead>
                                    <TableHead className="text-right">Type</TableHead>
                                    <TableHead className="text-right">Live Quote</TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('currentPrice')}>
                                        <div className="flex items-center justify-end">Market Price <SortIcon columnKey="currentPrice" /></div>
                                    </TableHead>
                                    <TableHead className="text-right md:table-cell hidden">Avg Cost</TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('marketValue')}>
                                        <div className="flex items-center justify-end">Market Value <SortIcon columnKey="marketValue" /></div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('dayChange')}>
                                        <div className="flex items-center justify-end">Day Change <SortIcon columnKey="dayChange" /></div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('unrealizedPL')}>
                                        <div className="flex items-center justify-end">Total Return <SortIcon columnKey="unrealizedPL" /></div>
                                    </TableHead>
                                    <TableHead className="text-center w-[90px]">AI Advisor</TableHead>
                                    <TableHead className="text-center w-[50px]">Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {equitiesPositions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={12} className="text-center py-8 text-muted-foreground text-sm">
                                            No equity positions match the selected filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    equitiesPositions.map(pos => renderPositionRow(pos, false))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {/* ================= UNIFIED TABLE SECTION ================= */}
            {viewLayout === 'UNIFIED' && (
                <div className="glass-card rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950/40">
                    <div className="p-4 border-b border-white/5 bg-slate-900/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-foreground text-base">Unified Holdings Table</h3>
                            <Badge variant="outline" className="text-xs font-mono">{allSortedPositions.length} Items</Badge>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-950/50">
                                <TableRow className="hover:bg-transparent border-white/5">
                                    <TableHead className="w-[240px] cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('symbol')}>
                                        <div className="flex items-center">Symbol & Themes <SortIcon columnKey="symbol" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('style')}>
                                        <div className="flex items-center">Style <SortIcon columnKey="style" /></div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('quantity')}>
                                        <div className="flex items-center justify-end">Pos <SortIcon columnKey="quantity" /></div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('risky')}>
                                        <div className="flex items-center justify-end">Risk / Strike <SortIcon columnKey="risky" /></div>
                                    </TableHead>
                                    <TableHead className="text-right">Und. Price</TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('currentPrice')}>
                                        <div className="flex items-center justify-end">Mkt Price <SortIcon columnKey="currentPrice" /></div>
                                    </TableHead>
                                    <TableHead className="text-right md:table-cell hidden">Avg Cost</TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('marketValue')}>
                                        <div className="flex items-center justify-end">Value <SortIcon columnKey="marketValue" /></div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('dayChange')}>
                                        <div className="flex items-center justify-end">Day P/L <SortIcon columnKey="dayChange" /></div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('unrealizedPL')}>
                                        <div className="flex items-center justify-end">Open P/L <SortIcon columnKey="unrealizedPL" /></div>
                                    </TableHead>
                                    <TableHead className="text-center w-[90px]">AI Advisor</TableHead>
                                    <TableHead className="text-center w-[50px]">Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allSortedPositions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={12} className="text-center py-8 text-muted-foreground text-sm">
                                            No positions match the selected filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    allSortedPositions.map(pos => renderPositionRow(pos, pos.assetType === 'Option'))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {/* Stock Note Modal */}
            <StockNoteModal
                isOpen={isNoteModalOpen}
                onClose={() => setIsNoteModalOpen(false)}
                symbol={noteModalStock?.symbol || ''}
                stockName={noteModalStock?.name}
                currentPrice={noteModalStock?.price}
            />

            {/* AI Position Defense Advisor Modal */}
            <PositionAdvisorModal
                position={advisorPosition}
                isOpen={isAdvisorOpen}
                onClose={() => {
                    setIsAdvisorOpen(false);
                    setAdvisorPosition(null);
                }}
            />

            {/* Critical Position Defense Center Modal */}
            <CriticalDefenseModal
                isOpen={isDefenseCenterOpen}
                onClose={() => setIsDefenseCenterOpen(false)}
                positions={positions}
                onOpenAdvisorForPosition={(pos) => {
                    setAdvisorPosition(pos);
                    setIsAdvisorOpen(true);
                }}
            />
        </div>
    );
}
