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
  Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  classification?: 'simple_task' | 'complex_analysis';
  reasoning?: string;
  toolsUsed?: string[];
  executionTime?: number;
  timestamp: string;
}

interface HybridAgentCopilotProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function HybridAgentCopilot({ isOpen, onOpenChange }: HybridAgentCopilotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: "👋 **Hello! I'm your Hybrid Financial Copilot.**\n\nI dynamically route requests between your **local Ollama (`llama3.1`)** instance for basic ticker lookups and statistical calculations (to save on API expenses), and a **remote OpenRouter frontier model** for deep macroeconomic and cross-asset synthesis.\n\nTry one of the quick suggestions below or enter your own financial query!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

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
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();

      const agentMessage: Message = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: data.response || 'No response returned from agent.',
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
        text: `⚠️ **Execution Error:** ${err.message || 'The hybrid agent encountered an unexpected error.'}\n\nPlease verify that Ollama is running and your API keys are set in \`.env.local\`.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl bg-slate-950/95 border-l border-slate-800 p-0 flex flex-col backdrop-blur-xl shadow-2xl z-50 text-slate-100"
      >
        {/* Header */}
        <SheetHeader className="p-4 sm:p-6 border-b border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold text-white flex items-center gap-2">
                  TradeFlow Hybrid Copilot
                  <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-300 border-purple-500/30 font-mono">
                    LangGraph
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-400">
                  Dynamic Local/Remote Financial Routing
                </SheetDescription>
              </div>
            </div>

            {/* Architecture Node Status Pills */}
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                <span>Ollama (Llama 3.1)</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                <Globe2 className="w-3 h-3" />
                <span>OpenRouter</span>
              </span>
            </div>
          </div>
        </SheetHeader>

        {/* Message Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-sm scrollbar-thin scrollbar-thumb-slate-800">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}
              >
                {/* Router Telemetry Header for Agent Messages */}
                {!isUser && msg.classification && (
                  <div className="flex flex-wrap items-center gap-2 mb-1.5 px-1">
                    {msg.classification === 'simple_task' ? (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-medium flex items-center gap-1">
                        <Cpu className="w-3 h-3" />
                        <span>Routed Locally (Ollama: llama3.1)</span>
                      </Badge>
                    ) : (
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] font-medium flex items-center gap-1">
                        <Globe2 className="w-3 h-3" />
                        <span>Routed Remotely (OpenRouter Frontier)</span>
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
                  <div className="text-[11px] text-slate-400 italic mb-2 px-2 py-1 rounded bg-slate-900/60 border border-slate-800/80 max-w-xl">
                    <span className="font-semibold text-slate-300">Routing Decision:</span> {msg.reasoning}
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={cn(
                    'rounded-2xl px-4 py-3 max-w-[90%] leading-relaxed shadow-sm',
                    isUser
                      ? 'bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground font-medium rounded-tr-xs'
                      : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-xs'
                  )}
                >
                  <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm">
                    {msg.text}
                  </div>
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
                  Evaluating triage in LangGraph...
                </span>
              </div>
            </div>
          )}

          <div ref={scrollEndRef} />
        </div>

        {/* Quick Suggestions Chips */}
        <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-900/30 overflow-x-auto">
          <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Sample Prompts</span>
          </p>
          <div className="flex items-center gap-1.5 pb-1">
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

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60">
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
              placeholder="Ask a stock price, calculate portfolio VaR, or request macro synthesis..."
              disabled={isLoading}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !inputQuery.trim()}
              className="rounded-xl px-4 bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5"
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
      </SheetContent>
    </Sheet>
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
