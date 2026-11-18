import { useEffect, useState } from 'react';
import { api, type Rule } from '../api';
import { METRIC_LABEL } from '../meta';

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { api<Rule[]>('/rules').then(setRules); }, []);

  const edit = (i: number, k: keyof Rule, v: string) =>
    setRules((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: k === 'op' || k === 'description' ? v : v === '' ? null : Number(v) } : r)));

  const save = async () => {
    try {
      setRules(await api<Rule[]>('/rules', { method: 'PUT', body: JSON.stringify(rules) }));
      setMsg('✔ Regras salvas e aplicadas imediatamente.');
    } catch (e: any) {
      setMsg('✖ ' + e.message);
    }
    setTimeout(() => setMsg(''), 4000);
  };

  return (
    <div className="page">
      <h1 className="page-title">⚙ Regras do Jogo (limiares de alerta)</h1>
      <p className="muted">Para cada métrica: limite <b className="warn">amarelo</b> (Atenção) e <b className="crit">vermelho</b> (Crítico). "Amostras" = quantas coletas seguidas (5 s cada) precisam violar o limite antes de disparar — evita alarme falso por pico isolado. A recuperação exige 2 amostras normais.</p>
      <section className="rpg-window">
        <div className="table-scroll">
          <table className="pixel-table rules">
            <thead><tr><th>Serviço</th><th>Métrica</th><th>Op.</th><th className="warn">Amarelo</th><th className="crit">Vermelho</th><th>Amostras</th><th>Descrição</th></tr></thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.id}>
                  <td>{r.service}</td>
                  <td title={r.metric}>{METRIC_LABEL[r.metric] ?? r.metric}</td>
                  <td>
                    <select value={r.op} onChange={(e) => edit(i, 'op', e.target.value)} aria-label="operador">
                      <option value=">">&gt;</option><option value="<">&lt;</option>
                    </select>
                  </td>
                  <td><input type="number" value={r.warn ?? ''} onChange={(e) => edit(i, 'warn', e.target.value)} aria-label={`amarelo ${r.id}`} /></td>
                  <td><input type="number" value={r.crit ?? ''} onChange={(e) => edit(i, 'crit', e.target.value)} aria-label={`vermelho ${r.id}`} /></td>
                  <td><input type="number" min={1} value={r.for} onChange={(e) => edit(i, 'for', e.target.value)} aria-label={`amostras ${r.id}`} /></td>
                  <td>{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row-between">
          <span>{msg}</span>
          <button className="btn primary" onClick={save}>Salvar regras</button>
        </div>
      </section>
    </div>
  );
}
