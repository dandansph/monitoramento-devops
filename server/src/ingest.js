// Pipeline de ingestão: grava a amostra, roda detecção de anomalia, avalia alertas e publica em tempo real.
import { saveMetrics, db } from './db.js';
import { bus, latest } from './bus.js';
import { evaluate } from './alerts/engine.js';
import { AnomalyDetector } from './security/anomaly.js';
import { logSecurityEvent } from './db.js';

const detectors = { web: new AnomalyDetector({ window: 60, minSamples: 12, minStd: 4 }) };

// Ao iniciar, recupera a linha de base do histórico gravado (ignorando picos > 3x a mediana),
// para que um ataque logo após o boot não seja aprendido como "normal".
try {
  const hist = db
    .prepare("SELECT value FROM metrics WHERE service = 'web' AND metric = 'rps' AND ts > ? ORDER BY ts DESC LIMIT 120")
    .all(Date.now() - 3 * 3600_000)
    .map((r) => r.value);
  if (hist.length >= 12) {
    const median = [...hist].sort((a, b) => a - b)[Math.floor(hist.length / 2)];
    detectors.web.samples = hist.filter((v) => v <= median * 3).slice(0, 60).reverse();
  }
} catch { /* sem histórico */ }
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
