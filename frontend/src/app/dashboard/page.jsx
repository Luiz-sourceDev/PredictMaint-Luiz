'use client';
import { useState } from 'react';
import Link from 'next/link';
import Painel from '@/components/Painel';
import { Badge, Carga, LineChart, Mini, Modal, SaudeBar, Vazio, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { num, saudacao } from '@/lib/util';

const kpiVal = k => num(k.valor, k.casas) + k.unidade;

function Foco({ f, label, cls = '', setFoco, children }) {
  const abrir = () => setFoco(f);
  return <section className={`pm-card pm-focus ${cls}`} tabIndex={0} role="button" aria-label={`Ampliar: ${label}`} onClick={abrir} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } }}>{children}</section>;
}
function OsBars({ o, max, grande }) {
  return [['Abertas', o.abertas, ''], ['Em andamento', o.andamento, 'y'], ['Aguardando peça', o.peca, 'gr'], ['Concluídas no mês', o.concluidas, 'g']].map(([t, v, c]) =>
    <div className="mb-3" key={t}><div className="pm-row"><span>{t}</span><span>{v}</span></div><div className={`pm-bar ${c} ${grande ? 'lg' : ''}`}><i style={{ width: (v / max * 100).toFixed(0) + '%' }} /></div></div>);
}

function VibFoco({ d }) {
  const [maq, setMaq] = useState(d.vibracao.maquina), [g, setG] = useState('vibracao'), [per, setPer] = useState(99);
  const l = useLoad(() => api.serie(maq, g), [maq, g]);
  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-sm-4"><label className="form-label" htmlFor="ex-m">Máquina</label><select id="ex-m" className="form-select" value={maq} onChange={e => setMaq(e.target.value)}>{d.maquinas.map(m => <option key={m.id} value={m.id}>{m.id} · {m.nome}</option>)}</select></div>
        <div className="col-sm-4"><label className="form-label" htmlFor="ex-g">Grandeza</label><select id="ex-g" className="form-select" value={g} onChange={e => setG(e.target.value)}><option value="vibracao">Vibração</option><option value="temperatura">Temperatura</option><option value="corrente">Corrente</option></select></div>
        <div className="col-sm-4"><span className="form-label d-block">Período</span><div className="btn-group w-100">{[[4, '7 dias'], [7, '14 dias'], [99, 'Tudo']].map(([v, t]) => <span key={v} className="d-contents"><input type="radio" className="btn-check" name="per" id={'per' + v} checked={per === v} onChange={() => setPer(v)} /><label className="btn btn-outline-dark" htmlFor={'per' + v}>{t}</label></span>)}</div></div>
      </div>
      <Carga l={l}>{s => { const ult = s.pontos[s.pontos.length - 1].y, mx = Math.max(...s.pontos.map(x => x.y)), dif = ult - s.limite; return <>
        <LineChart pts={s.pontos.slice(-per)} limite={s.limite} unit={s.unidade} big h={340} label={`${s.nome} de ${s.maquina}`} />
        <div className="row g-3 mt-1">{[['Última leitura', `${num(ult)} ${s.unidade}`], ['Maior valor', `${num(mx)} ${s.unidade}`], ['Limite de alarme', `${num(s.limite)} ${s.unidade}`], ['Folga', dif > 0 ? `${num(dif)} acima do limite` : `${num(-dif)} abaixo do limite`]].map(([a, b]) => <div key={a} className="col-6 col-md-3"><Mini rotulo={a} valor={b} /></div>)}</div></>; }}</Carga>
    </>
  );
}

function Conteudo({ d, u, setFoco }) {
  const crit = d.alertas.find(a => a.nivel === 'critico'), os = d.osPorStatus;
  const maxOS = Math.max(os.abertas, os.andamento, os.peca, os.concluidas) * 1.15;
  return (
    <>
      <p className="pm-hello">{saudacao()}, {u.nome.split(' ')[0]}. {crit ? <>A <b>{crit.ativo}</b> está pedindo atenção: {crit.titulo.toLowerCase()}, há {crit.ha}. Clique em qualquer gráfico ou indicador para vê-lo em destaque.</> : 'A planta está tranquila agora. Clique em qualquer gráfico ou indicador para vê-lo em destaque.'}</p>
      <div className="row g-3">
        {d.kpis.map(k => <div className="col-6 col-xl-3" key={k.k}><Foco f={'kpi:' + k.k} label={k.rotulo} cls="h-100" setFoco={setFoco}><p className="pm-lbl">{k.rotulo}</p><p className="pm-kpi">{kpiVal(k)}</p><p className="pm-sub">{k.sub}</p></Foco></div>)}
        <div className="col-xl-8"><Foco f="vib" label="vibração" cls="h-100" setFoco={setFoco}><h2>Vibração · Prensa Hidráulica {d.vibracao.maquina} ({d.vibracao.unidade})</h2><LineChart pts={d.vibracao.pontos} limite={d.vibracao.limite} unit={d.vibracao.unidade} label="Vibração da prensa PH-03 ao longo de outubro" /></Foco></div>
        <div className="col-xl-4"><Foco f="alertas" label="alertas recentes" cls="h-100" setFoco={setFoco}><h2>Alertas recentes</h2>{d.alertas.length ? d.alertas.map(a => <div className="pm-alert-i" key={a.id}><Badge k={a.nivel} /><div><strong>{a.titulo}</strong><small>{a.ativo} · há {a.ha}</small></div></div>) : <Vazio titulo="Sem alertas novos" sub="Bom sinal." />}</Foco></div>
        <div className="col-xl-7"><Foco f="saude" label="saúde dos ativos" cls="h-100" setFoco={setFoco}><h2>Saúde dos ativos</h2><div className="table-responsive"><table className="table"><thead><tr><th>MÁQUINA</th><th>ÍNDICE DE SAÚDE</th><th>STATUS</th></tr></thead><tbody>{d.saude.slice(0, 4).map(m => <tr key={m.id}><td>{m.nome} {m.id}</td><td><SaudeBar v={m.saude} /></td><td><Badge k={m.status} /></td></tr>)}</tbody></table></div></Foco></div>
        <div className="col-xl-5"><Foco f="os" label="ordens de serviço por status" cls="h-100" setFoco={setFoco}><h2>Ordens de serviço por status</h2><OsBars o={os} max={maxOS} /></Foco></div>
      </div>
    </>
  );
}

function Ampliado({ f, d, onClose }) {
  const [t, k] = f.split(':'), kp = t === 'kpi' ? d.kpis.find(x => x.k === k) : null, os = d.osPorStatus;
  const TIT = { vib: 'Vibração em detalhe', alertas: 'Alertas recentes', saude: 'Saúde de todos os ativos', os: 'Ordens de serviço por status' };
  const maxOS = Math.max(os.abertas, os.andamento, os.peca, os.concluidas) * 1.15;
  return (
    <Modal titulo={kp ? kp.rotulo : TIT[t]} size="modal-xl" onClose={onClose}>
      {kp && <div className="row g-4 align-items-center"><div className="col-lg-4"><p className="pm-lbl">{kp.rotulo}</p><p className="pm-kpi pm-kpi-xl">{kpiVal(kp)}</p><p className="mb-3">{kp.sub}</p><p className="text-secondary">{kp.explica}</p></div>
        <div className="col-lg-8"><h3 className="h6">Últimas 8 semanas</h3><LineChart pts={kp.historico} big h={320} limite={kp.meta} limiteLabel="Meta" unit={kp.unidade} dec={kp.casas} min={kp.escalaMin} label={'Histórico de ' + kp.rotulo} /></div></div>}
      {t === 'vib' && <VibFoco d={d} />}
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
