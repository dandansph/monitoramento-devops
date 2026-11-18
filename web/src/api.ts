export type Level = 'ok' | 'warn' | 'crit';
export type ServiceId = 'web' | 'database' | 'dns' | 'smtp';
export type Snapshot = { ts: number; metrics: Record<string, number>; details: any; source?: string };
export type Alert = {
  id: number; rule_id: string; service: string; metric: string | null; level: Level; message: string;
  value: number | null; started_at: number; updated_at: number; resolved_at: number | null;
  acknowledged: number; email_preview: string | null;
};
export type SecurityEvent = { id: number; ts: number; type: string; severity: Level; source: string | null; details: any };
export type Rule = { id: string; service: string; metric: string; op: '>' | '<'; warn: number | null; crit: number | null; for: number; description: string };
export type Scenario = { name: string; label: string; service: string; defaultSec: number; active: boolean; until: number | null };

const TOKEN_KEY = 'pixelnoc.token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(t: string | null) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* sem storage */ }
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getToken() ?? ''}`, ...(opts.headers || {}) },
  });
  if (res.status === 401 && !path.startsWith('/auth')) {
    setToken(null);
    window.location.href = '/login';
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
  return body as T;
}

export function openSocket(onMessage: (msg: any) => void): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry: number | undefined;
  const connect = () => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(getToken() ?? '')}`);
    ws.onmessage = (e) => onMessage(JSON.parse(e.data));
    ws.onclose = () => { if (!closed) retry = window.setTimeout(connect, 2000); };
  };
  connect();
  return () => { closed = true; clearTimeout(retry); ws?.close(); };
}
