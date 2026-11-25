/* Orçamento manutenciário (só gestor) */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { get, post, tokens, status } from "./_util.js";

let T, base;
before(async () => { T = await tokens(); });

test("carrega os parâmetros base da máquina", async () => {
  const r = await get("/orcamento/base/PH-03", { token: T.gestor });
  status(r, 200, "base");
  base = r.body;
  assert.equal(base.maquina, "PH-03");
  assert.ok(base.pecas.length > 0 && base.valorHora > 0 && base.custoParadaHora > 0);
});

test("comparativo preventiva x corretiva de todas as máquinas", async () => {
  const r = await get("/orcamento/resumo", { token: T.gestor });
  status(r, 200, "resumo");
  assert.ok(r.body.length >= 10);
  for (const m of r.body) assert.ok(m.corretivo > m.preventivo, `${m.maquina}: corretiva deveria custar mais`);
});

test("salva um orçamento preventivo e o servidor recalcula o total", async () => {
  const r = await post("/orcamento", { token: T.gestor, body: { maquina: "PH-03", tipo: "preventiva", detalhes: base, total: 1 } });
  status(r, 201, "salvar");
  assert.ok(r.body.total > 1, "o servidor não recalculou o total");
  const lista = await get("/orcamento", { token: T.gestor });
  assert.ok(lista.body.length >= 1);
});

test("corretiva sai mais cara que preventiva com os mesmos dados", async () => {
  const p = await post("/orcamento", { token: T.gestor, body: { maquina: "PH-03", tipo: "preventiva", detalhes: base } });
  const c = await post("/orcamento", { token: T.gestor, body: { maquina: "PH-03", tipo: "corretiva", detalhes: base } });
  assert.ok(c.body.total > p.body.total);
});

test("recusa máquina e tipo inválidos", async () => {
  status(await post("/orcamento", { token: T.gestor, body: { maquina: "NAO-EXISTE", tipo: "preventiva", detalhes: base } }), 400, "máquina");
  status(await post("/orcamento", { token: T.gestor, body: { maquina: "PH-03", tipo: "magica", detalhes: base } }), 400, "tipo");
});
