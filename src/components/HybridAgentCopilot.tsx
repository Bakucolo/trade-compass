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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
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
  ChevronDown,
  ShieldAlert,
  Sun,
  Eye,
  Palette,
  Type,
  StretchHorizontal
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createThoughtLog } from '@/services/thoughtLogService';
import { CopilotPrintModal, CopilotPrintableData } from './CopilotPrintModal';
import { DraftOrderCard } from './DraftOrderCard';
import { OptionChainCard } from './OptionChainCard';
import { StagedDraftOrder, FormattedOptionChain } from '@/services/tastytrade';

export interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  query?: string;
  model?: string;
  classification?: 'simple_task' | 'complex_analysis';
  reasoning?: string;
  toolsUsed?: string[];
  draftOrder?: StagedDraftOrder;
  optionChain?: FormattedOptionChain;
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

export type TextTone = 'slate' | 'silver' | 'amber' | 'emerald' | 'cyan';
export type FontSize = 'normal' | 'large' | 'xlarge';
export type WidthMode = 'expansive' | 'full';

export interface TextToneOption {
  id: TextTone;
  name: string;
  badge: string;
  colorHex: string;
  desc: string;
  textClass: string;
  headingClass: string;
  boldClass: string;
  codeClass: string;
  cardBg: string;
  cardBorder: string;
}

export const TEXT_TONES: TextToneOption[] = [
  {
    id: 'slate',
    name: 'Cool Slate',
    badge: 'Default',
    colorHex: '#f1f5f9',
    desc: 'Crisp default high contrast pure white & cool slate',
    textClass: 'text-slate-200',
    headingClass: 'text-white',
    boldClass: 'text-slate-100 font-bold',
    codeClass: 'text-indigo-300 bg-slate-950/80 border-slate-800',
    cardBg: 'bg-slate-900/90',
    cardBorder: 'border-slate-800'
  },
  {
    id: 'silver',
    name: 'Soft Silver',
    badge: 'Low Glare',
    colorHex: '#cbd5e1',
    desc: 'Gentle neutral silver-grey, reduces glare & eye fatigue',
    textClass: 'text-slate-300',
    headingClass: 'text-slate-100',
    boldClass: 'text-slate-100 font-bold',
    codeClass: 'text-slate-200 bg-slate-950/80 border-slate-700/60',
    cardBg: 'bg-slate-900/80',
    cardBorder: 'border-slate-700/60'
  },
  {
    id: 'amber',
    name: 'Warm Amber',
    badge: 'Night Shift',
    colorHex: '#fde68a',
    desc: 'Soothing warm golden glow for evening & dark rooms',
    textClass: 'text-amber-100/90',
    headingClass: 'text-amber-200',
    boldClass: 'text-amber-300 font-bold',
    codeClass: 'text-amber-300 bg-amber-950/40 border-amber-800/50',
    cardBg: 'bg-[#181308]/90',
    cardBorder: 'border-amber-900/50'
  },
  {
    id: 'emerald',
    name: 'Terminal Sage',
    badge: 'Bloomberg',
    colorHex: '#86efac',
    desc: 'Classic Bloomberg terminal green phosphor glow',
    textClass: 'text-emerald-100/90',
    headingClass: 'text-emerald-300',
    boldClass: 'text-emerald-200 font-bold',
    codeClass: 'text-emerald-300 bg-emerald-950/40 border-emerald-800/50',
    cardBg: 'bg-[#09180e]/90',
    cardBorder: 'border-emerald-900/50'
  },
  {
    id: 'cyan',
    name: 'Ice Cyan',
    badge: 'Cyber Glow',
    colorHex: '#7dd3fc',
    desc: 'Futuristic high-clarity electric cyan ice',
    textClass: 'text-cyan-100/90',
    headingClass: 'text-cyan-200',
    boldClass: 'text-cyan-300 font-bold',
    codeClass: 'text-cyan-300 bg-cyan-950/40 border-cyan-800/50',
    cardBg: 'bg-[#08151e]/90',
    cardBorder: 'border-cyan-900/50'
  }
];

export const COPILOT_MODELS: CopilotModelOption[] = [
  {
    id: 'auto',
    name: 'Auto Hybrid (Finance Quant)',
    badge: 'Smart Cascade',
    desc: 'High-speed resilient tool-calling across Groq & OpenRouter with Tastytrade Sandbox integration'
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'Groq Llama / GPT-OSS 120B',
    badge: 'Groq Ultra Fast',
    desc: 'Ultra-fast sub-second tool execution and reasoning via Groq LPUs'
  },
  {
    id: 'inclusionai/ling-3.0-flash-fin:free',
    name: 'Ling 3.0 Flash Finance',
    badge: 'Finance Free',
    desc: 'Fine-tuned specifically for financial statements, quotes, and draft orders'
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B Instruct',
    badge: 'Meta Reasoning',
    desc: "Meta's flagship high-capability reasoning model with automatic provider cascade"
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash',
    badge: 'Google Free',
    desc: 'Google high-speed experimental flash model via OpenRouter'
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
    label: 'Tastytrade Sandbox Balances & Positions',
    icon: TrendingUp,
    type: 'simple_task',
    query: 'Show my Tastytrade account balances, buying power, and current open positions.'
  },
  {
    label: 'Draft Buy Order: AAPL 10 Shares Limit',
    icon: Calculator,
    type: 'simple_task',
    query: 'Draft a limit buy order for 10 shares of Apple (AAPL) at limit price $220.'
  },
  {
    label: 'SPY Option Chain & Volatility Metrics',
    icon: Search,
    type: 'simple_task',
    query: 'Fetch the option chain and implied volatility metrics for SPY.'
  },
  {
    label: 'AAPL Live Price & 52W Range',
    icon: TrendingUp,
    type: 'simple_task',
    query: 'What is the current stock price of Apple (AAPL) and its 52-week high/low?'
  },
  {
    label: 'Macro Inflation vs Yield Curve Synthesis',
    icon: Globe2,
    type: 'complex_analysis',
    query: 'Synthesize current macroeconomic indicators (inflation vs yield curve) into a cross-asset forecasting scenario for equities vs commodities over the next 6 months.'
  }
];

export function HybridAgentCopilot({ isOpen, onOpenChange, onNavigateToLog }: HybridAgentCopilotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: "👋 **Hello! I'm your Hybrid Financial Copilot.**\n\nI dynamically route requests between your **local Ollama (`llama3.1`)** instance for basic ticker lookups and statistical calculations (to save on API expenses), and a **remote OpenRouter/Groq frontier model** for deep macroeconomic and cross-asset synthesis.\n\n⚡ **Interactive Trading:** Ask me to draft orders (e.g. *“Draft a limit buy for 10 AAPL at $220”*), inspect your Tastytrade balances, or fetch option chains.\n\n👁️ **Reading Comfort:** Use the **Eye-Care** icon in the header to dim text brightness, switch to warm amber night-shift tones, or scale font size.",
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

  // Reading & Eye-Care Customization State (Persistent)
  const [textBrightness, setTextBrightness] = useState<number>(() => {
    const saved = localStorage.getItem('tradeflow_copilot_text_brightness');
    return saved ? parseInt(saved, 10) : 100;
  });

  const [textTone, setTextTone] = useState<TextTone>(() => {
    return (localStorage.getItem('tradeflow_copilot_text_tone') as TextTone) || 'slate';
  });

  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (localStorage.getItem('tradeflow_copilot_font_size') as FontSize) || 'normal';
  });

  const [widthMode, setWidthMode] = useState<WidthMode>(() => {
    return (localStorage.getItem('tradeflow_copilot_width_mode') as WidthMode) || 'expansive';
  });

  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (typeof scrollEndRef.current?.scrollIntoView === 'function') {
        scrollEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, isOpen]);

  const handleBrightnessChange = (val: number) => {
    setTextBrightness(val);
    localStorage.setItem('tradeflow_copilot_text_brightness', val.toString());
  };

  const handleToneChange = (tone: TextTone) => {
    setTextTone(tone);
    localStorage.setItem('tradeflow_copilot_text_tone', tone);
    const chosen = TEXT_TONES.find((t) => t.id === tone);
    toast.info(`Text Theme: ${chosen?.name}`, {
      description: chosen?.desc
    });
  };

  const handleFontSizeChange = (size: FontSize) => {
    setFontSize(size);
    localStorage.setItem('tradeflow_copilot_font_size', size);
  };

  const handleWidthModeChange = (mode: WidthMode) => {
    setWidthMode(mode);
    localStorage.setItem('tradeflow_copilot_width_mode', mode);
  };

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
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-6)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

      const response = await fetch('/api/agent/hybrid-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, model: selectedModel, history })
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
        draftOrder: data.draftOrder,
        optionChain: data.optionChain,
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
    let badgeClass = "bg-sky-500/10 text-sky-300 border-sky-500/30";

    if (toolName.includes('draft_order')) {
      label = 'Draft Order (Approval Required)';
      icon = ShieldAlert;
      badgeClass = "bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse";
    } else if (toolName.includes('get_tasty_balances')) {
      label = 'Tastytrade Balances';
      icon = Calculator;
      badgeClass = "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
    } else if (toolName.includes('get_tasty_positions')) {
      label = 'Tastytrade Positions';
      icon = TrendingUp;
      badgeClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    } else if (toolName.includes('get_option_chain')) {
      label = 'Tastytrade Option Chain';
      icon = Search;
      badgeClass = "bg-purple-500/20 text-purple-300 border-purple-500/40";
    } else if (toolName.includes('get_market_metrics')) {
      label = 'IV & Volatility Metrics';
      icon = Sparkles;
      badgeClass = "bg-pink-500/20 text-pink-300 border-pink-500/40";
    } else if (toolName.includes('get_tasty_orders')) {
      label = 'Tastytrade Orders';
      icon = CheckCircle2;
      badgeClass = "bg-blue-500/20 text-blue-300 border-blue-500/40";
    } else if (toolName.includes('get_market_quote')) {
      label = 'Live Market Quote';
      icon = TrendingUp;
    } else if (toolName.includes('market_data')) {
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
        className={cn("text-[10px] flex items-center gap-1 py-0.5", badgeClass)}
      >
        <IconComponent className="w-2.5 h-2.5" />
        <span>{label}</span>
      </Badge>
    );
  };

  const renderFormattedMarkdownContent = (child: React.ReactNode): React.ReactNode => {
    if (typeof child === 'string') {
      if (/<br\s*\/?>/i.test(child)) {
        const parts = child.split(/<br\s*\/?>/i);
        return parts.map((part, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br className="my-0.5" />}
            {part.trim()}
          </React.Fragment>
        ));
      }
      return child;
    }
    if (Array.isArray(child)) {
      return child.map((c, i) => <React.Fragment key={i}>{renderFormattedMarkdownContent(c)}</React.Fragment>);
    }
    return child;
  };

  const activeToneObj = TEXT_TONES.find((t) => t.id === textTone) || TEXT_TONES[0];

  const fontSizeClasses: Record<FontSize, string> = {
    normal: 'text-xs sm:text-sm',
    large: 'text-sm sm:text-base',
    xlarge: 'text-base sm:text-lg'
  };

  const widthContainerClass = isFullScreen
    ? widthMode === 'full'
      ? 'w-full px-3 sm:px-6'
      : 'max-w-[1750px] mx-auto w-full px-3 sm:px-6'
    : 'w-full';

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
          <SheetHeader className="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/50 flex-shrink-0">
            <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-3", widthContainerClass)}>
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
                    {isFullScreen && (
                      <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-300 border-sky-500/30 font-mono hidden sm:inline-flex">
                        Full Screen {widthMode === 'full' ? 'Edge-to-Edge' : 'Expansive'}
                      </Badge>
                    )}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-slate-400">
                    Multi-Factor Financial Intelligence & Quantitative Execution
                  </SheetDescription>
                </div>
              </div>

              {/* Right: Model Selector, Eye-Care Controls & Fullscreen Toggle */}
              <div className="flex items-center gap-2 flex-wrap mr-8 sm:mr-6">
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

                {/* Reading & Eye-Care Appearance Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors flex items-center gap-1.5 border border-slate-800 bg-slate-900/60 shadow-inner"
                      title="Reading & Eye-Care: dim brightness, change text color tone, font scale"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[11px] font-mono text-slate-300 hidden md:inline">{textBrightness}%</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/20 shadow-xs shrink-0"
                        style={{ backgroundColor: activeToneObj.colorHex }}
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    sideOffset={8}
                    className="w-80 p-4 bg-slate-950/98 border border-slate-800 text-slate-100 shadow-2xl backdrop-blur-2xl rounded-2xl space-y-4 z-50"
                  >
                    {/* Popover Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-bold text-white tracking-wide">Reading & Eye-Care</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
                        Anti-Glare
                      </Badge>
                    </div>

                    {/* Text Brightness & Dimmer */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                          <Sun className="w-3.5 h-3.5 text-amber-400" />
                          Text Brightness:
                        </span>
                        <span className="font-mono text-indigo-300 font-bold">{textBrightness}%</span>
                      </div>
                      <Slider
                        value={[textBrightness]}
                        min={50}
                        max={100}
                        step={5}
                        onValueChange={([val]) => handleBrightnessChange(val)}
                        className="cursor-pointer py-1"
                      />
                      {/* Quick Dimming Presets */}
                      <div className="grid grid-cols-4 gap-1 pt-1">
                        {[
                          { label: 'Crisp', val: 100 },
                          { label: 'Soft', val: 85 },
                          { label: 'Dim', val: 70 },
                          { label: 'Night', val: 55 }
                        ].map((p) => (
                          <button
                            key={p.val}
                            type="button"
                            onClick={() => handleBrightnessChange(p.val)}
                            className={cn(
                              "text-[10px] py-1 px-1.5 rounded-lg border font-mono transition-all text-center",
                              textBrightness === p.val
                                ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/60 font-bold shadow-xs"
                                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/60"
                            )}
                          >
                            {p.label} {p.val}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Text Color Tone / Night Shift */}
                    <div className="space-y-2 pt-1 border-t border-slate-800/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                          <Palette className="w-3.5 h-3.5 text-purple-400" />
                          Text Color Tone:
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {TEXT_TONES.map((tone) => (
                          <button
                            key={tone.id}
                            type="button"
                            onClick={() => handleToneChange(tone.id)}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-xl border text-left transition-all",
                              textTone === tone.id
                                ? "bg-slate-800/90 border-indigo-500/60 shadow-xs"
                                : "bg-slate-900/40 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                                style={{ backgroundColor: tone.colorHex }}
                              />
                              <div>
                                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                                  <span>{tone.name}</span>
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-700 text-slate-400 font-mono">
                                    {tone.badge}
                                  </Badge>
                                </div>
                                <div className="text-[10px] text-slate-400 leading-tight">{tone.desc}</div>
                              </div>
                            </div>
                            {textTone === tone.id && (
                              <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-1" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reading Font Size Scale */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                          <Type className="w-3.5 h-3.5 text-emerald-400" />
                          Font Scale:
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'normal', label: 'Normal' },
                          { id: 'large', label: 'Large (+15%)' },
                          { id: 'xlarge', label: 'XL (+30%)' }
                        ].map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleFontSizeChange(f.id as FontSize)}
                            className={cn(
                              "text-[10px] py-1.5 px-2 rounded-lg border font-medium transition-all text-center",
                              fontSize === f.id
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold"
                                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/60"
                            )}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Full Screen Layout Width Mode (visible when in full screen) */}
                    {isFullScreen && (
                      <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                            <StretchHorizontal className="w-3.5 h-3.5 text-sky-400" />
                            Screen Layout Width:
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleWidthModeChange('expansive')}
                            className={cn(
                              "text-[10px] py-1.5 px-2 rounded-lg border font-medium transition-all text-center",
                              widthMode === 'expansive'
                                ? "bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold"
                                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/60"
                            )}
                          >
                            Expansive (1750px)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleWidthModeChange('full')}
                            className={cn(
                              "text-[10px] py-1.5 px-2 rounded-lg border font-medium transition-all text-center",
                              widthMode === 'full'
                                ? "bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold"
                                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/60"
                            )}
                          >
                            Edge-to-Edge (100%)
                          </button>
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>

                {/* Full Size / Fullscreen Toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors shrink-0"
                  title={isFullScreen ? "Restore side sheet view" : "Open chat in full size"}
                >
                  {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* Messages Stream Container */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 space-y-6 text-sm scrollbar-thin scrollbar-thumb-slate-800">
            <div className={cn("space-y-6 transition-all duration-200", widthContainerClass)}>
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
                                <span>Remote (OpenRouter/Groq)</span>
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
                      <div className={cn(
                        "text-[11px] text-slate-400 italic mb-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80",
                        isFullScreen ? "max-w-4xl" : "max-w-xl"
                      )}>
                        <span className="font-semibold text-slate-300">Routing Decision:</span> {msg.reasoning}
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={cn(
                        'rounded-2xl px-4 sm:px-5 py-3.5 sm:py-4 leading-relaxed shadow-sm group relative transition-all duration-200 border',
                        isUser
                          ? 'bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground font-medium rounded-tr-xs ml-auto border-indigo-500/30'
                          : cn(activeToneObj.cardBg, activeToneObj.cardBorder, activeToneObj.textClass, 'rounded-tl-xs w-full'),
                        isUser
                          ? (isFullScreen ? 'max-w-2xl sm:max-w-3xl' : 'max-w-[92%]')
                          : (isFullScreen ? 'w-full max-w-none' : 'w-full max-w-[96%]')
                      )}
                      style={!isUser ? { filter: `brightness(${textBrightness}%)` } : undefined}
                    >
                      {/* Message Content with Custom Font Scale & Markdown Formatting */}
                      <div className={cn("font-sans leading-relaxed", fontSizeClasses[fontSize])}>
                        {isUser ? (
                          <div className="whitespace-pre-wrap font-sans font-medium">
                            {msg.text}
                          </div>
                        ) : (
                          <div className="copilot-markdown-content overflow-x-auto">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                table: ({ node, ...props }) => (
                                  <div className="overflow-x-auto my-3 rounded-xl border border-slate-800/80 shadow-md bg-slate-950/60 backdrop-blur-sm">
                                    <table className="w-full text-left border-collapse text-xs sm:text-sm font-sans" {...props} />
                                  </div>
                                ),
                                thead: ({ node, ...props }) => (
                                  <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-300 font-semibold" {...props} />
                                ),
                                tbody: ({ node, ...props }) => (
                                  <tbody className="divide-y divide-slate-800/50" {...props} />
                                ),
                                tr: ({ node, ...props }) => (
                                  <tr className="hover:bg-slate-800/30 transition-colors" {...props} />
                                ),
                                th: ({ node, children, ...props }) => (
                                  <th className="px-3.5 py-2.5 font-semibold tracking-wider text-[11px] sm:text-xs uppercase text-slate-300" {...props}>
                                    {renderFormattedMarkdownContent(children)}
                                  </th>
                                ),
                                td: ({ node, children, ...props }) => (
                                  <td className="px-3.5 py-2.5 leading-normal" {...props}>
                                    {renderFormattedMarkdownContent(children)}
                                  </td>
                                ),
                                p: ({ node, children, ...props }) => (
                                  <p className="mb-2.5 last:mb-0 leading-relaxed" {...props}>
                                    {renderFormattedMarkdownContent(children)}
                                  </p>
                                ),
                                ul: ({ node, ...props }) => (
                                  <ul className="list-disc list-outside ml-5 mb-3 space-y-1.5" {...props} />
                                ),
                                ol: ({ node, ...props }) => (
                                  <ol className="list-decimal list-outside ml-5 mb-3 space-y-1.5" {...props} />
                                ),
                                li: ({ node, children, ...props }) => (
                                  <li className="leading-relaxed" {...props}>
                                    {renderFormattedMarkdownContent(children)}
                                  </li>
                                ),
                                h1: ({ node, ...props }) => (
                                  <h1 className={cn("text-lg sm:text-xl font-bold mt-4 mb-2 pb-1.5 border-b border-slate-800", activeToneObj.headingClass)} {...props} />
                                ),
                                h2: ({ node, ...props }) => (
                                  <h2 className={cn("text-base sm:text-lg font-bold mt-3 mb-2", activeToneObj.headingClass)} {...props} />
                                ),
                                h3: ({ node, ...props }) => (
                                  <h3 className={cn("text-sm sm:text-base font-semibold mt-2.5 mb-1.5", activeToneObj.headingClass)} {...props} />
                                ),
                                strong: ({ node, ...props }) => (
                                  <strong className={cn("font-bold", activeToneObj.boldClass)} {...props} />
                                ),
                                code: ({ node, className, children, ...props }: any) => {
                                  const isBlock = Boolean(className && /language-/.test(className)) || (typeof children === 'string' && children.includes('\n'));
                                  return !isBlock ? (
                                    <code className={cn("px-1.5 py-0.5 rounded text-[11px] sm:text-xs font-mono border", activeToneObj.codeClass)} {...props}>
                                      {children}
                                    </code>
                                  ) : (
                                    <div className="my-2.5 rounded-xl bg-slate-950 border border-slate-800 p-3 overflow-x-auto text-xs font-mono">
                                      <code className={className} {...props}>
                                        {children}
                                      </code>
                                    </div>
                                  );
                                },
                                blockquote: ({ node, ...props }) => (
                                  <blockquote className="border-l-4 border-indigo-500/60 pl-3.5 py-1.5 my-2.5 bg-indigo-500/5 rounded-r-xl italic text-xs sm:text-sm" {...props} />
                                ),
                              }}
                            >
                              {msg.text}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {/* Interactive Human-in-the-Loop Trade Approval Card */}
                      {msg.draftOrder && (
                        <DraftOrderCard
                          initialDraft={msg.draftOrder}
                          onStatusChange={(updatedDraft) => {
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === msg.id ? { ...m, draftOrder: updatedDraft } : m
                              )
                            );
                          }}
                        />
                      )}

                      {/* Interactive Option Chain Card */}
                      {msg.optionChain && (() => {
                        const prevUserMsg = messages.slice(0, idx).reverse().find(m => m.role === 'user');
                        const isShortDefault = prevUserMsg && /\b(short|sell|credit|sto)\b/i.test(prevUserMsg.content || '');

                        return (
                          <OptionChainCard
                            initialChain={msg.optionChain}
                            chain={msg.optionChain}
                            defaultAction={isShortDefault ? 'SELL' : 'BUY'}
                            onSelectContract={(action, type, strike, expiration, contractSymbol, price) => {
                              const isShort = action === 'SELL';
                              const actionPhrase = isShort ? 'sell to open (short)' : 'limit buy';
                              const priceStr = price !== undefined ? ` at $${price.toFixed(2)} limit` : ' at $1.50 limit';
                              handleSend(`Draft a ${actionPhrase} order for 1 contract of ${msg.optionChain?.symbol} ${expiration} $${strike} ${type}${priceStr}`);
                            }}
                            onSelectStrike={(strike, type, symbol, expiration, price, action) => {
                              const isShort = action === 'SELL';
                              const actionPhrase = isShort ? 'sell to open (short)' : 'limit buy';
                              const priceStr = price !== undefined ? ` at $${price.toFixed(2)} limit` : ' at $1.50 limit';
                              handleSend(`Draft a ${actionPhrase} order for 1 contract of ${symbol} ${expiration || ''} $${strike} ${type}${priceStr}`);
                            }}
                          />
                        );
                      })()}

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
          <div className="px-3 sm:px-4 py-2 border-t border-slate-800/60 bg-slate-900/30 overflow-x-auto flex-shrink-0">
            <div className={widthContainerClass}>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Sample Prompts</span>
              </p>
              <div className="flex items-center gap-2 pb-1 overflow-x-auto scrollbar-none">
                {SUGGESTED_QUERIES.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSend(item.query)}
                      disabled={isLoading}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
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
          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/60 flex-shrink-0">
            <div className={widthContainerClass}>
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
                  placeholder={`Ask financial question, draft orders, inspect balances, or synthesize macro (${COPILOT_MODELS.find(m => m.id === selectedModel)?.name})...`}
                  disabled={isLoading}
                  className={cn(
                    "flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50",
                    fontSizeClasses[fontSize]
                  )}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading || !inputQuery.trim()}
                  className="rounded-xl px-4 sm:px-5 h-10 bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 font-semibold shrink-0"
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

export { HybridAgentFloatingTrigger } from './HybridAgentFloatingTrigger';

