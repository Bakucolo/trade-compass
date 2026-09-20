// src/components/aiTrading/AiTradingBrokerBar.tsx
// Broker Selector & AI Trading Control Bar (Tastytrade default, Alpaca, IBKR)

import React from 'react';
import { 
  Bot, 
  ShieldCheck, 
  RotateCcw, 
  CheckCircle2, 
  Cpu, 
  Lock,
  Activity
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIBKRClientPortalStatus } from '@/services/ibkr';
import { BuyingPowerModal } from './BuyingPowerModal';

export type SupportedBroker = 'tastytrade' | 'alpaca' | 'ibkr';

interface AiTradingBrokerBarProps {
  activeBroker: SupportedBroker;
  onSelectBroker: (broker: SupportedBroker) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  onClearChat?: () => void;
  isChatEmpty?: boolean;
}

export const AiTradingBrokerBar: React.FC<AiTradingBrokerBarProps> = ({
  activeBroker,
  onSelectBroker,
  selectedModel,
  onSelectModel,
  onClearChat,
  isChatEmpty = false,
}) => {
  const brokers: {
    id: SupportedBroker;
    name: string;
    badge: string;
    envName: string;
    endpoint: string;
    instruments: string;
    color: string;
    borderColor: string;
    bgActive: string;
  }[] = [
    {
      id: 'tastytrade',
      name: 'Tastytrade',
      badge: 'Default',
      envName: 'Certification Sandbox',
      endpoint: 'api.cert.tastyworks.com',
      instruments: 'Options Chains & Equities',
      color: 'text-rose-400',
      borderColor: 'border-rose-500/40',
      bgActive: 'bg-rose-500/15 text-rose-200 border-rose-500/60 shadow-rose-950/40'
    },
    {
      id: 'alpaca',
      name: 'Alpaca Markets',
      badge: 'Paper',
      envName: 'Paper Trading API',
      endpoint: 'paper-api.alpaca.markets',
      instruments: 'Equities & Algorithmic Orders',
      color: 'text-amber-400',
      borderColor: 'border-amber-500/40',
      bgActive: 'bg-amber-500/15 text-amber-200 border-amber-500/60 shadow-amber-950/40'
    },
    {
      id: 'ibkr',
      name: 'Interactive Brokers',
      badge: 'Client Portal (Paper)',
      envName: 'IBKR Gateway (Paper DU1234567)',
      endpoint: 'localhost:5000/v1/api',
      instruments: 'Equities, Options & Tool Calling',
      color: 'text-blue-400',
      borderColor: 'border-blue-500/40',
      bgActive: 'bg-blue-500/15 text-blue-200 border-blue-500/60 shadow-blue-950/40'
    }
  ];

  const currentBroker = brokers.find((b) => b.id === activeBroker) || brokers[0];
  const { data: ibkrStatus } = useIBKRClientPortalStatus();

  return (
    <div className="bg-card/90 border border-border/80 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-sm space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Section branding and description */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              AI Trading Terminal
              <Badge variant="outline" className="text-[10px] font-mono font-medium border-primary/40 text-primary bg-primary/10">
                Multi-Broker
              </Badge>
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Interact with the LLM to request live quotes, analyze option chains, stage trade drafts, and monitor order routing with human-in-the-loop safety.
          </p>
        </div>

        {/* Right: Security & Model Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/60 border border-border text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-[11px] font-medium text-foreground">Human-in-the-Loop Rule</span>
            <Lock className="w-3 h-3 text-muted-foreground" />
          </div>

          {/* Model Selector */}
          <div className="flex items-center gap-1.5 bg-secondary/70 border border-border rounded-xl px-2 py-1 text-xs">
            <Cpu className="w-3.5 h-3.5 text-primary" />
            <select
              value={selectedModel}
              onChange={(e) => onSelectModel(e.target.value)}
              className="bg-transparent text-xs font-mono font-medium text-foreground focus:outline-none cursor-pointer pr-1"
            >
              <option value="auto" className="bg-card text-foreground">Auto Cascade (Optimal)</option>
              <option value="anthropic/claude-3.5-sonnet" className="bg-card text-foreground">Claude 3.5 Sonnet</option>
              <option value="openai/gpt-4o" className="bg-card text-foreground">GPT-4o (Reasoning)</option>
              <option value="deepseek/deepseek-r1" className="bg-card text-foreground">DeepSeek R1</option>
              <option value="meta-llama/llama-3.3-70b-instruct" className="bg-card text-foreground">Llama 3.3 70B</option>
              <option value="local/quant" className="bg-card text-foreground">Local Quant</option>
            </select>
          </div>

          {/* Quick Buying Power & Margin Analyser */}
          <BuyingPowerModal />

          {/* Clear chat action */}
          {onClearChat && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearChat}
              disabled={isChatEmpty}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground border-border hover:bg-secondary/60"
              title="Clear current terminal conversation"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset Chat
            </Button>
          )}
        </div>
      </div>

      {/* Broker Selector Tabs */}
      <div className="pt-2 border-t border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono mr-1">
            Active Broker:
          </span>
          {brokers.map((broker) => {
            const isSelected = activeBroker === broker.id;
            return (
              <button
                key={broker.id}
                type="button"
                onClick={() => onSelectBroker(broker.id)}
                className={cn(
                  "relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border shadow-sm cursor-pointer whitespace-nowrap",
                  isSelected
                    ? broker.bgActive
                    : "bg-secondary/40 text-muted-foreground hover:text-foreground border-border/80 hover:bg-secondary/80"
                )}
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isSelected ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/50"
                  )}
                />
                <span>{broker.name}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] font-mono px-1 py-0 h-4 uppercase font-bold",
                    isSelected
                      ? "border-current bg-background/50 text-current"
                      : "border-border text-muted-foreground bg-secondary/50"
                  )}
                >
                  {broker.badge}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* Selected Broker Environment Summary Pill */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 border border-border/70 rounded-xl px-3 py-1.5 font-mono">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="font-semibold text-foreground">{currentBroker.envName}</span>
          <span className="text-muted-foreground/60 hidden sm:inline">|</span>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">{currentBroker.endpoint}</span>
          <span className="text-muted-foreground/60 hidden md:inline">|</span>
          <span className="text-[11px] text-primary/90 hidden md:inline">{currentBroker.instruments}</span>
          {activeBroker === 'ibkr' && (
            <>
              <span className="text-muted-foreground/60 hidden lg:inline">|</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                <Activity className="w-3 h-3 animate-pulse text-emerald-400" />
                Tickle Heartbeat (2m)
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
