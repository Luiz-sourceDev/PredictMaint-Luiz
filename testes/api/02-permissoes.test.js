/* Quem pode o quê: confere a tabela de acessos de cada perfil */
import { test, before } from "node:test";
import { get, post, put, chamar, tokens } from "./_util.js";
import assert from "node:assert/strict";

let T;
before(async () => { T = await tokens(); });

// [método, rota, corpo, gestor, técnico, funcionário]  (true = pode usar)
// Para rotas de escrita, um corpo vazio basta: quem pode recebe 400 (validação), quem não pode recebe 403.
const MATRIZ = [
  ["GET", "/dashboard", undefined, true, true, false],
  ["GET", "/planta/resumo", undefined, true, true, false],
  ["GET", "/busca?q=PH", undefined, true, true, false],
  ["GET", "/maquinas", undefined, true, true, true],
  ["GET", "/maquinas/PH-03", undefined, true, true, true],
  ["GET", "/maquinas/PH-03/previsao", undefined, true, true, false],
  ["GET", "/previsoes", undefined, true, true, false],
  ["POST", "/previsoes/avaliar", {}, true, false, false],
  ["POST", "/maquinas", {}, true, false, false],
  ["PUT", "/maquinas/PH-03", {}, true, false, false],
  ["GET", "/medicoes", undefined, true, true, false],
  ["GET", "/medicoes/serie?maquina=PH-03&grandeza=vibracao", undefined, true, true, false],
  ["POST", "/medicoes", {}, true, true, false],
  ["GET", "/alertas", undefined, true, true, true],
  ["GET", "/limites", undefined, true, true, false],
  ["PUT", "/limites", { vibracao: { atencao: 9, limite: 1 } }, true, false, false],
  ["GET", "/ordens", undefined, true, true, false],
  ["POST", "/ordens", {}, true, false, false],
  ["GET", "/orcamento", undefined, true, false, false],
  ["GET", "/orcamento/resumo", undefined, true, false, false],
  ["GET", "/orcamento/base/PH-03", undefined, true, false, false],
  ["POST", "/orcamento", {}, true, false, false],
  ["GET", "/chamados", undefined, true, true, true],
  ["GET", "/setores", undefined, true, true, true],
  ["GET", "/notificacoes", undefined, true, true, true],
  ["GET", "/notificacoes/enviadas", undefined, true, false, false],
  ["POST", "/notificacoes", {}, true, false, false],
  ["GET", "/users", undefined, true, false, false],
  ["POST", "/users", {}, true, false, false],
];

for (const [metodo, rota, corpo, ...pode] of MATRIZ) {
  ["gestor", "tecnico", "funcionario"].forEach((perfil, i) => {
    test(`${perfil} ${pode[i] ? "PODE" : "NÃO pode"} usar ${metodo} ${rota}`, async () => {
      const r = await chamar(metodo, rota, { token: T[perfil], body: corpo });
      if (pode[i]) assert.notEqual(r.status, 403, `${perfil} deveria ter acesso: ${JSON.stringify(r.body)}`);
      else assert.equal(r.status, 403, `${perfil} NÃO deveria ter acesso, veio ${r.status}`);
      assert.ok(r.status < 500, `erro no servidor: ${r.status} ${JSON.stringify(r.body)}`);
    });
  });
}
