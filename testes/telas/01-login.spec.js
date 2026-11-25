import { test, expect } from "@playwright/test";
import { entrar, vigiarErros } from "./_util.js";
import { LOGINS } from "../config.js";

test.describe("Login", () => {
  for (const perfil of ["gestor", "tecnico", "funcionario"]) {
    test(`${perfil} entra e cai na tela certa`, async ({ page }) => {
      const erros = vigiarErros(page);
      await entrar(page, perfil);
      expect(erros).toEqual([]);
    });
  }

  test("senha errada mostra aviso e não entra", async ({ page }) => {
    await page.goto("/");
    await page.locator("label[for=p-gestor]").click();
    await page.fill("#usuario", LOGINS.gestor);
    await page.fill("#senha", "senha-errada");
    await page.locator("form button.btn-primary").click();
    await expect(page.locator(".alert-danger")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("sair volta para o login", async ({ page }) => {
    await entrar(page, "gestor");
    await page.getByRole("button", { name: "Sair" }).first().click();
    await expect(page).toHaveURL(/\/$/);
  });
});
