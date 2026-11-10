import bcrypt from "bcryptjs";

import { pool } from "../config/database.js";
import { erro400, erro404 } from "../lib/http.js";

const PERFIS = ["gestor", "tecnico", "funcionario"];

const SQL_USUARIO = `
  SELECT u.id, u.nome, u.email, u.matricula, s.nome AS setor, u.ativo, u.criado_em,
         GROUP_CONCAT(p.perfil ORDER BY p.perfil) AS perfis
    FROM usuarios u
    LEFT JOIN setores s ON s.id = u.setor_id
    LEFT JOIN usuario_perfis p ON p.usuario_id = u.id`;

// A senha (hash) nunca sai da API
const formatar = (u) => ({ ...u, ativo: !!u.ativo, perfis: u.perfis ? u.perfis.split(",") : [] });

async function buscar(id) {
  const [rows] = await pool.query(`${SQL_USUARIO} WHERE u.id = ? GROUP BY u.id`, [id]);
  return rows[0] ? formatar(rows[0]) : null;
}

function validarPerfis(perfis) {
  const lista = Array.isArray(perfis) ? perfis : perfis ? [perfis] : [];
  if (!lista.length || !lista.every((p) => PERFIS.includes(p))) {
    throw erro400("Informe ao menos um perfil: gestor, tecnico ou funcionario.");
  }
  return [...new Set(lista)];
}

async function idDoSetor(nome) {
  if (!nome) return null;
  const [rows] = await pool.query("SELECT id FROM setores WHERE nome = ?", [nome]);
  if (!rows[0]) throw erro400(`Setor "${nome}" não existe.`);
  return rows[0].id;
}

// Funcionário precisa de setor (é o setor dele que aparece no chamado)
function exigirSetor(perfis, setor) {
  if (perfis.includes("funcionario") && !setor) throw erro400("Escolha o setor do funcionário.");
}

// Nunca deixar o sistema sem nenhum gestor ativo
async function garantirOutroGestor(conn, id) {
  const [[{ n }]] = await conn.query(
    `SELECT COUNT(*) AS n FROM usuarios u JOIN usuario_perfis p ON p.usuario_id = u.id
      WHERE p.perfil = 'gestor' AND u.ativo = TRUE AND u.id <> ?`,
    [id],
  );
  if (!n) throw erro400("Este é o último gestor ativo. Cadastre outro gestor antes.");
}

const validarSenha = (s) => {
  if (String(s || "").length < 6) throw erro400("A senha precisa ter pelo menos 6 caracteres.");
};

// GET /api/users?q=texto&perfil=tecnico&ativo=1
export async function getUsers(req, res, next) {
  try {
    const where = [], valores = [];
    const q = String(req.query.q || "").trim();
    if (q) {
      where.push("(u.nome LIKE ? OR u.email LIKE ? OR u.matricula LIKE ?)");
      valores.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (PERFIS.includes(req.query.perfil)) {
      where.push("u.id IN (SELECT usuario_id FROM usuario_perfis WHERE perfil = ?)");
      valores.push(req.query.perfil);
    }
    if (req.query.ativo === "1" || req.query.ativo === "0") {
      where.push("u.ativo = ?");
      valores.push(req.query.ativo === "1");
    }
    const [rows] = await pool.query(
      `${SQL_USUARIO} ${where.length ? "WHERE " + where.join(" AND ") : ""} GROUP BY u.id ORDER BY u.ativo DESC, u.nome`,
      valores,
    );
    res.json(rows.map(formatar));
  } catch (e) {
    next(e);
  }
}

// POST /api/users  { nome, email, matricula, senha, perfis: ["tecnico"], setor }
export async function createUsers(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { nome, email, matricula, senha, setor } = req.body;
    if (!nome || !email || !matricula) throw erro400("Informe nome, e-mail e matrícula.");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw erro400("E-mail inválido.");
    validarSenha(senha);
    const perfis = validarPerfis(req.body.perfis ?? req.body.perfil);
    exigirSetor(perfis, setor);

    await conn.beginTransaction();
    const [r] = await conn.query(
      "INSERT INTO usuarios (nome, email, matricula, senha_hash, setor_id) VALUES (?, ?, ?, ?, ?)",
      [String(nome).trim(), String(email).trim().toLowerCase(), String(matricula).trim(), await bcrypt.hash(String(senha), 10), await idDoSetor(setor)],
    );
    await conn.query("INSERT INTO usuario_perfis (usuario_id, perfil) VALUES ?", [perfis.map((p) => [r.insertId, p])]);
    await conn.commit();
    res.status(201).json(await buscar(r.insertId));
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally {
    conn.release();
  }
}

// PUT /api/users/:id  (só os campos enviados; senha opcional)
export async function updateUsers(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const atual = await buscar(id);
    if (!atual) throw erro404("Usuário não encontrado.");

    const b = req.body, campos = [], valores = [];
    if (b.nome !== undefined) { campos.push("nome = ?"); valores.push(String(b.nome).trim()); }
    if (b.email !== undefined) { campos.push("email = ?"); valores.push(String(b.email).trim().toLowerCase()); }
    if (b.matricula !== undefined) { campos.push("matricula = ?"); valores.push(String(b.matricula).trim()); }
    if (b.setor !== undefined) { campos.push("setor_id = ?"); valores.push(await idDoSetor(b.setor)); }
    if (b.ativo !== undefined) { campos.push("ativo = ?"); valores.push(!!b.ativo); }
    if (b.senha) { validarSenha(b.senha); campos.push("senha_hash = ?"); valores.push(await bcrypt.hash(String(b.senha), 10)); }
    const perfis = b.perfis !== undefined ? validarPerfis(b.perfis) : null;
    if (!campos.length && !perfis) throw erro400("Nenhum campo para atualizar.");
    exigirSetor(perfis || atual.perfis, b.setor !== undefined ? b.setor : atual.setor);

    const perdeGestor = atual.perfis.includes("gestor") && atual.ativo && ((perfis && !perfis.includes("gestor")) || b.ativo === false);
    if (perdeGestor && id === req.usuario.id) throw erro400("Você não pode tirar o seu próprio acesso de gestor.");
    if (perdeGestor) await garantirOutroGestor(conn, id);

    await conn.beginTransaction();
    if (campos.length) await conn.query(`UPDATE usuarios SET ${campos.join(", ")} WHERE id = ?`, [...valores, id]);
    if (perfis) {
      await conn.query("DELETE FROM usuario_perfis WHERE usuario_id = ?", [id]);
      await conn.query("INSERT INTO usuario_perfis (usuario_id, perfil) VALUES ?", [perfis.map((p) => [id, p])]);
    }
    await conn.commit();
    res.json(await buscar(id));
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally {
    conn.release();
  }
}

// DELETE /api/users/:id  -> desativa (o usuário não consegue mais entrar)
export async function deleteUsers(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (id === req.usuario.id) throw erro400("Você não pode desativar o seu próprio usuário.");
    const atual = await buscar(id);
    if (!atual) throw erro404("Usuário não encontrado.");
    if (atual.perfis.includes("gestor") && atual.ativo) await garantirOutroGestor(pool, id);
    await pool.query("UPDATE usuarios SET ativo = FALSE WHERE id = ?", [id]);
    res.json({ mensagem: "Usuário desativado." });
  } catch (e) {
    next(e);
  }
}
