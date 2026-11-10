# Backend · PredictMaint

API em Node.js + Express, ligada ao MySQL (`predictmaint`). Todas as respostas e erros
usam o formato que o front espera — erros sempre vêm como `{ "mensagem": "..." }`.

## Rodar

```bash
cd backend
npm install
cp .env.example .env   # ajuste DB_USER, DB_PASSWORD e JWT_SECRET
npm run dev            # http://localhost:8080
```

Teste rápido: abra `http://localhost:8080/api/health` — deve mostrar `"database": "connected"`.

## Login

`POST /api/auth/login` com `{ "usuario": "admin@mantech.com.br", "senha": "senai@123", "perfil": "gestor" }`
devolve um `token`. As outras rotas exigem o cabeçalho `Authorization: Bearer <token>`.
Os logins de teste estão em [`../database/README.md`](../database/README.md).

## Rotas

| Método | Rota | Quem pode | O que faz |
| --- | --- | --- | --- |
| GET | `/api/health` | livre | Testa API e banco |
| POST | `/api/auth/login` | livre | Login (devolve token) |
| POST | `/api/auth/recuperar` | livre | Pedido de nova senha |
| GET | `/api/dashboard` | gestão | Indicadores, alertas, saúde e OS |
| GET | `/api/busca?q=` | gestão | Busca máquinas, OS e alertas |
| GET | `/api/planta` · `/api/planta/resumo` | gestão | Mapa da planta (`?horas=-6` = replay) |
| GET | `/api/planta/:codigo/preditivo` | gestão | Vida útil estimada e causas |
| GET | `/api/maquinas` | logado | Lista (`?setor=&status=&ordem=saude\|codigo\|setor`) |
| GET | `/api/maquinas/:codigo` | logado | Detalhe com medições e OS abertas |
| POST | `/api/maquinas` | gestor | Cadastra (`id`, `nome`, `setor`, `prox`, `custoParada`) |
| PUT | `/api/maquinas/:codigo` | gestor | Atualiza campos enviados |
| DELETE | `/api/maquinas/:codigo` | gestor | Desativa (mantém histórico) |
| GET | `/api/medicoes` · `/api/medicoes/serie` | gestão | Últimas leituras / série do gráfico |
| POST | `/api/medicoes` | gestão | Registra leitura; acima do limite abre alerta |
| GET | `/api/alertas` | logado | Alertas não resolvidos (`?setor=`) |
| PATCH | `/api/alertas/:id/reconhecer` | gestão | Marca como reconhecido |
| GET · PUT | `/api/limites` | gestão · gestor | Limites de vibração, temperatura e corrente |
| GET | `/api/ordens` | gestão | Quadro de OS (`?equipe=&prioridade=&periodo=30`) |
| POST | `/api/ordens` | gestor | Cria OS (também pelo "Gerar OS" do alerta) |
| PATCH | `/api/ordens/:codigo` | gestão | Gestor muda tudo; técnico só o `status` |
| GET | `/api/orcamento/base/:codigo` · `/api/orcamento/resumo` | gestor | Parâmetros e comparativo |
| GET · POST | `/api/orcamento` | gestor | Orçamentos salvos |
| GET | `/api/chamados` | logado | Funcionário vê os seus; gestão vê todos |
| POST | `/api/chamados` | logado | Abre chamado (JSON ou com foto) e já cria a OS |
| POST | `/api/chamados/:codigo/comentarios` | logado | Comenta |
| GET | `/api/setores` | logado | Lista de setores (formulários) |
| GET | `/api/users` | gestor | Lista (`?q=` busca nome/e-mail/matrícula, `?perfil=`, `?ativo=1\|0`) |
| POST | `/api/users` | gestor | Cadastra (`nome`, `email`, `matricula`, `senha`, `perfis[]`, `setor`) |
| PUT | `/api/users/:id` | gestor | Edita dados, perfis, senha ou reativa (`ativo: true`) |
| DELETE | `/api/users/:id` | gestor | Desativa (mantém o histórico; o acesso cai na hora) |
| GET | `/api/notificacoes` | logado | Caixa de avisos de quem está logado (`naoLidas`, `itens`) |
| PATCH | `/api/notificacoes/:id/lida` · `/api/notificacoes/lidas` | logado | Marca um aviso (ou todos) como lido |
| POST | `/api/notificacoes` | gestor | Envia aviso (`destinatario`, `maquina`, `prioridade`, `titulo`, `mensagem`) |
| GET | `/api/notificacoes/enviadas` | gestor | Avisos enviados (`?usuario=`) |

"gestão" = perfis gestor e técnico. "gestor" = só gestor. "logado" = qualquer perfil.

Níveis de acesso (chaves liga/desliga na tela Usuários): usam o mesmo `PUT /api/users/:id`
com `perfis` ou `ativo`. A cada requisição a API confere se o usuário continua ativo **e** se
ainda tem o perfil com que entrou; se perdeu, a sessão cai na hora (401).

Proteções de usuários: o gestor não consegue desativar a si mesmo, nem tirar o próprio
perfil de gestor, e o sistema nunca fica sem nenhum gestor ativo. Funcionário precisa de setor.

## Atualização automática do banco

Ao iniciar, a API roda `src/config/migracoes.js`, que cria o que faltar no banco
(ex.: a tabela `notificacoes`) sem apagar nada. Assim um banco que já existia
(no Coolify ou no PC de alguém da equipe) recebe as novidades só reiniciando a API.

## Como as coisas se conectam

- **Chamado → OS:** ao abrir um chamado, a API cria uma OS ligada a ele (prioridade pela urgência).
  Quando a OS muda de status no quadro, a linha do tempo do chamado avança sozinha.
- **Medição → alerta:** leitura acima do limite crítico abre um alerta (sem duplicar se já houver um aberto).
- **Alerta → OS:** "Gerar OS" num alerta já o marca como reconhecido.

## Pastas

- `src/routes/index.js` — todas as rotas e permissões num lugar só
- `src/controllers/` — uma tela/assunto por arquivo
- `src/middlewares/` — login (`auth.js`), erros e upload de fotos
- `src/lib/` — formatação de datas e regras de negócio
- `uploads/` — fotos dos chamados (criada sozinha, fora do Git)
