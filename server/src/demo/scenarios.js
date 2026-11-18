// Cenários de falha/ataque usados na demonstração em sala.
import { bus } from '../bus.js';

export const SCENARIOS = {
  ddos: { label: 'Ataque DDoS no Web Server', service: 'web', defaultSec: 90 },
  'web-down': { label: 'Derrubar o Web Server', service: 'web', defaultSec: 60 },
  'web-erros': { label: 'Web Server retornando 5xx', service: 'web', defaultSec: 60 },
  'db-lento': { label: 'Banco de dados lento (slow queries)', service: 'database', defaultSec: 90 },
  'dns-falha': { label: 'Falha de resolução DNS', service: 'dns', defaultSec: 60 },
  'smtp-fila': { label: 'Fila de e-mails congestionada', service: 'smtp', defaultSec: 90 },
  bruteforce: { label: 'Ataque de força bruta no login', service: 'security', defaultSec: 45 },
  'config-change': { label: 'Alterar arquivo de configuração', service: 'security', defaultSec: 0 },
};

const active = new Map(); // nome -> timestamp de término

export function startScenario(name, durationSec) {
  const def = SCENARIOS[name];
  if (!def) throw new Error(`Cenário desconhecido: ${name}`);
  const sec = Number(durationSec) > 0 ? Math.min(Number(durationSec), 600) : def.defaultSec;
  if (sec > 0) active.set(name, Date.now() + sec * 1000);
  bus.emit('scenario', { name, action: 'start', until: active.get(name) ?? Date.now() });
  return { name, until: active.get(name) ?? Date.now() };
}

export function stopScenario(name) {
  active.delete(name);
  bus.emit('scenario', { name, action: 'stop' });
}

export function isActive(name) {
  const until = active.get(name);
  if (!until) return false;
  if (Date.now() > until) {
    active.delete(name);
    bus.emit('scenario', { name, action: 'stop' });
    return false;
  }
  return true;
}

export function listScenarios() {
  return Object.entries(SCENARIOS).map(([name, def]) => ({
    name,
    ...def,
    active: isActive(name),
    until: active.get(name) ?? null,
  }));
}
