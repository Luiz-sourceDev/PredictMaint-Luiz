import { test, expect } from "@playwright/test";
import { entrar, toast, vigiarErros, fotoGrande, imagemCarregou } from "./_util.js";

test("técnico registra uma medição pela tela", async ({ page }) => {
  const erros = vigiarErros(page);
  await entrar(page, "tecnico");
  await page.goto("/medicoes");
  await page.waitForLoadState("networkidle");
  await page.selectOption("#m-m", "CP-01");
  await page.selectOption("#m-g", "temperatura");
  await page.fill("#m-v", "60");
  await page.getByRole("button", { name: "Salvar medição" }).click();
  expect(await toast(page)).toMatch(/medição|registrad|salv/i);
  expect(erros).toEqual([]);
});

test("técnico move uma OS de status", async ({ page }) => {
  await entrar(page, "tecnico");
  await page.goto("/ordens");
  await page.waitForLoadState("networkidle");
  await page.locator("article").first().click();
  await page.selectOption("#o-s", "andamento");
  await page.getByRole("button", { name: "Atualizar status" }).click();
  expect(await toast(page)).toMatch(/andamento/i);
});

test("funcionário abre um chamado e acompanha", async ({ page }) => {
  const erros = vigiarErros(page);
  await entrar(page, "funcionario");
  await page.selectOption("#c-m", "PH-03");
  await page.getByText("Vazamento", { exact: true }).click();
  await page.getByText("Alta", { exact: true }).click();
  await page.fill("#c-d", "Óleo pingando embaixo da prensa (teste automatizado).");
  await page.getByRole("button", { name: "Enviar chamado" }).click();
  const msg = page.getByText(/Chamado CH-\d+ enviado/);
  await expect(msg).toBeVisible();
  const protocolo = (await msg.innerText()).match(/CH-\d+/)[0];
  await page.getByRole("link", { name: "Acompanhar chamado" }).click();
  await page.waitForURL("**/meus-chamados");
  // o chamado novo aparece no histórico e na linha do tempo, como "Registrado"
  await expect(page.locator("tr", { hasText: protocolo })).toContainText("Vazamento");
  await expect(page.getByText(`${protocolo} · PH-03`)).toBeVisible();
  expect(erros).toEqual([]);
});

test("chamado com foto: a foto aparece para o funcionário e na OS do gestor", async ({ page }) => {
  const erros = vigiarErros(page);
  await entrar(page, "funcionario");
  await page.selectOption("#c-m", "SD-01");
  await page.fill("#c-d", "Vazamento de óleo, segue foto (teste automatizado).");
  // foto de 18 MB: o site precisa reduzir antes de enviar (o servidor aceita até 5 MB)
  await page.locator('input[type=file]').setInputFiles(fotoGrande());
  const previa = page.locator(".pm-foto-previa img");
  await expect(previa).toBeVisible();
  await imagemCarregou(previa);
  await page.getByRole("button", { name: "Enviar chamado" }).click();
  const msg = page.getByText(/Chamado CH-\d+ enviado/);
  await expect(msg).toBeVisible();
  const protocolo = (await msg.innerText()).match(/CH-\d+/)[0];

  // funcionário vê a foto no acompanhamento
  await page.getByRole("link", { name: "Acompanhar chamado" }).click();
  await page.locator("tr", { hasText: protocolo }).click();
  const fotoFunc = page.locator(".pm-foto img");
  await expect(fotoFunc).toBeVisible();
  await imagemCarregou(fotoFunc);

  // gestor vê a mesma foto dentro da OS criada pelo chamado
  await entrar(page, "gestor");
  await page.goto("/ordens");
  await page.waitForLoadState("networkidle");
  await page.locator("article", { hasText: protocolo }).first().click();
  const fotoOS = page.locator(".modal .pm-foto img");
  await expect(fotoOS).toBeVisible();
  await imagemCarregou(fotoOS);
  await expect(page.locator(".modal")).toContainText(protocolo);
  expect(erros).toEqual([]);
});
