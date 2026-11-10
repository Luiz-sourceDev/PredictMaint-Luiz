// import styles from "./page.module.css";
// import Link from "next/link";
// export default function Home() {
//   const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

//   return (
//     <div className={styles.page}>
//       <main className={styles.main}>
//         <section className={styles.hero}>
//           <p className={styles.kicker}>EXEMPLO ALTERAÇÂO</p>
//           <h1>PredictMaint - Projeto Integrador</h1>
//           <p>
//             Base limpa para fork dos alunos, preparada para desenvolvimento
//             local e deploy com Docker no Coolify.
//           </p>
//         </section>

//         <section className={styles.grid} aria-label="Stack do projeto">
//           <article>
//             <span>Frontend</span>
//             <strong>Next.js</strong>
//             <p>Sem Tailwind ou Bootstrap por padrao.</p>
//           </article>
//           <article>
//             <span>Backend</span>
//             <strong>Express</strong>
//             <p>API em JavaScript com dotenv, cors, helmet e mysql2.</p>
//           </article>
//           <article>
//             <span>Banco</span>
//             <strong>MySQL</strong>
//             <p>Container com script inicial em SQL.</p>
//           </article>
//         </section>

//         <p className={styles.api}>API configurada: {apiUrl}</p>
//       </main>
//       <Link href="/dashboard" className={styles.dashboardLink}>
//         Ir para o Dashboard
//       </Link>
//     </div>
//   );
// }
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, modoDemo } from '@/lib/api';
import { getUser } from '@/lib/util';
import { Modal, useToast } from '@/components/ui';

const DEMO = [
  { rotulo: 'Acesso máximo (admin)', email: 'admin@mantech.com.br', senha: 'senai@123', perfil: 'gestor' },
  { rotulo: 'Acesso normal (funcionário)', email: 'funcionario@mantech.com.br', senha: 'senai@123', perfil: 'funcionario' }
];

export default function Login() {
  const router = useRouter(), toast = useToast();
  const [perfil, setPerfil] = useState('gestor'), [usuario, setUsuario] = useState(''), [senha, setSenha] = useState(''), [manter, setManter] = useState(false);
  const [erro, setErro] = useState(''), [env, setEnv] = useState(false), [esq, setEsq] = useState(false), [rec, setRec] = useState('');

  useEffect(() => { const u = getUser(); if (u) router.replace(u.perfil === 'funcionario' ? '/chamado' : '/dashboard'); }, [router]);

  async function entrar(e) {
    e.preventDefault(); setErro(''); setEnv(true);
    try {
      const r = await api.login({ perfil, usuario: usuario.trim(), senha, manter });
      localStorage.setItem('pm_user', JSON.stringify({ ...r.usuario, perfil }));
      if (r.token) localStorage.setItem('pm_token', r.token);
      router.push(perfil === 'funcionario' ? '/chamado' : '/dashboard');
    } catch (err) { setErro(err.message); setEnv(false); }
  }
  async function recuperar() { try { await api.recuperarSenha({ usuario: rec }); setEsq(false); toast('Pedido enviado ao administrador.'); } catch (e) { toast(e.message, 'danger'); } }

  return (
    <div className="pm-login">
      <section className="pm-login-l">
        <img src="/mantech-logo.png" alt="Mantech" />
        <h1>Antecipe a falha.<br />Proteja a produção.</h1>
        <p className="lead">Monitoramento preditivo de máquinas, alertas e ordens de serviço em um só lugar.</p>
        <svg className="pm-beat" viewBox="0 0 420 60" aria-hidden="true"><path d="M0 34H150L166 6L186 54L200 34H290L304 12L320 48L332 34H420" /></svg>
        <ul><li>Alertas por tendência, antes da parada</li><li>Ordens de serviço integradas aos alertas</li><li>Chamados abertos direto do chão de fábrica</li></ul>
      </section>
      <section className="pm-login-r">
        <div className="pm-card pm-login-card p-4">
          <h2 className="h3 mb-1">Entrar no PredictMaint</h2>
          <p className="text-secondary">Use seu e-mail corporativo ou matrícula.</p>
          <form onSubmit={entrar} noValidate>
            <fieldset className="mb-3"><legend className="form-label">Perfil de acesso</legend>
              <div className="d-flex flex-wrap gap-2">{[['gestor', 'Gestor'], ['tecnico', 'Técnico'], ['funcionario', 'Funcionário']].map(([v, t]) => <span key={v}><input type="radio" className="btn-check" name="perfil" id={'p-' + v} checked={perfil === v} onChange={() => setPerfil(v)} /><label className="btn btn-outline-dark chip" htmlFor={'p-' + v}>{t}</label></span>)}</div></fieldset>
            <div className="mb-3"><label className="form-label" htmlFor="usuario">E-mail ou matrícula</label><input className="form-control" id="usuario" placeholder="nome@empresa.com.br" autoComplete="username" value={usuario} onChange={e => setUsuario(e.target.value)} /></div>
            <div className="mb-3"><label className="form-label" htmlFor="senha">Senha</label><input className="form-control" id="senha" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} /></div>
            <div className="d-flex justify-content-between mb-3"><div className="form-check"><input className="form-check-input" type="checkbox" id="manter" checked={manter} onChange={e => setManter(e.target.checked)} /><label className="form-check-label" htmlFor="manter">Manter conectado</label></div><a href="#" className="fw-semibold" onClick={e => { e.preventDefault(); setEsq(true); }}>Esqueci a senha</a></div>
            {erro && <div className="alert alert-danger py-2" role="alert">{erro}</div>}
            <button className="btn btn-primary w-100 py-2" disabled={env}>{env ? 'Entrando…' : 'Entrar'}</button>
          </form>
          <p className="text-secondary text-center small mt-3 mb-0">Problemas de acesso? Fale com o administrador do sistema.</p>
          {modoDemo && <div className="pm-mini mt-3"><p className="pm-lbl mb-2">Acessos de demonstração</p>
            {DEMO.map(d => <div key={d.email} className="d-flex justify-content-between align-items-center gap-2 mb-2"><span className="small"><b>{d.rotulo}</b><br />{d.email} · {d.senha}</span><button type="button" className="btn btn-outline-dark btn-sm" onClick={() => { setPerfil(d.perfil); setUsuario(d.email); setSenha(d.senha); setErro(''); }}>Usar</button></div>)}</div>}
        </div>
      </section>
      {esq && <Modal titulo="Recuperar acesso" onClose={() => setEsq(false)} footer={<button className="btn btn-primary" onClick={recuperar}>Pedir nova senha</button>}>
        <p>Informe seu e-mail ou matrícula. Se ele existir, o administrador recebe o pedido de nova senha.</p><input className="form-control" placeholder="nome@empresa.com.br" value={rec} onChange={e => setRec(e.target.value)} /></Modal>}
    </div>
  );
}

