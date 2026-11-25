'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Painel from '@/components/Painel';
import { Badge, Carga, useLoad, useToast } from '@/components/ui';
import { calcOrcamento } from '@/lib/calc';
import { api, brl, param } from '@/lib/util';

const TIPOS = ['preventiva', 'corretiva'];
const cap = t => t[0].toUpperCase() + t.slice(1);

export default function Orcamento() {
  const toast = useToast();
  const maqs = useLoad(() => api.maquinas({ ordem: 'codigo' })), resumo = useLoad(() => api.orcamentoResumo()), salvos = useLoad(() => api.orcamentos());
  const [id, setId] = useState(''), [e, setE] = useState(null), [tipo, setTipo] = useState('preventiva'), [editando, setEditando] = useState(null);

  // Máquina inicial: a do link (?maquina=) ou a primeira em estado crítico
  useEffect(() => { if (resumo.data && !id) setId(param('maquina') || (resumo.data.find(m => m.status === 'critico') || resumo.data[0]).maquina); }, [resumo.data, id]);
  useEffect(() => { if (id) { setEditando(null); api.orcamentoBase(id).then(setE).catch(er => toast(er.message, 'danger')); } }, [id]); // eslint-disable-line

  const num = k => ev => setE({ ...e, [k]: ev.target.value });
  const norm = x => ({ ...x, tecnicos: +x.tecnicos || 0, horas: +x.horas || 0, valorHora: +x.valorHora || 0, horasParada: +x.horasParada || 0, custoParadaHora: +x.custoParadaHora || 0, terceiros: +x.terceiros || 0, contingencia: +x.contingencia || 0, pecas: x.pecas.map(p => ({ ...p, qtd: +p.qtd || 0, valor: +p.valor || 0 })) });
  const setPeca = (i, k, v) => setE({ ...e, pecas: e.pecas.map((p, j) => j === i ? { ...p, [k]: v } : p) });
  const novaPeca = () => { setE({ ...e, pecas: [...e.pecas, { nome: '', qtd: 1, valor: 0 }] }); setEditando(e.pecas.length); };
  const tirarPeca = i => { setE({ ...e, pecas: e.pecas.filter((_, j) => j !== i) }); setEditando(null); };

  async function salvar(r, agora, quebra) {
    try { const o = await api.salvarOrcamento({ maquina: e.maquina, tipo, total: Math.round(r.total), cuidarAgora: Math.round(agora.total), esperarQuebrar: Math.round(quebra.total), detalhes: norm(e) }); toast(`${o.id} salvo para a ${e.maquina}.`); salvos.recarregar(); } catch (er) { toast(er.message, 'danger'); }
  }
  async function gerarOS(r) {
    try { const o = await api.criarOS({ ativo: e.maquina, titulo: `Manutenção ${tipo} · ${e.nome}`, prioridade: 'media', descricao: `Orçado em ${brl(r.total)} no PredictMaint.` }); toast(<>{o.id} criada. <Link className="text-warning fw-bold" href={`/ordens?os=${o.id}`}>Ver no quadro</Link></>); } catch (er) { toast(er.message, 'danger'); }
  }

  let res = null;
  if (e) { const n = norm(e), agora = calcOrcamento(n), quebra = calcOrcamento(n, true); res = { agora, quebra, r: tipo === 'corretiva' ? quebra : agora, dif: quebra.total - agora.total, cont: n.contingencia }; }
  const campo = (k, rot, step, col = 'col-6') => <div className={col}><label className="form-label" htmlFor={'o-' + k}>{rot}</label><input id={'o-' + k} className="form-control" type="number" min="0" step={step} value={e[k]} onChange={num(k)} /></div>;
  const passo = (n, titulo) => <h3 className="pm-passo"><span aria-hidden="true">{n}</span>{titulo}</h3>;

  return (
    <Painel soGestor titulo="Orçamento manutenciário" acao={{ label: 'Imprimir', onClick: () => window.print() }}>
      <div className="row g-3">
        <div className="col-lg-6"><section className="pm-card h-100">
          <h2 className="mb-1">Montar orçamento</h2>
          <p className="pm-sub mb-3">Preencha em 3 passos. O resultado aparece ao lado na hora.</p>

          {passo(1, 'Qual máquina e tipo de serviço?')}
          <label className="visually-hidden" htmlFor="o-m">Máquina</label>
          <select id="o-m" className="form-select mb-2" value={id} onChange={ev => setId(ev.target.value)}>{(maqs.data || []).map(m => <option key={m.id} value={m.id}>{m.id} · {m.nome}</option>)}</select>
          <div className="pm-seg mb-4" role="radiogroup" aria-label="Tipo de serviço">{TIPOS.map(t => <span key={t} className="d-contents"><input type="radio" className="btn-check" name="tp" id={'tp-' + t} checked={tipo === t} onChange={() => setTipo(t)} /><label className="btn" htmlFor={'tp-' + t}>{cap(t)}</label></span>)}</div>

          {e && <>
            {passo(2, 'Mão de obra')}
            <div className="row g-2 mb-4 align-items-end">{campo('tecnicos', 'Técnicos', 1, 'col-4')}{campo('horas', 'Horas', .5, 'col-4')}{campo('valorHora', 'Valor da hora (R$)', 5, 'col-4')}</div>

            {passo(3, 'Peças e parada')}
            <ul className="pm-pecas">
              {e.pecas.map((p, i) => editando === i
                ? <li key={i} className="pm-peca-edit"><div className="row g-2">
                    <div className="col-12"><input className="form-control" placeholder="Peça ou material" aria-label="Nome da peça" value={p.nome} onChange={ev => setPeca(i, 'nome', ev.target.value)} autoFocus /></div>
                    <div className="col-4"><input className="form-control" type="number" min="0" aria-label="Quantidade" value={p.qtd} onChange={ev => setPeca(i, 'qtd', ev.target.value)} /></div>
                    <div className="col-8"><input className="form-control" type="number" min="0" step="0.01" aria-label="Valor unitário em reais" value={p.valor} onChange={ev => setPeca(i, 'valor', ev.target.value)} /></div>
                    <div className="col-12 d-flex gap-2"><button className="btn btn-dark btn-sm" onClick={() => setEditando(null)}>Pronto</button><button className="btn btn-outline-dark btn-sm" aria-label="Remover peça" onClick={() => tirarPeca(i)}>Remover</button></div>
                  </div></li>
                : <li key={i}><button type="button" className="pm-peca" title="Clique para editar" onClick={() => setEditando(i)}><span><b>{+p.qtd || 0}×</b> {p.nome || 'Peça sem nome'}</span><span>{brl((+p.qtd || 0) * (+p.valor || 0))}</span></button></li>)}
            </ul>
            <button type="button" className="btn btn-link pm-add mb-3" onClick={novaPeca}>+ Adicionar peça</button>
            <div className="row g-2">{campo('horasParada', 'Horas de máquina parada', 1)}{campo('custoParadaHora', 'Custo da hora parada (R$)', 50)}</div>
            <details className="pm-ajustes mt-3"><summary>Outros ajustes (terceiros e margem)</summary><div className="row g-2 mt-1">{campo('terceiros', 'Terceiros (R$)', 100)}{campo('contingencia', 'Margem de segurança (%)', 1)}</div></details>
          </>}
        </section></div>

        <div className="col-lg-6"><section className="pm-card h-100" aria-live="polite">{res ? <>
          <h2 className="mb-2">{e.maquina} · {e.nome}</h2>
          <p className="pm-lbl mb-0">Total da manutenção {tipo}</p>
          <p className="pm-total mb-3">{brl(res.r.total)}</p>
          <div className="row g-2 mb-3"><div className="col-6"><div className="pm-cmp ok"><span className="pm-lbl">Cuidar agora</span><b>{brl(res.agora.total)}</b></div></div><div className="col-6"><div className="pm-cmp bad"><span className="pm-lbl">Esperar quebrar</span><b>{brl(res.quebra.total)}</b></div></div></div>
          {res.dif > 0 && <p className="pm-economia">Fazendo a preventiva agora você economiza <b>{brl(res.dif)}</b>.</p>}
          <div className="pm-linhas">
            <div className="pm-row"><span>Mão de obra</span><span>{brl(res.r.mo)}</span></div>
            <div className="pm-row"><span>Peças e materiais</span><span>{brl(res.r.pecas)}</span></div>
            {res.r.terceiros > 0 && <div className="pm-row"><span>Serviços de terceiros</span><span>{brl(res.r.terceiros)}</span></div>}
            <div className="pm-row"><span>Produção parada</span><span>{brl(res.r.parada)}</span></div>
            <div className="pm-row"><span>Margem de segurança ({res.cont}%)</span><span>{brl(res.r.contingencia)}</span></div>
          </div>
          <div className="d-flex flex-wrap gap-2 mt-3"><button className="btn btn-primary" onClick={() => salvar(res.r, res.agora, res.quebra)}>Salvar orçamento</button><button className="btn btn-outline-dark" onClick={() => gerarOS(res.r)}>Gerar OS</button></div>
          {salvos.data?.length > 0 && <p className="pm-ultimos" data-testid="ultimos-salvos"><b>Últimos salvos:</b> {salvos.data.slice(0, 3).map(o => `${o.id} ${o.tipo} ${brl(o.total)}`).join(' · ')}</p>}
        </> : <p className="text-secondary">Carregando a base de custos…</p>}</section></div>

        <div className="col-12"><details className="pm-card pm-todas"><summary><b>Comparar todas as máquinas</b> <span className="text-secondary">· custo preventivo, corretivo e risco de cada uma</span></summary>
          <p className="text-secondary mt-2">“Risco” é o custo de uma quebra ponderado pela saúde da máquina. Clique numa linha para orçar.</p>
          <Carga l={resumo}>{R => { const s = k => R.reduce((a, m) => a + m[k], 0); return <div className="table-responsive"><table className="table table-hover"><thead><tr><th>MÁQUINA</th><th>SETOR</th><th>SAÚDE</th><th className="text-end">PREVENTIVA</th><th className="text-end">SE QUEBRAR</th><th className="text-end">RISCO ESTIMADO</th></tr></thead>
            <tbody>{R.map(m => <tr key={m.maquina} data-id={m.maquina} onClick={() => { setId(m.maquina); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><td><b>{m.maquina}</b> {m.nome}</td><td>{m.setor}</td><td><Badge k={m.status}>{m.saude}%</Badge></td><td className="text-end">{brl(m.preventivo)}</td><td className="text-end">{brl(m.corretivo)}</td><td className="text-end"><b>{brl(m.risco)}</b></td></tr>)}</tbody>
            <tfoot><tr><td colSpan={3}><b>Planta inteira</b></td><td className="text-end"><b>{brl(s('preventivo'))}</b></td><td className="text-end"><b>{brl(s('corretivo'))}</b></td><td className="text-end"><b>{brl(s('risco'))}</b></td></tr></tfoot></table></div>; }}</Carga>
        </details></div>
      </div>
    </Painel>
  );
}
