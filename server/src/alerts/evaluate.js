// Lógica pura de avaliação de regras (testada em test/alerts.test.js).
export const LEVELS = { ok: 0, warn: 1, crit: 2 };
export const RECOVERY_SAMPLES = 2;

/** Nível instantâneo de um valor frente a uma regra. */
export function classify(rule, value) {
  const breach = (th) => th !== null && th !== undefined && (rule.op === '>' ? value > th : value < th);
  if (breach(rule.crit)) return 'crit';
  if (breach(rule.warn)) return 'warn';
  return 'ok';
}

/**
 * Máquina de estados com histerese:
 * - piorar exige `rule.for` amostras consecutivas no novo nível (evita alarme por pico isolado);
 * - melhorar exige RECOVERY_SAMPLES amostras consecutivas (evita "flapping").
 */
export function step(prev, rule, value) {
  const state = prev ?? { level: 'ok', candidate: 'ok', count: 0 };
  const now = classify(rule, value);
  if (now === state.level) return { level: state.level, candidate: now, count: 0, changed: false };

  const count = now === state.candidate ? state.count + 1 : 1;
  const needed = LEVELS[now] > LEVELS[state.level] ? Math.max(rule.for ?? 1, 1) : RECOVERY_SAMPLES;
  if (count >= needed) return { level: now, candidate: now, count: 0, changed: true, from: state.level };
  return { level: state.level, candidate: now, count, changed: false };
}

/** Status agregado de um serviço = pior nível entre suas regras. */
export function worst(levels) {
  return levels.reduce((w, l) => (LEVELS[l] > LEVELS[w] ? l : w), 'ok');
}
