/* Cadastro de máquinas (gestor) */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { get, post, put, del, tokens, status } from "./_util.js";
import { RODADA } from "../config.js";

let T;
const COD = `TST-M${RODADA}`;
before(async () => { T = await tokens(); });
after(async () => { await del(`/maquinas/${COD}`, { token: T.gestor }); });

test("lista as máquinas do exemplo", async () => {
  const r = await get("/maquinas", { token: T.gestor });
  status(r, 200, "lista");
  assert.ok(r.body.length >= 10, "esperava pelo menos 10 máquinas no exemplo");
  assert.ok(r.body.find((m) => m.id === "PH-03"), "PH-03 não apareceu");
});

test("filtra por setor e ordena por saúde", async () => {
  const r = await get("/maquinas?setor=Estamparia&ordem=saude", { token: T.gestor });
  status(r, 200, "filtro");
  assert.ok(r.body.length > 0 && r.body.every((m) => m.setor === "Estamparia"));
  const saudes = r.body.map((m) => m.saude);
  assert.deepEqual(saudes, [...saudes].sort((a, b) => a - b), "não veio em ordem de saúde");
});

for (const st of ["critico", "atencao", "normal"]) {
  test(`filtra por status ${st} (sozinho, com setor e com ordem)`, async () => {
    const so = await get(`/maquinas?status=${st}`, { token: T.gestor });
    status(so, 200, `status=${st}`);
    assert.ok(so.body.length > 0, `nenhuma máquina ${st} no exemplo`);
    assert.ok(so.body.every((m) => m.status === st), "veio máquina de outro status");
    const setor = so.body[0].setor;
    const comSetor = await get(`/maquinas?status=${st}&setor=${encodeURIComponent(setor)}&ordem=codigo`, { token: T.gestor });
    status(comSetor, 200, "status + setor + ordem");
    assert.ok(comSetor.body.length > 0 && comSetor.body.every((m) => m.status === st && m.setor === setor));
  });
}

test("cadastra uma máquina nova", async () => {
  const r = await post("/maquinas", { token: T.gestor, body: { id: COD, nome: "Máquina de teste", setor: "Usinagem", custoParada: 500 } });
  status(r, 201, "cadastro");
  assert.equal(r.body.id, COD);
  assert.equal(r.body.setor, "Usinagem");
});

test("não deixa cadastrar o mesmo código duas vezes", async () => {
  const r = await post("/maquinas", { token: T.gestor, body: { id: COD, nome: "Repetida", setor: "Usinagem" } });
  status(r, 409, "código repetido");
});

test("exige código, nome e setor", async () => {
  status(await post("/maquinas", { token: T.gestor, body: { nome: "Sem código" } }), 400, "sem código");
});

test("mostra o detalhe da máquina", async () => {
  const r = await get(`/maquinas/${COD}`, { token: T.gestor });
  status(r, 200, "detalhe");
  assert.equal(r.body.id ?? r.body.maquina?.id, COD);
});

test("edita nome e saúde", async () => {
  const r = await put(`/maquinas/${COD}`, { token: T.gestor, body: { nome: "Máquina de teste editada", saude: 77 } });
  status(r, 200, "edição");
  assert.equal(r.body.nome, "Máquina de teste editada");
  assert.equal(r.body.saude, 77);
});

test("recusa saúde fora de 0 a 100", async () => {
  status(await put(`/maquinas/${COD}`, { token: T.gestor, body: { saude: 150 } }), 400, "saúde 150");
});

test("desativa a máquina e ela some da lista", async () => {
  status(await del(`/maquinas/${COD}`, { token: T.gestor }), 200, "desativar");
  const r = await get("/maquinas", { token: T.gestor });
  assert.ok(!r.body.find((m) => m.id === COD), "a máquina desativada continua na lista");
});

test("máquina que não existe responde 404", async () => {
  status(await get("/maquinas/NAO-EXISTE-999", { token: T.gestor }), 404, "inexistente");
});
