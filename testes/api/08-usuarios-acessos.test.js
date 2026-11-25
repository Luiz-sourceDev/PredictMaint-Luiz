/* Usuários e níveis de acesso (tela Usuários do gestor) */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { get, post, put, del, entrar, tokens, status } from "./_util.js";
import { RODADA, SENHA } from "../config.js";

let T, novo;
const EMAIL = `teste.${RODADA.toLowerCase()}@mantech.com.br`;
before(async () => { T = await tokens(); });
after(async () => { if (novo) await del(`/users/${novo.id}`, { token: T.gestor }); });

test("lista, busca e filtra usuários", async () => {
  const todos = await get("/users", { token: T.gestor });
  status(todos, 200, "lista");
  assert.ok(todos.body.length >= 3);
  const busca = await get("/users?q=carl", { token: T.gestor });
  assert.ok(busca.body.length >= 1 && busca.body.every((u) => /carl/i.test(u.nome + u.email + u.matricula)), "a busca trouxe gente errada");
  const tecnicos = await get("/users?perfil=tecnico", { token: T.gestor });
  assert.ok(tecnicos.body.every((u) => u.perfis.includes("tecnico")), "o filtro de perfil falhou");
});

test("lista os setores para o formulário", async () => {
  const r = await get("/setores", { token: T.funcionario });
  status(r, 200, "setores");
  assert.ok(r.body.includes("Usinagem"));
});

test("funcionário novo precisa de setor; e-mail inválido é recusado", async () => {
  status(await post("/users", { token: T.gestor, body: { nome: "Sem Setor", email: `x${EMAIL}`, matricula: `x${RODADA}`, senha: SENHA, perfis: ["funcionario"] } }), 400, "sem setor");
  status(await post("/users", { token: T.gestor, body: { nome: "Email Ruim", email: "nao-e-email", matricula: `y${RODADA}`, senha: SENHA, perfis: ["tecnico"] } }), 400, "e-mail");
  status(await post("/users", { token: T.gestor, body: { nome: "Senha Curta", email: `z${EMAIL}`, matricula: `z${RODADA}`, senha: "123", perfis: ["tecnico"] } }), 400, "senha curta");
});

test("cadastra um funcionário e ele já consegue entrar", async () => {
  const r = await post("/users", { token: T.gestor, body: { nome: `Teste ${RODADA}`, email: EMAIL, matricula: `t${RODADA}`, senha: SENHA, perfis: ["funcionario"], setor: "Usinagem" } });
  status(r, 201, "cadastro");
  novo = r.body;
  assert.deepEqual(novo.perfis, ["funcionario"]);
  await entrar("funcionario", EMAIL);
});

test("e-mail repetido é recusado", async () => {
  status(await post("/users", { token: T.gestor, body: { nome: "Repetido", email: EMAIL, matricula: `r${RODADA}`, senha: SENHA, perfis: ["tecnico"] } }), 409, "repetido");
});

test("chave liga/desliga: ligar o nível Técnico libera o login como técnico", async () => {
  status(await post("/auth/login", { body: { usuario: EMAIL, senha: SENHA, perfil: "tecnico" } }), 403, "antes de ligar");
  const r = await put(`/users/${novo.id}`, { token: T.gestor, body: { perfis: ["funcionario", "tecnico"] } });
  status(r, 200, "ligar técnico");
  await entrar("tecnico", EMAIL);
});

test("desligar um nível derruba na hora quem está usando esse nível", async () => {
  const tokenTecnico = await entrar("tecnico", EMAIL);
  status(await get("/dashboard", { token: tokenTecnico }), 200, "técnico usando");
  status(await put(`/users/${novo.id}`, { token: T.gestor, body: { perfis: ["funcionario"] } }), 200, "desligar técnico");
  status(await get("/dashboard", { token: tokenTecnico }), 401, "sessão antiga de técnico");
});

test("não deixa a pessoa sem nenhum nível", async () => {
  status(await put(`/users/${novo.id}`, { token: T.gestor, body: { perfis: [] } }), 400, "sem nível");
});

test("desligar o acesso ao sistema bloqueia o login e derruba a sessão", async () => {
  const tk = await entrar("funcionario", EMAIL);
  status(await del(`/users/${novo.id}`, { token: T.gestor }), 200, "desativar");
  status(await get("/chamados", { token: tk }), 401, "sessão aberta");
  status(await post("/auth/login", { body: { usuario: EMAIL, senha: SENHA, perfil: "funcionario" } }), 401, "login desativado");
  const inativos = await get("/users?ativo=0", { token: T.gestor });
  assert.ok(inativos.body.find((u) => u.id === novo.id), "não aparece entre os desativados");
});

test("reativa o usuário", async () => {
  status(await put(`/users/${novo.id}`, { token: T.gestor, body: { ativo: true } }), 200, "reativar");
  await entrar("funcionario", EMAIL);
});

test("edita nome e troca a senha", async () => {
  const r = await put(`/users/${novo.id}`, { token: T.gestor, body: { nome: `Teste Editado ${RODADA}`, senha: "outra@123" } });
  status(r, 200, "editar");
  assert.equal(r.body.nome, `Teste Editado ${RODADA}`);
  await entrar("funcionario", EMAIL, "outra@123");
});

test("proteções do gestor: não se desativa nem tira o próprio acesso de gestor", async () => {
  const eu = (await get("/users?q=admin@mantech", { token: T.gestor })).body[0];
  status(await del(`/users/${eu.id}`, { token: T.gestor }), 400, "auto-desativar");
  status(await put(`/users/${eu.id}`, { token: T.gestor, body: { perfis: ["tecnico"] } }), 400, "tirar o próprio gestor");
  status(await put(`/users/${eu.id}`, { token: T.gestor, body: { ativo: false } }), 400, "desligar o próprio acesso");
});

test("usuário inexistente responde 404", async () => {
  status(await put("/users/999999", { token: T.gestor, body: { nome: "x" } }), 404, "inexistente");
});
