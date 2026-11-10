import { pool } from "../config/database.js";
import { dm } from "../lib/formato.js";
import { erro400, erro404 } from "../lib/http.js";
import { calcOrcamento } from "../lib/regras.js";

const FATORES = { mo: 1.5, pecas: 1.4, parada: 3 }; // quanto a corretiva encarece

// Parâmetros iniciais do orçamento de uma máquina (vêm do setor dela)
async function baseDe(codigo) {
  const [rows] = await pool.query(
    `SELECT m.id AS maquina_id, m.codigo, m.nome, m.saude, m.custo_parada_hora, s.id AS setor_id, s.nome AS setor,
            s.tecnicos_padrao, s.horas_padrao, s.horas_parada_padrao, s.valor_hora_tecnico
       FROM maquinas m JOIN setores s ON s.id = m.setor_id
      WHERE m.codigo = ? AND m.ativo = TRUE`,
    [codigo],
  );
  const m = rows[0];
  if (!m) return null;
  const [pecas] = await pool.query(
    `SELECT p.nome, sp.quantidade AS qtd, p.valor_unitario AS valor
       FROM setor_pecas_padrao sp JOIN pecas p ON p.id = sp.peca_id
      WHERE sp.setor_id = ? ORDER BY p.id`,
    [m.setor_id],
  );
  return {
    maquina: m.codigo,
    nome: m.nome,
    setor: m.setor,
    saude: m.saude,
    custoParadaHora: m.custo_parada_hora,
    valorHora: m.valor_hora_tecnico,
    tecnicos: m.tecnicos_padrao,
    horas: m.horas_padrao,
    horasParada: m.horas_parada_padrao,
    pecas: pecas.length ? pecas : [{ nome: "Peça de reposição", qtd: 1, valor: 500 }],
    terceiros: 0,
    contingencia: 10,
    fatores: FATORES,
  };
}

// GET /api/orcamento/base/:id
export async function getBase(req, res, next) {
  try {
    const b = await baseDe(req.params.id);
    if (!b) throw erro404("Máquina não encontrada.");
    const { saude, ...base } = b;
    res.json(base);
  } catch (e) {
    next(e);
  }
}

// GET /api/orcamento/resumo  -> custo preventivo x corretivo de cada máquina
export async function getResumo(req, res, next) {
  try {
    const [maqs] = await pool.query("SELECT id, status FROM vw_maquinas ORDER BY id");
    const lista = [];
    for (const { id, status } of maqs) {
      const b = await baseDe(id);
      const preventivo = calcOrcamento(b).total, corretivo = calcOrcamento(b, true).total;
      lista.push({ maquina: b.maquina, nome: b.nome, setor: b.setor, saude: b.saude, status, preventivo, corretivo, risco: corretivo * (1 - b.saude / 100) });
    }
    res.json(lista);
  } catch (e) {
    next(e);
  }
}

const formatarOrcamento = (o) => ({
  id: "ORC-" + String(o.id).padStart(3, "0"),
  data: dm(o.criado_em),
  maquina: o.maquina,
  tipo: o.tipo,
  total: o.total,
  cuidarAgora: o.cuidar_agora,
  esperarQuebrar: o.esperar_quebrar,
  detalhes: typeof o.detalhes === "string" ? JSON.parse(o.detalhes) : o.detalhes,
});

const SQL_ORC = "SELECT o.*, m.codigo AS maquina FROM orcamentos o JOIN maquinas m ON m.id = o.maquina_id";

// GET /api/orcamento
export async function getOrcamentos(req, res, next) {
  try {
    const [rows] = await pool.query(`${SQL_ORC} ORDER BY o.id DESC LIMIT 50`);
    res.json(rows.map(formatarOrcamento));
  } catch (e) {
    next(e);
  }
}

// POST /api/orcamento  { maquina, tipo, total, cuidarAgora, esperarQuebrar, detalhes }
// O total é recalculado aqui a partir dos detalhes, para não confiar só no navegador.
export async function salvarOrcamento(req, res, next) {
  try {
    const b = req.body;
    const [maq] = await pool.query("SELECT id FROM maquinas WHERE codigo = ?", [b.maquina]);
    if (!maq[0]) throw erro400("Escolha a máquina.");
    if (!["preventiva", "corretiva"].includes(b.tipo)) throw erro400("Tipo de intervenção inválido.");

    let { total, cuidarAgora, esperarQuebrar } = b;
    const d = b.detalhes;
    if (d && Array.isArray(d.pecas)) {
      cuidarAgora = calcOrcamento(d).total;
      esperarQuebrar = calcOrcamento(d, true).total;
      total = b.tipo === "corretiva" ? esperarQuebrar : cuidarAgora;
    }
    if (![total, cuidarAgora, esperarQuebrar].every((n) => Number.isFinite(Number(n)) && Number(n) >= 0)) {
      throw erro400("Valores do orçamento inválidos.");
    }

    const [r] = await pool.query(
      `INSERT INTO orcamentos (maquina_id, usuario_id, tipo, total, cuidar_agora, esperar_quebrar, detalhes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [maq[0].id, req.usuario.id, b.tipo, Math.round(total), Math.round(cuidarAgora), Math.round(esperarQuebrar), d ? JSON.stringify(d) : null],
    );
    const [rows] = await pool.query(`${SQL_ORC} WHERE o.id = ?`, [r.insertId]);
    res.status(201).json(formatarOrcamento(rows[0]));
  } catch (e) {
    next(e);
  }
}
