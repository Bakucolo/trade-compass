import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Scale,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Flame,
  PieChart,
  BarChart3,
  Calendar,
  ExternalLink,
  Coins,
  DollarSign,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Info,
  FileText,
  Percent,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDilutionAnalysis, DilutionAnalysisData } from '@/services/dilutionService';

interface DilutionAndSbcCardProps {
  symbol: string;
  className?: string;
}

export function DilutionAndSbcCard({ symbol, className }: DilutionAndSbcCardProps) {
  const { data: dilution, isLoading, isError, error, refetch, isFetching } = useDilutionAnalysis(symbol);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'sbc' | 'atm' | 'shares' | 'filings'>('overview');

  const formatUSD = (val?: number, compact = false) => {
    if (val === undefined || val === null || isNaN(val)) return '$0';
    if (compact) {
      if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
      if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
      if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    }
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatShares = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
    return val.toLocaleString();
  };

  if (isLoading) {
    return (
      <Card className={cn("glass-card border border-border/60 bg-card/70 p-8 text-center space-y-3", className)}>
        <div className="flex justify-center items-center gap-2 text-primary font-mono text-sm">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Analyzing SEC EDGAR Filings & XBRL Stock Compensation Data for {symbol}...</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Extracting Stock-Based Compensation (SBC), ATM Offerings, Buybacks, and Share Count history...
        </p>
      </Card>
    );
  }

  if (isError || !dilution) {
    return (
      <Card className={cn("glass-card border border-border/60 bg-card/70 p-6 text-center space-y-3", className)}>
        <div className="flex justify-center items-center gap-2 text-rose-400 font-semibold text-sm">
          <AlertTriangle className="w-5 h-5" />
          <span>Unable to compile dilution dossier for {symbol}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {error instanceof Error ? error.message : 'No XBRL data or SEC filings found for this ticker.'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </Button>
      </Card>
    );
  }

  const {
    dilutionRiskTier,
    dilutionRiskScore,
    riskBadgeColor,
    dilutionVerdict,
    annualSbcUSD,
    sbcPercentOfRevenue,
    sbcPerShareUSD,
    annualAtmProceedsUSD,
    annualBuybacksUSD,
    netDilutionRateYoY,
    threeYearCagrDilution,
    shareholderYieldPercent,
    sbcHistoryQuarterly = [],
    sbcHistoryAnnual = [],
    sharesHistory = [],
    equityIssuances = [],
    shareBuybacks = [],
    recentDilutionFilings = [],
    hasActiveAtmShelf,
    activeAtmDetails,
    cik,
  } = dilution;

  const isAccretive = netDilutionRateYoY < 0;
  const isHighDilution = netDilutionRateYoY > 5.0 || sbcPercentOfRevenue > 25.0;

  return (
    <Card className={cn("glass-card border border-border/60 bg-card/80 shadow-xl rounded-2xl overflow-hidden relative", className)}>
      {/* Top Gradient Stripe */}
      <div
        className={cn(
          "h-1.5 w-full",
          riskBadgeColor === 'emerald' && "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600",
          riskBadgeColor === 'cyan' && "bg-gradient-to-r from-cyan-500 via-blue-400 to-indigo-500",
          riskBadgeColor === 'amber' && "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600",
          riskBadgeColor === 'orange' && "bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500",
          riskBadgeColor === 'rose' && "bg-gradient-to-r from-rose-600 via-red-500 to-rose-700"
        )}
      />

      <CardHeader className="p-5 pb-3 border-b border-border/40 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2.5 rounded-xl border",
                riskBadgeColor === 'emerald' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                riskBadgeColor === 'cyan' && "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
                riskBadgeColor === 'amber' && "bg-amber-500/10 text-amber-400 border-amber-500/30",
                riskBadgeColor === 'orange' && "bg-orange-500/10 text-orange-400 border-orange-500/30",
                riskBadgeColor === 'rose' && "bg-rose-500/10 text-rose-400 border-rose-500/30"
              )}
            >
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  Shareholder Dilution & Stock-Based Comp (SBC)
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5">
                  {symbol}
                </Badge>
                {cik && cik !== '0000000000' && (
                  <a
                    href={`https://www.sec.gov/edgar/browse/?CIK=${Number(cik)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors bg-accent/40 px-1.5 py-0.5 rounded-md"
                    title="View Official SEC EDGAR Filings"
                  >
                    <span>CIK: {Number(cik)}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <CardDescription className="text-xs">
                Forensic audit of equity compensation burn rate, At-The-Market (ATM) equity offerings, and net share expansion
              </CardDescription>
            </div>
          </div>

          {/* Dilution Risk Rating Pill */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <div
              className={cn(
                "px-3 py-1.5 rounded-xl border flex items-center gap-2 shadow-xs",
                riskBadgeColor === 'emerald' && "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
                riskBadgeColor === 'cyan' && "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
                riskBadgeColor === 'amber' && "bg-amber-500/15 text-amber-300 border-amber-500/40",
                riskBadgeColor === 'orange' && "bg-orange-500/15 text-orange-300 border-orange-500/40",
                riskBadgeColor === 'rose' && "bg-rose-500/15 text-rose-300 border-rose-500/40 animate-pulse"
              )}
            >
              {riskBadgeColor === 'emerald' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : riskBadgeColor === 'rose' || riskBadgeColor === 'orange' ? (
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              ) : (
                <Scale className="w-4 h-4 text-cyan-400" />
              )}
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Dilution Rating</div>
                <div className="text-xs font-black font-mono tracking-tight">{dilutionRiskTier} ({dilutionRiskScore}/100)</div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Refresh SEC Dilution Data"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin text-primary")} />
            </Button>
          </div>
        </div>

        {/* Verdict Box */}
        <div
          className={cn(
            "p-3 rounded-xl border text-xs flex items-start gap-2.5",
            riskBadgeColor === 'emerald' && "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
            riskBadgeColor === 'cyan' && "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
            riskBadgeColor === 'amber' && "bg-amber-500/10 border-amber-500/30 text-amber-300",
            riskBadgeColor === 'orange' && "bg-orange-500/10 border-orange-500/30 text-orange-300",
            riskBadgeColor === 'rose' && "bg-rose-500/10 border-rose-500/30 text-rose-300"
          )}
        >
          <Info className="w-4 h-4 shrink-0 mt-0.5 opacity-80" />
          <div className="space-y-0.5">
            <span className="font-bold font-mono uppercase text-[10px]">Forensic Assessment: </span>
            <span className="font-medium">{dilutionVerdict}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* ================= 1. PRIMARY 4 CORE METRIC CARDS ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Annual SBC Expense */}
          <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1.5 relative group hover:border-purple-500/50 transition-all">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-purple-400" /> Annual SBC Expense
              </span>
              <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-[9px] font-mono">
                {sbcPercentOfRevenue > 0 ? `${sbcPercentOfRevenue.toFixed(1)}% of Rev` : 'SBC Burn'}
              </Badge>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black font-mono text-foreground">
                {formatUSD(annualSbcUSD, true)}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {sbcPerShareUSD > 0 ? `${formatUSD(sbcPerShareUSD)}/share drag` : 'Trailing 12 Months'}
              </div>
            </div>
          </div>

          {/* 2. Net Share Dilution Rate */}
          <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1.5 relative group hover:border-cyan-500/50 transition-all">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Net Dilution Rate
              </span>
              <Badge
                className={cn(
                  "text-[9px] font-mono",
                  isAccretive
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : isHighDilution
                    ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                    : "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                )}
              >
                {isAccretive ? 'ACCRETIVE' : 'YoY Share Change'}
              </Badge>
            </div>
            <div className="space-y-0.5">
              <div
                className={cn(
                  "text-2xl font-black font-mono",
                  isAccretive ? "text-emerald-400" : isHighDilution ? "text-rose-400" : "text-foreground"
                )}
              >
                {netDilutionRateYoY >= 0 ? '+' : ''}{netDilutionRateYoY.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                3-Yr CAGR: {threeYearCagrDilution >= 0 ? '+' : ''}{threeYearCagrDilution.toFixed(1)}%/yr
              </div>
            </div>
          </div>

          {/* 3. ATM Offerings & Equity Raises */}
          <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1.5 relative group hover:border-amber-500/50 transition-all">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" /> ATM Offerings / Raises
              </span>
              <Badge
                className={cn(
                  "text-[9px] font-mono",
                  hasActiveAtmShelf ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-muted text-muted-foreground"
                )}
              >
                {hasActiveAtmShelf ? 'SHELF ACTIVE' : 'NO ATM DETECTED'}
              </Badge>
            </div>
            <div className="space-y-0.5">
              <div className="text-2xl font-black font-mono text-foreground">
                {formatUSD(annualAtmProceedsUSD, true)}
              </div>
              <div className="text-xs text-muted-foreground truncate" title={activeAtmDetails}>
                {hasActiveAtmShelf ? 'S-3 / 424B5 on file' : 'No recent ATM equity dumping'}
              </div>
            </div>
          </div>

          {/* 4. Net Shareholder Yield */}
          <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1.5 relative group hover:border-emerald-500/50 transition-all">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-emerald-400" /> Shareholder Net Yield
              </span>
              <Badge className={cn("text-[9px] font-mono", shareholderYieldPercent >= 0 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-rose-500/15 text-rose-300 border-rose-500/30")}>
                Buybacks − Dilution
              </Badge>
            </div>
            <div className="space-y-0.5">
              <div className={cn("text-2xl font-black font-mono", shareholderYieldPercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {shareholderYieldPercent >= 0 ? '+' : ''}{shareholderYieldPercent.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                Buybacks: {formatUSD(annualBuybacksUSD, true)}
              </div>
            </div>
          </div>
        </div>

        {/* ================= 2. INTERACTIVE SUB-TABS ================= */}
        <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as any)} className="w-full space-y-4">
          <TabsList className="bg-background/80 p-1 border border-border/60 rounded-xl grid grid-cols-2 sm:grid-cols-5 gap-1">
            <TabsTrigger value="overview" className="text-xs font-bold gap-1.5">
              <PieChart className="w-3.5 h-3.5" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="sbc" className="text-xs font-bold gap-1.5">
              <Coins className="w-3.5 h-3.5 text-purple-400" />
              <span>SBC Breakdown</span>
            </TabsTrigger>
            <TabsTrigger value="atm" className="text-xs font-bold gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              <span>ATM Offerings</span>
            </TabsTrigger>
            <TabsTrigger value="shares" className="text-xs font-bold gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>Shares Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="filings" className="text-xs font-bold gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>SEC Filings Radar</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW & RUNWAY */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: SBC Impact */}
              <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                  <Coins className="w-4 h-4" />
                  <span>Stock-Based Comp Drag</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The company granted <strong>{formatUSD(annualSbcUSD, true)}</strong> in stock-based compensation over the trailing year. This represents <strong>{sbcPercentOfRevenue.toFixed(1)}% of top-line revenue</strong>. High SBC dilutes per-share intrinsic value unless offset by matching cash flow growth or aggressive buybacks.
                </p>
              </div>

              {/* Card 2: ATM Offerings & Financing */}
              <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <DollarSign className="w-4 h-4" />
                  <span>ATM Equity Offerings</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {hasActiveAtmShelf ? (
                    <>
                      <strong>Active Shelf Offering Detected</strong>: The company has registered equity shelf programs to issue shares directly into the open market, having raised <strong>{formatUSD(annualAtmProceedsUSD, true)}</strong>. Watch for downward price pressure during spikes.
                    </>
                  ) : (
                    <>
                      <strong>No Active ATM Equity Flooding</strong>: No continuous at-the-market equity program detected in recent SEC registrations. Capital is primarily internally generated or debt-financed.
                    </>
                  )}
                </p>
              </div>

              {/* Card 3: Shareholder Net Return */}
              <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Scale className="w-4 h-4" />
                  <span>Net Shareholder Balance</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAccretive ? (
                    <>
                      <strong>Accretive Capital Management</strong>: Total share buybacks of <strong>{formatUSD(annualBuybacksUSD, true)}</strong> exceed new equity grants, reducing total shares outstanding by <strong>{Math.abs(netDilutionRateYoY).toFixed(1)}% YoY</strong> and boosting EPS.
                    </>
                  ) : (
                    <>
                      <strong>Net Dilutive Flow</strong>: Share count grew by <strong>{netDilutionRateYoY.toFixed(1)}% YoY</strong>. Existing shareholders own a smaller slice of the business unless revenue & earnings grow faster than the dilution rate.
                    </>
                  )}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: SBC BREAKDOWN */}
          <TabsContent value="sbc" className="space-y-4">
            <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Historical Stock-Based Compensation (SBC) Progression
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {sbcHistoryQuarterly.length} Quarters Logged
                </Badge>
              </div>

              {sbcHistoryQuarterly.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-border/50 text-muted-foreground font-mono">
                        <th className="pb-2">Fiscal Period</th>
                        <th className="pb-2">Period End</th>
                        <th className="pb-2">SBC Amount</th>
                        <th className="pb-2">SEC Form</th>
                        <th className="pb-2">Filed Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 font-mono">
                      {sbcHistoryQuarterly.slice().reverse().map((rec, idx) => (
                        <tr key={idx} className="hover:bg-accent/30 transition-colors">
                          <td className="py-2.5 font-bold text-foreground">
                            {rec.fiscalYear} {rec.fiscalPeriod}
                          </td>
                          <td className="py-2.5 text-muted-foreground">{rec.endDate}</td>
                          <td className="py-2.5 text-purple-300 font-bold">{formatUSD(rec.amountUSD)}</td>
                          <td className="py-2.5">
                            <Badge variant="outline" className="text-[10px] py-0">
                              {rec.form}
                            </Badge>
                          </td>
                          <td className="py-2.5 text-muted-foreground">{rec.filedDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No detailed quarterly SBC line items reported in US-GAAP XBRL format for {symbol}.
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 3: ATM OFFERINGS & CAPITAL RAISES */}
          <TabsContent value="atm" className="space-y-4">
            <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    At-The-Market (ATM) & Public Common Stock Issuance Proceeds
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {equityIssuances.length} Equity Events
                </Badge>
              </div>

              {equityIssuances.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-border/50 text-muted-foreground font-mono">
                        <th className="pb-2">Period</th>
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Proceeds Raised</th>
                        <th className="pb-2">Filing</th>
                        <th className="pb-2">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 font-mono">
                      {equityIssuances.map((rec, idx) => (
                        <tr key={idx} className="hover:bg-accent/30 transition-colors">
                          <td className="py-2.5 font-bold text-foreground">
                            {rec.fiscalYear} {rec.fiscalPeriod}
                          </td>
                          <td className="py-2.5 text-muted-foreground">{rec.endDate}</td>
                          <td className="py-2.5 text-amber-400 font-bold">{formatUSD(rec.proceedsUSD)}</td>
                          <td className="py-2.5">
                            <Badge variant="outline" className="text-[10px] py-0">
                              {rec.form}
                            </Badge>
                          </td>
                          <td className="py-2.5 text-muted-foreground text-[11px]">
                            {rec.type.replace(/_/g, ' ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No public equity offerings or ATM stock issuances recorded in recent XBRL cash flow statements.
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 4: SHARES OUTSTANDING TIMELINE */}
          <TabsContent value="shares" className="space-y-4">
            <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Historical Share Count Evolution
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-muted-foreground">Latest Shares:</span>
                  <strong className="text-cyan-400">{formatShares(sharesHistory[sharesHistory.length - 1]?.sharesOutstanding)}</strong>
                </div>
              </div>

              {sharesHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-border/50 text-muted-foreground font-mono">
                        <th className="pb-2">Period</th>
                        <th className="pb-2">Report Date</th>
                        <th className="pb-2">Shares Outstanding</th>
                        <th className="pb-2">Form</th>
                        <th className="pb-2">Filed Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 font-mono">
                      {sharesHistory.slice().reverse().map((rec, idx) => (
                        <tr key={idx} className="hover:bg-accent/30 transition-colors">
                          <td className="py-2.5 font-bold text-foreground">
                            {rec.fiscalYear} {rec.fiscalPeriod}
                          </td>
                          <td className="py-2.5 text-muted-foreground">{rec.endDate}</td>
                          <td className="py-2.5 text-cyan-300 font-bold">{formatShares(rec.sharesOutstanding)}</td>
                          <td className="py-2.5">
                            <Badge variant="outline" className="text-[10px] py-0">
                              {rec.form}
                            </Badge>
                          </td>
                          <td className="py-2.5 text-muted-foreground">{rec.filedDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No historical share count records found in US-GAAP XBRL statements.
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 5: SEC FILINGS RADAR */}
          <TabsContent value="filings" className="space-y-4">
            <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    SEC Dilution & Offering Registrations Radar (S-3, S-8, 424B5, 144)
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {recentDilutionFilings.length} Filings Detected
                </Badge>
              </div>

              {recentDilutionFilings.length > 0 ? (
                <div className="space-y-2">
                  {recentDilutionFilings.map((filing, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-background/60 border border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-start gap-2.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-mono text-[10px] font-bold px-2 py-0.5 shrink-0 mt-0.5",
                            filing.category === 'ATM_SHELF_OFFERING' && "bg-amber-500/10 text-amber-300 border-amber-500/30",
                            filing.category === 'EQUITY_INCENTIVE_SBC' && "bg-purple-500/10 text-purple-300 border-purple-500/30",
                            filing.category === 'INSIDER_PROPOSED_SALE' && "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                          )}
                        >
                          Form {filing.form}
                        </Badge>
                        <div>
                          <div className="text-xs font-semibold text-foreground">{filing.description}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            Filed: {filing.filingDate} · Accession: {filing.accessionNumber}
                          </div>
                        </div>
                      </div>

                      {filing.edgarUrl && (
                        <a
                          href={filing.edgarUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0 self-end sm:self-center"
                        >
                          <span>Open in SEC EDGAR</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No recent S-3, 424B5, or S-8 offering registrations detected in SEC Edgar submissions.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
