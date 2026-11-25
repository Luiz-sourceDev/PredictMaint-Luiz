/* Testes de tela (navegador robô) */
import { defineConfig, devices } from "@playwright/test";
import { SITE_URL } from "./config.js";

// No Windows usa o Microsoft Edge que já vem instalado (não precisa baixar navegador).
// Outro navegador: set PW_CHANNEL=chrome    |    caminho manual: set CHROME_PATH=C:\...\chrome.exe
// PW_CHANNEL=chromium usa o Chromium do próprio Playwright (npx playwright install chromium).
const pedido = process.env.PW_CHANNEL || (process.platform === "win32" ? "msedge" : "");
const channel = pedido && pedido !== "chromium" ? pedido : undefined;
const executablePath = process.env.CHROME_PATH || undefined;

export default defineConfig({
  testDir: "./telas",
  workers: 1,                // um de cada vez: os testes mexem no mesmo banco
  fullyParallel: false,
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "relatorio-telas", open: "never" }]],
  use: {
    baseURL: SITE_URL,
    channel,
    launchOptions: executablePath ? { executablePath, args: ["--no-sandbox"] } : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    locale: "pt-BR",
    // O servidor do SENAI usa certificado próprio ("Não seguro"): aceita nos testes.
    ignoreHTTPSErrors: true,
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    { name: "computador", use: { viewport: { width: 1366, height: 860 } }, testIgnore: /celular\.spec\.js/ },
    { name: "celular", use: { ...devices["Pixel 7"], channel, launchOptions: executablePath ? { executablePath, args: ["--no-sandbox"] } : {} }, testMatch: /celular\.spec\.js/ },
  ],
});
