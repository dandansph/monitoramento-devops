import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { setToken } from '../api';
import { useStore } from '../store';
import { LEVEL_COLOR, SERVICES } from '../meta';
import { isMuted, setMuted } from '../sound';

const NAV = [
  { to: '/', label: 'Mapa', icon: '▦' },
  { to: '/alertas', label: 'Missões', icon: '⚔' },
  { to: '/seguranca', label: 'Segurança', icon: '⛨' },
  { to: '/regras', label: 'Regras', icon: '⚙' },
  { to: '/simulador', label: 'Simulador', icon: '⚡' },
];

export default function Layout() {
  const { statuses, uptime, activeAlerts, connected, mail } = useStore();
  const [muted, setM] = useState(isMuted());
  const [now, setNow] = useState(new Date());
  const nav = useNavigate();
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const crit = activeAlerts.filter((a) => a.level === 'crit').length;

  return (
    <div className="app">
      <header className="hud">
        <div className="brand">
          <span className="logo">▣</span> PIXEL<span className="accent">NOC</span>
        </div>
        <div className="hp-bars">
          {(['web', 'database', 'dns', 'smtp'] as const).map((s) => {
            const up = uptime[s] ?? 100;
            const lvl = statuses[s] ?? 'ok';
            return (
              <div key={s} className="hp" title={`${SERVICES[s].name}: uptime 1h ${up}%`}>
                <span className="hp-name">{SERVICES[s].name.split(' ')[0].toUpperCase()}</span>
                <span className="hp-track"><span className="hp-fill" style={{ width: `${up}%`, background: LEVEL_COLOR[lvl] }} /></span>
              </div>
            );
          })}
        </div>
        <div className="hud-right">
          <span className={`quest ${crit ? 'crit' : activeAlerts.length ? 'warn' : ''}`} title="Alertas ativos">⚔ {activeAlerts.length}</span>
          <span className={`net ${connected ? 'ok' : 'crit'}`} title={connected ? 'Tempo real conectado' : 'Reconectando'}>● {connected ? 'AO VIVO' : 'OFF'}</span>
          <span className="clock">{now.toLocaleTimeString('pt-BR')}</span>
          <button className="btn icon" onClick={() => { setMuted(!muted); setM(!muted); }} title={muted ? 'Ativar som de alarme' : 'Silenciar'}>{muted ? '🔇' : '🔊'}</button>
          <button className="btn small" onClick={() => { setToken(null); nav('/login'); }}>Sair</button>
        </div>
      </header>
      <nav className="tabs">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            <span aria-hidden>{n.icon}</span> {n.label}
          </NavLink>
        ))}
        <span className="mail-mode muted">e-mail: {mail || '...'}</span>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
