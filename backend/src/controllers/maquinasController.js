import { pool } from "../config/database.js";
import { dm, dmhm, paraDataSQL, rotuloQuando } from "../lib/formato.js";
import { erro400, erro404, erro409 } from "../lib/http.js";
import { situacaoMedicao } from "../lib/regras.js";
import { formatarOS, SQL_OS } from "./ordensController.js";

// Linha da vw_maquinas -> formato do front
export const formatarMaquina = (m) => ({
  id: m.id,
  nome: m.nome,
  setor: m.setor,
  saude: m.saude,
  status: m.status,
  ultima: rotuloQuando(m.ultima_medicao),
  prox: dm(m.prox),
  custoParada: m.custoParada,
  tend: m.tend,
});

export async function buscarMaquina(codigo) {
  const [rows] = await pool.query("SELECT * FROM vw_maquinas WHERE id = ?", [codigo]);
  return rows[0] || null;
}

// Acha o setor pelo nome; se não existir, cria (a tela permite digitar um setor novo)
async function idDoSetor(nome) {
  const [rows] = await pool.query("SELECT id FROM setores WHERE nome = ?", [nome]);
  if (rows[0]) return rows[0].id;
  const [r] = await pool.query("INSERT INTO setores (nome) VALUES (?)", [nome]);
  return r.insertId;
}

// GET /api/maquinas?setor=&status=&ordem=saude|codigo|setor
export async function getMaquinas(req, res, next) {
  try {
    const { setor, status, ordem } = req.query;
    const filtros = [], valores = [];
    if (setor) { filtros.push("setor = ?"); valores.push(setor); }
    if (status) { filtros.push("status = ?"); valores.push(status); }
    const where = filtros.length ? "WHERE " + filtros.join(" AND ") : "";
    const orderBy = { codigo: "id", setor: "setor, id" }[ordem] || "saude, id";

    const [rows] = await pool.query(`SELECT * FROM vw_maquinas ${where} ORDER BY ${orderBy}`, valores);
    res.json(rows.map(formatarMaquina));
  } catch (e) {
    next(e);
  }
}

// GET /api/maquinas/:id   (id = código, ex.: PH-03)
export async function getMaquina(req, res, next) {
  try {
    const m = await buscarMaquina(req.params.id);
    if (!m) throw erro404("Máquina não encontrada.");

    const [medicoes] = await pool.query(
      `SELECT me.id, me.medido_em, me.grandeza, me.valor, me.observacao,
              g.nome, g.unidade, g.limite_atencao, g.limite_critico
         FROM medicoes me JOIN grandezas g ON g.codigo = me.grandeza
        WHERE me.maquina_id = ? ORDER BY me.medido_em DESC, me.id DESC LIMIT 5`,
      [m.maquina_id],
    );
    const [ordens] = await pool.query(`${SQL_OS} WHERE o.maquina_id = ? AND o.status <> 'concluida' ORDER BY o.prazo`, [m.maquina_id]);

    res.json({
      ...formatarMaquina(m),
      medicoes: medicoes.map((x) => ({
        id: x.id,
        data: dmhm(x.medido_em),
        maquina: m.id,
        grandeza: x.grandeza,
        valor: x.valor,
        obs: x.observacao || "",
        nome: x.nome,
        unidade: x.unidade,
        situacao: situacaoMedicao(x.valor, x),
      })),
      ordens: ordens.map(formatarOS),
    });
  } catch (e) {
    next(e);
  }
}

// POST /api/maquinas  { id (código), nome, setor, prox (AAAA-MM-DD), custoParada }
export async function createMaquina(req, res, next) {
  try {
    const codigo = String(req.body.id || req.body.codigo || "").trim().toUpperCase();
    const nome = String(req.body.nome || "").trim();
    const setor = String(req.body.setor || "").trim();
    if (!codigo || !nome || !setor) throw erro400("Informe código, nome e setor.");
    if (codigo.length > 20) throw erro400("O código pode ter no máximo 20 caracteres.");

    const [existe] = await pool.query("SELECT ativo FROM maquinas WHERE codigo = ?", [codigo]);
    if (existe[0]) throw erro409(`Já existe uma máquina com o código ${codigo}.`);

    const custo = Math.max(0, Number(req.body.custoParada) || 0);
    await pool.query(
      `INSERT INTO maquinas (codigo, nome, setor_id, saude, custo_parada_hora, proxima_manutencao)
       VALUES (?, ?, ?, 100, ?, ?)`,
      [codigo, nome, await idDoSetor(setor), custo, paraDataSQL(req.body.prox)],
    );
    res.status(201).json(formatarMaquina(await buscarMaquina(codigo)));
  } catch (e) {
    next(e);
  }
}

// PUT /api/maquinas/:id   (atualiza só os campos enviados)
export async function updateMaquina(req, res, next) {
  try {
    const m = await buscarMaquina(req.params.id);
    if (!m) throw erro404("Máquina não encontrada.");

    const b = req.body, campos = [], valores = [];
    if (b.nome !== undefined) { campos.push("nome = ?"); valores.push(String(b.nome).trim()); }
    if (b.setor !== undefined) { campos.push("setor_id = ?"); valores.push(await idDoSetor(String(b.setor).trim())); }
    if (b.saude !== undefined) {
      const s = Number(b.saude);
      if (!Number.isInteger(s) || s < 0 || s > 100) throw erro400("A saúde precisa ser um número inteiro de 0 a 100.");
      campos.push("saude = ?"); valores.push(s);
    }
    if (b.prox !== undefined) { campos.push("proxima_manutencao = ?"); valores.push(paraDataSQL(b.prox)); }
    if (b.custoParada !== undefined) { campos.push("custo_parada_hora = ?"); valores.push(Math.max(0, Number(b.custoParada) || 0)); }
    if (!campos.length) throw erro400("Nenhum campo para atualizar.");

    await pool.query(`UPDATE maquinas SET ${campos.join(", ")} WHERE id = ?`, [...valores, m.maquina_id]);
    res.json(formatarMaquina(await buscarMaquina(m.id)));
  } catch (e) {
    next(e);
  }
}

// DELETE /api/maquinas/:id   -> desativa (mantém histórico de medições, OS e chamados)
export async function deleteMaquina(req, res, next) {
  try {
    const m = await buscarMaquina(req.params.id);
    if (!m) throw erro404("Máquina não encontrada.");
    await pool.query("UPDATE maquinas SET ativo = FALSE WHERE id = ?", [m.maquina_id]);
    res.json({ mensagem: `Máquina ${m.id} desativada.` });
  } catch (e) {
    next(e);
  }
}
