/* ============================================================
   CAMADA DE API — as "portas do fetch".
   Nenhuma tela chama fetch() direto: todas passam por api.*
   NEXT_PUBLIC_API_URL vazio  -> dados de demonstração (lib/mock.jsx)
   NEXT_PUBLIC_API_URL=http://localhost:8080/api -> API e banco de verdade
   (o nome antigo NEXT_PUBLIC_API_BASE continua funcionando)
   ============================================================ */
import { mock } from './mock';

const BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
export const modoDemo = !BASE;

async function req(method, path, body) {
  if (!BASE) return mock(method, path, body);
  const headers = {};
  const token = typeof window !== 'undefined' ? localStorage.getItem('pm_token') : null;
  if (token) headers.Authorization = 'Bearer ' + token;
  let payload;
  if (typeof FormData !== 'undefined' && body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let r;
  try { r = await fetch(BASE + path, { method, headers, body: payload }); }
  catch { throw new Error('Não consegui falar com a API em ' + BASE + '. Ela está no ar?'); }
  if (r.status === 401 && !path.startsWith('/auth')) { localStorage.removeItem('pm_user'); localStorage.removeItem('pm_token'); location.href = '/'; return new Promise(() => { }); }
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error((data && data.mensagem) || 'A API respondeu ' + r.status);
  return data;
}
const q = o => { const s = new URLSearchParams(Object.entries(o || {}).filter(([, v]) => v !== '' && v != null)).toString(); return s ? '?' + s : ''; };

export const api = {
  login: d => req('POST', '/auth/login', d),
  recuperarSenha: d => req('POST', '/auth/recuperar', d),
  busca: t => req('GET', '/busca' + q({ q: t })),
  dashboard: () => req('GET', '/dashboard'),
  resumoPlanta: () => req('GET', '/planta/resumo'),
  planta: p => req('GET', '/planta' + q(p)),
  ativoPreditivo: id => req('GET', `/planta/${id}/preditivo`),
  maquinas: p => req('GET', '/maquinas' + q(p)),
  maquina: id => req('GET', '/maquinas/' + id),
  criarMaquina: d => req('POST', '/maquinas', d),
  medicoes: p => req('GET', '/medicoes' + q(p)),
  serie: (maquina, grandeza) => req('GET', '/medicoes/serie' + q({ maquina, grandeza })),
  criarMedicao: d => req('POST', '/medicoes', d),
  alertas: p => req('GET', '/alertas' + q(p)),
  reconhecerAlerta: id => req('PATCH', `/alertas/${id}/reconhecer`),
  limites: () => req('GET', '/limites'),
  salvarLimites: d => req('PUT', '/limites', d),
  ordens: p => req('GET', '/ordens' + q(p)),
  criarOS: d => req('POST', '/ordens', d),
  atualizarOS: (id, d) => req('PATCH', '/ordens/' + id, d),
  orcamentoBase: id => req('GET', '/orcamento/base/' + id),
  orcamentoResumo: () => req('GET', '/orcamento/resumo'),
  orcamentos: () => req('GET', '/orcamento'),
  salvarOrcamento: d => req('POST', '/orcamento', d),
  chamados: () => req('GET', '/chamados'),
  criarChamado: d => req('POST', '/chamados', d),
  comentarChamado: (id, texto) => req('POST', `/chamados/${id}/comentarios`, { texto }),
  setores: () => req('GET', '/setores'),
  usuarios: p => req('GET', '/users' + q(p)),
  criarUsuario: d => req('POST', '/users', d),
  editarUsuario: (id, d) => req('PUT', '/users/' + id, d),
  desativarUsuario: id => req('DELETE', '/users/' + id),
  notificacoes: () => req('GET', '/notificacoes'),
  marcarLida: id => req('PATCH', `/notificacoes/${id}/lida`),
  marcarTodasLidas: () => req('PATCH', '/notificacoes/lidas'),
  enviarNotificacao: d => req('POST', '/notificacoes', d),
  notificacoesEnviadas: usuario => req('GET', '/notificacoes/enviadas' + q({ usuario }))
};
