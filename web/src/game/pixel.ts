// Primitivas de desenho em pixel art (arte original, desenhada em código).
export type Ctx = CanvasRenderingContext2D;

export const r = (c: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), w, h);
};

// ---------- Personagens 8x12 ----------
const BODY = [
  '..hhhh..',
  '.hhhhhh.',
  '.hssssh.',
  '.sesses.',
  '..ssss..',
  '.cccccc.',
  'sccccccs',
  'sccccccs',
  '.cccccc.',
];
const LEGS_A = ['.pp..pp.', '.pp..pp.', '.bb..bb.'];
const LEGS_B = ['..pppp..', '..pp.p..', '..bb.b..'];
const LEGS_C = ['..pppp..', '..p.pp..', '..b.bb..'];
const HOOD = [
  '..hhhh..',
  '.hhhhhh.',
  'hhsssshh',
  'hhesseh.',
  '.hssssh.',
  '.cccccc.',
  'sccccccs',
  'sccccccs',
  '.cccccc.',
];

export type Look = { hair: string; skin: string; shirt: string; pants: string; shoes?: string; hood?: boolean };

export function drawPerson(c: Ctx, x: number, y: number, look: Look, frame: number, flip = false) {
  const rows = [...(look.hood ? HOOD : BODY), ...(frame === 0 ? LEGS_A : frame === 1 ? LEGS_B : LEGS_C)];
  const pal: Record<string, string> = {
    h: look.hair, s: look.skin, e: '#1a1a24', c: look.shirt, p: look.pants, b: look.shoes ?? '#2a1d18',
  };
  // sombra
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(Math.round(x) + 1, Math.round(y) + 11, 6, 2);
  rows.forEach((row, j) => {
    for (let i = 0; i < 8; i++) {
      const ch = row[flip ? 7 - i : i];
      if (ch === '.') continue;
      c.fillStyle = pal[ch];
      c.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
    }
  });
}

/** Ícone de status sobre a cabeça: "!" amarelo ou vermelho piscando. */
export function drawBadge(c: Ctx, x: number, y: number, color: string) {
  r(c, x, y, 5, 7, '#11131c');
  r(c, x + 1, y + 1, 3, 5, color);
  r(c, x + 2, y + 2, 1, 2, '#11131c');
  r(c, x + 2, y + 5, 1, 1, '#11131c');
}

// ---------- Móveis ----------
export function rack(c: Ctx, x: number, y: number, t: number, level: string, down: boolean) {
  r(c, x, y, 16, 30, '#14161f');
  r(c, x + 1, y + 1, 14, 28, '#2a2f42');
  for (let k = 0; k < 6; k++) {
    const yy = y + 3 + k * 4;
    r(c, x + 2, yy, 12, 3, '#1b1e2b');
    if (down) continue;
    const blink = (Math.sin(t * (level === 'crit' ? 18 : 6) + k * 1.7 + x) > 0);
    const led = level === 'crit' ? (blink ? '#ff4d5e' : '#5a1f27') : level === 'warn' ? (blink ? '#f4c542' : '#5dd39e') : blink ? '#5dd39e' : '#1f5c43';
    r(c, x + 3, yy + 1, 1, 1, led);
    r(c, x + 5, yy + 1, 1, 1, Math.sin(t * 11 + k) > 0.3 ? '#5ab0ff' : '#23314f');
  }
  r(c, x, y + 30, 16, 2, 'rgba(0,0,0,0.3)');
}

export function desk(c: Ctx, x: number, y: number, w: number, screen: string) {
  r(c, x, y + 6, w, 4, '#a0703f');
  r(c, x, y + 10, w, 3, '#6e4a29');
  r(c, x + 1, y + 13, 2, 4, '#4a3220');
  r(c, x + w - 3, y + 13, 2, 4, '#4a3220');
  const mx = x + Math.floor(w / 2) - 6;
  r(c, mx, y - 3, 12, 9, '#1c1e28');
  r(c, mx + 1, y - 2, 10, 6, screen);
  r(c, mx + 5, y + 6, 2, 1, '#1c1e28');
}

export function plant(c: Ctx, x: number, y: number) {
  r(c, x + 1, y + 8, 6, 5, '#9a5b34');
  r(c, x + 1, y + 8, 6, 1, '#b8744a');
  r(c, x, y + 2, 3, 6, '#2f8f4e');
  r(c, x + 5, y + 2, 3, 6, '#2f8f4e');
  r(c, x + 2, y, 4, 8, '#3fae62');
  r(c, x + 3, y + 3, 1, 2, '#6fd18a');
}

export function cylinder(c: Ctx, x: number, y: number, t: number, active: number, down: boolean) {
  r(c, x + 1, y, 14, 2, '#c9d0ea');
  r(c, x, y + 1, 16, 20, '#8a93b5');
  r(c, x, y + 1, 16, 2, '#b3bbd9');
  r(c, x, y + 7, 16, 1, '#6a7396');
  r(c, x, y + 13, 16, 1, '#6a7396');
  r(c, x + 1, y + 21, 14, 1, '#6a7396');
  r(c, x + 13, y + 4, 1, 1, down ? '#333' : Math.sin(t * (4 + active) + x) > 0 ? '#5dd39e' : '#1f5c43');
  r(c, x + 13, y + 10, 1, 1, down ? '#333' : Math.sin(t * (5 + active) + x * 2) > 0 ? '#5ab0ff' : '#23314f');
}

export function bookshelf(c: Ctx, x: number, y: number, w: number, seed = 1) {
  r(c, x, y, w, 26, '#5a3a22');
  const colors = ['#d9534f', '#5ab0ff', '#f4c542', '#5dd39e', '#c77dff', '#ff8fab', '#e9ecef'];
  for (let shelf = 0; shelf < 3; shelf++) {
    const sy = y + 2 + shelf * 8;
    r(c, x + 1, sy, w - 2, 7, '#2c1c10');
    let bx = x + 2;
    let k = shelf * 3 + seed;
    while (bx < x + w - 3) {
      const bw = 1 + ((k * 7) % 2);
      const bh = 4 + ((k * 3) % 3);
      r(c, bx, sy + 7 - bh, bw, bh, colors[k % colors.length]);
      bx += bw + 1;
      k++;
    }
  }
}

export function globe(c: Ctx, x: number, y: number, t: number) {
  r(c, x + 3, y + 12, 6, 2, '#6e4a29');
  r(c, x + 5, y + 10, 2, 2, '#6e4a29');
  r(c, x + 2, y, 8, 10, '#2e6fd1');
  r(c, x + 1, y + 2, 10, 6, '#2e6fd1');
  const s = Math.floor(t * 2) % 4;
  r(c, x + 2 + s, y + 2, 3, 2, '#3fae62');
  r(c, x + 4 + ((s + 2) % 4), y + 6, 3, 2, '#3fae62');
}

export function envelope(c: Ctx, x: number, y: number, tint = '#f1ece0') {
  r(c, x, y, 7, 5, tint);
  r(c, x + 1, y + 1, 1, 1, '#b9ad94');
  r(c, x + 2, y + 2, 3, 1, '#b9ad94');
  r(c, x + 5, y + 1, 1, 1, '#b9ad94');
}

export function mailShelf(c: Ctx, x: number, y: number) {
  r(c, x, y, 34, 24, '#6e4a29');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    r(c, x + 2 + i * 8, y + 2 + j * 7, 6, 5, '#2c1c10');
    if ((i + j) % 2 === 0) r(c, x + 3 + i * 8, y + 4 + j * 7, 4, 3, '#f1ece0');
  }
}

export function mailbox(c: Ctx, x: number, y: number) {
  r(c, x + 3, y + 10, 2, 8, '#444');
  r(c, x, y, 9, 10, '#d62828');
  r(c, x, y, 9, 2, '#ff4d5e');
  r(c, x + 2, y + 4, 5, 1, '#3a0d10');
}

export function sofa(c: Ctx, x: number, y: number, color = '#c2416b') {
  r(c, x, y, 26, 6, color);
  r(c, x, y + 6, 26, 6, '#9c2f53');
  r(c, x - 2, y + 3, 3, 9, '#7d2443');
  r(c, x + 25, y + 3, 3, 9, '#7d2443');
}

export function rug(c: Ctx, x: number, y: number, w: number, h: number) {
  r(c, x, y, w, h, '#2b4f7a');
  r(c, x + 2, y + 2, w - 4, h - 4, '#356196');
  for (let i = x + 4; i < x + w - 4; i += 4) r(c, i, y + Math.floor(h / 2), 2, 1, '#9cc7ff');
}

export function cctv(c: Ctx, x: number, y: number, t: number, alarm: boolean) {
  r(c, x, y, 30, 20, '#1c1e28');
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const on = alarm && Math.sin(t * 10 + i + j * 2) > 0;
    r(c, x + 2 + i * 14, y + 2 + j * 9, 12, 7, on ? '#7a1f2a' : '#24475e');
    r(c, x + 4 + i * 14, y + 4 + j * 9, 3 + ((i + j + Math.floor(t * 3)) % 5), 1, '#9cc7ff');
  }
}

export function gate(c: Ctx, x: number, y: number, locked: boolean) {
  r(c, x, y, 20, 26, '#3a3f55');
  r(c, x + 2, y + 2, 16, 24, '#6b5a3a');
  r(c, x + 9, y + 2, 1, 24, '#4e4128');
  r(c, x + 12, y + 13, 3, 3, locked ? '#ff4d5e' : '#f4c542');
}

export function portal(c: Ctx, x: number, y: number, t: number, hot: boolean) {
  r(c, x, y, 6, 26, '#11131c');
  for (let k = 0; k < 6; k++) {
    const a = (Math.sin(t * (hot ? 12 : 4) + k) + 1) / 2;
    r(c, x + 1, y + 2 + k * 4, 4, 3, hot ? `rgba(255,77,94,${0.4 + a * 0.6})` : `rgba(90,176,255,${0.3 + a * 0.6})`);
  }
}

export function bigScreen(c: Ctx, x: number, y: number, colors: string[], t: number) {
  r(c, x, y, 52, 22, '#11131c');
  r(c, x + 2, y + 2, 48, 18, '#0e2235');
  colors.forEach((col, i) => {
    const h = 6 + Math.round(4 * Math.abs(Math.sin(t * 1.5 + i)));
    r(c, x + 5 + i * 11, y + 18 - h, 8, h, col);
  });
}

export function bug(c: Ctx, x: number, y: number, t: number) {
  const f = Math.sin(t * 25 + x) > 0;
  r(c, x + 1, y, 3, 3, '#c0265a');
  r(c, x + 2, y + 1, 1, 1, '#ffe066');
  r(c, x, y + (f ? 0 : 2), 1, 1, '#2a0a17');
  r(c, x + 4, y + (f ? 2 : 0), 1, 1, '#2a0a17');
}

export function hourglass(c: Ctx, x: number, y: number) {
  r(c, x, y, 5, 1, '#6e4a29');
  r(c, x + 1, y + 1, 3, 2, '#f4c542');
  r(c, x + 2, y + 3, 1, 1, '#f4c542');
  r(c, x + 1, y + 4, 3, 2, '#e9d8a6');
  r(c, x, y + 6, 5, 1, '#6e4a29');
}
