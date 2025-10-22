# MT5 WebSocket Bridge Installation Guide

This guide will help you connect your MT5 terminal with the TradingView signal executor using **WebSocket** for real-time, instant command execution.

## Why WebSocket is Better

✅ **Instant execution** - Commands are pushed immediately (no 1-second polling delay)  
✅ **More reliable** - Persistent connection with automatic reconnection  
✅ **More efficient** - Reduces network requests by 99%  
✅ **Real-time** - Bidirectional communication for faster feedback  

---

## 📥 Step 1: Download the Expert Advisor

1. Download the WebSocket EA file: **`TradingViewWebSocket_EA.mq5`**
2. Save it to your MT5 **`MQL5/Experts`** folder:
   - Windows: `C:\Users\[YourName]\AppData\Roaming\MetaQuotes\Terminal\[BrokerID]\MQL5\Experts\`
   - Mac: `~/Library/Application Support/MetaQuotes/Terminal/[BrokerID]/MQL5/Experts/`

---

## 🔧 Step 2: Compile the Expert Advisor

1. Open **MetaEditor** in MT5 (press F4 or click Tools → MetaQuotes Language Editor)
2. In MetaEditor, click **File → Open** and select `TradingViewWebSocket_EA.mq5`
3. Click **Compile** button (F7) or **Tools → Compile**
4. You should see: **"0 error(s), 0 warning(s)"**
5. Close MetaEditor

---

## ⚙️ Step 3: Configure MT5 Settings

### Enable WebRequest

**CRITICAL**: MT5 must allow WebSocket connections to your server.

1. In MT5, go to **Tools → Options → Expert Advisors**
2. Check ✅ **"Allow WebRequest for listed URL:"**
3. Click **Add** and enter your Replit app URL:
   ```
   https://your-replit-app-url.replit.dev
   ```
   Example: `https://tradingbridge-abc123.replit.dev`
4. Click **OK**

### Enable Auto-Trading

1. In MT5, click **Tools → Options → Expert Advisors**
2. Check ✅ **"Allow automated trading"**
3. Click **OK**
4. In the main toolbar, ensure the **"AutoTrading"** button is **GREEN**

---

## 🚀 Step 4: Configure the EA

1. In Navigator, expand **Expert Advisors**
2. Drag `TradingViewWebSocket_EA` onto any chart
3. In the inputs tab, configure:
   - **ServerURL**: Your Replit app URL
     - Use `https://` format (it will auto-convert to `wss://`)
     - Example: `https://your-app.replit.dev`
   - **ApiSecret**: Your API secret (must match what's in the app settings)
   - **MaxSlippagePercent**: `0.5` (0.5% max slippage)
4. In the **Common** tab:
   - Check ✅ **"Allow live trading"**
5. Click **OK**

---

## ✅ Verify Installation

### Check 1: EA is Running

Look at the **Experts** tab (View → Toolbox → Experts). You should see:

```
=== Initializing TradingView WebSocket EA ===
Detected broker filling mode: ORDER_FILLING_FOK
WebSocket URL: wss://your-app.replit.dev/mt5-ws?secret=***
=== EA initialized successfully! ===
[WS] Connecting to: your-app.replit.dev:443/mt5-ws?secret=***
[WS] Connected successfully!
```

### Check 2: Connection Status

In your Replit app dashboard, the connection status should show:
- **"Connected"** (green indicator)
- This confirms MT5 is connected via WebSocket

### Check 3: Test Trade

1. Go to your app's dashboard
2. Enable **Auto-Trade**
3. Send a test signal from TradingView
4. Watch the Experts tab for:
   ```
   [WS COMMAND] ID: xyz123, Action: TRADE
   [TRADE] Symbol: EURUSD, Type: BUY, Volume: 0.01
   [TRADE] SL: 1.08500, TP: 1.08800
   Symbol EURUSD loaded successfully
   [TRADE SUCCESS] Order: 123456, Deal: 123456
   [REPORT] Sent successfully
   ```

---

## 🔄 How It Works

### Old Method (HTTP Polling):
1. ❌ MT5 asks server every 1 second: "Any commands?"
2. ❌ Server responds: "No" or "Yes, here's a command"
3. ❌ 1-second delay minimum
4. ❌ Lots of unnecessary requests

### New Method (WebSocket):
1. ✅ MT5 maintains persistent connection to server
2. ✅ Server **instantly pushes** commands when they arrive
3. ✅ Zero polling delay
4. ✅ Minimal network overhead

---

## 🔍 Troubleshooting

### Problem: "[WS ERROR] Failed to connect: 4014"
**Solution**: URL not in WebRequest whitelist
- Go to Tools → Options → Expert Advisors
- Add your server URL to allowed URLs
- Restart the EA

### Problem: "[WS ERROR] Handshake failed"
**Solution**: API secret might be incorrect
- Check that the `ApiSecret` in EA matches the one in your app settings
- Make sure there are no extra spaces

### Problem: "Connection closed by server"
**Solution**: This is normal if:
- You're redeploying the app
- The server restarted
- The EA will auto-reconnect every 5 seconds

### Problem: EA shows connected but no trades execute
**Solution**:
1. Check Auto-Trade is enabled in the app
2. Verify symbol mapping is correct
3. Check the Experts tab for error messages

---

## 📊 Connection Status

The EA checks connection every **5 seconds** and will:
- Auto-reconnect if disconnected
- Send heartbeat to server to maintain connection
- Handle server restarts gracefully

---

## 🆚 Comparison: HTTP vs WebSocket

| Feature | HTTP Polling | WebSocket |
|---------|-------------|-----------|
| **Latency** | 1-2 seconds | < 100ms |
| **Reliability** | Medium | High |
| **Network Load** | High (1 req/sec) | Very Low |
| **Error Rate** | Higher | Lower |
| **Auto-Reconnect** | No | Yes |
| **Server Load** | High | Low |

---

## 📝 Notes

- The WebSocket connection is **secure** (uses WSS with TLS)
- Your API secret is sent only during initial connection
- Commands are encrypted in transit
- The EA will automatically reconnect if connection drops
- Multiple MT5 instances can connect to the same server

---

## 🎯 Next Steps

1. **Set up TradingView alerts** with your webhook URL
2. **Configure symbol mappings** in the app settings
3. **Set your risk parameters** (SL/TP pips, risk %)
4. **Monitor the dashboard** for real-time trade execution

---

## ⚠️ Important Security Notes

- **Never share your API secret**
- Keep your Replit app URL private
- Only add trusted URLs to WebRequest whitelist
- Monitor your MT5 Experts tab for unauthorized connection attempts

---

## 📞 Support

If you encounter issues:
1. Check the MT5 Experts tab for error messages
2. Verify your settings match between MT5 and the app
3. Ensure your Replit app is running (not sleeping)
4. Check that Auto-Trading is enabled in both MT5 and the app
