import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Printer,
  Bookmark,
  BookmarkCheck,
  Copy,
  Check,
  Sparkles,
  Cpu,
  Globe2,
  Clock,
  FileText,
  Search,
  Type,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ThoughtLogRecord } from '@/services/thoughtLogService';

export interface CopilotPrintableData {
  id: string;
  query: string;
  response: string;
  model?: string;
  classification?: 'simple_task' | 'complex_analysis' | string;
  executionTime?: number;
  toolsUsed?: string[];
  timestamp?: string;
}

interface CopilotPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CopilotPrintableData | null;
  onSaveToLog?: () => Promise<void> | void;
  isSaved?: boolean;
}

/**
 * Extracts structured printable briefing data from a saved ThoughtLog record.
 */
export function extractPrintableDataFromLog(log: ThoughtLogRecord): CopilotPrintableData {
  let query = log.title;
  let response = log.content;
  let model = 'AI Copilot';
  const toolsUsed: string[] = [];

  // 1. If saved from AI Copilot, parse structured inquiry, model, and analysis
  if (log.content && log.content.includes('### Financial Inquiry')) {
    const inquiryMatch = log.content.match(/### Financial Inquiry\s*\n+>\s*([\s\S]*?)(?=\n+\*\*AI Model\*\*|\n+---|$)/);
    if (inquiryMatch && inquiryMatch[1].trim()) {
      query = inquiryMatch[1].trim();
    }
    const modelMatch = log.content.match(/\*\*AI Model\*\*:\s*`([^`]+)`/);
    if (modelMatch && modelMatch[1].trim()) {
      model = modelMatch[1].trim();
    }
    const analysisMatch = log.content.match(/### Copilot Analysis\s*\n+([\s\S]*)$/);
    if (analysisMatch && analysisMatch[1].trim()) {
      response = analysisMatch[1].trim();
    } else if (log.agentOutput) {
      response = log.agentOutput;
    }
  } else if (log.agentOutput && log.agentOutput.trim()) {
    // If agentOutput is available, content is the note and agentOutput is the analysis
    query = log.title || log.content.slice(0, 80);
    response = log.agentOutput;
  }

  // Detect tool tags if present
  if (log.tags?.toLowerCase().includes('yfinance') || response.includes('yfinance')) toolsUsed.push('yfinance');
  if (log.tags?.toLowerCase().includes('scipy') || response.includes('scipy')) toolsUsed.push('scipy/numpy');
  if (log.tags?.toLowerCase().includes('tavily') || response.includes('Tavily')) toolsUsed.push('Tavily');

  // Clean title prefix
  const cleanTitle = query.replace(/^Copilot:\s*/i, '').trim();

  return {
    id: log.id,
    query: cleanTitle || log.title || 'Financial Inquiry',
    response,
    model,
    classification: 'complex_analysis',
    toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
    timestamp: new Date(log.createdAt).toLocaleString(),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function CopilotPrintModal({
  isOpen,
  onClose,
  data,
  onSaveToLog,
  isSaved = false,
}: CopilotPrintModalProps) {
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');

  if (!data) return null;

  const formattedDate = data.timestamp || new Date().toLocaleString();

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = async () => {
    try {
      const fullText = `# ${data.query}\n\n**Model**: ${data.model || 'AI Copilot'}\n**Timestamp**: ${formattedDate}\n\n---\n\n${data.response}`;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast.success('Research memo copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-w-4xl max-h-[92vh] flex flex-col p-0 bg-slate-950/98 text-slate-100 border border-slate-800 shadow-2xl rounded-2xl overflow-hidden backdrop-blur-2xl"
      >
        {/* Modal Action Bar (Hidden in Print View) */}
        <DialogHeader className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 flex flex-row items-center justify-between gap-4 no-print shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
                Executive Research Memo
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 font-mono">
                  Print & Reader View
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Institutional stylized view formatted for long-form reading and PDF export
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Font Size Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFontSize(fontSize === 'normal' ? 'large' : 'normal')}
              className="h-8 text-xs border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 gap-1.5"
              title="Toggle reading font size"
            >
              <Type className="w-3.5 h-3.5" />
              <span>{fontSize === 'normal' ? 'A+' : 'A-'}</span>
            </Button>

            {/* Copy Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8 text-xs border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </Button>

            {/* Save to Log Button */}
            {onSaveToLog && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSaveToLog}
                disabled={isSaved}
                className={cn(
                  'h-8 text-xs border-slate-700 gap-1.5 transition-colors',
                  isSaved
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                )}
              >
                {isSaved ? <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Bookmark className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isSaved ? 'Saved to Log' : 'Save to Log'}</span>
              </Button>
            )}

            {/* Print / Save as PDF Button */}
            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium gap-1.5 shadow-md shadow-indigo-600/25"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Memo Body & Target Print Container */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 scrollbar-thin scrollbar-thumb-slate-800">
          <article
            id="copilot-printable-report"
            className={cn(
              'copilot-memo-container max-w-3xl mx-auto space-y-6 transition-all',
              fontSize === 'large' ? 'text-base leading-relaxed' : 'text-sm leading-normal'
            )}
          >
            {/* Institutional Header Banner */}
            <header className="border-b-2 border-slate-800 pb-5 space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    TF
                  </div>
                  <div>
                    <h1 className="text-xs font-black tracking-widest uppercase text-slate-400 font-mono">
                      TradeFlow Intelligence Copilot
                    </h1>
                    <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                      Executive Financial Research Briefing
                    </h2>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-mono text-slate-400">
                    {formattedDate}
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono bg-slate-900 border-slate-700 text-slate-300 mt-0.5">
                    Doc ID: {data.id.slice(-8).toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Metadata Badges Ribbon */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                {/* Model Pill */}
                <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 text-[11px] font-mono font-medium flex items-center gap-1 py-0.5">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>Model: {data.model || 'Hybrid Auto (LangGraph)'}</span>
                </Badge>

                {/* Routing Pill */}
                {data.classification && (
                  <Badge
                    className={cn(
                      'text-[11px] font-mono font-medium flex items-center gap-1 py-0.5',
                      data.classification === 'simple_task'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                    )}
                  >
                    {data.classification === 'simple_task' ? (
                      <>
                        <Cpu className="w-3 h-3 text-emerald-400" />
                        <span>Local Execution (Ollama)</span>
                      </>
                    ) : (
                      <>
                        <Globe2 className="w-3 h-3 text-purple-400" />
                        <span>Remote Synthesis (OpenRouter)</span>
                      </>
                    )}
                  </Badge>
                )}

                {/* Latency Pill */}
                {data.executionTime && (
                  <Badge variant="outline" className="text-[11px] font-mono text-slate-400 border-slate-800 flex items-center gap-1 py-0.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{data.executionTime}s latency</span>
                  </Badge>
                )}

                {/* Tools Used Pills */}
                {data.toolsUsed && data.toolsUsed.length > 0 && (
                  <div className="flex items-center gap-1">
                    {data.toolsUsed.map((tool) => (
                      <Badge
                        key={tool}
                        variant="outline"
                        className="text-[10px] bg-sky-500/10 text-sky-300 border-sky-500/30 py-0.5"
                      >
                        {tool}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </header>

            {/* Inquiry Callout Card */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
              <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <Search className="w-3 h-3 text-indigo-400" />
                <span>Original Financial Inquiry</span>
              </div>
              <p className="text-sm sm:text-base font-semibold text-slate-100 italic">
                "{data.query}"
              </p>
            </div>

            {/* Formatted Markdown Content */}
            <div className="copilot-prose-body prose prose-invert max-w-none prose-headings:text-slate-100 prose-headings:font-bold prose-p:text-slate-200 prose-p:leading-relaxed prose-strong:text-white prose-strong:font-bold prose-code:text-indigo-300 prose-code:bg-slate-900/80 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-li:text-slate-200 prose-table:border prose-table:border-slate-800 prose-th:bg-slate-900/80 prose-th:p-2.5 prose-td:p-2.5 prose-td:border-t prose-td:border-slate-800">
              <ReactMarkdown>{data.response}</ReactMarkdown>
            </div>

            {/* Memo Footer & Regulatory Disclaimer */}
            <footer className="border-t border-slate-800/80 pt-6 mt-10 space-y-2 text-slate-500 text-[11px] font-mono">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span>TradeFlow Capital Quantitative AI Engine</span>
                <span>Generated: {formattedDate}</span>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500/80">
                Disclaimer: This automated research briefing is generated for quantitative analytical and informational purposes only. It does not constitute investment advice or a solicitation to buy or sell securities. Past performance is no guarantee of future returns.
              </p>
            </footer>
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}
