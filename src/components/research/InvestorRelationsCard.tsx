import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Globe,
  FileText,
  ExternalLink,
  Download,
  Calendar,
  Building2,
  Phone,
  MapPin,
  Search,
  Sparkles,
  Layers,
  Radio,
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Filter,
  FileCheck2
} from 'lucide-react';
import { useInvestorRelations, SecFilingItem, InvestorMaterialItem } from '@/services/investorRelationsService';

interface InvestorRelationsCardProps {
  symbol: string;
  onNavigateToGraphs?: (symbol: string) => void;
}

type FilingFilter = 'ALL' | '10-K' | '10-Q' | '8-K' | 'PROXY' | 'INSIDER';

export const InvestorRelationsCard: React.FC<InvestorRelationsCardProps> = ({ symbol }) => {
  const { data: irData, isLoading, isError, error, refetch } = useInvestorRelations(symbol);
  const [filingFilter, setFilingFilter] = useState<FilingFilter>('ALL');
  const [filingSearch, setFilingSearch] = useState('');

  // Filtered SEC Filings
  const filteredFilings = useMemo(() => {
    if (!irData?.filings) return [];
    return irData.filings.filter((f) => {
      // Category / Type filter
      if (filingFilter === '10-K' && !f.formType.includes('10-K')) return false;
      if (filingFilter === '10-Q' && !f.formType.includes('10-Q')) return false;
      if (filingFilter === '8-K' && !f.formType.includes('8-K')) return false;
      if (filingFilter === 'PROXY' && !f.formType.includes('14A') && !f.formType.includes('PROXY')) return false;
      if (filingFilter === 'INSIDER' && !f.formType.includes('13') && !f.formType.includes('4')) return false;

      // Text search
      if (filingSearch.trim()) {
        const query = filingSearch.toLowerCase();
        const matchTitle = f.title.toLowerCase().includes(query);
        const matchType = f.formType.toLowerCase().includes(query);
        const matchDate = f.formattedDate.toLowerCase().includes(query);
        if (!matchTitle && !matchType && !matchDate) return false;
      }

      return true;
    });
  }, [irData?.filings, filingFilter, filingSearch]);

  const getFormBadgeColor = (formType: string) => {
    const t = formType.toUpperCase();
    if (t.includes('10-K')) {
      return 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm';
    }
    if (t.includes('10-Q')) {
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm';
    }
    if (t.includes('8-K')) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
    if (t.includes('14A') || t.includes('PROXY')) {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
    if (t.includes('13G') || t.includes('13D')) {
      return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  if (isLoading) {
    return (
      <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-xl rounded-2xl p-8">
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground animate-pulse">
            Connecting to official Investor Relations and SEC EDGAR servers for {symbol}...
          </p>
        </div>
      </Card>
    );
  }

  if (isError || !irData) {
    return (
      <Card className="bg-destructive/10 border border-destructive/30 rounded-2xl p-6">
        <div className="text-center space-y-3">
          <h3 className="text-base font-bold text-destructive">Failed to Load Investor Relations Hub</h3>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : 'Unable to connect to IR registry.'}
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="text-xs">
            Retry Connection
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ================= 1. PRIMARY INVESTOR RELATIONS COMMAND BANNER ================= */}
      <Card className="bg-gradient-to-br from-card/90 via-card/70 to-card/90 backdrop-blur-2xl border border-border/70 shadow-2xl rounded-2xl overflow-hidden relative">
        <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500" />
        
        <CardContent className="p-6 space-y-6">
          {/* Header Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-black text-foreground tracking-tight">
                      {irData.companyName}
                    </h2>
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 font-mono text-xs">
                      {irData.symbol} IR HUB
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{irData.sector}</span>
                    <span>•</span>
                    <span>{irData.industry}</span>
                    <span>•</span>
                    <span className="text-cyan-400 font-medium">{irData.irPortalName}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Main Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Direct Official IR Portal */}
              <a
                href={irData.irWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02]"
                title="Open official Investor Relations Website in new tab"
              >
                <Globe className="w-4 h-4" />
                <span>Official IR Website</span>
                <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
              </a>

              {/* Latest Presentation Search / PDF */}
              <a
                href={irData.latestPresentation.directSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm transition-all hover:scale-[1.02]"
                title="Search and download latest official investor presentation PDF"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Latest Presentation (PDF)</span>
                <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
              </a>

              {/* SEC EDGAR Complete Directory */}
              <a
                href={irData.secEdgarSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-card/80 hover:bg-card text-foreground border border-border/80 shadow-sm transition-all"
                title="Search company filings directly on SEC EDGAR"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>SEC EDGAR</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground ml-0.5" />
              </a>
            </div>
          </div>

          {/* Quick Metrics & Corporate Info Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/40 border border-white/5 font-mono text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-sans font-bold block">
                Official Web Domain
              </span>
              <a
                href={irData.officialWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-cyan-300 hover:underline flex items-center gap-1 mt-0.5"
              >
                <span>{irData.officialWebsite.replace(/^https?:\/\/(www\.)?/, '')}</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-sans font-bold block">
                Next Earnings Date
              </span>
              <span className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>{irData.nextEarningsDate || 'TBD'}</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-sans font-bold block">
                Headquarters
              </span>
              <span className="font-bold text-foreground truncate block mt-0.5" title={irData.headquarters.fullAddress}>
                {irData.headquarters.city ? `${irData.headquarters.city}, ${irData.headquarters.state || irData.headquarters.country}` : 'United States'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-sans font-bold block">
                Active Filings on File
              </span>
              <span className="font-bold text-emerald-400 mt-0.5 block">
                {irData.filings.length} Recent Submissions
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================= 2. FEATURED INVESTOR MATERIALS & PRESENTATIONS GRID ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {irData.featuredMaterials.map((mat) => (
          <a
            key={mat.id}
            href={mat.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex flex-col justify-between p-5 rounded-2xl bg-card/60 hover:bg-card/90 border border-border/70 hover:border-purple-500/50 shadow-lg hover:shadow-purple-500/10 transition-all duration-300"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className={cn(
                  "p-2.5 rounded-xl border",
                  mat.category === 'PRESENTATION' ? "bg-purple-500/20 text-purple-300 border-purple-500/40" :
                  mat.category === 'EARNINGS_DECK' ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" :
                  mat.category === 'SEC_DIRECTORY' ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                  "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                )}>
                  {mat.category === 'PRESENTATION' && <FileSpreadsheet className="w-5 h-5" />}
                  {mat.category === 'EARNINGS_DECK' && <Globe className="w-5 h-5" />}
                  {mat.category === 'SEC_DIRECTORY' && <ShieldCheck className="w-5 h-5" />}
                  {mat.category === 'WEBCAST' && <Radio className="w-5 h-5" />}
                </div>

                <Badge variant="outline" className="text-[10px] font-mono uppercase bg-slate-950/40 border-white/10">
                  {mat.fileType || 'LINK'}
                </Badge>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground group-hover:text-purple-300 transition-colors flex items-center gap-1">
                  <span>{mat.title}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-purple-400" />
                </h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {mat.subtitle}
                </p>
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-purple-400 group-hover:text-purple-300">
              <span>Access Material</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </a>
        ))}
      </div>

      {/* ================= 3. SEC EDGAR FILINGS INTERACTIVE DIRECTORY ================= */}
      <Card className="bg-card/70 backdrop-blur-xl border border-border/70 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="p-6 pb-4 border-b border-border/40 bg-accent/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <CardTitle className="text-lg font-bold text-foreground">
                  Official SEC EDGAR Filings Directory
                </CardTitle>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-mono">
                  {filteredFilings.length} Submissions
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Audited 10-K Annual Reports, 10-Q Quarterly Disclosures, 8-K Material Events, and Proxy Statements
              </CardDescription>
            </div>

            {/* Filings Search Input */}
            <div className="relative w-full sm:w-[260px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by form or keyword..."
                value={filingSearch}
                onChange={(e) => setFilingSearch(e.target.value)}
                className="pl-9 h-9 bg-slate-950/40 border-border/70 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Form Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-3">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-purple-400" /> Filter Forms:
            </span>
            {(
              [
                { id: 'ALL', label: 'All Filings' },
                { id: '10-K', label: '10-K (Annual)' },
                { id: '10-Q', label: '10-Q (Quarterly)' },
                { id: '8-K', label: '8-K (Material Events)' },
                { id: 'PROXY', label: 'Proxy / DEF 14A' },
                { id: 'INSIDER', label: 'Insider / 13G' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilingFilter(tab.id)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border",
                  filingFilter === tab.id
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm"
                    : "bg-slate-950/40 text-muted-foreground border-white/5 hover:text-foreground hover:bg-white/5"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-border/40 max-h-[480px] overflow-y-auto">
            {filteredFilings.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">
                No SEC filings found matching your filter criteria.
              </div>
            ) : (
              filteredFilings.map((filing, idx) => (
                <div
                  key={`${filing.formType}-${filing.date}-${idx}`}
                  className="p-4 hover:bg-white/5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <Badge className={cn("font-mono text-xs px-2 py-0.5 shrink-0 uppercase", getFormBadgeColor(filing.formType))}>
                      {filing.formType}
                    </Badge>
                    <div className="space-y-0.5">
                      <h5 className="text-sm font-semibold text-foreground group-hover:text-purple-300 transition-colors">
                        {filing.title}
                      </h5>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Filing Date: {filing.formattedDate || filing.date}</span>
                      </div>
                    </div>
                  </div>

                  <a
                    href={filing.edgarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent/40 hover:bg-purple-500/20 hover:text-purple-300 border border-border/70 transition-all shrink-0 self-start sm:self-auto"
                    title={`Open ${filing.formType} filing directly on SEC EDGAR`}
                  >
                    <span>View Filing</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
