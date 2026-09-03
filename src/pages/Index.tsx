import { useState, useEffect, lazy, Suspense } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

// Lazy-loaded route components for lightning-fast initial load & chunk splitting
const Dashboard = lazy(() => import('@/components/Dashboard').then((m) => ({ default: m.Dashboard })));
const WatchlistPage = lazy(() => import('@/components/WatchlistPage').then((m) => ({ default: m.WatchlistPage })));
const GraphsPage = lazy(() => import('@/components/GraphsPage').then((m) => ({ default: m.GraphsPage })));
const MacroPage = lazy(() => import('@/components/MacroPage').then((m) => ({ default: m.MacroPage })));
const TradesPage = lazy(() => import('@/components/TradesPage').then((m) => ({ default: m.TradesPage })));
const IdeasPage = lazy(() => import('@/components/IdeasPage').then((m) => ({ default: m.IdeasPage })));
const LogPage = lazy(() => import('@/components/LogPage').then((m) => ({ default: m.LogPage })));
const ScannerPage = lazy(() => import('@/components/ScannerPage').then((m) => ({ default: m.ScannerPage })));
const ResearchPage = lazy(() => import('@/components/ResearchPage').then((m) => ({ default: m.ResearchPage })));
const AlertsPage = lazy(() => import('@/components/AlertsPage').then((m) => ({ default: m.AlertsPage })));
const BrokersPage = lazy(() => import('@/components/BrokersPage').then((m) => ({ default: m.BrokersPage })));
const SettingsPage = lazy(() => import('@/components/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ManagementPage = lazy(() => import('@/components/ManagementPage').then((m) => ({ default: m.ManagementPage })));
const ScorecardsPage = lazy(() => import('@/components/ScorecardsPage').then((m) => ({ default: m.ScorecardsPage })));
const EarningsPage = lazy(() => import('@/components/EarningsPage').then((m) => ({ default: m.EarningsPage })));

// Sleek loading skeleton fallback for seamless page transitions
const PageLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-fade-in">
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
      </div>
    </div>
    <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
      Loading View...
    </p>
  </div>
);

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [researchTicker, setResearchTicker] = useState('AAPL');

  const handleNavigateToResearch = (symbol: string) => {
    setResearchTicker(symbol);
    setActiveTab('research');
  };

  const handleNavigateToGraphs = (_symbol?: string) => {
    setActiveTab('graphs');
  };

  useEffect(() => {
    const handleTickerEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        handleNavigateToResearch(customEvent.detail);
      }
    };
    window.addEventListener('select-research-ticker', handleTickerEvent);
    return () => window.removeEventListener('select-research-ticker', handleTickerEvent);
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
        return <GraphsPage onNavigateToResearch={handleNavigateToResearch} />;
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
            onNavigateToResearch={handleNavigateToResearch}
            onNavigateToIdeas={() => setActiveTab('ideas')}
            onNavigateToTrades={() => setActiveTab('trades')}
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
        return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8">
          <ErrorBoundary fallbackTitle={`${activeTab.toUpperCase()} View`}>
            <Suspense fallback={<PageLoadingFallback />}>
              {renderContent()}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default Index;
