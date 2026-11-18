// Motor de alertas: aplica as regras a cada amostra, abre/atualiza/resolve alertas e dispara e-mails.
import fs from 'node:fs';
import { config } from '../config.js';
import { db } from '../db.js';
import { bus } from '../bus.js';
import { step, worst } from './evaluate.js';
import { notify } from './notifier.js';

let rules = JSON.parse(fs.readFileSync(config.rulesFile, 'utf8'));
const states = new Map(); // rule.id -> estado da máquina
const openAlertId = new Map(); // rule.id -> id do alerta aberto

// reabre os alertas que ficaram abertos antes de um reinício
for (const a of db.prepare('SELECT id, rule_id, level FROM alerts WHERE resolved_at IS NULL').all()) {
  openAlertId.set(a.rule_id, a.id);
  states.set(a.rule_id, { level: a.level, candidate: a.level, count: 0 });
}

export const getRules = () => rules;

export function setRules(newRules) {
  if (!Array.isArray(newRules)) throw new Error('Regras devem ser uma lista');
  for (const r of newRules) {
    if (!r.id || !r.service || !r.metric || !['>', '<'].includes(r.op)) throw new Error(`Regra inválida: ${JSON.stringify(r)}`);
    for (const k of ['warn', 'crit', 'for']) if (r[k] !== null && r[k] !== undefined && !Number.isFinite(Number(r[k]))) throw new Error(`Valor inválido em ${r.id}.${k}`);
  }
  rules = newRules.map((r) => ({ ...r, warn: r.warn === '' ? null : r.warn, crit: r.crit === '' ? null : r.crit }));
  fs.writeFileSync(config.rulesFile, JSON.stringify(rules, null, 2));
  bus.emit('rules', rules);
  return rules;
}

const rowToAlert = (id) => db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);

function attachPreview(id) {
  return (preview) => {
    if (!preview) return;
    db.prepare('UPDATE alerts SET email_preview = ? WHERE id = ?').run(preview, id);
    bus.emit('alert', rowToAlert(id));
  };
}

function openOrUpdate(rule, level, value, message) {
  const now = Date.now();
  let id = openAlertId.get(rule.id);
  if (id) {
    db.prepare('UPDATE alerts SET level = ?, value = ?, updated_at = ?, acknowledged = 0 WHERE id = ?').run(level, value, now, id);
  } else {
    const r = db
      .prepare('INSERT INTO alerts (rule_id, service, metric, level, message, value, started_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(rule.id, rule.service, rule.metric ?? null, level, message, value, now, now);
    id = Number(r.lastInsertRowid);
    openAlertId.set(rule.id, id);
  }
  const alert = rowToAlert(id);
  bus.emit('alert', alert);
  notify(alert, attachPreview(id));
}

function resolve(rule, value) {
  const id = openAlertId.get(rule.id);
  if (!id) return;
  const now = Date.now();
  db.prepare('UPDATE alerts SET resolved_at = ?, updated_at = ?, value = ? WHERE id = ?').run(now, now, value, id);
  openAlertId.delete(rule.id);
  const alert = rowToAlert(id);
  bus.emit('alert', alert);
  if (alert.level === 'crit') notify({ ...alert, level: 'ok', message: `Resolvido: ${alert.message}` });
}

/** Avalia todas as regras de um serviço contra a amostra recebida. */
export function evaluate(service, metrics) {
  for (const rule of rules) {
    if (rule.service !== service || !(rule.metric in metrics)) continue;
    const value = metrics[rule.metric];
    const next = step(states.get(rule.id), rule, value);
    states.set(rule.id, next);
    if (!next.changed) continue;
    if (next.level === 'ok') resolve(rule, value);
    else openOrUpdate(rule, next.level, value, `${rule.description} (${rule.metric} = ${value}, limite ${rule.op} ${next.level === 'crit' ? rule.crit : rule.warn})`);
  }
  bus.emit('status', getStatuses());
}

/** Alertas pontuais (mudança de configuração, vulnerabilidade): ficam abertos até serem reconhecidos. */
export function raiseEvent({ ruleId, service, level, message, value = null }) {
  const now = Date.now();
  const r = db
    .prepare('INSERT INTO alerts (rule_id, service, metric, level, message, value, started_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(ruleId, service, null, level, message, value, now, now);
  const alert = rowToAlert(Number(r.lastInsertRowid));
  bus.emit('alert', alert);
  notify(alert, attachPreview(alert.id));
  bus.emit('status', getStatuses());
  return alert;
}

export function acknowledge(id) {
  const a = rowToAlert(id);
  if (!a) return null;
  // alertas de evento são encerrados ao reconhecer; alertas de métrica só marcam "visto"
  if (!a.metric && !a.resolved_at) db.prepare('UPDATE alerts SET acknowledged = 1, resolved_at = ? WHERE id = ?').run(Date.now(), id);
  else db.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(id);
  const updated = rowToAlert(id);
  bus.emit('alert', updated);
  bus.emit('status', getStatuses());
  return updated;
}

export function getStatuses() {
  const open = db.prepare('SELECT service, level FROM alerts WHERE resolved_at IS NULL').all();
  const out = {};
  for (const s of ['web', 'database', 'dns', 'smtp', 'security']) out[s] = worst(open.filter((a) => a.service === s).map((a) => a.level));
  return out;
}
