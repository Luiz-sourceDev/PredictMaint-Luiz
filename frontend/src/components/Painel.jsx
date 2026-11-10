'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getUser, saudacao } from '@/lib/util';
import { Modal } from '@/components/ui';
import Sino from '@/components/Sino';

/* Menu por perfil: o técnico opera o dia a dia; custos e cadastros de pessoas são do gestor. */
const NAV = [['/dashboard', 'Dashboard'], ['/planta', 'Planta ao vivo'], ['/maquinas', 'Máquinas'], ['/medicoes', 'Medições'], ['/alertas', 'Alertas'], ['/ordens', 'Ordens de Serviço'], ['/orcamento', 'Orçamento manutenciário', 'gestor'], ['/usuarios', 'Usuários', 'gestor']];
const PERFIL = { gestor: 'Gestor', tecnico: 'Técnico', funcionario: 'Funcionário' };

/* Guarda de rota: sem login volta para "/", e cada perfil só entra na sua área. */
export function useSessao(papel) {
  const r = useRouter(), [u, setU] = useState(null);
  useEffect(() => {
    const x = getUser();
    if (!x) { r.replace('/'); return; }
    const emp = x.perfil === 'funcionario';
    if (papel === 'funcionario' && !emp) { r.replace('/dashboard'); return; }
    if (papel === 'gestor' && emp) { r.replace('/chamado'); return; }
    setU(x);
  }, [papel, r]);
  return u;
}
export const sair = router => { localStorage.removeItem('pm_user'); localStorage.removeItem('pm_token'); router.push('/'); };

function Busca() {
  const [q, setQ] = useState(''), [res, setRes] = useState(null);
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const t = setTimeout(() => api.busca(q.trim()).then(setRes).catch(() => setRes(null)), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="pm-search d-none d-md-block">
      <input className="form-control" type="search" placeholder="Buscar máquina, OS ou alerta" aria-label="Buscar máquina, OS ou alerta" autoComplete="off" value={q} onChange={e => setQ(e.target.value)} onBlur={() => setTimeout(() => setRes(null), 200)} />
      {res && <div className="pm-results">{res.length ? res.map((x, i) => <Link key={i} className="d-block px-3 py-2 text-decoration-none border-bottom" href={x.href}><strong>{x.titulo}</strong><small className="d-block text-secondary">{x.tipo} em {x.sub || '—'}</small></Link>) : <p className="p-3 m-0 text-secondary">Nada com esse nome. Tente o código da máquina, como PH-03.</p>}</div>}
    </div>
  );
}

/* soGestor: a tela inteira é do gestor (o técnico volta para o dashboard).
   acao.soGestor: o botão do topo só aparece para o gestor. */
export default function Painel({ titulo, acao, soGestor = false, children }) {
  const u = useSessao('gestor'), path = usePathname(), router = useRouter();
  const bloqueado = !!u && soGestor && u.perfil !== 'gestor';
  useEffect(() => { if (bloqueado) router.replace('/dashboard'); }, [bloqueado, router]);
  const [aberto, setAberto] = useState(false), [pulso, setPulso] = useState(null);
  useEffect(() => { setAberto(false); }, [path]);
  useEffect(() => { if (u) api.resumoPlanta().then(setPulso).catch(() => setPulso(false)); }, [u]);
  if (!u || bloqueado) return null;
  const botao = acao && (!acao.soGestor || u.perfil === 'gestor') ? acao : null;
  return (
    <div className="pm-shell">
      {aberto && <div className="pm-scrim" onClick={() => setAberto(false)} />}
      <aside className={`pm-side${aberto ? ' aberto' : ''}`} aria-label="Menu principal">
        <Link href="/dashboard"><img className="pm-logo" src="/mantech-logo.png" alt="Mantech" /></Link>
        <nav className="pm-nav" aria-label="Seções">
          {NAV.filter(([, , p]) => !p || p === u.perfil).map(([h, t]) => <Link key={h} href={h} className={path === h ? 'active' : ''} aria-current={path === h ? 'page' : undefined}>{t}</Link>)}
        </nav>
        <div className="pm-pulse">
          <svg viewBox="0 0 200 30" preserveAspectRatio="none" aria-hidden="true"><path d="M0 16H62L70 4L80 27L88 13H118L126 6L134 22L140 16H200" /></svg>
          <strong>{pulso === null ? 'Lendo a planta…' : pulso === false ? 'Planta sem resposta' : pulso.criticos ? `${pulso.criticos} máquina${pulso.criticos > 1 ? 's' : ''} em estado crítico` : 'Planta sem criticidade'}</strong>
          <span>{pulso ? `${pulso.atencao} em atenção · ${pulso.normais} tranquilas` : saudacao() + '.'}</span>
        </div>
        <div className="pm-me"><div><strong>{u.nome}</strong><small>{PERFIL[u.perfil] || u.perfil}</small></div><button className="btn btn-sm btn-outline-light" onClick={() => sair(router)}>Sair</button></div>
      </aside>
      <div className="pm-main">
        <header className="pm-top">
          <button className="btn btn-outline-dark d-lg-none" aria-label="Abrir menu" onClick={() => setAberto(true)}>☰</button>
          <h1>{titulo}</h1>
          <Busca />
          <Sino />
          {botao && (botao.href ? <Link className="btn btn-primary" href={botao.href}>{botao.label}</Link> : <button className="btn btn-primary" onClick={botao.onClick}>{botao.label}</button>)}
        </header>
        <main className="pm-content">{typeof children === 'function' ? children(u) : children}</main>
      </div>
    </div>
  );
}

/* ---------- área do funcionário ---------- */
const FAQ = [
  ['Como abro um chamado?', 'Em “Abrir chamado”, escolha a máquina, marque o que está acontecendo e a urgência, e escreva em poucas palavras o que viu, ouviu ou sentiu. Foto ajuda muito.'],
  ['E se a máquina parou de vez?', 'Marque a urgência “Máquina parada”. O gestor é avisado na hora e a equipe de manutenção é chamada em seguida.'],
  ['Como sei em que pé está meu chamado?', 'Em “Meus chamados” você acompanha cada etapa: registrado, triado, técnico designado, em reparo e concluído. Se algo mudar, deixe um comentário por lá.']
];
export function AreaFuncionario({ children }) {
  const u = useSessao('funcionario'), path = usePathname(), router = useRouter();
  const [menu, setMenu] = useState(false), [drop, setDrop] = useState(false), [ajuda, setAjuda] = useState(false), [faq, setFaq] = useState(0);
  if (!u) return null;
  const L = [['/chamado', 'Abrir chamado'], ['/meus-chamados', 'Meus chamados']];
  return (
    <>
      <nav className="navbar navbar-expand-md pm-topnav" data-bs-theme="dark"><div className="container-xl">
        <Link className="navbar-brand" href="/chamado"><img src="/mantech-logo.png" alt="Mantech" style={{ height: 30 }} /></Link>
        <div className="ms-auto me-2 d-md-none"><Sino claro linkMaquina={false} /></div>
        <button className="navbar-toggler" aria-label="Abrir menu" onClick={() => setMenu(!menu)}><span className="navbar-toggler-icon" /></button>
        <div className={`collapse navbar-collapse${menu ? ' show' : ''}`}>
          <ul className="navbar-nav me-auto gap-1">
            {L.map(([h, t]) => <li key={h} className="nav-item"><Link className={`nav-link${path === h ? ' active' : ''}`} href={h}>{t}</Link></li>)}
            <li className="nav-item"><a className="nav-link" href="#" onClick={e => { e.preventDefault(); setAjuda(true); }}>Ajuda</a></li>
          </ul>
          <div className="d-none d-md-flex align-items-center gap-2"><Sino claro linkMaquina={false} /></div>
          <div className="dropdown ms-md-2">
            <button className="btn btn-outline-light rounded-pill" onClick={() => setDrop(!drop)}>Funcionário · {u.setor}</button>
            <ul className={`dropdown-menu dropdown-menu-end${drop ? ' show' : ''}`}><li><span className="dropdown-item-text">{u.nome}</span></li><li><button className="dropdown-item" onClick={() => sair(router)}>Sair</button></li></ul>
          </div>
        </div>
      </div></nav>
      <main className="pm-wrap">{typeof children === 'function' ? children(u) : children}</main>
      {ajuda && <Modal titulo="Ajuda" onClose={() => setAjuda(false)}>
        <div className="accordion">{FAQ.map(([q, a], i) => <div key={i} className="accordion-item"><h3 className="accordion-header"><button className={`accordion-button${faq === i ? '' : ' collapsed'}`} onClick={() => setFaq(faq === i ? -1 : i)}>{q}</button></h3>{faq === i && <div className="accordion-collapse collapse show"><div className="accordion-body">{a}</div></div>}</div>)}</div>
      </Modal>}
    </>
  );
}
