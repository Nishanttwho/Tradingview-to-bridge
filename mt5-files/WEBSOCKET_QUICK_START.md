# WebSocket Quick Start Guide

## ✅ What's Completed

The WebSocket implementation is now fully functional:

1. ✅ **Server-side WebSocket handler** - Properly handles MT5's manual WebSocket handshake
2. ✅ **MT5 Expert Advisor** - Compilation errors fixed, ready to use
3. ✅ **Settings interface** - Shows WebSocket URL and configuration

## 📋 Setup Steps

### Step 1: Get Your Server URL and API Secret

1. Open your app settings dialog
2. Copy the **MT5 WebSocket URL** (e.g., `https://your-app.replit.dev`)
3. Set an **MT5 API Secret** and save it (remember this secret!)

### Step 2: Install the WebSocket EA

1. Download `TradingViewWebSocket_EA.mq5` from the `mt5-files` folder
2. In MT5, go to **File → Open Data Folder**
3. Navigate to `MQL5/Experts/`
4. Paste the `TradingViewWebSocket_EA.mq5` file
5. Restart MT5 or click "Refresh" in the Navigator

### Step 3: Configure MT5 WebRequest Whitelist

1. In MT5: **Tools → Options → Expert Advisors**
2. Enable: **☑ Allow automated trading**
3. Enable: **☑ Allow WebRequest for listed URLs**
4. Add your server URL to the whitelist:
   ```
   https://your-app.replit.dev
   ```
5. Click **Add** then **OK**

### Step 4: Attach the EA to a Chart

1. Drag `TradingViewWebSocket_EA` from Navigator to any chart
2. In the **Input Parameters**:
   - **ServerURL**: Paste your server URL (e.g., `https://your-app.replit.dev`)
   - **ApiSecret**: Enter the API secret you set in settings
3. Click **OK**

## 🔍 Verify Connection

### In MT5 Terminal (Experts tab):
```
=== Initializing TradingView WebSocket EA ===
Detected broker filling mode: ORDER_FILLING_FOK
WebSocket: wss://your-app.replit.dev /mt5-ws?secret=YOUR_SECRET
[WS] Connecting to your-app.replit.dev:443/mt5-ws?secret=YOUR_SECRET (SSL: Yes)
[WS] Socket connected (TLS enabled automatically on port 443)
[WS] Connected successfully!
```

### In Your App Dashboard:
- **MT5 Status**: Should show "Connected" (green)
- **Last Heartbeat**: Should show current time

## ❓ Troubleshooting

### Error: "URL not in WebRequest whitelist"
- Make sure you added `https://your-app.replit.dev` to MT5's allowed URLs
- Restart MT5 after adding the URL

### Error: "Unauthorized" or Connection Closes
- Verify the ApiSecret in EA matches the one in your app settings
- Make sure you saved the settings in your app

### Connection Timeout
- Check your internet connection
- Verify the server URL is correct
- Make sure the app is running (not sleeping)

## 🎯 How It Works

1. **MT5 → Server**: EA connects via WebSocket to `/mt5-ws` path
2. **Server → MT5**: Server sends trade commands as JSON messages
3. **MT5 → Server**: EA executes trades and sends back results
4. **Real-time**: No polling delay - instant command delivery!

## 📊 Advantages Over HTTP Polling

- ⚡ **Instant**: No 1-second polling delay
- 📉 **Efficient**: Less network traffic
- 🔄 **Bidirectional**: Server can push commands immediately
- 🎯 **Real-time**: Trade signals executed faster
