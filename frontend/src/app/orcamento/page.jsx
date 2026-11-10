'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Painel from '@/components/Painel';
import { Badge, Carga, Vazio, useLoad, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { calcOrcamento } from '@/lib/calc';
import { brl, param } from '@/lib/util';

const CORES = { mo: '#1b1f27', pecas: '#ffcc14', terceiros: '#8a93a3', parada: '#c0392b', contingencia: '#bfc5d2' };
const ROT = { mo: 'Mão de obra', pecas: 'Peças e materiais', terceiros: 'Serviços de terceiros', parada: 'Produção parada', contingencia: 'Margem de segurança' };

export default function Orcamento() {
  const toast = useToast();
  const maqs = useLoad(() => api.maquinas({ ordem: 'codigo' })), resumo = useLoad(() => api.orcamentoResumo()), salvos = useLoad(() => api.orcamentos());
  const [id, setId] = useState(''), [e, setE] = useState(null), [tipo, setTipo] = useState('preventiva');

  useEffect(() => { if (resumo.data && !id) setId(param('maquina') || (resumo.data.find(m => m.status === 'critico') || resumo.data[0]).maquina); }, [resumo.data, id]);
  useEffect(() => { if (id) api.orcamentoBase(id).then(setE).catch(er => toast(er.message, 'danger')); }, [id]); // eslint-disable-line

  const num = k => ev => setE({ ...e, [k]: ev.target.value });
  const norm = x => ({ ...x, tecnicos: +x.tecnicos || 0, horas: +x.horas || 0, valorHora: +x.valorHora || 0, horasParada: +x.horasParada || 0, custoParadaHora: +x.custoParadaHora || 0, terceiros: +x.terceiros || 0, contingencia: +x.contingencia || 0, pecas: x.pecas.map(p => ({ ...p, qtd: +p.qtd || 0, valor: +p.valor || 0 })) });
  const setPeca = (i, k, v) => setE({ ...e, pecas: e.pecas.map((p, j) => j === i ? { ...p, [k]: v } : p) });

  async function salvar(r, agora, quebra) {
    try { const o = await api.salvarOrcamento({ maquina: e.maquina, tipo, total: Math.round(r.total), cuidarAgora: Math.round(agora.total), esperarQuebrar: Math.round(quebra.total), detalhes: norm(e) }); toast(`${o.id} salvo para a ${e.maquina}.`); salvos.recarregar(); } catch (er) { toast(er.message, 'danger'); }
  }
  async function gerarOS(r) {
    try { const o = await api.criarOS({ ativo: e.maquina, titulo: `Manutenção ${tipo} · ${e.nome}`, prioridade: 'media', descricao: `Orçado em ${brl(r.total)} no PredictMaint.` }); toast(<>{o.id} criada. <Link className="text-warning fw-bold" href={`/ordens?os=${o.id}`}>Ver no quadro</Link></>); } catch (er) { toast(er.message, 'danger'); }
  }
  let res = null;
  if (e) { const n = norm(e), agora = calcOrcamento(n), quebra = calcOrcamento(n, true), r = tipo === 'corretiva' ? quebra : agora; res = { agora, quebra, r, dif: quebra.total - agora.total, pct: agora.total ? Math.round((quebra.total - agora.total) / agora.total * 100) : 0 }; }
  const campo = (k, rot, step, col = 'col-6') => <div className={col}><label className="form-label" htmlFor={'o-' + k}>{rot}</label><input id={'o-' + k} className="form-control" type="number" min="0" step={step} value={e[k]} onChange={num(k)} /></div>;

  return (
    <Painel soGestor titulo="Orçamento manutenciário" acao={{ label: 'Imprimir', onClick: () => window.print() }}>
      <p className="pm-hello">Escolha a máquina e ajuste os números. A conta mostra quanto custa cuidar dela agora e quanto custaria esperar ela quebrar.</p>
      <div className="row g-3">
        <div className="col-xl-6"><section className="pm-card h-100"><h2>Montar orçamento</h2>
          <div className="row g-3 mb-3"><div className="col-sm-7"><label className="form-label" htmlFor="o-m">Máquina</label><select id="o-m" className="form-select" value={id} onChange={ev => setId(ev.target.value)}>{(maqs.data || []).map(m => <option key={m.id} value={m.id}>{m.id} · {m.nome}</option>)}</select></div>
            <div className="col-sm-5"><span className="form-label d-block">Tipo de intervenção</span><div className="btn-group w-100">{['preventiva', 'corretiva'].map(t => <span key={t} className="d-contents"><input type="radio" className="btn-check" name="tp" id={'tp-' + t} checked={tipo === t} onChange={() => setTipo(t)} /><label className="btn btn-outline-dark" htmlFor={'tp-' + t}>{t[0].toUpperCase() + t.slice(1)}</label></span>)}</div></div></div>
          {e && <>
            <h3 className="h6">Mão de obra</h3><div className="row g-2 mb-3">{campo('tecnicos', 'Técnicos', 1, 'col-4')}{campo('horas', 'Horas de trabalho', .5, 'col-4')}{campo('valorHora', 'Valor da hora (R$)', 5, 'col-4')}</div>
            <h3 className="h6">Peças e materiais</h3>
            {e.pecas.map((p, i) => <div className="row g-2 mb-2" key={i}><div className="col-12 col-sm-6"><input className="form-control" placeholder="Peça ou material" aria-label="Nome da peça" value={p.nome} onChange={ev => setPeca(i, 'nome', ev.target.value)} /></div><div className="col-4 col-sm-2"><input className="form-control" type="number" min="0" aria-label="Quantidade" value={p.qtd} onChange={ev => setPeca(i, 'qtd', ev.target.value)} /></div><div className="col-6 col-sm-3"><input className="form-control" type="number" min="0" step="0.01" aria-label="Valor unitário em reais" value={p.valor} onChange={ev => setPeca(i, 'valor', ev.target.value)} /></div><div className="col-2 col-sm-1"><button className="btn btn-outline-dark w-100 px-0" aria-label="Remover peça" onClick={() => setE({ ...e, pecas: e.pecas.filter((_, j) => j !== i) })}>×</button></div></div>)}
            <button className="btn btn-outline-dark btn-sm mb-3" onClick={() => setE({ ...e, pecas: [...e.pecas, { nome: '', qtd: 1, valor: 0 }] })}>+ Adicionar peça</button>
            <h3 className="h6">Parada e extras</h3><div className="row g-2">{campo('horasParada', 'Horas de máquina parada', 1)}{campo('custoParadaHora', 'Custo da hora parada (R$)', 50)}{campo('terceiros', 'Terceiros (R$)', 100)}{campo('contingencia', 'Margem de segurança (%)', 1)}</div></>}
        </section></div>
        <div className="col-xl-6"><section className="pm-card h-100" aria-live="polite">{res ? <>
          <h2>{e.maquina} · {e.nome}</h2><p className="pm-lbl mb-0">Total estimado, manutenção {tipo}</p><p className="pm-total mb-3">{brl(res.r.total)}</p>
          <div className="pm-stack mb-3" role="img" aria-label="Composição do custo">{Object.keys(CORES).map(k => <i key={k} style={{ width: (res.r.total ? res.r[k] / res.r.total * 100 : 0) + '%', background: CORES[k] }} />)}</div>
          {Object.keys(CORES).map(k => <div className="pm-row" key={k}><span><span className="sw" style={{ background: CORES[k] }} />{ROT[k]}</span><span>{brl(res.r[k])}</span></div>)}
          <div className="row g-2 mt-3"><div className="col-6"><div className="pm-cmp ok"><span className="pm-lbl">Cuidar agora</span><b>{brl(res.agora.total)}</b></div></div><div className="col-6"><div className="pm-cmp bad"><span className="pm-lbl">Esperar quebrar</span><b>{brl(res.quebra.total)}</b></div></div></div>
          <p className="mt-3">{res.dif > 0 ? <>Se a {e.maquina} parar antes da manutenção, a conta sobe <b>{brl(res.dif)}</b> ({res.pct}% a mais). Boa parte vem de hora extra, peça urgente e produção parada por mais tempo.</> : 'Preencha os valores para comparar.'}</p>
          <div className="d-flex flex-wrap gap-2 mt-3"><button className="btn btn-primary" onClick={() => salvar(res.r, res.agora, res.quebra)}>Salvar orçamento</button><button className="btn btn-outline-dark" onClick={() => gerarOS(res.r)}>Gerar OS com este orçamento</button></div></> : <p className="text-secondary">Carregando a base de custos…</p>}</section></div>
        <div className="col-12"><section className="pm-card"><h2>Todas as máquinas, lado a lado</h2><p className="text-secondary">“Risco” é o custo de uma quebra ponderado pela saúde da máquina: quanto pior a saúde, mais perto o risco chega do custo corretivo. Clique numa linha para orçar.</p>
          <Carga l={resumo}>{R => { const s = k => R.reduce((a, m) => a + m[k], 0); return <div className="table-responsive"><table className="table table-hover"><thead><tr><th>MÁQUINA</th><th>SETOR</th><th>SAÚDE</th><th className="text-end">PREVENTIVA</th><th className="text-end">SE QUEBRAR</th><th className="text-end">RISCO ESTIMADO</th></tr></thead>
            <tbody>{R.map(m => <tr key={m.maquina} data-id={m.maquina} onClick={() => { setId(m.maquina); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><td><b>{m.maquina}</b> {m.nome}</td><td>{m.setor}</td><td><Badge k={m.status}>{m.saude}%</Badge></td><td className="text-end">{brl(m.preventivo)}</td><td className="text-end">{brl(m.corretivo)}</td><td className="text-end"><b>{brl(m.risco)}</b></td></tr>)}</tbody>
            <tfoot><tr><td colSpan={3}><b>Planta inteira</b></td><td className="text-end"><b>{brl(s('preventivo'))}</b></td><td className="text-end"><b>{brl(s('corretivo'))}</b></td><td className="text-end"><b>{brl(s('risco'))}</b></td></tr></tfoot></table></div>; }}</Carga></section></div>
        <div className="col-12"><section className="pm-card"><h2>Orçamentos salvos</h2><Carga l={salvos}>{l => l.length ? <table className="table"><thead><tr><th>CÓDIGO</th><th>DATA</th><th>MÁQUINA</th><th>TIPO</th><th className="text-end">TOTAL</th></tr></thead><tbody>{l.slice(0, 6).map(o => <tr key={o.id}><td><b>{o.id}</b></td><td>{o.data}</td><td>{o.maquina}</td><td>{o.tipo}</td><td className="text-end">{brl(o.total)}</td></tr>)}</tbody></table> : <Vazio titulo="Nenhum orçamento salvo ainda" sub="Monte um acima e clique em “Salvar orçamento”." />}</Carga></section></div>
      </div>
    </Painel>
  );
}
