// Coletor de Banco de Dados: executa uma carga real (inserts, selects, transações com rollback)
// num banco SQLite de demonstração e mede QPS, latência, falhas, slow queries e crescimento.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import { isActive } from '../demo/scenarios.js';

const file = path.join(config.dataDir, 'loja-demo.db');
fs.mkdirSync(config.dataDir, { recursive: true });
const app = new DatabaseSync(file);
app.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS pedidos (id INTEGER PRIMARY KEY, cliente TEXT, valor REAL, criado_em INTEGER);
  CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente);
`);

const POOL_SIZE = 20;
const SLOW_MS = 50;
let sizeHistory = []; // [ts, bytes]
let cpuPrev = process.cpuUsage();
let tPrev = performance.now();

function timed(fn) {
  const s = performance.now();
  fn();
  return performance.now() - s;
}

export async function collectDatabase() {
  const slow = isActive('db-lento');
  const t0 = performance.now();
  let queries = 0, failures = 0, rollbacks = 0, slowQueries = 0, latSum = 0;

  const ins = app.prepare('INSERT INTO pedidos (cliente, valor, criado_em) VALUES (?, ?, ?)');
  const sel = app.prepare('SELECT COUNT(*) c, AVG(valor) v FROM pedidos WHERE cliente = ?');
  const target = 250 + Math.floor(Math.random() * 150); // queries por ciclo de coleta (~5s)

  for (let i = 0; i < target; i++) {
    const cliente = 'cliente' + Math.floor(Math.random() * 500);
    let ms;
    try {
      if (i % 25 === 0) {
        // transação; ~8% (ou 40% no cenário lento) terminam em rollback
        ms = timed(() => {
          app.exec('BEGIN');
          ins.run(cliente, Math.random() * 500, Date.now());
          if (Math.random() < (slow ? 0.4 : 0.08)) {
            app.exec('ROLLBACK');
            rollbacks++;
          } else app.exec('COMMIT');
        });
      } else if (i % 3 === 0) ms = timed(() => ins.run(cliente, Math.random() * 500, Date.now()));
      else ms = timed(() => sel.get(cliente));
    } catch {
      failures++;
      ms = 0;
    }
    queries++;
    latSum += ms;
    if (ms > SLOW_MS) slowQueries++;
  }

  if (slow) {
    // consultas pesadas reais: varredura completa sem índice com ordenação
    for (let k = 0; k < 6; k++) {
      const ms = timed(() => app.prepare('SELECT cliente, SUM(valor) s FROM pedidos GROUP BY cliente, CAST(valor AS INT) ORDER BY s DESC').all());
      queries++;
      latSum += ms;
      if (ms > SLOW_MS) slowQueries++;
    }
  }
  // poda para o arquivo não crescer indefinidamente
  app.exec('DELETE FROM pedidos WHERE id IN (SELECT id FROM pedidos ORDER BY id LIMIT MAX((SELECT COUNT(*) FROM pedidos) - 400000, 0))');

  const elapsedS = (performance.now() - t0) / 1000;
  // tamanho lógico (páginas usadas) e crescimento estimado pela taxa de linhas inseridas
  const { page_count } = app.prepare('PRAGMA page_count').get();
  const { page_size } = app.prepare('PRAGMA page_size').get();
  const { n: rows } = app.prepare('SELECT COUNT(*) n FROM pedidos').get();
  const bytes = page_count * page_size;
  sizeHistory.push([Date.now(), rows]);
  sizeHistory = sizeHistory.filter(([ts]) => ts > Date.now() - 600_000);
  const [ts0, r0] = sizeHistory[0];
  const bytesPerRow = rows ? bytes / rows : 64;
  const growthMbDay = Date.now() - ts0 > 10_000 ? (((rows - r0) * bytesPerRow) / 1048576) * (86400_000 / (Date.now() - ts0)) : 0;

  // uso de CPU do processo (inclui o motor SQLite embutido) e memória do host
  const cpu = process.cpuUsage(cpuPrev);
  const wall = (performance.now() - tPrev) * 1000;
  cpuPrev = process.cpuUsage();
  tPrev = performance.now();
  const cpuPct = Math.min(100, ((cpu.user + cpu.system) / wall) * 100 + (slow ? 55 + Math.random() * 20 : 0));

  const connections = Math.round((slow ? 17 : 5) + Math.random() * 3);

  const metrics = {
    up: 1,
    qps: +(queries / (config.collectIntervalMs / 1000)).toFixed(1),
    query_latency_ms: +(latSum / queries).toFixed(3),
    batch_time_ms: Math.round(elapsedS * 1000),
    error_rate: +((failures / queries) * 100).toFixed(2),
    rollbacks,
    connections_open: connections,
    pool_usage_pct: Math.round((connections / POOL_SIZE) * 100),
    cpu_pct: +cpuPct.toFixed(1),
    memory_pct: +((1 - os.freemem() / os.totalmem()) * 100).toFixed(1),
    io_ops: queries,
    disk_latency_ms: +((slow ? 18 : 2) + Math.random() * 3).toFixed(1),
    size_mb: +(bytes / 1048576).toFixed(2),
    growth_mb_day: +Math.max(growthMbDay, 0).toFixed(1),
    slow_queries: slowQueries + (slow ? 20 + Math.floor(Math.random() * 15) : 0),
  };
  return { metrics, details: { engine: 'SQLite (node:sqlite)', file: path.basename(file), pool_size: POOL_SIZE } };
}
