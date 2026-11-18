import { describe, it, expect } from 'vitest';
import { classify, step, worst } from '../src/alerts/evaluate.js';

const latency = { id: 'lat', op: '>', warn: 150, crit: 400, for: 2 };
const down = { id: 'down', op: '<', warn: null, crit: 1, for: 1 };
const delivery = { id: 'del', op: '<', warn: 90, crit: 75, for: 1 };

describe('classify', () => {
  it('classifica limites superiores (verde/amarelo/vermelho)', () => {
    expect(classify(latency, 100)).toBe('ok');
    expect(classify(latency, 200)).toBe('warn');
    expect(classify(latency, 500)).toBe('crit');
  });
  it('classifica limites inferiores (taxa de entrega, disponibilidade)', () => {
    expect(classify(delivery, 95)).toBe('ok');
    expect(classify(delivery, 85)).toBe('warn');
    expect(classify(delivery, 60)).toBe('crit');
    expect(classify(down, 1)).toBe('ok');
    expect(classify(down, 0)).toBe('crit');
  });
});

describe('step (histerese)', () => {
  it('um pico isolado não dispara alerta quando for=2', () => {
    let s = step(undefined, latency, 500);
    expect(s.level).toBe('ok');
    s = step(s, latency, 100);
    expect(s.level).toBe('ok');
  });
  it('dispara após N amostras consecutivas', () => {
    let s = step(undefined, latency, 500);
    s = step(s, latency, 520);
    expect(s.level).toBe('crit');
    expect(s.changed).toBe(true);
  });
  it('indisponibilidade (for=1) dispara imediatamente', () => {
    const s = step(undefined, down, 0);
    expect(s).toMatchObject({ level: 'crit', changed: true });
  });
  it('recuperação exige 2 amostras boas (anti-flapping)', () => {
    let s = { level: 'crit', candidate: 'crit', count: 0 };
    s = step(s, latency, 50);
    expect(s.level).toBe('crit');
    s = step(s, latency, 50);
    expect(s).toMatchObject({ level: 'ok', changed: true });
  });
});

describe('worst', () => {
  it('status do serviço é o pior nível', () => {
    expect(worst([])).toBe('ok');
    expect(worst(['ok', 'warn'])).toBe('warn');
    expect(worst(['warn', 'crit', 'ok'])).toBe('crit');
  });
});
