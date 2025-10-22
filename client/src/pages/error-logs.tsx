import { useQuery } from "@tanstack/react-query";
import { AlertCircle, XCircle, Clock, FileText, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { Signal, Mt5Command, Mt5ExecutionResult } from "@shared/schema";

interface ErrorLogsResponse {
  failedSignals: Signal[];
  failedCommands: Mt5Command[];
  failedExecutionResults: Mt5ExecutionResult[];
}

interface PendingLogsResponse {
  pendingSignals: Signal[];
  pendingCommands: Mt5Command[];
}

export default function ErrorLogs() {
  const { data, isLoading } = useQuery<ErrorLogsResponse>({
    queryKey: ['/api/error-logs'],
  });

  const { data: pendingData, isLoading: pendingLoading } = useQuery<PendingLogsResponse>({
    queryKey: ['/api/pending-logs'],
  });

  const totalErrors = (data?.failedSignals.length || 0) + 
                      (data?.failedCommands.length || 0) + 
                      (data?.failedExecutionResults.length || 0);

  const totalPending = (pendingData?.pendingSignals.length || 0) +
                       (pendingData?.pendingCommands.length || 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild data-testid="button-back">
              <Link href="/">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              </Link>
            </Button>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight" data-testid="text-page-title">Error Logs</h1>
              <p className="text-xs text-muted-foreground">View and diagnose all errors</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6 md:px-6 md:py-8">
        {/* Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Error Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-32 animate-pulse rounded bg-muted" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono" data-testid="text-total-errors">
                  {totalErrors}
                </span>
                <span className="text-muted-foreground">total errors found</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending ({totalPending})
            </TabsTrigger>
            <TabsTrigger value="signals" data-testid="tab-failed-signals">
              Failed Signals ({data?.failedSignals.length || 0})
            </TabsTrigger>
            <TabsTrigger value="commands" data-testid="tab-failed-commands">
              Failed Commands ({data?.failedCommands.length || 0})
            </TabsTrigger>
            <TabsTrigger value="executions" data-testid="tab-failed-executions">
              Failed Executions ({data?.failedExecutionResults.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Pending Tab */}
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending Signals & Commands</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : totalPending === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending signals or commands
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Pending Signals */}
                    {pendingData?.pendingSignals && pendingData.pendingSignals.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3">Pending Signals ({pendingData.pendingSignals.length})</h3>
                        <div className="rounded-md border border-border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Symbol</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Duration Pending</TableHead>
                                <TableHead>Reason</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pendingData.pendingSignals.map((signal) => {
                                const pendingDuration = Date.now() - new Date(signal.timestamp).getTime();
                                const pendingSeconds = Math.floor(pendingDuration / 1000);
                                const isStale = pendingSeconds > 120; // Over 2 minutes
                                const isWarning = pendingSeconds > 30; // Over 30 seconds
                                
                                return (
                                  <TableRow key={signal.id} data-testid={`row-pending-signal-${signal.id}`}>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(signal.timestamp), { addSuffix: true })}
                                    </TableCell>
                                    <TableCell className="font-medium">{signal.symbol}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{signal.type}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge 
                                        variant="outline" 
                                        className={`gap-1 ${
                                          isStale 
                                            ? 'border-destructive/50 bg-destructive/10 text-destructive' 
                                            : isWarning
                                            ? 'border-chart-4/50 bg-chart-4/10 text-chart-4'
                                            : 'border-muted-foreground/50 bg-muted/10 text-muted-foreground'
                                        }`}
                                      >
                                        {isStale || isWarning ? <Clock className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
                                        {pendingSeconds}s
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-md">
                                      <p className="text-sm text-muted-foreground" data-testid={`reason-${signal.id}`}>
                                        {signal.errorMessage || 'Waiting for execution...'}
                                      </p>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Pending Commands */}
                    {pendingData?.pendingCommands && pendingData.pendingCommands.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-3">Pending Commands ({pendingData.pendingCommands.length})</h3>
                        <div className="rounded-md border border-border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Symbol</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Duration Pending</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pendingData.pendingCommands.map((command) => {
                                const pendingDuration = Date.now() - new Date(command.createdAt).getTime();
                                const pendingSeconds = Math.floor(pendingDuration / 1000);
                                const isStale = pendingSeconds > 120;
                                const isWarning = pendingSeconds > 30;
                                
                                return (
                                  <TableRow key={command.id} data-testid={`row-pending-command-${command.id}`}>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(command.createdAt), { addSuffix: true })}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{command.action}</Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">{command.symbol || '—'}</TableCell>
                                    <TableCell>
                                      <Badge 
                                        variant="outline" 
                                        className="gap-1 border-chart-4/50 bg-chart-4/10 text-chart-4"
                                      >
                                        <Clock className="h-3 w-3" />
                                        {command.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge 
                                        variant="outline" 
                                        className={`gap-1 ${
                                          isStale 
                                            ? 'border-destructive/50 bg-destructive/10 text-destructive' 
                                            : isWarning
                                            ? 'border-chart-4/50 bg-chart-4/10 text-chart-4'
                                            : 'border-muted-foreground/50 bg-muted/10 text-muted-foreground'
                                        }`}
                                      >
                                        {isStale || isWarning ? <Clock className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
                                        {pendingSeconds}s
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Failed Signals Tab */}
          <TabsContent value="signals">
            <Card>
              <CardHeader>
                <CardTitle>Failed Signals</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : data?.failedSignals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No failed signals
                  </div>
                ) : (
                  <div className="rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Error Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.failedSignals.map((signal) => (
                          <TableRow key={signal.id} data-testid={`row-failed-signal-${signal.id}`}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(signal.timestamp), { addSuffix: true })}
                            </TableCell>
                            <TableCell className="font-medium">{signal.symbol}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{signal.type}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1 border-destructive/50 bg-destructive/10 text-destructive">
                                <XCircle className="h-3 w-3" />
                                {signal.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-md">
                              <p className="text-sm text-destructive truncate" data-testid={`error-msg-${signal.id}`}>
                                {signal.errorMessage || 'No error message'}
                              </p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Failed Commands Tab */}
          <TabsContent value="commands">
            <Card>
              <CardHeader>
                <CardTitle>Failed MT5 Commands</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : data?.failedCommands.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No failed commands
                  </div>
                ) : (
                  <div className="rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Error Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.failedCommands.map((command) => (
                          <TableRow key={command.id} data-testid={`row-failed-command-${command.id}`}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(command.createdAt), { addSuffix: true })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{command.action}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{command.symbol || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1 border-destructive/50 bg-destructive/10 text-destructive">
                                <XCircle className="h-3 w-3" />
                                {command.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-md">
                              <p className="text-sm text-destructive truncate" data-testid={`error-msg-${command.id}`}>
                                {command.errorMessage || 'No error message'}
                              </p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Failed Executions Tab */}
          <TabsContent value="executions">
            <Card>
              <CardHeader>
                <CardTitle>Failed MT5 Executions</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : data?.failedExecutionResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No failed executions
                  </div>
                ) : (
                  <div className="rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Command ID</TableHead>
                          <TableHead>Success</TableHead>
                          <TableHead>Error Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.failedExecutionResults.map((result) => (
                          <TableRow key={result.id} data-testid={`row-failed-execution-${result.id}`}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(result.executedAt), { addSuffix: true })}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {result.commandId?.slice(0, 8) || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1 border-destructive/50 bg-destructive/10 text-destructive">
                                <XCircle className="h-3 w-3" />
                                {result.success}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-md">
                              <p className="text-sm text-destructive truncate" data-testid={`error-msg-${result.id}`}>
                                {result.errorMessage || 'No error message'}
                              </p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
