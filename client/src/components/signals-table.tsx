import { formatDistanceToNow } from "date-fns";
import { ArrowUpCircle, ArrowDownCircle, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Signal } from "@shared/schema";

interface SignalsTableProps {
  signals: Signal[];
  isLoading: boolean;
}

export function SignalsTable({ signals, isLoading }: SignalsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-3 mb-4">
          <Clock className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No signals yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Waiting for TradingView alerts. Configure your webhook URL in settings and set up alerts in TradingView.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Time</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Entry</TableHead>
              <TableHead className="text-right">SL</TableHead>
              <TableHead className="text-right">TP</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {signals.map((signal) => (
              <TableRow key={signal.id} data-testid={`row-signal-${signal.id}`}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(signal.timestamp), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={`gap-1 ${
                      signal.type === 'BUY' 
                        ? 'border-chart-2/50 bg-chart-2/10 text-chart-2' 
                        : 'border-destructive/50 bg-destructive/10 text-destructive'
                    }`}
                  >
                    {signal.type === 'BUY' ? (
                      <ArrowUpCircle className="h-3 w-3" />
                    ) : (
                      <ArrowDownCircle className="h-3 w-3" />
                    )}
                    {signal.type}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {signal.symbol}
                  {signal.indicatorType && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {signal.indicatorType}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {signal.entryPrice ? parseFloat(signal.entryPrice).toFixed(5) : '—'}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-destructive">
                  {signal.stopLoss ? parseFloat(signal.stopLoss).toFixed(5) : '—'}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-chart-2">
                  {signal.takeProfit ? parseFloat(signal.takeProfit).toFixed(5) : '—'}
                </TableCell>
                <TableCell>
                  {signal.status === 'pending' && (
                    signal.errorMessage ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="outline" className="gap-1 border-chart-4/50 bg-chart-4/10 text-chart-4 cursor-help">
                            <AlertCircle className="h-3 w-3" />
                            Pending
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm" data-testid={`tooltip-error-${signal.id}`}>
                          <p className="font-semibold">Why pending?</p>
                          <p className="text-sm text-muted-foreground">{signal.errorMessage}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-chart-4/50 bg-chart-4/10 text-chart-4">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    )
                  )}
                  {signal.status === 'executed' && (
                    <Badge variant="outline" className="gap-1 border-chart-2/50 bg-chart-2/10 text-chart-2">
                      <CheckCircle2 className="h-3 w-3" />
                      Executed
                    </Badge>
                  )}
                  {signal.status === 'failed' && (
                    signal.errorMessage ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="outline" className="gap-1 border-destructive/50 bg-destructive/10 text-destructive cursor-help" data-testid={`badge-failed-${signal.id}`}>
                            <XCircle className="h-3 w-3" />
                            Failed
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm" data-testid={`tooltip-error-${signal.id}`}>
                          <p className="font-semibold">Error Details</p>
                          <p className="text-sm text-muted-foreground">{signal.errorMessage}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-destructive/50 bg-destructive/10 text-destructive">
                        <XCircle className="h-3 w-3" />
                        Failed
                      </Badge>
                    )
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
