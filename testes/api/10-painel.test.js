/* Telas de visão geral: dashboard, planta, preditivo e busca */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { get, tokens, status } from "./_util.js";

let T;
before(async () => { T = await tokens(); });

test("dashboard traz indicadores, alertas, saúde e OS", async () => {
  const r = await get("/dashboard", { token: T.gestor });
  status(r, 200, "dashboard");
  assert.equal(r.body.kpis.length, 4);
  assert.ok(Array.isArray(r.body.saude) && r.body.saude.length >= 10);
  assert.ok(r.body.osPorStatus && typeof r.body.osPorStatus.abertas === "number");
});

test("planta ao vivo e replay de 6 horas atrás", async () => {
  const agora = await get("/planta", { token: T.tecnico });
  status(agora, 200, "planta");
  assert.ok(agora.body.zonas.length >= 3);
  const antes = await get("/planta?horas=-6", { token: T.tecnico });
  assert.equal(antes.body.horas, -6);
  const resumo = await get("/planta/resumo", { token: T.tecnico });
  assert.ok(resumo.body.criticos + resumo.body.atencao + resumo.body.normais >= 10);
});

test("previsão de vida útil e causas somando 100%", async () => {
  const r = await get("/planta/PH-03/preditivo", { token: T.gestor });
  status(r, 200, "preditivo");
  assert.ok(r.body.rulDias > 0);
  assert.equal(r.body.causas.reduce((s, c) => s + c.pct, 0), 100);
  status(await get("/planta/NAO-EXISTE/preditivo", { token: T.gestor }), 404, "máquina inexistente");
});

test("busca encontra máquina e OS", async () => {
  const r = await get("/busca?q=PH-03", { token: T.gestor });
  status(r, 200, "busca");
  assert.ok(r.body.some((x) => x.tipo === "Máquina"));
});

test("acentos e ç chegam certos do banco (UTF-8)", async () => {
  const setores = (await get("/setores", { token: T.gestor })).body;
  assert.ok(setores.includes("Logística"), `setores com acento errado: ${setores.join(", ")}`);
  const ordens = (await get("/ordens", { token: T.gestor })).body;
  const textos = ordens.map((o) => `${o.titulo} ${o.equipe}`).join(" ");
  assert.match(textos, /Mecânica/, "a palavra Mecânica não veio certa");
  assert.doesNotMatch(textos, /Ã|Â|�/, "apareceu acento quebrado (banco sem UTF-8)");
});
