import { pool } from "../config/database.js";
import { rotuloHa } from "../lib/formato.js";
import { erro400, erro404 } from "../lib/http.js";

export const formatarAlerta = (a) => ({
  id: a.id,
  nivel: a.nivel,
  titulo: a.titulo,
  ativo: a.ativo,
  maquina: a.maquina,
  setor: a.setor,
  ha: rotuloHa(a.min),
  min: a.min,
  estado: a.estado,
  medido: a.medido || "—",
  limite: a.limite || "—",
  previsao: a.previsao || "—",
  acao: a.acao || "",
});

// GET /api/alertas?setor=   (não mostra os já resolvidos)
export async function getAlertas(req, res, next) {
  try {
    const where = ["estado <> 'resolvido'"], valores = [];
    if (req.query.setor) { where.push("setor = ?"); valores.push(req.query.setor); }
    const [rows] = await pool.query(
      `SELECT * FROM vw_alertas WHERE ${where.join(" AND ")}
        ORDER BY FIELD(nivel, 'critico', 'atencao', 'info'), criado_em DESC`,
      valores,
    );
    res.json(rows.map(formatarAlerta));
  } catch (e) {
    next(e);
  }
}

// PATCH /api/alertas/:id/reconhecer
export async function reconhecerAlerta(req, res, next) {
  try {
    const [r] = await pool.query(
      "UPDATE alertas SET estado = 'reconhecido', reconhecido_por = ?, reconhecido_em = NOW() WHERE id = ? AND estado = 'novo'",
      [req.usuario.id, req.params.id],
    );
    const [rows] = await pool.query("SELECT * FROM vw_alertas WHERE id = ?", [req.params.id]);
    if (!rows[0]) throw erro404("Alerta não encontrado.");
    if (!r.affectedRows && rows[0].estado === "resolvido") throw erro400("Este alerta já foi resolvido.");
    res.json(formatarAlerta(rows[0]));
  } catch (e) {
    next(e);
  }
}

// GET /api/limites  -> { vibracao: { nome, limite, atencao, un }, ... }
export async function getLimites(req, res, next) {
  try {
    const [rows] = await pool.query("SELECT * FROM grandezas ORDER BY FIELD(codigo, 'vibracao', 'temperatura', 'corrente')");
    res.json(Object.fromEntries(rows.map((g) => [g.codigo, { nome: g.nome, limite: g.limite_critico, atencao: g.limite_atencao, un: g.unidade }])));
  } catch (e) {
    next(e);
  }
}

// PUT /api/limites  { vibracao: { atencao, limite }, ... }
export async function salvarLimites(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const [grandezas] = await conn.query("SELECT codigo, nome FROM grandezas");
    await conn.beginTransaction();
    for (const g of grandezas) {
      const v = req.body[g.codigo];
      if (!v) continue;
      const atencao = Number(v.atencao), limite = Number(v.limite);
      if (!Number.isFinite(atencao) || !Number.isFinite(limite) || atencao <= 0) {
        throw erro400(`${g.nome}: informe números maiores que zero.`);
      }
      if (atencao >= limite) throw erro400(`${g.nome}: o nível de atenção precisa ser menor que o limite.`);
      await conn.query("UPDATE grandezas SET limite_atencao = ?, limite_critico = ? WHERE codigo = ?", [atencao, limite, g.codigo]);
    }
    await conn.commit();
    conn.release();
    return getLimites(req, res, next);
  } catch (e) {
    await conn.rollback().catch(() => {});
    conn.release();
    next(e);
  }
}
