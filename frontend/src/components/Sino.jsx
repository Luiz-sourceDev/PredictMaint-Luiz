'use client';
/* Sininho de avisos: mostra quantos alertas do gestor ainda não foram lidos.
   Atualiza sozinho a cada 30 s. Usado na área do gestor/técnico e na do funcionário. */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Badge, Modal, Vazio, useToast } from '@/components/ui';

export default function Sino({ claro = false, linkMaquina = true }) {
  const toast = useToast(), [d, setD] = useState({ naoLidas: 0, itens: [] }), [aberto, setAberto] = useState(false);
  const ultimo = useRef(null);
  async function carregar(avisar) {
    try {
      const r = await api.notificacoes();
      const novo = r.itens.find(i => !i.lida);
      if (avisar && novo && ultimo.current !== null && novo.id !== ultimo.current) toast(`Novo aviso: ${novo.titulo}`, novo.prioridade === 'urgente' ? 'danger' : undefined);
      ultimo.current = novo ? novo.id : 0;
      setD(r);
    } catch { /* sem aviso quando a API está fora */ }
  }
  useEffect(() => {
    const t0 = setTimeout(() => carregar(false), 0);
    const t = setInterval(() => { if (document.visibilityState === 'visible') carregar(true); }, 30000);
    return () => { clearTimeout(t0); clearInterval(t); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function ler(n) {
    if (n.lida) return;
    try { await api.marcarLida(n.id); setD(x => ({ naoLidas: Math.max(0, x.naoLidas - 1), itens: x.itens.map(i => i.id === n.id ? { ...i, lida: true } : i) })); } catch (e) { toast(e.message, 'danger'); }
  }
  async function lerTodas() {
    try { await api.marcarTodasLidas(); setD(x => ({ naoLidas: 0, itens: x.itens.map(i => ({ ...i, lida: true })) })); } catch (e) { toast(e.message, 'danger'); }
  }
  return (
    <>
      <button type="button" className={`pm-sino${claro ? ' claro' : ''}${d.naoLidas ? ' tem' : ''}`} aria-label={d.naoLidas ? `${d.naoLidas} aviso(s) não lido(s)` : 'Avisos'} onClick={() => setAberto(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1Z" /></svg>
        {d.naoLidas > 0 && <span className="pm-sino-n">{d.naoLidas > 9 ? '9+' : d.naoLidas}</span>}
      </button>
      {aberto && <div data-bs-theme="light" className="text-body"><Modal titulo="Avisos do gestor" onClose={() => setAberto(false)} footer={d.naoLidas > 0 && <button className="btn btn-outline-dark" onClick={lerTodas}>Marcar todos como lidos</button>}>
        {d.itens.length ? <div className="d-flex flex-column gap-2">{d.itens.map(n => (
          <article key={n.id} className={`pm-aviso${n.lida ? ' lida' : ''}${n.prioridade === 'urgente' ? ' urgente' : ''}`} onClick={() => ler(n)}>
            <div className="d-flex justify-content-between gap-2 align-items-start">
              <strong>{n.titulo}</strong>
              {n.prioridade === 'urgente' ? <Badge k="critico">Urgente</Badge> : !n.lida && <Badge k="info">Novo</Badge>}
            </div>
            {n.mensagem && <p className="mb-1">{n.mensagem}</p>}
            <small className="text-secondary">{n.de} · {n.quando}{n.maquina && <> · Máquina {linkMaquina ? <Link href={`/maquinas?id=${n.maquina}`} onClick={() => ler(n)}>{n.maquina}</Link> : n.maquina}</>}</small>
          </article>))}</div>
          : <Vazio titulo="Nenhum aviso por enquanto" sub="Quando o gestor mandar um alerta para você, ele aparece aqui." />}
      </Modal></div>}
    </>
  );
}
