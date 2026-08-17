import React, { type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadRecoverySnapshot } from '../lib/recoveryVault';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class AppErrorBoundary extends React.Component<Props, State> {
  declare readonly props: Readonly<Props>;
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Facility Engine recovered from a rendering error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <section className="surface-panel w-full max-w-xl space-y-5 rounded-3xl p-7 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold">The workspace encountered an error</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your latest in-memory project can be downloaded before reloading. The app will not silently discard it.
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-left font-mono text-xs text-muted-foreground">
            {this.state.error.message || 'Unexpected rendering error'}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={() => downloadRecoverySnapshot()}><Download className="mr-2 h-4 w-4" />DOWNLOAD RECOVERY JSON</Button>
            <Button variant="outline" onClick={() => window.location.reload()}><RefreshCw className="mr-2 h-4 w-4" />RELOAD WORKSPACE</Button>
          </div>
        </section>
      </main>
    );
  }
}
