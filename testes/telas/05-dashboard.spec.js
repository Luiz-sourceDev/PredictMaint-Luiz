import { test, expect } from "@playwright/test";
import { entrar, vigiarErros } from "./_util.js";
import { API_URL, RODADA } from "../config.js";

// Dashboard limpo: sem gráfico de vibração; faixa de destaque, saúde, alertas e OS com prazos
test("dashboard mostra destaque, saúde, alertas e prazos, sem gráfico de vibração", async ({ page }) => {
  const erros = vigiarErros(page);
  await entrar(page, "gestor");
  await expect(page.locator(".pm-kpi")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: /^Vibração/ })).toHaveCount(0);
  await expect(page.locator('section[aria-label="Ampliar: vibração"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Saúde dos ativos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alertas recentes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ordens de serviço" })).toBeVisible();
  await expect(page.locator(".pm-prazo").first()).toBeVisible();
  // a faixa de destaque leva ao alerta crítico
  const faixa = page.locator("a.pm-destaque");
  await expect(faixa).toContainText("pede atenção");
  await faixa.click();
  await page.waitForURL(/\/alertas\?id=/);
  // ampliar continua funcionando
  await page.goto("/dashboard");
  await page.locator('section[aria-label="Ampliar: saúde dos ativos"]').click();
  await expect(page.locator(".modal")).toContainText("Saúde de todos os ativos");
  expect(erros).toEqual([]);
});

// Máquina recém-cadastrada (sem medições) e crítica: o dashboard continua de pé
test("dashboard com máquina sem medições não quebra", async ({ page }) => {
  const erros = vigiarErros(page);
  const cod = `TST-V${RODADA}`;
  await entrar(page, "gestor");
  const token = await page.evaluate(() => localStorage.getItem("pm_token"));
  const h = { Authorization: "Bearer " + token };
  expect((await page.request.post(API_URL + "/maquinas", { headers: h, data: { id: cod, nome: "Sem leituras", setor: "Usinagem" } })).status()).toBe(201);
  await page.request.put(API_URL + `/maquinas/${cod}`, { headers: h, data: { saude: 5 } });
  try {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".pm-kpi").first()).toBeVisible();
    await expect(page.locator("tbody tr").first()).toContainText(cod);
    expect(erros).toEqual([]);
  } finally {
    await page.request.delete(API_URL + `/maquinas/${cod}`, { headers: h });
  }
});
