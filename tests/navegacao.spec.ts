import { test, expect, type Page } from '@playwright/test';

const USER = process.env.ADMIN_USER || 'admin';
const PASS = process.env.ADMIN_PASSWORD || 'redes2026';
const SHOTS = 'docs/img';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[name=user]').fill(USER);
  await page.locator('input[name=password]').fill(PASS);
  await page.getByRole('button', { name: /START/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('CT01 - acesso sem login redireciona para a tela de login', async ({ page }) => {
  await page.goto('/alertas');
  await expect(page).toHaveURL(/\/login/);
});

test('CT02 - senha errada é recusada e contabilizada', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[name=user]').fill('teste-e2e');
  await page.locator('input[name=password]').fill('senha-errada');
  await page.getByRole('button', { name: /START/ }).click();
  await expect(page.getByRole('alert')).toContainText(/inválidos|bloqueado/);
});

test('CT03 - visão consolidada mostra as 4 salas e cartões de serviço', async ({ page }, info) => {
  await login(page);
  for (const id of ['web', 'database', 'dns', 'smtp', 'control', 'security']) await expect(page.getByTestId(`room-${id}`)).toBeVisible();
  for (const id of ['web', 'database', 'dns', 'smtp']) await expect(page.getByTestId(`card-${id}`)).toBeVisible();
  await expect(page.getByText('AO VIVO')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-mapa.png`, fullPage: true });
});

test('CT04 - abrir dashboard de cada serviço com gráficos', async ({ page }, info) => {
  await login(page);
  for (const [id, title] of [['web', 'Web Server'], ['database', 'Banco de Dados'], ['dns', 'DNS'], ['smtp', 'SMTP']]) {
    await page.getByTestId(`card-${id}`).click();
    const dlg = page.getByRole('dialog', { name: title });
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('.recharts-surface').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-servico-${id}.png` });
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
  }
});

test('CT05 - navegação por todas as abas', async ({ page }, info) => {
  await login(page);
  const tabs: [string, RegExp][] = [['Missões', /Quadro de Missões/], ['Segurança', /Guarita de Segurança/], ['Regras', /Regras do Jogo/], ['Simulador', /Simulador de Incidentes/], ['Mapa', /Log da partida/]];
  for (const [tab, heading] of tabs) {
    await page.getByRole('link', { name: new RegExp(tab) }).click();
    await expect(page.getByText(heading).first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/${info.project.name}-aba-${tab.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()}.png`, fullPage: true });
  }
});

test('CT06 - derrubar o Web Server gera alerta crítico (Nível 3)', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'cenário executado só uma vez');
  await login(page);
  await page.getByRole('link', { name: /Simulador/ }).click();
  await page.getByTestId('sim-web-down').click();
  await page.getByRole('link', { name: /Missões/ }).click();
  const alert = page.getByTestId('active-alert').filter({ hasText: 'indisponível' });
  await expect(alert).toBeVisible({ timeout: 30000 });
  await expect(alert).toContainText('CRÍTICO');
  await page.screenshot({ path: `${SHOTS}/alerta-critico.png`, fullPage: true });
  // encerra o cenário
  await page.getByRole('link', { name: /Simulador/ }).click();
  await page.getByRole('button', { name: 'Parar' }).first().click();
});

test('CT07 - editar limiar de regra e salvar', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'executado só no desktop');
  await login(page);
  await page.getByRole('link', { name: /Regras/ }).click();
  const input = page.getByLabel('amarelo web-latency');
  const old = await input.inputValue();
  await input.fill('155');
  await page.getByRole('button', { name: 'Salvar regras' }).click();
  await expect(page.getByText('Regras salvas')).toBeVisible();
  await input.fill(old);
  await page.getByRole('button', { name: 'Salvar regras' }).click();
});
