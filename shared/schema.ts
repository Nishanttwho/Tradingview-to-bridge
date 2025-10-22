import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Signal types from TradingView
export const signals = pgTable("signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'BUY' | 'SELL'
  symbol: text("symbol").notNull(), // e.g., 'EURUSD'
  price: decimal("price", { precision: 10, scale: 5 }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  source: text("source").notNull().default('tradingview'), // Signal source
  status: text("status").notNull().default('pending'), // 'pending' | 'executed' | 'failed'
  errorMessage: text("error_message"),
  // Strategy/Indicator fields
  indicatorType: text("indicator_type"), // 'target_trend' | 'fibonacci_705' | null
  entryPrice: decimal("entry_price", { precision: 10, scale: 5 }), // Indicator entry price
  stopLoss: decimal("stop_loss", { precision: 10, scale: 5 }), // Indicator stop loss
  takeProfit: decimal("take_profit", { precision: 10, scale: 5 }), // Take profit (full exit)
});

// Trade execution records
export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signalId: varchar("signal_id").references(() => signals.id),
  symbol: text("symbol").notNull(),
  type: text("type").notNull(), // 'BUY' | 'SELL'
  volume: decimal("volume", { precision: 10, scale: 2 }).notNull(), // Lot size
  openPrice: decimal("open_price", { precision: 10, scale: 5 }),
  closePrice: decimal("close_price", { precision: 10, scale: 5 }),
  stopLoss: decimal("stop_loss", { precision: 10, scale: 5 }), // Stop Loss price
  takeProfit: decimal("take_profit", { precision: 10, scale: 5 }), // Take Profit price
  profit: decimal("profit", { precision: 10, scale: 2 }),
  status: text("status").notNull().default('open'), // 'open' | 'closed' | 'failed'
  mt5OrderId: text("mt5_order_id"),
  mt5PositionId: text("mt5_position_id"), // MetaApi position ID for closing
  openTime: timestamp("open_time").notNull().defaultNow(),
  closeTime: timestamp("close_time"),
  errorMessage: text("error_message"),
});

// MT5 Command Queue - commands waiting to be executed by MT5
export const mt5Commands = pgTable("mt5_commands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(), // 'TRADE' | 'CLOSE' | 'PING'
  symbol: text("symbol"),
  type: text("type"), // 'BUY' | 'SELL'
  volume: decimal("volume", { precision: 10, scale: 2 }),
  stopLoss: decimal("stop_loss", { precision: 10, scale: 5 }),
  takeProfit: decimal("take_profit", { precision: 10, scale: 5 }),
  positionId: text("position_id"), // For CLOSE action
  signalId: varchar("signal_id").references(() => signals.id),
  status: text("status").notNull().default('pending'), // 'pending' | 'sent' | 'acknowledged' | 'failed'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  errorMessage: text("error_message"),
});

// MT5 Execution Results - results reported back from MT5
export const mt5ExecutionResults = pgTable("mt5_execution_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commandId: varchar("command_id").references(() => mt5Commands.id),
  success: text("success").notNull(), // 'true' | 'false'
  orderId: text("order_id"),
  positionId: text("position_id"),
  executedAt: timestamp("executed_at").notNull().defaultNow(),
  errorMessage: text("error_message"),
  responseData: text("response_data"), // JSON string of full response
});

// MT5 Settings
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mt5ApiSecret: text("mt5_api_secret"), // Shared secret for MT5 authentication
  accountBalance: decimal("account_balance", { precision: 15, scale: 2 }).notNull().default('10000'), // Account balance for monitoring
  autoTrade: text("auto_trade").notNull().default('true'), // 'true' | 'false'
  lastMt5Heartbeat: timestamp("last_mt5_heartbeat"), // Last time MT5 polled
});

// Symbol Mappings - Map TradingView symbols to MT5 symbols
export const symbolMappings = pgTable("symbol_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradingViewSymbol: text("tradingview_symbol").notNull().unique(), // e.g., 'BTCUSD'
  mt5Symbol: text("mt5_symbol").notNull(), // e.g., 'BTCUSDm'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schemas for inserts
export const insertSignalSchema = createInsertSchema(signals).omit({ 
  id: true, 
  timestamp: true 
});

export const insertTradeSchema = createInsertSchema(trades).omit({ 
  id: true, 
  openTime: true 
});

export const insertSettingsSchema = createInsertSchema(settings).omit({ 
  id: true,
  lastMt5Heartbeat: true
}).extend({
  accountBalance: z.coerce.number().positive("Account balance must be positive").transform(val => val.toString()),
  autoTrade: z.string().optional().default('true'),
  mt5ApiSecret: z.string().optional(),
});

export const insertMt5CommandSchema = createInsertSchema(mt5Commands).omit({ 
  id: true, 
  createdAt: true,
  sentAt: true,
  acknowledgedAt: true
});

export const insertMt5ExecutionResultSchema = createInsertSchema(mt5ExecutionResults).omit({ 
  id: true, 
  executedAt: true 
});

export const insertSymbolMappingSchema = createInsertSchema(symbolMappings).omit({ 
  id: true, 
  createdAt: true 
});

// Types
export type Signal = typeof signals.$inferSelect;
export type InsertSignal = z.infer<typeof insertSignalSchema>;

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;

export type Mt5Command = typeof mt5Commands.$inferSelect;
export type InsertMt5Command = z.infer<typeof insertMt5CommandSchema>;

export type Mt5ExecutionResult = typeof mt5ExecutionResults.$inferSelect;
export type InsertMt5ExecutionResult = z.infer<typeof insertMt5ExecutionResultSchema>;

export type SymbolMapping = typeof symbolMappings.$inferSelect;
export type InsertSymbolMapping = z.infer<typeof insertSymbolMappingSchema>;

// Dashboard stats type
export type DashboardStats = {
  totalSignals: number;
  pendingSignals: number;
  executedTrades: number;
  successRate: number;
  isConnected: boolean;
};

// MT5 Account Info type (from actual MT5)
export type MT5AccountInfo = {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  profit: number;
};

// MT5 Position type (actual open positions from MT5)
export type MT5Position = {
  ticket: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  profit: number;
  swap: number;
  commission: number;
  openTime: string;
};

// WebSocket message types
export type WSMessage = 
  | { type: 'signal'; data: Signal }
  | { type: 'trade'; data: Trade }
  | { type: 'stats'; data: DashboardStats }
  | { type: 'connection'; data: { status: 'connected' | 'disconnected' } }
  | { type: 'mt5_account'; data: MT5AccountInfo }
  | { type: 'mt5_positions'; data: MT5Position[] };
