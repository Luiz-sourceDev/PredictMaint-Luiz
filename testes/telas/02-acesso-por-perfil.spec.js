import { test, expect } from "@playwright/test";
import { entrar, vigiarErros } from "./_util.js";

const TELAS_GESTAO = ["/dashboard", "/maquinas", "/medicoes", "/alertas", "/ordens"];

test.describe("Gestor", () => {
  test("vê o menu completo e todas as telas abrem sem erro", async ({ page }) => {
    const erros = vigiarErros(page);
    await entrar(page, "gestor");
    const menu = page.locator(".pm-nav");
    for (const item of ["Dashboard", "Máquinas", "Medições", "Alertas", "Ordens de Serviço", "Orçamento", "Usuários"]) {
      await expect(menu).toContainText(item);
    }
    for (const tela of [...TELAS_GESTAO, "/orcamento", "/usuarios"]) {
      await page.goto(tela);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(new RegExp(tela));
      await expect(page.locator("h1").first()).toBeVisible();
    }
    expect(erros).toEqual([]);
  });

  test("Planta ao vivo saiu do menu e o endereço antigo leva ao Dashboard", async ({ page }) => {
    const erros = vigiarErros(page);
    await entrar(page, "gestor");
    await expect(page.locator(".pm-nav")).not.toContainText("Planta ao vivo");
    await expect(page.locator(".pm-pulse, aside").first()).toContainText(/estado crítico|sem criticidade/);
    await page.goto("/planta");
    await page.waitForURL("**/dashboard");
    await expect(page.locator("h1").first()).toBeVisible();
    expect(erros).toEqual([]);
  });

  test("tem os botões de cadastro", async ({ page }) => {
    await entrar(page, "gestor");
    await page.goto("/maquinas");
    await expect(page.locator("header").getByRole("button", { name: "Nova máquina" })).toBeVisible();
    await page.goto("/ordens");
    await expect(page.locator("header").getByRole("button", { name: "Nova OS" })).toBeVisible();
  });
});

test.describe("Técnico (acesso reduzido)", () => {
  test("menu sem Orçamento e Usuários; telas de operação abrem", async ({ page }) => {
    const erros = vigiarErros(page);
    await entrar(page, "tecnico");
    const menu = page.locator(".pm-nav");
    await expect(menu).not.toContainText("Orçamento");
    await expect(menu).not.toContainText("Usuários");
    for (const tela of TELAS_GESTAO) {
      await page.goto(tela);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(new RegExp(tela));
    }
    expect(erros).toEqual([]);
  });

  test("não vê botões de cadastro nem 'Gerar OS'", async ({ page }) => {
    await entrar(page, "tecnico");
    await page.goto("/maquinas"); await page.waitForLoadState("networkidle");
    await expect(page.locator("header").getByRole("button", { name: "Nova máquina" })).toHaveCount(0);
    await page.goto("/ordens"); await page.waitForLoadState("networkidle");
    await expect(page.locator("header").getByRole("button", { name: "Nova OS" })).toHaveCount(0);
    await page.goto("/alertas"); await page.waitForLoadState("networkidle");
    await expect(page.locator("header").getByRole("button", { name: "Configurar limites" })).toHaveCount(0);
    await expect(page.getByText("Gerar OS")).toHaveCount(0);
  });

  for (const tela of ["/usuarios", "/orcamento"]) {
    test(`digitar ${tela} no endereço volta para o Dashboard`, async ({ page }) => {
      await entrar(page, "tecnico");
      await page.goto(tela);
      await page.waitForURL("**/dashboard");
    });
  }
});

test.describe("Funcionário", () => {
  test("só tem a área de chamados", async ({ page }) => {
    await entrar(page, "funcionario");
    await expect(page.getByRole("link", { name: "Meus chamados" }).first()).toBeVisible();
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});
