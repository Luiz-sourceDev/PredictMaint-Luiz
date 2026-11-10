'use client';
import { useEffect, useState } from 'react';
import Painel from '@/components/Painel';
import AtivoModal from '@/components/AtivoModal';
import { Badge, Carga, Modal, SaudeBar, Vazio, useLoad, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { param } from '@/lib/util';

function NovaMaquina({ setores, onClose, onOk }) {
  const toast = useToast(), [f, setF] = useState({ id: '', nome: '', setor: '', prox: '', custoParada: '' });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  async function salvar() { try { await api.criarMaquina(f); toast('Máquina cadastrada. Já aparece na lista e na planta.'); onOk(); } catch (e) { toast(e.message, 'danger'); } }
  return (
    <Modal titulo="Nova máquina" onClose={onClose} footer={<button className="btn btn-primary" onClick={salvar}>Cadastrar máquina</button>}>
      <div className="row g-3">
        <div className="col-sm-4"><label className="form-label" htmlFor="nm-id">Código</label><input className="form-control" id="nm-id" placeholder="Ex.: PH-06" value={f.id} onChange={set('id')} /></div>
        <div className="col-sm-8"><label className="form-label" htmlFor="nm-n">Nome</label><input className="form-control" id="nm-n" placeholder="Ex.: Prensa Hidráulica" value={f.nome} onChange={set('nome')} /></div>
        <div className="col-sm-6"><label className="form-label" htmlFor="nm-s">Setor</label><input className="form-control" id="nm-s" list="setores" placeholder="Ex.: Estamparia" value={f.setor} onChange={set('setor')} /><datalist id="setores">{setores.map(s => <option key={s}>{s}</option>)}</datalist></div>
        <div className="col-sm-6"><label className="form-label" htmlFor="nm-p">Próxima manutenção</label><input className="form-control" id="nm-p" type="date" value={f.prox} onChange={set('prox')} /></div>
        <div className="col-12"><label className="form-label" htmlFor="nm-c">Custo de cada hora parada (R$)</label><input className="form-control" id="nm-c" type="number" min="0" step="50" placeholder="Usado no orçamento manutenciário" value={f.custoParada} onChange={set('custoParada')} /></div>
      </div>
    </Modal>
  );
}

export default function Maquinas() {
  const [fs, setFs] = useState(''), [ft, setFt] = useState(''), [fo, setFo] = useState('saude'), [det, setDet] = useState(null), [nova, setNova] = useState(false);
  const todas = useLoad(() => api.maquinas());
  const l = useLoad(() => api.maquinas({ setor: fs, status: ft, ordem: fo }), [fs, ft, fo]);
  useEffect(() => { const id = param('id'); if (id) setDet(id); }, []);
  const T = todas.data || [], setores = [...new Set(T.map(m => m.setor))], c = s => T.filter(m => m.status === s).length;
  return (
    <Painel titulo="Máquinas e ativos" acao={{ label: 'Nova máquina', onClick: () => setNova(true), soGestor: true }}>
      <div className="row g-3 mb-3">{[['Ativos monitorados', T.length, `Em ${setores.length} setores`], ['Normais', c('normal'), 'Índice de saúde acima de 75%'], ['Em atenção', c('atencao'), 'Acompanhar tendência'], ['Críticos', c('critico'), 'Ação imediata']].map(([a, b, s]) => <div className="col-6 col-xl-3" key={a}><div className="pm-card h-100"><p className="pm-lbl">{a}</p><p className="pm-kpi">{b}</p><p className="pm-sub">{s}</p></div></div>)}</div>
      <div className="pm-card mb-3"><div className="row g-3 align-items-end">
        <div className="col-md-3"><label className="form-label" htmlFor="f-s">Setor</label><select id="f-s" className="form-select" value={fs} onChange={e => setFs(e.target.value)}><option value="">Todos os setores</option>{setores.map(s => <option key={s}>{s}</option>)}</select></div>
        <div className="col-md-3"><label className="form-label" htmlFor="f-t">Status</label><select id="f-t" className="form-select" value={ft} onChange={e => setFt(e.target.value)}><option value="">Todos</option><option value="critico">Crítico</option><option value="atencao">Atenção</option><option value="normal">Normal</option></select></div>
        <div className="col-md-4"><label className="form-label" htmlFor="f-o">Ordenar por</label><select id="f-o" className="form-select" value={fo} onChange={e => setFo(e.target.value)}><option value="saude">Menor índice de saúde</option><option value="codigo">Código</option><option value="setor">Setor</option></select></div>
        <div className="col-md-2"><button className="btn btn-outline-dark w-100" onClick={() => { setFs(''); setFt(''); setFo('saude'); }}>Limpar filtros</button></div></div></div>
      <div className="pm-card"><Carga l={l}>{lista => <div className="table-responsive"><table className="table"><thead><tr><th>CÓDIGO</th><th>MÁQUINA</th><th>SETOR</th><th>SAÚDE</th><th>STATUS</th><th>ÚLTIMA MEDIÇÃO</th><th>PRÓX. MANUTENÇÃO</th><th /></tr></thead>
        <tbody>{lista.length ? lista.map(m => <tr key={m.id}><td>{m.id}</td><td><b>{m.nome}</b></td><td>{m.setor}</td><td style={{ minWidth: 170 }}><SaudeBar v={m.saude} /></td><td><Badge k={m.status} /></td><td>{m.ultima}</td><td>{m.prox}</td><td><button className="btn btn-outline-dark btn-sm" onClick={() => setDet(m.id)}>Detalhes</button></td></tr>) : <tr><td colSpan={8}><Vazio titulo="Nenhuma máquina com esses filtros" sub="Limpe os filtros para ver todas." /></td></tr>}</tbody></table></div>}</Carga></div>
      {det && <AtivoModal id={det} onClose={() => setDet(null)} />}
      {nova && <NovaMaquina setores={setores} onClose={() => setNova(false)} onOk={() => { setNova(false); l.recarregar(); todas.recarregar(); }} />}
    </Painel>
  );
}
