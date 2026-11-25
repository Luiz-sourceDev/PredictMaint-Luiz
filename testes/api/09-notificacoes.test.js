/* Avisos do gestor (sininho) */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { get, post, patch, tokens, status } from "./_util.js";
import { RODADA } from "../config.js";

let T, tecnicoId, aviso;
before(async () => {
  T = await tokens();
  tecnicoId = (await get("/users?q=tecnico@mantech", { token: T.gestor })).body[0].id;
  await patch("/notificacoes/lidas", { token: T.tecnico }); // começa com a caixa limpa
});

test("gestor manda alerta urgente sobre uma máquina para o técnico", async () => {
  const r = await post("/notificacoes", { token: T.gestor, body: { destinatario: tecnicoId, maquina: "PH-03", prioridade: "urgente", titulo: `Urgência na PH-03 ${RODADA}`, mensagem: "Inspecione os mancais hoje." } });
  status(r, 201, "enviar");
  aviso = r.body;
  assert.equal(aviso.prioridade, "urgente");
  assert.equal(aviso.maquina, "PH-03");
});

test("o técnico vê o aviso como não lido", async () => {
  const r = await get("/notificacoes", { token: T.tecnico });
  status(r, 200, "caixa");
  assert.ok(r.body.naoLidas >= 1);
  assert.ok(r.body.itens.find((n) => n.id === aviso.id && !n.lida));
});

test("outra pessoa não consegue marcar o aviso do técnico", async () => {
  const r = await patch(`/notificacoes/${aviso.id}/lida`, { token: T.funcionario });
  status(r, 200, "marcar alheio");
  assert.equal(r.body.marcadas, 0, "marcou aviso de outra pessoa");
});

test("técnico marca como lido", async () => {
  const r = await patch(`/notificacoes/${aviso.id}/lida`, { token: T.tecnico });
  assert.equal(r.body.marcadas, 1);
  const caixa = await get("/notificacoes", { token: T.tecnico });
  assert.ok(caixa.body.itens.find((n) => n.id === aviso.id).lida);
});

test("marcar todos como lidos zera o contador", async () => {
  await post("/notificacoes", { token: T.gestor, body: { destinatario: tecnicoId, prioridade: "normal", titulo: `Aviso normal ${RODADA}` } });
  status(await patch("/notificacoes/lidas", { token: T.tecnico }), 200, "todas");
  assert.equal((await get("/notificacoes", { token: T.tecnico })).body.naoLidas, 0);
});

test("gestor vê o histórico de avisos enviados para a pessoa", async () => {
  const r = await get(`/notificacoes/enviadas?usuario=${tecnicoId}`, { token: T.gestor });
  status(r, 200, "enviadas");
  assert.ok(r.body.find((n) => n.id === aviso.id));
});

test("recusa aviso sem título, máquina inexistente ou destinatário que não existe", async () => {
  status(await post("/notificacoes", { token: T.gestor, body: { destinatario: tecnicoId, titulo: "" } }), 400, "sem título");
  status(await post("/notificacoes", { token: T.gestor, body: { destinatario: tecnicoId, titulo: "x", maquina: "NAO-EXISTE" } }), 400, "máquina");
  status(await post("/notificacoes", { token: T.gestor, body: { destinatario: 999999, titulo: "x" } }), 404, "destinatário");
});
