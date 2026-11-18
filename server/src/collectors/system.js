// Métricas do host onde a plataforma roda.
import os from 'node:os';

let prev = os.cpus().map((c) => c.times);

export async function collectSystem() {
  const cur = os.cpus().map((c) => c.times);
  let idle = 0, total = 0;
  cur.forEach((t, i) => {
    const p = prev[i];
    const tot = Object.values(t).reduce((a, b) => a + b, 0) - Object.values(p).reduce((a, b) => a + b, 0);
    total += tot;
    idle += t.idle - p.idle;
  });
  prev = cur;
  return {
    metrics: {
      cpu_pct: total ? +(100 - (idle / total) * 100).toFixed(1) : 0,
      memory_pct: +((1 - os.freemem() / os.totalmem()) * 100).toFixed(1),
      uptime_h: +(os.uptime() / 3600).toFixed(1),
    },
    details: { hostname: os.hostname(), platform: `${os.type()} ${os.release()}`, cpus: cur.length },
  };
}
