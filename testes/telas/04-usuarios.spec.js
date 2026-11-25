import { test, expect } from "@playwright/test";
import { entrar, toast, vigiarErros } from "./_util.js";
import { RODADA } from "../config.js";

const NOME = `Teste Tela ${RODADA}`;
const EMAIL = `tela.${RODADA.toLowerCase()}@mantech.com.br`;

test.describe.serial("Usuários e acessos (gestor)", () => {
  test("cadastra um funcionário (exige setor)", async ({ page }) => {
    const erros = vigiarErros(page);
    await entrar(page, "gestor");
    await page.goto("/usuarios");
    await page.waitForLoadState("networkidle");
    await page.locator("header").getByRole("button", { name: "Novo usuário" }).click();
    await expect(page.locator("#u-pw")).toHaveValue("senai@123");
    await page.fill("#u-n", NOME);
    await page.fill("#u-e", EMAIL);
    await page.fill("#u-m", `tl${RODADA}`);
    await page.locator(".modal").getByRole("button", { name: "Cadastrar" }).click();
    expect(await toast(page)).toMatch(/setor/i);
    await page.selectOption("#u-s", "Usinagem");
    await page.locator(".modal").getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.locator(".toast-container")).toContainText("cadastrado");
    await expect(page.locator("table")).toContainText(NOME);
    expect(erros).toEqual([]);
  });

  test("busca e filtra", async ({ page }) => {
    await entrar(page, "gestor");
    await page.goto("/usuarios");
    await page.fill("#u-b", RODADA);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("table")).toContainText(NOME);
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await page.selectOption("#u-fp", "tecnico");
    await expect(page.locator("table")).toContainText("Carlos Lima");
    await expect(page.locator("table")).not.toContainText("Ana Souza");
  });

  test("liga e desliga níveis de acesso pelas chaves", async ({ page }) => {
    await entrar(page, "gestor");
    await page.goto("/usuarios");
    await page.fill("#u-b", RODADA);
    await page.locator(`tr:has-text("${NOME}")`).getByRole("button", { name: "Acessos" }).click();
    const tecnico = page.locator("#ac-tecnico");
    await expect(tecnico).not.toBeChecked();
    await tecnico.click();
    await expect(tecnico).toBeChecked();
    expect(await toast(page)).toMatch(/Técnico ligado/);
    // não deixa ficar sem nenhum nível
    await tecnico.click();
    await expect(tecnico).not.toBeChecked();
    await page.locator("#ac-funcionario").click();
    expect(await toast(page)).toMatch(/pelo menos um/);
    await expect(page.locator("#ac-funcionario")).toBeChecked();
    // desliga e religa o acesso ao sistema
    await page.locator("#ac-ativo").click();
    await expect(page.locator("#ac-ativo")).not.toBeChecked();
    await page.locator("#ac-ativo").click();
    await expect(page.locator("#ac-ativo")).toBeChecked();
  });

  test("o gestor não consegue desligar o próprio acesso", async ({ page }) => {
    await entrar(page, "gestor");
    await page.goto("/usuarios");
    await page.locator('tr:has-text("(você)")').getByRole("button", { name: "Acessos" }).click();
    await expect(page.locator("#ac-ativo")).toBeDisabled();
    await expect(page.locator("#ac-gestor")).toBeDisabled();
  });

  test("manda alerta urgente e o técnico recebe no sininho", async ({ page }) => {
    await entrar(page, "tecnico");
    await page.request.patch((process.env.API_URL || "http://localhost:8080/api") + "/notificacoes/lidas", {
      headers: { Authorization: "Bearer " + (await page.evaluate(() => localStorage.getItem("pm_token"))) },
    });
    await entrar(page, "gestor");
    await page.goto("/usuarios");
    await page.locator('tr:has-text("Carlos Lima")').getByRole("button", { name: "Enviar alerta" }).click();
    await page.selectOption("#a-m", "PH-03");
    await expect(page.locator("#a-t")).toHaveValue(/PH-03/);
    await page.fill("#a-x", `Teste automatizado ${RODADA}`);
    await page.locator(".modal").getByRole("button", { name: "Enviar alerta" }).click();
    expect(await toast(page)).toMatch(/Alerta enviado/);

    await entrar(page, "tecnico");
    await expect(page.locator(".pm-sino-n").first()).toHaveText("1");
    await page.locator(".pm-sino").first().click();
    await expect(page.locator(".modal")).toContainText("Urgência na PH-03");
    await page.locator(".pm-aviso").first().click();
    await page.keyboard.press("Escape");
    await expect(page.locator(".pm-sino-n")).toHaveCount(0);
  });

  test("desativa o usuário de teste", async ({ page }) => {
    await entrar(page, "gestor");
    await page.goto("/usuarios");
    await page.fill("#u-b", RODADA);
    await page.locator(`tr:has-text("${NOME}")`).getByRole("button", { name: "Desativar" }).click();
    await page.locator(".modal .btn-danger").click();
    expect(await toast(page)).toMatch(/desativado/);
  });
});
