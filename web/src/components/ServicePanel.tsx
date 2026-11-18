import { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { api, type ServiceId } from '../api';
import { useStore } from '../store';
import { fmt, LEVEL_COLOR, LEVEL_LABEL, METRIC_LABEL, SERIES_COLORS, SERVICES, type ChartDef } from '../meta';

const RANGES = ['15m', '1h', '6h', '24h'];
const time = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function Chart({ def, points }: { def: ChartDef; points: any[] }) {
  const common = { data: points, margin: { top: 6, right: 8, bottom: 0, left: -18 } };
  const axes = [
    <CartesianGrid key="g" stroke="#2b3150" strokeDasharray="2 4" vertical={false} />,
    <XAxis key="x" dataKey="t" tickFormatter={(t) => time(t).slice(0, 5)} tick={{ fill: '#8f96b8', fontSize: 14 }} stroke="#3a4166" minTickGap={30} />,
    <YAxis key="y" tick={{ fill: '#8f96b8', fontSize: 14 }} stroke="#3a4166" width={56} />,
    <Tooltip key="tt" labelFormatter={(t) => time(Number(t))} formatter={(v: any, k: any) => [fmt(Number(v), def.unit), METRIC_LABEL[k] ?? k]} contentStyle={{ background: '#11131c', border: '2px solid #5ab0ff', fontFamily: 'VT323', fontSize: 16 }} />,
    def.keys.length > 1 ? <Legend key="l" formatter={(k) => METRIC_LABEL[k] ?? k} wrapperStyle={{ fontFamily: 'VT323', fontSize: 15 }} /> : null,
  ];
  return (
    <div className="chart pixel-box">
      <h4>{def.title}</h4>
      <ResponsiveContainer width="100%" height={150}>
        {def.kind === 'bar' ? (
          <BarChart {...common}>
            {axes}
            {def.keys.map((k, i) => <Bar key={k} dataKey={k} fill={SERIES_COLORS[i]} isAnimationActive={false} />)}
          </BarChart>
        ) : def.kind === 'area' ? (
          <AreaChart {...common}>
            {axes}
            {def.keys.map((k, i) => <Area key={k} dataKey={k} type="step" stroke={SERIES_COLORS[i]} fill={SERIES_COLORS[i]} fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} />)}
          </AreaChart>
        ) : (
          <LineChart {...common}>
            {axes}
            {def.keys.map((k, i) => <Line key={k} dataKey={k} type={def.kind === 'step' ? 'stepAfter' : 'linear'} stroke={SERIES_COLORS[i]} strokeWidth={2} dot={false} isAnimationActive={false} />)}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function Details({ service, details }: { service: ServiceId; details: any }) {
  if (!details) return null;
  if (service === 'web')
    return (
      <div className="pixel-box details">
        <h4>Alvos HTTP/HTTPS monitorados</h4>
        <table><tbody>
          <tr><td>loja-demo (health)</td><td className={details.health?.up ? 'ok' : 'crit'}>{details.health?.up ? 'UP' : 'DOWN'}</td><td>{details.health?.status || '-'}</td><td>{details.health?.ms} ms</td></tr>
          {details.external?.map((e: any) => (
            <tr key={e.url}><td>{e.url}</td><td className={e.up ? 'ok' : 'crit'}>{e.up ? 'UP' : 'DOWN'}</td><td>{e.status || e.error}</td><td>{e.ms} ms</td></tr>
          ))}
        </tbody></table>
        <h4>Códigos HTTP no último ciclo</h4>
        <div className="codes">{Object.entries(details.codes || {}).map(([k, v]) => <span key={k} className={Number(k) >= 500 ? 'crit' : Number(k) >= 400 ? 'warn' : 'ok'}>{k}: {String(v)}</span>)}</div>
      </div>
    );
  if (service === 'dns')
    return (
      <div className="pixel-box details">
        <h4>Servidores de nomes</h4>
        <table><tbody>{details.perServer?.map((s: any) => (
          <tr key={s.server}><td>{s.server}</td><td className={s.up ? 'ok' : 'crit'}>{s.up ? 'UP' : 'DOWN'}</td><td>{s.avg_ms ?? '-'} ms</td><td>{s.failures} falhas</td></tr>
        ))}</tbody></table>
        <h4>Amostra de resoluções (registro A)</h4>
        <table><tbody>{details.sample?.map((s: any, i: number) => (
          <tr key={i}><td>{s.name}</td><td>@{s.server}</td><td className={s.ok ? 'ok' : 'crit'}>{s.ok ? s.answer : s.error}</td><td>{s.ms} ms</td></tr>
        ))}</tbody></table>
      </div>
    );
  if (service === 'smtp')
    return (
      <div className="pixel-box details">
        <h4>Sonda SMTP real</h4>
        <p>{details.probe?.host}:{details.probe?.port} — {details.probe?.ok ? `220 + EHLO OK em ${details.probe.ms} ms` : `falhou (${details.probe?.error})`}</p>
        {details.probe?.extensions && <p className="muted">Extensões ESMTP: {details.probe.extensions.join(', ')}</p>}
        <p className="muted">Totais do MTA de demonstração: {details.totals?.delivered} entregues de {details.totals?.attempted} tentativas</p>
      </div>
    );
  return (
    <div className="pixel-box details">
      <h4>Instância</h4>
      <p>Motor: {details.engine} · arquivo {details.file} · pool máximo {details.pool_size} conexões</p>
    </div>
  );
}

export default function ServicePanel({ service, onClose }: { service: ServiceId; onClose: () => void }) {
  const meta = SERVICES[service];
  const { latest, statuses, uptime, activeAlerts } = useStore();
  const [range, setRange] = useState('15m');
  const [points, setPoints] = useState<any[]>([]);
  const level = statuses[service] ?? 'ok';
  const m = latest[service]?.metrics ?? {};

  useEffect(() => {
    let alive = true;
    const load = () => api(`/services/${service}/series?range=${range}`).then((r) => alive && setPoints(r.points)).catch(() => {});
    load();
    const t = setInterval(load, range === '15m' ? 5000 : 30000);
    return () => { alive = false; clearInterval(t); };
  }, [service, range]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const alerts = activeAlerts.filter((a) => a.service === service);

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <section className="rpg-window panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={meta.name}>
        <header className="panel-head">
          <div>
            <div className="eyebrow">{meta.room} · operador {meta.operator}</div>
            <h2>{meta.name}</h2>
            <div className="muted">{meta.protocol}</div>
          </div>
          <div className="panel-status" style={{ color: LEVEL_COLOR[level] }}>
            <span className="dot" style={{ background: LEVEL_COLOR[level] }} /> {LEVEL_LABEL[level]}
            <div className="muted">uptime 1h: {uptime[service] ?? '—'}%</div>
          </div>
          <button className="btn icon" onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        <div className="tiles">
          {meta.tiles.map((t) => (
            <div key={t.key} className="tile pixel-box">
              <div className="tile-label">{t.label}</div>
              <div className="tile-value">{t.key === 'up' ? (m.up === 0 ? <span className="crit">DOWN</span> : <span className="ok">UP</span>) : fmt(m[t.key], t.unit)}</div>
            </div>
          ))}
        </div>

        {alerts.length > 0 && (
          <div className="pixel-box alert-strip">
            {alerts.map((a) => <div key={a.id} className={a.level}>⚠ {a.message}</div>)}
          </div>
        )}

        <div className="range">
          {RANGES.map((r) => <button key={r} className={`btn small ${r === range ? 'active' : ''}`} onClick={() => setRange(r)}>{r}</button>)}
        </div>

        <div className="charts">
          {meta.charts.map((c) => <Chart key={c.title} def={c} points={points} />)}
        </div>
        <Details service={service} details={latest[service]?.details} />
      </section>
    </div>
  );
}
