import { stocks } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { BarChart3, Building2, DollarSign, Percent, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { Input } from './ui/input';
import { useState } from 'react';

export function ResearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState(stocks[0]);

  const filteredStocks = stocks.filter(
    (stock) =>
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Stock Research</h1>
        <p className="text-muted-foreground">Analyze fundamentals and technical indicators</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock List */}
        <div className="glass-card rounded-xl p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search stocks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-accent border-border"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
            {filteredStocks.map((stock) => {
              const isPositive = stock.change >= 0;
              const isSelected = selectedStock.symbol === stock.symbol;

              return (
                <button
                  key={stock.symbol}
                  onClick={() => setSelectedStock(stock)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg transition-all",
                    isSelected
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                      <span className="text-xs font-bold text-foreground">
                        {stock.symbol.slice(0, 2)}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-foreground ticker-symbol">{stock.symbol}</p>
                      <p className="text-xs text-muted-foreground">{stock.sector}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-medium text-foreground">${stock.price.toFixed(2)}</p>
                    <p className={cn("text-xs font-mono", isPositive ? "price-up" : "price-down")}>
                      {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stock Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-bold text-foreground ticker-symbol">{selectedStock.symbol}</h2>
                  <span className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded text-sm font-medium",
                    selectedStock.change >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                  )}>
                    {selectedStock.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {selectedStock.change >= 0 ? '+' : ''}{selectedStock.changePercent.toFixed(2)}%
                  </span>
                </div>
                <p className="text-muted-foreground">{selectedStock.name}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-foreground font-mono">${selectedStock.price.toFixed(2)}</p>
                <p className={cn("text-sm font-mono", selectedStock.change >= 0 ? "price-up" : "price-down")}>
                  {selectedStock.change >= 0 ? '+' : ''}${selectedStock.change.toFixed(2)} today
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-accent/50">
                <p className="data-label mb-1">Volume</p>
                <p className="font-mono font-medium text-foreground">{selectedStock.volume}</p>
              </div>
              <div className="p-3 rounded-lg bg-accent/50">
                <p className="data-label mb-1">Avg Volume</p>
                <p className="font-mono font-medium text-foreground">{selectedStock.avgVolume}</p>
              </div>
              <div className="p-3 rounded-lg bg-accent/50">
                <p className="data-label mb-1">52W High</p>
                <p className="font-mono font-medium text-success">${selectedStock.high52w.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-lg bg-accent/50">
                <p className="data-label mb-1">52W Low</p>
                <p className="font-mono font-medium text-destructive">${selectedStock.low52w.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Fundamentals */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Fundamentals</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-accent/30">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <p className="data-label">Market Cap</p>
                </div>
                <p className="text-xl font-bold text-foreground">{selectedStock.marketCap}</p>
              </div>
              <div className="p-4 rounded-lg bg-accent/30">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-4 h-4 text-primary" />
                  <p className="data-label">P/E Ratio</p>
                </div>
                <p className="text-xl font-bold text-foreground">{selectedStock.pe.toFixed(1)}</p>
              </div>
              <div className="p-4 rounded-lg bg-accent/30">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <p className="data-label">EPS</p>
                </div>
                <p className="text-xl font-bold text-foreground">${selectedStock.eps.toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-lg bg-accent/30">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-success" />
                  <p className="data-label">Dividend</p>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {selectedStock.dividend > 0 ? `$${selectedStock.dividend.toFixed(2)}` : 'N/A'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-accent/30">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <p className="data-label">Sector</p>
                </div>
                <p className="text-lg font-semibold text-foreground">{selectedStock.sector}</p>
              </div>
            </div>
          </div>

          {/* 52 Week Range Visualization */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">52 Week Range</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">${selectedStock.low52w.toFixed(2)}</span>
                <span className="text-muted-foreground">${selectedStock.high52w.toFixed(2)}</span>
              </div>
              <div className="relative h-2 bg-accent rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-gradient-to-r from-destructive via-warning to-success"
                  style={{ width: '100%' }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-foreground rounded-full border-2 border-background shadow-lg"
                  style={{
                    left: `${((selectedStock.price - selectedStock.low52w) / (selectedStock.high52w - selectedStock.low52w)) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Current: <span className="font-mono text-foreground">${selectedStock.price.toFixed(2)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
