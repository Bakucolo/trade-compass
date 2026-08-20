
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, DollarSign, Wallet, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortfolioSummaryProps {
    netLiquidValue: number;
    dailyPL: number;
    dailyPLPercent: number;
    unrealizedPL: number;
    buyingPower: number;
    connectedSources: {
        ibkr: boolean;
        tastytrade: boolean;
    };
    isPrivacyMode: boolean;
    onTogglePrivacy: () => void;
    accountBreakdown: {
        ibkr: number;
        tastytrade: number;
    };
}

export function PortfolioSummary({
    netLiquidValue,
    dailyPL,
    dailyPLPercent,
    unrealizedPL,
    buyingPower,
    connectedSources,
    isPrivacyMode,
    onTogglePrivacy,
    accountBreakdown
}: PortfolioSummaryProps) {
    const isPositiveDay = dailyPL >= 0;
    const isPositiveTotal = unrealizedPL >= 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 relative">
            {/* Net Liquid Value (Hero) */}
            {/* Net Liquid Value (Hero) */}
            <Card className="md:col-span-1 glass-card border-l-4 border-l-cyan-500 p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity z-0">
                    <Wallet className="w-24 h-24 text-cyan-400" />
                </div>

                <div className="flex items-center justify-between mb-1 relative z-10">
                    <p className="text-muted-foreground font-medium">Net Liquid Value</p>
                    <button
                        onClick={onTogglePrivacy}
                        className="text-cyan-400 hover:text-cyan-300 transition-colors p-2 rounded-full hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        aria-label={isPrivacyMode ? "Show Values" : "Hide Values"}
                    >
                        {isPrivacyMode ? (
                            <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full border border-cyan-500/30 shadow-[0_0_10px_-2px_rgba(6,182,212,0.3)]">
                                <EyeOff className="w-4 h-4 text-cyan-400" />
                                <span className="text-xs font-bold text-cyan-100 tracking-wide">HIDDEN</span>
                            </div>
                        ) : (
                            <Eye className="w-5 h-5" />
                        )}
                    </button>
                </div>

                <h2 className={cn("text-3xl font-bold font-mono tracking-tight text-foreground transition-all duration-300", isPrivacyMode && "blur-md select-none opacity-50")}>
                    ${netLiquidValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>

                <div className="mt-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Interactive Brokers</span>
                        <span className={cn("font-mono text-cyan-200/70", isPrivacyMode && "blur-sm")}>
                            ${accountBreakdown.ibkr.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tastytrade</span>
                        <span className={cn("font-mono text-cyan-200/70", isPrivacyMode && "blur-sm")}>
                            ${accountBreakdown.tastytrade.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                    </div>
                </div>
            </Card>

            {/* Daily P/L */}
            <Card className={cn(
                "glass-card p-6 relative overflow-hidden border-l-4",
                isPositiveDay ? "border-l-emerald-500" : "border-l-rose-500"
            )}>
                <div className="absolute top-0 right-0 p-3 opacity-10">
                    {isPositiveDay ? <ArrowUpRight className="w-12 h-12 text-emerald-400" /> : <ArrowDownRight className="w-12 h-12 text-rose-400" />}
                </div>
                <p className="text-muted-foreground font-medium mb-1">Daily P/L</p>
                <div className={cn("text-2xl font-bold font-mono flex items-center gap-2", isPositiveDay ? "text-emerald-400" : "text-rose-400")}>
                    <span className={cn(isPrivacyMode && "blur-md select-none opacity-60")}>
                        {isPositiveDay ? '+' : ''}${Math.abs(dailyPL).toLocaleString()}
                    </span>
                    <span className="text-sm font-sans opacity-80">
                        ({isPositiveDay ? '+' : ''}{dailyPLPercent.toFixed(2)}%)
                    </span>
                </div>
            </Card>

            {/* Unrealized P/L */}
            <Card className={cn(
                "glass-card p-6 relative overflow-hidden border-l-4",
                isPositiveTotal ? "border-l-purple-500" : "border-l-orange-500"
            )}>
                <p className="text-muted-foreground font-medium mb-1">Unrealized P/L</p>
                <div className={cn("text-2xl font-bold font-mono", isPositiveTotal ? "text-purple-400" : "text-orange-400", isPrivacyMode && "blur-md select-none opacity-60")}>
                    {isPositiveTotal ? '+' : ''}${Math.abs(unrealizedPL).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total Open Return</p>
            </Card>

            {/* Connection Status (Mini) */}
            <Card className="glass-card p-4 flex flex-col justify-center space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Interactive Brokers</span>
                    <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full shadow-lg", connectedSources.ibkr ? "bg-emerald-500 shadow-emerald-500/50 animate-pulse" : "bg-red-500/50")} />
                        <span className="text-xs text-foreground">{connectedSources.ibkr ? 'Connected' : 'Offline'}</span>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Tastytrade</span>
                    <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full shadow-lg", connectedSources.tastytrade ? "bg-emerald-500 shadow-emerald-500/50 animate-pulse" : "bg-red-500/50")} />
                        <span className="text-xs text-foreground">{connectedSources.tastytrade ? 'Connected' : 'Offline'}</span>
                    </div>
                </div>
            </Card>
        </div>
    );
}
