import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { HybridAgentCopilot, HybridAgentFloatingTrigger } from '@/components/HybridAgentCopilot';

import { Dashboard } from '@/components/Dashboard';
import { WatchlistPage } from '@/components/WatchlistPage';
import { GraphsPage } from '@/components/GraphsPage';
import { MacroPage } from '@/components/MacroPage';
import { TradesPage } from '@/components/TradesPage';
import { IdeasPage } from '@/components/IdeasPage';
import { LogPage } from '@/components/LogPage';
import { ScannerPage } from '@/components/ScannerPage';
import { ResearchPage } from '@/components/ResearchPage';
import { AlertsPage } from '@/components/AlertsPage';
import { BrokersPage } from '@/components/BrokersPage';
import { SettingsPage } from '@/components/SettingsPage';
import { ManagementPage } from '@/components/ManagementPage';
import { ScorecardsPage } from '@/components/ScorecardsPage';
import { EarningsPage } from '@/components/EarningsPage';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [researchTicker, setResearchTicker] = useState('AAPL');
  const [graphsTicker, setGraphsTicker] = useState('AAPL');
  const [logInitialFolder, setLogInitialFolder] = useState<string | undefined>();
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  const handleNavigateToResearch = (symbol: string) => {
    setResearchTicker(symbol);
    setActiveTab('research');
  };

  const handleNavigateToGraphs = (symbol?: string) => {
    if (symbol && symbol.trim()) {
      const clean = symbol.trim().toUpperCase();
      setGraphsTicker(clean);
      window.dispatchEvent(new CustomEvent('select-graphs-ticker', { detail: clean }));
    }
    setActiveTab('graphs');
  };

  const handleNavigateToLog = (folder?: string) => {
    setLogInitialFolder(folder);
    setActiveTab('log');
  };

  useEffect(() => {
    const handleTickerEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        handleNavigateToResearch(customEvent.detail);
      }
    };

    const handleGraphsEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        handleNavigateToGraphs(customEvent.detail);
      }
    };

    const handleOpenCopilot = () => setIsCopilotOpen(true);

    window.addEventListener('select-research-ticker', handleTickerEvent);
    window.addEventListener('select-graphs-ticker', handleGraphsEvent);
    window.addEventListener('open-hybrid-copilot', handleOpenCopilot);
    return () => {
      window.removeEventListener('select-research-ticker', handleTickerEvent);
      window.removeEventListener('select-graphs-ticker', handleGraphsEvent);
      window.removeEventListener('open-hybrid-copilot', handleOpenCopilot);
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigateTab={setActiveTab}
            onNavigateToResearch={handleNavigateToResearch}
            onNavigateToGraphs={handleNavigateToGraphs}
          />
        );
      case 'scorecards':
        return <ScorecardsPage onNavigateToResearch={handleNavigateToResearch} />;
      case 'management':
        return (
          <ManagementPage
            onNavigateToResearch={handleNavigateToResearch}
            onNavigateToPortfolio={() => setActiveTab('portfolio')}
            onNavigateToGraphs={handleNavigateToGraphs}
          />
        );
      case 'macro':
        return (
          <MacroPage
            onNavigateToResearch={handleNavigateToResearch}
            onNavigateToGraphs={handleNavigateToGraphs}
            onNavigateToTrades={() => setActiveTab('trades')}
          />
        );
      case 'graphs':
        return (
          <GraphsPage
            initialSymbol={graphsTicker}
            onNavigateToResearch={handleNavigateToResearch}
          />
        );
      case 'earnings':
        return (
          <EarningsPage
            onNavigateToResearch={handleNavigateToResearch}
            onNavigateToGraphs={handleNavigateToGraphs}
            onNavigateToWatchlist={() => setActiveTab('watchlist')}
          />
        );
      case 'scanner':
        return (
          <ScannerPage
            onNavigateToResearch={handleNavigateToResearch}
            onNavigateToGraphs={handleNavigateToGraphs}
            onNavigateToLog={() => setActiveTab('log')}
            onNavigateToWatchlist={() => setActiveTab('watchlist')}
          />
        );
      case 'watchlist':
        return <WatchlistPage onNavigateToResearch={handleNavigateToResearch} />;
      case 'log':
        return (
          <LogPage
            initialFolder={logInitialFolder}
            onNavigateToResearch={handleNavigateToResearch}
            onNavigateToIdeas={() => setActiveTab('ideas')}
            onNavigateToTrades={() => setActiveTab('trades')}
            onNavigateToManagement={() => setActiveTab('management')}
          />
        );
      case 'alerts':
        return <AlertsPage onNavigateToResearch={handleNavigateToResearch} />;
      case 'trades':
        return <TradesPage onNavigateToResearch={handleNavigateToResearch} />;
      case 'ideas':
        return <IdeasPage onNavigateToResearch={handleNavigateToResearch} />;
      case 'research':
        return <ResearchPage initialSymbol={researchTicker} onNavigateTab={setActiveTab} />;
      case 'portfolio':
      case 'brokers':
        return (
          <BrokersPage
            onNavigateToResearch={handleNavigateToResearch}
            onNavigateToGraphs={handleNavigateToGraphs}
          />
        );
      case 'settings':
        return <SettingsPage />;
      default:
        return (
          <Dashboard
            onNavigateTab={setActiveTab}
            onNavigateToResearch={handleNavigateToResearch}
            onNavigateToGraphs={handleNavigateToGraphs}
          />
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-background relative">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8">
          <ErrorBoundary fallbackTitle={`${activeTab.toUpperCase()} View`}>
            {renderContent()}
          </ErrorBoundary>
        </div>
      </main>

      {/* Floating AI Financial Copilot Launcher */}
      <HybridAgentFloatingTrigger onOpen={() => setIsCopilotOpen(true)} />

      {/* Slide-out / Fullscreen Hybrid Copilot Drawer */}
      <HybridAgentCopilot
        isOpen={isCopilotOpen}
        onOpenChange={setIsCopilotOpen}
        onNavigateToLog={handleNavigateToLog}
      />
    </div>
  );
};

export default Index;
