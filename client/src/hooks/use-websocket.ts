import { useEffect, useRef, useCallback } from 'react';
import type { WSMessage } from '@shared/schema';

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    console.log('Connecting to WebSocket:', wsUrl);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        // Minimal message handling - only handle pong responses
        // All data is fetched via REST API instead of WebSocket broadcasts
        if (message.type === 'pong') {
          // Connection confirmed
          return;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected - will reconnect in 5 seconds');
      
      // Reconnect after 5 seconds only if truly disconnected
      reconnectTimeout.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 5000);
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  return ws.current;
}
