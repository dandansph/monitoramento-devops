// PixelNOC — servidor de monitoramento (API REST + WebSocket + coletores + alertas).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import { config, ROOT } from './config.js';
import { pruneOld, logSecurityEvent } from './db.js';
import { bus, latest } from './bus.js';
import { ingest } from './ingest.js';
import { router, handleLoginAttempt } from './routes/api.js';
import { initMailer } from './alerts/notifier.js';
import { raiseEvent, getStatuses } from './alerts/engine.js';
import { startDemoTarget } from './demo/target.js';
import { setLoginHandler } from './demo/effects.js';
import { collectWeb } from './collectors/web.js';
import { collectDns } from './collectors/dns.js';
import { collectDatabase } from './collectors/database.js';
import { collectSmtp } from './collectors/smtp.js';
import { collectSystem } from './collectors/system.js';
import { startConfigWatch } from './security/configWatch.js';
import { scanVulnerabilities } from './security/vulns.js';
import { bruteForce } from './security/bruteforce.js';

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '200kb' }));
app.use('/api', router);

// em produção o próprio servidor entrega o front-end compilado
const dist = path.join(ROOT, '..', 'web', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|ws).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const server = http.createServer(app);

// ---------- WebSocket: tempo real ----------
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws, req) => {
  const token = new URL(req.url, 'http://x').searchParams.get('token');
  try {
    jwt.verify(token, config.jwtSecret);
  } catch {
    return ws.close(4001, 'unauthorized');
  }
  ws.send(JSON.stringify({ type: 'hello', latest, statuses: getStatuses() }));
});
const broadcast = (type, payload) => {
  const msg = JSON.stringify({ type, ...payload });
  for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
};
bus.on('metrics', (p) => broadcast('metrics', p));
bus.on('alert', (alert) => broadcast('alert', { alert }));
bus.on('status', (statuses) => broadcast('status', { statuses }));
bus.on('security', (event) => broadcast('security', { event }));
bus.on('scenario', (s) => broadcast('scenario', { scenario: s }));

// ---------- Coletores ----------
async function run(name, fn) {
  try {
    const { metrics, details } = await fn();
    ingest(name, metrics, details);
  } catch (e) {
    console.error(`[coletor ${name}]`, e.message);
    ingest(name, { up: 0 }, { error: e.message });
  }
}

function startCollectors() {
  const tick = () => {
    run('web', collectWeb);
    run('dns', collectDns);
    run('database', collectDatabase);
    run('smtp', collectSmtp);
    run('system', collectSystem);
    ingest('security', { failed_logins_5min: bruteForce.summary().total });
  };
  tick();
  setInterval(tick, config.collectIntervalMs);
  setInterval(pruneOld, 10 * 60_000);
}

// ---------- Segurança ----------
setLoginHandler(handleLoginAttempt);
startConfigWatch(config.configDir, (chg) => {
  const ev = logSecurityEvent('config_alterada', 'warn', chg.file, chg);
  bus.emit('security', ev);
  raiseEvent({ ruleId: 'sec-config', service: 'security', level: 'warn', message: `Arquivo de configuração alterado: ${chg.file} (${chg.oldHash} → ${chg.newHash})` });
});

async function vulnScan() {
  const rep = await scanVulnerabilities();
  const total = rep.items.filter((i) => i.service !== 'plataforma').reduce((s, i) => s + (i.count || 0), 0);
  console.log(`[vulns] ${total} avisos de segurança em serviços (${rep.source})`);
}

startDemoTarget(config.demoTargetPort);
await initMailer();
server.listen(config.port, () => {
  console.log(`PixelNOC rodando em http://localhost:${config.port}  (login: ${config.adminUser})`);
  startCollectors();
  vulnScan();
  setInterval(vulnScan, 6 * 3600_000);
});
