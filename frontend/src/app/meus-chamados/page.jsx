'use client';
import { useEffect, useState } from 'react';
import { AreaFuncionario } from '@/components/Painel';
import { Badge, Carga, Vazio, useLoad, useToast } from '@/components/ui';
import { api, urlArquivo } from '@/lib/util';

const SIT = { 'Registrado': 'neutro', 'Triado': 'info', 'Técnico designado': 'info', 'Em reparo': 'atencao', 'Concluído': 'normal' };

function Lista() {
  const toast = useToast(), l = useLoad(() => api.chamados()), [sel, setSel] = useState(null), [txt, setTxt] = useState('');
  useEffect(() => { if (l.data && !sel && l.data[0]) setSel(l.data[0].id); }, [l.data, sel]);
  async function comentar(c) {
    if (!txt.trim()) return toast('Escreva o comentário antes de enviar.', 'warning');
    try { const n = await api.comentarChamado(c.id, txt.trim()); l.setData(d => d.map(x => x.id === c.id ? { ...x, ...n } : x)); setTxt(''); toast('Comentário enviado para a equipe.'); } catch (e) { toast(e.message, 'danger'); }
  }
  return (
    <Carga l={l}>{lista => {
      const n = f => lista.filter(c => f.includes(c.situacao)).length, c = lista.find(x => x.id === sel);
      return <>
        <div className="row g-3 mb-3">{[['Em aberto', n(['Registrado', 'Triado']), 'Aguardando atendimento'], ['Em atendimento', n(['Técnico designado', 'Em reparo']), 'Técnico designado'], ['Concluídos', n(['Concluído']), 'Nos últimos 90 dias']].map(([a, b, s]) => <div className="col-md-4" key={a}><div className="pm-card"><p className="pm-lbl">{a}</p><p className="pm-kpi">{b}</p><p className="pm-sub">{s}</p></div></div>)}</div>
        <div className="row g-3">
          <div className="col-lg-7"><section className="pm-card h-100"><h2>Histórico de chamados</h2><div className="table-responsive"><table className="table table-hover"><thead><tr><th>PROTOCOLO</th><th>MÁQUINA</th><th>PROBLEMA</th><th>SITUAÇÃO</th><th>ABERTO EM</th></tr></thead>
            <tbody>{lista.length ? lista.map(x => <tr key={x.id} className={x.id === sel ? 'table-warning' : ''} style={{ cursor: 'pointer' }} onClick={() => setSel(x.id)}><td><b>{x.id}</b></td><td>{x.maquina}</td><td>{x.problema}</td><td><Badge k={SIT[x.situacao] || 'neutro'}>{x.situacao}</Badge></td><td>{x.aberto}</td></tr>) : <tr><td colSpan={5}><Vazio titulo="Você ainda não abriu chamados" sub="Viu algo estranho? Abra o primeiro em “Abrir chamado”." /></td></tr>}</tbody></table></div></section></div>
          <div className="col-lg-5"><section className="pm-card h-100" aria-live="polite">{c ? <>
            <h2>{c.id} · {c.maquina} · {c.problema}</h2>
            {c.descricao && <p className="mb-2">{c.descricao}</p>}
            {c.foto && <a className="pm-foto d-block mb-3" href={urlArquivo(c.foto)} target="_blank" rel="noreferrer"><img src={urlArquivo(c.foto)} alt={`Foto anexada ao chamado ${c.id}`} loading="lazy" /><small>Abrir foto em tamanho real</small></a>}
            <ol className="pm-tl">{c.timeline.map(t => <li key={t.nome} className={t.estado === 'feito' ? '' : t.estado}><b>{t.nome}</b>{(t.quando || t.detalhe) && <small>{[t.quando, t.detalhe].filter(Boolean).join(' · ')}</small>}</li>)}</ol>
            {c.comentarios.length > 0 && <><h3 className="h6">Seus comentários</h3>{c.comentarios.map((k, i) => <p className="mb-1" key={i}><small className="text-secondary">{k.quando}</small><br />{k.texto}</p>)}</>}
            <label className="form-label mt-2" htmlFor="cm">Adicionar informação</label><textarea id="cm" className="form-control mb-2" rows={2} placeholder="Algo mudou? Escreva aqui" value={txt} onChange={e => setTxt(e.target.value)} /><button className="btn btn-outline-dark" onClick={() => comentar(c)}>Enviar comentário</button></> : <h2>Detalhe</h2>}</section></div>
        </div></>; }}</Carga>
  );
}
export default function MeusChamados() {
  return <AreaFuncionario><h1 className="h2 mb-1">Meus chamados</h1><p className="text-secondary mb-4">Acompanhe o andamento do que você registrou.</p><Lista /></AreaFuncionario>;
}
