'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Badge, Carga, Vazio, useLoad } from '@/components/ui';
import { api, num } from '@/lib/util';

/* Ações preditivas: previsão de falha calculada pela API com regressão linear
   sobre as últimas medições (backend/src/lib/regressao.js). */

export const SITUACAO = {
  acima: ['critico', 'Acima do limite'],
  critico: ['critico', 'Falha em até 7 dias'],
  atencao: ['atencao', 'Falha em até 15 dias'],
  ok: ['normal', 'Sobe devagar'],
  estavel: ['normal', 'Estável'],
  insuficiente: ['neutro', 'Poucas leituras'],
};
export const SituacaoBadge = ({ s }) => <Badge k={SITUACAO[s][0]}>{SITUACAO[s][1]}</Badge>;

export function textoDias(p, minimo = 5) {
  if (p.situacao === 'acima') return 'Já passou do limite crítico';
  if (p.situacao === 'estavel') return 'Sem tendência de alta';
  if (p.situacao === 'insuficiente') return `${p.leituras} de ${minimo} leituras necessárias`;
  return p.diasCritico === 0 ? 'Limite a qualquer momento' : `Limite em ~${p.diasCritico} dia${p.diasCritico > 1 ? 's' : ''} (${p.dataCritico})`;
}
const sobe = p => `${p.inclinacao > 0 ? 'Sobe' : 'Varia'} ${num(Math.abs(p.inclinacao), 2)} ${p.unidade} por dia · confiança ${p.confianca}%`;

/* Gráfico: leituras (pontos), reta da regressão e a projeção tracejada até o limite crítico */
function TendenciaChart({ p }) {
  const W = 640, h = 230, m = { t: 22, r: 16, b: 30, l: 44 };
  const xs = p.pontos.map(q => q.x), ys = p.pontos.map(q => q.y);
  const projeta = ['critico', 'atencao', 'ok'].includes(p.situacao) && p.diasCritico <= 60;
  const x0 = Math.min(...xs), x1 = Math.max(0, ...xs, projeta ? p.diasCritico : 0) || 1;
  const f = x => p.reta.a + p.reta.b * x;
  const yMin = Math.min(...ys, f(x0)) * .9, yMax = Math.max(...ys, p.limite, f(x1)) * 1.08;
  const X = x => m.l + (W - m.l - m.r) * ((x - x0) / (x1 - x0 || 1));
  const Y = v => h - m.b - (h - m.t - m.b) * ((v - yMin) / (yMax - yMin || 1));
  const ultimoX = Math.max(...xs);
  const ticksX = [...new Set([x0, 0, x1].map(Math.round))];
  const rotX = x => x === 0 ? 'hoje' : x < 0 ? `${x} d` : `+${x} d`;
  return (
    <div className="pm-chart pm-tend">
      <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`Tendência de ${p.nome}: ${textoDias(p)}`}>
        {[0, 1, 2, 3].map(k => { const v = yMin + (yMax - yMin) * k / 3; return <g key={k}><line className="grid" x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} /><text className="tick" x={m.l - 8} y={Y(v) + 4} textAnchor="end">{num(v, 1)}</text></g>; })}
        {ticksX.map(x => <text key={x} className="tick" x={X(x)} y={h - 8} textAnchor={x === ticksX[0] ? 'start' : x === ticksX[ticksX.length - 1] ? 'end' : 'middle'}>{rotX(x)}</text>)}
        <line className="limit" x1={m.l} x2={W - m.r} y1={Y(p.limite)} y2={Y(p.limite)} /><text className="limit-t" x={m.l + 4} y={Y(p.limite) - 6}>Limite crítico {num(p.limite, 1)} {p.unidade}</text>
        <line className="reta" x1={X(x0)} x2={X(ultimoX)} y1={Y(f(x0))} y2={Y(f(ultimoX))} />
        {projeta && <line className="reta proj" x1={X(ultimoX)} x2={X(p.diasCritico)} y1={Y(f(ultimoX))} y2={Y(f(p.diasCritico))} />}
        {p.pontos.map((q, i) => <circle key={i} className="pt" cx={X(q.x)} cy={Y(q.y)} r="4" />)}
        {projeta && <g><circle className="falha" cx={X(p.diasCritico)} cy={Y(p.limite)} r="6" /><text className="falha-t" x={X(p.diasCritico) - 10} y={Y(p.limite) - 10} textAnchor="end">Falha prevista {p.dataCritico}</text></g>}
      </svg>
    </div>
  );
}

/* Detalhe da máquina: uma linha por grandeza e o gráfico da escolhida */
export function PrevisaoMaquina({ id }) {
  const l = useLoad(() => api.previsaoMaquina(id), [id]);
  const [sel, setSel] = useState(null);
  return (
    <section className="pm-prev mb-4" aria-label="Previsão de falha">
      <h3 className="h6 mb-1">Previsão de falha</h3>
      <p className="pm-sub mb-2">Regressão linear das últimas medições de cada grandeza.</p>
      <Carga l={l}>{d => {
        const atual = d.grandezas.find(g => g.grandeza === (sel || d.pior.grandeza)) || d.grandezas[0];
        return <>
          <div className="pm-prev-lista">{d.grandezas.map(g => <button type="button" key={g.grandeza} className={'pm-prev-g' + (g === atual ? ' on' : '')} aria-pressed={g === atual} onClick={() => setSel(g.grandeza)}>
            <span><b>{g.nome}</b><small>{textoDias(g, d.regras.minimoLeituras)}</small></span><SituacaoBadge s={g.situacao} /></button>)}</div>
          {atual.pontos.length ? <><TendenciaChart p={atual} /><p className="pm-sub mb-1">{sobe(atual)}.</p></> : <p className="text-secondary mt-2 mb-1">Ainda não há leituras suficientes de {atual.nome.toLowerCase()} para traçar a tendência.</p>}
          {['acima', 'critico', 'atencao'].includes(atual.situacao) && <p className="mb-0"><b>Ação recomendada:</b> {atual.acao}.</p>}
        </>;
      }}</Carga>
    </section>
  );
}

/* Dashboard: máquinas mais próximas do limite crítico */
export function AcoesPreditivas() {
  const l = useLoad(() => api.previsoes());
  return (
    <section className="pm-card" aria-labelledby="t-preditivas">
      <h2 id="t-preditivas" className="mb-1">Ações preditivas</h2>
      <p className="pm-sub mb-2">Quando cada máquina deve chegar ao limite crítico, pela tendência das medições.</p>
      <Carga l={l}>{d => {
        const lista = d.maquinas.filter(m => ['acima', 'critico', 'atencao', 'ok'].includes(m.pior.situacao)).slice(0, 5);
        return lista.length ? lista.map(m => <Link key={m.id} href={`/maquinas?id=${m.id}`} className="pm-prev-i">
          <SituacaoBadge s={m.pior.situacao} />
          <span className="pm-prev-txt"><b>{m.id}</b> {m.nome} · {m.pior.nome.toLowerCase()}<small>{textoDias(m.pior)}{m.pior.confianca != null ? ` · confiança ${m.pior.confianca}%` : ''}</small></span>
          <span className="pm-prev-ir">Ver →</span></Link>)
          : <Vazio titulo="Nenhuma tendência de falha" sub="As medições não indicam máquinas chegando ao limite." />;
      }}</Carga>
    </section>
  );
}
