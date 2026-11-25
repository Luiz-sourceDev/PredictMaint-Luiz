/* Apoio dos testes de tela */
import { expect } from "@playwright/test";
import { LOGINS, SENHA } from "../config.js";

export const DESTINO = { gestor: "/dashboard", tecnico: "/dashboard", funcionario: "/chamado" };

// Entra no sistema pela tela de login, como uma pessoa faria
// Abre um endereço; se a tela anterior ainda estiver redirecionando, o navegador cancela
// a navegação (ERR_ABORTED): espera assentar e tenta de novo.
async function abrir(page, url) {
  for (let i = 0; i < 3; i++) {
    try { return await page.goto(url); } catch (e) {
      if (!/ERR_ABORTED|interrupted/i.test(String(e)) || i === 2) throw e;
      await page.waitForLoadState("load").catch(() => {});
    }
  }
}

export async function entrar(page, perfil, usuario = LOGINS[perfil], senha = SENHA) {
  await abrir(page, "/");
  await page.evaluate(() => localStorage.clear());
  await abrir(page, "/");
  await page.locator(`label[for=p-${perfil}]`).click();
  await page.fill("#usuario", usuario);
  await page.fill("#senha", senha);
  await page.locator("form button.btn-primary").click();
  await page.waitForURL("**" + DESTINO[perfil]);
  await page.waitForLoadState("networkidle");
}

// Guarda erros de JavaScript e respostas 500 da página
export function vigiarErros(page) {
  const erros = [];
  page.on("pageerror", (e) => erros.push("JS: " + e.message));
  page.on("response", (r) => { if (r.status() >= 500) erros.push(`${r.status()} ${r.url()}`); });
  return erros;
}

export async function toast(page) {
  const t = page.locator(".toast-container .toast").last();
  await expect(t).toBeVisible();
  return (await t.innerText()).trim();
}

// Nenhuma rolagem para o lado (layout quebrado)
export async function semRolagemLateral(page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sobra, "a página está mais larga que a tela").toBeLessThanOrEqual(1);
}

// Gera uma "foto" BMP grande (3000x2000, ~18 MB), maior que o limite de 5 MB do servidor,
// para conferir que o site reduz a foto antes de enviar.
export function fotoGrande() {
  const w = 3000, h = 2000, linha = w * 3, tam = 54 + linha * h;
  const b = Buffer.alloc(tam);
  b.write("BM", 0); b.writeUInt32LE(tam, 2); b.writeUInt32LE(54, 10); b.writeUInt32LE(40, 14);
  b.writeInt32LE(w, 18); b.writeInt32LE(h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = 54 + y * linha + x * 3;
    b[i] = (x * 255 / w) | 0; b[i + 1] = (y * 255 / h) | 0; b[i + 2] = 120;
  }
  return { name: "foto-celular.bmp", mimeType: "image/bmp", buffer: b };
}

// A imagem carregou de verdade (não está quebrada)
export async function imagemCarregou(img) {
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
}
