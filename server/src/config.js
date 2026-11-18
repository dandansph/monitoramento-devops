import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

const list = (v, def) => (v && v.trim() ? v : def).split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  port: Number(process.env.PORT || 4000),
  demoTargetPort: Number(process.env.DEMO_TARGET_PORT || 4100),
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'redes2026',
  jwtSecret: process.env.JWT_SECRET || 'pixelnoc-dev-secret',
  ingestApiKey: process.env.INGEST_API_KEY || 'chave-de-ingestao-demo',
  httpTargets: list(process.env.HTTP_TARGETS, 'https://www.google.com,https://www.idp.edu.br'),
  dnsServers: list(process.env.DNS_SERVERS, '8.8.8.8,1.1.1.1'),
  dnsNames: list(process.env.DNS_NAMES, 'google.com,idp.edu.br,github.com'),
  smtpProbeHost: process.env.SMTP_PROBE_HOST || 'smtp.gmail.com',
  smtpProbePort: Number(process.env.SMTP_PROBE_PORT || 587),
  mail: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.ALERT_EMAIL_FROM || 'PixelNOC <alertas@pixelnoc.local>',
    to: process.env.ALERT_EMAIL_TO || 'equipe@exemplo.com',
  },
  dataDir: path.join(ROOT, 'data'),
  configDir: path.join(ROOT, 'config-monitorada'),
  rulesFile: path.join(ROOT, 'src', 'alerts', 'rules.json'),
  collectIntervalMs: 5000,
  retentionHours: 24,
};

export const SERVICES = ['web', 'database', 'dns', 'smtp'];
