import { useEffect, useRef, useState } from 'react';
import type { Level, SecurityEvent, Snapshot } from '../api';
import { LEVEL_COLOR, SERVICES } from '../meta';
import * as P from './pixel';

export const W = 384;
export const H = 224;

type RoomId = 'web' | 'database' | 'dns' | 'smtp' | 'control' | 'security';
type Room = { id: RoomId; x: number; y: number; w: number; h: number; floor: [string, string]; wall: string; label: string };

export const ROOMS: Room[] = [
  { id: 'web', x: 0, y: 0, w: 144, h: 112, floor: ['#3d4b6e', '#384563'], wall: '#262c44', label: 'Sala dos Servidores · WEB' },
  { id: 'database', x: 144, y: 0, w: 112, h: 112, floor: ['#5b4838', '#544231'], wall: '#3a2b20', label: 'Cofre de Dados · BANCO' },
  { id: 'dns', x: 256, y: 0, w: 128, h: 112, floor: ['#2f5a52', '#2b534b'], wall: '#1e3b36', label: 'Central de Nomes · DNS' },
  { id: 'smtp', x: 0, y: 112, w: 144, h: 112, floor: ['#6c5b3b', '#655535'], wall: '#463a24', label: 'Agência de Correio · SMTP' },
  { id: 'control', x: 144, y: 112, w: 112, h: 112, floor: ['#8a8f9e', '#7f8494'], wall: '#4a4e5c', label: 'Sala de Controle · NOC' },
  { id: 'security', x: 256, y: 112, w: 128, h: 112, floor: ['#4b3c5c', '#453754'], wall: '#2e2340', label: 'Guarita · SEGURANÇA' },
];
const WALL_H = 22;

type Actor = {
  id: string; room: RoomId; x: number; y: number; tx: number; ty: number; wait: number; look: P.Look; frame: number; flip: boolean; anim: number;
};

const LOOKS: Record<string, P.Look> = {
  web: { hair: '#2b1b12', skin: '#f1c7a5', shirt: '#5ab0ff', pants: '#2b3350' },
  database: { hair: '#c98b2f', skin: '#d9a07a', shirt: '#c77dff', pants: '#3a2d4f' },
  dns: { hair: '#111', skin: '#8d5a3b', shirt: '#5dd39e', pants: '#24423a' },
  smtp: { hair: '#a33b20', skin: '#f3d2b8', shirt: '#ff8fab', pants: '#4a2f2f' },
  security: { hair: '#2a2a2a', skin: '#c68a63', shirt: '#2f3e66', pants: '#1c2238', shoes: '#000' },
  control: { hair: '#e8d9b0', skin: '#f1c7a5', shirt: '#f4c542', pants: '#3b3b48' },
};

function roomOf(id: RoomId) {
  return ROOMS.find((r) => r.id === id)!;
}
function randomSpot(room: Room) {
  return { x: room.x + 10 + Math.random() * (room.w - 28), y: room.y + WALL_H + 14 + Math.random() * (room.h - WALL_H - 32) };
}

export type MapData = {
  latest: Record<string, Snapshot>;
  statuses: Record<string, Level>;
  activeAlerts: number;
  lastSecurity: SecurityEvent | null;
};

export default function OfficeMap({ data, onSelect }: { data: MapData; onSelect: (room: RoomId) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const bubbles = useRef<Record<string, HTMLDivElement | null>>({});
  const [hover, setHover] = useState<RoomId | null>(null);
  const hoverRef = useRef<RoomId | null>(null);
  hoverRef.current = hover;

  useEffect(() => {
    const c = canvas.current!.getContext('2d')!;
    const actors: Actor[] = (['web', 'database', 'dns', 'smtp', 'security', 'control'] as RoomId[]).map((id) => {
      const s = randomSpot(roomOf(id));
      return { id, room: id, ...s, tx: s.x, ty: s.y, wait: 1, look: LOOKS[id], frame: 0, flip: false, anim: 0 };
    });
    const bugs: { x: number; y: number; vx: number; vy: number }[] = [];
    const packets: { x: number; y: number; tx: number; ty: number; color: string; life: number }[] = [];
    const smoke: { x: number; y: number; life: number }[] = [];
    let raf = 0;
    let last = performance.now();

    const m = (svc: string) => dataRef.current.latest[svc]?.metrics ?? {};
    const lvl = (svc: string): Level => dataRef.current.statuses[svc] ?? 'ok';
    const isDown = (svc: string) => m(svc).up === 0;

    function drawRoom(room: Room, t: number) {
      // piso quadriculado
      for (let y = room.y + WALL_H; y < room.y + room.h; y += 8)
        for (let x = room.x; x < room.x + room.w; x += 8)
          P.r(c, x, y, 8, 8, ((x + y) / 8) % 2 === 0 ? room.floor[0] : room.floor[1]);
      // parede do fundo
      P.r(c, room.x, room.y, room.w, WALL_H, room.wall);
      P.r(c, room.x, room.y + WALL_H - 3, room.w, 3, 'rgba(0,0,0,0.35)');
      P.r(c, room.x, room.y + 3, room.w, 1, 'rgba(255,255,255,0.06)');
      // bordas
      P.r(c, room.x, room.y, room.w, 2, '#0d0f17');
      P.r(c, room.x, room.y, 2, room.h, '#0d0f17');
      P.r(c, room.x + room.w - 2, room.y, 2, room.h, '#0d0f17');
      P.r(c, room.x, room.y + room.h - 2, room.w, 2, '#0d0f17');
      void t;
    }

    function furniture(t: number) {
      const web = roomOf('web');
      const wl = lvl('web');
      const wdown = isDown('web');
      P.portal(c, web.x + 2, web.y + 50, t, (m('web').anomaly_z ?? 0) > 3);
      for (let k = 0; k < 4; k++) P.rack(c, web.x + 30 + k * 22, web.y + 4, t, wl, wdown);
      P.desk(c, web.x + 96, web.y + 70, 30, wdown ? '#111' : '#1f4f7a');
      P.plant(c, web.x + 128, web.y + 92);

      const db = roomOf('database');
      const dl = lvl('database');
      const dm = m('database');
      for (let k = 0; k < 4; k++) P.cylinder(c, db.x + 10 + k * 24, db.y + 6, t, Math.min((dm.qps ?? 0) / 20, 8), isDown('database'));
      const hg = Math.min(Math.ceil((dm.slow_queries ?? 0) / 8), 4);
      for (let k = 0; k < hg; k++) P.hourglass(c, db.x + 15 + k * 24, db.y + 30 + Math.round(Math.sin(t * 4 + k) * 1.5));
      P.desk(c, db.x + 40, db.y + 72, 30, dl === 'crit' ? '#5a1f27' : '#2c5a3f');
      P.plant(c, db.x + 98, db.y + 92);

      const dns = roomOf('dns');
      P.bookshelf(c, dns.x + 8, dns.y + 0, 44, 2);
      P.bookshelf(c, dns.x + 76, dns.y + 0, 44, 5);
      P.globe(c, dns.x + 58, dns.y + 54, t);
      P.desk(c, dns.x + 14, dns.y + 76, 30, '#1f6b5a');
      P.plant(c, dns.x + 112, dns.y + 92);

      const smtp = roomOf('smtp');
      const sm = m('smtp');
      P.mailShelf(c, smtp.x + 10, smtp.y + 0);
      P.mailShelf(c, smtp.x + 52, smtp.y + 0);
      P.mailbox(c, smtp.x + 120, smtp.y + 40);
      // pilha de envelopes = tamanho da fila
      const pile = Math.min(Math.ceil((sm.queue_length ?? 0) / 4), 30);
      for (let k = 0; k < pile; k++) P.envelope(c, smtp.x + 98 + (k % 3) * 6 - (k % 2), smtp.y + 100 - Math.floor(k / 3) * 4, k % 5 === 0 ? '#ffe3e3' : undefined);
      P.desk(c, smtp.x + 20, smtp.y + 74, 34, '#7a5a1f');

      const ctl = roomOf('control');
      const order = ['web', 'database', 'dns', 'smtp'];
      P.bigScreen(c, ctl.x + 30, ctl.y + 0, order.map((s) => LEVEL_COLOR[lvl(s)]), t);
      P.rug(c, ctl.x + 26, ctl.y + 60, 60, 30);
      P.desk(c, ctl.x + 14, ctl.y + 36, 34, dataRef.current.activeAlerts ? '#5a1f27' : '#1f4f7a');
      P.desk(c, ctl.x + 64, ctl.y + 36, 34, '#1f4f7a');
      P.sofa(c, ctl.x + 42, ctl.y + 94);
      P.plant(c, ctl.x + 4, ctl.y + 92);

      const sec = roomOf('security');
      const sl = lvl('security');
      P.cctv(c, sec.x + 10, sec.y + 0, t, sl !== 'ok');
      P.gate(c, sec.x + 102, sec.y + 0, sl === 'crit');
      P.desk(c, sec.x + 20, sec.y + 70, 34, sl === 'ok' ? '#24475e' : '#5a1f27');
      // papel "voando" quando um arquivo de configuração muda
      const ev = dataRef.current.lastSecurity;
      if (ev?.type === 'config_alterada' && Date.now() - ev.ts < 10_000) {
        const k = ((Date.now() - ev.ts) % 2000) / 2000;
        const px = sec.x + 60 - k * 25;
        const py = sec.y + 40 + k * 28 - Math.sin(k * Math.PI) * 14;
        P.r(c, px, py, 7, 9, '#f8f9fa');
        P.r(c, px + 1, py + 2, 5, 1, '#adb5bd');
        P.r(c, px + 1, py + 4, 4, 1, '#adb5bd');
        P.r(c, px + 1, py + 6, 5, 1, '#ff4d5e');
      }
      P.plant(c, sec.x + 4, sec.y + 92);
    }

    function effects(dt: number, t: number) {
      // pacotes HTTP entrando pelo portal "Internet" em direção aos racks
      const web = roomOf('web');
      const wm = m('web');
      if (!isDown('web') && Math.random() < Math.min((wm.rps ?? 0) / 120, 1.5) * dt * 10) {
        const err = Math.random() * 100 < (wm.error_rate ?? 0);
        packets.push({ x: web.x + 8, y: web.y + 52 + Math.random() * 22, tx: web.x + 34 + Math.floor(Math.random() * 4) * 22, ty: web.y + 38, color: err ? '#ff4d5e' : '#7cf2b5', life: 1 });
      }
      // consultas DNS saindo do globo para as estantes
      const dns = roomOf('dns');
      const dm = m('dns');
      if (Math.random() < Math.min((dm.qps ?? 0) / 20, 1) * dt * 6) {
        const fail = Math.random() * 100 < (dm.failure_rate ?? 0);
        packets.push({ x: dns.x + 63, y: dns.y + 58, tx: dns.x + 20 + Math.random() * 90, ty: dns.y + 28, color: fail ? '#ff4d5e' : '#ffe066', life: 1 });
      }
      // e-mails saindo pela caixa de correio
      const smtp = roomOf('smtp');
      const sm = m('smtp');
      if (Math.random() < Math.min((sm.emails_per_min ?? 0) / 60, 1.2) * dt * 3) {
        packets.push({ x: smtp.x + 40, y: smtp.y + 30, tx: smtp.x + 124, ty: smtp.y + 44, color: '#f1ece0', life: 1 });
      }
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        const dx = p.tx - p.x, dy = p.ty - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 2) { packets.splice(i, 1); continue; }
        const sp = 70 * dt;
        p.x += (dx / d) * sp;
        p.y += (dy / d) * sp;
        P.r(c, p.x, p.y, 2, 2, p.color);
      }
      if (packets.length > 300) packets.splice(0, packets.length - 300);

      // DDoS: insetos (bots) invadindo a sala Web
      const z = wm.anomaly_z ?? 0;
      const wanted = z > 2 ? Math.min(Math.round(z * 4), 60) : 0;
      while (bugs.length < wanted) bugs.push({ x: web.x + 6, y: web.y + 50 + Math.random() * 24, vx: 20 + Math.random() * 40, vy: (Math.random() - 0.5) * 40 });
      if (bugs.length > wanted) bugs.splice(0, Math.max(1, Math.floor((bugs.length - wanted) / 10)));
      for (const b of bugs) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < web.x + 8 || b.x > web.x + web.w - 10) b.vx *= -1;
        if (b.y < web.y + WALL_H + 2 || b.y > web.y + web.h - 8) b.vy *= -1;
        if (Math.random() < 0.02) b.vy = (Math.random() - 0.5) * 50;
        P.bug(c, b.x, b.y, t);
      }

      // fumaça nas salas fora do ar
      for (const room of ROOMS) {
        if (['web', 'database', 'dns', 'smtp'].includes(room.id) && isDown(room.id) && Math.random() < dt * 8)
          smoke.push({ x: room.x + 20 + Math.random() * (room.w - 40), y: room.y + 40, life: 1 });
      }
      for (let i = smoke.length - 1; i >= 0; i--) {
        const s = smoke[i];
        s.life -= dt * 0.5;
        s.y -= dt * 10;
        s.x += Math.sin(t * 3 + i) * dt * 4;
        if (s.life <= 0) { smoke.splice(i, 1); continue; }
        c.fillStyle = `rgba(160,160,170,${s.life * 0.5})`;
        c.fillRect(Math.round(s.x), Math.round(s.y), 4, 4);
      }
    }

    function overlays(t: number) {
      for (const room of ROOMS) {
        const svc = room.id === 'control' ? null : room.id;
        const level = svc ? lvl(svc) : 'ok';
        const down = svc && isDown(svc);
        if (down) {
          c.fillStyle = 'rgba(5,6,12,0.55)';
          c.fillRect(room.x, room.y, room.w, room.h);
        }
        if (level !== 'ok') {
          const speed = level === 'crit' ? 8 : 3;
          const a = (Math.sin(t * speed) + 1) / 2;
          c.fillStyle = level === 'crit' ? `rgba(255,40,60,${0.08 + a * 0.16})` : `rgba(244,197,66,${0.04 + a * 0.1})`;
          c.fillRect(room.x, room.y, room.w, room.h);
          // sirene no topo da sala
          const sx = room.x + room.w / 2 - 3;
          P.r(c, sx - 1, room.y + 2, 8, 2, '#222');
          P.r(c, sx, room.y + 4, 6, 4, a > 0.5 ? LEVEL_COLOR[level] : '#552');
          if (level === 'crit') {
            const ang = t * 6;
            c.fillStyle = 'rgba(255,60,70,0.18)';
            c.beginPath();
            c.moveTo(sx + 3, room.y + 6);
            c.lineTo(sx + 3 + Math.cos(ang - 0.3) * 80, room.y + 6 + Math.abs(Math.sin(ang - 0.3)) * 80);
            c.lineTo(sx + 3 + Math.cos(ang + 0.3) * 80, room.y + 6 + Math.abs(Math.sin(ang + 0.3)) * 80);
            c.closePath();
            c.fill();
          }
        }
        if (hoverRef.current === room.id) {
          c.strokeStyle = '#ffffff';
          c.lineWidth = 1;
          c.strokeRect(room.x + 2.5, room.y + 2.5, room.w - 5, room.h - 5);
        }
      }
    }

    function updateActors(dt: number, t: number, extra: Actor[]) {
      const all = [...actors, ...extra];
      all.sort((a, b) => a.y - b.y);
      for (const a of all) {
        const svc = a.room === 'control' ? null : a.room;
        const level: Level = svc ? lvl(svc) : dataRef.current.activeAlerts ? 'warn' : 'ok';
        const speed = level === 'crit' ? 34 : level === 'warn' ? 18 : 10;
        if (!a.id.startsWith('atk')) {
          if (a.wait > 0) {
            a.wait -= dt;
            a.frame = 0;
          } else {
            const dx = a.tx - a.x, dy = a.ty - a.y;
            const d = Math.hypot(dx, dy);
            if (d < 1) {
              a.wait = level === 'crit' ? 0.2 + Math.random() * 0.4 : 1 + Math.random() * 3;
              const s = randomSpot(roomOf(a.room));
              a.tx = s.x;
              a.ty = s.y;
            } else {
              a.x += (dx / d) * speed * dt;
              a.y += (dy / d) * speed * dt;
              a.flip = dx < 0;
              a.anim += dt * (speed / 4);
              a.frame = 1 + (Math.floor(a.anim) % 2);
            }
          }
        }
        P.drawPerson(c, a.x, a.y, a.look, a.frame, a.flip);
        if (!a.id.startsWith('atk') && level !== 'ok' && Math.sin(t * (level === 'crit' ? 12 : 5)) > -0.2) P.drawBadge(c, a.x + 1.5, a.y - 10, LEVEL_COLOR[level]);
        const el = bubbles.current[a.id];
        if (el) {
          el.style.left = `${((a.x + 4) / W) * 100}%`;
          el.style.top = `${((a.y - (level !== 'ok' ? 11 : 2)) / H) * 100}%`;
        }
      }
    }

    // atacantes de força bruta na porta da guarita
    const attackers: Actor[] = [];
    function syncAttackers(t: number) {
      const sec = roomOf('security');
      const fails = m('security').failed_logins_5min ?? 0;
      const wanted = Math.min(Math.ceil(fails / 3), 8);
      while (attackers.length < wanted) {
        const k = attackers.length;
        attackers.push({ id: `atk${k}`, room: 'security', x: sec.x + 92 + (k % 4) * 9, y: sec.y + 32 + Math.floor(k / 4) * 12, tx: 0, ty: 0, wait: 0, look: { hair: '#1d1d26', skin: '#6b6b7a', shirt: '#2a2a35', pants: '#15151c', hood: true }, frame: 0, flip: k % 2 === 0, anim: 0 });
      }
      attackers.length = wanted;
      attackers.forEach((a, k) => { a.frame = Math.sin(t * 8 + k) > 0 ? 1 : 2; });
    }

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const t = now / 1000;
      c.clearRect(0, 0, W, H);
      for (const room of ROOMS) drawRoom(room, t);
      furniture(t);
      effects(dt, t);
      syncAttackers(t);
      updateActors(dt, t, attackers);
      overlays(t);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toLogical = (e: React.MouseEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  };
  const pick = (e: React.MouseEvent) => {
    const { x, y } = toLogical(e);
    return ROOMS.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)?.id ?? null;
  };

  const lm = (s: string) => data.latest[s]?.metrics ?? {};
  const bubbleText: Record<string, string> = {
    web: SERVICES.web.headline(lm('web')),
    database: SERVICES.database.headline(lm('database')),
    dns: SERVICES.dns.headline(lm('dns')),
    smtp: SERVICES.smtp.headline(lm('smtp')),
    security: (() => {
      const f = lm('security').failed_logins_5min ?? 0;
      const ev = data.lastSecurity;
      if (ev?.type === 'config_alterada' && Date.now() - ev.ts < 15000) return `Config alterada: ${ev.source}!`;
      if (f > 0) return `${f} logins falhos em 5 min`;
      return 'Perímetro seguro';
    })(),
    control: data.activeAlerts ? `${data.activeAlerts} alerta(s) ativo(s)!` : 'Tudo verde por aqui',
  };

  return (
    <div className="map-wrap">
      <canvas
        ref={canvas}
        width={W}
        height={H}
        className="map-canvas"
        style={{ cursor: hover ? 'pointer' : 'default' }}
        onMouseMove={(e) => setHover(pick(e))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => { const id = pick(e); if (id) onSelect(id); }}
        role="img"
        aria-label="Mapa do data center com o estado de cada serviço"
      />
      {ROOMS.map((room) => {
        const st = room.id === 'control' ? (data.activeAlerts ? 'warn' : 'ok') : data.statuses[room.id] ?? 'ok';
        return (
          <button
            key={room.id}
            className={`room-label lvl-${st}`}
            style={{ left: `${((room.x + 4) / W) * 100}%`, top: `${((room.y + room.h - 12) / H) * 100}%` }}
            onClick={() => onSelect(room.id)}
            data-testid={`room-${room.id}`}
          >
            <span className="dot" /> <span className="long">{room.label}</span><span className="short">{room.label.split(' · ')[1]}</span>
          </button>
        );
      })}
      {Object.entries(bubbleText).map(([id, text]) => (
        <div key={id} ref={(el) => { bubbles.current[id] = el; }} className={`bubble lvl-${id === 'control' ? (data.activeAlerts ? 'warn' : 'ok') : data.statuses[id] ?? 'ok'}`}>
          {text}
        </div>
      ))}
    </div>
  );
}
