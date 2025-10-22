import type { Settings } from '@shared/schema';
import * as zmq from 'zeromq';

interface TradeRequest {
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface TradeResult {
  success: boolean;
  orderId?: string;
  positionId?: string;
  error?: string;
}

interface ZMQCommand {
  action: 'TRADE' | 'CLOSE' | 'GET_ACCOUNT' | 'GET_POSITIONS' | 'GET_PRICE' | 'PING';
  data?: any;
}

interface ZMQResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class MT5Service {
  private pushSocket: zmq.Push | null = null;
  private pullSocket: zmq.Pull | null = null;
  private isConnected: boolean = false;
  private host: string = 'localhost';
  private pushPort: number = 5555;
  private pullPort: number = 5556;
  private responseTimeout: number = 10000; // 10 seconds

  async initialize(settings: Settings): Promise<boolean> {
    try {
      this.host = settings.zmqHost || 'localhost';
      this.pushPort = settings.zmqPushPort || 5555;
      this.pullPort = settings.zmqPullPort || 5556;

      // Close existing sockets if any
      await this.disconnect();

      // Create PUSH socket for sending commands
      this.pushSocket = new zmq.Push();
      await this.pushSocket.connect(`tcp://${this.host}:${this.pushPort}`);

      // Create PULL socket for receiving responses
      this.pullSocket = new zmq.Pull();
      await this.pullSocket.connect(`tcp://${this.host}:${this.pullPort}`);

      // Test connection with PING
      const pingResult = await this.sendCommand({ action: 'PING' });
      
      if (pingResult.success) {
        this.isConnected = true;
        console.log(`ZeroMQ MT5 connection established: ${this.host}:${this.pushPort}`);
        return true;
      } else {
        this.isConnected = false;
        console.error('MT5 PING failed:', pingResult.error);
        return false;
      }
    } catch (error) {
      console.error('MT5 ZeroMQ initialization error:', error);
      this.isConnected = false;
      return false;
    }
  }

  private async sendCommand(command: ZMQCommand, timeout?: number): Promise<ZMQResponse> {
    try {
      if (!this.pushSocket || !this.pullSocket) {
        return {
          success: false,
          error: 'ZeroMQ sockets not initialized'
        };
      }

      // Send command
      await this.pushSocket.send(JSON.stringify(command));

      // Wait for response with timeout
      const timeoutMs = timeout || this.responseTimeout;
      const response = await Promise.race([
        this.receiveResponse(),
        this.createTimeout(timeoutMs)
      ]);

      return response;
    } catch (error) {
      console.error('Send command error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async receiveResponse(): Promise<ZMQResponse> {
    try {
      if (!this.pullSocket) {
        return { success: false, error: 'Pull socket not initialized' };
      }

      for await (const [msg] of this.pullSocket) {
        const response = JSON.parse(msg.toString()) as ZMQResponse;
        return response;
      }

      return { success: false, error: 'No response received' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to receive response'
      };
    }
  }

  private createTimeout(ms: number): Promise<ZMQResponse> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: false,
          error: `Request timeout after ${ms}ms`
        });
      }, ms);
    });
  }

  async executeTrade(request: TradeRequest): Promise<TradeResult> {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: 'MT5 connection not established'
        };
      }

      const command: ZMQCommand = {
        action: 'TRADE',
        data: {
          symbol: request.symbol,
          type: request.type,
          volume: request.volume,
          stopLoss: request.stopLoss,
          takeProfit: request.takeProfit
        }
      };

      const response = await this.sendCommand(command);

      if (response.success && response.data) {
        return {
          success: true,
          orderId: response.data.orderId || response.data.ticket,
          positionId: response.data.positionId || response.data.ticket
        };
      } else {
        return {
          success: false,
          error: response.error || 'Trade execution failed'
        };
      }
    } catch (error) {
      console.error('Trade execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async closePosition(positionId: string): Promise<TradeResult> {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: 'MT5 connection not established'
        };
      }

      const command: ZMQCommand = {
        action: 'CLOSE',
        data: {
          positionId: positionId,
          ticket: positionId // Support both formats
        }
      };

      const response = await this.sendCommand(command);

      return {
        success: response.success,
        error: response.error
      };
    } catch (error) {
      console.error('Close position error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getAccountInfo(): Promise<any> {
    try {
      if (!this.isConnected) {
        return null;
      }

      const command: ZMQCommand = {
        action: 'GET_ACCOUNT'
      };

      const response = await this.sendCommand(command);

      return response.success ? response.data : null;
    } catch (error) {
      console.error('Get account info error:', error);
      return null;
    }
  }

  async getPositions(): Promise<any[]> {
    try {
      if (!this.isConnected) {
        return [];
      }

      const command: ZMQCommand = {
        action: 'GET_POSITIONS'
      };

      const response = await this.sendCommand(command);

      return response.success && response.data ? response.data : [];
    } catch (error) {
      console.error('Get positions error:', error);
      return [];
    }
  }

  async getSymbolPrice(symbol: string): Promise<{ bid: number; ask: number } | null> {
    try {
      if (!this.isConnected) {
        return null;
      }

      const command: ZMQCommand = {
        action: 'GET_PRICE',
        data: { symbol }
      };

      const response = await this.sendCommand(command);

      if (response.success && response.data) {
        return {
          bid: response.data.bid,
          ask: response.data.ask
        };
      }

      return null;
    } catch (error) {
      console.error('Get symbol price error:', error);
      return null;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    try {
      if (this.pushSocket) {
        this.pushSocket.close();
        this.pushSocket = null;
      }
      if (this.pullSocket) {
        this.pullSocket.close();
        this.pullSocket = null;
      }
      this.isConnected = false;
      console.log('ZeroMQ MT5 disconnected');
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }
}

export const mt5Service = new MT5Service();
