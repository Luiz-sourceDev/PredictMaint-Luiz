/* Ordens de serviço: gestor cria e muda tudo; técnico só muda o status */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { get, post, patch, del, tokens, status } from "./_util.js";
import { RODADA } from "../config.js";

let T, os;
const COD = `TST-O${RODADA}`;
before(async () => {
  T = await tokens();
  status(await post("/maquinas", { token: T.gestor, body: { id: COD, nome: "Máquina p/ OS", setor: "Estamparia" } }), 201, "criar máquina");
});
after(async () => {
  if (os) await patch(`/ordens/${os.id}`, { token: T.gestor, body: { status: "concluida" } });
  await del(`/maquinas/${COD}`, { token: T.gestor });
});

test("gestor abre uma OS", async () => {
  const r = await post("/ordens", { token: T.gestor, body: { titulo: `Teste automatizado ${RODADA}`, ativo: COD, prioridade: "alta", descricao: "criada pelo teste" } });
  status(r, 201, "criar OS");
  os = r.body;
  assert.match(os.id, /^OS-\d+/);
  assert.equal(os.status, "aberta");
  assert.equal(os.prioridade, "alta");
  assert.equal(os.equipe, "Mecânica", "a equipe padrão da Estamparia é Mecânica");
});

test("OS sem título ou com prioridade errada é recusada", async () => {
  status(await post("/ordens", { token: T.gestor, body: { ativo: COD } }), 400, "sem título");
  status(await post("/ordens", { token: T.gestor, body: { titulo: "x", ativo: COD, prioridade: "urgentissima" } }), 400, "prioridade");
});

test("a OS aparece no quadro e no filtro por prioridade", async () => {
  const r = await get("/ordens?prioridade=alta", { token: T.tecnico });
  status(r, 200, "quadro");
  assert.ok(r.body.find((o) => o.id === os.id), "a OS não apareceu no quadro");
});

test("técnico move a OS para andamento", async () => {
  const r = await patch(`/ordens/${os.id}`, { token: T.tecnico, body: { status: "andamento" } });
  status(r, 200, "técnico muda status");
  assert.equal(r.body.status, "andamento");
});

test("técnico NÃO pode mudar prazo, prioridade nem equipe", async () => {
  status(await patch(`/ordens/${os.id}`, { token: T.tecnico, body: { prazo: "2030-01-01" } }), 403, "prazo");
  status(await patch(`/ordens/${os.id}`, { token: T.tecnico, body: { prioridade: "baixa" } }), 403, "prioridade");
  status(await patch(`/ordens/${os.id}`, { token: T.tecnico, body: { equipe: "Elétrica" } }), 403, "equipe");
});

test("gestor muda prioridade, equipe e prazo", async () => {
  const r = await patch(`/ordens/${os.id}`, { token: T.gestor, body: { prioridade: "media", equipe: "Elétrica", prazo: "2030-01-15" } });
  status(r, 200, "gestor edita");
  assert.equal(r.body.prioridade, "media");
  assert.equal(r.body.equipe, "Elétrica");
});

test("status inválido e OS inexistente são recusados", async () => {
  status(await patch(`/ordens/${os.id}`, { token: T.gestor, body: { status: "voando" } }), 400, "status inválido");
  status(await patch("/ordens/OS-999999", { token: T.gestor, body: { status: "aberta" } }), 404, "OS inexistente");
});

test("conclui a OS", async () => {
  const r = await patch(`/ordens/${os.id}`, { token: T.tecnico, body: { status: "concluida" } });
  status(r, 200, "concluir");
  assert.equal(r.body.status, "concluida");
});
