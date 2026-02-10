import { ExternalLink, Link2, Plus, RefreshCw, Shield, Unlink, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { useIBKRStatus, useIBKRPortfolio } from '../services/ibkr';
import { useTastytradeLogin, useTastytradeAccounts, useTastytradePositions } from '../services/tastytrade';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectTastytradeDialog } from './ConnectTastytradeDialog';
import { useState } from 'react';

export function BrokersPage() {
  // IBKR State
  const { data: status, isLoading: isStatusLoading } = useIBKRStatus();
  const { data: ibPortfolio, isLoading: isIBPortfolioLoading } = useIBKRPortfolio();
  const isIBConnected = status?.connected;

  // Tastytrade State
  const [tastyAuthenticated, setTastyAuthenticated] = useState(false);
  const [selectedTastyAccount, setSelectedTastyAccount] = useState<string | null>(null);

  const { data: tastyAccounts } = useTastytradeAccounts(tastyAuthenticated);
  const { data: tastyPositions, isLoading: isTastyPositionsLoading } = useTastytradePositions(selectedTastyAccount);


  // Select first account automatically when loaded
  if (tastyAuthenticated && tastyAccounts && tastyAccounts.length > 0 && !selectedTastyAccount) {
    setSelectedTastyAccount(tastyAccounts[0].account['account-number']);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Broker Connections</h1>
        <p className="text-muted-foreground">Connect your brokerage accounts to sync trades and portfolio data</p>
      </div>

      {/* IBKR Connection Status */}
      <Card className="glass-card border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Interactive Brokers Connection</span>
            {isStatusLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : isIBConnected ? (
              <span className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Disconnected
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isIBConnected && !isStatusLoading && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Connection Failed</AlertTitle>
              <AlertDescription>
                Could not connect to Trader Workstation (TWS) or IB Gateway. Please ensure it is running and API connections are enabled (Port 7497/7496).
              </AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-muted-foreground">
            This integration connects to your local TWS instance via a local proxy server.
          </p>
        </CardContent>
      </Card>

      {/* Tastytrade Connection Card */}
      <Card className="glass-card border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Tastytrade Connection</span>
            {tastyAuthenticated ? (
              <span className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Connected
              </span>
            ) : (
              <ConnectTastytradeDialog onConnect={() => setTastyAuthenticated(true)} />
            )}
          </CardTitle>
        </CardHeader>
        {tastyAuthenticated && (
          <CardContent>
            <div className="mb-4">
              <p className="font-medium">Accounts:</p>
              <div className="flex gap-2 mt-2">
                {tastyAccounts?.map((item: any) => {
                  const acc = item.account;
                  return (
                    <Button
                      key={acc['account-number']}
                      variant={selectedTastyAccount === acc['account-number'] ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTastyAccount(acc['account-number'])}
                    >
                      {acc.nickname || acc['account-number']}
                    </Button>
                  );
                })}
              </div>
            </div>

            {isTastyPositionsLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : tastyPositions && tastyPositions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tastyPositions.map((pos: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{pos.symbol}</TableCell>
                      <TableCell className="text-right">{pos.quantity}</TableCell>
                      <TableCell className="text-right">{pos['average-open-price']}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No positions found in this account.</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* IBKR Portfolio Table */}
      {isIBConnected && ibPortfolio && ibPortfolio.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Interactive Brokers Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>SecType</TableHead>
                  <TableHead className="text-right">Position</TableHead>
                  <TableHead className="text-right">Avg Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ibPortfolio.map((pos, idx) => (
                  <TableRow key={`${pos.contract.conId}-${idx}`}>
                    <TableCell className="font-medium">{pos.contract.symbol}</TableCell>
                    <TableCell>{pos.contract.secType}</TableCell>
                    <TableCell className="text-right">{pos.pos}</TableCell>
                    <TableCell className="text-right">${pos.avgCost.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
