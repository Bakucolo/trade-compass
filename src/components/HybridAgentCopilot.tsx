import React, { useState, useRef, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Bot,
  Sparkles,
  Send,
  Loader2,
  Cpu,
  Globe2,
  Calculator,
  TrendingUp,
  Search,
  CheckCircle2,
  ArrowRight,
  HelpCircle,
  Clock,
  Wrench,
  Maximize2,
  Minimize2,
  Bookmark,
  BookmarkCheck,
  Printer,
  Copy,
  Check,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createThoughtLog } from '@/services/thoughtLogService';
import { CopilotPrintModal, CopilotPrintableData } from './CopilotPrintModal';

export interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  query?: string;
  model?: string;
  classification?: 'simple_task' | 'complex_analysis';
  reasoning?: string;
  toolsUsed?: string[];
  executionTime?: number;
  timestamp: string;
}

export interface HybridAgentCopilotProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToLog?: (folder?: string) => void;
}

export interface CopilotModelOption {
  id: string;
  name: string;
  badge: string;
  desc: string;
  isLocal?: boolean;
}

export const COPILOT_MODELS: CopilotModelOption[] = [
  {
    id: 'auto',
    name: 'Auto Hybrid (LangGraph)',
    badge: 'Smart Triage',
    desc: 'Ollama local for basic lookup/math + OpenRouter frontier for macro synthesis'
  },
  {
    id: 'inclusionai/ling-3.0-flash-fin:free',
    name: 'Ling 3.0 Flash Finance',
    badge: 'Finance Free',
    desc: 'Fine-tuned specifically for financial statements, DCF multiples, and macro'
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B Instruct',
    badge: 'Meta Free',
    desc: "Meta's flagship high-capability open-weights reasoning model"
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash',
    badge: 'Google Free',
    desc: 'Google high-speed experimental flash model via OpenRouter'
  },
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 Reasoning',
    badge: 'Reasoning Free',
    desc: 'Deep step-by-step mathematical & structural chain of thought'
  },
  {
    id: 'ollama',
    name: 'Ollama (Llama 3.1 Local)',
    badge: 'Offline Local',
    desc: '100% private offline execution via local Ollama engine',
    isLocal: true
  }
];

const SUGGESTED_QUERIES = [
  {
    label: 'AAPL Live Price & 52W Range',
    icon: TrendingUp,
    type: 'simple_task',
    query: 'What is the current stock price of Apple (AAPL) and its 52-week high/low?'
  },
  {
    label: '95% Value-at-Risk (VaR) Calculation',
    icon: Calculator,
    type: 'simple_task',
    query: 'Using scipy stats, calculate the standard normal cumulative probability at z = 1.96 and calculate a 95% Value at Risk for a $500,000 portfolio with 1.5% daily volatility.'
  },
  {
    label: 'Macro Inflation vs Yield Curve Synthesis',
    icon: Globe2,
    type: 'complex_analysis',
    query: 'Synthesize current macroeconomic indicators (inflation vs yield curve) into a cross-asset forecasting scenario for equities vs commodities over the next 6 months.'
  },
  {
    label: 'NVDA Market Valuation & P/E Check',
    icon: Search,
    type: 'simple_task',
    query: 'Fetch current market data and trailing P/E ratio for NVDA and summarize its valuation multiples.'
  }
];

export function HybridAgentCopilot({ isOpen, onOpenChange, onNavigateToLog }: HybridAgentCopilotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: "👋 **Hello! I'm your Hybrid Financial Copilot.**\n\nI dynamically route requests between your **local Ollama (`llama3.1`)** instance for basic ticker lookups and statistical calculations (to save on API expenses), and a **remote OpenRouter frontier model** for deep macroeconomic and cross-asset synthesis.\n\nYou can select your preferred AI model from the header dropdown above, expand this chat to full size, and print or save any response to your Log section!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('tradeflow_copilot_model') || 'auto';
  });
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [printModalData, setPrintModalData] = useState<CopilotPrintableData | null>(null);

  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (typeof scrollEndRef.current?.scrollIntoView === 'function') {
        scrollEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, isOpen]);

  const handleModelChange = (newModelId: string) => {
    setSelectedModel(newModelId);
    localStorage.setItem('tradeflow_copilot_model', newModelId);
    const chosen = COPILOT_MODELS.find((m) => m.id === newModelId);
    toast.info(`Active AI Model: ${chosen?.name || newModelId}`, {
      description: chosen?.desc
    });
  };

  const handleSend = async (queryToSend?: string) => {
    const query = (queryToSend || inputQuery).trim();
    if (!query || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent/hybrid-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, model: selectedModel })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();

      const chosenModelName = COPILOT_MODELS.find((m) => m.id === selectedModel)?.name || selectedModel;

      const agentMessage: Message = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: data.response || 'No response returned from agent.',
        query,
        model: data.model || chosenModelName,
        classification: data.classification,
        reasoning: data.router_reasoning,
        toolsUsed: data.tools_used || [],
        executionTime: data.execution_time_seconds,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, agentMessage]);
    } catch (err: any) {
      console.error('Hybrid Agent Error:', err);
      toast.error(err.message || 'Failed to execute hybrid agent query');

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        sender: 'agent',
        text: `⚠️ **Execution Error:** ${err.message || 'The hybrid agent encountered an unexpected error.'}\n\nPlease verify that your API keys are set in \`.env.local\` or try another model.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = async (msg: Message) => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopiedMsgId(msg.id);
      toast.success('Response copied to clipboard');
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleSaveToLog = async (msg: Message) => {
    try {
      const cleanPrompt = msg.query || (messages.find(m => m.sender === 'user' && m.id < msg.id)?.text) || 'Financial Inquiry';
      const firstLine = cleanPrompt.split('\n')[0].replace(/^[#*>\s]+/, '').slice(0, 50);
      const title = `Copilot: ${firstLine || 'Saved Insight'}`;
      const modelUsed = msg.model || selectedModel;

      const content = `### Financial Inquiry\n> ${cleanPrompt}\n\n**AI Model**: \`${modelUsed}\` • **Timestamp**: ${msg.timestamp}\n\n---\n\n### Copilot Analysis\n\n${msg.text}`;

      await createThoughtLog({
        title,
        content,
        folder: 'Saved',
        tags: 'AI Copilot, Saved Answer',
        sentiment: 'NEUTRAL',
        agentOutput: msg.text,
        agentActionType: 'COPILOT_SAVED'
      });

      setSavedMessageIds((prev) => new Set(prev).add(msg.id));
      toast.success('Answer saved to "Saved" folder in Log!', {
        description: `Stored under [Saved] folder with ${modelUsed} metadata.`,
        action: onNavigateToLog ? {
          label: 'View in Saved',
          onClick: () => {
            onNavigateToLog('Saved');
            onOpenChange(false);
          }
        } : undefined
      });
    } catch (err: any) {
      console.error('Failed to save to log:', err);
      toast.error(`Failed to save: ${err.message || 'Unknown error'}`);
    }
  };

  const handleOpenPrintModal = (msg: Message) => {
    const prompt = msg.query || (messages.find(m => m.sender === 'user' && m.id < msg.id)?.text) || 'Financial Inquiry';
    setPrintModalData({
      id: msg.id,
      query: prompt,
      response: msg.text,
      model: msg.model || selectedModel,
      classification: msg.classification,
      executionTime: msg.executionTime,
      toolsUsed: msg.toolsUsed,
      timestamp: msg.timestamp
    });
  };

  const renderToolBadge = (toolName: string) => {
    let label = toolName;
    let icon = Wrench;
    if (toolName.includes('market_data')) {
      label = 'yfinance (Market Data)';
      icon = TrendingUp;
    } else if (toolName.includes('math_statistics')) {
      label = 'scipy/numpy (Math Sandbox)';
      icon = Calculator;
    } else if (toolName.includes('web_search')) {
      label = 'Tavily (Web Search)';
      icon = Search;
    }

    const IconComponent = icon;
    return (
      <Badge
        key={toolName}
        variant="outline"
        className="text-[10px] bg-sky-500/10 text-sky-300 border-sky-500/30 flex items-center gap-1 py-0.5"
      >
        <IconComponent className="w-2.5 h-2.5" />
        <span>{label}</span>
      </Badge>
    );
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={cn(
            "bg-slate-950/98 border-slate-800 p-0 flex flex-col backdrop-blur-2xl shadow-2xl z-50 text-slate-100 transition-all duration-300",
            isFullScreen
              ? "!inset-0 !w-screen !max-w-none !h-screen border-none rounded-none"
              : "w-full sm:max-w-xl md:max-w-2xl border-l"
          )}
        >
          {/* Header Bar */}
          <SheetHeader className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/50 flex-shrink-0">
            <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-3", isFullScreen && "max-w-5xl mx-auto w-full")}>
              {/* Left: Branding & Tagline */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <SheetTitle className="text-base font-semibold text-white flex items-center gap-2">
                    TradeFlow Copilot
                    <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-300 border-purple-500/30 font-mono">
                      Quant AI
                    </Badge>
                  </SheetTitle>
                  <SheetDescription className="text-xs text-slate-400">
                    Multi-Factor Financial Intelligence & Quantitative Execution
                  </SheetDescription>
                </div>
              </div>

              {/* Right: Model Selector & Fullscreen Toggle */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* AI Model Selector */}
                <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1 text-xs shadow-inner">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-[10px] font-mono text-slate-400 uppercase font-bold hidden sm:inline">Model:</span>
                  <select
                    value={selectedModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    aria-label="Select AI Model"
                    className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer font-medium pr-1 py-0.5"
                  >
                    {COPILOT_MODELS.map((m) => (
                      <option key={m.id} value={m.id} className="bg-slate-950 text-slate-100">
                        {m.name} ({m.badge})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Full Size / Fullscreen Toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors"
                  title={isFullScreen ? "Restore side sheet view" : "Open chat in full size"}
                >
                  {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* Messages Stream Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-sm scrollbar-thin scrollbar-thumb-slate-800">
            <div className={cn("space-y-5", isFullScreen && "max-w-4xl mx-auto w-full")}>
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                const isSaved = savedMessageIds.has(msg.id);
                const isCopied = copiedMsgId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}
                  >
                    {/* Telemetry Header for Agent Messages */}
                    {!isUser && (
                      <div className="flex flex-wrap items-center gap-2 mb-1.5 px-1">
                        {/* Model Pill */}
                        {msg.model && (
                          <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[10px] font-mono font-medium flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                            <span>{msg.model}</span>
                          </Badge>
                        )}

                        {/* Classification Pill */}
                        {msg.classification && (
                          <Badge className={cn(
                            "text-[10px] font-mono font-medium flex items-center gap-1",
                            msg.classification === 'simple_task'
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-purple-500/20 text-purple-300 border-purple-500/40"
                          )}>
                            {msg.classification === 'simple_task' ? (
                              <>
                                <Cpu className="w-2.5 h-2.5 text-emerald-400" />
                                <span>Local (Ollama)</span>
                              </>
                            ) : (
                              <>
                                <Globe2 className="w-2.5 h-2.5 text-purple-400" />
                                <span>Remote (OpenRouter)</span>
                              </>
                            )}
                          </Badge>
                        )}

                        {msg.executionTime && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5 font-mono">
                            <Clock className="w-2.5 h-2.5" />
                            {msg.executionTime}s
                          </span>
                        )}

                        {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                          <div className="flex items-center gap-1">
                            {msg.toolsUsed.map(renderToolBadge)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Router Reasoning Accordion / Callout */}
                    {!isUser && msg.reasoning && (
                      <div className="text-[11px] text-slate-400 italic mb-2 px-2.5 py-1 rounded-xl bg-slate-900/60 border border-slate-800/80 max-w-xl">
                        <span className="font-semibold text-slate-300">Routing Decision:</span> {msg.reasoning}
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={cn(
                        'rounded-2xl px-4 py-3 max-w-[92%] leading-relaxed shadow-sm group relative',
                        isUser
                          ? 'bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground font-medium rounded-tr-xs'
                          : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-xs'
                      )}
                    >
                      <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm">
                        {msg.text}
                      </div>

                      {/* Action Bar for Agent Answers */}
                      {!isUser && msg.id !== 'welcome' && (
                        <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-slate-800/70 justify-end flex-wrap">
                          {/* Copy Action */}
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg)}
                            className="px-2 py-1 rounded-lg text-[11px] font-mono text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center gap-1"
                            title="Copy response markdown"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{isCopied ? 'Copied' : 'Copy'}</span>
                          </button>

                          {/* Print / PDF Reader Action */}
                          <button
                            type="button"
                            onClick={() => handleOpenPrintModal(msg)}
                            className="px-2 py-1 rounded-lg text-[11px] font-mono text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center gap-1"
                            title="Open stylized reader & print to PDF"
                          >
                            <Printer className="w-3 h-3 text-indigo-400" />
                            <span>Print / PDF</span>
                          </button>

                          {/* Save to Log Action */}
                          <button
                            type="button"
                            onClick={() => handleSaveToLog(msg)}
                            disabled={isSaved}
                            className={cn(
                              "px-2 py-1 rounded-lg text-[11px] font-mono transition-colors flex items-center gap-1",
                              isSaved
                                ? "text-emerald-400 bg-emerald-500/10"
                                : "text-slate-400 hover:text-emerald-300 hover:bg-slate-800/80"
                            )}
                            title="Save this answer to 'Saved' folder in Log section"
                          >
                            {isSaved ? <BookmarkCheck className="w-3 h-3 text-emerald-400" /> : <Bookmark className="w-3 h-3 text-emerald-400" />}
                            <span>{isSaved ? 'Saved in Log' : 'Save to Log'}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </div>
                );
              })}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-indigo-400 animate-pulse" />
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-300 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="text-xs text-slate-300 font-mono">
                      Evaluating financial triage in LangGraph with {COPILOT_MODELS.find(m => m.id === selectedModel)?.name}...
                    </span>
                  </div>
                </div>
              )}

              <div ref={scrollEndRef} />
            </div>
          </div>

          {/* Quick Suggestions Chips */}
          <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-900/30 overflow-x-auto flex-shrink-0">
            <div className={cn(isFullScreen && "max-w-4xl mx-auto w-full")}>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Sample Prompts</span>
              </p>
              <div className="flex items-center gap-1.5 pb-1 overflow-x-auto scrollbar-none">
                {SUGGESTED_QUERIES.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSend(item.query)}
                      disabled={isLoading}
                      className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Icon className="w-3 h-3 text-primary" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Input Bar */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex-shrink-0">
            <div className={cn(isFullScreen && "max-w-4xl mx-auto w-full")}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder={`Ask financial question, run math, or synthesize macro (${COPILOT_MODELS.find(m => m.id === selectedModel)?.name})...`}
                  disabled={isLoading}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading || !inputQuery.trim()}
                  className="rounded-xl px-4 bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 font-semibold"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Send</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Stylized Research Note Reader & PDF Print Modal */}
      <CopilotPrintModal
        isOpen={Boolean(printModalData)}
        onClose={() => setPrintModalData(null)}
        data={printModalData}
        isSaved={printModalData ? savedMessageIds.has(printModalData.id) : false}
        onSaveToLog={() => {
          if (!printModalData) return;
          const msg = messages.find(m => m.id === printModalData.id);
          if (msg) handleSaveToLog(msg);
        }}
      />
    </>
  );
}

// Floating button to summon Copilot from any view in the app
export function HybridAgentFloatingTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium text-xs sm:text-sm shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-105 active:scale-95 transition-all duration-200 border border-indigo-400/30 group"
      title="Open TradeFlow Hybrid AI Copilot"
    >
      <div className="relative">
        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
      </div>
      <span className="font-semibold tracking-wide">AI Copilot</span>
      <Badge className="bg-white/20 text-white text-[9px] px-1.5 py-0 border-none font-mono">
        Hybrid
      </Badge>
    </button>
  );
}
