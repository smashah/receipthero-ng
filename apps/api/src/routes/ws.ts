import { Hono } from 'hono';
import { upgradeWebSocket } from 'hono/bun';
import { broadcastHub } from '../lib/broadcast';
import { createLogger } from '@sm-rn/core';

const logger = createLogger('ws');
const ws = new Hono();

ws.get('/', upgradeWebSocket((c) => {
  return {
    onOpen(event, ws) {
      logger.debug('Client connected');
      const onAppEvent = (data: any) => {
        ws.send(JSON.stringify(data));
      };
      
      broadcastHub.on('app:event', onAppEvent);
      
      // Store listener for cleanup
      (ws as any)._onAppEvent = onAppEvent;
    },
    onClose(event, ws) {
      logger.debug('Client disconnected');
      const listener = (ws as any)._onAppEvent;
      if (listener) {
        broadcastHub.off('app:event', listener);
      }
    }
  }
}));

export default ws;
