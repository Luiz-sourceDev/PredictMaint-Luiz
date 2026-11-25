/* Ações preditivas nas telas: dashboard, detalhe da máquina e central de alertas */
import { test, expect } from "@playwright/test";
import { entrar, vigiarErros } from "./_util.js";
import { API_URL, RODADA } from "../config.js";

const atras = (horas) => {
  const d = new Date(Date.now() - horas * 3600000), z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
};

test("previsão de falha aparece no dashboard, na máquina e nos alertas", async ({ page }) => {
  const erros = vigiarErros(page);
  const cod = `TST-R${RODADA}`;
  await entrar(page, "gestor");
  const h = { Authorization: "Bearer " + (await page.evaluate(() => localStorage.getItem("pm_token"))) };
  const limite = Number((await (await page.request.get(API_URL + "/limites", { headers: h })).json()).vibracao.limite);
  expect((await page.request.post(API_URL + "/maquinas", { headers: h, data: { id: cod, nome: "Tendência de teste", setor: "Usinagem" } })).status()).toBe(201);
  const medir = (valor, horas) => page.request.post(API_URL + "/medicoes", { headers: h, data: { maquina: cod, grandeza: "vibracao", valor, data: atras(horas) } });
  try {
    // vibração subindo 0,3 por dia, ~3 dias do limite crítico
    for (let i = 5; i >= 0; i--) expect((await medir(+(limite - 0.9 - i * 0.3).toFixed(2), i * 24 + 5)).status()).toBe(201);

    await page.goto("/dashboard");
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Ações preditivas" }) });
    await expect(card).toBeVisible();
    await expect(card.locator(".pm-prev-i").first()).toBeVisible();

    await page.goto(`/maquinas?id=${cod}`);
    const modal = page.locator(".modal");
    await expect(modal.getByRole("heading", { name: "Previsão de falha" })).toBeVisible();
    const vib = modal.locator(".pm-prev-g", { hasText: "Vibração" });
    await expect(vib).toContainText("Falha em até 7 dias");
    await expect(modal.locator(".pm-tend svg")).toBeVisible();
    await expect(modal).toContainText("Falha prevista");
    await expect(modal).toContainText("Ação recomendada");
    await expect(modal.locator(".pm-prev-g", { hasText: "Temperatura" })).toContainText("Poucas leituras");

    await page.goto("/alertas");
    const linha = page.locator("tr", { hasText: cod }).filter({ hasText: "Falha prevista" });
    await expect(linha).toContainText("Preditivo");
    await linha.click();
    await expect(page.locator("section[aria-live]")).toContainText("regressão linear");
  } finally {
    // tendência some (o alerta preditivo é resolvido) e a máquina de teste sai da lista
    for (let i = 0; i < 6; i++) await medir(0.5, 3);
    await page.request.delete(API_URL + `/maquinas/${cod}`, { headers: h });
  }
  expect(erros).toEqual([]);
});
