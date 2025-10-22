import { 
  type Signal, 
  type InsertSignal,
  type Trade,
  type InsertTrade,
  type Settings,
  type InsertSettings,
  type DashboardStats,
  type Mt5Command,
  type InsertMt5Command,
  type Mt5ExecutionResult,
  type InsertMt5ExecutionResult,
  type SymbolMapping,
  type InsertSymbolMapping
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Signals
  createSignal(signal: InsertSignal): Promise<Signal>;
  getSignals(limit?: number): Promise<Signal[]>;
  getSignalById(id: string): Promise<Signal | undefined>;
  updateSignalStatus(id: string, status: string, errorMessage?: string | null): Promise<void>;
  getFailedSignals(limit?: number): Promise<Signal[]>;
  getPendingSignals(limit?: number): Promise<Signal[]>;
  
  // Trades
  createTrade(trade: InsertTrade): Promise<Trade>;
  getTrades(limit?: number): Promise<Trade[]>;
  getTradeById(id: string): Promise<Trade | undefined>;
  updateTradeStatus(id: string, status: string): Promise<void>;
  getOpenTradesByType(type: string): Promise<Trade[]>;
  closeTrade(id: string, closePrice: string, profit: string): Promise<void>;
  
  // Settings
  getSettings(): Promise<Settings | undefined>;
  upsertSettings(settings: InsertSettings): Promise<Settings>;
  updateMt5Heartbeat(): Promise<void>;
  
  // MT5 Command Queue
  enqueueCommand(command: InsertMt5Command): Promise<Mt5Command>;
  getNextPendingCommand(): Promise<Mt5Command | undefined>;
  getCommandById(commandId: string): Promise<Mt5Command | undefined>;
  retryTimedOutCommands(): Promise<void>;
  markCommandAsSent(commandId: string): Promise<void>;
  markCommandAsAcknowledged(commandId: string): Promise<void>;
  markCommandAsFailed(commandId: string, errorMessage: string): Promise<void>;
  getPendingCommands(): Promise<Mt5Command[]>;
  getFailedCommands(limit?: number): Promise<Mt5Command[]>;
  
  // MT5 Execution Results
  createExecutionResult(result: InsertMt5ExecutionResult): Promise<Mt5ExecutionResult>;
  getFailedExecutionResults(limit?: number): Promise<Mt5ExecutionResult[]>;
  
  // Symbol Mappings
  createSymbolMapping(mapping: InsertSymbolMapping): Promise<SymbolMapping>;
  getSymbolMappings(): Promise<SymbolMapping[]>;
  getSymbolMappingByTradingViewSymbol(tradingViewSymbol: string): Promise<SymbolMapping | undefined>;
  deleteSymbolMapping(id: string): Promise<void>;
  mapSymbol(tradingViewSymbol: string): Promise<string>;
  areSymbolsEquivalent(symbol1: string, symbol2: string): Promise<boolean>;
  
  // Stats
  getStats(): Promise<DashboardStats>;
}

export class MemStorage implements IStorage {
  private signals: Map<string, Signal>;
  private trades: Map<string, Trade>;
  private settings: Settings | undefined;
  private mt5Commands: Map<string, Mt5Command>;
  private mt5ExecutionResults: Map<string, Mt5ExecutionResult>;
  private symbolMappings: Map<string, SymbolMapping>;

  constructor() {
    this.signals = new Map();
    this.trades = new Map();
    this.settings = undefined;
    this.mt5Commands = new Map();
    this.mt5ExecutionResults = new Map();
    this.symbolMappings = new Map();
  }

  // Signals
  async createSignal(insertSignal: InsertSignal): Promise<Signal> {
    const id = randomUUID();
    const signal: Signal = {
      ...insertSignal,
      id,
      timestamp: new Date(),
      status: insertSignal.status || 'pending',
      source: insertSignal.source || 'tradingview',
      price: insertSignal.price ?? null,
      errorMessage: insertSignal.errorMessage ?? null,
      indicatorType: insertSignal.indicatorType ?? null,
      entryPrice: insertSignal.entryPrice ?? null,
      stopLoss: insertSignal.stopLoss ?? null,
      takeProfit: insertSignal.takeProfit ?? null,
    };
    this.signals.set(id, signal);
    return signal;
  }

  async getSignals(limit: number = 50): Promise<Signal[]> {
    const allSignals = Array.from(this.signals.values());
    return allSignals
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getSignalById(id: string): Promise<Signal | undefined> {
    return this.signals.get(id);
  }

  async updateSignalStatus(id: string, status: string, errorMessage?: string | null): Promise<void> {
    const signal = this.signals.get(id);
    if (signal) {
      signal.status = status;
      if (errorMessage !== undefined) {
        signal.errorMessage = errorMessage;
      }
      this.signals.set(id, signal);
    }
  }

  async getFailedSignals(limit: number = 50): Promise<Signal[]> {
    const allSignals = Array.from(this.signals.values());
    return allSignals
      .filter(s => s.status === 'failed')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getPendingSignals(limit: number = 50): Promise<Signal[]> {
    const allSignals = Array.from(this.signals.values());
    return allSignals
      .filter(s => s.status === 'pending')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // Trades
  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const id = randomUUID();
    const trade: Trade = {
      ...insertTrade,
      id,
      openTime: new Date(),
      status: insertTrade.status || 'open',
      signalId: insertTrade.signalId ?? null,
      openPrice: insertTrade.openPrice ?? null,
      closePrice: insertTrade.closePrice ?? null,
      stopLoss: insertTrade.stopLoss ?? null,
      takeProfit: insertTrade.takeProfit ?? null,
      profit: insertTrade.profit ?? null,
      mt5OrderId: insertTrade.mt5OrderId ?? null,
      mt5PositionId: insertTrade.mt5PositionId ?? null,
      closeTime: insertTrade.closeTime ?? null,
      errorMessage: insertTrade.errorMessage ?? null,
    };
    this.trades.set(id, trade);
    return trade;
  }

  async getTrades(limit: number = 50): Promise<Trade[]> {
    const allTrades = Array.from(this.trades.values());
    return allTrades
      .sort((a, b) => new Date(b.openTime).getTime() - new Date(a.openTime).getTime())
      .slice(0, limit);
  }

  async getTradeById(id: string): Promise<Trade | undefined> {
    return this.trades.get(id);
  }

  async updateTradeStatus(id: string, status: string): Promise<void> {
    const trade = this.trades.get(id);
    if (trade) {
      trade.status = status;
      if (status === 'closed') {
        trade.closeTime = new Date();
      }
      this.trades.set(id, trade);
    }
  }

  async getOpenTradesByType(type: string): Promise<Trade[]> {
    const allTrades = Array.from(this.trades.values());
    return allTrades.filter(t => t.status === 'open' && t.type === type);
  }

  async closeTrade(id: string, closePrice: string, profit: string): Promise<void> {
    const trade = this.trades.get(id);
    if (trade) {
      trade.status = 'closed';
      trade.closePrice = closePrice;
      trade.profit = profit;
      trade.closeTime = new Date();
      this.trades.set(id, trade);
    }
  }

  // Settings
  async getSettings(): Promise<Settings | undefined> {
    // Return default settings if none exist
    if (!this.settings) {
      this.settings = {
        id: 'default',
        mt5ApiSecret: null,
        accountBalance: '10000',
        autoTrade: 'true',
        lastMt5Heartbeat: null,
      };
    }
    return this.settings;
  }

  async upsertSettings(insertSettings: InsertSettings): Promise<Settings> {
    const id = this.settings?.id || randomUUID();
    const settings: Settings = {
      ...insertSettings,
      id,
      mt5ApiSecret: insertSettings.mt5ApiSecret ?? null,
      accountBalance: insertSettings.accountBalance || '10000',
      autoTrade: insertSettings.autoTrade || 'true',
      lastMt5Heartbeat: this.settings?.lastMt5Heartbeat ?? null,
    };
    this.settings = settings;
    return settings;
  }

  async updateMt5Heartbeat(): Promise<void> {
    if (!this.settings) {
      // Create default settings if they don't exist
      this.settings = {
        id: 'default',
        mt5ApiSecret: null,
        accountBalance: '10000',
        autoTrade: 'true',
        lastMt5Heartbeat: new Date(),
      };
    } else {
      this.settings.lastMt5Heartbeat = new Date();
    }
  }

  // MT5 Command Queue
  async enqueueCommand(insertCommand: InsertMt5Command): Promise<Mt5Command> {
    const id = randomUUID();
    const command: Mt5Command = {
      ...insertCommand,
      id,
      symbol: insertCommand.symbol ?? null,
      type: insertCommand.type ?? null,
      volume: insertCommand.volume ?? null,
      stopLoss: insertCommand.stopLoss ?? null,
      takeProfit: insertCommand.takeProfit ?? null,
      positionId: insertCommand.positionId ?? null,
      signalId: insertCommand.signalId ?? null,
      status: 'pending',
      createdAt: new Date(),
      sentAt: null,
      acknowledgedAt: null,
      errorMessage: insertCommand.errorMessage ?? null,
    };
    this.mt5Commands.set(id, command);
    return command;
  }

  async getNextPendingCommand(): Promise<Mt5Command | undefined> {
    // First, check for sent commands that have timed out (>30 seconds without acknowledgment)
    await this.retryTimedOutCommands();
    
    const allCommands = Array.from(this.mt5Commands.values());
    const pendingCommands = allCommands
      .filter(c => c.status === 'pending')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    return pendingCommands[0];
  }

  async getCommandById(commandId: string): Promise<Mt5Command | undefined> {
    return this.mt5Commands.get(commandId);
  }

  async retryTimedOutCommands(): Promise<void> {
    // Simplified timeout mechanism - only fails commands that are truly stuck
    // Timeout increased to 60 seconds to prevent premature failures
    const now = new Date();
    const timeout = 60000; // 60 seconds
    
    const allCommands = Array.from(this.mt5Commands.values());
    const timedOutCommands = allCommands.filter(c => {
      if (c.status === 'sent' && c.sentAt) {
        const sentTime = new Date(c.sentAt).getTime();
        const elapsed = now.getTime() - sentTime;
        return elapsed > timeout;
      }
      return false;
    });

    for (const command of timedOutCommands) {
      // Mark as failed instead of retrying - reconnection will handle pending commands
      command.status = 'failed';
      command.errorMessage = 'Command timeout - no acknowledgement received';
      this.mt5Commands.set(command.id, command);
      console.log(`[TIMEOUT] Command ${command.id} failed after ${timeout/1000}s without acknowledgement`);
    }
  }

  async markCommandAsSent(commandId: string): Promise<void> {
    const command = this.mt5Commands.get(commandId);
    if (command) {
      command.status = 'sent';
      command.sentAt = new Date();
      this.mt5Commands.set(commandId, command);
    }
  }

  async markCommandAsAcknowledged(commandId: string): Promise<void> {
    const command = this.mt5Commands.get(commandId);
    if (command) {
      command.status = 'acknowledged';
      command.acknowledgedAt = new Date();
      this.mt5Commands.set(commandId, command);
    }
  }

  async markCommandAsFailed(commandId: string, errorMessage: string): Promise<void> {
    const command = this.mt5Commands.get(commandId);
    if (command) {
      command.status = 'failed';
      command.errorMessage = errorMessage;
      this.mt5Commands.set(commandId, command);
    }
  }

  async getPendingCommands(): Promise<Mt5Command[]> {
    const allCommands = Array.from(this.mt5Commands.values());
    // CRITICAL FIX: Return BOTH 'pending' and 'sent' commands
    // 'sent' just means we sent it via WebSocket, not that MT5 acknowledged it
    // If MT5 disconnects/reconnects, we need to retry 'sent' commands too
    return allCommands.filter(c => c.status === 'pending' || c.status === 'sent');
  }

  async getFailedCommands(limit: number = 50): Promise<Mt5Command[]> {
    const allCommands = Array.from(this.mt5Commands.values());
    return allCommands
      .filter(c => c.status === 'failed' || (c.errorMessage !== null && c.errorMessage !== ''))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  // MT5 Execution Results
  async createExecutionResult(insertResult: InsertMt5ExecutionResult): Promise<Mt5ExecutionResult> {
    const id = randomUUID();
    const result: Mt5ExecutionResult = {
      ...insertResult,
      id,
      commandId: insertResult.commandId ?? null,
      orderId: insertResult.orderId ?? null,
      positionId: insertResult.positionId ?? null,
      executedAt: new Date(),
      errorMessage: insertResult.errorMessage ?? null,
      responseData: insertResult.responseData ?? null,
    };
    this.mt5ExecutionResults.set(id, result);
    return result;
  }

  async getFailedExecutionResults(limit: number = 50): Promise<Mt5ExecutionResult[]> {
    const allResults = Array.from(this.mt5ExecutionResults.values());
    return allResults
      .filter(r => r.success === 'false' || (r.errorMessage !== null && r.errorMessage !== ''))
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
      .slice(0, limit);
  }

  // Symbol Mappings
  async createSymbolMapping(insertMapping: InsertSymbolMapping): Promise<SymbolMapping> {
    // Check if mapping already exists
    const existing = Array.from(this.symbolMappings.values()).find(
      m => m.tradingViewSymbol === insertMapping.tradingViewSymbol
    );
    if (existing) {
      throw new Error(`Mapping for ${insertMapping.tradingViewSymbol} already exists`);
    }

    const id = randomUUID();
    const mapping: SymbolMapping = {
      ...insertMapping,
      id,
      createdAt: new Date(),
    };
    this.symbolMappings.set(id, mapping);
    return mapping;
  }

  async getSymbolMappings(): Promise<SymbolMapping[]> {
    return Array.from(this.symbolMappings.values())
      .sort((a, b) => a.tradingViewSymbol.localeCompare(b.tradingViewSymbol));
  }

  async getSymbolMappingByTradingViewSymbol(tradingViewSymbol: string): Promise<SymbolMapping | undefined> {
    // Case-insensitive search for symbol mapping
    const upperSymbol = tradingViewSymbol.toUpperCase();
    return Array.from(this.symbolMappings.values()).find(
      m => m.tradingViewSymbol.toUpperCase() === upperSymbol
    );
  }

  async deleteSymbolMapping(id: string): Promise<void> {
    this.symbolMappings.delete(id);
  }

  async mapSymbol(tradingViewSymbol: string): Promise<string> {
    const mapping = await this.getSymbolMappingByTradingViewSymbol(tradingViewSymbol);
    const mappedSymbol = mapping ? mapping.mt5Symbol : tradingViewSymbol;
    
    // Log the mapping for debugging
    if (mapping) {
      console.log(`[SYMBOL-MAP] Mapped "${tradingViewSymbol}" -> "${mappedSymbol}"`);
    } else {
      console.log(`[SYMBOL-MAP] No mapping found for "${tradingViewSymbol}", using as-is`);
    }
    
    return mappedSymbol;
  }

  // Check if two symbols represent the same underlying instrument
  // This handles cases where one is mapped and one is unmapped
  async areSymbolsEquivalent(symbol1: string, symbol2: string): Promise<boolean> {
    // Case 1: Direct match (case-insensitive)
    if (symbol1.toUpperCase() === symbol2.toUpperCase()) {
      return true;
    }

    // Case 2: Check if they map to the same MT5 symbol or if one is the unmapped version of the other
    const allMappings = await this.getSymbolMappings();
    
    for (const mapping of allMappings) {
      const tvSymbol = mapping.tradingViewSymbol;
      const mt5Symbol = mapping.mt5Symbol;
      
      // Check if one symbol is the TradingView symbol and the other is the MT5 symbol
      const isSymbol1TV = tvSymbol.toUpperCase() === symbol1.toUpperCase();
      const isSymbol1MT5 = mt5Symbol.toUpperCase() === symbol1.toUpperCase();
      const isSymbol2TV = tvSymbol.toUpperCase() === symbol2.toUpperCase();
      const isSymbol2MT5 = mt5Symbol.toUpperCase() === symbol2.toUpperCase();
      
      // If symbol1 is TV and symbol2 is MT5 (or vice versa) from the same mapping, they're equivalent
      if ((isSymbol1TV && isSymbol2MT5) || (isSymbol1MT5 && isSymbol2TV)) {
        console.log(`[SYMBOL-MAP] Symbols "${symbol1}" and "${symbol2}" are equivalent via mapping: ${tvSymbol} -> ${mt5Symbol}`);
        return true;
      }
    }
    
    return false;
  }

  // Stats
  async getStats(): Promise<DashboardStats> {
    const allSignals = Array.from(this.signals.values());
    const allTrades = Array.from(this.trades.values());

    const totalSignals = allSignals.length;
    const pendingSignals = allSignals.filter(s => s.status === 'pending').length;
    const executedTrades = allTrades.filter(t => t.status === 'open' || t.status === 'closed').length;
    const executedSignals = allSignals.filter(s => s.status === 'executed').length;
    
    const successRate = totalSignals > 0 
      ? (executedSignals / totalSignals) * 100 
      : 0;

    // Check if MT5 is connected (heartbeat within last 60 seconds)
    // Increased from 10s to 60s to match 30s ping interval with buffer
    const now = new Date();
    const lastHeartbeat = this.settings?.lastMt5Heartbeat;
    const isConnected = lastHeartbeat 
      ? (now.getTime() - new Date(lastHeartbeat).getTime()) < 60000 
      : false;

    return {
      totalSignals,
      pendingSignals,
      executedTrades,
      successRate: Math.round(successRate),
      isConnected,
    };
  }
}

export const storage = new MemStorage();
