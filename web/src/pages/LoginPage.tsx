import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';

export default function LoginPage() {
  const [user, setUser] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const r = await api<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ user, password }) });
      setToken(r.token);
      nav('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="login">
      <form className="rpg-window login-box" onSubmit={submit}>
        <div className="brand big">▣ PIXEL<span className="accent">NOC</span></div>
        <p className="muted">Plataforma de Monitoramento para DevOps</p>
        <label>Jogador<input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" name="user" /></label>
        <label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" name="password" /></label>
        {error && <p className="crit" role="alert">{error}</p>}
        <button className="btn primary" type="submit">▶ START</button>
        <p className="muted small">Falhas de login são monitoradas (detecção de força bruta).</p>
      </form>
    </div>
  );
}
