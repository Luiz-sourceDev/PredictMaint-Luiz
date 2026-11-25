/* Chamados do funcionário: abrir (com e sem foto), comentar, linha do tempo ligada à OS */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { get, post, patch, tokens, status } from "./_util.js";
import { RODADA } from "../config.js";

let T, chamado;
before(async () => { T = await tokens(); });

// PNG de 1x1 pixel, para testar o envio de foto
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("funcionário abre um chamado", async () => {
  const r = await post("/chamados", { token: T.funcionario, body: { maquina: "PH-03", problema: "Ruído anormal", urgencia: "Alta", descricao: `Barulho estranho no teste ${RODADA}` } });
  status(r, 201, "abrir chamado");
  chamado = r.body;
  assert.match(chamado.id, /^CH-\d+/);
  assert.equal(chamado.maquina, "PH-03");
  assert.ok(Array.isArray(chamado.timeline) && chamado.timeline.length > 0, "sem linha do tempo");
});

test("o chamado já vira uma OS no quadro do gestor", async () => {
  const r = await get("/ordens", { token: T.gestor });
  const os = r.body.find((o) => o.titulo.includes(chamado.id));
  assert.ok(os, "não encontrei a OS ligada ao chamado");
  assert.equal(os.prioridade, "alta", "urgência Alta deveria virar prioridade alta");
  // quando a OS anda, a linha do tempo do chamado anda junto
  status(await patch(`/ordens/${os.id}`, { token: T.tecnico, body: { status: "andamento" } }), 200, "mover OS");
  const meus = await get("/chamados", { token: T.funcionario });
  const atual = meus.body.find((c) => c.id === chamado.id);
  assert.notEqual(atual.situacao, chamado.situacao, "a linha do tempo do chamado não andou");
});

test("abre chamado com foto", async () => {
  const form = new FormData();
  form.append("dados", JSON.stringify({ maquina: "SD-01", problema: "Vazamento", urgencia: "Baixa", descricao: "Vazamento com foto (teste)" }));
  form.append("foto", new Blob([PNG], { type: "image/png" }), "foto.png");
  const r = await post("/chamados", { token: T.funcionario, form });
  status(r, 201, "chamado com foto");
  assert.match(r.body.foto || "", /^\/uploads\//, "a foto não foi salva");
  // a foto pode ser aberta pelo endereço da API
  const origem = (process.env.API_URL || "http://localhost:8080/api").replace(/\/api\/?$/, "");
  const img = await fetch(origem + r.body.foto);
  assert.equal(img.status, 200, "a foto não abre pelo endereço");
  assert.match(img.headers.get("content-type") || "", /^image\//);
  // a OS criada pelo chamado leva a mesma foto (gestor e técnico veem)
  const os = (await get("/ordens", { token: T.gestor })).body.find((o) => o.chamado === r.body.id);
  assert.ok(os, "não achei a OS do chamado com foto");
  assert.equal(os.foto, r.body.foto, "a OS não trouxe a foto do chamado");
});

test("recusa foto que não é imagem", async () => {
  const form = new FormData();
  form.append("dados", JSON.stringify({ maquina: "SD-01", descricao: "arquivo errado" }));
  form.append("foto", new Blob(["texto"], { type: "text/plain" }), "nota.txt");
  status(await post("/chamados", { token: T.funcionario, form }), 400, "arquivo .txt");
});

test("recusa chamado sem máquina ou com descrição curta", async () => {
  status(await post("/chamados", { token: T.funcionario, body: { maquina: "PH-03", descricao: "oi" } }), 400, "descrição curta");
  status(await post("/chamados", { token: T.funcionario, body: { maquina: "NAO-EXISTE", descricao: "descrição ok" } }), 400, "máquina errada");
});

test("funcionário comenta no próprio chamado", async () => {
  const r = await post(`/chamados/${chamado.id}/comentarios`, { token: T.funcionario, body: { texto: "Continua fazendo barulho." } });
  status(r, 201, "comentar");
  assert.ok(r.body.comentarios.some((c) => c.texto === "Continua fazendo barulho."));
  status(await post(`/chamados/${chamado.id}/comentarios`, { token: T.funcionario, body: { texto: "" } }), 400, "comentário vazio");
});

test("funcionário só vê os próprios chamados; gestão vê todos", async () => {
  const doGestor = await post("/chamados", { token: T.gestor, body: { maquina: "CP-01", descricao: `Chamado do gestor ${RODADA}` } });
  status(doGestor, 201, "gestor abre chamado");
  const func = await get("/chamados", { token: T.funcionario });
  const gest = await get("/chamados", { token: T.tecnico });
  assert.ok(!func.body.find((c) => c.id === doGestor.body.id), "funcionário viu chamado de outra pessoa");
  assert.ok(gest.body.find((c) => c.id === doGestor.body.id), "técnico deveria ver todos os chamados");
  status(await post(`/chamados/${doGestor.body.id}/comentarios`, { token: T.funcionario, body: { texto: "intruso" } }), 404, "comentar em chamado alheio");
});
