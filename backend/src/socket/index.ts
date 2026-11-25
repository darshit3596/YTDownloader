import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from '../config';
import { events, EVENTS } from '../services/event-bus';
import { jobRunner } from '../services/job-runner';

let io: Server | null = null;
let listenersBound = false;

export function initSocket(server: HttpServer): Server {
  if (io) return io;

  io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: config.clientOrigins,
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 100_000,
    serveClient: false,
  });

  io.on('connection', (socket) => {
    socket.emit('queue:stats', jobRunner.getStats());
    socket.on('disconnect', () => undefined);
  });

  if (!listenersBound) {
    listenersBound = true;
    events.on(EVENTS.jobCreated, (job) => io?.emit('job:created', job));
    events.on(EVENTS.jobUpdated, (job) => io?.emit('job:update', job));
    events.on(EVENTS.queueStats, (stats) => io?.emit('queue:stats', stats));
    events.on(EVENTS.historyChanged, () => io?.emit('history:changed'));
    events.on(EVENTS.settingsUpdated, (settings) => io?.emit('settings:updated', settings));
  }

  return io;
}

export function closeSocket(): void {
  io?.close();
  io = null;
}
