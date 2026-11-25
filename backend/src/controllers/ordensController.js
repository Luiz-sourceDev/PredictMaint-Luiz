import { pool } from "../config/database.js";
import { dm, hojeISO, paraDataSQL } from "../lib/formato.js";
import { erro400, erro403, erro404, idDoCodigo } from "../lib/http.js";

// Consulta base das OS (o código "OS-0241" é montado em formatarOS)
export const SQL_OS = `
  SELECT o.id, o.titulo, o.descricao, m.codigo AS ativo, e.nome AS equipe, o.prazo,
         o.prioridade, o.status, o.alerta_id, o.chamado_id, ch.foto_url,
         (o.status <> 'concluida' AND o.prazo < CURDATE()) AS vencida
    FROM ordens_servico o
    JOIN maquinas m     ON m.id = o.maquina_id
    LEFT JOIN equipes e ON e.id = o.equipe_id
    LEFT JOIN chamados ch ON ch.id = o.chamado_id`;

export const codigoOS = (id) => "OS-" + String(id).padStart(4, "0");

export const formatarOS = (o) => ({
  id: codigoOS(o.id),
  titulo: o.titulo,
  ativo: o.ativo,
  equipe: o.equipe || "—",
  prazo: dm(o.prazo),
  prioridade: o.prioridade,
  status: o.status,
  descricao: o.descricao || "",
  alertaId: o.alerta_id,
  chamado: o.chamado_id ? "CH-" + o.chamado_id : null,
  foto: o.foto_url || null, // foto que o funcionário anexou no chamado
  vencida: !!o.vencida,
});

const PRIORIDADES = ["baixa", "media", "alta"];
const STATUS = ["aberta", "andamento", "peca", "concluida"];

async function buscarOS(id) {
  const [rows] = await pool.query(`${SQL_OS} WHERE o.id = ?`, [id]);
  return rows[0] || null;
}

async function idDaEquipe(nome) {
  if (!nome) return null;
  const [rows] = await pool.query("SELECT id FROM equipes WHERE nome = ?", [nome]);
  if (!rows[0]) throw erro400(`Equipe "${nome}" não existe.`);
  return rows[0].id;
}

// GET /api/ordens?equipe=&prioridade=&periodo=30
// OS em aberto aparecem sempre; as concluídas, só as do período escolhido (em dias).
export async function getOrdens(req, res, next) {
  try {
    const { equipe, prioridade } = req.query;
    const periodo = Math.min(365, Math.max(1, Number(req.query.periodo) || 30));
    const filtros = ["(o.status <> 'concluida' OR COALESCE(o.concluido_em, o.criado_em) >= NOW() - INTERVAL ? DAY)"];
    const valores = [periodo];
    if (equipe) { filtros.push("e.nome = ?"); valores.push(equipe); }
    if (prioridade) { filtros.push("o.prioridade = ?"); valores.push(prioridade); }

    const [rows] = await pool.query(`${SQL_OS} WHERE ${filtros.join(" AND ")} ORDER BY o.id DESC`, valores);
    res.json(rows.map(formatarOS));
  } catch (e) {
    next(e);
  }
}

// POST /api/ordens  { titulo, ativo (código da máquina), equipe, prioridade, prazo, descricao, alertaId }
export async function createOrdem(req, res, next) {
  try {
    const b = req.body;
    const titulo = String(b.titulo || "").trim();
    const [maq] = await pool.query(
      `SELECT m.id, s.equipe_padrao_id FROM maquinas m JOIN setores s ON s.id = m.setor_id
        WHERE m.codigo = ? AND m.ativo = TRUE`,
      [b.ativo],
    );
    if (!titulo || !maq[0]) throw erro400("Informe o título e a máquina.");
    if (b.prioridade && !PRIORIDADES.includes(b.prioridade)) throw erro400("Prioridade inválida.");

    const equipeId = b.equipe ? await idDaEquipe(b.equipe) : maq[0].equipe_padrao_id;
    const prazo = paraDataSQL(b.prazo) || hojeISO(7); // sem prazo: uma semana
    const alertaId = Number(b.alertaId) || null;

    const [r] = await pool.query(
      `INSERT INTO ordens_servico (titulo, descricao, maquina_id, equipe_id, prioridade, prazo, alerta_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [titulo, b.descricao || null, maq[0].id, equipeId, b.prioridade || "media", prazo, alertaId],
    );
    // Se a OS veio de um alerta, o alerta passa a ser "reconhecido"
    if (alertaId) {
      await pool.query(
        "UPDATE alertas SET estado = 'reconhecido', reconhecido_por = ?, reconhecido_em = NOW() WHERE id = ? AND estado = 'novo'",
        [req.usuario.id, alertaId],
      );
    }
    res.status(201).json(formatarOS(await buscarOS(r.insertId)));
  } catch (e) {
    next(e);
  }
}

// PATCH /api/ordens/:id  (id = "OS-0241")  { status, prioridade, equipe, prazo, titulo, descricao }
export async function updateOrdem(req, res, next) {
  try {
    const id = idDoCodigo(req.params.id);
    const atual = id && (await buscarOS(id));
    if (!atual) throw erro404("OS não encontrada.");

    const b = req.body, campos = [], valores = [];
    // Técnico só movimenta o status; prazo, prioridade, equipe e textos são do gestor
    if (req.usuario.perfil !== "gestor" && ["prioridade", "equipe", "prazo", "titulo", "descricao"].some((k) => b[k] !== undefined)) {
      throw erro403("O técnico só pode mudar o status da OS. Peça ao gestor para alterar o resto.");
    }
    if (b.status !== undefined) {
      if (!STATUS.includes(b.status)) throw erro400("Status inválido.");
      campos.push("status = ?", "concluido_em = IF(? = 'concluida', NOW(), NULL)");
      valores.push(b.status, b.status);
    }
    if (b.prioridade !== undefined) {
      if (!PRIORIDADES.includes(b.prioridade)) throw erro400("Prioridade inválida.");
      campos.push("prioridade = ?"); valores.push(b.prioridade);
    }
    if (b.equipe !== undefined) { campos.push("equipe_id = ?"); valores.push(await idDaEquipe(b.equipe)); }
    if (b.prazo !== undefined) { campos.push("prazo = ?"); valores.push(paraDataSQL(b.prazo)); }
    if (b.titulo !== undefined) {
      if (!String(b.titulo).trim()) throw erro400("O título não pode ficar vazio.");
      campos.push("titulo = ?"); valores.push(String(b.titulo).trim());
    }
    if (b.descricao !== undefined) { campos.push("descricao = ?"); valores.push(b.descricao || null); }
    if (!campos.length) throw erro400("Nenhum campo para atualizar.");

    await pool.query(`UPDATE ordens_servico SET ${campos.join(", ")} WHERE id = ?`, [...valores, id]);

    // OS ligada a um chamado: atualiza a linha do tempo que o funcionário acompanha
    if (atual.chamado_id && b.status && b.status !== atual.status) {
      const etapa = { andamento: [3, "Em reparo"], peca: [3, "Em reparo"], concluida: [4, "Concluído"] }[b.status];
      if (etapa) {
        await pool.query("UPDATE chamados SET situacao = ? WHERE id = ?", [etapa[1], atual.chamado_id]);
        // Etapas anteriores (triagem e equipe), caso ainda não tenham sido registradas
        await pool.query(
          "INSERT IGNORE INTO chamado_eventos (chamado_id, etapa, ocorrido_em, detalhe) VALUES (?, 1, NOW(), ?), (?, 2, NOW(), ?)",
          [atual.chamado_id, `prioridade ${{ media: "média" }[atual.prioridade] || atual.prioridade}`, atual.chamado_id, `Equipe ${atual.equipe || "—"}`],
        );
        await pool.query(
          `INSERT INTO chamado_eventos (chamado_id, etapa, ocorrido_em, detalhe) VALUES (?, ?, NOW(), ?)
           ON DUPLICATE KEY UPDATE ocorrido_em = NOW(), detalhe = VALUES(detalhe)`,
          [atual.chamado_id, etapa[0], b.status === "peca" ? "Aguardando peça" : null],
        );
      }
    }
    res.json(formatarOS(await buscarOS(id)));
  } catch (e) {
    next(e);
  }
}
