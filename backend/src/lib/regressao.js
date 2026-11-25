/* Previsão de falha por regressão linear (mínimos quadrados).

   Para cada máquina e grandeza, pega as últimas leituras e traça a reta
       valor = a + b × dia
   b  = quanto o valor sobe por dia (inclinação)
   R² = o quanto as leituras seguem a reta (0 a 1): é a confiança da previsão
   A falha prevista é o dia em que a reta cruza o limite crítico da grandeza. */

export const DIA_MS = 86400000;

// Regras da previsão (mudar aqui muda o sistema inteiro)
export const REGRAS = {
  leituras: 10,          // usa as últimas N leituras de cada grandeza
  janelaDias: 60,        // ignora leituras mais antigas que isso
  minimoLeituras: 5,     // com menos que isso não dá para confiar na reta
  minimoR2: 0.6,         // abaixo disso as leituras estão espalhadas demais
  diasCritico: 7,        // falha prevista em até 7 dias  -> alerta crítico
  diasAtencao: 15,       // falha prevista em até 15 dias -> alerta de atenção
};

// Ação recomendada conforme a grandeza que está subindo
export const ACOES = {
  vibracao: "Inspecionar rolamentos, alinhamento e fixação da máquina",
  temperatura: "Verificar lubrificação, nível de óleo e arrefecimento",
  corrente: "Verificar sobrecarga, conexões elétricas e o estado do motor",
};

export const TITULO_PREDITIVO = "Falha prevista";

/* Reta dos mínimos quadrados.
   pontos: [{ x, y }]  ->  { a, b, r2 }   (null se não der para traçar a reta) */
export function regressao(pontos) {
  const n = pontos.length;
  if (n < 2) return null;
  const mx = pontos.reduce((s, p) => s + p.x, 0) / n;
  const my = pontos.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const { x, y } of pontos) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx === 0) return null; // todas as leituras no mesmo instante
  const b = sxy / sxx;
  const a = my - b * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { a, b, r2 };
}

const dm = (ms) => {
  const d = new Date(ms);
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
};
const arred = (v, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;

/* Previsão de uma grandeza.
   leituras: [{ quando: Date, valor }] em qualquer ordem
   g: { codigo, nome, unidade, limite_atencao, limite_critico }
   Devolve a situação:
     insuficiente  poucas leituras (ou todas no mesmo instante)
     acima         a última leitura já passou do limite crítico
     estavel       não sobe, ou sobe sem um padrão confiável (R² baixo)
     critico       chega ao limite crítico em até REGRAS.diasCritico dias
     atencao       chega ao limite crítico em até REGRAS.diasAtencao dias
     ok            sobe, mas o limite ainda está longe */
export function preverGrandeza(leituras, g, agora = Date.now()) {
  const pts = [...leituras]
    .map((l) => ({ ms: new Date(l.quando).getTime(), y: Number(l.valor) }))
    .sort((p, q) => p.ms - q.ms);
  const limite = Number(g.limite_critico), atencao = Number(g.limite_atencao);
  const base = {
    grandeza: g.codigo, nome: g.nome, unidade: g.unidade, limite, atencao,
    leituras: pts.length, ultimo: pts.length ? pts[pts.length - 1].y : null,
    inclinacao: null, r2: null, confianca: null, diasCritico: null, dataCritico: null,
    acao: ACOES[g.codigo] || "Inspecionar a máquina",
  };
  const pontos = pts.map((p) => ({ x: p.ms / DIA_MS, y: p.y }));
  const reta = pontos.length >= REGRAS.minimoLeituras ? regressao(pontos) : null;
  if (!reta) return { ...base, situacao: "insuficiente", pontos: [] };

  const hoje = agora / DIA_MS;
  const out = {
    ...base,
    inclinacao: arred(reta.b, 3),
    r2: arred(reta.r2, 2),
    confianca: Math.round(reta.r2 * 100),
    // pontos para o gráfico: x = dias em relação a hoje (negativo = passado)
    pontos: pontos.map((p) => ({ x: arred(p.x - hoje, 2), y: p.y })),
    reta: { a: arred(reta.a + reta.b * hoje, 4), b: reta.b }, // valor = a + b × (dias a partir de hoje)
  };
  if (base.ultimo > limite) return { ...out, situacao: "acima", diasCritico: 0 };
  if (reta.b <= 0 || reta.r2 < REGRAS.minimoR2) return { ...out, situacao: "estavel" };

  // dia em que a reta cruza o limite crítico, contado a partir de agora
  const dias = Math.max(0, (limite - reta.a) / reta.b - hoje);
  const diasCritico = Math.ceil(dias);
  const situacao = diasCritico <= REGRAS.diasCritico ? "critico" : diasCritico <= REGRAS.diasAtencao ? "atencao" : "ok";
  return { ...out, situacao, diasCritico, dataCritico: dm(agora + dias * DIA_MS) };
}

// Texto curto da previsão, usado no alerta: "Em ~9 dias (02/12)"
export const textoPrevisao = (p) =>
  p.diasCritico === 0 ? "A qualquer momento" : `Em ~${p.diasCritico} dia${p.diasCritico > 1 ? "s" : ""} (${p.dataCritico})`;
