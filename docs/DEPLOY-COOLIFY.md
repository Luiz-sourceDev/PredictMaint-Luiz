# Homologação no Coolify · PredictMaint

Guia para subir o sistema completo (banco + API + site) no servidor Coolify
usando o `docker-compose.yml` da raiz do repositório.

## 1. Criar o recurso

1. No Coolify: **Projects › (projeto da turma) › + New › Docker Compose** a partir do repositório Git.
2. Repositório: `Luiz-sourceDev/PredictMaint-Luiz` (ou o oficial, depois do merge) · branch `feat/banco-completo`.
3. Arquivo: `docker-compose.yml` (o `docker-compose.override.yml` é só para os PCs da equipe e o Coolify o ignora).

## 2. Domínios

Em cada serviço do compose, defina o domínio público:

| Serviço | Porta interna | Exemplo de domínio |
| --- | --- | --- |
| `frontend` | 3000 | `https://predictmaint.seudominio.com` |
| `backend` | 8080 | `https://api-predictmaint.seudominio.com` |
| `database` | 3306 | **sem domínio** (fica só na rede interna) |

## 3. Variáveis de ambiente

| Variável | Valor na homologação | Observação |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api-predictmaint.seudominio.com/api` | **Entra no build do site.** Se mudar, faça *Redeploy* com rebuild. Termina em `/api`. |
| `FRONTEND_URL` | `https://predictmaint.seudominio.com` | Libera o site no CORS da API. Mais de um: separe por vírgula. |
| `JWT_SECRET` | texto longo e aleatório | Assina os logins. Trocar derruba as sessões abertas. |
| `TZ` | `America/Sao_Paulo` | Horário do banco e da API. |
| `MYSQL_ROOT_PASSWORD` · `MYSQL_PASSWORD` · `DB_PASSWORD` | `senai@123` | Padrão da equipe. `MYSQL_PASSWORD` e `DB_PASSWORD` precisam ser iguais. |
| `MYSQL_DATABASE` · `DB_NAME` | `predictmaint` | |
| `MYSQL_USER` · `DB_USER` | `app_user` | |
| `DB_HOST` | `database` | Nome do serviço no compose. |

Não use `localhost` em nenhuma URL: no servidor, `localhost` é o próprio container.

## 4. Primeiro deploy

1. Clique em **Deploy** e acompanhe os logs.
2. Na primeira subida, o MySQL roda `database/init/01-schema.sql` e `02-seed.sql`
   (16 tabelas, 5 views e os dados de demonstração).
3. A API espera o banco ficar saudável, aplica as migrações (`backend/src/config/migracoes.js`)
   e mostra `API do PredictMaint rodando na porta 8080`.
4. Confira: `https://api-predictmaint.seudominio.com/api/health` deve responder com o banco conectado.
5. Abra o site e entre com os logins de teste (senha `senai@123`):
   `admin@mantech.com.br` (gestor) · `tecnico@mantech.com.br` (técnico) · `funcionario@mantech.com.br` (funcionário).

## 5. Atualizações seguintes

- **Redeploy** mantém os volumes: os dados do banco (`mysql-data`) e as fotos dos chamados (`uploads`) não se perdem.
- Os scripts de `database/init` **não** rodam de novo num volume que já tem dados.
  Por isso, mudanças de estrutura novas vão também em `migracoes.js` (com `IF NOT EXISTS`),
  e a API as aplica sozinha ao reiniciar.
- Para zerar a homologação e voltar ao seed: apague o volume `mysql-data` do recurso no Coolify e faça Deploy.

## 6. Problemas comuns

| Sintoma | Causa provável | Como resolver |
| --- | --- | --- |
| Site abre em "modo demonstração" | `NEXT_PUBLIC_API_URL` vazio no build | Preencha a variável e faça Redeploy com rebuild. |
| Erro de CORS no console | `FRONTEND_URL` diferente do domínio do site | Use exatamente o domínio do site, com `https://`, sem barra no final. |
| `/api/health` sem banco | Senha do `DB_PASSWORD` diferente de `MYSQL_PASSWORD` | Deixe as duas iguais. Se o volume já foi criado com outra senha, apague o volume e faça Deploy. |
| Login cai sozinho | `JWT_SECRET` foi trocado | Normal: entre de novo. |
| Usuário não consegue entrar | Foi desativado na tela Usuários | O gestor reativa em Usuários › Situação: Desativados › Reativar. |
