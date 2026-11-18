import { useEffect, useState } from 'react';
import { api, type Alert } from '../api';
import { useStore } from '../store';
import { LEVEL_COLOR } from '../meta';

const dt = (t: number | null) => (t ? new Date(t).toLocaleString('pt-BR') : '—');
const dur = (a: Alert) => {
  const s = Math.round(((a.resolved_at ?? Date.now()) - a.started_at) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
};

export default function AlertsPage() {
  const { activeAlerts } = useStore();
  const [all, setAll] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'todos' | 'crit' | 'warn'>('todos');

  const load = () => api<Alert[]>('/alerts').then(setAll).catch(() => {});
  useEffect(() => { load(); }, [activeAlerts]);

  const ack = async (id: number) => { await api(`/alerts/${id}/ack`, { method: 'POST' }); load(); };
  const history = all.filter((a) => a.resolved_at && (filter === 'todos' || a.level === filter));

  return (
    <div className="page">
      <h1 className="page-title">⚔ Quadro de Missões</h1>
      <p className="muted">Cada alerta é uma missão. <b className="warn">Nível 2 (amarelo)</b> = degradação, notificação por e-mail agrupada. <b className="crit">Nível 3 (vermelho)</b> = crítico, e-mail imediato.</p>

      <section className="rpg-window">
        <h3>Missões ativas ({activeAlerts.length})</h3>
        {activeAlerts.length === 0 && <p className="ok">Nenhuma missão ativa. Todos os serviços em Nível 1 (verde).</p>}
        <div className="quest-list">
          {activeAlerts.map((a) => (
            <div key={a.id} className="quest-card pixel-box" style={{ borderColor: LEVEL_COLOR[a.level] }} data-testid="active-alert">
              <div className="quest-head">
                <span className={`chip ${a.level}`}>{a.level === 'crit' ? 'CRÍTICO' : 'ATENÇÃO'}</span>
                <b>{a.service.toUpperCase()}</b> <span className="muted">· {a.rule_id}</span>
                <span className="muted right">há {dur(a)}</span>
              </div>
              <div>{a.message}</div>
              <div className="quest-foot">
                <span className="muted">início {dt(a.started_at)}</span>
                {a.email_preview ? (
                  a.email_preview.startsWith('http') ? <a href={a.email_preview} target="_blank" rel="noreferrer">✉ ver e-mail enviado</a> : <span className="muted">✉ {a.email_preview}</span>
                ) : <span className="muted">✉ {a.level === 'warn' ? 'na fila do resumo (60 s)' : 'enviando...'}</span>}
                <button className="btn small" disabled={!!a.acknowledged} onClick={() => ack(a.id)}>{a.acknowledged ? 'Reconhecido' : 'Reconhecer'}</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rpg-window">
        <div className="row-between">
          <h3>Histórico</h3>
          <div className="range">
            {(['todos', 'crit', 'warn'] as const).map((f) => <button key={f} className={`btn small ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f === 'todos' ? 'Todos' : f === 'crit' ? 'Críticos' : 'Atenção'}</button>)}
          </div>
        </div>
        <div className="table-scroll">
          <table className="pixel-table">
            <thead><tr><th>Nível</th><th>Serviço</th><th>Mensagem</th><th>Início</th><th>Resolvido</th><th>Duração</th><th>E-mail</th></tr></thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id}>
                  <td><span className={`chip ${a.level}`}>{a.level === 'crit' ? 'CRIT' : 'WARN'}</span></td>
                  <td>{a.service}</td><td>{a.message}</td><td>{dt(a.started_at)}</td><td>{dt(a.resolved_at)}</td><td>{dur(a)}</td>
                  <td>{a.email_preview?.startsWith('http') ? <a href={a.email_preview} target="_blank" rel="noreferrer">ver</a> : a.email_preview ? '✓' : '—'}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={7} className="muted">Sem histórico ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
