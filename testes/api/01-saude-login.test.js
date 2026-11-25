/* Saúde do sistema e login */
import { test } from "node:test";
import assert from "node:assert/strict";
import { get, post, status } from "./_util.js";
import { LOGINS, SENHA } from "../config.js";

test("API e banco estão no ar", async () => {
  const r = await get("/health");
  status(r, 200, "health");
  assert.equal(r.body.database, "connected", "a API não conseguiu falar com o banco");
});

for (const [perfil, email] of Object.entries(LOGINS)) {
  test(`login do ${perfil} (${email}) com a senha padrão`, async () => {
    const r = await post("/auth/login", { body: { usuario: email, senha: SENHA, perfil } });
    status(r, 200, "login");
    assert.ok(r.body.token, "não veio token");
    assert.equal(r.body.usuario.perfil, perfil);
  });
}

test("login pela matrícula também funciona", async () => {
  const r = await post("/auth/login", { body: { usuario: "adm001", senha: SENHA, perfil: "gestor" } });
  status(r, 200, "login por matrícula");
});

test("senha errada é recusada", async () => {
  const r = await post("/auth/login", { body: { usuario: LOGINS.gestor, senha: "senha-errada", perfil: "gestor" } });
  status(r, 401, "senha errada");
});

test("usuário não entra num perfil que não tem", async () => {
  const r = await post("/auth/login", { body: { usuario: LOGINS.funcionario, senha: SENHA, perfil: "gestor" } });
  status(r, 403, "funcionário tentando entrar como gestor");
});

test("login sem e-mail ou senha mostra aviso", async () => {
  const r = await post("/auth/login", { body: { usuario: "", senha: "" } });
  status(r, 400, "login vazio");
});

test("pedido de nova senha responde ok", async () => {
  const r = await post("/auth/recuperar", { body: { usuario: LOGINS.tecnico } });
  status(r, 200, "recuperar senha");
});

test("rota protegida sem login é bloqueada", async () => {
  status(await get("/maquinas"), 401, "sem token");
  status(await get("/maquinas", { token: "token-falso" }), 401, "token falso");
});

test("rota que não existe responde 404 (para quem está logado)", async () => {
  const r = await post("/auth/login", { body: { usuario: LOGINS.gestor, senha: SENHA, perfil: "gestor" } });
  status(await get("/rota-que-nao-existe", { token: r.body.token }), 404, "rota inexistente");
});
