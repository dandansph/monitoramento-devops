import { useNavigate, useSearchParams } from 'react-router-dom';
import OfficeMap from '../game/OfficeMap';
import ServicePanel from '../components/ServicePanel';
import { useStore } from '../store';
import { fmt, LEVEL_COLOR, SERVICES } from '../meta';
import type { ServiceId } from '../api';

export default function MapPage() {
  const store = useStore();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const sala = params.get('sala') as ServiceId | null;

  const select = (id: string) => {
    if (id === 'security') nav('/seguranca');
    else if (id === 'control') nav('/alertas');
    else setParams({ sala: id });
  };

  return (
    <div className="map-page">
      <div className="map-col">
        <OfficeMap
          data={{ latest: store.latest, statuses: store.statuses, activeAlerts: store.activeAlerts.length, lastSecurity: store.lastSecurity }}
          onSelect={select}
        />
        <div className="summary">
          {(Object.keys(SERVICES) as ServiceId[]).map((s) => {
            const m = store.latest[s]?.metrics ?? {};
            const lvl = store.statuses[s] ?? 'ok';
            const t = SERVICES[s].tiles;
            return (
              <button key={s} className="pixel-box svc-card" style={{ borderColor: LEVEL_COLOR[lvl] }} onClick={() => select(s)} data-testid={`card-${s}`}>
                <div className="svc-card-head">
                  <span className="dot" style={{ background: LEVEL_COLOR[lvl] }} />
                  <b>{SERVICES[s].name}</b>
                  <span className={`chip ${m.up === 0 ? 'crit' : 'ok'}`}>{m.up === 0 ? 'DOWN' : 'UP'}</span>
                </div>
                <div className="svc-card-metrics">
                  {t.slice(1, 4).map((x) => (
                    <div key={x.key}><span className="muted">{x.label}</span> {fmt(m[x.key], x.unit)}</div>
                  ))}
                  <div><span className="muted">Uptime 1h</span> {store.uptime[s] ?? '—'}%</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <aside className="game-log rpg-window">
        <h3>Log da partida</h3>
        {store.log.length === 0 && <p className="muted">Aguardando eventos... dispare um cenário no Simulador.</p>}
        <ul>
          {store.log.map((e) => (
            <li key={e.id} className={`lvl-${e.level}`}>
              <span className="muted">{new Date(e.ts).toLocaleTimeString('pt-BR')}</span> {e.text}
            </li>
          ))}
        </ul>
      </aside>
      {sala && SERVICES[sala] && <ServicePanel service={sala} onClose={() => setParams({})} />}
    </div>
  );
}
