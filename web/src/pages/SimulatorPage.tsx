import { useEffect, useState } from 'react';
import { api } from '../api';
import { useStore } from '../store';

const ICON: Record<string, string> = { ddos: '🐛', 'web-down': '💥', 'web-erros': '🔥', 'db-lento': '⌛', 'dns-falha': '❓', 'smtp-fila': '✉', bruteforce: '🔓', 'config-change': '📝' };
const EXPECT: Record<string, string> = {
  ddos: 'Insetos invadem a sala Web, RPS e z-score disparam → alerta de anomalia (DDoS) e RPS alto.',
  'web-down': 'Sala Web apaga e solta fumaça; health check falha → Nível 3 + e-mail imediato.',
  'web-erros': 'Pacotes vermelhos; taxa de erro e 5xx sobem → Atenção/Crítico.',
  'db-lento': 'Ampulhetas sobre os discos, slow queries, rollbacks e CPU sobem.',
  'dns-falha': 'Servidor DNS 192.0.2.53 não responde + nome inexistente → falhas de resolução.',
  'smtp-fila': 'Pilha de envelopes cresce, taxa de entrega cai, rejeições e timeouts.',
  bruteforce: 'Encapuzados na porta da guarita; IPs bloqueados após 5 falhas.',
  'config-change': 'Altera nginx.conf (server_tokens). Clique de novo para reverter. Papel voa até o guarda.',
};

export default function SimulatorPage() {
  const { scenarios, refresh } = useStore();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState('');
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const start = async (name: string) => { setBusy(name); await api(`/sim/${name}`, { method: 'POST', body: '{}' }).catch(() => {}); setBusy(''); refresh(); };
  const stop = async (name: string) => { await api(`/sim/${name}`, { method: 'DELETE' }); refresh(); };

  return (
    <div className="page">
      <h1 className="page-title">⚡ Simulador de Incidentes</h1>
      <p className="muted">Use durante a apresentação para provocar falhas e ataques reais/simulados e ver o mapa, os alertas e os e-mails reagirem. Os cenários terminam sozinhos.</p>
      <div className="sim-grid">
        {scenarios.map((s) => {
          const left = s.until ? Math.max(0, Math.round((s.until - now) / 1000)) : 0;
          return (
            <div key={s.name} className={`rpg-window sim-card ${s.active ? 'active' : ''}`}>
              <div className="sim-icon" aria-hidden>{ICON[s.name]}</div>
              <h3>{s.label}</h3>
              <p className="muted">{EXPECT[s.name]}</p>
              <div className="row-between">
                <span className="muted">{s.active ? `ativo · ${left}s` : s.defaultSec ? `${s.defaultSec}s` : 'instantâneo'}</span>
                {s.active ? (
                  <button className="btn danger" onClick={() => stop(s.name)}>Parar</button>
                ) : (
                  <button className="btn primary" disabled={busy === s.name} onClick={() => start(s.name)} data-testid={`sim-${s.name}`}>Disparar</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
