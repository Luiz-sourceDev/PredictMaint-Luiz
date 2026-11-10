'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { AreaFuncionario } from '@/components/Painel';
import { Badge, Carga, Modal, useLoad, useToast } from '@/components/ui';
import { api } from '@/lib/api';

const Chips = ({ nome, lista, valor, onChange }) => <div className="d-flex flex-wrap gap-2">{lista.map(t => <span key={t} className="d-contents"><input type="radio" className="btn-check" name={nome} id={nome + t} checked={valor === t} onChange={() => onChange(t)} /><label className="btn btn-outline-dark chip" htmlFor={nome + t}>{t}</label></span>)}</div>;

function Form({ u }) {
  const toast = useToast(), maqs = useLoad(() => api.maquinas({ ordem: 'codigo' })), alertas = useLoad(() => api.alertas({ setor: u.setor }), [u.setor]);
  const [maq, setMaq] = useState(''), [prob, setProb] = useState('Ruído anormal'), [urg, setUrg] = useState('Média'), [desc, setDesc] = useState(''), [foto, setFoto] = useState(null), [env, setEnv] = useState(false), [ok, setOk] = useState(null), [qr, setQr] = useState(null);
  const fileRef = useRef(null), M = maqs.data || [], atual = maq || (M[0] || {}).id || '';

  async function enviar(e) {
    e.preventDefault(); setEnv(true);
    try {
      const d = { maquina: atual, problema: prob, urgencia: urg, descricao: desc.trim(), setor: u.setor };
      if (d.descricao.length < 5) throw new Error('Conte em poucas palavras o que você viu, ouviu ou sentiu.');
      let corpo = d; if (foto) { corpo = new FormData(); corpo.append('dados', JSON.stringify(d)); corpo.append('foto', foto); }
      setOk(await api.criarChamado(corpo));
    } catch (er) { toast(er.message, 'danger'); setEnv(false); }
  }
  function usarQr() { const v = qr.trim().toUpperCase(); if (!M.some(x => x.id === v)) return toast(`Não achei a máquina ${v}. Confira a etiqueta.`, 'warning'); setMaq(v); setQr(null); }

  return (
    <>
      <h1 className="h2 mb-1">Abrir chamado de manutenção</h1><p className="text-secondary mb-4">Viu algo errado em uma máquina? Conte para a equipe de manutenção.</p>
      <div className="row g-3">
        <div className="col-lg-8"><section className="pm-card">{ok ? <div className="pm-empty"><strong>Chamado {ok.id} enviado.</strong>O gestor já foi avisado e vai definir prioridade e equipe.<div className="d-flex gap-2 justify-content-center mt-3"><Link className="btn btn-primary" href="/meus-chamados">Acompanhar chamado</Link><button className="btn btn-outline-dark" onClick={() => { setOk(null); setEnv(false); setDesc(''); setFoto(null); }}>Abrir outro</button></div></div> :
          <form onSubmit={enviar} noValidate>
            <div className="row g-2 mb-3 align-items-end"><div className="col-12 col-sm"><label className="form-label" htmlFor="c-m">Máquina</label><select id="c-m" className="form-select" value={atual} onChange={e => setMaq(e.target.value)}>{M.map(m => <option key={m.id} value={m.id}>{m.id} · {m.nome}</option>)}</select></div><div className="col-12 col-sm-auto"><button type="button" className="btn btn-outline-dark w-100" onClick={() => setQr('')}>Escanear QR da máquina</button></div></div>
            <fieldset className="mb-3"><legend className="form-label">O que está acontecendo?</legend><Chips nome="prob" lista={['Ruído anormal', 'Vazamento', 'Superaquecimento', 'Parada', 'Outro']} valor={prob} onChange={setProb} /></fieldset>
            <fieldset className="mb-3"><legend className="form-label">Urgência</legend><Chips nome="urg" lista={['Baixa', 'Média', 'Alta', 'Máquina parada']} valor={urg} onChange={setUrg} /></fieldset>
            <div className="mb-3"><label className="form-label" htmlFor="c-d">Descrição</label><textarea id="c-d" className="form-control" rows={5} placeholder="Descreva o que você viu, ouviu ou sentiu" value={desc} onChange={e => setDesc(e.target.value)} /></div>
            <div className="d-flex flex-wrap gap-2 justify-content-between"><div><input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={e => setFoto(e.target.files[0] || null)} /><button type="button" className="btn btn-outline-dark" onClick={() => fileRef.current.click()}>Anexar foto</button> <span className="text-secondary small">{foto?.name}</span></div>
              <div className="d-flex gap-2"><Link className="btn btn-outline-dark" href="/meus-chamados">Cancelar</Link><button className="btn btn-primary px-4" disabled={env}>Enviar chamado</button></div></div>
          </form>}</section></div>
        <div className="col-lg-4">
          <section className="pm-card mb-3"><h2>Como funciona</h2><ol className="pm-tl"><li><b>1. Você registra</b><small>Leva menos de 1 minuto</small></li><li className="atual"><b>2. O gestor analisa</b><small>Prioridade e equipe são definidas</small></li><li className="pendente"><b>3. O técnico atende</b><small>Você acompanha cada etapa</small></li></ol></section>
          <section className="pm-card"><h2>Alertas no seu setor</h2><Carga l={alertas}>{a => a.length ? a.map(x => <div className="pm-alert-i" key={x.id}><Badge k={x.nivel} /><div><strong>{x.ativo}</strong><small>{x.titulo}</small></div></div>) : <p className="text-secondary mb-0">Nada fora do normal no seu setor agora.</p>}</Carga></section>
        </div>
      </div>
      {qr !== null && <Modal titulo="Código da máquina" onClose={() => setQr(null)} footer={<button className="btn btn-primary" onClick={usarQr}>Usar este código</button>}><p>A leitura pela câmera entra numa próxima versão. Por enquanto, digite o código que está na etiqueta da máquina.</p><input className="form-control" placeholder="Ex.: PH-03" value={qr} onChange={e => setQr(e.target.value)} /></Modal>}
    </>
  );
}
export default function Chamado() { return <AreaFuncionario>{u => <Form u={u} />}</AreaFuncionario>; }
