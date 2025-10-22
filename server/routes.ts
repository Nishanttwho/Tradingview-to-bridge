import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from "zod";
import { insertSignalSchema, insertSettingsSchema, insertSymbolMappingSchema, type WSMessage } from "@shared/schema";
import { mt5Service } from "./mt5-service";

// WebSocket clients tracking
const wsClients = new Set<WebSocket>();
const mt5WsClients = new Set<WebSocket>();

// Broadcast to all connected WebSocket clients (optimized: stringify once)
function broadcast(message: WSMessage) {
  const messageStr = JSON.stringify(message);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// Send command to MT5 via WebSocket
// Returns true if command was sent to at least one MT5 client, false otherwise
function sendCommandToMT5(command: any): boolean {
  const message = JSON.stringify(command);
  let sentToAtLeastOne = false;
  
  mt5WsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      console.log(`[MT5-WS] 📤 Sending command ${command.id} to MT5: ${command.action} ${command.type || ''} ${command.symbol || ''}`);
      client.send(message);
      sentToAtLeastOne = true;
    }
  });
  
  if (!sentToAtLeastOne) {
    console.log(`[MT5-WS] ⚠️ No connected MT5 clients - command ${command.id} will remain pending`);
  }
  
  return sentToAtLeastOne;
}

// Get pip value based on symbol (handles JPY, crypto, indices, metals)
function getPipValue(symbol: string): number {
  const upperSymbol = symbol.toUpperCase();
  
  // JPY pairs: pip = 0.01 (2-3 digits)
  if (upperSymbol.includes('JPY')) {
    return 0.01;
  }
  
  // Gold (XAUUSD): pip = 0.10 (10 points)
  if (upperSymbol.includes('XAU') || upperSymbol.includes('GOLD')) {
    return 0.10;
  }
  
  // Silver (XAGUSD): pip = 0.01 (1 point)
  if (upperSymbol.includes('XAG') || upperSymbol.includes('SILVER')) {
    return 0.01;
  }
  
  // Crypto pairs: use larger pip value for realistic SL/TP
  // BTC/ETH use $10 pip (so 20 pips = $200 SL, more reasonable for high-value cryptos)
  if (upperSymbol.includes('BTC') || upperSymbol.includes('ETH')) {
    return 10.0;
  }
  
  // Other smaller cryptos use $1 pip
  if (upperSymbol.includes('XRP') || upperSymbol.includes('LTC') || 
      upperSymbol.includes('DOGE') || upperSymbol.includes('ADA')) {
    return 1.0;
  }
  
  // Indices: use point value
  if (upperSymbol.includes('US30') || upperSymbol.includes('NAS') || upperSymbol.includes('SPX') || 
      upperSymbol.includes('GER') || upperSymbol.includes('DAX') || upperSymbol.includes('FTSE')) {
    return 1.0;
  }
  
  // Standard forex pairs: pip = 0.0001 (4-5 digits)
  return 0.0001;
}

// Validate symbol format (allows broker suffixes like .e, .cash, _m, etc.)
function isValidSymbol(symbol: string): boolean {
  // Must be 3-30 characters, alphanumeric plus common broker suffixes
  return /^[A-Za-z0-9._-]{3,30}$/.test(symbol);
}

// Calculate lot size based on 1% risk
function calculateLotSize(accountBalance: number, riskPercentage: number, slPips: number): string {
  // Risk amount in account currency
  const riskAmount = (accountBalance * riskPercentage) / 100;
  
  // For standard lot (100,000 units), 1 pip = $10 for most pairs
  // For 20 pips SL: risk per standard lot = 20 * $10 = $200
  const pipValue = 10; // Standard pip value for 1 standard lot
  const riskPerStandardLot = slPips * pipValue;
  
  // Calculate lot size: riskAmount / riskPerStandardLot
  const lotSize = riskAmount / riskPerStandardLot;
  
  // Return with 2 decimal places, minimum 0.01
  // Note: For very small balances (<$200), the minimum 0.01 lot will result in
  // slightly higher than configured risk percentage due to broker minimum lot sizes
  return Math.max(0.01, Number(lotSize.toFixed(2))).toString();
}

// Calculate profit for a trade
function calculateProfit(trade: { type: string; volume: string; openPrice: string | null }, closePrice: string): string {
  const volume = parseFloat(trade.volume);
  const open = parseFloat(trade.openPrice || '0');
  const close = parseFloat(closePrice);
  
  if (open === 0 || close === 0) return '0';
  
  const pipValue = 10; // $10 per pip for standard lot
  const priceDiff = trade.type === 'BUY' ? (close - open) : (open - close);
  const pips = priceDiff / 0.0001; // Convert price difference to pips
  const profit = pips * pipValue * volume;
  
  return profit.toFixed(2);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for uptime monitoring (UptimeRobot, etc.)
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Get dashboard stats
  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getStats();
      // Use heartbeat-based connection status (WebSocket system)
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Get signals
  app.get("/api/signals", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const signals = await storage.getSignals(limit);
      res.json(signals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch signals" });
    }
  });

  // Get error logs - failed signals, commands, and execution results
  app.get("/api/error-logs", async (_req, res) => {
    try {
      const [failedSignals, failedCommands, failedExecutionResults] = await Promise.all([
        storage.getFailedSignals(100),
        storage.getFailedCommands(100),
        storage.getFailedExecutionResults(100),
      ]);

      res.json({
        failedSignals,
        failedCommands,
        failedExecutionResults,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch error logs" });
    }
  });

  // Get pending logs - pending signals and commands with reasons
  app.get("/api/pending-logs", async (_req, res) => {
    try {
      const [pendingSignals, pendingCommands] = await Promise.all([
        storage.getPendingSignals(100),
        storage.getPendingCommands(),
      ]);
      
      console.log(`[API] Pending logs requested: ${pendingSignals.length} signals, ${pendingCommands.length} commands`);
      if (pendingCommands.length > 0) {
        console.log(`[API] Pending command details:`, pendingCommands.map(c => ({
          id: c.id,
          action: c.action,
          symbol: c.symbol,
          type: c.type,
          status: c.status,
          createdAt: c.createdAt,
          sentAt: c.sentAt
        })));
      }

      res.json({
        pendingSignals,
        pendingCommands,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending logs" });
    }
  });


  // TradingView webhook endpoint
  app.post("/api/webhook", async (req, res) => {
    try {
      // Parse TradingView alert payload
      const body = req.body;
      
      console.log(`[WEBHOOK] Raw payload:`, JSON.stringify(body));
      
      // Helper function to safely extract and validate numeric fields
      const safeExtract = (value: any): string | null => {
        if (value === null || value === undefined || value === '') return null;
        // Remove any commas or invalid characters
        const cleaned = String(value).replace(/,/g, '').trim();
        if (cleaned === '' || cleaned === 'null' || cleaned === 'undefined') return null;
        // Validate it's a number
        const num = parseFloat(cleaned);
        if (isNaN(num)) return null;
        return cleaned;
      };
      
      // Extract signal data (TradingView sends many different formats)
      // Support: {symbol, type, price}, {ticker, action, close}, {symbol, side, last}, etc.
      const tradingViewSymbol = body.symbol || body.ticker || body.pair || body.instrument || 'UNKNOWN';
      const signalType = body.type || body.action || body.side || body.signal || 'BUY';
      const signalPrice = safeExtract(body.price || body.close || body.last || body.entry);
      
      // Target Trend indicator fields - support multiple field name variations
      const indicatorType = body.indicator || body.indicatorType || body.signalType || null;
      const entryPrice = safeExtract(body.entry || body.entryPrice);
      
      // Extract stopLoss - try multiple field names and clean the value
      const stopLoss = safeExtract(
        body.stopLoss || body.sl || body.stop_loss || body.SL
      );
      
      // Extract takeProfit - try multiple field names and clean the value
      const takeProfit = safeExtract(
        body.takeProfit1 || body.tp1 || body.takeProfit || body.tp || 
        body.TP1 || body.TP || body.takeProfit_Algo_V1
      );
      
      // Validate extracted data
      if (tradingViewSymbol === 'UNKNOWN') {
        console.log(`[WEBHOOK] No symbol found in payload`);
        return res.status(400).json({ 
          error: "Missing symbol in webhook payload",
          hint: "Include 'symbol', 'ticker', 'pair', or 'instrument' in your TradingView alert"
        });
      }
      
      // Normalize signal type (support: BUY/SELL, buy/sell, long/short, LONG/SHORT)
      let normalizedType = signalType.toString().toUpperCase();
      if (normalizedType === 'LONG') normalizedType = 'BUY';
      if (normalizedType === 'SHORT') normalizedType = 'SELL';
      
      if (normalizedType !== 'BUY' && normalizedType !== 'SELL') {
        console.log(`[WEBHOOK] Invalid signal type: ${signalType}`);
        return res.status(400).json({ 
          error: "Invalid signal type",
          received: signalType,
          expected: "BUY, SELL, LONG, or SHORT"
        });
      }
      
      // Map TradingView symbol to MT5 symbol
      const mt5Symbol = await storage.mapSymbol(tradingViewSymbol);
      
      console.log(`[WEBHOOK] Symbol mapping: TradingView="${tradingViewSymbol}" -> MT5="${mt5Symbol}"`);
      
      const signalData = {
        type: normalizedType,
        symbol: mt5Symbol,
        price: signalPrice,
        source: 'tradingview',
        status: 'pending',
        indicatorType: indicatorType,
        entryPrice: entryPrice,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
      };

      // Validate signal
      const validatedSignal = insertSignalSchema.parse(signalData);
      
      console.log(`[WEBHOOK] Received signal: ${validatedSignal.type} ${validatedSignal.symbol} @ ${validatedSignal.price}`);
      console.log(`[WEBHOOK] TP/SL extracted: SL=${stopLoss || 'NONE'}, TP=${takeProfit || 'NONE'}`);
      
      // CRITICAL FIX 1: Extend duplicate check to 60 seconds (for 1-minute candles)
      // CRITICAL FIX 2: Check for signals that are 'pending' or 'executed' to prevent duplicates
      // NOTE: Keep at 100 signals to ensure full 60-second window coverage even during high volume
      const recentSignals = await storage.getSignals(100);
      const now = Date.now();
      const sixtySecondsAgo = now - 60000; // Changed from 5 seconds to 60 seconds
      
      const isDuplicate = recentSignals.some(s => {
        const signalTime = new Date(s.timestamp).getTime();
        return (
          s.symbol === validatedSignal.symbol &&
          s.type === validatedSignal.type &&
          signalTime >= sixtySecondsAgo &&
          s.status !== 'failed' // Allow retrying failed signals
        );
      });
      
      if (isDuplicate) {
        console.log(`[WEBHOOK] Duplicate signal detected: ${validatedSignal.type} ${validatedSignal.symbol}, skipping`);
        return res.json({ 
          success: true, 
          message: 'Duplicate signal ignored',
          note: 'Signal received but already processed recently (within 60 seconds)'
        });
      }
      
      // Create signal
      const signal = await storage.createSignal(validatedSignal);
      console.log(`[WEBHOOK] Created signal ID: ${signal.id}`);

      // Check if auto-trade is enabled
      const settings = await storage.getSettings();
      
      // Check MT5 connection status (aligned with optimized 90s timeout)
      const isMt5Connected = settings?.lastMt5Heartbeat && 
        (Date.now() - new Date(settings.lastMt5Heartbeat).getTime() < 90000); // 90 second timeout (matches EA)
      
      if (settings && settings.autoTrade === 'true') {
        // Check if MT5 is connected
        if (!isMt5Connected) {
          const errorMsg = 'MT5 not connected - signal will execute when MT5 connects';
          console.log(`[WEBHOOK] ${errorMsg}`);
          await storage.updateSignalStatus(signal.id, 'pending', errorMsg);
          
          return res.json({ 
            success: true, 
            signalId: signal.id,
            warning: errorMsg,
            message: 'Signal created but pending MT5 connection'
          });
        }
        
        // Validate symbol
        if (!isValidSymbol(signal.symbol)) {
          console.log(`[WEBHOOK] Invalid symbol format: ${signal.symbol}`);
          await storage.updateSignalStatus(signal.id, 'failed', 'Invalid symbol format');
          return res.json({ 
            success: false, 
            error: 'Invalid symbol format',
            signalId: signal.id
          });
        }
        
        // Calculate lot size and prepare SL/TP for EA
        // EA will use these values only when its enable flags are disabled
        // When EA's EnableStopLoss or EnableTakeProfit are true, EA overrides these values
        const useIndicatorLevels = signal.stopLoss && signal.takeProfit;
        
        let volume: number;
        let slValue: string | undefined;
        let tpValue: string | undefined;
        
        if (useIndicatorLevels) {
          // Use indicator-provided SL/TP levels
          console.log(`[WEBHOOK] Using indicator SL/TP levels:`);
          console.log(`  SL: ${signal.stopLoss}`);
          console.log(`  TP: ${signal.takeProfit}`);
          
          // Use a default volume - EA will handle lot sizing with its FixedLotSize input
          volume = 0.01; // Default minimal volume, EA will override with its FixedLotSize setting
          
          // Send indicator SL/TP to EA (EA will use these if its enable flags are disabled)
          slValue = signal.stopLoss!;
          tpValue = signal.takeProfit!;
          
          console.log(`  Using default volume: ${volume} lots (EA will use its FixedLotSize)`);
          console.log(`  Sending SL: ${slValue}, TP: ${tpValue} to EA`);
        } else {
          // Use default volume - EA will handle lot sizing with its FixedLotSize input
          volume = 0.01;
          console.log(`[WEBHOOK] Using default volume: ${volume} lots (EA will use its FixedLotSize)`);
          console.log(`  No SL/TP in webhook - EA will use its own settings if enabled`);
        }

        // CRITICAL FIX 3: Update signal status to 'pending' BEFORE enqueueing command
        await storage.updateSignalStatus(signal.id, 'pending');

        // CRITICAL FIX 4: Check if there's already a pending command for this signal
        const pendingCommands = await storage.getPendingCommands();
        const existingCommand = pendingCommands.find(cmd => cmd.signalId === signal.id);
        
        if (existingCommand) {
          console.log(`[WEBHOOK] Command already exists for signal ${signal.id}, skipping duplicate command creation`);
          return res.json({ 
            success: true, 
            signalId: signal.id,
            message: 'Signal already has pending command, prevented duplicate' 
          });
        }

        // NOTE: Hedging (closing opposite positions) is now handled by the EA itself
        // The dashboard only sends trade signals - the EA decides whether to close opposite positions
        // Send indicator SL/TP to EA (EA will use these if EnableStopLoss/EnableTakeProfit are false)
        // Enqueue TRADE command for MT5 to execute
        const tradeCommand = await storage.enqueueCommand({
          action: 'TRADE',
          symbol: signal.symbol,
          type: signal.type,
          volume: volume.toString(),
          stopLoss: slValue, // Send indicator SL if available, otherwise undefined (EA will use its settings)
          takeProfit: tpValue, // Send indicator TP if available, otherwise undefined (EA will use its settings)
          signalId: signal.id,
          status: 'pending',
        });

        console.log(`[WEBHOOK] Enqueued NEW ${signal.type} trade command ${tradeCommand.id} for signal ${signal.id} (after closing opposite trades)`);
        
        // Send command to MT5 via WebSocket (if connected)
        const tradeSent = sendCommandToMT5({
          id: tradeCommand.id,
          action: tradeCommand.action,
          symbol: tradeCommand.symbol,
          type: tradeCommand.type,
          volume: tradeCommand.volume ? parseFloat(tradeCommand.volume) : undefined,
          stopLoss: tradeCommand.stopLoss ? parseFloat(tradeCommand.stopLoss) : undefined,
          takeProfit: tradeCommand.takeProfit ? parseFloat(tradeCommand.takeProfit) : undefined,
        });
        
        // Mark command as sent ONLY if it was actually sent to MT5
        if (tradeSent) {
          await storage.markCommandAsSent(tradeCommand.id);
        } else {
          console.log(`[WEBHOOK] Trade command ${tradeCommand.id} remains pending (MT5 not connected)`);
        }
      } else {
        // Auto-trade is disabled
        const errorMsg = 'Auto-trade is disabled - enable it in settings to execute trades';
        console.log(`[WEBHOOK] ${errorMsg}`);
        await storage.updateSignalStatus(signal.id, 'pending', errorMsg);
        
        return res.json({ 
          success: true, 
          signalId: signal.id,
          warning: errorMsg,
          message: 'Signal created but auto-trade is disabled'
        });
      }

      res.json({ 
        success: true, 
        signalId: signal.id,
        message: 'Signal received and queued for execution' 
      });
    } catch (error) {
      console.error('[WEBHOOK] Error:', error);
      res.status(400).json({ 
        error: "Invalid signal data",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get settings
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      console.log('[API] GET /api/settings - Storage returned:', JSON.stringify(settings, null, 2));
      
      // Return default settings if none exist
      if (!settings) {
        res.json({
          id: 'default',
          mt5ApiSecret: null,
          accountBalance: '10000',
          riskPercentage: '1',
          autoTrade: 'true',
          defaultTpPips: '30',
          defaultSlPips: '20',
          fixedLotSize: '0.01',
          lastMt5Heartbeat: null,
        });
        return;
      }

      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Update settings
  app.post("/api/settings", async (req, res) => {
    try {
      const validatedSettings = insertSettingsSchema.parse(req.body);
      const settings = await storage.upsertSettings(validatedSettings);

      res.json(settings);
    } catch (error) {
      console.error('Settings update error:', error);
      res.status(400).json({ 
        error: "Invalid settings data",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get symbol mappings
  app.get("/api/symbol-mappings", async (_req, res) => {
    try {
      const mappings = await storage.getSymbolMappings();
      res.json(mappings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch symbol mappings" });
    }
  });

  // Create symbol mapping
  app.post("/api/symbol-mappings", async (req, res) => {
    try {
      const validatedMapping = insertSymbolMappingSchema.parse(req.body);
      const mapping = await storage.createSymbolMapping(validatedMapping);
      res.json(mapping);
    } catch (error) {
      console.error('Symbol mapping creation error:', error);
      res.status(400).json({ 
        error: "Failed to create symbol mapping",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete symbol mapping
  app.delete("/api/symbol-mappings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSymbolMapping(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Symbol mapping deletion error:', error);
      res.status(500).json({ error: "Failed to delete symbol mapping" });
    }
  });

  // Get trades
  app.get("/api/trades", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const trades = await storage.getTrades(limit);
      res.json(trades);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trades" });
    }
  });

  // HTTP polling endpoints removed - using WebSocket only

  const httpServer = createServer(app);

  // WebSocket server setup for frontend clients (noServer: true to handle upgrade manually)
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    wsClients.add(ws);

    // Send initial stats
    storage.getStats().then(stats => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'stats',
          data: stats,
        }));
      }
    });

    // Handle messages from client (e.g., keepalive pings)
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle keepalive ping from frontend
        if (message.type === 'ping') {
          // Respond with pong to confirm connection is alive
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
          return;
        }

        // Close position functionality removed - focus on instant execution only
      } catch (error) {
        console.error('[CLIENT-WS] Error processing message:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      wsClients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
    });
  });

  // MT5 WebSocket server setup (separate endpoint with noServer option)
  const mt5Wss = new WebSocketServer({ noServer: true });

  mt5Wss.on('connection', async (ws: WebSocket, req) => {
    console.log('[MT5-WS] MT5 client connected successfully');
    mt5WsClients.add(ws);
    
    // Update heartbeat on connection
    await storage.updateMt5Heartbeat();

    // Set up server-side ping interval to keep connection alive
    // OPTIMIZED: 20-second interval with 90s EA timeout = 4.5x buffer (production-grade stability)
    // Prevents false disconnections while maintaining responsive failure detection
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 20000); // Ping every 20 seconds - optimized for long-term stability

    // Store interval reference for cleanup
    (ws as any).pingInterval = pingInterval;

    // Send any pending commands immediately on reconnection
    const allPendingCommands = await storage.getPendingCommands();
    // CRITICAL FIX: Only resend 'pending' commands on reconnection
    // 'sent' commands are already being managed by the retry mechanism
    const commandsToResend = allPendingCommands.filter(cmd => cmd.status === 'pending');
    
    console.log(`[MT5-WS] Found ${commandsToResend.length} pending commands to send on reconnection (${allPendingCommands.length} total including sent)`);
    
    for (const command of commandsToResend) {
      console.log(`[MT5-WS] Sending pending command ${command.id} (${command.action}) for signal ${command.signalId}`);
      sendCommandToMT5({
        id: command.id,
        action: command.action,
        symbol: command.symbol,
        type: command.type,
        volume: command.volume ? parseFloat(command.volume) : undefined,
        stopLoss: command.stopLoss ? parseFloat(command.stopLoss) : undefined,
        takeProfit: command.takeProfit ? parseFloat(command.takeProfit) : undefined,
        positionId: command.positionId,
      });
      // Mark as sent
      await storage.markCommandAsSent(command.id);
      
      // Update signal status to show it's being executed
      if (command.signalId) {
        await storage.updateSignalStatus(command.signalId, 'pending', 'Executing after MT5 reconnection');
      }
    }
    
    if (commandsToResend.length > 0) {
      console.log(`[MT5-WS] Successfully sent ${commandsToResend.length} pending commands to MT5`);
    }
    
    // Check for pending signals without commands and process them now that MT5 is connected
    const pendingSignals = await storage.getPendingSignals(100);
    const signalsWithoutCommands = pendingSignals.filter(signal => {
      // Check if this signal already has a command
      return !allPendingCommands.some((cmd: any) => cmd.signalId === signal.id);
    });
    
    console.log(`[MT5-WS] Found ${signalsWithoutCommands.length} pending signals without commands to retry`);
    
    // Get settings to check if auto-trade is enabled
    const settings = await storage.getSettings();
    const autoTradeEnabled = settings && settings.autoTrade === 'true';
    
    if (autoTradeEnabled && signalsWithoutCommands.length > 0) {
      for (const signal of signalsWithoutCommands) {
        console.log(`[MT5-WS] Retrying pending signal ${signal.id}: ${signal.type} ${signal.symbol}`);
        
        // Create trade command for the pending signal
        const tradeCommand = await storage.enqueueCommand({
          action: 'TRADE',
          symbol: signal.symbol,
          type: signal.type,
          volume: '0.01', // Default volume - EA will use its FixedLotSize
          stopLoss: signal.stopLoss || undefined,
          takeProfit: signal.takeProfit || undefined,
          signalId: signal.id,
          status: 'pending',
        });
        
        // Send command to MT5
        const sent = sendCommandToMT5({
          id: tradeCommand.id,
          action: tradeCommand.action,
          symbol: tradeCommand.symbol,
          type: tradeCommand.type,
          volume: tradeCommand.volume ? parseFloat(tradeCommand.volume) : undefined,
          stopLoss: tradeCommand.stopLoss ? parseFloat(tradeCommand.stopLoss) : undefined,
          takeProfit: tradeCommand.takeProfit ? parseFloat(tradeCommand.takeProfit) : undefined,
        });
        
        if (sent) {
          await storage.markCommandAsSent(tradeCommand.id);
          await storage.updateSignalStatus(signal.id, 'pending', 'Executing after MT5 reconnection');
        }
      }
      
      console.log(`[MT5-WS] Successfully queued ${signalsWithoutCommands.length} pending signals for execution`);
    } else if (!autoTradeEnabled) {
      console.log(`[MT5-WS] Auto-trade is disabled - pending signals will not be processed`);
    }

    // Handle messages from MT5 (execution reports, account info, positions)
    ws.on('message', async (data: Buffer) => {
      try {
        const report = JSON.parse(data.toString());

        // Update heartbeat for ANY message received from MT5
        await storage.updateMt5Heartbeat();

        // Handle heartbeat messages - just update heartbeat timestamp
        if (report.type === 'HEARTBEAT') {
          return;
        }

        // Handle execution reports (existing logic)
        const { commandId, success, orderId, positionId, error: errorMessage } = report;

        if (!commandId) {
          return; // Silently ignore non-execution messages
        }
        
        console.log(`[MT5-WS] ✅ EXECUTION: cmd=${commandId}, success=${success}, order=${orderId}`);


        const command = await storage.getCommandById(commandId);
        if (!command) {
          ws.send(JSON.stringify({ success: true, warning: 'Command not found' }));
          return;
        }

        // Store execution result
        await storage.createExecutionResult({
          success: success ? 'true' : 'false',
          commandId,
          orderId: orderId || null,
          positionId: positionId || null,
          errorMessage: errorMessage || null,
        });

        // Mark command as acknowledged
        await storage.markCommandAsAcknowledged(commandId);

        // Update associated signal and trade
        if (command.signalId) {
          if (success && orderId) {
            await storage.updateSignalStatus(command.signalId, 'executed', null);
            
            const signal = await storage.getSignalById(command.signalId);
            if (signal && command.action === 'TRADE') {
              await storage.createTrade({
                signalId: command.signalId,
                symbol: signal.symbol,
                type: signal.type,
                openPrice: signal.price || '0',
                volume: command.volume || '0',
                mt5OrderId: orderId,
                mt5PositionId: positionId || orderId,
                stopLoss: command.stopLoss,
                takeProfit: command.takeProfit,
                status: 'open',
              });
              console.log(`[TRADE] Created: ${signal.type} ${signal.symbol} @ ${signal.price}, order=${orderId}`);
            }

          } else {
            await storage.updateSignalStatus(command.signalId, 'failed', errorMessage || 'Trade execution failed in MT5');
            console.log(`[ERROR] Signal ${command.signalId} failed: ${errorMessage}`);
          }
        }

        // Send acknowledgment to MT5
        ws.send(JSON.stringify({ success: true }));
      } catch (error) {
        console.error('[MT5-WS] Error processing report:', error);
        ws.send(JSON.stringify({ success: false, error: 'Failed to process report' }));
      }
    });

    // Handle ping frames from MT5 (respond with pong)
    ws.on('ping', async () => {
      ws.pong();
      // Update heartbeat when we receive ping from MT5
      await storage.updateMt5Heartbeat();
    });

    // Handle pong frames from MT5
    ws.on('pong', async () => {
      // Update heartbeat when MT5 responds to our ping
      await storage.updateMt5Heartbeat();
    });

    ws.on('close', () => {
      console.log('[MT5-WS] MT5 client disconnected');
      mt5WsClients.delete(ws);
      
      // Clear ping interval
      const interval = (ws as any).pingInterval;
      if (interval) {
        clearInterval(interval);
      }
    });

    ws.on('error', (error) => {
      console.error('[MT5-WS] WebSocket error:', error);
      mt5WsClients.delete(ws);
    });
  });

  // Retry mechanism removed - commands are now only retried on MT5 reconnection
  // This prevents constant retries that can interfere with order execution
  // Commands will be sent when MT5 connects and resent if MT5 reconnects
  console.log('[COMMAND-QUEUE] Command retry on reconnection only - no periodic retry polling');

  // Manual upgrade handler for all WebSocket connections
  httpServer.on('upgrade', async (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    
    console.log('[WS] Upgrade request for:', pathname);
    
    if (pathname === '/ws') {
      // Handle frontend WebSocket upgrades
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (pathname === '/mt5-ws') {
      // Handle MT5 WebSocket upgrades
      console.log('[MT5-WS] Handling upgrade request from:', request.headers.host);
      
      // Extract API secret from query params or headers
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const apiSecret = url.searchParams.get('secret') || request.headers['x-mt5-api-secret'] as string;
      
      // Verify API secret before upgrading
      const settings = await storage.getSettings();
      if (settings?.mt5ApiSecret && apiSecret !== settings.mt5ApiSecret) {
        console.log('[MT5-WS] Unauthorized upgrade attempt - invalid secret');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      
      console.log('[MT5-WS] API secret verified, upgrading connection');
      
      // Handle the upgrade
      mt5Wss.handleUpgrade(request, socket, head, (ws) => {
        mt5Wss.emit('connection', ws, request);
      });
    } else {
      // Reject unknown WebSocket paths
      console.log('[WS] Unknown WebSocket path:', pathname);
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
    }
  });

  return httpServer;
}
