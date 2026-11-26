// Gera prints de todas as funções do PixelNOC em relatorio/prints/ (precisa do app rodando em :5173)
const { chromium, devices } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'prints');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const shot = async (page, name, full = true) => {
  const f = path.join(OUT, `${String(++n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: f, fullPage: full });
  console.log('ok', f);
};
const safe = async (label, fn) => { try { await fn(); } catch (e) { console.log('FALHA', label, e.message.split('\n')[0]); } };

async function login(page) {
  await page.goto(BASE + '/login');
  await page.locator('input[name=user]').fill('admin');
  await page.locator('input[name=password]').fill('redes2026');
  await page.getByRole('button', { name: /START/ }).click();
  await page.waitForURL(/\/$/);
  await page.getByText('AO VIVO').waitFor({ timeout: 15000 });
}
const tab = async (page, t) => { await page.getByRole('link', { name: new RegExp(t) }).click(); await wait(1200); };
const slug = (t) => t.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase();

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // --- Autenticação ---
  await page.goto(BASE + '/alertas');
  await page.waitForURL(/login/);
  await shot(page, 'login-rota-protegida-redireciona', false);
  await page.locator('input[name=user]').fill('aluno-teste');
  await page.locator('input[name=password]').fill('senha-errada');
  await page.getByRole('button', { name: /START/ }).click();
  await page.getByRole('alert').waitFor();
  await shot(page, 'login-senha-invalida', false);
  await login(page);
  await wait(3000);
  await shot(page, 'mapa-visao-consolidada');

  // --- Dashboard por serviço (+ seletor de período) ---
  for (const [id, title] of [['web', 'Web Server'], ['database', 'Banco de Dados'], ['dns', 'DNS'], ['smtp', 'SMTP']]) {
    await safe('servico ' + id, async () => {
      await page.getByTestId(`card-${id}`).click();
      const dlg = page.getByRole('dialog', { name: title });
      await dlg.locator('.recharts-surface').first().waitFor({ timeout: 15000 });
      await wait(1000);
      await shot(page, `servico-${id}-15m`, false);
      if (id === 'web') {
        await dlg.getByRole('button', { name: '1h', exact: true }).click(); await wait(1200);
        await shot(page, 'servico-web-periodo-1h', false);
      }
      await page.keyboard.press('Escape');
    });
  }

  // --- Abas ---
  await tab(page, 'Missões');   await shot(page, 'aba-missoes-sem-alertas');
  await tab(page, 'Segurança'); await shot(page, 'aba-seguranca');
  await safe('rescan', async () => {
    await page.getByRole('button', { name: 'Reverificar' }).click(); await wait(6000);
    await shot(page, 'seguranca-reverificar-cves');
  });
  await tab(page, 'Regras');    await shot(page, 'aba-regras');
  await safe('editar regra', async () => {
    const input = page.getByLabel('amarelo web-latency');
    const old = await input.inputValue();
    await input.fill('155');
    await page.getByRole('button', { name: 'Salvar regras' }).click();
    await page.getByText('Regras salvas').waitFor();
    await shot(page, 'regras-editar-e-salvar');
    await input.fill(old);
    await page.getByRole('button', { name: 'Salvar regras' }).click(); await wait(800);
  });
  await tab(page, 'Simulador'); await shot(page, 'aba-simulador');

  // --- Cenários ---
  const scen = [
    ['ddos', 'ataque-ddos', 30],
    ['web-down', 'web-fora-do-ar', 30],
    ['web-erros', 'web-erros-5xx', 28],
    ['db-lento', 'banco-lento', 30],
    ['dns-falha', 'dns-falha', 30],
    ['smtp-fila', 'smtp-fila', 30],
    ['bruteforce', 'forca-bruta', 14],
    ['config-change', 'config-alterada', 14],
  ];
  for (const [name, label, secs] of scen) {
    await safe(label, async () => {
      await tab(page, 'Simulador');
      await page.getByTestId(`sim-${name}`).click();
      await wait(600);
      await shot(page, `cenario-${label}-1-disparo`, false);
      await tab(page, 'Mapa');
      await wait(secs * 1000);
      await shot(page, `cenario-${label}-2-mapa`, false);
      if (name === 'bruteforce' || name === 'config-change') { await tab(page, 'Segurança'); await wait(1500); await shot(page, `cenario-${label}-3-guarita`); }
      await tab(page, 'Missões'); await wait(1500);
      await shot(page, `cenario-${label}-4-missoes`);
      if (name === 'web-down') {
        await safe('email', async () => {
          const link = page.getByRole('link', { name: /ver e-mail enviado/ }).first();
          await link.waitFor({ timeout: 20000 });
          const [popup] = await Promise.all([ctx.waitForEvent('page'), link.click()]);
          await popup.waitForLoadState('load', { timeout: 20000 }); await wait(2500);
          await shot(popup, 'email-alerta-critico-recebido', false);
          await popup.close();
        });
        await safe('reconhecer', async () => {
          await page.getByRole('button', { name: 'Reconhecer' }).first().click(); await wait(800);
          await shot(page, 'missoes-alerta-reconhecido');
        });
      }
      await tab(page, 'Simulador');
      if (name !== 'config-change') await safe('parar', async () => { await page.getByRole('button', { name: 'Parar' }).first().click(); await wait(500); });
      else { await page.getByTestId('sim-config-change').click(); await wait(500); } // reverte nginx.conf
    });
  }
  await safe('limpeza', async () => {
    await tab(page, 'Simulador');
    for (let i = 0; i < 8; i++) { const b = page.getByRole('button', { name: 'Parar' }); if (!(await b.count())) break; await b.first().click(); await wait(300); }
  });

  await wait(25000); // recuperação
  await tab(page, 'Missões'); await shot(page, 'missoes-historico-resolvidos');
  await safe('filtro', async () => { await page.getByRole('button', { name: 'Críticos' }).click(); await wait(500); await shot(page, 'missoes-filtro-criticos'); });
  await tab(page, 'Mapa'); await wait(2000); await shot(page, 'mapa-apos-recuperacao');

  // --- Mobile ---
  const m = await browser.newContext({ ...devices['Pixel 7'] });
  const mp = await m.newPage();
  await login(mp); await wait(3000);
  await shot(mp, 'mobile-mapa');
  await safe('mobile servico', async () => { await mp.getByTestId('card-web').click(); await wait(2500); await shot(mp, 'mobile-servico-web', false); await mp.keyboard.press('Escape'); });
  for (const t of ['Missões', 'Segurança', 'Regras', 'Simulador']) { await tab(mp, t); await shot(mp, `mobile-aba-${slug(t)}`); }

  // --- Logout ---
  await page.getByRole('button', { name: 'Sair' }).click(); await page.waitForURL(/login/); await shot(page, 'logout', false);
  await browser.close();
})();
