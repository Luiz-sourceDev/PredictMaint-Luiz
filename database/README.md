# Banco de dados · PredictMaint

MySQL 8. Banco: **`predictmaint`**.

| Arquivo | O que faz |
| --- | --- |
| `init/01-schema.sql` | Cria o banco, as tabelas e as views (apaga e recria tudo). |
| `init/02-seed.sql` | Dados de exemplo — os mesmos do modo demonstração do front. |

## Como rodar

**Docker:** os dois arquivos rodam sozinhos na primeira subida do container.
Para recriar do zero:

```bash
docker compose down -v
docker compose up -d database
```

**XAMPP / MySQL Workbench:** execute `01-schema.sql` e depois `02-seed.sql`.
No `backend/.env`, use `DB_NAME=predictmaint`.

## Logins de teste

| E-mail | Matrícula | Senha | Perfis |
| --- | --- | --- | --- |
| admin@mantech.com.br | adm001 | Mantech@2026 | gestor, técnico, funcionário |
| funcionario@mantech.com.br | fun001 | Func@2026 | funcionário (Estamparia) |
| tecnico@mantech.com.br | tec001 | Tec@2026 | técnico |

As senhas estão salvas com **bcrypt** (`senha_hash`). No login, o backend compara com
`bcrypt.compare(senhaDigitada, usuario.senha_hash)` — nunca grave senha em texto puro.

## Diagrama (DER)

```mermaid
erDiagram
  equipes ||--o{ setores : "equipe padrão"
  equipes ||--o{ ordens_servico : executa
  setores ||--o{ maquinas : contém
  setores ||--o{ usuarios : "lotação"
  setores ||--o{ setor_pecas_padrao : usa
  pecas   ||--o{ setor_pecas_padrao : ""
  usuarios ||--o{ usuario_perfis : tem
  maquinas ||--o{ medicoes : recebe
  grandezas ||--o{ medicoes : mede
  maquinas ||--o{ alertas : gera
  medicoes |o--o{ alertas : dispara
  maquinas ||--o{ ordens_servico : ""
  alertas  |o--o{ ordens_servico : origina
  chamados |o--o{ ordens_servico : origina
  maquinas ||--o{ chamados : ""
  usuarios ||--o{ chamados : abre
  chamados ||--o{ chamado_eventos : "linha do tempo"
  chamados ||--o{ chamado_comentarios : ""
  maquinas ||--o{ orcamentos : ""
```

## Tabelas

| Tabela | Tela que usa | Observação |
| --- | --- | --- |
| `maquinas` | Máquinas, Planta, Dashboard | `codigo` (PH-03) é o "id" que o front mostra. Status sai da `saude`. |
| `setores`, `equipes` | Filtros, OS, Orçamento | Setor guarda os parâmetros padrão do orçamento. |
| `usuarios`, `usuario_perfis` | Login | Um usuário pode ter vários perfis. |
| `grandezas` | Medições, Alertas › Limites | Vibração, temperatura, corrente e seus limites. |
| `medicoes` | Medições, gráficos | 11 pontos por máquina e grandeza no seed. |
| `alertas` | Alertas, Dashboard | `estado`: novo, reconhecido, resolvido. |
| `ordens_servico` | Ordens (Kanban) | Código exibido: `OS-` + id com 4 dígitos. |
| `chamados`, `chamado_eventos`, `chamado_comentarios` | Abrir chamado, Meus chamados | Código exibido: `CH-` + id. |
| `pecas`, `setor_pecas_padrao`, `orcamentos` | Orçamento | `detalhes` guarda os parâmetros do cálculo em JSON. |

## Views (atalho para o backend)

As views já devolvem os campos com os nomes que o front espera:

- `vw_maquinas` — `id` (código), `setor`, `status` calculado, `custoParada`, `tend`, `prox`
- `vw_medicoes` — com `nome`, `unidade` e `situacao` (normal/atencao/critico)
- `vw_alertas` — com `ativo`, `setor` e `min` (minutos desde o alerta)
- `vw_ordens` — `id` no formato `OS-0241` e `vencida`
- `vw_chamados` — `id` no formato `CH-1042`

Exemplo no controller: `SELECT * FROM vw_maquinas WHERE setor = ? ORDER BY saude`.

## Regras importantes

- **Excluir máquina:** máquinas com chamados, OS ou orçamentos não podem ser apagadas
  (a chave estrangeira bloqueia). Use `UPDATE maquinas SET ativo = FALSE` — elas somem
  da `vw_maquinas` e o histórico fica preservado.
- `saude` só aceita 0 a 100 e `limite_atencao` precisa ser menor que `limite_critico`.
- As datas do seed são relativas ao dia em que ele roda, então a demo nunca fica vencida.
