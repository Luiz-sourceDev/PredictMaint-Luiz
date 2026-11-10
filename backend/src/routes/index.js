/* Todas as rotas da API, no mesmo formato de frontend/src/lib/api.jsx.
   Quem pode usar cada rota:
     livre        -> login, recuperar senha, health
     logado       -> qualquer perfil (gestor, técnico e funcionário)
     gestão       -> gestor e técnico (consultar e operar o dia a dia)
     gestor       -> só gestor (cadastros, custos, limites, usuários e avisos) */
import { Router } from "express";

import * as alertas from "../controllers/alertasController.js";
import * as auth from "../controllers/authController.js";
import * as chamados from "../controllers/chamadosController.js";
import { healthCheck } from "../controllers/healthController.js";
import * as maquinas from "../controllers/maquinasController.js";
import * as medicoes from "../controllers/medicoesController.js";
import * as notificacoes from "../controllers/notificacoesController.js";
import * as orcamento from "../controllers/orcamentoController.js";
import * as ordens from "../controllers/ordensController.js";
import * as painel from "../controllers/painelController.js";
import * as users from "../controllers/usersController.js";
import { autenticar, permitir } from "../middlewares/auth.js";
import { uploadFoto } from "../middlewares/upload.js";

const r = Router();
const gestao = permitir("gestor", "tecnico");
const gestor = permitir("gestor");

// ---- livre
r.get("/health", healthCheck);
r.post("/auth/login", auth.login);
r.post("/auth/recuperar", auth.recuperarSenha);

// ---- daqui para baixo precisa estar logado
r.use(autenticar);

// Máquinas (o funcionário também lista, para abrir chamado)
r.get("/maquinas", maquinas.getMaquinas);
r.get("/maquinas/:id", maquinas.getMaquina);
r.post("/maquinas", gestor, maquinas.createMaquina);
r.put("/maquinas/:id", gestor, maquinas.updateMaquina);
r.delete("/maquinas/:id", gestor, maquinas.deleteMaquina);

// Alertas (o funcionário vê os do setor dele na tela de chamado)
r.get("/alertas", alertas.getAlertas);
r.patch("/alertas/:id/reconhecer", gestao, alertas.reconhecerAlerta);
r.get("/limites", gestao, alertas.getLimites);
r.put("/limites", gestor, alertas.salvarLimites);

// Chamados
r.get("/chamados", chamados.getChamados);
r.post("/chamados", uploadFoto, chamados.createChamado);
r.post("/chamados/:id/comentarios", chamados.comentarChamado);

// Área de gestão
r.get("/busca", gestao, painel.busca);
r.get("/dashboard", gestao, painel.getDashboard);
r.get("/planta/resumo", gestao, painel.getResumoPlanta);
r.get("/planta", gestao, painel.getPlanta);
r.get("/planta/:id/preditivo", gestao, painel.getPreditivo);

r.get("/medicoes", gestao, medicoes.getMedicoes);
r.get("/medicoes/serie", gestao, medicoes.getSerie);
r.post("/medicoes", gestao, medicoes.createMedicao);

r.get("/ordens", gestao, ordens.getOrdens);
r.post("/ordens", gestor, ordens.createOrdem);
r.patch("/ordens/:id", gestao, ordens.updateOrdem);

r.get("/orcamento/base/:id", gestor, orcamento.getBase);
r.get("/orcamento/resumo", gestor, orcamento.getResumo);
r.get("/orcamento", gestor, orcamento.getOrcamentos);
r.post("/orcamento", gestor, orcamento.salvarOrcamento);

// Setores (formulários de usuário e chamado)
r.get("/setores", painel.setores);

// Notificações: cada um lê as suas; só o gestor envia
r.get("/notificacoes", notificacoes.minhas);
r.patch("/notificacoes/lidas", notificacoes.marcarLida);
r.patch("/notificacoes/:id/lida", notificacoes.marcarLida);
r.get("/notificacoes/enviadas", gestor, notificacoes.enviadas);
r.post("/notificacoes", gestor, notificacoes.enviar);

// Usuários
r.get("/users", gestor, users.getUsers);
r.post("/users", gestor, users.createUsers);
r.put("/users/:id", gestor, users.updateUsers);
r.delete("/users/:id", gestor, users.deleteUsers);

export default r;
