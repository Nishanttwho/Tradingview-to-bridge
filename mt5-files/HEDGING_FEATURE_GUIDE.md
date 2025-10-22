# 🛡️ Hedging and Stop Loss Features Guide

This guide explains how to use the new **Hedging** and **Stop Loss** features in the TradingView WebSocket EA.

## 📋 Overview

The EA now includes built-in hedging and stop loss management features that can be configured directly in the EA settings, without needing to modify the dashboard settings.

## 🎯 Features

### 1. **Hedging (Auto-Close Opposite Positions)**

When hedging is enabled, the EA will automatically close any opposite positions for the same symbol before opening a new trade.

**Example:**
- You have an open **BUY** position on **EURUSD**
- A **SELL** signal arrives
- The EA will:
  1. Close the BUY position automatically
  2. Open the new SELL position

**Settings:**
- **Hedging**: `true` (enabled) or `false` (disabled)
  - Default: `true`

### 2. **Pyramiding (Max Positions per Symbol)**

Controls the maximum number of positions allowed for each symbol.

**Settings:**
- **Pyramiding**: Maximum positions per symbol
  - Default: `1` (only one position per symbol at a time)
  - Set to `2` or higher to allow multiple positions on the same symbol

### 3. **Stop Loss Override**

When enabled, the EA will override the server-provided stop loss with your custom stop loss value in pips.

**Settings:**
- **EnableStopLoss**: `true` (enabled) or `false` (disabled)
  - Default: `true`
- **StopLossPips**: Stop loss distance in pips
  - Default: `20` pips
  - Set to `0` to use the stop loss from the server/dashboard

## ⚙️ How to Configure

### Step 1: Drag EA to Chart

1. In MT5 Navigator, find **TradingViewWebSocket_EA**
2. Drag it onto any chart
3. The EA settings window will open

### Step 2: Configure Hedging Settings

In the **Inputs** tab:

```
Hedging = true                  // Enable hedging (close opposite positions)
Pyramiding = 1                  // Max positions per symbol
```

**Common configurations:**

| Use Case | Hedging | Pyramiding |
|----------|---------|------------|
| Standard hedging (close opposite) | `true` | `1` |
| Allow multiple same-direction positions | `true` | `2+` |
| Keep all positions (no hedging) | `false` | `10` |

### Step 3: Configure Stop Loss Settings

In the **Inputs** tab:

```
EnableStopLoss = true          // Enable EA stop loss
StopLossPips = 20              // SL distance in pips
```

**Common configurations:**

| Use Case | EnableStopLoss | StopLossPips |
|----------|----------------|--------------|
| Use EA stop loss (20 pips) | `true` | `20` |
| Use EA stop loss (50 pips) | `true` | `50` |
| Use server/dashboard SL | `false` | `0` |
| No stop loss | `false` | `0` |

### Step 4: Enable Live Trading

In the **Common** tab:
- ✅ Check **"Allow live trading"**
- Click **OK**

## 📊 How It Works

### Hedging Flow:

```
1. Signal received: SELL EURUSD
   ↓
2. Check if Hedging is enabled
   ↓
3. If yes, close all BUY positions on EURUSD
   ↓
4. Check Pyramiding limit
   ↓
5. Open new SELL position
```

### Stop Loss Flow:

```
1. Signal received with or without SL
   ↓
2. Check if EnableStopLoss is true
   ↓
3. If yes, calculate SL from current price
   ↓
4. Override server SL with EA SL
   ↓
5. Place trade with EA stop loss
```

## 🔍 Checking Logs

You can verify hedging and stop loss operations in the MT5 **Experts** log:

### Hedging Logs:
```
[HEDGING] Hedging is ENABLED - checking for opposite positions
[HEDGING] Closing opposite position: 123456 (BUY)
[HEDGING] Successfully closed position: 123456
[HEDGING] Closed 1 opposite position(s) for EURUSD
```

### Stop Loss Logs:
```
[STOP LOSS] EA SL enabled - calculated SL: 1.08500 (20 pips)
[TRADE] Current market price: 1.08700, Normalized SL: 1.08500, TP: 0
```

### Pyramiding Logs:
```
[PYRAMIDING] Max positions reached for EURUSD (limit: 1)
```

## 💡 Tips & Best Practices

### 1. **For Trend Following:**
```
Hedging = true
Pyramiding = 1
EnableStopLoss = true
StopLossPips = 20
```
This ensures you always follow the latest signal direction with a fixed stop loss.

### 2. **For Grid Trading:**
```
Hedging = false
Pyramiding = 10
EnableStopLoss = true
StopLossPips = 30
```
This allows multiple positions in different directions with stop loss protection.

### 3. **For Signal Testing:**
```
Hedging = true
Pyramiding = 1
EnableStopLoss = false
StopLossPips = 0
```
This follows signals with hedging but uses the server-provided stop loss settings.

## ⚠️ Important Notes

1. **Hedging takes priority**: When hedging is enabled, opposite positions are closed BEFORE checking pyramiding limits.

2. **Stop Loss Override**: When `EnableStopLoss = true` and `StopLossPips > 0`, the EA will ALWAYS override the server stop loss.

3. **Magic Number**: All trades use magic number `123456` to identify EA trades.

4. **Symbol-specific**: Hedging and pyramiding are applied per symbol. You can have 1 EURUSD position and 1 GBPUSD position simultaneously.

## 🆘 Troubleshooting

### Issue: Positions not closing on opposite signals
**Solution:** 
- Check that `Hedging = true` in EA settings
- Verify in logs that hedging is enabled
- Ensure the magic number matches (123456)

### Issue: Stop loss not applied
**Solution:**
- Check that `EnableStopLoss = true`
- Verify that `StopLossPips > 0`
- Check logs for SL calculation messages

### Issue: "Max positions reached" error
**Solution:**
- Increase `Pyramiding` value
- Or enable `Hedging` to close opposite positions first

## 📝 Summary

The new hedging and stop loss features give you complete control over your trading strategy directly from the EA settings, without needing to modify the dashboard or send close signals manually. This makes your trading system more robust and easier to manage!
