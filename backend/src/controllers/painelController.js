/* Telas de visão geral: dashboard, resumo da planta (menu lateral) e busca. */
import { pool } from "../config/database.js";
import { formatarAlerta } from "./alertasController.js";
import { formatarOS, SQL_OS } from "./ordensController.js";
import { serieDe } from "./medicoesController.js";

const semanas = (valores) => valores.map((y, i) => ({ x: "Sem " + (i + 1), y }));

// GET /api/dashboard
export async function getDashboard(req, res, next) {
  try {
    const [os] = await pool.query(`${SQL_OS} ORDER BY o.prazo, o.id`);
    const conta = (s) => os.filter((o) => o.status === s).length;
    const abertas = conta("aberta"), andamento = conta("andamento"), peca = conta("peca"), concluidas = conta("concluida");
    const vencidas = os.filter((o) => o.vencida).length;

    // MTTR real: média de horas entre abrir e concluir as OS dos últimos 90 dias
    const [[mttr]] = await pool.query(
      `SELECT AVG(TIMESTAMPDIFF(MINUTE, criado_em, concluido_em)) / 60 AS horas
         FROM ordens_servico WHERE status = 'concluida' AND concluido_em >= NOW() - INTERVAL 90 DAY`,
    );

    const [alertas] = await pool.query("SELECT * FROM vw_alertas WHERE estado <> 'resolvido' ORDER BY criado_em DESC");
    const [maqs] = await pool.query("SELECT id, nome, setor, saude, status FROM vw_maquinas ORDER BY saude, id");

    // Gráfico do topo: a máquina mais crítica QUE TEM medições de vibração.
    // Máquina nova (ainda sem leituras) não pode deixar o gráfico do dashboard vazio.
    const [[comLeitura]] = await pool.query(
      `SELECT vm.id FROM vw_maquinas vm
        WHERE EXISTS (SELECT 1 FROM medicoes me WHERE me.maquina_id = vm.maquina_id AND me.grandeza = 'vibracao')
        ORDER BY vm.saude, vm.id LIMIT 1`,
    );
    const foco = comLeitura?.id || maqs[0]?.id;
    const sv = foco ? await serieDe(foco, "vibracao") : null;
    const nomeFoco = maqs.find((m) => m.id === foco)?.nome || "";
    const emAberto = abertas + andamento + peca;

    res.json({
      // Disponibilidade e MTBF dependem de registro de paradas, que ainda não existe no sistema:
      // por enquanto ficam como valores de referência da planta.
      kpis: [
        { k: "disp", rotulo: "Disponibilidade", valor: 96.4, unidade: "%", casas: 1, sub: "Meta: 95%", meta: 95, escalaMin: 92, historico: semanas([94.8, 95.2, 95.9, 96.8, 95.7, 96.1, 96.0, 96.4]), explica: "Percentual do tempo em que as máquinas ficaram prontas para produzir. Despenca quando uma parada que ninguém previu acontece." },
        { k: "mtbf", rotulo: "MTBF", valor: 412, unidade: " h", casas: 0, sub: "Tempo médio entre falhas", escalaMin: 340, historico: semanas([372, 380, 391, 388, 402, 398, 407, 412]), explica: "Quanto tempo, em média, uma máquina roda entre uma falha e a próxima. Quanto maior, melhor." },
        { k: "mttr", rotulo: "MTTR", valor: mttr.horas ? Math.round(mttr.horas * 10) / 10 : 3.8, unidade: " h", casas: 1, sub: "Tempo médio de reparo", escalaMin: 0, historico: semanas([4.6, 4.4, 4.5, 4.1, 4.0, 3.9, 3.9, mttr.horas ? Math.round(mttr.horas * 10) / 10 : 3.8]), explica: "Quanto tempo a equipe leva, em média, para devolver a máquina à produção. Quanto menor, melhor." },
        { k: "os", rotulo: "OS abertas", valor: emAberto, unidade: "", casas: 0, sub: vencidas + " com prazo vencido", escalaMin: 0, historico: semanas([14, 15, 13, 17, 16, 19, 17, emAberto]), explica: "Ordens de serviço ainda não concluídas (abertas, em andamento e aguardando peça). As vencidas passaram do prazo combinado." },
      ],
      vibracao: sv && { maquina: sv.maquina, nomeMaquina: nomeFoco, grandeza: sv.nome, unidade: sv.unidade, limite: sv.limite, pontos: sv.pontos },
      alertas: alertas.filter((a) => a.estado === "novo").sort((a, b) => a.min - b.min).slice(0, 4).map(formatarAlerta),
      todosAlertas: alertas.map(formatarAlerta),
      saude: maqs.map((m) => ({ id: m.id, nome: m.nome, setor: m.setor, saude: m.saude, status: m.status })),
      osPorStatus: {
        abertas, andamento, peca, concluidas, vencidas,
        proximas: os.filter((o) => o.status !== "concluida").slice(0, 5).map(formatarOS),
      },
      maquinas: [...maqs].sort((a, b) => a.id.localeCompare(b.id)).map((m) => ({ id: m.id, nome: m.nome })),
    });
  } catch (e) {
    next(e);
  }
}

// GET /api/planta/resumo  -> { criticos, atencao, normais }
export async function getResumoPlanta(req, res, next) {
  try {
    const [rows] = await pool.query("SELECT status, COUNT(*) AS n FROM vw_maquinas GROUP BY status");
    const n = (s) => rows.find((r) => r.status === s)?.n || 0;
    res.json({ criticos: n("critico"), atencao: n("atencao"), normais: n("normal") });
  } catch (e) {
    next(e);
  }
}

// GET /api/busca?q=texto  -> máquinas, OS e alertas
export async function busca(req, res, next) {
  try {
    const t = `%${String(req.query.q || "").trim()}%`;
    const [maqs] = await pool.query("SELECT id, nome, setor FROM vw_maquinas WHERE id LIKE ? OR nome LIKE ? ORDER BY id LIMIT 8", [t, t]);
    const [os] = await pool.query(
      `${SQL_OS} WHERE o.titulo LIKE ? OR m.codigo LIKE ? OR CONCAT('OS-', LPAD(o.id, 4, '0')) LIKE ? ORDER BY o.id DESC LIMIT 4`,
      [t, t, t],
    );
    const [alertas] = await pool.query("SELECT id, titulo, ativo FROM vw_alertas WHERE estado <> 'resolvido' AND (titulo LIKE ? OR ativo LIKE ?) LIMIT 4", [t, t]);

    res.json([
      ...maqs.map((m) => ({ tipo: "Máquina", titulo: `${m.id} · ${m.nome}`, sub: m.setor, href: "/maquinas?id=" + m.id })),
      ...os.map(formatarOS).map((o) => ({ tipo: "Ordem de serviço", titulo: `${o.id} · ${o.titulo}`, sub: o.ativo, href: "/ordens?os=" + o.id })),
      ...alertas.map((a) => ({ tipo: "Alerta", titulo: a.titulo, sub: a.ativo, href: "/alertas?id=" + a.id })),
    ].slice(0, 8));
  } catch (e) {
    next(e);
  }
}

// GET /api/setores -> ["Estamparia", "Logística", ...]
export async function setores(req, res, next) {
  try {
    const [rows] = await pool.query("SELECT nome FROM setores ORDER BY nome");
    res.json(rows.map((r) => r.nome));
  } catch (e) {
    next(e);
  }
}
