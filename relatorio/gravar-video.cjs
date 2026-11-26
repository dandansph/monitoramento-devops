// Grava um vídeo (.webm) testando cada função do PixelNOC, com legendas na tela.
// Uso: com o app rodando em :5173 -> node relatorio/gravar-video.cjs
const { chromium, devices } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'video');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173';
const W = 1440, H = 900;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// legenda + cursor visível, reinjetados a cada navegação
const OVERLAY = () => {
  const boot = () => {
    if (document.getElementById('__cap')) return;
    const st = document.createElement('style');
    st.textContent = `
      #__cap{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483647;max-width:92vw;
        background:rgba(10,12,28,.92);color:#fff;border:2px solid #4ee1ff;border-radius:6px;padding:10px 18px;
        font:600 19px/1.3 Arial,sans-serif;text-align:center;box-shadow:0 4px 18px rgba(0,0,0,.6);pointer-events:none}
      #__cap small{display:block;color:#4ee1ff;font-size:13px;letter-spacing:1px;margin-bottom:2px}
      #__cur{position:fixed;width:22px;height:22px;border:3px solid #ff3b6b;background:rgba(255,59,107,.25);border-radius:50%;
        z-index:2147483647;pointer-events:none;transform:translate(-50%,-50%);left:-50px;top:-50px;transition:transform .08s}
      #__cur.click{transform:translate(-50%,-50%) scale(1.8);background:rgba(255,59,107,.6)}`;
    document.head.appendChild(st);
    const cap = document.createElement('div'); cap.id = '__cap'; cap.style.display = 'none'; document.body.appendChild(cap);
    const cur = document.createElement('div'); cur.id = '__cur'; document.body.appendChild(cur);
    addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => cur.classList.add('click'), true);
    addEventListener('mouseup', () => setTimeout(() => cur.classList.remove('click'), 150), true);
    window.__setCap = (step, text) => { cap.innerHTML = step ? `<small>${step}</small>${text}` : text; cap.style.display = text ? 'block' : 'none'; };
    if (window.__lastCap) window.__setCap(...window.__lastCap);
  };
  if (document.body) boot(); else addEventListener('DOMContentLoaded', boot);
};

// garante que nenhum cenário fique ativo (usa a API, fora da gravação)
async function apiStopAll() {
  const r = await fetch('http://localhost:4000/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', password: 'redes2026' }) });
  const { token } = await r.json();
  const h = { authorization: `Bearer ${token}` };
  const list = await (await fetch('http://localhost:4000/api/sim', { headers: h })).json();
  for (const sc of list.filter((x) => x.active)) await fetch(`http://localhost:4000/api/sim/${sc.name}`, { method: 'DELETE', headers: h });
}

let step = 0;
const cap = async (page, text, ms = 2500, numbered = true) => {
  const label = numbered ? `FUNÇÃO ${++step}` : '';
  await page.evaluate(([l, t]) => { window.__lastCap = [l, t]; window.__setCap && window.__setCap(l, t); }, [label, text]).catch(() => {});
  console.log(label, text);
  await wait(ms);
};
const note = (page, text, ms = 2500) => cap(page, text, ms, false);

async function moveTo(page, loc) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 });
  await wait(250);
}
async function click(page, loc, after = 800) { await moveTo(page, loc); await loc.click(); await wait(after); }
async function type(page, loc, text) { await moveTo(page, loc); await loc.click(); await loc.fill(''); await loc.pressSequentially(text, { delay: 90 }); await wait(300); }
const tab = (page, t) => click(page, page.getByRole('link', { name: new RegExp(t) }), 1600);
const safe = async (label, fn) => { try { await fn(); } catch (e) { console.log('FALHA', label, e.message.split('\n')[0]); } };

async function login(page) {
  await page.goto(BASE + '/login');
  await type(page, page.locator('input[name=user]'), 'admin');
  await type(page, page.locator('input[name=password]'), 'redes2026');
  await click(page, page.getByRole('button', { name: /START/ }), 500);
  await page.waitForURL(/\/$/);
  await page.getByText('AO VIVO').waitFor({ timeout: 15000 });
}

async function scenario(page, id, label, mapMsg, secs, extra) {
  await tab(page, 'Simulador');
  await cap(page, `Simulador: ${label}`, 1200);
  await click(page, page.getByTestId(`sim-${id}`), 800);
  await tab(page, 'Mapa');
  await note(page, mapMsg, secs * 1000);
  if (extra) await safe(id + ' extra', () => extra());
  await tab(page, 'Missões');
  await note(page, 'Quadro de Missões: o alerta aparece com nível e mensagem', 4500);
  return async () => { // encerra o cenário
    await tab(page, 'Simulador');
    const stop = page.locator('.sim-card', { hasText: label }).getByRole('button', { name: 'Parar' });
    if (await stop.count()) await click(page, stop.first(), 500);
    await apiStopAll();
    await tab(page, 'Mapa');
    await note(page, 'Cenário encerrado: aguardando o serviço se recuperar antes do próximo teste', 16000);
  };
}

(async () => {
  await apiStopAll();
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } } });
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  const video = page.video();

  // ---------- Abertura ----------
  await page.goto(BASE + '/login');
  await note(page, 'PixelNOC: plataforma de monitoramento de serviços de rede (Web, Banco, DNS e SMTP). Teste de todas as funções', 4500);

  // ---------- Autenticação ----------
  await page.goto(BASE + '/alertas');
  await page.waitForURL(/login/);
  await cap(page, 'Rota protegida: acessar /alertas sem login redireciona para a tela de login', 3500);
  await type(page, page.locator('input[name=user]'), 'aluno-teste');
  await type(page, page.locator('input[name=password]'), 'senha-errada');
  await click(page, page.getByRole('button', { name: /START/ }), 500);
  await page.getByRole('alert').waitFor();
  await cap(page, 'Login inválido: mensagem de erro, e a falha é registrada na Guarita (detecção de força bruta)', 3500);
  await login(page);
  await cap(page, 'Login válido: entra no painel e a conexão em tempo real fica AO VIVO', 3000);

  // ---------- Mapa ----------
  await cap(page, 'Visão consolidada: cada serviço é uma sala, e o operador mostra a métrica no balão', 5000);
  await note(page, 'Barras de vida no topo = disponibilidade na última hora. Log da partida = eventos em tempo real', 4000);

  // ---------- Painel por serviço ----------
  for (const [id, title, msg] of [
    ['web', 'Web Server', 'Painel Web: requisições, latência, erros 4xx/5xx e conexões'],
    ['database', 'Banco de Dados', 'Painel Banco de Dados: consultas por segundo, pool, CPU e slow queries'],
    ['dns', 'DNS', 'Painel DNS: tempo de resolução e falhas por servidor'],
    ['smtp', 'SMTP', 'Painel SMTP: fila, taxa de entrega e latência de envio'],
  ]) {
    await safe('painel ' + id, async () => {
      await click(page, page.getByTestId(`card-${id}`), 1000);
      const dlg = page.getByRole('dialog', { name: title });
      await dlg.locator('.recharts-surface').first().waitFor({ timeout: 15000 });
      await cap(page, msg, 4000);
      if (id === 'web') {
        for (const r of ['1h', '6h', '24h', '15m']) { await click(page, dlg.getByRole('button', { name: r, exact: true }), 1500); }
        await note(page, 'Seletor de período: 15 minutos, 1 hora, 6 horas e 24 horas', 2000);
      }
      await dlg.hover(); await page.mouse.wheel(0, 700); await wait(1800); await page.mouse.wheel(0, -700); await wait(800);
      await page.keyboard.press('Escape'); await wait(700);
    });
  }

  // ---------- Abas ----------
  await tab(page, 'Missões');
  await cap(page, 'Quadro de Missões: alertas ativos e histórico (sem alertas no momento)', 4000);
  await tab(page, 'Segurança');
  await cap(page, 'Guarita de Segurança: eventos, IPs com falhas de login, integridade de configuração e anomalia de tráfego', 5000);
  await safe('rescan', async () => {
    await click(page, page.getByRole('button', { name: 'Reverificar' }), 500);
    await cap(page, 'Vulnerabilidades conhecidas: consulta à base pública OSV.dev (botão Reverificar)', 7000);
  });
  await tab(page, 'Regras');
  await cap(page, 'Regras do Jogo: limiares amarelo e vermelho e número de amostras de cada alerta', 4000);
  await safe('regra', async () => {
    const input = page.getByLabel('amarelo web-latency');
    const old = await input.inputValue();
    await type(page, input, '155');
    await click(page, page.getByRole('button', { name: 'Salvar regras' }), 500);
    await cap(page, 'Editar regra: limiar alterado e salvo, com efeito imediato', 3000);
    await type(page, input, old);
    await click(page, page.getByRole('button', { name: 'Salvar regras' }), 1500);
    await note(page, 'Limiar restaurado ao valor original', 1500);
  });
  await tab(page, 'Simulador');
  await cap(page, 'Simulador de incidentes: 8 cenários de falha e ataque para testar o monitoramento', 4500);

  // ---------- Cenários ----------
  let stop;
  stop = await scenario(page, 'ddos', 'Ataque DDoS no Web Server', 'Mapa: insetos invadem a sala Web, o tráfego dispara e o z-score detecta a anomalia', 22);
  await stop();

  stop = await scenario(page, 'web-down', 'Derrubar o Web Server', 'Mapa: sala Web apagada, fumaça e alerta crítico (Nível 3)', 22, async () => {
    await tab(page, 'Missões');
  });
  await safe('email', async () => {
    const link = page.getByRole('link', { name: /ver e-mail enviado/ }).first();
    await link.waitFor({ timeout: 25000 });
    const href = await link.getAttribute('href');
    await cap(page, 'Notificação por e-mail: alerta crítico enviado imediatamente (link ver e-mail enviado)', 2500);
    await moveTo(page, link);
    await page.goto(href); await wait(500);
    await note(page, 'E-mail de alerta recebido (caixa de teste Ethereal)', 6000);
    await page.goBack(); await page.getByText('AO VIVO').waitFor({ timeout: 15000 });
    await wait(1500);
  });
  await safe('ack', async () => {
    await tab(page, 'Missões');
    const b = page.getByRole('button', { name: 'Reconhecer' }).first();
    await b.waitFor({ timeout: 8000 });
    await click(page, b, 500);
    await cap(page, 'Reconhecer alerta: o operador assume a missão', 3500);
  });
  await stop();

  stop = await scenario(page, 'web-erros', 'Web Server retornando 5xx', 'Mapa: pacotes vermelhos, taxa de erro e 5xx sobem', 20);
  await stop();
  stop = await scenario(page, 'db-lento', 'Banco de dados lento', 'Mapa: ampulhetas sobre os discos, slow queries e rollbacks', 22);
  await stop();
  stop = await scenario(page, 'dns-falha', 'Falha de resolução DNS', 'Mapa: servidor DNS sem resposta e falhas de resolução', 22);
  await stop();
  stop = await scenario(page, 'smtp-fila', 'Fila de e-mails congestionada', 'Mapa: pilha de envelopes cresce e a entrega cai', 22);
  await stop();

  stop = await scenario(page, 'bruteforce', 'Ataque de força bruta no login', 'Mapa: encapuzados na porta da Guarita', 12, async () => {
    await tab(page, 'Segurança');
    await note(page, 'Guarita: IPs atacantes ficam BLOQUEADOS após 5 falhas de login', 6000);
  });
  await stop();
  stop = await scenario(page, 'config-change', 'Alterar arquivo de configuração', 'Mapa: papel voa até o guarda (nginx.conf alterado)', 8, async () => {
    await tab(page, 'Segurança');
    await note(page, 'Integridade de configuração: diff do arquivo alterado, com hash SHA-256 antes e depois', 6000);
  });
  await tab(page, 'Simulador');
  await click(page, page.getByTestId('sim-config-change'), 800); // reverte nginx.conf
  await note(page, 'Configuração revertida ao valor original', 2500);
  await safe('limpeza', async () => {
    for (let i = 0; i < 8; i++) { const b = page.getByRole('button', { name: 'Parar' }); if (!(await b.count())) break; await b.first().click(); await wait(300); }
  });

  // ---------- Histórico e filtros ----------
  await wait(15000);
  await tab(page, 'Missões');
  await cap(page, 'Histórico de missões: alertas resolvidos com início, fim e duração', 5000);
  await safe('filtros', async () => {
    await click(page, page.getByRole('button', { name: 'Críticos' }), 500);
    await cap(page, 'Filtro de histórico: somente alertas críticos', 3000);
    await click(page, page.getByRole('button', { name: 'Atenção' }), 500);
    await note(page, 'Filtro de histórico: somente alertas de atenção', 3000);
    await click(page, page.getByRole('button', { name: 'Todos' }), 500);
  });
  await tab(page, 'Mapa');
  await cap(page, 'Mapa após a recuperação: todos os serviços voltam ao Nível 1 (verde)', 5000);

  // ---------- Som e logout ----------
  await safe('som', async () => {
    const mute = page.getByTitle(/Silenciar|Ativar som/);
    await click(page, mute, 1200); await click(page, mute, 1200);
    await cap(page, 'Botão de som: liga e desliga o alarme sonoro', 1500);
  });
  await click(page, page.getByRole('button', { name: 'Sair' }), 500);
  await page.waitForURL(/login/);
  await cap(page, 'Logout: encerra a sessão e volta à tela de login', 3500);

  // ---------- Mobile (mesma gravação, viewport do celular) ----------
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto(BASE + '/login');
  await note(page, 'Layout responsivo: o mesmo painel em tela de celular', 3000);
  await login(page); await wait(2500);
  await cap(page, 'Celular: visão consolidada', 3500);
  await safe('mobile painel', async () => {
    await click(page, page.getByTestId('card-web'), 1500);
    await cap(page, 'Celular: painel do serviço', 3500);
    await page.keyboard.press('Escape'); await wait(500);
  });
  for (const t of ['Missões', 'Segurança', 'Regras', 'Simulador']) {
    await safe('mobile ' + t, async () => { await tab(page, t); await cap(page, `Celular: aba ${t}`, 3000); });
  }
  await note(page, 'Fim do teste: todas as funções do PixelNOC foram exercitadas', 3500);

  await ctx.close();
  const tmp = await video.path();
  const dest = path.join(OUT, 'PixelNOC-teste-das-funcoes.webm');
  fs.renameSync(tmp, dest);
  await browser.close();
  console.log('VIDEO', dest);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
