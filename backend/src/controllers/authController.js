import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { pool } from "../config/database.js";
import { erro400, erro401, erro403 } from "../lib/http.js";
import { JWT_SECRET } from "../middlewares/auth.js";

// POST /api/auth/login  { usuario (e-mail ou matrícula), senha, perfil, manter }
export async function login(req, res, next) {
  try {
    const usuario = String(req.body.usuario || "").trim().toLowerCase();
    const { senha, perfil, manter } = req.body;
    if (!usuario || !senha) throw erro400("Preencha e-mail (ou matrícula) e senha.");

    const [rows] = await pool.query(
      `SELECT u.id, u.nome, u.email, u.senha_hash, s.nome AS setor,
              GROUP_CONCAT(p.perfil) AS perfis
         FROM usuarios u
         LEFT JOIN setores s ON s.id = u.setor_id
         LEFT JOIN usuario_perfis p ON p.usuario_id = u.id
        WHERE u.ativo = TRUE AND (LOWER(u.email) = ? OR LOWER(u.matricula) = ?)
        GROUP BY u.id`,
      [usuario, usuario],
    );
    const u = rows[0];
    if (!u || !(await bcrypt.compare(String(senha), u.senha_hash))) {
      throw erro401("E-mail ou senha incorretos.");
    }

    const perfis = (u.perfis || "").split(",");
    const escolhido = perfil || perfis[0];
    if (!perfis.includes(escolhido)) throw erro403(`Este usuário não tem acesso ao perfil ${escolhido}.`);

    const setor = escolhido === "funcionario" ? u.setor || "Estamparia" : null;
    const token = jwt.sign({ id: u.id, nome: u.nome, perfil: escolhido, setor }, JWT_SECRET, {
      expiresIn: manter ? "30d" : "10h",
    });

    res.json({ token, usuario: { nome: u.nome, email: u.email, perfil: escolhido, setor } });
  } catch (e) {
    next(e);
  }
}

// POST /api/auth/recuperar  { usuario }
// Não envia e-mail: registra o pedido no log para o administrador redefinir a senha.
export async function recuperarSenha(req, res) {
  const usuario = String(req.body.usuario || "").trim();
  if (usuario) console.log(`[recuperar senha] pedido para: ${usuario}`);
  res.json({ ok: true });
}
