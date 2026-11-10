import { pool } from "../config/database.js";
import { dmhm } from "../lib/formato.js";
import { erro400, erro404 } from "../lib/http.js";

const SQL = `
  SELECT n.id, n.prioridade, n.titulo, n.mensagem, n.criado_em, n.lida_em,
         m.codigo AS maquina, m.nome AS maquina_nome,
         r.nome AS remetente, d.nome AS destinatario
    FROM notificacoes n
    LEFT JOIN maquinas m ON m.id = n.maquina_id
    LEFT JOIN usuarios r ON r.id = n.remetente_id
    JOIN usuarios d ON d.id = n.destinatario_id`;

const formatar = (n) => ({
  id: n.id,
  prioridade: n.prioridade,
  titulo: n.titulo,
  mensagem: n.mensagem || "",
  maquina: n.maquina,
  maquinaNome: n.maquina_nome,
  de: n.remetente || "Sistema",
  para: n.destinatario,
  quando: dmhm(n.criado_em),
  lida: !!n.lida_em,
});

// GET /api/notificacoes  -> caixa de entrada de quem está logado
export async function minhas(req, res, next) {
  try {
    const [rows] = await pool.query(
      `${SQL} WHERE n.destinatario_id = ? ORDER BY n.lida_em IS NOT NULL, n.criado_em DESC, n.id DESC LIMIT 50`,
      [req.usuario.id],
    );
    res.json({ naoLidas: rows.filter((n) => !n.lida_em).length, itens: rows.map(formatar) });
  } catch (e) {
    next(e);
  }
}

// GET /api/notificacoes/enviadas?usuario=ID  (gestor) -> histórico do que foi enviado
export async function enviadas(req, res, next) {
  try {
    const filtro = Number(req.query.usuario) || null;
    const [rows] = await pool.query(
      `${SQL} ${filtro ? "WHERE n.destinatario_id = ?" : ""} ORDER BY n.criado_em DESC, n.id DESC LIMIT 50`,
      filtro ? [filtro] : [],
    );
    res.json(rows.map(formatar));
  } catch (e) {
    next(e);
  }
}

// POST /api/notificacoes  (gestor) { destinatario: id, maquina: "PH-03", prioridade, titulo, mensagem }
export async function enviar(req, res, next) {
  try {
    const b = req.body;
    const titulo = String(b.titulo || "").trim();
    if (!titulo) throw erro400("Escreva o título do alerta.");
    if (titulo.length > 120) throw erro400("O título pode ter no máximo 120 caracteres.");
    const prioridade = b.prioridade === "urgente" ? "urgente" : "normal";

    const [dest] = await pool.query("SELECT id, nome, ativo FROM usuarios WHERE id = ?", [Number(b.destinatario) || 0]);
    if (!dest[0]) throw erro404("Usuário não encontrado.");
    if (!dest[0].ativo) throw erro400("Este usuário está desativado e não vai ver o alerta.");

    let maquinaId = null;
    if (b.maquina) {
      const [m] = await pool.query("SELECT id FROM maquinas WHERE codigo = ? AND ativo = TRUE", [b.maquina]);
      if (!m[0]) throw erro400("Máquina não encontrada.");
      maquinaId = m[0].id;
    }

    const [r] = await pool.query(
      `INSERT INTO notificacoes (destinatario_id, remetente_id, maquina_id, prioridade, titulo, mensagem)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dest[0].id, req.usuario.id, maquinaId, prioridade, titulo, String(b.mensagem || "").trim().slice(0, 2000) || null],
    );
    const [rows] = await pool.query(`${SQL} WHERE n.id = ?`, [r.insertId]);
    res.status(201).json(formatar(rows[0]));
  } catch (e) {
    next(e);
  }
}

// PATCH /api/notificacoes/:id/lida   e   PATCH /api/notificacoes/lidas (todas)
export async function marcarLida(req, res, next) {
  try {
    const todas = req.params.id === undefined;
    const [r] = await pool.query(
      `UPDATE notificacoes SET lida_em = NOW() WHERE destinatario_id = ? AND lida_em IS NULL ${todas ? "" : "AND id = ?"}`,
      todas ? [req.usuario.id] : [req.usuario.id, Number(req.params.id) || 0],
    );
    res.json({ marcadas: r.affectedRows });
  } catch (e) {
    next(e);
  }
}
