import { Server } from 'socket.io';
import ActivityLog from './models/ActivityLog.js';

let ioInstance = null;

export function initSocket(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  ioInstance.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
}

export function getIO() {
  return ioInstance;
}

/**
 * Emit event to all connected clients and optionally persist to ActivityLog
 */
export async function broadcastEvent(event, data, persistLog = false) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }

  if (persistLog && data && data.message) {
    try {
      await ActivityLog.create({
        type: data.type || 'info',
        action: event,
        message: data.message,
        metadata: data.metadata || data,
      });
    } catch (e) {
      console.error('[Socket] Error saving activity log:', e.message);
    }
  }
}
