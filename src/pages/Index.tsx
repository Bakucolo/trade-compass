import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
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
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
            {renderContent()}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default Index;
