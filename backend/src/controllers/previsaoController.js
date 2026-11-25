/* Ações preditivas: previsão de falha por regressão linear e os alertas que ela gera.
   A conta fica em lib/regressao.js; aqui ficam as consultas, os alertas e os avisos. */
import { pool } from "../config/database.js";
import { erro404 } from "../lib/http.js";
import { ACOES, DIA_MS, REGRAS, TITULO_PREDITIVO, preverGrandeza, textoPrevisao } from "../lib/regressao.js";
import { virgula } from "../lib/regras.js";

const ORDEM = { acima: 0, critico: 1, atencao: 2, ok: 3, estavel: 4, insuficiente: 5 };
const ORDEM_GRANDEZA = ["vibracao", "temperatura", "corrente"];

// Leituras recentes de várias máquinas, agrupadas por máquina e grandeza (as N mais novas de cada)
async function leiturasRecentes(maquinaIds, grandeza) {
  if (!maquinaIds.length) return {};
  const filtroG = grandeza ? "AND grandeza = ?" : "";
  const [rows] = await pool.query(
    `SELECT maquina_id, grandeza, valor, medido_em FROM medicoes
      WHERE maquina_id IN (?) ${filtroG} AND medido_em >= NOW() - INTERVAL ? DAY
      ORDER BY medido_em DESC, id DESC`,
    grandeza ? [maquinaIds, grandeza, REGRAS.janelaDias] : [maquinaIds, REGRAS.janelaDias],
  );
  const grupos = {};
  for (const r of rows) {
    const lista = ((grupos[r.maquina_id] ||= {})[r.grandeza] ||= []);
    if (lista.length < REGRAS.leituras) lista.push({ quando: r.medido_em, valor: r.valor });
  }
  return grupos;
}

async function grandezas(codigo) {
  const [g] = await pool.query(`SELECT * FROM grandezas ${codigo ? "WHERE codigo = ?" : ""}`, codigo ? [codigo] : []);
  return g.sort((a, b) => ORDEM_GRANDEZA.indexOf(a.codigo) - ORDEM_GRANDEZA.indexOf(b.codigo));
}

// Previsões de uma lista de máquinas (linhas da vw_maquinas)
async function preverMaquinas(maqs, grandeza) {
  const gs = await grandezas(grandeza);
  const leituras = await leiturasRecentes(maqs.map((m) => m.maquina_id), grandeza);
  const agora = Date.now();
  return maqs.map((m) => {
    const lista = gs.map((g) => preverGrandeza(leituras[m.maquina_id]?.[g.codigo] || [], g, agora));
    const pior = [...lista].sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao] || (a.diasCritico ?? 1e9) - (b.diasCritico ?? 1e9))[0];
    return { maquinaId: m.maquina_id, id: m.id, nome: m.nome, setor: m.setor, grandezas: lista, pior };
  });
}

const resumoGrandeza = ({ pontos, reta, ...resto }) => resto;

// GET /api/previsoes  -> todas as máquinas, das mais urgentes para as mais tranquilas
export async function getPrevisoes(req, res, next) {
  try {
    const [maqs] = await pool.query("SELECT maquina_id, id, nome, setor FROM vw_maquinas");
    const lista = (await preverMaquinas(maqs))
      .sort((a, b) => ORDEM[a.pior.situacao] - ORDEM[b.pior.situacao] || (a.pior.diasCritico ?? 1e9) - (b.pior.diasCritico ?? 1e9) || a.id.localeCompare(b.id))
      .map(({ maquinaId, grandezas: gs, pior, ...m }) => ({ ...m, pior: resumoGrandeza(pior), grandezas: gs.map(resumoGrandeza) }));
    res.json({ regras: REGRAS, maquinas: lista });
  } catch (e) {
    next(e);
  }
}

// GET /api/maquinas/:id/previsao  -> previsão de cada grandeza, com os pontos e a reta para o gráfico
export async function getPrevisaoMaquina(req, res, next) {
  try {
    const [maqs] = await pool.query("SELECT maquina_id, id, nome, setor FROM vw_maquinas WHERE id = ?", [req.params.id]);
    if (!maqs[0]) throw erro404("Máquina não encontrada.");
    const [p] = await preverMaquinas(maqs);
    res.json({ id: p.id, nome: p.nome, setor: p.setor, regras: REGRAS, pior: resumoGrandeza(p.pior), grandezas: p.grandezas });
  } catch (e) {
    next(e);
  }
}

// Data até quando agir: um dia antes da falha prevista (nunca antes de hoje)
const prazoAcao = (p) => {
  const d = new Date(Date.now() + Math.max(0, p.diasCritico - 1) * DIA_MS);
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
};

// Avisa gestores e técnicos ativos no sininho
async function avisarEquipe(conn, m, p) {
  const [pessoas] = await conn.query(
    `SELECT DISTINCT u.id FROM usuarios u JOIN usuario_perfis up ON up.usuario_id = u.id
      WHERE u.ativo = TRUE AND up.perfil IN ('gestor', 'tecnico')`,
  );
  const titulo = `Falha prevista na ${m.id}: ${p.nome.toLowerCase()}`.slice(0, 120);
  const msg = `${m.nome}: ${p.nome.toLowerCase()} deve chegar ao limite crítico ${textoPrevisao(p).toLowerCase()}. ${ACOES[p.grandeza] || "Inspecionar a máquina"} até ${prazoAcao(p)}.`;
  for (const u of pessoas) {
    await conn.query(
      "INSERT INTO notificacoes (destinatario_id, maquina_id, prioridade, titulo, mensagem) VALUES (?, ?, ?, ?, ?)",
      [u.id, m.maquinaId, p.situacao === "critico" ? "urgente" : "normal", titulo, msg],
    );
  }
}

/* Mantém em dia o alerta preditivo de uma máquina e grandeza:
   - previsão crítica ou de atenção: cria o alerta (e avisa a equipe) ou atualiza o que já existe;
   - previsão tranquila: resolve o alerta preditivo que estava aberto.
   Devolve "criado", "atualizado", "resolvido" ou null. */
async function sincronizarAlerta(conn, m, p) {
  const titulo = `${TITULO_PREDITIVO} de ${p.nome.toLowerCase()}`;
  const [abertos] = await conn.query(
    "SELECT id, nivel FROM alertas WHERE maquina_id = ? AND titulo = ? AND estado <> 'resolvido' ORDER BY id DESC LIMIT 1",
    [m.maquinaId, titulo],
  );
  const aberto = abertos[0];

  if (p.situacao !== "critico" && p.situacao !== "atencao") {
    if (!aberto) return null;
    await conn.query("UPDATE alertas SET estado = 'resolvido' WHERE id = ?", [aberto.id]);
    return "resolvido";
  }

  const un = p.unidade;
  const campos = [
    p.situacao,
    `${virgula(p.ultimo)} ${un}`,
    `${virgula(p.limite)} ${un}`,
    textoPrevisao(p),
    `${p.acao} até ${prazoAcao(p)}. A leitura sobe ${virgula(Number(p.inclinacao.toFixed(2)))} ${un} por dia (confiança ${p.confianca}%).`.slice(0, 255),
  ];
  if (aberto) {
    const piorou = aberto.nivel === "atencao" && p.situacao === "critico";
    await conn.query(
      `UPDATE alertas SET nivel = ?, valor_medido = ?, valor_limite = ?, previsao = ?, acao = ?
         ${piorou ? ", estado = 'novo', criado_em = NOW()" : ""} WHERE id = ?`,
      [...campos, aberto.id],
    );
    if (piorou) await avisarEquipe(conn, m, p);
    return "atualizado";
  }
  await conn.query(
    `INSERT INTO alertas (maquina_id, grandeza, nivel, valor_medido, valor_limite, previsao, acao, titulo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [m.maquinaId, p.grandeza, ...campos, titulo],
  );
  await avisarEquipe(conn, m, p);
  return "criado";
}

// Recalcula a previsão de máquinas (todas ou só uma) e atualiza os alertas preditivos
export async function avaliarPrevisoes({ maquinaId, grandeza } = {}) {
  const [maqs] = await pool.query(
    `SELECT maquina_id, id, nome, setor FROM vw_maquinas ${maquinaId ? "WHERE maquina_id = ?" : ""}`,
    maquinaId ? [maquinaId] : [],
  );
  const resultado = { criados: 0, atualizados: 0, resolvidos: 0, alertas: [] };
  const conn = await pool.getConnection();
  try {
    for (const m of await preverMaquinas(maqs, grandeza)) {
      for (const p of m.grandezas) {
        await conn.beginTransaction();
        try {
          const r = await sincronizarAlerta(conn, m, p);
          await conn.commit();
          if (r === "criado") { resultado.criados++; resultado.alertas.push({ maquina: m.id, grandeza: p.grandeza, nivel: p.situacao, previsao: textoPrevisao(p) }); }
          if (r === "atualizado") resultado.atualizados++;
          if (r === "resolvido") resultado.resolvidos++;
        } catch (e) {
          await conn.rollback().catch(() => {});
          throw e;
        }
      }
    }
  } finally {
    conn.release();
  }
  return resultado;
}

// POST /api/previsoes/avaliar  (gestor) -> recalcula tudo na hora
export async function postAvaliar(req, res, next) {
  try {
    res.json(await avaliarPrevisoes());
  } catch (e) {
    next(e);
  }
}
