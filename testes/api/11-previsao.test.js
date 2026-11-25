/* Ações preditivas: previsão de falha por regressão linear */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { get, post, del, tokens, status } from "./_util.js";
import { RODADA } from "../config.js";
import { regressao, preverGrandeza } from "../../backend/src/lib/regressao.js";

// ---------- a conta (sem servidor) ----------

test("regressão acha a reta exata de pontos alinhados", () => {
  const r = regressao([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }]); // y = 1 + 2x
  assert.equal(r.b, 2);
  assert.equal(r.a, 1);
  assert.equal(r.r2, 1);
});

test("regressão de pontos espalhados tem confiança (R²) baixa", () => {
  const r = regressao([{ x: 0, y: 5 }, { x: 1, y: 1 }, { x: 2, y: 6 }, { x: 3, y: 0 }, { x: 4, y: 5 }]);
  assert.ok(r.r2 < 0.2, `R² deveria ser baixo, veio ${r.r2}`);
});

test("regressão não quebra com leituras no mesmo instante", () => {
  assert.equal(regressao([{ x: 1, y: 2 }, { x: 1, y: 3 }]), null);
});

const G = { codigo: "vibracao", nome: "Vibração", unidade: "mm/s", limite_atencao: 3.8, limite_critico: 4.5 };
const DIA = 86400000, AGORA = Date.UTC(2026, 10, 24, 12);
const serie = (valores) => valores.map((valor, i) => ({ quando: new Date(AGORA - (valores.length - 1 - i) * DIA), valor }));

test("prevê o dia em que a reta cruza o limite crítico", () => {
  // sobe 0,3 por dia e está em 3,65 hoje: chega a 4,5 em 2,8 dias (arredonda para 3)
  const p = preverGrandeza(serie([2.15, 2.45, 2.75, 3.05, 3.35, 3.65]), G, AGORA);
  assert.equal(p.situacao, "critico");
  assert.equal(p.diasCritico, 3);
  assert.equal(p.inclinacao, 0.3);
  assert.equal(p.confianca, 100);
});

test("classifica atenção, longe, estável, acima e poucas leituras", () => {
  assert.equal(preverGrandeza(serie([2.0, 2.1, 2.2, 2.3, 2.4, 2.5]), G, AGORA).situacao, "ok");      // 20 dias
  assert.equal(preverGrandeza(serie([2.9, 3.0, 3.1, 3.2, 3.3, 3.4]), G, AGORA).situacao, "atencao"); // 11 dias
  assert.equal(preverGrandeza(serie([3.0, 2.8, 2.9, 2.7, 2.8, 2.6]), G, AGORA).situacao, "estavel");
  assert.equal(preverGrandeza(serie([3.0, 3.5, 4.0, 4.4, 4.6, 4.8]), G, AGORA).situacao, "acima");
  assert.equal(preverGrandeza(serie([1, 2, 3]), G, AGORA).situacao, "insuficiente");
});

// ---------- pela API ----------

let T, limite;
const COD = `TST-P${RODADA}`;
// Data no formato do formulário (AAAA-MM-DDTHH:MM), horas atrás
const atras = (horas) => {
  const d = new Date(Date.now() - horas * 3600000), z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
};

before(async () => {
  T = await tokens();
  status(await post("/maquinas", { token: T.gestor, body: { id: COD, nome: "Máquina p/ previsão", setor: "Usinagem" } }), 201, "criar máquina");
  limite = Number((await get("/limites", { token: T.gestor })).body.vibracao.limite);
});
after(async () => {
  await del(`/maquinas/${COD}`, { token: T.gestor });
});

test("medições subindo geram alerta preditivo com data e ação", async () => {
  // 6 leituras, uma por dia, subindo 0,3 por dia; a última fica 0,9 abaixo do limite (~3 dias)
  // (a previsão começa a valer a partir da 5ª leitura)
  const criados = [];
  for (let i = 5; i >= 0; i--) {
    const r = await post("/medicoes", { token: T.tecnico, body: { maquina: COD, grandeza: "vibracao", valor: +(limite - 0.9 - i * 0.3).toFixed(2), data: atras(i * 24 + 5) } });
    status(r, 201, "medição");
    if (r.body.alertaPreditivo) criados.push(r.body.alertaPreditivo);
  }
  assert.equal(criados.length, 1, "deveria criar um único alerta preditivo");
  assert.equal(criados[0].nivel, "critico");

  const alertas = (await get("/alertas", { token: T.tecnico })).body.filter((a) => a.ativo === COD && a.titulo.startsWith("Falha prevista"));
  assert.equal(alertas.length, 1, "deveria haver um alerta preditivo");
  assert.match(alertas[0].previsao, /Em ~\d+ dias? \(\d\d\/\d\d\)/);
  assert.match(alertas[0].acao, /rolamentos/);
});

test("previsão da máquina traz a reta, a confiança e os pontos do gráfico", async () => {
  const r = await get(`/maquinas/${COD}/previsao`, { token: T.tecnico });
  status(r, 200, "previsão da máquina");
  const v = r.body.grandezas.find((g) => g.grandeza === "vibracao");
  assert.equal(v.situacao, "critico");
  assert.ok(v.diasCritico >= 2 && v.diasCritico <= 4, `esperava ~3 dias, veio ${v.diasCritico}`);
  assert.ok(Math.abs(v.inclinacao - 0.3) < 0.02, `inclinação ${v.inclinacao}`);
  assert.ok(v.confianca >= 95);
  assert.equal(v.pontos.length, 6);
  assert.equal(r.body.grandezas.find((g) => g.grandeza === "temperatura").situacao, "insuficiente");
  status(await get("/maquinas/NAO-EXISTE/previsao", { token: T.gestor }), 404, "máquina inexistente");
});

test("lista de previsões coloca as máquinas mais urgentes primeiro", async () => {
  const r = await get("/previsoes", { token: T.gestor });
  status(r, 200, "previsões");
  const ordem = ["acima", "critico", "atencao", "ok", "estavel", "insuficiente"];
  const pos = r.body.maquinas.map((m) => ordem.indexOf(m.pior.situacao));
  assert.deepEqual(pos, [...pos].sort((a, b) => a - b), "lista fora de ordem");
  assert.ok(r.body.maquinas.find((m) => m.id === COD), "a máquina de teste não apareceu");
});

test("uma nova leitura do mesmo alerta não duplica, e o técnico e o gestor recebem aviso", async () => {
  status(await post("/medicoes", { token: T.tecnico, body: { maquina: COD, grandeza: "vibracao", valor: +(limite - 0.8).toFixed(2), data: atras(4) } }), 201, "mais uma");
  const alertas = (await get("/alertas", { token: T.gestor })).body.filter((a) => a.ativo === COD && a.titulo.startsWith("Falha prevista"));
  assert.equal(alertas.length, 1, "duplicou o alerta preditivo");
  const caixa = (await get("/notificacoes", { token: T.tecnico })).body.itens;
  assert.ok(caixa.find((n) => n.maquina === COD && n.titulo.startsWith("Falha prevista")), "técnico não recebeu o aviso");
});

test("quando a tendência some, o alerta preditivo é resolvido sozinho", async () => {
  for (let i = 0; i < 6; i++) {
    status(await post("/medicoes", { token: T.tecnico, body: { maquina: COD, grandeza: "vibracao", valor: 0.5, data: atras(3) } }), 201, "leitura baixa");
  }
  const alertas = (await get("/alertas", { token: T.gestor })).body.filter((a) => a.ativo === COD && a.titulo.startsWith("Falha prevista"));
  assert.equal(alertas.length, 0, "o alerta preditivo continuou aberto");
});
