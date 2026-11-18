import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { config, SERVICES } from '../config.js';
import { db, querySeries, logSecurityEvent } from '../db.js';
import { bus, latest } from '../bus.js';
import { ingest } from '../ingest.js';
import { getRules, setRules, acknowledge, getStatuses } from '../alerts/engine.js';
import { mailMode, flushDigest } from '../alerts/notifier.js';
import { bruteForce } from '../security/bruteforce.js';
import { getVulnReport, scanVulnerabilities } from '../security/vulns.js';
import { listBaselines } from '../security/configWatch.js';
import { listScenarios, startScenario, stopScenario } from '../demo/scenarios.js';
import { runScenarioSideEffects } from '../demo/effects.js';

export const router = express.Router();
const clientIp = (req) => (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '?').replace('::ffff:', '');

// ---------- Autenticação ----------
export function handleLoginAttempt(ip, user, password) {
  if (bruteForce.isBlocked(ip)) return { status: 429, body: { error: 'IP bloqueado temporariamente por excesso de tentativas' } };
  if (user === config.adminUser && password === config.adminPassword) {
    bruteForce.recordSuccess(ip);
    const token = jwt.sign({ sub: user }, config.jwtSecret, { expiresIn: '12h' });
    return { status: 200, body: { token, user } };
  }
  const r = bruteForce.recordFailure(ip, user || '(vazio)');
  const ev = logSecurityEvent('login_falho', r.newlyBlocked ? 'crit' : 'warn', ip, { usuario: user, falhasIp: r.countIp, falhasConta: r.countUser, bloqueado: r.newlyBlocked });
  bus.emit('security', ev);
  ingest('security', { failed_logins_5min: bruteForce.summary().total });
  return { status: 401, body: { error: 'Usuário ou senha inválidos', tentativas: r.countIp } };
}

router.post('/auth/login', rateLimit({ windowMs: 60_000, limit: 30 }), (req, res) => {
  const { user, password } = req.body || {};
  const r = handleLoginAttempt(clientIp(req), String(user ?? ''), String(password ?? ''));
  res.status(r.status).json(r.body);
});

// ---------- Ingestão externa (agentes) ----------
router.post('/ingest', (req, res) => {
  if (req.get('x-api-key') !== config.ingestApiKey) return res.status(401).json({ error: 'API key inválida' });
  const { service, metrics, details } = req.body || {};
  if (![...SERVICES, 'system'].includes(service) || typeof metrics !== 'object') return res.status(400).json({ error: 'Informe service válido e objeto metrics' });
  ingest(service, metrics, details, `agente:${clientIp(req)}`);
  res.status(202).json({ accepted: Object.keys(metrics).length });
});

router.get('/health', (_req, res) => res.json({ status: 'ok', mail: mailMode(), ts: Date.now() }));

// ---------- Daqui para baixo exige JWT ----------
router.use((req, res, next) => {
  const token = (req.get('authorization') || '').replace(/^Bearer /, '');
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Não autenticado' });
  }
});

const RANGES = { '15m': [15 * 60_000, 15_000], '1h': [3600_000, 60_000], '6h': [6 * 3600_000, 300_000], '24h': [24 * 3600_000, 900_000] };

function uptime(service, sinceMs) {
  const r = db.prepare("SELECT AVG(value) v, COUNT(*) n FROM metrics WHERE service = ? AND metric = 'up' AND ts >= ?").get(service, sinceMs);
  return r.n ? +(r.v * 100).toFixed(2) : null;
}

router.get('/overview', (_req, res) => {
  const since = Date.now() - 3600_000;
  res.json({
    statuses: getStatuses(),
    latest,
    uptime: Object.fromEntries(SERVICES.map((s) => [s, uptime(s, since)])),
    uptime24h: Object.fromEntries(SERVICES.map((s) => [s, uptime(s, Date.now() - 86400_000)])),
    activeAlerts: db.prepare('SELECT * FROM alerts WHERE resolved_at IS NULL ORDER BY updated_at DESC').all(),
    scenarios: listScenarios(),
    mail: mailMode(),
  });
});

router.get('/services/:service/series', (req, res) => {
  const { service } = req.params;
  const [span, bucket] = RANGES[req.query.range] || RANGES['15m'];
  const rows = querySeries(service, Date.now() - span, bucket);
  const byTs = new Map();
  for (const r of rows) {
    if (!byTs.has(r.t)) byTs.set(r.t, { t: r.t });
    byTs.get(r.t)[r.metric] = +r.v.toFixed(2);
  }
  res.json({ service, range: req.query.range || '15m', points: [...byTs.values()], latest: latest[service] });
});

router.get('/alerts', (req, res) => {
  const where = req.query.state === 'active' ? 'WHERE resolved_at IS NULL' : '';
  res.json(db.prepare(`SELECT * FROM alerts ${where} ORDER BY updated_at DESC LIMIT 300`).all());
});
router.post('/alerts/:id/ack', (req, res) => {
  const a = acknowledge(Number(req.params.id));
  return a ? res.json(a) : res.status(404).json({ error: 'Alerta não encontrado' });
});
router.post('/alerts/flush-digest', async (_req, res) => {
  await flushDigest();
  res.json({ ok: true });
});

router.get('/rules', (_req, res) => res.json(getRules()));
router.put('/rules', (req, res) => {
  try {
    res.json(setRules(req.body));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/security', (_req, res) => {
  res.json({
    events: db.prepare('SELECT * FROM security_events ORDER BY ts DESC LIMIT 200').all().map((e) => ({ ...e, details: JSON.parse(e.details || '{}') })),
    bruteForce: bruteForce.summary(),
    configBaselines: listBaselines(),
    vulns: getVulnReport(),
    anomaly: latest.web?.details?.anomaly ?? null,
  });
});
router.post('/security/vulns/scan', async (_req, res) => res.json(await scanVulnerabilities()));

router.get('/sim', (_req, res) => res.json(listScenarios()));
router.post('/sim/:name', (req, res) => {
  try {
    const r = startScenario(req.params.name, req.body?.durationSec);
    runScenarioSideEffects(req.params.name);
    res.json(r);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
router.delete('/sim/:name', (req, res) => {
  stopScenario(req.params.name);
  res.json({ ok: true });
});
