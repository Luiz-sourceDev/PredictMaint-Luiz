import { test, expect } from "@playwright/test";
import { entrar, vigiarErros } from "./_util.js";

// Os filtros de status davam "Erro interno no servidor" (regra de comparação de texto
// diferente entre a API e o banco). As conferências esperam a tabela atualizar.
test("filtros de máquinas por status, setor e ordem", async ({ page }) => {
  const erros = vigiarErros(page);
  await entrar(page, "gestor");
  await page.goto("/maquinas");
  await page.waitForLoadState("networkidle");
  const linhas = page.locator("tbody tr");
  const erroTela = page.getByText("Não consegui carregar esta tela");

  await page.selectOption("#f-t", { label: "Crítico" });
  await expect(linhas.filter({ hasNotText: "Crítico" })).toHaveCount(0);
  await expect(linhas.first()).toContainText("Crítico");
  await expect(erroTela).toHaveCount(0);

  await page.selectOption("#f-t", { label: "Atenção" });
  await page.selectOption("#f-o", { index: 1 });
  await expect(linhas.filter({ hasNotText: "Atenção" })).toHaveCount(0);
  await expect(linhas.first()).toContainText("Atenção");

  await page.selectOption("#f-t", { label: "Normal" });
  await page.selectOption("#f-s", { label: "Usinagem" });
  await expect(linhas.filter({ hasNotText: "Usinagem" })).toHaveCount(0);
  await expect(linhas.first()).toContainText("Normal");
  await expect(erroTela).toHaveCount(0);

  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect.poll(() => linhas.count()).toBeGreaterThanOrEqual(10);
  expect(erros).toEqual([]);
});
