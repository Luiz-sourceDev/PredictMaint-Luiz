/* ============================================================
   DADOS DE DEMONSTRAÇÃO — usados só quando NEXT_PUBLIC_API_BASE está vazio.
   Simula a API (mesmas rotas do README) e guarda o que você cadastra no localStorage.
   Quando o banco estiver pronto, este arquivo pode ser apagado.
   ============================================================ */
import { calcOrcamento } from './calc';

  const KEY = 'pm_mock_v3';
  const LIM = {
    vibracao:    { nome: 'Vibração',    limite: 4.5, atencao: 3.8, un: 'mm/s' },
    temperatura: { nome: 'Temperatura', limite: 95,  atencao: 85,  un: '°C' },
    corrente:    { nome: 'Corrente',    limite: 22,  atencao: 17,  un: 'A' }
  };
  const EQUIPE_SETOR = { Estamparia: 'Mecânica', Usinagem: 'Usinagem', Utilidades: 'Utilidades', Logística: 'Mecânica' };
  const pad = n => String(n).padStart(2, '0');
  const dm = d => pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
  const hm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
  const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const stS = s => s < 50 ? 'critico' : s < 75 ? 'atencao' : 'normal';
  const venc = p => { const [d, m] = p.split('/').map(Number); return m < 10 || (m === 10 && d < 22); };   // "hoje" da demo = 22/10
  const toDM = v => /^\d{4}-/.test(v || '') ? v.slice(8, 10) + '/' + v.slice(5, 7) : v;
  const sit = (g, v) => { const L = LIM[g]; return v > L.limite ? 'critico' : v >= L.atencao ? 'atencao' : 'normal'; };

  /* Logins de DEMONSTRAÇÃO (somente no mock). Com a API real, a senha é validada no backend. */
  const USUARIOS = [
    { nome: 'Administrador Mantech', email: 'admin@mantech.com.br', matricula: 'adm001', senha: 'senai@123', perfis: ['gestor', 'tecnico', 'funcionario'] },
    { nome: 'Ana Souza', email: 'funcionario@mantech.com.br', matricula: 'fun001', senha: 'senai@123', perfis: ['funcionario'], setor: 'Estamparia' },
    { nome: 'Carlos Lima', email: 'tecnico@mantech.com.br', matricula: 'tec001', senha: 'senai@123', perfis: ['tecnico'] }
  ];

  function seed() {
    const M = [
      ['PH-03', 'Prensa Hidráulica', 'Estamparia', 38, 'Hoje 08:40', '25/10', 4200, .6],
      ['PH-05', 'Prensa Hidráulica', 'Estamparia', 90, 'Hoje 07:50', '12/11', 3900, 0],
      ['SD-01', 'Serra de Fita', 'Estamparia', 58, '20/10 14:00', '28/10', 900, .15],
      ['CNC-02', 'Torno CNC', 'Usinagem', 92, 'Hoje 08:05', '27/10', 3100, 0],
      ['CNC-03', 'Torno CNC', 'Usinagem', 89, 'Hoje 07:30', '15/11', 3100, 0],
      ['FR-04', 'Fresadora', 'Usinagem', 88, 'Hoje 06:30', '09/11', 2400, 0],
      ['CP-01', 'Compressor de Parafuso', 'Utilidades', 64, 'Hoje 07:15', '30/10', 2600, .2],
      ['CP-02', 'Compressor de Parafuso', 'Utilidades', 86, 'Ontem 19:40', '18/11', 2600, 0],
      ['BM-02', 'Bomba Centrífuga', 'Utilidades', 81, 'Ontem 22:10', '14/11', 1500, 0],
      ['ET-07', 'Esteira Transportadora', 'Logística', 71, 'Ontem 17:50', '02/11', 1800, .1],
      ['ET-08', 'Esteira Transportadora', 'Logística', 84, 'Hoje 05:55', '20/11', 1800, 0]
    ].map(([id, nome, setor, saude, ultima, prox, custoParada, tend]) => ({ id, nome, setor, saude, ultima, prox, custoParada, tend }));

    const medicoes = [
      [1, '22/10 08:40', 'PH-03', 'vibracao', 6.4], [2, '22/10 07:15', 'CP-01', 'temperatura', 88],
      [3, '22/10 06:30', 'FR-04', 'corrente', 12.1], [4, '21/10 17:50', 'ET-07', 'corrente', 18.7],
      [5, '21/10 14:20', 'CNC-02', 'vibracao', 1.9]
    ].map(([id, data, maquina, grandeza, valor]) => ({ id, data, maquina, grandeza, valor, obs: '' }));

    const A = (id, nivel, titulo, ativo, ha, min, estado, medido, limite, previsao, acao) => ({ id, nivel, titulo, ativo, ha, min, estado, medido, limite, previsao, acao });
    const alertas = [
      A(1, 'critico', 'Vibração acima do limite', 'PH-03', '12 min', 12, 'novo', '6,4 mm/s', '4,5 mm/s', 'Até 6 dias', 'Inspecionar mancais e alinhamento do motor.'),
      A(2, 'critico', 'Pressão de óleo baixa', 'BM-02', '2 h', 120, 'reconhecido', '1,8 bar', '2,5 bar', 'Até 9 dias', 'Conferir nível e filtro de óleo; procurar vazamento na selagem.'),
      A(3, 'atencao', 'Temperatura em alta', 'CP-01', '1 h', 60, 'novo', '88 °C', '95 °C', 'Até 18 dias', 'Limpar o trocador de calor e checar ventilação do compressor.'),
      A(4, 'atencao', 'Corrente fora do padrão', 'ET-07', '3 h', 180, 'novo', '18,7 A', '22 A', 'Até 25 dias', 'Verificar tensão da correia e carga do motorredutor.'),
      A(5, 'atencao', 'Desgaste de lâmina previsto', 'SD-01', '1 d', 1440, 'reconhecido', '58% de saúde', '50% de saúde', 'Até 12 dias', 'Programar troca da lâmina na próxima janela de parada.'),
      A(6, 'info', 'Manutenção em 5 dias', 'CNC-02', '1 d', 1441, 'novo', '—', '—', 'Sem risco imediato', 'Manutenção preventiva programada, nada fora do normal.')
    ];

    const O = (id, titulo, ativo, equipe, prazo, prioridade, status) => ({ id, titulo, ativo, equipe, prazo, prioridade, status });
    const ordens = [
      O('OS-0241', 'Inspeção de mancais', 'PH-03', 'Mecânica', '23/10', 'alta', 'aberta'),
      O('OS-0238', 'Troca de filtro', 'CP-01', 'Utilidades', '26/10', 'media', 'aberta'),
      O('OS-0236', 'Verificar acoplamento', 'ET-07', 'Mecânica', '28/10', 'media', 'aberta'),
      O('OS-0235', 'Revisão do sistema hidráulico', 'PH-05', 'Mecânica', '20/10', 'media', 'aberta'),
      O('OS-0233', 'Troca de óleo', 'CP-02', 'Utilidades', '19/10', 'baixa', 'aberta'),
      O('OS-0232', 'Inspeção elétrica do painel', 'CNC-03', 'Elétrica', '18/10', 'media', 'aberta'),
      O('OS-0231', 'Limpeza de sensores', 'FR-04', 'Lubrificação', '30/10', 'baixa', 'aberta'),
      O('OS-0230', 'Revisar guias da serra', 'SD-01', 'Corte', '01/11', 'baixa', 'aberta'),
      O('OS-0229', 'Alinhamento a laser', 'BM-02', 'Mecânica', '22/10', 'alta', 'andamento'),
      O('OS-0226', 'Lubrificação preventiva', 'FR-04', 'Lubrificação', '25/10', 'baixa', 'andamento'),
      O('OS-0224', 'Reapertar fixação do motor', 'ET-08', 'Mecânica', '21/10', 'media', 'andamento'),
      O('OS-0222', 'Ajustar pressão do sistema', 'CP-02', 'Utilidades', '20/10', 'media', 'andamento'),
      O('OS-0220', 'Inspeção térmica', 'PH-05', 'Elétrica', '27/10', 'baixa', 'andamento'),
      O('OS-0219', 'Calibrar ponto zero', 'CNC-03', 'Usinagem', '29/10', 'baixa', 'andamento'),
      O('OS-0218', 'Substituir lâmina', 'SD-01', 'Corte', '30/10', 'media', 'peca'),
      O('OS-0214', 'Trocar rolamento', 'CNC-02', 'Usinagem', '03/11', 'baixa', 'peca'),
      O('OS-0212', 'Substituir válvula', 'CP-01', 'Utilidades', '05/11', 'media', 'peca'),
      O('OS-0211', 'Trocar correia dentada', 'ET-08', 'Mecânica', '07/11', 'baixa', 'peca'),
      O('OS-0209', 'Calibração de sensor', 'CP-01', 'Elétrica', '20/10', 'baixa', 'concluida'),
      O('OS-0205', 'Troca de correia', 'ET-07', 'Mecânica', '18/10', 'media', 'concluida')
    ];
    const tit = ['Lubrificação preventiva', 'Troca de filtro', 'Inspeção visual', 'Calibração de sensor', 'Troca de rolamento', 'Limpeza geral', 'Reaperto de conexões'];
    const eq = ['Mecânica', 'Elétrica', 'Utilidades', 'Lubrificação', 'Usinagem', 'Corte'];
    for (let i = 0; i < 19; i++) ordens.push(O('OS-0' + String(204 - i).padStart(3, '0'), tit[i % 7], M[(i * 3) % M.length].id, eq[i % 6], pad(17 - (i % 14)) + '/10', ['baixa', 'media', 'alta'][i % 3], 'concluida'));

    const C = (id, maquina, problema, situacao, aberto, setor = 'Estamparia') => ({ id, maquina, problema, situacao, aberto, setor, descricao: '', comentarios: [], eventos: {} });
    const chamados = [
      C('CH-1042', 'PH-03', 'Ruído anormal', 'Em reparo', '22/10 08:42'),
      C('CH-1040', 'PH-05', 'Superaquecimento', 'Registrado', '21/10 16:20'),
      C('CH-1037', 'SD-01', 'Vazamento', 'Triado', '21/10 15:10'),
      C('CH-1029', 'ET-07', 'Parada', 'Concluído', '19/10 09:30'),
      C('CH-1018', 'CP-01', 'Superaquecimento', 'Concluído', '15/10 11:05')
    ];
    chamados[0].eventos = { 1: ['22/10 08:55', 'prioridade alta'], 2: ['22/10 09:10', 'Equipe Mecânica'], 3: ['Iniciado às 09:40', ''], 4: ['Previsão: hoje, 14:00', ''] };
    const pr = ['Ruído anormal', 'Vazamento', 'Parada', 'Superaquecimento', 'Outro'];
    for (let i = 0; i < 10; i++) chamados.push(C('CH-' + (1017 - i), M[(i * 2) % M.length].id, pr[i % 5], 'Concluído', pad(14 - i) + '/10 ' + pad(8 + i) + ':15'));

    return { maquinas: M, medicoes, alertas, ordens, chamados, limites: LIM, orcamentos: [], seqOS: 241, seqCH: 1042, seqMed: 5, seqAl: 6, seqOrc: 0 };
  }

  let db = null;
  const load = () => {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch { }
    if (!db) db = seed();
    Object.keys(LIM).forEach(k => db.limites && db.limites[k] && Object.assign(LIM[k], db.limites[k]));
  };
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const maq = id => db.maquinas.find(m => m.id === id);
  const osOut = o => ({ ...o, vencida: o.status !== 'concluida' && venc(o.prazo) });
  const wk = a => a.map((y, i) => ({ x: 'Sem ' + (i + 1), y }));

  function baseSerie(m, g) {
    const L = LIM[g]; let v;
    if (m.id === 'PH-03' && g === 'vibracao') v = [1.8, 2.1, 2.0, 2.8, 2.9, 3.2, 3.8, 4.1, 4.8, 5.5, 6.4];
    else {
      const h = hash(m.id + g), risk = 1 - m.saude / 100, ref = db.medicoes.find(x => !x.novo && x.maquina === m.id && x.grandeza === g), end = ref ? ref.valor : L.limite * (.3 + .6 * risk) * (.95 + (h % 10) / 100), start = end * (.6 + (h % 20) / 100);
      v = Array.from({ length: 11 }, (_, i) => +(start + (end - start) * i / 10 + (((h >> i) % 5) - 2) * .015 * end).toFixed(1));
      v[10] = +end.toFixed(1);
    }
    return v.map((y, i) => ({ x: pad(1 + i * 2) + '/10', y }));
  }
  function serie(id, g) {
    const m = maq(id), L = LIM[g]; if (!m || !L) throw new Error('Máquina ou grandeza desconhecida.');
    const pts = baseSerie(m, g);
    db.medicoes.filter(x => x.novo && x.maquina === id && x.grandeza === g).reverse().forEach(x => pts.push({ x: x.data.slice(0, 5), y: x.valor }));
    return { maquina: id, grandeza: g, nome: L.nome, unidade: L.un, limite: L.limite, atencao: L.atencao, pontos: pts };
  }

  function orcBase(id) {
    const m = maq(id); if (!m) throw new Error('Máquina não encontrada.');
    const P = {
      Estamparia: { tec: 2, h: 8, hp: 6, p: [['Rolamento do mancal', 2, 1480], ['Kit de vedação', 1, 620], ['Óleo hidráulico ISO 68 (litro)', 40, 18]] },
      Usinagem: { tec: 2, h: 5, hp: 4, p: [['Rolamento de precisão', 2, 960], ['Fluido refrigerante (litro)', 20, 22], ['Correia do fuso', 1, 340]] },
      Utilidades: { tec: 1, h: 4, hp: 2, p: [['Filtro de óleo', 1, 280], ['Elemento separador', 1, 1150], ['Óleo de compressor (litro)', 20, 46]] },
      Logística: { tec: 2, h: 4, hp: 3, p: [['Correia da esteira', 1, 890], ['Rolete de apoio', 4, 175], ['Graxa industrial (kg)', 3, 58]] }
    }[m.setor] || { tec: 2, h: 4, hp: 3, p: [['Peça de reposição', 1, 500]] };
    return { maquina: m.id, nome: m.nome, setor: m.setor, custoParadaHora: m.custoParada, valorHora: 85, tecnicos: P.tec, horas: P.h, horasParada: P.hp,
      pecas: P.p.map(([nome, qtd, valor]) => ({ nome, qtd, valor })), terceiros: 0, contingencia: 10, fatores: { mo: 1.5, pecas: 1.4, parada: 3 } };
  }

  const R = [], on = (m, p, f) => R.push([m, new RegExp('^' + p.replace(/:(\w+)/g, '([^/]+)') + '$'), f]);

  on('POST', '/auth/login', (_, __, b) => {
    const email = (b.usuario || '').trim().toLowerCase(), u = usuariosDemo().find(x => x.ativo !== false && (x.email === email || x.matricula === email));
    if (!email || !b.senha) throw new Error('Preencha e-mail (ou matrícula) e senha.');
    if (!u || u.senha !== b.senha) throw new Error('E-mail ou senha incorretos.');
    if (!u.perfis.includes(b.perfil)) throw new Error('Este usuário não tem acesso ao perfil ' + b.perfil + '.');
    return { token: 'token-de-demonstracao', usuario: { nome: u.nome, email: u.email, perfil: b.perfil, setor: b.perfil === 'funcionario' ? (u.setor || 'Estamparia') : null } };
  });
  on('POST', '/auth/recuperar', () => ({ ok: true }));

  /* Usuários e avisos (demonstração): ficam no localStorage junto com o resto */
  const usuariosDemo = () => { if (!db.usuarios) { db.usuarios = USUARIOS.map((u, i) => ({ id: i + 1, ativo: true, setor: null, ...u })); db.avisos = []; } return db.usuarios; };
  const semSenha = ({ senha, ...u }) => u;
  const eu = () => { try { return JSON.parse(localStorage.getItem('pm_user')) || {}; } catch { return {}; } };
  on('GET', '/setores', () => [...new Set(db.maquinas.map(m => m.setor))].sort());
  on('GET', '/users', (_, P) => usuariosDemo().filter(u => (!P.q || (u.nome + u.email + u.matricula).toLowerCase().includes(P.q.toLowerCase())) && (!P.perfil || u.perfis.includes(P.perfil)) && (P.ativo === undefined || String(+u.ativo) === P.ativo)).map(semSenha));
  on('POST', '/users', (_, __, b) => {
    const L = usuariosDemo();
    if (!b.nome || !b.email || !b.matricula) throw new Error('Informe nome, e-mail e matrícula.');
    if (L.some(u => u.email === b.email.toLowerCase() || u.matricula === b.matricula)) throw new Error('Já existe um registro com esses dados.');
    if ((b.perfis || []).includes('funcionario') && !b.setor) throw new Error('Escolha o setor do funcionário.');
    const u = { id: Math.max(...L.map(x => x.id)) + 1, nome: b.nome, email: b.email.toLowerCase(), matricula: b.matricula, senha: b.senha || 'senai@123', perfis: b.perfis, setor: b.setor || null, ativo: true };
    L.push(u); save(); return semSenha(u);
  });
  on('PUT', '/users/:id', ([id], _, b) => { const u = usuariosDemo().find(x => x.id === +id); if (!u) throw new Error('Usuário não encontrado.'); Object.assign(u, Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined))); save(); return semSenha(u); });
  on('DELETE', '/users/:id', ([id]) => { const u = usuariosDemo().find(x => x.id === +id); if (!u) throw new Error('Usuário não encontrado.'); if (u.email === eu().email) throw new Error('Você não pode desativar o seu próprio usuário.'); u.ativo = false; save(); return { mensagem: 'Usuário desativado.' }; });
  const avisoOut = a => ({ ...a, para: (usuariosDemo().find(u => u.id === a.dest) || {}).nome });
  on('GET', '/notificacoes', () => { usuariosDemo(); const me = usuariosDemo().find(u => u.email === eu().email); const itens = db.avisos.filter(a => me && a.dest === me.id).map(avisoOut); return { naoLidas: itens.filter(a => !a.lida).length, itens }; });
  on('GET', '/notificacoes/enviadas', (_, P) => { usuariosDemo(); return db.avisos.filter(a => !P.usuario || a.dest === +P.usuario).map(avisoOut); });
  on('POST', '/notificacoes', (_, __, b) => {
    usuariosDemo(); if (!b.titulo) throw new Error('Escreva o título do alerta.');
    const d = new Date(), m = db.maquinas.find(x => x.id === b.maquina);
    const a = { id: Date.now(), dest: +b.destinatario, prioridade: b.prioridade === 'urgente' ? 'urgente' : 'normal', titulo: b.titulo, mensagem: b.mensagem || '', maquina: m ? m.id : null, maquinaNome: m ? m.nome : null, de: eu().nome || 'Gestor', quando: dm(d) + ' ' + hm(d), lida: false };
    db.avisos.unshift(a); save(); return avisoOut(a);
  });
  on('PATCH', '/notificacoes/lidas', () => { usuariosDemo(); const me = usuariosDemo().find(u => u.email === eu().email); db.avisos.forEach(a => { if (me && a.dest === me.id) a.lida = true; }); save(); return { ok: true }; });
  on('PATCH', '/notificacoes/:id/lida', ([id]) => { usuariosDemo(); const a = db.avisos.find(x => x.id === +id); if (a) a.lida = true; save(); return { ok: true }; });
  on('GET', '/busca', (_, P) => {
    const t = (P.q || '').toLowerCase(), out = [];
    db.maquinas.filter(m => (m.id + m.nome).toLowerCase().includes(t)).forEach(m => out.push({ tipo: 'Máquina', titulo: m.id + ' · ' + m.nome, sub: m.setor, href: '/maquinas?id=' + m.id }));
    db.ordens.filter(o => (o.id + o.titulo + o.ativo).toLowerCase().includes(t)).slice(0, 4).forEach(o => out.push({ tipo: 'Ordem de serviço', titulo: o.id + ' · ' + o.titulo, sub: o.ativo, href: '/ordens?os=' + o.id }));
    db.alertas.filter(a => (a.titulo + a.ativo).toLowerCase().includes(t)).forEach(a => out.push({ tipo: 'Alerta', titulo: a.titulo, sub: a.ativo, href: '/alertas?id=' + a.id }));
    return out.slice(0, 8);
  });
  on('GET', '/planta/resumo', () => { const c = { criticos: 0, atencao: 0, normais: 0 }; db.maquinas.forEach(m => { const s = stS(m.saude); c[s === 'critico' ? 'criticos' : s === 'atencao' ? 'atencao' : 'normais']++; }); return c; });

  on('GET', '/dashboard', () => {
    const o = k => db.ordens.filter(x => x.status === k).length, abertas = o('aberta'), and = o('andamento'), pec = o('peca'), conc = o('concluida');
    const vencidas = db.ordens.filter(x => osOut(x).vencida).length;
    const sv = serie('PH-03', 'vibracao');
    return {
      kpis: [
        { k: 'disp', rotulo: 'Disponibilidade', valor: 96.4, unidade: '%', casas: 1, sub: 'Meta: 95%', meta: 95, escalaMin: 92, historico: wk([94.8, 95.2, 95.9, 96.8, 95.7, 96.1, 96.0, 96.4]), explica: 'Percentual do tempo em que as máquinas ficaram prontas para produzir. Despenca quando uma parada que ninguém previu acontece.' },
        { k: 'mtbf', rotulo: 'MTBF', valor: 412, unidade: ' h', casas: 0, sub: 'Tempo médio entre falhas', escalaMin: 340, historico: wk([372, 380, 391, 388, 402, 398, 407, 412]), explica: 'Quanto tempo, em média, uma máquina roda entre uma falha e a próxima. Quanto maior, melhor.' },
        { k: 'mttr', rotulo: 'MTTR', valor: 3.8, unidade: ' h', casas: 1, sub: 'Tempo médio de reparo', escalaMin: 3, historico: wk([4.6, 4.4, 4.5, 4.1, 4.0, 3.9, 3.9, 3.8]), explica: 'Quanto tempo a equipe leva, em média, para devolver a máquina à produção. Quanto menor, melhor.' },
        { k: 'os', rotulo: 'OS abertas', valor: abertas + and + pec, unidade: '', casas: 0, sub: vencidas + ' com prazo vencido', escalaMin: 10, historico: wk([14, 15, 13, 17, 16, 19, 17, abertas + and + pec]), explica: 'Ordens de serviço ainda não concluídas (abertas, em andamento e aguardando peça). As vencidas passaram do prazo combinado.' }
      ],
      vibracao: { maquina: 'PH-03', grandeza: 'Vibração', unidade: 'mm/s', limite: sv.limite, pontos: sv.pontos },
      alertas: db.alertas.filter(a => a.estado === 'novo').sort((a, b) => a.min - b.min).slice(0, 4),
      todosAlertas: db.alertas,
      saude: [...db.maquinas].sort((a, b) => a.saude - b.saude).map(m => ({ id: m.id, nome: m.nome, setor: m.setor, saude: m.saude, status: stS(m.saude) })),
      osPorStatus: { abertas, andamento: and, peca: pec, concluidas: conc, vencidas, proximas: db.ordens.filter(x => x.status !== 'concluida').sort((a, b) => a.prazo.split('/').reverse().join('').localeCompare(b.prazo.split('/').reverse().join(''))).slice(0, 5).map(osOut) },
      maquinas: db.maquinas.map(m => ({ id: m.id, nome: m.nome }))
    };
  });

  on('GET', '/maquinas', (_, P) => {
    let l = db.maquinas.map(m => ({ ...m, status: stS(m.saude) }));
    if (P.setor) l = l.filter(m => m.setor === P.setor);
    if (P.status) l = l.filter(m => m.status === P.status);
    const ord = P.ordem || 'saude';
    l.sort((a, b) => ord === 'saude' ? a.saude - b.saude : ord === 'codigo' ? a.id.localeCompare(b.id) : a.setor.localeCompare(b.setor) || a.id.localeCompare(b.id));
    return l;
  });
  on('GET', '/maquinas/:id', ([id]) => {
    const m = maq(id); if (!m) throw new Error('Máquina não encontrada.');
    return { ...m, status: stS(m.saude), medicoes: db.medicoes.filter(x => x.maquina === id).slice(0, 5).map(x => ({ ...x, nome: LIM[x.grandeza].nome, unidade: LIM[x.grandeza].un, situacao: sit(x.grandeza, x.valor) })), ordens: db.ordens.filter(o => o.ativo === id && o.status !== 'concluida').map(osOut) };
  });
  on('POST', '/maquinas', (_, __, b) => {
    const id = (b.id || '').trim().toUpperCase();
    if (!id || !b.nome || !b.setor) throw new Error('Informe código, nome e setor.');
    if (maq(id)) throw new Error('Já existe uma máquina com o código ' + id + '.');
    const m = { id, nome: b.nome, setor: b.setor, saude: 100, ultima: 'Sem medição', prox: toDM(b.prox) || '—', custoParada: +b.custoParada || 0, tend: 0 };
    db.maquinas.push(m); save(); return m;
  });

  on('GET', '/medicoes', (_, P) => db.medicoes.filter(x => (!P.maquina || x.maquina === P.maquina)).slice(0, +P.limite || 8).map(x => ({ ...x, nome: LIM[x.grandeza].nome, unidade: LIM[x.grandeza].un, situacao: sit(x.grandeza, x.valor) })));
  on('GET', '/medicoes/serie', (_, P) => serie(P.maquina, P.grandeza));
  on('POST', '/medicoes', (_, __, b) => {
    const m = maq(b.maquina), L = LIM[b.grandeza], v = Number(b.valor);
    if (!m || !L) throw new Error('Escolha a máquina e a grandeza.');
    if (!isFinite(v)) throw new Error('O valor precisa ser um número.');
    const d = b.data ? new Date(b.data) : new Date();
    const med = { id: ++db.seqMed, data: dm(d) + ' ' + hm(d), maquina: m.id, grandeza: b.grandeza, valor: v, obs: b.obs || '', novo: true };
    db.medicoes.unshift(med); m.ultima = 'Hoje ' + hm(d);
    const s = sit(b.grandeza, v); let alertaCriado = false;
    if (s === 'critico' && !db.alertas.some(a => a.ativo === m.id && a.titulo === L.nome + ' acima do limite')) {
      db.alertas.unshift({ id: ++db.seqAl, nivel: 'critico', titulo: L.nome + ' acima do limite', ativo: m.id, ha: 'agora', min: 0, estado: 'novo', medido: v + ' ' + L.un, limite: L.limite + ' ' + L.un, previsao: 'A calcular', acao: 'Inspecionar a máquina e confirmar a leitura.' });
      alertaCriado = true;
    }
    save(); return { medicao: { ...med, nome: L.nome, unidade: L.un, situacao: s }, situacao: s, alertaCriado };
  });

  on('GET', '/alertas', (_, P) => db.alertas.filter(a => !P.setor || (maq(a.ativo) || {}).setor === P.setor).map(a => ({ ...a, setor: (maq(a.ativo) || {}).setor, maquina: (maq(a.ativo) || {}).nome })));
  on('PATCH', '/alertas/:id/reconhecer', ([id]) => { const a = db.alertas.find(x => x.id == id); if (!a) throw new Error('Alerta não encontrado.'); a.estado = 'reconhecido'; save(); return a; });
  on('GET', '/limites', () => db.limites);
  on('PUT', '/limites', (_, __, b) => { Object.keys(b).forEach(k => { if (db.limites[k]) { db.limites[k].limite = +b[k].limite; db.limites[k].atencao = +b[k].atencao; LIM[k].limite = +b[k].limite; LIM[k].atencao = +b[k].atencao; } }); save(); return db.limites; });

  on('GET', '/ordens', (_, P) => db.ordens.filter(o => (!P.equipe || o.equipe === P.equipe) && (!P.prioridade || o.prioridade === P.prioridade)).map(osOut));
  on('POST', '/ordens', (_, __, b) => {
    const m = maq(b.ativo); if (!b.titulo || !m) throw new Error('Informe o título e a máquina.');
    const id = 'OS-' + String(++db.seqOS).padStart(4, '0'), p = new Date(); p.setDate(p.getDate() + 7);
    const os = { id, titulo: b.titulo, ativo: m.id, equipe: b.equipe || EQUIPE_SETOR[m.setor] || 'Mecânica', prazo: toDM(b.prazo) || '29/10', prioridade: b.prioridade || 'media', status: 'aberta', descricao: b.descricao || '', alertaId: b.alertaId };
    db.ordens.unshift(os); save(); return osOut(os);
  });
  on('PATCH', '/ordens/:id', ([id], _, b) => { const o = db.ordens.find(x => x.id === id); if (!o) throw new Error('OS não encontrada.'); Object.assign(o, b); save(); return osOut(o); });

  on('GET', '/planta', (_, P) => {
    const h = Math.min(0, +P.horas || 0), zonas = {};
    db.maquinas.forEach(m => { const s = Math.max(5, Math.min(100, Math.round(m.saude - m.tend * h))); (zonas[m.setor] = zonas[m.setor] || []).push({ id: m.id, nome: m.nome, saude: s, status: stS(s) }); });
    return { horas: h, zonas: Object.entries(zonas).map(([nome, maquinas]) => ({ nome, maquinas })) };
  });
  on('GET', '/planta/:id/preditivo', ([id]) => {
    const m = maq(id); if (!m) throw new Error('Máquina não encontrada.');
    const C = { 'PH-03': [['Vibração no mancal', 52], ['Temperatura do óleo', 28], ['Corrente do motor', 20]], 'CP-01': [['Temperatura do óleo', 55], ['Corrente do motor', 25], ['Vibração no mancal', 20]], 'ET-07': [['Corrente do motor', 60], ['Vibração no mancal', 25], ['Temperatura do óleo', 15]] }[id] || [['Vibração no mancal', 40], ['Temperatura do óleo', 35], ['Corrente do motor', 25]];
    return { id, nome: m.nome, status: stS(m.saude), rulDias: id === 'PH-03' ? 6 : Math.max(2, Math.round(Math.pow(m.saude / 100, 2) * 90)), confianca: id === 'PH-03' ? 87 : 80 + hash(id) % 15, causas: C.map(([nome, pct]) => ({ nome, pct })) };
  });

  on('GET', '/orcamento/base/:id', ([id]) => orcBase(id));
  on('GET', '/orcamento/resumo', () => db.maquinas.map(m => {
    const b = orcBase(m.id), prev = calcOrcamento(b).total, cor = calcOrcamento(b, true).total;
    return { maquina: m.id, nome: m.nome, setor: m.setor, saude: m.saude, status: stS(m.saude), preventivo: prev, corretivo: cor, risco: cor * (1 - m.saude / 100) };
  }));
  on('GET', '/orcamento', () => db.orcamentos);
  on('POST', '/orcamento', (_, __, b) => { const o = { id: 'ORC-' + String(++db.seqOrc).padStart(3, '0'), data: dm(new Date()), ...b }; db.orcamentos.unshift(o); save(); return o; });

  const etapas = ['Registrado', 'Triado pelo gestor', 'Técnico designado', 'Em reparo', 'Concluído'], idx = { 'Registrado': 0, 'Triado': 1, 'Técnico designado': 2, 'Em reparo': 3, 'Concluído': 4 };
  const chOut = c => {
    const a = idx[c.situacao] ?? 0;
    return { ...c, timeline: etapas.map((nome, i) => ({ nome, estado: i < a || (i === a && a === 4) ? 'feito' : i === a ? 'atual' : 'pendente', quando: i === 0 ? c.aberto + ' · por você' : (c.eventos[i] || [i <= a ? c.aberto : '', ''])[0], detalhe: (c.eventos[i] || ['', ''])[1] })) };
  };
  on('GET', '/chamados', () => db.chamados.map(chOut));
  on('POST', '/chamados', (_, __, b) => {
    if (!b.maquina || !b.descricao) throw new Error('Escolha a máquina e descreva o que está acontecendo.');
    const d = new Date(), c = { id: 'CH-' + (++db.seqCH), maquina: b.maquina, problema: b.problema || 'Outro', urgencia: b.urgencia, situacao: 'Registrado', aberto: dm(d) + ' ' + hm(d), setor: b.setor || 'Estamparia', descricao: b.descricao, comentarios: [], eventos: {} };
    db.chamados.unshift(c); save(); return chOut(c);
  });
  on('POST', '/chamados/:id/comentarios', ([id], _, b) => { const c = db.chamados.find(x => x.id === id); if (!c) throw new Error('Chamado não encontrado.'); const d = new Date(); c.comentarios.push({ quando: dm(d) + ' ' + hm(d), texto: b.texto }); save(); return chOut(c); });

  async function mockImpl(method, url, body) {
    if (!db) load();
    await new Promise(r => setTimeout(r, 110));
    if (typeof FormData !== 'undefined' && body instanceof FormData) body = JSON.parse(body.get('dados'));
    const [path, qs] = url.split('?'), P = Object.fromEntries(new URLSearchParams(qs || ''));
    for (const [m, re, f] of R) {
      if (m !== method) continue;
      const x = re.exec(path);
      if (x) return JSON.parse(JSON.stringify(f(x.slice(1).map(decodeURIComponent), P, body || {}) ?? {}));
    }
    throw new Error('Rota de demonstração não encontrada: ' + method + ' ' + path);
  }

export const mock = mockImpl;
export function mockReset() { localStorage.removeItem(KEY); location.reload(); }
