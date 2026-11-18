// Armazenamento de métricas, alertas e eventos de segurança em SQLite (módulo nativo node:sqlite).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });
export const db = new DatabaseSync(process.env.DB_FILE || path.join(config.dataDir, 'pixelnoc.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS metrics (
    ts INTEGER NOT NULL, service TEXT NOT NULL, metric TEXT NOT NULL, value REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_metrics ON metrics(service, metric, ts);
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id TEXT NOT NULL, service TEXT NOT NULL, metric TEXT, level TEXT NOT NULL,
    message TEXT NOT NULL, value REAL, started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    resolved_at INTEGER, acknowledged INTEGER DEFAULT 0, email_preview TEXT
  );
  CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, type TEXT NOT NULL,
    severity TEXT NOT NULL, source TEXT, details TEXT
  );
  CREATE TABLE IF NOT EXISTS config_snapshots (
    file TEXT PRIMARY KEY, hash TEXT NOT NULL, content TEXT, ts INTEGER NOT NULL
  );
`);

const insertMetric = db.prepare('INSERT INTO metrics (ts, service, metric, value) VALUES (?, ?, ?, ?)');

export function saveMetrics(service, values, ts = Date.now()) {
  db.exec('BEGIN');
  try {
    for (const [metric, value] of Object.entries(values)) {
      if (typeof value === 'number' && Number.isFinite(value)) insertMetric.run(ts, service, metric, value);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Série temporal agregada em baldes de `bucketMs` (média por balde). */
export function querySeries(service, sinceMs, bucketMs) {
  return db
    .prepare(
      `SELECT (ts / ?) * ? AS t, metric, AVG(value) AS v FROM metrics
       WHERE service = ? AND ts >= ? GROUP BY t, metric ORDER BY t`,
    )
    .all(bucketMs, bucketMs, service, sinceMs);
}

export function pruneOld() {
  const cutoff = Date.now() - config.retentionHours * 3600_000;
  db.prepare('DELETE FROM metrics WHERE ts < ?').run(cutoff);
}

export function logSecurityEvent(type, severity, source, details) {
  const ts = Date.now();
  const r = db
    .prepare('INSERT INTO security_events (ts, type, severity, source, details) VALUES (?, ?, ?, ?, ?)')
    .run(ts, type, severity, source ?? null, JSON.stringify(details ?? {}));
  return { id: Number(r.lastInsertRowid), ts, type, severity, source, details };
}
