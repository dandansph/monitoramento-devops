import { useEffect, useState } from 'react';
import { api } from '../api';
import { useStore } from '../store';
import { LEVEL_COLOR } from '../meta';

const TYPE: Record<string, string> = { ddos_suspeito: 'Tráfego anômalo (DDoS?)', login_falho: 'Login falho', config_alterada: 'Configuração alterada' };

export default function SecurityPage() {
  const { lastSecurity, latest, statuses } = useStore();
  const [data, setData] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const load = () => api('/security').then(setData).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [lastSecurity]);

  if (!data) return <div className="page">Carregando...</div>;
  const an = latest.web?.details?.anomaly;
  const rescan = async () => { setScanning(true); await api('/security/vulns/scan', { method: 'POST' }).catch(() => {}); setScanning(false); load(); };

  return (
    <div className="page">
      <h1 className="page-title">⛨ Guarita de Segurança <span className="chip" style={{ background: LEVEL_COLOR[statuses.security ?? 'ok'] }}>{(statuses.security ?? 'ok').toUpperCase()}</span></h1>

      <div className="grid-2">
        <section className="rpg-window">
          <h3>Anomalias de tráfego (DDoS)</h3>
          <p className="muted">Linha de base por média móvel das últimas coletas de RPS; alerta quando o z-score passa de 3 (amarelo) ou 6 (vermelho). Pontos anômalos não entram na média.</p>
          <div className="tiles">
            <div className="tile pixel-box"><div className="tile-label">RPS atual</div><div className="tile-value">{latest.web?.metrics?.rps ?? '—'}</div></div>
            <div className="tile pixel-box"><div className="tile-label">Média normal</div><div className="tile-value">{an?.mean ?? '—'}</div></div>
            <div className="tile pixel-box"><div className="tile-label">Desvio</div><div className="tile-value">{an?.std ?? '—'}</div></div>
            <div className="tile pixel-box"><div className="tile-label">z-score</div><div className={`tile-value ${an?.z > 6 ? 'crit' : an?.z > 3 ? 'warn' : 'ok'}`}>{an?.learning ? 'aprendendo' : an?.z ?? '—'}</div></div>
          </div>
        </section>

        <section className="rpg-window">
          <h3>Falhas de autenticação (força bruta)</h3>
          <p className="muted">Janela de 5 min. 5 falhas do mesmo IP = bloqueio por 10 min. Total na janela: <b>{data.bruteForce.total}</b></p>
          <div className="table-scroll small">
            <table className="pixel-table">
              <thead><tr><th>IP</th><th>Falhas</th><th>Situação</th></tr></thead>
              <tbody>
                {data.bruteForce.byIp.map((r: any) => <tr key={r.ip}><td>{r.ip}</td><td>{r.count}</td><td className={r.blocked ? 'crit' : 'warn'}>{r.blocked ? 'BLOQUEADO' : 'observando'}</td></tr>)}
                {data.bruteForce.byIp.length === 0 && <tr><td colSpan={3} className="ok">Nenhuma falha recente</td></tr>}
              </tbody>
            </table>
          </div>
          {data.bruteForce.byUser.length > 0 && <p className="muted">Contas visadas: {data.bruteForce.byUser.map((u: any) => `${u.user} (${u.count})`).join(', ')}</p>}
        </section>

        <section className="rpg-window">
          <h3>Integridade de configuração</h3>
          <p className="muted">Hash SHA-256 de cada arquivo verificado a cada 3 s; mudança gera alerta e diff.</p>
          <table className="pixel-table">
            <thead><tr><th>Arquivo</th><th>Hash atual</th><th>Linha de base em</th></tr></thead>
            <tbody>{data.configBaselines.map((f: any) => <tr key={f.file}><td>{f.file}</td><td><code>{f.hash}</code></td><td>{new Date(f.ts).toLocaleString('pt-BR')}</td></tr>)}</tbody>
          </table>
        </section>

        <section className="rpg-window">
          <div className="row-between">
            <h3>Vulnerabilidades conhecidas por serviço</h3>
            <button className="btn small" onClick={rescan} disabled={scanning}>{scanning ? 'Consultando...' : 'Reverificar'}</button>
          </div>
          <p className="muted">Fonte: {data.vulns.source}{data.vulns.checkedAt ? ` · ${new Date(data.vulns.checkedAt).toLocaleString('pt-BR')}` : ''}</p>
          {data.vulns.items.map((it: any) => (
            <details key={it.service + it.name} className="vuln pixel-box">
              <summary>
                <b>{it.service}</b> · {it.software} <span className="muted">{it.version}</span>
                <span className={`chip ${it.count ? (it.count > 3 ? 'crit' : 'warn') : 'ok'}`}>{it.count ?? '?'} avisos</span>
              </summary>
              <ul>
                {it.advisories.map((a: any) => (
                  <li key={a.id}><a href={a.url} target="_blank" rel="noreferrer">{a.id}</a> {a.summary} {a.cves?.length ? <span className="muted">({a.cves.slice(0, 3).join(', ')})</span> : null} {a.fixed && <span className="ok">corrigido em {a.fixed}</span>}</li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      </div>

      <section className="rpg-window">
        <h3>Eventos de segurança</h3>
        <div className="table-scroll">
          <table className="pixel-table">
            <thead><tr><th>Horário</th><th>Tipo</th><th>Severidade</th><th>Origem</th><th>Detalhes</th></tr></thead>
            <tbody>
              {data.events.map((e: any) => (
                <tr key={e.id}>
                  <td>{new Date(e.ts).toLocaleTimeString('pt-BR')}</td><td>{TYPE[e.type] ?? e.type}</td>
                  <td><span className={`chip ${e.severity}`}>{e.severity}</span></td><td>{e.source}</td>
                  <td className="mono">{e.type === 'config_alterada' ? (e.details.diff || []).join('  ') : Object.entries(e.details).map(([k, v]) => `${k}=${v}`).join(' ')}</td>
                </tr>
              ))}
              {data.events.length === 0 && <tr><td colSpan={5} className="muted">Nenhum evento ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
