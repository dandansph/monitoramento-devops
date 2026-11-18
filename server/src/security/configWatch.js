// Detecção de alterações em arquivos de configuração (integridade por hash SHA-256 + diff de linhas).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { lineDiff } from './diff.js';

export { lineDiff };

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function startConfigWatch(dir, onChange, intervalMs = 3000) {
  const get = db.prepare('SELECT hash, content FROM config_snapshots WHERE file = ?');
  const put = db.prepare('INSERT OR REPLACE INTO config_snapshots (file, hash, content, ts) VALUES (?, ?, ?, ?)');

  const scan = () => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (!fs.statSync(full).isFile()) continue;
      const content = fs.readFileSync(full, 'utf8');
      const hash = sha(content);
      const prev = get.get(name);
      if (!prev) put.run(name, hash, content, Date.now()); // linha de base
      else if (prev.hash !== hash) {
        put.run(name, hash, content, Date.now());
        onChange({ file: name, oldHash: prev.hash.slice(0, 12), newHash: hash.slice(0, 12), diff: lineDiff(prev.content, content) });
      }
    }
  };
  scan();
  // polling (mais confiável que fs.watch em pastas sincronizadas como OneDrive)
  return setInterval(scan, intervalMs);
}

export function listBaselines() {
  return db.prepare('SELECT file, substr(hash, 1, 12) AS hash, ts FROM config_snapshots ORDER BY file').all();
}
