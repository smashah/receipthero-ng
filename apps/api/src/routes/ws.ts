import { Hono } from 'hono';
import { upgradeWebSocket } from 'hono/bun';
import { broadcastHub } from '../lib/broadcast';

const ws = new Hono();

ws.get('/', upgradeWebSocket((c) => {
  return {
    onOpen(event, ws) {
      console.log('WS Client connected');
      const onAppEvent = (data: any) => {
        ws.send(JSON.stringify(data));
      };
      
      broadcastHub.on('app:event', onAppEvent);
      
      // Store listener for cleanup
      (ws as any)._onAppEvent = onAppEvent;
    },
    onClose(event, ws) {
      console.log('WS Client disconnected');
      const listener = (ws as any)._onAppEvent;
      if (listener) {
        broadcastHub.off('app:event', listener);
      }
    }
  }
}));

export default ws;
