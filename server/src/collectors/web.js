// Coletor HTTP/HTTPS: health check real + métricas do servidor web de demonstração + alvos externos reais.
import { config } from '../config.js';
import { readAndResetCounters, getActiveConnections } from '../demo/target.js';

let lastRead = Date.now();

async function probe(url, timeoutMs = 5000) {
  const start = performance.now();
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    await res.arrayBuffer();
    return { url, up: res.status < 500, status: res.status, ms: Math.round(performance.now() - start) };
  } catch (e) {
    return { url, up: false, status: 0, ms: Math.round(performance.now() - start), error: e.cause?.code || e.name };
  }
}

export async function collectWeb() {
  const now = Date.now();
  const elapsed = Math.max((now - lastRead) / 1000, 0.001);
  lastRead = now;
  const c = readAndResetCounters();
  const health = await probe(`http://127.0.0.1:${config.demoTargetPort}/health`, 3000);
  const external = await Promise.all(config.httpTargets.map((u) => probe(u)));
  const extUp = external.filter((e) => e.up);

  const errors = c.c4xx + c.c5xx;
  const metrics = {
    up: health.up ? 1 : 0,
    rps: +(c.requests / elapsed).toFixed(1),
    latency_ms: c.requests ? +(c.latencySum / c.requests).toFixed(1) : health.ms,
    health_latency_ms: health.ms,
    error_rate: c.requests ? +((errors / c.requests) * 100).toFixed(2) : health.up ? 0 : 100,
    err_4xx: c.c4xx,
    err_5xx: c.c5xx,
    active_connections: await getActiveConnections(),
    ext_up_pct: external.length ? Math.round((extUp.length / external.length) * 100) : 100,
    ext_latency_ms: extUp.length ? Math.round(extUp.reduce((s, e) => s + e.ms, 0) / extUp.length) : 0,
  };
  return { metrics, details: { codes: c.codes, health, external } };
}
