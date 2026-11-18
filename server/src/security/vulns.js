// Monitoramento de vulnerabilidades conhecidas por serviço.
// Consulta a base pública OSV.dev (Google) com o inventário de pacotes/versões de cada serviço.
import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT } from '../config.js';

export const INVENTORY = [
  { service: 'web', software: 'nginx', ecosystem: 'Debian:11', name: 'nginx', version: '1.18.0-6.1+deb11u3' },
  { service: 'database', software: 'PostgreSQL 13', ecosystem: 'Debian:11', name: 'postgresql-13', version: '13.11-0+deb11u1' },
  { service: 'dns', software: 'BIND 9', ecosystem: 'Debian:11', name: 'bind9', version: '1:9.16.37-1~deb11u1' },
  { service: 'smtp', software: 'Postfix', ecosystem: 'Debian:11', name: 'postfix', version: '3.5.18-0+deb11u1' },
];

// dependências da própria plataforma (lidas do package-lock, se existir)
function platformPackages() {
  try {
    const lock = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'package-lock.json'), 'utf8'));
    return ['express', 'nodemailer', 'ws', 'jsonwebtoken', 'helmet']
      .map((n) => ({ n, v: lock.packages?.[`node_modules/${n}`]?.version }))
      .filter((p) => p.v)
      .map((p) => ({ service: 'plataforma', software: p.n, ecosystem: 'npm', name: p.n, version: p.v }));
  } catch {
    return [];
  }
}

const cacheFile = path.join(config.dataDir, 'vulns-cache.json');
let report = { checkedAt: null, source: 'pendente', items: [] };

async function details(id) {
  const r = await fetch(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(10000) });
  const j = await r.json();
  const fixed = j.affected?.[0]?.ranges?.[0]?.events?.find((e) => e.fixed)?.fixed;
  return {
    id: j.id,
    summary: j.summary || j.details?.slice(0, 140) || '',
    cves: (j.upstream || j.aliases || []).filter((c) => c.startsWith('CVE-')),
    published: j.published,
    fixed,
    url: `https://osv.dev/vulnerability/${j.id}`,
  };
}

export async function scanVulnerabilities() {
  const inventory = [...INVENTORY, ...platformPackages()];
  try {
    const res = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queries: inventory.map((i) => ({ package: { name: i.name, ecosystem: i.ecosystem }, version: i.version })) }),
      signal: AbortSignal.timeout(15000),
    });
    const { results } = await res.json();
    const items = [];
    for (let k = 0; k < inventory.length; k++) {
      const ids = (results[k]?.vulns || []).map((v) => v.id);
      const top = await Promise.all(ids.slice(0, 6).map((id) => details(id).catch(() => ({ id, summary: '', cves: [] }))));
      items.push({ ...inventory[k], count: ids.length, advisories: top });
    }
    report = { checkedAt: Date.now(), source: 'OSV.dev (online)', items };
    fs.writeFileSync(cacheFile, JSON.stringify(report));
  } catch (e) {
    if (fs.existsSync(cacheFile)) report = { ...JSON.parse(fs.readFileSync(cacheFile, 'utf8')), source: 'cache local (offline)' };
    else report = { checkedAt: Date.now(), source: `indisponível (${e.message})`, items: inventory.map((i) => ({ ...i, count: null, advisories: [] })) };
  }
  return report;
}

export const getVulnReport = () => report;
