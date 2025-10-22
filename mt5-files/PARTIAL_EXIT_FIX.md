# Partial Exit Fix - 75% at TP1, 25% at TP2

## Problem
The EA was exiting the **full position** at TP1 (1:1 ratio) instead of only 75%.

## Root Cause
When a position is opened with a take profit set, MT5 automatically closes the **entire position** the instant the price reaches that TP level. This happens **before** the EA's `ManagePartialExits()` function (which runs every 1 second) can execute the partial close logic.

## Solution
**Do NOT set any take profit on the position when it opens.** Instead:
1. Store the intended TP1 value in the position's comment field
2. Let the EA manually close 75% when price reaches TP1
3. Set TP2 (2:1 ratio) on the remaining 25% after partial exit

## Implementation Details

### 1. Opening Position WITHOUT TP (Lines 900-915)
```mql5
// CRITICAL: Set TP to 0 (no take profit on position)
request.tp = 0;

// Store intended TP1 in comment for later use
string tpComment = "";
if(takeProfit > 0)
   tpComment = "|TP1:" + DoubleToString(takeProfit, 5);
request.comment = "TradingView" + tpComment;
```

**Result**: Position opens with NO take profit → MT5 cannot auto-close it

### 2. Extract TP1 from Comment (Lines 977-986)
```mql5
double GetTP1FromComment(string comment)
{
   // Comment format: "TradingView|TP1:1.23456"
   int startPos = StringFind(comment, "|TP1:");
   if(startPos < 0)
      return 0;
   
   string tpStr = StringSubstr(comment, startPos + 5);
   return StringToDouble(tpStr);
}
```

### 3. ManagePartialExits Reads TP1 from Comment (Lines 1050-1066)
```mql5
// Read TP1 from comment instead of position's TP field
tp1Price = GetTP1FromComment(comment);
if(tp1Price > 0)
{
   // Calculate distance to TP1 (1:1 ratio)
   double tpDistance = (posType == POSITION_TYPE_BUY) ? (tp1Price - openPrice) : (openPrice - tp1Price);
   exitTriggerPips = tpDistance / pipValue;
}
```

### 4. Partial Exit at TP1 (Lines 1069-1096)
When price reaches TP1:
```mql5
// Close 75% of position
double exitVolume = volume * PartialExitPercent / 100.0;  // 75%
OrderSend(request, result);  // Manual close - NOT automatic
```

### 5. Set TP2 and Breakeven (Lines 1104-1149)
After closing 75%, for the remaining 25%:
```mql5
// Calculate TP2 = 2x the TP1 distance (2:1 risk-reward)
double tpDistance = (posType == POSITION_TYPE_BUY) ? (tp1Price - openPrice) : (openPrice - tp1Price);
newTP = openPrice + (2.0 * tpDistance);  // or minus for SELL

// Set SL to breakeven (entry price)
newSL = openPrice;

// Apply TP2 and breakeven to remaining 25%
modifyRequest.tp = newTP;
modifyRequest.sl = newSL;
OrderSend(modifyRequest, modifyResult);
```

**Now** MT5 can auto-close the remaining 25% when it reaches TP2 (2:1 ratio)

## How It Works (Complete Flow)

### When Position Opens
```
✓ Position opened with SL from indicator
✓ NO TP set on position (TP = 0)
✓ Intended TP1 stored in comment: "TradingView|TP1:1.23456"
✓ Full position volume opened
```

### EA Monitors Every 1 Second
```
ManagePartialExits() runs
├─ Reads comment: "TradingView|TP1:1.23456"
├─ Extracts TP1 = 1.23456
├─ Calculates distance to TP1 in pips
└─ Compares current profit vs TP1 distance
```

### At 100% of TP1 (1:1 ratio)
```
✓ Price reaches TP1
✓ EA detects: profitPips >= exitTriggerPips
✓ EA manually closes 75% of position
✓ Position marked as "partially exited"
✓ EA waits 100ms for close to process
```

### Immediately After Partial Exit
```
✓ EA calculates TP2 = 2x TP1 distance
✓ EA sets SL = entry price (breakeven)
✓ EA applies TP2 and breakeven to remaining 25%
✓ Position marked as "breakeven moved"
```

### Remaining 25% Has:
- **TP = TP2** (2:1 risk-reward ratio)
- **SL = Entry price** (breakeven - no risk)

### At TP2 (2:1 ratio)
```
✓ MT5 automatically closes remaining 25% at TP2
OR
✓ Price reverses and hits breakeven SL (no loss)
```

## Why This Works

| Previous Approach | Current Fix |
|------------------|-------------|
| TP set on position → MT5 auto-closes full position | **NO TP set** → MT5 cannot auto-close |
| Try to remove TP at 95% → Too slow, race condition | **Never set TP** → No race condition possible |
| EA loses control | **EA has full control** from start to finish |

## Configuration
Ensure your EA settings are:
```
EnableStopLoss = false          ← Use indicator's SL
EnableTakeProfit = false        ← Use indicator's TP (stored in comment)
PartialExitPercent = 75         ← Exit 75% at TP1
BreakEvenPips = 0               ← Auto breakeven after partial exit
UseFixedPartialExit = false     ← Use indicator's TP1 (not fixed pips)
```

## Expected Logs in MT5

### 1. Position Opens
```
[TRADE] Opening position WITHOUT TP (stored in comment: 1.23456) to enable partial exits
[TRADE SUCCESS] Order: 123456, Deal: 123456
```

### 2. Monitoring
```
[PARTIAL EXIT] Using INDICATOR TP1 from comment: 50.0 pips (TP1=1.23456)
```

### 3. At TP1
```
[PARTIAL EXIT @ TP1] Position 123456 (EURUSD) reached TP1 at 50.0 pips
[PARTIAL EXIT @ TP1] Closing 75% (0.75 lots), keeping 25% for TP2
[PARTIAL EXIT SUCCESS] Closed 0.75 lots of position 123456
```

### 4. Setting TP2 and Breakeven
```
[TP2 CALC] TP1=1.23456, TP1 Distance=0.00500, TP2=1.24456
[TP2 & BREAKEVEN] Successfully set for remaining 25%:
[TP2 & BREAKEVEN] TP2 = 1.24456 (100.0 pips = 2:1 ratio)
[TP2 & BREAKEVEN] SL moved to breakeven = 1.21956
```

## Benefits
✅ **100% reliable** - No race conditions or timing issues  
✅ **MT5 cannot auto-close** - Position has no TP initially  
✅ **EA has full control** - Manages everything manually  
✅ **True 75%/25% split** - Exactly as designed  
✅ **Automatic breakeven** - Risk-free after TP1  
✅ **Works with any symbol** - Forex, crypto, gold, indices  

## Testing Steps
1. Upload updated EA to MT5
2. Verify EA settings (see Configuration above)
3. Send signal from TradingView with SL and TP
4. Watch for logs showing:
   - Position opened WITHOUT TP
   - TP1 detected from comment
   - 75% closed at TP1
   - TP2 and breakeven set for 25%
5. Verify in MT5 that remaining position has TP2 and breakeven SL
