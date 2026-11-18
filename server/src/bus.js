// Barramento de eventos interno: coletores -> motor de alertas -> WebSocket.
import { EventEmitter } from 'node:events';
export const bus = new EventEmitter();
bus.setMaxListeners(50);

/** Último snapshot de cada serviço, enviado aos clientes ao conectar. */
export const latest = { web: {}, database: {}, dns: {}, smtp: {}, system: {} };
