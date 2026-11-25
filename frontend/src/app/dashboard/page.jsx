'use client';
import { useState } from 'react';
import Link from 'next/link';
import Painel from '@/components/Painel';
import { Badge, Carga, LineChart, Mini, Modal, SaudeBar, Vazio, useLoad } from '@/components/ui';
import { api, num, saudacao } from '@/lib/util';
import { AcoesPreditivas } from '@/components/Previsao';

const kpiVal = k => num(k.valor, k.casas) + k.unidade;

function Foco({ f, label, cls = '', setFoco, children }) {
  const abrir = () => setFoco(f);
  return <section className={`pm-card pm-focus ${cls}`} tabIndex={0} role="button" aria-label={`Ampliar: ${label}`} onClick={abrir} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } }}>{children}</section>;
}
function OsBars({ o, max, grande }) {
  return [['Abertas', o.abertas, ''], ['Em andamento', o.andamento, 'y'], ['Aguardando peça', o.peca, 'gr'], ['Concluídas no mês', o.concluidas, 'g']].map(([t, v, c]) =>
    <div className="mb-3" key={t}><div className="pm-row"><span>{t}</span><span>{v}</span></div><div className={`pm-bar ${c} ${grande ? 'lg' : ''}`}><i style={{ width: (v / max * 100).toFixed(0) + '%' }} /></div></div>);
}

function Conteudo({ d, u, setFoco }) {
  const crit = d.alertas.find(a => a.nivel === 'critico'), os = d.osPorStatus;
  const maxOS = Math.max(os.abertas, os.andamento, os.peca, os.concluidas) * 1.15;
  return (
    <>
      <p className="pm-hello">{saudacao()}, {u.nome.split(' ')[0]}.</p>
      {crit
        ? <Link href={`/alertas?id=${crit.id}`} className="pm-destaque"><Badge k="critico" /><span><b>{crit.ativo}</b> pede atenção: {crit.titulo.toLowerCase()}, há {crit.ha}.</span><span className="pm-destaque-ir">Ver alerta →</span></Link>
        : <div className="pm-destaque ok"><Badge k="normal">Tudo certo</Badge><span>Nenhuma máquina em estado crítico agora.</span></div>}
      <div className="row g-3">
        {d.kpis.map(k => <div className="col-6 col-xl-3" key={k.k}><Foco f={'kpi:' + k.k} label={k.rotulo} cls="h-100" setFoco={setFoco}><p className="pm-lbl">{k.rotulo}</p><p className="pm-kpi">{kpiVal(k)}</p><p className="pm-sub">{k.sub}</p></Foco></div>)}
        <div className="col-lg-7"><Foco f="saude" label="saúde dos ativos" cls="h-100" setFoco={setFoco}><h2>Saúde dos ativos</h2><div className="table-responsive"><table className="table mb-0"><thead><tr><th>MÁQUINA</th><th>ÍNDICE DE SAÚDE</th><th>STATUS</th></tr></thead><tbody>{d.saude.slice(0, 5).map(m => <tr key={m.id}><td>{m.nome} <b>{m.id}</b></td><td><SaudeBar v={m.saude} /></td><td><Badge k={m.status} /></td></tr>)}</tbody></table></div></Foco></div>
        <div className="col-lg-5"><Foco f="alertas" label="alertas recentes" cls="h-100" setFoco={setFoco}><h2>Alertas recentes</h2>{d.alertas.length ? d.alertas.map(a => <div className="pm-alert-i" key={a.id}><Badge k={a.nivel} /><div><strong>{a.titulo}</strong><small>{a.ativo} · há {a.ha}</small></div></div>) : <Vazio titulo="Sem alertas novos" sub="Bom sinal." />}</Foco></div>
        <div className="col-12"><AcoesPreditivas /></div>
        <div className="col-12"><Foco f="os" label="ordens de serviço" setFoco={setFoco}><h2>Ordens de serviço</h2><div className="row g-4"><div className="col-lg-6"><OsBars o={os} max={maxOS} /></div>
          <div className="col-lg-6"><p className="pm-lbl mb-2">Próximos prazos{os.vencidas ? <> · <span className="text-danger">{os.vencidas} vencida{os.vencidas > 1 ? 's' : ''}</span></> : ''}</p>{os.proximas.slice(0, 4).map(o => <div key={o.id} className="pm-prazo"><span><b>{o.id}</b> {o.titulo}</span><span className={o.vencida ? 'text-danger fw-bold' : 'text-secondary'}>{o.prazo}</span></div>)}</div></div></Foco></div>
      </div>
    </>
  );
}

function Ampliado({ f, d, onClose }) {
  const [t, k] = f.split(':'), kp = t === 'kpi' ? d.kpis.find(x => x.k === k) : null, os = d.osPorStatus;
  const TIT = { alertas: 'Alertas recentes', saude: 'Saúde de todos os ativos', os: 'Ordens de serviço por status' };
  const maxOS = Math.max(os.abertas, os.andamento, os.peca, os.concluidas) * 1.15;
  return (
    <Modal titulo={kp ? kp.rotulo : TIT[t]} size="modal-xl" onClose={onClose}>
      {kp && <div className="row g-4 align-items-center"><div className="col-lg-4"><p className="pm-lbl">{kp.rotulo}</p><p className="pm-kpi pm-kpi-xl">{kpiVal(kp)}</p><p className="mb-3">{kp.sub}</p><p className="text-secondary">{kp.explica}</p></div>
        <div className="col-lg-8"><h3 className="h6">Últimas 8 semanas</h3><LineChart pts={kp.historico} big h={320} limite={kp.meta} limiteLabel="Meta" unit={kp.unidade} dec={kp.casas} min={kp.escalaMin} label={'Histórico de ' + kp.rotulo} /></div></div>}
      {t === 'alertas' && <div className="row g-4"><div className="col-lg-7">{d.todosAlertas.map(a => <div className="pm-alert-i" key={a.id}><Badge k={a.nivel} /><div><strong>{a.titulo}</strong><small>{a.ativo} · há {a.ha} · {a.estado}</small><small>{a.acao}</small></div></div>)}</div>
        <div className="col-lg-5"><div className="mb-3"><Mini rotulo="Críticos" valor={d.todosAlertas.filter(a => a.nivel === 'critico').length} /></div><div className="mb-3"><Mini rotulo="Em atenção" valor={d.todosAlertas.filter(a => a.nivel === 'atencao').length} /></div><Link className="btn btn-primary" href="/alertas">Abrir a central de alertas</Link></div></div>}
      {t === 'saude' && <table className="table"><thead><tr><th>CÓDIGO</th><th>MÁQUINA</th><th>SETOR</th><th>ÍNDICE DE SAÚDE</th><th>STATUS</th></tr></thead><tbody>{d.saude.map(m => <tr key={m.id}><td><b>{m.id}</b></td><td>{m.nome}</td><td>{m.setor}</td><td style={{ minWidth: 200 }}><SaudeBar v={m.saude} /></td><td><Badge k={m.status} /></td></tr>)}</tbody></table>}
      {t === 'os' && <div className="row g-4"><div className="col-lg-7"><OsBars o={os} max={maxOS} grande /></div><div className="col-lg-5"><div className="mb-3"><Mini rotulo="Com prazo vencido" valor={os.vencidas} /></div><h3 className="h6">Próximos prazos</h3>
        {os.proximas.map(o => <Link key={o.id} href={`/ordens?os=${o.id}`} className="d-flex justify-content-between text-decoration-none py-1"><span><b>{o.id}</b> {o.titulo}</span><span className={o.vencida ? 'text-danger fw-bold' : ''}>{o.prazo}</span></Link>)}<Link className="btn btn-primary mt-3" href="/ordens">Ver o quadro de ordens</Link></div></div>}
    </Modal>
  );
}

export default function Dashboard() {
  const l = useLoad(() => api.dashboard()), [foco, setFoco] = useState(null);
  return (
    <Painel titulo="Dashboard de indicadores" acao={{ label: 'Registrar medição', href: '/medicoes' }}>
      {u => <Carga l={l}>{d => <><Conteudo d={d} u={u} setFoco={setFoco} />{foco && <Ampliado f={foco} d={d} onClose={() => setFoco(null)} />}</>}</Carga>}
    </Painel>
  );
}
