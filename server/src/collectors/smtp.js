// Coletor SMTP: sonda real (TCP + banner 220 + EHLO + QUIT) em um servidor SMTP público
// e métricas de um MTA de demonstração (fila, taxa de entrega, volume, rejeições).
import net from 'node:net';
import { config } from '../config.js';
import { isActive } from '../demo/scenarios.js';

function smtpProbe(host, port, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const start = performance.now();
    const sock = net.connect({ host, port });
    let buf = '';
    let stage = 'banner';
    let bannerMs = null;
    const done = (ok, extra = {}) => {
      sock.destroy();
      resolve({ host, port, ok, ms: Math.round(performance.now() - start), bannerMs, ...extra });
    };
    sock.setTimeout(timeoutMs, () => done(false, { error: 'timeout' }));
    sock.on('error', (e) => done(false, { error: e.code }));
    sock.on('data', (d) => {
      buf += d.toString();
      if (!buf.endsWith('\r\n')) return;
      const last = buf.trim().split('\r\n').pop();
      if (stage === 'banner') {
        bannerMs = Math.round(performance.now() - start);
        if (!last.startsWith('220')) return done(false, { error: last });
        stage = 'ehlo';
        buf = '';
        sock.write('EHLO pixelnoc.local\r\n');
      } else if (stage === 'ehlo' && /^250 /.test(last)) {
        const exts = buf.split('\r\n').filter(Boolean).map((l) => l.slice(4));
        sock.write('QUIT\r\n');
        done(true, { banner: true, extensions: exts.slice(1) });
      }
    });
  });
}

// estado do MTA de demonstração
let queue = 4;
let delivered = 0;
let attempted = 0;

export async function collectSmtp() {
  const jam = isActive('smtp-fila');
  const probe = await smtpProbe(config.smtpProbeHost, config.smtpProbePort);

  const intervalMin = config.collectIntervalMs / 60000;
  const incomingPerMin = 40 + Math.random() * 25 + (jam ? 60 : 0);
  const capacityPerMin = jam ? 15 + Math.random() * 10 : 90;
  const incoming = Math.round(incomingPerMin * intervalMin);
  queue += incoming;
  const tryNow = Math.min(queue, Math.round(capacityPerMin * intervalMin));
  const rejectRate = jam ? 0.18 + Math.random() * 0.1 : 0.01 + Math.random() * 0.02;
  const rejected = Math.round(tryNow * rejectRate);
  const timeouts = jam ? Math.round(tryNow * 0.1) : 0;
  const ok = Math.max(tryNow - rejected - timeouts, 0);
  queue -= ok + rejected; // timeouts voltam para a fila
  delivered += ok;
  attempted += tryNow;

  const metrics = {
    up: probe.ok ? 1 : 0,
    probe_latency_ms: probe.ms,
    delivery_rate: tryNow ? +((ok / tryNow) * 100).toFixed(1) : 100,
    queue_length: queue,
    send_latency_ms: Math.round((jam ? 2500 : 180) + Math.random() * 150 + queue * 20),
    error_rate: tryNow ? +(((rejected + timeouts) / tryNow) * 100).toFixed(1) : 0,
    rejections: rejected,
    timeouts,
    emails_per_min: +(ok / intervalMin).toFixed(0),
    emails_per_hour: +((ok / intervalMin) * 60).toFixed(0),
  };
  return { metrics, details: { probe, totals: { delivered, attempted } } };
}
