import jwt from "jsonwebtoken";

import "../config/env.js";
import { pool } from "../config/database.js";
import { erro401, erro403 } from "../lib/http.js";

export const JWT_SECRET = process.env.JWT_SECRET || "troque-este-segredo-no-env";

// Exige o token "Authorization: Bearer <token>" gerado no login.
// Depois dele, req.usuario = { id, nome, perfil, setor }.
export async function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization || "").split(" ");
  if (tipo !== "Bearer" || !token) return next(erro401("Faça login para continuar."));
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
  } catch {
    return next(erro401("Sua sessão expirou. Entre de novo."));
  }
  try {
    // Usuário desativado, ou que perdeu o perfil com que entrou, perde o acesso na hora,
    // mesmo com o token ainda válido (o gestor liga e desliga isso na tela Usuários)
    const [rows] = await pool.query(
      `SELECT u.ativo,
              EXISTS(SELECT 1 FROM usuario_perfis p WHERE p.usuario_id = u.id AND p.perfil = ?) AS tem_perfil
         FROM usuarios u WHERE u.id = ?`,
      [req.usuario.perfil, req.usuario.id],
    );
    if (!rows[0] || !rows[0].ativo) return next(erro401("Seu acesso foi desativado. Fale com o gestor."));
    if (!rows[0].tem_perfil) return next(erro401("Seu nível de acesso mudou. Entre de novo."));
    next();
  } catch (e) {
    next(e);
  }
}

// Libera a rota só para alguns perfis. Ex.: permitir("gestor", "tecnico")
export const permitir =
  (...perfis) =>
  (req, res, next) =>
    perfis.includes(req.usuario?.perfil)
      ? next()
      : next(erro403("Seu perfil não tem acesso a esta função."));
