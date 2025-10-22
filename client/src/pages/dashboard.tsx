import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, TrendingUp, CheckCircle2, Percent, Settings as SettingsIcon, BookOpen, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignalsTable } from "@/components/signals-table";
import { SettingsDialog } from "@/components/settings-dialog";
import { ConnectionStatus } from "@/components/connection-status";
import { useWebSocket } from "@/hooks/use-websocket";
import type { DashboardStats, Signal } from "@shared/schema";

export default function Dashboard() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Initialize WebSocket connection
  const ws = useWebSocket();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/stats'],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  const { data: signals = [], isLoading: signalsLoading } = useQuery<Signal[]>({
    queryKey: ['/api/signals'],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  const isConnected = stats?.isConnected ?? false;
  const successRate = stats?.successRate ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight" data-testid="text-app-title">Trading Bridge</h1>
              <p className="text-xs text-muted-foreground">TradingView → MT5</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ConnectionStatus isConnected={isConnected} />
            <Button
              variant="ghost"
              size="icon"
              data-testid="button-error-logs"
              asChild
            >
              <Link href="/error-logs">
                <AlertCircle className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              data-testid="button-alert-guide"
              asChild
            >
              <Link href="/alert-guide">
                <BookOpen className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              data-testid="button-open-settings"
            >
              <SettingsIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6 md:px-6 md:py-8">
        {/* Stats Cards - Simplified */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Signals</CardTitle>
              <TrendingUp className="h-4 w-4 text-chart-4" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-muted" />
              ) : (
                <div className="text-2xl font-bold font-mono text-chart-4" data-testid="text-pending-signals">
                  {stats?.pendingSignals ?? 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Awaiting execution</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Executed Trades</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-chart-2" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-muted" />
              ) : (
                <div className="text-2xl font-bold font-mono text-chart-2" data-testid="text-executed-trades">
                  {stats?.executedTrades ?? 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Successfully executed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="h-8 w-20 animate-pulse rounded bg-muted" />
              ) : (
                <div className="flex items-baseline gap-1">
                  <span 
                    className={`text-2xl font-bold font-mono ${
                      successRate >= 80 ? 'text-chart-2' : 
                      successRate >= 50 ? 'text-chart-4' : 
                      'text-destructive'
                    }`}
                    data-testid="text-success-rate"
                  >
                    {successRate.toFixed(0)}%
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Execution success</p>
            </CardContent>
          </Card>
        </div>

        {/* Signals Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Signals</CardTitle>
              <Badge variant="outline" className="font-mono text-xs">
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <SignalsTable signals={signals} isLoading={signalsLoading} />
          </CardContent>
        </Card>
      </main>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
