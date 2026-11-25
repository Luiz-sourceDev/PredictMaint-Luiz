/* Funções de apoio dos testes da API (sem bibliotecas extras: usa o fetch do Node 18+). */
import assert from "node:assert/strict";
import { API_URL, LOGINS, SENHA } from "../config.js";

// Chama a API e devolve { status, body }
export async function chamar(metodo, caminho, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const r = await fetch(API_URL + caminho, { method: metodo, headers, body: payload });
  const texto = await r.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = texto; }
  return { status: r.status, body: json };
}

export const get = (c, o) => chamar("GET", c, o);
export const post = (c, o) => chamar("POST", c, o);
export const put = (c, o) => chamar("PUT", c, o);
export const patch = (c, o) => chamar("PATCH", c, o);
export const del = (c, o) => chamar("DELETE", c, o);

// Login e devolve o token
export async function entrar(perfil, usuario = LOGINS[perfil], senha = SENHA) {
  const r = await post("/auth/login", { body: { usuario, senha, perfil } });
  assert.equal(r.status, 200, `login de ${usuario} como ${perfil} falhou: ${JSON.stringify(r.body)}`);
  return r.body.token;
}

// Tokens dos 3 perfis de exemplo (feitos uma vez por arquivo)
export async function tokens() {
  return {
    gestor: await entrar("gestor"),
    tecnico: await entrar("tecnico"),
    funcionario: await entrar("funcionario"),
  };
}

// Confere o código HTTP mostrando a resposta se der errado
export function status(r, esperado, contexto = "") {
  assert.equal(r.status, esperado, `${contexto} -> esperava ${esperado}, veio ${r.status}: ${JSON.stringify(r.body)}`);
}
