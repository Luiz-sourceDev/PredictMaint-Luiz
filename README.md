# Projeto Base Full Stack

Template para alunos criarem forks com a mesma stack de frontend, backend e banco de dados.

## Configurar o ambiente num PC novo (Windows)

1. Baixe a pasta [`instalador/`](instalador/) (ou o zip que a equipe compartilha).
2. Dê dois cliques em `Configurar-Ambiente-PredictMaint.bat`.

Ele instala o que faltar (Git, Docker Desktop, VS Code, DBeaver e Node.js), baixa esta branch,
sobe banco + API + site no Docker, cria os atalhos "Iniciar/Parar PredictMaint", a conexão
"PredictMaint (Docker)" no DBeaver e abre o projeto no VS Code. Todas as senhas: `senai@123`.
Detalhes e solução de problemas: [`instalador/LEIA-ME.txt`](instalador/LEIA-ME.txt).

## Stack Padrao

- Frontend: Next.js `16.2.10` com JavaScript, sem Tailwind e sem Bootstrap por padrao.
- Backend: Node.js com Express em JavaScript.
- Banco de dados: MySQL.
- Deploy: Dockerfiles separados para frontend, backend e banco, facilitando criacao de servicos.

## Estrutura

```text
.
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── database/
│   ├── init/
│   │   └── 01-schema.sql
│   └── Dockerfile
├── frontend/
│   ├── src/app/
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml
```

## Como Rodar Localmente

1. Instale as dependencias:

```bash
cd backend
npm install

cd ../frontend
npm install
```

2. Copie os arquivos de ambiente:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

3. Suba o MySQL com Docker (se for rodar com XAMPP ou MySQL Community Server, ignorar passo):

```bash
docker compose up -d database
```

4. Rode o backend:

```bash
cd backend
npm run dev
```

5. Rode o frontend:

```bash
cd frontend
npm run dev
```

URLs padrao:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- Health check da API: `http://localhost:8080/api/health`
- MySQL: `localhost:3306`

## Rodando Tudo com Docker Compose

```bash
docker compose up --build
```

Esse comando sobe:

- `frontend` na porta `3000` por padrao
- `backend` na porta `8080` por padrao
- `database` na porta `3306` por padrao

## Variaveis de Ambiente

Docker Compose raiz (`.env`):

```env
FRONTEND_HOST_PORT=3000
BACKEND_HOST_PORT=8080
DATABASE_HOST_PORT=3306

FRONTEND_PORT=3000
BACKEND_PORT=8080

FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8080/api

MYSQL_ROOT_PASSWORD=senai@123
MYSQL_DATABASE=app_db
MYSQL_USER=app_user
MYSQL_PASSWORD=senai@123

DB_HOST=database
DB_PORT=3306
DB_USER=app_user
DB_PASSWORD=senai@123
DB_NAME=app_db
```

Para rodar varios grupos no mesmo servidor, mude pelo menos as portas publicadas no host e a URL publica da API. Exemplo para um segundo grupo:

```env
FRONTEND_HOST_PORT=3001
BACKEND_HOST_PORT=8081
DATABASE_HOST_PORT=3307
FRONTEND_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:8081/api
```

As portas internas podem continuar nos defaults (`FRONTEND_PORT=3000` e `BACKEND_PORT=8080`) na maioria dos casos. Altere as portas internas apenas se o Coolify ou a arquitetura escolhida exigirem.

Backend (`backend/.env`):

```env
PORT=8080
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=app_user
DB_PASSWORD=senai@123
DB_NAME=app_db
```

Frontend (`frontend/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

No Docker Compose, o backend usa `DB_HOST=database`, porque esse e o nome do servico MySQL na rede Docker.

## Backend

Scripts principais:

```bash
npm run dev
npm start
```

Rotas, login e permissoes: veja [`backend/README.md`](backend/README.md).

- `GET /api/health` retorna status da API e testa a conexao com MySQL.

Pastas padrao:

- `src/config`: configuracoes e conexoes externas.
- `src/controllers`: funcoes que tratam requisicoes.
- `src/routes`: definicao das rotas HTTP.
- `src/middlewares`: middlewares compartilhados.

## Frontend

Scripts principais:

```bash
npm run dev
npm run build
npm start
npm run lint
```

Com `NEXT_PUBLIC_API_URL` preenchido em `frontend/.env.local`, o front usa a API e o banco de verdade.
Se a variavel ficar vazia, o front roda em modo demonstracao (dados de `src/lib/mock.jsx`, sem backend).

O projeto esta sem Tailwind e sem Bootstrap por padrao. Cada aluno pode instalar e configurar a biblioteca CSS escolhida conforme a necessidade do projeto.

## Banco de Dados

Os arquivos `database/init/01-schema.sql` (estrutura) e `02-seed.sql` (dados de exemplo) criam o banco `predictmaint` quando o container MySQL sobe pela primeira vez. Detalhes, DER e logins de teste em [`database/README.md`](database/README.md).

Para reiniciar o banco local do zero:

```bash
docker compose down -v
docker compose up -d database
```

## Deploy no Coolify

Passo a passo completo da homologação (compose inteiro, domínios e variáveis): [`docs/DEPLOY-COOLIFY.md`](docs/DEPLOY-COOLIFY.md).

Crie servicos separados apontando para os Dockerfiles:

- Frontend: `frontend/Dockerfile`
- Backend: `backend/Dockerfile`
- Banco: preferencialmente use o servico gerenciado de MySQL do Coolify. Se quiser usar a imagem do repo, use `database/Dockerfile`.

Configure no Coolify as variaveis de ambiente equivalentes aos arquivos `.env.example`. No backend, `DB_HOST` deve apontar para o host/nome interno do servico MySQL no Coolify.

Para cada grupo, configure valores diferentes para:

- `FRONTEND_HOST_PORT`
- `BACKEND_HOST_PORT`
- `DATABASE_HOST_PORT`, se estiver publicando MySQL no host
- `FRONTEND_URL`
- `NEXT_PUBLIC_API_URL`

Em deploy com dominio/reverse proxy, `NEXT_PUBLIC_API_URL` deve apontar para a URL publica real do backend, por exemplo `https://api-grupo-01.seudominio.com/api`.

## Observacoes Para Alunos

- Nao versionar arquivos `.env`.
- Nao versionar `node_modules`, `.next` ou arquivos de build.
- Manter o backend em JavaScript.
- Instalar Tailwind ou Bootstrap apenas se o projeto precisar.
