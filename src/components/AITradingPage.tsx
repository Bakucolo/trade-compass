// src/components/AITradingPage.tsx
// Redesigned AI Trading Section: Multi-Broker Terminal, Fluid Conversational LLM, Zero Balances/Positions

import React, { useState } from 'react';
import { AiTradingBrokerBar, SupportedBroker } from './aiTrading/AiTradingBrokerBar';
import { AiTradingLlmConsole, ChatMessage } from './aiTrading/AiTradingLlmConsole';
import { AiTradingOrdersWorkspace } from './aiTrading/AiTradingOrdersWorkspace';
import { AiBacktester } from './aiTrading/AiBacktester';
import { AiStrategyDiscovery } from './aiTrading/AiStrategyDiscovery';
import { AiDeployedStrategies } from './aiTrading/AiDeployedStrategies';
import { AiSettingsGuardrails } from './aiTrading/AiSettingsGuardrails';
import { FullWindowOptionsTradeStationModal } from './aiTrading/FullWindowOptionsTradeStationModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { 
  Bot, 
  Terminal, 
  BarChart3, 
  BrainCircuit, 
  Sliders, 
  ShieldCheck 
} from 'lucide-react';
import { StagedDraftOrder } from '@/services/tastytrade';
import { cn } from '@/lib/utils';

interface AITradingPageProps {
  onNavigateToResearch?: (symbol: string) => void;
  onNavigateToGraphs?: (symbol?: string) => void;
}

export const AITradingPage: React.FC<AITradingPageProps> = ({
  onNavigateToResearch,
  onNavigateToGraphs,
}) => {
  // Default broker MUST be Tastytrade per user requirement
  const [activeBroker, setActiveBroker] = useState<SupportedBroker>('tastytrade');
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  const [activeSubTab, setActiveSubTab] = useState<
    'terminal' | 'backtest' | 'ai-discovery' | 'deployed' | 'settings'
  >('terminal');

  // Shared conversational messages in the LLM Trading Console
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isTradeStationOpen, setIsTradeStationOpen] = useState(false);

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleTriggerRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6 pb-12 max-w-[1600px] mx-auto">
      {/* Top Broker Selector & Controls Bar (Zero Balances / Positions) */}
      <AiTradingBrokerBar
        activeBroker={activeBroker}
        onSelectBroker={setActiveBroker}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        onClearChat={handleClearChat}
        isChatEmpty={messages.length === 0}
        onOpenTradeStation={() => setIsTradeStationOpen(true)}
      />

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('terminal')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
            activeSubTab === 'terminal'
              ? "bg-secondary text-foreground shadow-sm border border-border/80"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          )}
        >
          <Terminal className="w-4 h-4 text-primary" />
          <span>AI Trading Terminal & Orders</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('backtest')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
            activeSubTab === 'backtest'
              ? "bg-secondary text-foreground shadow-sm border border-border/80"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          )}
        >
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <span>Strategy Backtester</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('ai-discovery')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
            activeSubTab === 'ai-discovery'
              ? "bg-secondary text-foreground shadow-sm border border-border/80"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          )}
        >
          <BrainCircuit className="w-4 h-4 text-amber-400" />
          <span>AI Strategy Explorer</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('deployed')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
            activeSubTab === 'deployed'
              ? "bg-secondary text-foreground shadow-sm border border-border/80"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          )}
        >
          <Bot className="w-4 h-4 text-blue-400" />
          <span>Deployed Strategies</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('settings')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
            activeSubTab === 'settings'
              ? "bg-secondary text-foreground shadow-sm border border-border/80"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          )}
        >
          <Sliders className="w-4 h-4 text-rose-400" />
          <span>Risk & Safety Guardrails</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div>
        {activeSubTab === 'terminal' && (
          <ErrorBoundary fallbackTitle="AI Trading Terminal">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Conversational LLM Terminal */}
              <div className="lg:col-span-7">
                <AiTradingLlmConsole
                  activeBroker={activeBroker}
                  selectedModel={selectedModel}
                  messages={messages}
                  setMessages={setMessages}
                  onRefreshOrders={handleTriggerRefresh}
                />
              </div>

              {/* Right Column: Staged Drafts & Orders Workspace (Zero Balances/Positions) */}
              <div className="lg:col-span-5">
                <AiTradingOrdersWorkspace
                  key={refreshKey}
                  activeBroker={activeBroker}
                  onRefreshNeeded={handleTriggerRefresh}
                  onOpenTradeStation={() => setIsTradeStationOpen(true)}
                />
              </div>
            </div>
          </ErrorBoundary>
        )}

        {activeSubTab === 'backtest' && (
          <ErrorBoundary fallbackTitle="Strategy Backtester">
            <AiBacktester />
          </ErrorBoundary>
        )}

        {activeSubTab === 'ai-discovery' && (
          <ErrorBoundary fallbackTitle="AI Strategy Discovery">
            <AiStrategyDiscovery />
          </ErrorBoundary>
        )}

        {activeSubTab === 'deployed' && (
          <ErrorBoundary fallbackTitle="Deployed Strategies">
            <AiDeployedStrategies onNavigateToBacktest={() => setActiveSubTab('backtest')} />
          </ErrorBoundary>
        )}

        {activeSubTab === 'settings' && (
          <ErrorBoundary fallbackTitle="Position Sizing & Safety Guardrails">
            <AiSettingsGuardrails />
          </ErrorBoundary>
        )}
      </div>

      {/* Full-Window Options Trade Station Modal */}
      <FullWindowOptionsTradeStationModal
        open={isTradeStationOpen}
        onOpenChange={setIsTradeStationOpen}
        defaultBroker={activeBroker}
        onOrderStaged={() => {
          handleTriggerRefresh();
        }}
      />
    </div>
  );
};

export default AITradingPage;
