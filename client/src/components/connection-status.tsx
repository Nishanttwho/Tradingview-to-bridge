import { Badge } from "@/components/ui/badge";
import { Circle } from "lucide-react";

interface ConnectionStatusProps {
  isConnected: boolean;
}

export function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
  return (
    <Badge 
      variant="outline" 
      className={`gap-2 ${
        isConnected 
          ? 'border-chart-2/50 bg-chart-2/10 text-chart-2' 
          : 'border-destructive/50 bg-destructive/10 text-destructive'
      }`}
      data-testid="badge-connection-status"
    >
      <Circle 
        className={`h-2 w-2 fill-current ${
          isConnected ? 'animate-pulse' : ''
        }`} 
      />
      {isConnected ? 'Connected' : 'Disconnected'}
    </Badge>
  );
}
