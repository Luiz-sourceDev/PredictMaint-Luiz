'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Painel from '@/components/Painel';
import { Badge, Carga, LineChart, Vazio, useLoad, useToast } from '@/components/ui';
import { api, num, param } from '@/lib/util';

const UN = { vibracao: 'mm/s', temperatura: '°C', corrente: 'A' };
const agora = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export default function Medicoes() {
  const toast = useToast();
  const [maq, setMaq] = useState(''), [g, setG] = useState('vibracao'), [valor, setValor] = useState(''), [data, setData] = useState(''), [obs, setObs] = useState(''), [env, setEnv] = useState(false);
  const maqs = useLoad(() => api.maquinas({ ordem: 'codigo' }));
  useEffect(() => { setData(agora()); }, []);
  useEffect(() => { if (maqs.data?.length && !maq) setMaq(param('maquina') || maqs.data[0].id); }, [maqs.data, maq]);
  const serie = useLoad(() => maq ? api.serie(maq, g) : Promise.resolve(null), [maq, g]);
  const tab = useLoad(() => api.medicoes({ limite: 8 }));

  async function salvar(e) {
    e.preventDefault(); setEnv(true);
    try {
      if (valor === '') throw new Error('Digite o valor lido no equipamento.');
      const r = await api.criarMedicao({ maquina: maq, grandeza: g, valor: +valor, unidade: UN[g], data, obs }), m = r.medicao;
      if (r.situacao === 'critico') toast(<>{num(m.valor)} {m.unidade} passou do limite da {m.maquina}.{r.alertaCriado ? ' Abri um alerta crítico.' : ''} <Link className="text-warning fw-bold" href="/alertas">Ver alertas</Link></>, 'danger');
      else if (r.situacao === 'atencao') toast(`Medição salva. ${m.maquina} está chegando perto do limite, vale acompanhar.`, 'warning');
      else toast(`Medição salva. ${m.maquina} dentro do esperado.`);
      setValor(''); setObs(''); setData(agora()); serie.recarregar(); tab.recarregar();
    } catch (err) { toast(err.message, 'danger'); } finally { setEnv(false); }
  }
  return (
    <Painel titulo="Registro de medições" acao={{ label: 'Registrar medição', onClick: () => document.getElementById('m-v')?.focus() }}>
      <div className="row g-3">
        <div className="col-lg-4"><section className="pm-card h-100"><h2>Nova medição</h2>
          <form onSubmit={salvar} noValidate>
            <div className="mb-3"><label className="form-label" htmlFor="m-m">Máquina</label><select id="m-m" className="form-select" value={maq} onChange={e => setMaq(e.target.value)}>{(maqs.data || []).map(m => <option key={m.id} value={m.id}>{m.id} · {m.nome}</option>)}</select></div>
            <div className="mb-3"><label className="form-label" htmlFor="m-g">Grandeza</label><select id="m-g" className="form-select" value={g} onChange={e => setG(e.target.value)}><option value="vibracao">Vibração</option><option value="temperatura">Temperatura</option><option value="corrente">Corrente</option></select></div>
            <div className="row g-2 mb-3"><div className="col-7"><label className="form-label" htmlFor="m-v">Valor</label><input id="m-v" className="form-control" type="number" step="0.1" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} /></div><div className="col-5"><label className="form-label" htmlFor="m-u">Unidade</label><select id="m-u" className="form-select" value={UN[g]} onChange={() => { }}><option>{UN[g]}</option></select></div></div>
            <div className="mb-3"><label className="form-label" htmlFor="m-d">Data e hora</label><input id="m-d" className="form-control" type="datetime-local" value={data} onChange={e => setData(e.target.value)} /></div>
            <div className="mb-3"><label className="form-label" htmlFor="m-o">Observações</label><textarea id="m-o" className="form-control" rows={3} placeholder="Ex.: ruído anormal no mancal" value={obs} onChange={e => setObs(e.target.value)} /></div>
            <button className="btn btn-primary w-100 py-2" disabled={env}>Salvar medição</button>
          </form></section></div>
        <div className="col-lg-8">
          <section className="pm-card mb-3"><h2>{serie.data ? `Tendência · ${serie.data.maquina} · ${serie.data.nome}` : 'Tendência'}</h2>{serie.data && <LineChart pts={serie.data.pontos} limite={serie.data.limite} unit={serie.data.unidade} h={240} label={`Tendência de ${serie.data.nome} da ${serie.data.maquina}`} />}</section>
          <section className="pm-card"><h2>Últimas medições</h2><Carga l={tab}>{l => <div className="table-responsive"><table className="table"><thead><tr><th>DATA</th><th>MÁQUINA</th><th>GRANDEZA</th><th>VALOR</th><th>SITUAÇÃO</th></tr></thead>
            <tbody>{l.length ? l.map(x => <tr key={x.id}><td>{x.data}</td><td>{x.maquina}</td><td>{x.nome}</td><td><b>{num(x.valor, 1)} {x.unidade}</b></td><td><Badge k={x.situacao}>{x.situacao === 'critico' ? 'Acima do limite' : undefined}</Badge></td></tr>) : <tr><td colSpan={5}><Vazio titulo="Nenhuma medição ainda" sub="Registre a primeira ao lado." /></td></tr>}</tbody></table></div>}</Carga></section>
        </div>
      </div>
    </Painel>
  );
}
