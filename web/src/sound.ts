// Alarme 8-bit gerado com Web Audio (sem arquivos de áudio).
let ctx: AudioContext | null = null;
const KEY = 'pixelnoc.mute';

export function isMuted() {
  try { return localStorage.getItem(KEY) !== '0'; } catch { return true; }
}
export function setMuted(m: boolean) {
  try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* ignore */ }
}

export function playAlarm() {
  if (isMuted()) return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    [0, 0.18, 0.36].forEach((d, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'square';
      o.frequency.value = i % 2 ? 660 : 880;
      g.gain.setValueAtTime(0.06, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.16);
      o.connect(g).connect(ctx!.destination);
      o.start(t + d);
      o.stop(t + d + 0.17);
    });
  } catch { /* navegador sem áudio */ }
}
