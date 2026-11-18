import type { Level, ServiceId } from './api';

export const LEVEL_COLOR: Record<Level, string> = { ok: '#5dd39e', warn: '#f4c542', crit: '#ff4d5e' };
export const LEVEL_LABEL: Record<Level, string> = { ok: 'Nível 1 · OK', warn: 'Nível 2 · Atenção', crit: 'Nível 3 · Crítico' };

export type ChartDef = { title: string; keys: string[]; kind?: 'line' | 'area' | 'bar' | 'step'; unit?: string };

export const SERVICES: Record<ServiceId, {
  name: string; room: string; operator: string; protocol: string; headline: (m: Record<string, number>) => string;
  tiles: { key: string; label: string; unit?: string }[]; charts: ChartDef[];
}> = {
  web: {
    name: 'Web Server', room: 'Sala dos Servidores', operator: 'Ana (Web)', protocol: 'HTTP/HTTPS · TCP 80/443',
    headline: (m) => (m.up === 0 ? 'Caiu! Sem resposta HTTP' : `${m.rps ?? '-'} req/s · ${m.latency_ms ?? '-'} ms`),
    tiles: [
      { key: 'up', label: 'Status' }, { key: 'rps', label: 'Req/s' }, { key: 'latency_ms', label: 'Latência', unit: 'ms' },
      { key: 'error_rate', label: 'Erros', unit: '%' }, { key: 'active_connections', label: 'Conexões' }, { key: 'ext_latency_ms', label: 'Sites externos', unit: 'ms' },
    ],
    charts: [
      { title: 'Disponibilidade (UP=1 / DOWN=0)', keys: ['up'], kind: 'step' },
      { title: 'Requests por segundo (RPS)', keys: ['rps'], kind: 'area' },
      { title: 'Latência (ms)', keys: ['latency_ms', 'health_latency_ms', 'ext_latency_ms'], unit: 'ms' },
      { title: 'Taxa de erro (%)', keys: ['error_rate'], kind: 'area', unit: '%' },
      { title: 'Contagem de erros 4xx / 5xx', keys: ['err_4xx', 'err_5xx'], kind: 'bar' },
      { title: 'Conexões ativas', keys: ['active_connections'] },
      { title: 'Anomalia de tráfego (z-score)', keys: ['anomaly_z'], kind: 'area' },
    ],
  },
  database: {
    name: 'Banco de Dados', room: 'Cofre de Dados', operator: 'Bruno (DBA)', protocol: 'SQL · TCP 5432',
    headline: (m) => (m.up === 0 ? 'Banco fora do ar!' : `${m.qps ?? '-'} q/s · ${m.slow_queries ?? 0} lentas`),
    tiles: [
      { key: 'up', label: 'Status' }, { key: 'qps', label: 'Queries/s' }, { key: 'slow_queries', label: 'Slow queries' },
      { key: 'pool_usage_pct', label: 'Pool', unit: '%' }, { key: 'cpu_pct', label: 'CPU', unit: '%' }, { key: 'size_mb', label: 'Tamanho', unit: 'MB' },
    ],
    charts: [
      { title: 'Disponibilidade', keys: ['up'], kind: 'step' },
      { title: 'Queries por segundo (QPS)', keys: ['qps'], kind: 'area' },
      { title: 'Latência média de query (ms)', keys: ['query_latency_ms'], unit: 'ms' },
      { title: 'Erros (%) e rollbacks/falhas de transação', keys: ['error_rate', 'rollbacks'], kind: 'bar' },
      { title: 'Conexões abertas e uso do pool (%)', keys: ['connections_open', 'pool_usage_pct'] },
      { title: 'CPU e memória (%)', keys: ['cpu_pct', 'memory_pct'], unit: '%' },
      { title: 'I/O (operações) e latência de disco (ms)', keys: ['io_ops', 'disk_latency_ms'] },
      { title: 'Tamanho (MB) e crescimento (MB/dia)', keys: ['size_mb', 'growth_mb_day'] },
      { title: 'Slow queries', keys: ['slow_queries'], kind: 'bar' },
    ],
  },
  dns: {
    name: 'DNS', room: 'Central de Nomes', operator: 'Carla (DNS)', protocol: 'DNS · UDP/TCP 53',
    headline: (m) => (m.up === 0 ? 'Ninguém resolve nomes!' : `${m.resolve_ms ?? '-'} ms · ${m.failure_rate ?? 0}% falhas`),
    tiles: [
      { key: 'up', label: 'Status' }, { key: 'resolve_ms', label: 'Resolução', unit: 'ms' }, { key: 'failure_rate', label: 'Falhas', unit: '%' },
      { key: 'qps', label: 'Queries/s' }, { key: 'servers_up_pct', label: 'Servidores UP', unit: '%' },
    ],
    charts: [
      { title: 'Disponibilidade dos servidores de domínio (%)', keys: ['servers_up_pct'], kind: 'step', unit: '%' },
      { title: 'Tempo de resposta de resolução (ms)', keys: ['resolve_ms'], unit: 'ms' },
      { title: 'Taxa de falhas de resolução (%)', keys: ['failure_rate'], kind: 'area', unit: '%' },
      { title: 'Queries por segundo', keys: ['qps'], kind: 'area' },
    ],
  },
  smtp: {
    name: 'SMTP', room: 'Agência de Correio', operator: 'Davi (Mail)', protocol: 'SMTP · TCP 25/587',
    headline: (m) => (m.up === 0 ? 'Servidor SMTP mudo!' : `fila: ${m.queue_length ?? '-'} · ${m.delivery_rate ?? '-'}% entregues`),
    tiles: [
      { key: 'up', label: 'Status' }, { key: 'delivery_rate', label: 'Entrega', unit: '%' }, { key: 'queue_length', label: 'Fila' },
      { key: 'send_latency_ms', label: 'Latência envio', unit: 'ms' }, { key: 'error_rate', label: 'Erros', unit: '%' }, { key: 'emails_per_min', label: 'E-mails/min' },
    ],
    charts: [
      { title: 'Disponibilidade (sonda TCP + EHLO)', keys: ['up'], kind: 'step' },
      { title: 'Taxa de entrega (%)', keys: ['delivery_rate'], kind: 'area', unit: '%' },
      { title: 'Tamanho da fila (backlog)', keys: ['queue_length'], kind: 'area' },
      { title: 'Latência de envio e da sonda (ms)', keys: ['send_latency_ms', 'probe_latency_ms'], unit: 'ms' },
      { title: 'Taxa de erros (%) · rejeições · timeouts', keys: ['error_rate', 'rejections', 'timeouts'], kind: 'bar' },
      { title: 'Volume de e-mails por minuto', keys: ['emails_per_min'], kind: 'area' },
    ],
  },
};

export const METRIC_LABEL: Record<string, string> = {
  up: 'UP', rps: 'req/s', latency_ms: 'latência', health_latency_ms: 'health check', ext_latency_ms: 'sites externos',
  error_rate: 'erros %', err_4xx: '4xx', err_5xx: '5xx', active_connections: 'conexões', anomaly_z: 'z-score',
  qps: 'q/s', query_latency_ms: 'latência', rollbacks: 'rollbacks', connections_open: 'conexões', pool_usage_pct: 'pool %',
  cpu_pct: 'CPU %', memory_pct: 'memória %', io_ops: 'I/O ops', disk_latency_ms: 'disco ms', size_mb: 'MB',
  growth_mb_day: 'MB/dia', slow_queries: 'slow', resolve_ms: 'resolução', failure_rate: 'falhas %', servers_up_pct: 'servidores %',
  delivery_rate: 'entrega %', queue_length: 'fila', send_latency_ms: 'envio', probe_latency_ms: 'sonda',
  rejections: 'rejeições', timeouts: 'timeouts', emails_per_min: 'e-mails/min', failed_logins_5min: 'logins falhos (5 min)',
};

export const SERIES_COLORS = ['#5ab0ff', '#ff8fab', '#f4c542', '#5dd39e'];

export function fmt(v: number | undefined, unit?: string) {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  const n = Math.abs(v) >= 100 ? Math.round(v) : +v.toFixed(v < 1 ? 3 : 1);
  return unit ? `${n} ${unit}` : String(n);
}
