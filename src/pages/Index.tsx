import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/components/Dashboard';
import { WatchlistPage } from '@/components/WatchlistPage';
import { TradesPage } from '@/components/TradesPage';
import { IdeasPage } from '@/components/IdeasPage';
import { ResearchPage } from '@/components/ResearchPage';
import { BrokersPage } from '@/components/BrokersPage';
import { SettingsPage } from '@/components/SettingsPage';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'watchlist':
        return <WatchlistPage />;
      case 'trades':
        return <TradesPage />;
      case 'ideas':
        return <IdeasPage />;
      case 'research':
        return <ResearchPage />;
      case 'brokers':
        return <BrokersPage />;
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
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Index;
