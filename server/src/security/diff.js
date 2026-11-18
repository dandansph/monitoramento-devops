/** Diff simples linha a linha (suficiente para arquivos de configuração). */
export function lineDiff(before, after) {
  const a = (before ?? '').split(/\r?\n/);
  const b = after.split(/\r?\n/);
  const removed = a.filter((l) => !b.includes(l)).map((l) => `- ${l}`);
  const added = b.filter((l) => !a.includes(l)).map((l) => `+ ${l}`);
  return [...removed, ...added].slice(0, 40);
}

