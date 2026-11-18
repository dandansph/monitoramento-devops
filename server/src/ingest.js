// Pipeline de ingestão: grava a amostra, roda detecção de anomalia, avalia alertas e publica em tempo real.
import { saveMetrics } from './db.js';
import { bus, latest } from './bus.js';
import { evaluate } from './alerts/engine.js';
import { AnomalyDetector } from './security/anomaly.js';
import { logSecurityEvent } from './db.js';

const detectors = { web: new AnomalyDetector({ window: 60, minSamples: 12, minStd: 4 }) };
let lastAnomalyLog = 0;

export function ingest(service, metrics, details = {}, source = 'coletor') {
  const ts = Date.now();
  const m = { ...metrics };

  if (service === 'web' && typeof m.rps === 'number') {
    const r = detectors.web.push(m.rps, 3);
    m.anomaly_z = Math.max(r.z, 0);
    details = { ...details, anomaly: r };
    if (r.anomalous && ts - lastAnomalyLog > 30_000) {
      lastAnomalyLog = ts;
      const ev = logSecurityEvent('ddos_suspeito', r.z > 6 ? 'crit' : 'warn', 'web', {
        rps: m.rps, media: r.mean, desvio: r.std, z: r.z, conexoes: m.active_connections,
      });
      bus.emit('security', ev);
    }
  }

  saveMetrics(service, m, ts);
  latest[service] = { ts, metrics: m, details, source };
  bus.emit('metrics', { service, ts, metrics: m, details });
  evaluate(service, m);
}
