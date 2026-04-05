import { createServer } from 'http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from 'shared';
import { registerHandlers } from './socket-handlers.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

registerHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`RPS Hand Tactics server running on port ${PORT}`);
});
