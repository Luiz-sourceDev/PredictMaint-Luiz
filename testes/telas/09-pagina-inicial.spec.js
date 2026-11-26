/* Página inicial: login no topo e apresentação do sistema abaixo */
import { test, expect } from "@playwright/test";
import { vigiarErros } from "./_util.js";

test("página inicial mostra o login e as seções de apresentação", async ({ page }) => {
  const erros = vigiarErros(page);
  await page.goto("/");
  await expect(page.locator("#usuario")).toBeVisible();
  for (const titulo of ["Máquina parada custa mais do que manutenção.", "Da medição à ordem de serviço, em quatro passos.", "Tudo o que a manutenção precisa, em um só sistema.", "Equipe Mantech Solutions"])
    await expect(page.getByRole("heading", { name: titulo })).toBeAttached();
  await expect(page.locator(".lp-equipe li")).toHaveCount(4);
  await expect(page.locator("#perfis")).toHaveCount(0);

  // O botão do fim da página volta para o login
  await page.getByRole("link", { name: "Entrar no PredictMaint" }).click();
  await expect(page).toHaveURL(/#entrar$/);
  await expect(page.locator("#usuario")).toBeInViewport();
  expect(erros).toEqual([]);
});
