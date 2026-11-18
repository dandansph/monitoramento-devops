// Efeitos colaterais dos cenários que não são apenas "estado" (ataque de força bruta, mudança de config).
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { isActive } from './scenarios.js';

let handleLogin;
export const setLoginHandler = (fn) => (handleLogin = fn);

const USERS = ['admin', 'root', 'administrator', 'suporte', 'postgres'];
const PASSWORDS = ['123456', 'admin', 'password', 'qwerty', 'senha123', 'root'];

export function runScenarioSideEffects(name) {
  if (name === 'bruteforce') {
    // botnet de 6 IPs (faixa de documentação TEST-NET-3) tentando senhas comuns
    const ips = Array.from({ length: 6 }, (_, i) => `203.0.113.${10 + i * 7}`);
    const timer = setInterval(() => {
      if (!isActive('bruteforce')) return clearInterval(timer);
      const ip = ips[Math.floor(Math.random() * ips.length)];
      handleLogin?.(ip, USERS[Math.floor(Math.random() * USERS.length)], PASSWORDS[Math.floor(Math.random() * PASSWORDS.length)]);
    }, 900);
  }
  if (name === 'config-change') {
    const file = path.join(config.configDir, 'nginx.conf');
    const txt = fs.readFileSync(file, 'utf8');
    const next = txt.includes('server_tokens off;') ? txt.replace('server_tokens off;', 'server_tokens on;   # alterado!') : txt.replace('server_tokens on;   # alterado!', 'server_tokens off;');
    fs.writeFileSync(file, next);
  }
}
