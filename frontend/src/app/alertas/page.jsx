'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Painel from '@/components/Painel';
import { Badge, Carga, Modal, Vazio, useLoad, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { param } from '@/lib/util';
import { usePerfil } from '@/lib/perfil';

function Limites({ onClose }) {
  const toast = useToast(), l = useLoad(() => api.limites()), [v, setV] = useState(null);
  useEffect(() => { if (l.data) setV(Object.fromEntries(Object.entries(l.data).map(([k, x]) => [k, { atencao: x.atencao, limite: x.limite }]))); }, [l.data]);
  async function salvar() {
    if (Object.values(v).some(x => +x.atencao >= +x.limite)) return toast('O limite de atenção precisa ser menor que o de alarme.', 'warning');
    try { await api.salvarLimites(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, { atencao: +x.atencao, limite: +x.limite }]))); onClose(); toast('Limites atualizados. Valem para as próximas medições.'); } catch (e) { toast(e.message, 'danger'); }
  }
  return (
    <Modal titulo="Limites de alarme" onClose={onClose} footer={<button className="btn btn-primary" onClick={salvar}>Salvar limites</button>}>
      <p className="text-secondary">Acima do limite de atenção o alerta fica amarelo; acima do limite de alarme, vermelho.</p>
      {l.data && v && Object.entries(l.data).map(([k, x]) => <div className="row g-2 mb-3 align-items-end" key={k}><div className="col-4"><b>{x.nome}</b><div className="text-secondary small">{x.un}</div></div>
        {['atencao', 'limite'].map(c => <div className="col-4" key={c}><label className="form-label" htmlFor={c + k}>{c === 'atencao' ? 'Atenção' : 'Alarme'}</label><input id={c + k} className="form-control" type="number" step="0.1" value={v[k][c]} onChange={e => setV({ ...v, [k]: { ...v[k], [c]: e.target.value } })} /></div>)}</div>)}
    </Modal>
  );
}

export default function Alertas() {
  const toast = useToast(), l = useLoad(() => api.alertas()), [sel, setSel] = useState(null), [lim, setLim] = useState(false);
  const gestor = usePerfil() === 'gestor';
  useEffect(() => { if (l.data && sel == null) setSel(+param('id') || (l.data[0] || {}).id); }, [l.data, sel]);

  async function gerarOS(a, e) {
    e.stopPropagation(); const btn = e.currentTarget; btn.disabled = true;
    try {
      const o = await api.criarOS({ ativo: a.ativo, titulo: a.titulo + ' · ' + a.ativo, prioridade: a.nivel === 'critico' ? 'alta' : a.nivel === 'atencao' ? 'media' : 'baixa', alertaId: a.id, descricao: a.acao });
      toast(<>{o.id} criada a partir do alerta da {a.ativo}. <Link className="text-warning fw-bold" href={`/ordens?os=${o.id}`}>Ver no quadro</Link></>);
    } catch (err) { toast(err.message, 'danger'); } finally { btn.disabled = false; }
  }
  async function reconhecer(a) { try { await api.reconhecerAlerta(a.id); l.setData(d => d.map(x => x.id === a.id ? { ...x, estado: 'reconhecido' } : x)); toast('Alerta reconhecido. A equipe vê que alguém já está de olho.'); } catch (e) { toast(e.message, 'danger'); } }

  return (
    <Painel titulo="Central de alertas" acao={{ label: 'Configurar limites', onClick: () => setLim(true), soGestor: true }}>
      <Carga l={l}>{lista => { const c = n => lista.filter(a => a.nivel === n).length, a = lista.find(x => x.id === sel); return <>
        <div className="row g-3 mb-3">{[['Críticos', 'critico', 'Exigem ação imediata'], ['Atenção', 'atencao', 'Tendência de piora'], ['Informativos', 'info', 'Sem risco imediato']].map(([t, n, s]) => <div className="col-md-4" key={n}><div className="pm-card"><p className="pm-lbl">{t}</p><p className="pm-kpi">{c(n)}</p><p className="pm-sub">{s}</p></div></div>)}</div>
        <div className="row g-3">
          <div className="col-xl-8"><section className="pm-card h-100"><h2>Alertas ativos</h2><div className="table-responsive"><table className="table table-hover"><thead><tr><th>NÍVEL</th><th>ALERTA</th><th>ATIVO</th><th>HÁ</th><th>ESTADO</th><th /></tr></thead>
            <tbody>{lista.length ? lista.map(x => <tr key={x.id} className={x.id === sel ? 'table-warning' : ''} style={{ cursor: 'pointer' }} onClick={() => setSel(x.id)}><td><Badge k={x.nivel} /></td><td><b>{x.titulo}</b></td><td>{x.ativo}</td><td>{x.ha}</td><td>{x.estado[0].toUpperCase() + x.estado.slice(1)}</td><td>{gestor && <button className="btn btn-outline-dark btn-sm" onClick={e => gerarOS(x, e)}>Gerar OS</button>}</td></tr>) : <tr><td colSpan={6}><Vazio titulo="Nenhum alerta ativo" sub="A planta está quieta. Aproveite." /></td></tr>}</tbody></table></div></section></div>
          <div className="col-xl-4"><section className="pm-card h-100" aria-live="polite"><h2>Detalhe do alerta</h2>{a ? <>
            <Badge k={a.nivel} /><h3 className="h5 mt-2 mb-0">{a.titulo}</h3><p className="text-secondary">{a.maquina} {a.ativo}{a.setor ? ' · ' + a.setor : ''}</p>
            <table className="table table-sm"><tbody><tr><td>Medido</td><td className="text-end"><b>{a.medido}</b></td></tr><tr><td>Limite</td><td className="text-end"><b>{a.limite}</b></td></tr><tr><td>Previsão de falha</td><td className="text-end"><b>{a.previsao}</b></td></tr></tbody></table>
            <p><b>Ação recomendada:</b> {a.acao}</p>
            <div className="d-grid gap-2">{gestor && <button className="btn btn-primary py-2" onClick={e => gerarOS(a, e)}>Gerar ordem de serviço</button>}<button className="btn btn-outline-dark py-2" disabled={a.estado === 'reconhecido'} onClick={() => reconhecer(a)}>{a.estado === 'reconhecido' ? 'Alerta já reconhecido' : 'Reconhecer alerta'}</button></div></>
            : <Vazio titulo="Escolha um alerta" sub="Clique em uma linha para ver os detalhes." />}</section></div>
        </div></>; }}</Carga>
      {lim && <Limites onClose={() => setLim(false)} />}
    </Painel>
  );
}
