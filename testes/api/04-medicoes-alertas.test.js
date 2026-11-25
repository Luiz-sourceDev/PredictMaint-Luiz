/* Medições, alertas automáticos e limites */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { get, post, put, patch, del, tokens, status } from "./_util.js";
import { RODADA } from "../config.js";

let T, limitesOriginais;
const COD = `TST-A${RODADA}`;
before(async () => {
  T = await tokens();
  status(await post("/maquinas", { token: T.gestor, body: { id: COD, nome: "Máquina p/ medições", setor: "Usinagem" } }), 201, "criar máquina");
  limitesOriginais = (await get("/limites", { token: T.gestor })).body;
});
after(async () => {
  await del(`/maquinas/${COD}`, { token: T.gestor });
});

test("técnico registra uma medição normal", async () => {
  const r = await post("/medicoes", { token: T.tecnico, body: { maquina: COD, grandeza: "vibracao", valor: 1.2, obs: "teste automatizado" } });
  status(r, 201, "medição normal");
  assert.equal(r.body.situacao, "normal");
  assert.equal(r.body.alertaCriado, false);
});

test("medição acima do limite cria alerta automaticamente", async () => {
  const limite = limitesOriginais.vibracao.limite;
  const r = await post("/medicoes", { token: T.tecnico, body: { maquina: COD, grandeza: "vibracao", valor: limite + 2 } });
  status(r, 201, "medição crítica");
  assert.equal(r.body.situacao, "critico");
  assert.equal(r.body.alertaCriado, true, "não criou alerta");
});

test("segunda leitura crítica não duplica o alerta aberto", async () => {
  const limite = limitesOriginais.vibracao.limite;
  const r = await post("/medicoes", { token: T.tecnico, body: { maquina: COD, grandeza: "vibracao", valor: limite + 3 } });
  status(r, 201, "segunda crítica");
  assert.equal(r.body.alertaCriado, false, "duplicou o alerta");
});

test("o alerta aparece na lista e o técnico reconhece", async () => {
  const lista = await get("/alertas", { token: T.tecnico });
  status(lista, 200, "lista de alertas");
  const meu = lista.body.find((a) => a.ativo === COD || String(a.ativo).startsWith(COD));
  assert.ok(meu, "o alerta da máquina de teste não apareceu");
  const r = await patch(`/alertas/${meu.id}/reconhecer`, { token: T.tecnico });
  status(r, 200, "reconhecer");
});

test("medição recusa valor inválido, máquina errada e data no futuro", async () => {
  status(await post("/medicoes", { token: T.tecnico, body: { maquina: COD, grandeza: "vibracao", valor: "abc" } }), 400, "valor texto");
  status(await post("/medicoes", { token: T.tecnico, body: { maquina: COD, grandeza: "vibracao", valor: -1 } }), 400, "valor negativo");
  status(await post("/medicoes", { token: T.tecnico, body: { maquina: "NAO-EXISTE", grandeza: "vibracao", valor: 1 } }), 400, "máquina errada");
  const amanha = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 16);
  status(await post("/medicoes", { token: T.tecnico, body: { maquina: COD, grandeza: "vibracao", valor: 1, data: amanha } }), 400, "futuro");
});

test("lista as últimas medições e a série do gráfico", async () => {
  const r = await get(`/medicoes?maquina=${COD}&limite=10`, { token: T.gestor });
  status(r, 200, "últimas medições");
  assert.ok(r.body.length >= 3, "esperava as 3 medições registradas");
  const s = await get(`/medicoes/serie?maquina=PH-03&grandeza=vibracao`, { token: T.gestor });
  status(s, 200, "série");
  assert.ok(Array.isArray(s.body.pontos) && s.body.pontos.length > 0, "série sem pontos");
});

test("lê os limites das 3 grandezas", async () => {
  for (const g of ["vibracao", "temperatura", "corrente"]) {
    assert.ok(limitesOriginais[g], `faltou ${g}`);
    assert.ok(limitesOriginais[g].atencao < limitesOriginais[g].limite);
  }
});

test("gestor salva limites e o sistema recusa atenção maior que o limite", async () => {
  const v = limitesOriginais.vibracao;
  status(await put("/limites", { token: T.gestor, body: { vibracao: { atencao: v.limite + 1, limite: v.limite } } }), 400, "atenção > limite");
  const r = await put("/limites", { token: T.gestor, body: { vibracao: { atencao: v.atencao, limite: v.limite } } });
  status(r, 200, "salvar os mesmos valores");
  assert.equal(Number(r.body.vibracao.limite), Number(v.limite));
});
