import { pool } from "../config/database.js";
import { dm, dmhm, paraDataHoraSQL } from "../lib/formato.js";
import { erro400, erro404 } from "../lib/http.js";
import { situacaoMedicao, virgula } from "../lib/regras.js";

const SQL_MEDICAO = `
  SELECT me.id, me.medido_em, m.codigo AS maquina, me.grandeza, me.valor, me.observacao,
         g.nome, g.unidade, g.limite_atencao, g.limite_critico
    FROM medicoes me
    JOIN maquinas  m ON m.id = me.maquina_id
    JOIN grandezas g ON g.codigo = me.grandeza`;

const formatarMedicao = (x) => ({
  id: x.id,
  data: dmhm(x.medido_em),
  maquina: x.maquina,
  grandeza: x.grandeza,
  valor: x.valor,
  obs: x.observacao || "",
  nome: x.nome,
  unidade: x.unidade,
  situacao: situacaoMedicao(x.valor, x),
});

// GET /api/medicoes?maquina=&limite=8
export async function getMedicoes(req, res, next) {
  try {
    const limite = Math.min(100, Math.max(1, Number(req.query.limite) || 8));
    const where = req.query.maquina ? "WHERE m.codigo = ?" : "";
    const valores = req.query.maquina ? [req.query.maquina, limite] : [limite];
    const [rows] = await pool.query(`${SQL_MEDICAO} ${where} ORDER BY me.medido_em DESC, me.id DESC LIMIT ?`, valores);
    res.json(rows.map(formatarMedicao));
  } catch (e) {
    next(e);
  }
}

// Série para o gráfico de tendência (últimos 20 pontos, do mais antigo ao mais novo)
export async function serieDe(codigo, grandeza) {
  const [g] = await pool.query("SELECT * FROM grandezas WHERE codigo = ?", [grandeza]);
  const [m] = await pool.query("SELECT id, codigo FROM maquinas WHERE codigo = ?", [codigo]);
  if (!g[0] || !m[0]) throw erro404("Máquina ou grandeza desconhecida.");

  const [pts] = await pool.query(
    `SELECT medido_em, valor FROM (
       SELECT id, medido_em, valor FROM medicoes WHERE maquina_id = ? AND grandeza = ?
        ORDER BY medido_em DESC, id DESC LIMIT 20
     ) t ORDER BY medido_em, id`,
    [m[0].id, grandeza],
  );
  return {
    maquina: m[0].codigo,
    grandeza,
    nome: g[0].nome,
    unidade: g[0].unidade,
    limite: g[0].limite_critico,
    atencao: g[0].limite_atencao,
    pontos: pts.map((p) => ({ x: dm(p.medido_em), y: p.valor })),
  };
}

// GET /api/medicoes/serie?maquina=PH-03&grandeza=vibracao
export async function getSerie(req, res, next) {
  try {
    res.json(await serieDe(req.query.maquina, req.query.grandeza));
  } catch (e) {
    next(e);
  }
}

// POST /api/medicoes  { maquina, grandeza, valor, data (AAAA-MM-DDTHH:MM), obs }
// Se passar do limite crítico, abre um alerta automaticamente.
export async function createMedicao(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const b = req.body;
    const [maq] = await conn.query("SELECT id, codigo FROM maquinas WHERE codigo = ? AND ativo = TRUE", [b.maquina]);
    const [gr] = await conn.query("SELECT * FROM grandezas WHERE codigo = ?", [b.grandeza]);
    if (!maq[0] || !gr[0]) throw erro400("Escolha a máquina e a grandeza.");
    const valor = Number(b.valor);
    if (b.valor === "" || b.valor === null || !Number.isFinite(valor)) throw erro400("O valor precisa ser um número.");
    if (valor < 0 || valor > 999999) throw erro400("O valor está fora da faixa aceita.");

    const m = maq[0], g = gr[0];
    const quando = paraDataHoraSQL(b.data); // vazio = agora
    if (b.data && !quando) throw erro400("Data da medição inválida.");
    if (quando) {
      const [[{ futuro }]] = await conn.query("SELECT ? > NOW() + INTERVAL 5 MINUTE AS futuro", [quando]);
      if (futuro) throw erro400("A data da medição não pode estar no futuro.");
    }
    const situacao = situacaoMedicao(valor, g);

    await conn.beginTransaction();
    const [r] = await conn.query(
      "INSERT INTO medicoes (maquina_id, grandeza, valor, medido_em, observacao, usuario_id) VALUES (?, ?, ?, COALESCE(?, NOW()), ?, ?)",
      [m.id, g.codigo, valor, quando, String(b.obs || "").trim() || null, req.usuario.id],
    );
    await conn.query(
      "UPDATE maquinas SET ultima_medicao = GREATEST(COALESCE(ultima_medicao, '1000-01-01'), COALESCE(?, NOW())) WHERE id = ?",
      [quando, m.id],
    );

    let alertaCriado = false;
    if (situacao === "critico") {
      const titulo = `${g.nome} acima do limite`;
      const [aberto] = await conn.query(
        "SELECT id FROM alertas WHERE maquina_id = ? AND titulo = ? AND estado <> 'resolvido' LIMIT 1",
        [m.id, titulo],
      );
      if (!aberto[0]) {
        await conn.query(
          `INSERT INTO alertas (maquina_id, medicao_id, grandeza, nivel, titulo, valor_medido, valor_limite, previsao, acao)
           VALUES (?, ?, ?, 'critico', ?, ?, ?, 'A calcular', 'Inspecionar a máquina e confirmar a leitura.')`,
          [m.id, r.insertId, g.codigo, titulo, `${virgula(valor)} ${g.unidade}`, `${virgula(g.limite_critico)} ${g.unidade}`],
        );
        alertaCriado = true;
      }
    }
    await conn.commit();

    const [nova] = await pool.query(`${SQL_MEDICAO} WHERE me.id = ?`, [r.insertId]);
    res.status(201).json({ medicao: formatarMedicao(nova[0]), situacao, alertaCriado });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally {
    conn.release();
  }
}
