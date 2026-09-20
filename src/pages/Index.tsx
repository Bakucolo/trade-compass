import { useState, useEffect, lazy, Suspense } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageSkeleton } from '@/components/PageSkeleton';
import { HybridAgentFloatingTrigger } from '@/components/HybridAgentFloatingTrigger';

// Code-Split Dynamic Route Chunks for ultra-fast startup and zero-stutter navigation
const Dashboard = lazy(() => import('@/components/Dashboard').then(m => ({ default: m.Dashboard })));
const WatchlistPage = lazy(() => import('@/components/WatchlistPage').then(m => ({ default: m.WatchlistPage })));
const GraphsPage = lazy(() => import('@/components/GraphsPage').then(m => ({ default: m.GraphsPage })));
const MacroPage = lazy(() => import('@/components/MacroPage').then(m => ({ default: m.MacroPage })));
const TradesPage = lazy(() => import('@/components/TradesPage').then(m => ({ default: m.TradesPage })));
const IdeasPage = lazy(() => import('@/components/IdeasPage').then(m => ({ default: m.IdeasPage })));
const LogPage = lazy(() => import('@/components/LogPage').then(m => ({ default: m.LogPage })));
const ScannerPage = lazy(() => import('@/components/ScannerPage').then(m => ({ default: m.ScannerPage })));
const ResearchPage = lazy(() => import('@/components/ResearchPage').then(m => ({ default: m.ResearchPage })));
const AlertsPage = lazy(() => import('@/components/AlertsPage').then(m => ({ default: m.AlertsPage })));
const BrokersPage = lazy(() => import('@/components/BrokersPage').then(m => ({ default: m.BrokersPage })));
const SettingsPage = lazy(() => import('@/components/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ManagementPage = lazy(() => import('@/components/ManagementPage').then(m => ({ default: m.ManagementPage })));
const ScorecardsPage = lazy(() => import('@/components/ScorecardsPage').then(m => ({ default: m.ScorecardsPage })));
const EarningsPage = lazy(() => import('@/components/EarningsPage').then(m => ({ default: m.EarningsPage })));
const AITradingPage = lazy(() => import('@/components/AITradingPage').then(m => ({ default: m.AITradingPage })));
const HybridAgentCopilot = lazy(() => import('@/components/HybridAgentCopilot').then(m => ({ default: m.HybridAgentCopilot })));


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
            onSelectSymbol={(sym) => setGraphsTicker(sym)}
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
      case 'ai-trading':
        return (
          <AITradingPage
            onNavigateToResearch={handleNavigateToResearch}
            onNavigateToGraphs={handleNavigateToGraphs}
          />
        );
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
            <Suspense fallback={<PageSkeleton />}>
              {renderContent()}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      {/* Floating AI Financial Copilot Launcher */}
      <HybridAgentFloatingTrigger onOpen={() => setIsCopilotOpen(true)} />

      {/* Slide-out / Fullscreen Hybrid Copilot Drawer (Dynamically loaded on demand) */}
      <Suspense fallback={null}>
        {isCopilotOpen && (
          <HybridAgentCopilot
            isOpen={isCopilotOpen}
            onOpenChange={setIsCopilotOpen}
            onNavigateToLog={handleNavigateToLog}
          />
        )}
      </Suspense>
    </div>
  );
};

export default Index;
