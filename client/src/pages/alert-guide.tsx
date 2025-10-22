import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Bell, Settings, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";

export default function AlertGuide() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <Button variant="ghost" className="mb-4" data-testid="button-back-dashboard" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
        
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">TradingView Alert Setup Guide</h1>
          <p className="text-muted-foreground">
            Complete guide for setting up alerts on your INFO KATTA UNIVERSAL ALGO indicator
          </p>
        </div>

        <Alert className="mb-6" data-testid="alert-info">
          <Bell className="h-4 w-4" />
          <AlertDescription>
            Your Pine Script indicator already has alert conditions built-in. Follow these steps to activate them.
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          <Card data-testid="card-step-1">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-lg px-3 py-1">Step 1</Badge>
                <CardTitle>Add the Indicator to Your Chart</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Open TradingView and load your chart</p>
                  <p className="text-sm text-muted-foreground">Choose the symbol you want to trade (FROTO, TUPRS, KCHOL, ADAUSDT, XRPUSDT, YKBNK, or any other)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Click on "Indicators" at the top</p>
                  <p className="text-sm text-muted-foreground">Search for "INFO KATTA UNIVERSAL ALGO" and add it to your chart</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Verify the indicator is working</p>
                  <p className="text-sm text-muted-foreground">You should see green "Buy" labels and red "Sell" labels on your chart with trend lines</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-step-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-lg px-3 py-1">Step 2</Badge>
                <CardTitle>Create the Alert</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Click the "Alert" button</p>
                  <p className="text-sm text-muted-foreground">Located at the top right of your chart (or press Alt + A on keyboard)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">In the "Condition" dropdown, select your indicator</p>
                  <p className="text-sm text-muted-foreground">Choose: <code className="bg-muted px-2 py-0.5 rounded">INFO KATTA UNIVERSAL ALGO (LEAKED)</code></p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Select the alert type</p>
                  <p className="text-sm text-muted-foreground">
                    Choose either <code className="bg-muted px-2 py-0.5 rounded">Buy Signal</code> or <code className="bg-muted px-2 py-0.5 rounded">Sell Signal</code>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-signal-types">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Understanding the Signals
              </CardTitle>
              <CardDescription>What each alert means and when it triggers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4 bg-green-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <h3 className="font-semibold text-green-600 dark:text-green-400">Buy Signal</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Triggers when the trend changes from DOWN to UP (price crosses above the lower trend line)
                </p>
                <p className="text-sm mt-2">
                  <span className="font-medium">Condition:</span> <code className="text-xs bg-muted px-2 py-0.5 rounded">trend == 1 and trend[1] == -1</code>
                </p>
              </div>

              <div className="border rounded-lg p-4 bg-red-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  <h3 className="font-semibold text-red-600 dark:text-red-400">Sell Signal</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Triggers when the trend changes from UP to DOWN (price crosses below the upper trend line)
                </p>
                <p className="text-sm mt-2">
                  <span className="font-medium">Condition:</span> <code className="text-xs bg-muted px-2 py-0.5 rounded">trend == -1 and trend[1] == 1</code>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-step-3">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-lg px-3 py-1">Step 3</Badge>
                <CardTitle>Configure Alert Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Set "Alert name"</p>
                  <p className="text-sm text-muted-foreground">Example: "FROTO Buy Signal" or "ADAUSDT Sell Alert"</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Choose frequency: "Once Per Bar Close"</p>
                  <p className="text-sm text-muted-foreground">This prevents false signals during bar formation. Recommended for accuracy.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Set expiration (optional)</p>
                  <p className="text-sm text-muted-foreground">Leave as "Open-ended" or set a specific date if needed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-step-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-lg px-3 py-1">Step 4</Badge>
                <CardTitle>Set Notification Methods</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Notification options</p>
                  <p className="text-sm text-muted-foreground">Enable your preferred notification methods:</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                    <li>Pop-up: Instant notification on TradingView</li>
                    <li>Email: Receive alerts in your inbox</li>
                    <li>Webhook URL: Send to your trading bot or external system</li>
                    <li>SMS: Mobile text messages (requires premium TradingView plan)</li>
                  </ul>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Customize the alert message (optional)</p>
                  <p className="text-sm text-muted-foreground">
                    Default messages are already set: "Buy Signal!" or "Sell Signal!"
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You can customize it with placeholders like {`{{ticker}}`}, {`{{close}}`}, {`{{time}}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-step-5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-lg px-3 py-1">Step 5</Badge>
                <CardTitle>Create and Test</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Click "Create"</p>
                  <p className="text-sm text-muted-foreground">Your alert is now active and will trigger when conditions are met</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Repeat for both Buy and Sell signals</p>
                  <p className="text-sm text-muted-foreground">Create separate alerts for Buy and Sell to get both types of notifications</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">Monitor your alerts</p>
                  <p className="text-sm text-muted-foreground">Check the Alerts panel (Alt + A) to see all active alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-tips">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <CardTitle>Important Tips & Best Practices</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Symbol-Specific Settings</h3>
                <p className="text-sm text-muted-foreground">
                  The indicator has optimized settings for specific symbols:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li><strong>FROTO:</strong> ATR Period 34, Multiplier 4.0, uses High price</li>
                  <li><strong>TUPRS:</strong> ATR Period 15, Multiplier 3.4, uses Close price</li>
                  <li><strong>KCHOL:</strong> ATR Period 12, Multiplier 3.2, uses Open price</li>
                  <li><strong>ADAUSDT:</strong> ATR Period 3, Multiplier 0.1, uses HL2</li>
                  <li><strong>XRPUSDT:</strong> ATR Period 3, Multiplier 0.1, uses Low price</li>
                  <li><strong>YKBNK:</strong> ATR Period 15, Multiplier 5.5, uses HLC3</li>
                  <li><strong>Other symbols:</strong> Default settings (ATR Period 10, Multiplier 3.0)</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Alert Frequency</h3>
                <p className="text-sm text-muted-foreground">
                  Always use "Once Per Bar Close" to avoid getting alerts while a bar is still forming. This ensures you only get confirmed signals.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Free Plan Limitations</h3>
                <p className="text-sm text-muted-foreground">
                  TradingView free plan allows limited concurrent alerts. Consider upgrading if you need alerts on multiple symbols.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Webhook for Automation</h3>
                <p className="text-sm text-muted-foreground">
                  If you want to automate trading, use webhook URLs to send alerts to your trading bot or this dashboard.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-webhook">
            <CardHeader>
              <CardTitle>Advanced: Webhook Integration (Optional)</CardTitle>
              <CardDescription>Connect alerts to this trading system for automated execution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                To integrate TradingView alerts with this MT5 trading system:
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-mono">
                  Webhook URL: <code className="text-xs">{window.location.origin}/api/webhook/tradingview</code>
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Configure the webhook in TradingView alert settings, and this system will automatically:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Receive the alert</li>
                <li>Calculate position size based on risk settings</li>
                <li>Execute trades on MT5</li>
                <li>Manage stop loss and take profit</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
