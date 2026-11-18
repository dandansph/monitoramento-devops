// Servidor web de demonstração ("loja-demo") instrumentado + gerador de tráfego real.
// O coletor web lê os contadores daqui (RPS, códigos HTTP, conexões ativas, latência).
import http from 'node:http';
import { isActive } from './scenarios.js';

const counters = { requests: 0, c2xx: 0, c4xx: 0, c5xx: 0, latencySum: 0, codes: {} };
let inflight = 0;
let server;

export function readAndResetCounters() {
  const snap = { ...counters, codes: { ...counters.codes }, inflight };
  counters.requests = counters.c2xx = counters.c4xx = counters.c5xx = counters.latencySum = 0;
  counters.codes = {};
  return snap;
}

export function getActiveConnections() {
  return new Promise((resolve) => (server ? server.getConnections((_e, n) => resolve(n || 0)) : resolve(0)));
}

function finish(res, start, code, body) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
  const ms = performance.now() - start;
  counters.requests++;
  counters.latencySum += ms;
  counters.codes[code] = (counters.codes[code] || 0) + 1;
  if (code >= 500) counters.c5xx++;
  else if (code >= 400) counters.c4xx++;
  else counters.c2xx++;
  inflight--;
}

export function startDemoTarget(port) {
  server = http.createServer((req, res) => {
    if (isActive('web-down')) {
      req.socket.destroy(); // simula processo caído: conexão é derrubada
      return;
    }
    inflight++;
    const start = performance.now();
    // latência artificial que cresce com a carga (fila de atendimento)
    const base = 8 + Math.random() * 25;
    const load = Math.min(inflight * 1.5, 900);
    setTimeout(() => {
      const url = req.url || '/';
      if (url.startsWith('/health')) return finish(res, start, 200, { status: 'ok' });
      if (isActive('web-erros') && Math.random() < 0.35) return finish(res, start, Math.random() < 0.7 ? 500 : 503, { error: 'internal' });
      if (url.startsWith('/produto/999')) return finish(res, start, 404, { error: 'not found' });
      if (url.startsWith('/admin')) return finish(res, start, 403, { error: 'forbidden' });
      if (Math.random() < 0.004) return finish(res, start, 500, { error: 'internal' });
      return finish(res, start, 200, { ok: true, path: url });
    }, base + load);
  });
  server.keepAliveTimeout = 2000;
  server.listen(port, '127.0.0.1');
  startTraffic(port);
  return server;
}

// ---- Gerador de tráfego: clientes "normais" + botnet durante o cenário DDoS ----
// ~3% das requisições normais caem em 404/403
const paths = [...Array(12).fill('/'), ...Array(8).fill('/produtos'), ...Array(8).fill('/produto/1'), ...Array(6).fill('/carrinho'), ...Array(6).fill('/busca?q=rede'), '/produto/999'];
const ddosPaths = ['/', '/busca?q=' + 'x'.repeat(50), '/admin', '/produto/999'];
const agent = new http.Agent({ keepAlive: true, maxSockets: 64 });
const ddosAgent = new http.Agent({ keepAlive: true, maxSockets: 300 }); // keep-alive evita esgotar portas efêmeras do host

function hit(port, ag, list = paths) {
  const p = list[Math.floor(Math.random() * list.length)];
  const req = http.get({ host: '127.0.0.1', port, path: p, agent: ag, timeout: 4000 }, (res) => res.resume());
  req.on('error', () => {});
  req.on('timeout', () => req.destroy());
}

function startTraffic(port) {
  // tráfego normal: ~15-45 req/s com variação senoidal (simula horário de pico)
  setInterval(() => {
    const t = Date.now() / 60000;
    const rps = 30 + 12 * Math.sin(t) + Math.random() * 6;
    const n = Math.round(rps / 10);
    for (let i = 0; i < n; i++) hit(port, agent);
  }, 100);
  // botnet: ~350-500 req/s adicionais
  setInterval(() => {
    if (!isActive('ddos')) return;
    const n = 35 + Math.floor(Math.random() * 15);
    for (let i = 0; i < n; i++) hit(port, ddosAgent, ddosPaths);
  }, 100);
}
