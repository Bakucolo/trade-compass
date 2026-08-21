import { portfolioStats } from '@/data/mockData';
import { PortfolioChart } from './PortfolioChart';
import { StatsCard } from './StatsCard';
import { WatchlistCard } from './WatchlistCard';
import { RecentTrades } from './RecentTrades';
import { IdeasCard } from './IdeasCard';

interface DashboardProps {
  onNavigateToResearch?: (symbol: string) => void;
}

export function Dashboard({ onNavigateToResearch }: DashboardProps) {
  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Portfolio Value"
          value={`$${portfolioStats.totalValue.toLocaleString()}`}
          change={portfolioStats.dayChangePercent}
          changeLabel="today"
          icon="dollar"
          delay={0}
        />
        <StatsCard
          title="Day Change"
          value={`$${portfolioStats.dayChange.toLocaleString()}`}
          change={portfolioStats.dayChangePercent}
          icon="trending"
          delay={100}
        />
        <StatsCard
          title="Total Gain"
          value={`$${portfolioStats.totalGain.toLocaleString()}`}
          change={portfolioStats.totalGainPercent}
          changeLabel="all time"
          icon="trending"
          delay={200}
        />
        <StatsCard
          title="Buying Power"
          value={`$${portfolioStats.buyingPower.toLocaleString()}`}
          icon="wallet"
          delay={300}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <PortfolioChart />
          <RecentTrades />
        </div>
        <div className="space-y-6">
          <WatchlistCard />
          <IdeasCard onNavigateToResearch={onNavigateToResearch} />
        </div>
      </div>
    </div>
  );
}

