import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Copy, Check, ExternalLink, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import type { Settings, SymbolMapping } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const settingsSchema = z.object({
  mt5ApiSecret: z.string().min(1, "MT5 API Secret is required"),
  accountBalance: z.string().min(1, "Account balance is required"),
  autoTrade: z.string(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [newTvSymbol, setNewTvSymbol] = useState('');
  const [newMt5Symbol, setNewMt5Symbol] = useState('');

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['/api/settings'],
  });

  const { data: symbolMappings = [] } = useQuery<SymbolMapping[]>({
    queryKey: ['/api/symbol-mappings'],
  });

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      mt5ApiSecret: '',
      accountBalance: '10000',
      autoTrade: 'true',
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        mt5ApiSecret: settings.mt5ApiSecret || '',
        accountBalance: settings.accountBalance || '10000',
        autoTrade: settings.autoTrade || 'true',
      });
    }
  }, [settings, form]);

  const mutation = useMutation({
    mutationFn: async (data: SettingsForm) => {
      return apiRequest('POST', '/api/settings', {
        mt5ApiSecret: data.mt5ApiSecret,
        accountBalance: data.accountBalance,
        autoTrade: data.autoTrade,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Settings saved",
        description: "Your MT5 configuration has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addMappingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/symbol-mappings', {
        tradingViewSymbol: newTvSymbol.trim(),
        mt5Symbol: newMt5Symbol.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/symbol-mappings'] });
      setNewTvSymbol('');
      setNewMt5Symbol('');
      toast({
        title: "Symbol mapping added",
        description: `${newTvSymbol} will now be mapped to ${newMt5Symbol}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add symbol mapping. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/symbol-mappings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/symbol-mappings'] });
      toast({
        title: "Symbol mapping deleted",
        description: "The symbol mapping has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete symbol mapping. Please try again.",
        variant: "destructive",
      });
    },
  });

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhook`
    : '/api/webhook';

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied!",
      description: "Webhook URL copied to clipboard",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your MetaTrader 5 connection and trading parameters
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
              {/* Webhook URL */}
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-medium mb-2">TradingView Webhook URL</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Use this URL in your TradingView alert settings
                </p>
                <div className="flex gap-2">
                  <Input 
                    value={webhookUrl} 
                    readOnly 
                    className="font-mono text-xs"
                    data-testid="input-webhook-url"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={copyWebhookUrl}
                    data-testid="button-copy-webhook"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-chart-2" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* MT5 WebSocket URL */}
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-medium mb-2">MT5 WebSocket URL</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Use this as the ServerURL parameter in your MT5 Expert Advisor
                </p>
                <div className="flex gap-2">
                  <Input 
                    value={typeof window !== 'undefined' ? window.location.origin : 'https://your-app.replit.dev'}
                    readOnly 
                    className="font-mono text-xs"
                    data-testid="input-server-url"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => {
                      const serverUrl = window.location.origin;
                      navigator.clipboard.writeText(serverUrl);
                      toast({
                        title: "Copied!",
                        description: "Server URL copied to clipboard",
                      });
                    }}
                    data-testid="button-copy-server-url"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Note: The EA will automatically convert this to wss:// and connect to /mt5-ws path
                </p>
              </div>

              {/* MT5 Connection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">MT5 WebSocket Connection</h3>
                  <a 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault();
                      window.open('/mt5-files/INSTALLATION_GUIDE_WEBSOCKET.md', '_blank');
                    }}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Installation Guide
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">
                  Real-time bidirectional communication between MT5 and server using WebSocket protocol
                </p>
                
                <FormField
                  control={form.control}
                  name="mt5ApiSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MT5 API Secret</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter a secret key for MT5 authentication" 
                          {...field} 
                          data-testid="input-mt5-api-secret" 
                        />
                      </FormControl>
                      <FormDescription>
                        This must match the ApiSecret in your MT5 Expert Advisor settings
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-3">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    📋 <strong>Setup Required:</strong> Install the TradingViewWebSocket_EA.mq5 Expert Advisor in your MT5 terminal. 
                    Check the <code className="bg-background/50 px-1 rounded">mt5-files/INSTALLATION_GUIDE_WEBSOCKET.md</code> for complete instructions.
                  </p>
                </div>
              </div>

              {/* Trading Parameters */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Trading Parameters</h3>

                <FormField
                  control={form.control}
                  name="accountBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Balance ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} data-testid="input-account-balance" />
                      </FormControl>
                      <FormDescription>Your MT5 account balance for monitoring</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-3">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    ℹ️ <strong>Trading Parameters</strong> (Stop Loss, Take Profit, and Lot Size) are now configured directly in the MT5 Expert Advisor settings. 
                    You can enable/disable SL and TP independently, set their pip values, and configure your fixed lot size in the EA inputs.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="autoTrade"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border bg-card p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Auto Trading</FormLabel>
                        <FormDescription>
                          Automatically execute trades when signals are received
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value === 'true'}
                          onCheckedChange={(checked) => field.onChange(checked ? 'true' : 'false')}
                          data-testid="switch-auto-trade"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

              </div>

              {/* Symbol Mappings */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Symbol Mappings</h3>
                <p className="text-xs text-muted-foreground">
                  Map TradingView symbol names to your MT5 broker's symbol names. For example, map "BTCUSD" to "BTCUSDm".
                </p>

                {/* Add new mapping */}
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-xs font-medium mb-1.5 block">TradingView Symbol</label>
                      <Input
                        placeholder="e.g., BTCUSD"
                        value={newTvSymbol}
                        onChange={(e) => setNewTvSymbol(e.target.value)}
                        data-testid="input-tradingview-symbol"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium mb-1.5 block">MT5 Symbol</label>
                      <Input
                        placeholder="e.g., BTCUSDm"
                        value={newMt5Symbol}
                        onChange={(e) => setNewMt5Symbol(e.target.value)}
                        data-testid="input-mt5-symbol"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => addMappingMutation.mutate()}
                      disabled={!newTvSymbol.trim() || !newMt5Symbol.trim() || addMappingMutation.isPending}
                      data-testid="button-add-mapping"
                    >
                      {addMappingMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Existing mappings */}
                {symbolMappings.length > 0 ? (
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>TradingView Symbol</TableHead>
                          <TableHead>MT5 Symbol</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {symbolMappings.map((mapping) => (
                          <TableRow key={mapping.id} data-testid={`mapping-row-${mapping.id}`}>
                            <TableCell className="font-medium" data-testid={`text-tv-symbol-${mapping.id}`}>
                              {mapping.tradingViewSymbol}
                            </TableCell>
                            <TableCell data-testid={`text-mt5-symbol-${mapping.id}`}>
                              {mapping.mt5Symbol}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMappingMutation.mutate(mapping.id)}
                                disabled={deleteMappingMutation.isPending}
                                data-testid={`button-delete-mapping-${mapping.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/50 p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      No symbol mappings configured. Add one above to get started.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel-settings"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={mutation.isPending}
                  data-testid="button-save-settings"
                >
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Settings
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
