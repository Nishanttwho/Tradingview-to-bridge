# Elite Algo v13 Indicator - Complete Alert Setup Guide

## ✅ **FIXED: TP/SL VALUES NOW SEND CORRECTLY!**

The Elite Algo v13 Indicator has been **completely fixed** to send actual TP and SL values instead of 0!

### 🎯 What Was Fixed

1. ✅ **SL/TP plots moved to FIRST position** - Now plot_0, plot_1, plot_2, plot_3 for predictable indexing
2. ✅ **Alert messages use correct {{plot_X}} syntax** - Pine Script v4 compatible
3. ✅ **Only 4 webhook alerts remaining** - All notification alerts removed as requested
4. ✅ **Default JSON messages pre-configured** - No manual setup needed in Message tab!
5. ✅ **Actual ATR-based calculations** - Uses close - nLoss and close + nLoss for accurate SL/TP

---

## 📋 Available Alerts (4 Total - Webhook Only)

All alerts automatically send trades to your MT5 dashboard:

| # | Alert Name | When It Triggers | Webhook Message |
|---|------------|------------------|-----------------|
| **1** | 🟢 BUY Signal | Regular buy entry (below SMA 200) | Includes: symbol, price, **stopLoss**, **takeProfit** |
| **2** | 🟢 SMART BUY Signal | Smart buy entry (above SMA 200) | Includes: symbol, price, **stopLoss**, **takeProfit**, signalType |
| **3** | 🔴 SELL Signal | Regular sell entry (above SMA 200) | Includes: symbol, price, **stopLoss**, **takeProfit** |
| **4** | 🔴 SMART SELL Signal | Smart sell entry (below SMA 200) | Includes: symbol, price, **stopLoss**, **takeProfit**, signalType |

**Note:** All notification alerts (TP1, TP2, SL Hit, Support/Resistance breakouts) have been **removed** as requested.

---

## 🚀 How to Setup Alerts (UPDATED!)

### Step 1: Add Indicator to TradingView Chart
1. Open TradingView
2. Search for "Elite Algo 13 - Indicator"
3. Add it to your chart (e.g., BTCUSD, 1m timeframe)

### Step 2: Create Alert
1. Click **Alert** button (or press `Alt + A`)
2. In **Condition** dropdown:
   - Select: `Elite Algo 13 - Indicator`
   - Choose alert type:
     - **🟢 BUY Signal** - for regular buy signals
     - **🟢 SMART BUY Signal** - for smart buy signals
     - **🔴 SELL Signal** - for regular sell signals
     - **🔴 SMART SELL Signal** - for smart sell signals

### Step 3: Configure Alert Settings
1. **Alert name**: e.g., "BTCUSD Buy Alert"
2. **Frequency**: Select **"Once Per Bar Close"** ⚠️ CRITICAL!
3. **Expiration**: Leave as "Open-ended"

### Step 4: Add Webhook URL
1. Check **"Webhook URL"** checkbox
2. Enter your webhook URL:
   ```
   https://your-replit-app.replit.dev/api/webhook
   ```
3. **Message field**: **LEAVE EMPTY** ✅ 
   - The default message is already configured in the indicator!
   - **DO NOT enter anything in the Message tab**
   - The indicator automatically sends the correct JSON with TP/SL values

### Step 5: Click "Create"
Done! Your alert will now send actual TP and SL values! 🎉

---

## 📨 Alert Message Format (Auto-Configured)

### BUY Signal Alert sends:
```json
{
  "type": "BUY",
  "symbol": "BTCUSD",
  "price": "110701",
  "stopLoss": "110560.2311",
  "takeProfit": "110841.7688",
  "indicator": "Elite_Algo_v13"
}
```

### SELL Signal Alert sends:
```json
{
  "type": "SELL",
  "symbol": "BTCUSD",
  "price": "110701",
  "stopLoss": "110841.7688",
  "takeProfit": "110560.2311",
  "indicator": "Elite_Algo_v13"
}
```

### Smart BUY/SELL Alerts send:
```json
{
  "type": "BUY",
  "symbol": "BTCUSD",
  "price": "110701",
  "stopLoss": "110560.2311",
  "takeProfit": "110841.7688",
  "indicator": "Elite_Algo_v13",
  "signalType": "SMART"
}
```

**✅ All values are actual calculated values from the indicator, NOT 0!**

---

## ⚙️ Technical Details - How It Works

### Plot Order (Critical for {{plot_X}} syntax)

The invisible SL/TP plots are now the **FIRST** plots in the indicator:

```pinescript
// PLOT 0: BUY Stop Loss
plot(entryLong ? close - nLoss : na, title="BUY_SL", display=display.none)

// PLOT 1: BUY Take Profit
plot(entryLong ? close + nLoss : na, title="BUY_TP", display=display.none)

// PLOT 2: SELL Stop Loss  
plot(entryShort ? close + nLoss : na, title="SELL_SL", display=display.none)

// PLOT 3: SELL Take Profit
plot(entryShort ? close - nLoss : na, title="SELL_TP", display=display.none)
```

### Alert Message Mapping

**BUY Signals** (both regular and smart):
- `{{plot_0}}` → BUY_SL (close - nLoss)
- `{{plot_1}}` → BUY_TP (close + nLoss)

**SELL Signals** (both regular and smart):
- `{{plot_2}}` → SELL_SL (close + nLoss)
- `{{plot_3}}` → SELL_TP (close - nLoss)

### SL/TP Calculation

- **nLoss** = 2.5 × ATR(14)
- **BUY SL** = Entry Price - nLoss
- **BUY TP** = Entry Price + nLoss (1:1 risk/reward)
- **SELL SL** = Entry Price + nLoss
- **SELL TP** = Entry Price - nLoss (1:1 risk/reward)

This creates a **1:1 risk/reward ratio** for all trades.

---

## ⚠️ Important Notes

### 1. **Always Use "Once Per Bar Close"**
- Prevents false signals during bar formation
- Ensures accurate entry signals
- Required for proper webhook execution

### 2. **DO NOT Edit the Message Tab**
- The default message is already configured
- Editing it may break TP/SL value transmission
- **Leave the Message field completely EMPTY**

### 3. **Webhook URL Must Be Accessible**
- Your Replit app must be running
- Webhook endpoint: `/api/webhook`
- Test with a manual POST request first

### 4. **Symbol Mapping**
- TradingView symbol (e.g., "BTCUSD") → MT5 symbol (configured in dashboard)
- Set up symbol mappings in your dashboard Settings
- Example: Map "BTCUSD" to "BTCUSDm" if your broker uses that symbol

### 5. **Multiple Alerts for Different Symbols**
- Create separate alerts for each trading pair
- Name them clearly (e.g., "BTCUSD Buy", "EURUSD Sell")
- Each alert can have its own webhook URL

---

## 🎯 Partial Exit Strategy (75% at TP1, 25% at TP2)

The indicator sends **TP1 (1:1 ratio)** as the takeProfit value. To implement the 75%/25% exit strategy:

### Option A: Automatic Partial Exits (MT5 EA Configuration)

Configure your MT5 EA with these settings:

```
EnableStopLoss = false          ← Use indicator's SL
EnableTakeProfit = false        ← Use indicator's TP (TP1)
EnablePartialExit = true        ← Enable partial exits
PartialExitPercent = 75         ← Exit 75% at TP1
PartialExitPips = 0             ← Set to 0 to use TP distance
EnableBreakEven = true          ← Move SL to breakeven
BreakEvenPips = 0               ← Set to 0 to trigger with partial exit
```

**How it works (FULLY AUTOMATED):**
1. When price reaches TP1 (1:1), EA automatically closes 75% of position
2. EA automatically calculates TP2 = Entry + 2 × TP1 distance (2:1 ratio)
3. EA automatically modifies remaining 25% to have:
   - Stop Loss = Breakeven (entry price)
   - Take Profit = TP2 (2:1 risk:reward)
4. Remaining 25% closes automatically when price reaches TP2

**✅ COMPLETE AUTOMATION** - No manual intervention needed!

### Recommended EA Configuration

For **fully automated trading** with partial exits:
```
EnableStopLoss = false
EnableTakeProfit = false
EnablePartialExit = true
PartialExitPercent = 75
PartialExitPips = 0
EnableBreakEven = true
BreakEvenPips = 0
UseRiskBasedLotSize = true
RiskPercentPerTrade = 1.0
```

This ensures:
✅ Indicator controls all entry, SL, and TP levels
✅ Automatic 75% exit at TP1
✅ Automatic breakeven at TP1
✅ Risk-based lot sizing for consistent risk management

---

## 🔄 Differences from Previous Version

| Feature | Before (Broken) | After (Fixed) |
|---------|----------------|---------------|
| TP/SL Values | Sent as `0` | Sends actual calculated values |
| Alert Messages | Used incorrect `{{plot("name")}}` syntax | Uses correct `{{plot_0}}`, `{{plot_1}}` syntax |
| Plot Order | SL/TP plots at end (plot_5+) | SL/TP plots at beginning (plot_0-3) |
| Number of Alerts | 13 alerts (many notifications) | 4 alerts (webhook only) |
| Message Tab | Required manual configuration | Pre-configured, leave EMPTY |

---

## ✅ Verification Checklist

Before going live, verify:

- [x] Indicator installed on TradingView chart
- [x] Alert frequency set to **"Once Per Bar Close"**
- [x] Webhook URL is correct and accessible
- [x] **Message field is LEFT EMPTY** (critical!)
- [x] Symbol mappings configured in dashboard
- [x] Test alert sent successfully with actual TP/SL values (not 0)
- [x] MT5 EA connected to dashboard
- [x] EA configured to use indicator SL/TP (`EnableStopLoss = false`, `EnableTakeProfit = false`)

---

## 🆘 Troubleshooting

### Still Getting 0 for TP/SL Values
1. ✅ **Check Message Tab**: Must be **completely EMPTY**
2. ✅ **Verify Plot Order**: Use updated indicator file
3. ✅ **Check Alert Type**: Make sure you selected the correct alert (🟢 BUY Signal, not custom)
4. ✅ **Verify Frequency**: Must be "Once Per Bar Close"
5. ✅ **Check Logs**: Look at your Replit dashboard logs to see what values are received

### Alert Not Firing
- Check indicator is added to chart
- Verify "Once Per Bar Close" is selected
- Confirm alert conditions are met (signal must appear on chart)
- Check TradingView alert notifications

### Webhook Not Received
- Check Replit app is running
- Verify webhook URL is correct (no typos)
- Check dashboard logs for errors
- Test with manual POST request using curl or Postman

### Wrong Symbol on MT5
- Configure symbol mapping in dashboard Settings
- TradingView symbol may differ from MT5 symbol
- Example: "BTCUSD" (TradingView) → "BTCUSDm" (MT5)

---

## 📞 Quick Reference

| What You Want | Which Alert to Use | TP/SL Included? |
|---------------|-------------------|-----------------|
| Auto-trade BUY signals below SMA | 🟢 BUY Signal | ✅ Yes |
| Auto-trade BUY signals above SMA | 🟢 SMART BUY Signal | ✅ Yes |
| Auto-trade SELL signals above SMA | 🔴 SELL Signal | ✅ Yes |
| Auto-trade SELL signals below SMA | 🔴 SMART SELL Signal | ✅ Yes |

---

## 🎓 Example Test

To verify TP/SL values are working:

1. Create a BUY alert on BTCUSD 1m chart
2. Leave Message field **EMPTY**
3. Set webhook to your Replit URL
4. Wait for signal to trigger
5. Check your Replit logs - you should see:

```
[WEBHOOK] Raw payload: {"type":"BUY","symbol":"BTCUSD","price":"110701","stopLoss":"110560.2311","takeProfit":"110841.7688","indicator":"Elite_Algo_v13"}
[WEBHOOK] Received signal: BUY BTCUSD @ 110701
[WEBHOOK] TP/SL extracted: SL=110560.2311, TP=110841.7688
```

**✅ If you see actual numbers (not 0), it's working perfectly!**

---

**That's it! Your Elite Algo v13 Indicator is now perfectly configured to send actual TP and SL values! 🎯**
