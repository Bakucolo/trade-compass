import { ExternalLink, Link2, Plus, RefreshCw, Shield, Unlink } from 'lucide-react';
import { Button } from './ui/button';

const connectedBrokers = [
  {
    id: 'td',
    name: 'TD Ameritrade',
    status: 'connected',
    lastSync: '2 minutes ago',
    accounts: 2,
    logo: 'TD',
  },
];

const availableBrokers = [
  { id: 'robinhood', name: 'Robinhood', logo: 'RH', color: 'bg-emerald-500' },
  { id: 'fidelity', name: 'Fidelity', logo: 'FI', color: 'bg-green-600' },
  { id: 'schwab', name: 'Charles Schwab', logo: 'CS', color: 'bg-blue-600' },
  { id: 'etrade', name: 'E*TRADE', logo: 'ET', color: 'bg-purple-600' },
  { id: 'webull', name: 'Webull', logo: 'WB', color: 'bg-orange-500' },
  { id: 'ibkr', name: 'Interactive Brokers', logo: 'IB', color: 'bg-red-600' },
];

export function BrokersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Broker Connections</h1>
        <p className="text-muted-foreground">Connect your brokerage accounts to sync trades and portfolio data</p>
      </div>

      {/* Security Notice */}
      <div className="glass-card rounded-xl p-4 border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-medium text-foreground">Secure Connection</h3>
            <p className="text-sm text-muted-foreground">
              Your credentials are encrypted and never stored on our servers. We use OAuth 2.0 and read-only access to sync your data securely.
            </p>
          </div>
        </div>
      </div>

      {/* Connected Brokers */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Connected Accounts</h2>
        
        {connectedBrokers.length > 0 ? (
          <div className="space-y-4">
            {connectedBrokers.map((broker) => (
              <div key={broker.id} className="glass-card rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                      <span className="text-lg font-bold text-success">{broker.logo}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{broker.name}</h3>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-success">
                          <span className="w-2 h-2 rounded-full bg-success animate-pulse-slow" />
                          Connected
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{broker.accounts} accounts</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">Synced {broker.lastSync}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                      <RefreshCw className="w-4 h-4" />
                      Sync Now
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive">
                      <Unlink className="w-4 h-4" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-xl p-8 text-center">
            <Link2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No brokers connected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your brokerage account to automatically sync your trades and portfolio
            </p>
          </div>
        )}
      </div>

      {/* Available Brokers */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Available Integrations</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableBrokers.map((broker, index) => (
            <div
              key={broker.id}
              className="glass-card rounded-xl p-5 hover:border-primary/30 transition-all cursor-pointer group animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl ${broker.color} flex items-center justify-center`}>
                  <span className="text-lg font-bold text-white">{broker.logo}</span>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{broker.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Sync trades, positions, and account balances
              </p>
              <Button variant="outline" className="w-full gap-2">
                <Plus className="w-4 h-4" />
                Connect
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Help Section */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-2">Need help connecting?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Check our documentation for step-by-step guides on connecting each broker, or contact support if you're having issues.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">View Documentation</Button>
          <Button variant="ghost" size="sm">Contact Support</Button>
        </div>
      </div>
    </div>
  );
}
