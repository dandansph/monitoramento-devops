// Canal de notificação por e-mail (nodemailer).
// Amarelo (Atenção): e-mail agrupado (digest a cada 60 s). Vermelho (Crítico): e-mail imediato.
import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter;
let mode = 'pendente';
const digest = [];

export async function initMailer() {
  try {
    if (config.mail.host) {
      transporter = nodemailer.createTransport({
        host: config.mail.host,
        port: config.mail.port,
        secure: config.mail.port === 465,
        auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
      });
      mode = `smtp:${config.mail.host}`;
    } else {
      const acc = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({ host: acc.smtp.host, port: acc.smtp.port, secure: acc.smtp.secure, auth: { user: acc.user, pass: acc.pass } });
      mode = 'ethereal';
    }
  } catch (e) {
    console.warn('[mail] sem acesso a SMTP, e-mails serão apenas registrados no log:', e.message);
    transporter = nodemailer.createTransport({ jsonTransport: true });
    mode = 'log';
  }
  console.log(`[mail] modo de envio: ${mode}`);
  setInterval(flushDigest, 60_000).unref();
}

export const mailMode = () => mode;

const COLORS = { warn: '#e0a100', crit: '#d62828', ok: '#2a9d4b' };
const LABEL = { warn: 'NÍVEL 2 — AMARELO (Atenção)', crit: 'NÍVEL 3 — VERMELHO (Crítico)', ok: 'NÍVEL 1 — VERDE (Resolvido)' };

function html(items) {
  return `<div style="font-family:Arial,sans-serif">
    <h2 style="margin:0 0 8px">PixelNOC — Alerta de monitoramento</h2>
    ${items
      .map(
        (a) => `<div style="border-left:6px solid ${COLORS[a.level]};padding:8px 12px;margin:8px 0;background:#f6f6f6">
        <b style="color:${COLORS[a.level]}">${LABEL[a.level]}</b><br>
        <b>Serviço:</b> ${a.service} &nbsp; <b>Regra:</b> ${a.rule_id}<br>
        <b>Mensagem:</b> ${a.message}<br>
        <b>Valor:</b> ${a.value ?? '-'} &nbsp; <b>Horário:</b> ${new Date(a.updated_at).toLocaleString('pt-BR')}
      </div>`,
      )
      .join('')}
    <p style="color:#666;font-size:12px">Consulte o runbook do serviço em docs/runbooks.md.</p></div>`;
}

async function send(subject, items) {
  if (!transporter) return null;
  try {
    const info = await transporter.sendMail({ from: config.mail.from, to: config.mail.to, subject, html: html(items) });
    const preview = nodemailer.getTestMessageUrl(info) || null;
    console.log(`[mail] enviado: ${subject}${preview ? ' -> ' + preview : ''}`);
    return preview || `enviado (${mode})`;
  } catch (e) {
    console.warn('[mail] falha no envio:', e.message);
    return null;
  }
}

/** Notifica um alerta. Retorna (via callback) o link de preview para gravar no alerta. */
export async function notify(alert, onSent) {
  if (alert.level === 'crit' || alert.level === 'ok') {
    const tag = alert.level === 'crit' ? '[CRÍTICO]' : '[RESOLVIDO]';
    const preview = await send(`${tag} ${alert.service.toUpperCase()}: ${alert.message}`, [alert]);
    onSent?.(preview);
  } else if (alert.level === 'warn') {
    digest.push({ alert, onSent });
  }
}

async function flushDigest() {
  if (!digest.length) return;
  const batch = digest.splice(0);
  const preview = await send(`[ATENÇÃO] ${batch.length} alerta(s) amarelo(s) no PixelNOC`, batch.map((b) => b.alert));
  batch.forEach((b) => b.onSent?.(preview));
}

export { flushDigest };
