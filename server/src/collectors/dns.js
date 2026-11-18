// Coletor DNS: resoluções reais (registro A) contra servidores públicos, medindo tempo e falhas.
import { Resolver } from 'node:dns/promises';
import { config } from '../config.js';
import { isActive } from '../demo/scenarios.js';

async function resolveOnce(server, name) {
  const r = new Resolver({ timeout: 1500, tries: 1 });
  r.setServers([server]);
  const start = performance.now();
  try {
    const addrs = await r.resolve4(name);
    return { server, name, ok: true, ms: +(performance.now() - start).toFixed(1), answer: addrs[0] };
  } catch (e) {
    return { server, name, ok: false, ms: +(performance.now() - start).toFixed(1), error: e.code };
  }
}

export async function collectDns() {
  // No cenário "dns-falha" um dos servidores vira um IP que não responde (TEST-NET) e um nome inexistente entra na lista
  const servers = isActive('dns-falha') ? ['192.0.2.53', ...config.dnsServers.slice(1)] : config.dnsServers;
  const names = isActive('dns-falha') ? [...config.dnsNames, 'servico-inexistente.invalid'] : config.dnsNames;

  const start = performance.now();
  const jobs = [];
  for (let round = 0; round < 3; round++) for (const s of servers) for (const n of names) jobs.push(resolveOnce(s, n));
  const results = await Promise.all(jobs);
  const elapsed = (performance.now() - start) / 1000;

  const ok = results.filter((r) => r.ok);
  const perServer = servers.map((s) => {
    const rs = results.filter((r) => r.server === s);
    const good = rs.filter((r) => r.ok);
    return {
      server: s,
      up: good.length > 0,
      avg_ms: good.length ? +(good.reduce((a, r) => a + r.ms, 0) / good.length).toFixed(1) : null,
      failures: rs.length - good.length,
    };
  });

  const metrics = {
    up: perServer.some((p) => p.up) ? 1 : 0,
    servers_up_pct: Math.round((perServer.filter((p) => p.up).length / perServer.length) * 100),
    resolve_ms: ok.length ? +(ok.reduce((a, r) => a + r.ms, 0) / ok.length).toFixed(1) : 1500,
    failure_rate: +(((results.length - ok.length) / results.length) * 100).toFixed(1),
    qps: +(results.length / Math.max(elapsed, 1)).toFixed(1),
  };
  return { metrics, details: { perServer, sample: results.slice(0, servers.length * names.length) } };
}
