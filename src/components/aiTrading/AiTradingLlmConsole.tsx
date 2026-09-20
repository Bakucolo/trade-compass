// src/components/aiTrading/AiTradingLlmConsole.tsx
// Embedded Conversational Trading Terminal for Multi-Broker LLM Function-Calling

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  TrendingUp,
  BarChart2,
  ShieldCheck,
  Zap,
  ArrowRight,
  Layers,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DraftOrderCard } from '../DraftOrderCard';
import { OptionChainCard } from '../OptionChainCard';
import { StagedDraftOrder, FormattedOptionChain } from '@/services/tastytrade';
import { SupportedBroker } from './AiTradingBrokerBar';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  toolsUsed?: string[];
  draftOrder?: StagedDraftOrder;
  optionChain?: FormattedOptionChain;
  model?: string;
  executionTime?: number;
  timestamp: string;
}

interface AiTradingLlmConsoleProps {
  activeBroker: SupportedBroker;
  selectedModel: string;
  onDraftOrderCreated?: (draft: StagedDraftOrder) => void;
  onRefreshOrders?: () => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export const AiTradingLlmConsole: React.FC<AiTradingLlmConsoleProps> = ({
  activeBroker,
  selectedModel,
  onDraftOrderCreated,
  onRefreshOrders,
  messages,
  setMessages,
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Dynamic quick prompt suggestions per broker
  const brokerPrompts: Record<SupportedBroker, { label: string; prompt: string; icon: string }[]> = {
    tastytrade: [
      {
        label: 'Compare BP: 50 AAPL',
        prompt: 'Compare buying power and margin requirements for 50 shares of AAPL on Tastytrade vs Interactive Brokers.',
        icon: '⚖️'
      },
      {
        label: 'Draft AAPL Limit Buy',
        prompt: 'Draft a limit buy order for 10 shares of AAPL at $220.00 limit in Tastytrade Sandbox.',
        icon: '⚡'
      },
      {
        label: 'SPY Options Chain',
        prompt: 'Show the option chain for SPY for the nearest monthly expiration.',
        icon: '📊'
      },
      {
        label: 'NVDA Quote & Metrics',
        prompt: 'Get market quote, IV rank, and day range for NVDA.',
        icon: '📈'
      },
      {
        label: 'Check Staged & Open Orders',
        prompt: 'Show all my current orders and staged drafts.',
        icon: '📋'
      }
    ],
    alpaca: [
      {
        label: 'Draft TSLA Market Buy',
        prompt: 'Draft a market buy order for 5 shares of TSLA on Alpaca Paper.',
        icon: '⚡'
      },
      {
        label: 'MSFT Live Quote',
        prompt: 'Get current price, bid/ask spread, and day range for MSFT.',
        icon: '📈'
      },
      {
        label: 'Draft SPY Limit Buy',
        prompt: 'Draft a limit buy order for 2 shares of SPY at $560.00 on Alpaca.',
        icon: '⚡'
      },
      {
        label: 'Check Alpaca Orders',
        prompt: 'List recent orders submitted to Alpaca paper trading.',
        icon: '📋'
      }
    ],
    ibkr: [
      {
        label: 'Compare BP: 100 SPY',
        prompt: 'Compare buying power, initial margin, and fees between IBKR and Tastytrade for buying 100 shares of SPY.',
        icon: '⚖️'
      },
      {
        label: 'IBKR Account Summary',
        prompt: 'Show my IBKR paper trading account summary, Net Liquidation Value, and Buying Power.',
        icon: '💼'
      },
      {
        label: 'Draft AAPL Limit Buy',
        prompt: 'Draft a limit buy order for 10 shares of AAPL at $220.00 limit on my IBKR paper account.',
        icon: '⚡'
      },
      {
        label: 'IBKR Portfolio Positions',
        prompt: 'Show my current open portfolio positions and unrealized P&L on IBKR.',
        icon: '📊'
      },
      {
        label: 'Inspect IBKR Orders',
        prompt: 'Check recent orders on the Interactive Brokers Client Portal Gateway.',
        icon: '📋'
      }
    ]
  };

  const currentPrompts = brokerPrompts[activeBroker] || brokerPrompts.tastytrade;

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent/hybrid-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToSend,
          model: selectedModel,
          broker: activeBroker,
          history: messages.slice(-8).map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text
          }))
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();

      const agentMessage: ChatMessage = {
        id: `msg_agent_${Date.now()}`,
        sender: 'agent',
        text: data.response || 'Action completed successfully.',
        toolsUsed: data.tools_used || [],
        draftOrder: data.draftOrder,
        optionChain: data.optionChain,
        model: data.model || selectedModel,
        executionTime: data.execution_time_seconds,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, agentMessage]);

      if (data.draftOrder) {
        onDraftOrderCreated?.(data.draftOrder);
        onRefreshOrders?.();
        toast.info('New Order Staged', {
          description: `Staged draft for ${data.draftOrder.quantity} ${data.draftOrder.symbol} on ${activeBroker.toUpperCase()}. Click Approve Trade to execute.`
        });
      }
    } catch (err: any) {
      console.error('[AI Trading Console Error]', err);
      const errorMessage: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        sender: 'agent',
        text: `⚠️ **Execution Notice**: ${err.message || 'An error occurred while contacting the AI trading router.'}\n\nPlease verify network connection and try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to trigger a drafted option order when user selects a strike from OptionChainCard
  const handleSelectOptionStrike = (
    strike: number,
    type: 'Call' | 'Put',
    symbol: string,
    expiration?: string,
    price?: number,
    action: 'BUY' | 'SELL' = 'BUY'
  ) => {
    const isShort = action === 'SELL';
    const actionPhrase = isShort ? 'sell to open (short)' : 'limit buy';
    const expStr = expiration ? ` ${expiration}` : '';
    const priceStr = price !== undefined ? ` at $${price.toFixed(2)} limit` : ' at $1.50 limit';
    const prompt = `Draft a ${actionPhrase} order for 1 contract of ${symbol}${expStr} $${strike.toFixed(2)} ${type}${priceStr} on ${activeBroker}.`;
    handleSendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-[740px] bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xl">
      {/* Console Top Header */}
      <div className="px-4 py-3 bg-secondary/40 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
            {activeBroker.toUpperCase()} AI Terminal
          </span>
          <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground bg-secondary/80">
            Interactive LLM
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>Target Broker:</span>
          <span className="font-semibold text-foreground capitalize">{activeBroker}</span>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 font-sans text-sm">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
              <Sparkles className="w-7 h-7 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-base text-foreground">
                How can I assist your {activeBroker.toUpperCase()} trading today?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                I can stage order drafts with physical approval protection, query options chains, retrieve market quotes, and monitor active orders without exposing balances or positions.
              </p>
            </div>

            {/* Quick Prompts Grid */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-left">
              {currentPrompts.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(item.prompt)}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-secondary/50 hover:bg-secondary/90 border border-border/80 text-xs text-foreground transition-all hover:border-primary/40 group shadow-sm text-left"
                >
                  <span className="text-base flex-shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {item.prompt}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 max-w-3xl",
                  isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold shadow-sm",
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary border border-border text-primary"
                  )}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Content Bubble */}
                <div className="space-y-2 max-w-[85%] sm:max-w-[90%]">
                  <div
                    className={cn(
                      "p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm",
                      isUser
                        ? "bg-primary text-primary-foreground rounded-tr-none font-medium"
                        : "bg-secondary/70 border border-border/80 text-foreground rounded-tl-none backdrop-blur-sm"
                    )}
                  >
                    {/* Tool badges if any */}
                    {!isUser && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mb-2.5 pb-2 border-b border-border/60">
                        {msg.toolsUsed.map((tool) => (
                          <Badge
                            key={tool}
                            variant="outline"
                            className="text-[10px] font-mono bg-background/50 border-border text-muted-foreground flex items-center gap-1"
                          >
                            <Zap className="w-2.5 h-2.5 text-primary" />
                            {tool}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Markdown rendering with clean typography & table support */}
                    <div className="prose prose-invert prose-xs sm:prose-sm max-w-none break-words [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4 [&>table]:w-full [&>table]:text-left [&>table]:border-collapse [&>table]:my-2 [&>table_th]:border-b [&>table_th]:border-border [&>table_th]:pb-1.5 [&>table_th]:font-mono [&>table_th]:text-[11px] [&>table_td]:py-1.5 [&>table_td]:border-b [&>table_td]:border-border/40 [&>table_td]:font-mono [&>table_td]:text-[11px]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.text.replace(/<br\s*\/?>/gi, '\n')}
                      </ReactMarkdown>
                    </div>

                    {/* Inline Interactive Draft Order Card */}
                    {msg.draftOrder && (
                      <div className="mt-3">
                        <DraftOrderCard
                          initialDraft={msg.draftOrder}
                          onStatusChange={() => {
                            onRefreshOrders?.();
                          }}
                        />
                      </div>
                    )}

                    {/* Inline Interactive Option Chain Card */}
                    {msg.optionChain && (() => {
                      const prevUserMsg = messages.slice(0, idx).reverse().find(m => m.role === 'user');
                      const isShortDefault = prevUserMsg && /\b(short|sell|credit|sto)\b/i.test(prevUserMsg.content || '');

                      return (
                        <div className="mt-3">
                          <OptionChainCard
                            chain={msg.optionChain}
                            defaultAction={isShortDefault ? 'SELL' : 'BUY'}
                            onSelectContract={(action, type, strike, expiration, contractSymbol, price) => {
                              handleSelectOptionStrike(
                                strike,
                                type === 'CALL' ? 'Call' : 'Put',
                                msg.optionChain?.symbol || '',
                                expiration,
                                price,
                                action
                              );
                            }}
                            onSelectStrike={handleSelectOptionStrike}
                          />
                        </div>
                      );
                    })()}
                  </div>

                  {/* Message timestamp and meta */}
                  <div
                    className={cn(
                      "flex items-center gap-2 text-[10px] font-mono text-muted-foreground px-1",
                      isUser ? "justify-end" : "justify-start"
                    )}
                  >
                    <span>{msg.timestamp}</span>
                    {!isUser && msg.executionTime && (
                      <>
                        <span>·</span>
                        <span>{msg.executionTime.toFixed(2)}s</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-3 mr-auto max-w-md">
            <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0 text-primary">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-3.5 rounded-2xl rounded-tl-none bg-secondary/60 border border-border/80 flex items-center gap-2.5 text-xs text-muted-foreground font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>Analyzing market data & drafting tools for {activeBroker}...</span>
            </div>
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>

      {/* Suggested Quick Prompt Chips (Always available below messages) */}
      <div className="px-4 py-2 bg-secondary/30 border-t border-border/60 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] font-mono uppercase text-muted-foreground flex-shrink-0">
          Suggestions:
        </span>
        {currentPrompts.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSendMessage(p.prompt)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/60 hover:bg-secondary border border-border/80 text-[11px] text-muted-foreground hover:text-foreground whitespace-nowrap transition-all cursor-pointer"
          >
            <span>{p.icon}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {/* Query Input Box */}
      <div className="p-3 sm:p-4 bg-card border-t border-border">
        <div className="relative flex items-center rounded-xl bg-secondary/50 border border-border focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40 transition-all">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${activeBroker.toUpperCase()} Copilot to draft an order, fetch an option chain, or check a quote...`}
            className="w-full bg-transparent px-3.5 py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
            disabled={isLoading}
          />
          <div className="pr-2.5 flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              onClick={() => handleSendMessage()}
              disabled={!inputQuery.trim() || isLoading}
              className="h-8 w-8 p-0 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center justify-center transition-all disabled:opacity-40"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mt-1.5 px-1">
          <span>Press Enter to send, Shift+Enter for newline</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3 h-3" /> Live execution locked behind physical approval
          </span>
        </div>
      </div>
    </div>
  );
};
