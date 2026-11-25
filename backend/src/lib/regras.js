/* Regras de negócio compartilhadas entre os controllers. */

// Status da máquina a partir da saúde (mesma regra da vw_maquinas)
export const statusSaude = (s) => (s < 50 ? "critico" : s < 75 ? "atencao" : "normal");

// Situação de uma medição em relação aos limites da grandeza
export const situacaoMedicao = (valor, g) =>
  valor > g.limite_critico ? "critico" : valor >= g.limite_atencao ? "atencao" : "normal";

// Número com vírgula: 6.4 -> "6,4"
export const virgula = (n) => String(n).replace(".", ",");

/* Conta do orçamento. Mesma fórmula de frontend/src/lib/calc.jsx.
   Corretiva = a mesma intervenção depois da quebra (hora extra, peça urgente, parada maior). */
export function calcOrcamento(e, corretiva = false) {
  const f = corretiva ? e.fatores || { mo: 1.5, pecas: 1.4, parada: 3 } : { mo: 1, pecas: 1, parada: 1 };
  const mo = e.horas * e.tecnicos * e.valorHora * f.mo;
  const pecas = e.pecas.reduce((s, p) => s + p.qtd * p.valor, 0) * f.pecas;
  const terceiros = +e.terceiros || 0;
  const parada = e.horasParada * e.custoParadaHora * f.parada;
  const sub = mo + pecas + terceiros + parada;
  const contingencia = (sub * (+e.contingencia || 0)) / 100;
  return { mo, pecas, terceiros, parada, contingencia, total: sub + contingencia };
}

// Hash simples e estável de um texto (usado para variar números de demonstração)
export const hashTexto = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
