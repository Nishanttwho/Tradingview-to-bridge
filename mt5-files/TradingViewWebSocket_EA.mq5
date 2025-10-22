//+------------------------------------------------------------------+
//|                                  TradingViewWebSocket_EA.mq5     |
//|                        WebSocket-Based Expert Advisor            |
//|                           Real-time Command Execution            |
//+------------------------------------------------------------------+
#property copyright "TradingView Signal Executor - WebSocket Version"
#property version   "2.00"
#property strict

// Input parameters
input string ServerURL = "wss://your-replit-app.replit.dev";  // WebSocket server URL (use wss:// for https)
input string ApiSecret = "your-secret-key-here";   // API secret for authentication
input double MaxSlippagePercent = 0.5;             // Max slippage as % of entry price

// Hedging settings
input bool Hedging = true;                         // Enable hedging (close opposite positions)
input int Pyramiding = 1;                          // Max positions per symbol

// Stop Loss settings (IMPORTANT: Set to false to use indicator's SL)
input bool EnableStopLoss = false;                 // Enable EA stop loss (false = use indicator SL)
input double StopLossPips = 20;                    // Stop loss in pips (only if EnableStopLoss = true)

// Take Profit settings (IMPORTANT: Set to false to use indicator's TP)
input bool EnableTakeProfit = false;               // Enable EA take profit (false = use indicator TP)
input double TakeProfitPips = 30;                  // Take profit in pips (only if EnableTakeProfit = true)

// Lot Size settings
input bool UseRiskBasedLotSize = true;             // Use risk-based lot sizing
input double RiskPercentPerTrade = 1.0;            // Risk % per trade (e.g., 1.0 = 1% of account)
input double FixedLotSize = 0.01;                  // Fixed lot size (only if UseRiskBasedLotSize = false)

// Partial Exit settings (ALWAYS ENABLED - uses indicator's TP by default)
input bool UseFixedPartialExit = false;            // Use fixed pips for partial exit (false = use indicator's TP)
input double PartialExitPercent = 75;              // Percentage of lot to exit at TP1 (default: 75%)
input double PartialExitPips = 50;                 // Pips for partial exit (only if UseFixedPartialExit = true)

// Break-Even settings
input double BreakEvenPips = 0;                    // Pips profit to trigger break-even (0 = auto: trigger after partial exit or at TP distance)

// Global variables
string wsHost;
int wsPort;
string wsPath;
bool useSSL;
int wsHandle = -1;
bool isConnected = false;
ENUM_ORDER_TYPE_FILLING brokerFillingMode;
datetime lastHeartbeat;
datetime lastHeartbeatSent;

// Position tracking for partial exit and break-even
ulong partialExitedPositions[];  // Track positions that have been partially exited
ulong breakEvenPositions[];      // Track positions that have been moved to break-even

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("=== Initializing TradingView WebSocket EA ===");
   
   // Detect broker's order filling mode
   brokerFillingMode = DetectBrokerFillingMode();
   Print("Detected broker filling mode: ", EnumToString(brokerFillingMode));
   
   // Parse WebSocket URL
   ParseWebSocketURL();
   
   Print("WebSocket: ", (useSSL ? "wss://" : "ws://"), wsHost, ":", wsPort, wsPath);
   Print("IMPORTANT: Add this URL to WebRequest whitelist:");
   Print("Tools -> Options -> Expert Advisors -> Allow WebRequest for:");
   Print(ServerURL);
   
   // Connect to WebSocket
   ConnectWebSocket();
   
   // Set timer for heartbeat and reconnection checks
   EventSetTimer(1);  // Check every 1 second for instant execution
   
   Print("=== EA initialized successfully! ===");
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("=== Shutting down TradingView EA ===");
   EventKillTimer();
   
   if(wsHandle >= 0)
   {
      SocketClose(wsHandle);
      wsHandle = -1;
   }
}

//+------------------------------------------------------------------+
//| Timer function - check connection and heartbeat                  |
//+------------------------------------------------------------------+
void OnTimer()
{
   // OPTIMIZED: 90-second timeout with 20s server pings = 4.5x buffer (prevents false disconnections)
   // Allow up to 4 missed server pings before declaring true disconnection
   // This handles temporary network stalls, broker delays, and NAT/firewall quirks
   if(isConnected && (TimeCurrent() - lastHeartbeat) > 90)
   {
      Print("[WS ERROR] Heartbeat timeout - no message received in 90 seconds (4+ missed pings), reconnecting...");
      isConnected = false;
      if(wsHandle >= 0)
      {
         SocketClose(wsHandle);
         wsHandle = -1;
      }
   }
   
   // Check if we need to reconnect
   if(!isConnected || wsHandle < 0)
   {
      ConnectWebSocket();
   }
   
   // Check for incoming messages and manage partial exits
   if(isConnected && wsHandle >= 0)
   {
      CheckForMessages();
      
      // ALWAYS manage partial exits (75% at TP1, 25% at TP2 with breakeven)
      ManagePartialExits();
      
      // OPTIMIZED: Send heartbeat every 5 seconds (reduced from 1s = 95% less overhead)
      // This is sufficient for connection health monitoring without excessive traffic
      if((TimeCurrent() - lastHeartbeatSent) >= 5)
      {
         SendHeartbeatPing();
         lastHeartbeatSent = TimeCurrent();
      }
   }
}

//+------------------------------------------------------------------+
//| Parse WebSocket URL                                              |
//+------------------------------------------------------------------+
void ParseWebSocketURL()
{
   string url = ServerURL;
   
   // Convert http(s):// to ws(s):// and determine SSL
   if(StringFind(url, "https://") == 0)
   {
      useSSL = true;
      wsPort = 443;
      url = StringSubstr(url, 8);  // Remove "https://"
   }
   else if(StringFind(url, "http://") == 0)
   {
      useSSL = false;
      wsPort = 80;
      url = StringSubstr(url, 7);  // Remove "http://"
   }
   else if(StringFind(url, "wss://") == 0)
   {
      useSSL = true;
      wsPort = 443;
      url = StringSubstr(url, 6);  // Remove "wss://"
   }
   else if(StringFind(url, "ws://") == 0)
   {
      useSSL = false;
      wsPort = 80;
      url = StringSubstr(url, 5);  // Remove "ws://"
   }
   else
   {
      // No scheme - default to secure
      useSSL = true;
      wsPort = 443;
   }
   
   // Extract path
   int pathStart = StringFind(url, "/");
   if(pathStart > 0)
   {
      wsPath = StringSubstr(url, pathStart);
      wsHost = StringSubstr(url, 0, pathStart);
   }
   else
   {
      wsPath = "/mt5-ws";
      wsHost = url;
   }
   
   // Add API secret to path
   if(StringFind(wsPath, "?") < 0)
      wsPath += "?secret=" + ApiSecret;
   else
      wsPath += "&secret=" + ApiSecret;
   
   // Check for port in host
   int portPos = StringFind(wsHost, ":");
   if(portPos > 0)
   {
      wsPort = (int)StringToInteger(StringSubstr(wsHost, portPos + 1));
      wsHost = StringSubstr(wsHost, 0, portPos);
   }
}

//+------------------------------------------------------------------+
//| Connect to WebSocket server                                      |
//+------------------------------------------------------------------+
void ConnectWebSocket()
{
   if(wsHandle >= 0)
   {
      SocketClose(wsHandle);
      wsHandle = -1;
   }
   
   Print("[WS] Connecting to ", wsHost, ":", wsPort, wsPath, " (SSL: ", (useSSL ? "Yes" : "No"), ")");
   
   // Create socket
   wsHandle = SocketCreate();
   if(wsHandle < 0)
   {
      Print("[WS ERROR] Failed to create socket: ", GetLastError());
      return;
   }
   
   // Connect to server (reduced timeout to 2000ms for faster reconnection)
   // Port 443 automatically enables TLS
   if(!SocketConnect(wsHandle, wsHost, wsPort, 2000))
   {
      int error = GetLastError();
      Print("[WS ERROR] Failed to connect: ", error);
      if(error == 4014)
         Print("[WS ERROR] URL not in WebRequest whitelist. Add ", ServerURL, " to allowed URLs");
      SocketClose(wsHandle);
      wsHandle = -1;
      return;
   }
   
   Print("[WS] Socket connected", (useSSL ? " (TLS enabled automatically on port 443)" : ""));
   
   // Build and send WebSocket handshake
   string handshake = 
      "GET " + wsPath + " HTTP/1.1\r\n" +
      "Host: " + wsHost + "\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==\r\n" +
      "Sec-WebSocket-Version: 13\r\n" +
      "\r\n";
   
   // Send handshake (use TLS send if SSL)
   int sent;
   uchar handshakeBytes[];
   StringToCharArray(handshake, handshakeBytes, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(handshakeBytes, ArraySize(handshakeBytes) - 1);  // Remove null terminator
   
   if(useSSL)
   {
      sent = SocketTlsSend(wsHandle, handshakeBytes, ArraySize(handshakeBytes));
   }
   else
   {
      sent = SocketSend(wsHandle, handshakeBytes, ArraySize(handshakeBytes));
   }
   
   if(sent < 0)
   {
      Print("[WS ERROR] Failed to send handshake: ", GetLastError());
      SocketClose(wsHandle);
      wsHandle = -1;
      return;
   }
   
   // Read handshake response (reduced timeout to 2000ms for faster failure detection)
   string response = "";
   uchar buffer[];
   uint timeout = GetTickCount() + 2000;
   
   while(GetTickCount() < timeout)
   {
      int received;
      if(useSSL)
      {
         received = SocketTlsReadAvailable(wsHandle, buffer, 4096);
      }
      else
      {
         uint readable = SocketIsReadable(wsHandle);
         if(readable > 0)
         {
            ArrayResize(buffer, (int)readable);
            received = SocketRead(wsHandle, buffer, (int)readable, 100);
         }
         else
         {
            received = 0;
         }
      }
      
      if(received > 0)
      {
         response += CharArrayToString(buffer, 0, received, CP_UTF8);
         if(StringFind(response, "\r\n\r\n") >= 0)
            break;
      }
      Sleep(1);
   }
   
   // Check if handshake successful
   if(StringFind(response, "101") >= 0 && StringFind(response, "Upgrade") >= 0)
   {
      isConnected = true;
      lastHeartbeat = TimeCurrent();
      lastHeartbeatSent = TimeCurrent();
      Print("[WS] Connected successfully!");
      Print("[WS] Optimized keep-alive: Server pings @20s, EA timeout @90s, EA heartbeat @5s");
   }
   else
   {
      Print("[WS ERROR] Handshake failed. Response: ", StringSubstr(response, 0, 200));
      SocketClose(wsHandle);
      wsHandle = -1;
      isConnected = false;
   }
}

//+------------------------------------------------------------------+
//| Check for incoming WebSocket messages                            |
//+------------------------------------------------------------------+
void CheckForMessages()
{
   if(wsHandle < 0 || !isConnected)
      return;
   
   uchar buffer[];
   int bytes;
   
   if(useSSL)
   {
      bytes = SocketTlsReadAvailable(wsHandle, buffer, 4096);
   }
   else
   {
      uint readable = SocketIsReadable(wsHandle);
      if(readable <= 0)
         return;
      
      ArrayResize(buffer, (int)readable);
      bytes = SocketRead(wsHandle, buffer, (int)readable, 100);
   }
   
   if(bytes <= 0)
      return;
   
   // Update heartbeat - we received data from server
   lastHeartbeat = TimeCurrent();
   
   // Decode WebSocket frame
   string message = DecodeWebSocketFrame(buffer, bytes);
   if(message != "")
   {
      ProcessCommand(message);
   }
}

//+------------------------------------------------------------------+
//| Decode WebSocket frame                                           |
//+------------------------------------------------------------------+
string DecodeWebSocketFrame(uchar &buffer[], int length)
{
   if(length < 2)
      return "";
   
   // Check FIN bit and opcode
   uchar fin = (buffer[0] & 0x80) >> 7;
   uchar opcode = buffer[0] & 0x0F;
   
   // Opcode 1 = text, 8 = close, 9 = ping, 10 = pong
   if(opcode == 8)
   {
      Print("[WS] Connection closed by server");
      isConnected = false;
      return "";
   }
   
   if(opcode == 9)  // Ping
   {
      SendPong();
      return "";
   }
   
   if(opcode != 1)  // Not text
      return "";
   
   // Get payload length
   uchar masked = (buffer[1] & 0x80) >> 7;
   uint payloadLength = buffer[1] & 0x7F;
   int offset = 2;
   
   if(payloadLength == 126)
   {
      payloadLength = (buffer[2] << 8) | buffer[3];
      offset = 4;
   }
   else if(payloadLength == 127)
   {
      offset = 10;  // 64-bit length
   }
   
   // Extract payload
   if(offset + (int)payloadLength > length)
      return "";
   
   uchar payload[];
   ArrayResize(payload, (int)payloadLength);
   ArrayCopy(payload, buffer, 0, offset, (int)payloadLength);
   
   return CharArrayToString(payload, 0, -1, CP_UTF8);
}

//+------------------------------------------------------------------+
//| Send WebSocket message with masking (required for client frames) |
//+------------------------------------------------------------------+
bool SendWebSocketMessage(string message)
{
   if(wsHandle < 0 || !isConnected)
      return false;
   
   // Convert message to bytes
   uchar messageBytes[];
   StringToCharArray(message, messageBytes, 0, WHOLE_ARRAY, CP_UTF8);
   int messageLen = ArraySize(messageBytes) - 1;  // Exclude null terminator
   
   // Calculate frame size
   int frameSize = 6 + messageLen;  // Header(2) + Mask(4) + Payload
   if(messageLen > 125)
      frameSize += 2;  // Extended length
   
   uchar frame[];
   ArrayResize(frame, frameSize);
   
   // FIN bit + opcode 1 (text)
   frame[0] = 0x81;
   
   // Mask bit + payload length
   int offset = 2;
   if(messageLen <= 125)
   {
      frame[1] = 0x80 | (uchar)messageLen;  // Mask bit set + length
   }
   else
   {
      frame[1] = 0x80 | 126;  // Mask bit + extended length indicator
      frame[2] = (uchar)((messageLen >> 8) & 0xFF);
      frame[3] = (uchar)(messageLen & 0xFF);
      offset = 4;
   }
   
   // Generate random mask key (required for client frames)
   uchar mask[4];
   for(int i = 0; i < 4; i++)
      mask[i] = (uchar)(MathRand() % 256);
   
   // Copy mask to frame
   for(int i = 0; i < 4; i++)
      frame[offset + i] = mask[i];
   offset += 4;
   
   // Mask and copy payload
   for(int i = 0; i < messageLen; i++)
      frame[offset + i] = messageBytes[i] ^ mask[i % 4];
   
   // Send frame
   int sent;
   if(useSSL)
   {
      sent = SocketTlsSend(wsHandle, frame, frameSize);
   }
   else
   {
      sent = SocketSend(wsHandle, frame, frameSize);
   }
   
   return sent == frameSize;
}

//+------------------------------------------------------------------+
//| Send pong response (must be masked for client frames)            |
//+------------------------------------------------------------------+
void SendPong()
{
   // Pong frame with masking (required for all client frames)
   uchar frame[6];  // Header(2) + Mask(4) + no payload
   
   frame[0] = 0x8A;  // FIN + opcode 10 (pong)
   frame[1] = 0x80;  // Mask bit set + 0 length
   
   // Generate random mask key (required even for zero-length payload)
   for(int i = 0; i < 4; i++)
      frame[2 + i] = (uchar)(MathRand() % 256);
   
   // No payload to mask, but mask key is still required
   
   if(useSSL)
      SocketTlsSend(wsHandle, frame, 6);
   else
      SocketSend(wsHandle, frame, 6);
}

//+------------------------------------------------------------------+
//| Process received command                                          |
//+------------------------------------------------------------------+
void ProcessCommand(string commandJson)
{
   string commandId = GetJsonValue(commandJson, "id");
   string action = GetJsonValue(commandJson, "action");
   
   if(commandId == "")
   {
      Print("[WS ERROR] No command ID");
      return;
   }
   
   Print("[WS COMMAND] ID: ", commandId, ", Action: ", action);
   
   if(action == "PING")
      SendReport(commandId, true, "", "", "");
   else if(action == "TRADE")
      ExecuteTrade(commandId, commandJson);
   else if(action == "CLOSE")
      ClosePosition(commandId, commandJson);
   else
      SendReport(commandId, false, "", "", "Unknown action: " + action);
}

//+------------------------------------------------------------------+
//| Detect broker's supported order filling mode                     |
//+------------------------------------------------------------------+
ENUM_ORDER_TYPE_FILLING DetectBrokerFillingMode()
{
   string symbol = Symbol();
   int filling = (int)SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
   
   if((filling & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK)
      return ORDER_FILLING_FOK;
   else if((filling & SYMBOL_FILLING_IOC) == SYMBOL_FILLING_IOC)
      return ORDER_FILLING_IOC;
   else
      return ORDER_FILLING_RETURN;
}

//+------------------------------------------------------------------+
//| Normalize price to symbol's tick size                            |
//+------------------------------------------------------------------+
double NormalizePrice(string symbol, double price)
{
   double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize == 0) tickSize = SymbolInfoDouble(symbol, SYMBOL_POINT);
   
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   double normalized = MathRound(price / tickSize) * tickSize;
   return NormalizeDouble(normalized, digits);
}

//+------------------------------------------------------------------+
//| Normalize volume to symbol's lot step                            |
//+------------------------------------------------------------------+
double NormalizeVolume(string symbol, double volume)
{
   double minVolume = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxVolume = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double volumeStep = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   
   if(volumeStep == 0) volumeStep = 0.01;
   
   volume = MathRound(volume / volumeStep) * volumeStep;
   
   if(volume < minVolume) volume = minVolume;
   if(volume > maxVolume) volume = maxVolume;
   
   return volume;
}

//+------------------------------------------------------------------+
//| Ensure symbol is ready                                           |
//+------------------------------------------------------------------+
bool EnsureSymbolReady(string symbol)
{
   uint startTime = GetTickCount();
   
   if(!SymbolInfoInteger(symbol, SYMBOL_SELECT))
   {
      if(!SymbolSelect(symbol, true))
      {
         Print("[ERROR] Symbol ", symbol, " not found");
         return false;
      }
   }
   
   int attempts = 0;
   while(!SymbolInfoInteger(symbol, SYMBOL_SELECT) && attempts < 50)
   {
      Sleep(10);  // Reduced from 100ms to 10ms for faster symbol loading
      attempts++;
   }
   
   uint loadTime = GetTickCount() - startTime;
   
   if(!SymbolInfoInteger(symbol, SYMBOL_SELECT))
   {
      Print("[ERROR] Failed to load symbol ", symbol, " after ", loadTime, "ms (", attempts, " attempts)");
      return false;
   }
   
   Print("Symbol ", symbol, " loaded successfully in ", loadTime, "ms (", attempts, " attempts)");
   return true;
}

//+------------------------------------------------------------------+
//| Get pip value for symbol (dynamic based on symbol type)          |
//+------------------------------------------------------------------+
double GetPipValue(string symbol)
{
   // Check if it's a crypto pair (contains BTC, ETH, etc.)
   if(StringFind(symbol, "BTC") >= 0 || StringFind(symbol, "ETH") >= 0 || 
      StringFind(symbol, "XRP") >= 0 || StringFind(symbol, "LTC") >= 0)
   {
      return 1.0;  // 1 point = 1 pip for crypto
   }
   
   // Check if it's Gold (XAUUSD) - 1 pip = 0.10 (10 points)
   if(StringFind(symbol, "XAU") >= 0 || StringFind(symbol, "GOLD") >= 0)
   {
      return 0.10;  // 0.10 = 1 pip for Gold
   }
   
   // Check if it's Silver (XAGUSD) - 1 pip = 0.01 (1 point)
   if(StringFind(symbol, "XAG") >= 0 || StringFind(symbol, "SILVER") >= 0)
   {
      return 0.01;  // 0.01 = 1 pip for Silver
   }
   
   // Check if it's a JPY pair
   if(StringFind(symbol, "JPY") >= 0)
   {
      return 0.01;  // 0.01 = 1 pip for JPY pairs
   }
   
   // Standard forex pairs
   return 0.0001;  // 0.0001 = 1 pip for standard forex
}

//+------------------------------------------------------------------+
//| Count open positions for symbol                                  |
//+------------------------------------------------------------------+
int CountPositionsForSymbol(string symbol)
{
   int count = 0;
   int totalPositions = PositionsTotal();
   
   for(int i = 0; i < totalPositions; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         string posSymbol = PositionGetString(POSITION_SYMBOL);
         if(posSymbol == symbol)
            count++;
      }
   }
   
   return count;
}

//+------------------------------------------------------------------+
//| Close opposite positions for symbol                              |
//+------------------------------------------------------------------+
void CloseOppositePositions(string symbol, string tradeType)
{
   Print("[HEDGING] Checking for opposite positions to close - Symbol: ", symbol, ", New trade type: ", tradeType);
   
   int totalPositions = PositionsTotal();
   int closedCount = 0;
   
   for(int i = totalPositions - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         string posSymbol = PositionGetString(POSITION_SYMBOL);
         long posType = PositionGetInteger(POSITION_TYPE);
         
         if(posSymbol == symbol)
         {
            bool isOpposite = false;
            
            if(tradeType == "BUY" && posType == POSITION_TYPE_SELL)
               isOpposite = true;
            else if(tradeType == "SELL" && posType == POSITION_TYPE_BUY)
               isOpposite = true;
            
            if(isOpposite)
            {
               Print("[HEDGING] Closing opposite position: ", ticket, " (", (posType == POSITION_TYPE_BUY ? "BUY" : "SELL"), ")");
               
               MqlTradeRequest request = {};
               MqlTradeResult result = {};
               
               request.action = TRADE_ACTION_DEAL;
               request.position = ticket;
               request.symbol = posSymbol;
               request.volume = PositionGetDouble(POSITION_VOLUME);
               request.type = (posType == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
               request.price = (request.type == ORDER_TYPE_SELL) ? SymbolInfoDouble(posSymbol, SYMBOL_BID) : SymbolInfoDouble(posSymbol, SYMBOL_ASK);
               request.deviation = 10;
               request.magic = 123456;
               request.type_filling = brokerFillingMode;
               
               if(OrderSend(request, result))
               {
                  if(result.retcode == TRADE_RETCODE_DONE)
                  {
                     Print("[HEDGING] Successfully closed position: ", ticket, ", retcode: ", result.retcode);
                     closedCount++;
                  }
                  else
                  {
                     Print("[HEDGING ERROR] Close rejected for position: ", ticket, ", retcode: ", result.retcode);
                  }
               }
               else
               {
                  Print("[HEDGING ERROR] Failed to close position: ", ticket, ", Error: ", GetLastError());
               }
            }
         }
      }
   }
   
   if(closedCount > 0)
      Print("[HEDGING] Closed ", closedCount, " opposite position(s) for ", symbol);
   else
      Print("[HEDGING] No opposite positions found for ", symbol);
}

//+------------------------------------------------------------------+
//| Execute trade                                                     |
//+------------------------------------------------------------------+
void ExecuteTrade(string commandId, string commandJson)
{
   string symbol = GetJsonValue(commandJson, "symbol");
   string type = GetJsonValue(commandJson, "type");
   double serverVolume = StringToDouble(GetJsonValue(commandJson, "volume"));
   double stopLoss = StringToDouble(GetJsonValue(commandJson, "stopLoss"));
   double takeProfit = StringToDouble(GetJsonValue(commandJson, "takeProfit"));
   
   // Volume will be calculated later based on risk or fixed lot size
   double volume = FixedLotSize;
   
   Print("[TRADE] Received command - Symbol: ", symbol, ", Type: ", type);
   Print("[TRADE] Server volume: ", serverVolume, ", Using EA FixedLotSize: ", volume);
   Print("[TRADE] Server SL: ", stopLoss, ", Server TP: ", takeProfit);
   
   if(symbol == "" || type == "")
   {
      SendReport(commandId, false, "", "", "Missing symbol or type");
      return;
   }
   
   if(!EnsureSymbolReady(symbol))
   {
      SendReport(commandId, false, "", "", "Symbol not available: " + symbol);
      return;
   }
   
   // HEDGING: Close opposite positions if enabled
   // NOTE: This provides "close on opposite signal" functionality when both SL and TP are disabled
   // When EnableStopLoss=false and EnableTakeProfit=false, positions stay open until an opposite signal arrives
   // The hedging mechanism then closes the existing position before opening the new opposite trade
   if(Hedging)
   {
      Print("[HEDGING] Hedging is ENABLED - checking for opposite positions");
      CloseOppositePositions(symbol, type);
   }
   else
   {
      Print("[HEDGING] Hedging is DISABLED - keeping opposite positions");
   }
   
   // PYRAMIDING: Check max positions per symbol
   int currentPositions = CountPositionsForSymbol(symbol);
   if(currentPositions >= Pyramiding)
   {
      string error = "Max positions reached for " + symbol + " (limit: " + IntegerToString(Pyramiding) + ")";
      Print("[PYRAMIDING] ", error);
      SendReport(commandId, false, "", "", error);
      return;
   }
   
   // Get current market price for execution
   double currentPrice;
   if(type == "BUY")
      currentPrice = SymbolInfoDouble(symbol, SYMBOL_ASK);
   else
      currentPrice = SymbolInfoDouble(symbol, SYMBOL_BID);
   
   // STOP LOSS & TAKE PROFIT: Use values from TradingView indicator
   // The indicator sends exact SL/TP values - we just use them directly
   double pipValue = GetPipValue(symbol);
   
   Print("[SL/TP] Using indicator values - SL: ", (stopLoss > 0 ? DoubleToString(stopLoss) : "None"), ", TP: ", (takeProfit > 0 ? DoubleToString(takeProfit) : "None"));
   
   // Normalize SL/TP prices to symbol's tick size
   if(stopLoss > 0)
      stopLoss = NormalizePrice(symbol, stopLoss);
   if(takeProfit > 0)
      takeProfit = NormalizePrice(symbol, takeProfit);
   
   // CALCULATE LOT SIZE based on risk percentage (if enabled and SL is set)
   if(UseRiskBasedLotSize && stopLoss > 0)
   {
      // Calculate SL distance in pips
      double slDistance = MathAbs(currentPrice - stopLoss);
      double slPips = slDistance / pipValue;
      
      // Get account balance and calculate risk amount
      double accountBalance = AccountInfoDouble(ACCOUNT_BALANCE);
      double riskAmount = accountBalance * (RiskPercentPerTrade / 100.0);
      
      // Calculate pip value per lot for this symbol
      double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
      double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
      double pipValuePerLot = (tickValue / tickSize) * pipValue;
      
      // Calculate lot size: Risk Amount / (SL in pips * pip value per lot)
      volume = riskAmount / (slPips * pipValuePerLot);
      volume = NormalizeVolume(symbol, volume);
      
      Print("[RISK CALC] Account: $", accountBalance, ", Risk: ", RiskPercentPerTrade, "% ($", riskAmount, ")");
      Print("[RISK CALC] SL Distance: ", slPips, " pips, Calculated Lot Size: ", volume);
   }
   else if(UseRiskBasedLotSize && stopLoss <= 0)
   {
      Print("[RISK CALC] Risk-based sizing enabled but no SL set - using FixedLotSize: ", FixedLotSize);
      volume = FixedLotSize;
   }
   else
   {
      Print("[LOT SIZE] Using fixed lot size: ", FixedLotSize);
      volume = FixedLotSize;
   }
   
   // Normalize and validate volume
   volume = NormalizeVolume(symbol, volume);
   if(volume <= 0)
   {
      SendReport(commandId, false, "", "", "Invalid calculated volume");
      return;
   }
   
   Print("[TRADE] Current market price: ", currentPrice, ", Final SL: ", (stopLoss > 0 ? DoubleToString(stopLoss) : "None"), ", Final TP: ", (takeProfit > 0 ? DoubleToString(takeProfit) : "None"), ", Volume: ", volume);
   
   // Validate SL/TP (only if they are set)
   if(type == "BUY")
   {
      if(stopLoss > 0 && stopLoss >= currentPrice)
      {
         SendReport(commandId, false, "", "", "Invalid SL for BUY");
         return;
      }
      if(takeProfit > 0 && takeProfit <= currentPrice)
      {
         SendReport(commandId, false, "", "", "Invalid TP for BUY");
         return;
      }
   }
   else
   {
      if(stopLoss > 0 && stopLoss <= currentPrice)
      {
         SendReport(commandId, false, "", "", "Invalid SL for SELL");
         return;
      }
      if(takeProfit > 0 && takeProfit >= currentPrice)
      {
         SendReport(commandId, false, "", "", "Invalid TP for SELL");
         return;
      }
   }
   
   MqlTradeRequest request = {};
   MqlTradeResult result = {};
   
   request.action = TRADE_ACTION_DEAL;
   request.symbol = symbol;
   request.volume = volume;
   request.type = (type == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   request.price = currentPrice;
   request.sl = stopLoss;
   
   // CRITICAL FIX FOR PARTIAL EXITS: Do NOT set TP on position
   // This prevents MT5 from auto-closing the full position at TP1
   // Instead, store TP in comment and let ManagePartialExits handle it manually
   request.tp = 0;  // No TP - EA will manage manually
   
   // Store the intended TP1 in the comment for ManagePartialExits to use
   string tpComment = "";
   if(takeProfit > 0)
      tpComment = "|TP1:" + DoubleToString(takeProfit, 5);
   request.comment = "TradingView" + tpComment;
   
   request.deviation = (ulong)(currentPrice * MaxSlippagePercent / 100.0 / SymbolInfoDouble(symbol, SYMBOL_POINT));
   request.magic = 123456;
   request.type_filling = brokerFillingMode;
   
   Print("[TRADE] Opening position WITHOUT TP (stored in comment: ", takeProfit, ") to enable partial exits");
   
   if(!OrderSend(request, result))
   {
      string error = "OrderSend failed: " + IntegerToString(GetLastError());
      Print("[TRADE ERROR] ", error);
      SendReport(commandId, false, "", "", error);
      return;
   }
   
   if(result.retcode != TRADE_RETCODE_DONE)
   {
      string error = "Trade failed: retcode=" + IntegerToString(result.retcode);
      Print("[TRADE ERROR] ", error);
      SendReport(commandId, false, "", "", error);
      return;
   }
   
   Print("[TRADE SUCCESS] Order: ", result.order, ", Deal: ", result.deal);
   SendReport(commandId, true, IntegerToString(result.order), IntegerToString(result.order), "");
}

//+------------------------------------------------------------------+
//| Close position                                                    |
//+------------------------------------------------------------------+
void ClosePosition(string commandId, string commandJson)
{
   string positionId = GetJsonValue(commandJson, "positionId");
   ulong ticket = StringToInteger(positionId);
   
   if(!PositionSelectByTicket(ticket))
   {
      SendReport(commandId, false, "", "", "Position not found: " + positionId);
      return;
   }
   
   MqlTradeRequest request = {};
   MqlTradeResult result = {};
   
   request.action = TRADE_ACTION_DEAL;
   request.position = ticket;
   request.symbol = PositionGetString(POSITION_SYMBOL);
   request.volume = PositionGetDouble(POSITION_VOLUME);
   request.type = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
   request.price = (request.type == ORDER_TYPE_SELL) ? SymbolInfoDouble(request.symbol, SYMBOL_BID) : SymbolInfoDouble(request.symbol, SYMBOL_ASK);
   request.deviation = 10;
   request.magic = 123456;
   request.type_filling = brokerFillingMode;
   
   if(!OrderSend(request, result))
   {
      SendReport(commandId, false, "", "", "Close failed: " + IntegerToString(GetLastError()));
      return;
   }
   
   Print("[CLOSE SUCCESS] Position ", positionId, " closed");
   SendReport(commandId, true, "", "", "");
}

//+------------------------------------------------------------------+
//| Extract TP1 from position comment                                |
//+------------------------------------------------------------------+
double GetTP1FromComment(string comment)
{
   // Comment format: "TradingView|TP1:1.23456"
   int startPos = StringFind(comment, "|TP1:");
   if(startPos < 0)
      return 0;
   
   string tpStr = StringSubstr(comment, startPos + 5);  // Skip "|TP1:"
   return StringToDouble(tpStr);
}

//+------------------------------------------------------------------+
//| Check if position is in tracking array                           |
//+------------------------------------------------------------------+
bool IsPositionTracked(ulong ticket, ulong &trackingArray[])
{
   int size = ArraySize(trackingArray);
   for(int i = 0; i < size; i++)
   {
      if(trackingArray[i] == ticket)
         return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Add position to tracking array                                   |
//+------------------------------------------------------------------+
void AddPositionToTracking(ulong ticket, ulong &trackingArray[])
{
   int size = ArraySize(trackingArray);
   ArrayResize(trackingArray, size + 1);
   trackingArray[size] = ticket;
}

//+------------------------------------------------------------------+
//| Manage partial exits for positions                               |
//+------------------------------------------------------------------+
void ManagePartialExits()
{
   int totalPositions = PositionsTotal();
   
   for(int i = 0; i < totalPositions; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         // Skip if already partially exited
         if(IsPositionTracked(ticket, partialExitedPositions))
            continue;
         
         string symbol = PositionGetString(POSITION_SYMBOL);
         long posType = PositionGetInteger(POSITION_TYPE);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         double currentPrice = (posType == POSITION_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);
         double volume = PositionGetDouble(POSITION_VOLUME);
         string comment = PositionGetString(POSITION_COMMENT);
         
         // Calculate profit in pips
         double pipValue = GetPipValue(symbol);
         double priceDiff = (posType == POSITION_TYPE_BUY) ? (currentPrice - openPrice) : (openPrice - currentPrice);
         double profitPips = priceDiff / pipValue;
         
         // Determine partial exit trigger based on UseFixedPartialExit setting
         double exitTriggerPips = 0;
         double tp1Price = 0;
         
         if(UseFixedPartialExit)
         {
            // Use fixed pips setting
            exitTriggerPips = PartialExitPips;
            Print("[PARTIAL EXIT] Using FIXED pips: ", DoubleToString(exitTriggerPips, 1), " pips");
         }
         else
         {
            // Read TP1 from comment (since we don't set TP on position to prevent auto-close)
            tp1Price = GetTP1FromComment(comment);
            if(tp1Price > 0)
            {
               // Use indicator's TP1 distance (1:1 ratio)
               double tpDistance = (posType == POSITION_TYPE_BUY) ? (tp1Price - openPrice) : (openPrice - tp1Price);
               exitTriggerPips = tpDistance / pipValue;
               Print("[PARTIAL EXIT] Using INDICATOR TP1 from comment: ", DoubleToString(exitTriggerPips, 1), " pips (TP1=", DoubleToString(tp1Price, 5), ")");
            }
            else
            {
               Print("[PARTIAL EXIT] No TP1 in comment - skipping position ", ticket);
               continue;
            }
         }
         
         // Check if profit reached partial exit target
         if(exitTriggerPips > 0 && profitPips >= exitTriggerPips)
         {
            double exitVolume = NormalizeVolume(symbol, volume * PartialExitPercent / 100.0);
            double remainingPercent = 100.0 - PartialExitPercent;
            
            // Make sure we don't try to close more than we have or less than minimum
            if(exitVolume > 0 && exitVolume < volume)
            {
               Print("[PARTIAL EXIT @ TP1] Position ", ticket, " (", symbol, ") reached TP1 at ", DoubleToString(profitPips, 1), " pips");
               Print("[PARTIAL EXIT @ TP1] Closing ", DoubleToString(PartialExitPercent, 0), "% (", DoubleToString(exitVolume, 2), " lots), keeping ", DoubleToString(remainingPercent, 0), "% for TP2");
               
               MqlTradeRequest request = {};
               MqlTradeResult result = {};
               
               request.action = TRADE_ACTION_DEAL;
               request.position = ticket;
               request.symbol = symbol;
               request.volume = exitVolume;
               request.type = (posType == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
               request.price = currentPrice;
               request.deviation = 10;
               request.magic = 123456;
               request.comment = "Partial Exit";
               request.type_filling = brokerFillingMode;
               
               if(OrderSend(request, result))
               {
                  if(result.retcode == TRADE_RETCODE_DONE)
                  {
                     Print("[PARTIAL EXIT SUCCESS] Closed ", DoubleToString(exitVolume, 2), " lots of position ", ticket);
                     AddPositionToTracking(ticket, partialExitedPositions);
                     
                     // After partial exit, set TP2 and breakeven on remaining position
                     Sleep(100); // Brief pause to ensure partial close is processed
                     
                     if(PositionSelectByTicket(ticket))
                     {
                        // Calculate TP2 (2x the original TP1 distance)
                        double newTP = 0;
                        if(tp1Price > 0)
                        {
                           double tpDistance = (posType == POSITION_TYPE_BUY) ? (tp1Price - openPrice) : (openPrice - tp1Price);
                           if(posType == POSITION_TYPE_BUY)
                              newTP = openPrice + (2.0 * tpDistance);
                           else
                              newTP = openPrice - (2.0 * tpDistance);
                           
                           newTP = NormalizePrice(symbol, newTP);
                           Print("[TP2 CALC] TP1=", DoubleToString(tp1Price, 5), ", TP1 Distance=", DoubleToString(tpDistance, 5), ", TP2=", DoubleToString(newTP, 5));
                        }
                        else if(UseFixedPartialExit)
                        {
                           // For fixed partial exit, calculate TP2 based on fixed pips
                           double tp2Distance = PartialExitPips * 2.0 * pipValue;
                           if(posType == POSITION_TYPE_BUY)
                              newTP = openPrice + tp2Distance;
                           else
                              newTP = openPrice - tp2Distance;
                           
                           newTP = NormalizePrice(symbol, newTP);
                           Print("[TP2 CALC] Using FIXED TP2 at ", DoubleToString(PartialExitPips * 2.0, 1), " pips: ", DoubleToString(newTP, 5));
                        }
                        
                        // Set breakeven SL
                        double newSL = NormalizePrice(symbol, openPrice);
                        
                        // Modify position to set TP2 and breakeven
                        MqlTradeRequest modifyRequest = {};
                        MqlTradeResult modifyResult = {};
                        
                        modifyRequest.action = TRADE_ACTION_SLTP;
                        modifyRequest.position = ticket;
                        modifyRequest.symbol = symbol;
                        modifyRequest.sl = newSL;
                        modifyRequest.tp = newTP;
                        
                        if(OrderSend(modifyRequest, modifyResult))
                        {
                           if(modifyResult.retcode == TRADE_RETCODE_DONE)
                           {
                              double tp2Pips = (newTP > 0) ? (MathAbs(newTP - openPrice) / pipValue) : 0;
                              Print("[TP2 & BREAKEVEN] Successfully set for remaining ", DoubleToString(remainingPercent, 0), "%:");
                              Print("[TP2 & BREAKEVEN] TP2 = ", DoubleToString(newTP, 5), " (", DoubleToString(tp2Pips, 1), " pips = 2:1 ratio)");
                              Print("[TP2 & BREAKEVEN] SL moved to breakeven = ", DoubleToString(newSL, 5));
                              // Mark as breakeven so ManageBreakEven doesn't try to modify again
                              AddPositionToTracking(ticket, breakEvenPositions);
                           }
                           else
                           {
                              Print("[PARTIAL EXIT WARNING] Failed to set TP2/breakeven: retcode=", modifyResult.retcode);
                           }
                        }
                        else
                        {
                           Print("[PARTIAL EXIT WARNING] Failed to modify position: ", GetLastError());
                        }
                     }
                  }
                  else
                  {
                     Print("[PARTIAL EXIT ERROR] Failed: retcode=", result.retcode);
                  }
               }
               else
               {
                  Print("[PARTIAL EXIT ERROR] OrderSend failed: ", GetLastError());
               }
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Manage break-even for positions                                  |
//+------------------------------------------------------------------+
void ManageBreakEven()
{
   int totalPositions = PositionsTotal();
   
   for(int i = 0; i < totalPositions; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         // Skip if already moved to break-even
         if(IsPositionTracked(ticket, breakEvenPositions))
            continue;
         
         string symbol = PositionGetString(POSITION_SYMBOL);
         long posType = PositionGetInteger(POSITION_TYPE);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         double currentPrice = (posType == POSITION_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);
         double currentSL = PositionGetDouble(POSITION_SL);
         double positionTP = PositionGetDouble(POSITION_TP);
         
         // Calculate profit in pips
         double pipValue = GetPipValue(symbol);
         double priceDiff = (posType == POSITION_TYPE_BUY) ? (currentPrice - openPrice) : (openPrice - currentPrice);
         double profitPips = priceDiff / pipValue;
         
         // Determine break-even trigger
         double breakEvenTriggerPips = BreakEvenPips;
         
         // If BreakEvenPips = 0, trigger when position is partially exited or use TP distance
         if(BreakEvenPips == 0)
         {
            // If position was partially exited, always move to breakeven
            if(IsPositionTracked(ticket, partialExitedPositions))
            {
               breakEvenTriggerPips = 0; // Trigger immediately for partially exited positions
            }
            // Otherwise use TP distance if available
            else if(positionTP > 0)
            {
               double tpDistance = (posType == POSITION_TYPE_BUY) ? (positionTP - openPrice) : (openPrice - positionTP);
               breakEvenTriggerPips = tpDistance / pipValue;
            }
         }
         
         // Check if profit reached break-even target
         if(breakEvenTriggerPips >= 0 && profitPips >= breakEvenTriggerPips)
         {
            // Check if SL is not already at or better than break-even
            bool needsUpdate = false;
            if(posType == POSITION_TYPE_BUY && (currentSL == 0 || currentSL < openPrice))
               needsUpdate = true;
            else if(posType == POSITION_TYPE_SELL && (currentSL == 0 || currentSL > openPrice))
               needsUpdate = true;
            
            if(needsUpdate)
            {
               double newSL = NormalizePrice(symbol, openPrice);
               
               Print("[BREAK-EVEN] Position ", ticket, " (", symbol, ") profit: ", DoubleToString(profitPips, 1), " pips - moving SL to break-even: ", DoubleToString(newSL, 5));
               
               MqlTradeRequest request = {};
               MqlTradeResult result = {};
               
               request.action = TRADE_ACTION_SLTP;
               request.position = ticket;
               request.symbol = symbol;
               request.sl = newSL;
               request.tp = PositionGetDouble(POSITION_TP);
               
               if(OrderSend(request, result))
               {
                  if(result.retcode == TRADE_RETCODE_DONE)
                  {
                     Print("[BREAK-EVEN SUCCESS] Moved SL to break-even for position ", ticket);
                     AddPositionToTracking(ticket, breakEvenPositions);
                  }
                  else
                  {
                     Print("[BREAK-EVEN ERROR] Failed: retcode=", result.retcode);
                  }
               }
               else
               {
                  Print("[BREAK-EVEN ERROR] OrderSend failed: ", GetLastError());
               }
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Send execution report via WebSocket                              |
//+------------------------------------------------------------------+
void SendReport(string commandId, bool success, string orderId, string positionId, string error)
{
   string report = "{";
   report += "\"commandId\":\"" + commandId + "\",";
   report += "\"success\":" + (success ? "true" : "false");
   if(orderId != "") report += ",\"orderId\":\"" + orderId + "\"";
   if(positionId != "") report += ",\"positionId\":\"" + positionId + "\"";
   if(error != "") report += ",\"error\":\"" + EscapeJsonString(error) + "\"";
   report += "}";
   
   if(SendWebSocketMessage(report))
   {
      Print("[REPORT] Sent successfully");
   }
   else
   {
      Print("[REPORT ERROR] Failed to send");
   }
}

//+------------------------------------------------------------------+
//| Send heartbeat ping to server to maintain connection             |
//+------------------------------------------------------------------+
void SendHeartbeatPing()
{
   // Send simple heartbeat message to keep connection alive
   // Server will update lastMt5Heartbeat when it receives ANY message
   string json = "{\"type\":\"HEARTBEAT\"}";
   SendWebSocketMessage(json);
}

//+------------------------------------------------------------------+
//| Escape JSON special characters                                   |
//+------------------------------------------------------------------+
string EscapeJsonString(string str)
{
   StringReplace(str, "\\", "\\\\");
   StringReplace(str, "\"", "\\\"");
   StringReplace(str, "\n", "\\n");
   StringReplace(str, "\r", "\\r");
   StringReplace(str, "\t", "\\t");
   return str;
}

//+------------------------------------------------------------------+
//| Simple JSON value extractor                                      |
//+------------------------------------------------------------------+
string GetJsonValue(string json, string key)
{
   string searchKey = "\"" + key + "\"";
   int startPos = StringFind(json, searchKey);
   
   if(startPos == -1) return "";
   
   startPos += StringLen(searchKey);
   while(startPos < StringLen(json) && (StringGetCharacter(json, startPos) == ' ' || StringGetCharacter(json, startPos) == ':'))
      startPos++;
   
   bool isString = (StringGetCharacter(json, startPos) == '"');
   if(isString) startPos++;
   
   int endPos = startPos;
   
   if(isString)
   {
      while(endPos < StringLen(json) && StringGetCharacter(json, endPos) != '"')
         endPos++;
   }
   else
   {
      while(endPos < StringLen(json) && StringGetCharacter(json, endPos) != ',' && StringGetCharacter(json, endPos) != '}')
         endPos++;
   }
   
   return StringSubstr(json, startPos, endPos - startPos);
}
//+------------------------------------------------------------------+
