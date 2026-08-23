import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught component error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReload = () => {
    window.location.reload();
  };

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-3xl mx-auto my-8">
          <Card className="glass-card p-6 border-rose-500/40 bg-slate-950/80 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {this.props.fallbackTitle || 'Component Error'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  An unexpected error occurred while rendering this section.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="p-3 bg-black/50 rounded-lg border border-border/50 text-xs font-mono text-rose-300 overflow-x-auto">
                <p className="font-bold">{this.state.error.toString()}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-muted-foreground mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="gap-2 border-border/60 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try Again
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={this.handleReload}
                className="gap-2 bg-rose-600 hover:bg-rose-500 text-white text-xs"
              >
                Reload Page
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
