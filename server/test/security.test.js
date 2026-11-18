import { describe, it, expect } from 'vitest';
import { AnomalyDetector } from '../src/security/anomaly.js';
import { BruteForceDetector } from '../src/security/bruteforce.js';
import { lineDiff } from '../src/security/diff.js';

describe('AnomalyDetector (DDoS)', () => {
  it('aprende a linha de base e não alerta tráfego normal', () => {
    const d = new AnomalyDetector({ minSamples: 10 });
    for (let i = 0; i < 30; i++) expect(d.push(30 + (i % 5)).anomalous).toBe(false);
  });
  it('detecta pico súbito (z-score alto)', () => {
    const d = new AnomalyDetector({ minSamples: 10 });
    for (let i = 0; i < 30; i++) d.push(30 + (i % 5));
    const r = d.push(400);
    expect(r.anomalous).toBe(true);
    expect(r.z).toBeGreaterThan(6);
  });
  it('ataque prolongado não contamina a linha de base', () => {
    const d = new AnomalyDetector({ minSamples: 10 });
    for (let i = 0; i < 20; i++) d.push(30 + (i % 3));
    for (let i = 0; i < 50; i++) d.push(450);
    expect(d.push(450).anomalous).toBe(true);
  });
});

describe('BruteForceDetector', () => {
  it('bloqueia IP após 5 falhas na janela', () => {
    const b = new BruteForceDetector({ maxPerIp: 5 });
    let r;
    for (let i = 0; i < 5; i++) r = b.recordFailure('203.0.113.10', 'admin', 1000 + i);
    expect(r.newlyBlocked).toBe(true);
    expect(b.isBlocked('203.0.113.10', 2000)).toBe(true);
    expect(b.isBlocked('198.51.100.1', 2000)).toBe(false);
  });
  it('falhas antigas saem da janela deslizante', () => {
    const b = new BruteForceDetector({ windowMs: 1000, maxPerIp: 3, blockMs: 500 });
    b.recordFailure('1.1.1.1', 'a', 0);
    b.recordFailure('1.1.1.1', 'a', 100);
    const r = b.recordFailure('1.1.1.1', 'a', 5000);
    expect(r.countIp).toBe(1);
  });
  it('detecta conta alvo de vários IPs', () => {
    const b = new BruteForceDetector({ maxPerUser: 4, maxPerIp: 100 });
    let r;
    for (let i = 0; i < 4; i++) r = b.recordFailure(`10.0.0.${i}`, 'root', 100 + i);
    expect(r.userTargeted).toBe(true);
    expect(b.summary(200).byUser[0]).toEqual({ user: 'root', count: 4 });
  });
});

describe('lineDiff (mudança de configuração)', () => {
  it('mostra linhas removidas e adicionadas', () => {
    expect(lineDiff('a\nserver_tokens off;\nc', 'a\nserver_tokens on;\nc')).toEqual(['- server_tokens off;', '+ server_tokens on;']);
  });
});
