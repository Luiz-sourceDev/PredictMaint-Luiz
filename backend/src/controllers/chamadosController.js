import { pool } from "../config/database.js";
import { dmhm } from "../lib/formato.js";
import { erro400, erro404, idDoCodigo } from "../lib/http.js";

const ETAPAS = ["Registrado", "Triado pelo gestor", "Técnico designado", "Em reparo", "Concluído"];
const INDICE = { Registrado: 0, Triado: 1, "Técnico designado": 2, "Em reparo": 3, Concluído: 4 };
const PROBLEMAS = ["Ruído anormal", "Vazamento", "Parada", "Superaquecimento", "Outro"];
const URGENCIAS = ["Baixa", "Média", "Alta", "Máquina parada"];

// Monta o chamado completo com linha do tempo e comentários
async function montarChamados(where, valores) {
  const [lista] = await pool.query(
    `SELECT c.id, m.codigo AS maquina, c.problema, c.urgencia, c.situacao, c.aberto_em,
            s.nome AS setor, c.descricao, c.foto_url
       FROM chamados c
       JOIN maquinas m     ON m.id = c.maquina_id
       LEFT JOIN setores s ON s.id = c.setor_id
      ${where} ORDER BY c.id DESC`,
    valores,
  );
  if (!lista.length) return [];
  const ids = lista.map((c) => c.id);
  const [eventos] = await pool.query("SELECT * FROM chamado_eventos WHERE chamado_id IN (?)", [ids]);
  const [comentarios] = await pool.query("SELECT * FROM chamado_comentarios WHERE chamado_id IN (?) ORDER BY criado_em, id", [ids]);

  return lista.map((c) => {
    const aberto = dmhm(c.aberto_em);
    const atual = INDICE[c.situacao] ?? 0;
    const ev = Object.fromEntries(
      eventos.filter((e) => e.chamado_id === c.id).map((e) => [e.etapa, e.ocorrido_em ? [dmhm(e.ocorrido_em), e.detalhe || ""] : [e.detalhe || "", ""]]),
    );
    return {
      id: "CH-" + c.id,
      maquina: c.maquina,
      problema: c.problema,
      urgencia: c.urgencia,
      situacao: c.situacao,
      aberto,
      setor: c.setor,
      descricao: c.descricao || "",
      foto: c.foto_url,
      comentarios: comentarios.filter((k) => k.chamado_id === c.id).map((k) => ({ quando: dmhm(k.criado_em), texto: k.texto })),
      timeline: ETAPAS.map((nome, i) => ({
        nome,
        estado: i < atual || (i === atual && atual === 4) ? "feito" : i === atual ? "atual" : "pendente",
        quando: i === 0 ? aberto + " · por você" : (ev[i] || [i <= atual ? aberto : "", ""])[0],
        detalhe: (ev[i] || ["", ""])[1],
      })),
    };
  });
}

// GET /api/chamados   funcionário vê só os dele; gestor e técnico veem todos
export async function getChamados(req, res, next) {
  try {
    const proprios = req.usuario.perfil === "funcionario";
    res.json(await montarChamados(proprios ? "WHERE c.usuario_id = ?" : "", proprios ? [req.usuario.id] : []));
  } catch (e) {
    next(e);
  }
}

// POST /api/chamados  JSON ou multipart (campo "dados" com o JSON + campo "foto")
export async function createChamado(req, res, next) {
  try {
    const b = req.file || req.body.dados ? JSON.parse(req.body.dados || "{}") : req.body;
    const descricao = String(b.descricao || "").trim();
    const [maq] = await pool.query("SELECT id, setor_id FROM maquinas WHERE codigo = ? AND ativo = TRUE", [b.maquina]);
    if (!maq[0] || descricao.length < 5) throw erro400("Escolha a máquina e descreva o que está acontecendo.");

    const problema = PROBLEMAS.includes(b.problema) ? b.problema : "Outro";
    const urgencia = URGENCIAS.includes(b.urgencia) ? b.urgencia : "Média";
    const [setor] = await pool.query("SELECT id FROM setores WHERE nome = ?", [b.setor || req.usuario.setor || ""]);
    const foto = req.file ? "/uploads/" + req.file.filename : null;

    const [r] = await pool.query(
      `INSERT INTO chamados (maquina_id, usuario_id, setor_id, problema, urgencia, descricao, foto_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [maq[0].id, req.usuario.id, setor[0]?.id || maq[0].setor_id, problema, urgencia, descricao.slice(0, 2000), foto],
    );

    // Já cria a OS no quadro do gestor, ligada ao chamado.
    // Quando a OS anda no quadro, a linha do tempo do funcionário anda junto.
    const prioridade = { Baixa: "baixa", Média: "media" }[urgencia] || "alta";
    const dias = { baixa: 7, media: 3, alta: 1 }[prioridade];
    await pool.query(
      `INSERT INTO ordens_servico (titulo, descricao, maquina_id, equipe_id, prioridade, prazo, chamado_id)
       SELECT ?, ?, m.id, s.equipe_padrao_id, ?, CURDATE() + INTERVAL ? DAY, ?
         FROM maquinas m JOIN setores s ON s.id = m.setor_id WHERE m.id = ?`,
      [`${problema} · chamado CH-${r.insertId}`, descricao.slice(0, 2000), prioridade, dias, r.insertId, maq[0].id],
    );
    const [c] = await montarChamados("WHERE c.id = ?", [r.insertId]);
    res.status(201).json(c);
  } catch (e) {
    if (e instanceof SyntaxError) return next(erro400("Os dados do chamado vieram em formato inválido."));
    next(e);
  }
}

// POST /api/chamados/:id/comentarios  { texto }
export async function comentarChamado(req, res, next) {
  try {
    const id = idDoCodigo(req.params.id);
    const texto = String(req.body.texto || "").trim();
    if (!texto) throw erro400("Escreva o comentário.");
    const proprios = req.usuario.perfil === "funcionario";
    const [existe] = await pool.query(
      `SELECT id FROM chamados WHERE id = ? ${proprios ? "AND usuario_id = ?" : ""}`,
      proprios ? [id, req.usuario.id] : [id],
    );
    if (!existe[0]) throw erro404("Chamado não encontrado.");

    await pool.query("INSERT INTO chamado_comentarios (chamado_id, usuario_id, texto) VALUES (?, ?, ?)", [id, req.usuario.id, texto.slice(0, 2000)]);
    const [c] = await montarChamados("WHERE c.id = ?", [id]);
    res.status(201).json(c);
  } catch (e) {
    next(e);
  }
}
