'use client';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Badge, Carga, Mini, Modal, useLoad } from '@/components/ui';
import { num } from '@/lib/util';
import { usePerfil } from '@/lib/perfil';

/* Detalhe de uma máquina: usado em Máquinas, Planta e na busca. */
export default function AtivoModal({ id, onClose }) {
  const gestor = usePerfil() === 'gestor';
  const l = useLoad(() => api.maquina(id), [id]);
  const m = l.data;
  return (
    <Modal titulo={m ? <>{m.id} · {m.nome} <Badge k={m.status} /></> : id} size="modal-lg" onClose={onClose}
      footer={m && <>{gestor && <Link className="btn btn-outline-dark" href={`/orcamento?maquina=${m.id}`}>Orçar manutenção</Link>}<Link className="btn btn-primary" href={`/medicoes?maquina=${m.id}`}>Registrar medição</Link></>}>
      <Carga l={l}>{m => <>
        <div className="row g-3 mb-3"><div className="col-sm-4"><Mini rotulo="Saúde" valor={m.saude + '%'} /></div><div className="col-sm-4"><Mini rotulo="Última medição" valor={m.ultima} /></div><div className="col-sm-4"><Mini rotulo="Próx. manutenção" valor={m.prox} /></div></div>
        <p className="text-secondary mb-3">Setor {m.setor}.</p>
        <h3 className="h6">Últimas medições</h3>
        {m.medicoes.length ? <table className="table table-sm mb-4"><tbody>{m.medicoes.map(x => <tr key={x.id}><td>{x.data}</td><td>{x.nome}</td><td><b>{num(x.valor, 1)} {x.unidade}</b></td><td><Badge k={x.situacao}>{x.situacao === 'critico' ? 'Acima do limite' : undefined}</Badge></td></tr>)}</tbody></table> : <p className="text-secondary">Ainda sem medições registradas.</p>}
        <h3 className="h6">Ordens de serviço em aberto</h3>
        {m.ordens.length ? m.ordens.map(o => <Link key={o.id} className="d-flex justify-content-between text-decoration-none py-1" href={`/ordens?os=${o.id}`}><span><b>{o.id}</b> {o.titulo}</span><Badge k={o.prioridade} /></Link>) : <p className="text-secondary mb-0">Nenhuma OS aberta para esta máquina.</p>}
      </>}</Carga>
    </Modal>
  );
}
