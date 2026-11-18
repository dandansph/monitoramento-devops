import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, openSocket, type Alert, type Level, type Scenario, type SecurityEvent, type Snapshot } from './api';
import { playAlarm } from './sound';

type LogEntry = { id: string; ts: number; level: Level; text: string; kind: 'alert' | 'security' | 'info' };

type Store = {
  latest: Record<string, Snapshot>;
  statuses: Record<string, Level>;
  uptime: Record<string, number | null>;
  activeAlerts: Alert[];
  scenarios: Scenario[];
  log: LogEntry[];
  lastSecurity: SecurityEvent | null;
  mail: string;
  connected: boolean;
  refresh: () => void;
};

const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

const SEC_LABEL: Record<string, string> = {
  ddos_suspeito: 'Tráfego anômalo — possível DDoS',
  login_falho: 'Login falho',
  config_alterada: 'Configuração alterada',
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [latest, setLatest] = useState<Record<string, Snapshot>>({});
  const [statuses, setStatuses] = useState<Record<string, Level>>({});
  const [uptime, setUptime] = useState<Record<string, number | null>>({});
  const [activeAlerts, setActive] = useState<Alert[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [lastSecurity, setLastSecurity] = useState<SecurityEvent | null>(null);
  const [mail, setMail] = useState('');
  const [connected, setConnected] = useState(false);
  const seen = useRef(new Map<number, string>());

  const push = (e: LogEntry) => setLog((l) => [e, ...l].slice(0, 80));

  const refresh = () =>
    api('/overview').then((o) => {
      setLatest(o.latest); setStatuses(o.statuses); setUptime(o.uptime); setActive(o.activeAlerts);
      setScenarios(o.scenarios); setMail(o.mail);
      o.activeAlerts.forEach((a: Alert) => seen.current.set(a.id, a.level));
    }).catch(() => {});

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    const close = openSocket((msg) => {
      setConnected(true);
      if (msg.type === 'metrics') setLatest((p) => ({ ...p, [msg.service]: { ts: msg.ts, metrics: msg.metrics, details: msg.details } }));
      if (msg.type === 'status') setStatuses(msg.statuses);
      if (msg.type === 'alert') {
        const a: Alert = msg.alert;
        setActive((list) => {
          const rest = list.filter((x) => x.id !== a.id);
          return a.resolved_at ? rest : [a, ...rest];
        });
        const key = `${a.resolved_at ? 'r' : a.level}`;
        if (seen.current.get(a.id) !== key) {
          seen.current.set(a.id, key);
          push({ id: `a${a.id}${key}`, ts: Date.now(), kind: 'alert', level: a.resolved_at ? 'ok' : a.level, text: `${a.resolved_at ? 'RESOLVIDO' : a.level === 'crit' ? 'CRÍTICO' : 'ATENÇÃO'} · ${a.service.toUpperCase()} · ${a.message}` });
          if (!a.resolved_at && a.level === 'crit') playAlarm();
        }
      }
      if (msg.type === 'security') {
        const e: SecurityEvent = msg.event;
        setLastSecurity(e);
        const d = e.details || {};
        const extra = e.type === 'login_falho' ? ` de ${e.source} (usuário "${d.usuario}")${d.bloqueado ? ' — IP BLOQUEADO' : ''}` : e.type === 'config_alterada' ? `: ${e.source}` : ` (${d.rps} req/s, z=${d.z})`;
        push({ id: `s${e.id}`, ts: e.ts, kind: 'security', level: e.severity, text: `${SEC_LABEL[e.type] || e.type}${extra}` });
      }
      if (msg.type === 'scenario') {
        refresh();
        push({ id: `c${Date.now()}`, ts: Date.now(), kind: 'info', level: 'ok', text: `Cenário "${msg.scenario.name}" ${msg.scenario.action === 'start' ? 'iniciado' : 'encerrado'}` });
      }
    });
    return () => { clearInterval(t); close(); };
  }, []);

  return (
    <Ctx.Provider value={{ latest, statuses, uptime, activeAlerts, scenarios, log, lastSecurity, mail, connected, refresh }}>
      {children}
    </Ctx.Provider>
  );
}
