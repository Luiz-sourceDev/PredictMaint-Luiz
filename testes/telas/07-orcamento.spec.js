/* Tela de orçamento: 3 passos à esquerda, resultado na hora à direita */
import { test, expect } from "@playwright/test";
import { entrar, vigiarErros, toast } from "./_util.js";

const valor = (t) => Number(t.replace(/[^\d,]/g, "").replace(",", "."));

test.describe("Orçamento manutenciário", () => {
  test("monta, compara, salva e gera OS", async ({ page }) => {
    const erros = vigiarErros(page);
    await entrar(page, "gestor");
    await page.goto("/orcamento");

    await expect(page.getByRole("heading", { name: "Montar orçamento" })).toBeVisible();
    for (const p of ["Qual máquina e tipo de serviço?", "Mão de obra", "Peças e parada"])
      await expect(page.getByRole("heading", { name: p })).toBeVisible();

    const total = page.locator(".pm-total");
    await expect(total).toContainText("R$");
    const agora = page.locator(".pm-cmp.ok b"), quebra = page.locator(".pm-cmp.bad b");
    expect(valor(await quebra.innerText())).toBeGreaterThan(valor(await agora.innerText()));
    await expect(page.locator(".pm-economia")).toContainText("economiza");

    // Mudar a mão de obra muda o total na hora
    const antes = await total.innerText();
    await page.fill("#o-tecnicos", "5");
    await expect(total).not.toHaveText(antes);

    // Corretiva mostra o mesmo valor de "Esperar quebrar"
    await page.locator("label[for=tp-corretiva]").click();
    await expect(page.getByText("Total da manutenção corretiva")).toBeVisible();
    await expect(total).toHaveText(await quebra.innerText());

    // Peça nova entra na lista
    await page.getByRole("button", { name: "+ Adicionar peça" }).click();
    await page.getByLabel("Nome da peça").fill("Correia de teste");
    await page.getByLabel("Valor unitário em reais").fill("100");
    await page.getByRole("button", { name: "Pronto" }).click();
    await expect(page.locator(".pm-peca", { hasText: "Correia de teste" })).toBeVisible();

    await page.getByRole("button", { name: "Salvar orçamento" }).click();
    expect(await toast(page)).toMatch(/ORC-\d+ salvo/);
    await expect(page.getByTestId("ultimos-salvos")).toContainText("corretiva");

    await page.getByRole("button", { name: "Gerar OS" }).click();
    await expect(page.locator(".toast-container .toast", { hasText: /OS-\d+ criada/ })).toBeVisible();

    // A comparação de todas as máquinas continua disponível
    await page.getByText("Comparar todas as máquinas").click();
    await expect(page.locator("tfoot")).toContainText("Planta inteira");

    await page.setViewportSize({ width: 1366, height: 900 });
    expect(erros).toEqual([]);
  });
});
