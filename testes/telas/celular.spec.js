import { test, expect } from "@playwright/test";
import { entrar, semRolagemLateral, vigiarErros } from "./_util.js";

test("gestor no celular: todas as telas cabem na tela", async ({ page }) => {
  const erros = vigiarErros(page);
  await entrar(page, "gestor");
  for (const tela of ["/dashboard", "/maquinas", "/medicoes", "/alertas", "/ordens", "/orcamento", "/usuarios"]) {
    await page.goto(tela);
    await page.waitForLoadState("networkidle");
    await semRolagemLateral(page);
  }
  expect(erros).toEqual([]);
});

test("funcionário no celular: chamado e sininho", async ({ page }) => {
  await entrar(page, "funcionario");
  await semRolagemLateral(page);
  await expect(page.locator(".pm-sino:visible")).toHaveCount(1);
  await page.goto("/meus-chamados");
  await page.waitForLoadState("networkidle");
  await semRolagemLateral(page);
});
