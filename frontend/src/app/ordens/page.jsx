'use client';
import { useEffect, useState } from 'react';
import Painel from '@/components/Painel';
import { Badge, Carga, Modal, useLoad, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { EQUIPES, STATUS_OS, param } from '@/lib/util';

const COLS = ['aberta', 'andamento', 'peca', 'concluida'];

function NovaOS({ maqs, onClose, onOk }) {
  const toast = useToast(), [f, setF] = useState({ titulo: '', ativo: maqs[0]?.id || '', equipe: EQUIPES[0], prioridade: 'media', prazo: '', descricao: '' });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  async function criar() { try { const o = await api.criarOS({ ...f, titulo: f.titulo.trim() }); toast(`${o.id} criada e já está na coluna “abertas”.`); onOk(); } catch (e) { toast(e.message, 'danger'); } }
  return (
    <Modal titulo="Nova ordem de serviço" onClose={onClose} footer={<button className="btn btn-primary" onClick={criar}>Criar OS</button>}>
      <div className="row g-3">
        <div className="col-12"><label className="form-label" htmlFor="n-t">O que precisa ser feito?</label><input className="form-control" id="n-t" placeholder="Ex.: Trocar rolamento do mancal" value={f.titulo} onChange={set('titulo')} /></div>
        <div className="col-sm-6"><label className="form-label" htmlFor="n-a">Máquina</label><select className="form-select" id="n-a" value={f.ativo} onChange={set('ativo')}>{maqs.map(x => <option key={x.id} value={x.id}>{x.id} · {x.nome}</option>)}</select></div>
        <div className="col-sm-6"><label className="form-label" htmlFor="n-e">Equipe</label><select className="form-select" id="n-e" value={f.equipe} onChange={set('equipe')}>{EQUIPES.map(e => <option key={e}>{e}</option>)}</select></div>
        <div className="col-sm-6"><label className="form-label" htmlFor="n-p">Prioridade</label><select className="form-select" id="n-p" value={f.prioridade} onChange={set('prioridade')}><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select></div>
        <div className="col-sm-6"><label className="form-label" htmlFor="n-d">Prazo</label><input className="form-control" id="n-d" type="date" value={f.prazo} onChange={set('prazo')} /></div>
        <div className="col-12"><label className="form-label" htmlFor="n-x">Detalhes</label><textarea className="form-control" id="n-x" rows={3} value={f.descricao} onChange={set('descricao')} /></div>
      </div>
    </Modal>
  );
}

export default function Ordens() {
  const toast = useToast(), [fe, setFe] = useState(''), [fp, setFp] = useState(''), [fd, setFd] = useState('30'), [det, setDet] = useState(null), [nova, setNova] = useState(false), [sobre, setSobre] = useState(null), [novoSt, setNovoSt] = useState('');
  const l = useLoad(() => api.ordens({ equipe: fe, prioridade: fp, periodo: fd }), [fe, fp, fd]);
  const maqs = useLoad(() => api.maquinas({ ordem: 'codigo' }));
  useEffect(() => { const o = param('os'); if (o) setDet(o); }, []);

  async function mover(id, status) {
    const o = (l.data || []).find(x => x.id === id); if (!o || o.status === status) return;
    try { await api.atualizarOS(id, { status }); l.setData(d => d.map(x => x.id === id ? { ...x, status } : x)); toast(`${id} agora está em “${STATUS_OS[status].toLowerCase()}”.`); } catch (e) { toast(e.message, 'danger'); }
  }
  const o = det && (l.data || []).find(x => x.id === det);
  return (
    <Painel titulo="Ordens de serviço" acao={{ soGestor: true, label: 'Nova OS', onClick: () => setNova(true) }}>
      <div className="pm-card mb-3"><div className="row g-3 align-items-end">
        <div className="col-md-3"><label className="form-label" htmlFor="f-e">Responsável</label><select id="f-e" className="form-select" value={fe} onChange={e => setFe(e.target.value)}><option value="">Todas as equipes</option>{EQUIPES.map(e => <option key={e}>{e}</option>)}</select></div>
        <div className="col-md-3"><label className="form-label" htmlFor="f-p">Prioridade</label><select id="f-p" className="form-select" value={fp} onChange={e => setFp(e.target.value)}><option value="">Todas</option><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select></div>
        <div className="col-md-4"><label className="form-label" htmlFor="f-d">Período</label><select id="f-d" className="form-select" value={fd} onChange={e => setFd(e.target.value)}><option value="30">Últimos 30 dias</option><option value="7">Últimos 7 dias</option><option value="90">Últimos 90 dias</option></select></div>
        <div className="col-md-2"><button className="btn btn-outline-dark w-100" onClick={() => { setFe(''); setFp(''); setFd('30'); }}>Limpar filtros</button></div></div></div>
      <p className="text-secondary small mb-2">Dica: arraste um cartão para outra coluna para mudar o status da OS.</p>
      <Carga l={l}>{lista => <div className="row g-3">{COLS.map(s => { const itens = lista.filter(x => x.status === s); return (
        <div className="col-md-6 col-xl-3" key={s}><div className={`pm-col${sobre === s ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setSobre(s); }} onDragLeave={() => setSobre(null)} onDrop={e => { e.preventDefault(); setSobre(null); mover(e.dataTransfer.getData('text/plain'), s); }}>
          <h2>{STATUS_OS[s]} · {itens.length}</h2>
          <div className="scroll">{itens.length ? itens.map(x => <article key={x.id} className={`pm-os${x.vencida ? ' late' : ''}`} draggable tabIndex={0} onDragStart={e => e.dataTransfer.setData('text/plain', x.id)} onClick={() => { setDet(x.id); setNovoSt(x.status); }} onKeyDown={e => { if (e.key === 'Enter') { setDet(x.id); setNovoSt(x.status); } }}>
            <div className="d-flex justify-content-between align-items-start"><strong>{x.id}</strong><Badge k={x.prioridade} /></div><p>{x.titulo}</p><small>{x.ativo} · Equipe {x.equipe}</small><small className="pz">Prazo: {x.prazo}{x.vencida ? ' (vencido)' : ''}</small></article>) : <p className="text-secondary small px-1">Nada por aqui.</p>}</div>
        </div></div>); })}</div>}</Carga>
      {o && <Modal titulo={<>{o.id} <Badge k={o.prioridade} /></>} onClose={() => setDet(null)} footer={<button className="btn btn-primary" onClick={async () => { await mover(o.id, novoSt || o.status); setDet(null); }}>Atualizar status</button>}>
        <h3 className="h5">{o.titulo}</h3><p className="text-secondary">{o.ativo} · Equipe {o.equipe} · Prazo {o.prazo}{o.vencida && <b className="text-danger"> (vencido)</b>}</p>{o.descricao && <p>{o.descricao}</p>}
        <label className="form-label" htmlFor="o-s">Status</label><select id="o-s" className="form-select" value={novoSt || o.status} onChange={e => setNovoSt(e.target.value)}>{COLS.map(s => <option key={s} value={s}>{STATUS_OS[s]}</option>)}</select></Modal>}
      {nova && maqs.data && <NovaOS maqs={maqs.data} onClose={() => setNova(false)} onOk={() => { setNova(false); l.recarregar(); }} />}
    </Painel>
  );
}
